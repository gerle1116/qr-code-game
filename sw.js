const CACHE = "qr-city-quest-v34";

const PRECACHE = [
  "./",
  "./index.html",

  "./styles.css?v=34",

  "./language-loader.js?v=34",
  "./app.js?v=34",

  "./mod-system/mod-conditions.js?v=34",
  "./mod-system/mod-validator.js?v=34",
  "./mod-system/mod-registry.js?v=34",
  "./mod-system/mod-zip-reader.js?v=34",
  "./mod-system/mod-storage.js?v=34",
  "./mod-system/mod-installer.js?v=34",
  "./mod-system/mod-runtime.js?v=34",
  "./mod-system/mod-localization.js?v=34",

  "./data/apptext_en.js?v=34",
  "./data/apptext_hu.js?v=34",

  "./data/game-data_en.js?v=34",
  "./data/game-data_hu.js?v=34",

  // NPC default pictures
  "./images/child.png?v=34",
  "./images/merchant.png?v=34",
  "./images/guard.png?v=34",
  "./images/talking-tree.png?v=34",
  "./images/hunter.png?v=34",
  "./images/goblin.png?v=34",
  "./images/troll.png?v=34",
  "./images/fisherman.png?v=34",
  "./images/messenger.png?v=34",
  "./images/warrior.png?v=34",
  "./images/bird.png?v=34",
  "./images/otter.png?v=34",
  "./images/heron.png?v=34",

  // Special dialogue pictures
  "./images/child-back.png?v=34",
  "./images/child-gone.png?v=34",
  "./images/bird-gone.png?v=34",
  "./images/otter-gone.png?v=34",

  "./images/merchant-choice-items.png?v=34",
  "./images/merchant-asking-hand.png?v=34",
  "./images/merchant-reading-list.png?v=34",
  "./images/merchant-offers-sweets.png?v=34",
  "./images/merchant-offers-scroll.png?v=34",

  "./images/guard-map-village-center.png?v=34",
  "./images/guard-map-sections.png?v=34",
  "./images/guard-troll-sketch.png?v=34",
  "./images/guard-delighted.png?v=34",

  "./images/talking-tree-magic-branch.png?v=34",
  "./images/talking-tree-horn-hole.png?v=34",

  "./images/hunter-points-trees.png?v=34",
  "./images/hunter-points-fountain.png?v=34",
  "./images/hunter-points-footprints.png?v=34",
  "./images/hunter-gives-medal.png?v=34",

  "./images/goblin-items-on-ground.png?v=34",
  "./images/goblin-holds-gold-coin.png?v=34",
  "./images/goblin-holds-lucky-pebble.png?v=34",
  "./images/goblin-holds-ruby-sword.png?v=34",
  "./images/goblin-holds-powder-sack.png?v=34",
  "./images/goblin-empty-hand.png?v=34",
  "./images/goblin-holds-staff-of-goblins.png?v=34",
  "./images/goblin-tent-by-tree.png?v=34",

  "./images/troll-blocks-bridge.png?v=34",
  "./images/troll-holds-key.png?v=34",
  "./images/troll-sits-by-bridge.png?v=34",

  "./images/fisherman-points-direction.png?v=34",
  "./images/fisherman-gives-rod.png?v=34",
  "./images/fisherman-empty-hand.png?v=34",
  "./images/fisherman-gives-small-fish.png?v=34",
  "./images/fisherman-sits-on-dock.png?v=34",

  "./images/messenger-open-gloved-hands.png?v=34",
  "./images/messenger-delighted-letters.png?v=34",
  "./images/messenger-delighted-fish.png?v=34",

  "./images/warrior-arms-crossed.png?v=34",
  "./images/warrior-holds-sword.png?v=34",
  "./images/warrior-open-gate-side.png?v=34",
  "./images/warrior-defeated-weaponless.png?v=34",

  // Item pictures
  "./images/sweets.png?v=34",
  "./images/old-scroll.png?v=34",
  "./images/magic-branch.png?v=34",
  "./images/horn-of-trees.png?v=34",
  "./images/bridge-key.png?v=34",
  "./images/golden-medal.png?v=34",
  "./images/mark-of-goblins.png?v=34",
  "./images/priclys-feather.png?v=34",
  "./images/strange-powder.png?v=34",
  "./images/gold-coin.png?v=34",
  "./images/lucky-pebble.png?v=34",
  "./images/ruby-sword.png?v=34",
  "./images/staff-of-goblins.png?v=34",
  "./images/fishing-rod.png?v=34",
  "./images/crystal-shard.png?v=34",
  "./images/blobfish.png?v=34",
  "./images/silver-ring.png?v=34",
  "./images/bundle-of-letters.png?v=34",
  "./images/scroll-with-password.png?v=34",
  "./images/old-boots.png?v=34",
  "./images/great-salmon.png?v=34",
  "./images/fish.png?v=34",

  "./manifest.webmanifest",

  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/book.png?v=34",
  "./images/worm-book-cover.png?v=34",
  "./images/magic-book-cover.png?v=34",
  "./images/crystal-book-cover.png?v=34",
  "./images/book-too-small.png?v=34",
  "./images/magnifier-card.png?v=34",
  "./images/premium-library-card.png?v=34",
  "./images/straw.png?v=34",
  "./images/mosquito.png?v=34",
  "./images/scribe.png?v=34",
  "./images/scribe-books.png?v=34",
  "./images/scribe-gives-magnifier-card.png?v=34",
  "./images/scribe-premium-card.png?v=34",
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
