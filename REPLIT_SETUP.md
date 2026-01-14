# How to Deploy MineBot to Replit

This guide explains how to move your local project to Replit easily.

## Option 1: Drag & Drop (Easiest)
1.  **Create a New Repl**:
    *   Go to Replit.com and click **Create Repl**.
    *   Template: Choose **Node.js**.
    *   Title: `MineBot-Manager`.

2.  **Upload Files**:
    *   In the Replit sidebar (Files), drag and drop the following files/folders from your PC:
        *   `server.js`
        *   `package.json`
        *   `public/` (The entire folder)
    *   *Note: You do NOT need to upload `node_modules` or `.git`. Replit installs dependencies automatically.*

3.  **Install Dependencies**:
    *   In the Replit "Shell" (Console tab), type:
        ```bash
        npm install
        ```

4.  **Run**:
    *   Click the big green **Run** button at the top.
    *   Replit should detect `node server.js` automatically. If it asks, the run command is: `node server.js`

5.  **Access the UI**:
    *   A "Webview" window will appear.
    *   Your URL will look like: `https://MineBot-Manager.yourname.repl.co`.
    *   **Open this URL in a new tab** to use your dashboard properly!

## Important Notes for Replit
*   **Keep it Running**: Replit sleeps if you close the tab. You might need a service like **UptimeRobot** to ping your URL every 5 minutes if you want 24/7 AFK.
*   **Proxies**: Replit IPs change often. This works best on Cracked Servers (which you are using) or servers with weak anti-bot protection.
*   **Storage**: Your "My Bots" list is saved in your *browser's* LocalStorage. If you switch computers, you will need to re-add the bots.
