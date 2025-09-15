# Secret Management Guide

## 🚨 CRITICAL SECURITY ALERT

**Exposed secrets have been detected in this repository!** Immediate action is required to rotate all secrets and clean the git history.

## Immediate Actions Required

1. **Run the rotation script:**
   ```bash
   chmod +x scripts/rotate-secrets.sh
   ./scripts/rotate-secrets.sh
   ```

2. **Remove exposed secrets from history:**
   ```bash
   chmod +x scripts/remove-exposed-secrets.sh
   ./scripts/remove-exposed-secrets.sh
   ```

3. **Rotate all secrets in their respective platforms**

4. **Update GitHub secrets and Azure Key Vault**

## Complete List of Secrets

### Backend Services

| Secret Name | Provider | Description | Rotation Frequency |
|------------|----------|-------------|-------------------|
| **GROQ_API_KEY** | Groq | AI/LLM service | 90 days |
| **AZURE_OPENAI_API_KEY** | Azure | Azure OpenAI service | 90 days |
| **AZURE_OPENAI_ENDPOINT** | Azure | Azure OpenAI endpoint | As needed |
| **OPENAI_API_KEY** | OpenAI | Direct OpenAI API | 90 days |
| **ANTHROPIC_API_KEY** | Anthropic | Claude API | 90 days |
| **PLAID_CLIENT_ID** | Plaid | Banking API client ID | Rarely |
| **PLAID_SECRET** | Plaid | Banking API secret | 90 days |
| **POLYGON_API_KEY** | Polygon | Market data API | 90 days |
| **ALPACA_API_KEY** | Alpaca | Trading API key | 90 days |
| **ALPACA_SECRET_KEY** | Alpaca | Trading API secret | 90 days |
| **YAHOO_FINANCE_API_KEY** | Yahoo | Market data API | 90 days |
| **MEM0_API_KEY** | Mem0 | Memory service | 90 days |

### Database & Infrastructure

| Secret Name | Provider | Description | Rotation Frequency |
|------------|----------|-------------|-------------------|
| **SUPABASE_URL** | Supabase | Database URL | Never |
| **SUPABASE_ANON_KEY** | Supabase | Public anon key | As needed |
| **SUPABASE_SERVICE_KEY** | Supabase | Admin service key | 90 days |
| **REDIS_URL** | Redis | Cache connection string | 90 days |

### Frontend (Public)

| Secret Name | Provider | Description | Rotation Frequency |
|------------|----------|-------------|-------------------|
| **NEXT_PUBLIC_SUPABASE_URL** | Supabase | Public database URL | Never |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | Supabase | Public anon key | As needed |
| **NEXT_PUBLIC_API_URL** | Internal | Backend API URL | Never |

### CI/CD & Deployment

| Secret Name | Provider | Description | Rotation Frequency |
|------------|----------|-------------|-------------------|
| **AZURE_CREDENTIALS** | Azure | Service principal JSON | 180 days |
| **GITHUB_TOKEN** | GitHub | Actions token | Auto-rotated |
| **DOCKERHUB_TOKEN** | Docker | Registry token | 180 days |
| **NPM_TOKEN** | NPM | Package registry | 180 days |

## Secret Rotation Procedures

### 1. Supabase Secrets

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Navigate to Settings → API
3. For service key rotation:
   - Click "Reveal" next to service_role key
   - Click "Roll" to generate new key
   - Update in GitHub Secrets and Azure Key Vault

### 2. Plaid Secrets

