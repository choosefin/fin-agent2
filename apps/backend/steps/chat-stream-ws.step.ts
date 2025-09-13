import type { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { LLMService } from '../services/llm-service'
import { WorkflowDetector } from '../services/workflow-detector'
import { agentPrompts } from '../src/mastra/config'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ChatStreamWS',
  path: '/api/chat/stream-ws',
  method: 'POST',
  bodySchema: z.object({
    message: z.string(),
    assistantType: z.enum(['general', 'analyst', 'trader', 'advisor', 'riskManager', 'economist']).optional(),
    userId: z.string(),
    streamId: z.string().optional(), // Optional stream ID for specific channel
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

export const handler: Handlers['ChatStreamWS'] = async (req, { logger, emit, state, streams, traceId }) => {
  const { message, assistantType = 'general', userId, streamId, context } = req.body
  
  // Use provided streamId or default to user-specific stream
  const chatStreamKey = streamId || `chat-${userId}`
  
  try {
    // Check if streams are available
    if (!streams) {
      logger.warn('Streams context not available, falling back to non-streaming response')
      // Fallback to regular response
      return {
        status: 503,
        body: {
          error: 'Streaming not available',
          message: 'WebSocket streams are not configured. Please use the regular chat endpoint.',
        },
      }
    }

    // Detect if this should trigger a workflow
    const workflowDetector = new WorkflowDetector()
    const shouldTriggerWorkflow = await workflowDetector.analyze(message, context)

    if (shouldTriggerWorkflow) {
      // Workflow path
      logger.info('Workflow detected, triggering multi-agent analysis', { traceId })
      
      // Send initial workflow detection via WebSocket
      await streams.set(chatStreamKey, {
        type: 'workflow_detected',
        workflowId: traceId,
        message: 'Initiating multi-agent analysis...',
        agents: shouldTriggerWorkflow.agents,
        estimatedTime: shouldTriggerWorkflow.estimatedTime,
        timestamp: new Date().toISOString(),
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
          streamKey: chatStreamKey, // Pass stream key for workflow updates
        },
      })

      return {
        status: 200,
        body: {
          type: 'workflow',
          workflowId: traceId,
          streamUrl: `ws://localhost:3000/streams/${chatStreamKey}`,
          message: 'Workflow initiated. Connect to WebSocket for real-time updates.',
        },
      }
    }

    // Regular chat path with streaming
    logger.info('Processing streaming chat message', { traceId, assistantType })
    
    // Send initial status via WebSocket
    await streams.set(chatStreamKey, {
      type: 'chat_started',
      traceId,
      assistantType,
      timestamp: new Date().toISOString(),
    })

    // Emit chat started event
    await emit({
      topic: 'chat.started',
      data: { traceId, userId, message, assistantType },
    })

    // Initialize LLM service with streaming callback
    const llmService = new LLMService({
      streamCallback: async (token, metadata) => {
        // Send each token via WebSocket
        await streams.set(chatStreamKey, {
          type: 'token',
          content: token,
          metadata,
          timestamp: new Date().toISOString(),
        })
      },
      providerSwitchCallback: async (from, to, reason) => {
        // Notify about provider switch
        await streams.set(chatStreamKey, {
          type: 'provider_switch',
          from,
          to,
          reason,
          timestamp: new Date().toISOString(),
        })
      },
    })

    // Get system prompt
    const systemPrompt = agentPrompts[assistantType] || agentPrompts.general

    // Process message with streaming
    const response = await llmService.processWithStreaming(
      message,
      assistantType,
      { traceId, userId }
    )

    // Store complete response in state
    await state.set('chats', traceId, {
      userId,
      message,
      response: response.content,
      assistantType,
      provider: response.provider,
      model: response.model,
      timestamp: new Date().toISOString(),
    })

    // Send completion message via WebSocket
    await streams.set(chatStreamKey, {
      type: 'chat_completed',
      traceId,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed,
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

    return {
      status: 200,
      body: {
        type: 'chat',
        traceId,
        streamUrl: `ws://localhost:3000/streams/${chatStreamKey}`,
        message: 'Chat response streamed via WebSocket',
        provider: response.provider,
        model: response.model,
      },
    }

  } catch (error) {
    logger.error('Error in chat WebSocket stream', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      traceId 
    })
    
    // Send error via WebSocket if available
    if (streams) {
      await streams.set(chatStreamKey, {
        type: 'error',
        message: error instanceof Error ? error.message : 'An error occurred',
        traceId,
        timestamp: new Date().toISOString(),
      })
    }
    
    return {
      status: 500,
      body: {
        error: 'An error occurred processing your request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }
}