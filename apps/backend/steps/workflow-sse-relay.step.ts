import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';
import { sseManager } from '../services/sse-manager.service';

// This step relays workflow.agent.started events to SSE clients
// It subscribes with the same schema as AgentExecutor expects
const inputSchema = z.object({
  workflowId: z.string(),
  stepIndex: z.number(),
  agent: z.string(),
  task: z.string(),
});

export const config: EventConfig = {
  type: 'event',
  name: 'WorkflowSSERelay',
  subscribes: ['workflow.agent.started'],
  emits: [],
  input: inputSchema,
};

export const handler: Handlers['WorkflowSSERelay'] = async (input, { logger, state, traceId }) => {
  try {
    const { workflowId, stepIndex, agent, task } = input;
    
    // Get workflow to find userId
    const workflow: any = await state.get('workflows', workflowId);
    const userId = workflow?.userId;
    
    // Create SSE message for agent started
    const sseMessage = {
      type: 'workflow.agent.started',
      workflowId,
      agent,
      task,
      stepIndex,
      timestamp: new Date().toISOString(),
    };
    
    logger.info('Relaying workflow.agent.started to SSE', {
      workflowId,
      agent,
      userId,
      traceId,
    });
    
    // Send to specific user if userId is available
    if (userId) {
      sseManager.sendWorkflowEvent(workflowId, userId, sseMessage);
    } else {
      // Broadcast if no specific user
      sseManager.broadcast(sseMessage);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to relay workflow.agent.started', {
      error: errorMessage,
      input,
      traceId,
    });
  }
};