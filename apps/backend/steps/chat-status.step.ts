import type { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ChatStatus',
  path: '/api/chat/status',
  method: 'GET',
  querySchema: z.object({
    sessionId: z.string(),
    lastTokenIndex: z.string().optional(),
  }),
  emits: [],
}

// Import the sessions map from chat-polling
import { activeSessions } from './chat-polling.step'

export const handler: Handlers['ChatStatus'] = async (req, { logger }) => {
  const { sessionId, lastTokenIndex = '0' } = req.query
  const lastIndex = parseInt(lastTokenIndex, 10)
  
  logger.debug('Checking chat status', { sessionId, lastTokenIndex })
  
  const session = activeSessions.get(sessionId)
  
  if (!session) {
    return {
      status: 404,
      body: {
        error: 'Session not found',
        message: 'The session may have expired or does not exist',
      },
    }
  }
  
  // Return incremental tokens if streaming
  if (session.status === 'streaming') {
    const newTokens = session.tokens.slice(lastIndex)
    return {
      status: 200,
      body: {
        status: 'streaming',
        tokens: newTokens,
        totalTokens: session.tokens.length,
        metadata: session.metadata,
      },
    }
  }
  
  // Return final result if completed
  if (session.status === 'completed') {
    return {
      status: 200,
      body: {
        status: 'completed',
        result: session.result,
        allTokens: session.tokens.join(''),
        metadata: session.metadata,
      },
    }
  }
  
  // Return error if failed
  if (session.status === 'error') {
    return {
      status: 200,
      body: {
        status: 'error',
        error: session.error,
        partialContent: session.tokens.join(''),
      },
    }
  }
  
  // Return processing status
  return {
    status: 200,
    body: {
      status: session.status,
      metadata: session.metadata,
    },
  }
}

// Export for use in chat-polling.step.ts
export { activeSessions }