import { GraphQLUpload } from 'graphql-upload';
import { finished } from 'stream/promises';
import path from 'path';
import fs from 'fs';
import { requireBackofficeTenant } from '../../../utils/tenant';
import { ProductService } from '../../../models/products';
import { Category } from '../../../models/categories';
import { SubCategory } from '../../../models/subcategories';
import { AdminSettings } from '../../../models/adminsettings';
import { purgeImageCache } from '../../../utils/imagecache';
import { PUBLIC_BASE_URL } from '../../../config/serverconfig';

/** Where uploadImage writes, and what express serves at /uploads. */
const uploadDir = () => path.join(__dirname, '../../../uploads');

/**
 * Turn a stored image URL back into the file it names on this server.
 *
 * Only the segment after the last "/uploads/" is used, and the resolved path
 * is checked to sit inside the uploads folder — so a crafted url ending in
 * "/uploads/../../config/.env" resolves to null instead of deleting something
 * it should not. A url pointing at some other host or a CDN also returns null:
 * not our file, not ours to delete.
 */
const localUploadPath = (rawUrl: string): string | null => {
  const withoutQuery = String(rawUrl || '').split(/[?#]/)[0];
  const marker = '/uploads/';
  const at = withoutQuery.lastIndexOf(marker);
  if (at === -1) return null;

  const raw = withoutQuery.slice(at + marker.length);
  if (!raw) return null;

  let name = raw;
  try {
    name = decodeURIComponent(raw);
  } catch {
    // A malformed escape means we cannot be sure what file is meant. Skip it.
    return null;
  }
  if (!name || name.includes('/') || name.includes('\\')) return null;

  const dir = path.resolve(uploadDir());
  const full = path.resolve(dir, name);
  return full.startsWith(dir + path.sep) ? full : null;
};

/**
 * Is this file still pointed at by a record?
 *
 * The forms only ask for deletion after a save has succeeded, so the record
 * being edited has already let go of the url. But the same file can be shared
 * — a category image reused on a product, a product photo pointed at by a home
 * page banner slide, two products given one photo by an import — and deleting
 * it would leave the other one showing a broken thumbnail. Cheaper to check
 * than to explain afterwards.
 *
 * Every place an uploaded image can be stored belongs in this list. Miss one
 * and this quietly deletes files that page is still displaying.
 */
const stillInUse = async (url: string): Promise<boolean> => {
  const [product, category, subcategory, settings] = await Promise.all([
    ProductService.exists({ $or: [{ imageurl: url }, { imageurls: url }] }),
    Category.exists({ image: url }),
    SubCategory.exists({ image: url }),
    AdminSettings.exists({
      $or: [
        { "heroBannerSlides.image": url },
        { "promoBanners.image": url },
        { brandLogo: url },
      ],
    }),
  ]);
  return Boolean(product || category || subcategory || settings);
};

export const uploadResolvers = {
  Upload: GraphQLUpload,

  Mutation: {
    uploadImage: async (_parent: any, { file }: { file: any }, context: any) => {
      console.log("📥 UploadImage resolver hit!");
      const { createReadStream, filename, mimetype, encoding } = await file;

      // Correct path from resolver file to uploads folder
      const uploadDir = path.join(__dirname, '../../../uploads');

      // Make sure upload dir exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Create unique filename to avoid overwrites
      const uniqueFilename = `${Date.now()}-${filename}`;
      console.log('Saving file:', uniqueFilename);
      const filepath = path.join(uploadDir, uniqueFilename);

      // Save file to disk
      const stream = createReadStream();
      const out = fs.createWriteStream(filepath);
      stream.pipe(out);
      await finished(out); // wait for the file to be fully written

      // Public URL for the file: dev → http://localhost:4000,
      // production → https://rudra.digisysindiatech.com (src/config/serverconfig.ts).
      const base = PUBLIC_BASE_URL;

      return {
        filename: uniqueFilename,
        mimetype,
        encoding,
        url: `${base}/uploads/${uniqueFilename}`,
      };
    },

    /**
     * Delete uploads that nothing references any more.
     *
     * Every image the app has ever uploaded stayed on disk forever: removing a
     * product photo, or replacing a category image, only changed the database
     * row. The file underneath was never touched, so the uploads folder grew
     * with files no page could ever show again.
     *
     * The caller passes the urls it has just stopped using, once its own save
     * has succeeded. Each one is re-checked here before its file goes: a url
     * we did not serve, one another record still points at, or one whose file
     * is already gone is skipped. None of those are failures — the caller
     * wanted the file not lying around, and in all three cases it isn't.
     */
    deleteImages: async (_parent: any, { urls }: { urls: string[] }, context: any) => {
      // Signed in, and a back-office user — an image url is guessable, and
      // this is a delete.
      await requireBackofficeTenant(context);

      let removed = 0;

      for (const url of Array.from(new Set(urls || []))) {
        const filepath = localUploadPath(url);
        if (!filepath) continue;
        if (await stillInUse(url)) continue;

        try {
          await fs.promises.unlink(filepath);
          // The resized renders this file produced are now orphans — nothing
          // will ever request them again, so they would sit in .cache forever.
          await purgeImageCache(uploadDir(), path.basename(filepath));
          removed++;
        } catch (err: any) {
          // ENOENT: already gone, which is the state we were asked for.
          if (err?.code !== 'ENOENT') {
            console.error('Could not delete upload:', filepath, err);
          }
        }
      }

      return removed;
    },
  },
};
