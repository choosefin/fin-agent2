#!/bin/bash
echo "=== Next.js Debug Startup Script ==="
echo "Date: $(date)"
echo "Port: ${PORT:-8080}"
echo ""

echo "=== Current Directory ==="
pwd
echo ""

echo "=== Root Directory Contents ==="
ls -la
echo ""

echo "=== Checking for Next.js build ==="
if [ -f "server.js" ]; then
    echo "✓ Found standalone server.js"
    echo "File size: $(stat -c%s server.js) bytes"
    echo "First 100 chars of server.js:"
    head -c 100 server.js
    echo ""
elif [ -d ".next" ]; then
    echo "✓ Found .next directory"
    echo "Contents of .next:"
    ls -la .next/
    if [ -d ".next/standalone" ]; then
        echo "Contents of .next/standalone:"
        ls -la .next/standalone/
    fi
else
    echo "✗ No Next.js build found!"
fi
echo ""

echo "=== Checking node_modules ==="
if [ -d "node_modules" ]; then
    echo "✓ node_modules exists as directory"
    echo "Number of packages: $(ls node_modules | wc -l)"
    # Check for critical packages
    for pkg in next react react-dom; do
        if [ -d "node_modules/$pkg" ]; then
            echo "  ✓ $pkg found"
        else
            echo "  ✗ $pkg missing"
        fi
    done
elif [ -L "node_modules" ]; then
    echo "✓ node_modules is a symlink"
    ls -l node_modules
    target=$(readlink -f node_modules)
    echo "Symlink target: $target"
    if [ -d "$target" ]; then
        echo "Target exists with $(ls $target | wc -l) packages"
    else
        echo "✗ Symlink target does not exist!"
    fi
else
    echo "✗ node_modules not found"
    echo "Checking /node_modules..."
    if [ -d "/node_modules" ]; then
        echo "Found /node_modules with $(ls /node_modules | wc -l) packages"
        echo "Creating symlink..."
        ln -sfn /node_modules ./node_modules
    fi
fi
echo ""

echo "=== Package.json ==="
if [ -f "package.json" ]; then
    cat package.json
else
    echo "✗ package.json not found"
fi
echo ""

echo "=== Environment Variables (redacted) ==="
env | grep -E "NEXT_|NODE_|PORT|WEBSITE_" | sed 's/\(KEY=\).*/\1[REDACTED]/' | sort
echo ""

echo "=== Attempting to start server ==="
cd /home/site/wwwroot

# Check for node_modules
if [ ! -d "node_modules" ] && [ ! -L "node_modules" ]; then
    echo "Creating symlink to /node_modules..."
    if [ -d "/node_modules" ]; then
        ln -sfn /node_modules ./node_modules
    else
        echo "Installing minimal dependencies..."
        npm install next@15.5.3 react@19.1.0 react-dom@19.1.0 --production --no-save
    fi
fi

# Try to start the server
if [ -f "server.js" ]; then
    echo "Starting Next.js standalone server..."
    echo "Command: PORT=${PORT:-8080} node server.js"
    PORT=${PORT:-8080} node server.js
elif [ -d ".next" ]; then
    echo "Starting Next.js with next start..."
    echo "Command: PORT=${PORT:-8080} npx next start"
    PORT=${PORT:-8080} npx next start
else
    echo "ERROR: No Next.js build found!"
    echo "Directory contents:"
    ls -la
    exit 1
fi