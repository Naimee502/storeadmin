/**
 * Images for an import.
 *
 * Two routes, because they suit different users:
 *
 *   URLs   — an "Image URLs" column with comma-separated web addresses. Works
 *            in CSV too, needs no new infrastructure, and round-trips on
 *            export. Handled entirely by the parser; nothing to do here.
 *
 *   ZIP    — the user zips the workbook together with an images/ folder and
 *            names files in the "Image Files" column. That is what people
 *            actually have: a folder of photos off a phone or a camera.
 *
 * The ZIP route reuses the existing uploadImage GraphQL mutation, one call per
 * unique file, so no storage work was needed. Uploads run a few at a time with
 * progress reported — 200 images pushed one-by-one through a single endpoint
 * looks like a frozen browser, and all at once falls over.
 */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 150 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 4;

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
const SHEET_EXTENSIONS = /\.(xlsx|xlsm|csv)$/i;

export interface ZipContents {
  /** The workbook or CSV found inside the archive. */
  sheetFile: File;
  /** Lower-cased base file name → the image File. */
  images: Map<string, File>;
  warnings: string[];
}

export interface UploadProgress {
  done: number;
  total: number;
  currentName: string;
}

/** Pull the workbook and the images out of an uploaded .zip. */
export const readImportZip = async (zipFile: File): Promise<ZipContents> => {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(zipFile);

  const warnings: string[] = [];
  const images = new Map<string, File>();
  let sheetFile: File | null = null;
  let totalBytes = 0;

  const entries = Object.values(zip.files).filter((entry: any) => !entry.dir);

  for (const entry of entries as any[]) {
    const path: string = entry.name;
    const base = path.split("/").pop() || path;

    // Skip the junk macOS and Windows put in archives.
    if (base.startsWith(".") || path.includes("__MACOSX/")) continue;

    if (SHEET_EXTENSIONS.test(base)) {
      if (sheetFile) {
        warnings.push(`More than one spreadsheet in the zip — using "${sheetFile.name}" and ignoring "${base}".`);
        continue;
      }
      const blob: Blob = await entry.async("blob");
      sheetFile = new File([blob], base);
      continue;
    }

    if (IMAGE_EXTENSIONS.test(base)) {
      const blob: Blob = await entry.async("blob");

      if (blob.size > MAX_IMAGE_BYTES) {
        warnings.push(
          `"${base}" is ${(blob.size / 1024 / 1024).toFixed(1)} MB — over the 5 MB limit, so it was skipped.`
        );
        continue;
      }

      totalBytes += blob.size;
      if (totalBytes > MAX_TOTAL_BYTES) {
        warnings.push("The images in this zip add up to more than 150 MB. Split the import into smaller batches.");
        break;
      }

      images.set(base.toLowerCase(), new File([blob], base, { type: blob.type }));
    }
  }

  if (!sheetFile) {
    throw new Error("No .xlsx or .csv file found inside the zip. Add the filled-in template to the archive.");
  }

  return { sheetFile, images, warnings };
};

/**
 * Upload every referenced image once and return name → URL.
 *
 * Deduplicated on purpose: a catalogue where forty products share one brand
 * shot should upload it once, not forty times.
 */
export const uploadImportImages = async (
  referenced: Map<string, string[]>,
  images: Map<string, File>,
  uploadImage: (file: File) => Promise<string>,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ urls: Map<string, string>; missing: string[] }> => {
  const wanted = new Set<string>();
  for (const names of referenced.values()) {
    for (const name of names) wanted.add(name.trim().toLowerCase());
  }

  const missing: string[] = [];
  const queue: { key: string; file: File }[] = [];

  for (const key of wanted) {
    const file = images.get(key);
    if (file) queue.push({ key, file });
    else missing.push(key);
  }

  const urls = new Map<string, string>();
  let done = 0;

  // A small worker pool rather than Promise.all over the whole queue.
  const worker = async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) break;
      try {
        const url = await uploadImage(next.file);
        if (url) urls.set(next.key, url);
      } catch {
        missing.push(next.key);
      }
      done++;
      onProgress?.({ done, total: wanted.size, currentName: next.file.name });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(UPLOAD_CONCURRENCY, Math.max(queue.length, 1)) }, worker)
  );

  return { urls, missing };
};

/**
 * Write the uploaded URLs onto the parsed products, matching by ProductRef.
 * URLs already present in the "Image URLs" column are kept and the uploaded
 * ones appended, so both routes can be used in the same file.
 */
export const attachImageUrls = (
  products: any[],
  refs: string[],
  referenced: Map<string, string[]>,
  urls: Map<string, string>
): void => {
  products.forEach((product, index) => {
    const names = referenced.get(refs[index]);
    if (!names?.length) return;

    const uploaded = names
      .map((name) => urls.get(name.trim().toLowerCase()))
      .filter(Boolean) as string[];

    if (!uploaded.length) return;

    const existing: string[] = Array.isArray(product.imageurls) ? product.imageurls : [];
    const merged = Array.from(new Set([...existing, ...uploaded]));

    product.imageurls = merged;
    product.imageurl = merged[0] ?? "";
  });
};
