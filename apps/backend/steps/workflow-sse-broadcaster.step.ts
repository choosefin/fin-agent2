import type { EventRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { sendWorkflowUpdate } from './chat-stream.step'

export const config: EventRouteConfig = {
  type: 'event',
  name: 'WorkflowSSEBroadcaster',
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

export const handler: Handlers['WorkflowSSEBroadcaster'] = async (event, { logger }) => {
  const { workflowId, type, ...eventData } = event

  try {
    logger.info('Broadcasting workflow event to SSE stream', { 
      workflowId, 
      eventType: type 
    })

    // Send the workflow update to the SSE stream
    sendWorkflowUpdate(workflowId, {
      workflowId,
      eventType: type,
      ...eventData,
      timestamp: eventData.timestamp || new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Error broadcasting workflow event to SSE', {
      error: error instanceof Error ? error.message : 'Unknown error',
      workflowId,
    })
  }
}