#!/bin/sh
# Enhanced startup script with comprehensive logging for Azure debugging

# Setup log file - use mounted volume if available, otherwise local
LOG_DIR="/mnt/logs"
if [ ! -d "$LOG_DIR" ]; then
    LOG_DIR="/tmp"
fi
LOG_FILE="$LOG_DIR/motia-startup-$(date +%Y%m%d-%H%M%S).log"

# Function to log both to console and file
log() {
    echo "$1" | tee -a "$LOG_FILE"
}

log "========================================"
log "MOTIA AZURE STARTUP DEBUG - $(date)"
log "========================================"
log "Log file: $LOG_FILE"

# System information
log "[SYSTEM] Hostname: $(hostname)"
log "[SYSTEM] OS: $(uname -a)"
log "[SYSTEM] Working directory: $(pwd)"
log "[SYSTEM] Node version: $(node --version)"
log "[SYSTEM] NPM version: $(npm --version)"

# Environment variables
echo ""
log "[ENV] Critical environment variables:"
log "[ENV] NODE_ENV=${NODE_ENV:-not_set}"
log "[ENV] PORT=${PORT:-not_set}"
log "[ENV] REDIS_URL=${REDIS_URL:-not_set}"
log "[ENV] DATABASE_URL=${DATABASE_URL:-not_set}"
log "[ENV] HOME=${HOME}"
log "[ENV] USER=${USER:-not_set}"
log "[ENV] PATH=${PATH}"

# File system check
echo ""
log "[FS] Current directory contents:"
ls -la

echo ""
log "[FS] Checking for critical files:"
[ -f "package.json" ] && log "[FS] ✓ package.json exists" || log "[FS] ✗ package.json missing"
[ -f "motia-workbench.json" ] && log "[FS] ✓ motia-workbench.json exists" || log "[FS] ✗ motia-workbench.json missing"
[ -d "steps" ] && log "[FS] ✓ steps directory exists" || log "[FS] ✗ steps directory missing"
[ -d "node_modules" ] && log "[FS] ✓ node_modules exists" || log "[FS] ✗ node_modules missing"
[ -d ".motia" ] && log "[FS] ✓ .motia directory exists" || log "[FS] ✗ .motia directory missing"

# Check Motia installation
echo ""
log "[MOTIA] Checking Motia installation:"
which motia && log "[MOTIA] Motia binary found at: $(which motia)" || log "[MOTIA] Motia binary not in PATH"
npx motia --version 2>&1 | head -5 || log "[MOTIA] Failed to get Motia version"

# Memory and resource limits
echo ""
log "[RESOURCES] Memory info:"
cat /proc/meminfo | grep -E "MemTotal|MemFree|MemAvailable" 2>/dev/null || log "[RESOURCES] Cannot read memory info"

echo ""
log "[RESOURCES] CPU info:"
nproc 2>/dev/null && log "[RESOURCES] CPU cores: $(nproc)" || log "[RESOURCES] Cannot determine CPU cores"

# Network check
echo ""
log "[NETWORK] Network interfaces:"
ip addr 2>/dev/null | grep -E "inet " || ifconfig 2>/dev/null | grep -E "inet " || log "[NETWORK] Cannot list network interfaces"

echo ""
log "[NETWORK] Checking port availability:"
netstat -tuln 2>/dev/null | grep ":${PORT:-3001}" && log "[NETWORK] Port ${PORT:-3001} already in use!" || log "[NETWORK] Port ${PORT:-3001} is available"

# Try to run Motia with different configurations
echo ""
echo "========================================"
echo "STARTING MOTIA SERVER ATTEMPTS"
echo "========================================"

# Set production environment
export NODE_ENV=production
export PORT=${PORT:-3001}

# Function to try running Motia with timeout
try_motia_config() {
    local config_name="$1"
    local motia_cmd="$2"
    
    echo ""
    log "[ATTEMPT] Trying: $config_name"
    log "[ATTEMPT] Command: $motia_cmd"
    
    # Run with timeout and capture both stdout and stderr
    timeout 10 sh -c "$motia_cmd" 2>&1 | while IFS= read -r line; do
        log "[MOTIA-$config_name] $line"
    done
    
    local exit_code=$?
    log "[ATTEMPT] Exit code: $exit_code"
    
    if [ $exit_code -eq 124 ]; then
        log "[ATTEMPT] ✓ Server ran for 10 seconds without crashing (timeout reached)"
        return 0
    elif [ $exit_code -eq 0 ]; then
        log "[ATTEMPT] ✓ Server exited cleanly"
        return 0
    else
        log "[ATTEMPT] ✗ Server crashed with exit code: $exit_code"
        return 1
    fi
}

# Try different Motia configurations
echo ""
log "[CONFIG] Testing configuration 1: Standard with host 0.0.0.0"
try_motia_config "STANDARD" "npx motia start --port ${PORT} --host 0.0.0.0"

echo ""
log "[CONFIG] Testing configuration 2: Without host specification"
try_motia_config "NO_HOST" "npx motia start --port ${PORT}"

echo ""
log "[CONFIG] Testing configuration 3: With NODE_OPTIONS for memory"
export NODE_OPTIONS="--max-old-space-size=512"
try_motia_config "MEM_LIMIT" "npx motia start --port ${PORT} --host 0.0.0.0"

echo ""
log "[CONFIG] Testing configuration 4: Development mode"
export NODE_ENV=development
try_motia_config "DEV_MODE" "npx motia dev --port ${PORT} --host 0.0.0.0"

# Check if Motia left any error logs
echo ""
log "[LOGS] Checking for Motia logs:"
[ -f ".motia/logs/error.log" ] && cat .motia/logs/error.log || log "[LOGS] No error.log found"
[ -f ".motia/logs/app.log" ] && cat .motia/logs/app.log || log "[LOGS] No app.log found"

# Final attempt with production mode and full logging
echo ""
echo "========================================"
echo "FINAL PRODUCTION ATTEMPT WITH VERBOSE LOGGING"
echo "========================================"
export NODE_ENV=production
export DEBUG=*
export MOTIA_LOG_LEVEL=debug

log "[FINAL] Starting Motia with verbose logging..."
log "[FINAL] Command: npx motia start --port ${PORT} --host 0.0.0.0"

# Run without timeout for production
exec npx motia start --port ${PORT} --host 0.0.0.0 2>&1 | while IFS= read -r line; do
    log "[MOTIA-PROD] $(date '+%Y-%m-%d %H:%M:%S') $line"
done