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

/**
 * The widths the server is willing to render, and the only ones worth asking
 * for. Anything else is snapped up to the next rung server-side, so asking for
 * an off-ladder size just means two screens never share a cached file.
 */
const WIDTH_LADDER = [96, 160, 240, 320, 400, 480, 640, 800, 1080, 1280, 1600];

/**
 * Named sizes, so no call site has to think in pixels.
 *
 * Each number is the widest that kind of image is ever drawn, taken up the
 * ladder far enough to stay sharp on a 3x screen. They are deliberately
 * nowhere near the size of the stored original: a product card is 170dp wide,
 * and the file behind it is routinely a 3 MB photo straight off a phone.
 * Downloading all of that to fill a thumbnail is what left the grids sitting
 * on grey placeholders.
 */
export const IMG = {
  /** Cart rows, order lines, list thumbnails, category circles (60-80dp). */
  thumb: 240,
  /** Brand logo, wherever it appears. */
  logo: 320,
  /** Product grid cards (~170dp, two columns). */
  card: 480,
  /** Full-bleed banners and hero slides. */
  banner: 1080,
  /** Product detail hero and the full-screen viewer. */
  full: 1280,
} as const;

export type ImageWidth = number;

export const resolveMediaUrl = (url?: string | null, width?: ImageWidth): string => {
  const raw = String(url ?? '').trim();
  if (!raw) return '';

  const at = raw.indexOf('/uploads/');
  if (at === -1) return raw;

  let resolved: string;

  // Already relative — just give it a host.
  if (at === 0) {
    resolved = `${ACTIVE_SERVER_URL}${raw}`;
  } else {
    const origin = raw.slice(0, at);
    if (!isOurOrigin(origin)) return raw;
    resolved = `${ACTIVE_SERVER_URL}${raw.slice(at)}`;
  }

  return width ? withWidth(resolved, width) : resolved;
};

/**
 * Ask our own server for a resized copy of a file it is already storing.
 *
 * The server answers "?w=480" with a WebP re-encode of the same upload —
 * roughly 25 KB where the original is megabytes — generated once and then
 * cached on disk. Nothing has to be re-uploaded for this to work on images
 * that are already there, and a URL without "?w=" still returns the original,
 * so nothing that predates this changes behaviour.
 *
 * Only URLs pointing at our own server get the parameter. A CDN or an external
 * image would either ignore it or, worse, treat it as part of a cache key we
 * do not control.
 */
const withWidth = (resolved: string, width: number): string => {
  if (resolved.includes('?w=') || resolved.includes('&w=')) return resolved;
  const snapped = WIDTH_LADDER.find(w => w >= width) ?? WIDTH_LADDER[WIDTH_LADDER.length - 1];
  return `${resolved}${resolved.includes('?') ? '&' : '?'}w=${snapped}`;
};
