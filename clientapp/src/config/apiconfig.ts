// ─────────────────────────────────────────────────────────────────────────────
// SERVER URL — debug vs release, no manual switching (applies to EVERY flavor:
// rudraerp, rkn, powergold — they all share this file):
//
//   Debug   (npm run android:<flavor>, Metro)  → SERVER_URL      (LOCAL)
//   Release (assemble*/bundle* Release, APK/AAB) → SERVER_URL_PROD (LIVE)
//
// React Native's `__DEV__` is true in debug and false in any release build.
//
// Local on a USB phone / emulator: `npm run android:<flavor>` already runs
// `adb reverse tcp:4000 tcp:4000`, so 'http://localhost:4000' reaches the Mac.
// (Emulator without adb reverse: 'http://10.0.2.2:4000'.
//  ngrok: `ngrok http 4000` then `npm run sync-ngrok` rewrites SERVER_URL.)
// ─────────────────────────────────────────────────────────────────────────────
const SERVER_URL = 'http://localhost:4000';

// Same production GraphQL host the web admin panel (client/src/config/apiconfig.ts)
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
  /**
   * Every picture OF A PRODUCT, whatever size it is drawn at.
   *
   * A width is part of the URL, and a URL is the cache key — so a 32dp order
   * line asking for `thumb` was not reusing the catalogue's copy of the same
   * photo, it was starting a second download of it. That is why a product
   * looked instant in the grid and then crawled on the order detail screen.
   *
   * While nginx serves /uploads itself the "?w=" is dropped anyway (see
   * server/deploy/nginx-uploads.conf), so that second request is the whole
   * multi-megabyte original again — the smaller number bought nothing and cost
   * the entire download. Sharing one width makes every screen after the first
   * a disk-cache hit; once the resize is actually deployed the difference
   * between a 240 and a 480 render is a few kilobytes, which is a price worth
   * paying once for a picture that is then free everywhere else.
   *
   * Category circles, brand tiles and logos are NOT products — they keep their
   * own sizes, because they are never drawn large anywhere.
   */
  product: 480,
  /** Full-bleed banners and hero slides. */
  banner: 1080,
  /** Product detail hero and the full-screen viewer. */
  full: 1280,
} as const;

export type ImageWidth = number;

/**
 * Percent-encode a path so a filename with a space or a bracket survives.
 *
 * Uploads keep the name they were uploaded under, and "images (35).jpg" is a
 * real one in this store — seven of the first nine products have a space in
 * theirs. A literal space makes the URL invalid. Android's image loader is
 * lenient enough to cope; iOS builds an NSURL, gets nil, and the picture
 * simply never appears, with nothing in the log to say why.
 *
 * Each segment is encoded on its own so the separators stay separators, and a
 * path that already carries an escape is left alone — encoding "%20" a second
 * time gives "%2520" and breaks a URL that was working.
 */
const encodePath = (path: string): string =>
  /%[0-9a-f]{2}/i.test(path)
    ? path
    : path.split('/').map(encodeURIComponent).join('/');

export const resolveMediaUrl = (url?: string | null, width?: ImageWidth): string => {
  const raw = String(url ?? '').trim();
  if (!raw) return '';

  const at = raw.indexOf('/uploads/');
  if (at === -1) return raw;

  let resolved: string;

  // Already relative — just give it a host.
  if (at === 0) {
    resolved = `${ACTIVE_SERVER_URL}${encodePath(raw)}`;
  } else {
    const origin = raw.slice(0, at);
    if (!isOurOrigin(origin)) return raw;
    resolved = `${ACTIVE_SERVER_URL}${encodePath(raw.slice(at))}`;
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
