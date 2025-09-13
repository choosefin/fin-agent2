import type { ApiRouteConfig, Handlers } from 'motia';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'WorkflowStream',
  method: 'GET',
  path: '/api/workflow/stream',
  emits: [],
};

export const handler: Handlers['WorkflowStream'] = async (_req, { logger, streams, traceId }) => {
  try {
    logger.info('Initializing workflow stream', { traceId });

    // Initialize Motia's WebSocket stream for workflow updates
    // The client will connect to ws://localhost:3000/streams/workflow
    if (streams && streams.workflow) {
      // Set initial connection state
      await streams.workflow.set({
        type: 'connected',
        message: 'Workflow stream connected',
        timestamp: new Date().toISOString(),
      });
      
      logger.info('Workflow stream initialized', { traceId });
      
      return {
        status: 200,
        body: {
          success: true,
          message: 'Workflow stream initialized',
          streamUrl: 'ws://localhost:3000/streams/workflow',
        },
      };
    } else {
      // If streams are not available, return error
      return {
        status: 503,
        body: {
          error: 'Streaming not available',
          message: 'WebSocket streams are not configured',
        },
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to initialize workflow stream', {
      error: errorMessage,
      traceId
    });
    
    return {
      status: 500,
      body: {
        error: 'Failed to initialize workflow stream',
        message: errorMessage,
      },
    };
  }
};