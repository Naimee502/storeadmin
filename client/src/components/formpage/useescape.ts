import { useEffect, useRef } from "react";
import { OVERLAY_SELECTOR, isOverlayOpen } from "./overlay";

/**
 * Esc = go back / cancel, for any desktop screen (forms, detail views).
 *
 * Listens in the capture phase, before any field sees the key — dropdowns
 * (react-select) mark every Esc as handled, which would otherwise swallow it
 * whenever a select has focus. Esc is left alone only when it has something
 * of its own to close: an open dropdown, a popup, or a box marked
 * `data-own-esc` (e.g. the menu search, which clears itself).
 */
export function useEscape(handler: () => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t?.getAttribute?.("aria-expanded") === "true") return;
      if (t?.closest?.("[data-own-esc]")) return;
      if (t?.closest?.(OVERLAY_SELECTOR) || isOverlayOpen()) return;
      e.preventDefault();
      ref.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);
}
