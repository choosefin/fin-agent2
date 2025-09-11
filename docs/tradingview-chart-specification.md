# TradingView Chart Feature Specification

## Overview

This specification defines the implementation requirements for integrating TradingView's Advanced Charts library with Polygon.io data feed adapter to provide interactive financial charting capabilities. The feature enables users to access detailed chart analysis for any financial symbol through dynamically generated links that open the TradingView charting interface.

## Feature Description

### Core Functionality
When users query about a particular financial symbol (e.g., "Show me AAPL chart" or "Analyze TSLA"), the system:

1. **Symbol Detection**: Identifies financial symbols in user queries using natural language processing
2. **Link Generation**: Creates a dynamic URL that opens the TradingView chart for the specific symbol
3. **Chart Display**: Opens the customized TradingView charting library with the symbol pre-loaded
4. **Data Integration**: Uses Polygon.io data feed adapter to provide real-time and historical market data

### User Experience Flow
```
User Query → Symbol Extraction → Chart URL Generation → TradingView Chart Opens → Real-time Data Display
```

## Technical Architecture

### Component Overview
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   User Query    │───▶│  Symbol Parser   │───▶│   Chart Generator   │
│   Processing    │    │    & Validator   │    │                     │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                                                           │
                                                           ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│  TradingView    │◄───│   Data Feed      │◄───│   Chart URL with    │
│    Library      │    │    Adapter       │    │   Symbol Parameter  │
│                 │    │  (Polygon.io)    │    │                     │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
```

### Technology Stack

#### Frontend Integration
- **TradingView Advanced Charts Library**: Proprietary charting solution
- **Chart Container**: HTML container element for chart rendering
- **URL Router**: Navigation handler for chart links
- **Responsive Design**: Mobile and desktop compatibility

#### Backend Components
- **Symbol Recognition Service**: NLP-based symbol extraction from queries
- **Chart URL Builder**: Dynamic link generation with symbol parameters
- **Data Feed Adapter**: Polygon.io integration for market data
- **Authentication Handler**: API key management for Polygon.io

## Implementation Requirements

### 1. TradingView Advanced Charts Integration

#### Library Setup
```javascript
// Chart configuration
const chartConfig = {
  container: 'chart-container',
  library_path: '/charting_library/',
  locale: 'en',
  charts_storage_url: 'https://saveload.tradingview.com',
  charts_storage_api_version: '1.1',
  client_id: 'finagent-platform',
  user_id: 'user_unique_id',
  fullscreen: false,
  autosize: true,
  studies_overrides: {},
  theme: 'light', // or 'dark'
  custom_css_url: '/chart-styles.css',
  loading_screen: { backgroundColor: '#000000' },
  disabled_features: [
    'use_localstorage_for_settings',
    'volume_force_overlay'
  ],
  enabled_features: [
    'study_templates',
    'side_toolbar_in_fullscreen_mode'
  ],
  debug: false,
  symbol: 'NASDAQ:AAPL', // Dynamic symbol parameter
  interval: '1D',
  datafeed: new PolygonDatafeedAdapter(), // Custom adapter
  time_frames: [
    { text: '1M', resolution: '1D', description: '1 Month' },
    { text: '3M', resolution: '1D', description: '3 Months' },
    { text: '1Y', resolution: '1W', description: '1 Year' },
    { text: '5Y', resolution: '1M', description: '5 Years' }
  ]
};
```

#### Chart Container HTML
```html
<div id="chart-container" style="height: 600px; width: 100%;"></div>
<script>
  const widget = new TradingView.widget(chartConfig);
