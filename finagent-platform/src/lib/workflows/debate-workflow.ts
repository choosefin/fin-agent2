// Multi-Agent Debate Workflow for Mastra
import { Workflow, Step } from '@mastra/core';
import { z } from 'zod';
import { 
  createFinancialAgent, 
  AgentType,
  FinancialAnalyst,
  TradingAssistant,
  RiskManager,
  MacroEconomist,
  InvestmentAdvisor
} from '../agents/financial-agents';
import { supabase } from '../db/supabase';

// Debate configuration schema
const DebateConfigSchema = z.object({
  query: z.string(),
  assistantType: z.nativeEnum(AgentType),
  symbols: z.array(z.string()).optional(),
  userId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  maxRounds: z.number().default(3),
  requireConsensus: z.boolean().default(true),
});

export type DebateConfig = z.infer<typeof DebateConfigSchema>;

// Debate participant schema
interface DebateParticipant {
  agent: any;
  agentType: AgentType;
  confidence: number;
  position: string;
  evidence: any[];
}

// Debate round result
interface DebateRound {
  roundNumber: number;
  statements: Map<AgentType, {
    statement: string;
    confidence: number;
    evidence: any;
  }>;
  consensus?: string;
  disagreements?: string[];
}

// Create the multi-agent debate workflow
export class FinancialDebateWorkflow extends Workflow {
  constructor() {
    super({
      name: 'financial-analysis-debate',
      description: 'Multi-agent debate for comprehensive financial analysis',
    });
  }

  /**
   * Execute the debate workflow
   */
  async execute(config: DebateConfig): Promise<any> {
    const validatedConfig = DebateConfigSchema.parse(config);
    
    // Track execution in database
    const executionId = await this.createExecution(validatedConfig);
    
    try {
      // Step 1: Parallel data gathering
      const marketData = await this.gatherMarketData(validatedConfig.symbols || []);
      
      // Step 2: Select debate participants based on query type
      const participants = this.selectParticipants(validatedConfig);
      
      // Step 3: Initial analysis from each agent
      const initialAnalysis = await this.performInitialAnalysis(
        participants,
        validatedConfig.query,
        marketData
      );
      
      // Step 4: Multi-round debate
      const debateResults = await this.conductDebate(
        participants,
        initialAnalysis,
        validatedConfig.maxRounds,
        executionId
      );
      
      // Step 5: Build consensus or present disagreements
      const finalResult = await this.buildConsensus(
        debateResults,
        validatedConfig.requireConsensus
      );
      
      // Step 6: Generate final recommendation
      const recommendation = await this.generateRecommendation(
        finalResult,
        validatedConfig.query
      );
      
      // Update execution status
      await this.updateExecution(executionId, 'completed', recommendation);
      
      return {
        success: true,
        executionId,
        recommendation,
        debate: debateResults,
        consensus: finalResult.consensus,
        confidence: finalResult.averageConfidence,
      };
    } catch (error) {
      await this.updateExecution(executionId, 'failed', null, error);
      throw error;
    }
  }

  /**
   * Select appropriate agents for the debate based on query
   */
  private selectParticipants(config: DebateConfig): DebateParticipant[] {
    const participants: DebateParticipant[] = [];
    const { query, assistantType } = config;
    
    // Always include the primary assistant
    participants.push({
      agent: createFinancialAgent(assistantType),
      agentType: assistantType,
      confidence: 1.0,
      position: '',
      evidence: [],
    });
    
    // Add relevant specialists based on query content
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('risk') || queryLower.includes('hedge')) {
      participants.push({
        agent: new RiskManager(),
        agentType: AgentType.RISK_MANAGER,
        confidence: 1.0,
        position: '',
        evidence: [],
      });
    }
    
    if (queryLower.includes('trade') || queryLower.includes('buy') || queryLower.includes('sell')) {
      participants.push({
        agent: new TradingAssistant(),
        agentType: AgentType.TRADER,
        confidence: 1.0,
        position: '',
        evidence: [],
      });
    }
    
    if (queryLower.includes('economy') || queryLower.includes('inflation') || queryLower.includes('fed')) {
      participants.push({
        agent: new MacroEconomist(),
        agentType: AgentType.ECONOMIST,
        confidence: 1.0,
        position: '',
        evidence: [],
      });
    }
    
    if (queryLower.includes('portfolio') || queryLower.includes('allocation') || queryLower.includes('diversif')) {
      participants.push({
        agent: new InvestmentAdvisor(),
        agentType: AgentType.ADVISOR,
        confidence: 1.0,
        position: '',
        evidence: [],
      });
    }
    
