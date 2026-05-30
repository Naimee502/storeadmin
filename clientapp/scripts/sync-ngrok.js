/**
 * Reads the active ngrok tunnel URL from ngrok's local API
 * and patches src/config/apiconfig.ts with the new HTTPS URL.
 *
 * Usage:
 *   1. Start your server:  node server/index.js  (port 4000)
 *   2. Start ngrok:        ngrok http 4000
 *   3. Run this script:    npm run sync-ngrok   (inside clientapp/)
 *   4. Reload the app (press R in Metro terminal or shake device → Reload)
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const NGROK_API  = 'http://127.0.0.1:4040/api/tunnels';
const CONFIG_PATH = path.join(__dirname, '../src/config/apiconfig.ts');

http.get(NGROK_API, (res) => {
  let body = '';
  res.on('data', chunk => { body += chunk; });
  res.on('end', () => {
    let tunnels;
    try {
      tunnels = JSON.parse(body).tunnels;
    } catch {
      console.error('❌  Could not parse ngrok response. Is ngrok running?');
      process.exit(1);
    }

    const tunnel = tunnels.find(t => t.proto === 'https');
    if (!tunnel) {
      console.error('❌  No HTTPS tunnel found. Run: ngrok http 4000');
      process.exit(1);
    }

    const ngrokUrl = tunnel.public_url; // e.g. https://abc123.ngrok-free.app

    let content = fs.readFileSync(CONFIG_PATH, 'utf8');

    // Replace the SERVER_URL line
    const updated = content.replace(
      /const SERVER_URL\s*=\s*['"][^'"]*['"]/,
      `const SERVER_URL = '${ngrokUrl}'`
    );

    if (updated === content) {
      console.error('❌  Could not find SERVER_URL in apiconfig.ts — pattern mismatch.');
      process.exit(1);
    }

    fs.writeFileSync(CONFIG_PATH, updated, 'utf8');
    console.log(`✅  API URL updated to: ${ngrokUrl}`);
    console.log('    Press R in the Metro terminal (or shake device → Reload) to apply.');
  });
}).on('error', (err) => {
  console.error('❌  Cannot reach ngrok API at', NGROK_API);
  console.error('    Make sure ngrok is running:  ngrok http 4000');
  console.error('   ', err.message);
  process.exit(1);
});
