#!/bin/bash
# Azure App Service deployment script for Next.js (Linux)

echo "=== Starting Next.js deployment ==="

# Exit on any error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Deployment directory (Azure default)
DEPLOYMENT_TARGET=${DEPLOYMENT_TARGET:-/home/site/wwwroot}

echo -e "${YELLOW}Deployment target: $DEPLOYMENT_TARGET${NC}"

# Navigate to deployment directory
cd "$DEPLOYMENT_TARGET"

# Check Node.js version
echo -e "${YELLOW}Node.js version:${NC}"
node --version

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
if [ -f "pnpm-lock.yaml" ]; then
    echo "Using pnpm..."
    npm install -g pnpm
    pnpm install --frozen-lockfile --prod
elif [ -f "package-lock.json" ]; then
    echo "Using npm..."
    npm ci --production
elif [ -f "yarn.lock" ]; then
    echo "Using yarn..."
    npm install -g yarn
    yarn install --frozen-lockfile --production
else
    echo "Using npm (no lock file found)..."
    npm install --production
fi

# Build the Next.js application
echo -e "${YELLOW}Building Next.js application...${NC}"
npm run build

# Verify build output
if [ ! -d ".next" ]; then
    echo -e "${RED}Error: Build failed - .next directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}=== Deployment completed successfully ===${NC}"
echo "Application will start on port ${PORT:-8080}"

# Note: The actual app start is handled by Azure's startup command or startup.sh