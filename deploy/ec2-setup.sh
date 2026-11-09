#!/usr/bin/env bash
# First-time setup on a fresh Amazon Linux 2023 EC2 instance.
# Usage (on the instance):  bash deploy/ec2-setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Installing Node.js 20, Nginx, Git"
sudo dnf install -y nodejs20 nodejs20-npm git nginx
sudo alternatives --install /usr/bin/node node /usr/bin/node-20 90 2>/dev/null || true
sudo alternatives --install /usr/bin/npm npm /usr/bin/npm-20 90 2>/dev/null || true
sudo npm install -g pm2

echo "==> Installing app dependencies"
cd app
npm ci --omit=dev
if [ ! -f .env ]; then
  cp .env.example .env
  echo "!! Created app/.env from the example — edit it now (nano app/.env), then run this script again."
  exit 1
fi

echo "==> Creating tables and catalog in RDS"
npm run db:init

echo "==> Starting the app with PM2 (restarts on crash and on reboot)"
pm2 start server.js --name yallain --time
pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | bash || true

echo "==> Configuring Nginx"
sudo cp ../deploy/nginx.conf /etc/nginx/conf.d/yallain.conf
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx

echo "==> Done. Health check:"
curl -s http://localhost/healthz; echo
