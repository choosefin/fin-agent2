import { Workflow } from '@mastra/core';
import { z } from 'zod';
import { selectDebateParticipants } from '../agents';
import { memory } from '../config';
import * as tools from '../tools';

// Input schema for the debate workflow
const DebateInputSchema = z.object({
  query: z.string(),
  userId: z.string(),
  assistantType: z.enum(['general', 'analyst', 'trader', 'advisor', 'riskManager', 'economist']),
  symbols: z.array(z.string()).optional(),
  includeRisk: z.boolean().optional(),
  includeMacro: z.boolean().optional(),
  includeTrading: z.boolean().optional(),
});

// Multi-Agent Debate Workflow
export const debateWorkflow = new Workflow({
  name: 'financial-analysis-debate',
  description: 'Multi-agent debate for comprehensive financial analysis',
  triggerSchema: DebateInputSchema,
});

// Step 1: Parallel Search
debateWorkflow.step('parallel-search', async ({ input, logger }) => {
  logger.info('Starting parallel search', { query: input.query });
  
  const searchPromises = [
    tools.searchTool.execute({ 
      query: input.query, 
      sources: ['news'] 
    }),
    tools.searchTool.execute({ 
      query: input.query, 
      sources: ['sec-filings'] 
    }),
    tools.searchTool.execute({ 
      query: input.query, 
      sources: ['social-media'] 
    }),
  ];
  
  // Add market data search if symbols provided
  if (input.symbols && input.symbols.length > 0) {
    for (const symbol of input.symbols) {
      searchPromises.push(
        tools.marketDataTool.execute({
          symbol,
          dataType: 'quote',
        })
      );
      searchPromises.push(
        tools.marketDataTool.execute({
          symbol,
          dataType: 'news',
        })
      );
    }
  }
  
  const searchResults = await Promise.all(searchPromises);
  
  return {
    searchResults,
    timestamp: new Date().toISOString(),
  };
});

// Step 2: Memory Retrieval
debateWorkflow.step('memory-retrieval', async ({ input, context, logger }) => {
  logger.info('Retrieving relevant memory context');
  
  // Retrieve user preferences and context
  const userMemory = await memory.get({
    userId: input.userId,
    category: 'preferences',
  });
  
  // Retrieve relevant past analyses
  const relevantAnalyses = await memory.search({
    userId: input.userId,
    query: input.query,
    limit: 5,
  });
  
  // Retrieve conversation history
  const conversationHistory = await memory.getConversation({
    userId: input.userId,
    limit: 10,
  });
  
  return {
    userMemory,
    relevantAnalyses,
    conversationHistory,
    searchResults: context.searchResults,
  };
});

// Step 3: Initial Analysis
debateWorkflow.step('initial-analysis', async ({ input, context, logger }) => {
  logger.info('Performing initial analysis by each agent');
  
  const participants = selectDebateParticipants(input.assistantType, {
    symbols: input.symbols,
    includeRisk: input.includeRisk,
    includeMacro: input.includeMacro,
    includeTrading: input.includeTrading,
  });
  
  // Each agent performs initial analysis
  const initialAnalyses = await Promise.all(
    participants.map(async (agent) => {
      const analysis = await agent.execute({
        task: 'analyze',
        query: input.query,
        context: {
          searchResults: context.searchResults,
          userMemory: context.userMemory,
          relevantAnalyses: context.relevantAnalyses,
        },
      });
      
      return {
        agentName: agent.name,
        analysis,
        confidence: analysis.confidence || 0.7,
        keyPoints: analysis.keyPoints || [],
      };
    })
  );
  
  return {
    participants: participants.map(p => p.name),
    initialAnalyses,
    context: context,
  };
});

