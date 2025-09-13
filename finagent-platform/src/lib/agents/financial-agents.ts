// Specialized Financial Agents for Mastra
import { Agent, Tool } from '@mastra/core';
import { z } from 'zod';

// Define agent types
export enum AgentType {
  GENERAL = 'general',
  ANALYST = 'analyst',
  TRADER = 'trader',
  ADVISOR = 'advisor',
  RISK_MANAGER = 'risk_manager',
  ECONOMIST = 'economist',
}

// Agent color schemes for UI
export const agentColors = {
  [AgentType.GENERAL]: { primary: '#3B82F6', secondary: '#EFF6FF' }, // Blue
  [AgentType.ANALYST]: { primary: '#10B981', secondary: '#F0FDF4' }, // Green
  [AgentType.TRADER]: { primary: '#F59E0B', secondary: '#FEF3C7' }, // Amber
  [AgentType.ADVISOR]: { primary: '#8B5CF6', secondary: '#F3E8FF' }, // Purple
  [AgentType.RISK_MANAGER]: { primary: '#EF4444', secondary: '#FEE2E2' }, // Red
  [AgentType.ECONOMIST]: { primary: '#06B6D4', secondary: '#ECFEFF' }, // Cyan
};

// Base configuration for all financial agents
const baseAgentConfig = {
  model: {
    provider: 'OPENAI' as const,
    name: 'gpt-4-turbo-preview',
  },
  temperature: 0.7,
  maxTokens: 2000,
};

// General Assistant Agent
export class GeneralAssistant extends Agent {
  constructor() {
    super({
      ...baseAgentConfig,
      name: 'General Financial Assistant',
      instructions: `You are a balanced financial assistant providing comprehensive market analysis and general financial advice.
      
Your expertise includes:
- Market overview and trends
- Basic portfolio guidance
- Educational content about investing
- News interpretation and impact analysis
- General financial planning concepts

Approach:
- Provide balanced, educational responses
- Explain financial concepts clearly
- Offer multiple perspectives on market events
- Help users understand the basics of investing
- Avoid overly technical jargon unless requested

You should be helpful, informative, and encourage users to learn more about financial markets.`,
    });
  }

  async analyzeMarket(query: string): Promise<string> {
    return this.generate(query);
  }
}

// Financial Analyst Agent
export class FinancialAnalyst extends Agent {
  constructor() {
    super({
      ...baseAgentConfig,
      name: 'Financial Analyst',
      instructions: `You are an expert financial analyst specializing in deep fundamental and technical analysis.
      
Your expertise includes:
- Fundamental analysis (P/E ratios, earnings, revenue growth, margins)
- Technical analysis (chart patterns, indicators, support/resistance)
- Financial statement analysis
- Sector and industry comparisons
- Valuation models (DCF, comparable company analysis)
- Earnings forecasts and price targets

Analytical approach:
- Use data-driven insights
- Identify key financial metrics and ratios
- Recognize chart patterns and technical indicators
- Compare companies within sectors
- Assess intrinsic value vs market price
- Provide detailed reasoning for your analysis

Always support your analysis with specific metrics and data points.`,
    });
  }

  async analyzeSecurity(symbol: string, analysisType: 'fundamental' | 'technical' | 'both'): Promise<any> {
    const prompt = `Perform ${analysisType} analysis on ${symbol}. Include key metrics, trends, and actionable insights.`;
    return this.generate(prompt);
  }

  async compareSecurities(symbols: string[]): Promise<any> {
    const prompt = `Compare the following securities: ${symbols.join(', ')}. Focus on fundamental metrics, growth prospects, and relative valuation.`;
    return this.generate(prompt);
  }
}

