# Deployment Guide

## Server Requirements

- Ubuntu 20.04+ (or any Linux with Node.js)
- Node.js 18+
- Nginx
- SSL certificate (Let's Encrypt)

## Step 1: Server Setup

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx
```

## Step 2: Deploy Files

```bash
# Upload project
rsync -avz --exclude node_modules --exclude .env --exclude database.sqlite \
  ./ root@YOUR_SERVER:/var/www/mysite/

# On server: install dependencies
cd /var/www/mysite/admin-panel && npm install --production

# Create .env
cp .env.example .env
nano .env  # Fill in production values
```

## Step 3: Configure Nginx

```nginx
server {
    server_name yourdomain.com www.yourdomain.com;
    root /var/www/mysite/frontend;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:7001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Admin panel
    location /admin/ {
        proxy_pass http://127.0.0.1:7001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

## Step 4: Start with PM2

```bash
cd /var/www/mysite/admin-panel
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Step 5: SSL Certificate

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## Updating

```bash
# Upload new files
rsync -avz --exclude node_modules --exclude .env --exclude database.sqlite \
  ./ root@YOUR_SERVER:/var/www/mysite/

# Restart
ssh root@YOUR_SERVER "cd /var/www/mysite/admin-panel && pm2 restart sky-admin"
```
