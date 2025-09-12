#!/bin/bash
# Azure App Service startup script for Next.js (Linux)

echo "=== Starting Next.js server ==="
cd /home/site/wwwroot

# Debug: Show what files are present
echo "Files in /home/site/wwwroot:"
ls -la

# Set Node environment
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=2048"

# Check for node_modules
if [ ! -d "node_modules" ] && [ ! -L "node_modules" ]; then
    echo "WARNING: node_modules not found!"
    # Try to create symlink if /node_modules exists (Azure's extraction)
    if [ -d "/node_modules" ]; then
        echo "Creating symlink to /node_modules..."
        ln -sfn /node_modules ./node_modules
    else
        echo "Installing minimal dependencies..."
        npm install next@15.5.3 react@19.1.0 react-dom@19.1.0 --production --no-save
    fi
fi

# Port configuration
PORT=${PORT:-8080}
export PORT

echo "Node version: $(node --version)"
echo "Starting Next.js server on port $PORT..."

# Check if this is a standalone build
if [ -f "server.js" ]; then
    echo "Starting Next.js standalone server..."
    exec node server.js
elif [ -d ".next" ]; then
    echo "Starting Next.js production server..."
    exec npx next start -p $PORT
else
    echo "ERROR: No Next.js build found!"
    echo "Contents of current directory:"
    ls -la
    exit 1
fi