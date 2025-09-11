#!/bin/bash

# Azure Deployment Script for Fin Agent Platform
# This script handles the deployment of the application to Azure Container Instances

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Azure Deployment for Fin Agent Platform${NC}"

# Check for required tools
command -v az >/dev/null 2>&1 || { echo -e "${RED}Azure CLI is required but not installed. Aborting.${NC}" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker is required but not installed. Aborting.${NC}" >&2; exit 1; }

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}Warning: .env.production not found. Using defaults.${NC}"
fi

# Set Azure variables
RESOURCE_GROUP=${AZURE_RESOURCE_GROUP:-"finagent-rg"}
LOCATION=${AZURE_LOCATION:-"eastus"}
CONTAINER_GROUP_NAME=${AZURE_CONTAINER_GROUP:-"finagent-container-group"}
REDIS_NAME=${AZURE_REDIS_NAME:-"finagent-redis"}

# Login to Azure (if not already logged in)
echo -e "${GREEN}Checking Azure login status...${NC}"
az account show >/dev/null 2>&1 || az login

# Create resource group if it doesn't exist
echo -e "${GREEN}Creating/updating resource group...${NC}"
az group create --name $RESOURCE_GROUP --location $LOCATION

# Get Container Registry details
echo -e "${GREEN}Setting up Container Registry...${NC}"
ACR_NAME=$(az acr list --resource-group $RESOURCE_GROUP --query "[0].name" -o tsv)

if [ -z "$ACR_NAME" ]; then
    # Registry will be created by ARM template
    ACR_NAME="finagentacr$(openssl rand -hex 4)"
    echo -e "${YELLOW}Container Registry will be created: $ACR_NAME${NC}"
else
    echo -e "${GREEN}Using existing Container Registry: $ACR_NAME${NC}"
fi

# Build Docker images
echo -e "${GREEN}Building Docker images...${NC}"
docker-compose build

# Tag images for Azure Container Registry
echo -e "${GREEN}Tagging images for Azure Container Registry...${NC}"
docker tag backend:latest $ACR_NAME.azurecr.io/finagent-backend:latest
docker tag web:latest $ACR_NAME.azurecr.io/finagent-web:latest

# Deploy ARM template
echo -e "${GREEN}Deploying Azure resources...${NC}"
az deployment group create \
    --resource-group $RESOURCE_GROUP \
    --template-file azure-deploy.json \
    --parameters \
        containerGroupName=$CONTAINER_GROUP_NAME \
        redisName=$REDIS_NAME \
        supabaseUrl=$SUPABASE_URL \
        supabaseAnonKey=$SUPABASE_ANON_KEY \
        supabaseServiceKey=$SUPABASE_SERVICE_KEY \
        plaidClientId=$PLAID_CLIENT_ID \
        plaidSecret=$PLAID_SECRET \
        polygonApiKey=$POLYGON_API_KEY \
        alpacaApiKey=$ALPACA_API_KEY \
        alpacaSecretKey=$ALPACA_SECRET_KEY \
        openaiApiKey=$OPENAI_API_KEY \
        anthropicApiKey=$ANTHROPIC_API_KEY \
        groqApiKey=$GROQ_API_KEY \
        mem0ApiKey=$MEM0_API_KEY

# Get ACR credentials and login
echo -e "${GREEN}Logging into Azure Container Registry...${NC}"
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)

docker login $ACR_LOGIN_SERVER -u $ACR_USERNAME -p $ACR_PASSWORD

# Push images to ACR
echo -e "${GREEN}Pushing images to Azure Container Registry...${NC}"
docker push $ACR_NAME.azurecr.io/finagent-backend:latest
docker push $ACR_NAME.azurecr.io/finagent-web:latest

# Restart container group to pull latest images
echo -e "${GREEN}Restarting container instances...${NC}"
az container restart --resource-group $RESOURCE_GROUP --name $CONTAINER_GROUP_NAME

# Get deployment outputs
echo -e "${GREEN}Deployment complete! Getting deployment information...${NC}"
FQDN=$(az container show --resource-group $RESOURCE_GROUP --name $CONTAINER_GROUP_NAME --query ipAddress.fqdn -o tsv)

echo -e "${GREEN}✅ Deployment Successful!${NC}"
echo -e "Web App URL: ${GREEN}http://$FQDN:3000${NC}"
echo -e "API URL: ${GREEN}http://$FQDN:3001${NC}"
echo -e ""
echo -e "${YELLOW}Note: It may take a few minutes for the services to become fully available.${NC}"

# Optional: Show container logs
read -p "Would you like to view container logs? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    az container logs --resource-group $RESOURCE_GROUP --name $CONTAINER_GROUP_NAME --container-name backend --follow &
    az container logs --resource-group $RESOURCE_GROUP --name $CONTAINER_GROUP_NAME --container-name web --follow
fi