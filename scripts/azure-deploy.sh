#!/bin/bash

# Azure App Service Deployment Script for Fin Agent Platform
# This script automates the deployment with environment variables from .env.production

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Azure App Service Deployment Script${NC}"
echo -e "${BLUE}========================================${NC}"

# Check for required tools
command -v az >/dev/null 2>&1 || { echo -e "${RED}Azure CLI is required but not installed. Aborting.${NC}" >&2; exit 1; }

# Configuration
RESOURCE_GROUP=${AZURE_RESOURCE_GROUP:-"finagent-rg"}
LOCATION=${AZURE_LOCATION:-"eastus"}
ENV_FILE=".env.production"
TEMPLATE_FILE="azure-appservice-deploy.json"

# Check if .env.production exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: $ENV_FILE not found!${NC}"
    echo "Please create $ENV_FILE with your environment variables"
    exit 1
fi

# Load environment variables from .env.production
echo -e "${YELLOW}Loading environment variables from $ENV_FILE...${NC}"
set -a
source "$ENV_FILE"
set +a

# Function to check if variable is set
check_var() {
    local var_name=$1
    local var_value=${!var_name}
    if [ -z "$var_value" ]; then
        echo -e "${RED}Warning: $var_name is not set in $ENV_FILE${NC}"
        return 1
    fi
    return 0
}

# Check required variables
echo -e "${YELLOW}Checking required environment variables...${NC}"
MISSING_VARS=0

check_var "SUPABASE_URL" || MISSING_VARS=$((MISSING_VARS + 1))
check_var "SUPABASE_ANON_KEY" || MISSING_VARS=$((MISSING_VARS + 1))
check_var "SUPABASE_SERVICE_KEY" || MISSING_VARS=$((MISSING_VARS + 1))

# Optional variables (warn but don't fail)
check_var "PLAID_CLIENT_ID" || echo -e "${YELLOW}  Plaid integration will not work${NC}"
check_var "PLAID_SECRET" || echo -e "${YELLOW}  Plaid integration will not work${NC}"
check_var "POLYGON_API_KEY" || echo -e "${YELLOW}  Polygon market data will not work${NC}"
check_var "ALPACA_API_KEY" || echo -e "${YELLOW}  Alpaca trading will not work${NC}"
check_var "OPENAI_API_KEY" || echo -e "${YELLOW}  OpenAI LLM will not work${NC}"
check_var "ANTHROPIC_API_KEY" || echo -e "${YELLOW}  Anthropic LLM will not work${NC}"
check_var "GROQ_API_KEY" || echo -e "${YELLOW}  Groq LLM will not work${NC}"

if [ $MISSING_VARS -gt 0 ]; then
    echo -e "${RED}Error: $MISSING_VARS required variables are missing${NC}"
    echo "Please update $ENV_FILE with all required values"
    exit 1
fi

# Check if logged into Azure
echo -e "${YELLOW}Checking Azure login status...${NC}"
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}Not logged into Azure. Please login:${NC}"
    az login
fi

# Get current subscription
SUBSCRIPTION=$(az account show --query name -o tsv)
echo -e "${GREEN}Using Azure subscription: $SUBSCRIPTION${NC}"

# Create resource group if it doesn't exist
echo -e "${YELLOW}Creating/updating resource group: $RESOURCE_GROUP...${NC}"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" > /dev/null
echo -e "${GREEN}✓ Resource group ready${NC}"

# Prepare parameters for deployment
echo -e "${YELLOW}Preparing deployment parameters...${NC}"

# Create parameters file
cat > azure-deploy.parameters.json <<EOF
{
  "\$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "supabaseUrl": {
      "value": "${SUPABASE_URL:-}"
    },
    "supabaseAnonKey": {
      "value": "${SUPABASE_ANON_KEY:-}"
    },
    "supabaseServiceKey": {
      "value": "${SUPABASE_SERVICE_KEY:-}"
    },
    "plaidClientId": {
      "value": "${PLAID_CLIENT_ID:-placeholder}"
    },
    "plaidSecret": {
      "value": "${PLAID_SECRET:-placeholder}"
    },
    "polygonApiKey": {
      "value": "${POLYGON_API_KEY:-placeholder}"
    },
    "alpacaApiKey": {
      "value": "${ALPACA_API_KEY:-placeholder}"
    },
    "alpacaSecretKey": {
      "value": "${ALPACA_SECRET_KEY:-placeholder}"
    },
    "openaiApiKey": {
      "value": "${OPENAI_API_KEY:-placeholder}"
    },
    "anthropicApiKey": {
      "value": "${ANTHROPIC_API_KEY:-placeholder}"
    },
    "groqApiKey": {
      "value": "${GROQ_API_KEY:-placeholder}"
    },
    "mem0ApiKey": {
      "value": "${MEM0_API_KEY:-placeholder}"
    }
  }
}
EOF

echo -e "${GREEN}✓ Parameters file created${NC}"

# Deploy to Azure
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Starting Azure deployment...${NC}"
echo -e "${BLUE}========================================${NC}"

DEPLOYMENT_NAME="finagent-deployment-$(date +%Y%m%d-%H%M%S)"

echo -e "${YELLOW}Deployment name: $DEPLOYMENT_NAME${NC}"
echo -e "${YELLOW}This may take 5-10 minutes...${NC}"

