# Data Schemas & Integration Patterns
## Fin Agent Platform - Technical Implementation Guide

> **Companion Document**: `third-party-api-specification.md`  
> **Version**: 1.0  
> **Purpose**: Detailed technical schemas and patterns for third-party API integrations

---

## Table of Contents

1. [Data Schema Standards](#data-schema-standards)
2. [Market Data Schemas](#market-data-schemas)
3. [AI/LLM Integration Schemas](#aillm-integration-schemas)
4. [News & Sentiment Schemas](#news--sentiment-schemas)
5. [Financial Services Schemas](#financial-services-schemas)
6. [Options Data Schemas](#options-data-schemas)
7. [Integration Patterns](#integration-patterns)
8. [Error Handling Patterns](#error-handling-patterns)
9. [Caching Strategies](#caching-strategies)
10. [Real-time Data Patterns](#real-time-data-patterns)

---

## Data Schema Standards

### Base Interface Conventions

```typescript
// Universal base interfaces
interface BaseTimestamp {
  createdAt: Date;
  updatedAt: Date;
}

interface BaseProvider {
  provider: string;
  providerId?: string;
  confidence?: number; // 0-1 confidence score
}

interface BaseErrorResponse {
  error: boolean;
  message: string;
  code?: string;
  timestamp: Date;
  provider?: string;
}

interface BaseSuccessResponse<T> {
  success: boolean;
  data: T;
  timestamp: Date;
  provider: string;
  cached?: boolean;
  ttl?: number;
}

// Unified response wrapper
type APIResponse<T> = BaseSuccessResponse<T> | BaseErrorResponse;
```

### Validation Schemas

```typescript
import { z } from 'zod';

const SymbolSchema = z.string()
  .min(1)
  .max(10)
  .regex(/^[A-Z0-9.]+$/, 'Invalid symbol format');

const PriceSchema = z.number()
  .positive()
  .finite();

const VolumeSchema = z.number()
  .nonnegative()
  .finite();

const TimestampSchema = z.union([
  z.string().datetime(),
  z.number().int().positive(),
  z.date()
]);
```

---

## Market Data Schemas

### 1. Universal Quote Schema

```typescript
interface UniversalQuote extends BaseProvider, BaseTimestamp {
  symbol: string;
  price: {
    last: number;
    bid: number;
    ask: number;
    open: number;
    high: number;
    low: number;
    close?: number; // Previous close
  };
  volume: {
    current: number;
    average?: number;
    total?: number;
  };
  spread: {
    absolute: number;
    percentage: number;
  };
  marketStatus: 'open' | 'closed' | 'pre_market' | 'after_hours';
  exchange: string;
  currency: string;
  timestamp: Date;
  delay?: number; // Data delay in seconds
}

// Validation
const QuoteSchema = z.object({
  symbol: SymbolSchema,
  price: z.object({
    last: PriceSchema,
    bid: PriceSchema,
    ask: PriceSchema,
    open: PriceSchema,
    high: PriceSchema,
    low: PriceSchema,
    close: PriceSchema.optional(),
  }),
  volume: z.object({
    current: VolumeSchema,
    average: VolumeSchema.optional(),
    total: VolumeSchema.optional(),
  }),
  marketStatus: z.enum(['open', 'closed', 'pre_market', 'after_hours']),
  exchange: z.string(),
  currency: z.string(),
  timestamp: TimestampSchema,
});
```

### 2. Historical Data Schema

```typescript
interface HistoricalBar extends BaseProvider {
  symbol: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number; // Volume Weighted Average Price
  trades?: number; // Number of trades
  timeframe: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M';
}

interface HistoricalDataRequest {
  symbol: string;
  from: Date;
  to: Date;
  timeframe: string;
  limit?: number;
  page?: number;
}

interface HistoricalDataResponse {
  symbol: string;
  bars: HistoricalBar[];
  hasMore: boolean;
  nextPage?: string;
  totalCount?: number;
}
```

### 3. Provider-Specific Adapters

```typescript
// Polygon.io Adapter
class PolygonAdapter {
  static toUniversalQuote(polygonData: PolygonQuoteResponse): UniversalQuote {
    return {
      symbol: polygonData.ticker,
      price: {
        last: polygonData.last.price,
        bid: polygonData.bid,
        ask: polygonData.ask,
        open: polygonData.open,
        high: polygonData.high,
        low: polygonData.low,
      },
      volume: {
        current: polygonData.volume,
      },
      spread: {
        absolute: polygonData.ask - polygonData.bid,
        percentage: ((polygonData.ask - polygonData.bid) / polygonData.bid) * 100,
      },
      marketStatus: this.mapMarketStatus(polygonData.market_status),
      exchange: polygonData.exchange || 'UNKNOWN',
      currency: 'USD',
      timestamp: new Date(polygonData.last.timestamp),
      provider: 'polygon',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

// Alpaca Adapter
class AlpacaAdapter {
  static toUniversalQuote(alpacaData: AlpacaQuoteResponse): UniversalQuote {
    return {
      symbol: alpacaData.symbol,
      price: {
        last: alpacaData.quote.bid_price, // Alpaca doesn't provide last price in quotes
        bid: alpacaData.quote.bid_price,
        ask: alpacaData.quote.ask_price,
        open: 0, // Need separate call for OHLC
        high: 0,
        low: 0,
      },
      volume: {
        current: alpacaData.quote.bid_size + alpacaData.quote.ask_size,
      },
      spread: {
        absolute: alpacaData.quote.ask_price - alpacaData.quote.bid_price,
        percentage: ((alpacaData.quote.ask_price - alpacaData.quote.bid_price) / alpacaData.quote.bid_price) * 100,
      },
      marketStatus: 'open', // Alpaca requires separate market status call
      exchange: 'UNKNOWN',
      currency: 'USD',
      timestamp: new Date(alpacaData.quote.timestamp),
      provider: 'alpaca',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
```

---

## AI/LLM Integration Schemas

### 1. Universal AI Request/Response

```typescript
interface AIRequest {
  model: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: AITool[];
  context?: Record<string, any>;
}

interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

interface AIResponse extends BaseProvider {
  id: string;
  content: string;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  timestamp: Date;
  latency: number;
  toolCalls?: AIToolCall[];
}

interface AIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface AITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}
```

### 2. Financial Analysis Schemas

```typescript
interface MarketAnalysisRequest {
  symbols: string[];
  analysisType: 'sentiment' | 'technical' | 'fundamental' | 'comprehensive';
  timeframe?: string;
  includePredictions?: boolean;
  context?: {
    userPortfolio?: Portfolio;
    riskTolerance?: 'low' | 'medium' | 'high';
    investmentGoals?: string[];
  };
}

interface MarketAnalysisResponse extends BaseProvider {
  analysis: {
    symbol: string;
    sentiment: {
      score: number; // -1 to 1
      label: 'bearish' | 'neutral' | 'bullish';
      confidence: number; // 0 to 1
      reasoning: string[];
    };
    technical?: {
      trend: 'uptrend' | 'downtrend' | 'sideways';
      support: number[];
      resistance: number[];
      indicators: Record<string, number>;
    };
    fundamental?: {
      rating: number; // 1-10
      keyMetrics: Record<string, number>;
      risks: string[];
      opportunities: string[];
    };
    prediction?: {
      priceTarget: number;
      timeframe: string;
      probability: number;
    };
  }[];
  summary: string;
  recommendations: string[];
  riskAssessment: string;
}
```

### 3. Provider Adapters

```typescript
// OpenAI Adapter
class OpenAIAdapter {
  static toAIResponse(openaiResponse: OpenAI.ChatCompletion): AIResponse {
    const choice = openaiResponse.choices[0];
    return {
      id: openaiResponse.id,
      content: choice.message.content || '',
      finishReason: choice.finish_reason as any,
      usage: {
        promptTokens: openaiResponse.usage?.prompt_tokens || 0,
        completionTokens: openaiResponse.usage?.completion_tokens || 0,
        totalTokens: openaiResponse.usage?.total_tokens || 0,
      },
      model: openaiResponse.model,
      timestamp: new Date(),
      latency: 0, // Calculate separately
      provider: 'openai',
      toolCalls: choice.message.tool_calls?.map(tc => ({
        id: tc.id,
        type: tc.type,
        function: tc.function,
      })),
    };
  }
}

// Anthropic Adapter
class AnthropicAdapter {
  static toAIResponse(anthropicResponse: Anthropic.Message): AIResponse {
    return {
      id: anthropicResponse.id,
      content: anthropicResponse.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join(''),
      finishReason: anthropicResponse.stop_reason as any,
      usage: {
        promptTokens: anthropicResponse.usage.input_tokens,
        completionTokens: anthropicResponse.usage.output_tokens,
        totalTokens: anthropicResponse.usage.input_tokens + anthropicResponse.usage.output_tokens,
      },
      model: anthropicResponse.model,
      timestamp: new Date(),
      latency: 0,
      provider: 'anthropic',
    };
  }
}
```

---

## News & Sentiment Schemas

### 1. Universal News Schema

```typescript
interface UniversalNews extends BaseProvider, BaseTimestamp {
  id: string;
  headline: string;
  summary?: string;
  content?: string;
  url: string;
  source: {
    name: string;
    domain: string;
    credibility?: number; // 0-1
  };
  publishedAt: Date;
  symbols: string[]; // Related symbols
  categories: string[];
  sentiment: {
    score: number; // -1 to 1
    label: 'negative' | 'neutral' | 'positive';
    confidence: number; // 0 to 1
  };
  impact: {
    level: 'low' | 'medium' | 'high';
    timeframe: 'immediate' | 'short_term' | 'long_term';
  };
  metrics?: {
    views?: number;
    shares?: number;
    engagement?: number;
  };
}

// Validation Schema
const NewsSchema = z.object({
  id: z.string(),
  headline: z.string().min(1),
  summary: z.string().optional(),
  url: z.string().url(),
  source: z.object({
    name: z.string(),
    domain: z.string(),
    credibility: z.number().min(0).max(1).optional(),
  }),
  publishedAt: TimestampSchema,
  symbols: z.array(SymbolSchema),
  categories: z.array(z.string()),
  sentiment: z.object({
    score: z.number().min(-1).max(1),
    label: z.enum(['negative', 'neutral', 'positive']),
    confidence: z.number().min(0).max(1),
  }),
});
```

### 2. Social Sentiment Schema

```typescript
interface SocialSentiment extends BaseProvider {
  symbol: string;
  platform: 'twitter' | 'reddit' | 'stocktwits' | 'news' | 'aggregate';
  timeframe: '1h' | '4h' | '1d' | '1w';
  metrics: {
    mentions: number;
    sentiment: {
      bullish: number;
      bearish: number;
      neutral: number;
    };
    volume: {
      current: number;
      average: number;
      percentChange: number;
    };
    trending: boolean;
    buzz: number; // 0-100 buzz score
  };
  topKeywords: Array<{
    keyword: string;
    frequency: number;
    sentiment: number;
  }>;
  influencerSentiment?: {
    bullish: number;
    bearish: number;
    count: number;
  };
  timestamp: Date;
}
```

### 3. Provider Adapters

```typescript
// Finnhub Adapter
class FinnhubAdapter {
  static toUniversalNews(finnhubNews: FinnhubNewsItem): UniversalNews {
    return {
      id: finnhubNews.id.toString(),
      headline: finnhubNews.headline,
      summary: finnhubNews.summary,
      url: finnhubNews.url,
      source: {
        name: finnhubNews.source,
        domain: new URL(finnhubNews.url).hostname,
      },
      publishedAt: new Date(finnhubNews.datetime * 1000),
      symbols: [finnhubNews.symbol],
      categories: [finnhubNews.category || 'general'],
      sentiment: this.calculateSentiment(finnhubNews.summary),
      impact: this.assessImpact(finnhubNews),
      provider: 'finnhub',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  static toSocialSentiment(finnhubSentiment: FinnhubSentimentResponse): SocialSentiment {
    return {
      symbol: finnhubSentiment.symbol,
      platform: 'aggregate',
      timeframe: '1d',
      metrics: {
        mentions: finnhubSentiment.mention,
        sentiment: {
          bullish: finnhubSentiment.positiveMention,
          bearish: finnhubSentiment.negativeMention,
          neutral: finnhubSentiment.mention - finnhubSentiment.positiveMention - finnhubSentiment.negativeMention,
        },
        volume: {
          current: finnhubSentiment.mention,
          average: 0, // Not provided
          percentChange: 0, // Calculate separately
        },
        trending: finnhubSentiment.mention > 100,
        buzz: Math.min(100, finnhubSentiment.mention / 10),
      },
      topKeywords: [], // Not provided by Finnhub
      timestamp: new Date(),
      provider: 'finnhub',
    };
  }
}

// Unusual Whales Adapter
class UnusualWhalesAdapter {
  static toSocialSentiment(uwData: UnusualWhalesResponse): SocialSentiment {
    return {
      symbol: uwData.ticker,
      platform: 'aggregate',
      timeframe: '1d',
      metrics: {
        mentions: uwData.total_mentions || 0,
        sentiment: {
          bullish: uwData.bullish_mentions || 0,
          bearish: uwData.bearish_mentions || 0,
          neutral: (uwData.total_mentions || 0) - (uwData.bullish_mentions || 0) - (uwData.bearish_mentions || 0),
        },
        volume: {
          current: uwData.option_volume || 0,
          average: uwData.avg_option_volume || 0,
          percentChange: uwData.volume_change_percent || 0,
        },
        trending: uwData.is_trending || false,
        buzz: uwData.buzz_score || 0,
      },
      topKeywords: uwData.keywords || [],
      timestamp: new Date(),
      provider: 'unusual_whales',
    };
  }
}
```

---

## Financial Services Schemas

### 1. Plaid Integration Schemas

```typescript
interface PlaidAccount extends BaseProvider {
  id: string;
  itemId: string;
  name: string;
  officialName?: string;
  type: 'depository' | 'credit' | 'loan' | 'investment' | 'other';
  subtype: string;
  mask?: string;
  balances: {
    available?: number;
    current?: number;
    limit?: number;
    isoCurrencyCode?: string;
    unofficialCurrencyCode?: string;
  };
  institution: {
    id: string;
    name: string;
  };
  verificationStatus?: 'pending' | 'verified' | 'failed';
}

interface PlaidTransaction extends BaseProvider {
  id: string;
  accountId: string;
  amount: number;
  isoCurrencyCode?: string;
  date: Date;
  name: string;
  merchantName?: string;
  category: string[];
  subCategory?: string;
  type: 'place' | 'special' | 'unresolved';
  pending: boolean;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    lat?: number;
    lon?: number;
  };
  personalFinanceCategory?: {
    primary: string;
    detailed: string;
  };
}

interface PlaidHolding extends BaseProvider {
  id: string;
  accountId: string;
  security: {
    securityId: string;
    symbol?: string;
    name: string;
    type: string;
    closePrice?: number;
    closePriceAsOf?: Date;
  };
  quantity: number;
  price: number;
  value: number;
  costBasis?: number;
  isoCurrencyCode?: string;
}
```

### 2. Portfolio Management Schemas

```typescript
interface Portfolio extends BaseProvider, BaseTimestamp {
  id: string;
  userId: string;
  name: string;
  description?: string;
  type: 'real' | 'paper' | 'watchlist';
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
  holdings: PortfolioHolding[];
  cash: number;
  currency: string;
  performance: PerformanceMetrics;
}

interface PortfolioHolding extends BaseProvider {
  symbol: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  allocation: number; // Percentage of portfolio
  sector?: string;
  industry?: string;
  assetType: 'stock' | 'etf' | 'crypto' | 'option' | 'bond';
}

interface PerformanceMetrics {
  sharpeRatio?: number;
  beta?: number;
  alpha?: number;
  volatility?: number;
  maxDrawdown?: number;
  winRate?: number;
  avgWin?: number;
  avgLoss?: number;
  profitFactor?: number;
}
```

---

## Options Data Schemas

### 1. Universal Options Schema

```typescript
interface OptionsContract extends BaseProvider {
  symbol: string; // Options symbol (e.g., AAPL240315C00150000)
  underlyingSymbol: string;
  type: 'call' | 'put';
  strike: number;
  expiration: Date;
  daysToExpiration: number;
  exerciseStyle: 'american' | 'european';
  
  pricing: {
    bid: number;
    ask: number;
    last: number;
    mark: number; // Mid-point
    change: number;
    changePercent: number;
  };
  
  volume: {
    current: number;
    average?: number;
    openInterest: number;
  };
  
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
    impliedVolatility: number;
  };
  
  intrinsicValue: number;
  timeValue: number;
  moneyness: 'ITM' | 'ATM' | 'OTM'; // In/At/Out of the money
  
  exchange: string;
  lastTradeDate?: Date;
  timestamp: Date;
}

interface OptionsChain extends BaseProvider {
  underlyingSymbol: string;
  underlyingPrice: number;
  expirations: Date[];
  strikes: number[];
  calls: Record<string, OptionsContract[]>; // Keyed by expiration date
  puts: Record<string, OptionsContract[]>;
  impliedVolatility?: number;
  timestamp: Date;
}

// Validation
const OptionsContractSchema = z.object({
  symbol: z.string(),
  underlyingSymbol: SymbolSchema,
  type: z.enum(['call', 'put']),
  strike: PriceSchema,
  expiration: TimestampSchema,
  pricing: z.object({
    bid: PriceSchema,
    ask: PriceSchema,
    last: PriceSchema,
    mark: PriceSchema,
  }),
  volume: z.object({
    current: VolumeSchema,
    openInterest: VolumeSchema,
  }),
});
```

### 2. Options Analytics Schemas

```typescript
interface OptionsFlowData extends BaseProvider {
  symbol: string;
  underlyingSymbol: string;
  type: 'call' | 'put';
  strike: number;
  expiration: Date;
  
  flow: {
    size: number; // Contract size
    premium: number; // Total premium
    side: 'buy' | 'sell';
    execution: 'sweep' | 'block' | 'large' | 'unusual';
    aggressor: 'buyer' | 'seller';
  };
  
  sentiment: {
    bullish: boolean;
    bearish: boolean;
    confidence: number;
  };
  
  context: {
    volumeRatio: number; // vs average volume
    openInterestRatio: number;
    timeToExpiration: number;
    moneyness: number; // Distance from ATM
  };
  
  timestamp: Date;
}

interface VolatilityData extends BaseProvider {
  symbol: string;
  
  implied: {
    iv30: number; // 30-day implied volatility
    ivRank: number; // IV rank (0-100)
    ivPercentile: number; // IV percentile
  };
  
  historical: {
    hv20: number; // 20-day historical volatility
    hv30: number; // 30-day historical volatility
    hv60: number; // 60-day historical volatility
  };
  
  skew: {
    putCallSkew: number;
    termStructure: Array<{
      expiration: Date;
      iv: number;
    }>;
  };
  
  timestamp: Date;
}
```

### 3. Provider Adapters

```typescript
// Polygon Options Adapter
class PolygonOptionsAdapter {
  static toOptionsContract(polygonData: PolygonOptionsContract): OptionsContract {
    const underlyingSymbol = polygonData.underlying_ticker;
    const strike = polygonData.strike_price;
    const expiration = new Date(polygonData.expiration_date);
    
    return {
      symbol: polygonData.ticker,
      underlyingSymbol,
      type: polygonData.contract_type,
      strike,
      expiration,
      daysToExpiration: this.calculateDaysToExpiration(expiration),
      exerciseStyle: polygonData.exercise_style,
      
      pricing: {
        bid: polygonData.day?.open || 0,
        ask: polygonData.day?.close || 0,
        last: polygonData.last_quote?.price || 0,
        mark: ((polygonData.day?.open || 0) + (polygonData.day?.close || 0)) / 2,
        change: polygonData.day?.change || 0,
        changePercent: polygonData.day?.change_percent || 0,
      },
      
      volume: {
        current: polygonData.day?.volume || 0,
        openInterest: polygonData.open_interest || 0,
      },
      
      greeks: polygonData.greeks ? {
        delta: polygonData.greeks.delta,
        gamma: polygonData.greeks.gamma,
        theta: polygonData.greeks.theta,
        vega: polygonData.greeks.vega,
        rho: polygonData.greeks.rho,
        impliedVolatility: polygonData.implied_volatility || 0,
      } : undefined,
      
      intrinsicValue: this.calculateIntrinsicValue(
        polygonData.contract_type,
        polygonData.underlying_ticker, // Need current price
        strike
      ),
      timeValue: 0, // Calculate separately
      moneyness: this.calculateMoneyness(
        polygonData.contract_type,
        polygonData.underlying_ticker, // Need current price
        strike
      ),
      
      exchange: 'CBOE', // Default
      timestamp: new Date(),
      provider: 'polygon',
    };
  }
}

// Alpaca Options Adapter
class AlpacaOptionsAdapter {
  static toOptionsContract(alpacaData: AlpacaOptionsBar): OptionsContract {
    // Parse Alpaca options symbol format
    const symbolParts = this.parseAlpacaOptionsSymbol(alpacaData.symbol);
    
    return {
      symbol: alpacaData.symbol,
      underlyingSymbol: symbolParts.underlying,
      type: symbolParts.type,
      strike: symbolParts.strike,
      expiration: symbolParts.expiration,
      daysToExpiration: this.calculateDaysToExpiration(symbolParts.expiration),
      exerciseStyle: 'american', // Most US options
      
      pricing: {
        bid: 0, // Not provided in bars
        ask: 0,
        last: alpacaData.close,
        mark: (alpacaData.high + alpacaData.low) / 2,
        change: alpacaData.close - alpacaData.open,
        changePercent: ((alpacaData.close - alpacaData.open) / alpacaData.open) * 100,
      },
      
      volume: {
        current: alpacaData.volume,
        openInterest: 0, // Need separate call
      },
      
      intrinsicValue: 0, // Calculate separately
      timeValue: 0,
      moneyness: 'ATM', // Calculate separately
      
      exchange: 'UNKNOWN',
      timestamp: new Date(alpacaData.timestamp),
      provider: 'alpaca',
    };
  }
}
```

---

## Integration Patterns

### 1. Provider Factory with Fallback

```typescript
interface ProviderConfig {
  primary: string;
  fallback: string[];
  timeout: number;
  retries: number;
  circuitBreaker: {
    failureThreshold: number;
    resetTimeout: number;
  };
}

class UnifiedMarketDataProvider {
  private providers: Map<string, MarketDataProvider> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private cache: CacheInterface;
  
  constructor(
    private config: ProviderConfig,
    cache: CacheInterface
  ) {
    this.cache = cache;
    this.initializeProviders();
  }
  
  async getQuote(symbol: string): Promise<UniversalQuote> {
    const cacheKey = `quote:${symbol}`;
    
    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Try providers in order
    for (const providerName of [this.config.primary, ...this.config.fallback]) {
      try {
        const provider = this.providers.get(providerName);
        const circuitBreaker = this.circuitBreakers.get(providerName);
        
        if (!provider || !circuitBreaker) continue;
        
        const quote = await circuitBreaker.execute(() => 
          provider.getQuote(symbol)
        );
        
        // Cache successful result
        await this.cache.setex(cacheKey, 30, JSON.stringify(quote));
        
        return quote;
      } catch (error) {
        console.warn(`Provider ${providerName} failed for ${symbol}:`, error);
        continue;
      }
    }
    
    throw new Error(`All providers failed for symbol: ${symbol}`);
  }
  
  async getHistoricalData(request: HistoricalDataRequest): Promise<HistoricalDataResponse> {
    // Similar pattern with caching and fallbacks
    const cacheKey = `historical:${request.symbol}:${request.from}:${request.to}:${request.timeframe}`;
    
    // Implementation similar to getQuote...
  }
}
```

### 2. Rate Limiting Pattern

```typescript
class RateLimitedProvider implements MarketDataProvider {
  private limiter: Map<string, RateLimiter> = new Map();
  
  constructor(
    private provider: MarketDataProvider,
    private limits: Record<string, { tokens: number; interval: string }>
  ) {
    // Initialize rate limiters for each endpoint
    Object.entries(limits).forEach(([endpoint, config]) => {
      this.limiter.set(endpoint, new RateLimiter({
        tokensPerInterval: config.tokens,
        interval: config.interval,
      }));
    });
  }
  
  async getQuote(symbol: string): Promise<UniversalQuote> {
    const limiter = this.limiter.get('quotes');
    if (limiter) {
      await limiter.removeTokens(1);
    }
    
    return this.provider.getQuote(symbol);
  }
  
  async getHistoricalData(request: HistoricalDataRequest): Promise<HistoricalDataResponse> {
    const limiter = this.limiter.get('historical');
    if (limiter) {
      // Historical data may require more tokens based on range
      const tokens = this.calculateTokensRequired(request);
      await limiter.removeTokens(tokens);
    }
    
    return this.provider.getHistoricalData(request);
  }
  
  private calculateTokensRequired(request: HistoricalDataRequest): number {
    const days = Math.ceil((request.to.getTime() - request.from.getTime()) / (1000 * 60 * 60 * 24));
    
    // Different timeframes require different token counts
    switch (request.timeframe) {
      case '1m': return Math.min(days * 390, 100); // Market minutes per day
      case '5m': return Math.min(days * 78, 50);
      case '1h': return Math.min(days * 6.5, 10);
      case '1d': return Math.min(days, 5);
      default: return 1;
    }
  }
}
```

### 3. Error Handling and Retry Pattern

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

class ResilientProvider implements MarketDataProvider {
  constructor(
    private provider: MarketDataProvider,
    private retryConfig: RetryConfig
  ) {}
  
  async getQuote(symbol: string): Promise<UniversalQuote> {
    return this.executeWithRetry(
      () => this.provider.getQuote(symbol),
      `getQuote(${symbol})`
    );
  }
  
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on non-retryable errors
        if (!this.isRetryableError(error)) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === this.retryConfig.maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
          this.retryConfig.maxDelay
        );
        
        console.warn(`${operationName} failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, error);
        await this.sleep(delay);
      }
    }
    
    throw new Error(`${operationName} failed after ${this.retryConfig.maxRetries} retries: ${lastError.message}`);
  }
  
  private isRetryableError(error: any): boolean {
    if (error.status >= 500) return true; // Server errors
    if (error.code === 'ECONNRESET') return true; // Connection reset
    if (error.code === 'ETIMEDOUT') return true; // Timeout
    
    return this.retryConfig.retryableErrors.some(retryableError => 
      error.message?.includes(retryableError)
    );
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## Caching Strategies

### 1. Multi-Level Caching

```typescript
interface CacheStrategy {
  l1: { ttl: number; maxSize: number }; // In-memory
  l2: { ttl: number }; // Redis
  l3?: { ttl: number }; // Database
}

class MultiLevelCache implements CacheInterface {
  private l1Cache: Map<string, { data: any; expires: number }> = new Map();
  
  constructor(
    private redis: RedisClient,
    private db: DatabaseClient,
    private strategy: CacheStrategy
  ) {}
  
  async get(key: string): Promise<string | null> {
    // L1: Memory cache
    const l1Data = this.l1Cache.get(key);
    if (l1Data && l1Data.expires > Date.now()) {
      return l1Data.data;
    }
    
    // L2: Redis cache
    const l2Data = await this.redis.get(key);
    if (l2Data) {
      // Populate L1 cache
      this.l1Cache.set(key, {
        data: l2Data,
        expires: Date.now() + this.strategy.l1.ttl * 1000
      });
      return l2Data;
    }
    
    // L3: Database cache (if configured)
    if (this.strategy.l3) {
      const l3Data = await this.db.getCachedData(key);
      if (l3Data && l3Data.expires > new Date()) {
        // Populate both L1 and L2
        await this.set(key, l3Data.data, this.strategy.l2.ttl);
        return l3Data.data;
      }
    }
    
    return null;
  }
  
  async set(key: string, value: string, ttl: number): Promise<void> {
    // Set in all levels
    this.l1Cache.set(key, {
      data: value,
      expires: Date.now() + Math.min(ttl, this.strategy.l1.ttl) * 1000
    });
    
    await this.redis.setex(key, ttl, value);
    
    if (this.strategy.l3) {
      await this.db.setCachedData(key, value, new Date(Date.now() + this.strategy.l3.ttl * 1000));
    }
    
    // Cleanup L1 cache if too large
    if (this.l1Cache.size > this.strategy.l1.maxSize) {
      this.cleanupL1Cache();
    }
  }
  
  private cleanupL1Cache(): void {
    const now = Date.now();
    const entries = Array.from(this.l1Cache.entries());
    
    // Remove expired entries
    entries.forEach(([key, value]) => {
      if (value.expires <= now) {
        this.l1Cache.delete(key);
      }
    });
    
    // If still too large, remove oldest entries
    if (this.l1Cache.size > this.strategy.l1.maxSize) {
      const sortedEntries = entries
        .filter(([, value]) => value.expires > now)
        .sort(([, a], [, b]) => a.expires - b.expires);
      
      const toRemove = this.l1Cache.size - this.strategy.l1.maxSize;
      sortedEntries.slice(0, toRemove).forEach(([key]) => {
        this.l1Cache.delete(key);
      });
    }
  }
}
```

### 2. Smart Cache Invalidation

```typescript
class SmartCache implements CacheInterface {
  private dependencies: Map<string, Set<string>> = new Map(); // key -> dependent keys
  
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    
    // Collect all dependent keys
    const allKeysToInvalidate = new Set<string>();
    const queue = [...keys];
    
    while (queue.length > 0) {
      const key = queue.pop()!;
      allKeysToInvalidate.add(key);
      
      const dependents = this.dependencies.get(key);
      if (dependents) {
        dependents.forEach(dependent => {
          if (!allKeysToInvalidate.has(dependent)) {
            queue.push(dependent);
          }
        });
      }
    }
    
    // Invalidate all keys
    if (allKeysToInvalidate.size > 0) {
      await this.redis.del(...Array.from(allKeysToInvalidate));
    }
  }
  
  async setWithDependency(key: string, value: string, ttl: number, dependsOn: string[]): Promise<void> {
    await this.redis.setex(key, ttl, value);
    
    // Track dependencies
    dependsOn.forEach(dep => {
      if (!this.dependencies.has(dep)) {
        this.dependencies.set(dep, new Set());
      }
      this.dependencies.get(dep)!.add(key);
    });
  }
}
```

---

## Real-time Data Patterns

### 1. WebSocket Connection Management

```typescript
interface WebSocketConfig {
  url: string;
  auth?: {
    apiKey?: string;
    token?: string;
  };
  reconnect: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
  };
  heartbeat: {
    interval: number;
    timeout: number;
  };
}

class RealTimeDataManager {
  private connections: Map<string, WebSocket> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // provider -> symbols
  private eventEmitter = new EventEmitter();
  
  constructor(private configs: Record<string, WebSocketConfig>) {}
  
  async subscribe(provider: string, symbols: string[]): Promise<void> {
    if (!this.subscriptions.has(provider)) {
      this.subscriptions.set(provider, new Set());
    }
    
    const providerSubs = this.subscriptions.get(provider)!;
    const newSymbols = symbols.filter(symbol => !providerSubs.has(symbol));
    
    if (newSymbols.length === 0) return;
    
    // Add to subscription set
    newSymbols.forEach(symbol => providerSubs.add(symbol));
    
    // Get or create connection
    const ws = await this.getConnection(provider);
    
    // Send subscription message
    const subscribeMessage = this.buildSubscribeMessage(provider, newSymbols);
    ws.send(JSON.stringify(subscribeMessage));
  }
  
  async unsubscribe(provider: string, symbols: string[]): Promise<void> {
    const providerSubs = this.subscriptions.get(provider);
    if (!providerSubs) return;
    
    const symbolsToRemove = symbols.filter(symbol => providerSubs.has(symbol));
    if (symbolsToRemove.length === 0) return;
    
    // Remove from subscription set
    symbolsToRemove.forEach(symbol => providerSubs.delete(symbol));
    
    // Send unsubscribe message
    const ws = this.connections.get(provider);
    if (ws && ws.readyState === WebSocket.OPEN) {
      const unsubscribeMessage = this.buildUnsubscribeMessage(provider, symbolsToRemove);
      ws.send(JSON.stringify(unsubscribeMessage));
    }
  }
  
  private async getConnection(provider: string): Promise<WebSocket> {
    const existing = this.connections.get(provider);
    if (existing && existing.readyState === WebSocket.OPEN) {
      return existing;
    }
    
    const config = this.configs[provider];
    if (!config) {
      throw new Error(`No configuration found for provider: ${provider}`);
    }
    
    const ws = new WebSocket(config.url);
    this.connections.set(provider, ws);
    
    // Set up event handlers
    ws.onopen = () => this.handleOpen(provider, ws);
    ws.onmessage = (event) => this.handleMessage(provider, event);
    ws.onclose = (event) => this.handleClose(provider, event);
    ws.onerror = (error) => this.handleError(provider, error);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout for provider: ${provider}`));
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        this.handleOpen(provider, ws);
        resolve(ws);
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });
  }
  
  private handleMessage(provider: string, event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      const normalizedData = this.normalizeMessage(provider, data);
      
      if (normalizedData) {
        this.eventEmitter.emit('quote', normalizedData);
        this.eventEmitter.emit(`quote:${normalizedData.symbol}`, normalizedData);
      }
    } catch (error) {
      console.error(`Failed to parse message from ${provider}:`, error);
    }
  }
  
  private normalizeMessage(provider: string, data: any): UniversalQuote | null {
    switch (provider) {
      case 'polygon':
        return this.normalizePolygonMessage(data);
      case 'alpaca':
        return this.normalizeAlpacaMessage(data);
      default:
        return null;
    }
  }
  
  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }
  
  off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }
}
```

### 2. Data Aggregation and Fan-out

```typescript
class RealTimeAggregator {
  private aggregationWindows: Map<string, AggregationWindow> = new Map();
  
  constructor(
    private realTimeManager: RealTimeDataManager,
    private publisher: EventPublisher
  ) {
    // Listen to real-time quotes
    realTimeManager.on('quote', (quote: UniversalQuote) => {
      this.processQuote(quote);
    });
  }
  
  private processQuote(quote: UniversalQuote): void {
    // Update aggregation windows
    this.updateAggregations(quote);
    
    // Publish to subscribers
    this.publisher.publish(`quote:${quote.symbol}`, quote);
    this.publisher.publish('quote:all', quote);
    
    // Update portfolio calculations if needed
    this.updatePortfolioMetrics(quote);
  }
  
  private updateAggregations(quote: UniversalQuote): void {
    const windows = ['1m', '5m', '15m', '1h'];
    
    windows.forEach(window => {
      const key = `${quote.symbol}:${window}`;
      let aggWindow = this.aggregationWindows.get(key);
      
      if (!aggWindow) {
        aggWindow = new AggregationWindow(window);
        this.aggregationWindows.set(key, aggWindow);
      }
      
      const bar = aggWindow.addQuote(quote);
      if (bar) {
        // Window completed, publish the bar
        this.publisher.publish(`bar:${quote.symbol}:${window}`, bar);
      }
    });
  }
}

class AggregationWindow {
  private currentBar: Partial<HistoricalBar> | null = null;
  private windowSizeMs: number;
  
  constructor(private window: string) {
    this.windowSizeMs = this.parseWindow(window);
  }
  
  addQuote(quote: UniversalQuote): HistoricalBar | null {
    const windowStart = this.getWindowStart(quote.timestamp);
    
    // Check if we need to start a new window
    if (!this.currentBar || this.currentBar.timestamp!.getTime() !== windowStart.getTime()) {
      const completedBar = this.currentBar ? this.finalizeBar() : null;
      this.startNewBar(quote, windowStart);
      return completedBar;
    }
    
    // Update current bar
    this.updateBar(quote);
    return null;
  }
  
  private updateBar(quote: UniversalQuote): void {
    if (!this.currentBar) return;
    
    this.currentBar.high = Math.max(this.currentBar.high || 0, quote.price.last);
    this.currentBar.low = Math.min(this.currentBar.low || Infinity, quote.price.last);
    this.currentBar.close = quote.price.last;
    this.currentBar.volume = (this.currentBar.volume || 0) + (quote.volume.current || 0);
  }
  
  private startNewBar(quote: UniversalQuote, windowStart: Date): void {
    this.currentBar = {
      symbol: quote.symbol,
      timestamp: windowStart,
      open: quote.price.last,
      high: quote.price.last,
      low: quote.price.last,
      close: quote.price.last,
      volume: quote.volume.current || 0,
      timeframe: this.window as any,
      provider: quote.provider,
    };
  }
  
  private finalizeBar(): HistoricalBar {
    return this.currentBar as HistoricalBar;
  }
  
  private getWindowStart(timestamp: Date): Date {
    const time = timestamp.getTime();
    return new Date(Math.floor(time / this.windowSizeMs) * this.windowSizeMs);
  }
  
  private parseWindow(window: string): number {
    const match = window.match(/^(\d+)([mhd])$/);
    if (!match) throw new Error(`Invalid window format: ${window}`);
    
    const [, num, unit] = match;
    const multiplier = {
      'm': 60 * 1000,      // minutes
      'h': 60 * 60 * 1000, // hours
      'd': 24 * 60 * 60 * 1000, // days
    }[unit];
    
    return parseInt(num) * multiplier!;
  }
}
```

---

This comprehensive data schemas and integration patterns document provides the technical foundation needed to implement or port the Fin Agent platform's third-party integrations. Each schema includes validation rules, adapter patterns, and real-world implementation examples for seamless integration across different applications.