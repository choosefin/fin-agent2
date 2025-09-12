#!/bin/bash
# Script to clear deployment locks and restart Azure Web Apps

set -e

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "Azure CLI is not installed. Please install it first."
    exit 1
fi

# Configuration
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-finagent-rg}"
BACKEND_APP="${AZURE_WEBAPP_NAME_BACKEND:-finagent-backend-pps457j4wjrc6}"
FRONTEND_APP="${AZURE_WEBAPP_NAME_FRONTEND:-finagent-web-pps457j4wjrc6}"

echo "=== Clearing Deployment Locks for Azure Web Apps ==="
echo "Resource Group: $RESOURCE_GROUP"
echo "Backend App: $BACKEND_APP"
echo "Frontend App: $FRONTEND_APP"

# Function to clear deployment for an app
clear_deployment() {
    local APP_NAME=$1
    echo ""
    echo "Processing $APP_NAME..."
    
    # Stop the web app
    echo "  Stopping $APP_NAME..."
    az webapp stop --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" 2>/dev/null || echo "  Could not stop (may already be stopped)"
    
    # Wait a moment
    sleep 5
    
    # Clear deployment locks
    echo "  Clearing deployment locks..."
    az webapp deployment source sync --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" 2>/dev/null || echo "  No deployment to sync"
    
    # Delete deployment logs to clear any stuck deployments
    echo "  Clearing deployment logs..."
    az webapp log deployment clear --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" 2>/dev/null || echo "  Could not clear logs"
    
    # Start the web app
    echo "  Starting $APP_NAME..."
    az webapp start --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" 2>/dev/null || echo "  Could not start"
    
    # Check status
    echo "  Checking status..."
    STATE=$(az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query "state" -o tsv 2>/dev/null || echo "Unknown")
    echo "  Current state: $STATE"
}

# Login to Azure if not already logged in
echo ""
echo "Checking Azure login status..."
if ! az account show &>/dev/null; then
    echo "Please login to Azure:"
    az login
fi

# Clear backend deployment
clear_deployment "$BACKEND_APP"

# Clear frontend deployment  
clear_deployment "$FRONTEND_APP"

echo ""
echo "=== Deployment locks cleared ==="
echo "You can now retry the deployment."
echo ""
echo "To manually deploy, run:"
echo "  cd apps/backend && ./deploy.sh"
echo "  cd apps/web && ./deploy.sh"