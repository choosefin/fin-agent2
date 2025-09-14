interface ChartConfig {
  symbol: string;
  theme?: 'light' | 'dark';
  height?: number;
  interval?: string;
  showToolbar?: boolean;
  indicators?: string[];
}

export function extractSymbolFromQuery(query: string): string | null {
  const upperQuery = query.toUpperCase();
  
  // Common stock and crypto mappings
  const commonSymbols: Record<string, string> = {
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
    'GOLD': 'GC=F',
    'SILVER': 'SI=F',
    'OIL': 'CL=F',
  };

  // Check for company names first
  for (const [name, symbol] of Object.entries(commonSymbols)) {
    if (upperQuery.includes(name)) {
      return symbol;
    }
  }

  // Check for ticker symbols (1-5 uppercase letters, optionally followed by . and 1-2 letters)
  const tickerMatch = query.match(/\b([A-Z]{1,5}(?:\.[A-Z]{1,2})?)\b/);
  if (tickerMatch) {
    return tickerMatch[1];
  }

  // Check for crypto symbols
  const cryptoMatch = query.match(/\b(BTC|ETH|SOL|ADA|DOT|AVAX|MATIC|LINK|UNI|AAVE|XRP|BNB|DOGE|SHIB)(?:USD)?\b/i);
  if (cryptoMatch) {
    const crypto = cryptoMatch[1].toUpperCase();
    return crypto.includes('USD') ? crypto : `${crypto}USD`;
  }

  // Check for forex pairs
  const forexMatch = query.match(/\b(EUR|GBP|JPY|AUD|CAD|CHF|NZD)\s*\/?\s*(USD|EUR|GBP|JPY)\b/i);
  if (forexMatch) {
    return `${forexMatch[1].toUpperCase()}${forexMatch[2].toUpperCase()}`;
  }

  return null;
}

