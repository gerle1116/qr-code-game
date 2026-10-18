const CACHE = "qr-city-quest-v40";

const PRECACHE = [
  "./",
  "./index.html",

  "./styles.css?v=40",

  "./language-loader.js?v=40",
  "./app.js?v=40",

  "./mod-system/mod-conditions.js?v=40",
  "./mod-system/mod-validator.js?v=40",
  "./mod-system/mod-registry.js?v=40",
  "./mod-system/mod-zip-reader.js?v=40",
  "./mod-system/mod-storage.js?v=40",
  "./mod-system/mod-installer.js?v=40",
  "./mod-system/mod-runtime.js?v=40",
  "./mod-system/mod-localization.js?v=40",

  "./data/apptext_en.js?v=40",
  "./data/apptext_hu.js?v=40",

  "./data/game-data_en.js?v=40",
  "./data/game-data_hu.js?v=40",

  // NPC default pictures
  "./images/child.png?v=40",
  "./images/merchant.png?v=40",
  "./images/guard.png?v=40",
  "./images/talking-tree.png?v=40",
  "./images/hunter.png?v=40",
  "./images/goblin.png?v=40",
  "./images/troll.png?v=40",
  "./images/fisherman.png?v=40",
  "./images/messenger.png?v=40",
  "./images/warrior.png?v=40",
  "./images/bird.png?v=40",
  "./images/otter.png?v=40",
  "./images/heron.png?v=40",

  // Special dialogue pictures
  "./images/child-back.png?v=40",
  "./images/child-gone.png?v=40",
  "./images/bird-gone.png?v=40",
  "./images/otter-gone.png?v=40",

  "./images/merchant-choice-items.png?v=40",
  "./images/merchant-asking-hand.png?v=40",
  "./images/merchant-reading-list.png?v=40",
  "./images/merchant-offers-sweets.png?v=40",
  "./images/merchant-offers-scroll.png?v=40",

  "./images/guard-map-village-center.png?v=40",
  "./images/guard-map-sections.png?v=40",
  "./images/guard-troll-sketch.png?v=40",
  "./images/guard-delighted.png?v=40",

  "./images/talking-tree-magic-branch.png?v=40",
  "./images/talking-tree-horn-hole.png?v=40",

  "./images/hunter-points-trees.png?v=40",
  "./images/hunter-points-fountain.png?v=40",
  "./images/hunter-points-footprints.png?v=40",
  "./images/hunter-gives-medal.png?v=40",

  "./images/goblin-items-on-ground.png?v=40",
  "./images/goblin-holds-gold-coin.png?v=40",
  "./images/goblin-holds-lucky-pebble.png?v=40",
  "./images/goblin-holds-ruby-sword.png?v=40",
  "./images/goblin-holds-powder-sack.png?v=40",
  "./images/goblin-empty-hand.png?v=40",
  "./images/goblin-holds-staff-of-goblins.png?v=40",
  "./images/goblin-tent-by-tree.png?v=40",

  "./images/troll-blocks-bridge.png?v=40",
  "./images/troll-holds-key.png?v=40",
  "./images/troll-sits-by-bridge.png?v=40",

  "./images/fisherman-points-direction.png?v=40",
  "./images/fisherman-gives-rod.png?v=40",
  "./images/fisherman-empty-hand.png?v=40",
  "./images/fisherman-gives-small-fish.png?v=40",
  "./images/fisherman-sits-on-dock.png?v=40",

  "./images/messenger-open-gloved-hands.png?v=40",
  "./images/messenger-delighted-letters.png?v=40",
  "./images/messenger-delighted-fish.png?v=40",

  "./images/warrior-arms-crossed.png?v=40",
  "./images/warrior-holds-sword.png?v=40",
  "./images/warrior-open-gate-side.png?v=40",
  "./images/warrior-defeated-weaponless.png?v=40",

  // Item pictures
  "./images/sweets.png?v=40",
  "./images/old-scroll.png?v=40",
  "./images/magic-branch.png?v=40",
  "./images/horn-of-trees.png?v=40",
  "./images/bridge-key.png?v=40",
  "./images/golden-medal.png?v=40",
  "./images/mark-of-goblins.png?v=40",
  "./images/priclys-feather.png?v=40",
  "./images/strange-powder.png?v=40",
  "./images/gold-coin.png?v=40",
  "./images/lucky-pebble.png?v=40",
  "./images/ruby-sword.png?v=40",
  "./images/staff-of-goblins.png?v=40",
  "./images/fishing-rod.png?v=40",
  "./images/crystal-shard.png?v=40",
  "./images/blobfish.png?v=40",
  "./images/silver-ring.png?v=40",
  "./images/bundle-of-letters.png?v=40",
  "./images/scroll-with-password.png?v=40",
  "./images/old-boots.png?v=40",
  "./images/great-salmon.png?v=40",
  "./images/fish.png?v=40",

  "./manifest.webmanifest",

  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/book.png?v=40",
  "./images/worm-book-cover.png?v=40",
  "./images/magic-book-cover.png?v=40",
  "./images/crystal-book-cover.png?v=40",
  "./images/book-too-small.png?v=40",
  "./images/magnifier-card.png?v=40",
  "./images/premium-library-card.png?v=40",
  "./images/straw.png?v=40",
  "./images/mosquito.png?v=40",
  "./images/scribe.png?v=40",
  "./images/scribe-books.png?v=40",
  "./images/scribe-gives-book.png?v=40",
  "./images/scribe-gives-magnifier-card.png?v=40",
  "./images/scribe-premium-card.png?v=40",
  "./images/scribe-annoyed.png?v=40",
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
