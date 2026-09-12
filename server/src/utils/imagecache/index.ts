import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';

/**
 * Serve an uploaded image at the size the caller actually needs.
 *
 * uploadImage stores whatever file was handed to it, untouched — routinely a
 * 2-5 MB photo straight off a phone or a designer's export. Every one of those
 * megabytes used to be downloaded in full to fill a 170dp product card, which
 * is why the app's grids sat on grey placeholders: six or eight multi-megabyte
 * downloads racing each other over a mobile connection, none of them finishing.
 * Opening one product and coming back "fixed" it only because that single
 * image had finally landed in the cache.
 *
 * So the fix has to work on the images that are ALREADY uploaded — nothing may
 * need re-uploading. This middleware sits in front of express.static and
 * answers `/uploads/<file>?w=480` with a WebP re-encode of that same file at
 * that width, generated once and then kept on disk. A 3 MB JPEG becomes a
 * ~25 KB WebP, which is the entire difference between "loads eventually" and
 * "is simply there".
 *
 * Requests with no `?w=` fall straight through to express.static, so every URL
 * already stored in the database, every old build of the app and the admin
 * panel keep working exactly as before.
 *
 * If sharp is not installed (or cannot decode a particular file) the request
 * also falls through to the original. Missing the optimisation is acceptable;
 * failing to serve the image is not.
 */

let sharp: any = null;
try {
  // Required lazily so a deploy that has not run `npm install` yet degrades to
  // serving originals instead of refusing to boot.
  sharp = require('sharp');
  // Two workers per request keeps a burst of thumbnail generation from
  // starving the GraphQL event loop on a small VPS.
  sharp.concurrency(2);
  sharp.cache({ files: 0 });
} catch {
  sharp = null;
}

/**
 * Widths are snapped to this ladder rather than honoured verbatim.
 *
 * An arbitrary `?w=` is a free way for anyone to fill the disk with thousands
 * of one-pixel-apart variants, and it also means two screens asking for 399
 * and 401 never share a cached file. A fixed ladder caps the cache at
 * (files x 11) and makes a hit the normal case.
 */
const WIDTHS = [96, 160, 240, 320, 400, 480, 640, 800, 1080, 1280, 1600];

/** Formats sharp can usefully re-encode. SVG and GIF are passed through. */
const RESIZABLE = /\.(jpe?g|png|webp|avif|tiff?|heic|heif)$/i;

const snapWidth = (n: number): number =>
  WIDTHS.find(w => w >= n) ?? WIDTHS[WIDTHS.length - 1];

const clampQuality = (n: number): number =>
  Number.isFinite(n) ? Math.min(90, Math.max(40, Math.round(n))) : 78;

/** Cached renders live under uploads/.cache — a dotfile, so express.static's
 *  default `dotfiles: 'ignore'` will never serve this folder directly. */
export const cacheRoot = (uploadsDir: string) => path.join(uploadsDir, '.cache');

/**
 * Requests for the same missing variant are collapsed into one sharp run.
 * Without this, a grid of 50 cards that all mount at once can start 50
 * identical encodes of the same shared image.
 */
const inFlight = new Map<string, Promise<Buffer>>();

const firstParam = (v: unknown): string =>
  Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '');

export const imageResizer = (uploadsDir: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (!sharp) return next();

    const wRaw = firstParam(req.query.w);
    if (!wRaw) return next();

    const requested = Number(wRaw);
    if (!Number.isFinite(requested) || requested <= 0) return next();
    const width = snapWidth(requested);
    const quality = clampQuality(Number(firstParam(req.query.q)) || 78);

    // req.path is relative to the mount point, e.g. "/1712345-photo.jpg".
    let name: string;
    try {
      name = decodeURIComponent(req.path.replace(/^\/+/, ''));
    } catch {
      return next();
    }
    // Uploads are a flat folder. Anything with a separator in it is either a
    // traversal attempt or not ours; either way, not something to resize.
    if (!name || name.includes('/') || name.includes('\\')) return next();
    if (!RESIZABLE.test(name)) return next();

    const dir = path.resolve(uploadsDir);
    const src = path.resolve(dir, name);
    if (!src.startsWith(dir + path.sep)) return next();

    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(src);
    } catch {
      return next();
    }
    if (!stat.isFile()) return next();

    const outDir = path.join(cacheRoot(uploadsDir), `${width}q${quality}`);
    const out = path.join(outDir, `${name}.webp`);

    // A cached render older than the source means the file was replaced under
    // the same name. Unlikely (names carry Date.now()), cheap to be right about.
    try {
      const cached = await fs.promises.stat(out);
      if (cached.mtimeMs >= stat.mtimeMs) return sendFile(res, out);
    } catch {
      /* not rendered yet */
    }

    const key = out;
    let job = inFlight.get(key);
    if (!job) {
      job = render(src, out, outDir, width, quality).finally(() => {
        inFlight.delete(key);
      });
      inFlight.set(key, job);
    }

    try {
      const buf = await job;
      setImageHeaders(res);
      res.type('image/webp');
      res.setHeader('Content-Length', String(buf.length));
      if (req.method === 'HEAD') return res.end();
      return res.end(buf);
    } catch {
      // Un-decodable file, out of disk, anything at all: hand it to
      // express.static and let the caller have the original.
      return next();
    }
  };

const render = async (
  src: string,
  out: string,
  outDir: string,
  width: number,
  quality: number,
): Promise<Buffer> => {
  const buf: Buffer = await sharp(src, { failOn: 'none' })
    // Phone photos carry their orientation in EXIF; resizing without this
    // silently turns portrait shots on their side.
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer();

  // Written via a temp file + rename so a crash mid-encode can never leave a
  // truncated image behind to be served forever afterwards.
  try {
    await fs.promises.mkdir(outDir, { recursive: true });
    const tmp = `${out}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.writeFile(tmp, buf);
    await fs.promises.rename(tmp, out);
  } catch {
    // Caching is an optimisation. If the disk says no, still serve the bytes.
  }

  return buf;
};

const setImageHeaders = (res: Response) => {
  // Every URL this answers is content-addressed in practice: upload names carry
  // Date.now(), and the width/quality are in the query. The bytes behind a
  // given URL therefore never change, so a client that has them never needs to
  // ask again — no revalidation round trip on app launch, which is the other
  // half of "the images are just there".
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
};

const sendFile = (res: Response, file: string) =>
  new Promise<void>((resolve) => {
    setImageHeaders(res);
    res.sendFile(file, { immutable: true, maxAge: '365d' }, () => resolve());
  });

/**
 * Drop every cached render of a file that has just been deleted.
 *
 * deleteImages removes the original; without this its thumbnails would sit in
 * .cache forever, since nothing else ever looks at them again.
 */
export const purgeImageCache = async (uploadsDir: string, name: string) => {
  if (!name || name.includes('/') || name.includes('\\')) return;
  const root = cacheRoot(uploadsDir);
  let buckets: string[] = [];
  try {
    buckets = await fs.promises.readdir(root);
  } catch {
    return;
  }
  await Promise.all(
    buckets.map(b =>
      fs.promises.unlink(path.join(root, b, `${name}.webp`)).catch(() => {}),
    ),
  );
};
