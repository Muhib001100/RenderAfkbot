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
    afkInterval: document.getElementById('afkInterval'), // New
    viewDistance: document.getElementById('viewDistance'), // New
    liteMode: document.getElementById('liteMode'), // New
    ultraLiteMode: document.getElementById('ultraLiteMode'), // New
    proxy: document.getElementById('proxy'), // New
    replitUrl: document.getElementById('replitUrl'), // New
    ghostConnectBtn: document.getElementById('ghostConnectBtn'), // New
    ghostStatus: document.getElementById('ghostStatus'), // New
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    botList: document.getElementById('botList'),
    logContainer: document.getElementById('logContainer'),
    chatInput: document.getElementById('chatInput'),
    sendChatBtn: document.getElementById('sendChatBtn'),
    moveBtns: document.querySelectorAll('.move-btn'),
    activeBotName: document.getElementById('activeBotName'),
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    healthMonitor: document.getElementById('healthMonitor')
};

// --- MOBILE UI ---
if (els.sidebarToggle) {
    els.sidebarToggle.addEventListener('click', () => {
        els.sidebar.classList.toggle('open');
        els.sidebarToggle.textContent = els.sidebar.classList.contains('open') ? '✕' : '☰';
    });
}

// --- TABS & SIDEBAR UI ---
function switchTab(botId) {
    if (activeTab === botId) return;
    activeTab = botId;
    els.activeBotName.textContent = botId === 'Global' ? 'Global Dashboard' : botId;

    // Highlight Sidebar
    document.querySelectorAll('.bot-item').forEach(el => {
        el.classList.toggle('active', el.dataset.bot === botId);
    });

    if (window.innerWidth <= 1024) {
        els.sidebar.classList.remove('open');
        els.sidebarToggle.textContent = '☰';
    }

    renderLogs();
}

function renderLogs() {
    els.logContainer.innerHTML = '';
    const logs = botData[activeTab]?.logs || [];
    const slice = logs.slice(-150);
    slice.forEach(entry => appendLogToDom(entry));
    els.logContainer.scrollTop = els.logContainer.scrollHeight;
}

