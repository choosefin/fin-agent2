import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from '@motia/core';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'QuickChart',
  method: 'GET',
  path: '/api/chart/:symbol',
  emits: ['quick.chart.served'],
  flows: ['market-analysis'],
};

export const handler: Handlers['QuickChart'] = async (req, { logger, emit, state, traceId }) => {
  try {
    const symbol = req.params.symbol?.toUpperCase();
    
    if (!symbol) {
      return {
        status: 400,
        body: {
          error: 'Symbol is required',
        },
      };
    }

    const theme = req.query?.theme || 'light';
    const interval = req.query?.interval || '1D';
    const height = parseInt(req.query?.height || '500');

    logger.info('Serving quick chart', { symbol, theme, interval, traceId });

    const htmlResponse = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${symbol} Chart - TradingView</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: ${theme === 'dark' ? '#0d0d0d' : '#ffffff'};
        }
        .container { 
            width: 100%; 
            height: 100vh; 
            display: flex; 
            flex-direction: column;
        }
        .header {
            padding: 15px 20px;
            background: ${theme === 'dark' ? '#1a1a1a' : '#f8f9fa'};
            border-bottom: 1px solid ${theme === 'dark' ? '#333' : '#e0e0e0'};
        }
        .header h1 {
            font-size: 24px;
            color: ${theme === 'dark' ? '#ffffff' : '#333333'};
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .symbol-badge {
            background: ${theme === 'dark' ? '#2a2a2a' : '#e3f2fd'};
            color: ${theme === 'dark' ? '#4a90e2' : '#1976d2'};
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 600;
        }
        .chart-container {
            flex: 1;
            width: 100%;
            position: relative;
        }
        .loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: ${theme === 'dark' ? '#666' : '#999'};
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>
                ${symbol} Live Chart
                <span class="symbol-badge">${interval}</span>
            </h1>
        </div>
        <div class="chart-container">
            <div class="loading">Loading chart...</div>
            <div class="tradingview-widget-container" style="height:100%;width:100%;">
                <div id="tradingview_${symbol.toLowerCase()}" style="height:100%;width:100%;"></div>
                <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
                <script type="text/javascript">
                window.addEventListener('DOMContentLoaded', function() {
                    new TradingView.widget({
                        "autosize": true,
                        "symbol": "${symbol}",
                        "interval": "${interval}",
                        "timezone": "Etc/UTC",
                        "theme": "${theme}",
                        "style": "1",
                        "locale": "en",
                        "toolbar_bg": "${theme === 'dark' ? '#1a1a1a' : '#f1f3f6'}",
                        "enable_publishing": false,
                        "allow_symbol_change": true,
                        "container_id": "tradingview_${symbol.toLowerCase()}",
                        "hide_side_toolbar": false,
                        "studies": [
                            "RSI@tv-basicstudies",
                            "MASimple@tv-basicstudies"
                        ],
                        "show_popup_button": true,
                        "popup_width": "1000",
                        "popup_height": "650",
                        "details": true,
                        "hotlist": true,
                        "calendar": true
                    });
                    document.querySelector('.loading').style.display = 'none';
                });
                </script>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    await emit({
      topic: 'quick.chart.served',
      data: {
        symbol,
        theme,
        interval,
        traceId,
      },
    });

    return {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
      body: htmlResponse,
    };
  } catch (error) {
    logger.error('Failed to serve quick chart', {
      error: error.message,
      symbol: req.params?.symbol,
      traceId,
    });

    return {
      status: 500,
      body: {
        error: 'Failed to generate chart',
        message: error.message,
      },
    };
  }
};