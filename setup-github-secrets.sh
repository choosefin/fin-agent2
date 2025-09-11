#!/bin/bash

# GitHub Secrets Setup Script
# This script helps you add the required secrets to your GitHub repository

echo "================================================"
echo "GitHub Actions Secrets Setup"
echo "================================================"
echo ""
echo "This script will help you set up the required GitHub secrets."
echo "Make sure you have the GitHub CLI installed and authenticated."
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Install it with: brew install gh"
    echo "Then authenticate with: gh auth login"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Not in a git repository. Please run this from your project root."
    exit 1
fi

echo "✅ GitHub CLI is installed"
echo ""

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)
if [ -z "$REPO" ]; then
    echo "❌ Could not determine GitHub repository."
    echo "Make sure you're in the right directory and have a GitHub remote configured."
    exit 1
fi

echo "📦 Repository: $REPO"
echo ""

# Function to add secret
add_secret() {
    local name=$1
    local value=$2
    echo -n "Adding $name... "
    echo "$value" | gh secret set "$name" -R "$REPO" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅"
    else
        echo "❌ Failed"
    fi
}

# Check for required files
echo "Checking for required files..."
echo ""

if [ -f "backend-publish-profile.xml" ]; then
    echo "✅ Found backend-publish-profile.xml"
    BACKEND_PROFILE=$(cat backend-publish-profile.xml)
else
    echo "❌ backend-publish-profile.xml not found"
    echo "Run: az webapp deployment list-publishing-profiles --name finagent-backend-pps457j4wjrc6 --resource-group finagent-rg --xml > backend-publish-profile.xml"
    exit 1
fi

if [ -f "frontend-publish-profile.xml" ]; then
    echo "✅ Found frontend-publish-profile.xml"
    FRONTEND_PROFILE=$(cat frontend-publish-profile.xml)
else
    echo "❌ frontend-publish-profile.xml not found"
    echo "Run: az webapp deployment list-publishing-profiles --name finagent-web-pps457j4wjrc6 --resource-group finagent-rg --xml > frontend-publish-profile.xml"
    exit 1
fi

echo ""
echo "Adding GitHub Secrets..."
echo ""

# Add publish profiles
add_secret "AZURE_WEBAPP_PUBLISH_PROFILE_BACKEND" "$BACKEND_PROFILE"
add_secret "AZURE_WEBAPP_PUBLISH_PROFILE_FRONTEND" "$FRONTEND_PROFILE"

# Add Azure resource group
add_secret "AZURE_RESOURCE_GROUP" "finagent-rg"

# Add Azure credentials (should be in a separate secure file)
if [ -f "azure-credentials.json" ]; then
    echo "✅ Found azure-credentials.json"
    AZURE_CREDS=$(cat azure-credentials.json)
    add_secret "AZURE_CREDENTIALS" "$AZURE_CREDS"
else
    echo "⚠️  azure-credentials.json not found"
    echo "   Create it with: az ad sp create-for-rbac --name github-actions --role contributor --scopes /subscriptions/YOUR_SUB_ID/resourceGroups/finagent-rg --sdk-auth > azure-credentials.json"
    echo "   Then run this script again."
fi

# Check for .env.production file
if [ -f ".env.production" ]; then
    echo ""
    echo "Found .env.production file. Adding Supabase secrets..."
    
    # Extract Supabase values
    SUPABASE_URL=$(grep "^SUPABASE_URL=" .env.production | cut -d '=' -f2-)
    SUPABASE_ANON_KEY=$(grep "^SUPABASE_ANON_KEY=" .env.production | cut -d '=' -f2-)
    SUPABASE_SERVICE_KEY=$(grep "^SUPABASE_SERVICE_KEY=" .env.production | cut -d '=' -f2-)
    
    if [ -n "$SUPABASE_URL" ]; then
        add_secret "SUPABASE_URL" "$SUPABASE_URL"
    fi
    
    if [ -n "$SUPABASE_ANON_KEY" ]; then
        add_secret "SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY"
    fi
    
    if [ -n "$SUPABASE_SERVICE_KEY" ]; then
        add_secret "SUPABASE_SERVICE_KEY" "$SUPABASE_SERVICE_KEY"
    fi
    
    echo ""
    echo "Adding optional API keys if present..."
    
    # Optional keys
    for key in PLAID_CLIENT_ID PLAID_SECRET POLYGON_API_KEY ALPACA_API_KEY ALPACA_SECRET_KEY OPENAI_API_KEY ANTHROPIC_API_KEY GROQ_API_KEY MEM0_API_KEY; do
        value=$(grep "^$key=" .env.production | cut -d '=' -f2-)
        if [ -n "$value" ] && [ "$value" != "placeholder" ]; then
            add_secret "$key" "$value"
        fi
    done
else
    echo ""
    echo "⚠️  .env.production not found. You'll need to manually add these secrets:"
    echo "   - SUPABASE_URL"
    echo "   - SUPABASE_ANON_KEY"
    echo "   - SUPABASE_SERVICE_KEY"
fi

echo ""
echo "================================================"
echo "Setup Complete!"
echo "================================================"
echo ""
echo "✅ GitHub secrets have been configured."
echo ""
echo "Next steps:"
echo "1. Commit and push your changes to GitHub"
echo "2. The GitHub Action will automatically trigger on push to main/master"
echo "3. Monitor the deployment at: https://github.com/$REPO/actions"
echo ""
echo "To manually trigger a deployment:"
echo "   gh workflow run 'Deploy to Azure App Service' -R $REPO"
echo ""
echo "Application URLs:"
echo "   Backend: https://finagent-backend-pps457j4wjrc6.azurewebsites.net"
echo "   Frontend: https://finagent-web-pps457j4wjrc6.azurewebsites.net"