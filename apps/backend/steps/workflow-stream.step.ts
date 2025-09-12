import { z } from 'zod';
import type { StreamStepConfig, Handlers } from 'motia';

export const config: StreamStepConfig = {
  type: 'stream',
  name: 'WorkflowStream',
  path: '/api/workflow/stream',
  subscribes: [
    'workflow.started',
    'workflow.agent.started',
    'workflow.agent.progress',
    'workflow.agent.completed',
    'workflow.completed'
  ],
};

export const handler: Handlers['WorkflowStream'] = async (event, { logger, send, traceId }) => {
  try {
    logger.info('Streaming workflow event', {
      topic: event.topic,
      workflowId: event.data?.workflowId,
      traceId
    });

    // Format the event for client consumption
    const streamEvent = {
      type: event.topic,
      timestamp: new Date().toISOString(),
      data: event.data,
    };

    // Send to connected clients
    await send(streamEvent);

    // Log specific event types for debugging
    switch (event.topic) {
      case 'workflow.started':
        logger.info('Workflow started streaming', {
          workflowId: event.data.workflowId,
          agents: event.data.agents,
        });
        break;
      
      case 'workflow.agent.started':
        logger.info('Agent started streaming', {
          workflowId: event.data.workflowId,
          agent: event.data.agent,
          stepIndex: event.data.stepIndex,
        });
        break;
      
      case 'workflow.agent.progress':
        logger.info('Agent progress streaming', {
          workflowId: event.data.workflowId,
          agent: event.data.agent,
          status: event.data.status,
        });
        break;
      
      case 'workflow.agent.completed':
        logger.info('Agent completed streaming', {
          workflowId: event.data.workflowId,
          agent: event.data.agent,
          hasError: !!event.data.error,
        });
        break;
      
      case 'workflow.completed':
        logger.info('Workflow completed streaming', {
          workflowId: event.data.workflowId,
          resultCount: event.data.results?.length || 0,
        });
        break;
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to stream workflow event', {
      error: errorMessage,
      topic: event.topic,
      traceId
    });
  }
};