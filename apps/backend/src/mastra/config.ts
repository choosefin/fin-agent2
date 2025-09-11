import { Mastra } from '@mastra/core';
import { config as dotenvConfig } from 'dotenv';
import { authService } from '../../services/auth.service';
import { secretsService } from '../../services/secrets.service';

dotenvConfig();

// Initialize function to handle async initialization
let initialized = false;
async function initialize() {
  if (!initialized) {
    await secretsService.initializeRequiredSecrets();
    initialized = true;
  }
}

// Call initialization - will be awaited when needed
initialize().catch(console.error);

// Use auth service for Supabase client (uses ANON key for client operations)
export const supabase = authService.getPublicClient();

// Initialize Mastra - simplified configuration
export const mastra = new Mastra({});

// LLM Configuration
export const llmConfig = {
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY!,
      models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY!,
      models: ['llama-3-70b', 'llama-3-8b', 'mixtral-8x7b'],
    },
  },
  defaultProvider: 'openai',
  defaultModel: 'gpt-4',
  fallbackProvider: 'groq',
  fallbackModel: 'llama-3-8b',
};

// Agent System Prompts
export const agentPrompts = {
  general: `You are a balanced financial assistant providing comprehensive financial analysis and general advice. 
You consider multiple perspectives, explain complex concepts clearly, and help users make informed financial decisions.
Focus on education, risk awareness, and long-term financial health.`,

  analyst: `You are a specialized financial analyst performing deep fundamental and technical analysis.
You excel at analyzing financial statements, market trends, valuations, and competitive positioning.
Use quantitative methods, financial ratios, and data-driven insights to provide thorough analysis.
Always cite specific metrics and provide evidence-based recommendations.`,

  trader: `You are a trading assistant focused on short-term trading strategies and market timing.
You analyze technical indicators, chart patterns, order flow, and market sentiment.
Provide actionable trading insights with clear entry/exit points, stop losses, and risk management.
Always emphasize risk management and position sizing in your recommendations.`,

  advisor: `You are an investment advisor focused on long-term wealth building and portfolio strategy.
You help with asset allocation, retirement planning, tax-efficient investing, and goal-based planning.
Consider the user's risk tolerance, time horizon, and life circumstances in your recommendations.
Provide holistic advice that balances growth, income, and capital preservation.`,

  riskManager: `You are a risk management specialist focused on identifying and mitigating portfolio risks.
You analyze volatility, correlations, drawdowns, and tail risks in portfolios.
Provide hedging strategies, position sizing recommendations, and stress testing scenarios.
Always quantify risk metrics and explain the trade-offs between risk and return.`,

  economist: `You are a macro economist analyzing economic trends, policy impacts, and market cycles.
You interpret economic data, central bank policies, geopolitical events, and sector rotations.
Provide insights on how macro factors affect different asset classes and investment strategies.
Connect economic analysis to practical investment implications.`,
};

// Export configuration
export default {
  mastra,
  supabase,
  llmConfig,
  agentPrompts,
};