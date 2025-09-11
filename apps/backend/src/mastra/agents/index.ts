import { Agent } from '@mastra/core';
import { agentPrompts, llmConfig } from '../config';
import * as tools from '../tools';

// General Assistant Agent
export const generalAgent = new Agent({
  name: 'General Assistant',
  description: 'Balanced financial analysis and general advice',
  instructions: agentPrompts.general,
  model: {
    provider: llmConfig.defaultProvider,
    name: llmConfig.defaultModel,
  },
  tools: [
    tools.marketDataTool,
    tools.plaidTool,
    tools.searchTool,
    tools.portfolioAnalysisTool,
  ],
});

// Financial Analyst Agent
export const analystAgent = new Agent({
  name: 'Financial Analyst',
  description: 'Deep fundamental and technical analysis',
  instructions: agentPrompts.analyst,
  model: {
    provider: llmConfig.defaultProvider,
    name: llmConfig.defaultModel,
  },
  tools: [
    tools.marketDataTool,
    tools.fundamentalAnalysisTool,
    tools.technicalAnalysisTool,
    tools.quantAnalysisTool,
    tools.searchTool,
  ],
});

// Trading Assistant Agent
export const traderAgent = new Agent({
  name: 'Trading Assistant',
  description: 'Short-term trading and market timing',
  instructions: agentPrompts.trader,
  model: {
    provider: llmConfig.defaultProvider,
    name: llmConfig.defaultModel,
  },
  tools: [
    tools.marketDataTool,
    tools.technicalIndicatorsTool,
    tools.orderFlowTool,
    tools.alpacaTradingTool,
    tools.riskManagementTool,
  ],
});

// Investment Advisor Agent
export const advisorAgent = new Agent({
  name: 'Investment Advisor',
  description: 'Long-term investment strategy and planning',
  instructions: agentPrompts.advisor,
  model: {
    provider: llmConfig.defaultProvider,
    name: llmConfig.defaultModel,
  },
  tools: [
    tools.portfolioOptimizationTool,
    tools.assetAllocationTool,
    tools.plaidTool,
    tools.retirementPlanningTool,
    tools.taxOptimizationTool,
  ],
});

// Risk Manager Agent
export const riskManagerAgent = new Agent({
  name: 'Risk Manager',
  description: 'Portfolio risk assessment and mitigation',
  instructions: agentPrompts.riskManager,
  model: {
    provider: llmConfig.defaultProvider,
    name: llmConfig.defaultModel,
  },
  tools: [
    tools.riskAssessmentTool,
    tools.hedgingTool,
    tools.stressTestingTool,
    tools.volatilityAnalysisTool,
    tools.correlationAnalysisTool,
  ],
});

// Macro Economist Agent
export const economistAgent = new Agent({
  name: 'Macro Economist',
  description: 'Economic trends and policy analysis',
  instructions: agentPrompts.economist,
  model: {
    provider: llmConfig.defaultProvider,
    name: llmConfig.defaultModel,
  },
  tools: [
    tools.economicDataTool,
    tools.sectorAnalysisTool,
    tools.policyAnalysisTool,
    tools.marketCycleTool,
    tools.searchTool,
  ],
});

// Agent Registry
export const agents = {
  general: generalAgent,
  analyst: analystAgent,
  trader: traderAgent,
  advisor: advisorAgent,
  riskManager: riskManagerAgent,
  economist: economistAgent,
};

// Agent selector function
export function selectAgent(assistantType: string): Agent {
  return agents[assistantType as keyof typeof agents] || agents.general;
}

// Get debate participants based on query type
export function selectDebateParticipants(
  assistantType: string,
  queryContext: any
): Agent[] {
  const primaryAgent = selectAgent(assistantType);
  const participants = [primaryAgent];

  // Add relevant agents based on context
  if (queryContext.symbols && queryContext.symbols.length > 0) {
    participants.push(analystAgent);
  }
  
  if (queryContext.includeRisk) {
    participants.push(riskManagerAgent);
  }
  
  if (queryContext.includeMacro) {
    participants.push(economistAgent);
  }
  
  if (queryContext.includeTrading) {
    participants.push(traderAgent);
  }

  // Ensure unique agents
  return Array.from(new Set(participants));
}

export default agents;