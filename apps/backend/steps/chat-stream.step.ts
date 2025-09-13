import type { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { LLMService } from '../services/llm-service'
import { WorkflowDetector } from '../services/workflow-detector'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ChatStream',
  path: '/api/chat/stream',
  method: 'POST',
  bodySchema: z.object({
    message: z.string(),
    assistantType: z.string().optional(),
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

export const handler: Handlers['ChatStream'] = async (req: any, { logger, emit, state, traceId }: any) => {
  const { message, assistantType = 'general', userId, context } = req.body
  
  try {
    // Detect if this should trigger a workflow
    const workflowDetector = new WorkflowDetector()
    const shouldTriggerWorkflow = await workflowDetector.analyze(message, context)

    if (shouldTriggerWorkflow) {
      // Workflow path
      logger.info('Workflow detected, triggering multi-agent analysis', { traceId })
      
      // Emit workflow trigger event
      await emit({
        topic: 'workflow.trigger',
        data: {
          workflowId: traceId,
          userId,
          message,
          context,
          agents: shouldTriggerWorkflow.agents,
        },
      })

      // Return workflow detection response
      return {
        status: 200,
        body: {
          type: 'workflow',
          workflowId: traceId,
          message: 'Initiating multi-agent analysis...',
          agents: shouldTriggerWorkflow.agents,
          estimatedTime: shouldTriggerWorkflow.estimatedTime,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    } else {
      // Regular chat path
      logger.info('Processing regular chat message', { traceId, assistantType })
      
      // Emit chat started event
      await emit({
        topic: 'chat.started',
        data: { traceId, userId, message, assistantType },
      })

      // Initialize LLM service
      const llmService = new LLMService({})

      // Process message (simplified for now - no streaming in this version)
      const response = await llmService.processWithStreaming(
        message,
        assistantType,
        { traceId, userId }
      )

      // Store in state
      await state.set('chats', traceId, {
        userId,
        message,
        response: response.content,
        assistantType,
        timestamp: new Date().toISOString(),
      })

      // Emit completion event
      await emit({
        topic: 'chat.completed',
        data: {
          traceId,
          userId,
          response: response.content,
        },
      })

      // Return chat response
      return {
        status: 200,
        body: {
          type: 'chat',
          response: response.content,
          provider: response.provider,
          model: response.model,
          tokensUsed: response.tokensUsed,
          traceId,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    }
  } catch (error) {
    logger.error('Error in chat stream', { error: error instanceof Error ? error.message : 'Unknown error', traceId })
    
    return {
      status: 500,
      body: {
        error: 'An error occurred processing your request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }
}