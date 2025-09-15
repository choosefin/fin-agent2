#!/bin/bash

# ============================================================================
# Remove Exposed Secrets from Repository
# ============================================================================
# This script helps remove exposed secrets from git history
# ============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "    Remove Exposed Secrets from Git      "
echo "=========================================="
echo ""

# Files containing exposed secrets
FILES_WITH_SECRETS=(
    "setup-github-secrets-azure.sh"
    "scripts/trigger-azure-deploy.sh"
    ".github/workflows/azure-deploy.yml"
)

echo -e "${YELLOW}[!] WARNING: This will rewrite git history!${NC}"
echo "Files to be cleaned:"
for file in "${FILES_WITH_SECRETS[@]}"; do
    echo "  - $file"
done
echo ""

read -p "Do you want to proceed? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Create backup
echo "Creating backup..."
git clone . ../finagent-backup-$(date +%Y%m%d_%H%M%S)

# Option 1: Using BFG Repo-Cleaner (recommended)
echo ""
echo "Option 1: Using BFG Repo-Cleaner (Recommended)"
echo "================================================"
echo "1. Download BFG: https://rtyley.github.io/bfg-repo-cleaner/"
echo "2. Run these commands:"
echo ""
echo "   # Remove specific files"
echo "   java -jar bfg.jar --delete-files setup-github-secrets-azure.sh"
echo ""
echo "   # Remove secrets from all files"
echo "   java -jar bfg.jar --replace-text secrets.txt"
echo ""
echo "   # Clean up"
echo "   git reflog expire --expire=now --all && git gc --prune=now --aggressive"
echo ""

# Option 2: Using git filter-branch
echo "Option 2: Using git filter-branch"
echo "=================================="
echo "Run these commands:"
echo ""
for file in "${FILES_WITH_SECRETS[@]}"; do
    echo "git filter-branch --force --index-filter \\"
    echo "  'git rm --cached --ignore-unmatch $file' \\"
    echo "  --prune-empty --tag-name-filter cat -- --all"
    echo ""
done

# Create secrets.txt for BFG
cat > secrets.txt << 'EOF'
# Add your exposed secrets here (one per line) for BFG to replace
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
d05d9a76a3624eebafacd8db6c78e370
68bf57325c4cee0025d8c1ae
e888e74d34801eb3dc29e5c6e74eb5
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnBmc2ZobG54dG9lc2FmcHd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjkzODgxNCwiZXhwIjoyMDcyNTE0ODE0fQ.IZlSfOtNjFkAeyBe3rQa8LulakVviYyurZ5F2vcXfHw
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1YW9ndmdtZGduZGxkaW1ubnJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM4NTU4OTAsImV4cCI6MjA0OTQzMTg5MH0.vFq6l6zVbG3M7MJBCymVcjJXNPiCrBvPBfqDOvLxvxo
EOF

echo -e "${GREEN}[✓]${NC} Created secrets.txt for BFG"
echo ""
echo "After cleaning history:"
echo "========================"
echo "1. Force push to all branches:"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "2. Have all team members re-clone the repository"
echo ""
echo "3. Delete and recreate any existing PRs"
echo ""
echo -e "${RED}[!] CRITICAL: Rotate all exposed secrets immediately!${NC}"
echo "   Run: ./scripts/rotate-secrets.sh"
echo ""