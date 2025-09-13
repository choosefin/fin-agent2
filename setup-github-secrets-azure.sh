#!/bin/bash
# Script to set up GitHub secrets for Azure deployment

echo "Setting up GitHub secrets for Azure deployment..."
echo "Make sure you have the GitHub CLI installed and authenticated."
echo ""

# Repository name
REPO="sst/finagent2"  # Update this with your actual GitHub repo

echo "Setting secrets for repository: $REPO"
echo ""

# Backend secrets
echo "Setting backend secrets..."
gh secret set GROQ_API_KEY --repo $REPO --body "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"
gh secret set AZURE_OPENAI_API_KEY --repo $REPO --body "d05d9a76a3624eebafacd8db6c78e370"
gh secret set AZURE_OPENAI_ENDPOINT --repo $REPO --body "https://ai-hubjan31758181607127.openai.azure.com/"
gh secret set PLAID_CLIENT_ID --repo $REPO --body "68bf57325c4cee0025d8c1ae"
gh secret set PLAID_SECRET --repo $REPO --body "e888e74d34801eb3dc29e5c6e74eb5"
gh secret set SUPABASE_SERVICE_KEY --repo $REPO --body "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnBmc2ZobG54dG9lc2FmcHd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjkzODgxNCwiZXhwIjoyMDcyNTE0ODE0fQ.IZlSfOtNjFkAeyBe3rQa8LulakVviYyurZ5F2vcXfHw"

# Frontend secrets (already in the workflow as defaults, but setting them here for consistency)
echo "Setting frontend secrets..."
gh secret set NEXT_PUBLIC_SUPABASE_URL --repo $REPO --body "https://fuaogvgmdgndldimnnrs.supabase.co"
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --repo $REPO --body "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1YW9ndmdtZGduZGxkaW1ubnJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM4NTU4OTAsImV4cCI6MjA0OTQzMTg5MH0.vFq6l6zVbG3M7MJBCymVcjJXNPiCrBvPBfqDOvLxvxo"

echo ""
echo "Secrets have been set! Now you need to:"
echo "1. Push the updated workflow file to trigger a new deployment"
echo "2. Monitor the deployment in GitHub Actions"
echo "3. Test the deployed endpoints once complete"
echo ""
echo "Backend URL: https://finagent-backend-pps457j4wjrc6.azurewebsites.net"
echo "Frontend URL: https://finagent-web-pps457j4wjrc6.azurewebsites.net"