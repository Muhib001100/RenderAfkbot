# Koyeb Deployment Guide for MineBot

This guide will help you deploy your MineBot to Koyeb for **FREE 24/7 hosting**.

---

## Prerequisites

Before starting, make sure you have:
- [ ] A GitHub account (free) - https://github.com/signup
- [ ] Your MineBot project files ready

---

## Step 1: Create a GitHub Account (Skip if you have one)

1. Go to https://github.com/signup
2. Enter your email, create a password
3. Choose a username
4. Verify your email
5. Done!

---

## Step 2: Create a New GitHub Repository

1. Go to https://github.com/new
2. Fill in the details:
   - **Repository name:** `minebot` (or any name you like)
   - **Description:** `Minecraft AFK Bot Manager`
   - **Visibility:** Select **Private** (recommended) or Public
3. Click **Create repository**
4. Keep this page open - you'll need the upload option

---

## Step 3: Upload Your MineBot Files to GitHub

### Option A: Using GitHub Web Interface (Easiest)

1. On your new repository page, click **"uploading an existing file"** link
2. Drag and drop these files/folders from your MineBot project:
   - `server.js`
   - `package.json`
   - `public/` (entire folder)
3. Scroll down and click **"Commit changes"**
4. Wait for upload to complete

### Option B: Using Git Command Line (Advanced)

```powershell
cd "d:\Extra\1 Projects\MineBot"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/minebot.git
git push -u origin main
```

---

## Step 4: Create a Koyeb Account

1. Go to https://www.koyeb.com
2. Click **"Get Started for Free"** or **"Sign Up"**
3. Choose **"Continue with GitHub"** (recommended - links your accounts)
4. Authorize Koyeb to access your GitHub
5. Complete the signup process
6. You're now in the Koyeb Dashboard!

---

## Step 5: Deploy Your MineBot

1. In Koyeb Dashboard, click **"Create App"** or **"Deploy my first App"**

2. Choose **"GitHub"** as the deployment method

3. Select your repository:
   - Click **"Select repository"**
   - Find and select your `minebot` repository
   - Select the `main` branch

4. Configure the build:
   - **Builder:** Auto-detect (it will detect Node.js)
   - **Build command:** Leave empty or `npm install`
   - **Run command:** `node server.js`

5. Choose your instance:
   - **Instance type:** Select **"Free"** (Nano - 512MB RAM)
   - **Region:** Choose the closest to your Minecraft server
     - If your MC server is in Europe → Frankfurt or Paris
     - If your MC server is in USA → Washington DC
     - If your MC server is in Asia → Singapore

6. Configure ports:
   - **Port:** `5000`
   - **Protocol:** HTTP

7. Name your service:
   - **App name:** `minebot` (or anything you like)
   - **Service name:** `minebot-service`

8. Click **"Deploy"**

---

## Step 6: Wait for Deployment

1. Koyeb will now:
   - Pull your code from GitHub
   - Install dependencies (`npm install`)
   - Start your bot (`node server.js`)

2. This takes about 2-5 minutes

3. Watch the **"Logs"** tab for progress

4. When you see `Server running on port 5000` in logs, it's working!

---

## Step 7: Access Your Bot Dashboard

1. After deployment, Koyeb gives you a URL like:
   ```
   https://minebot-YOUR_USERNAME.koyeb.app
   ```

2. Click this URL to open your MineBot dashboard

3. Configure your bot:
   - Enter your Minecraft server IP
   - Add bot names
   - Enable **Lite Mode** for best performance
   - Set View Distance to **Tiny (2)**
   - Click **Start Selected**

---

## Step 8: Verify 24/7 Operation

1. Start your bot(s) using the web dashboard
2. **Close the browser tab completely**
3. Wait 5 minutes
4. Open the dashboard again
5. Check if bots are still online!

If they're still online → **SUCCESS! Your bot runs 24/7 now!**

---

## Troubleshooting

### "Build Failed" Error
- Check that `package.json` is in the root folder
- Make sure all files were uploaded to GitHub

### "Port Already in Use" Error
- In Koyeb settings, ensure **Port** is set to `5000`

### Bot Disconnects After a While
- Enable **Lite Mode** in the dashboard
- Set **View Distance** to Tiny (2)
- Set **AFK Jump** to Never

### Can't Access Dashboard
- Check the Koyeb logs for errors
- Make sure the deployment status is "Healthy"

---

## Important Notes

### Free Tier Limits
- **RAM:** 512 MB (enough for 2-3 bots)
- **CPU:** Shared nano instance
- **Uptime:** 24/7 (no sleep!)
- **Bandwidth:** Generous for bot traffic

### Updating Your Bot
When you update code on GitHub:
1. Push changes to GitHub
2. Koyeb will auto-redeploy (if enabled)
3. Or manually click "Redeploy" in Koyeb dashboard

### Monitoring
- Use Koyeb's built-in **Logs** tab to see bot activity
- Check **Metrics** for CPU/RAM usage

---

## Quick Reference

| Item | Value |
|------|-------|
| Koyeb Dashboard | https://app.koyeb.com |
| Your Bot URL | `https://minebot-YOURNAME.koyeb.app` |
| Port | 5000 |
| Build Command | `npm install` |
| Run Command | `node server.js` |

---

## Need Help?

- Koyeb Docs: https://www.koyeb.com/docs
- Koyeb Discord: https://discord.gg/koyeb

**Congratulations! Your MineBot now runs 24/7 for FREE!** 🎉