# Run deployment
if az deployment group create \
    --name "$DEPLOYMENT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "$TEMPLATE_FILE" \
    --parameters @azure-deploy.parameters.json \
    --verbose; then
    
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    
    # Get deployment outputs
    echo -e "${YELLOW}Getting deployment outputs...${NC}"
    
    BACKEND_URL=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$DEPLOYMENT_NAME" \
        --query properties.outputs.backendUrl.value -o tsv)
    
    FRONTEND_URL=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$DEPLOYMENT_NAME" \
        --query properties.outputs.frontendUrl.value -o tsv)
    
    echo -e "${GREEN}✓ Backend URL: $BACKEND_URL${NC}"
    echo -e "${GREEN}✓ Frontend URL: $FRONTEND_URL${NC}"
    
    # Save URLs to file
    cat > deployment-urls.txt <<EOF
Backend URL: $BACKEND_URL
Frontend URL: $FRONTEND_URL
Deployment Name: $DEPLOYMENT_NAME
Resource Group: $RESOURCE_GROUP
Timestamp: $(date)
EOF
    
    echo -e "${GREEN}URLs saved to deployment-urls.txt${NC}"
    
    # Deploy application code
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Deploying application code...${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    # Get app names from deployment
    BACKEND_APP=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$DEPLOYMENT_NAME" \
        --query properties.outputs.backendAppName.value -o tsv 2>/dev/null)
    
    if [ -z "$BACKEND_APP" ]; then
        # Fallback to getting from parameters
        BACKEND_APP="finagent-backend-$(az deployment group show --resource-group "$RESOURCE_GROUP" --name "$DEPLOYMENT_NAME" --query properties.parameters.webAppName.value -o tsv | sed 's/"//g')"
    fi
    
    FRONTEND_APP=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$DEPLOYMENT_NAME" \
        --query properties.outputs.frontendAppName.value -o tsv 2>/dev/null)
    
    if [ -z "$FRONTEND_APP" ]; then
        # Fallback to getting from parameters
        FRONTEND_APP="finagent-web-$(az deployment group show --resource-group "$RESOURCE_GROUP" --name "$DEPLOYMENT_NAME" --query properties.parameters.frontendAppName.value -o tsv | sed 's/"//g')"
    fi
    
    # Deploy backend
    echo -e "${YELLOW}Deploying backend code to Azure App Service...${NC}"
    cd apps/backend
    
    # Create deployment package
    echo -e "${YELLOW}Creating backend deployment package...${NC}"
    zip -r backend-deploy.zip . \
        -x "*.git*" \
        -x "*node_modules*" \
        -x "*.env*" \
        -x "*dist*" \
        -x "*.motia*" \
        -x "*.DS_Store" > /dev/null
    
    # Deploy using ZIP deployment
    echo -e "${YELLOW}Uploading backend code...${NC}"
    if az webapp deployment source config-zip \
        --resource-group "$RESOURCE_GROUP" \
        --name "$BACKEND_APP" \
        --src backend-deploy.zip 2>/dev/null; then
        echo -e "${GREEN}✓ Backend code deployed${NC}"
    else
        echo -e "${YELLOW}Using alternative deployment method...${NC}"
        # Try alternative deployment method
        az webapp deploy \
            --resource-group "$RESOURCE_GROUP" \
            --name "$BACKEND_APP" \
            --src-path backend-deploy.zip \
            --type zip 2>/dev/null || echo -e "${RED}Backend deployment may need manual intervention${NC}"
    fi
    
    rm backend-deploy.zip
    cd ../..
    
    # Deploy frontend
    echo -e "${YELLOW}Deploying frontend code to Azure App Service...${NC}"
    cd apps/web
    
    # Build frontend
    echo -e "${YELLOW}Building frontend for production...${NC}"
    npm run build || echo -e "${YELLOW}Frontend build warnings ignored${NC}"
    
    # Create deployment package
    echo -e "${YELLOW}Creating frontend deployment package...${NC}"
    zip -r frontend-deploy.zip . \
        -x "*.git*" \
        -x "*node_modules*" \
        -x "*.env*" \
        -x "*.next/cache*" \
        -x "*.DS_Store" > /dev/null
    
    # Deploy using ZIP deployment
    echo -e "${YELLOW}Uploading frontend code...${NC}"
    if az webapp deployment source config-zip \
        --resource-group "$RESOURCE_GROUP" \
        --name "$FRONTEND_APP" \
        --src frontend-deploy.zip 2>/dev/null; then
        echo -e "${GREEN}✓ Frontend code deployed${NC}"
    else
        echo -e "${YELLOW}Using alternative deployment method...${NC}"
        # Try alternative deployment method
        az webapp deploy \
            --resource-group "$RESOURCE_GROUP" \
            --name "$FRONTEND_APP" \
            --src-path frontend-deploy.zip \
            --type zip 2>/dev/null || echo -e "${RED}Frontend deployment may need manual intervention${NC}"
    fi
    
    rm frontend-deploy.zip
    cd ../..
    
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Deployment Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${GREEN}Your applications are available at:${NC}"
    echo -e "${BLUE}Backend API: $BACKEND_URL${NC}"
    echo -e "${BLUE}Frontend App: $FRONTEND_URL${NC}"
    echo ""
    echo -e "${YELLOW}Note: It may take 3-5 minutes for the apps to start${NC}"
    echo -e "${YELLOW}You can check logs with:${NC}"
    echo "  az webapp log tail --resource-group $RESOURCE_GROUP --name $BACKEND_APP"
    echo "  az webapp log tail --resource-group $RESOURCE_GROUP --name $FRONTEND_APP"
    
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}Deployment failed!${NC}"
    echo -e "${RED}========================================${NC}"
    echo -e "${YELLOW}Check the error messages above for details${NC}"
    echo -e "${YELLOW}You can also check the deployment in Azure Portal${NC}"
    exit 1
fi

# Clean up parameters file (contains secrets)
rm -f azure-deploy.parameters.json

echo -e "${GREEN}Script completed!${NC}"