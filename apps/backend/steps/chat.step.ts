import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from 'motia';
import { OpenAI } from 'openai';
import { azureOpenAI } from '../services/azure-openai.service';
import { groqService } from '../services/groq.service';
import { agentPrompts } from '../src/mastra/config';
import { generateTradingViewChart, extractSymbolFromQuery } from '../services/chart.service';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ChatWithAgent',
  method: 'POST',
  path: '/api/chat',
  bodySchema: z.object({
    message: z.string(),
    assistantType: z.enum(['general', 'analyst', 'trader', 'advisor', 'riskManager', 'economist']),
    userId: z.string(),
    symbols: z.array(z.string()).optional(),
  }),
  emits: ['chart.requested', 'symbol.detected'],
};

export const handler: Handlers['ChatWithAgent'] = async (req, { logger, state, traceId, emit }) => {
  try {
    logger.info('Processing chat request', { 
      assistantType: req.body.assistantType,
      message: req.body.message.substring(0, 50) + '...',
      traceId 
    });

    // Check if the message is requesting a chart or contains a symbol
    const detectedSymbol = extractSymbolFromQuery(req.body.message);
    const isChartRequest = /\b(chart|graph|show|display|view|price|stock|crypto|ticker)\b/i.test(req.body.message);
    
    if (detectedSymbol && isChartRequest) {
      logger.info('Chart request detected', { symbol: detectedSymbol, traceId });
      
      await emit({
        topic: 'symbol.detected',
        data: {
          symbol: detectedSymbol,
          originalMessage: req.body.message,
          traceId,
        },
      });

      // Generate TradingView chart
      const chartHtml = await generateTradingViewChart({
        symbol: detectedSymbol,
        theme: 'light',
        height: 500,
        interval: '1D',
      });

      await emit({
        topic: 'chart.requested',
        data: {
          symbol: detectedSymbol,
          timestamp: new Date().toISOString(),
          traceId,
        },
      });

      // Return chart with minimal text response
      const chartResponse = {
        traceId,
        response: `Here's the interactive chart for ${detectedSymbol.toUpperCase()}:`,
        assistantType: req.body.assistantType,
        llmProvider: 'groq',
        model: 'chart-display',
        chartHtml,
        symbol: detectedSymbol,
        hasChart: true,
      };

      await state.set('chats', `${traceId}:response`, {
        ...chartResponse,
        timestamp: new Date().toISOString(),
      });

      return {
        status: 200,
        body: chartResponse,
      };
    }

    // Store the chat message
    await state.set('chats', traceId, {
      message: req.body.message,
      assistantType: req.body.assistantType,
      userId: req.body.userId,
      timestamp: new Date().toISOString(),
    });

    // Get the appropriate system prompt for the assistant type
    const systemPrompt = agentPrompts[req.body.assistantType] || agentPrompts.general;

    let response: string;
    let llmProvider = 'none';
    let model = 'unknown';
    
    // Priority 1: Try Groq with Llama (fastest, primary provider)
    if (groqService.isConfigured()) {
      logger.info('Using Groq with Llama 3 for ultra-fast inference');
      try {
        const completion = await groqService.createChatCompletion({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: req.body.message }
          ],
          model: 'llama-3.3-70b-versatile', // Use latest Llama 3.3 70B
          temperature: 0.7,
          max_tokens: 1500,
        });
        
        // Type guard for streaming vs non-streaming response
        if ('choices' in completion) {
          response = completion.choices[0]?.message?.content || 'No response generated';
        } else {
          response = 'Streaming response not supported in this context';
        }
        llmProvider = 'groq';
        model = 'llama-3.3-70b-versatile';
        logger.info('Groq response received successfully', { llmProvider, model });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.warn('Groq failed, falling back to Azure', { error: errorMessage });
        throw error; // Will be caught and trigger fallback
      }
    } 
    // Priority 2: Azure OpenAI with Model Router (GPT-4/5)
    else if (azureOpenAI.isConfigured()) {
      logger.info('Using Azure OpenAI Model Router (GPT-4/5)');
      try {
        const completion = await azureOpenAI.createChatCompletion({
          model: 'model-router', // Intelligent model selection
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: req.body.message }
          ],
          temperature: 0.7,
          max_tokens: 1500,
        });
        
        response = completion.choices[0]?.message?.content || 'No response generated';
        llmProvider = 'azure';
        model = 'gpt-4';
        logger.info('Azure OpenAI response received', { llmProvider, model });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Azure OpenAI failed', { error: errorMessage });
        throw error;
      }
    }
    // Priority 3: Standard OpenAI (fallback)
    else if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
      logger.info('Using standard OpenAI API');
      try {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        
        const completion = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: req.body.message }
          ],
          temperature: 0.7,
          max_tokens: 1500,
        });
        
        response = completion.choices[0]?.message?.content || 'No response generated';
        llmProvider = 'openai';
        model = 'gpt-4-turbo-preview';
        logger.info('OpenAI response received', { llmProvider, model });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('OpenAI API error', { error: errorMessage });
        
        if (errorMessage.includes('API key')) {
          response = `Please configure your LLM providers. Add one of these to backend/.env.local:

**Recommended Setup:**
1. **Groq (Fastest)**: GROQ_API_KEY=gsk-... (Get from https://console.groq.com)
2. **Azure OpenAI**: Already configured with model router
3. **OpenAI**: OPENAI_API_KEY=sk-... (Get from https://platform.openai.com)`;
        } else {
          throw error;
        }
      }
    } 
    // No LLM configured - provide instructions
    else {
      logger.warn('No LLM provider configured');
      response = `I'm your ${req.body.assistantType} assistant. To enable AI responses:

**Priority 1 - Groq (Recommended for speed):**
- Add to backend/.env.local: GROQ_API_KEY=gsk-...
- Get your key from: https://console.groq.com/keys
- Features: Ultra-fast Llama 3 70B responses

**Priority 2 - Azure OpenAI (Already configured):**
- Endpoint and key are set for model router (GPT-4/5)
- Just needs to be activated

**Priority 3 - OpenAI:**
- Add: OPENAI_API_KEY=sk-...
- Get from: https://platform.openai.com/api-keys

Your message: "${req.body.message}"`;
      model = 'none';
      llmProvider = 'none';
    }

    // Store the response with metadata
    await state.set('chats', `${traceId}:response`, {
      response,
      assistantType: req.body.assistantType,
      llmProvider,
      timestamp: new Date().toISOString(),
    });

    // Check if response mentions a symbol and we should add a chart
    const symbolInResponse = extractSymbolFromQuery(response);
    let chartHtml = null;
    
    if (symbolInResponse && (response.toLowerCase().includes('chart') || response.toLowerCase().includes('price') || response.toLowerCase().includes('stock'))) {
      try {
        chartHtml = await generateTradingViewChart({
          symbol: symbolInResponse,
          theme: 'light',
          height: 500,
          interval: '1D',
        });
        
        await emit({
          topic: 'chart.requested',
          data: {
            symbol: symbolInResponse,
            source: 'llm-response',
            timestamp: new Date().toISOString(),
            traceId,
          },
        });
      } catch (chartError) {
        logger.warn('Failed to generate chart for detected symbol', { 
          symbol: symbolInResponse, 
          error: chartError 
        });
      }
    }

    return {
      status: 200,
      body: {
        traceId,
        response,
        assistantType: req.body.assistantType,
        llmProvider,
        model,
        chartHtml: chartHtml || undefined,
        symbol: symbolInResponse || undefined,
        hasChart: !!chartHtml,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Chat processing failed', { 
      error: errorMessage,
      traceId 
    });
    
    // Try fallback chain if primary provider fails
    if (groqService.isConfigured() && !errorMessage.includes('Groq')) {
      // Already tried Groq, now try Azure
      if (azureOpenAI.isConfigured()) {
        logger.info('Attempting Azure OpenAI fallback');
        try {
          const systemPrompt = agentPrompts[req.body.assistantType] || agentPrompts.general;
          const completion = await azureOpenAI.createChatCompletion({
            model: 'model-router',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: req.body.message }
            ],
            temperature: 0.7,
            max_tokens: 1500,
          });
          
          const response = completion.choices[0]?.message?.content || 'No response generated';
          
          return {
            status: 200,
            body: {
              traceId,
              response,
              assistantType: req.body.assistantType,
              llmProvider: 'azure',
              model: 'gpt-4',
              chartHtml: undefined,
              symbol: undefined,
              hasChart: false,
            },
          };
        } catch (azureError) {
          logger.error('Azure fallback also failed', { error: azureError });
        }
      }
    }
    
    return {
      status: 500,
      body: {
        error: 'Failed to process chat request',
        message: errorMessage,
        suggestion: 'Please check your LLM provider configuration in backend/.env.local',
      },
    };
  }
};