#!/bin/bash
# Azure App Service startup script for Next.js

echo "Starting Next.js application..."

# Navigate to app directory
cd /home/site/wwwroot

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --production
fi

# Check if .next directory exists (built app)
if [ ! -d ".next" ]; then
    echo "Building Next.js application..."
    npm run build
fi

# Start the application
echo "Starting application on port 8080..."
PORT=8080 npm start