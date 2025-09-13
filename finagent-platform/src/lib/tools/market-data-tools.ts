// Mastra Tools for Market Data and External Integrations
import { Tool } from '@mastra/core';
import { z } from 'zod';
import axios from 'axios';
import { supabase } from '../db/supabase';

// Market Data Tool - with fallback providers
export const marketDataTool = new Tool({
  id: 'market-data',
  name: 'Market Data Fetcher',
  description: 'Fetch real-time and historical market data with fallback providers',
  inputSchema: z.object({
    symbol: z.string().describe('Stock symbol to fetch data for'),
    dataType: z.enum(['quote', 'historical', 'options', 'sentiment', 'news']),
    timeframe: z.string().optional().describe('Timeframe for historical data'),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
  execute: async ({ symbol, dataType, timeframe, startDate, endDate }) => {
    // Try primary provider (Polygon.io)
    try {
      return await fetchFromPolygon(symbol, dataType, timeframe, startDate, endDate);
    } catch (error) {
      console.warn('Polygon.io failed, trying Alpaca...', error);
      
      // Fallback to Alpaca
      try {
        return await fetchFromAlpaca(symbol, dataType, timeframe, startDate, endDate);
      } catch (alpacaError) {
        console.warn('Alpaca failed, trying Yahoo Finance...', alpacaError);
        
        // Final fallback to Yahoo Finance
        return await fetchFromYahoo(symbol, dataType, timeframe);
      }
    }
  },
});

// Polygon.io data fetcher
async function fetchFromPolygon(
  symbol: string,
  dataType: string,
  timeframe?: string,
  startDate?: string,
  endDate?: string
): Promise<any> {
  const apiKey = process.env.POLYGON_API_KEY;
  const baseUrl = 'https://api.polygon.io';
  
  switch (dataType) {
    case 'quote':
      const quoteResponse = await axios.get(
        `${baseUrl}/v2/aggs/ticker/${symbol}/prev`,
        { params: { apikey: apiKey } }
      );
      return quoteResponse.data;
    
    case 'historical':
      const histResponse = await axios.get(
        `${baseUrl}/v2/aggs/ticker/${symbol}/range/1/day/${startDate}/${endDate}`,
        { params: { apikey: apiKey } }
      );
      return histResponse.data;
    
    case 'options':
      const optionsResponse = await axios.get(
        `${baseUrl}/v3/reference/options/contracts`,
        { 
          params: { 
            underlying_ticker: symbol,
            apikey: apiKey,
            limit: 100
          } 
        }
      );
      return optionsResponse.data;
    
    case 'news':
      const newsResponse = await axios.get(
        `${baseUrl}/v2/reference/news`,
        { 
          params: { 
            ticker: symbol,
            apikey: apiKey,
            limit: 10
          } 
        }
      );
      return newsResponse.data;
    
    default:
      throw new Error(`Unsupported data type: ${dataType}`);
  }
}

// Alpaca data fetcher
async function fetchFromAlpaca(
  symbol: string,
  dataType: string,
  timeframe?: string,
  startDate?: string,
  endDate?: string
): Promise<any> {
  const apiKey = process.env.ALPACA_API_KEY;
  const apiSecret = process.env.ALPACA_SECRET_KEY;
  const baseUrl = 'https://data.alpaca.markets/v2';
  
  const headers = {
    'APCA-API-KEY-ID': apiKey,
    'APCA-API-SECRET-KEY': apiSecret,
  };
  
  switch (dataType) {
    case 'quote':
      const quoteResponse = await axios.get(
        `${baseUrl}/stocks/${symbol}/quotes/latest`,
        { headers }
      );
      return quoteResponse.data;
    
    case 'historical':
      const barsResponse = await axios.get(
        `${baseUrl}/stocks/${symbol}/bars`,
        { 
          headers,
          params: {
            start: startDate,
            end: endDate,
            timeframe: timeframe || '1Day',
          }
        }
      );
      return barsResponse.data;
    
    default:
      throw new Error(`Alpaca doesn't support data type: ${dataType}`);
  }
}

// Yahoo Finance data fetcher (simplified)
async function fetchFromYahoo(
  symbol: string,
  dataType: string,
  timeframe?: string
): Promise<any> {
  // Note: In production, use a proper Yahoo Finance API library
  const baseUrl = 'https://query1.finance.yahoo.com/v8/finance';
  
  switch (dataType) {
    case 'quote':
      const quoteResponse = await axios.get(
        `${baseUrl}/chart/${symbol}`
      );
      return quoteResponse.data;
    
    default:
      throw new Error(`Yahoo Finance fallback only supports quotes`);
  }
}

// Trading Execution Tool (Alpaca)
export const tradingTool = new Tool({
  id: 'trading',
  name: 'Trading Executor',
  description: 'Execute trades via Alpaca API',
  inputSchema: z.object({
    action: z.enum(['buy', 'sell', 'cancel']),
    symbol: z.string(),
    quantity: z.number().positive(),
    orderType: z.enum(['market', 'limit', 'stop', 'stop_limit']).default('market'),
    limitPrice: z.number().optional(),
    stopPrice: z.number().optional(),
    timeInForce: z.enum(['day', 'gtc', 'ioc', 'fok']).default('day'),
  }),
  execute: async ({ action, symbol, quantity, orderType, limitPrice, stopPrice, timeInForce }) => {
    const apiKey = process.env.ALPACA_API_KEY;
    const apiSecret = process.env.ALPACA_SECRET_KEY;
    const baseUrl = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets';
    
    const headers = {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
    };
    
    if (action === 'cancel') {
      // Cancel all orders for the symbol
      const ordersResponse = await axios.get(
        `${baseUrl}/v2/orders`,
        { 
          headers,
          params: { status: 'open', symbols: symbol }
        }
      );
      
      const cancelPromises = ordersResponse.data.map((order: any) =>
        axios.delete(`${baseUrl}/v2/orders/${order.id}`, { headers })
      );
      
      await Promise.all(cancelPromises);
      return { message: `Cancelled all orders for ${symbol}` };
    }
    
    // Place order
    const orderData: any = {
      symbol,
      qty: quantity,
      side: action,
      type: orderType,
      time_in_force: timeInForce,
    };
    
    if (orderType === 'limit' || orderType === 'stop_limit') {
      orderData.limit_price = limitPrice;
    }
    
    if (orderType === 'stop' || orderType === 'stop_limit') {
      orderData.stop_price = stopPrice;
    }
    
    const response = await axios.post(
      `${baseUrl}/v2/orders`,
      orderData,
      { headers }
    );
    
    // Save to database
    await supabase.from('trades').insert({
      symbol,
      trade_type: action,
      quantity,
      price: limitPrice || 0,
      total_amount: quantity * (limitPrice || 0),
      order_id: response.data.id,
      status: 'pending',
    });
    
    return response.data;
  },
});

// Parallel Search Tool
export const parallelSearchTool = new Tool({
  id: 'parallel-search',
  name: 'Parallel Search',
  description: 'Search multiple financial data sources in parallel',
  inputSchema: z.object({
    query: z.string(),
    sources: z.array(z.enum(['news', 'sec', 'social', 'research', 'options'])).default(['news', 'sec']),
    symbols: z.array(z.string()).optional(),
    limit: z.number().default(10),
  }),
  execute: async ({ query, sources, symbols, limit }) => {
    const searchPromises = sources.map(source => 
      searchBySource(source, query, symbols, limit)
    );
    
    const results = await Promise.allSettled(searchPromises);
    
    const aggregatedResults: any = {};
    
    results.forEach((result, index) => {
      const source = sources[index];
      if (result.status === 'fulfilled') {
        aggregatedResults[source] = result.value;
      } else {
        aggregatedResults[source] = { error: result.reason.message };
      }
    });
    
    return aggregatedResults;
  },
});

// Search by source helper
async function searchBySource(
  source: string,
  query: string,
  symbols?: string[],
  limit: number = 10
): Promise<any> {
  switch (source) {
    case 'news':
      return searchNews(query, symbols, limit);
    
    case 'sec':
      return searchSECFilings(query, symbols, limit);
    
    case 'social':
      return searchSocialMedia(query, symbols, limit);
    
    case 'research':
      return searchResearchReports(query, symbols, limit);
    
    case 'options':
      return searchOptionsFlow(symbols || [], limit);
    
    default:
      throw new Error(`Unknown search source: ${source}`);
  }
}

// News search
async function searchNews(query: string, symbols?: string[], limit: number = 10): Promise<any> {
  const apiKey = process.env.POLYGON_API_KEY;
  const params: any = {
    apikey: apiKey,
    limit,
    q: query,
  };
  
  if (symbols && symbols.length > 0) {
    params.ticker = symbols.join(',');
  }
  
  const response = await axios.get(
    'https://api.polygon.io/v2/reference/news',
    { params }
  );
  
  return response.data.results;
}

// SEC filings search (simplified)
async function searchSECFilings(query: string, symbols?: string[], limit: number = 10): Promise<any> {
  // In production, use SEC EDGAR API
  const mockResults = symbols?.map(symbol => ({
    symbol,
    filing: '10-K',
    date: new Date().toISOString(),
    url: `https://sec.gov/filings/${symbol}`,
    summary: `Latest filing for ${symbol} containing ${query}`,
  }));
  
  return mockResults || [];
}

// Social media sentiment search
async function searchSocialMedia(query: string, symbols?: string[], limit: number = 10): Promise<any> {
  // In production, integrate with Twitter API, Reddit API, etc.
  const mockResults = {
    twitter: {
      mentions: Math.floor(Math.random() * 1000),
      sentiment: Math.random() * 2 - 1, // -1 to 1
      trending: Math.random() > 0.5,
    },
    reddit: {
      posts: Math.floor(Math.random() * 100),
      sentiment: Math.random() * 2 - 1,
      subreddits: ['wallstreetbets', 'stocks', 'investing'],
    },
  };
  
  return mockResults;
}

// Research reports search
async function searchResearchReports(query: string, symbols?: string[], limit: number = 10): Promise<any> {
  // In production, integrate with research providers
  const mockReports = symbols?.map(symbol => ({
    symbol,
    title: `${symbol} Analysis: ${query}`,
    author: 'Research Team',
    date: new Date().toISOString(),
    rating: ['Buy', 'Hold', 'Sell'][Math.floor(Math.random() * 3)],
    priceTarget: Math.floor(Math.random() * 500) + 50,
  }));
  
  return mockReports || [];
}

// Options flow search
async function searchOptionsFlow(symbols: string[], limit: number = 10): Promise<any> {
  if (symbols.length === 0) return [];
  
  const apiKey = process.env.POLYGON_API_KEY;
  const flowPromises = symbols.map(symbol =>
    axios.get(
      'https://api.polygon.io/v3/reference/options/contracts',
      {
        params: {
          underlying_ticker: symbol,
          apikey: apiKey,
          limit: Math.floor(limit / symbols.length),
          sort: 'volume',
          order: 'desc',
        },
      }
    )
  );
  
  const responses = await Promise.allSettled(flowPromises);
  const results: any = {};
  
  symbols.forEach((symbol, index) => {
    const response = responses[index];
    if (response.status === 'fulfilled') {
      results[symbol] = response.value.data.results;
    } else {
      results[symbol] = { error: 'Failed to fetch options flow' };
    }
  });
  
  return results;
}

// Portfolio Analytics Tool
export const portfolioAnalyticsTool = new Tool({
  id: 'portfolio-analytics',
  name: 'Portfolio Analytics',
  description: 'Calculate portfolio metrics and risk statistics',
  inputSchema: z.object({
    portfolioId: z.string().uuid(),
    metrics: z.array(z.enum(['returns', 'sharpe', 'volatility', 'beta', 'var', 'correlation'])),
    period: z.enum(['1d', '1w', '1m', '3m', '6m', '1y', 'ytd', 'all']).default('1m'),
  }),
  execute: async ({ portfolioId, metrics, period }) => {
    // Fetch portfolio positions
    const { data: positions } = await supabase
      .from('positions')
      .select('*')
      .eq('portfolio_id', portfolioId);
    
    if (!positions || positions.length === 0) {
      return { error: 'No positions found in portfolio' };
    }
    
    const results: any = {};
    
    for (const metric of metrics) {
      switch (metric) {
        case 'returns':
          results.returns = await calculateReturns(positions, period);
          break;
        
        case 'sharpe':
          results.sharpe = await calculateSharpeRatio(positions, period);
          break;
        
        case 'volatility':
          results.volatility = await calculateVolatility(positions, period);
          break;
        
        case 'beta':
          results.beta = await calculateBeta(positions, period);
          break;
        
        case 'var':
          results.var = await calculateVaR(positions, period);
          break;
        
        case 'correlation':
          results.correlation = await calculateCorrelation(positions);
          break;
      }
    }
    
    return results;
  },
});

// Portfolio calculation helpers
async function calculateReturns(positions: any[], period: string): Promise<number> {
  // Simplified return calculation
  const totalValue = positions.reduce((sum, pos) => sum + (pos.market_value || 0), 0);
  const totalCost = positions.reduce((sum, pos) => sum + (pos.quantity * pos.average_cost), 0);
  return ((totalValue - totalCost) / totalCost) * 100;
}

async function calculateSharpeRatio(positions: any[], period: string): Promise<number> {
  // Simplified Sharpe ratio (returns / volatility)
  const returns = await calculateReturns(positions, period);
  const volatility = await calculateVolatility(positions, period);
  const riskFreeRate = 0.05; // 5% annual
  return (returns - riskFreeRate) / volatility;
}

async function calculateVolatility(positions: any[], period: string): Promise<number> {
  // Simplified volatility calculation
  return Math.random() * 20 + 10; // Mock: 10-30% volatility
}

async function calculateBeta(positions: any[], period: string): Promise<number> {
  // Simplified beta calculation
  return Math.random() * 0.5 + 0.75; // Mock: 0.75-1.25 beta
}

async function calculateVaR(positions: any[], period: string): Promise<number> {
  // Value at Risk - simplified
  const totalValue = positions.reduce((sum, pos) => sum + (pos.market_value || 0), 0);
  const confidence = 0.95;
  const volatility = await calculateVolatility(positions, period);
  return totalValue * volatility * 0.01 * Math.sqrt(1); // 1-day VaR
}

async function calculateCorrelation(positions: any[]): Promise<any> {
  // Correlation matrix between positions
  const matrix: any = {};
  
  for (const pos1 of positions) {
    matrix[pos1.symbol] = {};
    for (const pos2 of positions) {
      if (pos1.symbol === pos2.symbol) {
        matrix[pos1.symbol][pos2.symbol] = 1.0;
      } else {
        // Mock correlation
        matrix[pos1.symbol][pos2.symbol] = Math.random() * 2 - 1;
      }
    }
  }
  
  return matrix;
}