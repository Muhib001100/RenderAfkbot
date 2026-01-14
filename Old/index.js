const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')

// --- CONFIGURATION ---
const config = {
  host: 'localhost', // CHANGE THIS to your server IP
  port: 25565,       // Default Minecraft port
  username: 'BotName', // CHANGE THIS
  version: false,    // false = auto-detect. Set to '1.18.2' etc if needed.
  password: 'password123' // password for /login
}

let bot

function createBot() {
  console.log(`Logging in as ${config.username}...`)

  bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version,
    auth: 'offline', // 'offline' for cracked servers
    checkTimeoutInterval: 60 * 1000, // 60s timeout to prevent disconnects on slow world switches
  })

  bot.loadPlugin(pathfinder)

  // --- EVENTS ---

  bot.once('spawn', () => {
    console.log('Spawned in the world!')
    startAntiAfk()
  })

  // Auto-Login for Cracked Servers
  bot.on('message', (jsonMsg) => {
    const message = jsonMsg.toString()
    // Helper to log chat
    if (message.trim().length > 0) console.log(`[CHAT] ${message}`)

    // Basic Login detection - Adjust strings based on your server plugin (AuthMe, etc.)
    if (message.toLowerCase().includes('/register')) {
      bot.chat(`/register ${config.password} ${config.password}`)
      console.log('Exec: /register ...')
    }
    else if (message.toLowerCase().includes('/login')) {
      bot.chat(`/login ${config.password}`)
      console.log('Exec: /login ...')
    }
  })

  // Handling Kicks & Disconnects
  bot.on('kicked', (reason) => {
    console.log(`Kicked: ${reason}`)
    // reason handling if needed
  })

  bot.on('end', (reason) => {
    console.log(`Disconnected: ${reason}`)
    
    // If it was a deliberate quit, don't reconnect
    if (reason === 'disconnect.quitting') return

    // Auto-Reconnect Logic
    console.log('Attempting to reconnect in 5 seconds...')
    setTimeout(createBot, 5000)
  })

  bot.on('error', (err) => {
    console.log(`Error: ${err.message}`)
    // Don't crash, just log it. 
    // Connection errors often trigger 'end' event shortly after.
  })
}

// --- ANTI-AFK & LOGIC ---

function startAntiAfk() {
  // Simple random jump/look every few seconds to stay active
  setInterval(() => {
    if (!bot || !bot.entity) return
    
    // 1. Look around randomly
    const yaw = Math.random() * Math.PI - (0.5 * Math.PI)
    const pitch = Math.random() * Math.PI - (0.5 * Math.PI)
    bot.look(yaw, pitch)

    // 2. Random tiny jump
    if (Math.random() > 0.8) {
      bot.setControlState('jump', true)
      setTimeout(() => bot.setControlState('jump', false), 250)
    }

  }, 5000) // Every 5 seconds
}

// Start the bot
createBot()
