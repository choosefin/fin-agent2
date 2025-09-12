# GitHub Actions Setup for Azure Deployment

This guide will help you set up GitHub Actions to automatically deploy your Fin Agent application to Azure App Service.

## Prerequisites

- GitHub repository with your code
- Azure App Services already created (✅ Done)
- Azure CLI installed locally (✅ Done)

## Required GitHub Secrets

You need to add the following secrets to your GitHub repository:

### 1. Navigate to GitHub Secrets
1. Go to your GitHub repository
2. Click on **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

### 2. Add the Following Secrets

#### Publishing Profiles (Required)

**AZURE_WEBAPP_PUBLISH_PROFILE_BACKEND**
- Copy the entire contents of `backend-publish-profile.xml`
- This file has been generated in your project root

**AZURE_WEBAPP_PUBLISH_PROFILE_FRONTEND**
- Copy the entire contents of `frontend-publish-profile.xml`
- This file has been generated in your project root

#### Azure Credentials (Required for App Settings)

**AZURE_RESOURCE_GROUP**
- The name of your Azure resource group
- Default: `finagent-rg`

**AZURE_CREDENTIALS**
```json
{
  "clientId": "<AZURE_CLIENT_ID>",
  "clientSecret": "<AZURE_CLIENT_SECRET>",
  "subscriptionId": "<AZURE_SUBSCRIPTION_ID>",
  "tenantId": "<AZURE_TENANT_ID>"
}
```

To create Azure credentials:
```bash
# Create a service principal
az ad sp create-for-rbac --name "github-actions-finagent" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/finagent-rg \
  --sdk-auth
```

Copy the JSON output and save it as the `AZURE_CREDENTIALS` secret.

⚠️ **IMPORTANT**: Never commit the credentials JSON to your repository!

#### Application Secrets (Required)

**SUPABASE_URL**
- Your Supabase project URL
- Example: `https://xxxxx.supabase.co`

**SUPABASE_ANON_KEY**
- Your Supabase anonymous key
- Found in Supabase dashboard → Settings → API

**SUPABASE_SERVICE_KEY**
- Your Supabase service role key
- Found in Supabase dashboard → Settings → API

#### Optional API Keys

Add these if you want to enable the respective services:

- **PLAID_CLIENT_ID** - Plaid client ID
- **PLAID_SECRET** - Plaid secret key
- **POLYGON_API_KEY** - Polygon.io API key
- **ALPACA_API_KEY** - Alpaca trading API key
- **ALPACA_SECRET_KEY** - Alpaca secret key
- **OPENAI_API_KEY** - OpenAI API key
- **ANTHROPIC_API_KEY** - Anthropic API key
- **GROQ_API_KEY** - Groq API key
- **MEM0_API_KEY** - Mem0 API key

## Deployment Workflow

The GitHub Action workflow (`azure-deploy.yml`) will:

1. **Trigger on:**
   - Push to main/master branch
   - Pull requests to main/master
   - Manual trigger (workflow_dispatch)

2. **Build and Deploy Backend:**
   - Install dependencies with pnpm
   - Build the backend application
   - Package and deploy to Azure App Service

3. **Build and Deploy Frontend:**
   - Install dependencies with pnpm
   - Build the Next.js application
   - Package with startup script
   - Deploy to Azure App Service

4. **Configure App Settings:**
   - Set environment variables
   - Configure Node.js version
   - Set startup commands

## Manual Deployment Trigger

To manually trigger a deployment:

1. Go to **Actions** tab in your GitHub repository
2. Select **Deploy to Azure App Service**
3. Click **Run workflow**
4. Select the branch and click **Run workflow**

## Monitoring Deployments

### GitHub Actions
- Check the **Actions** tab in your repository
- View logs for each workflow run
- Debug any failures in the workflow steps

### Azure Portal
- Navigate to your App Services in Azure Portal
- Check **Deployment Center** for deployment history
- View **Log stream** for application logs

### Application URLs
- Backend API: https://finagent-backend-pps457j4wjrc6.azurewebsites.net
- Frontend App: https://finagent-web-pps457j4wjrc6.azurewebsites.net

## Troubleshooting

### Common Issues

1. **503 Service Unavailable**
   - Wait 3-5 minutes after deployment for the app to start
   - Check Azure Portal → App Service → Log stream
   - Verify all required secrets are set

2. **Build Failures**
   - Check GitHub Actions logs
   - Ensure all dependencies are in package.json
   - Verify Node.js version compatibility

3. **Missing Environment Variables**
   - Check Azure Portal → App Service → Configuration
   - Verify all secrets are properly set in GitHub
   - Restart the App Service after configuration changes

### Useful Commands

```bash
# Check deployment status
az webapp deployment list --name finagent-backend-pps457j4wjrc6 --resource-group finagent-rg

# View application logs
az webapp log tail --name finagent-backend-pps457j4wjrc6 --resource-group finagent-rg

# Restart app service
az webapp restart --name finagent-backend-pps457j4wjrc6 --resource-group finagent-rg
```

## Next Steps

1. Add all required secrets to GitHub
2. Push your code to the main branch or manually trigger the workflow
3. Monitor the deployment in GitHub Actions
4. Verify your applications are running at the provided URLs

## Security Notes

- Never commit publish profiles or credentials to your repository
- Keep the `*.xml` files in `.gitignore`
- Rotate service principal credentials periodically
- Use Azure Key Vault for production secrets management