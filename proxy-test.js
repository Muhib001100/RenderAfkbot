const { SocksProxyAgent } = require('socks-proxy-agent');
const http = require('http');
const net = require('net');

const proxyStr = process.argv[2]; // Run as: node proxy-test.js "user:pass@ip:port"

if (!proxyStr) {
    console.log('Usage: node proxy-test.js "user:pass@ip:port"');
    process.exit(1);
}

const proxyUrl = proxyStr.startsWith('socks5://') ? proxyStr : `socks5://${proxyStr}`;
console.log(`\n🔍 PROXY DEBUGGER`);
console.log(`----------------`);
console.log(`Target Proxy: ${proxyStr.includes('@') ? '***@' + proxyStr.split('@')[1] : proxyStr}`);
console.log(`URL Format:   ${proxyUrl.includes('@') ? 'socks5://***@' + proxyUrl.split('@')[1] : proxyUrl}`);

const agent = new SocksProxyAgent(proxyUrl);

// Test 1: Simple HTTP (Connectivity)
console.log(`\n[Test 1] Stage 1: Testing Internet Access (google.com)...`);
const start = Date.now();

const req = http.get('http://www.google.com', { agent, timeout: 5000 }, (res) => {
    console.log(`✅ [Test 1] SUCCESS! Proxy can reach Google (${Date.now() - start}ms)`);
    res.resume();

    // Proceed to Test 2
    testMCServer();
});

req.on('error', (err) => {
    console.error(`❌ [Test 1] FAILED: ${err.message}`);
    if (err.message.includes('Authentication failed')) {
        console.error(`⚠️  ADVICE: Username or Password is WRONG.`);
    } else {
        console.error(`⚠️  ADVICE: Proxy server is unreachable.`);
    }
});

function testMCServer() {
    console.log(`\n[Test 2] Stage 2: Testing Minecraft Server (play.dgnetwork.in)...`);
    const start2 = Date.now();

    const socket_test = net.connect({
        host: 'play.dgnetwork.in',
        port: 25565,
        agent: agent,
        timeout: 8000
    });

    socket_test.on('connect', () => {
        console.log(`✅ [Test 2] SUCCESS! Reached Minecraft Server via Proxy (${Date.now() - start2}ms)`);
        socket_test.destroy();
        console.log(`\n🎉 SUMMARY: Your proxy is 100% compatible with this server!`);
    });

    socket_test.on('error', (err) => {
        console.error(`❌ [Test 2] FAILED: ${err.message}`);
        console.error(`⚠️  ADVICE: Proxy works for internet, but THIS Minecraft server has banned this Proxy IP.`);
        socket_test.destroy();
    });

    socket_test.on('timeout', () => {
        console.error(`❌ [Test 2] TIMEOUT: Minecraft server did not respond.`);
        socket_test.destroy();
    });
}
