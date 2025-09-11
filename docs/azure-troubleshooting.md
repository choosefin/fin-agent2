# Azure Deployment Troubleshooting Guide

This guide helps diagnose and resolve common issues when deploying the Fin Agent platform to Azure.

## Quick Diagnostics

### Health Check Commands

```bash
# Check container status
az container show --resource-group finagent-rg --name finagent-container-group

# View container logs
az container logs --resource-group finagent-rg --name finagent-container-group --container-name backend
az container logs --resource-group finagent-rg --name finagent-container-group --container-name web

# Check Redis status
az redis show --resource-group finagent-rg --name finagent-redis

# Test network connectivity
curl -I http://your-container-group-fqdn:3000
curl -I http://your-container-group-fqdn:3001/health
```

## Common Issues

### 1. Container Startup Failures

#### Symptoms
- Container shows "Failed" or "Pending" state
- Application not responding to HTTP requests
- Containers restart continuously

#### Diagnosis
```bash
# Check container events
az container show --resource-group finagent-rg --name finagent-container-group --query "properties.instanceView"

# View detailed logs
az container logs --resource-group finagent-rg --name finagent-container-group --container-name backend --tail 100

# Check resource allocation
az container show --resource-group finagent-rg --name finagent-container-group --query "properties.containers[].resources"
```

#### Solutions
1. **Memory Issues**: Increase memory allocation in ARM template
2. **Environment Variables**: Verify all required variables are set
3. **Image Issues**: Confirm images pushed to ACR successfully
4. **Dependencies**: Check application dependencies and startup order

#### Prevention
```json
// ARM template - Add resource requests
"resources": {
  "requests": {
    "cpu": 1.0,
    "memoryInGB": 2.0
  },
  "limits": {
    "cpu": 2.0,
    "memoryInGB": 4.0
  }
}
```

### 2. Redis Connection Issues

#### Symptoms
- "Redis Client Error" in application logs
- Cache operations timing out
- Intermittent connectivity issues

#### Diagnosis
```bash
# Check Redis status and configuration
az redis show --resource-group finagent-rg --name finagent-redis

# Test Redis connectivity from container
az container exec --resource-group finagent-rg --container-group finagent-container-group --container-name backend --exec-command "redis-cli -h finagent-redis.redis.cache.windows.net -p 6380 -a <access-key> --tls ping"

# Check network security groups
az network nsg show --resource-group finagent-rg --name finagent-container-group-nsg
```

#### Solutions
1. **Authentication**: Verify Redis access keys are correct
2. **TLS Configuration**: Ensure TLS 1.2 is properly configured
3. **Network Rules**: Check NSG and firewall rules
4. **Connection String**: Validate Redis URL format

#### Fix Redis Configuration
```bash
# Get Redis access key
REDIS_KEY=$(az redis list-keys --resource-group finagent-rg --name finagent-redis --query primaryKey -o tsv)

# Update connection string
REDIS_URL="rediss://finagent-redis.redis.cache.windows.net:6380"
```

### 3. Image Push/Pull Problems

#### Symptoms
- "ImagePullBackOff" errors
- Authentication failures with ACR
- Outdated images running in containers

#### Diagnosis
```bash
# Check ACR status
az acr show --resource-group finagent-rg --name <acr-name>

# List repository images
az acr repository list --name <acr-name>

# Check image tags
az acr repository show-tags --name <acr-name> --repository finagent-backend
az acr repository show-tags --name <acr-name> --repository finagent-web

# Test ACR authentication
az acr login --name <acr-name>
```

#### Solutions
1. **Authentication**: Regenerate ACR admin credentials
2. **Image Tags**: Verify correct image tags are used
3. **Network**: Check ACR network accessibility
4. **Permissions**: Ensure service principal has ACR access

#### Fix ACR Issues
```bash
# Enable admin user (if needed)
az acr update --resource-group finagent-rg --name <acr-name> --admin-enabled true

# Get ACR credentials
az acr credential show --name <acr-name>

# Manually push images
docker tag backend:latest <acr-name>.azurecr.io/finagent-backend:latest
docker push <acr-name>.azurecr.io/finagent-backend:latest
```

### 4. Network Connectivity Issues

#### Symptoms
- Cannot access application endpoints
- Internal service communication failures
- DNS resolution problems

#### Diagnosis
```bash
# Check public IP and DNS
az container show --resource-group finagent-rg --name finagent-container-group --query "properties.ipAddress"

# Test network connectivity
nslookup <container-group-fqdn>
curl -v http://<container-group-fqdn>:3000

# Check NSG rules
az network nsg rule list --resource-group finagent-rg --nsg-name finagent-container-group-nsg
```

#### Solutions
1. **NSG Rules**: Verify inbound rules allow traffic
2. **DNS**: Check DNS name label uniqueness
3. **Ports**: Confirm correct ports exposed
4. **Virtual Network**: Validate VNet configuration

