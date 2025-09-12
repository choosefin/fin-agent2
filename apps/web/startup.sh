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

# Port configuration - Azure uses process.env.PORT
PORT=${PORT:-8080}
HOSTNAME="0.0.0.0"
export PORT
export HOSTNAME

echo "Node version: $(node --version)"
echo "Starting Next.js server on $HOSTNAME:$PORT..."

# Check if this is a standalone build
if [ -f "server.js" ]; then
    echo "Starting Next.js standalone server..."
    # For standalone, we need to ensure the server binds to all interfaces
    exec node server.js
elif [ -d ".next/standalone" ]; then
    echo "Found standalone directory, using it..."
    if [ -f ".next/standalone/server.js" ]; then
        cd .next/standalone
        exec node server.js
    elif [ -f ".next/standalone/apps/web/server.js" ]; then
        cd .next/standalone/apps/web
        exec node server.js
    fi
elif [ -d ".next" ]; then
    echo "Starting Next.js production server (non-standalone)..."
    # Check for node_modules
    if [ ! -d "node_modules" ] && [ ! -L "node_modules" ]; then
        echo "WARNING: node_modules not found!"
        # Try to create symlink if /node_modules exists (Azure's extraction)
        if [ -d "/node_modules" ]; then
            echo "Creating symlink to /node_modules..."
            ln -sfn /node_modules ./node_modules
        else
            echo "Installing minimal dependencies..."
            npm install next@15.5.3 react@18.3.1 react-dom@18.3.1 @supabase/supabase-js@2.45.0 @supabase/auth-helpers-nextjs@0.10.0 --production --no-save
        fi
    fi
    exec npx next start -H $HOSTNAME -p $PORT
else
    echo "ERROR: No Next.js build found!"
    echo "Contents of current directory:"
    ls -la
    echo "Checking for .next directory:"
    ls -la .next 2>/dev/null || echo ".next not found"
    exit 1
fi