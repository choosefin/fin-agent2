import Groq from 'groq-sdk';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig({ path: '.env.local' });

/**
 * Groq Service Wrapper for ultra-fast Llama inference
 * Primary LLM provider for financial analysis with sub-second response times
 */
export class GroqService {
  private client: Groq | null = null;
  private apiKey: string | undefined;
  
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    
    if (!this.apiKey || this.apiKey === 'your-groq-api-key-here') {
      console.warn('Groq API key not configured. Fast LLM inference will not be available.');
      return;
    }
    
    try {
      this.client = new Groq({
        apiKey: this.apiKey,
      });
      console.info('Groq service initialized successfully with Llama models');
    } catch (error) {
      console.error('Failed to initialize Groq client:', error);
    }
  }
  
  /**
   * Create chat completion using Groq's Llama models
   */
  async createChatCompletion(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
  }) {
    if (!this.isConfigured()) {
      throw new Error('Groq is not configured. Please add GROQ_API_KEY to your .env.local file');
    }
    
    try {
      // Use Llama 3.3 70B for complex financial analysis, Llama 3.1 8B for fast responses
      const model = params.model || 'llama-3.3-70b-versatile'; // Latest Llama 3.3 70B model
      
      const response = await this.client!.chat.completions.create({
        messages: params.messages,
        model,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens ?? 1000,
        stream: params.stream ?? false,
      });
      
      return response;
    } catch (error: any) {
      console.error('Groq API error:', error);
      
      // If rate limited or model unavailable, try fallback model
      if (error.status === 429 || error.status === 503) {
        console.info('Falling back to Llama 3 8B model due to rate limit or availability');
        try {
          const response = await this.client!.chat.completions.create({
            messages: params.messages,
            model: 'llama-3.1-8b-instant', // Fallback to smaller, faster model
            temperature: params.temperature ?? 0.7,
            max_tokens: params.max_tokens ?? 1000,
            stream: params.stream ?? false,
          });
          return response;
        } catch (fallbackError: any) {
          throw new Error(`Groq API error (both models failed): ${fallbackError.message}`);
        }
      }
      
      throw new Error(`Groq API error: ${error.message}`);
    }
  }
  
  /**
   * Stream chat completion responses for real-time updates
   */
  async *streamChatCompletion(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    model?: string;
    temperature?: number;
    max_tokens?: number;
  }) {
    if (!this.isConfigured()) {
      throw new Error('Groq is not configured');
    }
    
    const stream = await this.client!.chat.completions.create({
      messages: params.messages,
      model: params.model || 'llama-3.3-70b-versatile',
      temperature: params.temperature ?? 0.7,
      max_tokens: params.max_tokens ?? 1000,
      stream: true,
    });
    
    for await (const chunk of stream) {
      yield chunk;
    }
  }
  
  /**
   * Check if Groq is properly configured
   */
  isConfigured(): boolean {
    return !!(this.client && this.apiKey && this.apiKey !== 'your-groq-api-key-here');
  }
  
  /**
   * Get available Groq models and their capabilities
   */
  getModelCapabilities() {
    return {
      chat: true,
      streaming: true,
      functionCalling: true,
      maxTokens: 8192,
      models: [
        {
          id: 'llama-3.3-70b-versatile',
          name: 'Llama 3.3 70B Versatile',
          description: 'Latest and best quality for complex financial analysis',
          contextWindow: 32768,
          recommended: true,
        },
        {
          id: 'llama-3.1-70b-versatile',
          name: 'Llama 3.1 70B',
          description: 'Previous gen 70B model with excellent quality',
          contextWindow: 131072,
          recommended: false,
        },
        {
          id: 'llama-3.1-8b-instant', 
          name: 'Llama 3.1 8B Instant',
          description: 'Fastest responses for simple queries',
          contextWindow: 131072,
          recommended: false,
        },
        {
          id: 'mixtral-8x7b-32768',
          name: 'Mixtral 8x7B',
          description: 'Alternative model for varied tasks',
          contextWindow: 32768,
          recommended: false,
        },
      ],
      advantages: [
        'Sub-second response times',
        'No rate limits for most use cases',
        'Excellent for financial calculations',
        'Strong reasoning capabilities',
      ],
    };
  }
  
  /**
   * Get the underlying Groq client (for advanced usage)
   */
  getClient(): Groq | null {
    return this.client;
  }
}

// Export singleton instance
export const groqService = new GroqService();

// Export as default for convenience
export default groqService;