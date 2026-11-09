#!/usr/bin/env bash
# Redeploy the latest code on EC2:  bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
cd app
npm ci --omit=dev
pm2 restart yallain --update-env
sleep 2
curl -s http://localhost/healthz; echo
