const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { SocksProxyAgent } = require('socks-proxy-agent');
const ioClient = require('socket.io-client');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Store active bots: { [id]: botInstance }
const bots = {};
// Store pending reconnection timeouts: { [id]: timeoutId }
const reconnectTimeouts = {};

io.on('connection', (socket) => {
    console.log('Web Client Connected');

    // --- START BOTS ---
    socket.on('start-bots', (data) => {
        // New Format: { global: {host, port, version, afkInterval, viewDistance}, bots: [] }

        const { host, port, version, afkInterval, viewDistance, liteMode, proxy } = data.global;
        // Handle 0 explicitly
        let jumpInterval = parseInt(afkInterval);
        if (isNaN(jumpInterval)) jumpInterval = 30000;
        let vDist = viewDistance || 'tiny';
        if (!isNaN(vDist)) vDist = parseInt(vDist);

        console.log(`Starting ${data.bots.length} bots on ${host}... (AFK: ${jumpInterval}ms, View: ${vDist}, Lite: ${!!liteMode}, Proxy: ${proxy || 'None'})`);

        data.bots.forEach((botConfig, index) => {
            // Delay each join by 8 SECONDS
            setTimeout(() => {
                let finalHost = host;
                let finalPort = port || 25565;

                // Support host:port format
                if (host.includes(':')) {
                    const parts = host.split(':');
                    finalHost = parts[0];
                    finalPort = parseInt(parts[1]) || 25565;
                }

                const fullConfig = {
                    host: finalHost,
                    port: finalPort,
                    version: version === 'auto' ? false : version,
                    username: botConfig.name,
                    reconnect: botConfig.reconnect,
                    commands: botConfig.commands || [],
                    afkInterval: jumpInterval,
                    viewDistance: vDist,
                    liteMode: !!liteMode,
                    ultraLiteMode: !!data.global.ultraLiteMode, // Pass Ultra Lite
                    proxy: proxy // Pass Proxy
                };

                if (bots[botConfig.name]) return; // Already running

                createBot(botConfig.name, fullConfig);

            }, index * 8000); // 8000ms Gap
        });
    });

    // --- STOP BOTS ---
    socket.on('stop-bots', () => {
        console.log("Stopping all bots...");

        // Clear all pending reconnection timeouts first
        Object.keys(reconnectTimeouts).forEach(botId => {
            clearTimeout(reconnectTimeouts[botId]);
            delete reconnectTimeouts[botId];
        });

        Object.keys(bots).forEach(botId => {
            const bot = bots[botId];
            if (bot) {
                bot.removeAllListeners(); // Prevent auto-reconnect
                try { bot.quit(); } catch (e) { }
                delete bots[botId];
            }
        });
        io.emit('status', { msg: 'All bots stopped.' });
        io.emit('bot-status-all', { status: 'Offline' });
    });

    // --- GHOST BROWSER (Keep Replit Awake) ---
    let ghostSocket = null;
    socket.on('ghost-connect', (targetUrl) => {
        console.log(`Ghost Browser attempting to connect to: ${targetUrl}`);
        if (ghostSocket) ghostSocket.close();

        ghostSocket = ioClient(targetUrl, {
            reconnection: true,
            reconnectionAttempts: Infinity
        });

        ghostSocket.on('connect', () => {
            console.log("Ghost Browser CONNECTED to Replit!");
            socket.emit('ghost-status', { msg: 'CONNECTED' });
        });

        ghostSocket.on('disconnect', () => {
            console.log("Ghost Browser DISCONNECTED from Replit.");
            socket.emit('ghost-status', { msg: 'DISCONNECTED' });
        });

        ghostSocket.on('connect_error', (err) => {
            console.log(`Ghost Browser ERROR: ${err.message}`);
            socket.emit('ghost-status', { msg: `ERROR: ${err.message}` });
        });
    });

    // AGGRESSIVE KEEP-ALIVE (When Tab Closes)
    socket.on('disconnect', () => {
        console.log("Client Disconnected (Tab Closed). Triggering Anti-Sleep...");
        // Immediate Self-Ping to prevent Replit Sleep
        http.get(`http://localhost:${PORT}/ping`).on('error', () => { });
    });


    // --- SEND CHAT ---
    socket.on('chat', ({ target, message }) => {
        if (target === 'all') {
            Object.values(bots).forEach(bot => bot.chat(message));
        } else if (bots[target]) {
            bots[target].chat(message);
        }
    });

    // --- ADVANCED INVENTORY ACTIONS ---

    socket.on('click-window', ({ target, slot, type }) => {
        // type: 0 = Left, 1 = Right, 'shift' = Shift+Left
        if (!bots[target] || !bots[target].currentWindow) return;

        try {
            console.log(`[${target}] Clicking slot ${slot} (Type: ${type})`);

            let mouseButton = 0; // Left
            let mode = 0; // Normal click

            if (type === 'right') mouseButton = 1;
            if (type === 'shift') {
                mouseButton = 0; // Left
                mode = 1; // Shift
            }

            bots[target].clickWindow(slot, mouseButton, mode);
        } catch (e) {
            console.error(`Click Error: ${e.message}`);
        }
    });

    socket.on('drop-slot', ({ target, slot }) => {
        // "Q" functionality - Drop 1 item from slot
        if (!bots[target]) return;
        try {
            console.log(`[${target}] Dropping item from slot ${slot}`);
            // Mode 4 = Drop, Button 0 = Drop 1 item, Button 1 = Drop stack
            if (bots[target].currentWindow) {
                bots[target].clickWindow(slot, 0, 4);
            } else {
                // Inventory not open, toss from hotbar?
                // Assuming 'slot' here refers to the inventory slot number (0-8 for hotbar)
                // mineflayer.toss requires item type, metadata, and count.
                // This part needs more context if 'slot' is just a number.
                // For now, a placeholder or a more robust check would be needed.
                // Example: bots[target].inventory.slots[slot] to get item details.
                const itemToToss = bots[target].inventory.slots[slot];
                if (itemToToss) {
                    bots[target].tossStack(itemToToss); // Tosses the whole stack
                } else {
                    console.log(`[${target}] No item in slot ${slot} to toss.`);
                }
            }
        } catch (e) { console.error(e); }
    });

    // --- CONTROL (Movement) ---
    socket.on('control', ({ target, action, state }) => {
        // action: 'forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak'
        // state: true (down) / false (up)

        const applyControl = (bot) => {
            try {
                if (action === 'click') {
                    if (state) bot.activateItem();
                    bot.swingArm();
                } else {
                    bot.setControlState(action, state);
                }
            } catch (e) { }
        };

        if (target === 'all') {
            Object.values(bots).forEach(applyControl);
        } else if (bots[target]) {
            applyControl(bots[target]);
        }
    });
});

