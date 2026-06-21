// ─────────────────────────────────────────────────────────────────────────────
// SERVER URL — auto-updated by:  npm run sync-ngrok  (inside clientapp/)
//
// Workflow for physical device:
//   1. Start server:   cd server && node dist/index.js   (port 4000)
//   2. Start ngrok:    ngrok http 4000
//   3. Sync URL:       npm run sync-ngrok   (clientapp/)
//   4. Reload app:     press R in Metro terminal
//
// For Android emulator (no ngrok needed):
//   const SERVER_URL = 'http://10.0.2.2:4000'
// ─────────────────────────────────────────────────────────────────────────────
const SERVER_URL = 'http://192.168.29.228:4000';

export const API_CONFIG = {
  GRAPHQL_URL: `${SERVER_URL}/graphql`,
  TIMEOUT: 30000,
};
