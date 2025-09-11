# Performance Tuning Guide

This guide provides comprehensive recommendations for optimizing the Fin Agent platform's performance across all components.

## Architecture Overview

The Fin Agent platform consists of:
- **Frontend**: Next.js application
- **Backend**: Fastify API with Mastra framework
- **Cache**: Redis for data caching
- **Database**: Supabase (PostgreSQL)
- **External APIs**: Plaid, market data providers, AI services

## Performance Metrics & Targets

### Target Performance Metrics

| Component | Metric | Target | Critical |
|-----------|--------|--------|----------|
| API Response | Average latency | < 200ms | < 500ms |
| Cache Hit Rate | Redis hit rate | > 80% | > 60% |
| Database Queries | Average query time | < 50ms | < 200ms |
| Page Load | Time to Interactive | < 3s | < 5s |
| Memory Usage | Container memory | < 80% | < 95% |
| CPU Usage | Container CPU | < 70% | < 90% |

### Key Performance Indicators

```typescript
// Custom performance monitoring
export class PerformanceMonitor {
  private metrics = {
    apiLatency: new Map<string, number[]>(),
    cacheHitRate: { hits: 0, misses: 0 },
    dbQueryTimes: []
  }

  recordApiLatency(endpoint: string, duration: number) {
    if (!this.metrics.apiLatency.has(endpoint)) {
      this.metrics.apiLatency.set(endpoint, [])
    }
    this.metrics.apiLatency.get(endpoint)!.push(duration)
  }

  recordCacheHit(hit: boolean) {
    if (hit) this.metrics.cacheHitRate.hits++
    else this.metrics.cacheHitRate.misses++
  }

  getStats() {
    const cacheHitRate = this.metrics.cacheHitRate.hits / 
      (this.metrics.cacheHitRate.hits + this.metrics.cacheHitRate.misses)
    
    return {
      cacheHitRate,
      apiLatencies: Object.fromEntries(
        Array.from(this.metrics.apiLatency.entries()).map(([key, values]) => [
          key, 
          values.reduce((a, b) => a + b, 0) / values.length
        ])
      )
    }
  }
}
```

## Redis Performance Optimization

### 1. Connection Pool Tuning

```typescript
// Optimized Redis configuration
const redisConfig = {
  socket: {
    connectTimeout: 5000,
    commandTimeout: 3000,
    lazyConnect: true,
    keepAlive: 30000,
    reconnectStrategy: (retries) => Math.min(retries * 50, 2000)
  },
  // Connection pooling
  isolationPoolOptions: {
    min: 5,        // Minimum connections
    max: 20,       // Maximum connections  
    acquireTimeout: 3000,
    idleTimeout: 30000
  },
  // Pipeline commands for better throughput
  enableAutoPipelining: true,
  maxRetriesPerRequest: 3
}
```

### 2. Memory Optimization

```json
// Redis configuration in ARM template
{
  "redisConfiguration": {
    "maxmemory-policy": "allkeys-lru",
    "maxmemory-samples": "10",
    "timeout": "300",
    "tcp-keepalive": "60"
  }
}
```

### 3. Caching Strategies

```typescript
// Intelligent cache warming
export class CacheWarmer {
  async warmupMarketData(symbols: string[]) {
    const promises = symbols.map(async symbol => {
      try {
        const data = await fetchMarketData(symbol)
        await cacheService.cacheMarketData(symbol, data, 300)
      } catch (error) {
        console.warn(`Failed to warm cache for ${symbol}:`, error)
      }
    })
    
    await Promise.allSettled(promises)
  }

  async warmupUserData(userId: string) {
    const [portfolio, preferences, history] = await Promise.allSettled([
      this.warmupPortfolio(userId),
      this.warmupUserPreferences(userId), 
      this.warmupTransactionHistory(userId)
    ])
  }
}
```

### 4. Cache Invalidation Optimization

