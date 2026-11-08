// Shrink an image before upload (proxy caps bodies); returns the original on any failure.

/** Files below this are already small enough that re-encoding gains nothing. */
const SKIP_BELOW_BYTES = 200 * 1024;

// Max sizes per kind (largest display size × 3); logos stay PNG to avoid JPEG ringing.
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
  /** Keep PNG even without transparency (line art like logos). */
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
    // Sample one alpha byte per pixel step to stay fast on large images.
    for (let i = 3; i < data.length; i += 4 * 16) {
      if (data[i] < 255) return true;
    }
    return false;
  } catch {
    // Tainted canvas can't be read; assume transparency.
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

    // Keep whichever is smaller; flat PNGs can grow as JPEG.
    if (blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + (keepAlpha ? ".png" : ".jpg");
    return new File([blob], name, { type, lastModified: Date.now() });
  } catch {
    return file;
  }
};
