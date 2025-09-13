import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';

// Flexible schema to handle all workflow event types
const workflowEventSchema = z.object({
  workflowId: z.string().optional(),
  userId: z.string().optional(),
  type: z.string().optional(),
  stepIndex: z.number().optional(),
  agent: z.string().optional(),
  task: z.string().optional(),
  data: z.any().optional(),
  results: z.any().optional(),
  message: z.string().optional(),
  progress: z.number().optional(),
  error: z.string().optional(),
  timestamp: z.string().optional(),
}).passthrough();

export const config: EventConfig = {
  type: 'event',
  name: 'WorkflowStreamBroadcaster',
  subscribes: [
    'workflow.started',
    'workflow.agent.progress',
    'workflow.agent.completed',
    'workflow.completed',
  ],
  emits: [],
  input: workflowEventSchema,
};

export const handler: Handlers['WorkflowStreamBroadcaster'] = async (input, { logger, streams, traceId }) => {
  try {
    const { workflowId, userId, type, ...eventData } = input;
    
    // Determine event type
    const eventType = type || 'workflow.update';
    
    // Create stream message
    const streamMessage = {
      type: eventType,
      workflowId,
      userId,
      timestamp: new Date().toISOString(),
      ...eventData,
    };
    
    logger.info('Broadcasting workflow event via stream', {
      type: eventType,
      workflowId,
      userId,
      traceId,
    });
    
    // Use Motia's native streaming to broadcast updates
    // Streams are available at ws://localhost:3000/streams/<workflow-id>
    if (streams && workflowId) {
      const streamKey = `workflow-${workflowId}`;
      
      // Set the data to the specific workflow stream
      await streams.set(streamKey, streamMessage);
      
      // Also broadcast to a general workflow stream for monitoring
      await streams.set('workflow-updates', streamMessage);
    }
    
    logger.debug('Stream broadcast complete', {
      workflowId,
      eventType,
      traceId,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to broadcast workflow event', {
      error: errorMessage,
      input,
      traceId,
    });
  }
};