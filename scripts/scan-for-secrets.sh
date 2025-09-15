#!/bin/bash

# ============================================================================
# Scan for Exposed Secrets in Repository
# ============================================================================
# This script scans the repository for potentially exposed secrets
# ============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "    Scanning for Exposed Secrets         "
echo "=========================================="
echo ""

FOUND_ISSUES=0
TEMP_FILE=$(mktemp)

# Patterns to search for
declare -A PATTERNS=(
    ["AWS"]="AKIA[0-9A-Z]{16}"
    ["GitHub Token"]="gh[ps]_[a-zA-Z0-9]{36}"
    ["Generic API Key"]="api[_-]?key[_-]?['\"]?[:]?['\"]?[a-zA-Z0-9]{32,}"
    ["Generic Secret"]="secret[_-]?['\"]?[:]?['\"]?[a-zA-Z0-9]{32,}"
    ["Private Key"]="-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----"
    ["Slack Token"]="xox[baprs]-[0-9]{10,}-[a-zA-Z0-9]{24,}"
    ["Stripe Key"]="sk_live_[0-9a-zA-Z]{24,}"
    ["Square Token"]="sq0[a-z]{3}-[0-9A-Za-z\-_]{22,43}"
    ["Twilio Key"]="SK[0-9a-fA-F]{32}"
)

# Known exposed secrets to specifically check for
KNOWN_EXPOSED=(
    "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"
    "d05d9a76a3624eebafacd8db6c78e370"
    "68bf57325c4cee0025d8c1ae"
    "e888e74d34801eb3dc29e5c6e74eb5"
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnBmc2ZobG54dG9lc2FmcHd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjkzODgxNCwiZXhwIjoyMDcyNTE0ODE0fQ"
)

echo -e "${BLUE}[i]${NC} Scanning for known exposed secrets..."

# Check for known exposed secrets
for secret in "${KNOWN_EXPOSED[@]}"; do
    if grep -r "${secret:0:20}" . --exclude-dir=.git --exclude-dir=node_modules --exclude="*.md" --exclude="scan-for-secrets.sh" 2>/dev/null | head -1 >> "$TEMP_FILE"; then
        echo -e "${RED}[!] CRITICAL: Known exposed secret found!${NC}"
        echo "    Pattern: ${secret:0:20}..."
        FOUND_ISSUES=$((FOUND_ISSUES + 1))
    fi
done

echo -e "${BLUE}[i]${NC} Scanning for secret patterns..."

# Check for generic patterns
for pattern_name in "${!PATTERNS[@]}"; do
    pattern="${PATTERNS[$pattern_name]}"
    if grep -rE "$pattern" . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.next --exclude="*.md" 2>/dev/null | head -3 >> "$TEMP_FILE"; then
        echo -e "${YELLOW}[!] Warning: Potential $pattern_name found${NC}"
        FOUND_ISSUES=$((FOUND_ISSUES + 1))
    fi
done

echo -e "${BLUE}[i]${NC} Checking for hardcoded credentials..."

# Check for hardcoded credentials in source files
SUSPICIOUS_PATTERNS=(
    "password.*=.*['\"][^'\"]{8,}['\"]"
    "api_key.*=.*['\"][^'\"]{20,}['\"]"
    "secret.*=.*['\"][^'\"]{20,}['\"]"
    "token.*=.*['\"][^'\"]{20,}['\"]"
    "Bearer [a-zA-Z0-9._-]{20,}"
)

for pattern in "${SUSPICIOUS_PATTERNS[@]}"; do
    if grep -rE "$pattern" . --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" --include="*.py" --include="*.rb" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | grep -v "example\|sample\|test\|mock" | head -3 >> "$TEMP_FILE"; then
        echo -e "${YELLOW}[!] Warning: Suspicious pattern found${NC}"
        FOUND_ISSUES=$((FOUND_ISSUES + 1))
    fi
done

echo -e "${BLUE}[i]${NC} Checking .env files..."

# Check for .env files that shouldn't be committed
ENV_FILES=$(find . -name ".env" -o -name ".env.*" | grep -v ".env.example" | grep -v node_modules | grep -v .git || true)
if [ -n "$ENV_FILES" ]; then
    echo -e "${RED}[!] Found .env files that should not be committed:${NC}"
    echo "$ENV_FILES"
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
fi

echo -e "${BLUE}[i]${NC} Checking configuration files..."

# Check for secrets in configuration files
CONFIG_FILES=(
    "docker-compose.yml"
    "docker-compose.yaml"
    ".github/workflows/*.yml"
    ".github/workflows/*.yaml"
    "*.json"
)

for config_pattern in "${CONFIG_FILES[@]}"; do
    files=$(find . -path "./node_modules" -prune -o -path "./.git" -prune -o -name "$config_pattern" -type f -print 2>/dev/null)
    for file in $files; do
        if grep -E "(api[_-]?key|secret|password|token).*[:=].*[a-zA-Z0-9]{20,}" "$file" 2>/dev/null | grep -v "example\|placeholder\|\${\|<<\|null\|undefined" >> "$TEMP_FILE"; then
            echo -e "${YELLOW}[!] Potential secret in config file: $file${NC}"
            FOUND_ISSUES=$((FOUND_ISSUES + 1))
        fi
    done
done

echo ""
echo "=========================================="

if [ $FOUND_ISSUES -eq 0 ]; then
    echo -e "${GREEN}[✓] No obvious exposed secrets found!${NC}"
    echo ""
    echo "Note: This is a basic scan. For comprehensive scanning:"
    echo "  1. Use GitHub secret scanning"
    echo "  2. Use tools like TruffleHog or GitLeaks"
    echo "  3. Regular manual security audits"
else
    echo -e "${RED}[✗] Found $FOUND_ISSUES potential security issues!${NC}"
    echo ""
    echo "Immediate actions required:"
    echo "  1. Review the findings above"
    echo "  2. Run: ./scripts/rotate-secrets.sh"
    echo "  3. Run: ./scripts/remove-exposed-secrets.sh"
    echo "  4. Enable GitHub secret scanning"
    echo ""
    echo "Detailed findings saved to: $TEMP_FILE"
fi

echo "=========================================="

# Cleanup
if [ $FOUND_ISSUES -eq 0 ]; then
    rm -f "$TEMP_FILE"
fi