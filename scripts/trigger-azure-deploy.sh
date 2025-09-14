#!/bin/bash

# Azure CLI Script to Trigger Manual Deployment
# This script bypasses GitHub Actions and directly deploys to Azure App Service

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AZURE_WEBAPP_NAME_BACKEND="finagent-backend-pps457j4wjrc6"
AZURE_WEBAPP_NAME_FRONTEND="finagent-web-pps457j4wjrc6"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-finagent-rg}"
NODE_VERSION="20.x"

# Parse command line arguments
DEPLOY_TARGET=""
SKIP_BUILD=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        backend|frontend|both)
            DEPLOY_TARGET="$1"
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --resource-group)
            RESOURCE_GROUP="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [backend|frontend|both] [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-build         Skip the build step and deploy existing artifacts"
            echo "  --resource-group RG  Specify the Azure resource group (default: finagent-rg)"
            echo "  --verbose, -v        Enable verbose output"
            echo "  --help, -h           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 both                    # Deploy both backend and frontend"
            echo "  $0 backend                 # Deploy only backend"
            echo "  $0 frontend --skip-build   # Deploy frontend without rebuilding"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check if deploy target is specified
if [ -z "$DEPLOY_TARGET" ]; then
    echo -e "${YELLOW}No deployment target specified. Please choose:${NC}"
    echo "1) Backend only"
    echo "2) Frontend only"
    echo "3) Both"
    read -p "Enter your choice (1-3): " choice
    case $choice in
        1) DEPLOY_TARGET="backend" ;;
        2) DEPLOY_TARGET="frontend" ;;
        3) DEPLOY_TARGET="both" ;;
        *) echo -e "${RED}Invalid choice${NC}"; exit 1 ;;
    esac
fi

# Function to print colored messages
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Azure CLI is installed
check_az_cli() {
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed. Please install it first:"
        echo "  - macOS: brew install azure-cli"
        echo "  - Linux: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
        echo "  - Windows: Download from https://aka.ms/installazurecliwindows"
        exit 1
    fi
    log_success "Azure CLI is installed"
}

# Function to check Azure login status
check_az_login() {
    log_info "Checking Azure login status..."
    if ! az account show &> /dev/null; then
        log_warning "Not logged in to Azure. Initiating login..."
        az login
        if [ $? -ne 0 ]; then
            log_error "Azure login failed"
            exit 1
        fi
    fi
    
    CURRENT_ACCOUNT=$(az account show --query "name" -o tsv)
    log_success "Logged in to Azure account: $CURRENT_ACCOUNT"
}

# Function to build backend
build_backend() {
    log_info "Building backend application..."
    cd apps/backend
    
    # Install dependencies
    log_info "Installing dependencies..."
    npm ci || npm install
    
    # Pre-build Motia
    log_info "Building Motia..."
    npx motia build || echo "Motia build completed or not required"
    npm run build || echo "Build script not found, skipping build"
    
    # Create deployment package
    log_info "Creating deployment package..."
    
    # Remove Windows deployment files
    rm -f .deployment deploy.cmd
    
    # Create startup script
    cat > startup.sh << 'BACKEND_EOF'
#!/bin/bash
set -e
echo "Starting Motia backend application..."
cd /home/site/wwwroot

if [ ! -d "node_modules" ]; then
    echo "ERROR: node_modules not found - attempting emergency install..."
    npm ci --only=production --no-audit --no-fund || npm install --only=production --no-audit --no-fund
fi

if ! npx motia --version > /dev/null 2>&1; then
    echo "ERROR: Motia not found, installing..."
    npm install @motia/core @motia/cli --no-save --no-audit --no-fund
fi

echo "Starting Motia on port ${PORT:-3001}..."
export NODE_OPTIONS="--max-old-space-size=2048"
PORT=${PORT:-3001} timeout 300 npx motia start --host 0.0.0.0 || {
    echo "ERROR: Failed to start Motia within 5 minutes"
    echo "Attempting direct node start as fallback..."
    PORT=${PORT:-3001} node node_modules/@motia/cli/dist/index.js start --host 0.0.0.0
}
BACKEND_EOF
    
    chmod +x startup.sh
    
    # Create deployment zip
    log_info "Creating deployment zip..."
    zip -r deploy.zip . \
        -x "*.git*" \
        -x "*.env*" \
        -x "*test*" \
        -x "*.md" \
        -x ".DS_Store" \
        -x "node_modules/.cache/*" \
        -x "node_modules/.bin/*"
    
    cd ../..
    log_success "Backend build completed"
}

