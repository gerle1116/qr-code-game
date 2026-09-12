const CACHE = "qr-city-quest-v8";

const PRECACHE = [
  "./",
  "./index.html",

  "./styles.css?v=6",

  "./language-loader.js?v=6",
  "./app.js?v=6",

  "./data/apptext_en.js?v=6",
  "./data/apptext_hu.js?v=6",

  "./data/game-data_en.js?v=6",
  "./data/game-data_hu.js?v=6",

  "./manifest.webmanifest",

  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});


self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
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
  if (event.request.method !== "GET") {
    return;
  }

  const request = event.request;
  const url = new URL(request.url);


  // =========================================================
  // HTML / PAGE NAVIGATION
  // Network first, cache fallback
  // =========================================================

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();

            caches.open(CACHE).then(cache => {
              cache.put("./index.html", copy);
            });
          }

          return response;
        })
        .catch(() =>
          caches
            .match("./index.html")
            .then(hit =>
              hit || caches.match("./")
            )
        )
    );

    return;
  }


  // =========================================================
  // OUR OWN FILES
  // Network first, cache fallback
  // =========================================================

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (
            response &&
            response.ok
          ) {
            const copy =
              response.clone();

            caches
              .open(CACHE)
              .then(cache => {
                cache.put(
                  request,
                  copy
                );
              });
          }

          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then(hit =>
              hit ||
              caches.match(
                request,
                {
                  ignoreSearch: true
                }
              )
            )
        )
    );

    return;
  }


  // =========================================================
  // THIRD-PARTY FILES
  // Example: ZXing
  // =========================================================

  event.respondWith(
    caches
      .match(request)
      .then(hit => {
        if (hit) {
          return hit;
        }

        return fetch(request)
          .then(response => {
            if (
              response &&
              response.ok
            ) {
              const copy =
                response.clone();

              caches
                .open(CACHE)
                .then(cache => {
                  cache.put(
                    request,
                    copy
                  );
                });
            }

            return response;
          });
      })
  );
});
