import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from '@motia/core';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetSymbolChartResponse',
  method: 'POST',
  path: '/api/symbol-chart',
  bodySchema: z.object({
    query: z.string().describe('User query mentioning a symbol (e.g., "Show me AAPL chart", "How is Tesla doing?")'),
    preferences: z.object({
      theme: z.enum(['light', 'dark']).optional(),
      defaultInterval: z.string().optional(),
      preferredIndicators: z.array(z.string()).optional(),
    }).optional(),
  }),
  emits: ['symbol.chart.requested', 'symbol.parsed'],
  flows: ['market-analysis', 'chat-integration'],
};

export const handler: Handlers['GetSymbolChartResponse'] = async (req, { logger, emit, state, traceId }) => {
  try {
    const { query, preferences = {} } = req.body;
    
    logger.info('Processing symbol chart request from query', { query, traceId });

    const symbol = extractSymbolFromQuery(query);
    
    if (!symbol) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'No valid symbol found in query',
          message: 'Please specify a valid stock symbol (e.g., AAPL, MSFT, TSLA)',
        },
      };
    }

    await emit({
      topic: 'symbol.parsed',
      data: {
        originalQuery: query,
        extractedSymbol: symbol,
        traceId,
      },
    });

    const theme = preferences.theme || 'light';
    const interval = preferences.defaultInterval || '1D';
    const indicators = preferences.preferredIndicators || ['RSI@tv-basicstudies', 'MACD@tv-basicstudies'];

    const widgetConfig = {
      symbol: symbol.toUpperCase(),
      width: '100%',
      height: 600,
      theme,
      interval,
      timezone: 'Etc/UTC',
      style: '1',
      locale: 'en',
      toolbar_bg: theme === 'dark' ? '#1a1a1a' : '#f1f3f6',
      enable_publishing: false,
      allow_symbol_change: true,
      container_id: `tradingview_${symbol.toLowerCase()}_${Date.now()}`,
      studies: indicators,
      show_popup_button: true,
      popup_width: '1000',
      popup_height: '650',
    };

    const embedHtml = `
      <div class="tradingview-chart-container" style="width:100%;height:600px;margin:20px 0;">
        <div class="chart-header" style="padding:10px;background:${theme === 'dark' ? '#1a1a1a' : '#f7f7f7'};border-radius:8px 8px 0 0;">
          <h3 style="margin:0;color:${theme === 'dark' ? '#fff' : '#333'};">${symbol.toUpperCase()} - Interactive Chart</h3>
          <p style="margin:5px 0 0;color:${theme === 'dark' ? '#aaa' : '#666'};font-size:14px;">
            Powered by TradingView • ${interval} timeframe
          </p>
        </div>
        <div class="tradingview-widget-container" style="height:600px;width:100%;border:1px solid ${theme === 'dark' ? '#333' : '#ddd'};border-top:none;border-radius:0 0 8px 8px;overflow:hidden;">
          <div id="${widgetConfig.container_id}" style="height:100%;width:100%;"></div>
          <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
          <script type="text/javascript">
            (function() {
              new TradingView.widget(${JSON.stringify(widgetConfig, null, 2)});
            })();
          </script>
        </div>
        <div class="chart-footer" style="padding:10px;text-align:center;color:${theme === 'dark' ? '#888' : '#999'};font-size:12px;">
          <a href="https://www.tradingview.com/symbols/${symbol}/" target="_blank" style="color:${theme === 'dark' ? '#4a90e2' : '#0066cc'};text-decoration:none;">
            View full chart on TradingView →
          </a>
        </div>
      </div>
    `;

    const response = {
      success: true,
      symbol: symbol.toUpperCase(),
      message: `Here's the interactive chart for ${symbol.toUpperCase()}. You can interact with it directly - zoom, change timeframes, and add indicators.`,
      chart: {
        type: 'embedded',
        html: embedHtml,
        config: widgetConfig,
        features: {
          interactive: true,
          realtime: true,
          indicators: indicators,
          timeframes: ['1', '5', '15', '60', '240', '1D', '1W', '1M'],
        },
      },
      quickActions: [
        {
          label: 'Switch to Dark Mode',
          action: 'updateTheme',
          value: theme === 'light' ? 'dark' : 'light',
        },
        {
          label: 'Add Volume',
          action: 'addIndicator', 
          value: 'Volume@tv-basicstudies',
        },
        {
          label: 'Compare with S&P 500',
          action: 'addComparison',
          value: 'SPX',
        },
      ],
      metadata: {
        requestedAt: new Date().toISOString(),
        traceId,
      },
    };

    await state.set('chart-responses', `${symbol}-${Date.now()}`, {
      query,
      symbol,
      response,
      traceId,
    });

    await emit({
      topic: 'symbol.chart.requested',
      data: {
        symbol,
        query,
        config: widgetConfig,
        traceId,
      },
    });

    return {
      status: 200,
      body: response,
    };
  } catch (error) {
    logger.error('Failed to generate symbol chart response', {
      error: error.message,
      query: req.body.query,
      traceId,
    });

    return {
      status: 500,
      body: {
        success: false,
        error: 'Failed to generate chart',
        message: error.message,
      },
    };
  }
};

function extractSymbolFromQuery(query: string): string | null {
  const upperQuery = query.toUpperCase();
  
  const commonSymbols = {
    'APPLE': 'AAPL',
    'MICROSOFT': 'MSFT',
    'GOOGLE': 'GOOGL',
    'ALPHABET': 'GOOGL',
    'AMAZON': 'AMZN',
    'TESLA': 'TSLA',
    'META': 'META',
    'FACEBOOK': 'META',
    'NVIDIA': 'NVDA',
    'BERKSHIRE': 'BRK.B',
    'BITCOIN': 'BTCUSD',
    'ETHEREUM': 'ETHUSD',
    'S&P': 'SPX',
    'NASDAQ': 'NDX',
    'DOW': 'DJI',
  };

  for (const [name, symbol] of Object.entries(commonSymbols)) {
    if (upperQuery.includes(name)) {
      return symbol;
    }
  }

  const tickerMatch = query.match(/\b([A-Z]{1,5}(?:\.[A-Z]{1,2})?)\b/);
  if (tickerMatch) {
    return tickerMatch[1];
  }

  const cryptoMatch = query.match(/\b(BTC|ETH|SOL|ADA|DOT|AVAX|MATIC|LINK|UNI|AAVE)(?:USD)?\b/i);
  if (cryptoMatch) {
    const crypto = cryptoMatch[1].toUpperCase();
    return crypto.includes('USD') ? crypto : `${crypto}USD`;
  }

  return null;
}