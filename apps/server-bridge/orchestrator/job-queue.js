import { TheBrain } from './agents/the-brain.js';
import crypto from 'crypto';
import IORedis from 'ioredis';
import { Job, Queue, Worker } from 'bullmq';
import { logger } from '../utils/logger.js';
import {
  recordQueueBackpressureMetric,
  recordQueueJobMetric,
  setQueueConsumerMetric,
  setQueueDepthMetric,
} from '../utils/metrics.js';
import {
  getTraceContext,
  runWithTraceContext,
  setTraceStep,
  setTraceUser,
  withSpan,
} from '../utils/tracing.js';

const QUEUE_NAME = process.env.CODE_QUEUE_NAME || 'code-orchestration';
const IDEMPOTENCY_TTL_SECONDS = Number.parseInt(process.env.IDEMPOTENCY_TTL_SECONDS || '3600', 10);
const DEFAULT_LANE = 'interactive';
const QUEUE_LANES = Object.freeze({
  interactive: 'interactive',
  background: 'background',
});

function connection() {
  return new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  });
}

function idempotencyJobId(userId, idempotencyKey, lane = DEFAULT_LANE) {
  return `${lane}:${crypto
    .createHash('sha256')
    .update(`${userId}:${idempotencyKey}`)
    .digest('hex')}`;
}

export function createCodeQueue({
  processor,
  io,
  queueFactory = Queue,
  workerFactory = Worker,
  jobLookup = Job,
  redisFactory = connection,
  brainFactory = () => new TheBrain(),
} = {}) {
  if (!process.env.REDIS_URL) {
    logger.info('Code queue disabled; /api/code will run inline');
    return null;
  }

  const queueConnection = redisFactory();
  const interactiveWorkerConnection = redisFactory();
  const backgroundWorkerConnection = redisFactory();
  const dlqConnection = redisFactory();
  const idempotencyRedis = redisFactory();

  const queueNames = buildQueueNames(QUEUE_NAME);
  const laneConfigs = buildLaneConfigs();
  const queues = {
    interactive: new queueFactory(queueNames.interactive, { connection: queueConnection }),
    background: new queueFactory(queueNames.background, { connection: queueConnection }),
  };
  const deadLetterQueue = new queueFactory(queueNames.deadLetter, { connection: dlqConnection });

  const pressureState = {
    activeProcessors: 0,
    activeByLane: {
      interactive: 0,
      background: 0,
    },
    maxInflight: Number.parseInt(
      process.env.LLM_INFERENCE_MAX_INFLIGHT
        || String(laneConfigs.interactive.concurrency + laneConfigs.background.concurrency),
      10,
    ),
  };

  const workers = {};
  workers.interactive = createLaneWorker({
    lane: QUEUE_LANES.interactive,
    queueName: queueNames.interactive,
    workerConnection: interactiveWorkerConnection,
    processor,
    io,
    workerFactory,
    laneConfig: laneConfigs.interactive,
    deadLetterQueue,
    pressureState,
    brainFactory,
  });
  workers.background = createLaneWorker({
    lane: QUEUE_LANES.background,
    queueName: queueNames.background,
    workerConnection: backgroundWorkerConnection,
    processor,
    io,
    workerFactory,
    laneConfig: laneConfigs.background,
    deadLetterQueue,
    pressureState,
    brainFactory,
  });

  return {
    async enqueue(data, { idempotencyKey = null } = {}) {
      const lane = normalizeQueueLane(data.queueLane);
      const queue = queues[lane];
      const replayKey = idempotencyKey ? `idempotency:code:${lane}:${data.userId}:${idempotencyKey}` : null;

      if (replayKey) {
        const existing = await idempotencyRedis.get(replayKey);
        if (existing) return { ...JSON.parse(existing), replayed: true };
      }

      const jobId = idempotencyKey ? idempotencyJobId(data.userId, idempotencyKey, lane) : undefined;
      const laneConfig = laneConfigs[lane];
      const traceContext = getTraceContext();
      const job = await queue.add('code', {
        ...data,
        queueLane: lane,
        traceContext: traceContext ? {
          traceId: traceContext.traceId,
          parentSpanId: traceContext.spanId,
          spanId: traceContext.spanId,
          traceFlags: traceContext.traceFlags,
          requestId: traceContext.requestId,
          userId: traceContext.userId || data.userId,
          agentRunId: traceContext.agentRunId,
          step: 'queue.enqueue',
        } : null,
      }, {
        jobId,
        priority: laneConfig.priority,
        attempts: laneConfig.attempts,
        backoff: laneConfig.backoff,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      });

      recordQueueJobMetric(lane, 'enqueued');
      await updateQueueDepths(queues, deadLetterQueue);

      const response = {
        jobId: job.id,
        queueLane: lane,
        status: 'queued',
        queuedAt: new Date().toISOString(),
      };

      if (replayKey) {
        await idempotencyRedis.set(replayKey, JSON.stringify(response), 'EX', IDEMPOTENCY_TTL_SECONDS);
      }

      return response;
    },

    async getStatus(jobId, userId) {
      const lane = laneFromJobId(jobId);
      const searchOrder = lane ? [lane] : [QUEUE_LANES.interactive, QUEUE_LANES.background];

      for (const candidateLane of searchOrder) {
        const queue = queues[candidateLane];
        const job = queue ? await jobLookup.fromId(queue, jobId) : null;
        if (!job) continue;
        if (userId && String(job.data?.userId) !== String(userId)) {
          return { forbidden: true };
        }
        return {
          id: job.id,
          queueLane: candidateLane,
          state: await job.getState(),
          progress: job.progress,
          failedReason: job.failedReason,
          returnvalue: job.returnvalue,
          attemptsMade: job.attemptsMade,
          createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
          processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
          finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        };
      }

      const deadLetterJob = await jobLookup.fromId(deadLetterQueue, deadLetterJobId(jobId));
      if (deadLetterJob) {
        if (userId && String(deadLetterJob.data?.job?.userId) !== String(userId)) {
          return { forbidden: true };
        }
        return {
          id: deadLetterJob.data?.jobId || deadLetterJob.id,
          queueLane: deadLetterJob.data?.lane || null,
          state: 'dead-lettered',
          failedReason: deadLetterJob.data?.error?.message || 'Job moved to dead-letter queue.',
          attemptsMade: deadLetterJob.data?.attemptsMade || 0,
          createdAt: deadLetterJob.timestamp ? new Date(deadLetterJob.timestamp).toISOString() : null,
          processedAt: deadLetterJob.processedOn ? new Date(deadLetterJob.processedOn).toISOString() : null,
          finishedAt: deadLetterJob.finishedOn ? new Date(deadLetterJob.finishedOn).toISOString() : null,
        };
      }

      return null;
    },

    async close() {
      await Promise.allSettled([
        workers.interactive.close(),
        workers.background.close(),
        queues.interactive.close(),
        queues.background.close(),
        deadLetterQueue.close(),
        queueConnection.quit(),
        interactiveWorkerConnection.quit(),
        backgroundWorkerConnection.quit(),
        dlqConnection.quit(),
        idempotencyRedis.quit(),
      ]);
    },
    workers: [workers.interactive, workers.background],
  };
}

