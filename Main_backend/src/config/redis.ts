import Redis, { RedisOptions } from 'ioredis';
import { config } from './env';

let isRedisConnected = false;
let redisErrorLogged = false;

const redisOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false, // Fail fast so application can fallback immediately to PostgreSQL
  retryStrategy(times: number) {
    // If Redis is not available, stop retrying after 2 attempts to avoid hanging processes/tests
    if (times > 2) {
      return null;
    }
    return 1000;
  },
};

export const redisClient: Redis = config.redis.url
  ? new Redis(config.redis.url, redisOptions)
  : new Redis(redisOptions);

if (config.redis.enabled && config.nodeEnv !== 'test') {
  redisClient.on('connect', () => {
    isRedisConnected = true;
    redisErrorLogged = false;
    console.log(`🔴 [Redis] Connected successfully to Redis at ${config.redis.host}:${config.redis.port}`);
  });

  redisClient.on('ready', () => {
    isRedisConnected = true;
  });

  redisClient.on('close', () => {
    isRedisConnected = false;
  });

  redisClient.on('error', (err: any) => {
    isRedisConnected = false;
    if (!redisErrorLogged) {
      console.warn(
        `⚠️ [Redis] Connection unavailable (${err.message || 'ECONNREFUSED'}). Graceful PostgreSQL fallback is active.`
      );
      redisErrorLogged = true;
    }
  });

  // Background connect only in non-test mode
  redisClient.connect().catch(() => {});
}

export function isRedisReady(): boolean {
  return config.redis.enabled && isRedisConnected && redisClient.status === 'ready';
}

/**
 * Wait until Redis client transitions into 'ready' status or timeout elapses
 */
async function waitUntilReady(timeoutMs: number = 3000): Promise<boolean> {
  if (redisClient.status === 'ready') return true;
  if (!config.redis.enabled) return false;

  return new Promise<boolean>((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    const onReady = () => {
      cleanup();
      resolve(true);
    };

    const onError = () => {
      cleanup();
      resolve(false);
    };

    const onClose = () => {
      cleanup();
      resolve(false);
    };

    function cleanup() {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        redisClient.removeListener('ready', onReady);
        redisClient.removeListener('error', onError);
        redisClient.removeListener('close', onClose);
      }
    }

    redisClient.once('ready', onReady);
    redisClient.once('error', onError);
    redisClient.once('close', onClose);
  });
}

/**
 * Test Redis connection on server startup without blocking or crashing on failure
 */
export async function testRedisConnection(): Promise<boolean> {
  if (!config.redis.enabled) {
    console.log('ℹ️ [Redis] Cache is disabled via configuration (REDIS_ENABLED=false).');
    return false;
  }

  try {
    if (redisClient.status === 'wait') {
      await redisClient.connect().catch(() => {});
    }

    const ready = await waitUntilReady(3000);
    if (!ready) {
      console.warn(
        `⚠️ [Redis] Cache connection unavailable (status: ${redisClient.status}). Graceful PostgreSQL fallback is active.`
      );
      return false;
    }

    const pong = await redisClient.ping();
    if (pong === 'PONG') {
      console.log(`✅ [Redis] Cache connected successfully at: ${config.redis.host}:${config.redis.port} (PONG)`);
      return true;
    }
    return false;
  } catch (error) {
    console.warn(
      `⚠️ [Redis] Cache connection failed (${(error as Error).message}). Graceful PostgreSQL fallback is active.`
    );
    return false;
  }
}

export interface RedisHealth {
  status: 'CONNECTED' | 'DISABLED' | 'DISCONNECTED' | string;
  host: string;
  port: number;
  latencyMs?: number;
  error?: string;
}

/**
 * Check Redis health and response latency for /health endpoint
 */
export async function getRedisHealth(): Promise<RedisHealth> {
  if (!config.redis.enabled) {
    return {
      status: 'DISABLED',
      host: config.redis.host,
      port: config.redis.port,
    };
  }

  if (redisClient.status !== 'ready') {
    if (redisClient.status === 'connecting' || redisClient.status === 'connect') {
      await waitUntilReady(500);
    }
  }

  if (redisClient.status !== 'ready') {
    return {
      status: 'DISCONNECTED',
      host: config.redis.host,
      port: config.redis.port,
      error: `Redis client status is ${redisClient.status}`,
    };
  }

  try {
    const start = Date.now();
    await redisClient.ping();
    const latencyMs = Date.now() - start;
    return {
      status: 'CONNECTED',
      host: config.redis.host,
      port: config.redis.port,
      latencyMs,
    };
  } catch (error) {
    return {
      status: `ERROR: ${(error as Error).message}`,
      host: config.redis.host,
      port: config.redis.port,
      error: (error as Error).message,
    };
  }
}

export async function closeRedis(): Promise<void> {
  try {
    if (redisClient.status !== 'end') {
      await redisClient.quit();
    }
  } catch {
    redisClient.disconnect(false);
  }
}
