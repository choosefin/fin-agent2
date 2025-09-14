import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from '@motia/core';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetTradingViewChart',
  method: 'POST',
  path: '/api/tradingview-chart',
  bodySchema: z.object({
    symbol: z.string().describe('Stock symbol to display (e.g., AAPL, MSFT)'),
    theme: z.enum(['light', 'dark']).optional().default('light'),
    height: z.number().optional().default(600),
    interval: z.string().optional().default('1D'),
    showToolbar: z.boolean().optional().default(true),
    allowSymbolChange: z.boolean().optional().default(true),
    studies: z.array(z.string()).optional().default([]),
    embedType: z.enum(['iframe', 'widget', 'config']).optional().default('widget'),
  }),
  emits: ['chart.requested', 'chart.generated'],
  flows: ['market-analysis', 'trading-view'],
};

export const handler: Handlers['GetTradingViewChart'] = async (req, { logger, emit, state, traceId }) => {
  try {
    const {
      symbol,
      theme = 'light',
      height = 600,
      interval = '1D',
      showToolbar = true,
      allowSymbolChange = true,
      studies = [],
      embedType = 'widget',
    } = req.body;

    logger.info('Generating TradingView chart configuration', {
      symbol,
      embedType,
      traceId,
    });

    await emit({
      topic: 'chart.requested',
      data: {
        symbol,
        embedType,
        timestamp: new Date().toISOString(),
        traceId,
      },
    });

    const baseConfig = {
      symbol: symbol.toUpperCase(),
      width: '100%',
      height,
      theme,
      interval,
      timezone: 'Etc/UTC',
      style: '1',
      locale: 'en',
      toolbar_bg: theme === 'dark' ? '#1a1a1a' : '#f1f3f6',
      enable_publishing: false,
      hide_side_toolbar: !showToolbar,
      allow_symbol_change: allowSymbolChange,
      container_id: `tradingview_${symbol.toLowerCase()}_${Date.now()}`,
      studies: studies.length > 0 ? studies : ['RSI@tv-basicstudies', 'MASimple@tv-basicstudies'],
    };

    let response;

    switch (embedType) {
      case 'iframe':
        const iframeUrl = `https://s.tradingview.com/embed-widget/advanced-chart/?locale=en#${encodeURIComponent(
          JSON.stringify({
            symbol,
            interval,
            theme,
            style: '1',
            enable_publishing: false,
            allow_symbol_change: allowSymbolChange,
            studies_overrides: {},
          })
        )}`;

        response = {
          type: 'iframe',
          html: `
            <div class="tradingview-widget-container" style="height:${height}px;width:100%;">
              <iframe 
                src="${iframeUrl}"
                style="width: 100%; height: 100%;"
                frameborder="0"
                allowtransparency="true"
                scrolling="no"
                allowfullscreen>
              </iframe>
              <div class="tradingview-widget-copyright">
                <a href="https://www.tradingview.com/symbols/${symbol}/" rel="noopener" target="_blank">
                  <span class="blue-text">${symbol} Chart</span>
                </a> by TradingView
              </div>
            </div>
          `,
          config: baseConfig,
        };
        break;

      case 'widget':
        response = {
          type: 'widget',
          html: `
            <div class="tradingview-widget-container" style="height:${height}px;width:100%;">
              <div id="${baseConfig.container_id}" style="height:100%;width:100%;"></div>
              <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
              <script type="text/javascript">
                new TradingView.widget({
                  "width": "100%",
                  "height": ${height},
                  "symbol": "${symbol}",
                  "interval": "${interval}",
                  "timezone": "Etc/UTC",
                  "theme": "${theme}",
                  "style": "1",
                  "locale": "en",
                  "toolbar_bg": "${baseConfig.toolbar_bg}",
                  "enable_publishing": false,
                  "allow_symbol_change": ${allowSymbolChange},
                  "container_id": "${baseConfig.container_id}",
                  "studies": ${JSON.stringify(studies.length > 0 ? studies : ['RSI@tv-basicstudies'])},
                  "show_popup_button": true,
                  "popup_width": "1000",
                  "popup_height": "650"
                });
              </script>
            </div>
          `,
          config: baseConfig,
        };
        break;

      case 'config':
        response = {
          type: 'config',
          config: baseConfig,
          libraryPath: '/charting_library/',
          datafeedUrl: '/api/tradingview/datafeed',
          customCssUrl: theme === 'dark' ? '/css/tradingview-dark.css' : null,
          overrides: theme === 'dark' ? {
            'paneProperties.background': '#1a1a1a',
            'paneProperties.vertGridProperties.color': '#2a2a2a',
            'paneProperties.horzGridProperties.color': '#2a2a2a',
            'symbolWatermarkProperties.transparency': 90,
            'scalesProperties.textColor': '#AAA',
            'mainSeriesProperties.candleStyle.wickUpColor': '#26a69a',
            'mainSeriesProperties.candleStyle.wickDownColor': '#ef5350',
          } : {},
        };
        break;

      default:
        throw new Error(`Unsupported embed type: ${embedType}`);
    }

    await state.set('charts', `${symbol}-${Date.now()}`, {
      symbol,
      config: baseConfig,
      embedType,
      requestedAt: new Date().toISOString(),
      traceId,
    });

    await emit({
      topic: 'chart.generated',
      data: {
        symbol,
        embedType,
        timestamp: new Date().toISOString(),
        traceId,
      },
    });

    return {
      status: 200,
      body: {
        success: true,
        symbol,
        embedType,
        ...response,
      },
    };
  } catch (error) {
    logger.error('Failed to generate TradingView chart', {
      error: error.message,
      symbol: req.body.symbol,
      traceId,
    });

    return {
      status: 500,
      body: {
        success: false,
        error: 'Failed to generate TradingView chart',
        message: error.message,
      },
    };
  }
};