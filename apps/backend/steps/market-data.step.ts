import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from '@motia/core';
import { marketDataTool } from '../src/mastra/tools/marketData';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetMarketData',
  method: 'POST',
  path: '/api/market-data',
  bodySchema: z.object({
    symbol: z.string(),
    dataType: z.enum(['quote', 'historical', 'options', 'sentiment', 'news']),
    timeframe: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
  emits: ['market.data.fetched'],
  flows: ['market-analysis'],
};

export const handler: Handlers['GetMarketData'] = async (req, { logger, emit, state, traceId }) => {
  try {
    logger.info('Fetching market data', { 
      symbol: req.body.symbol,
      dataType: req.body.dataType,
      traceId 
    });

    const result = await marketDataTool.execute(req.body);

    // Cache the result
    await state.set('market-data', `${req.body.symbol}-${req.body.dataType}`, {
      ...result,
      timestamp: new Date().toISOString(),
    });

    await emit({
      topic: 'market.data.fetched',
      data: {
        symbol: req.body.symbol,
        dataType: req.body.dataType,
        source: result.source,
        traceId,
      },
    });

    return {
      status: 200,
      body: result,
    };
  } catch (error) {
    logger.error('Failed to fetch market data', { 
      error: error.message,
      symbol: req.body.symbol,
      traceId 
    });
    
    return {
      status: 500,
      body: {
        error: 'Failed to fetch market data',
        message: error.message,
      },
    };
  }
};