function createLaneWorker({
  lane,
  queueName,
  workerConnection,
  processor,
  io,
  workerFactory,
  laneConfig,
  deadLetterQueue,
  pressureState,
  brainFactory,
}) {
  const worker = new workerFactory(
    queueName,
    async (job) => {
      const inheritedTrace = {
        ...(job.data.traceContext || {}),
        parentSpanId: job.data.traceContext?.spanId || job.data.traceContext?.parentSpanId || null,
        spanId: undefined,
        userId: job.data.userId || job.data.traceContext?.userId || null,
        step: 'queue.process',
      };

      return runWithTraceContext(inheritedTrace, () => withSpan('queue.process', {
        queueLane: lane,
        jobId: job.id,
      }, async () => {
        setTraceUser(job.data.userId);
        setTraceStep('queue.backpressure_check');
        await maybeApplyBackpressure({ lane, laneConfig, pressureState, worker });

        pressureState.activeProcessors += 1;
        pressureState.activeByLane[lane] = (pressureState.activeByLane[lane] || 0) + 1;
        setQueueConsumerMetric(lane, pressureState.activeByLane[lane], laneConfig.concurrency);
        recordQueueJobMetric(lane, 'started');

        try {
          const { socketId, requestId } = job.data;
          if (io && socketId) {
            io.to(socketId).emit('agent_status', {
              status: 'queued_job_started',
              message: `Orchestration job ${job.id} started.`,
              jobId: job.id,
              requestId,
              queueLane: lane,
              timestamp: new Date().toISOString(),
            });
          }

          setTraceStep('brain.heavy_lift_check');
          const brain = brainFactory();
          const brainResult = await brain.process(job.id, job.data.prompt);

          if (brainResult && brainResult.isHeavyLift) {
            logger.info(`Task ${job.id} identified as heavy-lift (>5 files). Dispatched to GitHub Actions.`);
            if (io && socketId) {
              io.to(socketId).emit('agent_status', {
                status: 'heavy_lift_dispatched',
                message: 'Task spans > 5 files. Dispatched to async Heavy-Lift runner.',
                jobId: job.id,
                queueLane: lane,
              });
            }
            return { status: 'bypassed_for_heavy_lift' };
          }

          setTraceStep('orchestrator.execute');
          return processor({ ...job.data, jobId: job.id, queueLane: lane }, job);
        } finally {
          pressureState.activeProcessors = Math.max(0, pressureState.activeProcessors - 1);
          pressureState.activeByLane[lane] = Math.max(0, (pressureState.activeByLane[lane] || 0) - 1);
          setQueueConsumerMetric(lane, pressureState.activeByLane[lane], laneConfig.concurrency);
        }
      }));
    },
    {
      connection: workerConnection,
      concurrency: laneConfig.concurrency,
      lockDuration: Number.parseInt(process.env.ORCHESTRATION_JOB_LOCK_MS || '120000', 10),
      limiter: laneConfig.limiter,
      maxStartedAttempts: laneConfig.maxStartedAttempts,
    },
  );

  worker.on('active', async () => {
    await updateQueueDepthMetricForQueue(lane, worker.getQueue()).catch(() => {});
  });

  worker.on('completed', async (job) => {
    logger.info('Code orchestration job completed', { jobId: job.id, requestId: job.data.requestId, queueLane: lane });
    recordQueueJobMetric(lane, 'completed');
    await updateQueueDepthMetricForQueue(lane, worker.getQueue());
  });

  worker.on('failed', async (job, error) => {
    const attempts = Number.parseInt(job?.opts?.attempts || laneConfig.attempts, 10);
    const exhausted = (job?.attemptsMade || 0) >= attempts;

    logger.error('Code orchestration job failed', {
      jobId: job?.id,
      requestId: job?.data?.requestId,
      queueLane: lane,
      exhaustedRetries: exhausted,
      error: error.message,
    });
    recordQueueJobMetric(lane, exhausted ? 'dead_lettered' : 'failed');

    if (io && job?.data?.socketId) {
      io.to(job.data.socketId).emit('agent_status', {
        status: exhausted ? 'dead_lettered' : 'fatal_failure',
        message: exhausted ? 'Job exhausted retries and moved to dead-letter queue.' : error.message,
        jobId: job.id,
        requestId: job.data.requestId,
        queueLane: lane,
        timestamp: new Date().toISOString(),
      });
    }

    if (exhausted && job) {
      await deadLetterQueue.add('code-dead-letter', {
        lane,
        jobId: job.id,
        requestId: job.data?.requestId || null,
        attemptsMade: job.attemptsMade,
        job: job.data,
        error: {
          message: error.message,
          stack: error.stack || null,
        },
        failedAt: new Date().toISOString(),
      }, {
        jobId: deadLetterJobId(job.id),
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      }).catch(dlqError => {
        logger.error('Failed to write dead-letter job', {
          jobId: job.id,
          queueLane: lane,
          error: dlqError.message,
        });
      });
    }

    await Promise.allSettled([
      updateQueueDepthMetricForQueue(lane, worker.getQueue()),
      updateQueueDepthMetricForQueue('dead-letter', deadLetterQueue),
    ]);
  });

  return worker;
}

