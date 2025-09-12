#!/bin/bash
# Azure-specific build script for Next.js

echo "=== Building Next.js for Azure App Service ==="

# Install dependencies
echo "Installing dependencies..."
if [ -f "pnpm-lock.yaml" ]; then
    echo "Using pnpm..."
    pnpm install --frozen-lockfile
elif [ -f "package-lock.json" ]; then
    echo "Using npm..."
    npm ci
else
    echo "Using npm install..."
    npm install
fi

# Set environment variables for build
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1

# Build the Next.js app
echo "Building Next.js app..."
if [ -f "pnpm-lock.yaml" ]; then
    pnpm build
else
    npm run build
fi

# Check if standalone build was created
if [ -d ".next/standalone" ]; then
    echo "Standalone build created successfully"
    
    # Copy static files (not included in standalone by default)
    if [ -d ".next/static" ]; then
        echo "Copying static files..."
        mkdir -p .next/standalone/.next
        cp -r .next/static .next/standalone/.next/
    fi
    
    # Copy public files if they exist
    if [ -d "public" ]; then
        echo "Copying public files..."
        cp -r public .next/standalone/
    fi
    
    echo "Build completed successfully!"
else
    echo "Warning: Standalone build not found, using regular build"
fi

# List build output
echo "Build output:"
ls -la .next/