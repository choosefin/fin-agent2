import type { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { LLMService } from '../services/llm-service'
import { WorkflowDetector } from '../services/workflow-detector'
import { agentPrompts } from '../src/mastra/config'

// Inline chart functions to avoid import issues
function extractSymbolFromQuery(query: string): string | null {
  const upperQuery = query.toUpperCase();
  
  const commonSymbols: Record<string, string> = {
    'APPLE': 'AAPL',
    'MICROSOFT': 'MSFT',
    'GOOGLE': 'GOOGL',
    'ALPHABET': 'GOOGL',
    'AMAZON': 'AMZN',
    'TESLA': 'TSLA',
    'META': 'META',
    'FACEBOOK': 'META',
    'NVIDIA': 'NVDA',
    'BERKSHIRE': 'BRK.B',
    'BITCOIN': 'BTCUSD',
    'ETHEREUM': 'ETHUSD',
    'S&P': 'SPX',
    'NASDAQ': 'NDX',
    'DOW': 'DJI',
  };

  for (const [name, symbol] of Object.entries(commonSymbols)) {
    if (upperQuery.includes(name)) {
      return symbol;
    }
  }

  const tickerMatch = query.match(/\b([A-Z]{1,5}(?:\.[A-Z]{1,2})?)\b/);
  if (tickerMatch) {
    return tickerMatch[1];
  }

  const cryptoMatch = query.match(/\b(BTC|ETH|SOL|ADA|DOT|AVAX|MATIC|LINK|UNI|AAVE|XRP|BNB|DOGE|SHIB)(?:USD)?\b/i);
  if (cryptoMatch) {
    const crypto = cryptoMatch[1].toUpperCase();
    return crypto.includes('USD') ? crypto : `${crypto}USD`;
  }

  return null;
}

function isChartRequest(message: string): boolean {
  const chartKeywords = [
    'chart', 'graph', 'show', 'display', 'view', 
    'price', 'stock', 'crypto', 'ticker', 'trading',
    'candle', 'technical', 'analysis', 'market'
  ];
  
  const lowerMessage = message.toLowerCase();
  return chartKeywords.some(keyword => lowerMessage.includes(keyword));
}

function generateTradingViewChart(config: { symbol: string; theme?: string; height?: number; interval?: string }): string {
  const { symbol, theme = 'light', height = 500, interval = '1D' } = config;
  const containerId = `tradingview_${symbol.toLowerCase()}_${Date.now()}`;

  const widgetConfig = {
    autosize: false,
    width: '100%',
    height,
    symbol: symbol.toUpperCase(),
    interval,
    timezone: 'Etc/UTC',
    theme,
    style: '1',
    locale: 'en',
    toolbar_bg: theme === 'dark' ? '#1a1a1a' : '#f1f3f6',
    enable_publishing: false,
    allow_symbol_change: true,
    container_id: containerId,
    studies: ['RSI@tv-basicstudies'],
    show_popup_button: true,
    popup_width: '1000',
    popup_height: '650',
    hide_side_toolbar: false,
  };

  return `
    <div class="tradingview-chart-wrapper" style="width:100%;margin:20px 0;">
      <div class="chart-header" style="padding:12px 16px;background:${theme === 'dark' ? '#1a1a1a' : '#f7f9fc'};border:1px solid ${theme === 'dark' ? '#333' : '#e1e4e8'};border-bottom:none;border-radius:8px 8px 0 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h3 style="margin:0;color:${theme === 'dark' ? '#fff' : '#24292e'};font-size:16px;font-weight:600;">
              ${symbol.toUpperCase()} Chart
            </h3>
            <p style="margin:4px 0 0;color:${theme === 'dark' ? '#8b949e' : '#586069'};font-size:13px;">
              Interactive chart • ${interval} timeframe • Real-time data
            </p>
          </div>
          <div style="display:flex;gap:8px;">
            <span style="padding:4px 10px;background:${theme === 'dark' ? '#21262d' : '#f6f8fa'};color:${theme === 'dark' ? '#58a6ff' : '#0969da'};border-radius:6px;font-size:12px;font-weight:500;">
              ${interval}
            </span>
            <span style="padding:4px 10px;background:${theme === 'dark' ? '#1f6feb20' : '#ddf4ff'};color:${theme === 'dark' ? '#58a6ff' : '#0969da'};border-radius:6px;font-size:12px;font-weight:500;">
              Live
            </span>
          </div>
        </div>
      </div>
      <div class="tradingview-widget-container" style="height:${height}px;width:100%;border:1px solid ${theme === 'dark' ? '#333' : '#e1e4e8'};border-top:none;border-radius:0 0 8px 8px;overflow:hidden;background:${theme === 'dark' ? '#0d1117' : '#ffffff'};">
        <div id="${containerId}" style="height:100%;width:100%;"></div>
        <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
        <script type="text/javascript">
          (function() {
            try {
              new TradingView.widget(${JSON.stringify(widgetConfig)});
            } catch (e) {
              console.error('TradingView widget initialization failed:', e);
            }
          })();
        </script>
      </div>
    </div>
  `;
}

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
    // Log the incoming message
    logger.info('ChatStream received message', { message, traceId })
    
    // Check if the message is requesting a chart
    const detectedSymbol = extractSymbolFromQuery(message)
    const chartRequest = isChartRequest(message)
    
    logger.info('Chart detection results', { 
      message,
      detectedSymbol,
      chartRequest,
      willShowChart: !!(detectedSymbol && chartRequest),
      traceId 
    })
    
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

      // Generate iframe version as alternative
      const chartIframe = `<iframe src="https://s.tradingview.com/widgetembed/?frameElementId=tradingview_${Date.now()}&symbol=${detectedSymbol}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%5D&theme=light&style=1&timezone=Etc%2FUTC&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en" style="width: 100%; height: 500px; border: 0;" allowtransparency="true" frameborder="0"></iframe>`;
      
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
          chartIframe,
          chartConfig: {
            symbol: detectedSymbol,
            containerId: `tradingview_${detectedSymbol.toLowerCase()}_${Date.now()}`,
            height: 500,
            width: '100%',
            interval: '1D',
          },
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