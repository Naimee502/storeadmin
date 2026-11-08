// True while a visible popup is open, so page shortcuts stand down.
export const OVERLAY_SELECTOR = '[role="dialog"], [aria-modal="true"], .fixed.inset-0';

export const isOverlayOpen = (): boolean => {
  if (typeof document === "undefined") return false;
  return Array.from(document.querySelectorAll<HTMLElement>(OVERLAY_SELECTOR)).some((el) => {
    const cs = window.getComputedStyle(el);
    return (
      cs.display !== "none" &&
      cs.visibility !== "hidden" &&
      cs.pointerEvents !== "none" &&
      parseFloat(cs.opacity || "1") > 0.05
    );
  });
};
