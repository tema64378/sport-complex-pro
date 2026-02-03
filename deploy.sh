#!/usr/bin/env bash
set -e

DOMAIN="sportcomplecspro.ru"
APP_DIR="/opt/sport-complex-pro"
API_PORT=4000
REPO_URL="https://github.com/tema64378/sport-complex-pro.git"

sudo apt update
sudo apt install -y nginx git curl ufw

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

sudo rm -rf $APP_DIR
sudo git clone $REPO_URL $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

cd $APP_DIR
npm install
npm run build

cd $APP_DIR/server
npm install

# .env для сервера
cat > $APP_DIR/server/.env <<EOF_ENV
YOOKASSA_SHOP_ID=your_shop_id
YOOKASSA_SECRET_KEY=your_secret_key
TINKOFF_TERMINAL_KEY=your_terminal_key
TINKOFF_PASSWORD=your_terminal_password
TINKOFF_API_TOKEN=your_api_token
VK_CLIENT_ID=your_vk_app_id
VK_CLIENT_SECRET=your_vk_client_secret
VK_REDIRECT_URI=https://sportcomplecspro.ru/api/auth/vk/callback
EOF_ENV

# .env для фронта
cat > $APP_DIR/.env <<EOF_ENV
VITE_API_BASE=https://sportcomplecspro.ru/api
VITE_CLOUDPAYMENTS_PUBLIC_ID=your_cloudpayments_public_id
EOF_ENV

sudo tee /etc/systemd/system/sport-api.service > /dev/null <<EOF_SERVICE
[Unit]
Description=Sport API
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR/server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node index.js
Restart=always
User=$USER

[Install]
WantedBy=multi-user.target
EOF_SERVICE

sudo systemctl daemon-reload
sudo systemctl enable sport-api
sudo systemctl start sport-api

sudo tee /etc/nginx/sites-available/sport-pro > /dev/null <<EOF_NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location /api/ {
        proxy_pass http://127.0.0.1:$API_PORT/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    location / {
        root $APP_DIR/dist;
        try_files \$uri /index.html;
    }
}
EOF_NGINX

sudo ln -sf /etc/nginx/sites-available/sport-pro /etc/nginx/sites-enabled/sport-pro
sudo nginx -t
sudo systemctl restart nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN

echo "Готово: https://$DOMAIN"
