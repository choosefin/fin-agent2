import type { EventRouteConfig, Handlers } from 'motia'
import { z } from 'zod'

export const config: EventRouteConfig = {
  type: 'event',
  name: 'WorkflowWebSocketRelay',
  subscribes: [
    'workflow.started',
    'workflow.agent.started',
    'workflow.agent.progress',
    'workflow.agent.completed',
    'workflow.completed',
    'workflow.error',
  ],
  input: z.object({
    workflowId: z.string(),
    userId: z.string().optional(),
    streamId: z.string().optional(), // WebSocket stream ID
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
  }),
}

export const handler: Handlers['WorkflowWebSocketRelay'] = async (event, { logger, streams }) => {
  const { workflowId, streamId, type, ...eventData } = event

  try {
    // If we have a specific stream ID, send to that stream
    if (streamId && streams[streamId]) {
      logger.info('Relaying workflow event to WebSocket stream', { 
        workflowId, 
        streamId, 
        eventType: type 
      })

      // Send the workflow update to the specific WebSocket connection
      await streams[streamId].send({
        type: 'workflow_update',
        workflowId,
        eventType: type,
        ...eventData,
        timestamp: eventData.timestamp || new Date().toISOString(),
      })
    } else {
      // Broadcast to all connected streams that are subscribed to this workflow
      // This would require a more sophisticated subscription mechanism
      logger.debug('No specific stream ID provided for workflow event', { workflowId })
      
      // In a real implementation, you'd maintain a mapping of workflowId to streamIds
      // For now, we'll rely on the streamId being passed through the event chain
    }
  } catch (error) {
    logger.error('Error relaying workflow event to WebSocket', {
      error: error instanceof Error ? error.message : 'Unknown error',
      workflowId,
      streamId,
    })
  }
}