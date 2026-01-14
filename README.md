# Robust Mineflayer Bot (Cracked & BungeeCord Support)

This bot is designed to handle **BungeeCord world switches** without disconnecting, and automatically logs in to **cracked servers**.

## Fixes Included
1. **Connection Error Fix**: `checkTimeoutInterval` is set to 60 seconds. This prevents the bot from timing out when the server "pauses" during a world switch (e.g., Hub -> SkyBlock).
2. **Auto-Reconnect**: If the bot is kicked or the server restarts, it waits 5 seconds and rejoins.
3. **Auto-Login**: Detects `/login` or `/register` messages and sends the password automatically.

## How to Setup

1. **Open `index.js`**
2. Edit the **Config** section at the top:
   ```javascript
   const config = {
     host: 'example.server.ip', // YOUR SERVER IP HERE
     port: 25565,
     username: 'BotName',
     password: 'yourpassword'   // Password for /login plugin
   }
   ```

## How to Run

Open a terminal in this folder and run:

```bash
node index.js
```

## Troubleshooting
- **Still disconnecting?** Try increasing `checkTimeoutInterval` in `index.js` to `90000` (90 seconds).
- **Wrong Password?** Check your `config` variable.
- **Kicked for Spam?** The bot has a simple Anti-AFK. If the server is strict, you might need to tweak the jump interval.
