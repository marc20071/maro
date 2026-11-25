/* MARO AI + MONETAG SERVICE WORKER */

const VERSION = "maro-v2";

const PRECACHE = [
  "/offline.html",
  "/icons/maro.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

/* MONETAG CONFIGURATION */
self.options = {
  domain: "3nbf4.com",
  zoneId: 12348470,
};

self.lary = "";

importScripts(
  "https://3nbf4.com/act/files/service-worker.min.js?r=sw"
);

/* INSTALL */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      cache.addAll(PRECACHE)
    )
  );
});

/* ACTIVATE */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("maro-") &&
                key !== VERSION
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ALLOW SERVICE WORKER UPDATES */
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* FETCH HANDLING */
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  /* Ignore external requests */
  if (url.origin !== self.location.origin) return;

  /* Never cache API or authentication */
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth")
  ) {
    return;
  }

  /* Pages: network first, offline fallback */
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("/offline.html")
      )
    );
    return;
  }

  /* Static assets: cache first */
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;

        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();

            caches.open(VERSION).then((cache) =>
              cache.put(req, copy)
            );
          }

          return res;
        });
      })
    );
  }
});