// Step 4: Agent Debate
debateWorkflow.step('agent-debate', async ({ input, context, logger }) => {
  logger.info('Starting multi-agent debate');
  
  const maxRounds = 3;
  const debateRounds = [];
  let currentConsensus = null;
  
  for (let round = 0; round < maxRounds; round++) {
    logger.info(`Debate round ${round + 1}`);
    
    const roundResponses = [];
    
    // Each agent responds to previous analyses
    for (let i = 0; i < context.initialAnalyses.length; i++) {
      const agent = context.initialAnalyses[i];
      const otherAnalyses = context.initialAnalyses.filter((_, idx) => idx !== i);
      
      const response = await generateAgentResponse({
        agent: agent.agentName,
        ownAnalysis: agent.analysis,
        otherAnalyses,
        previousRounds: debateRounds,
        round: round + 1,
      });
      
      roundResponses.push({
        agent: agent.agentName,
        response,
        agreement: response.agreement || [],
        disagreement: response.disagreement || [],
        newInsights: response.newInsights || [],
      });
    }
    
    debateRounds.push({
      round: round + 1,
      responses: roundResponses,
      timestamp: new Date().toISOString(),
    });
    
    // Check for consensus
    const consensusLevel = calculateConsensus(roundResponses);
    if (consensusLevel > 0.8) {
      currentConsensus = buildConsensus(roundResponses);
      break;
    }
  }
  
  return {
    debateRounds,
    consensus: currentConsensus,
    participantCount: context.participants.length,
  };
});

// Step 5: Consensus Building
debateWorkflow.step('consensus-building', async ({ input, context, logger }) => {
  logger.info('Building final consensus');
  
  const allInsights = [];
  const allRecommendations = [];
  const riskFactors = [];
  
  // Aggregate insights from all debate rounds
  for (const round of context.debateRounds) {
    for (const response of round.responses) {
      allInsights.push(...(response.newInsights || []));
      
      if (response.response.recommendations) {
        allRecommendations.push({
          agent: response.agent,
          recommendations: response.response.recommendations,
        });
      }
      
      if (response.response.risks) {
        riskFactors.push({
          agent: response.agent,
          risks: response.response.risks,
        });
      }
    }
  }
  
  // Build structured consensus
  const consensus = {
    summary: generateConsensusSummary(context.debateRounds),
    agreedPoints: extractAgreedPoints(context.debateRounds),
    disagreements: extractDisagreements(context.debateRounds),
    keyInsights: deduplicateInsights(allInsights),
    recommendations: synthesizeRecommendations(allRecommendations),
    riskAssessment: synthesizeRisks(riskFactors),
    confidence: calculateOverallConfidence(context.debateRounds),
  };
  
  return consensus;
});

// Step 6: Final Recommendation
debateWorkflow.step('final-recommendation', async ({ input, context, logger }) => {
  logger.info('Generating final recommendation');
  
  // Store analysis in memory for future reference
  await memory.store({
    userId: input.userId,
    category: 'analysis',
    data: {
      query: input.query,
      consensus: context,
      timestamp: new Date().toISOString(),
    },
  });
  
  // Generate narrative report
  const narrativeReport = await generateNarrativeReport({
    query: input.query,
    consensus: context,
    assistantType: input.assistantType,
    symbols: input.symbols,
  });
  
  return {
    query: input.query,
    assistantType: input.assistantType,
    symbols: input.symbols,
    consensus: context,
    narrative: narrativeReport,
    timestamp: new Date().toISOString(),
    participantAgents: context.participants,
    debateRounds: context.debateRounds.length,
  };
});

// Helper functions
async function generateAgentResponse(params: any) {
  // Simulate agent response generation
  return {
    analysis: params.ownAnalysis,
    agreement: [],
    disagreement: [],
    newInsights: [],
    recommendations: [],
    risks: [],
  };
}

function calculateConsensus(responses: any[]): number {
  // Calculate consensus level between agents
  let agreementCount = 0;
  let totalComparisons = 0;
  
  for (let i = 0; i < responses.length; i++) {
    for (let j = i + 1; j < responses.length; j++) {
      totalComparisons++;
      if (responses[i].agreement.some((a: any) => 
        responses[j].agreement.includes(a))) {
        agreementCount++;
      }
    }
  }
  
  return totalComparisons > 0 ? agreementCount / totalComparisons : 0;
}

