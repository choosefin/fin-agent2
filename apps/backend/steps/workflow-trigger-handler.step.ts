import { z } from 'zod';
import type { EventConfig, Handlers } from 'motia';

const inputSchema = z.object({
  workflowId: z.string(),
  userId: z.string(),
  message: z.string(),
  context: z.object({
    symbols: z.array(z.string()).optional(),
    timeframe: z.string().optional(),
    riskTolerance: z.string().optional(),
  }).optional(),
  agents: z.array(z.string()),
});

export const config: EventConfig = {
  type: 'event',
  name: 'WorkflowTriggerHandler',
  subscribes: ['workflow.trigger'],
  emits: ['workflow.started', 'workflow.agent.started'],
  input: inputSchema,
};

// Workflow definitions
const workflowSteps = {
  analyst: 'Analyze market data and financial metrics',
  trader: 'Identify trading opportunities and entry/exit points',
  advisor: 'Provide personalized investment recommendations',
  riskManager: 'Assess portfolio risks and suggest hedging strategies',
  economist: 'Analyze macroeconomic trends and impacts',
};

export const handler: Handlers['WorkflowTriggerHandler'] = async (input, { logger, emit, state }) => {
  const { workflowId, userId, message, agents, context } = input;
  
  logger.info('Handling workflow trigger', { 
    workflowId, 
    userId, 
    agents,
    message: message.substring(0, 50) + '...' 
  });

  try {
    // Store workflow state
    await state.set('workflows', workflowId, {
      id: workflowId,
      status: 'started',
      userId,
      message,
      context,
      agents,
      startedAt: new Date().toISOString(),
      currentStep: 0,
      results: [],
    });

    // Log workflow started
    logger.info('Workflow started', {
      workflowId,
      agents,
      totalSteps: agents.length,
      message: 'Starting multi-agent analysis...',
    });

    // Emit workflow started event
    await emit({
      topic: 'workflow.started',
      data: {
        type: 'workflow.started',
        workflowId,
        userId,
        agents,
        message,
        timestamp: new Date().toISOString(),
      },
    });

    // Start the first agent
    if (agents.length > 0) {
      const firstAgent = agents[0];
      const task = workflowSteps[firstAgent as keyof typeof workflowSteps] || 'Process request';
      
      logger.info('Starting first agent', { 
        workflowId, 
        agent: firstAgent,
        task 
      });

      // Log agent starting
      logger.info('Agent starting', {
        workflowId,
        agent: firstAgent,
        task,
        stepIndex: 0,
        totalSteps: agents.length,
      });

      // Emit agent started event (this triggers the agent-executor)
      await emit({
        topic: 'workflow.agent.started',
        data: {
          workflowId,
          stepIndex: 0,
          agent: firstAgent,
          task,
        },
      });

      // Store step state
      await state.set('workflows', `${workflowId}:step:0`, {
        agent: firstAgent,
        task,
        status: 'processing',
        startedAt: new Date().toISOString(),
      });
    } else {
      // No agents, complete immediately
      logger.warn('No agents specified for workflow', { workflowId });
      
      logger.warn('Workflow completed with no agents', {
        workflowId,
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to handle workflow trigger', {
      error: errorMessage,
      workflowId,
      userId,
    });

    // Log error
    logger.error('Workflow error', {
      workflowId,
      error: errorMessage,
      message: 'Failed to start workflow',
    });

    throw error;
  }
};