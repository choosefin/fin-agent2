import type { EventConfig, Handlers } from '@motia/core';

export const config: EventConfig = {
  type: 'event',
  name: 'ProcessChartRequest',
  subscribes: ['chart.requested'],
  emits: ['chart.enhanced', 'chart.metadata.fetched'],
  input: {
    symbol: 'string',
    embedType: 'string',
    timestamp: 'string',
    traceId: 'string',
  },
};

export const handler: Handlers['ProcessChartRequest'] = async (data, { logger, emit, state }) => {
  const { symbol, embedType, timestamp, traceId } = data;

  try {
    logger.info('Processing chart request', { symbol, embedType, traceId });

    const cachedMetadata = await state.get('symbol-metadata', symbol);
    
    let metadata;
    if (cachedMetadata && isCacheValid(cachedMetadata.timestamp)) {
      metadata = cachedMetadata;
      logger.info('Using cached symbol metadata', { symbol });
    } else {
      metadata = await fetchSymbolMetadata(symbol);
      
      await state.set('symbol-metadata', symbol, {
        ...metadata,
        timestamp: new Date().toISOString(),
      });

      await emit({
        topic: 'chart.metadata.fetched',
        data: {
          symbol,
          metadata,
          traceId,
        },
      });
    }

    const enhancedData = {
      symbol,
      embedType,
      metadata: {
        name: metadata.name || symbol,
        exchange: metadata.exchange || 'NASDAQ',
        type: metadata.type || 'stock',
        currency: metadata.currency || 'USD',
        currentPrice: metadata.currentPrice,
        change: metadata.change,
        changePercent: metadata.changePercent,
        volume: metadata.volume,
        marketCap: metadata.marketCap,
      },
      technicalIndicators: getDefaultIndicators(metadata.type),
      suggestedTimeframes: getSuggestedTimeframes(metadata.type),
      relatedSymbols: metadata.relatedSymbols || [],
      requestedAt: timestamp,
      processedAt: new Date().toISOString(),
      traceId,
    };

    await state.set('chart-requests', `${symbol}-${Date.now()}`, enhancedData);

    await emit({
      topic: 'chart.enhanced',
      data: enhancedData,
    });

    logger.info('Chart request processed successfully', { symbol, traceId });
  } catch (error) {
    logger.error('Failed to process chart request', {
      error: error.message,
      symbol,
      traceId,
    });

    await emit({
      topic: 'chart.processing.failed',
      data: {
        symbol,
        error: error.message,
        traceId,
      },
    });
  }
};

function isCacheValid(timestamp: string): boolean {
  const cacheTime = new Date(timestamp).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  return (now - cacheTime) < fiveMinutes;
}

async function fetchSymbolMetadata(symbol: string) {
  return {
    name: symbol,
    exchange: 'NASDAQ',
    type: 'stock',
    currency: 'USD',
    currentPrice: null,
    change: null,
    changePercent: null,
    volume: null,
    marketCap: null,
    relatedSymbols: [],
  };
}

function getDefaultIndicators(assetType: string): string[] {
  switch (assetType) {
    case 'stock':
      return ['RSI@tv-basicstudies', 'MASimple@tv-basicstudies', 'MACD@tv-basicstudies'];
    case 'crypto':
      return ['RSI@tv-basicstudies', 'BB@tv-basicstudies', 'MACD@tv-basicstudies'];
    case 'forex':
      return ['RSI@tv-basicstudies', 'MASimple@tv-basicstudies', 'Stochastic@tv-basicstudies'];
    default:
      return ['RSI@tv-basicstudies', 'MASimple@tv-basicstudies'];
  }
}

function getSuggestedTimeframes(assetType: string): string[] {
  switch (assetType) {
    case 'crypto':
      return ['1', '5', '15', '60', '240', '1D', '1W'];
    case 'forex':
      return ['1', '5', '15', '30', '60', '240', '1D'];
    case 'stock':
    default:
      return ['5', '15', '60', '1D', '1W', '1M'];
  }
}