async function maybeApplyBackpressure({ lane, laneConfig, pressureState, worker }) {
  if (pressureState.activeProcessors < pressureState.maxInflight) {
    return;
  }

  const delayMs = laneConfig.backpressureDelayMs;
  recordQueueBackpressureMetric(lane);
  logger.warn('Applying queue backpressure before dispatching job', {
    queueLane: lane,
    activeProcessors: pressureState.activeProcessors,
    maxInflight: pressureState.maxInflight,
    delayMs,
  });

  await worker.rateLimit(delayMs);
  throw Worker.RateLimitError();
}

function buildLaneConfigs() {
  const attempts = Number.parseInt(process.env.ORCHESTRATION_JOB_ATTEMPTS || '3', 10);
  const backoffDelay = Number.parseInt(process.env.ORCHESTRATION_JOB_BACKOFF_MS || '2000', 10);
  const backoffJitter = Number.parseFloat(process.env.ORCHESTRATION_JOB_BACKOFF_JITTER || '0.25');

  return {
    interactive: {
      concurrency: Number.parseInt(
        process.env.ORCHESTRATION_INTERACTIVE_WORKER_CONCURRENCY
          || process.env.ORCHESTRATION_WORKER_CONCURRENCY
          || '2',
        10,
      ),
      priority: Number.parseInt(process.env.ORCHESTRATION_INTERACTIVE_PRIORITY || '1', 10),
      attempts,
      backoff: buildBackoff({ delay: backoffDelay, jitter: backoffJitter }),
      backpressureDelayMs: Number.parseInt(process.env.ORCHESTRATION_INTERACTIVE_BACKPRESSURE_MS || '1500', 10),
      limiter: buildLaneLimiter('INTERACTIVE'),
      maxStartedAttempts: Number.parseInt(process.env.ORCHESTRATION_INTERACTIVE_MAX_STARTED_ATTEMPTS || String(attempts + 1), 10),
    },
    background: {
      concurrency: Number.parseInt(process.env.ORCHESTRATION_BACKGROUND_WORKER_CONCURRENCY || '1', 10),
      priority: Number.parseInt(process.env.ORCHESTRATION_BACKGROUND_PRIORITY || '10', 10),
      attempts,
      backoff: buildBackoff({ delay: backoffDelay, jitter: backoffJitter }),
      backpressureDelayMs: Number.parseInt(process.env.ORCHESTRATION_BACKGROUND_BACKPRESSURE_MS || '5000', 10),
      limiter: buildLaneLimiter('BACKGROUND'),
      maxStartedAttempts: Number.parseInt(process.env.ORCHESTRATION_BACKGROUND_MAX_STARTED_ATTEMPTS || String(attempts + 1), 10),
    },
  };
}

