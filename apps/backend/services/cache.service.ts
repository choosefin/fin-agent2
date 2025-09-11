import { createClient, RedisClientType, RedisClientOptions } from 'redis'

export class CacheService {
  private client: RedisClientType | null = null
  private readonly defaultTTL = 300 // 5 minutes default
  private isConnecting = false
  private connectionAttempts = 0
  private readonly maxRetries = 10
  
  constructor(private readonly redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379') {}

  async connect(): Promise<void> {
    if (this.client?.isReady) return
    if (this.isConnecting) {
      // Wait for existing connection attempt
      return new Promise((resolve, reject) => {
        const checkConnection = () => {
          if (this.client?.isReady) {
            resolve()
          } else if (!this.isConnecting) {
            reject(new Error('Connection failed'))
          } else {
            setTimeout(checkConnection, 100)
          }
        }
        checkConnection()
      })
    }

    this.isConnecting = true
    this.connectionAttempts++
    
    try {
      const options: RedisClientOptions = {
        url: this.redisUrl,
        socket: {
          connectTimeout: 5000,
          lazyConnect: true,
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
              console.error(`Redis: Max reconnection attempts (${this.maxRetries}) exceeded`)
              return false
            }
            const delay = Math.min(retries * 100, 3000)
            console.log(`Redis: Reconnecting in ${delay}ms (attempt ${retries}/${this.maxRetries})`)
            return delay
          }
        },
        // Enable connection pooling
        isolationPoolOptions: {
          min: 2,
          max: 10
        }
      }

      this.client = createClient(options)

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err)
      })

      this.client.on('ready', () => {
        console.log('Redis cache connected successfully')
        this.connectionAttempts = 0
      })

      this.client.on('reconnecting', () => {
        console.log('Redis: Attempting to reconnect...')
      })

      this.client.on('end', () => {
        console.log('Redis connection ended')
      })

      await this.client.connect()
    } catch (error) {
      console.error(`Redis connection failed (attempt ${this.connectionAttempts}):`, error)
      this.client = null
      throw error
    } finally {
      this.isConnecting = false
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit()
      this.client = null
    }
  }

  async get<T>(key: string): Promise<T | null> {
    await this.ensureConnection()
    
    try {
      if (!this.client?.isReady) {
        console.warn('Redis client not ready, returning null for key:', key)
        return null
      }
      
      const value = await this.client.get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error)
      return null
    }
  }

  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    await this.ensureConnection()
    
    try {
      if (!this.client?.isReady) {
        console.warn('Redis client not ready, skipping set for key:', key)
        return
      }
      
      await this.client.setEx(key, ttl, JSON.stringify(value))
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error)
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    await this.ensureConnection()
    
    try {
      if (!this.client?.isReady) {
        console.warn('Redis client not ready, skipping delete for key:', key)
        return
      }
      
      await this.client.del(key)
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error)
      throw error
    }
  }

  async flush(): Promise<void> {
    await this.ensureConnection()
    
    try {
      if (!this.client?.isReady) {
        console.warn('Redis client not ready, skipping flush')
        return
      }
      
      await this.client.flushAll()
    } catch (error) {
      console.error('Cache flush error:', error)
      throw error
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client?.isReady) return false
      await this.client.ping()
      return true
    } catch (error) {
      console.error('Redis health check failed:', error)
      return false
    }
  }

  private async ensureConnection(): Promise<void> {
    if (!this.client?.isReady) {
      await this.connect()
    }
  }

  // Cache patterns for financial data
  async cacheMarketData(symbol: string, data: any, ttl: number = 60): Promise<void> {
    const key = `market:${symbol}:${Date.now()}`
    await this.set(key, data, ttl)
  }

  async getCachedMarketData(symbol: string, maxAge: number = 60): Promise<any | null> {
    await this.ensureConnection()
    
    try {
      if (!this.client?.isReady) {
        console.warn('Redis client not ready, returning null for market data:', symbol)
        return null
      }
      
      const pattern = `market:${symbol}:*`
      const keys: string[] = []
      
      // Use SCAN instead of KEYS to avoid blocking Redis
      for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        keys.push(key)
      }
      
      if (keys.length === 0) return null
      
      // Get most recent key
      const sortedKeys = keys.sort((a, b) => {
        const timestampA = parseInt(a.split(':')[2] || '0')
        const timestampB = parseInt(b.split(':')[2] || '0')
        return timestampB - timestampA
      })
      
      const mostRecentKey = sortedKeys[0]
      const timestamp = parseInt(mostRecentKey.split(':')[2] || '0')
      
      // Check if data is still fresh
      if (Date.now() - timestamp > maxAge * 1000) {
        // Clean up old keys in background
        this.cleanupOldMarketData(symbol, maxAge).catch(err => 
          console.error('Background cleanup failed:', err)
        )
        return null
      }
      
      return await this.get(mostRecentKey)
    } catch (error) {
      console.error(`Failed to get cached market data for ${symbol}:`, error)
      return null
    }
  }

  private async cleanupOldMarketData(symbol: string, maxAge: number): Promise<void> {
    try {
      if (!this.client?.isReady) return
      
      const pattern = `market:${symbol}:*`
      const keysToDelete: string[] = []
      const cutoffTime = Date.now() - maxAge * 1000
      
      for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        const timestamp = parseInt(key.split(':')[2] || '0')
        if (timestamp < cutoffTime) {
          keysToDelete.push(key)
        }
      }
      
      if (keysToDelete.length > 0) {
        await this.client.del(keysToDelete)
        console.log(`Cleaned up ${keysToDelete.length} old market data keys for ${symbol}`)
      }
    } catch (error) {
      console.error('Error cleaning up old market data:', error)
    }
  }

  async cacheAgentResult(agentId: string, input: any, result: any, ttl: number = 600): Promise<void> {
    const key = `agent:${agentId}:${JSON.stringify(input)}`
    await this.set(key, result, ttl)
  }

  async getCachedAgentResult(agentId: string, input: any): Promise<any | null> {
    const key = `agent:${agentId}:${JSON.stringify(input)}`
    return await this.get(key)
  }

  async cachePortfolioData(userId: string, portfolioData: any, ttl: number = 300): Promise<void> {
    const key = `portfolio:${userId}`
    await this.set(key, portfolioData, ttl)
  }

  async getCachedPortfolioData(userId: string): Promise<any | null> {
    const key = `portfolio:${userId}`
    return await this.get(key)
  }

  async invalidatePortfolioCache(userId: string): Promise<void> {
    const key = `portfolio:${userId}`
    await this.delete(key)
  }
}

// Singleton instance
export const cacheService = new CacheService()