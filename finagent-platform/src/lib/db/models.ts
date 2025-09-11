// TypeScript models and Zod schemas for database entities
import { z } from 'zod';

// Portfolio schemas
export const PortfolioSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  total_value: z.number().default(0),
  cash_balance: z.number().default(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreatePortfolioSchema = PortfolioSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  total_value: true,
});

export const UpdatePortfolioSchema = CreatePortfolioSchema.partial();

// Account schemas
export const AccountTypeEnum = z.enum(['cash', 'margin', 'retirement', 'crypto']);

export const AccountSchema = z.object({
  id: z.string().uuid(),
  portfolio_id: z.string().uuid(),
  broker_name: z.string().min(1),
  account_number: z.string().min(1),
  account_type: AccountTypeEnum,
  is_active: z.boolean().default(true),
  api_key_encrypted: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Position schemas
export const PositionTypeEnum = z.enum(['long', 'short']);

export const PositionSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  symbol: z.string().min(1).max(10),
  quantity: z.number(),
  average_cost: z.number().positive(),
  current_price: z.number().positive().optional(),
  market_value: z.number().optional(),
  unrealized_pnl: z.number().optional(),
  realized_pnl: z.number().default(0),
  position_type: PositionTypeEnum.default('long'),
  updated_at: z.string().datetime(),
});

// Trade schemas
export const TradeTypeEnum = z.enum(['buy', 'sell', 'buy_to_cover', 'sell_short']);
export const TradeStatusEnum = z.enum(['pending', 'executed', 'cancelled', 'failed']);

export const TradeSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  symbol: z.string().min(1),
  trade_type: TradeTypeEnum,
  quantity: z.number().positive(),
  price: z.number().positive(),
  total_amount: z.number(),
  commission: z.number().default(0),
  status: TradeStatusEnum.default('pending'),
  order_id: z.string().optional(),
  executed_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
});

export const CreateTradeSchema = TradeSchema.omit({
  id: true,
  created_at: true,
  status: true,
});

// Market data schemas
export const AssetTypeEnum = z.enum(['stock', 'etf', 'crypto', 'forex', 'option', 'future']);

export const TickerSchema = z.object({
  symbol: z.string().min(1),
  company_name: z.string().optional(),
  sector: z.string().optional(),
  industry: z.string().optional(),
  market_cap: z.number().optional(),
  exchange: z.string().optional(),
  asset_type: AssetTypeEnum.optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const PriceHistorySchema = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  timestamp: z.string().datetime(),
  open_price: z.number(),
  high_price: z.number(),
  low_price: z.number(),
  close_price: z.number(),
  volume: z.number(),
  adjusted_close: z.number().optional(),
});

// Options flow schema
export const OptionTypeEnum = z.enum(['call', 'put']);

export const OptionsFlowSchema = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  strike_price: z.number(),
  expiration_date: z.string().date(),
  option_type: OptionTypeEnum,
  volume: z.number(),
  open_interest: z.number().optional(),
  premium: z.number().optional(),
  implied_volatility: z.number().optional(),
  delta: z.number().optional(),
  gamma: z.number().optional(),
  theta: z.number().optional(),
  vega: z.number().optional(),
  timestamp: z.string().datetime(),
});

// Sentiment data schema
export const SentimentDataSchema = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  source: z.string(),
  source_url: z.string().url().optional(),
  content: z.string(),
  sentiment_score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  embedding: z.array(z.number()).optional(),
  entities: z.record(z.any()).optional(),
  timestamp: z.string().datetime(),
  created_at: z.string().datetime(),
});

// Agent schemas
export const AgentStatusEnum = z.enum(['pending', 'running', 'completed', 'failed']);

export const AgentExecutionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  session_id: z.string().uuid().optional(),
  query: z.string().min(1),
  agent_name: z.string(),
  agent_type: z.string().optional(),
  status: AgentStatusEnum.default('pending'),
  result: z.record(z.any()).optional(),
  error_message: z.string().optional(),
  execution_time_ms: z.number().optional(),
  tokens_used: z.number().optional(),
  cost: z.number().optional(),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
});

export const CreateAgentExecutionSchema = AgentExecutionSchema.omit({
  id: true,
  created_at: true,
  completed_at: true,
  status: true,
});

export const AgentMemorySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  agent_type: z.string(),
  memory_key: z.string(),
  memory_value: z.record(z.any()),
  context: z.record(z.any()).optional(),
  ttl_seconds: z.number().optional(),
  expires_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const AgentDebateSchema = z.object({
  id: z.string().uuid(),
  execution_id: z.string().uuid(),
  round_number: z.number().int().positive(),
  participant_agent: z.string(),
  statement: z.string(),
  evidence: z.record(z.any()).optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  timestamp: z.string().datetime(),
});

// User preferences schema
export const ThemeEnum = z.enum(['light', 'dark', 'auto']);
export const RiskToleranceEnum = z.enum(['conservative', 'moderate', 'aggressive']);
export const TradingExperienceEnum = z.enum(['beginner', 'intermediate', 'advanced', 'professional']);

export const UserPreferencesSchema = z.object({
  user_id: z.string().uuid(),
  theme: ThemeEnum.default('light'),
  default_chart_interval: z.string().default('1D'),
  preferred_agents: z.array(z.string()).default([]),
  risk_tolerance: RiskToleranceEnum.optional(),
  trading_experience: TradingExperienceEnum.optional(),
  notification_settings: z.record(z.boolean()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Watchlist schema
export const WatchlistSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  symbols: z.array(z.string()).default([]),
  is_public: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateWatchlistSchema = WatchlistSchema.omit({
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true,
});

// Alert schema
export const AlertTypeEnum = z.enum(['price_above', 'price_below', 'volume_spike', 'volatility', 'sentiment']);

export const AlertSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  symbol: z.string(),
  alert_type: AlertTypeEnum,
  condition: z.record(z.any()),
  is_active: z.boolean().default(true),
  triggered_count: z.number().default(0),
  last_triggered_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
});

export const CreateAlertSchema = AlertSchema.omit({
  id: true,
  user_id: true,
  triggered_count: true,
  last_triggered_at: true,
  created_at: true,
});

// Type exports
export type Portfolio = z.infer<typeof PortfolioSchema>;
export type CreatePortfolio = z.infer<typeof CreatePortfolioSchema>;
export type UpdatePortfolio = z.infer<typeof UpdatePortfolioSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Trade = z.infer<typeof TradeSchema>;
export type CreateTrade = z.infer<typeof CreateTradeSchema>;
export type Ticker = z.infer<typeof TickerSchema>;
export type PriceHistory = z.infer<typeof PriceHistorySchema>;
export type OptionsFlow = z.infer<typeof OptionsFlowSchema>;
export type SentimentData = z.infer<typeof SentimentDataSchema>;
export type AgentExecution = z.infer<typeof AgentExecutionSchema>;
export type CreateAgentExecution = z.infer<typeof CreateAgentExecutionSchema>;
export type AgentMemory = z.infer<typeof AgentMemorySchema>;
export type AgentDebate = z.infer<typeof AgentDebateSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type Watchlist = z.infer<typeof WatchlistSchema>;
export type CreateWatchlist = z.infer<typeof CreateWatchlistSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type CreateAlert = z.infer<typeof CreateAlertSchema>;