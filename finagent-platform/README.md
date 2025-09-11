# FinAgent Platform - TradingView Chart Integration

A Next.js application with TradingView Advanced Charts integration, powered by Polygon.io data feeds and Mastra AI framework for intelligent financial analysis.

## Features

- 📊 **TradingView Advanced Charts**: Interactive financial charts with real-time data
- 🔍 **Intelligent Symbol Recognition**: Extract stock symbols from natural language queries
- 📈 **Polygon.io Data Integration**: Real-time and historical market data
- 🤖 **Mastra AI Agents**: Intelligent chart analysis and recommendations
- 🌓 **Dark/Light Theme**: Customizable chart themes
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🔄 **Real-time Updates**: WebSocket support for live data streaming

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **AI Framework**: Mastra Core for agent orchestration
- **Data Provider**: Polygon.io for market data
- **Charts**: TradingView Advanced Charts library
- **Database**: Supabase (PostgreSQL)
- **State Management**: React hooks and context

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Polygon.io API key
- TradingView Advanced Charts library (commercial license required for production)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd finagent-platform
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:
```env
POLYGON_API_KEY=your_polygon_api_key
NEXT_PUBLIC_POLYGON_API_KEY=your_polygon_api_key
OPENAI_API_KEY=your_openai_api_key
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
finagent-platform/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── api/                # API routes
│   │   │   └── chart/          # Chart-related endpoints
│   │   └── chart/              # Chart page
│   ├── components/             # React components
│   │   └── charts/             # Chart components
│   ├── lib/                    # Core libraries
│   │   ├── agents/             # Mastra AI agents
│   │   ├── services/           # Business logic services
│   │   └── tradingview/        # TradingView integration
│   └── styles/                 # Global styles
├── public/                     # Static assets
└── package.json               # Dependencies
```

## API Endpoints

### Chart Symbol API
```http
GET /api/chart/symbol/:symbol
```
Generate chart for a specific symbol.

Query parameters:
- `interval`: Time interval (1, 5, 15, 30, 60, 1D, 1W, 1M)
- `theme`: Chart theme (light, dark)
- `fullscreen`: Open in fullscreen (true, false)

### Chart Search API
```http
POST /api/chart/search
```
Analyze query and extract symbols for charting.

Request body:
```json
{
  "query": "Show me AAPL and MSFT charts",
  "theme": "dark",
  "interval": "1D"
}
```

## Usage Examples

### Basic Chart Display
```tsx
import TradingViewChart from '@/components/charts/TradingViewChart';

<TradingViewChart
  symbol="NASDAQ:AAPL"
  theme="dark"
  interval="1D"
  height={600}
/>
```

### Using Chart Agent
```typescript
import { ChartAgent } from '@/lib/agents/chart-agent';

const agent = new ChartAgent();
const result = await agent.analyzeCharts("Show me Tesla stock chart", {
  theme: "light",
  interval: "1H"
});
```

### Symbol Parser
```typescript
import { SymbolParserService } from '@/lib/services/symbol-parser';

const parser = new SymbolParserService(apiKey);
const symbols = await parser.parseQuery("Compare AAPL and GOOGL performance");
// Returns: [{ symbol: 'AAPL', ... }, { symbol: 'GOOGL', ... }]
```

## Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
npm start
```

### Linting
```bash
npm run lint
```

## Deployment

The application is designed to be deployed on Azure Container Instances:

1. Build Docker image:
```bash
docker build -t finagent-platform .
```

2. Push to Azure Container Registry:
```bash
az acr build --registry <registry-name> --image finagent-platform .
```

3. Deploy to Azure Container Instances:
```bash
az container create --resource-group <rg-name> --name finagent --image <registry-name>.azurecr.io/finagent-platform:latest
```

## License

This project requires appropriate licenses for:
- TradingView Advanced Charts (commercial license)
- Polygon.io API (based on subscription tier)
- Other third-party services as applicable

## Support

For issues and questions:
- Open an issue in the GitHub repository
- Check the documentation
- Contact the development team
