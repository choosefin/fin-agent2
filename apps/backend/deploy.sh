#!/bin/bash

# ----------------------
# KUDU Deployment Script for Azure App Service - Motia Backend (Linux)
# Version: 1.0.0
# ----------------------

# Helpers
# -------

exitWithMessageOnError () {
  if [ ! $? -eq 0 ]; then
    echo "An error has occurred during web site deployment."
    echo $1
    exit 1
  fi
}

# Prerequisites
# -------------

# Verify node.js installed
hash node 2>/dev/null
exitWithMessageOnError "Missing node.js executable, please install node.js, if already installed make sure it can be reached from current environment."

# Setup
# -----

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ARTIFACTS=$SCRIPT_DIR/../artifacts
KUDU_SYNC_CMD=${KUDU_SYNC_CMD//\'}

if [[ ! -n "$DEPLOYMENT_SOURCE" ]]; then
  DEPLOYMENT_SOURCE=$SCRIPT_DIR
fi

if [[ ! -n "$DEPLOYMENT_TARGET" ]]; then
  DEPLOYMENT_TARGET=$ARTIFACTS/wwwroot
fi

if [[ ! -n "$NEXT_MANIFEST_PATH" ]]; then
  NEXT_MANIFEST_PATH=$ARTIFACTS/manifest

  if [[ ! -n "$PREVIOUS_MANIFEST_PATH" ]]; then
    PREVIOUS_MANIFEST_PATH=$ARTIFACTS/manifest
  fi
fi

if [[ ! -n "$KUDU_SYNC_CMD" ]]; then
  # Install kudu sync
  echo Installing Kudu Sync
  npm install kudusync -g --silent
  exitWithMessageOnError "npm failed"

  if [[ ! -n "$KUDU_SYNC_CMD" ]]; then
    # Locate kudu sync
    KUDU_SYNC_CMD=kudusync
    hash kudusync 2>/dev/null
    exitWithMessageOnError "kudusync not found"
  fi
fi

# Deployment
# ----------

echo Handling Motia backend deployment.

# 1. KuduSync
if [[ "$IN_PLACE_DEPLOYMENT" -ne "1" ]]; then
  "$KUDU_SYNC_CMD" -v 50 -f "$DEPLOYMENT_SOURCE" -t "$DEPLOYMENT_TARGET" -n "$NEXT_MANIFEST_PATH" -p "$PREVIOUS_MANIFEST_PATH" -i ".git;.hg;.deployment;deploy.sh"
  exitWithMessageOnError "Kudu Sync failed"
fi

# 2. Install npm packages
if [ -e "$DEPLOYMENT_TARGET/package.json" ]; then
  cd "$DEPLOYMENT_TARGET"
  echo "Installing npm packages for Motia backend..."
  npm ci --only=production
  exitWithMessageOnError "npm failed"
  cd - > /dev/null
fi

# 3. Install Motia globally for Azure
cd "$DEPLOYMENT_TARGET"
echo "Installing Motia CLI globally..."
npm install -g motia@0.6.4-beta.130
exitWithMessageOnError "Motia CLI installation failed"

# 4. Build Motia project
echo "Building Motia backend..."
motia build
exitWithMessageOnError "Motia build failed"
cd - > /dev/null

# 5. Create startup script
echo "Creating startup script..."
cat > "$DEPLOYMENT_TARGET/startup.sh" <<'EOF'
#!/bin/bash
motia start --port $PORT --host 0.0.0.0
EOF
chmod +x "$DEPLOYMENT_TARGET/startup.sh"

echo "Finished successfully."