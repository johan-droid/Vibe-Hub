import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildBackoff,
  buildQueueNames,
  createCodeQueue,
  deadLetterJobId,
  laneFromJobId,
  maybeApplyBackpressure,
  normalizeQueueLane,
} from '../orchestrator/job-queue.js';

class FakeRedis {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    return this.store.get(key) ?? null;
  }

  async set(key, value) {
    this.store.set(key, value);
  }

  async quit() {}
}

class FakeQueue {
  static instances = new Map();

  constructor(name) {
    this.name = name;
    this.jobs = new Map();
    this.sequence = 0;
    FakeQueue.instances.set(name, this);
  }

  async add(_name, data, opts = {}) {
    const id = opts.jobId || `${this.name}-${++this.sequence}`;
    const job = {
      id,
      data,
      opts,
      progress: 0,
      attemptsMade: 0,
      failedReason: null,
      returnvalue: null,
      timestamp: Date.now(),
      processedOn: null,
      finishedOn: null,
      getState: async () => job.state || 'waiting',
      state: 'waiting',
    };
    this.jobs.set(id, job);
    return job;
  }

  async getJobCounts(...states) {
    const counts = Object.fromEntries(states.map(state => [state, 0]));
    for (const job of this.jobs.values()) {
      const state = job.state || 'waiting';
      if (state in counts) counts[state] += 1;
    }
    return counts;
  }

  async close() {}
}

class FakeWorker {
  static instances = [];

  constructor(queueName, processor, options = {}) {
    this.queueName = queueName;
    this.processor = processor;
    this.options = options;
    this.handlers = new Map();
    this.rateLimit = vi.fn(async () => {});
    FakeWorker.instances.push(this);
  }

  on(event, handler) {
    this.handlers.set(event, handler);
  }

  async getQueue() {
    return FakeQueue.instances.get(this.queueName);
  }

  async close() {}
}

const fakeJobLookup = {
  fromId: async (queue, id) => queue.jobs.get(id) || null,
};

describe('job queue orchestration', () => {
  beforeEach(() => {
    process.env.REDIS_URL = 'redis://example';
    process.env.CODE_QUEUE_NAME = 'selina-code';
    process.env.ORCHESTRATION_WORKER_CONCURRENCY = '2';
    process.env.ORCHESTRATION_BACKGROUND_WORKER_CONCURRENCY = '1';
    process.env.ORCHESTRATION_JOB_ATTEMPTS = '3';
    process.env.ORCHESTRATION_JOB_BACKOFF_MS = '2000';
    process.env.ORCHESTRATION_JOB_BACKOFF_JITTER = '0.25';
    process.env.LLM_INFERENCE_MAX_INFLIGHT = '2';
    FakeQueue.instances = new Map();
    FakeWorker.instances = [];
  });

  it('builds lane-specific queue names and normalizes queue lanes', () => {
    expect(buildQueueNames('selina-code')).toEqual({
      interactive: 'selina-code-interactive',
      background: 'selina-code-background',
      deadLetter: 'selina-code-dead-letter',
    });
    expect(normalizeQueueLane('background')).toBe('background');
    expect(normalizeQueueLane('anything-else')).toBe('interactive');
    expect(laneFromJobId('background:abc')).toBe('background');
    expect(deadLetterJobId('interactive-abc')).toBe('dlq:interactive-abc');
  });

  it('enqueues interactive and background work into dedicated lanes with retry backoff jitter', async () => {
    const queue = createCodeQueue({
      processor: vi.fn(),
      io: null,
      queueFactory: FakeQueue,
      workerFactory: FakeWorker,
      jobLookup: fakeJobLookup,
      redisFactory: () => new FakeRedis(),
      brainFactory: () => ({ process: vi.fn(async () => ({ isHeavyLift: false })) }),
    });

    const interactive = await queue.enqueue({
      prompt: 'Fix login flow',
      userId: 'u1',
      targetFile: 'backend/index.js',
      socketId: 'socket-1',
      requestId: 'r1',
      queueLane: 'interactive',
    }, { idempotencyKey: 'same-request' });
    const background = await queue.enqueue({
      prompt: 'Rebuild analytics snapshot',
      userId: 'u1',
      targetFile: 'backend/index.js',
      requestId: 'r2',
      queueLane: 'background',
    });

    const interactiveQueue = [...FakeQueue.instances.entries()].find(([name]) => name.endsWith('-interactive'))?.[1];
    const backgroundQueue = [...FakeQueue.instances.entries()].find(([name]) => name.endsWith('-background'))?.[1];
    const interactiveJob = interactiveQueue.jobs.get(interactive.jobId);
    const backgroundJob = backgroundQueue.jobs.get(background.jobId);

    expect(interactive.queueLane).toBe('interactive');
    expect(background.queueLane).toBe('background');
    expect(interactive.jobId.startsWith('interactive:')).toBe(true);
    expect(backgroundJob.opts.priority).toBe(10);
    expect(interactiveJob.opts.backoff).toEqual(buildBackoff({ delay: 2000, jitter: 0.25 }));
  });

  it('surfaces dead-lettered jobs in status lookups after retries are exhausted', async () => {
    const queue = createCodeQueue({
      processor: vi.fn(),
      io: null,
      queueFactory: FakeQueue,
      workerFactory: FakeWorker,
      jobLookup: fakeJobLookup,
      redisFactory: () => new FakeRedis(),
      brainFactory: () => ({ process: vi.fn(async () => ({ isHeavyLift: false })) }),
    });

    const interactiveWorker = FakeWorker.instances.find(worker => worker.queueName.endsWith('-interactive'));
    await interactiveWorker.handlers.get('failed')({
      id: 'interactive-job-1',
      data: { userId: 'u1', requestId: 'req-1' },
      opts: { attempts: 3 },
      attemptsMade: 3,
    }, new Error('llm unavailable'));

    const status = await queue.getStatus('interactive-job-1', 'u1');
    expect(status.state).toBe('dead-lettered');
    expect(status.failedReason).toContain('llm unavailable');
    expect(status.queueLane).toBe('interactive');
  });

  it('applies backpressure by rate-limiting workers instead of dispatching more work', async () => {
    const worker = { rateLimit: vi.fn(async () => {}) };
    await expect(maybeApplyBackpressure({
      lane: 'background',
      laneConfig: { backpressureDelayMs: 5000 },
      pressureState: { activeProcessors: 3, maxInflight: 2 },
      worker,
    })).rejects.toBeInstanceOf(Error);
    expect(worker.rateLimit).toHaveBeenCalledWith(5000);
  });
});