</script>
```

### 2. Polygon.io Data Feed Adapter

#### Adapter Interface
```javascript
class PolygonDatafeedAdapter {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.polygon.io';
    this.supportedResolutions = ['1', '5', '15', '30', '60', '1D', '1W', '1M'];
  }

  // Required TradingView methods
  onReady(callback) {
    // Return datafeed configuration
    callback({
      supported_resolutions: this.supportedResolutions,
      supports_marks: false,
      supports_timescale_marks: false,
      supports_time: true,
      exchanges: [
        { value: 'NASDAQ', name: 'NASDAQ', desc: 'NASDAQ Exchange' },
        { value: 'NYSE', name: 'NYSE', desc: 'New York Stock Exchange' }
      ],
      symbols_types: [
        { name: 'stock', value: 'stock' },
        { name: 'crypto', value: 'crypto' },
        { name: 'forex', value: 'forex' }
      ]
    });
  }

  searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
    // Search symbols using Polygon API
    const searchUrl = `${this.baseUrl}/v3/reference/tickers?search=${userInput}&apikey=${this.apiKey}`;
    // Process and return search results
  }

  resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
    // Resolve symbol information
    const symbolInfo = {
      ticker: symbolName,
      name: symbolName,
      description: 'Stock Symbol',
      type: 'stock',
      session: '0930-1600',
      timezone: 'America/New_York',
      exchange: 'NASDAQ',
      minmov: 1,
      pricescale: 100,
      has_intraday: true,
      supported_resolutions: this.supportedResolutions,
      volume_precision: 0,
      data_status: 'streaming'
    };
    onSymbolResolvedCallback(symbolInfo);
  }

  getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
    // Fetch historical data from Polygon
    const { from, to, firstDataRequest } = periodParams;
    const aggregatesUrl = `${this.baseUrl}/v2/aggs/ticker/${symbolInfo.ticker}/range/1/${resolution}/${from * 1000}/${to * 1000}?apikey=${this.apiKey}`;
    
    // Process and return bar data
  }

  subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
    // WebSocket connection for real-time data
    const wsUrl = `wss://socket.polygon.io/stocks`;
    this.subscribeToWebSocket(symbolInfo.ticker, onRealtimeCallback);
  }

  unsubscribeBars(subscriberUID) {
    // Cleanup WebSocket subscriptions
  }
}
```

### 3. Symbol Recognition & URL Generation

#### Symbol Parser Service
```javascript
class SymbolParserService {
  constructor() {
    this.symbolRegex = /\b[A-Z]{1,5}\b/g; // Basic symbol pattern
    this.exchangeMap = {
      'NASDAQ': 'NASDAQ',
      'NYSE': 'NYSE',
      'CRYPTO': 'CRYPTO'
    };
  }

  extractSymbols(query) {
    // Extract potential symbols from user query
    const matches = query.match(this.symbolRegex) || [];
    return matches.filter(this.validateSymbol.bind(this));
  }

  validateSymbol(symbol) {
    // Validate against known symbols or API
    return symbol.length >= 1 && symbol.length <= 5;
  }

  async resolveSymbolWithExchange(symbol) {
    // Use Polygon API to get full symbol info
    const response = await fetch(`https://api.polygon.io/v3/reference/tickers/${symbol}?apikey=${API_KEY}`);
    const data = await response.json();
    return data.results ? `${data.results.primary_exchange}:${symbol}` : symbol;
  }
}
```

#### Chart URL Builder
```javascript
class ChartUrlBuilder {
  constructor(baseUrl = '/chart') {
    this.baseUrl = baseUrl;
  }

  generateChartUrl(symbol, options = {}) {
    const params = new URLSearchParams({
      symbol: symbol,
      interval: options.interval || '1D',
      theme: options.theme || 'light',
      fullscreen: options.fullscreen || 'false',
      studies: options.studies || '',
      ...options.customParams
    });

    return `${this.baseUrl}?${params.toString()}`;
  }

  generateEmbedUrl(symbol, options = {}) {
    const params = new URLSearchParams({
      symbol: symbol,
      interval: options.interval || '1D',
      theme: options.theme || 'light',
      toolbar: options.toolbar || 'false',
      withdateranges: options.dateRanges || 'true',
      hide_side_toolbar: options.hideSideToolbar || 'false',
      allow_symbol_change: options.allowSymbolChange || 'true',
      save_image: options.saveImage || 'false',
      container_id: options.containerId || 'tradingview_chart'
    });

    return `${this.baseUrl}/embed?${params.toString()}`;
  }
}
```

### 4. Agent Integration

#### Chart Agent Implementation
```javascript
class ChartAgent extends AgentBase {
  constructor() {
    super();
    this.name = 'ChartAgent';
    this.capabilities = ['chart_generation', 'symbol_analysis', 'technical_analysis'];
    this.symbolParser = new SymbolParserService();
    this.urlBuilder = new ChartUrlBuilder();
  }

