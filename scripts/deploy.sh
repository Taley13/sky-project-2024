#!/bin/bash

# Sky Template - Deploy Script
# Usage: ./scripts/deploy.sh user@server /var/www/mysite

set -e

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: ./scripts/deploy.sh user@server /remote/path"
    echo "Example: ./scripts/deploy.sh root@167.71.57.210 /var/www/mysite"
    exit 1
fi

SERVER="$1"
REMOTE_PATH="$2"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Deploying to ${SERVER}:${REMOTE_PATH}..."

# Upload files (exclude dev files)
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.env' \
    --exclude 'database.sqlite' \
    --exclude '.git' \
    --exclude '.DS_Store' \
    --exclude 'PROJECT_CONFIG.md' \
    --exclude '*.bak' \
    "${PROJECT_ROOT}/" "${SERVER}:${REMOTE_PATH}/"

# Install dependencies and restart on server
ssh "$SERVER" "cd ${REMOTE_PATH}/admin-panel && npm install --production && pm2 restart sky-admin 2>/dev/null || pm2 start ecosystem.config.js"

echo ""
echo "Deploy complete!"
echo "Site: ${REMOTE_PATH}/frontend"
echo "Admin: PM2 process 'sky-admin'"
