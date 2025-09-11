# Redis Caching Patterns

This document outlines the caching strategies and patterns implemented in the Fin Agent platform for optimal performance and reliability.

## Overview

The platform uses Redis as the primary caching layer to improve response times and reduce load on external APIs and services. Our caching implementation focuses on three main data types:

1. **Market Data**: Real-time financial data with short TTL
2. **Agent Results**: AI processing results with medium TTL  
3. **Portfolio Data**: User portfolio information with medium TTL

## Caching Strategies

### 1. Market Data Caching

**Pattern**: Time-based keys with cleanup
**TTL**: 60 seconds (configurable)
**Key Format**: `market:{symbol}:{timestamp}`

```typescript
// Cache market data with timestamp
await cacheService.cacheMarketData('AAPL', marketData, 60)

// Retrieve fresh data (automatically handles stale data)
const data = await cacheService.getCachedMarketData('AAPL', 60)
```

**Benefits**:
- Automatic cleanup of stale data
- Prevents API rate limiting
- Reduces latency for frequently accessed symbols

**Cleanup Strategy**:
- Uses SCAN instead of KEYS for production safety
- Background cleanup of expired entries
- Automatic eviction based on maxAge parameter

### 2. Agent Result Caching

**Pattern**: Input-based hashing
**TTL**: 600 seconds (10 minutes)
**Key Format**: `agent:{agentId}:{inputHash}`

```typescript
// Cache AI agent results
await cacheService.cacheAgentResult('financial-analyzer', input, result, 600)

// Retrieve cached results
const cachedResult = await cacheService.getCachedAgentResult('financial-analyzer', input)
```

**Benefits**:
- Expensive AI computations cached
- Consistent results for identical inputs
- Significant cost savings on AI API calls

### 3. Portfolio Data Caching

**Pattern**: User-specific caching with invalidation
**TTL**: 300 seconds (5 minutes)
**Key Format**: `portfolio:{userId}`

```typescript
// Cache user portfolio
await cacheService.cachePortfolioData(userId, portfolioData, 300)

// Retrieve cached portfolio
const portfolio = await cacheService.getCachedPortfolioData(userId)

// Invalidate on updates
await cacheService.invalidatePortfolioCache(userId)
```

**Benefits**:
- Reduced database queries
- Improved dashboard loading times
- Manual invalidation on data changes

## Performance Optimizations

### Connection Management

```typescript
// Connection pooling enabled
isolationPoolOptions: {
  min: 2,
  max: 10
}

// Health checks available
const isHealthy = await cacheService.healthCheck()
```

### Error Handling

- **Graceful degradation**: Cache failures don't break functionality
- **Connection retry**: Automatic reconnection with exponential backoff
- **Circuit breaker**: Health checks prevent cascade failures

### Memory Management

- **LRU eviction**: `allkeys-lru` policy prevents memory overflow
- **TTL enforcement**: All keys have expiration times
- **Background cleanup**: Automated removal of stale data

## Best Practices

### 1. Key Naming Conventions

```typescript
// Good: Hierarchical and descriptive
market:AAPL:1609459200000
agent:financial-analyzer:hash123
portfolio:user123

// Avoid: Generic or flat keys
data:123
cache:item
temp:stuff
```

### 2. TTL Guidelines

| Data Type | TTL | Reasoning |
|-----------|-----|-----------|
| Market Data | 60s | Real-time requirements |
| Agent Results | 600s | Expensive to compute |
| Portfolio Data | 300s | Balance freshness/performance |
| User Sessions | 3600s | Standard session timeout |

### 3. Error Handling

```typescript
// Always handle cache failures gracefully
try {
  const cached = await cacheService.get(key)
  if (cached) return cached
} catch (error) {
  console.warn('Cache error, falling back to source:', error)
}

// Fetch from primary source
return await fetchFromSource()
```

### 4. Monitoring and Alerting

```typescript
// Health check integration
app.get('/health', async (req, res) => {
  const redisHealthy = await cacheService.healthCheck()
  
  res.json({
    status: redisHealthy ? 'healthy' : 'degraded',
    redis: redisHealthy
  })
})
```

## Security Considerations

### 1. Connection Security

- **TLS encryption**: `minimumTlsVersion: "1.2"`
- **No plaintext**: `enableNonSslPort: false`
- **Network isolation**: VNet integration in Azure

### 2. Access Control

- **Managed identity**: Preferred authentication method
- **Network Security Groups**: Restricted access rules
- **Private endpoints**: Internal communication only

### 3. Data Protection

```typescript
// Sensitive data handling
const sensitiveData = {
  publicInfo: data.public,
  // Never cache sensitive information
  // ssn: data.ssn,  ❌
  // password: data.password  ❌
}
await cacheService.set(key, sensitiveData, ttl)
```

## Performance Monitoring

### Key Metrics

1. **Hit Rate**: `cache_hits / (cache_hits + cache_misses)`
2. **Response Time**: Average cache operation latency
3. **Memory Usage**: Redis memory consumption
4. **Connection Pool**: Active/idle connections

### Monitoring Tools

```typescript
// Custom metrics
const startTime = Date.now()
const result = await cacheService.get(key)
const latency = Date.now() - startTime

// Log performance metrics
console.log(`Cache operation: ${latency}ms, hit: ${!!result}`)
```

### Performance Targets

- **Cache Hit Rate**: > 80%
- **Get Operation**: < 5ms average
- **Set Operation**: < 10ms average
- **Memory Usage**: < 80% of allocated

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check TTL configuration
   - Review key expiration policies
   - Monitor for memory leaks

2. **Low Hit Rates**
   - Verify key generation logic
   - Check TTL appropriateness
   - Review cache invalidation timing

3. **Connection Issues**
   - Validate network configuration
   - Check Redis server health
   - Review connection pool settings

### Debug Commands

```bash
# Redis CLI debugging
redis-cli info memory
redis-cli info stats
redis-cli monitor

# Application debugging
curl /health
docker logs container_name
```

## Migration and Scaling

### Horizontal Scaling

```typescript
// Redis Cluster configuration (future)
const cluster = new Redis.Cluster([
  { host: 'redis-node1', port: 6379 },
  { host: 'redis-node2', port: 6379 },
  { host: 'redis-node3', port: 6379 }
])
```

### Data Migration

```typescript
// Safe cache migration
async function migrateCache() {
  // Warm new cache
  await warmupCache()
  
  // Switch traffic
  await updateCacheEndpoint()
  
  // Cleanup old cache
  await cleanupOldCache()
}
```

This caching strategy ensures high performance, reliability, and scalability while maintaining data consistency and security across the Fin Agent platform.