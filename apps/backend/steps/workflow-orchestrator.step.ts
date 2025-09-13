import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from 'motia';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'WorkflowOrchestrator',
  method: 'POST',
  path: '/api/workflow/trigger',
  bodySchema: z.object({
    message: z.string(),
    userId: z.string(),
    context: z.object({
      symbols: z.array(z.string()).optional(),
      timeframe: z.string().optional(),
      riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
    }).optional(),
  }),
  emits: ['workflow.started', 'workflow.agent.started', 'workflow.agent.completed', 'workflow.completed'],
};

// Workflow definitions with trigger patterns
const workflows = {
  portfolioAnalysis: {
    name: 'Portfolio Analysis',
    description: 'Comprehensive portfolio review with multiple agent perspectives',
    triggers: [
      'analyze my portfolio',
      'review my investments',
      'portfolio performance',
      'how are my investments doing',
      'portfolio health check',
    ],
    agents: ['analyst', 'riskManager', 'advisor'],
    steps: [
      { agent: 'analyst', task: 'Analyze portfolio composition and performance metrics' },
      { agent: 'riskManager', task: 'Assess portfolio risks and correlations' },
      { agent: 'advisor', task: 'Provide recommendations for portfolio optimization' },
    ],
  },
  marketOpportunity: {
    name: 'Market Opportunity Scanner',
    description: 'Identify trading opportunities across markets',
    triggers: [
      'find trading opportunities',
      'what should i buy',
      'market opportunities',
      'best stocks to trade',
      'trading ideas',
    ],
    agents: ['trader', 'analyst', 'economist'],
    steps: [
      { agent: 'economist', task: 'Analyze current market conditions and trends' },
      { agent: 'analyst', task: 'Screen for undervalued or momentum stocks' },
      { agent: 'trader', task: 'Identify specific entry points and trading setups' },
    ],
  },
  riskAssessment: {
    name: 'Risk Assessment',
    description: 'Comprehensive risk analysis and mitigation strategies',
    triggers: [
      'assess my risk',
      'portfolio risk',
      'am i too exposed',
      'hedge my portfolio',
      'protect my investments',
    ],
    agents: ['riskManager', 'economist', 'advisor'],
    steps: [
      { agent: 'riskManager', task: 'Calculate portfolio risk metrics and stress tests' },
      { agent: 'economist', task: 'Identify macro risks and market conditions' },
      { agent: 'advisor', task: 'Recommend hedging strategies and adjustments' },
    ],
  },
  investmentResearch: {
    name: 'Investment Research',
    description: 'Deep dive research on specific investments',
    triggers: [
      'research',
      'tell me about',
      'should i invest in',
      'analyze this stock',
      'deep dive',
    ],
    agents: ['analyst', 'economist', 'trader'],
    steps: [
      { agent: 'analyst', task: 'Perform fundamental analysis and valuation' },
      { agent: 'economist', task: 'Analyze sector and macro factors' },
      { agent: 'trader', task: 'Assess technical setup and timing' },
    ],
  },
  marketDebate: {
    name: 'Market Debate',
    description: 'Multi-perspective debate on market direction',
    triggers: [
      'market debate',
      'bull vs bear',
      'market outlook',
      'where is the market heading',
      'recession coming',
    ],
    agents: ['economist', 'trader', 'analyst', 'riskManager'],
    steps: [
      { agent: 'economist', task: 'Present macro economic view' },
      { agent: 'trader', task: 'Share technical and sentiment analysis' },
      { agent: 'analyst', task: 'Provide fundamental market valuation' },
      { agent: 'riskManager', task: 'Assess systemic risks and tail events' },
    ],
  },
};

// Function to detect workflow from user message
function detectWorkflow(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  for (const [workflowId, workflow] of Object.entries(workflows)) {
    for (const trigger of workflow.triggers) {
      if (lowerMessage.includes(trigger)) {
        return workflowId;
      }
    }
  }
  
  // Check for explicit workflow requests
  if (lowerMessage.includes('workflow') || lowerMessage.includes('multi-agent')) {
    // Default to portfolio analysis for generic requests
    return 'portfolioAnalysis';
  }
  
  return null;
}

export const handler: Handlers['WorkflowOrchestrator'] = async (req, { logger, emit, state, traceId }) => {
  try {
    const { message, userId, context } = req.body;
    
    logger.info('Processing workflow trigger request', { 
      message: message.substring(0, 50) + '...',
      userId,
      traceId 
    });

    // Detect which workflow to trigger
    const workflowId = detectWorkflow(message);
    
    if (!workflowId) {
      return {
        status: 200,
        body: {
          triggered: false,
          message: 'No workflow detected. Processing as regular chat.',
          suggestions: Object.entries(workflows).map(([id, w]) => ({
            id,
            name: w.name,
            description: w.description,
            samplePrompts: w.triggers.slice(0, 2),
          })),
        },
      };
    }

    const workflow = workflows[workflowId as keyof typeof workflows];
    const workflowInstanceId = `${workflowId}-${traceId}`;

    // Store workflow state
    await state.set('workflows', workflowInstanceId, {
      id: workflowInstanceId,
      workflowId,
      status: 'started',
      userId,
      message,
      context,
      agents: workflow.agents,
      steps: workflow.steps,
      startedAt: new Date().toISOString(),
      currentStep: 0,
      results: [],
    });

    // Emit workflow started event
    await emit({
      topic: 'workflow.started',
      data: {
        type: 'workflow.started',
        workflowId: workflowInstanceId,
        userId,
        name: workflow.name,
        agents: workflow.agents,
        steps: workflow.steps,
        message,
      },
    });

    // Start the first agent only (sequential processing)
    if (workflow.steps.length > 0) {
      const firstStep = workflow.steps[0];
      
      // Emit first agent started event
      await emit({
        topic: 'workflow.agent.started',
        data: {
          workflowId: workflowInstanceId,
          stepIndex: 0,
          agent: firstStep.agent,
          task: firstStep.task,
        },
      });

      // Update workflow state for first step
      await state.set('workflows', `${workflowInstanceId}:step:0`, {
        agent: firstStep.agent,
        task: firstStep.task,
        status: 'processing',
        startedAt: new Date().toISOString(),
      });
    }

    return {
      status: 200,
      body: {
        triggered: true,
        workflowId: workflowInstanceId,
        workflow: {
          name: workflow.name,
          description: workflow.description,
          agents: workflow.agents,
          steps: workflow.steps,
        },
        message: `Workflow "${workflow.name}" initiated with ${workflow.agents.length} agents`,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Workflow orchestration failed', { 
      error: errorMessage,
      traceId 
    });
    
    return {
      status: 500,
      body: {
        error: 'Failed to orchestrate workflow',
        message: errorMessage,
      },
    };
  }
};