# Sky Project - Deployment Guide

## 🚀 DEPLOYMENT TO VERCEL

### Prerequisites
- GitHub account (repo already pushed)
- Vercel account (free tier available)

---

## **STEP 1: Connect to Vercel**

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com)
2. Sign up / Log in with GitHub
3. Click **"New Project"**
4. Select **GitHub** → authorize
5. Find & select **`Taley13/sky-project-2024`** repo
6. Click **"Import"**

### Option B: Via CLI

```bash
npm i -g vercel
cd /Users/taley13/Desktop/Sky
vercel
# Follow prompts to connect GitHub account
```

---

## **STEP 2: Configure Environment Variables**

In Vercel Dashboard:
1. Project → Settings → Environment Variables
2. Add these variables:

```
PORT = 3000
NODE_ENV = production
ALLOWED_ORIGINS = https://your-vercel-domain.vercel.app
TELEGRAM_BOT_TOKEN = your_bot_token_here
TELEGRAM_CHAT_ID = your_chat_id_here
```

**Important:** Never commit `.env` to git - only add via Vercel dashboard!

---

## **STEP 3: Deploy**

### Auto-Deploy (Recommended)
```
Push to GitHub main branch
↓
Vercel automatically detects changes
↓
Builds & deploys automatically
```

### Manual Deploy via CLI
```bash
vercel --prod
```

---

## **STEP 4: Verify Deployment**

After deploy completes:

1. **Check Frontend:**
   ```
   https://your-project.vercel.app/
   ```

2. **Check API Health:**
   ```
   https://your-project.vercel.app/api/health
   ```

3. **Test Lead Submission:**
   - Go to `/contacts.html`
   - Fill form
   - Should appear in Telegram chat

---

## **📝 Project Structure for Vercel**

```
/
├── vercel.json          (Vercel config)
├── .vercelignore        (Files to ignore)
├── frontend/            (Static files)
│   ├── index.html
│   ├── contacts.html
│   ├── portfolio.html
│   ├── services.html
│   ├── css/
│   ├── js/
│   ├── images/
│   └── locales/
└── backend/admin-panel/ (Node.js API)
    ├── server.js
    ├── package.json
    ├── .env
    └── database.sqlite
```

---

## **🔒 Security Checklist**

Before production:

- [ ] `.env` file NOT committed to git
- [ ] Telegram bot token in Vercel env vars (not in code)
- [ ] API_BASE_URL matches production domain
- [ ] HTTPS enforced (Vercel does this by default)
- [ ] Rate limiting enabled (10/hour for `/api/orders`)

---

## **🧪 Testing Checklist**

After deployment:

- [ ] Homepage loads: `https://your-domain.vercel.app/`
- [ ] All 4 pages load (index, services, portfolio, contacts)
- [ ] Configurator works on `/services.html`
- [ ] Contact form submits & appears in Telegram
- [ ] Language switching works (EN/RU)
- [ ] Portfolio filters work
- [ ] Responsive on mobile
- [ ] Lighthouse audit > 80

---

## **🔧 Troubleshooting**

### Build Fails

Check Vercel logs:
```
Deployments → [Failed Deployment] → Logs
```

Common issues:
- Missing dependencies → `npm install` in backend/admin-panel
- Wrong Node version → Set in `package.json` engine field
- Port conflict → Use `PORT=3000`

### API Not Working

1. Check `.env` variables in Vercel dashboard
2. Test API: `https://your-domain.vercel.app/api/health`
3. Check function logs: Deployments → [Build] → Runtime Logs

### Static Files Not Serving

1. Verify `vercel.json` routes configuration
2. Check frontend files exist in `/frontend/`
3. Clear Vercel cache: Settings → Deployment → Clear Cache

---

## **📊 Monitoring**

After deployment, check:

1. **Vercel Analytics Dashboard**
   - Performance metrics
   - Bandwidth usage
   - Error rates

2. **Error Tracking** (Optional)
   - Setup Sentry for error monitoring
   - Add in logger.js

3. **Telegram Notifications**
   - Test by submitting form from live site
   - Verify message appears in Telegram

---

## **🔄 Continuous Deployment**

Vercel auto-deploys on:
- ✅ Push to `main` branch
- ✅ Merged pull requests
- ✅ Force push

Deployments can be:
- ✅ Canceled
- ✅ Redeployed
- ✅ Promoted to Production

---

## **💰 Pricing**

**Free tier includes:**
- ✅ Unlimited deployments
- ✅ Static file serving (frontend)
- ✅ Serverless functions (backend API)
- ✅ 100 GB bandwidth/month
- ✅ Custom domain support
- ✅ HTTPS

**Upgrade only if:**
- Need more bandwidth
- Team collaboration features
- Advanced analytics

---

## **🎯 Production Domain**

To use custom domain:

1. Vercel Dashboard → Settings → Domains
2. Add your domain (e.g., `sky.example.com`)
3. Update DNS records (Vercel shows instructions)
4. Update Telegram callback URL (if using)
5. Update ALLOWED_ORIGINS in .env

---

## **📞 Support**

- Vercel Docs: https://vercel.com/docs
- Support: https://vercel.com/support
- Status: https://status.vercel.com

---

## **✅ Deployment Complete!**

Your Sky project is now:
- 🌍 **Live on the web**
- 🔒 **Secure with HTTPS**
- ⚡ **Fast with global CDN**
- 📈 **Scalable with serverless**
- 🔄 **Auto-deploying on git push**

🚀 **Ready for production!**
