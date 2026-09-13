const CACHE = "qr-city-quest-v11";

const PRECACHE = [
  "./",
  "./index.html",

  "./styles.css?v=11",

  "./language-loader.js?v=11",
  "./app.js?v=11",

  "./data/apptext_en.js?v=11",
  "./data/apptext_hu.js?v=11",

  "./data/game-data_en.js?v=11",
  "./data/game-data_hu.js?v=11",

  "./images/sweets.png",
  "./images/old-scroll.png",
  "./images/magic-branch.png",
  "./images/horn-of-trees.png",
  "./images/bridge-key.png",
  "./images/golden-medal.png",
  "./images/mark-of-goblins.png",
  "./images/priclys-feather.png",
  "./images/strange-powder.png",
  "./images/gold-coin.png",
  "./images/ruby-sword.png",
  "./images/staff-of-goblins.png",
  "./images/fishing-rod.png",
  "./images/crystal-shard.png",
  "./images/blobfish.png",
  "./images/silver-ring.png",
  "./images/bundle-of-letters.png",
  "./images/scroll-with-password.png",
  "./images/old-boots.png",
  "./images/great-salmon.png",
  "./images/fish.png",

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

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();

            caches
              .open(CACHE)
              .then(cache => {
                cache.put(request, copy);
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
                { ignoreSearch: true }
              )
            )
        )
    );

    return;
  }

  event.respondWith(
    caches
      .match(request)
      .then(hit => {
        if (hit) {
          return hit;
        }

        return fetch(request)
          .then(response => {
            if (response && response.ok) {
              const copy = response.clone();

              caches
                .open(CACHE)
                .then(cache => {
                  cache.put(request, copy);
                });
            }

            return response;
          });
      })
  );
});
