import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
// Temporarily disable Polygon.io due to package export issues
// import { restClient } from '@polygon.io/client-js';
import Alpaca from '@alpacahq/alpaca-trade-api';
import yahooFinance from 'yahoo-finance2';

// Initialize clients with safe fallbacks
// Polygon client disabled due to package export issues
const polygon: any = null;

const alpaca = process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY
  ? new Alpaca({
      keyId: process.env.ALPACA_API_KEY,
      secretKey: process.env.ALPACA_SECRET_KEY,
      paper: process.env.NODE_ENV !== 'production',
    })
  : null;

// Market Data Tool
export const marketDataTool = createTool({
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
    // Skip Polygon.io since it's disabled, go straight to alternatives
    try {
      // Try Alpaca first if available
      if (alpaca) {
        try {
          switch (dataType) {
            case 'quote':
              const alpacaQuote = await alpaca.getLatestTrade(symbol);
              return {
                source: 'alpaca',
                data: {
                  symbol,
                  price: alpacaQuote.Price,
                  size: alpacaQuote.Size,
                  timestamp: alpacaQuote.Timestamp,
                },
              };

            case 'historical':
              const alpacaBars = await alpaca.getBarsV2(
                symbol,
                {
                  start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                  end: endDate || new Date().toISOString(),
                  timeframe: timeframe || '1Day',
                }
              );
              const barsArray: any[] = [];
              for await (const bar of alpacaBars) {
                barsArray.push({
                  timestamp: bar.Timestamp,
                  open: bar.OpenPrice,
                  high: bar.HighPrice,
                  low: bar.LowPrice,
                  close: bar.ClosePrice,
                  volume: bar.Volume,
                });
              }
              return {
                source: 'alpaca',
                data: barsArray,
              };

            default:
              throw new Error(`Unsupported data type for Alpaca: ${dataType}`);
          }
        } catch (alpacaError) {
          console.log('Alpaca failed, trying Yahoo Finance...', alpacaError);
          // Fall through to Yahoo Finance
        }
      }

      // Use Yahoo Finance as primary/fallback
      try {
        switch (dataType) {
          case 'quote':
            const yahooQuote = await yahooFinance.quote(symbol);
            return {
              source: 'yahoo',
              data: {
                symbol,
                price: yahooQuote.regularMarketPrice,
                change: yahooQuote.regularMarketChange,
                changePercent: yahooQuote.regularMarketChangePercent,
                volume: yahooQuote.regularMarketVolume,
                high: yahooQuote.regularMarketDayHigh,
                low: yahooQuote.regularMarketDayLow,
                open: yahooQuote.regularMarketOpen,
                previousClose: yahooQuote.regularMarketPreviousClose,
              },
            };

          case 'historical':
            const yahooHistory = await yahooFinance.historical(symbol, {
              period1: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              period2: endDate || new Date().toISOString().split('T')[0],
            });
            return {
              source: 'yahoo',
              data: yahooHistory.map((bar: any) => ({
                timestamp: bar.date,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: bar.volume,
              })),
            };

          case 'news':
            // Yahoo Finance doesn't have a direct news API in this package
            return {
              source: 'yahoo',
              data: [],
              message: 'News data not available from Yahoo Finance'
            };

          default:
            throw new Error(`Unsupported data type: ${dataType}`);
        }
      } catch (yahooError) {
        throw new Error(`All data providers failed: ${yahooError}`);
      }
    } catch (error) {
      throw new Error(`Market data fetch failed: ${error}`);
    }
  },
});