function buildConsensus(responses: any[]) {
  return {
    reached: true,
    level: calculateConsensus(responses),
    mainPoints: responses.flatMap(r => r.agreement),
  };
}

function generateConsensusSummary(debateRounds: any[]): string {
  // Generate a summary of the consensus
  const lastRound = debateRounds[debateRounds.length - 1];
  const agreements = lastRound.responses.flatMap((r: any) => r.agreement);
  return `After ${debateRounds.length} rounds of debate, agents reached consensus on ${agreements.length} key points.`;
}

function extractAgreedPoints(debateRounds: any[]): string[] {
  // Extract points all agents agreed on
  const allAgreements = new Set<string>();
  for (const round of debateRounds) {
    for (const response of round.responses) {
      response.agreement.forEach((a: string) => allAgreements.add(a));
    }
  }
  return Array.from(allAgreements);
}

function extractDisagreements(debateRounds: any[]): any[] {
  // Extract points of disagreement
  const disagreements = [];
  for (const round of debateRounds) {
    for (const response of round.responses) {
      if (response.disagreement.length > 0) {
        disagreements.push({
          agent: response.agent,
          points: response.disagreement,
        });
      }
    }
  }
  return disagreements;
}

function deduplicateInsights(insights: any[]): any[] {
  // Remove duplicate insights
  const unique = new Map();
  for (const insight of insights) {
    const key = JSON.stringify(insight);
    if (!unique.has(key)) {
      unique.set(key, insight);
    }
  }
  return Array.from(unique.values());
}

function synthesizeRecommendations(recommendations: any[]): any {
  // Synthesize recommendations from all agents
  return {
    primary: recommendations.filter(r => r.priority === 'high'),
    secondary: recommendations.filter(r => r.priority === 'medium'),
    considerations: recommendations.filter(r => r.priority === 'low'),
  };
}

function synthesizeRisks(riskFactors: any[]): any {
  // Synthesize risk assessment
  return {
    high: riskFactors.filter(r => r.level === 'high'),
    medium: riskFactors.filter(r => r.level === 'medium'),
    low: riskFactors.filter(r => r.level === 'low'),
  };
}

function calculateOverallConfidence(debateRounds: any[]): number {
  // Calculate overall confidence level
  let totalConfidence = 0;
  let count = 0;
  
  for (const round of debateRounds) {
    for (const response of round.responses) {
      if (response.confidence) {
        totalConfidence += response.confidence;
        count++;
      }
    }
  }
  
  return count > 0 ? totalConfidence / count : 0.5;
}

async function generateNarrativeReport(params: any): Promise<string> {
  // Generate a narrative report from the consensus
  const { query, consensus, assistantType, symbols } = params;
  
  let report = `## Financial Analysis Report\n\n`;
  report += `**Query:** ${query}\n`;
  report += `**Assistant Type:** ${assistantType}\n`;
  
  if (symbols && symbols.length > 0) {
    report += `**Symbols Analyzed:** ${symbols.join(', ')}\n`;
  }
  
  report += `\n### Executive Summary\n${consensus.summary}\n`;
  
  report += `\n### Key Insights\n`;
  for (const insight of consensus.keyInsights.slice(0, 5)) {
    report += `- ${insight}\n`;
  }
  
  report += `\n### Recommendations\n`;
  if (consensus.recommendations.primary.length > 0) {
    report += `**Primary:**\n`;
    for (const rec of consensus.recommendations.primary) {
      report += `- ${rec}\n`;
    }
  }
  
  report += `\n### Risk Assessment\n`;
  report += `Overall Confidence: ${(consensus.confidence * 100).toFixed(1)}%\n`;
  
  return report;
}

export default debateWorkflow;