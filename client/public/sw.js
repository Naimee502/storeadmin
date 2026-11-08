// Offline service worker for the admin app; registered only when offline mode is on.
const VERSION = "v1";
const CACHE = "storeadmin-shell-" + VERSION;
const SCOPE = self.registration.scope;
const SHELL = SCOPE;
const ASSETS = SCOPE + "assets/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        fetch(SHELL, { cache: "no-store" }).then((res) => {
          if (!res.ok) return;
          return res
            .clone()
            .text()
            .then((html) => {
              const urls = Array.from(html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g), (m) => new URL(m[1], SCOPE).href);
              return cache.put(SHELL, res).then(() => Promise.all(urls.map((u) => cache.add(u).catch(() => {}))));
            });
        })
      )
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("storeadmin-shell-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page sends asset URLs it loaded before this worker took control.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "cache-urls" || !Array.isArray(data.urls)) return;
  const urls = data.urls.filter((u) => typeof u === "string" && u.startsWith(ASSETS));
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(urls.map((u) => cache.match(u).then((hit) => hit || cache.add(u).catch(() => {}))))
    )
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!req.url.startsWith(SCOPE)) return;
  if (url.pathname.includes("/graphql")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(SHELL, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(SHELL).then((hit) => hit || Response.error()))
    );
    return;
  }

  if (req.url.startsWith(ASSETS)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
            }
            return res;
          })
      )
    );
  }
});
