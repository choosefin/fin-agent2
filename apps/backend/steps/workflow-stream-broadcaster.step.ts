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

export const handler: Handlers['WorkflowStreamBroadcaster'] = async (input, { logger, state, traceId }) => {
  try {
    const { workflowId, userId, type, ...eventData } = input;
    
    // Determine event type
    const eventType = type || 'workflow.update';
    
    // Create event message
    const eventMessage = {
      type: eventType,
      workflowId,
      userId,
      timestamp: new Date().toISOString(),
      ...eventData,
    };
    
    logger.info('Processing workflow event', {
      type: eventType,
      workflowId,
      userId,
      traceId,
    });
    
    // Store workflow events for polling
    // Since Motia doesn't support streaming, we store events for the UI to poll
    if (workflowId) {
      // Get existing events or initialize
      const existingEvents = await state.get('workflow-events', workflowId) || [];
      
      // Add new event
      const updatedEvents = [...existingEvents, eventMessage];
      
      // Store updated events (keep last 100 events)
      await state.set('workflow-events', workflowId, updatedEvents.slice(-100));
      
      // Update workflow status based on event type
      if (eventType === 'workflow.completed') {
        const workflow = await state.get('workflows', workflowId);
        if (workflow) {
          await state.set('workflows', workflowId, {
            ...workflow,
            status: 'completed',
            completedAt: new Date().toISOString(),
          });
        }
      }
    }
    
    logger.debug('Workflow event stored', {
      workflowId,
      eventType,
      traceId,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to process workflow event', {
      error: errorMessage,
      input,
      traceId,
    });
  }
};