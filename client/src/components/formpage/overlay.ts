/**
 * Is a popup (modal, drawer, "Add customer" box, full-screen loader…) showing?
 *
 * Page-level shortcuts — Esc = Cancel, Ctrl/⌘+S = Save, list arrow keys — must
 * stand down while one is open, or Esc on a popup would also leave the form.
 * Some popups stay mounted and are only faded out (opacity-0 +
 * pointer-events-none), so being in the DOM is not enough: it must be visible.
 */
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
