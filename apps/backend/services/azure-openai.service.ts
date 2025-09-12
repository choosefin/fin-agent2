import { OpenAI } from 'openai';
import type { 
  ChatCompletionCreateParams,
  ChatCompletion 
} from 'openai/resources/chat/completions';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig({ path: '.env.local' });

/**
 * Azure OpenAI Service Wrapper
 * Uses Azure AI Studio's model router endpoint for intelligent model selection
 * Provides OpenAI SDK compatibility for seamless Mastra integration
 */
export class AzureOpenAIService {
  private client: OpenAI;
  private deploymentName: string;
  
  constructor() {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    this.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'model-router';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
    
    if (!endpoint || !apiKey || apiKey === 'your-azure-api-key-here') {
      console.warn('Azure OpenAI credentials not configured. AI features will be limited.');
      // Create a dummy client to prevent crashes
      this.client = new OpenAI({
        apiKey: 'dummy',
        baseURL: 'https://api.openai.com/v1'
      });
      return;
    }
    
    // Extract base URL from full endpoint
    // From: https://ai-hello8437ai492250619539.cognitiveservices.azure.com/openai/deployments/model-router/chat/completions?api-version=2025-01-01-preview
    // To: https://ai-hello8437ai492250619539.cognitiveservices.azure.com
    const baseURL = endpoint.split('/openai')[0];
    
    this.client = new OpenAI({
      apiKey,
      baseURL: `${baseURL}/openai`,
      defaultQuery: { 'api-version': apiVersion },
      defaultHeaders: { 
        'api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });
  }
  
  /**
   * Create chat completion using Azure OpenAI
   */
  async createChatCompletion(params: ChatCompletionCreateParams): Promise<ChatCompletion> {
    if (!this.isConfigured()) {
      throw new Error('Azure OpenAI is not configured');
    }
    
    try {
      const response = await this.client.chat.completions.create({
        ...params,
        model: this.deploymentName, // Override model with deployment name
        stream: false as const // Ensure non-streaming response
      });
      
      return response;
    } catch (error: any) {
      console.error('Azure OpenAI API error:', error);
      throw new Error(`Azure OpenAI API error: ${error.message}`);
    }
  }
  
  /**
   * Stream chat completion responses
   */
  async *streamChatCompletion(params: ChatCompletionCreateParams) {
    if (!this.isConfigured()) {
      throw new Error('Azure OpenAI is not configured');
    }
    
    const stream = await this.client.chat.completions.create({
      ...params,
      model: this.deploymentName,
      stream: true
    });
    
    for await (const chunk of stream) {
      yield chunk;
    }
  }
  
  /**
   * Create embeddings using Azure OpenAI
   */
  async createEmbedding(input: string | string[]) {
    if (!this.isConfigured()) {
      throw new Error('Azure OpenAI is not configured');
    }
    
    try {
      const response = await this.client.embeddings.create({
        input,
        model: 'text-embedding-ada-002' // Azure's embedding model
      });
      
      return response;
    } catch (error: any) {
      console.error('Azure OpenAI Embedding error:', error);
      throw new Error(`Azure OpenAI Embedding error: ${error.message}`);
    }
  }
  
  /**
   * OpenAI SDK compatibility layer for Mastra
   */
  get chat() {
    return {
      completions: {
        create: async (params: ChatCompletionCreateParams) => {
          return this.createChatCompletion(params);
        }
      }
    };
  }
  
  /**
   * OpenAI SDK compatibility for embeddings
   */
  get embeddings() {
    return {
      create: async (params: { input: string | string[]; model?: string }) => {
        return this.createEmbedding(params.input);
      }
    };
  }
  
  /**
   * Check if Azure OpenAI is configured
   */
  isConfigured(): boolean {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    return !!(endpoint && apiKey && apiKey !== 'your-azure-api-key-here');
  }
  
  /**
   * Get model capabilities based on the router configuration
   */
  getModelCapabilities() {
    return {
      chat: true,
      embeddings: true,
      functionCalling: true,
      visionSupport: true, // Model router can handle vision models
      maxTokens: 128000, // GPT-4 Turbo max
      models: [
        'gpt-4-turbo',
        'gpt-4',
        'gpt-35-turbo',
        'text-embedding-ada-002'
      ]
    };
  }
  
  /**
   * Get the underlying OpenAI client (for advanced usage)
   */
  getClient(): OpenAI {
    return this.client;
  }
}

// Export singleton instance
export const azureOpenAI = new AzureOpenAIService();

// Export as default for drop-in replacement
export default azureOpenAI;