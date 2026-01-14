const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Store active bots: { [id]: botInstance }
const bots = {};

io.on('connection', (socket) => {
    console.log('Web Client Connected');

    // --- START BOTS ---
    socket.on('start-bots', (data) => {
        // data CAN be the old config OR the new array format.
        // New Format: { global: {host, port, version}, bots: [ {name, reconnect, commands: [] } ] }

        const { host, port, version } = data.global;

        console.log(`Starting ${data.bots.length} bots on ${host}...`);

        data.bots.forEach((botConfig, index) => {
            // Delay each join slightly
            setTimeout(() => {
                const fullConfig = {
                    host, port, version: version === 'auto' ? false : version,
                    username: botConfig.name,
                    reconnect: botConfig.reconnect,
                    commands: botConfig.commands || []
                };

                if (bots[botConfig.name]) return; // Already running

                createBot(botConfig.name, fullConfig);

            }, index * 2000);
        });
    });

    // --- STOP BOTS ---
    socket.on('stop-bots', () => {
        Object.values(bots).forEach(bot => {
            bot.removeAllListeners('end'); // Prevent auto-reconnect logic
            bot.quit();
        });
        io.emit('status', { msg: 'All bots stopped.' });
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
        // action: 'forward', 'back', 'left', 'right', 'jump', 'sprint'
        // state: true (down) / false (up)

        const applyControl = (bot) => {
            try {
                if (action === 'click') {
                    if (state) bot.activateItem(); // Example for right click/use
                    // For left click attack, we usually need a target entity. 
                    // Simple swingArm for visual:
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
    const bot = mineflayer.createBot({
        host: config.host,
        port: config.port,
        username: config.username,
        version: config.version === 'auto' ? false : config.version,
        auth: 'offline', // Cracked server support
        checkTimeoutInterval: 60000 // Fix disconnects
    });

    bot.loadPlugin(pathfinder);
    bots[botId] = bot;

    io.emit('bot-status', { id: botId, status: 'Connecting...' });

    // --- WINDOW / INVENTORY HANDLING ---
    bot.on('windowOpen', (window) => {
        const items = window.slots.map((item, index) => {
            if (!item) return null;
            return {
                slot: index,
                name: item.name,
                displayName: item.displayName || item.name,
                count: item.count
            };
        });

        // Fix for "title is already object" crash
        let titleStr = 'Inventory';
        try {
            if (typeof window.title === 'string') {
                const parsed = JSON.parse(window.title);
                titleStr = parsed.text || window.title;
            } else if (typeof window.title === 'object') {
                // It's already parsed
                titleStr = window.title.text || titleStr;
            }
        } catch (e) {
            titleStr = window.title || 'Inventory';
        }

        io.emit('window-open', {
            bot: botId,
            id: window.id,
            type: window.type,
            title: titleStr,
            slots: items,
            inventoryStart: window.inventoryStart
        });

        io.emit('log', { bot: botId, msg: `[GUI] Opened: ${titleStr}` });
    });

    bot.on('windowClose', (window) => {
        io.emit('window-close', { bot: botId });
        io.emit('log', { bot: botId, msg: `[GUI] Closed.` });
    });

    // --- EVENTS ---

    bot.once('spawn', () => {
        io.emit('bot-status', { id: botId, status: 'Online' });
        io.emit('log', { bot: botId, msg: 'Spawned! (Stabilizing...)' });

        // Stability: Disable physics for 2s to prevent packet spam on join
        bot.physicsEnabled = false;
        setTimeout(() => {
            if (bot) {
                bot.physicsEnabled = true;
                io.emit('log', { bot: botId, msg: 'Ready.' });

                // AUTO COMMANDS
                if (config.commands && config.commands.length > 0) {
                    io.emit('log', { bot: botId, msg: `Scheduling ${config.commands.length} auto-commands in 10s...` });
                    setTimeout(() => {
                        if (!bots[botId]) return;
                        config.commands.forEach((cmd, i) => {
                            setTimeout(() => {
                                if (!bots[botId]) return;
                                io.emit('log', { bot: botId, msg: `Exec Auto: ${cmd}` });
                                bot.chat(cmd);
                            }, i * 1000); // 1 sec delay between each command
                        });
                    }, 10000); // 10s wait as requested
                }
            }
        }, 2000);
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
        io.emit('bot-status', { id: botId, status: 'Offline' });
        io.emit('log', { bot: botId, msg: `Disconnected: ${reason || 'Unknown'}` });

        delete bots[botId];

        // AUTO-RECONNECT
        if (config.reconnect) {
            setTimeout(() => {
                io.emit('log', { bot: botId, msg: `Attempting Reconnect...` });
                createBot(botId, config);
            }, 5000); // 5s Retry delay
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

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
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
