#!/bin/bash

# ============================================================================
# Secret Rotation Script for Finagent Application
# ============================================================================
# This script helps rotate all secrets used in the application
# Requires authentication to various services before running
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_NAME="${GITHUB_REPO:-sst/finagent2}"
KEY_VAULT_NAME="${AZURE_KEY_VAULT_NAME:-finagent-keyvault}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="rotated_secrets_${TIMESTAMP}.env"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# Function to generate secure random strings
generate_secret() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Function to generate API key format
generate_api_key() {
    local prefix=${1:-"sk"}
    local length=${2:-48}
    echo "${prefix}_$(generate_secret $length)"
}

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Check for required tools
    local tools=("gh" "az" "openssl" "jq")
    for tool in "${tools[@]}"; do
        if ! command -v $tool &> /dev/null; then
            print_error "$tool is not installed. Please install it first."
            exit 1
        fi
    done
    
    # Check GitHub CLI authentication
    if ! gh auth status &> /dev/null; then
        print_error "GitHub CLI is not authenticated. Run: gh auth login"
        exit 1
    fi
    
    # Check Azure CLI authentication
    if ! az account show &> /dev/null; then
        print_error "Azure CLI is not authenticated. Run: az login"
        exit 1
    fi
    
    print_status "All prerequisites met"
}

# Backup current secrets
backup_secrets() {
    print_info "Creating backup of current secret references..."
    mkdir -p backups
    local backup_file="backups/secrets_backup_${TIMESTAMP}.json"
    
    # Export GitHub secrets list (names only, not values)
    gh secret list --repo $REPO_NAME --json name > "$backup_file" 2>/dev/null || true
    
    print_status "Backup created at $backup_file"
}

# Rotate Supabase secrets
rotate_supabase_secrets() {
    print_info "Rotating Supabase secrets..."
    
    cat >> "$OUTPUT_FILE" << EOF

# ============ SUPABASE ============
# Action Required: 
# 1. Go to https://app.supabase.com/project/YOUR_PROJECT/settings/api
# 2. Reset service role key
# 3. Copy the new values below

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=<copy-from-supabase-dashboard>
SUPABASE_SERVICE_KEY=<copy-from-supabase-dashboard-after-reset>

# For frontend (public keys)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<same-as-SUPABASE_ANON_KEY>
EOF
    
    print_warning "Manual action required for Supabase - see instructions in output file"
}

# Rotate Plaid secrets
rotate_plaid_secrets() {
    print_info "Rotating Plaid secrets..."
    
    cat >> "$OUTPUT_FILE" << EOF

# ============ PLAID ============
# Action Required:
# 1. Go to https://dashboard.plaid.com/developers/keys
# 2. Rotate your secret key
# 3. Copy the new values below

PLAID_CLIENT_ID=<your-existing-client-id>
PLAID_SECRET=<copy-new-secret-from-plaid-dashboard>
PLAID_ENV=sandbox  # or development/production
EOF
    
    print_warning "Manual action required for Plaid - see instructions in output file"
}

# Rotate AI/LLM API keys
rotate_ai_keys() {
    print_info "Rotating AI/LLM API keys..."
    
    cat >> "$OUTPUT_FILE" << EOF

# ============ AI/LLM PROVIDERS ============
# Action Required for each provider:

# OpenAI: https://platform.openai.com/api-keys
OPENAI_API_KEY=$(generate_api_key "sk" 48)  # Replace with actual from OpenAI dashboard

# Anthropic: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=$(generate_api_key "sk-ant" 48)  # Replace with actual from Anthropic dashboard

# Groq: https://console.groq.com/keys
GROQ_API_KEY=$(generate_api_key "gsk" 48)  # Replace with actual from Groq dashboard

# Azure OpenAI: Azure Portal > Cognitive Services
AZURE_OPENAI_API_KEY=$(generate_secret 32)  # Replace with actual from Azure
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com/
EOF
    
    print_warning "Manual action required for AI providers - see instructions in output file"
}

# Rotate market data API keys
rotate_market_data_keys() {
    print_info "Rotating market data API keys..."
    
    cat >> "$OUTPUT_FILE" << EOF

# ============ MARKET DATA PROVIDERS ============
# Action Required for each provider:

# Polygon: https://polygon.io/dashboard/api-keys
POLYGON_API_KEY=$(generate_api_key "pk" 32)  # Replace with actual from Polygon

# Alpaca: https://app.alpaca.markets/paper/dashboard/overview
ALPACA_API_KEY=$(generate_api_key "PK" 20)  # Replace with actual from Alpaca
ALPACA_SECRET_KEY=$(generate_secret 40)  # Replace with actual from Alpaca

# Yahoo Finance (if using paid API)
YAHOO_FINANCE_API_KEY=$(generate_secret 32)  # Replace with actual if using paid API
EOF
    
    print_warning "Manual action required for market data providers - see instructions in output file"
}

