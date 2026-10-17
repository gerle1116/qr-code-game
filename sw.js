const CACHE = "qr-city-quest-v32";

const PRECACHE = [
  "./",
  "./index.html",

  "./styles.css?v=32",

  "./language-loader.js?v=32",
  "./app.js?v=32",

  "./mod-system/mod-conditions.js?v=32",
  "./mod-system/mod-validator.js?v=32",
  "./mod-system/mod-registry.js?v=32",
  "./mod-system/mod-zip-reader.js?v=32",
  "./mod-system/mod-storage.js?v=32",
  "./mod-system/mod-installer.js?v=32",
  "./mod-system/mod-runtime.js?v=32",
  "./mod-system/mod-localization.js?v=32",

  "./data/apptext_en.js?v=32",
  "./data/apptext_hu.js?v=32",

  "./data/game-data_en.js?v=32",
  "./data/game-data_hu.js?v=32",

  // NPC default pictures
  "./images/child.png?v=32",
  "./images/merchant.png?v=32",
  "./images/guard.png?v=32",
  "./images/talking-tree.png?v=32",
  "./images/hunter.png?v=32",
  "./images/goblin.png?v=32",
  "./images/troll.png?v=32",
  "./images/fisherman.png?v=32",
  "./images/messenger.png?v=32",
  "./images/warrior.png?v=32",
  "./images/bird.png?v=32",
  "./images/otter.png?v=32",
  "./images/heron.png?v=32",

  // Special dialogue pictures
  "./images/child-back.png?v=32",
  "./images/child-gone.png?v=32",
  "./images/bird-gone.png?v=32",
  "./images/otter-gone.png?v=32",

  "./images/merchant-choice-items.png?v=32",
  "./images/merchant-asking-hand.png?v=32",
  "./images/merchant-reading-list.png?v=32",
  "./images/merchant-offers-sweets.png?v=32",
  "./images/merchant-offers-scroll.png?v=32",

  "./images/guard-map-village-center.png?v=32",
  "./images/guard-map-sections.png?v=32",
  "./images/guard-troll-sketch.png?v=32",
  "./images/guard-delighted.png?v=32",

  "./images/talking-tree-magic-branch.png?v=32",
  "./images/talking-tree-horn-hole.png?v=32",

  "./images/hunter-points-trees.png?v=32",
  "./images/hunter-points-fountain.png?v=32",
  "./images/hunter-points-footprints.png?v=32",
  "./images/hunter-gives-medal.png?v=32",

  "./images/goblin-items-on-ground.png?v=32",
  "./images/goblin-holds-gold-coin.png?v=32",
  "./images/goblin-holds-lucky-pebble.png?v=32",
  "./images/goblin-holds-ruby-sword.png?v=32",
  "./images/goblin-holds-powder-sack.png?v=32",
  "./images/goblin-empty-hand.png?v=32",
  "./images/goblin-holds-staff-of-goblins.png?v=32",
  "./images/goblin-tent-by-tree.png?v=32",

  "./images/troll-blocks-bridge.png?v=32",
  "./images/troll-holds-key.png?v=32",
  "./images/troll-sits-by-bridge.png?v=32",

  "./images/fisherman-points-direction.png?v=32",
  "./images/fisherman-gives-rod.png?v=32",
  "./images/fisherman-empty-hand.png?v=32",
  "./images/fisherman-gives-small-fish.png?v=32",
  "./images/fisherman-sits-on-dock.png?v=32",

  "./images/messenger-open-gloved-hands.png?v=32",
  "./images/messenger-delighted-letters.png?v=32",
  "./images/messenger-delighted-fish.png?v=32",

  "./images/warrior-arms-crossed.png?v=32",
  "./images/warrior-holds-sword.png?v=32",
  "./images/warrior-open-gate-side.png?v=32",
  "./images/warrior-defeated-weaponless.png?v=32",

  // Item pictures
  "./images/sweets.png?v=32",
  "./images/old-scroll.png?v=32",
  "./images/magic-branch.png?v=32",
  "./images/horn-of-trees.png?v=32",
  "./images/bridge-key.png?v=32",
  "./images/golden-medal.png?v=32",
  "./images/mark-of-goblins.png?v=32",
  "./images/priclys-feather.png?v=32",
  "./images/strange-powder.png?v=32",
  "./images/gold-coin.png?v=32",
  "./images/lucky-pebble.png?v=32",
  "./images/ruby-sword.png?v=32",
  "./images/staff-of-goblins.png?v=32",
  "./images/fishing-rod.png?v=32",
  "./images/crystal-shard.png?v=32",
  "./images/blobfish.png?v=32",
  "./images/silver-ring.png?v=32",
  "./images/bundle-of-letters.png?v=32",
  "./images/scroll-with-password.png?v=32",
  "./images/old-boots.png?v=32",
  "./images/great-salmon.png?v=32",
  "./images/fish.png?v=32",

  "./manifest.webmanifest",

  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/book.png?v=32",
  "./images/worm-book-cover.png?v=32",
  "./images/magic-book-cover.png?v=32",
  "./images/crystal-book-cover.png?v=32",
  "./images/book-too-small.png?v=32",
  "./images/magnifier-card.png?v=32",
  "./images/premium-library-card.png?v=32",
  "./images/straw.png?v=32",
  "./images/mosquito.png?v=32",
  "./images/scribe.png?v=32",
  "./images/scribe-books.png?v=32",
  "./images/scribe-gives-magnifier-card.png?v=32",
  "./images/scribe-premium-card.png?v=32",
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
