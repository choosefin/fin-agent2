#!/bin/bash
# Azure App Service Startup Script for Motia
# This script handles the specific requirements of running Motia in Azure App Service

echo "=========================================="
echo "MOTIA AZURE APP SERVICE STARTUP"
echo "=========================================="
echo "Timestamp: $(date)"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Python version: $(python3 --version 2>&1 || echo 'Python not found')"

# Azure App Service Environment
echo ""
echo "[ENVIRONMENT] Azure App Service Configuration:"
echo "PORT: ${PORT:-8080}"
echo "WEBSITES_PORT: ${WEBSITES_PORT:-8080}"
echo "NODE_ENV: ${NODE_ENV:-production}"
echo "HOME: ${HOME}"
echo "WEBSITE_INSTANCE_ID: ${WEBSITE_INSTANCE_ID}"
echo "WEBSITE_SITE_NAME: ${WEBSITE_SITE_NAME}"

# Check if running in Azure App Service
if [ ! -z "$WEBSITE_INSTANCE_ID" ]; then
    echo "[AZURE] Running in Azure App Service environment"
    
    # Set production environment
    export NODE_ENV=production
    
    # Use Azure's port or default to 8080
    export PORT=${WEBSITES_PORT:-${PORT:-8080}}
    
    # Set Motia specific environment variables for Azure
    export MOTIA_HOST="0.0.0.0"
    export MOTIA_PORT=$PORT
    export MOTIA_LOG_LEVEL="info"
    
    # Ensure proper file permissions
    if [ -w "/home/site/wwwroot" ]; then
        echo "[PERMISSIONS] Setting file permissions..."
        chmod -R 755 /home/site/wwwroot/steps 2>/dev/null || true
        chmod -R 755 /home/site/wwwroot/dist 2>/dev/null || true
    fi
else
    echo "[LOCAL] Running in local/container environment"
    export PORT=${PORT:-3001}
fi

# Check for required files
echo ""
echo "[VALIDATION] Checking required files:"
[ -f "package.json" ] && echo "✓ package.json found" || echo "✗ package.json missing!"
[ -f "motia-workbench.json" ] && echo "✓ motia-workbench.json found" || echo "✗ motia-workbench.json missing!"
[ -d "steps" ] && echo "✓ steps directory found" || echo "✗ steps directory missing!"
[ -d "node_modules" ] && echo "✓ node_modules found" || echo "✗ node_modules missing!"

# Check if Motia is installed
echo ""
echo "[MOTIA] Checking Motia installation:"
if command -v motia &> /dev/null; then
    echo "✓ Motia CLI found: $(which motia)"
    motia --version 2>&1 | head -1
else
    echo "✗ Motia CLI not found in PATH, trying npx..."
    npx motia --version 2>&1 | head -1
fi

# Python environment check (for multi-language support)
echo ""
echo "[PYTHON] Checking Python environment:"
if [ -d "python_modules" ]; then
    echo "✓ Python modules directory found"
    if [ -f "python_modules/bin/activate" ]; then
        echo "✓ Python virtual environment found"
        source python_modules/bin/activate
        echo "✓ Python virtual environment activated"
    fi
else
    echo "ℹ No Python modules directory (TypeScript-only mode)"
fi

# Build check
echo ""
echo "[BUILD] Checking build status:"
if [ -d "dist" ]; then
    echo "✓ Build directory exists"
    file_count=$(find dist -type f -name "*.js" 2>/dev/null | wc -l)
    echo "  Found $file_count JavaScript files"
else
    echo "⚠ Build directory missing, running build..."
    npm run build || npx motia build
fi

# Network configuration for Azure
echo ""
echo "[NETWORK] Configuring network settings:"
echo "Binding to 0.0.0.0:$PORT for Azure App Service"

# Health check endpoint test
echo ""
echo "[HEALTH] Setting up health check monitoring..."
(sleep 30 && curl -s http://localhost:$PORT/health > /dev/null 2>&1 && echo "[HEALTH] ✓ Health check passed" || echo "[HEALTH] ⚠ Health check failed") &

# Start Motia server
echo ""
echo "=========================================="
echo "STARTING MOTIA SERVER"
echo "=========================================="
echo "Command: motia start --port $PORT --host 0.0.0.0"
echo ""

# Use exec to replace shell process with Motia
# This ensures proper signal handling in Azure App Service
if command -v motia &> /dev/null; then
    exec motia start --port $PORT --host 0.0.0.0
else
    exec npx motia start --port $PORT --host 0.0.0.0
fi