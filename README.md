# Intelligence by Finn - AI-Powered Financial Platform

A hybrid financial AI system combining Next.js frontend with Motia-orchestrated backend services for intelligent portfolio management, market analysis, and trading insights. Powered by Mastra AI framework for multi-agent collaboration and comprehensive financial data integration.

## Project Structure

```
finagent2/
├── apps/
│   ├── backend/                 # Motia backend application
│   │   ├── config/             # Security and app configuration
│   │   ├── middleware/         # Authentication and rate limiting
│   │   ├── services/           # Business logic services
│   │   │   ├── auth.service.ts
│   │   │   ├── azure-openai.service.ts
│   │   │   ├── cache.service.ts
│   │   │   ├── database.service.ts
│   │   │   └── encryption.service.ts
│   │   ├── src/
│   │   │   └── mastra/        # Mastra AI framework integration
│   │   │       ├── agents/    # AI agent definitions
│   │   │       ├── tools/     # Market data and Plaid tools
│   │   │       └── config.ts
│   │   ├── steps/              # Motia steps (API, Event, Cron)
│   │   │   ├── api.step.ts
│   │   │   ├── chat.step.ts
│   │   │   ├── market-data.step.ts
│   │   │   ├── plaid-link.step.ts
│   │   │   ├── plaid-exchange.step.ts
│   │   │   └── state-audit-cron.step.ts
│   │   ├── supabase/           # Database migrations and RLS
│   │   ├── tests/             # Unit and integration tests
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
│       │   │   ├── ui/       # Reusable UI components
│       │   │   ├── assistant-selector.tsx
│       │   │   ├── chat-interface.tsx
│       │   │   └── plaid-connect.tsx
│       │   └── lib/           # Utilities and API clients
│       ├── public/            # Static assets
│       ├── package.json
│       └── next.config.ts
│
├── scripts/                   # Deployment and automation scripts
│   └── azure-deploy.sh
│
├── docs/                      # Documentation
│   ├── architecture.md
│   ├── deployment.md
│   ├── performance-tuning.md
│   └── azure-troubleshooting.md
│
├── .claude/                   # Claude AI configurations
│   ├── agents/               # AI agent prompts
│   ├── commands/             # Custom commands
│   └── CLAUDE.md            # SuperClaude configuration
├── .cursor/                   # Cursor AI rules
│   └── rules/               # Development patterns
├── .github/                   # GitHub workflows
│   └── workflows/
│       ├── azure-deploy.yml
│       └── claude-code-review.yml
├── turbo.json                # Turborepo configuration
├── package.json              # Root workspace package.json
├── pnpm-workspace.yaml       # PNPM workspace configuration
├── docker-compose.yml        # Docker development setup
└── AGENTS.md                 # Motia backend guide

```

## Key Features

### 🤖 Multi-Agent Financial Intelligence (Mastra Framework)
- **6 Specialized AI Assistants**: General, Analyst, Trading, Investment Advisor, Risk Manager, Macro Economist
- **Mastra AI Integration**: Powerful agent orchestration with tools and workflows
- **Azure OpenAI Service**: GPT-4 powered analysis and recommendations
- **Intelligent Tools**: Market data fetching, Plaid integration, portfolio analysis

### 📊 Trading & Market Analysis
- **Market Data API**: Real-time and historical data via dedicated API endpoints
- **Yahoo Finance Integration**: Comprehensive market data and analysis
- **Polygon.io Support**: Professional-grade market data feeds
- **Alpaca Trading API**: Brokerage integration for trade execution

### 💼 Portfolio Management
- **Plaid Integration**: Secure bank and brokerage account aggregation
- **Token Exchange System**: Secure Plaid token management via API endpoints
- **Supabase Database**: PostgreSQL with row-level security for user data
- **Redis Caching**: High-performance caching for market data and API responses

### 🔐 Authentication & Security
- **Supabase Auth**: Secure user authentication with email/password
- **Protected Routes**: Login required for chat and financial features
- **Session Management**: Automatic session refresh and persistence
- **User Data Isolation**: Row-level security in Supabase

### 🏗️ Technical Architecture
- **Event-Driven Backend**: Motia v0.6.4 orchestration with API, Event, and Cron steps
- **Security First**: JWT authentication, rate limiting, input sanitization, encryption
- **Azure Cloud Deployment**: Container Instances with GitHub Actions CI/CD
- **Performance Optimization**: Redis caching, connection pooling, optimized queries
- **Monorepo Management**: Turborepo for optimized builds and caching
- **Multi-Stage Docker**: Production-ready containerization with health checks
- **Comprehensive Testing**: Jest unit tests with coverage reporting

## Tech Stack

