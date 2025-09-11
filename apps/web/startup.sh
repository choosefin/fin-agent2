#!/bin/bash
# Azure App Service startup script for Next.js

echo "Starting Next.js application..."

# Navigate to app directory
cd /home/site/wwwroot

# Ensure node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Error: node_modules not found. Running npm install..."
    npm install --production --no-optional
fi

# Ensure .next directory exists (built app)
if [ ! -d ".next" ]; then
    echo "Error: .next directory not found. Application not built properly."
    exit 1
fi

# Start the application
echo "Starting Next.js on port ${PORT:-8080}..."
PORT=${PORT:-8080} node node_modules/.bin/next start