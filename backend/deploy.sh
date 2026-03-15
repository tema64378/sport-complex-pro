#!/usr/bin/env bash
set -euo pipefail

# Rust-only backend deploy helper (no Node.js backend, no MySQL/MariaDB)
# Frontend is static (Vite build), backend is Rust + SQLite.

DOMAIN="${1:-sportcomplecspro.ru}"
APP_DIR="${2:-/opt/sport-complex-pro}"
API_PORT="${PORT:-4000}"
REPO_URL="${REPO_URL:-https://github.com/tema64378/sport-complex-pro.git}"

echo "==> Installing base packages"
sudo apt update
sudo apt install -y nginx git curl build-essential pkg-config libssl-dev sqlite3

if ! command -v rustup >/dev/null 2>&1; then
  echo "==> Installing Rust toolchain"
  curl https://sh.rustup.rs -sSf | sh -s -- -y
  source "$HOME/.cargo/env"
fi

if ! command -v cargo >/dev/null 2>&1; then
  source "$HOME/.cargo/env"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "==> Installing Node.js for frontend build only"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

echo "==> Cloning/refreshing project"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo rm -rf "$APP_DIR"
  sudo git clone "$REPO_URL" "$APP_DIR"
fi
sudo chown -R "$USER":"$USER" "$APP_DIR"
cd "$APP_DIR"
git pull --ff-only

echo "==> Building frontend"
cd "$APP_DIR/frontend"
npm ci || npm install
npm run build

echo "==> Building Rust backend"
cd "$APP_DIR/backend"
mkdir -p logs backups
cargo build --release

sudo tee /etc/systemd/system/sport-api.service > /dev/null <<EOF_SERVICE
[Unit]
Description=Sport Complex Pro Rust API
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR/backend
Environment=PORT=$API_PORT
Environment=RUST_DB_PATH=$APP_DIR/backend/data.db
Environment=RUST_BACKUP_DIR=$APP_DIR/backend/backups
ExecStart=$APP_DIR/backend/target/release/sport-complex-pro-rust-api
Restart=always
User=$USER

[Install]
WantedBy=multi-user.target
EOF_SERVICE

sudo tee /etc/nginx/sites-available/sport-pro > /dev/null <<EOF_NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location /api/ {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    location / {
        root $APP_DIR/frontend/dist;
        try_files \$uri /index.html;
    }
}
EOF_NGINX

sudo ln -sf /etc/nginx/sites-available/sport-pro /etc/nginx/sites-enabled/sport-pro
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t

sudo systemctl daemon-reload
sudo systemctl enable sport-api
sudo systemctl restart sport-api
sudo systemctl restart nginx

echo "✅ Deploy complete"
echo "Frontend: http://$DOMAIN"
echo "API:      http://$DOMAIN/api/ping"
