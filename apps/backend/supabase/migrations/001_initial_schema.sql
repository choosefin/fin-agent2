-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Portfolios and Accounts
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  plaid_account_id TEXT UNIQUE,
  plaid_item_id TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plaid Integration Tables
CREATE TABLE plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_item_id TEXT UNIQUE NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE plaid_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_item_id TEXT REFERENCES plaid_items(plaid_item_id) ON DELETE CASCADE,
  plaid_account_id TEXT UNIQUE NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('depository', 'investment', 'loan', 'credit')),
  account_subtype TEXT,
  balance_available DECIMAL(20, 2),
  balance_current DECIMAL(20, 2),
  balance_limit DECIMAL(20, 2),
  iso_currency_code TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE plaid_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_account_id TEXT REFERENCES plaid_accounts(plaid_account_id) ON DELETE CASCADE,
  plaid_transaction_id TEXT UNIQUE NOT NULL,
  amount DECIMAL(20, 2) NOT NULL,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  merchant_name TEXT,
  category JSONB,
  pending BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE plaid_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_account_id TEXT REFERENCES plaid_accounts(plaid_account_id) ON DELETE CASCADE,
  plaid_holding_id TEXT UNIQUE NOT NULL,
  security_id TEXT NOT NULL,
  symbol TEXT,
  quantity DECIMAL(20, 8) NOT NULL,
  cost_basis DECIMAL(20, 2),
  value DECIMAL(20, 2) NOT NULL,
  iso_currency_code TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolio Positions
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  average_cost DECIMAL(20, 4) NOT NULL,
  current_price DECIMAL(20, 4),
  market_value DECIMAL(20, 2),
  unrealized_pnl DECIMAL(20, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Market Data
CREATE TABLE tickers (
  symbol TEXT PRIMARY KEY,
  company_name TEXT,
  sector TEXT,
  industry TEXT,
  market_cap BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT REFERENCES tickers(symbol) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  open_price DECIMAL(20, 4) NOT NULL,
  high_price DECIMAL(20, 4) NOT NULL,
  low_price DECIMAL(20, 4) NOT NULL,
  close_price DECIMAL(20, 4) NOT NULL,
  volume BIGINT NOT NULL,
  adjusted_close DECIMAL(20, 4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE options_flow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT REFERENCES tickers(symbol) ON DELETE CASCADE,
  strike_price DECIMAL(20, 4) NOT NULL,
  expiration_date DATE NOT NULL,
  option_type TEXT NOT NULL CHECK (option_type IN ('call', 'put')),
  volume BIGINT NOT NULL,
  open_interest BIGINT,
  premium DECIMAL(20, 4),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Sentiment Analysis
CREATE TABLE sentiment_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT REFERENCES tickers(symbol) ON DELETE CASCADE,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  sentiment_score DECIMAL(3, 2) NOT NULL CHECK (sentiment_score BETWEEN -1 AND 1),
  confidence DECIMAL(3, 2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  embedding VECTOR(1536), -- OpenAI embedding dimension
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Execution and Memory
CREATE TABLE agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  assistant_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  result JSONB,
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE agent_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES agent_executions(id) ON DELETE CASCADE,
  depends_on_execution_id UUID REFERENCES agent_executions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category, key)
);

-- Trading Orders
CREATE TABLE trading_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('market', 'limit', 'stop', 'stop_limit')),
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity DECIMAL(20, 8) NOT NULL,
  limit_price DECIMAL(20, 4),
  stop_price DECIMAL(20, 4),
  status TEXT NOT NULL CHECK (status IN ('pending', 'submitted', 'filled', 'partially_filled', 'cancelled', 'rejected')),
  broker_order_id TEXT,
  filled_quantity DECIMAL(20, 8),
  average_fill_price DECIMAL(20, 4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX idx_accounts_portfolio_id ON accounts(portfolio_id);
CREATE INDEX idx_plaid_items_user_id ON plaid_items(user_id);
CREATE INDEX idx_plaid_accounts_item_id ON plaid_accounts(plaid_item_id);
CREATE INDEX idx_plaid_transactions_account_id ON plaid_transactions(plaid_account_id);
CREATE INDEX idx_plaid_transactions_date ON plaid_transactions(date);
CREATE INDEX idx_plaid_holdings_account_id ON plaid_holdings(plaid_account_id);
CREATE INDEX idx_positions_account_id ON positions(account_id);
CREATE INDEX idx_positions_symbol ON positions(symbol);
CREATE INDEX idx_price_history_symbol ON price_history(symbol);
CREATE INDEX idx_price_history_timestamp ON price_history(timestamp);
CREATE INDEX idx_agent_executions_user_id ON agent_executions(user_id);
CREATE INDEX idx_agent_executions_status ON agent_executions(status);
CREATE INDEX idx_agent_memory_user_id ON agent_memory(user_id);
CREATE INDEX idx_agent_memory_category ON agent_memory(category);
CREATE INDEX idx_trading_orders_user_id ON trading_orders(user_id);
CREATE INDEX idx_trading_orders_symbol ON trading_orders(symbol);
CREATE INDEX idx_trading_orders_status ON trading_orders(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plaid_items_updated_at BEFORE UPDATE ON plaid_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickers_updated_at BEFORE UPDATE ON tickers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_memory_updated_at BEFORE UPDATE ON agent_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trading_orders_updated_at BEFORE UPDATE ON trading_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();