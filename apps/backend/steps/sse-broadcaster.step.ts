import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';
import { sseManager } from '../services/sse-manager.service';

// Since SSE broadcaster handles multiple event types with different schemas,
// we need a permissive schema that can accept all workflow event shapes
const workflowEventSchema = z.object({
  // Common fields
  workflowId: z.string().optional(),
  userId: z.string().optional(),
  type: z.string().optional(),
  
  // Agent-specific fields (for workflow.agent.started/completed/progress)
  stepIndex: z.number().optional(),
  agent: z.string().optional(),
  task: z.string().optional(),
  
  // Other potential fields
  data: z.any().optional(),
  results: z.any().optional(),
  message: z.string().optional(),
  progress: z.number().optional(),
  error: z.string().optional(),
  timestamp: z.string().optional(),
}).passthrough() // Allow any additional fields

export const config: EventConfig = {
  type: 'event',
  name: 'SSEBroadcaster',
  subscribes: [
    'workflow.started',
    // Don't subscribe to workflow.agent.started - AgentExecutor handles that
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