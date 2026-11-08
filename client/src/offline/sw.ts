// Registers or removes the offline service worker for the admin app.
const SW_FILE = "sw.js";
const CACHE_PREFIX = "storeadmin-shell-";

function scopeUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}

function sendLoadedAssets(sw: ServiceWorker | null | undefined) {
  if (!sw) return;
  try {
    const urls = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .filter((u) => u.startsWith(scopeUrl() + "assets/"));
    if (urls.length) sw.postMessage({ type: "cache-urls", urls });
  } catch {
    // Assets get cached on their next load instead.
  }
}

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  const go = () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}${SW_FILE}`, { scope: import.meta.env.BASE_URL })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => sendLoadedAssets(reg.active))
      .catch(() => {});
  };
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
}

// Removes this app's worker and its caches; does nothing if none exist.
export function unregisterServiceWorker(): void {
  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          for (const r of regs) {
            const script = r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || "";
            if (r.scope === scopeUrl() && script.endsWith(`/${SW_FILE}`)) void r.unregister();
          }
        })
        .catch(() => {});
    }
    if (typeof caches !== "undefined") {
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX)).map((k) => caches.delete(k))))
        .catch(() => {});
    }
  } catch {
    // Not supported in this browser.
  }
}
