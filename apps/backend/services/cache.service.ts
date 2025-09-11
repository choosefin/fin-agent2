import { createClient, RedisClientType } from 'redis'

export class CacheService {
  private client: RedisClientType | null = null
  private readonly defaultTTL = 300 // 5 minutes default
  
  constructor(private readonly redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379') {}

  async connect(): Promise<void> {
    if (this.client) return
    
    this.client = createClient({
      url: this.redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) return false
          return Math.min(retries * 100, 3000)
        }
      }
    })

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err)
    })

    await this.client.connect()
    console.log('Redis cache connected')
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit()
      this.client = null
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) await this.connect()
    
    try {
      const value = await this.client!.get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error)
      return null
    }
  }

  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    if (!this.client) await this.connect()
    
    try {
      await this.client!.setEx(key, ttl, JSON.stringify(value))
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error)
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client) await this.connect()
    
    try {
      await this.client!.del(key)
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error)
    }
  }

  async flush(): Promise<void> {
    if (!this.client) await this.connect()
    
    try {
      await this.client!.flushAll()
    } catch (error) {
      console.error('Cache flush error:', error)
    }
  }

  // Cache patterns for financial data
  async cacheMarketData(symbol: string, data: any, ttl: number = 60): Promise<void> {
    const key = `market:${symbol}:${Date.now()}`
    await this.set(key, data, ttl)
  }

  async getCachedMarketData(symbol: string, maxAge: number = 60): Promise<any | null> {
    if (!this.client) await this.connect()
    
    try {
      const pattern = `market:${symbol}:*`
      const keys = await this.client!.keys(pattern)
      
      if (keys.length === 0) return null
      
      // Get most recent key
      const sortedKeys = keys.sort((a, b) => {
        const timestampA = parseInt(a.split(':')[2])
        const timestampB = parseInt(b.split(':')[2])
        return timestampB - timestampA
      })
      
      const mostRecentKey = sortedKeys[0]
      const timestamp = parseInt(mostRecentKey.split(':')[2])
      
      // Check if data is still fresh
      if (Date.now() - timestamp > maxAge * 1000) {
        return null
      }
      
      return await this.get(mostRecentKey)
    } catch (error) {
      console.error(`Failed to get cached market data for ${symbol}:`, error)
      return null
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