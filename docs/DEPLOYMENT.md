# Sky Template - Production Deployment Guide

## Quick Start (Recommended)

Deploy in **5 minutes** using Vercel (Frontend) + Render (Backend).

### Prerequisites
- GitHub account with repository pushed
- Vercel account (free)
- Render account (free tier available)

---

## Option 1: Vercel + Render (RECOMMENDED)

### Frontend: Deploy on Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository (`Taley13/Sky`)
3. Configure:
   - **Framework Preset**: Other
   - **Root Directory**: `frontend`
4. Click "Deploy"

**Vercel will auto-deploy on every push to GitHub**

### Backend: Deploy on Render

1. Go to https://render.com → Dashboard → New Web Service
2. Connect GitHub account
3. Select `Taley13/Sky` repository
4. Configure:
   - **Name**: `sky-api`
   - **Runtime**: Node
   - **Root Directory**: `.`
   - **Build Command**: `npm install --prefix admin-panel`
   - **Start Command**: `npm start --prefix admin-panel`
5. Add Environment Variables:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `SESSION_SECRET` | _(generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)_ |
| `ADMIN_DEFAULT_PASSWORD` | _(your secure password)_ |
| `WEBSITE_API_KEY` | _(generate: `node -e "console.log(require('crypto').randomUUID())"`)_ |
| `ALLOWED_ORIGINS` | `https://your-vercel-domain.vercel.app,https://your-api.onrender.com` |
| `TELEGRAM_BOT_TOKEN` | _(optional)_ |
| `TELEGRAM_CHAT_ID` | _(optional)_ |

6. Click "Create Web Service"

**Render will auto-deploy on every push to GitHub**

### Verify Deployment

```bash
# Test API
curl https://your-api.onrender.com/api/health
# Response: {"status":"ok","timestamp":"..."}

# Test Frontend
curl https://your-project.vercel.app
# Should return HTML
```

### First Login
- URL: `https://your-api.onrender.com`
- Username: `admin`
- Password: Your `ADMIN_DEFAULT_PASSWORD` value

---

## Option 2: Self-Hosted (Advanced)

### Requirements
- Ubuntu 20.04+ or similar Linux
- Node.js 18+
- Nginx
- SSL certificate (Let's Encrypt)
- SSH access to server

### Step 1: Server Setup

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs npm

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx
```

### Step 2: Deploy Code

```bash
# Clone repository
cd /var/www
git clone https://github.com/Taley13/Sky.git mysite
cd mysite

# Install dependencies
cd admin-panel && npm install --production

# Setup environment
cp .env.example .env
# Edit .env with your values
nano .env
```

### Step 3: Configure Nginx

Create `/etc/nginx/sites-available/sky`:

```nginx
server {
    server_name yourdomain.com www.yourdomain.com;
    root /var/www/mysite/frontend;

    # Static frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:7001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 80;
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/sky /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

### Step 4: Configure SSL

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# Certbot will auto-update nginx config
```

### Step 5: Start Backend with PM2

```bash
cd /var/www/mysite/admin-panel
pm2 start server.js --name sky-api
pm2 save
pm2 startup
```

### Step 6: Update Process

```bash
# Pull latest code
cd /var/www/mysite
git pull origin main

# Reinstall deps if needed
cd admin-panel && npm install --production

# Restart service
pm2 restart sky-api
```

---

## Environment Variables

### Required (All Environments)
| Variable | Example |
|----------|---------|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | _(32-char hex)_ |
| `ADMIN_DEFAULT_PASSWORD` | _(strong password)_ |

### Optional (Features)
| Variable | When Needed |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | To send Telegram notifications |
| `TELEGRAM_CHAT_ID` | With Telegram bot |
| `INIT_DEMO_DATA` | Set to `true` first run only |

### Generate Secure Values

```bash
# SESSION_SECRET (32 bytes hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# WEBSITE_API_KEY (UUID)
node -e "console.log(require('crypto').randomUUID())"

# ADMIN_DEFAULT_PASSWORD (strong password)
openssl rand -base64 18
```

---

## Database Backup

### Vercel/Render (SQLite)
```bash
# Download from Render dashboard
# Settings → Disk → Download database.sqlite

# Or via SSH/SFTP
scp user@api.onrender.com:/app/database.sqlite ./backup.sqlite
```

### Self-Hosted
```bash
# Backup
cp /var/www/mysite/admin-panel/database.sqlite ./backup-$(date +%Y%m%d).sqlite

# Restore
cp backup.sqlite /var/www/mysite/admin-panel/database.sqlite
pm2 restart sky-api
```

---

## Monitoring

### Health Checks

```bash
# Check API
curl https://your-api.example.com/api/health

# Check Frontend
curl -I https://your-site.example.com
```

### View Logs

**Vercel**:
```bash
vercel logs your-project
```

**Render**:
- Dashboard → Logs tab

**Self-Hosted**:
```bash
pm2 logs sky-api
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Frontend can't connect to API | Check `ALLOWED_ORIGINS` includes frontend URL |
| Admin login fails | Verify `SESSION_SECRET` and `ADMIN_DEFAULT_PASSWORD` |
| 502 Bad Gateway | Check API service is running (`pm2 logs` or Render logs) |
| Slow first request | Normal on Render free tier (cold start) |
| Database lost after restart | Free tier Render may reset - use backup or upgrade |

---

## Production Checklist

- [ ] Code committed to GitHub
- [ ] Frontend deployed (Vercel/self-hosted)
- [ ] Backend deployed (Render/self-hosted)
- [ ] Environment variables configured
- [ ] SSL certificate installed (HTTPS)
- [ ] Admin login works
- [ ] API health check passes
- [ ] CORS configured
- [ ] Backup strategy implemented
- [ ] Monitoring/alerts configured

---

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [GitHub Repository](https://github.com/Taley13/Sky)
- [Vercel Documentation](https://vercel.com/docs)
- [Render Documentation](https://render.com/docs)
