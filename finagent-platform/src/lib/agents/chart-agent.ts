// Chart Agent for Mastra Integration
import { Agent, Tool } from '@mastra/core';
import { z } from 'zod';
import { SymbolParserService, ParsedSymbol } from '../services/symbol-parser';
import { ChartUrlBuilder, ChartOptions } from '../services/chart-url-builder';

export interface ChartResult {
  symbol: string;
  resolvedSymbol: string;
  chartUrl: string;
  embedUrl: string;
  tradingViewUrl: string;
  description: string;
}

export interface ChartAgentResponse {
  success: boolean;
  type: 'chart_links' | 'error' | 'validation_error';
  data?: {
    charts: ChartResult[];
    message: string;
  };
  error?: string;
}

// Define the chart tool schema
const chartToolSchema = z.object({
  query: z.string().describe('The user query containing symbols or chart request'),
  theme: z.enum(['light', 'dark']).optional().describe('Chart theme preference'),
  interval: z.string().optional().describe('Chart time interval (1, 5, 15, 30, 60, 1D, 1W, 1M)'),
  fullscreen: z.boolean().optional().describe('Open chart in fullscreen mode'),
});

// Create the chart analysis tool
export const chartAnalysisTool = new Tool({
  id: 'chart-analysis',
  name: 'Chart Analysis Tool',
  description: 'Generate TradingView charts and analyze symbols from user queries',
  inputSchema: chartToolSchema,
  execute: async (input) => {
    const symbolParser = new SymbolParserService();
    const urlBuilder = new ChartUrlBuilder();

    try {
      // Extract symbols from the query
      const symbols = await symbolParser.parseQuery(input.query);
      
      if (symbols.length === 0) {
        return {
          success: false,
          type: 'validation_error',
          error: 'No valid stock symbols found in your query. Please include a symbol like AAPL, MSFT, or TSLA.',
        };
      }

      // Detect timeframe from query if not specified
      const interval = input.interval || symbolParser.detectTimeframe(input.query);
      
      // Generate chart links for all found symbols
      const chartResults: ChartResult[] = await Promise.all(
        symbols.map(async (parsedSymbol: ParsedSymbol) => {
          const options: ChartOptions = {
            theme: input.theme || 'light',
            interval: interval,
            fullscreen: input.fullscreen || false,
          };

          const chartUrl = urlBuilder.generateChartUrl(parsedSymbol.fullSymbol, options);
          const embedUrl = urlBuilder.generateEmbedUrl(parsedSymbol.fullSymbol, options);
          const tradingViewUrl = urlBuilder.generateTradingViewUrl(parsedSymbol.fullSymbol, interval);

          return {
            symbol: parsedSymbol.symbol,
            resolvedSymbol: parsedSymbol.fullSymbol,
            chartUrl: chartUrl,
            embedUrl: embedUrl,
            tradingViewUrl: tradingViewUrl,
            description: `Interactive chart for ${parsedSymbol.symbol}${parsedSymbol.exchange ? ` on ${parsedSymbol.exchange}` : ''}`,
          };
        })
      );

      return {
        success: true,
        type: 'chart_links',
        data: {
          charts: chartResults,
          message: `Generated ${chartResults.length} chart${chartResults.length > 1 ? 's' : ''} for: ${symbols.map(s => s.symbol).join(', ')}`,
        },
      };
    } catch (error) {
      console.error('Chart analysis error:', error);
      return {
        success: false,
        type: 'error',
        error: error instanceof Error ? error.message : 'Failed to generate charts',
      };
    }
  },
});

// Create the Chart Agent
export class ChartAgent extends Agent {
  constructor() {
    super({
      name: 'Chart Analysis Agent',
      instructions: `You are a financial chart analysis agent that helps users visualize and analyze stock market data.
      
Your capabilities include:
- Extracting stock symbols from natural language queries
- Generating interactive TradingView charts with real-time data
- Detecting appropriate timeframes based on user intent
- Providing multiple chart viewing options (embedded, full-page, external)
- Supporting technical analysis with various chart intervals

When users ask about stocks or want to see charts:
1. Identify all stock symbols mentioned
2. Determine the appropriate timeframe from context
3. Generate chart links with proper configuration
4. Provide helpful context about what they're viewing

Always be helpful and explain what charts are being generated and why.`,
      model: {
        provider: 'OPENAI',
        name: 'gpt-4',
      },
      tools: [chartAnalysisTool],
    });
  }

  /**
   * Execute chart analysis for a user query
   */
  async analyzeCharts(query: string, options?: {
    theme?: 'light' | 'dark';
    interval?: string;
    userId?: string;
  }): Promise<ChartAgentResponse> {
    try {
      const result = await chartAnalysisTool.execute({
        query,
        theme: options?.theme,
        interval: options?.interval,
      });

      return result as ChartAgentResponse;
    } catch (error) {
      console.error('Chart agent execution error:', error);
      return {
        success: false,
        type: 'error',
        error: 'Failed to analyze charts',
      };
    }
  }

  /**
   * Generate a single chart for a specific symbol
   */
  async generateChart(symbol: string, options?: ChartOptions): Promise<ChartResult | null> {
    const symbolParser = new SymbolParserService();
    const urlBuilder = new ChartUrlBuilder();

    try {
      const resolved = await symbolParser.resolveSymbolWithExchange(symbol);
      if (!resolved) {
        return null;
      }

      const chartUrl = urlBuilder.generateChartUrl(resolved.fullSymbol, options);
      const embedUrl = urlBuilder.generateEmbedUrl(resolved.fullSymbol, options);
      const tradingViewUrl = urlBuilder.generateTradingViewUrl(
        resolved.fullSymbol, 
        options?.interval || '1D'
      );

      return {
        symbol: resolved.symbol,
        resolvedSymbol: resolved.fullSymbol,
        chartUrl,
        embedUrl,
        tradingViewUrl,
        description: `Interactive chart for ${resolved.symbol}`,
      };
    } catch (error) {
      console.error(`Failed to generate chart for ${symbol}:`, error);
      return null;
    }
  }
}