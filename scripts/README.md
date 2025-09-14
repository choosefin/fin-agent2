# Azure Deployment Scripts

## Manual Deployment with Azure CLI

When GitHub Actions build limits are reached, you can use the Azure CLI to trigger deployments manually from your local machine.

### Prerequisites

1. **Install Azure CLI**:
   - macOS: `brew install azure-cli`
   - Linux: `curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash`
   - Windows: Download from [Microsoft](https://aka.ms/installazurecliwindows)

2. **Login to Azure**:
   ```bash
   az login
   ```

### Usage

The `trigger-azure-deploy.sh` script provides a complete deployment solution:

```bash
# Deploy both backend and frontend
./scripts/trigger-azure-deploy.sh both

# Deploy only backend
./scripts/trigger-azure-deploy.sh backend

# Deploy only frontend
./scripts/trigger-azure-deploy.sh frontend

# Skip build and deploy existing artifacts
./scripts/trigger-azure-deploy.sh both --skip-build

# Specify custom resource group
./scripts/trigger-azure-deploy.sh both --resource-group my-resource-group

# Enable verbose output
./scripts/trigger-azure-deploy.sh both --verbose
```

### Interactive Mode

If you run the script without arguments, it will prompt you for the deployment target:

```bash
./scripts/trigger-azure-deploy.sh
```

### Features

- **Automatic Build**: Builds both backend (Motia) and frontend (Next.js) applications
- **Azure Configuration**: Sets up all required app settings and configurations
- **Health Checks**: Verifies deployment status after completion
- **Error Handling**: Includes retry logic and fallback mechanisms
- **Colored Output**: Clear visual feedback with color-coded messages

### What the Script Does

1. **Checks Prerequisites**:
   - Verifies Azure CLI installation
   - Checks Azure login status

2. **Builds Applications** (unless --skip-build):
   - Backend: Installs dependencies, builds Motia, creates deployment package
   - Frontend: Installs dependencies, builds Next.js standalone, packages static files

3. **Configures Azure App Services**:
   - Disables Oryx build (to use pre-built packages)
   - Sets environment variables
   - Configures startup scripts

4. **Deploys Packages**:
   - Stops app service
   - Uploads deployment ZIP
   - Starts app service

5. **Verifies Deployment**:
   - Checks deployment logs
   - Confirms app is running

### Environment Variables

The script uses these environment variables if set:

- `AZURE_RESOURCE_GROUP`: Azure resource group name (default: finagent-rg)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase URL for frontend
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key

### Monitoring After Deployment

```bash
# View live logs for backend
az webapp log tail --name finagent-backend-pps457j4wjrc6 --resource-group finagent-rg

# View live logs for frontend
az webapp log tail --name finagent-web-pps457j4wjrc6 --resource-group finagent-rg

# SSH into backend container
az webapp ssh --name finagent-backend-pps457j4wjrc6 --resource-group finagent-rg

# Restart services if needed
az webapp restart --name finagent-backend-pps457j4wjrc6 --resource-group finagent-rg
az webapp restart --name finagent-web-pps457j4wjrc6 --resource-group finagent-rg
```

### Troubleshooting

1. **Build Failures**: Check that you have Node.js 20.x installed locally
2. **Authentication Issues**: Run `az login` to refresh credentials
3. **Deployment Timeouts**: Use `--skip-build` if packages were already built
4. **App Not Starting**: Check logs with `az webapp log tail` command

### Alternative: Quick Deploy Commands

For quick deployments without the full script:

```bash
# Backend only
cd apps/backend
npm ci && npx motia build
zip -r deploy.zip . -x "*.git*" "*.env*" "*test*"
az webapp deployment source config-zip \
  --resource-group finagent-rg \
  --name finagent-backend-pps457j4wjrc6 \
  --src deploy.zip

# Frontend only
cd apps/web
npm ci && npm run build
cd .next/standalone
zip -r ../../deploy.zip .
cd ../..
az webapp deployment source config-zip \
  --resource-group finagent-rg \
  --name finagent-web-pps457j4wjrc6 \
  --src deploy.zip
```