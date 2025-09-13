-- Supabase Database Schema for FinAgent Platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Portfolios and Accounts
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  total_value DECIMAL(20, 2) DEFAULT 0,
  cash_balance DECIMAL(20, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('cash', 'margin', 'retirement', 'crypto')),
  is_active BOOLEAN DEFAULT true,
  api_key_encrypted TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broker_name, account_number)
);

CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  average_cost DECIMAL(20, 8) NOT NULL,
  current_price DECIMAL(20, 8),
  market_value DECIMAL(20, 2),
  unrealized_pnl DECIMAL(20, 2),
  realized_pnl DECIMAL(20, 2) DEFAULT 0,
  position_type TEXT DEFAULT 'long' CHECK (position_type IN ('long', 'short')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Market Data
CREATE TABLE tickers (
  symbol TEXT PRIMARY KEY,
  company_name TEXT,
  sector TEXT,
  industry TEXT,
  market_cap BIGINT,
  exchange TEXT,
  asset_type TEXT CHECK (asset_type IN ('stock', 'etf', 'crypto', 'forex', 'option', 'future')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT REFERENCES tickers(symbol),
  timestamp TIMESTAMPTZ NOT NULL,
  open_price DECIMAL(20, 8) NOT NULL,
  high_price DECIMAL(20, 8) NOT NULL,
  low_price DECIMAL(20, 8) NOT NULL,
  close_price DECIMAL(20, 8) NOT NULL,
  volume BIGINT NOT NULL,
  adjusted_close DECIMAL(20, 8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, timestamp)
);

CREATE TABLE options_flow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT REFERENCES tickers(symbol),
  strike_price DECIMAL(20, 2) NOT NULL,
  expiration_date DATE NOT NULL,
  option_type TEXT NOT NULL CHECK (option_type IN ('call', 'put')),
  volume BIGINT NOT NULL,
  open_interest BIGINT,
  premium DECIMAL(20, 4),
  implied_volatility DECIMAL(10, 4),
  delta DECIMAL(10, 4),
  gamma DECIMAL(10, 4),
  theta DECIMAL(10, 4),
  vega DECIMAL(10, 4),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Sentiment Analysis
CREATE TABLE sentiment_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT REFERENCES tickers(symbol),
  source TEXT NOT NULL,
  source_url TEXT,
  content TEXT NOT NULL,
  sentiment_score DECIMAL(5, 4) NOT NULL CHECK (sentiment_score BETWEEN -1 AND 1),
  confidence DECIMAL(5, 4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  embedding VECTOR(1536), -- OpenAI embedding dimension
  entities JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trading History
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell', 'buy_to_cover', 'sell_short')),
  quantity DECIMAL(20, 8) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  total_amount DECIMAL(20, 2) NOT NULL,
  commission DECIMAL(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled', 'failed')),
  order_id TEXT,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Execution and Memory
CREATE TABLE agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID,
  query TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  agent_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  result JSONB,
  error_message TEXT,
  execution_time_ms INTEGER,
  tokens_used INTEGER,
  cost DECIMAL(10, 6),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  memory_key TEXT NOT NULL,
  memory_value JSONB NOT NULL,
  context JSONB,
  ttl_seconds INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, agent_type, memory_key)
);

CREATE TABLE agent_debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES agent_executions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  participant_agent TEXT NOT NULL,
  statement TEXT NOT NULL,
  evidence JSONB,
  confidence_score DECIMAL(5, 4) CHECK (confidence_score BETWEEN 0 AND 1),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- User Preferences and Settings
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
  default_chart_interval TEXT DEFAULT '1D',
  preferred_agents JSONB DEFAULT '[]'::jsonb,
  risk_tolerance TEXT CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
  trading_experience TEXT CHECK (trading_experience IN ('beginner', 'intermediate', 'advanced', 'professional')),
  notification_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watchlists
CREATE TABLE watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  symbols TEXT[] NOT NULL DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('price_above', 'price_below', 'volume_spike', 'volatility', 'sentiment')),
  condition JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  triggered_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_positions_account_id ON positions(account_id);
CREATE INDEX idx_positions_symbol ON positions(symbol);
CREATE INDEX idx_price_history_symbol_timestamp ON price_history(symbol, timestamp DESC);
CREATE INDEX idx_trades_account_id ON trades(account_id);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_agent_executions_user_id ON agent_executions(user_id);
CREATE INDEX idx_agent_executions_session_id ON agent_executions(session_id);
CREATE INDEX idx_agent_memory_user_agent ON agent_memory(user_id, agent_type);
CREATE INDEX idx_sentiment_data_symbol ON sentiment_data(symbol);
CREATE INDEX idx_sentiment_data_timestamp ON sentiment_data(timestamp DESC);
CREATE INDEX idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_symbol ON alerts(symbol);

-- Row Level Security Policies
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own portfolios" ON portfolios
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own accounts" ON accounts
  FOR ALL USING (portfolio_id IN (
    SELECT id FROM portfolios WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view own positions" ON positions
  FOR ALL USING (account_id IN (
    SELECT a.id FROM accounts a
    JOIN portfolios p ON a.portfolio_id = p.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Users can view own trades" ON trades
  FOR ALL USING (account_id IN (
    SELECT a.id FROM accounts a
    JOIN portfolios p ON a.portfolio_id = p.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Users can view own agent executions" ON agent_executions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own agent memory" ON agent_memory
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own watchlists" ON watchlists
  FOR ALL USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can view own alerts" ON alerts
  FOR ALL USING (auth.uid() = user_id);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_watchlists_updated_at BEFORE UPDATE ON watchlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_memory_updated_at BEFORE UPDATE ON agent_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();