  async execute(query, context) {
    try {
      // Extract symbols from query
      const symbols = this.symbolParser.extractSymbols(query);
      
      if (symbols.length === 0) {
        return {
          success: false,
          message: "No valid symbols found in query",
          type: "validation_error"
        };
      }

      // Generate chart URLs for all found symbols
      const chartLinks = await Promise.all(
        symbols.map(async (symbol) => {
          const resolvedSymbol = await this.symbolParser.resolveSymbolWithExchange(symbol);
          const chartUrl = this.urlBuilder.generateChartUrl(resolvedSymbol, {
            theme: context.user?.preferences?.theme || 'light',
            interval: this.determineInterval(query)
          });

          return {
            symbol: symbol,
            resolvedSymbol: resolvedSymbol,
            chartUrl: chartUrl,
            description: `Interactive chart for ${symbol}`
          };
        })
      );

      return {
        success: true,
        type: "chart_links",
        data: {
          charts: chartLinks,
          message: `Generated ${chartLinks.length} chart link(s)`
        }
      };

    } catch (error) {
      return this.handleError(error);
    }
  }

  determineInterval(query) {
    // Analyze query for time frame hints
    const intervalMap = {
      'minute': '1',
      'hour': '60', 
      'hourly': '60',
      'daily': '1D',
      'day': '1D',
      'weekly': '1W',
      'week': '1W',
      'monthly': '1M',
      'month': '1M'
    };

    for (const [key, value] of Object.entries(intervalMap)) {
      if (query.toLowerCase().includes(key)) {
        return value;
      }
    }
    return '1D'; // Default
  }
}
```

### 5. Frontend Integration

#### React Chart Component
```jsx
import React, { useEffect, useRef } from 'react';

const TradingViewChart = ({ symbol, theme = 'light', height = 600 }) => {
  const chartContainerRef = useRef(null);
  const widgetRef = useRef(null);

  useEffect(() => {
    if (chartContainerRef.current) {
      const script = document.createElement('script');
      script.src = '/charting_library/charting_library.min.js';
      script.async = true;
      script.onload = () => {
        widgetRef.current = new window.TradingView.widget({
          container: chartContainerRef.current,
          library_path: '/charting_library/',
          locale: 'en',
          disabled_features: ['use_localstorage_for_settings'],
          enabled_features: ['study_templates'],
          charts_storage_url: 'https://saveload.tradingview.com',
          charts_storage_api_version: '1.1',
          client_id: 'finagent-platform',
          user_id: 'unique_user_id',
          fullscreen: false,
          autosize: true,
          symbol: symbol,
          interval: '1D',
          datafeed: new window.PolygonDatafeedAdapter(process.env.REACT_APP_POLYGON_API_KEY),
          theme: theme,
          height: height
        });
      };
      document.head.appendChild(script);
    }

    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove();
      }
    };
  }, [symbol, theme, height]);

  return <div ref={chartContainerRef} style={{ height: `${height}px`, width: '100%' }} />;
};

export default TradingViewChart;
```

#### Chart Link Component
```jsx
import React from 'react';

const ChartLink = ({ symbol, resolvedSymbol, chartUrl, description }) => {
  const handleChartClick = (e) => {
    e.preventDefault();
    // Open chart in modal or new tab
    window.open(chartUrl, '_blank', 'width=1200,height=800');
  };

  return (
    <div className="chart-link-container">
      <button 
        onClick={handleChartClick}
        className="chart-link-button"
        aria-label={`Open chart for ${symbol}`}
      >
        <div className="chart-icon">📈</div>
        <div className="chart-info">
          <div className="symbol">{symbol}</div>
          <div className="description">{description}</div>
        </div>
        <div className="chart-action">View Chart →</div>
      </button>
    </div>
  );
};

