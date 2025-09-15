#!/bin/bash
# Quick test deployment script to validate our fixes locally before pushing

set -e

echo "=== Testing Deployment Package Creation ==="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test frontend deployment
test_frontend() {
    echo -e "${YELLOW}Testing Frontend Deployment Package...${NC}"
    cd apps/web
    
    # Check if build exists
    if [ ! -d ".next" ]; then
        echo -e "${RED}ERROR: No .next build found. Run 'pnpm build' first${NC}"
        return 1
    fi
    
    # Create test deployment package
    rm -rf test-deploy
    mkdir -p test-deploy
    
    # Check for standalone build
    if [ -d ".next/standalone" ]; then
        echo -e "${GREEN}✓ Found standalone build${NC}"
        cp -r .next/standalone/* test-deploy/
        cp -r .next/static test-deploy/.next/ 2>/dev/null || true
        cp -r public test-deploy/ 2>/dev/null || true
        
        # Test if server.js exists
        if [ -f "test-deploy/server.js" ]; then
            echo -e "${GREEN}✓ server.js found${NC}"
        else
            echo -e "${RED}✗ server.js not found in standalone${NC}"
        fi
    else
        echo -e "${YELLOW}No standalone build, using regular build${NC}"
        cp -r .next test-deploy/
        cp -r public test-deploy/
        cp package.json test-deploy/
    fi
    
    # Add deployment files
    cat > test-deploy/.deployment << 'EOF'
[config]
SCM_DO_BUILD_DURING_DEPLOYMENT = false
EOF
    echo -e "${GREEN}✓ Created .deployment file${NC}"
    
    # Add startup script
    cat > test-deploy/startup.sh << 'EOF'
#!/bin/bash
set -e
echo "=== Starting Next.js server ==="
cd /home/site/wwwroot

if [ -f "server.js" ]; then
    echo "Starting standalone server..."
    PORT=${PORT:-8080} node server.js
elif [ -d ".next" ]; then
    echo "Starting Next.js..."
    if [ ! -f "node_modules/next/package.json" ]; then
        npm install next react react-dom --production --no-save
    fi
    PORT=${PORT:-8080} npx next start
else
    echo "ERROR: No Next.js build found!"
    exit 1
fi
EOF
    chmod +x test-deploy/startup.sh
    echo -e "${GREEN}✓ Created startup.sh${NC}"
    
    # Test local startup
    echo -e "${YELLOW}Testing local startup...${NC}"
    cd test-deploy
    
    # Check if we can start the server
    if [ -f "server.js" ]; then
        echo -e "${GREEN}✓ Can start with: node server.js${NC}"
        # Quick test - start and kill immediately
        timeout 2 node server.js 2>/dev/null || true
    else
        echo -e "${YELLOW}Would need to install dependencies${NC}"
    fi
    
    cd ..
    
    # Create zip package
    cd test-deploy
    zip -r ../test-deploy.zip . -x "*.git*" > /dev/null 2>&1
    cd ..
    
    # Check package size
    SIZE=$(du -h test-deploy.zip | cut -f1)
    echo -e "${GREEN}✓ Deployment package created: $SIZE${NC}"
    
    cd ../..
    return 0
}

# Function to test backend deployment
test_backend() {
    echo -e "${YELLOW}Testing Backend Deployment Package...${NC}"
    cd apps/backend
    
    # Create test deployment package
    rm -rf test-deploy
    mkdir -p test-deploy
    
    # Copy necessary files
    cp -r dist test-deploy/ 2>/dev/null || echo -e "${YELLOW}No dist folder${NC}"
    cp -r steps test-deploy/
    cp -r services test-deploy/
    cp package.json test-deploy/
    cp *.json test-deploy/ 2>/dev/null || true
    
    # Add deployment files
    cat > test-deploy/.deployment << 'EOF'
[config]
SCM_DO_BUILD_DURING_DEPLOYMENT = false
EOF
    echo -e "${GREEN}✓ Created .deployment file${NC}"
    
    # Add startup script
    cat > test-deploy/startup.sh << 'EOF'
#!/bin/bash
set -e
echo "=== Starting Motia backend ==="
cd /home/site/wwwroot

if [ ! -d "node_modules" ]; then
    npm install --production
fi

PORT=${PORT:-3001} npx motia dev --host 0.0.0.0
EOF
    chmod +x test-deploy/startup.sh
    echo -e "${GREEN}✓ Created startup.sh${NC}"
    
    cd ../..
    return 0
}

# Function to directly deploy to Azure (faster than GitHub Actions)
direct_deploy() {
    local APP_TYPE=$1
    local APP_NAME=$2
    
    echo -e "${YELLOW}Direct deployment to $APP_NAME...${NC}"
    
    if [ "$APP_TYPE" == "frontend" ]; then
        cd apps/web
        ZIP_FILE="test-deploy.zip"
    else
        cd apps/backend
        ZIP_FILE="test-deploy.zip"
    fi
    
    if [ ! -f "$ZIP_FILE" ]; then
        echo -e "${RED}ERROR: No test deployment package found${NC}"
        return 1
    fi
    
    echo "Deploying $ZIP_FILE to $APP_NAME..."
    
    # Deploy using Azure CLI
    az webapp deployment source config-zip \
        --resource-group finagent-rg \
        --name "$APP_NAME" \
        --src "$ZIP_FILE" \
        --timeout 300 || {
            echo -e "${RED}Deployment failed${NC}"
            return 1
        }
    
    echo -e "${GREEN}✓ Deployment complete${NC}"
    
    # Check app status
    sleep 5
    echo "Checking app status..."
    STATUS=$(az webapp show --name "$APP_NAME" --resource-group finagent-rg --query "state" -o tsv)
    echo "App state: $STATUS"
    
    # Get app URL and test
    URL="https://${APP_NAME}.azurewebsites.net"
    echo "Testing $URL..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL" || echo "000")
    
    if [ "$HTTP_CODE" == "200" ]; then
        echo -e "${GREEN}✓ App is responding (HTTP $HTTP_CODE)${NC}"
    else
        echo -e "${YELLOW}App returned HTTP $HTTP_CODE${NC}"
        
        # Get logs
        echo "Fetching recent logs..."
        az webapp log tail --name "$APP_NAME" --resource-group finagent-rg --timeout 10 || true
    fi
    
    cd ../..
    return 0
}

# Main menu
echo "=== Deployment Testing Tool ==="
echo ""
echo "This tool helps test deployment packages locally before pushing to GitHub"
echo ""

# Run tests
test_frontend
echo ""
test_backend
echo ""

# Ask if user wants to deploy
echo -e "${YELLOW}Do you want to deploy directly to Azure? (y/n)${NC}"
read -r DEPLOY

if [[ "$DEPLOY" == "y" ]]; then
    echo "1) Frontend only"
    echo "2) Backend only"
    echo "3) Both"
    read -r CHOICE
    
    case $CHOICE in
        1)
            direct_deploy "frontend" "finagent-web-pps457j4wjrc6"
            ;;
        2)
            direct_deploy "backend" "finagent-backend-pps457j4wjrc6"
            ;;
        3)
            direct_deploy "frontend" "finagent-web-pps457j4wjrc6"
            direct_deploy "backend" "finagent-backend-pps457j4wjrc6"
            ;;
        *)
            echo "Skipping deployment"
            ;;
    esac
fi

echo ""
echo "=== Test Complete ==="
echo ""
echo "Next steps:"
echo "1. If tests passed, commit and push changes"
echo "2. If direct deployment worked, the same approach will work in GitHub Actions"
echo "3. If it failed, check the error messages above"