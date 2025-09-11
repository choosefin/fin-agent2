#!/bin/sh
# Production startup script for Motia

# Set production environment
export NODE_ENV=production

# Start Motia server
echo "Starting Motia server on port ${PORT:-3001}..."
exec npx motia start --port ${PORT:-3001} --host 0.0.0.0