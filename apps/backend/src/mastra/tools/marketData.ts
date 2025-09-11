import { Tool } from '@mastra/tools';
import { z } from 'zod';
import PolygonClient from 'polygon.io';
import Alpaca from 'alpaca-trade-api';
import yahooFinance from 'yahoo-finance2';

// Initialize clients
const polygon = new PolygonClient({
  apiKey: process.env.POLYGON_API_KEY!,
});

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY!,
  secretKey: process.env.ALPACA_SECRET_KEY!,
  paper: process.env.NODE_ENV !== 'production',
});

// Market Data Tool
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
    try {
      // Try Polygon.io first
      switch (dataType) {
        case 'quote':
          const quote = await polygon.stocks.snapshotTicker({ ticker: symbol });
          return {
            source: 'polygon',
            data: {
              symbol,
              price: quote.ticker.day.c,
              change: quote.ticker.day.c - quote.ticker.day.o,
              changePercent: ((quote.ticker.day.c - quote.ticker.day.o) / quote.ticker.day.o) * 100,
              volume: quote.ticker.day.v,
              high: quote.ticker.day.h,
              low: quote.ticker.day.l,
              open: quote.ticker.day.o,
              close: quote.ticker.day.c,
            },
          };

        case 'historical':
          const bars = await polygon.stocks.aggregates({
            ticker: symbol,
            timespan: timeframe || 'day',
            from: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            to: endDate || new Date().toISOString().split('T')[0],
          });
          return {
            source: 'polygon',
            data: bars.results.map((bar: any) => ({
              timestamp: new Date(bar.t),
              open: bar.o,
              high: bar.h,
              low: bar.l,
              close: bar.c,
              volume: bar.v,
            })),
          };

        case 'news':
          const news = await polygon.reference.tickerNews({ ticker: symbol, limit: 10 });
          return {
            source: 'polygon',
            data: news.results.map((article: any) => ({
              title: article.title,
              url: article.article_url,
              publishedAt: article.published_utc,
              author: article.author,
              summary: article.description,
            })),
          };

        default:
          throw new Error(`Unsupported data type: ${dataType}`);
      }
    } catch (polygonError) {
      console.log('Polygon.io failed, trying Alpaca...', polygonError);
      
      try {
        // Fallback to Alpaca
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
        
        // Final fallback to Yahoo Finance
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

            default:
              throw new Error(`Unsupported data type for Yahoo: ${dataType}`);
          }
        } catch (yahooError) {
          throw new Error(`All data providers failed: ${yahooError}`);
        }
      }
    }
  },
});