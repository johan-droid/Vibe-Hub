import crypto from 'crypto';
import IORedis from 'ioredis';
import { Job, Queue, Worker } from 'bullmq';
import { logger } from '../utils/logger.js';

const QUEUE_NAME = process.env.CODE_QUEUE_NAME || 'code-orchestration';
const IDEMPOTENCY_TTL_SECONDS = Number.parseInt(process.env.IDEMPOTENCY_TTL_SECONDS || '3600', 10);

function connection() {
  return new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  });
}

function idempotencyJobId(userId, idempotencyKey) {
  return crypto
    .createHash('sha256')
    .update(`${userId}:${idempotencyKey}`)
    .digest('hex');
}

export function createCodeQueue({ processor, io }) {
  if (!process.env.REDIS_URL) {
    logger.info('Code queue disabled; /api/code will run inline');
    return null;
  }

  const queueConnection = connection();
  const workerConnection = connection();
  const idempotencyRedis = connection();
  const queue = new Queue(QUEUE_NAME, { connection: queueConnection });
  const concurrency = Number.parseInt(process.env.ORCHESTRATION_WORKER_CONCURRENCY || '2', 10);

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { socketId, requestId } = job.data;
      if (io && socketId) {
        io.to(socketId).emit('agent_status', {
          status: 'queued_job_started',
          message: `Orchestration job ${job.id} started.`,
          jobId: job.id,
          requestId,
          timestamp: new Date().toISOString(),
        });
      }
      return processor({ ...job.data, jobId: job.id }, job);
    },
    {
      connection: workerConnection,
      concurrency,
      lockDuration: Number.parseInt(process.env.ORCHESTRATION_JOB_LOCK_MS || '120000', 10),
    }
  );

  worker.on('completed', (job) => {
    logger.info('Code orchestration job completed', { jobId: job.id, requestId: job.data.requestId });
  });

  worker.on('failed', (job, error) => {
    logger.error('Code orchestration job failed', {
      jobId: job?.id,
      requestId: job?.data?.requestId,
      error: error.message,
    });
    if (io && job?.data?.socketId) {
      io.to(job.data.socketId).emit('agent_status', {
        status: 'fatal_failure',
        message: error.message,
        jobId: job.id,
        requestId: job.data.requestId,
        timestamp: new Date().toISOString(),
      });
    }
  });

  return {
    async enqueue(data, { idempotencyKey = null } = {}) {
      const replayKey = idempotencyKey ? `idempotency:code:${data.userId}:${idempotencyKey}` : null;
      if (replayKey) {
        const existing = await idempotencyRedis.get(replayKey);
        if (existing) return { ...JSON.parse(existing), replayed: true };
      }

      const jobId = idempotencyKey ? idempotencyJobId(data.userId, idempotencyKey) : undefined;
      const job = await queue.add('code', data, {
        jobId,
        attempts: Number.parseInt(process.env.ORCHESTRATION_JOB_ATTEMPTS || '2', 10),
        backoff: {
          type: 'exponential',
          delay: Number.parseInt(process.env.ORCHESTRATION_JOB_BACKOFF_MS || '2000', 10),
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      });

      const response = {
        jobId: job.id,
        status: 'queued',
        queuedAt: new Date().toISOString(),
      };

      if (replayKey) {
        await idempotencyRedis.set(replayKey, JSON.stringify(response), 'EX', IDEMPOTENCY_TTL_SECONDS);
      }

      return response;
    },

    async getStatus(jobId, userId) {
      const job = await Job.fromId(queue, jobId);
      if (!job) return null;
      if (userId && String(job.data?.userId) !== String(userId)) {
        return { forbidden: true };
      }
      return {
        id: job.id,
        state: await job.getState(),
        progress: job.progress,
        failedReason: job.failedReason,
        returnvalue: job.returnvalue,
        attemptsMade: job.attemptsMade,
        createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
        processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      };
    },

    async close() {
      await Promise.allSettled([
        worker.close(),
        queue.close(),
        queueConnection.quit(),
        workerConnection.quit(),
        idempotencyRedis.quit(),
      ]);
    },
  };
}
