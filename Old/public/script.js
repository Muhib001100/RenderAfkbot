const socket = io();

// STATE
let botData = {
    'Global': { logs: [], status: 'Online' }
};
let activeTab = 'Global';

// Elements
const els = {
    host: document.getElementById('host'),
    version: document.getElementById('version'),
    baseName: document.getElementById('baseName'),
    count: document.getElementById('count'),
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),

    botList: document.getElementById('botList'),
    logContainer: document.getElementById('logContainer'),
    chatInput: document.getElementById('chatInput'),
    sendChatBtn: document.getElementById('sendChatBtn'),
    moveBtns: document.querySelectorAll('.move-btn')
};

// --- TABS & SIDEBAR UI ---

function switchTab(botId) {
    if (activeTab === botId) return;
    activeTab = botId;

    // Highlight Sidebar
    document.querySelectorAll('.bot-item').forEach(el => {
        el.classList.toggle('active', el.dataset.bot === botId);
    });

    renderLogs();
}

function renderLogs() {
    els.logContainer.innerHTML = '';
    const logs = botData[activeTab]?.logs || [];

    // Optimisation: Render last 100 logs
    const slice = logs.slice(-100);
    slice.forEach(entry => appendLogToDom(entry));

    els.logContainer.scrollTop = els.logContainer.scrollHeight;
}