```typescript
// Smart cache invalidation
export class CacheInvalidationService {
  async invalidateRelated(key: string, pattern?: string) {
    if (pattern) {
      // Use SCAN for safe pattern-based deletion
      const keysToDelete = []
      for await (const k of this.client.scanIterator({ MATCH: pattern })) {
        keysToDelete.push(k)
      }
      
      if (keysToDelete.length > 0) {
        await this.client.del(keysToDelete)
      }
    } else {
      await this.client.del(key)
    }
  }

  // Batch invalidation for efficiency
  async batchInvalidate(keys: string[]) {
    if (keys.length === 0) return
    
    // Process in chunks to avoid overwhelming Redis
    const chunkSize = 100
    for (let i = 0; i < keys.length; i += chunkSize) {
      const chunk = keys.slice(i, i + chunkSize)
      await this.client.del(chunk)
    }
  }
}
```

## Database Performance Optimization

### 1. Query Optimization

```sql
-- Index creation for common queries
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id_date ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_symbol_timestamp ON market_data(symbol, timestamp DESC);

-- Partial indexes for performance
CREATE INDEX IF NOT EXISTS idx_active_portfolios ON portfolios(user_id) WHERE active = true;
```

### 2. Connection Pooling

```typescript
// Supabase client optimization
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    db: {
      schema: 'public'
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: { 'x-my-custom-header': 'my-app-name' },
    },
  }
)

// Connection pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                 // Maximum connections
  min: 5,                  // Minimum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000
})
```

### 3. Query Batching

```typescript
// Batch database operations
export class DatabaseBatcher {
  private batch: Array<{ query: string, params: any[] }> = []
  private batchTimeout: NodeJS.Timeout | null = null

  addQuery(query: string, params: any[]) {
    this.batch.push({ query, params })
    
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => this.executeBatch(), 100)
    }
  }

  private async executeBatch() {
    if (this.batch.length === 0) return
    
    const queries = this.batch.splice(0) // Clear batch
    this.batchTimeout = null
    
    try {
      await Promise.all(queries.map(({ query, params }) => 
        supabase.rpc(query, params)
      ))
    } catch (error) {
      console.error('Batch execution failed:', error)
    }
  }
}
```

## API Performance Optimization

### 1. Response Compression

```typescript
// Fastify compression plugin
import compression from '@fastify/compress'

await fastify.register(compression, {
  global: true,
  encodings: ['gzip', 'deflate'],
  threshold: 1024 // Only compress responses > 1KB
})
```

### 2. Request Rate Limiting

```typescript
// Rate limiting configuration
import rateLimit from '@fastify/rate-limit'

await fastify.register(rateLimit, {
  max: 100,           // 100 requests
  timeWindow: '1 minute',
  cache: 10000,       // Cache 10k rate limit records
  allowList: ['127.0.0.1'],
  redis: redisClient, // Use Redis for distributed rate limiting
  keyGenerator: (request) => request.ip,
  errorResponseBuilder: (request, context) => ({
    code: 429,
    error: 'Too Many Requests',
    message: `Rate limit exceeded, retry in ${context.ttl}ms`,
    date: Date.now(),
    expiresIn: context.ttl
  })
})
```

### 3. Response Caching

```typescript
// HTTP response caching
export class ResponseCache {
  private cache = new Map<string, { data: any, expires: number }>()

  generateKey(req: FastifyRequest): string {
    return `${req.method}:${req.url}:${JSON.stringify(req.query)}`
  }

  get(key: string) {
    const cached = this.cache.get(key)
    if (!cached || cached.expires < Date.now()) {
      this.cache.delete(key)
      return null
    }
    return cached.data
  }

  set(key: string, data: any, ttl = 300000) { // 5 minutes default
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl
    })
  }
}

// Middleware implementation
const responseCache = new ResponseCache()

fastify.addHook('preHandler', async (request, reply) => {
  if (request.method === 'GET') {
    const key = responseCache.generateKey(request)
    const cached = responseCache.get(key)
    if (cached) {
      reply.send(cached)
    }
  }
})

fastify.addHook('onSend', async (request, reply, payload) => {
  if (request.method === 'GET' && reply.statusCode === 200) {
    const key = responseCache.generateKey(request)
    responseCache.set(key, payload)
  }
})
```

