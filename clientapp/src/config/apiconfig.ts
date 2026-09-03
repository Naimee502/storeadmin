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
const SERVER_URL = 'http:/10.92.184.209:4000';

// Same production GraphQL host the web admin panel (client/.env.production)
// points to. Update here if the production domain ever changes.
const SERVER_URL_PROD = 'https://rudra.digisysindiatech.com';

const ACTIVE_SERVER_URL = __DEV__ ? SERVER_URL : SERVER_URL_PROD;

export const API_CONFIG = {
  GRAPHQL_URL: `${ACTIVE_SERVER_URL}/graphql`,
  TIMEOUT: 30000,
};

/**
 * Point an uploaded file's URL at the server this build actually talks to.
 *
 * uploadImage stores an absolute URL built from whichever host uploaded the
 * file, so a logo picked in the admin panel on a laptop is saved as
 * "http://localhost:4000/uploads/logo.jpg". That URL is correct in the browser
 * that made it and meaningless on a phone, where localhost is the phone —
 * right file, right path, wrong host. Nothing errors; the image is simply
 * blank, which is what "the logo doesn't show in the app" was.
 *
 * So the path is kept and the origin is swapped for ACTIVE_SERVER_URL, which
 * __DEV__ already resolves to the LAN address in a debug build and to the
 * production domain in any release build. A release build therefore never
 * asks a customer's phone for a developer's laptop, whatever host happened to
 * be stored.
 *
 * Only origins we know to be ours are rewritten: the two configured server
 * URLs, plus loopback and private LAN addresses, which is every shape a
 * dev/staging upload can take. Anything else — a CDN, an external image, a
 * data: URI — is left exactly as it is, because a URL we do not recognise is
 * one we have no business redirecting. A path that is already relative
 * ("/uploads/x.jpg") resolves too, so this keeps working if the server is ever
 * changed to store relative paths, which is the better long-term shape.
 */
const OURS = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/i;

const isOurOrigin = (origin: string) =>
  origin === SERVER_URL ||
  origin === SERVER_URL_PROD ||
  OURS.test(origin);

export const resolveMediaUrl = (url?: string | null): string => {
  const raw = String(url ?? '').trim();
  if (!raw) return '';

  const at = raw.indexOf('/uploads/');
  if (at === -1) return raw;

  // Already relative — just give it a host.
  if (at === 0) return `${ACTIVE_SERVER_URL}${raw}`;

  const origin = raw.slice(0, at);
  if (!isOurOrigin(origin)) return raw;

  return `${ACTIVE_SERVER_URL}${raw.slice(at)}`;
};