### Backend (Motia + Mastra)
- **Framework**: Motia v0.6.4 - Event-driven backend orchestration
- **AI Framework**: Mastra Core v0.16.2 for agent orchestration
- **Languages**: TypeScript with strict mode
- **Architecture**: Step-based (API, Event, Cron steps)
- **Security**: Azure Key Vault, JWT auth, encryption services
- **Caching**: Redis for high-performance data caching
- **Validation**: Zod schemas with strict input sanitization
- **State**: Built-in state management with traceId scoping

### Frontend (Next.js)
- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS with custom components
- **UI Components**: Custom chat interface, assistant selector, Plaid connect
- **Authentication**: Integration ready for Supabase Auth
- **State Management**: React hooks and context
- **Build Tools**: Turbo for optimized builds

### Integrations
- **AI Provider**: Azure OpenAI Service (GPT-4)
- **Market Data**: Yahoo Finance, Polygon.io, Alpaca Markets
- **Banking**: Plaid for secure account aggregation
- **Database**: Supabase (PostgreSQL with row-level security)
- **Cloud**: Microsoft Azure (Container Instances, Key Vault)
- **Caching**: Redis for performance optimization

### Development Tools
- **AI Assistance**: Claude and Cursor configurations for development
- **GitHub Actions**: Automated deployment and code review workflows
- **Docker**: Multi-stage builds for containerization
- **Testing**: Jest with comprehensive test coverage

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
cp apps/web/.env.local.example apps/web/.env.local
```

Edit the `.env` files with your API keys:

**Backend (`apps/backend/.env`):**
- Azure OpenAI credentials
- Plaid API keys
- Supabase connection string
- Redis connection (optional for local dev)
- Market data API keys (Yahoo Finance, Polygon.io, Alpaca)

**Frontend (`apps/web/.env.local`):**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key

Get Supabase credentials from: https://app.supabase.com/project/_/settings/api

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

## API Endpoints

The Motia backend provides the following API endpoints:

### Core APIs
- `POST /api/chat` - Chat with AI assistants
- `POST /api/market-data` - Fetch market data for symbols
- `POST /api/plaid/link` - Initialize Plaid Link
- `POST /api/plaid/exchange` - Exchange Plaid public token
- `POST /basic-tutorial` - Legacy tutorial endpoint

### Security Features
- JWT authentication middleware
- Rate limiting per user/IP
- Input sanitization with Zod schemas
- CORS configuration for production

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
The application automatically deploys to Azure App Service via GitHub Actions when pushing to the main branch.

```bash
# Manual deployment (if needed)
./scripts/azure-deploy.sh

# Or deploy specific apps
cd apps/backend && ./deploy.sh  # Deploy backend
cd apps/web && ./deploy.sh      # Deploy frontend
```

Deployment features:
- Linux-based App Service containers
- Automatic builds via GitHub Actions
- Environment variable management via Azure Key Vault
- Health checks and auto-restart

### Backend Deployment
- **Azure Container Instances**: Production deployment via GitHub Actions
- **Docker Support**: Multi-stage Dockerfile with health checks
- **Environment Variables**: Managed via Azure Key Vault
- **Monitoring**: Azure Application Insights integration

### Frontend Deployment
- **Vercel**: Recommended for Next.js optimization
- **Azure Static Web Apps**: Alternative cloud deployment
- **Docker**: Containerized deployment with nginx
- **CDN**: CloudFlare or Azure CDN for global distribution

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

## Current Status

### ✅ Implemented
- Motia backend with API endpoints
- Mastra AI agent framework integration
- Plaid account aggregation
- Market data fetching
- Redis caching layer
- Security middleware (auth, rate limiting)
- Azure deployment configuration
- GitHub Actions CI/CD

### 🚧 In Progress
- Agent debate workflows
- Frontend UI completion
- WebSocket real-time updates
- Advanced trading features

### 📋 Planned
- Mobile application
- Advanced portfolio analytics
- Social trading features
- Automated trading strategies

## Contributing

1. Create a feature branch
2. Follow the code style in AGENTS.md
3. Run tests: `pnpm test`
4. Run linting: `pnpm lint`
5. Submit a pull request

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

### Why Mastra + Motia?
- **Mastra AI Framework**: Production-ready agent orchestration with tools and workflows
- **Motia Backend**: Event-driven architecture for scalable microservices
- **Specialized Agents**: Each agent has domain-specific tools and prompts
- **Tool Integration**: Seamless integration with financial APIs and data sources

## Security & Compliance

- **Authentication**: JWT-based auth with secure token management
- **Secrets Management**: Azure Key Vault for API keys and credentials
- **Data Encryption**: AES-256 encryption for sensitive data
- **Input Validation**: Comprehensive Zod schemas with sanitization
- **Rate Limiting**: Per-user and IP-based rate limiting
- **CORS**: Strict origin validation for production
- **Audit Logging**: Structured logging with traceId tracking
- **Database Security**: Supabase RLS policies and secure connections

## License

Source Available - See [LICENSE.md](LICENSE.md) for details