export async function generateTradingViewChart(config: ChartConfig): Promise<string> {
  const {
    symbol,
    theme = 'light',
    height = 500,
    interval = '1D',
    showToolbar = true,
    indicators = ['RSI@tv-basicstudies'],
  } = config;

  const containerId = `tradingview_${symbol.toLowerCase()}_${Date.now()}`;

  const widgetConfig = {
    autosize: false,
    width: '100%',
    height,
    symbol: symbol.toUpperCase(),
    interval,
    timezone: 'Etc/UTC',
    theme,
    style: '1',
    locale: 'en',
    toolbar_bg: theme === 'dark' ? '#1a1a1a' : '#f1f3f6',
    enable_publishing: false,
    allow_symbol_change: true,
    container_id: containerId,
    studies: indicators,
    show_popup_button: true,
    popup_width: '1000',
    popup_height: '650',
    hide_side_toolbar: !showToolbar,
  };

  return `
    <div class="tradingview-chart-wrapper" style="width:100%;margin:20px 0;">
      <div class="chart-header" style="padding:12px 16px;background:${theme === 'dark' ? '#1a1a1a' : '#f7f9fc'};border:1px solid ${theme === 'dark' ? '#333' : '#e1e4e8'};border-bottom:none;border-radius:8px 8px 0 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h3 style="margin:0;color:${theme === 'dark' ? '#fff' : '#24292e'};font-size:16px;font-weight:600;">
              ${symbol.toUpperCase()} Chart
            </h3>
            <p style="margin:4px 0 0;color:${theme === 'dark' ? '#8b949e' : '#586069'};font-size:13px;">
              Interactive chart • ${interval} timeframe • Real-time data
            </p>
          </div>
          <div style="display:flex;gap:8px;">
            <span style="padding:4px 10px;background:${theme === 'dark' ? '#21262d' : '#f6f8fa'};color:${theme === 'dark' ? '#58a6ff' : '#0969da'};border-radius:6px;font-size:12px;font-weight:500;">
              ${interval}
            </span>
            <span style="padding:4px 10px;background:${theme === 'dark' ? '#1f6feb20' : '#ddf4ff'};color:${theme === 'dark' ? '#58a6ff' : '#0969da'};border-radius:6px;font-size:12px;font-weight:500;">
              Live
            </span>
          </div>
        </div>
      </div>
      <div class="tradingview-widget-container" style="height:${height}px;width:100%;border:1px solid ${theme === 'dark' ? '#333' : '#e1e4e8'};border-top:none;border-radius:0 0 8px 8px;overflow:hidden;background:${theme === 'dark' ? '#0d1117' : '#ffffff'};">
        <div id="${containerId}" style="height:100%;width:100%;"></div>
        <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
        <script type="text/javascript">
          (function() {
            try {
              new TradingView.widget(${JSON.stringify(widgetConfig)});
            } catch (e) {
              console.error('TradingView widget initialization failed:', e);
              document.getElementById('${containerId}').innerHTML = '<div style="padding:20px;text-align:center;color:${theme === 'dark' ? '#8b949e' : '#586069'};">Chart loading failed. Please refresh the page.</div>';
            }
          })();
        </script>
      </div>
      <div class="chart-actions" style="padding:12px 16px;background:${theme === 'dark' ? '#161b22' : '#f6f8fa'};border:1px solid ${theme === 'dark' ? '#333' : '#e1e4e8'};border-top:none;border-radius:0 0 8px 8px;margin-top:-1px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <a href="https://www.tradingview.com/symbols/${symbol}/" target="_blank" rel="noopener" style="color:${theme === 'dark' ? '#58a6ff' : '#0969da'};text-decoration:none;font-size:13px;font-weight:500;">
            View on TradingView →
          </a>
          <div style="display:flex;gap:12px;font-size:12px;color:${theme === 'dark' ? '#8b949e' : '#586069'};">
            <span>📊 Full screen</span>
            <span>📈 Add indicators</span>
            <span>⚙️ Settings</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function isChartRequest(message: string): boolean {
  const chartKeywords = [
    'chart', 'graph', 'show', 'display', 'view', 
    'price', 'stock', 'crypto', 'ticker', 'trading',
    'candle', 'technical', 'analysis', 'market'
  ];
  
  const lowerMessage = message.toLowerCase();
  return chartKeywords.some(keyword => lowerMessage.includes(keyword));
}

export function getSymbolType(symbol: string): 'stock' | 'crypto' | 'forex' | 'commodity' | 'index' {
  const upperSymbol = symbol.toUpperCase();
  
  // Crypto patterns
  if (upperSymbol.endsWith('USD') || upperSymbol.endsWith('USDT') || upperSymbol.endsWith('BTC')) {
    return 'crypto';
  }
  
  // Forex patterns
  if (/^[A-Z]{3}[A-Z]{3}$/.test(upperSymbol)) {
    return 'forex';
  }
  
  // Commodity futures
  if (upperSymbol.includes('=F') || ['GC', 'SI', 'CL', 'NG', 'ZW', 'ZC'].includes(upperSymbol)) {
    return 'commodity';
  }
  
  // Index patterns
  if (['SPX', 'NDX', 'DJI', 'VIX', 'RUT', 'FTSE', 'DAX', 'N225'].includes(upperSymbol)) {
    return 'index';
  }
  
  return 'stock';
}

export function getDefaultIndicators(symbolType: string): string[] {
  switch (symbolType) {
    case 'crypto':
      return ['RSI@tv-basicstudies', 'BB@tv-basicstudies', 'MACD@tv-basicstudies'];
    case 'forex':
      return ['RSI@tv-basicstudies', 'MASimple@tv-basicstudies', 'Stochastic@tv-basicstudies'];
    case 'commodity':
      return ['RSI@tv-basicstudies', 'CCI@tv-basicstudies', 'MACD@tv-basicstudies'];
    case 'index':
      return ['RSI@tv-basicstudies', 'MASimple@tv-basicstudies', 'Volume@tv-basicstudies'];
    default:
      return ['RSI@tv-basicstudies', 'MASimple@tv-basicstudies', 'MACD@tv-basicstudies'];
  }
}

export function getSuggestedTimeframes(symbolType: string): string[] {
  switch (symbolType) {
    case 'crypto':
      return ['1', '5', '15', '60', '240', '1D', '1W'];
    case 'forex':
      return ['1', '5', '15', '30', '60', '240', '1D'];
    case 'commodity':
      return ['60', '240', '1D', '1W', '1M'];
    case 'index':
      return ['5', '15', '60', '1D', '1W', '1M'];
    default:
      return ['5', '15', '60', '1D', '1W', '1M'];
  }
}