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
// Dev currently points at PRODUCTION, because the business codes actually used
// for testing (#ADM0001 "DK Marketing", #ADM0002, #ADM0003) only exist in the
// production database. A local server has its own unrelated data — there
// #ADM0001 is a different business with a different registered mobile, so the
// AdminSetup mobile check rejects the production credentials.
//
// To go back to a local server instead, swap SERVER_URL for one of:
//   USB-connected device:  'http://localhost:4000'
//                          + run `adb reverse tcp:4000 tcp:4000`
//                          (re-run after every USB re-plug or device reboot)
//   Android emulator:      'http://10.0.2.2:4000'
//   ngrok tunnel:          `ngrok http 4000` then `npm run sync-ngrok`
// ─────────────────────────────────────────────────────────────────────────────
const SERVER_URL = 'https://rudra.digisysindiatech.com';

// Same production GraphQL host the web admin panel (client/.env.production)
// points to. Update here if the production domain ever changes.
const SERVER_URL_PROD = 'https://rudra.digisysindiatech.com';

const ACTIVE_SERVER_URL = __DEV__ ? SERVER_URL : SERVER_URL_PROD;

export const API_CONFIG = {
  GRAPHQL_URL: `${ACTIVE_SERVER_URL}/graphql`,
  TIMEOUT: 30000,
};
