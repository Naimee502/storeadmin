import { useEffect, useRef } from "react";
import { OVERLAY_SELECTOR, isOverlayOpen } from "./overlay";

// Esc = cancel; capture phase so react-select can't swallow it. Skipped when something else should close.
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