function createBot(botId, config) {
    let agent;
    if (config.proxy && config.proxy.includes(':')) {
        try {
            agent = new SocksProxyAgent(`socks5://${config.proxy}`);
            console.log(`[${botId}] Using Proxy: ${config.proxy}`);
        } catch (e) {
            console.error(`[${botId}] Proxy Error: ${e.message}`);
        }
    }

    const botOptions = {
        host: config.host,
        port: config.port,
        username: config.username,
        version: config.version === 'auto' ? false : config.version,
        auth: 'offline', // Cracked server support
        checkTimeoutInterval: 180000,
        viewDistance: config.viewDistance || 'tiny', // Configurable
        hideErrors: false,
        agent: agent // Apply Proxy agent
    };

    const bot = mineflayer.createBot(botOptions);

    // ULTRA LITE MODE v2 - Surgical removal of heavy listeners
    if (config.ultraLiteMode) {
        // Wait for bot to initialize, then strip the expensive packet handlers
        bot.on('inject_allowed', () => {
            const heavyPackets = [
                'map_chunk', 'entity_velocity', 'entity_look', 'entity_move',
                'entity_move_look', 'entity_teleport', 'entity_head_look',
                'entity_metadata', 'entity_update_attributes', 'entity_equipment',
                'rel_entity_move', 'entity_destroy', 'spawn_entity',
                'spawn_entity_living', 'spawn_entity_painting',
                'spawn_entity_experience_orb', 'multi_block_change', 'block_change'
            ];

            heavyPackets.forEach(p => {
                bot._client.removeAllListeners(p);
            });
            console.log(`[${botId}] ULTRA LITE v2: Surgical removal of Chunks/Entities complete. 0% CPU AFK Mode Active.`);
        });
    }

    // LITE MODE - Disable Pathfinder to save massive CPU
    if (!config.liteMode && !config.ultraLiteMode) {
        bot.loadPlugin(pathfinder);
    }

    bots[botId] = bot;
    let hasJoinedOnce = false; // Debounce flag

    io.emit('bot-status', { id: botId, status: 'Connecting...' });

    // --- EVENTS ---

    // Inventory & Window Events (Skip in Lite Mode)
    if (!config.liteMode) {
        bot.on('windowOpen', (window) => {
            const inventoryStart = window.inventoryStart;
            io.emit('window-open', {
                bot: botId, title: window.title, slots: window.slots, inventoryStart
            });
        });
    }

    bot.on('login', () => {
        io.emit('bot-status', { id: botId, status: 'Logged In' });
        io.emit('log', { bot: botId, msg: 'Logged into server!' });
    });

    bot.on('spawn', () => {
        io.emit('bot-status', { id: botId, status: 'Online' });

        // REPLIT OPTIMIZATION: Always disable physics to save CPU
        bot.physicsEnabled = false;

        if (!hasJoinedOnce) {
            io.emit('log', { bot: botId, msg: 'Spawned! (Low Resource Mode)' });
            hasJoinedOnce = true;

            // Initial Commands (Only once per session)
            if (config.commands && config.commands.length > 0) {
                setTimeout(() => {
                    if (!bots[botId]) return;
                    config.commands.forEach((cmd, i) => {
                        setTimeout(() => {
                            if (!bots[botId]) return;
                            io.emit('log', { bot: botId, msg: `Exec Auto: ${cmd}` });
                            bot.chat(cmd);
                        }, i * 1500); // 1.5s gap
                    });
                }, 10000);
            }
        }

        // Anti-AFK (Configurable) - Only run if Config > 0
        if (!bot.afkInterval && config.afkInterval > 0) {
            bot.afkInterval = setInterval(() => {
                if (!bots[botId] || !bot.entity) return;

                // Temp Enable Physics for Jump
                bot.physicsEnabled = true;
                bot.setControlState('jump', true);

                setTimeout(() => {
                    if (bot.entity) {
                        bot.setControlState('jump', false);
                        bot.physicsEnabled = false; // Disable again
                    }
                }, 800); // Long jump press
            }, config.afkInterval);
        }

        // KEEP ALIVE HEARTBEAT (New)
        // Prevents "Read Timeout" by proving we are active
        if (!bot.heartbeat) {
            bot.heartbeat = setInterval(() => {
                if (bots[botId] && bot.entity) {
                    bot.swingArm();
                }
            }, 15000); // Swing every 15s
        }
    });

    bot.on('message', (jsonMsg) => {
        const message = jsonMsg.toString();
        // Only log essential chat to avoid spam
        if (message.length > 1) io.emit('log', { bot: botId, msg: message });

        // Auto-Login
        if (message.toLowerCase().includes('/register')) {
            bot.chat(`/register password123 password123`);
        } else if (message.toLowerCase().includes('/login')) {
            bot.chat(`/login password123`);
        }
    });

    bot.on('resourcePack', (url, hash) => {
        io.emit('log', { bot: botId, msg: `Resource Pack Request: ${url}` });
        if (config.resourcePack === 'accept') {
            bot.acceptResourcePack();
            io.emit('log', { bot: botId, msg: 'Accepted Resource Pack.' });
        } else {
            bot.denyResourcePack();
            io.emit('log', { bot: botId, msg: 'Denied Resource Pack.' });
        }
    });

    bot.on('kicked', (reason) => {
        // Parse JSON reason if possible
        let readableReason = reason;
        try {
            const json = JSON.parse(reason);
            if (json.text) readableReason = json.text;
            if (json.value && json.value.text) readableReason = json.value.text; // Bedrock/Complex
            if (json.extra) readableReason = json.extra.map(x => x.text).join(' ');
        } catch (e) { }

        io.emit('log', { bot: botId, msg: `Kicked: ${readableReason}` });
        io.emit('bot-status', { id: botId, status: 'Kicked' });
    });

    bot.on('end', (reason) => {
        if (bot.afkInterval) clearInterval(bot.afkInterval);
        if (bot.heartbeat) clearInterval(bot.heartbeat); // Clear Heartbeat
        io.emit('bot-status', { id: botId, status: 'Offline' });
        io.emit('log', { bot: botId, msg: `Disconnected: ${reason || 'Unknown'}` });

        delete bots[botId];

        // AUTO-RECONNECT
        if (config.reconnect) {
            // Cancel any existing timeout for this bot just in case
            if (reconnectTimeouts[botId]) clearTimeout(reconnectTimeouts[botId]);

            reconnectTimeouts[botId] = setTimeout(() => {
                delete reconnectTimeouts[botId]; // Remove from tracking
                io.emit('log', { bot: botId, msg: `Attempting Reconnect...` });
                createBot(botId, config);
            }, 8000); // 8s Retry delay
        } else {
            io.emit('log', { bot: botId, msg: `Auto-Reconnect disabled.` });
        }
    });

    bot.on('error', (err) => {
        // Suppress "ECONNRESET" spam
        if (err.message.includes('ECONNRESET')) return;
        io.emit('log', { bot: botId, msg: `Error: ${err.message}` });
    });
}

