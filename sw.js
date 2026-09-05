const CACHE = "qr-city-quest-v3";

const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css?v=3",
  "./app.js?v=3",
  "./data/game-data.js?v=3",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const request = event.request;
  const url = new URL(request.url);

  // Pages:
  // Try to get the newest version first.
  // If offline, use the cached page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE).then(cache => {
            cache.put("./index.html", copy);
          });

          return response;
        })
        .catch(() =>
          caches.match("./index.html").then(hit =>
            hit || caches.match("./")
          )
        )
    );

    return;
  }

  // Our own JS, CSS and game files:
  // Prefer the newest network version.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();

            caches.open(CACHE).then(cache => {
              cache.put(request, copy);
            });
          }

          return response;
        })
        .catch(() =>
          caches.match(request).then(hit =>
            hit ||
            caches.match(request, {
              ignoreSearch: true
            })
          )
        )
    );

    return;
  }

  // Third-party files such as ZXing.
  event.respondWith(
    caches.match(request).then(hit => {
      if (hit) return hit;

      return fetch(request).then(response => {
        const copy = response.clone();

        caches.open(CACHE).then(cache => {
          cache.put(request, copy);
        });

        return response;
      });
    })
  );
});
