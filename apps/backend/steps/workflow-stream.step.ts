import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from 'motia';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'WorkflowStream',
  method: 'GET',
  path: '/api/workflow/stream',
  emits: [],
};

export const handler: Handlers['WorkflowStream'] = async (req, { logger, state, traceId }) => {
  try {
    logger.info('Starting SSE stream for workflow events', { traceId });

    // Set SSE headers
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    };

    // Create SSE response
    // Note: This is a simplified implementation
    // In production, you'd need proper SSE handling with event listeners
    return {
      status: 200,
      headers,
      body: 'data: {"type":"connected","message":"SSE stream connected"}\n\n',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to initialize SSE stream', {
      error: errorMessage,
      traceId
    });
    
    return {
      status: 500,
      body: {
        error: 'Failed to initialize SSE stream',
        message: errorMessage,
      },
    };
  }
};