// Trading Assistant Agent
export class TradingAssistant extends Agent {
  constructor() {
    super({
      ...baseAgentConfig,
      name: 'Trading Assistant',
      instructions: `You are an experienced trading assistant focused on short-term trading strategies and market timing.
      
Your expertise includes:
- Day trading and swing trading strategies
- Entry and exit point identification
- Risk/reward ratio calculations
- Stop-loss and take-profit level setting
- Volume analysis and order flow
- Options strategies (calls, puts, spreads)
- Market microstructure and liquidity analysis

Trading approach:
- Focus on technical indicators and price action
- Identify momentum and reversal patterns
- Calculate optimal position sizes
- Set clear risk management parameters
- Monitor unusual options activity
- Track institutional order flow
- Provide specific entry/exit recommendations

Always emphasize risk management and position sizing in your recommendations.`,
      temperature: 0.6, // Lower temperature for more consistent trading signals
    });
  }

  async generateTradeIdea(symbol: string, timeframe: string): Promise<any> {
    const prompt = `Generate a trade idea for ${symbol} on ${timeframe} timeframe. Include entry, stop-loss, take-profit, and risk/reward ratio.`;
    return this.generate(prompt);
  }

  async analyzeOptionsFlow(symbol: string): Promise<any> {
    const prompt = `Analyze unusual options activity for ${symbol}. Identify significant trades and potential implications.`;
    return this.generate(prompt);
  }
}

// Investment Advisor Agent
export class InvestmentAdvisor extends Agent {
  constructor() {
    super({
      ...baseAgentConfig,
      name: 'Investment Advisor',
      instructions: `You are a professional investment advisor providing long-term investment strategy and portfolio planning.
      
Your expertise includes:
- Strategic asset allocation
- Portfolio diversification strategies
- Long-term wealth building
- Retirement planning
- Tax-efficient investing
- ETF and mutual fund selection
- Dollar-cost averaging strategies
- Rebalancing methodologies

Advisory approach:
- Focus on long-term wealth creation
- Emphasize diversification and risk-adjusted returns
- Consider investor's time horizon and goals
- Recommend low-cost, diversified investments
- Explain tax implications of investment decisions
- Provide education on compound growth
- Suggest systematic investment plans

Always consider the investor's risk tolerance, time horizon, and financial goals.`,
    });
  }

  async createPortfolioStrategy(riskTolerance: string, timeHorizon: string, goals: string[]): Promise<any> {
    const prompt = `Create a portfolio strategy for an investor with ${riskTolerance} risk tolerance, ${timeHorizon} time horizon, and goals: ${goals.join(', ')}.`;
    return this.generate(prompt);
  }

  async recommendAssetAllocation(age: number, riskProfile: string): Promise<any> {
    const prompt = `Recommend an asset allocation for a ${age}-year-old investor with ${riskProfile} risk profile.`;
    return this.generate(prompt);
  }
}

// Risk Manager Agent
export class RiskManager extends Agent {
  constructor() {
    super({
      ...baseAgentConfig,
      name: 'Risk Manager',
      instructions: `You are a specialized risk manager focused on portfolio risk assessment and protection strategies.
      
Your expertise includes:
- Portfolio risk metrics (VaR, Sharpe ratio, beta, standard deviation)
- Correlation analysis and diversification
- Hedging strategies (options, inverse ETFs)
- Position sizing and Kelly Criterion
- Drawdown analysis and recovery scenarios
- Black swan event preparation
- Stress testing and scenario analysis
- Risk parity and volatility targeting

Risk management approach:
- Quantify portfolio risk using multiple metrics
- Identify concentration risks and correlations
- Recommend hedging strategies for downside protection
- Calculate optimal position sizes based on risk
- Stress test portfolios under various scenarios
- Monitor systemic and idiosyncratic risks
- Provide early warning signals for risk events

Always prioritize capital preservation and emphasize the importance of risk management.`,
      temperature: 0.5, // Lower temperature for conservative risk assessments
    });
  }

  async assessPortfolioRisk(positions: any[]): Promise<any> {
    const prompt = `Assess the risk of a portfolio with positions: ${JSON.stringify(positions)}. Calculate risk metrics and identify vulnerabilities.`;
    return this.generate(prompt);
  }