    // Add analyst for any symbol-specific queries
    if (config.symbols && config.symbols.length > 0 && !participants.some(p => p.agentType === AgentType.ANALYST)) {
      participants.push({
        agent: new FinancialAnalyst(),
        agentType: AgentType.ANALYST,
        confidence: 1.0,
        position: '',
        evidence: [],
      });
    }
    
    return participants;
  }

  /**
   * Perform initial analysis with all participants
   */
  private async performInitialAnalysis(
    participants: DebateParticipant[],
    query: string,
    marketData: any
  ): Promise<Map<AgentType, any>> {
    const analyses = new Map<AgentType, any>();
    
    // Parallel analysis from all agents
    const results = await Promise.all(
      participants.map(async (participant) => {
        const context = `Given the following market data: ${JSON.stringify(marketData)}
        
        Please analyze: ${query}
        
        Provide your analysis with:
        1. Your main position/recommendation
        2. Supporting evidence and data
        3. Confidence level (0-1)
        4. Key risks or concerns`;
        
        const analysis = await participant.agent.generate(context);
        return { type: participant.agentType, analysis };
      })
    );
    
    results.forEach(({ type, analysis }) => {
      analyses.set(type, analysis);
    });
    
    return analyses;
  }

  /**
   * Conduct multi-round debate between agents
   */
  private async conductDebate(
    participants: DebateParticipant[],
    initialAnalysis: Map<AgentType, any>,
    maxRounds: number,
    executionId: string
  ): Promise<DebateRound[]> {
    const rounds: DebateRound[] = [];
    
    for (let round = 1; round <= maxRounds; round++) {
      const roundStatements = new Map<AgentType, any>();
      
      // Each agent responds to others' positions
      for (const participant of participants) {
        const otherPositions = Array.from(initialAnalysis.entries())
          .filter(([type]) => type !== participant.agentType)
          .map(([type, analysis]) => `${type}: ${analysis}`);
        
        const debatePrompt = `Round ${round} of debate.
        
        Your initial position: ${initialAnalysis.get(participant.agentType)}
        
        Other agents' positions:
        ${otherPositions.join('\n\n')}
        
        Please:
        1. Respond to other agents' arguments
        2. Strengthen your position with additional evidence
        3. Identify areas of agreement and disagreement
        4. Adjust your confidence level if needed`;
        
        const response = await participant.agent.generate(debatePrompt);
        
        roundStatements.set(participant.agentType, {
          statement: response,
          confidence: this.extractConfidence(response),
          evidence: this.extractEvidence(response),
        });
        
        // Save to database
        await this.saveDebateRound(executionId, round, participant.agentType, response);
      }
      
      rounds.push({
        roundNumber: round,
        statements: roundStatements,
      });
      
      // Check for early consensus
      if (this.hasReachedConsensus(roundStatements)) {
        break;
      }
    }
    
    return rounds;
  }

  /**
   * Build consensus from debate results
   */
  private async buildConsensus(
    debateResults: DebateRound[],
    requireConsensus: boolean
  ): Promise<any> {
    const lastRound = debateResults[debateResults.length - 1];
    const statements = Array.from(lastRound.statements.values());
    
    // Calculate average confidence
    const averageConfidence = statements.reduce((sum, s) => sum + s.confidence, 0) / statements.length;
    
    // Identify common themes
    const commonThemes = this.identifyCommonThemes(statements);
    
    // Identify disagreements
    const disagreements = this.identifyDisagreements(statements);
    
    if (requireConsensus && disagreements.length > 0) {
      // Attempt to synthesize a middle ground
      const synthesis = await this.synthesizePositions(statements);
      return {
        consensus: synthesis,
        averageConfidence,
        commonThemes,
        disagreements,
      };
    }
    
    return {
      consensus: commonThemes.join(' '),
      averageConfidence,
      commonThemes,
      disagreements,
    };
  }

  /**
   * Generate final recommendation
   */
  private async generateRecommendation(
    consensusResult: any,
    originalQuery: string
  ): Promise<any> {
    const recommendation = {
      summary: consensusResult.consensus,
      confidence: consensusResult.averageConfidence,
      keyPoints: consensusResult.commonThemes,
      considerations: consensusResult.disagreements,
      actionItems: this.extractActionItems(consensusResult.consensus),
      timeframe: this.determineTimeframe(originalQuery),
    };
    
    return recommendation;
  }

  /**
   * Gather market data for analysis
   */
  private async gatherMarketData(symbols: string[]): Promise<any> {
    if (symbols.length === 0) return {};
    
    const marketData: any = {};
    
    for (const symbol of symbols) {
      // Fetch from database or external API
      const { data: priceData } = await supabase
        .from('price_history')
        .select('*')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(30);
      
      const { data: sentimentData } = await supabase
        .from('sentiment_data')
        .select('*')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(10);
      
      marketData[symbol] = {
        prices: priceData,
        sentiment: sentimentData,
      };
    }
    
    return marketData;
  }

  /**
   * Helper methods
   */
  private extractConfidence(response: string): number {
    const match = response.match(/confidence:?\s*([\d.]+)/i);
    return match ? parseFloat(match[1]) : 0.7;
  }

  private extractEvidence(response: string): any[] {
    // Extract bullet points or numbered items as evidence
    const evidence = [];
    const lines = response.split('\n');
    for (const line of lines) {
      if (line.match(/^[\-\*•]\s/) || line.match(/^\d+\.\s/)) {
        evidence.push(line.trim());
      }
    }
    return evidence;
  }

  private hasReachedConsensus(statements: Map<AgentType, any>): boolean {
    const confidences = Array.from(statements.values()).map(s => s.confidence);
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    return avgConfidence > 0.8;
  }

  private identifyCommonThemes(statements: any[]): string[] {
    // Simple implementation - in production, use NLP
    const themes = [];
    const allText = statements.map(s => s.statement).join(' ').toLowerCase();
    
    if (allText.includes('bullish') || allText.includes('positive')) {
      themes.push('Positive outlook identified');
    }
    if (allText.includes('bearish') || allText.includes('concern')) {
      themes.push('Concerns raised about risks');
    }
    if (allText.includes('volatility')) {
      themes.push('Volatility considerations noted');
    }
    
    return themes;
  }

  private identifyDisagreements(statements: any[]): string[] {
    const disagreements = [];
    // Simplified - in production, use semantic analysis
    const positions = statements.map(s => {
      if (s.statement.includes('buy') || s.statement.includes('bullish')) return 'bullish';
      if (s.statement.includes('sell') || s.statement.includes('bearish')) return 'bearish';
      return 'neutral';
    });
    
    if (new Set(positions).size > 1) {
      disagreements.push('Agents disagree on market direction');
    }
    
    return disagreements;
  }

  private async synthesizePositions(statements: any[]): Promise<string> {
    // Use a general agent to synthesize different viewpoints
    const synthesisAgent = createFinancialAgent(AgentType.GENERAL);
    const prompt = `Synthesize the following different viewpoints into a balanced recommendation:
    ${statements.map(s => s.statement).join('\n\n')}`;
    
    return synthesisAgent.generate(prompt);
  }

  private extractActionItems(consensus: string): string[] {
    const actionItems = [];
    const lines = consensus.split('\n');
    for (const line of lines) {
      if (line.includes('recommend') || line.includes('suggest') || line.includes('should')) {
        actionItems.push(line.trim());
      }
    }
    return actionItems;
  }

  private determineTimeframe(query: string): string {
    const queryLower = query.toLowerCase();
    if (queryLower.includes('day') || queryLower.includes('today')) return 'short-term';
    if (queryLower.includes('week')) return 'medium-term';
    if (queryLower.includes('month') || queryLower.includes('year')) return 'long-term';
    return 'medium-term';
  }

  /**
   * Database operations
   */
  private async createExecution(config: DebateConfig): Promise<string> {
    const { data, error } = await supabase
      .from('agent_executions')
      .insert({
        user_id: config.userId,
        session_id: config.sessionId,
        query: config.query,
        agent_name: 'DebateWorkflow',
        agent_type: config.assistantType,
        status: 'running',
      })
      .select('id')
      .single();
    
    if (error) throw error;
    return data.id;
  }

  private async updateExecution(
    executionId: string, 
    status: string, 
    result: any, 
    error?: any
  ): Promise<void> {
    await supabase
      .from('agent_executions')
      .update({
        status,
        result,
        error_message: error?.message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', executionId);
  }

  private async saveDebateRound(
    executionId: string,
    round: number,
    agentType: string,
    statement: string
  ): Promise<void> {
    await supabase
      .from('agent_debates')
      .insert({
        execution_id: executionId,
        round_number: round,
        participant_agent: agentType,
        statement,
        confidence_score: this.extractConfidence(statement),
      });
  }
}