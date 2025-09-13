import type { StreamRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { LLMService } from '../services/llm-service'
import { WorkflowDetector } from '../services/workflow-detector'
import { agentPrompts } from '../src/mastra/config'

export const config: StreamRouteConfig = {
  type: 'stream',
  name: 'ChatWebSocket',
  path: '/chat',
  messageSchema: z.object({
    message: z.string(),
    assistantType: z.enum(['general', 'analyst', 'trader', 'advisor', 'riskManager', 'economist']).default('general'),
    userId: z.string(),
    context: z.object({
      symbols: z.array(z.string()).optional(),
      timeframe: z.string().optional(),
      riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
    }).optional(),
  }),
  emits: [
    'chat.started',
    'workflow.trigger',
    'chat.completed',
  ],
}

export const handler: Handlers['ChatWebSocket'] = async (message, { logger, emit, state, stream, traceId }) => {
  const { message: userMessage, assistantType = 'general', userId, context } = message
  
  try {
    // Detect if this should trigger a workflow
    const workflowDetector = new WorkflowDetector()
    const shouldTriggerWorkflow = await workflowDetector.analyze(userMessage, context)

    if (shouldTriggerWorkflow) {
      // Workflow path - send initial response via WebSocket
      logger.info('Workflow detected, triggering multi-agent analysis', { traceId })
      
      // Send initial status to client via WebSocket
      await stream.send({
        type: 'workflow_detected',
        workflowId: traceId,
        message: 'Initiating multi-agent analysis...',
        agents: shouldTriggerWorkflow.agents,
        estimatedTime: shouldTriggerWorkflow.estimatedTime,
      })

      // Emit workflow trigger event
      await emit({
        topic: 'workflow.trigger',
        data: {
          workflowId: traceId,
          userId,
          message: userMessage,
          context,
          agents: shouldTriggerWorkflow.agents,
          streamId: stream.id, // Pass stream ID for workflow updates
        },
      })

      // The workflow orchestrator will send updates via the stream
      return
    }

    // Regular chat path with streaming
    logger.info('Processing streaming chat message', { traceId, assistantType })
    
    // Send initial status
    await stream.send({
      type: 'chat_started',
      traceId,
      assistantType,
    })

    // Emit chat started event
    await emit({
      topic: 'chat.started',
      data: { traceId, userId, message: userMessage, assistantType },
    })

    // Initialize LLM service with WebSocket streaming callback
    const llmService = new LLMService({
      streamCallback: async (token, metadata) => {
        // Send each token to the client via WebSocket
        await stream.send({
          type: 'token',
          content: token,
          metadata,
        })
      },
      providerSwitchCallback: async (from, to, reason) => {
        // Notify client of provider switch
        await stream.send({
          type: 'provider_switch',
          from,
          to,
          reason,
        })
      },
    })

    // Get system prompt
    const systemPrompt = agentPrompts[assistantType] || agentPrompts.general

    // Process message with streaming
    const response = await llmService.processWithStreaming(
      userMessage,
      assistantType,
      { traceId, userId }
    )

    // Store complete response in state
    await state.set('chats', traceId, {
      userId,
      message: userMessage,
      response: response.content,
      assistantType,
      provider: response.provider,
      model: response.model,
      timestamp: new Date().toISOString(),
    })

    // Send completion message
    await stream.send({
      type: 'chat_completed',
      traceId,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed,
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

  } catch (error) {
    logger.error('Error in chat WebSocket stream', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      traceId 
    })
    
    // Send error to client
    await stream.send({
      type: 'error',
      message: error instanceof Error ? error.message : 'An error occurred',
      traceId,
    })
  }
}