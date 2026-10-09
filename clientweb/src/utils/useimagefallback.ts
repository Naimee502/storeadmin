import { useCallback, useState } from "react";

/**
 * A stored image URL is not proof the picture exists — the file can be gone
 * from /uploads, or sit on a host that never answers. Waiting for an `error`
 * event is not enough: a request that hangs never fires one, and the card
 * stays a blank white box (what the Shop page showed for Atta / Dove Shampoo).
 *
 * So the placeholder is the DEFAULT, and the photo replaces it only once it
 * has actually loaded:
 *   "loading" → placeholder visible, <img> mounted but invisible
 *   "loaded"  → photo visible
 *   "error"   → placeholder, <img> removed
 *
 * Keyed on the URL, so a new URL starts over instead of inheriting the last
 * one's state. The ref also catches an image the browser already finished
 * (from cache) before React attached its listeners.
 */
export function useImageFallback(url?: string | null) {
  const [state, setState] = useState<{ url: string; status: "loaded" | "error" } | null>(null);
  const status: "none" | "loading" | "loaded" | "error" = !url
    ? "none"
    : state?.url === url
      ? state.status
      : "loading";

  const onLoad = useCallback(() => url && setState({ url, status: "loaded" }), [url]);
  const onError = useCallback(() => url && setState({ url, status: "error" }), [url]);
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !url || !img.complete) return;
      if (img.naturalWidth > 0) setState((s) => (s?.url === url ? s : { url, status: "loaded" }));
      else setState((s) => (s?.url === url ? s : { url, status: "error" }));
    },
    [url]
  );

  return {
    status,
    /** Photo is on screen — hide the placeholder. */
    showImage: status === "loaded",
    /** Keep the <img> mounted while loading (invisible) and once loaded. */
    mountImage: status === "loading" || status === "loaded",
    imgProps: { ref, onLoad, onError },
  };
}