  async recommendHedgeStrategies(portfolio: any, marketConditions: string): Promise<any> {
    const prompt = `Recommend hedging strategies for portfolio: ${JSON.stringify(portfolio)} given ${marketConditions} market conditions.`;
    return this.generate(prompt);
  }
}

// Macro Economist Agent
export class MacroEconomist extends Agent {
  constructor() {
    super({
      ...baseAgentConfig,
      name: 'Macro Economist',
      instructions: `You are a macro economist analyzing economic trends, policy impacts, and their effects on financial markets.
      
Your expertise includes:
- Economic indicators (GDP, inflation, employment, PMI)
- Central bank policy analysis (Fed, ECB, BOJ, PBOC)
- Interest rate forecasting
- Currency and forex analysis
- Commodity market impacts
- Geopolitical risk assessment
- Sector rotation based on economic cycles
- Global trade and supply chain analysis

Economic analysis approach:
- Interpret economic data releases and their market impact
- Analyze central bank communications and policy changes
- Identify economic cycle phases
- Assess inflation/deflation pressures
- Evaluate fiscal policy impacts
- Connect macroeconomic trends to sector performance
- Provide context for global economic events

Always connect macroeconomic analysis to practical investment implications.`,
    });
  }

  async analyzeEconomicIndicators(indicators: string[]): Promise<any> {
    const prompt = `Analyze the following economic indicators and their market implications: ${indicators.join(', ')}.`;
    return this.generate(prompt);
  }

  async assessSectorRotation(economicPhase: string): Promise<any> {
    const prompt = `Recommend sector allocation based on ${economicPhase} phase of the economic cycle.`;
    return this.generate(prompt);
  }
}

// Factory function to create agents
export function createFinancialAgent(type: AgentType): Agent {
  switch (type) {
    case AgentType.GENERAL:
      return new GeneralAssistant();
    case AgentType.ANALYST:
      return new FinancialAnalyst();
    case AgentType.TRADER:
      return new TradingAssistant();
    case AgentType.ADVISOR:
      return new InvestmentAdvisor();
    case AgentType.RISK_MANAGER:
      return new RiskManager();
    case AgentType.ECONOMIST:
      return new MacroEconomist();
    default:
      return new GeneralAssistant();
  }
}

// Agent registry for capability discovery
export const agentRegistry = {
  [AgentType.GENERAL]: {
    name: 'General Assistant',
    description: 'Balanced financial analysis and general advice',
    capabilities: ['market_overview', 'basic_analysis', 'education', 'news_interpretation'],
    icon: '🤖',
  },
  [AgentType.ANALYST]: {
    name: 'Financial Analyst',
    description: 'Deep fundamental and technical analysis',
    capabilities: ['fundamental_analysis', 'technical_analysis', 'valuation', 'earnings_analysis'],
    icon: '📊',
  },
  [AgentType.TRADER]: {
    name: 'Trading Assistant',
    description: 'Short-term trading strategies and market timing',
    capabilities: ['trade_ideas', 'options_flow', 'entry_exit', 'risk_management'],
    icon: '📈',
  },
  [AgentType.ADVISOR]: {
    name: 'Investment Advisor',
    description: 'Long-term investment strategy and planning',
    capabilities: ['portfolio_strategy', 'asset_allocation', 'retirement_planning', 'tax_efficiency'],
    icon: '💼',
  },
  [AgentType.RISK_MANAGER]: {
    name: 'Risk Manager',
    description: 'Portfolio risk assessment and protection',
    capabilities: ['risk_assessment', 'hedging', 'position_sizing', 'stress_testing'],
    icon: '🛡️',
  },
  [AgentType.ECONOMIST]: {
    name: 'Macro Economist',
    description: 'Economic trends and policy analysis',
    capabilities: ['economic_analysis', 'policy_impact', 'sector_rotation', 'forex_analysis'],
    icon: '🌍',
  },
};