import type { StreamStepConfig, Handlers } from '@motia/core'
import { z } from 'zod'
import { SSEManager } from '../services/sse-manager'
import { LLMService } from '../services/llm-service'
import { WorkflowDetector } from '../services/workflow-detector'

export const config: StreamStepConfig = {
  type: 'stream',
  name: 'UnifiedChatStream',
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
  subscribes: [
    'chat.token.generated',
    'workflow.started',
    'workflow.agent.started',
    'workflow.agent.progress',
    'workflow.agent.completed',
    'workflow.completed',
    'llm.provider.switched',
  ],
  emits: [
    'chat.started',
    'workflow.trigger',
    'chat.completed',
  ],
}

interface StreamEvent {
  type: string
  data: any
  timestamp: string
}

export const handler: Handlers['UnifiedChatStream'] = async (req, { logger, emit, state, traceId, stream }) => {
  const { message, assistantType = 'general', userId, context } = req.body
  const sseManager = new SSEManager(stream)
  
  try {
    // Send initial connection event
    await sseManager.send({
      type: 'connection.established',
      data: { traceId, assistantType },
      timestamp: new Date().toISOString(),
    })

    // Detect if this should trigger a workflow
    const workflowDetector = new WorkflowDetector()
    const shouldTriggerWorkflow = await workflowDetector.analyze(message, context)

    if (shouldTriggerWorkflow) {
      // Workflow path
      logger.info('Workflow detected, triggering multi-agent analysis', { traceId })
      
      // Send workflow detection event
      await sseManager.send({
        type: 'workflow.detected',
        data: {
          workflowId: traceId,
          message: 'Initiating multi-agent analysis...',
          agents: shouldTriggerWorkflow.agents,
          estimatedTime: shouldTriggerWorkflow.estimatedTime,
        },
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
        },
      })

      // Subscribe to workflow events for this specific workflow
      const workflowEventHandler = async (event: any) => {
        if (event.workflowId === traceId) {
          await sseManager.send({
            type: event.type,
            data: event.data,
            timestamp: new Date().toISOString(),
          })
        }
      }

      // Keep connection alive while workflow processes
      const keepAlive = setInterval(() => {
        sseManager.sendPing()
      }, 30000)

      // Wait for workflow completion
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 300000) // 5 minute timeout
        stream.on('workflow.completed', (event: any) => {
          if (event.workflowId === traceId) {
            clearTimeout(timeout)
            clearInterval(keepAlive)
            resolve(event)
          }
        })
      })

    } else {
      // Regular chat path with streaming
      logger.info('Processing regular chat message', { traceId, assistantType })
      
      // Send chat started event
      await sseManager.send({
        type: 'chat.started',
        data: { 
          message: 'Processing your request...',
          assistantType,
        },
        timestamp: new Date().toISOString(),
      })

      // Initialize LLM service with streaming
      const llmService = new LLMService({
        streamCallback: async (token: string, metadata?: any) => {
          await sseManager.send({
            type: 'chat.token',
            data: { 
              token,
              provider: metadata?.provider,
              model: metadata?.model,
            },
            timestamp: new Date().toISOString(),
          })
        },
        providerSwitchCallback: async (from: string, to: string, reason: string) => {
          await sseManager.send({
            type: 'llm.provider.switched',
            data: { from, to, reason },
            timestamp: new Date().toISOString(),
          })
        },
      })

      // Process message with streaming
      const response = await llmService.processWithStreaming(
        message,
        assistantType,
        { traceId, userId }
      )

      // Send completion event
      await sseManager.send({
        type: 'chat.completed',
        data: {
          response,
          provider: response.provider,
          model: response.model,
          tokensUsed: response.tokensUsed,
        },
        timestamp: new Date().toISOString(),
      })

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
    }

    // Send final close event
    await sseManager.send({
      type: 'stream.end',
      data: { traceId },
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    logger.error('Error in unified chat stream', { error: error.message, traceId })
    
    await sseManager.send({
      type: 'error',
      data: {
        message: 'An error occurred processing your request',
        error: error.message,
      },
      timestamp: new Date().toISOString(),
    })
  } finally {
    await sseManager.close()
  }

  return { status: 200 }
}