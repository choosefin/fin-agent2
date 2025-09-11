#!/bin/bash
# Azure App Service startup script for Next.js (Linux)

set -e

echo "=== Starting Next.js production server ==="

# Navigate to app directory
cd /home/site/wwwroot

# Install minimal production dependencies if missing
if [ ! -f "node_modules/next/package.json" ]; then
    echo "Installing production dependencies..."
    npm install next@15.5.3 react@19.1.0 react-dom@19.1.0 --production --no-save
fi

# Ensure the build exists
if [ ! -d ".next" ]; then
    echo "ERROR: .next directory not found."
    echo "Contents of /home/site/wwwroot:"
    ls -la
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

# Start Next.js using npx to handle missing binaries
exec npx next start -p $PORT