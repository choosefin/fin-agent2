#!/bin/bash

# Build validation script for CI/CD
set -e

echo "🔍 Starting build validation..."

# Function to run build and capture errors
validate_app() {
    local app_name=$1
    local app_path=$2
    
    echo "📦 Validating $app_name..."
    cd "$app_path"
    
    # Run type checking
    if npm run typecheck 2>&1 | tee typecheck.log; then
        echo "✅ Type checking passed for $app_name"
    else
        echo "❌ Type checking failed for $app_name"
        cat typecheck.log
        return 1
    fi
    
    # Run linting
    if npm run lint 2>&1 | tee lint.log; then
        echo "✅ Linting passed for $app_name"
    else
        echo "❌ Linting failed for $app_name"
        cat lint.log
        return 1
    fi
    
    # Run build
    if npm run build 2>&1 | tee build.log; then
        echo "✅ Build passed for $app_name"
    else
        echo "❌ Build failed for $app_name"
        cat build.log
        return 1
    fi
    
    cd -
}

# Validate web app
validate_app "Web App" "apps/web"

# Validate backend app
validate_app "Backend" "apps/backend"

echo "✅ All validations passed!"