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

export async function closeRedis(): Promise<void> {
  try {
    redisClient.disconnect(false);
  } catch {}
}