1. Go to [Plaid Dashboard](https://dashboard.plaid.com)
2. Navigate to Team Settings → Keys
3. Click "Rotate" next to the secret
4. Update the new secret in all locations

### 3. AI/LLM Provider Keys

#### OpenAI
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Delete old key and create new one
3. Update in secrets

#### Anthropic
1. Go to [Anthropic Console](https://console.anthropic.com/settings/keys)
2. Create new key and delete old one
3. Update in secrets

#### Groq
1. Go to [Groq Console](https://console.groq.com/keys)
2. Generate new API key
3. Delete old key after updating

### 4. Market Data APIs

#### Polygon
1. Go to [Polygon Dashboard](https://polygon.io/dashboard)
2. Navigate to API Keys
3. Generate new key

#### Alpaca
1. Go to [Alpaca Dashboard](https://app.alpaca.markets)
2. Navigate to API Keys section
3. Regenerate both key and secret

### 5. Azure Credentials

```bash
# Create new service principal
az ad sp create-for-rbac \
  --name "finagent-sp-$(date +%Y%m%d)" \
  --role contributor \
  --scopes /subscriptions/YOUR-SUBSCRIPTION-ID \
  --sdk-auth

# Copy the JSON output and update AZURE_CREDENTIALS secret
```

## Storing Secrets

### GitHub Secrets

```bash
# Set a secret
gh secret set SECRET_NAME --repo owner/repo --body "secret-value"

# Set from file
gh secret set SECRET_NAME --repo owner/repo < secret.txt

# List secrets
gh secret list --repo owner/repo
```

### Azure Key Vault

```bash
# Set a secret
az keyvault secret set \
  --vault-name finagent-keyvault \
  --name "SECRET-NAME" \
  --value "secret-value"

# Get a secret
az keyvault secret show \
  --vault-name finagent-keyvault \
  --name "SECRET-NAME" \
  --query value -o tsv
```

### Local Development

1. Never commit `.env` files
2. Use `.env.example` for templates
3. Store local secrets in password manager
4. Use direnv or similar for auto-loading

## Security Best Practices

### DO's ✅

- **Rotate secrets regularly** (every 90 days)
- **Use different secrets** for each environment
- **Store secrets in secure vaults** (Azure Key Vault, GitHub Secrets)
- **Audit secret access** regularly
- **Use least privilege principle** for API keys
- **Monitor for exposed secrets** using GitHub secret scanning
- **Use managed identities** where possible (Azure)
- **Encrypt secrets at rest and in transit**

### DON'Ts ❌

- **Never commit secrets** to version control
- **Never log secrets** in application logs
- **Never share secrets** via email or chat
- **Never use production secrets** in development
- **Never hardcode secrets** in code
- **Never store secrets** in plain text files
- **Never expose secrets** in error messages
- **Never use weak or default secrets**

## Monitoring & Alerts

### GitHub Secret Scanning

1. Enable in Settings → Security → Code security
2. Configure alerts for exposed secrets
3. Review security alerts regularly

### Azure Key Vault Monitoring

```bash
# Enable diagnostic settings
az monitor diagnostic-settings create \
  --resource /subscriptions/.../providers/Microsoft.KeyVault/vaults/finagent-keyvault \
  --name keyvault-diagnostics \
  --logs '[{"category": "AuditEvent", "enabled": true}]' \
  --workspace YOUR-LOG-ANALYTICS-WORKSPACE
```

### Application Monitoring

- Log authentication failures
- Alert on unusual secret access patterns
- Monitor for secrets in logs
- Track secret age and rotation

## Emergency Procedures

### If a Secret is Exposed

1. **Immediately rotate** the affected secret
2. **Audit logs** for unauthorized access
3. **Update all services** using the secret
4. **Clean git history** if committed
5. **Notify team** and stakeholders
6. **Review and update** security practices

### Incident Response Checklist

- [ ] Identify which secrets were exposed
- [ ] Determine exposure duration
- [ ] Rotate all affected secrets
- [ ] Check for unauthorized access
- [ ] Update secrets in all environments
- [ ] Clean repository history
- [ ] Document incident
- [ ] Implement preventive measures

## Automation

### Scheduled Rotation Reminder

```yaml
# .github/workflows/secret-rotation-reminder.yml
name: Secret Rotation Reminder

on:
  schedule:
    - cron: '0 9 1 */3 *'  # Every 3 months

jobs:
  remind:
    runs-on: ubuntu-latest
    steps:
      - name: Create Issue
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🔐 Quarterly Secret Rotation Due',
              body: 'Time to rotate secrets! Run: `./scripts/rotate-secrets.sh`',
              labels: ['security', 'maintenance']
            })
```

### Secret Age Checker

```bash
#!/bin/bash
# scripts/check-secret-age.sh

# Check GitHub secret update times
gh api repos/owner/repo/actions/secrets \
  --jq '.secrets[] | {name, updated_at}'

# Alert if secrets are older than 90 days
```

## Resources

- [GitHub Secret Management](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Azure Key Vault Best Practices](https://docs.microsoft.com/en-us/azure/key-vault/general/best-practices)
- [OWASP Secret Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [12 Factor App - Config](https://12factor.net/config)

## Contact

For security issues or questions about secret management:
- Security Team: security@yourcompany.com
- DevOps Team: devops@yourcompany.com
- On-call: Use PagerDuty