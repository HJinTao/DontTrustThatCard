#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="/home/ubuntu/DontTrustThatCard"
cd "$PROJECT_ROOT"

source ~/.nvm/nvm.sh
nvm use 22.22.2 >/dev/null

npm run build

sudo mkdir -p /var/www/hhhjt.top
sudo rsync -a --delete "$PROJECT_ROOT/frontend/dist/" /var/www/hhhjt.top/

if pm2 describe dont-trust-that-card-backend >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --only dont-trust-that-card-backend
else
  pm2 start ecosystem.config.cjs --only dont-trust-that-card-backend
fi

pm2 save