## External API Optimization

### 1. Request Batching

```typescript
// Batch API requests to reduce external calls
export class APIBatcher {
  private batches = new Map<string, {
    requests: Array<{ symbol: string, resolve: Function, reject: Function }>,
    timeout: NodeJS.Timeout
  }>()

  async batchMarketDataRequest(symbol: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const batchKey = 'market-data'
      
      if (!this.batches.has(batchKey)) {
        this.batches.set(batchKey, {
          requests: [],
          timeout: setTimeout(() => this.executeBatch(batchKey), 100)
        })
      }
      
      const batch = this.batches.get(batchKey)!
      batch.requests.push({ symbol, resolve, reject })
      
      // Execute immediately if batch is full
      if (batch.requests.length >= 10) {
        clearTimeout(batch.timeout)
        this.executeBatch(batchKey)
      }
    })
  }

  private async executeBatch(batchKey: string) {
    const batch = this.batches.get(batchKey)
    if (!batch || batch.requests.length === 0) return
    
    this.batches.delete(batchKey)
    
    try {
      const symbols = batch.requests.map(r => r.symbol)
      const results = await this.fetchMultipleSymbols(symbols)
      
      batch.requests.forEach((req, index) => {
        req.resolve(results[req.symbol])
      })
    } catch (error) {
      batch.requests.forEach(req => req.reject(error))
    }
  }
}
```

### 2. Circuit Breaker Pattern

```typescript
export class CircuitBreaker {
  private failures = 0
  private nextAttempt = Date.now()
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  
  constructor(
    private threshold = 5,
    private timeout = 60000,
    private monitoringPeriod = 10000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN')
      }
      this.state = 'HALF_OPEN'
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure() {
    this.failures++
    if (this.failures >= this.threshold) {
      this.state = 'OPEN'
      this.nextAttempt = Date.now() + this.timeout
    }
  }
}
```

## Frontend Performance Optimization

### 1. Code Splitting and Lazy Loading

```typescript
// Dynamic imports for route-based code splitting
const Portfolio = dynamic(() => import('./components/Portfolio'), {
  loading: () => <LoadingSpinner />,
  ssr: false
})

const Dashboard = dynamic(() => import('./components/Dashboard'), {
  loading: () => <LoadingSpinner />
})

// Component-level code splitting
const TradingViewChart = dynamic(() => import('./TradingViewChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false // Chart components often don't work with SSR
})
```

### 2. Caching Strategies

```typescript
// SWR configuration for client-side caching
import useSWR from 'swr'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export function usePortfolioData(userId: string) {
  return useSWR(
    `/api/portfolio/${userId}`,
    fetcher,
    {
      refreshInterval: 30000,       // Refresh every 30 seconds
      revalidateOnFocus: true,      // Revalidate when window regains focus
      revalidateOnReconnect: true,  // Revalidate on network reconnect
      dedupingInterval: 10000,      // Dedupe requests within 10 seconds
      errorRetryInterval: 5000,     // Retry failed requests after 5 seconds
      errorRetryCount: 3            // Maximum 3 retries
    }
  )
}
```

### 3. Image Optimization

```typescript
// Next.js Image component with optimization
import Image from 'next/image'

export function OptimizedImage({ src, alt, ...props }) {
  return (
    <Image
      src={src}
      alt={alt}
      priority={props.priority}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      {...props}
    />
  )
}
```

## Azure Infrastructure Optimization

### 1. Container Resource Allocation

```json
// Optimized resource allocation in ARM template
{
  "containers": [
    {
      "name": "backend",
      "resources": {
        "requests": {
          "cpu": 1.5,
          "memoryInGB": 3
        },
        "limits": {
          "cpu": 2,
          "memoryInGB": 4
        }
      }
    },
    {
      "name": "web",
      "resources": {
        "requests": {
          "cpu": 0.5,
          "memoryInGB": 1
        },
        "limits": {
          "cpu": 1,
          "memoryInGB": 2
        }
      }
    }
  ]
}
```

