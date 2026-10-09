const CACHE = "qr-city-quest-v28";

const PRECACHE = [
  "./",
  "./index.html",

  "./styles.css?v=28",

  "./language-loader.js?v=28",
  "./app.js?v=28",

  "./mod-system/mod-validator.js?v=28",
  "./mod-system/mod-registry.js?v=28",
  "./mod-system/mod-zip-reader.js?v=28",
  "./mod-system/mod-storage.js?v=28",
  "./mod-system/mod-installer.js?v=28",

  "./data/apptext_en.js?v=28",
  "./data/apptext_hu.js?v=28",

  "./data/game-data_en.js?v=28",
  "./data/game-data_hu.js?v=28",

  // NPC default pictures
  "./images/child.png?v=28",
  "./images/merchant.png?v=28",
  "./images/guard.png?v=28",
  "./images/talking-tree.png?v=28",
  "./images/hunter.png?v=28",
  "./images/goblin.png?v=28",
  "./images/troll.png?v=28",
  "./images/fisherman.png?v=28",
  "./images/messenger.png?v=28",
  "./images/warrior.png?v=28",
  "./images/bird.png?v=28",
  "./images/otter.png?v=28",
  "./images/heron.png?v=28",

  // Special dialogue pictures
  "./images/child-back.png?v=28",
  "./images/child-gone.png?v=28",
  "./images/bird-gone.png?v=28",
  "./images/otter-gone.png?v=28",

  "./images/merchant-choice-items.png?v=28",
  "./images/merchant-asking-hand.png?v=28",
  "./images/merchant-reading-list.png?v=28",
  "./images/merchant-offers-sweets.png?v=28",
  "./images/merchant-offers-scroll.png?v=28",

  "./images/guard-map-village-center.png?v=28",
  "./images/guard-map-sections.png?v=28",
  "./images/guard-troll-sketch.png?v=28",
  "./images/guard-delighted.png?v=28",

  "./images/talking-tree-magic-branch.png?v=28",
  "./images/talking-tree-horn-hole.png?v=28",

  "./images/hunter-points-trees.png?v=28",
  "./images/hunter-points-fountain.png?v=28",
  "./images/hunter-points-footprints.png?v=28",
  "./images/hunter-gives-medal.png?v=28",

  "./images/goblin-items-on-ground.png?v=28",
  "./images/goblin-holds-gold-coin.png?v=28",
  "./images/goblin-holds-lucky-pebble.png?v=28",
  "./images/goblin-holds-ruby-sword.png?v=28",
  "./images/goblin-holds-powder-sack.png?v=28",
  "./images/goblin-empty-hand.png?v=28",
  "./images/goblin-holds-staff-of-goblins.png?v=28",
  "./images/goblin-tent-by-tree.png?v=28",

  "./images/troll-blocks-bridge.png?v=28",
  "./images/troll-holds-key.png?v=28",
  "./images/troll-sits-by-bridge.png?v=28",

  "./images/fisherman-points-direction.png?v=28",
  "./images/fisherman-gives-rod.png?v=28",
  "./images/fisherman-empty-hand.png?v=28",
  "./images/fisherman-gives-small-fish.png?v=28",
  "./images/fisherman-sits-on-dock.png?v=28",

  "./images/messenger-open-gloved-hands.png?v=28",
  "./images/messenger-delighted-letters.png?v=28",
  "./images/messenger-delighted-fish.png?v=28",

  "./images/warrior-arms-crossed.png?v=28",
  "./images/warrior-holds-sword.png?v=28",
  "./images/warrior-open-gate-side.png?v=28",
  "./images/warrior-defeated-weaponless.png?v=28",

  // Item pictures
  "./images/sweets.png?v=28",
  "./images/old-scroll.png?v=28",
  "./images/magic-branch.png?v=28",
  "./images/horn-of-trees.png?v=28",
  "./images/bridge-key.png?v=28",
  "./images/golden-medal.png?v=28",
  "./images/mark-of-goblins.png?v=28",
  "./images/priclys-feather.png?v=28",
  "./images/strange-powder.png?v=28",
  "./images/gold-coin.png?v=28",
  "./images/lucky-pebble.png?v=28",
  "./images/ruby-sword.png?v=28",
  "./images/staff-of-goblins.png?v=28",
  "./images/fishing-rod.png?v=28",
  "./images/crystal-shard.png?v=28",
  "./images/blobfish.png?v=28",
  "./images/silver-ring.png?v=28",
  "./images/bundle-of-letters.png?v=28",
  "./images/scroll-with-password.png?v=28",
  "./images/old-boots.png?v=28",
  "./images/great-salmon.png?v=28",
  "./images/fish.png?v=28",

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