function appendLogToDom(entry) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="log-bot">[${entry.source}]</span> <span class="log-text">${safeHtml(entry.msg)}</span>`;
    els.logContainer.appendChild(div);
}

function updateBotList() {
    // Keep "Global" at top
    els.botList.innerHTML = '';

    Object.keys(botData).forEach(botId => {
        const item = document.createElement('div');
        item.className = 'bot-item';
        if (activeTab === botId) item.classList.add('active');
        item.dataset.bot = botId;

        // Status Color
        let statusClass = 'status-offline';
        if (botData[botId].status === 'Online') statusClass = 'status-online';
        if (botData[botId].status === 'Connecting...') statusClass = 'status-connecting';

        item.innerHTML = `<span>${botId}</span> <div class="bot-status-dot ${statusClass}"></div>`;
        item.addEventListener('click', () => switchTab(botId));

        els.botList.appendChild(item);
    });
}

// --- CONFIG & START ---

// Config State
let savedBots = JSON.parse(localStorage.getItem('minebot_config')) || [
    { name: 'Bot_1', reconnect: true, commands: [] }
];

const configList = document.getElementById('configBotList');
const addBotBtn = document.getElementById('addBotBtn');
const cmdModal = document.getElementById('cmdModal');

// Render Config Rows
function renderConfig() {
    configList.innerHTML = '';
    savedBots.forEach((bot, index) => {
        const row = document.createElement('div');
        row.className = 'bot-config-card'; // New Class
        row.innerHTML = `
            <div class="bot-card-top">
                <input type="checkbox" class="select-bot-chk" ${bot.selected !== false ? 'checked' : ''} onchange="toggleSelect(${index}, this.checked)" title="Select to Start">
                <input type="text" class="bot-name-input" value="${bot.name}" onchange="updateName(${index}, this.value)" placeholder="Name">
            </div>
            <div class="bot-card-bottom">
                <label class="bot-opt-label">
                    <input type="checkbox" ${bot.reconnect ? 'checked' : ''} onchange="updateRec(${index}, this.checked)"> Auto-Rec
                </label>
                <div style="display:flex; gap:5px;">
                    <button class="btn-small" onclick="openCmds(${index})">CMD</button>
                    <button class="btn-small btn-del" onclick="removeBot(${index})">Remove</button>
                </div>
            </div>
        `;
        configList.appendChild(row);
    });
    saveConfig();
}

// Actions
window.updateName = (i, val) => { savedBots[i].name = val; saveConfig(); };
window.updateRec = (i, val) => { savedBots[i].reconnect = val; saveConfig(); };
window.toggleSelect = (i, val) => { savedBots[i].selected = val; saveConfig(); };
window.removeBot = (i) => { savedBots.splice(i, 1); renderConfig(); };

const nameModal = document.getElementById('nameModal');
const newBotNameInput = document.getElementById('newBotName');

addBotBtn.addEventListener('click', () => {
    newBotNameInput.value = `Bot_${savedBots.length + 1}`; // Default Suggestion
    nameModal.style.display = 'flex';
    newBotNameInput.focus();
});

window.closeNameModal = () => {
    nameModal.style.display = 'none';
};

window.confirmAddBot = () => {
    const name = newBotNameInput.value.trim();
    if (!name) return alert("Please enter a name!");

    // Check duplicate
    if (savedBots.find(b => b.name === name)) return alert("Name already exists!");

    savedBots.push({ name: name, reconnect: true, commands: [] });
    renderConfig();
    closeNameModal();
};

// Allow Enter key in modal
newBotNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') confirmAddBot();
});

function saveConfig() {
    localStorage.setItem('minebot_config', JSON.stringify(savedBots));
}

// Command Modal
let editingIndex = -1;
window.openCmds = (i) => {
    editingIndex = i;
    const cmds = savedBots[i].commands || [];
    document.getElementById('cmdInput').value = cmds.join('\n');
    cmdModal.style.display = 'block';
};
window.saveCmds = () => {
    if (editingIndex > -1) {
        const txt = document.getElementById('cmdInput').value;
        savedBots[editingIndex].commands = txt.split('\n').filter(l => l.trim().length > 0);
        saveConfig();
        cmdModal.style.display = 'none';
        addLog('System', `Saved commands for ${savedBots[editingIndex].name}`);
    }
};

// Start
els.startBtn.addEventListener('click', () => {
    const toStart = savedBots.filter(b => b.selected !== false);

    if (toStart.length === 0) return alert("Select at least one bot!");

    const data = {
        global: {
            host: els.host.value,
            port: 25565,
            version: els.version.value
        },
        bots: toStart
    };

    socket.emit('start-bots', data);
    addLog('System', `Starting ${toStart.length} bots...`);
});

// Init
renderConfig();

els.stopBtn.addEventListener('click', () => {
    socket.emit('stop-bots');
});

// --- LOGGING ---

socket.on('log', (data) => {
    addLog(data.bot, data.msg);
});

socket.on('bot-status', (data) => {
    // If new bot, init state
    if (!botData[data.id]) {
        botData[data.id] = { logs: [], status: data.status };
        updateBotList();
    } else {
        botData[data.id].status = data.status;
        // Update just the dot color (efficient) or full list
        updateBotList();
    }

    if (data.status === 'Offline' && data.id !== 'Global') {
        // Maybe keep history? For now, we keep it.
    }
});

function addLog(source, msg) {
    const entry = { source, msg };

    // Add to Global Log
    botData['Global'].logs.push(entry);

    // Add to Specific Bot Log
    if (botData[source]) {
        botData[source].logs.push(entry);
    }

    // If viewing this tab (or Global), append immediately
    if (activeTab === 'Global' || activeTab === source) {
        appendLogToDom(entry);
        els.logContainer.scrollTop = els.logContainer.scrollHeight;
    }
}

function safeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- CONTROLS ---

// Chat
function sendChat() {
    const text = els.chatInput.value.trim();
    if (!text) return;

    socket.emit('chat', {
        target: activeTab === 'Global' ? 'all' : activeTab,
        message: text
    });
    els.chatInput.value = '';
}
els.sendChatBtn.addEventListener('click', sendChat);
els.chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat();
});

// Movement (Mouse Down/Up) for smooth control
els.moveBtns.forEach(btn => {
    const action = btn.dataset.action;

    // Mouse
    btn.addEventListener('mousedown', () => emitControl(action, true));
    btn.addEventListener('mouseup', () => emitControl(action, false));
    btn.addEventListener('mouseleave', () => emitControl(action, false));

    // Touch
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); emitControl(action, true); });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); emitControl(action, false); });
});

function emitControl(action, state) {
    socket.emit('control', {
        target: activeTab === 'Global' ? 'all' : activeTab,
        action: action,
        state: state
    });
}

// --- INVENTORY MODAL LOGIC ---

const modal = document.getElementById('inventoryModal');
const invTitle = document.getElementById('invTitle');
const invGrid = document.getElementById('invGrid');
const closeInvBtn = document.getElementById('closeInv');

let currentInvBot = null;

socket.on('window-open', ({ bot, id, type, title, slots, inventoryStart }) => {
    currentInvBot = bot;
    invTitle.textContent = `${bot}: ${title}`;
    invGrid.innerHTML = '';

    // Split slots into Container (Top) and Player Inventory (Bottom)
    // inventoryStart usually marks the beginning of the player's main inventory (3 rows + hotbar)
    // If undefined, assume single container.

    const splitIndex = inventoryStart || slots.length;

    // --- CONTAINER (Top) ---
    const topContainer = document.createElement('div');
    topContainer.className = 'inv-section';
    topContainer.innerHTML = '<div class="inv-label">Container</div>';
    const topGrid = document.createElement('div');
    topGrid.className = 'inventory-grid';
    topContainer.appendChild(topGrid);

    // --- PLAYER (Bottom) ---
    const bottomContainer = document.createElement('div');
    bottomContainer.className = 'inv-section';
    bottomContainer.style.marginTop = '15px';
    bottomContainer.innerHTML = '<div class="inv-label">Player Inventory</div>';
    const bottomGrid = document.createElement('div');
    bottomGrid.className = 'inventory-grid';
    bottomContainer.appendChild(bottomGrid);

    slots.forEach((item, index) => {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'inv-slot';

        if (item) {
            // Colors
            if (item.name.includes('green_wool') || item.name.includes('lime')) {
                slotDiv.style.borderColor = '#00ff00';
                slotDiv.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
            }
            if (item.name.includes('red_wool')) {
                slotDiv.style.borderColor = '#ff0000';
                slotDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
            }

            slotDiv.title = `${item.displayName} x${item.count} (Slot ${item.slot})`;
            slotDiv.textContent = item.displayName.substring(0, 3);

            if (item.count > 1) {
                slotDiv.innerHTML += `<span class="inv-item-count">${item.count}</span>`;
            }

            // Click Handlers
            slotDiv.addEventListener('mousedown', (e) => {
                e.preventDefault();
                let clickType = 'left';
                if (e.button === 2) clickType = 'right';
                if (e.shiftKey) clickType = 'shift';

                socket.emit('click-window', { target: currentInvBot, slot: item.slot, type: clickType });
                slotDiv.style.opacity = '0.5';
                setTimeout(() => slotDiv.style.opacity = '1', 200);
            });
            slotDiv.addEventListener('contextmenu', e => e.preventDefault());
        }

        // Determine which grid to put it in
        if (index < splitIndex) {
            topGrid.appendChild(slotDiv);
        } else {
            bottomGrid.appendChild(slotDiv);
        }
    });

    invGrid.appendChild(topContainer);
    if (splitIndex < slots.length) invGrid.appendChild(bottomContainer);

    modal.style.display = 'flex';
});

socket.on('window-close', ({ bot }) => {
    // Only close if it matches the current bot
    if (currentInvBot === bot) {
        modal.style.display = 'none';
        currentInvBot = null;
    }
});

closeInvBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});

// Manual Re-Open (for disconnected users)
function showLastInventory() {
    if (currentInvBot) modal.style.display = 'flex';
}
