# Architecture Overview

## System Architecture

The Fin Agent Platform is built as a cloud-native, microservices-based financial AI system with the following key architectural components:

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                         │
│  - React 18 with App Router                                  │
│  - TradingView Charts                                        │
│  - Plaid Link Integration                                    │
│  - Real-time WebSocket connections                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                               │
│              (Fastify + Motia Framework)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   Redis     │ │   Motia     │ │  Multi-Agent│
│   Cache     │ │   Steps     │ │   System    │
│             │ │             │ │             │
│ - Market    │ │ - API       │ │ - General   │
│   Data      │ │ - Event     │ │ - Analyst   │
│ - Agent     │ │ - Cron      │ │ - Trading   │
│   Results   │ │ - Stream    │ │ - Risk Mgr  │
│ - Portfolio │ │             │ │ - Macro     │
└─────────────┘ └─────────────┘ └─────────────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
├─────────────────────────────────────────────────────────────┤
│  Supabase (PostgreSQL)  │  External APIs  │  Memory (mem0)  │
│  - User data            │  - Polygon.io   │  - Agent memory │
│  - Portfolio data       │  - Alpaca       │  - User context │
│  - Transactions         │  - Plaid        │  - Conversations│
│  - RLS policies         │  - Yahoo Finance│                 │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend Layer (Next.js)

**Technology Stack:**
- Next.js 14 with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- TradingView Advanced Charts
- Plaid Link for bank connections

**Key Features:**
- Server-side rendering for SEO and performance
- Real-time data updates via WebSockets
- Responsive design for mobile and desktop
- Progressive Web App capabilities

### 2. Backend Layer (Motia Framework)

**Event-Driven Architecture:**
```typescript
// API Step
export const config: ApiRouteConfig = {
  type: 'api',
  name: 'CreatePortfolio',
  method: 'POST',
  path: '/portfolios',
  emits: ['portfolio.created']
}

// Event Step
export const config: EventConfig = {
  type: 'event',
  name: 'AnalyzePortfolio',
  subscribes: ['portfolio.created'],
  emits: ['analysis.completed']
}
```

**Multi-Language Support:**
- TypeScript: API endpoints, business logic
- Python: AI/ML processing, data science
- Ruby: Report generation, templating

### 3. Multi-Agent AI System

**Agent Architecture:**
```
┌──────────────────────────────────────┐
│         Agent Orchestrator           │
└────────────────┬─────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│General │  │Analyst │  │Trading │
│ Agent  │  │ Agent  │  │ Agent  │
└────────┘  └────────┘  └────────┘
    │            │            │
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│  Risk  │  │ Invest │  │ Macro  │
│Manager │  │Advisor │  │  Econ  │
└────────┘  └────────┘  └────────┘
```

**Agent Capabilities:**
- Parallel search across multiple data sources
- Collaborative debate for complex decisions
- Persistent memory via mem0
- Tool execution (30+ financial tools)

### 4. Caching Layer (Redis)

**Cache Strategy:**
```typescript
interface CacheConfig {
  marketData: { ttl: 60 },      // 1 minute
  agentResults: { ttl: 600 },   // 10 minutes
  portfolioData: { ttl: 300 },  // 5 minutes
  userSession: { ttl: 3600 }    // 1 hour
}
```

**Cache Patterns:**
- Write-through for critical data
- Cache-aside for read-heavy operations
- TTL-based expiration
- Event-based invalidation

### 5. Data Persistence (Supabase)

**Database Schema:**
```sql
-- Users table with RLS
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  created_at TIMESTAMP
);

-- Portfolio table
CREATE TABLE portfolios (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name TEXT,
  total_value DECIMAL,
  updated_at TIMESTAMP
);

-- Row Level Security
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see own portfolios"
  ON portfolios FOR SELECT
  USING (auth.uid() = user_id);
```

## Deployment Architecture

### Local Development
```yaml
services:
  backend:
    build: ./apps/backend
    ports: ["3001:3000"]
    environment:
      REDIS_URL: redis://redis:6379
    
  web:
    build: ./apps/web
    ports: ["3000:3000"]
    depends_on: [backend]
    
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

### Azure Production
```
┌─────────────────────────────────────┐
│      Azure Resource Group           │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐  │
│  │  Container Registry (ACR)    │  │
│  └─────────────────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │  Container Instances (ACI)   │  │
│  │  - Backend Container         │  │
│  │  - Frontend Container        │  │
│  └─────────────────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │  Azure Cache for Redis       │  │
│  └─────────────────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │  Application Gateway         │  │
│  │  - SSL Termination           │  │
│  │  - Load Balancing            │  │
│  └─────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

## Data Flow

### 1. User Request Flow
```
User → Frontend → API Gateway → Backend Service → Cache/DB → Response
```

### 2. Event Processing Flow
```
API Step → Emit Event → Event Bus → Event Step → Process → Emit Result
```

### 3. AI Agent Flow
```
User Query → Orchestrator → Parallel Agent Execution → Debate → Consensus → Response
```

## Security Architecture

### Authentication & Authorization
- Supabase Auth for user management
- JWT tokens for API authentication
- Row-level security in PostgreSQL
- API key management for external services

### Data Protection
- TLS/SSL for all communications
- Encryption at rest for database
- Secure credential storage (Azure Key Vault)
- PII data masking in logs

### Network Security
- Network isolation via VPC/VNet
- Web Application Firewall (WAF)
- DDoS protection
- Rate limiting on APIs

## Performance Optimization

### Build Optimization (Turborepo)
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "cache": true
    }
  }
}
```

### Runtime Optimization
- Redis caching for frequent queries
- Database connection pooling
- Lazy loading of components
- Image optimization
- Code splitting

### Scaling Strategy
- Horizontal scaling via container replicas
- Auto-scaling based on CPU/memory
- Database read replicas
- CDN for static assets

## Monitoring & Observability

### Application Monitoring
- Health check endpoints
- Performance metrics (latency, throughput)
- Error tracking and alerting
- User analytics

### Infrastructure Monitoring
- Container metrics (CPU, memory, network)
- Redis cache hit rates
- Database query performance
- External API response times

### Logging Strategy
```typescript
logger.info('Processing trade', {
  userId,
  tradeId,
  symbol,
  quantity,
  timestamp: new Date().toISOString()
})
```

## Development Workflow

### CI/CD Pipeline
```
Code Push → GitHub Actions → Build → Test → Docker Build → Push to ACR → Deploy to Azure
```

### Environment Management
- Development: Local Docker Compose
- Staging: Azure Container Instances (shared)
- Production: Azure Container Instances (dedicated)

### Feature Flags
- Progressive rollout of new features
- A/B testing capabilities
- Quick rollback mechanism

## Technology Decisions

### Why Motia?
- Event-driven architecture for scalability
- Multi-language support (TS, Python, Ruby)
- Built-in state management
- Visual workflow editor

### Why Redis?
- Sub-millisecond latency
- Pub/sub for real-time features
- Data structure flexibility
- Proven scalability

### Why Supabase?
- Built-in authentication
- Real-time subscriptions
- Row-level security
- PostgreSQL power

### Why Azure?
- Container-native services
- Global presence
- Enterprise security
- Cost-effective scaling

## Future Enhancements

### Planned Features
- Kubernetes deployment (AKS)
- GraphQL API layer
- Machine learning pipeline
- Advanced portfolio optimization
- Social trading features

### Technical Improvements
- Service mesh (Istio/Linkerd)
- Event sourcing
- CQRS pattern
- Distributed tracing
- Chaos engineering