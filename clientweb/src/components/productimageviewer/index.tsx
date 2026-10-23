import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import { useImageFallback } from "../../utils/useimagefallback";

/** Every photo of a product: imageurls[] if there are several, else imageurl. */
export const productImages = (p: any): string[] => {
  const list: string[] = Array.isArray(p?.imageurls) ? p.imageurls.filter(Boolean) : [];
  if (list.length) return list;
  return p?.imageurl ? [p.imageurl] : [];
};

type Props = {
  open: boolean;
  images: string[];
  title?: string;
  onClose: () => void;
};

/**
 * One photo with the "no image" icon as the default; the photo replaces it only
 * once it has actually loaded, so a missing file never shows as a blank box.
 */
function Photo({ url, iconSize, fit }: { url: string; iconSize: string; fit: "contain" | "cover" }) {
  const image = useImageFallback(url);
  return (
    <>
      {!image.showImage && <ImageOff className={`${iconSize} text-slate-500`} strokeWidth={1.75} />}
      {image.mountImage && (
        <img
          src={url}
          alt=""
          {...image.imgProps}
          className={`absolute inset-0 h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"} ${image.showImage ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </>
  );
}

/**
 * Product photo viewer — website twin of the app's ProductImageViewer: white
 * card, title + round close button, big photo with an "n / total" pill,
 * thumbnail strip underneath. ‹ › / arrow keys / swipe to move; Esc, the close
 * button or the backdrop to close.
 */
export default function ProductImageViewer({ open, images, title, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => { if (open) setIdx(0); }, [open, images]);

  const last = images.length - 1;
  const go = (i: number) => setIdx(Math.max(0, Math.min(last, i)));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => Math.min(last, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, last, onClose]);

  if (!open || images.length === 0) return null;
  const current = Math.min(idx, last);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="truncate text-lg font-semibold text-ink-900">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-slate-50"
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
            touchX.current = null;
          }}
        >
          <Photo key={images[current]} url={images[current]} iconSize="h-14 w-14" fit="contain" />

          {current > 0 && (
            <button
              onClick={() => go(current - 1)}
              className="absolute left-2 rounded-full bg-white/90 p-1.5 text-slate-700 shadow hover:bg-white"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {current < last && (
            <button
              onClick={() => go(current + 1)}
              className="absolute right-2 rounded-full bg-white/90 p-1.5 text-slate-700 shadow hover:bg-white"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
          {images.length > 1 && (
            <span className="absolute bottom-3 right-3 rounded-full bg-slate-600/80 px-3 py-1 text-sm font-medium text-white">
              {current + 1} / {images.length}
            </span>
          )}
        </div>

        {images.length > 1 && (
          <div className="mt-4 flex justify-center gap-3 overflow-x-auto pb-1">
            {images.map((u, i) => (
              <button
                key={`${u}-${i}`}
                onClick={() => go(i)}
                className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 bg-slate-50 ${
                  i === current ? "border-brand-700" : "border-slate-200 hover:border-brand-300"
                }`}
                aria-label={`Photo ${i + 1}`}
              >
                <Photo url={u} iconSize="h-5 w-5" fit="cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
