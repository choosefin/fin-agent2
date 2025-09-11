# Intelligence by Finn - AI-Powered Financial Platform

A hybrid financial AI system combining Next.js frontend with Motia-orchestrated microservices for intelligent portfolio management, market analysis, and trading insights. Powered by multi-agent collaboration, persistent memory, and comprehensive financial data integration.

## Project Structure

```
finagent2/
├── apps/
│   ├── backend/                 # Motia backend application
│   │   ├── services/           # Business logic services
│   │   │   ├── pet-store.ts
│   │   │   └── types.ts
│   │   ├── steps/              # Motia steps (API, Event, Cron)
│   │   │   ├── api.step.ts
│   │   │   ├── notification.step.ts
│   │   │   ├── process-food-order.step.ts
│   │   │   └── state-audit-cron.step.ts
│   │   ├── motia-workbench.json
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── types.d.ts
│   │
│   └── web/                    # Next.js frontend application
│       ├── src/
│       │   ├── app/           # App Router pages
│       │   │   ├── layout.tsx
│       │   │   └── page.tsx
│       │   ├── components/    # React components
│       │   ├── hooks/         # Custom React hooks
│       │   └── lib/           # Utilities and API clients
│       ├── public/            # Static assets
│       ├── package.json
│       └── next.config.ts
│
├── packages/
│   ├── shared/                # Shared types and utilities
│   │   ├── src/
│   │   │   ├── types/        # TypeScript type definitions
│   │   │   ├── schemas/      # Zod validation schemas
│   │   │   └── utils/        # Shared utility functions
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ui/                    # Shared UI components
│   │   ├── src/
│   │   │   └── components/   # Reusable React components
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── config/                # Shared configuration
│       ├── eslint/           # ESLint configurations
│       ├── typescript/       # TypeScript configs
│       └── tailwind/         # Tailwind presets
│
├── docs/                      # Documentation
│   ├── architecture.md
│   ├── api-specification.md
│   └── deployment.md
│
├── .claude/                   # Claude AI configurations
├── .cursor/                   # Cursor AI rules
├── turbo.json                # Turborepo configuration
├── package.json              # Root workspace package.json
├── pnpm-workspace.yaml       # PNPM workspace configuration
└── .gitignore

```

## Key Features

### 🤖 Multi-Agent Financial Intelligence
- **6 Specialized AI Assistants**: General, Analyst, Trading, Investment Advisor, Risk Manager, Macro Economist
- **Agent Debate & Collaboration**: Multi-perspective analysis with structured turn-taking debates
- **Persistent Memory**: Context-aware conversations using mem0 for long-term memory
- **Parallel Search**: Simultaneous data gathering across news, SEC filings, social media, and market data

### 📊 Trading & Market Analysis
- **TradingView Integration**: Advanced charting with real-time Polygon.io data feeds
- **Brokerage Integration**: Trade execution through Alpaca API with risk controls
- **Multi-Asset Comparison**: Side-by-side analysis with AI-powered insights
- **Technical & Fundamental Analysis**: Comprehensive market evaluation

### 💼 Portfolio Management
- **Account Aggregation**: Secure connection via Plaid to banks and brokerages
- **Holistic Financial View**: Net worth tracking across all connected accounts
- **AI-Powered Recommendations**: Personalized advice based on complete financial picture
- **Risk Management**: Automated monitoring and alerts

### 🏗️ Technical Architecture
- **Hybrid Microservices**: TypeScript (Fastify) and Python services
- **Event-Driven Backend**: Motia orchestration with API, Event, and Cron steps
- **Cloud Native**: Azure container deployment with auto-scaling
- **Real-time Updates**: WebSocket support for live data streaming
- **Performance Optimization**: Redis caching layer for market data and API responses
- **Monorepo Management**: Turborepo for optimized builds and caching
- **Multi-Stage Docker**: Optimized container builds for production deployment

## Tech Stack

### Backend (Motia)
- **Framework**: Motia v0.6.4+ - Event-driven multi-language backend
- **Languages**: TypeScript (primary), Python for ML/AI services
- **Architecture**: Step-based (API, Event, Cron, NOOP steps)
- **AI Framework**: AgentScope for multi-agent orchestration
- **Memory**: mem0 for persistent agent memory
- **Caching**: Redis for high-performance data caching
- **Validation**: Zod schemas
- **State**: Built-in state management with traceId scoping