### 2. Auto-scaling Configuration

```json
// Container instance scaling profile
{
  "scaleSettings": {
    "minReplicas": 2,
    "maxReplicas": 10,
    "rules": [
      {
        "metricTrigger": {
          "metricName": "CpuUsage",
          "metricNamespace": "Microsoft.ContainerInstance/containerGroups",
          "threshold": 70,
          "operator": "GreaterThan",
          "timeGrain": "PT1M",
          "timeWindow": "PT5M",
          "statistic": "Average"
        },
        "scaleAction": {
          "direction": "Increase",
          "type": "ChangeCount",
          "value": 2,
          "cooldown": "PT5M"
        }
      }
    ]
  }
}
```

## Monitoring and Alerting

### 1. Performance Monitoring

```typescript
// Custom performance monitoring
export class PerformanceLogger {
  static logAPICall(endpoint: string, duration: number, success: boolean) {
    console.log(JSON.stringify({
      type: 'api_call',
      endpoint,
      duration,
      success,
      timestamp: new Date().toISOString()
    }))
  }

  static logCacheOperation(operation: string, key: string, hit: boolean, duration: number) {
    console.log(JSON.stringify({
      type: 'cache_operation',
      operation,
      key,
      hit,
      duration,
      timestamp: new Date().toISOString()
    }))
  }
}
```

### 2. Health Check Endpoints

```typescript
// Comprehensive health checks
app.get('/health', async (req, res) => {
  const startTime = Date.now()
  
  const checks = await Promise.allSettled([
    checkRedisHealth(),
    checkDatabaseHealth(),
    checkExternalAPIs(),
    checkSystemResources()
  ])

  const results = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    checks: {
      redis: checks[0].status === 'fulfilled' ? checks[0].value : false,
      database: checks[1].status === 'fulfilled' ? checks[1].value : false,
      external_apis: checks[2].status === 'fulfilled' ? checks[2].value : false,
      system: checks[3].status === 'fulfilled' ? checks[3].value : false
    }
  }

  const allHealthy = Object.values(results.checks).every(Boolean)
  results.status = allHealthy ? 'healthy' : 'degraded'
  
  res.status(allHealthy ? 200 : 503).json(results)
})
```

## Load Testing and Benchmarking

### 1. Load Testing Setup

```bash
# Artillery.js load testing configuration
cat > artillery.yml << EOF
config:
  target: 'http://your-container-group-fqdn:3001'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 60
      arrivalRate: 10
  defaults:
    headers:
      Content-Type: 'application/json'

scenarios:
  - name: "API Load Test"
    flow:
      - get:
          url: "/health"
      - get:
          url: "/api/portfolio/{{ userId }}"
      - post:
          url: "/api/market-data"
          json:
            symbols: ["AAPL", "GOOGL", "MSFT"]
EOF

# Run load test
npx artillery run artillery.yml
```

### 2. Performance Benchmarking

```typescript
// Benchmark utility
export class Benchmark {
  static async measureOperation<T>(
    name: string, 
    operation: () => Promise<T>
  ): Promise<{ result: T, duration: number }> {
    const start = Date.now()
    const result = await operation()
    const duration = Date.now() - start
    
    console.log(`[BENCHMARK] ${name}: ${duration}ms`)
    return { result, duration }
  }

  static async measureMultiple<T>(
    name: string,
    operation: () => Promise<T>,
    iterations = 100
  ): Promise<{ average: number, min: number, max: number }> {
    const durations: number[] = []
    
    for (let i = 0; i < iterations; i++) {
      const { duration } = await this.measureOperation(`${name}-${i}`, operation)
      durations.push(duration)
    }
    
    return {
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations)
    }
  }
}
```

This performance tuning guide provides a comprehensive approach to optimizing every aspect of the Fin Agent platform, from caching strategies to infrastructure configuration.