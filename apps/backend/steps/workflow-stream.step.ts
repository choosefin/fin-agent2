import type { ApiRouteConfig, Handlers } from 'motia';
import { sseManager } from '../services/sse-manager.service';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'WorkflowStream',
  method: 'GET',
  path: '/api/workflow/stream',
  emits: [],
};

export const handler: Handlers['WorkflowStream'] = async (_req, { logger, traceId }) => {
  try {
    logger.info('Starting SSE stream for workflow events', { traceId });

    // Set SSE headers
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'Access-Control-Allow-Origin': '*',
    };

    // Create a custom response handler for SSE
    // Note: In Motia, we need to return a streaming response
    // This is a simplified implementation - actual implementation may vary based on Motia's SSE support
    
    // Generate client ID
    const clientId = `sse-${traceId}-${Date.now()}`;
    
    // Extract user ID from query params or headers (simplified for now)
    const userId = `user-${Date.now()}`; // This should come from auth/session
    
    // We'll return a response that keeps the connection open
    // The actual SSE implementation would require Motia framework support for streaming responses
    
    return {
      status: 200,
      headers,
      // This is a placeholder - real implementation needs Motia's streaming support
      body: new ReadableStream({
        start(controller) {
          // Register the client with SSE manager
          const mockResponse = {
            write: (data: string) => {
              controller.enqueue(new TextEncoder().encode(data));
            },
            end: () => {
              controller.close();
            }
          };
          
          sseManager.addClient(clientId, mockResponse, userId);
          
          // Keep connection alive
          const keepAlive = setInterval(() => {
            try {
              controller.enqueue(new TextEncoder().encode(':keepalive\n\n'));
            } catch (e) {
              clearInterval(keepAlive);
              sseManager.removeClient(clientId);
            }
          }, 30000);
          
          // Cleanup on close
          return () => {
            clearInterval(keepAlive);
            sseManager.removeClient(clientId);
          };
        }
      }),
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