# Function to build frontend
build_frontend() {
    log_info "Building frontend application..."
    cd apps/web
    
    # Install dependencies
    log_info "Installing dependencies..."
    npm ci || npm install
    
    # Remove any conflicting app directory
    rm -rf app/
    
    # Build Next.js
    log_info "Building Next.js application..."
    export NEXT_PUBLIC_API_URL="https://${AZURE_WEBAPP_NAME_BACKEND}.azurewebsites.net"
    export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://fuaogvgmdgndldimnnrs.supabase.co}"
    export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1YW9ndmdtZGduZGxkaW1ubnJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM4NTU4OTAsImV4cCI6MjA0OTQzMTg5MH0.vFq6l6zVbG3M7MJBCymVcjJXNPiCrBvPBfqDOvLxvxo}"
    export SKIP_BUILD_PRODUCT_REDIRECTS=1
    export NODE_ENV=production
    
    npm run build
    
    # Verify standalone build
    if [ ! -d ".next/standalone" ]; then
        log_error "Standalone build not created!"
        exit 1
    fi
    
    # Create deployment package
    log_info "Creating deployment package..."
    mkdir -p deploy-package
    
    # Copy standalone files
    if [ -d ".next/standalone/apps/web" ]; then
        log_info "Monorepo structure detected"
        cp -r .next/standalone/* deploy-package/
        if [ ! -d "deploy-package/.next" ] && [ -d ".next/standalone/apps/web/.next" ]; then
            cp -r .next/standalone/apps/web/.next deploy-package/
        fi
    else
        cp -rL .next/standalone/* deploy-package/
    fi
    
    # Copy static files
    if [ -d "deploy-package/apps/web/.next" ]; then
        mkdir -p deploy-package/apps/web/.next
        cp -r .next/static deploy-package/apps/web/.next/static 2>/dev/null || true
        cp -r public deploy-package/apps/web/public 2>/dev/null || true
    else
        mkdir -p deploy-package/.next
        cp -r .next/static deploy-package/.next/static 2>/dev/null || true
        cp -r public deploy-package/public 2>/dev/null || true
    fi
    
    cp server.js deploy-package/server.js 2>/dev/null || true
    
    # Create startup script
    cat > deploy-package/startup.sh << 'STARTUP_EOF'
#!/bin/bash
echo "=== Starting Next.js server on Azure ==="
cd /home/site/wwwroot

export NODE_ENV=production
export PORT=${WEBSITES_PORT:-${PORT:-8080}}
export HOSTNAME="0.0.0.0"

if [ -f "apps/web/server.js" ]; then
    echo "Starting monorepo Next.js server..."
    cd apps/web
    exec node server.js
elif [ -f "server.js" ]; then
    echo "Starting server.js from root..."
    exec node server.js
elif [ -f ".next/standalone/server.js" ]; then
    echo "Starting Next.js standalone server directly..."
    cd .next/standalone
    exec node server.js
elif [ -f ".next/standalone/apps/web/server.js" ]; then
    echo "Starting monorepo Next.js standalone server..."
    cd .next/standalone/apps/web
    exec node server.js
else
    echo "ERROR: No server.js found!"
    if [ -f "package.json" ] && [ -d "node_modules" ]; then
        echo "Attempting to start with npx next start..."
        exec npx next start -H 0.0.0.0 -p ${PORT}
    else
        echo "FATAL: Cannot start Next.js application"
        exit 1
    fi
fi
STARTUP_EOF
    
    chmod +x deploy-package/startup.sh
    
    # Add deployment configuration
    cat > deploy-package/.deployment << 'EOF'
[config]
SCM_DO_BUILD_DURING_DEPLOYMENT = false
EOF
    
    # Add package.json
    cat > deploy-package/package.json << 'EOF'
{
  "name": "web",
  "version": "1.0.0",
  "scripts": {
    "start": "bash startup.sh"
  }
}
EOF
    
    touch deploy-package/.do-not-run-on-build
    
    # Create deployment zip
    cd deploy-package
    log_info "Creating deployment zip..."
    zip -r ../deploy.zip . \
        -x "*.git*" \
        -x "*.env*" \
        -x ".next/cache/*" \
        -x "*test*" \
        -x "*.md" \
        -x ".DS_Store" \
        -x "node_modules/.cache/*"
    
    cd ../../..
    log_success "Frontend build completed"
}

# Function to deploy backend
deploy_backend() {
    log_info "Deploying backend to Azure..."
    
    # Configure app settings
    log_info "Configuring backend app settings..."
    az webapp config appsettings set \
        --name "$AZURE_WEBAPP_NAME_BACKEND" \
        --resource-group "$RESOURCE_GROUP" \
        --settings \
            SCM_DO_BUILD_DURING_DEPLOYMENT=false \
            ENABLE_ORYX_BUILD=false \
            NODE_ENV=production \
            WEBSITE_NODE_DEFAULT_VERSION="~20" \
            WEBSITE_STARTUP_FILE="startup.sh" \
            ALLOWED_ORIGINS="https://${AZURE_WEBAPP_NAME_FRONTEND}.azurewebsites.net" \
        --output none
    
    # Remove WEBSITE_RUN_FROM_PACKAGE if exists
    az webapp config appsettings delete \
        --name "$AZURE_WEBAPP_NAME_BACKEND" \
        --resource-group "$RESOURCE_GROUP" \
        --setting-names WEBSITE_RUN_FROM_PACKAGE 2>/dev/null || true
    
    # Stop the app
    log_info "Stopping backend app..."
    az webapp stop --name "$AZURE_WEBAPP_NAME_BACKEND" --resource-group "$RESOURCE_GROUP"
    sleep 5
    
    # Deploy the package
    log_info "Deploying backend package..."
    az webapp deployment source config-zip \
        --resource-group "$RESOURCE_GROUP" \
        --name "$AZURE_WEBAPP_NAME_BACKEND" \
        --src apps/backend/deploy.zip \
        --timeout 900
    
    # Start the app
    log_info "Starting backend app..."
    az webapp start --name "$AZURE_WEBAPP_NAME_BACKEND" --resource-group "$RESOURCE_GROUP"
    
    log_success "Backend deployed successfully"
    echo "Backend URL: https://${AZURE_WEBAPP_NAME_BACKEND}.azurewebsites.net"
}

# Function to deploy frontend
deploy_frontend() {
    log_info "Deploying frontend to Azure..."
    
    # Configure app settings
    log_info "Configuring frontend app settings..."
    az webapp config appsettings set \
        --name "$AZURE_WEBAPP_NAME_FRONTEND" \
        --resource-group "$RESOURCE_GROUP" \
        --settings \
            SCM_DO_BUILD_DURING_DEPLOYMENT=false \
            ENABLE_ORYX_BUILD=false \
            NODE_ENV=production \
            WEBSITE_NODE_DEFAULT_VERSION="~20" \
            WEBSITE_STARTUP_FILE="startup.sh" \
            NEXT_PUBLIC_API_URL="https://${AZURE_WEBAPP_NAME_BACKEND}.azurewebsites.net" \
        --output none
    
    # Remove WEBSITE_RUN_FROM_PACKAGE if exists
    az webapp config appsettings delete \
        --name "$AZURE_WEBAPP_NAME_FRONTEND" \
        --resource-group "$RESOURCE_GROUP" \
        --setting-names WEBSITE_RUN_FROM_PACKAGE 2>/dev/null || true
    
    # Stop the app
    log_info "Stopping frontend app..."
    az webapp stop --name "$AZURE_WEBAPP_NAME_FRONTEND" --resource-group "$RESOURCE_GROUP"
    sleep 5
    
    # Deploy the package
    log_info "Deploying frontend package..."
    az webapp deployment source config-zip \
        --resource-group "$RESOURCE_GROUP" \
        --name "$AZURE_WEBAPP_NAME_FRONTEND" \
        --src apps/web/deploy.zip \
        --timeout 900
    
    # Start the app
    log_info "Starting frontend app..."
    az webapp start --name "$AZURE_WEBAPP_NAME_FRONTEND" --resource-group "$RESOURCE_GROUP"
    
    log_success "Frontend deployed successfully"
    echo "Frontend URL: https://${AZURE_WEBAPP_NAME_FRONTEND}.azurewebsites.net"
}

# Function to check deployment status
check_deployment_status() {
    local app_name=$1
    log_info "Checking deployment status for $app_name..."
    
    # Get deployment logs
    az webapp log deployment show \
        --name "$app_name" \
        --resource-group "$RESOURCE_GROUP" \
        --output table
    
    # Check if app is running
    local state=$(az webapp show --name "$app_name" --resource-group "$RESOURCE_GROUP" --query "state" -o tsv)
    if [ "$state" == "Running" ]; then
        log_success "$app_name is running"
    else
        log_warning "$app_name state: $state"
    fi
}

# Main execution
main() {
    echo -e "${GREEN}Azure Manual Deployment Script${NC}"
    echo "================================"
    echo ""
    
    # Check prerequisites
    check_az_cli
    check_az_login
    
    echo ""
    log_info "Deployment configuration:"
    echo "  - Target: $DEPLOY_TARGET"
    echo "  - Resource Group: $RESOURCE_GROUP"
    echo "  - Backend: $AZURE_WEBAPP_NAME_BACKEND"
    echo "  - Frontend: $AZURE_WEBAPP_NAME_FRONTEND"
    echo "  - Skip Build: $SKIP_BUILD"
    echo ""
    
    # Confirmation prompt
    read -p "Do you want to proceed? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "Deployment cancelled"
        exit 0
    fi
    
    # Execute deployment based on target
    case $DEPLOY_TARGET in
        backend)
            if [ "$SKIP_BUILD" != true ]; then
                build_backend
            fi
            deploy_backend
            check_deployment_status "$AZURE_WEBAPP_NAME_BACKEND"
            ;;
        frontend)
            if [ "$SKIP_BUILD" != true ]; then
                build_frontend
            fi
            deploy_frontend
            check_deployment_status "$AZURE_WEBAPP_NAME_FRONTEND"
            ;;
        both)
            if [ "$SKIP_BUILD" != true ]; then
                build_backend
                build_frontend
            fi
            deploy_backend
            deploy_frontend
            check_deployment_status "$AZURE_WEBAPP_NAME_BACKEND"
            check_deployment_status "$AZURE_WEBAPP_NAME_FRONTEND"
            ;;
    esac
    
    echo ""
    log_success "Deployment completed!"
    
    # Show helpful commands
    echo ""
    echo -e "${BLUE}Useful commands:${NC}"
    echo "  # View live logs:"
    echo "  az webapp log tail --name $AZURE_WEBAPP_NAME_BACKEND --resource-group $RESOURCE_GROUP"
    echo "  az webapp log tail --name $AZURE_WEBAPP_NAME_FRONTEND --resource-group $RESOURCE_GROUP"
    echo ""
    echo "  # Restart apps:"
    echo "  az webapp restart --name $AZURE_WEBAPP_NAME_BACKEND --resource-group $RESOURCE_GROUP"
    echo "  az webapp restart --name $AZURE_WEBAPP_NAME_FRONTEND --resource-group $RESOURCE_GROUP"
    echo ""
    echo "  # SSH into app:"
    echo "  az webapp ssh --name $AZURE_WEBAPP_NAME_BACKEND --resource-group $RESOURCE_GROUP"
}

# Run main function
main