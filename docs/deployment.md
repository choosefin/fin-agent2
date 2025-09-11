# Deployment Guide

This guide covers deployment options for the Fin Agent Platform, including local development, Docker deployment, and cloud deployment to Azure.

## Table of Contents
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Azure Deployment](#azure-deployment)
- [Environment Variables](#environment-variables)
- [Performance Optimization](#performance-optimization)
- [Monitoring & Logging](#monitoring--logging)
- [Security Considerations](#security-considerations)

## Local Development

### Prerequisites
- Node.js 18+
- PNPM 9.0.0
- Docker (optional, for Redis)
- Git

### Setup
```bash
# Clone repository
git clone https://github.com/yourusername/fin-agent2.git
cd fin-agent2

# Install dependencies
pnpm install

# Setup environment variables
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env

# Start Redis (if not using Docker Compose)
docker run -d -p 6379:6379 redis:7-alpine

# Start development servers
pnpm dev
```

### Available URLs
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Motia Workbench: http://localhost:5173
- Redis: localhost:6379

## Docker Deployment

### Building Images

The project uses multi-stage Docker builds to optimize image size and build time.

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build backend
docker-compose build web
```

### Running with Docker Compose

```bash
# Start all services
docker-compose up

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Docker Compose Services
- **backend**: Motia backend application (port 3001)
- **web**: Next.js frontend application (port 3000)
- **redis**: Redis cache server (port 6379)

## Azure Deployment

### Prerequisites
- Azure CLI installed and configured
- Azure subscription
- Docker installed locally

### Deployment Methods

#### Method 1: Automated Script

```bash
# Make script executable
chmod +x scripts/azure-deploy.sh

# Run deployment
./scripts/azure-deploy.sh
```

The script will:
1. Create/update resource group
2. Build Docker images
3. Create Azure Container Registry
4. Push images to ACR
5. Deploy ARM template
6. Configure Redis cache
7. Start container instances

#### Method 2: Manual ARM Template Deployment

1. Create parameter file:
```bash
cp azure-deploy.parameters.json my-params.json
# Edit my-params.json with your values
```

2. Deploy template:
```bash
az deployment group create \
  --resource-group finagent-rg \
  --template-file azure-deploy.json \
  --parameters @my-params.json
```

### Azure Resources Created
- **Container Registry**: For Docker images
- **Container Instances**: Running backend and frontend
- **Redis Cache**: Azure Cache for Redis (Basic tier)
- **Public IP**: With DNS label for access

### Post-Deployment

After deployment, you'll receive:
- Web App URL: `http://<dns-label>.region.azurecontainer.io:3000`
- API URL: `http://<dns-label>.region.azurecontainer.io:3001`

## Environment Variables

### Backend Environment Variables

```env
# Node Environment
NODE_ENV=production
PORT=3001

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# Financial APIs
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox
POLYGON_API_KEY=your_polygon_key
ALPACA_API_KEY=your_alpaca_key
ALPACA_SECRET_KEY=your_alpaca_secret

# AI Services
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GROQ_API_KEY=your_groq_key

# Memory Service
MEM0_API_KEY=your_mem0_key
MEM0_ENDPOINT=https://api.mem0.ai

# Cache
REDIS_URL=redis://localhost:6379
```

### Frontend Environment Variables

```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Performance Optimization

### Redis Caching Strategy

The platform implements intelligent caching for:

1. **Market Data** (60s TTL)
   - Real-time quotes
   - Historical price data
   - Market indicators

2. **Agent Results** (10min TTL)
   - AI analysis results
   - Agent debate outcomes
   - Recommendation cache

3. **Portfolio Data** (5min TTL)
   - Account balances
   - Holdings information
   - Performance metrics

### Cache Invalidation

```typescript
// Invalidate portfolio cache on updates
await cacheService.invalidatePortfolioCache(userId)

// Clear all cache (maintenance)
await cacheService.flush()
```

### Turborepo Build Optimization

Turborepo provides:
- Incremental builds
- Remote caching (when configured)
- Parallel task execution
- Smart dependency tracking

Configure remote caching:
```json
{
  "remoteCache": {
    "signature": true,
    "url": "https://your-cache-server.com"
  }
}
```

## Monitoring & Logging

### Application Logs

View logs in different environments:

```bash
# Local Docker
docker-compose logs -f backend
docker-compose logs -f web

# Azure Container Instances
az container logs --resource-group finagent-rg \
  --name finagent-container-group \
  --container-name backend --follow
```

### Redis Monitoring

```bash
# Connect to Redis CLI
redis-cli

# Monitor commands in real-time
MONITOR

# Get cache statistics
INFO stats

# Check memory usage
INFO memory
```

### Health Checks

Backend health endpoint:
```bash
curl http://localhost:3001/health
```

## Security Considerations

### Production Checklist

- [ ] Use strong, unique passwords for all services
- [ ] Enable SSL/TLS for all public endpoints
- [ ] Configure firewall rules for Azure resources
- [ ] Use Azure Key Vault for secrets management
- [ ] Enable audit logging
- [ ] Implement rate limiting
- [ ] Configure CORS properly
- [ ] Use environment-specific API keys
- [ ] Enable Redis password authentication
- [ ] Regular security updates

### Azure Security

1. **Network Security Groups**: Configure NSG rules to restrict access
2. **Azure Key Vault**: Store sensitive configuration
3. **Managed Identity**: Use for service-to-service authentication
4. **Azure Monitor**: Set up alerts for suspicious activity

### Data Protection

- All financial data encrypted in transit (HTTPS)
- Database encryption at rest (Supabase)
- Row-level security policies
- Session management with secure cookies
- API key rotation schedule

## Troubleshooting

### Common Issues

1. **Container fails to start**
   - Check environment variables
   - Verify Docker image builds successfully
   - Review container logs

2. **Redis connection errors**
   - Verify Redis is running
   - Check REDIS_URL configuration
   - Ensure network connectivity

3. **API timeout issues**
   - Check rate limits on external APIs
   - Verify network configuration
   - Review cache hit rates

4. **Build failures**
   - Clear Turborepo cache: `pnpm clean`
   - Remove node_modules: `rm -rf node_modules`
   - Reinstall dependencies: `pnpm install`

### Debug Commands

```bash
# Check container status
docker ps -a

# Inspect container
docker inspect <container_id>

# Azure resource status
az container show --resource-group finagent-rg \
  --name finagent-container-group

# Test Redis connection
redis-cli ping

# Check Turborepo cache
turbo run build --dry-run
```

## Scaling Considerations

### Horizontal Scaling
- Use Azure Container Instances scale sets
- Deploy to Azure Kubernetes Service (AKS)
- Implement load balancing

### Vertical Scaling
- Increase container CPU/memory limits
- Upgrade Redis tier for better performance
- Use premium Azure services

### Database Scaling
- Implement read replicas
- Use connection pooling
- Optimize queries and indexes

## CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup PNPM
        uses: pnpm/action-setup@v2
        with:
          version: 9.0.0
      
      - name: Build
        run: pnpm install && pnpm build
      
      - name: Deploy to Azure
        run: ./scripts/azure-deploy.sh
        env:
          AZURE_CREDENTIALS: ${{ secrets.AZURE_CREDENTIALS }}
```

## Backup and Recovery

### Database Backup
- Configure Supabase automatic backups
- Export data regularly
- Test restore procedures

### Application State
- Redis persistence configuration
- Regular state snapshots
- Disaster recovery plan

## Support

For deployment issues:
1. Check the [troubleshooting section](#troubleshooting)
2. Review application logs
3. Open an issue on GitHub
4. Contact support team