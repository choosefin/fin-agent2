# Third-Party API & Data Sources Specification
## Fin Agent Platform Integration Guide

> **Version**: 1.0  
> **Date**: September 2025  
> **Purpose**: Comprehensive specification for porting third-party integrations to other applications

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Architecture](#core-architecture)
3. [Market Data Providers](#market-data-providers)
4. [AI/LLM Providers](#aillm-providers)
5. [News & Sentiment Analysis](#news--sentiment-analysis)
6. [Financial Services](#financial-services)
7. [Options Data Providers](#options-data-providers)
8. [Infrastructure Services](#infrastructure-services)
9. [Charting & Visualization](#charting--visualization)
10. [Configuration Management](#configuration-management)
11. [Integration Patterns](#integration-patterns)
12. [Migration Guidelines](#migration-guidelines)

---

## Executive Summary

The Fin Agent platform integrates with **20+ third-party services** across 7 major categories. This specification provides complete technical details for porting these integrations to other applications, including API specifications, authentication methods, data schemas, and implementation patterns.

### Key Integration Categories:
- **Market Data**: 4 providers (Polygon, Alpaca, Yahoo Finance, Databento)
- **AI/LLM**: 4 providers (OpenAI, Anthropic, Groq, Mastra)
- **News & Sentiment**: 3 providers (Finnhub, NewsAPI, Unusual Whales)
- **Financial Services**: 2 providers (Plaid, Supabase)
- **Options Data**: 3 providers (Polygon, Alpaca, CBOE)
- **Infrastructure**: 4 services (Redis, Fly.io, Vercel, Azure)
- **Visualization**: 1 provider (TradingView)

---

## Core Architecture

### Integration Pattern
```typescript
interface ProviderInterface {
  name: string;
  priority: number;
  authenticate(): Promise<boolean>;
  healthCheck(): Promise<boolean>;
  rateLimit: RateLimitConfig;
  fallback?: ProviderInterface;
}
```

### Fallback Strategy
1. **Primary Provider** → **Secondary Provider** → **Tertiary Provider**
2. Automatic failover on errors/rate limits
3. Circuit breaker pattern implementation
4. Redis-based caching layer

---

## Market Data Providers

### 1. Polygon.io (Primary Provider)

**Priority**: High | **Status**: Production Ready

#### Authentication
```typescript
interface PolygonConfig {
  apiKey: string;
  baseUrl: "https://api.polygon.io";
  version: "v3" | "v2" | "v1";
}
```

#### Endpoints Used
- **Quotes**: `/v3/quotes/{ticker}`
- **Aggregates**: `/v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}`
- **Options**: `/v3/reference/options/contracts`
- **News**: `/v2/reference/news`
- **Market Status**: `/v1/marketstatus/now`

#### Data Schema
```typescript
interface PolygonQuote {
  ticker: string;
  last: {
    price: number;
    size: number;
    timestamp: number;
  };
  bid: number;
  ask: number;
  volume: number;
}
```

#### Rate Limits
- **Free Tier**: 5 calls/minute
- **Basic**: 100 calls/minute  
- **Starter**: 1,000 calls/minute
- **Developer**: 10,000 calls/minute

#### Implementation Notes
- Primary provider for real-time quotes
- Excellent options chain data
- WebSocket support for real-time feeds
- Strong historical data coverage

---

### 2. Alpaca Markets (Secondary Provider)

**Priority**: Medium | **Status**: Production Ready

#### Authentication
```typescript
interface AlpacaConfig {
  keyId: string;
  secretKey: string;
  baseUrl: "https://api.alpaca.markets";
  dataUrl: "https://data.alpaca.markets";
  optionsUrl: "https://data.alpaca.markets/v1beta1/options";
}
```

#### Endpoints Used
- **Quotes**: `/v2/stocks/{symbol}/quotes/latest`
- **Bars**: `/v2/stocks/{symbol}/bars`
- **Options**: `/v1beta1/options/bars`
- **Trading**: `/v2/orders`

#### Data Schema
```typescript
interface AlpacaQuote {
  symbol: string;
  quote: {
    bid_price: number;
    ask_price: number;
    bid_size: number;
    ask_size: number;
    timestamp: string;
  };
}
```

#### Rate Limits
- **Free**: 200 requests/minute
- **Unlimited**: No limits with paid plan

#### Implementation Notes
- Excellent for commission-free trading
- Good options data coverage
- Real-time market data feed
- Strong paper trading environment

---

### 3. Yahoo Finance (Tertiary/Fallback Provider)

**Priority**: Low | **Status**: Fallback Only

#### Implementation
```typescript
import yahooFinance from 'yahoo-finance2';

interface YahooQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketVolume: number;
  bid: number;
  ask: number;
}
```

#### Usage
- Fallback provider when primary/secondary fail
- Free but unreliable for production
- No official API (scraping-based)
- Limited to basic quotes

---

### 4. Databento (Professional Grade)

**Priority**: High | **Status**: Configured (Premium)

#### Authentication
```typescript
interface DatabentoConfig {
  apiKey: string;
  baseUrl: "https://hist.databento.com";
}
```

#### Features
- Professional-grade market data
- Microsecond timestamps
- Full market depth
- Historical tick data
- Low-latency feeds

---

## AI/LLM Providers

### 1. OpenAI (Primary AI Provider)

**Priority**: High | **Status**: Production Ready

#### Authentication
```typescript
interface OpenAIConfig {
  apiKey: string;
  baseURL: "https://api.openai.com/v1";
  organization?: string;
}
```

#### Models Used
- **GPT-4O**: Latest optimized model
- **GPT-4-Turbo**: High performance
- **GPT-4**: Standard model
- **GPT-3.5-Turbo**: Cost-effective option

#### Endpoints
- **Chat Completions**: `/chat/completions`
- **Embeddings**: `/embeddings`
- **Fine-tuning**: `/fine_tuning/jobs`

#### Implementation Example
```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{"role": "user", "content": "Analyze AAPL sentiment"}],
  temperature: 0.7,
  max_tokens: 1000
});
```

---

### 2. Anthropic Claude (Secondary AI Provider)

**Priority**: High | **Status**: Production Ready

#### Authentication
```typescript
interface AnthropicConfig {
  apiKey: string;
  baseURL: "https://api.anthropic.com";
}
```

#### Models Used
- **Claude-3-Opus**: Highest capability
- **Claude-3-Sonnet**: Balanced performance
- **Claude-3-Haiku**: Fast responses

#### Features
- Long context windows (200k+ tokens)
- Strong reasoning capabilities
- Constitutional AI safety
- Excellent for financial analysis

---

### 3. Groq (High-Speed Inference)

**Priority**: Medium | **Status**: Production Ready

#### Authentication
```typescript
interface GroqConfig {
  apiKey: string;
  baseURL: "https://api.groq.com/openai/v1";
}
```

#### Models Available
- **LLaMA3-70B**: High performance
- **LLaMA3-8B**: Balanced
- **LLaMA3.1-8B-Instant**: Ultra-fast
- **Mixtral-8x7B**: Strong reasoning
- **Gemma-7B**: Lightweight

#### Use Cases
- Real-time trading signals
- Fast sentiment analysis
- Quick market summaries

---

### 4. Mastra AI SDK (Agent Orchestration)

**Priority**: Medium | **Status**: Development

#### Features
- Agent orchestration
- Memory management
- RAG (Retrieval Augmented Generation)
- Multi-model routing

---

## News & Sentiment Analysis

### 1. Finnhub (Primary News Provider)

**Priority**: High | **Status**: Production Ready

#### Authentication
```typescript
interface FinnhubConfig {
  apiKey: string;
  baseUrl: "https://finnhub.io/api/v1";
  webhookSecret?: string;
}
```

#### Endpoints Used
- **Company News**: `/company-news`
- **Market News**: `/news`
- **Sentiment**: `/news-sentiment`
- **Buzz**: `/stock/social-sentiment`

#### Data Schema
```typescript
interface FinnhubNews {
  id: string;
  headline: string;
  summary: string;
  url: string;
  datetime: number;
  source: string;
  symbol: string;
  sentiment?: {
    bullishPercent: number;
    bearishPercent: number;
  };
}
```

#### Rate Limits
- **Free**: 60 calls/minute
- **Paid**: 300+ calls/minute

---

### 2. News API (General News)

**Priority**: Medium | **Status**: Production Ready

#### Authentication
```typescript
interface NewsAPIConfig {
  apiKey: string;
  baseUrl: "https://newsapi.org/v2";
}
```

#### Endpoints
- **Top Headlines**: `/top-headlines`
- **Everything**: `/everything`
- **Sources**: `/sources`

#### Use Cases
- General business news
- Market sentiment analysis
- Economic indicators

---

### 3. Unusual Whales (Options Flow)

**Priority**: High | **Status**: Production Ready

#### Authentication
```typescript
interface UnusualWhalesConfig {
  apiKey: string;
  baseUrl: "https://api.unusualwhales.com/api";
}
```

#### Features
- Unusual options activity
- Flow analysis
- Market sentiment indicators
- Social sentiment tracking

---

## Financial Services

### 1. Plaid (Banking Integration)

**Priority**: High | **Status**: Production Ready

#### Authentication
```typescript
interface PlaidConfig {
  clientId: string;
  secret: string;
  env: "sandbox" | "development" | "production";
  webhookUrl?: string;
  redirectUri?: string;
}
```

#### Products Used
- **Transactions**: Historical transaction data
- **Accounts**: Bank account information
- **Auth**: Account verification
- **Identity**: Account holder verification

#### Environments
- **Sandbox**: Testing environment
- **Development**: Development environment  
- **Production**: Live environment

#### Implementation Flow
```typescript
// 1. Create Link Token
const linkToken = await plaidClient.linkTokenCreate({
  user: { client_user_id: userId },
  client_name: "Fin Agent",
  products: ["transactions", "accounts"],
  country_codes: ["US"],
});

// 2. Exchange Public Token
const response = await plaidClient.itemPublicTokenExchange({
  public_token: publicToken
});
```

---

### 2. Supabase (Database & Auth)

**Priority**: High | **Status**: Production Ready

#### Configuration
```typescript
interface SupabaseConfig {
  url: string;
  serviceKey: string;
  anonKey: string;
  serviceRoleKey: string;
}
```

#### Features Used
- **Database**: PostgreSQL with real-time
- **Authentication**: User management
- **Storage**: File storage
- **Edge Functions**: Serverless functions
- **Real-time**: WebSocket subscriptions

---

## Options Data Providers

### 1. Polygon.io Options

**Priority**: High | **Status**: Production Ready

#### Endpoints
- **Options Contracts**: `/v3/reference/options/contracts`
- **Options Quotes**: `/v3/quotes/{optionsTicker}`
- **Options Aggregates**: `/v2/aggs/ticker/{optionsTicker}`

#### Data Schema
```typescript
interface OptionsContract {
  ticker: string;
  underlying_ticker: string;
  contract_type: "call" | "put";
  strike_price: number;
  expiration_date: string;
  exercise_style: "american" | "european";
}
```

---

### 2. Alpaca Options

**Priority**: Medium | **Status**: Production Ready

#### Endpoints
- **Options Bars**: `/v1beta1/options/bars`
- **Options Quotes**: `/v1beta1/options/quotes/latest`
- **Options Meta**: `/v1beta1/options/meta/exchanges`

---

### 3. CBOE (Recommended Addition)

**Priority**: High | **Status**: Recommended

#### Features
- Official options exchange data
- VIX and volatility indices
- Options volume and open interest
- Real-time options quotes

#### API Endpoints
- **VIX Data**: Historical and real-time VIX
- **Options Volume**: Daily volume statistics
- **Put/Call Ratios**: Market sentiment indicators

---

## Infrastructure Services

### 1. Redis (Caching & Sessions)

**Configuration**
```typescript
interface RedisConfig {
  url?: string;
  host: string;
  port: number;
  user?: string;
  password?: string;
}
```

#### Use Cases
- API response caching
- Session management
- Rate limiting
- Pub/sub messaging
- Real-time data buffering

---

### 2. Fly.io (Application Deployment)

**Services Deployed**
- **API Gateway**: `fin-agent-api-gateway.fly.dev`
- **Data Service**: `fin-agent-data-service.fly.dev`
- **Agents Service**: `fin-agent-agents-service.fly.dev`
- **Oracle Service**: `fin-agent-oracle-service.fly.dev`

#### Configuration Files
- `fly-api-gateway.toml`
- `fly-data-service.toml`
- `fly-agents-service.toml`
- `fly-oracle-service.toml`

---

### 3. Vercel (Frontend Hosting)

**Configuration**: `vercel.json`

#### Features
- Next.js optimized hosting
- Edge functions
- API route proxying
- Automatic deployments

---

### 4. Azure (Alternative Deployment)

**Infrastructure**: `/infrastructure/azure/`

#### Services
- Container instances
- Storage accounts
- Load balancers
- Database services

---

## Charting & Visualization

### 1. TradingView Charting Library

**Priority**: High | **Status**: Production Ready

#### Implementation
- **Library Path**: `/frontend/public/charting_library/`
- **UDF Endpoint**: `/routes/tradingview.routes.ts`
- **Repository**: `https://github.com/tradingview/charting_library`

#### Features
- Professional trading charts
- Technical indicators
- Drawing tools
- Multiple timeframes
- Custom data feeds

#### UDF (Universal Data Feed) Endpoints
```typescript
interface UDFEndpoints {
  config: "/config";
  symbols: "/symbols";
  search: "/search";
  history: "/history";
  marks: "/marks";
  time: "/time";
}
```

---

## Configuration Management

### Environment Variables

```bash
# ===== AI/LLM PROVIDERS =====
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...

# ===== MARKET DATA PROVIDERS =====
POLYGON_API_KEY=...
ALPACA_API_KEY_ID=...
ALPACA_API_SECRET_KEY=...
DATABENTO_API_KEY=...

# ===== NEWS & SENTIMENT =====
FINNHUB_API_KEY=...
FINNHUB_WEBHOOK_SECRET=...
UNUSUAL_WHALES_API_KEY=...
NEWS_API_KEY=...

# ===== FINANCIAL SERVICES =====
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENV=sandbox|development|production
PLAID_WEBHOOK_URL=...
PLAID_WEBHOOK_VERIFICATION_KEY=...
PLAID_REDIRECT_URI=...
PLAID_PRODUCTS=transactions,accounts,auth
PLAID_COUNTRY_CODES=US

# ===== DATABASE & STORAGE =====
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_KEY=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# ===== CACHING & SESSIONS =====
REDIS_URL=redis://...
REDIS_HOST=...
REDIS_PORT=6379
REDIS_USER=...
REDIS_PASSWORD=...

# ===== AUTHENTICATION =====
JWT_SECRET=...

# ===== DEPLOYMENT =====
FLY_API_TOKEN=...
VERCEL_TOKEN=...
```

### Provider Priority Matrix

| Service Type | Primary | Secondary | Tertiary |
|-------------|---------|-----------|----------|
| **Market Data** | Polygon.io | Alpaca | Yahoo Finance |
| **AI/LLM** | OpenAI | Anthropic | Groq |
| **News** | Finnhub | NewsAPI | - |
| **Options** | Polygon | Alpaca | CBOE* |
| **Charts** | TradingView | - | - |

*Recommended addition

---

## Integration Patterns

### 1. Provider Factory Pattern

```typescript
class ProviderFactory {
  static createMarketDataProvider(config: Config): MarketDataProvider {
    const providers = [
      new PolygonProvider(config.polygon),
      new AlpacaProvider(config.alpaca),
      new YahooFinanceProvider()
    ];
    
    return new FallbackProvider(providers);
  }
}
```

### 2. Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
```

### 3. Caching Strategy

```typescript
class CachedProvider implements MarketDataProvider {
  constructor(
    private provider: MarketDataProvider,
    private cache: CacheInterface,
    private ttl: number = 30000 // 30 seconds
  ) {}
  
  async getQuote(symbol: string): Promise<Quote> {
    const cacheKey = `quote:${symbol}`;
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    const quote = await this.provider.getQuote(symbol);
    await this.cache.setex(cacheKey, this.ttl, JSON.stringify(quote));
    
    return quote;
  }
}
```

### 4. Rate Limiting

```typescript
class RateLimitedProvider implements MarketDataProvider {
  private limiter = new RateLimiter({
    tokensPerInterval: 100,
    interval: 'minute'
  });
  
  async getQuote(symbol: string): Promise<Quote> {
    await this.limiter.removeTokens(1);
    return this.provider.getQuote(symbol);
  }
}
```

---

## Migration Guidelines

### Phase 1: Core Services (Week 1-2)
1. **Database Migration**
   - Set up Supabase instance
   - Migrate data schemas
   - Configure authentication

2. **Market Data Setup**
   - Configure Polygon.io API
   - Set up Alpaca as fallback
   - Implement caching layer

### Phase 2: AI & Analysis (Week 3-4)
1. **AI Provider Setup**
   - Configure OpenAI API
   - Set up Anthropic as alternative
   - Implement model routing

2. **News & Sentiment**
   - Configure Finnhub API
   - Set up sentiment analysis pipeline
   - Implement news aggregation

### Phase 3: Financial Services (Week 5-6)
1. **Banking Integration**
   - Set up Plaid integration
   - Configure webhooks
   - Implement transaction sync

2. **Options Data**
   - Configure options providers
   - Set up real-time feeds
   - Implement options analysis

### Phase 4: Infrastructure (Week 7-8)
1. **Deployment**
   - Set up hosting infrastructure
   - Configure monitoring
   - Implement health checks

2. **Optimization**
   - Fine-tune caching
   - Optimize rate limiting
   - Performance testing

### Critical Dependencies

```json
{
  "dependencies": {
    "@polygon.io/client-js": "^8.2.0",
    "@anthropic-ai/sdk": "^0.20.1",
    "@supabase/supabase-js": "^2.57.0",
    "plaid": "^38.1.0",
    "openai": "^4.29.2",
    "yahoo-finance2": "^2.11.1",
    "redis": "^4.6.0",
    "@tanstack/react-query": "^5.87.1"
  }
}
```

### Cost Estimation

| Service | Monthly Cost | Usage Tier |
|---------|-------------|------------|
| **Polygon.io** | $99-$399 | Starter-Developer |
| **OpenAI** | $50-$500 | Usage-based |
| **Plaid** | $0.60-$1.20/link | Per connection |
| **Supabase** | $25-$100 | Pro-Team |
| **Finnhub** | $0-$99 | Free-Premium |
| **Redis Cloud** | $0-$50 | Usage-based |
| **Fly.io** | $20-$100 | Multi-service |

**Total Estimated Range**: $244-$1,248/month

---

## Security Considerations

### API Key Management
- Use environment variables for all API keys
- Implement key rotation policies
- Monitor usage and rate limits
- Set up alerts for unusual activity

### Data Protection
- Encrypt sensitive financial data
- Implement proper access controls
- Use HTTPS for all API communications
- Regular security audits

### Compliance
- Follow financial data regulations
- Implement proper data retention policies
- Ensure PCI compliance for payment data
- Document all data flows

---

## Monitoring & Health Checks

### Provider Health Monitoring
```typescript
interface ProviderHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  errorRate: number;
  lastCheck: Date;
}
```

### Key Metrics
- API response times
- Error rates by provider
- Cache hit rates
- Rate limit utilization
- Data freshness

### Alerting
- Provider failures
- High error rates
- Rate limit approaching
- Unusual cost spikes
- Security incidents

---

This specification provides a complete blueprint for migrating all third-party integrations to a new application. Each service includes authentication details, API specifications, data schemas, rate limits, and implementation patterns necessary for successful integration.