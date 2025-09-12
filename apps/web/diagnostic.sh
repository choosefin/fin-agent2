#!/bin/bash
# Diagnostic script for Azure Web App deployment

echo "=== Azure Web App Diagnostic Script ==="
echo "Date: $(date)"
echo ""

echo "=== Environment Info ==="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Current directory: $(pwd)"
echo "PORT: ${PORT:-not set}"
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo ""

echo "=== Directory Contents ==="
echo "Root directory:"
ls -la /home/site/wwwroot 2>/dev/null || ls -la .
echo ""

echo "=== Checking for Next.js build ==="
if [ -f "server.js" ]; then
    echo "✓ Found standalone server.js"
elif [ -d ".next/standalone" ]; then
    echo "✓ Found .next/standalone directory"
    ls -la .next/standalone/
elif [ -d ".next" ]; then
    echo "✓ Found .next directory (non-standalone)"
    echo "Contents:"
    ls -la .next/
else
    echo "✗ No Next.js build found!"
fi
echo ""

echo "=== Checking node_modules ==="
if [ -d "node_modules" ]; then
    echo "✓ node_modules exists"
    echo "Number of packages: $(ls node_modules | wc -l)"
elif [ -L "node_modules" ]; then
    echo "✓ node_modules is a symlink"
    ls -l node_modules
else
    echo "✗ node_modules not found"
fi
echo ""

echo "=== Checking critical dependencies ==="
for dep in next react react-dom @supabase/supabase-js; do
    if [ -d "node_modules/$dep" ]; then
        echo "✓ $dep found"
    else
        echo "✗ $dep missing"
    fi
done
echo ""

echo "=== Environment Variables ==="
env | grep -E "NEXT_PUBLIC|SUPABASE|API_URL" | sed 's/\(KEY=\).*/\1[REDACTED]/'
echo ""

echo "=== Package.json ==="
if [ -f "package.json" ]; then
    echo "Contents:"
    cat package.json
else
    echo "✗ package.json not found"
fi
echo ""

echo "=== Attempting to start server (dry run) ==="
if [ -f "server.js" ]; then
    echo "Would run: node server.js"
    node -c server.js 2>&1 && echo "✓ server.js syntax is valid" || echo "✗ server.js has syntax errors"
elif [ -d ".next" ]; then
    echo "Would run: npx next start"
    which next 2>&1 && echo "✓ next command available" || echo "✗ next command not found"
fi

echo ""
echo "=== End of Diagnostic ==="