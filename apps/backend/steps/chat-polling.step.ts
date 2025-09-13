import type { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { LLMService } from '../services/llm-service'
import { WorkflowDetector } from '../services/workflow-detector'
import { agentPrompts } from '../src/mastra/config'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ChatPolling',
  path: '/api/chat/polling',
  method: 'POST',
  bodySchema: z.object({
    message: z.string(),
    assistantType: z.enum(['general', 'analyst', 'trader', 'advisor', 'riskManager', 'economist']).optional(),
    userId: z.string(),
    context: z.object({
      symbols: z.array(z.string()).optional(),
      timeframe: z.string().optional(),
      riskTolerance: z.string().optional(),
    }).optional(),
  }),
  emits: [
    'chat.started',
    'workflow.trigger',
    'chat.completed',
  ],
}

// Store for active chat sessions
const activeSessions = new Map<string, {
  status: 'processing' | 'streaming' | 'completed' | 'error',
  tokens: string[],
  metadata?: any,
  error?: string,
  result?: any
}>()

export const handler: Handlers['ChatPolling'] = async (req, { logger, emit, state, traceId }) => {
  const { message, assistantType = 'general', userId, context } = req.body
  const sessionId = `${userId}-${traceId}`
  
  try {
    // Detect if this should trigger a workflow
    const workflowDetector = new WorkflowDetector()
    const shouldTriggerWorkflow = await workflowDetector.analyze(message, context)

    if (shouldTriggerWorkflow) {
      // Workflow path
      logger.info('Workflow detected, triggering multi-agent analysis', { traceId })
      
      // Initialize session
      activeSessions.set(sessionId, {
        status: 'processing',
        tokens: [],
        metadata: {
          type: 'workflow',
          workflowId: traceId,
          agents: shouldTriggerWorkflow.agents,
        }
      })

      // Emit workflow trigger event
      await emit({
        topic: 'workflow.trigger',
        data: {
          workflowId: traceId,
          userId,
          message,
          context,
          agents: shouldTriggerWorkflow.agents,
          sessionId,
        },
      })

      return {
        status: 200,
        body: {
          sessionId,
          type: 'workflow',
          status: 'processing',
          workflowId: traceId,
          message: 'Workflow initiated. Poll /api/chat/status for updates.',
          agents: shouldTriggerWorkflow.agents,
          estimatedTime: shouldTriggerWorkflow.estimatedTime,
        },
      }
    }

    // Regular chat path
    logger.info('Processing chat message with polling', { traceId, assistantType })
    
    // Initialize session
    activeSessions.set(sessionId, {
      status: 'streaming',
      tokens: [],
      metadata: {
        assistantType,
        traceId,
      }
    })

    // Emit chat started event
    await emit({
      topic: 'chat.started',
      data: { traceId, userId, message, assistantType },
    })

    // Process in background
    processChat(sessionId, message, assistantType, userId, traceId, { logger, emit, state })
      .catch(error => {
        logger.error('Background chat processing failed', { error, sessionId })
        const session = activeSessions.get(sessionId)
        if (session) {
          session.status = 'error'
          session.error = error instanceof Error ? error.message : 'Unknown error'
        }
      })

    return {
      status: 200,
      body: {
        sessionId,
        type: 'chat',
        status: 'streaming',
        message: 'Chat initiated. Poll /api/chat/status for updates.',
        pollUrl: `/api/chat/status?sessionId=${sessionId}`,
      },
    }

  } catch (error) {
    logger.error('Error initiating chat', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      traceId 
    })
    
    return {
      status: 500,
      body: {
        error: 'Failed to initiate chat',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }
}

// Background processing function
async function processChat(
  sessionId: string,
  message: string,
  assistantType: string,
  userId: string,
  traceId: string,
  context: any
) {
  const { logger, emit, state } = context
  const session = activeSessions.get(sessionId)
  if (!session) return

  try {
    // Initialize LLM service with callback
    const llmService = new LLMService({
      streamCallback: async (token, metadata) => {
        session.tokens.push(token)
        session.metadata = { ...session.metadata, ...metadata }
      },
      providerSwitchCallback: async (from, to, reason) => {
        session.metadata = {
          ...session.metadata,
          providerSwitch: { from, to, reason }
        }
      },
    })

    // Get system prompt
    const systemPrompt = agentPrompts[assistantType] || agentPrompts.general

    // Process message
    const response = await llmService.processWithStreaming(
      message,
      assistantType,
      { traceId, userId }
    )

    // Update session
    session.status = 'completed'
    session.result = {
      content: response.content,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed,
    }

    // Store in state
    await state.set('chats', traceId, {
      userId,
      message,
      response: response.content,
      assistantType,
      provider: response.provider,
      model: response.model,
      timestamp: new Date().toISOString(),
    })

    // Emit completion event
    await emit({
      topic: 'chat.completed',
      data: {
        traceId,
        userId,
        response: response.content,
        provider: response.provider,
        model: response.model,
      },
    })

    // Clean up session after 5 minutes
    setTimeout(() => {
      activeSessions.delete(sessionId)
    }, 5 * 60 * 1000)

  } catch (error) {
    logger.error('Chat processing failed', { error, sessionId })
    session.status = 'error'
    session.error = error instanceof Error ? error.message : 'Unknown error'
  }
}