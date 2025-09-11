-- Enable Row Level Security on all tables
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_orders ENABLE ROW LEVEL SECURITY;

-- Portfolios policies
CREATE POLICY "Users can view own portfolios" ON portfolios
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own portfolios" ON portfolios
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolios" ON portfolios
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolios" ON portfolios
  FOR DELETE USING (auth.uid() = user_id);

-- Accounts policies
CREATE POLICY "Users can view accounts in own portfolios" ON accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios 
      WHERE portfolios.id = accounts.portfolio_id 
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create accounts in own portfolios" ON accounts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM portfolios 
      WHERE portfolios.id = portfolio_id 
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update accounts in own portfolios" ON accounts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM portfolios 
      WHERE portfolios.id = accounts.portfolio_id 
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete accounts in own portfolios" ON accounts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM portfolios 
      WHERE portfolios.id = accounts.portfolio_id 
      AND portfolios.user_id = auth.uid()
    )
  );

-- Plaid items policies
CREATE POLICY "Users can view own Plaid items" ON plaid_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own Plaid items" ON plaid_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Plaid items" ON plaid_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own Plaid items" ON plaid_items
  FOR DELETE USING (auth.uid() = user_id);

-- Plaid accounts policies
CREATE POLICY "Users can view Plaid accounts for own items" ON plaid_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plaid_items 
      WHERE plaid_items.plaid_item_id = plaid_accounts.plaid_item_id 
      AND plaid_items.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create Plaid accounts for own items" ON plaid_accounts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM plaid_items 
      WHERE plaid_items.plaid_item_id = plaid_item_id 
      AND plaid_items.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update Plaid accounts for own items" ON plaid_accounts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM plaid_items 
      WHERE plaid_items.plaid_item_id = plaid_accounts.plaid_item_id 
      AND plaid_items.user_id = auth.uid()
    )
  );

-- Plaid transactions policies
CREATE POLICY "Users can view transactions for own accounts" ON plaid_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plaid_accounts 
      JOIN plaid_items ON plaid_items.plaid_item_id = plaid_accounts.plaid_item_id
      WHERE plaid_accounts.plaid_account_id = plaid_transactions.plaid_account_id 
      AND plaid_items.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create transactions for own accounts" ON plaid_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM plaid_accounts 
      JOIN plaid_items ON plaid_items.plaid_item_id = plaid_accounts.plaid_item_id
      WHERE plaid_accounts.plaid_account_id = plaid_account_id 
      AND plaid_items.user_id = auth.uid()
    )
  );

-- Plaid holdings policies
CREATE POLICY "Users can view holdings for own accounts" ON plaid_holdings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plaid_accounts 
      JOIN plaid_items ON plaid_items.plaid_item_id = plaid_accounts.plaid_item_id
      WHERE plaid_accounts.plaid_account_id = plaid_holdings.plaid_account_id 
      AND plaid_items.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create holdings for own accounts" ON plaid_holdings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM plaid_accounts 
      JOIN plaid_items ON plaid_items.plaid_item_id = plaid_accounts.plaid_item_id
      WHERE plaid_accounts.plaid_account_id = plaid_account_id 
      AND plaid_items.user_id = auth.uid()
    )
  );

-- Positions policies
CREATE POLICY "Users can view positions in own accounts" ON positions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM accounts 
      JOIN portfolios ON portfolios.id = accounts.portfolio_id
      WHERE accounts.id = positions.account_id 
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create positions in own accounts" ON positions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM accounts 
      JOIN portfolios ON portfolios.id = accounts.portfolio_id
      WHERE accounts.id = account_id 
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update positions in own accounts" ON positions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM accounts 
      JOIN portfolios ON portfolios.id = accounts.portfolio_id
      WHERE accounts.id = positions.account_id 
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete positions in own accounts" ON positions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM accounts 
      JOIN portfolios ON portfolios.id = accounts.portfolio_id
      WHERE accounts.id = positions.account_id 
      AND portfolios.user_id = auth.uid()
    )
  );

-- Agent executions policies
CREATE POLICY "Users can view own agent executions" ON agent_executions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own agent executions" ON agent_executions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agent executions" ON agent_executions
  FOR UPDATE USING (auth.uid() = user_id);

-- Agent memory policies
CREATE POLICY "Users can view own agent memory" ON agent_memory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own agent memory" ON agent_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agent memory" ON agent_memory
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agent memory" ON agent_memory
  FOR DELETE USING (auth.uid() = user_id);

-- Trading orders policies
CREATE POLICY "Users can view own trading orders" ON trading_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own trading orders" ON trading_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trading orders" ON trading_orders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can cancel own trading orders" ON trading_orders
  FOR DELETE USING (auth.uid() = user_id);

-- Public read-only tables (no RLS)
-- Note: tickers, price_history, options_flow, sentiment_data are public market data
-- They don't need RLS as they're read-only public data