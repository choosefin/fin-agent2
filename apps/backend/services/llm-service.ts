import { Groq } from 'groq-sdk';
import OpenAI from 'openai';

interface LLMServiceConfig {
  streamCallback?: (token: string, metadata?: any) => Promise<void>;
  providerSwitchCallback?: (from: string, to: string, reason: string) => Promise<void>;
}

interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  tokensUsed?: number;
}

export class LLMService {
  private groqClient?: Groq;
  private openaiClient?: OpenAI;
  private azureClient?: OpenAI;
  private config: LLMServiceConfig;

  constructor(config: LLMServiceConfig = {}) {
    this.config = config;
    this.initializeClients();
  }

  private initializeClients() {
    // Initialize Groq client
    if (process.env.GROQ_API_KEY) {
      this.groqClient = new Groq({
        apiKey: process.env.GROQ_API_KEY,
      });
    }

    // Initialize OpenAI client
    if (process.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    // Initialize Azure OpenAI client
    if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
      this.azureClient = new OpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
        defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION || '2024-02-01' },
        defaultHeaders: {
          'api-key': process.env.AZURE_OPENAI_API_KEY,
        },
      });
    }
  }

  async process(
    message: string,
    assistantType: string,
    context: { traceId: string; userId: string }
  ): Promise<LLMResponse> {
    const systemPrompt = this.getSystemPrompt(assistantType);
    
    // Try Groq first
    if (this.groqClient) {
      try {
        const completion = await this.groqClient.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.7,
          max_tokens: 2048,
          stream: false,
        });

        return {
          content: completion.choices[0]?.message?.content || '',
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          tokensUsed: completion.usage?.total_tokens,
        };
      } catch (error) {
        console.error('Groq API failed:', error);
      }
    }

    // Fallback to Azure OpenAI
    if (this.azureClient) {
      try {
        const completion = await this.azureClient.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
          temperature: 0.7,
          max_tokens: 2048,
          stream: false,
        });

        return {
          content: completion.choices[0]?.message?.content || '',
          provider: 'azure',
          model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
          tokensUsed: completion.usage?.total_tokens,
        };
      } catch (error) {
        console.error('Azure OpenAI API failed:', error);
      }
    }

    // Fallback to OpenAI
    if (this.openaiClient) {
      try {
        const completion = await this.openaiClient.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          model: 'gpt-4-turbo-preview',
          temperature: 0.7,
          max_tokens: 2048,
          stream: false,
        });

        return {
          content: completion.choices[0]?.message?.content || '',
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
          tokensUsed: completion.usage?.total_tokens,
        };
      } catch (error) {
        console.error('OpenAI API failed:', error);
        throw new Error('All LLM providers failed');
      }
    }

    // No providers configured - return mock response
    return {
      content: `[${assistantType.toUpperCase()} ASSISTANT]\n\nI'm responding to your message: "${message}"\n\nTo enable AI responses, please configure an LLM provider (Groq, Azure OpenAI, or OpenAI) in your environment variables.`,
      provider: 'mock',
      model: 'none',
      tokensUsed: 0,
    };
  }

  async processWithStreaming(
    message: string,
    assistantType: string,
    context: { traceId: string; userId: string }
  ): Promise<LLMResponse> {
    const systemPrompt = this.getSystemPrompt(assistantType);
    let accumulatedContent = '';
    let provider = 'groq';
    let model = 'llama-3.3-70b-versatile';
    let tokensUsed = 0;

    // Try Groq first
    if (this.groqClient) {
      try {
        const stream = await this.groqClient.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.7,
          max_tokens: 2048,
          stream: true,
        });

        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content || '';
          if (token) {
            accumulatedContent += token;
            if (this.config.streamCallback) {
              await this.config.streamCallback(token, { provider, model });
            }
          }
          // Usage is not available in streaming chunks for Groq
        }

        return { content: accumulatedContent, provider, model, tokensUsed };
      } catch (error) {
        console.error('Groq streaming failed:', error);
        if (this.config.providerSwitchCallback) {
          await this.config.providerSwitchCallback('groq', 'azure', 'Groq API error');
        }
      }
    }

    // Fallback to Azure OpenAI
    if (this.azureClient) {
      try {
        provider = 'azure';
        model = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4';
        
        const stream = await this.azureClient.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
          temperature: 0.7,
          max_tokens: 2048,
          stream: true,
        });

        accumulatedContent = '';
        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content || '';
          if (token) {
            accumulatedContent += token;
            if (this.config.streamCallback) {
              await this.config.streamCallback(token, { provider, model });
            }
          }
          // Usage is not available in streaming chunks for Groq
        }

        return { content: accumulatedContent, provider, model, tokensUsed };
      } catch (error) {
        console.error('Azure OpenAI streaming failed:', error);
        if (this.config.providerSwitchCallback) {
          await this.config.providerSwitchCallback('azure', 'openai', 'Azure API error');
        }
      }
    }

    // Fallback to OpenAI
    if (this.openaiClient) {
      try {
        provider = 'openai';
        model = 'gpt-4-turbo-preview';
        
        const stream = await this.openaiClient.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          model: 'gpt-4-turbo-preview',
          temperature: 0.7,
          max_tokens: 2048,
          stream: true,
        });

        accumulatedContent = '';
        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content || '';
          if (token) {
            accumulatedContent += token;
            if (this.config.streamCallback) {
              await this.config.streamCallback(token, { provider, model });
            }
          }
          // Usage is not available in streaming chunks for Groq
        }

        return { content: accumulatedContent, provider, model, tokensUsed };
      } catch (error) {
        console.error('OpenAI streaming failed:', error);
        throw new Error('All LLM providers failed');
      }
    }

    throw new Error('No LLM providers configured');
  }

  private getSystemPrompt(assistantType: string): string {
    const prompts: Record<string, string> = {
      general: 'You are a helpful AI assistant. Provide clear, concise, and accurate responses.',
      analyst: 'You are a financial analyst. Provide detailed market analysis, technical indicators, and data-driven insights.',
      trader: 'You are an experienced trader. Focus on trading strategies, entry/exit points, and risk management.',
      advisor: 'You are a financial advisor. Provide personalized investment advice based on user goals and risk tolerance.',
      riskManager: 'You are a risk management expert. Analyze potential risks, volatility, and provide hedging strategies.',
      economist: 'You are an economist. Analyze macroeconomic trends, policy impacts, and economic indicators.',
    };

    return prompts[assistantType] || prompts.general;
  }
}