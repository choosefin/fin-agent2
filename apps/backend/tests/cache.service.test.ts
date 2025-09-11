import { CacheService } from '../services/cache.service'
import { createClient, RedisClientType } from 'redis'

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn()
}))

describe('CacheService', () => {
  let cacheService: CacheService
  let mockRedisClient: Partial<RedisClientType>

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    
    // Create mock Redis client
    mockRedisClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
      flushAll: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      scanIterator: jest.fn(),
      isReady: true,
      on: jest.fn()
    }
    
    ;(createClient as jest.Mock).mockReturnValue(mockRedisClient)
    
    // Create service instance
    cacheService = new CacheService('redis://localhost:6379')
  })

  afterEach(async () => {
    await cacheService.disconnect()
  })

  describe('connect', () => {
    it('should connect to Redis successfully', async () => {
      await cacheService.connect()
      
      expect(createClient).toHaveBeenCalledWith({
        url: 'redis://localhost:6379',
        socket: expect.objectContaining({
          connectTimeout: 5000,
          lazyConnect: true,
          reconnectStrategy: expect.any(Function)
        }),
        isolationPoolOptions: {
          min: 2,
          max: 10
        }
      })
      
      expect(mockRedisClient.connect).toHaveBeenCalled()
      expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockRedisClient.on).toHaveBeenCalledWith('ready', expect.any(Function))
      expect(mockRedisClient.on).toHaveBeenCalledWith('reconnecting', expect.any(Function))
      expect(mockRedisClient.on).toHaveBeenCalledWith('end', expect.any(Function))
    })

    it('should handle connection errors', async () => {
      const connectionError = new Error('Connection failed')
      ;(mockRedisClient.connect as jest.Mock).mockRejectedValueOnce(connectionError)
      
      await expect(cacheService.connect()).rejects.toThrow('Connection failed')
    })

    it('should not reconnect if already connected', async () => {
      mockRedisClient.isReady = true
      
      await cacheService.connect()
      await cacheService.connect() // Second call
      
      expect(createClient).toHaveBeenCalledTimes(1)
    })
  })

  describe('healthCheck', () => {
    it('should return true when Redis is healthy', async () => {
      await cacheService.connect()
      
      const isHealthy = await cacheService.healthCheck()
      
      expect(isHealthy).toBe(true)
      expect(mockRedisClient.ping).toHaveBeenCalled()
    })

    it('should return false when Redis is not ready', async () => {
      mockRedisClient.isReady = false
      await cacheService.connect()
      
      const isHealthy = await cacheService.healthCheck()
      
      expect(isHealthy).toBe(false)
    })

    it('should return false when ping fails', async () => {
      await cacheService.connect()
      ;(mockRedisClient.ping as jest.Mock).mockRejectedValueOnce(new Error('Ping failed'))
      
      const isHealthy = await cacheService.healthCheck()
      
      expect(isHealthy).toBe(false)
    })
  })

  describe('get', () => {
    it('should get cached value successfully', async () => {
      const testData = { id: 1, name: 'test' }
      ;(mockRedisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(testData))
      
      await cacheService.connect()
      const result = await cacheService.get('test-key')
      
      expect(result).toEqual(testData)
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key')
    })

    it('should return null for non-existent key', async () => {
      ;(mockRedisClient.get as jest.Mock).mockResolvedValue(null)
      
      await cacheService.connect()
      const result = await cacheService.get('non-existent')
      
      expect(result).toBeNull()
    })

    it('should handle get errors gracefully', async () => {
      ;(mockRedisClient.get as jest.Mock).mockRejectedValue(new Error('Get failed'))
      
      await cacheService.connect()
      const result = await cacheService.get('error-key')
      
      expect(result).toBeNull()
    })

    it('should return null when client is not ready', async () => {
      mockRedisClient.isReady = false
      await cacheService.connect()
      
      const result = await cacheService.get('test-key')
      
      expect(result).toBeNull()
      expect(mockRedisClient.get).not.toHaveBeenCalled()
    })
  })

  describe('set', () => {
    it('should set value with default TTL', async () => {
      const testData = { id: 1, name: 'test' }
      
      await cacheService.connect()
      await cacheService.set('test-key', testData)
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith('test-key', 300, JSON.stringify(testData))
    })

    it('should set value with custom TTL', async () => {
      const testData = { id: 1, name: 'test' }
      
      await cacheService.connect()
      await cacheService.set('test-key', testData, 600)
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith('test-key', 600, JSON.stringify(testData))
    })

    it('should handle set errors', async () => {
      ;(mockRedisClient.setEx as jest.Mock).mockRejectedValue(new Error('Set failed'))
      
      await cacheService.connect()
      
      await expect(cacheService.set('error-key', 'value')).rejects.toThrow('Set failed')
    })

    it('should skip set when client is not ready', async () => {
      mockRedisClient.isReady = false
      await cacheService.connect()
      
      await cacheService.set('test-key', 'value')
      
      expect(mockRedisClient.setEx).not.toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('should delete key successfully', async () => {
      await cacheService.connect()
      await cacheService.delete('test-key')
      
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key')
    })

    it('should handle delete errors', async () => {
      ;(mockRedisClient.del as jest.Mock).mockRejectedValue(new Error('Delete failed'))
      
      await cacheService.connect()
      
      await expect(cacheService.delete('error-key')).rejects.toThrow('Delete failed')
    })
  })

  describe('market data caching', () => {
    it('should cache market data with timestamp', async () => {
      const marketData = { price: 100, volume: 1000 }
      const symbol = 'AAPL'
      
      await cacheService.connect()
      await cacheService.cacheMarketData(symbol, marketData, 60)
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^market:${symbol}:\\d+$`)),
        60,
        JSON.stringify(marketData)
      )
    })

    it('should retrieve fresh market data using SCAN', async () => {
      const marketData = { price: 100, volume: 1000 }
      const symbol = 'AAPL'
      const currentTime = Date.now()
      const mockKey = `market:${symbol}:${currentTime}`
      
      // Mock SCAN iterator
      mockRedisClient.scanIterator = jest.fn().mockReturnValue({
        async* [Symbol.asyncIterator]() {
          yield mockKey
        }
      } as any)
      
      ;(mockRedisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(marketData))
      
      await cacheService.connect()
      const result = await cacheService.getCachedMarketData(symbol, 120)
      
      expect(result).toEqual(marketData)
      expect(mockRedisClient.scanIterator).toHaveBeenCalledWith({ MATCH: `market:${symbol}:*`, COUNT: 100 })
    })

    it('should return null for stale market data', async () => {
      const symbol = 'AAPL'
      const staleTime = Date.now() - 120000 // 2 minutes ago
      const mockKey = `market:${symbol}:${staleTime}`
      
      mockRedisClient.scanIterator = jest.fn().mockReturnValue({
        async* [Symbol.asyncIterator]() {
          yield mockKey
        }
      } as any)
      
      await cacheService.connect()
      const result = await cacheService.getCachedMarketData(symbol, 60) // 1 minute max age
      
      expect(result).toBeNull()
    })

    it('should handle SCAN errors gracefully', async () => {
      const symbol = 'AAPL'
      mockRedisClient.scanIterator = jest.fn().mockImplementation(() => {
        throw new Error('SCAN failed')
      })
      
      await cacheService.connect()
      const result = await cacheService.getCachedMarketData(symbol)
      
      expect(result).toBeNull()
    })
  })

  describe('agent result caching', () => {
    it('should cache and retrieve agent results', async () => {
      const agentId = 'financial-analyzer'
      const input = { symbol: 'AAPL', timeframe: '1d' }
      const result = { analysis: 'bullish', confidence: 0.8 }
      
      await cacheService.connect()
      await cacheService.cacheAgentResult(agentId, input, result, 600)
      
      const expectedKey = `agent:${agentId}:${JSON.stringify(input)}`
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(expectedKey, 600, JSON.stringify(result))
      
      ;(mockRedisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(result))
      const cached = await cacheService.getCachedAgentResult(agentId, input)
      
      expect(cached).toEqual(result)
      expect(mockRedisClient.get).toHaveBeenCalledWith(expectedKey)
    })
  })

  describe('portfolio data caching', () => {
    it('should cache and retrieve portfolio data', async () => {
      const userId = 'user123'
      const portfolioData = { positions: [], totalValue: 10000 }
      
      await cacheService.connect()
      await cacheService.cachePortfolioData(userId, portfolioData, 300)
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(`portfolio:${userId}`, 300, JSON.stringify(portfolioData))
      
      ;(mockRedisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(portfolioData))
      const cached = await cacheService.getCachedPortfolioData(userId)
      
      expect(cached).toEqual(portfolioData)
    })

    it('should invalidate portfolio cache', async () => {
      const userId = 'user123'
      
      await cacheService.connect()
      await cacheService.invalidatePortfolioCache(userId)
      
      expect(mockRedisClient.del).toHaveBeenCalledWith(`portfolio:${userId}`)
    })
  })

  describe('reconnection strategy', () => {
    it('should return false after max retries', () => {
      const reconnectStrategy = (createClient as jest.Mock).mock.calls[0][0].socket.reconnectStrategy
      
      expect(reconnectStrategy(11)).toBe(false) // More than maxRetries (10)
    })

    it('should return delay for valid retries', () => {
      const reconnectStrategy = (createClient as jest.Mock).mock.calls[0][0].socket.reconnectStrategy
      
      expect(reconnectStrategy(1)).toBe(100)
      expect(reconnectStrategy(5)).toBe(500)
      expect(reconnectStrategy(50)).toBe(3000) // Capped at 3000ms
    })
  })
})