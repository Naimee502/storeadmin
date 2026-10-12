import { useEffect, type RefObject } from "react";

/**
 * Make a horizontally scrollable row drift by itself while staying a normal
 * scroll container — mouse wheel / trackpad, drag on touch screens and the
 * scrollbar all keep working.
 *
 *  - Hover (mouse), touch or wheel pauses the drift; it picks up again from
 *    wherever the visitor left it, `resumeMs` after they let go.
 *  - loop: true  → the row's content is drawn twice; after one copy has
 *    scrolled out the position folds back by half the width (seamless).
 *  - loop: false → runs to the end, waits, glides back to the start.
 */
export function useAutoScrollX(
  ref: RefObject<HTMLElement | null>,
  { enabled, speed = 40, loop = false, resumeMs = 2000 }: { enabled: boolean; speed?: number; loop?: boolean; resumeMs?: number }
) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;

    let paused = false;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    let endHoldUntil = 0;
    let pos = el.scrollLeft;
    let last = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const max = el.scrollWidth - el.clientWidth;
      if (!paused && max > 2) {
        if (loop) {
          const half = el.scrollWidth / 2;
          pos += (speed * dt) / 1000;
          if (pos >= half) pos -= half;
          el.scrollLeft = pos;
        } else if (endHoldUntil) {
          if (now > endHoldUntil) {
            endHoldUntil = 0;
            pos = 0;
            el.scrollTo({ left: 0, behavior: "smooth" });
            paused = true; // let the glide finish
            resumeTimer = setTimeout(() => { paused = false; pos = el.scrollLeft; }, 1200);
          }
        } else {
          pos += (speed * dt) / 1000;
          if (pos >= max) {
            pos = max;
            endHoldUntil = now + 2500;
          }
          el.scrollLeft = pos;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    const pause = () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      paused = true;
    };
    const resumeLater = () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        pos = el.scrollLeft; // carry on from where the visitor left it
        if (loop) {
          const half = el.scrollWidth / 2;
          if (half > 0 && pos >= half) { pos -= half; el.scrollLeft = pos; }
        }
        endHoldUntil = 0;
        paused = false;
      }, resumeMs);
    };
    const onWheel = () => { pause(); resumeLater(); };

    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resumeLater);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", resumeLater);
    el.addEventListener("touchcancel", resumeLater);
    el.addEventListener("wheel", onWheel, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      if (resumeTimer) clearTimeout(resumeTimer);
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", resumeLater);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", resumeLater);
      el.removeEventListener("touchcancel", resumeLater);
      el.removeEventListener("wheel", onWheel);
    };
  }, [ref, enabled, speed, loop, resumeMs]);
}
