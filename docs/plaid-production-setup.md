# Plaid Production Setup Guide

## Current Status
- ✅ Plaid Sandbox working locally
- ✅ Azure deployment configured for Plaid environment variables
- 🔄 GitHub secrets need to be added

## Steps to Enable Plaid in Production

### 1. Add Secrets to GitHub (Required for Deployment)
```bash
# Run the setup script
./setup-plaid-secrets.sh

# Or manually add via GitHub UI:
# Go to Settings → Secrets and variables → Actions
# Add:
# - PLAID_CLIENT_ID: your_client_id
# - PLAID_SECRET: your_secret_key
```

### 2. For Production Plaid Access (When Ready)

#### a. Get Production Access
1. Go to [Plaid Dashboard](https://dashboard.plaid.com)
2. Apply for production access
3. Get production credentials

#### b. Update GitHub Workflow
Edit `.github/workflows/azure-deploy.yml` line 505:
```yaml
# Change from:
"value": "sandbox"
# To:
"value": "production"
```

#### c. Update GitHub Secrets
Replace sandbox credentials with production ones:
```bash
gh secret set PLAID_CLIENT_ID --body "your_production_client_id"
gh secret set PLAID_SECRET --body "your_production_secret"
```

### 3. Environment Variables in Azure (Alternative Method)

If you prefer to set environment variables directly in Azure instead of GitHub:

```bash
# Set Plaid credentials in Azure App Service
az webapp config appsettings set \
  --name finagent-backend-pps457j4wjrc6 \
  --resource-group finagent-rg \
  --settings \
    PLAID_CLIENT_ID="your_client_id" \
    PLAID_SECRET="your_secret" \
    PLAID_ENV="sandbox"
```

## How It Works in Production

1. **GitHub Actions Deployment**: 
   - Reads secrets from GitHub Secrets
   - Sets them as Azure App Service settings during deployment
   - No `.env` file needed in production

2. **Azure App Service**:
   - Environment variables are set as Application Settings
   - Node.js reads them via `process.env`
   - Motia framework loads them automatically

3. **Security**:
   - Credentials never stored in code
   - GitHub Secrets are encrypted
   - Azure App Settings are secure
   - Different credentials for dev/staging/production

## Testing Production Deployment

After adding secrets and deploying:

```bash
# Test the backend API directly
curl -X POST https://finagent-backend-pps457j4wjrc6.azurewebsites.net/api/plaid/create-link-token \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user"}'

# Should return a real Plaid link token (not mock)
```

## Troubleshooting

If Plaid isn't working in production:

1. **Check Azure App Settings**:
```bash
az webapp config appsettings list \
  --name finagent-backend-pps457j4wjrc6 \
  --resource-group finagent-rg \
  --query "[?name=='PLAID_CLIENT_ID' || name=='PLAID_SECRET' || name=='PLAID_ENV']"
```

2. **Check Application Logs**:
```bash
az webapp log tail \
  --name finagent-backend-pps457j4wjrc6 \
  --resource-group finagent-rg
```

3. **Verify Credentials**:
- Ensure credentials match your Plaid environment (sandbox vs production)
- Check Plaid Dashboard for any API errors
- Verify allowed redirect URIs in Plaid settings

## Important Notes

- **Sandbox**: Free, unlimited testing, fake data
- **Development**: Real accounts, limited to 100 items
- **Production**: Full access, pricing based on usage

Always test thoroughly in sandbox before moving to production!