function appendLogToDom(entry) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="log-bot">${entry.source}</span><span class="log-text">${safeHtml(entry.msg)}</span>`;
    els.logContainer.appendChild(div);
}

function updateBotList() {
    els.botList.innerHTML = '';
    Object.keys(botData).forEach(botId => {
        const item = document.createElement('div');
        item.className = 'bot-item';
        if (activeTab === botId) item.classList.add('active');
        item.dataset.bot = botId;

        let statusClass = 'status-offline';
        if (botData[botId].status === 'Online') statusClass = 'status-online';
        if (botData[botId].status === 'Connecting...') statusClass = 'status-connecting';

        item.innerHTML = `<span>${botId}</span> <div class="bot-status-dot ${statusClass}"></div>`;
        item.addEventListener('click', () => switchTab(botId));
        els.botList.appendChild(item);
    });
}

// --- CONFIG & PERSISTENCE ---
let savedBots = JSON.parse(localStorage.getItem('minebot_config')) || [
    { name: 'Bot_1', reconnect: true, selected: true, commands: [] }
];

function renderConfig() {
    const configList = document.getElementById('configBotList');
    configList.innerHTML = '';
    savedBots.forEach((bot, index) => {
        const card = document.createElement('div');
        card.className = 'bot-config-card';
        card.innerHTML = `
                <div class="bot-card-top">
                    <input type="checkbox" class="select-bot-chk" ${bot.selected !== false ? 'checked' : ''} onchange="toggleSelect(${index}, this.checked)">
                    <input type="text" class="bot-name-input" value="${bot.name}" onchange="updateName(${index}, this.value)">
                </div>
                <div class="bot-card-bottom">
                    <label class="bot-opt-label">
                        <input type="checkbox" ${bot.reconnect ? 'checked' : ''} onchange="updateRec(${index}, this.checked)"> Reconnect
                    </label>
                    <div style="display:flex; gap:6px;">
                        <button class="btn-small" onclick="openCmds(${index})">CMD</button>
                        <button class="btn-small" onclick="removeBot(${index})" style="color:var(--error)">DEL</button>
                    </div>
                </div>
            `;
        configList.appendChild(card);
    });
    saveConfig();
}

window.updateName = (i, val) => { savedBots[i].name = val; saveConfig(); };
window.updateRec = (i, val) => { savedBots[i].reconnect = val; saveConfig(); };
window.toggleSelect = (i, val) => { savedBots[i].selected = val; saveConfig(); };
window.removeBot = (i) => { savedBots.splice(i, 1); renderConfig(); };

window.confirmAddBot = () => {
    const input = document.getElementById('newBotName');
    const name = input.value.trim();
    if (!name) return;
    if (savedBots.find(b => b.name === name)) return alert("Name taken!");
    savedBots.push({ name: name, reconnect: true, selected: true, commands: [] });
    renderConfig();
    closeNameModal();
};

window.closeNameModal = () => document.getElementById('nameModal').style.display = 'none';

document.getElementById('addBotBtn').onclick = () => {
    document.getElementById('newBotName').value = `Bot_${savedBots.length + 1}`;
    document.getElementById('nameModal').style.display = 'flex';
};

function saveConfig() { localStorage.setItem('minebot_config', JSON.stringify(savedBots)); }

// --- LOGGING SYSTEM ---
const MAX_LOGS = 200;
let logHistory = JSON.parse(localStorage.getItem('bot_logs')) || [];

function loadLogs() {
    els.logContainer.innerHTML = '';
    logHistory.forEach(l => {
        const p = document.createElement('p');
        p.className = `log-line ${l.type.toLowerCase()}`;
        p.innerHTML = `<span class="log-time">[${l.time}]</span> <strong>${l.bot}:</strong> ${l.msg}`;
        els.logContainer.appendChild(p);
    });
    els.logContainer.scrollTop = els.logContainer.scrollHeight;
}

function addLog(botName, msg, type = 'Info') {
    const time = new Date().toLocaleTimeString();
    const logData = { time, bot: botName, msg, type };

    // UI Update
    const p = document.createElement('p');
    p.className = `log-line ${type.toLowerCase()}`;
    p.innerHTML = `<span class="log-time">[${time}]</span> <strong>${botName}:</strong> ${msg}`;
    els.logContainer.appendChild(p);

    // Persistence
    logHistory.push(logData);
    if (logHistory.length > MAX_LOGS) logHistory.shift(); // Keep last 200
    localStorage.setItem('bot_logs', JSON.stringify(logHistory));

    if (els.logContainer) els.logContainer.scrollTop = els.logContainer.scrollHeight;
}

// Initial Load
loadLogs();

// --- SOCKET EVENTS ---
els.startBtn.onclick = () => {
    // Clear Logs on Start (User Request)
    localStorage.removeItem('bot_logs');
    logHistory = [];
    els.logContainer.innerHTML = '';

    const toStart = savedBots.filter(b => b.selected !== false);
    if (toStart.length === 0) return alert("Select a bot!");

    // Button Locking
    els.startBtn.disabled = true;
    els.stopBtn.disabled = false;
    els.startBtn.textContent = "Running...";

    socket.emit('start-bots', {
        global: {
            host: els.host.value,
            port: 25565,
            version: els.version.value,
            afkInterval: els.afkInterval.value, // Pass Config
            viewDistance: els.viewDistance.value || 'tiny',
            liteMode: els.liteMode.checked, // Pass Flag
            ultraLiteMode: els.ultraLiteMode.checked, // Pass Flag
            proxy: els.proxy.value.trim() // Pass Proxy
        },
        bots: toStart
    });
};

socket.on('status', (data) => {
    addLog('System', data.msg);
    if (data.msg.includes('stopped')) {
        els.startBtn.disabled = false;
        els.stopBtn.disabled = true;
        els.startBtn.textContent = "Start Selected";
    }
});

els.ghostConnectBtn.onclick = () => {
    const url = els.replitUrl.value.trim();
    if (!url) return alert("Please enter a Replit URL");
    socket.emit('ghost-connect', url);
    els.ghostStatus.textContent = "Status: Connecting...";
};

socket.on('ghost-status', (data) => {
    els.ghostStatus.textContent = `Status: ${data.msg}`;
    if (data.msg === 'CONNECTED') {
        els.ghostStatus.style.color = '#00ff00';
    } else {
        els.ghostStatus.style.color = '#ff0000';
    }
});

socket.on('health-update', (metrics) => {
    const keys = Object.keys(metrics);
    if (keys.length === 0) {
        els.healthMonitor.innerHTML = '<div style="color:var(--text-muted); font-size:12px; grid-column:1/-1; text-align:center; padding:20px;">No Active Bots Tracking...</div>';
        return;
    }
    els.healthMonitor.innerHTML = '';
    keys.forEach(id => {
        const m = metrics[id];
        const card = document.createElement('div');
        card.className = `health-card ${m.status.toLowerCase()}`;
        card.innerHTML = `
            <div class="bot-name">
                ${id}
                <span class="mode-badge">${m.mode}</span>
            </div>
            <div class="metric">
                <span>Status</span>
                <span>${m.status}</span>
            </div>
            <div class="metric">
                <span>Latency</span>
                <span>${m.latency}ms</span>
            </div>
        `;
        els.healthMonitor.appendChild(card);
    });
});

els.stopBtn.onclick = () => {
    els.stopBtn.disabled = true; // Prevent double click
    socket.emit('stop-bots');
};

socket.on('log', (data) => addLog(data.bot, data.msg));

socket.on('bot-status', (data) => {
    if (!botData[data.id]) botData[data.id] = { logs: [], status: data.status };
    else botData[data.id].status = data.status;
    updateBotList();
});

socket.on('bot-status-all', (data) => {
    Object.keys(botData).forEach(id => {
        if (id !== 'Global') botData[id].status = data.status;
    });
    updateBotList();
});

function addLog(source, msg) {
    const entry = { source, msg };
    botData['Global'].logs.push(entry);
    if (botData[source]) botData[source].logs.push(entry);
    if (activeTab === 'Global' || activeTab === source) {
        appendLogToDom(entry);
        els.logContainer.scrollTop = els.logContainer.scrollHeight;
    }
}

function safeHtml(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// --- CONTROLS ---
function sendChat() {
    console.log("Sending chat...");
    const text = els.chatInput.value.trim();
    if (!text) return;
    socket.emit('chat', { target: activeTab === 'Global' ? 'all' : activeTab, message: text });
    els.chatInput.value = '';
    els.chatInput.focus();
}
els.sendChatBtn.onclick = sendChat;
els.chatInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendChat();
    }
};

// Ensure input is always enabled
setInterval(() => {
    if (els.chatInput.disabled) els.chatInput.disabled = false;
    if (els.chatInput.readOnly) els.chatInput.readOnly = false;
}, 1000);

let sneakActive = false;
const sneakBtn = document.getElementById('sneakBtn');

if (sneakBtn) {
    sneakBtn.onclick = () => {
        sneakActive = !sneakActive;
        sneakBtn.classList.toggle('active', sneakActive);
        emitControl('sneak', sneakActive);
    };
}

els.moveBtns.forEach(btn => {
    const action = btn.dataset.action;
    if (action === 'sneak') return; // Handled separately for toggle
    btn.onmousedown = () => emitControl(action, true);
    btn.onmouseup = () => emitControl(action, false);
    btn.onmouseleave = () => emitControl(action, false);
    btn.ontouchstart = (e) => { e.preventDefault(); emitControl(action, true); };
    btn.ontouchend = (e) => { e.preventDefault(); emitControl(action, false); };
});

function emitControl(action, state) {
    socket.emit('control', { target: activeTab === 'Global' ? 'all' : activeTab, action, state });
}

// --- INVENTORY ---
const invModal = document.getElementById('inventoryModal');
let currentInvBot = null;

socket.on('window-open', ({ bot, title, slots, inventoryStart }) => {
    currentInvBot = bot;
    document.getElementById('invTitle').textContent = `${bot}: ${title}`;
    const grid = document.getElementById('invGrid');
    grid.innerHTML = '';

    const createSection = (label, startIndex, endIndex) => {
        const sec = document.createElement('div');
        sec.innerHTML = `<div style="color:white;font-size:12px;margin-bottom:4px">${label}</div>`;
        const sGrid = document.createElement('div');
        sGrid.className = 'inventory-grid';
        for (let i = startIndex; i < endIndex; i++) {
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            const item = slots[i];
            if (item) {
                slot.title = `${item.displayName} x${item.count}`;
                slot.textContent = item.displayName.substring(0, 3);
                if (item.count > 1) slot.innerHTML += `<span class="inv-item-count">${item.count}</span>`;
                slot.onmousedown = (e) => {
                    e.preventDefault();
                    let type = e.button === 2 ? 'right' : (e.shiftKey ? 'shift' : 'left');
                    socket.emit('click-window', { target: currentInvBot, slot: i, type });
                };
            }
            sGrid.appendChild(slot);
        }
        sec.appendChild(sGrid);
        return sec;
    };

    const split = inventoryStart || slots.length;
    grid.appendChild(createSection('Container', 0, split));
    if (split < slots.length) grid.appendChild(createSection('Inventory', split, slots.length));
    invModal.style.display = 'flex';
});

document.getElementById('closeInv').onclick = () => invModal.style.display = 'none';
window.showLastInventory = () => currentInvBot && (invModal.style.display = 'flex');

// Command Modal
let editingIndex = -1;
window.openCmds = (i) => {
    editingIndex = i;
    const cmds = savedBots[i].commands || [];
    document.getElementById('cmdInput').value = cmds.join('\n');
    document.getElementById('cmdModal').style.display = 'flex';
};

window.saveCmds = () => {
    if (editingIndex > -1) {
        const txt = document.getElementById('cmdInput').value;
        savedBots[editingIndex].commands = txt.split('\n').filter(l => l.trim().length > 0);
        saveConfig();
        document.getElementById('cmdModal').style.display = 'none';
        addLog('System', `Saved commands for ${savedBots[editingIndex].name}`);
    }
};

renderConfig();
updateBotList();
