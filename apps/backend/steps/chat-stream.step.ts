import type { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { LLMService } from '../services/llm-service'
import { WorkflowDetector } from '../services/workflow-detector'
import { agentPrompts } from '../src/mastra/config'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ChatStream',
  path: '/api/chat/stream',
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

// Store for active SSE connections
const activeStreams = new Map<string, { writer: WritableStreamDefaultWriter, closed: boolean }>()

export const handler: Handlers['ChatStream'] = async (req: any, { logger, emit, state, traceId }: any) => {
  const { message, assistantType = 'general', userId, context } = req.body
  
  try {
    // Detect if this should trigger a workflow
    const workflowDetector = new WorkflowDetector()
    const shouldTriggerWorkflow = await workflowDetector.analyze(message, context)

    if (shouldTriggerWorkflow) {
      // Workflow path
      logger.info('Workflow detected, triggering multi-agent analysis', { traceId })
      
      // Create a readable stream for SSE
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          
          // Send initial workflow detection event
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'workflow_detected',
              workflowId: traceId,
              message: 'Initiating multi-agent analysis...',
              agents: shouldTriggerWorkflow.agents,
              estimatedTime: shouldTriggerWorkflow.estimatedTime,
            })}\n\n`)
          )

          // Store the stream controller for workflow updates
          activeStreams.set(traceId, { 
            writer: controller as any, 
            closed: false 
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

          // Keep connection alive until workflow completes
          // The workflow events will be handled by a separate event handler
        },
        cancel() {
          // Clean up when client disconnects
          activeStreams.delete(traceId)
        }
      })

      return {
        status: 200,
        body: stream,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    } else {
      // Regular chat path with streaming
      logger.info('Processing streaming chat message', { traceId, assistantType })
      
      // Create a readable stream for SSE
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          
          // Send initial status
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'chat_started',
              traceId,
              assistantType,
            })}\n\n`)
          )

          // Emit chat started event
          await emit({
            topic: 'chat.started',
            data: { traceId, userId, message, assistantType },
          })

          try {
            // Initialize LLM service with streaming callback
            const llmService = new LLMService({
              streamCallback: async (token, metadata) => {
                // Send each token via SSE
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'token',
                    content: token,
                    metadata,
                  })}\n\n`)
                )
              },
              providerSwitchCallback: async (from, to, reason) => {
                // Notify about provider switch
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'provider_switch',
                    from,
                    to,
                    reason,
                  })}\n\n`)
                )
              },
            })

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

            // Send completion event
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'chat_completed',
                traceId,
                provider: response.provider,
                model: response.model,
                tokensUsed: response.tokensUsed,
              })}\n\n`)
            )

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

            // Close the stream
            controller.close()
          } catch (error) {
            // Send error event
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                message: error instanceof Error ? error.message : 'An error occurred',
                traceId,
              })}\n\n`)
            )
            controller.close()
            throw error
          }
        },
        cancel() {
          // Clean up when client disconnects
          logger.info('Client disconnected from stream', { traceId })
        }
      })

      return {
        status: 200,
        body: stream,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
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

// Export helper to send workflow updates to active streams
export function sendWorkflowUpdate(workflowId: string, data: any) {
  const stream = activeStreams.get(workflowId)
  if (stream && !stream.closed) {
    const encoder = new TextEncoder()
    try {
      stream.writer.enqueue(
        encoder.encode(`data: ${JSON.stringify({
          type: 'workflow_update',
          ...data,
        })}\n\n`)
      )
    } catch (error) {
      // Stream might be closed
      activeStreams.delete(workflowId)
    }
  }
}