function buildLaneLimiter(prefix) {
  const max = Number.parseInt(process.env[`ORCHESTRATION_${prefix}_RATE_LIMIT_MAX`] || '0', 10);
  const duration = Number.parseInt(process.env[`ORCHESTRATION_${prefix}_RATE_LIMIT_WINDOW_MS`] || '1000', 10);
  return max > 0 ? { max, duration } : undefined;
}

function buildBackoff({ delay, jitter }) {
  return {
    type: 'exponential',
    delay,
    jitter: Number.isFinite(jitter) ? Math.max(0, Math.min(1, jitter)) : 0.25,
  };
}

function buildQueueNames(baseName) {
  return {
    interactive: `${baseName}:interactive`,
    background: `${baseName}:background`,
    deadLetter: `${baseName}:dead-letter`,
  };
}

function normalizeQueueLane(lane) {
  return lane === QUEUE_LANES.background ? QUEUE_LANES.background : QUEUE_LANES.interactive;
}

function laneFromJobId(jobId) {
  if (typeof jobId !== 'string') return null;
  if (jobId.startsWith(`${QUEUE_LANES.interactive}:`)) return QUEUE_LANES.interactive;
  if (jobId.startsWith(`${QUEUE_LANES.background}:`)) return QUEUE_LANES.background;
  return null;
}

function deadLetterJobId(jobId) {
  return `dlq:${jobId}`;
}

async function updateQueueDepths(queues, deadLetterQueue) {
  await Promise.allSettled([
    updateQueueDepthMetricForQueue(QUEUE_LANES.interactive, queues.interactive),
    updateQueueDepthMetricForQueue(QUEUE_LANES.background, queues.background),
    updateQueueDepthMetricForQueue('dead-letter', deadLetterQueue),
  ]);
}

async function updateQueueDepthMetricForQueue(lane, queueOrPromise) {
  const queue = await Promise.resolve(queueOrPromise);
  if (!queue || typeof queue.getJobCounts !== 'function') return;

  const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
  const depth = (counts.waiting || 0) + (counts.delayed || 0);
  setQueueDepthMetric(lane, depth, counts.active || 0, counts.failed || 0);
}

export {
  buildBackoff,
  buildLaneConfigs,
  buildQueueNames,
  deadLetterJobId,
  laneFromJobId,
  maybeApplyBackpressure,
  normalizeQueueLane,
};
