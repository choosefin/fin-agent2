import type { EventRouteConfig, Handlers } from 'motia'
import { z } from 'zod'

export const config: EventRouteConfig = {
  type: 'event',
  name: 'WorkflowWSRelay',
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
    streamKey: z.string().optional(), // WebSocket stream key
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
  emits: [],
}

export const handler: Handlers['WorkflowWSRelay'] = async (event, { logger, streams }) => {
  const { workflowId, streamKey, type, ...eventData } = event

  try {
    // Check if streams are available
    if (!streams) {
      logger.warn('Streams context not available for workflow relay')
      return
    }

    // Determine which stream to use
    const targetStreamKey = streamKey || `workflow-${workflowId}`

    logger.info('Relaying workflow event to WebSocket stream', { 
      workflowId, 
      streamKey: targetStreamKey, 
      eventType: type 
    })

    // Send the workflow update to the WebSocket stream
    await streams.set(targetStreamKey, {
      type: 'workflow_update',
      workflowId,
      eventType: type,
      ...eventData,
      timestamp: eventData.timestamp || new Date().toISOString(),
    })

    // Also broadcast to a general workflow stream for monitoring
    if (streams.workflow) {
      await streams.workflow.set({
        type: 'workflow_update',
        workflowId,
        eventType: type,
        ...eventData,
        timestamp: eventData.timestamp || new Date().toISOString(),
      })
    }

  } catch (error) {
    logger.error('Error relaying workflow event to WebSocket', {
      error: error instanceof Error ? error.message : 'Unknown error',
      workflowId,
      streamKey,
    })
  }
}