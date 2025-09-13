#!/bin/bash

# Script to check and fix Supabase configuration mismatch
set -e

echo "======================================"
echo "Supabase Configuration Checker"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check current configuration
echo -e "${YELLOW}Checking current configuration...${NC}"
echo ""

# Check setup script
echo "1. In setup-github-secrets-azure.sh:"
if [ -f "setup-github-secrets-azure.sh" ]; then
    echo "   Service Key project ref:"
    grep "SUPABASE_SERVICE_KEY" setup-github-secrets-azure.sh | grep -o 'ref":"[^"]*' | cut -d'"' -f3 || echo "Not found"
    
    echo "   URL project:"
    grep "NEXT_PUBLIC_SUPABASE_URL" setup-github-secrets-azure.sh | grep -o 'https://[^.]*' | cut -d'/' -f3 || echo "Not found"
    
    echo "   Anon Key project ref:"
    grep "NEXT_PUBLIC_SUPABASE_ANON_KEY" setup-github-secrets-azure.sh | grep -o 'ref":"[^"]*' | cut -d'"' -f3 || echo "Not found"
fi

echo ""
echo "2. In workflow defaults (azure-deploy.yml):"
if [ -f ".github/workflows/azure-deploy.yml" ]; then
    echo "   Default URL project:"
    grep "NEXT_PUBLIC_SUPABASE_URL.*||" .github/workflows/azure-deploy.yml | head -1 | grep -o 'https://[^.]*' | cut -d'/' -f3 || echo "Not found"
    
    echo "   Default Anon Key project ref:"
    grep "NEXT_PUBLIC_SUPABASE_ANON_KEY.*||" .github/workflows/azure-deploy.yml | head -1 | grep -o 'ref":"[^"]*' | cut -d'"' -f3 || echo "Not found"
fi

echo ""
echo "3. In supabase.ts:"
if [ -f "apps/web/src/lib/supabase.ts" ]; then
    echo "   Hardcoded URL project:"
    grep "supabaseUrl.*=" apps/web/src/lib/supabase.ts | grep -o 'https://[^.]*' | cut -d'/' -f3 || echo "Not found"
    
    echo "   Hardcoded Anon Key project ref:"
    grep "supabaseAnonKey.*=" apps/web/src/lib/supabase.ts | grep -o 'ref":"[^"]*' | cut -d'"' -f3 || echo "Not found"
fi

echo ""
echo -e "${RED}======================================"
echo "⚠️  ISSUE DETECTED!"
echo "======================================${NC}"
echo ""
echo "There's a mismatch between Supabase projects:"
echo ""
echo -e "${YELLOW}Project 1: sjvpfsfhlnxtoesafpwt${NC}"
echo "  - Used for: SERVICE_KEY"
echo ""
echo -e "${YELLOW}Project 2: fuaogvgmdgndldimnnrs${NC}"
echo "  - Used for: URL and ANON_KEY"
echo ""
echo -e "${RED}This mismatch is causing the 'Invalid API key' error!${NC}"
echo ""
echo "======================================"
echo "HOW TO FIX:"
echo "======================================"
echo ""
echo "You need to use keys from the SAME Supabase project."
echo ""
echo "Option 1: Use the correct Supabase project (recommended)"
echo "  1. Go to your Supabase dashboard"
echo "  2. Find which project you actually want to use"
echo "  3. Get ALL keys from that ONE project:"
echo "     - Project URL"
echo "     - Anon/Public key"
echo "     - Service key (if needed for backend)"
echo ""
echo "Option 2: Quick fix using GitHub Secrets (if you know the right values)"
echo "  Run these commands with YOUR correct values:"
echo ""
echo "  # Replace with your actual Supabase project values"
echo "  gh secret set NEXT_PUBLIC_SUPABASE_URL --body \"https://YOUR_PROJECT.supabase.co\""
echo "  gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --body \"YOUR_ANON_KEY\""
echo "  gh secret set SUPABASE_SERVICE_KEY --body \"YOUR_SERVICE_KEY\""
echo ""
echo "Option 3: Set directly in Azure Portal"
echo "  1. Go to Azure Portal → Your Web App → Configuration"
echo "  2. Update these Application Settings:"
echo "     - NEXT_PUBLIC_SUPABASE_URL"
echo "     - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo ""
echo "After fixing, redeploy your application."