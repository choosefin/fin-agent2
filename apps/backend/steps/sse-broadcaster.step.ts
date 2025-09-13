import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';
import { sseManager } from '../services/sse-manager.service';

// Generic workflow event schema - flexible to handle all event types
const workflowEventSchema = z.object({
  workflowId: z.string().optional(),
  userId: z.string().optional(), 
  type: z.string().optional(),
}).passthrough(); // Allow any additional fields

export const config: EventConfig = {
  type: 'event',
  name: 'SSEBroadcaster',
  subscribes: [
    'workflow.started',
    'workflow.agent.started', 
    'workflow.agent.progress',
    'workflow.agent.completed',
    'workflow.completed',
  ],
  emits: [],
  input: workflowEventSchema,
};

export const handler: Handlers['SSEBroadcaster'] = async (input, { logger, traceId }) => {
  try {
    const { workflowId, userId, ...eventData } = input;
    
    // Determine event type from the topic
    const eventType = eventData.type || 'workflow.update';
    
    // Create SSE message
    const sseMessage = {
      type: eventType,
      workflowId,
      timestamp: new Date().toISOString(),
      ...eventData,
    };
    
    logger.info('Broadcasting SSE event', {
      type: eventType,
      workflowId,
      userId,
      traceId,
    });
    
    // Send to specific user if userId is provided
    if (userId && workflowId) {
      sseManager.sendWorkflowEvent(workflowId, userId, sseMessage);
    } else if (userId) {
      // If we have userId but no workflowId, still send to user
      sseManager.sendWorkflowEvent('unknown', userId, sseMessage);
    } else {
      // Broadcast to all clients if no specific user
      sseManager.broadcast(sseMessage);
    }
    
    // Log metrics
    logger.info('SSE broadcast metrics', {
      connectedClients: sseManager.getClientCount(),
      queuedMessages: sseManager.getQueueSize(),
      traceId,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to broadcast SSE event', {
      error: errorMessage,
      input,
      traceId,
    });
  }
};