# Rotate infrastructure secrets
rotate_infrastructure_secrets() {
    print_info "Rotating infrastructure secrets..."
    
    # Generate new Redis password
    local redis_password=$(generate_secret 32)
    
    cat >> "$OUTPUT_FILE" << EOF

# ============ INFRASTRUCTURE ============

# Redis - Update password in your Redis instance
REDIS_URL=redis://default:${redis_password}@YOUR-REDIS-HOST:6379

# Mem0 Configuration
MEM0_API_KEY=$(generate_api_key "mem0" 48)  # Replace with actual from Mem0
MEM0_ENDPOINT=https://api.mem0.ai

# Application Settings
NODE_ENV=production
PORT=3000
API_BASE_URL=https://finagent-backend.azurewebsites.net
EOF
    
    print_status "Infrastructure secrets generated"
}

# Rotate Azure credentials
rotate_azure_credentials() {
    print_info "Rotating Azure service principal..."
    
    # Get current service principal ID if exists
    local sp_name="finagent-sp-${TIMESTAMP}"
    
    cat >> "$OUTPUT_FILE" << EOF

# ============ AZURE CREDENTIALS ============
# To create new service principal, run:
# az ad sp create-for-rbac --name "$sp_name" \\
#   --role contributor \\
#   --scopes /subscriptions/YOUR-SUBSCRIPTION-ID \\
#   --sdk-auth

AZURE_CREDENTIALS=<paste-json-output-from-above-command>

# Azure Container Registry
AZURE_CONTAINER_REGISTRY=finagentacr
AZURE_KEY_VAULT_NAME=$KEY_VAULT_NAME
EOF
    
    print_warning "Manual action required for Azure credentials - see instructions in output file"
}

# Update GitHub secrets
update_github_secrets() {
    print_info "Ready to update GitHub secrets..."
    
    cat >> "$OUTPUT_FILE" << EOF

# ============ GITHUB SECRETS UPDATE COMMANDS ============
# After obtaining all new secrets, run these commands:

# Backend secrets
gh secret set GROQ_API_KEY --repo $REPO_NAME --body "<new-groq-key>"
gh secret set AZURE_OPENAI_API_KEY --repo $REPO_NAME --body "<new-azure-openai-key>"
gh secret set AZURE_OPENAI_ENDPOINT --repo $REPO_NAME --body "<azure-openai-endpoint>"
gh secret set PLAID_CLIENT_ID --repo $REPO_NAME --body "<plaid-client-id>"
gh secret set PLAID_SECRET --repo $REPO_NAME --body "<new-plaid-secret>"
gh secret set SUPABASE_SERVICE_KEY --repo $REPO_NAME --body "<new-supabase-service-key>"
gh secret set POLYGON_API_KEY --repo $REPO_NAME --body "<new-polygon-key>"
gh secret set ALPACA_API_KEY --repo $REPO_NAME --body "<new-alpaca-key>"
gh secret set ALPACA_SECRET_KEY --repo $REPO_NAME --body "<new-alpaca-secret>"
gh secret set OPENAI_API_KEY --repo $REPO_NAME --body "<new-openai-key>"
gh secret set ANTHROPIC_API_KEY --repo $REPO_NAME --body "<new-anthropic-key>"
gh secret set MEM0_API_KEY --repo $REPO_NAME --body "<new-mem0-key>"
gh secret set REDIS_URL --repo $REPO_NAME --body "<new-redis-url>"

# Frontend secrets
gh secret set NEXT_PUBLIC_SUPABASE_URL --repo $REPO_NAME --body "<supabase-url>"
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --repo $REPO_NAME --body "<supabase-anon-key>"

# CI/CD secrets
gh secret set AZURE_CREDENTIALS --repo $REPO_NAME --body '<azure-sp-json>'

EOF
    
    print_status "GitHub secret update commands generated"
}

