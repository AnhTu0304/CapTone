import { redisClient, isRedisReady } from '../config/redis';
import { config } from '../config/env';

/**
 * In-memory fallback cache store for testing or offline environments
 */
interface CacheEntry {
  value: string;
  expiresAt: number;
}

export class RedisCacheService {
  private static simulatedOffline: boolean = false;
  private static memoryStore: Map<string, CacheEntry> = new Map();

  /**
   * Tạo cache key chuẩn hóa cho Organization
   * Convention: organization:{id}
   */
  public static organizationKey(orgId: string): string {
    return `organization:${orgId}`;
  }

  /**
   * Tạo cache key chuẩn hóa cho danh sách Organization
   * Convention: organization:list:{filterHash}
   */
  public static organizationListKey(filterHash: string): string {
    return `organization:list:${filterHash}`;
  }

  /**
   * Kiểm tra khả năng hoạt động của Cache layer
   */
  public static isAvailable(): boolean {
    if (this.simulatedOffline) return false;
    return isRedisReady() || config.nodeEnv === 'test';
  }

  /**
   * Bật/tắt chế độ mô phỏng Redis Offline để kiểm thử hành vi fallback
   */
  public static setSimulatedOffline(offline: boolean): void {
    this.simulatedOffline = offline;
    if (offline) {
      this.memoryStore.clear();
    }
  }

  /**
   * Read-through get cache
   * Trả về null nếu cache miss, cache hỏng hoặc Redis gặp sự cố (fallback an toàn)
   */
  public static async get<T>(key: string): Promise<T | null> {
    if (this.simulatedOffline) {
      return null;
    }

    try {
      // 1. Thử lấy từ Redis thực tế nếu đang kết nối
      if (isRedisReady()) {
        const raw = await redisClient.get(key);
        if (!raw) return null;
        try {
          return JSON.parse(raw) as T;
        } catch (parseError) {
          console.warn(`[RedisCache] Corrupted cache for key '${key}'. Evicting.`);
          await redisClient.del(key).catch(() => {});
          return null;
        }
      }

      // 2. Chế độ Test in-memory fallback nếu không có Redis daemon
      if (config.nodeEnv === 'test') {
        const entry = this.memoryStore.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
          this.memoryStore.delete(key);
          return null;
        }
        try {
          return JSON.parse(entry.value) as T;
        } catch {
          this.memoryStore.delete(key);
          return null;
        }
      }

      return null;
    } catch (err: any) {
      console.warn(`[RedisCache] Get failed for key '${key}': ${err.message}. Falling back to PostgreSQL.`);
      return null;
    }
  }

  /**
   * Write cache với Finite TTL
   */
  public static async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (this.simulatedOffline) {
      return false;
    }

    const ttl = ttlSeconds && ttlSeconds > 0 ? ttlSeconds : config.redis.ttlSeconds;
    const serialized = JSON.stringify(value);

    try {
      if (isRedisReady()) {
        await redisClient.set(key, serialized, 'EX', ttl);
        return true;
      }

      if (config.nodeEnv === 'test') {
        this.memoryStore.set(key, {
          value: serialized,
          expiresAt: Date.now() + ttl * 1000,
        });
        return true;
      }

      return false;
    } catch (err: any) {
      console.warn(`[RedisCache] Set failed for key '${key}': ${err.message}`);
      return false;
    }
  }

  /**
   * Cache Invalidation cho một key cụ thể
   */
  public static async del(key: string): Promise<boolean> {
    if (this.simulatedOffline) {
      return false;
    }

    try {
      this.memoryStore.delete(key);

      if (isRedisReady()) {
        await redisClient.del(key);
      }
      return true;
    } catch (err: any) {
      console.warn(`[RedisCache] Del failed for key '${key}': ${err.message}`);
      return false;
    }
  }

  /**
   * Cache Invalidation theo pattern (ví dụ: organization:*)
   */
  public static async delByPattern(pattern: string): Promise<boolean> {
    if (this.simulatedOffline) {
      return false;
    }

    try {
      // Xóa trong memoryStore
      const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
      for (const k of this.memoryStore.keys()) {
        if (regex.test(k)) {
          this.memoryStore.delete(k);
        }
      }

      if (isRedisReady()) {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      }
      return true;
    } catch (err: any) {
      console.warn(`[RedisCache] DelByPattern failed for pattern '${pattern}': ${err.message}`);
      return false;
    }
  }

  /**
   * Xóa toàn bộ cache (dùng khi dọn dẹp test)
   */
  public static async clear(): Promise<void> {
    this.memoryStore.clear();
    if (isRedisReady()) {
      await redisClient.flushdb().catch(() => {});
    }
  }
}
