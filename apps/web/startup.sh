#!/bin/bash
# Azure App Service startup script for Next.js (Linux)

set -e

echo "=== Starting Next.js application ==="

# Navigate to app directory
cd /home/site/wwwroot

# Ensure the build exists
if [ ! -d ".next" ]; then
    echo "Error: .next directory not found. Application not built properly."
    echo "Please check the deployment logs."
    exit 1
fi

# Set Node options for production
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=2048"

# Use PORT from environment or default to 8080
PORT=${PORT:-8080}
export PORT

echo "Starting Next.js server on port $PORT..."
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# Start Next.js using the direct command
exec node node_modules/.bin/next start -p $PORT