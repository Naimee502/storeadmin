/**
 * Render every upload at the sizes the apps actually ask for, up front.
 *
 * The resizer in utils/imagecache generates a size the first time someone
 * requests it. That is correct, but it means the FIRST customer to open a
 * screen pays for it — and paying means waiting while sharp decodes a five
 * megabyte phone photo, for every picture on that screen at once. On a
 * catalogue that has never been warmed, a product grid can sit on grey boxes
 * for a minute while the server chews through it, which looks exactly like the
 * images being broken.
 *
 * Run this once after deploying (and again after a bulk product import) and no
 * customer ever waits for an encode: every request is a cache hit from the
 * first one onwards.
 *
 *   cd server && npm run warm-images
 *
 * It is safe to re-run — anything already rendered and still newer than its
 * source is skipped, so a second run over an unchanged folder does nothing but
 * stat files.
 */
import path from 'path';
import fs from 'fs';
import { render, RESIZABLE, cacheRoot } from '../utils/imagecache';

/** Only the widths the app and the website actually request. */
const WANTED = [96, 240, 320, 480, 1080, 1280];
const QUALITY = 78;

const uploadsDir = path.join(__dirname, '../uploads');

const main = async () => {
  let files: string[];
  try {
    files = (await fs.promises.readdir(uploadsDir)).filter(f => RESIZABLE.test(f));
  } catch (e) {
    console.error(`Cannot read ${uploadsDir}:`, e);
    process.exit(1);
  }

  console.log(`${files.length} image(s) in ${uploadsDir}`);
  console.log(`Rendering widths: ${WANTED.join(', ')}\n`);

  let made = 0, skipped = 0, failed = 0;

  for (const name of files) {
    const src = path.join(uploadsDir, name);
    let srcStat: fs.Stats;
    try {
      srcStat = await fs.promises.stat(src);
      if (!srcStat.isFile()) continue;
    } catch {
      continue;
    }

    for (const width of WANTED) {
      const outDir = path.join(cacheRoot(uploadsDir), `${width}q${QUALITY}`);
      const out = path.join(outDir, `${name}.webp`);

      try {
        const cached = await fs.promises.stat(out);
        if (cached.mtimeMs >= srcStat.mtimeMs) { skipped++; continue; }
      } catch {
        /* not rendered yet */
      }

      try {
        const buf = await render(src, out, outDir, width, QUALITY);
        made++;
        console.log(
          `  ${name} @${width} -> ${(buf.length / 1024).toFixed(1)} KB` +
          `  (from ${(srcStat.size / 1024 / 1024).toFixed(2)} MB)`,
        );
      } catch (e: any) {
        failed++;
        console.warn(`  ! ${name} @${width}: ${e?.message ?? e}`);
      }
    }
  }

  console.log(`\nDone. ${made} rendered, ${skipped} already current, ${failed} failed.`);
};

main().catch(e => { console.error(e); process.exit(1); });
