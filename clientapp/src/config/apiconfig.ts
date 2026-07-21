// ─────────────────────────────────────────────────────────────────────────────
// SERVER URL
//
// Dev builds (Metro/debug) call SERVER_URL below — auto-updated by:
//   npm run sync-ngrok  (inside clientapp/)
// Release builds (signed APK/AAB, TestFlight/App Store, etc.) automatically
// call SERVER_URL_PROD instead — React Native's built-in `__DEV__` flag is
// false in any release build, so this switch needs no manual step. Without
// this, a release build would ship calling a dev machine's LAN IP, which is
// unreachable for real users.
//
// Workflow for physical device (dev):
//   1. Start server:   cd server && node dist/index.js   (port 4000)
//   2. Start ngrok:    ngrok http 4000
//   3. Sync URL:       npm run sync-ngrok   (clientapp/)
//   4. Reload app:     press R in Metro terminal
//
// For Android emulator (no ngrok needed):
//   const SERVER_URL = 'http://10.0.2.2:4000'
// ─────────────────────────────────────────────────────────────────────────────
const SERVER_URL = 'http://192.168.29.228:4000';

// Same production GraphQL host the web admin panel (client/.env.production)
// points to. Update here if the production domain ever changes.
const SERVER_URL_PROD = 'https://rudra.digisysindiatech.com';

const ACTIVE_SERVER_URL = __DEV__ ? SERVER_URL : SERVER_URL_PROD;

export const API_CONFIG = {
  GRAPHQL_URL: `${ACTIVE_SERVER_URL}/graphql`,
  TIMEOUT: 30000,
};
