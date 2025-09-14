import type { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { LLMService } from '../services/llm-service'
import { WorkflowDetector } from '../services/workflow-detector'
import { agentPrompts } from '../src/mastra/config'
import { generateTradingViewChart, extractSymbolFromQuery, isChartRequest } from '../services/chart.service'

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
    'chart.requested',
    'symbol.detected',
  ],
}

export const handler: Handlers['ChatStream'] = async (req: any, { logger, emit, state, traceId }: any) => {
  const { message, assistantType = 'general', userId, context } = req.body
  
  try {
    // Check if the message is requesting a chart
    const detectedSymbol = extractSymbolFromQuery(message)
    const chartRequest = isChartRequest(message)
    
    if (detectedSymbol && chartRequest) {
      logger.info('Chart request detected in stream', { symbol: detectedSymbol, traceId })
      
      await emit({
        topic: 'symbol.detected',
        data: {
          symbol: detectedSymbol,
          originalMessage: message,
          traceId,
        },
      })

      // Generate TradingView chart
      const chartHtml = await generateTradingViewChart({
        symbol: detectedSymbol,
        theme: 'light',
        height: 500,
        interval: '1D',
      })

      await emit({
        topic: 'chart.requested',
        data: {
          symbol: detectedSymbol,
          timestamp: new Date().toISOString(),
          traceId,
        },
      })

      // Return chart response immediately without LLM call
      return {
        status: 200,
        body: {
          traceId,
          response: `Here's the interactive chart for ${detectedSymbol.toUpperCase()}:`,
          assistantType,
          llmProvider: 'groq',
          model: 'chart-display',
          chartHtml,
          symbol: detectedSymbol,
          hasChart: true,
        },
      }
    }
    // Detect if this should trigger a workflow
    const workflowDetector = new WorkflowDetector()
    const shouldTriggerWorkflow = await workflowDetector.analyze(message, context)

    if (shouldTriggerWorkflow) {
      // Workflow path - return JSON response with workflowId
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

      // Return JSON response with workflow ID for polling
      return {
        status: 200,
        body: {
          workflowId: traceId,
          message: 'Workflow initiated successfully',
          agents: shouldTriggerWorkflow.agents,
          estimatedTime: shouldTriggerWorkflow.estimatedTime,
        },
      }
    } else {
      // Regular chat path - process synchronously and return response
      logger.info('Processing chat message', { traceId, assistantType })
      
      // Emit chat started event
      await emit({
        topic: 'chat.started',
        data: { traceId, userId, message, assistantType },
      })

      try {
        // Initialize LLM service
        const llmService = new LLMService()

        // Process message (without streaming since Motia doesn't support it)
        const response = await llmService.process(
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

        // Check if LLM response mentions a symbol and add chart if appropriate
        const symbolInResponse = extractSymbolFromQuery(response.content)
        let chartHtml = null
        
        if (symbolInResponse && (response.content.toLowerCase().includes('chart') || 
                                 response.content.toLowerCase().includes('price') || 
                                 response.content.toLowerCase().includes('stock'))) {
          try {
            chartHtml = await generateTradingViewChart({
              symbol: symbolInResponse,
              theme: 'light',
              height: 500,
              interval: '1D',
            })
            
            await emit({
              topic: 'chart.requested',
              data: {
                symbol: symbolInResponse,
                source: 'llm-response',
                timestamp: new Date().toISOString(),
                traceId,
              },
            })
          } catch (chartError) {
            logger.warn('Failed to generate chart for detected symbol', { 
              symbol: symbolInResponse, 
              error: chartError 
            })
          }
        }

        // Return JSON response with optional chart
        return {
          status: 200,
          body: {
            traceId,
            response: response.content,
            assistantType,
            llmProvider: response.provider,
            model: response.model,
            chartHtml: chartHtml || undefined,
            symbol: symbolInResponse || undefined,
            hasChart: !!chartHtml,
          },
        }
      } catch (error) {
        logger.error('Error processing chat', { error: error instanceof Error ? error.message : 'Unknown error', traceId })
        throw error
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