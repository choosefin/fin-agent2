import { Redis } from 'ioredis';
import crypto from 'crypto';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
  blocked: boolean;
  blockedUntil?: number;
}

export class RateLimitService {
  private memoryStore: Map<string, RateLimitInfo> = new Map();
  private redis: Redis | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private useRedis: boolean = false;
  private cleanupIntervalMs: number = 60000; // 1 minute
  private maxMemoryEntries: number = 10000; // Maximum entries before forced cleanup

  constructor() {
    this.initializeStore();
    this.startCleanupInterval();
  }

  /**
   * Initialize the rate limit store
   */
  private async initializeStore() {
    // Try to connect to Redis if available
    if (process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
      try {
        const Redis = require('ioredis');
        this.redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => {
            if (times > 3) {
              console.error('Redis connection failed, falling back to memory store');
              this.useRedis = false;
              return null;
            }
            return Math.min(times * 50, 2000);
          },
        });

        await this.redis.ping();
        this.useRedis = true;
        console.log('Rate limiting using Redis store');
      } catch (error) {
        console.warn('Redis not available, using memory store for rate limiting');
        this.useRedis = false;
      }
    } else {
      console.log('Rate limiting using memory store');
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);

    // Ensure cleanup runs on process exit
    process.on('beforeExit', () => this.cleanup());
    process.on('SIGINT', () => {
      this.cleanup();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      this.cleanup();
      process.exit(0);
    });
  }

  /**
   * Stop the cleanup interval
   */
  public stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up expired entries from memory or Redis
   */
  public async cleanup() {
    const now = Date.now();
    
    if (this.useRedis && this.redis) {
      // Redis cleanup using Lua script for atomic operation
      const luaScript = `
        local keys = redis.call('keys', ARGV[1] .. '*')
        local deleted = 0
        for i=1,#keys do
          local ttl = redis.call('ttl', keys[i])
          if ttl <= 0 and ttl ~= -2 then
            redis.call('del', keys[i])
            deleted = deleted + 1
          end
        end
        return deleted
      `;
      
      try {
        const deleted = await this.redis.eval(luaScript, 0, 'ratelimit:');
        if (deleted > 0) {
          console.log(`Cleaned up ${deleted} expired rate limit entries from Redis`);
        }
      } catch (error) {
        console.error('Redis cleanup failed:', error);
      }
    } else {
      // Memory cleanup
      let deleted = 0;
      for (const [key, info] of this.memoryStore.entries()) {
        if (info.resetTime < now) {
          this.memoryStore.delete(key);
          deleted++;
        }
      }

      if (deleted > 0) {
        console.log(`Cleaned up ${deleted} expired rate limit entries from memory`);
      }

      // Force cleanup if memory store is too large
      if (this.memoryStore.size > this.maxMemoryEntries) {
        this.forceMemoryCleanup();
      }
    }
  }

  /**
   * Force cleanup of oldest entries when memory limit is reached
   */
  private forceMemoryCleanup() {
    const entries = Array.from(this.memoryStore.entries());
    entries.sort((a, b) => a[1].resetTime - b[1].resetTime);
    
    const toDelete = Math.floor(this.maxMemoryEntries * 0.2); // Remove 20% of oldest entries
    for (let i = 0; i < toDelete; i++) {
      this.memoryStore.delete(entries[i][0]);
    }
    
    console.warn(`Forced cleanup: removed ${toDelete} oldest rate limit entries`);
  }

  /**
   * Check rate limit for a given identifier
   */
  public async checkRateLimit(
    identifier: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; retryAfter?: number; remaining?: number }> {
    const key = this.generateKey(identifier, config.keyPrefix);
    const now = Date.now();
    const resetTime = now + config.windowMs;

    if (this.useRedis && this.redis) {
      return await this.checkRedisRateLimit(key, config, now, resetTime);
    } else {
      return this.checkMemoryRateLimit(key, config, now, resetTime);
    }
  }

  /**
   * Check rate limit using Redis
   */
  private async checkRedisRateLimit(
    key: string,
    config: RateLimitConfig,
    now: number,
    resetTime: number
  ): Promise<{ allowed: boolean; retryAfter?: number; remaining?: number }> {
    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis!.pipeline();
      
      // Get current count and TTL
      pipeline.get(key);
      pipeline.ttl(key);
      
      const results = await pipeline.exec();
      
      if (!results) {
        throw new Error('Redis pipeline failed');
      }

      const [countResult, ttlResult] = results;
      const currentCount = countResult[1] ? parseInt(countResult[1] as string) : 0;
      const ttl = ttlResult[1] as number;

      // Check if blocked
      const blockedKey = `${key}:blocked`;
      const blockedUntil = await this.redis!.get(blockedKey);
      
      if (blockedUntil && parseInt(blockedUntil) > now) {
        return {
          allowed: false,
          retryAfter: Math.ceil((parseInt(blockedUntil) - now) / 1000),
          remaining: 0,
        };
      }

      // Check if limit exceeded
      if (currentCount >= config.max) {
        // Block for double the window time
        const blockDuration = config.windowMs * 2;
        await this.redis!.setex(blockedKey, Math.ceil(blockDuration / 1000), (now + blockDuration).toString());
        
        return {
          allowed: false,
          retryAfter: Math.ceil(config.windowMs / 1000),
          remaining: 0,
        };
      }

      // Increment counter
      const newCount = await this.redis!.incr(key);
      
      // Set expiry if this is the first request in the window
      if (newCount === 1) {
        await this.redis!.expire(key, Math.ceil(config.windowMs / 1000));
      }

      return {
        allowed: true,
        remaining: Math.max(0, config.max - newCount),
      };
    } catch (error) {
      console.error('Redis rate limit check failed:', error);
      // Fallback to memory store
      return this.checkMemoryRateLimit(key, config, now, resetTime);
    }
  }

  /**
   * Check rate limit using memory store
   */
  private checkMemoryRateLimit(
    key: string,
    config: RateLimitConfig,
    now: number,
    resetTime: number
  ): { allowed: boolean; retryAfter?: number; remaining?: number } {
    let info = this.memoryStore.get(key);

    // Clean up expired entry
    if (info && info.resetTime < now) {
      this.memoryStore.delete(key);
      info = undefined;
    }

    // Check if blocked
    if (info?.blocked && info.blockedUntil && info.blockedUntil > now) {
      return {
        allowed: false,
        retryAfter: Math.ceil((info.blockedUntil - now) / 1000),
        remaining: 0,
      };
    }

    // Create new entry if doesn't exist
    if (!info) {
      info = {
        count: 0,
        resetTime,
        blocked: false,
      };
      this.memoryStore.set(key, info);
    }

    // Check if limit exceeded
    if (info.count >= config.max) {
      // Block for double the window time
      info.blocked = true;
      info.blockedUntil = now + (config.windowMs * 2);
      
      return {
        allowed: false,
        retryAfter: Math.ceil(config.windowMs / 1000),
        remaining: 0,
      };
    }

    // Increment counter
    info.count++;

    return {
      allowed: true,
      remaining: Math.max(0, config.max - info.count),
    };
  }

  /**
   * Generate a unique key for rate limiting
   */
  private generateKey(identifier: string, prefix?: string): string {
    const hash = crypto.createHash('sha256').update(identifier).digest('hex').substring(0, 16);
    return `ratelimit:${prefix || 'default'}:${hash}`;
  }

  /**
   * Reset rate limit for a specific identifier
   */
  public async resetRateLimit(identifier: string, prefix?: string): Promise<void> {
    const key = this.generateKey(identifier, prefix);

    if (this.useRedis && this.redis) {
      await this.redis.del(key, `${key}:blocked`);
    } else {
      this.memoryStore.delete(key);
    }
  }

  /**
   * Get current rate limit status for an identifier
   */
  public async getRateLimitStatus(
    identifier: string,
    config: RateLimitConfig
  ): Promise<{ count: number; remaining: number; resetTime: number }> {
    const key = this.generateKey(identifier, config.keyPrefix);
    const now = Date.now();

    if (this.useRedis && this.redis) {
      const count = await this.redis.get(key);
      const ttl = await this.redis.ttl(key);
      
      return {
        count: count ? parseInt(count) : 0,
        remaining: Math.max(0, config.max - (count ? parseInt(count) : 0)),
        resetTime: ttl > 0 ? now + (ttl * 1000) : now + config.windowMs,
      };
    } else {
      const info = this.memoryStore.get(key);
      
      if (!info || info.resetTime < now) {
        return {
          count: 0,
          remaining: config.max,
          resetTime: now + config.windowMs,
        };
      }

      return {
        count: info.count,
        remaining: Math.max(0, config.max - info.count),
        resetTime: info.resetTime,
      };
    }
  }

  /**
   * Get memory store statistics
   */
  public getStats() {
    if (this.useRedis) {
      return {
        type: 'redis',
        connected: this.redis?.status === 'ready',
      };
    }

    return {
      type: 'memory',
      entries: this.memoryStore.size,
      maxEntries: this.maxMemoryEntries,
      utilizationPercent: (this.memoryStore.size / this.maxMemoryEntries) * 100,
    };
  }

  /**
   * Graceful shutdown
   */
  public async shutdown() {
    this.stopCleanupInterval();
    await this.cleanup();
    
    if (this.redis) {
      await this.redis.quit();
    }
    
    this.memoryStore.clear();
  }
}

// Singleton instance
export const rateLimitService = new RateLimitService();