### Frontend (Next.js)
- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: TradingView Advanced Charts
- **Authentication**: Supabase Auth
- **State Management**: React Context / Zustand
- **Data Fetching**: React Query / SWR
- **UI Components**: Radix UI / shadcn/ui

### Integrations
- **Market Data**: Polygon.io for real-time quotes and historical data
- **Trading**: Alpaca API for brokerage operations
- **Banking**: Plaid for account aggregation
- **Database**: Supabase (PostgreSQL with row-level security)
- **Cloud**: Microsoft Azure (Container Instances/AKS)

### Shared Packages
- **shared**: Type definitions, Zod schemas, utilities
- **ui**: Reusable React components
- **config**: Shared ESLint, TypeScript, Tailwind configs

## Getting Started

### Prerequisites
- Node.js 18+
- PNPM 8+ (recommended) or NPM
- Git

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/finagent2.git
cd finagent2
```

2. Install dependencies
```bash
pnpm install
```

3. Set up environment variables
```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env
```

### Development

Run all applications in development mode:
```bash
pnpm dev
```

Run specific apps:
```bash
pnpm dev --filter=backend  # Motia backend only
pnpm dev --filter=web      # Next.js frontend only
```

### Building

Build all applications:
```bash
pnpm build
```

Build specific apps:
```bash
pnpm build --filter=backend
pnpm build --filter=web
```

### Testing

Run tests across all packages:
```bash
pnpm test
```

Run tests for specific package:
```bash
pnpm test --filter=backend
pnpm test --filter=web
```

## API Communication

The Next.js frontend communicates with the Motia backend through:

1. **REST API Endpoints**: Defined in `apps/backend/steps/api.step.ts`
2. **Type Safety**: Shared Zod schemas in `packages/shared`
3. **Authentication**: JWT tokens (implementation pending)
4. **Real-time Updates**: WebSocket support (planned)

## Deployment

### Local Development with Docker
```bash
# Start all services (backend, frontend, Redis)
docker-compose up

# Access services
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:3001
# - Redis: localhost:6379
```

### Azure Deployment
```bash
# Deploy to Azure Container Instances
./scripts/azure-deploy.sh

# Or use ARM template directly
az deployment group create \
  --resource-group finagent-rg \
  --template-file azure-deploy.json \
  --parameters azure-deploy.parameters.json
```

### Backend (Motia)
- Deploy using Motia's built-in deployment tools
- Supports AWS Lambda, Google Cloud Functions, Azure Functions
- Container deployment via Docker with multi-stage builds
- Redis caching layer for improved performance

### Frontend (Next.js)
- Vercel (recommended)
- Netlify
- AWS Amplify
- Self-hosted via Docker
- Azure Container Instances (production)

## Scripts

### Root Level
- `pnpm dev` - Start all apps in development
- `pnpm build` - Build all apps
- `pnpm test` - Run all tests
- `pnpm lint` - Lint all packages
- `pnpm clean` - Clean all build artifacts

### Backend (Motia)
- `pnpm dev` - Start Motia development server
- `pnpm build` - Build Motia application
- `pnpm generate-types` - Generate TypeScript types
- `pnpm clean` - Clean build artifacts

### Frontend (Next.js)
- `pnpm dev` - Start Next.js dev server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## Architecture Decisions

### Why Turborepo?
- **Optimized Builds**: Intelligent caching and parallel execution
- **Code Sharing**: Easy sharing of types, schemas, and components
- **Independent Deployment**: Deploy backend and frontend separately
- **Developer Experience**: Single command to run entire stack

### Why Motia + Next.js?
- **Motia**: Powerful event-driven backend with multi-language support
- **Next.js**: Modern React framework with SSR/SSG capabilities
- **Type Safety**: End-to-end type safety with shared schemas
- **Scalability**: Both frameworks designed for production scale

### Why Multi-Agent Architecture?
- **Specialized Expertise**: Each agent focuses on specific financial domains
- **Collaborative Intelligence**: Agents debate and reach consensus for better decisions
- **Parallel Processing**: Multiple agents work simultaneously on complex analysis
- **Persistent Context**: mem0 enables long-term relationship building

## Security & Compliance

- **Authentication**: Multi-factor authentication via Supabase
- **Data Encryption**: End-to-end encryption for sensitive financial data
- **Row-Level Security**: PostgreSQL RLS policies for data isolation
- **Audit Logging**: Complete audit trail of all agent actions and data access
- **Compliance Ready**: Built for financial industry standards

## License

Source Available - See [LICENSE.md](LICENSE.md) for details