# Update Azure Key Vault
update_azure_keyvault() {
    print_info "Ready to update Azure Key Vault..."
    
    cat >> "$OUTPUT_FILE" << EOF

# ============ AZURE KEY VAULT UPDATE COMMANDS ============
# After obtaining all new secrets, run these commands:

az keyvault secret set --vault-name $KEY_VAULT_NAME --name "GROQ-API-KEY" --value "<new-groq-key>"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "AZURE-OPENAI-API-KEY" --value "<new-azure-openai-key>"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "PLAID-SECRET" --value "<new-plaid-secret>"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "SUPABASE-SERVICE-KEY" --value "<new-supabase-service-key>"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "POLYGON-API-KEY" --value "<new-polygon-key>"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "ALPACA-SECRET-KEY" --value "<new-alpaca-secret>"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "OPENAI-API-KEY" --value "<new-openai-key>"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "ANTHROPIC-API-KEY" --value "<new-anthropic-key>"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "REDIS-PASSWORD" --value "<new-redis-password>"

EOF
    
    print_status "Azure Key Vault update commands generated"
}

# Generate verification script
generate_verification_script() {
    local verify_script="verify_rotation_${TIMESTAMP}.sh"
    
    cat > "$verify_script" << 'EOF'
#!/bin/bash
# Verification script for secret rotation

echo "Verifying secret rotation..."

# Test GitHub secrets exist (not values)
echo "GitHub Secrets:"
gh secret list --repo $REPO_NAME

# Test Azure Key Vault secrets exist
echo -e "\nAzure Key Vault Secrets:"
az keyvault secret list --vault-name $KEY_VAULT_NAME --query "[].name" -o tsv

# Test endpoints
echo -e "\nTesting endpoints..."
curl -s -o /dev/null -w "Backend: %{http_code}\n" https://finagent-backend.azurewebsites.net/health || echo "Backend: Failed"
curl -s -o /dev/null -w "Frontend: %{http_code}\n" https://finagent-web.azurewebsites.net || echo "Frontend: Failed"

echo -e "\nVerification complete!"
EOF
    
    chmod +x "$verify_script"
    print_status "Verification script created: $verify_script"
}

# Main execution
main() {
    echo "=========================================="
    echo "    Secret Rotation Script for Finagent    "
    echo "=========================================="
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Create output file with header
    cat > "$OUTPUT_FILE" << EOF
# ============================================================================
# ROTATED SECRETS - Generated on $(date)
# ============================================================================
# IMPORTANT: 
# 1. This file contains sensitive information - handle with care
# 2. Never commit this file to version control
# 3. Delete this file after updating all secrets
# 4. Some secrets require manual rotation through provider dashboards
# ============================================================================
EOF
    
    # Backup current configuration
    backup_secrets
    
    # Rotate each category of secrets
    rotate_supabase_secrets
    rotate_plaid_secrets
    rotate_ai_keys
    rotate_market_data_keys
    rotate_infrastructure_secrets
    rotate_azure_credentials
    
    # Generate update commands
    update_github_secrets
    update_azure_keyvault
    
    # Generate verification script
    generate_verification_script
    
    # Final instructions
    cat >> "$OUTPUT_FILE" << EOF

# ============ POST-ROTATION CHECKLIST ============
# 1. [ ] Rotate secrets in each provider's dashboard
# 2. [ ] Update GitHub secrets using commands above
# 3. [ ] Update Azure Key Vault using commands above
# 4. [ ] Update local .env files in development
# 5. [ ] Restart all services
# 6. [ ] Run verification script
# 7. [ ] Delete this file after completion
# 8. [ ] Monitor application logs for any auth errors

# ============ IMPORTANT SECURITY NOTES ============
# - Remove exposed secrets from git history using BFG Repo-Cleaner or git filter-branch
# - Audit access logs in all services
# - Consider enabling secret scanning in GitHub
# - Set up secret rotation reminders (every 90 days)
# - Use Azure Key Vault references in App Service where possible
EOF
    
    echo ""
    echo "=========================================="
    print_status "Secret rotation preparation complete!"
    echo ""
    print_info "Output file created: ${GREEN}$OUTPUT_FILE${NC}"
    print_info "Verification script: ${GREEN}verify_rotation_${TIMESTAMP}.sh${NC}"
    echo ""
    print_warning "CRITICAL: You have exposed secrets in your repository!"
    print_warning "Immediate actions required:"
    echo "  1. Rotate ALL secrets immediately using this script"
    echo "  2. Remove setup-github-secrets-azure.sh from repository"
    echo "  3. Clean git history to remove exposed secrets"
    echo "  4. Enable GitHub secret scanning"
    echo ""
    echo "Run: ${GREEN}cat $OUTPUT_FILE${NC} to see all instructions"
    echo "=========================================="
}

# Run main function
main "$@"