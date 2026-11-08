// Offline cache for the shop: images seen once, and the site itself (OFFLINE.md, "Apps").
const CACHE = "clientweb-v1";
const SHELL = new URL("/", self.location.origin).href;
const MAX_IMAGES = 800;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("clientweb-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (key, res) => caches.open(CACHE).then((c) => c.put(key, res)).catch(() => {});

// Oldest images go first once the cache is full.
const trim = () =>
  caches.open(CACHE).then((c) =>
    c.keys().then((keys) => {
      const images = keys.filter((k) => k.destination === "image" || /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(k.url));
      return Promise.all(images.slice(0, Math.max(0, images.length - MAX_IMAGES)).map((k) => c.delete(k)));
    })
  );

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.pathname.includes("/graphql") || !url.protocol.startsWith("http")) return;

  // Image URLs never change their bytes (upload names are unique), so the saved copy is used first.
  if (req.destination === "image") {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok || res.type === "opaque") put(req, res.clone()).then(trim);
            return res;
          })
      )
    );
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Pages and the site's own files: network first, the saved copy when offline.
  const key = req.mode === "navigate" ? SHELL : req;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) put(key, res.clone());
        return res;
      })
      .catch(() => caches.match(key).then((hit) => hit || Response.error()))
  );
});
