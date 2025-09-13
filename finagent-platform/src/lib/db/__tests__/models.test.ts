import {
  PortfolioSchema,
  CreatePortfolioSchema,
  PositionSchema,
  TradeSchema,
  CreateTradeSchema,
  AgentExecutionSchema,
  UserPreferencesSchema,
  AlertSchema,
} from '../models';

describe('Database Models', () => {
  describe('PortfolioSchema', () => {
    it('should validate a valid portfolio', () => {
      const portfolio = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'My Portfolio',
        description: 'Test portfolio',
        total_value: 10000,
        cash_balance: 5000,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const result = PortfolioSchema.safeParse(portfolio);
      expect(result.success).toBe(true);
    });

    it('should reject invalid portfolio data', () => {
      const invalidPortfolio = {
        id: 'not-a-uuid',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        name: '',
        total_value: -1000,
      };

      const result = PortfolioSchema.safeParse(invalidPortfolio);
      expect(result.success).toBe(false);
    });
  });

  describe('CreatePortfolioSchema', () => {
    it('should validate portfolio creation data', () => {
      const createData = {
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'New Portfolio',
        description: 'My new portfolio',
        cash_balance: 10000,
      };

      const result = CreatePortfolioSchema.safeParse(createData);
      expect(result.success).toBe(true);
    });

    it('should allow optional fields', () => {
      const minimalData = {
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Minimal Portfolio',
      };

      const result = CreatePortfolioSchema.safeParse(minimalData);
      expect(result.success).toBe(true);
    });
  });

  describe('PositionSchema', () => {
    it('should validate a valid position', () => {
      const position = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        account_id: '123e4567-e89b-12d3-a456-426614174001',
        symbol: 'AAPL',
        quantity: 100,
        average_cost: 150.50,
        current_price: 155.00,
        market_value: 15500,
        unrealized_pnl: 450,
        realized_pnl: 0,
        position_type: 'long',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const result = PositionSchema.safeParse(position);
      expect(result.success).toBe(true);
    });

    it('should validate position types', () => {
      const longPosition = { ...validPosition(), position_type: 'long' };
      const shortPosition = { ...validPosition(), position_type: 'short' };

      expect(PositionSchema.safeParse(longPosition).success).toBe(true);
      expect(PositionSchema.safeParse(shortPosition).success).toBe(true);
    });

    it('should reject invalid position types', () => {
      const invalidPosition = { ...validPosition(), position_type: 'invalid' };
      const result = PositionSchema.safeParse(invalidPosition);
      expect(result.success).toBe(false);
    });
  });

  describe('TradeSchema', () => {
    it('should validate a valid trade', () => {
      const trade = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        account_id: '123e4567-e89b-12d3-a456-426614174001',
        symbol: 'MSFT',
        trade_type: 'buy',
        quantity: 50,
        price: 300.00,
        total_amount: 15000,
        commission: 5.00,
        status: 'executed',
        order_id: 'ORD123456',
        executed_at: '2024-01-01T10:00:00Z',
        created_at: '2024-01-01T09:59:00Z',
      };

      const result = TradeSchema.safeParse(trade);
      expect(result.success).toBe(true);
    });

    it('should validate all trade types', () => {
      const tradeTypes = ['buy', 'sell', 'buy_to_cover', 'sell_short'];
      
      tradeTypes.forEach(type => {
        const trade = { ...validTrade(), trade_type: type };
        const result = TradeSchema.safeParse(trade);
        expect(result.success).toBe(true);
      });
    });

    it('should validate all trade statuses', () => {
      const statuses = ['pending', 'executed', 'cancelled', 'failed'];
      
      statuses.forEach(status => {
        const trade = { ...validTrade(), status };
        const result = TradeSchema.safeParse(trade);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('AgentExecutionSchema', () => {
    it('should validate agent execution data', () => {
      const execution = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        session_id: '123e4567-e89b-12d3-a456-426614174002',
        query: 'Analyze AAPL',
        agent_name: 'FinancialAnalyst',
        agent_type: 'analyst',
        status: 'completed',
        result: { analysis: 'Bullish outlook' },
        execution_time_ms: 1500,
        tokens_used: 250,
        cost: 0.0025,
        created_at: '2024-01-01T10:00:00Z',
        completed_at: '2024-01-01T10:00:01.5Z',
      };

      const result = AgentExecutionSchema.safeParse(execution);
      expect(result.success).toBe(true);
    });

    it('should validate all execution statuses', () => {
      const statuses = ['pending', 'running', 'completed', 'failed'];
      
      statuses.forEach(status => {
        const execution = { ...validExecution(), status };
        const result = AgentExecutionSchema.safeParse(execution);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('UserPreferencesSchema', () => {
    it('should validate user preferences', () => {
      const preferences = {
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        theme: 'dark',
        default_chart_interval: '1H',
        preferred_agents: ['analyst', 'trader'],
        risk_tolerance: 'moderate',
        trading_experience: 'intermediate',
        notification_settings: {
          email: true,
          push: false,
          sms: true,
        },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const result = UserPreferencesSchema.safeParse(preferences);
      expect(result.success).toBe(true);
    });

    it('should validate theme options', () => {
      const themes = ['light', 'dark', 'auto'];
      
      themes.forEach(theme => {
        const prefs = { ...validPreferences(), theme };
        const result = UserPreferencesSchema.safeParse(prefs);
        expect(result.success).toBe(true);
      });
    });

    it('should validate risk tolerance levels', () => {
      const levels = ['conservative', 'moderate', 'aggressive'];
      
      levels.forEach(risk_tolerance => {
        const prefs = { ...validPreferences(), risk_tolerance };
        const result = UserPreferencesSchema.safeParse(prefs);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('AlertSchema', () => {
    it('should validate alert data', () => {
      const alert = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        symbol: 'TSLA',
        alert_type: 'price_above',
        condition: { threshold: 800, comparison: 'greater_than' },
        is_active: true,
        triggered_count: 0,
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = AlertSchema.safeParse(alert);
      expect(result.success).toBe(true);
    });

    it('should validate all alert types', () => {
      const alertTypes = ['price_above', 'price_below', 'volume_spike', 'volatility', 'sentiment'];
      
      alertTypes.forEach(alert_type => {
        const alert = { ...validAlert(), alert_type };
        const result = AlertSchema.safeParse(alert);
        expect(result.success).toBe(true);
      });
    });
  });
});

// Helper functions for valid test data
function validPosition() {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    account_id: '123e4567-e89b-12d3-a456-426614174001',
    symbol: 'AAPL',
    quantity: 100,
    average_cost: 150,
    updated_at: '2024-01-01T00:00:00Z',
  };
}

function validTrade() {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    account_id: '123e4567-e89b-12d3-a456-426614174001',
    symbol: 'MSFT',
    trade_type: 'buy',
    quantity: 50,
    price: 300,
    total_amount: 15000,
    created_at: '2024-01-01T00:00:00Z',
  };
}

function validExecution() {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    user_id: '123e4567-e89b-12d3-a456-426614174001',
    query: 'Test query',
    agent_name: 'TestAgent',
    status: 'pending',
    created_at: '2024-01-01T00:00:00Z',
  };
}

function validPreferences() {
  return {
    user_id: '123e4567-e89b-12d3-a456-426614174001',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

function validAlert() {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    user_id: '123e4567-e89b-12d3-a456-426614174001',
    symbol: 'AAPL',
    alert_type: 'price_above',
    condition: { threshold: 150 },
    created_at: '2024-01-01T00:00:00Z',
  };
}