#### Fix Network Issues
```bash
# Update NSG rule
az network nsg rule create \
  --resource-group finagent-rg \
  --nsg-name finagent-container-group-nsg \
  --name AllowHTTP \
  --protocol Tcp \
  --priority 1000 \
  --destination-port-range 3000 \
  --access Allow
```

### 5. SSL/TLS Certificate Issues

#### Symptoms
- HTTPS connections failing
- Certificate validation errors
- Mixed content warnings

#### Diagnosis
```bash
# Test SSL endpoint
openssl s_client -connect <your-domain>:443 -servername <your-domain>

# Check certificate details
curl -vI https://<your-domain>
```

#### Solutions
1. **Certificate Installation**: Properly install SSL certificates
2. **Certificate Chain**: Ensure complete certificate chain
3. **Domain Configuration**: Verify domain DNS settings
4. **Load Balancer**: Configure Azure Load Balancer for SSL termination

### 6. Performance Issues

#### Symptoms
- Slow response times
- High CPU/Memory usage
- Timeout errors

#### Diagnosis
```bash
# Check resource utilization
az monitor metrics list --resource <container-group-resource-id> --metric "CpuUsage,MemoryUsage"

# Application performance monitoring
curl http://<container-group-fqdn>:3001/health

# Check Redis performance
az redis show-metrics --resource-group finagent-rg --name finagent-redis
```

#### Solutions
1. **Resource Scaling**: Increase CPU/Memory allocation
2. **Caching**: Optimize Redis caching strategies
3. **Database**: Review database query performance
4. **Load Testing**: Identify performance bottlenecks

## Environment-Specific Issues

### Development Environment

```bash
# Quick local testing
docker-compose up --build

# Test services individually
docker run -p 3001:3001 backend:latest
docker run -p 3000:3000 web:latest
```

### Production Environment

```bash
# Monitor production metrics
az monitor log-analytics query \
  --workspace <workspace-id> \
  --analytics-query "ContainerInstanceLog_CL | where TimeGenerated > ago(1h)"

# Set up alerts
az monitor metrics alert create \
  --name "High CPU Usage" \
  --resource-group finagent-rg \
  --scopes <container-group-resource-id> \
  --condition "avg CpuUsage > 80"
```

## Logging and Monitoring

### Application Logs

```bash
# Stream backend logs
az container logs --resource-group finagent-rg --name finagent-container-group --container-name backend --follow

# Get web logs
az container logs --resource-group finagent-rg --name finagent-container-group --container-name web --tail 50

# Export logs to file
az container logs --resource-group finagent-rg --name finagent-container-group --container-name backend > backend.log
```

### Azure Monitoring

```bash
# Enable Log Analytics
az monitor log-analytics workspace create \
  --resource-group finagent-rg \
  --workspace-name finagent-logs

# Configure diagnostic settings
az monitor diagnostic-settings create \
  --name container-diagnostics \
  --resource <container-group-resource-id> \
  --workspace <workspace-id> \
  --logs '[{"category":"ContainerInsights","enabled":true}]'
```

### Custom Health Checks

Add to your application:

```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      redis: await cacheService.healthCheck(),
      database: await checkDatabaseConnection(),
      external_apis: await checkExternalAPIs()
    }
  }
  
  const allHealthy = Object.values(checks.services).every(Boolean)
  res.status(allHealthy ? 200 : 503).json(checks)
})
```

## Disaster Recovery

### Backup Procedures

```bash
# Backup Redis data
az redis export \
  --resource-group finagent-rg \
  --name finagent-redis \
  --container <storage-container-url> \
  --prefix backup-$(date +%Y%m%d)

# Backup container images
az acr import \
  --name <backup-acr> \
  --source <original-acr>.azurecr.io/finagent-backend:latest \
  --image finagent-backend:backup-$(date +%Y%m%d)
```

### Recovery Procedures

```bash
# Restore from backup
az redis import \
  --resource-group finagent-rg \
  --name finagent-redis \
  --files <backup-file-url>

# Rollback to previous image
az container restart \
  --resource-group finagent-rg \
  --name finagent-container-group
```

## Support Escalation

### Information to Collect

1. **Azure Subscription ID**
2. **Resource Group name**
3. **Container Group details**
4. **Error messages and logs**
5. **Timeline of issues**
6. **Recent changes made**

### Azure Support

```bash
# Create support ticket
az support tickets create \
  --ticket-name "Fin Agent Deployment Issue" \
  --description "Detailed description of the problem" \
  --severity "minimal" \
  --contact-first-name "Your Name" \
  --contact-last-name "Last Name" \
  --contact-primary-email "email@domain.com"
```

### Emergency Contacts

- **Azure Support**: [Azure Portal Support](https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade)
- **Internal Team**: Contact development team via designated channels
- **Third-party Services**: Document contact information for external dependencies

This troubleshooting guide provides systematic approaches to identify and resolve deployment issues, ensuring minimal downtime and optimal platform performance.