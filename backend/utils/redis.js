import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import { logger } from './logger.js';

const DEFAULT_KEY_PREFIX = 'selina:';

function redisOptions() {
  return {
    keyPrefix: process.env.REDIS_KEY_PREFIX || DEFAULT_KEY_PREFIX,
    maxRetriesPerRequest: Number.parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
    retryStrategy(times) {
      return Math.min(times * 100, 2000);
    },
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  };
}

export function createRedisClients() {
  if (!process.env.REDIS_URL) {
    logger.info('Redis disabled; using single-process in-memory coordination');
    return null;
  }

  const command = new Redis(process.env.REDIS_URL, redisOptions());
  const socketPublisher = command.duplicate();
  const socketSubscriber = command.duplicate();
  const vfsSubscriber = command.duplicate();

  for (const [name, client] of Object.entries({ command, socketPublisher, socketSubscriber, vfsSubscriber })) {
    client.on('error', (error) => {
      logger.error('Redis client error', { client: name, error: error.message });
    });
  }

  logger.info('Redis coordination enabled');
  return { command, socketPublisher, socketSubscriber, vfsSubscriber };
}

export function configureSocketRedisAdapter(io, redisClients) {
  if (!redisClients) return false;
  io.adapter(createAdapter(redisClients.socketPublisher, redisClients.socketSubscriber));
  logger.info('Socket.io Redis adapter enabled');
  return true;
}

export async function closeRedisClients(redisClients) {
  if (!redisClients) return;
  await Promise.allSettled(
    Object.values(redisClients).map(client => client.quit())
  );
}
