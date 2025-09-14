# TradingView Chart Integration

This implementation provides multiple ways to embed TradingView charts when users request stock/crypto symbols.

## Available Endpoints

### 1. Symbol Chart Response API
**Endpoint:** `POST /api/symbol-chart`

Intelligent endpoint that extracts symbols from natural language queries and returns embeddable charts.

```javascript
// Request
POST /api/symbol-chart
{
  "query": "Show me AAPL chart",
  "preferences": {
    "theme": "dark",
    "defaultInterval": "1D",
    "preferredIndicators": ["RSI@tv-basicstudies"]
  }
}

// Response includes embeddable HTML with TradingView widget
```

**Features:**
- Natural language processing (e.g., "How is Apple doing?" → AAPL chart)
- Smart symbol extraction
- Returns ready-to-embed HTML
- Customizable themes and indicators

### 2. TradingView Chart API
**Endpoint:** `POST /api/tradingview-chart`

Direct chart generation with multiple embed options.

```javascript
// Request
POST /api/tradingview-chart
{
  "symbol": "TSLA",
  "embedType": "widget", // "widget" | "iframe" | "config"
  "theme": "dark",
  "height": 600,
  "interval": "1D",
  "studies": ["RSI@tv-basicstudies", "MACD@tv-basicstudies"]
}
```

**Embed Types:**
- `widget`: Full TradingView widget with JS
- `iframe`: Simple iframe embed
- `config`: Returns configuration only (for custom implementations)

### 3. Quick Chart API
**Endpoint:** `GET /api/chart/:symbol`

Direct URL access to full-page charts.

```
GET /api/chart/AAPL?theme=dark&interval=1D
```

**Use Cases:**
- Direct links in chat responses
- Iframe embedding
- Full-page chart views

## Integration Examples

### Chat Bot Integration
When a user mentions a symbol, respond with an embedded chart:

```javascript
// Detect symbol in user message
if (userMessage.includes('AAPL') || userMessage.includes('Apple')) {
  const chartResponse = await fetch('/api/symbol-chart', {
    method: 'POST',
    body: JSON.stringify({
      query: userMessage,
      preferences: { theme: 'light' }
    })
  });
  
  const data = await chartResponse.json();
  // data.chart.html contains ready-to-render chart
  return {
    message: data.message,
    html: data.chart.html
  };
}
```

### Direct Embedding
```html
<!-- Embed chart directly in page -->
<iframe 
  src="http://localhost:5173/api/chart/BTCUSD?theme=dark" 
  width="100%" 
  height="600">
</iframe>
```

### React Component Usage
```jsx
function StockChart({ symbol }) {
  const [chartHtml, setChartHtml] = useState('');
  
  useEffect(() => {
    fetch('/api/tradingview-chart', {
      method: 'POST',
      body: JSON.stringify({
        symbol,
        embedType: 'widget',
        theme: 'light'
      })
    })
    .then(res => res.json())
    .then(data => setChartHtml(data.html));
  }, [symbol]);
  
  return <div dangerouslySetInnerHTML={{ __html: chartHtml }} />;
}
```

## Event Flow

The implementation uses Motia's event-driven architecture:

1. **Chart Request** → `chart.requested` event
2. **Symbol Parsing** → `symbol.parsed` event  
3. **Metadata Fetching** → `chart.metadata.fetched` event
4. **Chart Generation** → `chart.generated` event
5. **Chart Enhancement** → `chart.enhanced` event

## Supported Symbols

- **Stocks**: AAPL, MSFT, GOOGL, TSLA, etc.
- **Crypto**: BTCUSD, ETHUSD, SOLUSD, etc.
- **Forex**: EURUSD, GBPUSD, USDJPY, etc.
- **Indices**: SPX, NDX, DJI, etc.

The system recognizes both ticker symbols and company names:
- "Apple" → AAPL
- "Bitcoin" → BTCUSD
- "S&P" → SPX

## Testing

Open `test-tradingview-chart.html` in a browser to test all endpoints:

```bash
# Start the Motia dev server
npm run dev

# Open test page
open apps/backend/test-tradingview-chart.html
```

## Configuration Options

### Available Indicators
- `RSI@tv-basicstudies` - Relative Strength Index
- `MACD@tv-basicstudies` - MACD
- `MASimple@tv-basicstudies` - Simple Moving Average
- `BB@tv-basicstudies` - Bollinger Bands
- `Volume@tv-basicstudies` - Volume
- `Stochastic@tv-basicstudies` - Stochastic

### Timeframes
- `1`, `5`, `15`, `30` - Minutes
- `60`, `240` - Hours  
- `1D` - Daily
- `1W` - Weekly
- `1M` - Monthly

### Themes
- `light` - Light theme
- `dark` - Dark theme

## Notes

- Charts are interactive and real-time
- Data is provided by TradingView
- Charts include basic technical indicators by default
- Symbol metadata is cached for 5 minutes to reduce API calls
- All chart requests are tracked via Motia events for analytics