#!/bin/bash
# Local deployment testing script

set -e

echo "=== Testing Local Deployment Package ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a process is running
check_server() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Test Frontend
echo -e "${YELLOW}Testing Frontend Deployment...${NC}"
cd apps/web

# Clean previous test
rm -rf deploy-package
mkdir -p deploy-package

# Build the app first
echo "Building Next.js app..."
pnpm build || npm run build

# Create deployment package as per GitHub Actions
if [ -d ".next/standalone/apps/web" ]; then
    echo -e "${GREEN}✓ Found monorepo standalone build${NC}"
    cp -r .next/standalone/apps/web/* deploy-package/
    cp -r .next/standalone/apps/web/.next deploy-package/ 2>/dev/null || true
    cp -r .next/standalone/node_modules deploy-package/ 2>/dev/null || true
elif [ -d ".next/standalone" ]; then
    echo -e "${GREEN}✓ Found standalone build${NC}"
    cp -r .next/standalone/* deploy-package/
else
    echo -e "${RED}✗ No standalone build found${NC}"
    exit 1
fi

# Copy static files
cp -r .next/static deploy-package/.next/ 2>/dev/null || true
cp -r public deploy-package/ 2>/dev/null || true

# Add deployment config
cat > deploy-package/.deployment << 'EOF'
[config]
SCM_DO_BUILD_DURING_DEPLOYMENT = false
EOF

# Add startup script
cat > deploy-package/startup.sh << 'EOF'
#!/bin/bash
set -e
cd /home/site/wwwroot
if [ -f "server.js" ]; then
    PORT=${PORT:-8080} node server.js
else
    PORT=${PORT:-8080} npx next start
fi
EOF
chmod +x deploy-package/startup.sh

# Test the server
echo ""
echo -e "${YELLOW}Starting test server on port 3003...${NC}"
cd deploy-package

# Start server in background
PORT=3003 node server.js &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Test if server is running
if check_server 3003; then
    echo -e "${GREEN}✓ Server started successfully${NC}"
    
    # Test homepage
    if curl -s http://localhost:3003 | grep -q "<!DOCTYPE html>"; then
        echo -e "${GREEN}✓ Homepage loads successfully${NC}"
    else
        echo -e "${RED}✗ Homepage failed to load${NC}"
    fi
else
    echo -e "${RED}✗ Server failed to start${NC}"
fi

# Kill test server
kill $SERVER_PID 2>/dev/null || true

# Check package size
PACKAGE_SIZE=$(du -sh . | cut -f1)
echo ""
echo -e "${YELLOW}Deployment package size: ${PACKAGE_SIZE}${NC}"

# List contents
echo ""
echo "Package contents:"
ls -la

echo ""
echo -e "${GREEN}=== Frontend deployment package ready ===${NC}"
echo ""

# Test Backend
cd ../../
echo -e "${YELLOW}Testing Backend Deployment...${NC}"
cd apps/backend

# Create test package
rm -rf deploy-package
mkdir -p deploy-package

# Copy necessary files
cp -r . deploy-package/ 2>/dev/null || true
cd deploy-package

# Remove unnecessary files
rm -rf node_modules test-deploy .git

# Add deployment config
cat > .deployment << 'EOF'
[config]
SCM_DO_BUILD_DURING_DEPLOYMENT = false
EOF

# Test if we can start (we won't actually start due to dependencies)
if [ -f "package.json" ]; then
    echo -e "${GREEN}✓ Backend package.json found${NC}"
    
    # Check for Motia
    if grep -q "motia" package.json; then
        echo -e "${GREEN}✓ Motia dependency found${NC}"
    else
        echo -e "${RED}✗ Motia dependency missing${NC}"
    fi
else
    echo -e "${RED}✗ Backend package.json missing${NC}"
fi

echo ""
echo -e "${GREEN}=== Deployment packages tested ===${NC}"
echo ""
echo "Next steps:"
echo "1. Commit your changes"
echo "2. Push to trigger GitHub Actions"
echo "3. Monitor deployment at: https://github.com/brianyang/fin-agent2/actions"