// UPTIME ROBOT ENDPOINT
app.get('/', (req, res) => {
    res.send('MineBot Manager is Running!');
});

app.get('/ping', (req, res) => {
    res.status(200).send('Pong!');
});


// SELF PINGER (Aggressive - 3s)
setInterval(() => {
    // Only ping if server is actually listening
    if (server.listening) {
        http.get(`http://localhost:${PORT}/ping`).on('error', (err) => { });
    }

    // BROADCAST BOT HEALTH METRICS
    const metrics = {};
    Object.keys(bots).forEach(id => {
        const b = bots[id];
        metrics[id] = {
            status: b.entity ? 'Online' : 'Offline',
            latency: b.player?.ping || 0,
            mode: b.ultraLiteMode ? 'ULTRA' : (b.liteMode ? 'LITE' : 'NORMAL')
        };
    });
    io.emit('health-update', metrics);
}, 3000); // 3 seconds (matched with self-pinger)

const PORT = 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

// --- GLOBAL ERROR HANDLING ---
// Prevent the entire server from crashing due to a single bot connection reset
process.on('uncaughtException', (err) => {
    if (err.message.includes('ECONNRESET') || err.message.includes('ECONNREFUSED')) {
        // This is just a network drop, ignore it.
        return;
    }
    console.error('Critical Error:', err);
});
