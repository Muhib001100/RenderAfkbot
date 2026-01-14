# 🚀 Deploying MineBot to Render (24/7 Singapore)

Render is great because it offers **Singapore** servers, which are very fast for Indian players. Follow these steps exactly.

---

## Step 1: Create a Render Account
1.  Go to [Render.com](https://render.com/).
2.  Sign up using your **GitHub** account (this is the easiest way).

## Step 2: Create a New Web Service
1.  In your dashboard, click **"New +"** and select **"Web Service"**.
2.  Choose **"Build and deploy from a Git repository"**.
3.  Connect your GitHub repository: `Muhib001100/MinecraftAFKBot`.

## Step 3: Configure settings
Fill in the fields exactly like this:

| Field | Value |
| :--- | :--- |
| **Name** | `minebot-manager` |
| **Region** | **Singapore (Southeast Asia)** 🇸🇬 |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | **Free** |

## Step 4: Environment Variables (Optional)
Render might ask for a Port. If needed:
1.  Go to the **Environment** tab.
2.  Add: `PORT` = `5000` (Our bot uses 5000 by default).

## Step 5: Prevent Sleeping (IMPORTANT!) 😴
Render's free tier sleeps after 15 minutes of inactivity. **You MUST do this to keep your bots online:**
1.  Once deployed, copy your Render URL (e.g., `https://minebot-manager.onrender.com`).
2.  Go to [UptimeRobot](https://uptimerobot.com/) (create a free account).
3.  Click **"Add New Monitor"**:
    - **Monitor Type**: HTTP(s)
    - **URL**: Your Render URL.
    - **Interval**: Every 5 minutes.
4.  This will "ping" your bot every 5 minutes so Render never puts it to sleep!

---

## 🏆 Deployment Complete!
Your bot dashboard will now be available at your Render URL. You can use **Ultra Lite Mode** and see the **Health Monitor** just like before, but now running on a Singapore IP!