export default ChartLink;
```

### 6. API Endpoints

#### Chart Service Routes
```javascript
// Express.js routes
app.get('/api/chart/symbol/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval, theme, fullscreen } = req.query;

    const chartAgent = new ChartAgent();
    const result = await chartAgent.execute(`Show chart for ${symbol}`, {
      user: req.user,
      options: { interval, theme, fullscreen }
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/chart/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const chartAgent = new ChartAgent();
    const result = await chartAgent.execute(query, { user: req.user });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/chart', (req, res) => {
  // Serve chart page with embedded TradingView widget
  const { symbol, interval, theme } = req.query;
  res.render('chart', { symbol, interval, theme });
});
```

## Configuration Requirements

### Environment Variables
```env
# Polygon.io Configuration
POLYGON_API_KEY=your_polygon_api_key
POLYGON_BASE_URL=https://api.polygon.io
POLYGON_WS_URL=wss://socket.polygon.io

# TradingView Configuration
TRADINGVIEW_CLIENT_ID=finagent-platform
TRADINGVIEW_LIBRARY_PATH=/static/charting_library/
TRADINGVIEW_STORAGE_URL=https://saveload.tradingview.com

# Application Configuration
CHART_BASE_URL=https://yourapp.com/chart
DEFAULT_CHART_THEME=light
DEFAULT_CHART_INTERVAL=1D
```

### TradingView Library Setup
1. **License Agreement**: Obtain TradingView Advanced Charts license
2. **Library Download**: Download and host the charting library files
3. **Static Assets**: Serve library files from `/static/charting_library/`
4. **Font Loading**: Include TradingView fonts and icons

### Polygon.io Setup
1. **API Key**: Obtain Polygon.io API key with appropriate tier
2. **Rate Limits**: Configure rate limiting based on subscription
3. **WebSocket**: Set up WebSocket connections for real-time data
4. **Data Permissions**: Ensure proper exchange data permissions

## Security Considerations

### API Key Management
- Store API keys securely in environment variables
- Implement API key rotation policies
- Use server-side proxy for API calls to hide keys from frontend
- Monitor API usage and implement rate limiting

### Data Access Control
- Implement user authentication for chart access
- Validate symbol requests to prevent abuse
- Log chart access for audit purposes
- Implement CORS policies for chart embedding

### Performance Optimization
- Cache symbol metadata and market data
- Implement connection pooling for WebSocket connections
- Use CDN for TradingView library assets
- Optimize chart loading with lazy loading techniques

## Testing Strategy

### Unit Tests
- Symbol parser functionality
- URL generation logic
- Data feed adapter methods
- Chart agent execution flows

### Integration Tests
- Polygon.io API integration
- TradingView library integration
- Chart rendering and interaction
- WebSocket real-time data flow

### End-to-End Tests
- Complete user workflow from query to chart display
- Cross-browser compatibility testing
- Mobile responsiveness testing
- Performance testing with large datasets

## Deployment Considerations

### Infrastructure Requirements
- Static file hosting for TradingView library
- WebSocket support for real-time data
- Sufficient bandwidth for chart data
- CDN for global chart performance

### Monitoring and Logging
- Track chart usage metrics
- Monitor API rate limits and errors
- Log user interactions with charts
- Set up alerts for service degradation

### Scalability Planning
- Horizontal scaling for increased chart requests
- Caching strategies for market data
- Load balancing for WebSocket connections
- Database optimization for symbol metadata

## Future Enhancements

### Advanced Features
- Multi-symbol chart comparisons
- Custom indicator integration
- Chart sharing and collaboration
- Mobile native chart applications

### AI Integration
- Automated technical analysis
- Chart pattern recognition
- AI-generated trading insights
- Personalized chart recommendations

### Data Enhancement
- Additional data sources integration
- Alternative data feeds (news, social sentiment)
- Economic indicator overlays
- Sector and industry comparisons

---

*This specification provides a comprehensive foundation for implementing TradingView chart integration with Polygon.io data feeds in the FinAgent platform.*