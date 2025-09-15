#!/bin/bash

# Script to add Plaid secrets to GitHub repository
# Usage: ./setup-plaid-secrets.sh

echo "Setting up Plaid secrets for GitHub Actions..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed"
    echo "Install it with: brew install gh"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not in a git repository"
    exit 1
fi

# Get repository name
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Repository: $REPO"

# Read Plaid credentials from .env or .env.local
if [ -f "apps/backend/.env" ]; then
    source apps/backend/.env
elif [ -f "apps/backend/.env.local" ]; then
    source apps/backend/.env.local
else
    echo "Error: No .env file found in apps/backend/"
    echo "Please create one with your Plaid credentials first"
    exit 1
fi

# Verify credentials exist
if [ -z "$PLAID_CLIENT_ID" ] || [ -z "$PLAID_SECRET" ]; then
    echo "Error: PLAID_CLIENT_ID or PLAID_SECRET not found in .env file"
    exit 1
fi

echo "Found Plaid credentials:"
echo "  Client ID: ${PLAID_CLIENT_ID:0:10}..."
echo "  Secret: [HIDDEN]"
echo "  Environment: ${PLAID_ENV:-sandbox}"

# Prompt for confirmation
read -p "Do you want to add these to GitHub secrets? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
fi

# Add secrets to GitHub
echo "Adding PLAID_CLIENT_ID..."
gh secret set PLAID_CLIENT_ID --body "$PLAID_CLIENT_ID"

echo "Adding PLAID_SECRET..."
gh secret set PLAID_SECRET --body "$PLAID_SECRET"

echo "✅ Plaid secrets added to GitHub repository"
echo ""
echo "Note: For production Plaid access:"
echo "1. Create a production account at https://dashboard.plaid.com"
echo "2. Update PLAID_ENV in the GitHub workflow from 'sandbox' to 'production'"
echo "3. Update the secrets with your production credentials"