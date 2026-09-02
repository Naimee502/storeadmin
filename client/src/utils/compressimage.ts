/**
 * Shrink an image in the browser before it is uploaded.
 *
 * Why this exists: a logo or product photo taken straight off a phone or a
 * designer's export is routinely two to eight megabytes. Nothing in this app
 * ever displays one larger than a few hundred pixels, so every one of those
 * megabytes is paid for twice — once by the person waiting on the upload, and
 * again by every customer whose phone downloads it on the storefront.
 *
 * It also removes a whole class of failure. A reverse proxy in front of the API
 * caps request bodies (nginx defaults to 1 MB), and a file over that limit is
 * refused with a bare 413 before it ever reaches the server, where no amount of
 * application code can catch it or explain it. Sending something small means
 * never being at the mercy of that number.
 *
 * The image is drawn to a canvas at a bounded size and re-encoded. Transparency
 * decides the format: a PNG with an alpha channel stays a PNG, because putting
 * a transparent logo through JPEG paints the transparent parts black. Anything
 * else becomes a JPEG, which is far smaller for photographs.
 *
 * If anything at all goes wrong — an unreadable file, a canvas the browser
 * refuses to export, a format it cannot decode — the original file is returned
 * untouched. Failing to compress must never mean failing to upload.
 */

/** Files below this are already small enough that re-encoding gains nothing. */
const SKIP_BELOW_BYTES = 200 * 1024;

/**
 * One size does not fit every image, and getting this wrong shows.
 *
 * The numbers come from the largest place each kind is actually drawn,
 * multiplied by 3 for a phone's pixel density — not from a round number that
 * sounded safe:
 *
 *   logo    — 64px at its biggest (the website login), so 640 is ten times the
 *             headroom it needs. The important part is not the size but the
 *             format: a logo is line art, and JPEG puts visible ringing around
 *             the edges of letters at any quality. A PNG logo therefore stays a
 *             PNG whether or not it has transparency, and a JPEG one is
 *             re-encoded at 0.95 where the artefacts are not perceptible.
 *
 *   banner  — the website hero spans about 850 CSS pixels inside max-w-7xl, so
 *             1700 physical on a retina screen. This is the one place 1200
 *             would genuinely have looked soft.
 *
 *   product — the app's full-screen image viewer is roughly 400dp wide, 1200
 *             physical on a 3x phone. 1400 leaves room to pinch-zoom a little.
 */
export type ImagePurpose = 'logo' | 'banner' | 'product';

const PRESETS: Record<ImagePurpose, { maxDimension: number; quality: number; keepPng: boolean }> = {
  logo:    { maxDimension: 640,  quality: 0.95, keepPng: true },
  banner:  { maxDimension: 1920, quality: 0.86, keepPng: false },
  product: { maxDimension: 1400, quality: 0.86, keepPng: false },
};

export interface CompressOptions {
  /** Longest edge, in pixels. */
  maxDimension?: number;
  /** JPEG quality, 0–1. Ignored for PNG output. */
  quality?: number;
  /**
   * Keep a PNG as a PNG even with no transparency. For line art — logos — where
   * JPEG's ringing around sharp edges is the visible failure, not file size.
   */
  keepPng?: boolean;
}

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode this image."));
    };
    img.src = url;
  });

/** True when any pixel is not fully opaque. */
const hasTransparency = (canvas: HTMLCanvasElement): boolean => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  try {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Every fourth byte is alpha. Stepping by whole pixels rather than reading
    // each one keeps this quick on a large image; a logo's transparency is
    // never a single stray pixel.
    for (let i = 3; i < data.length; i += 4 * 16) {
      if (data[i] < 255) return true;
    }
    return false;
  } catch {
    // A canvas tainted by a cross-origin source cannot be read. Assume
    // transparency: keeping a PNG is the safe way to be wrong.
    return true;
  }
};

/** Settings for a kind of image, so callers name the purpose, not the numbers. */
export const presetFor = (purpose: ImagePurpose): CompressOptions => PRESETS[purpose];

export const compressImage = async (
  file: File,
  { maxDimension = 1400, quality = 0.86, keepPng = false }: CompressOptions = {},
): Promise<File> => {
  if (!file.type.startsWith("image/")) return file;
  // An SVG is already tiny and vector; rasterising it would make it worse.
  if (file.type === "image/svg+xml") return file;
  if (file.size <= SKIP_BELOW_BYTES) return file;

  try {
    const img = await loadImage(file);

    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const isPng = file.type === "image/png";
    const keepAlpha = isPng && (keepPng || hasTransparency(canvas));
    const type = keepAlpha ? "image/png" : "image/jpeg";

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, type, keepAlpha ? undefined : quality),
    );
    if (!blob) return file;

    // Re-encoding does not always win — a small PNG of flat colour can come out
    // larger as a JPEG. Keep whichever is actually smaller.
    if (blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + (keepAlpha ? ".png" : ".jpg");
    return new File([blob], name, { type, lastModified: Date.now() });
  } catch {
    return file;
  }
};
