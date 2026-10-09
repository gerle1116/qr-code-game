const CACHE = "qr-city-quest-v27";

const PRECACHE = [
  "./",
  "./index.html",

  "./styles.css?v=27",

  "./language-loader.js?v=27",
  "./app.js?v=27",

  "./mod-system/mod-validator.js?v=27",
  "./mod-system/mod-registry.js?v=27",
  "./mod-system/mod-zip-reader.js?v=27",
  "./mod-system/mod-storage.js?v=27",
  "./mod-system/mod-installer.js?v=27",

  "./data/apptext_en.js?v=27",
  "./data/apptext_hu.js?v=27",

  "./data/game-data_en.js?v=27",
  "./data/game-data_hu.js?v=27",

  // NPC default pictures
  "./images/child.png?v=27",
  "./images/merchant.png?v=27",
  "./images/guard.png?v=27",
  "./images/talking-tree.png?v=27",
  "./images/hunter.png?v=27",
  "./images/goblin.png?v=27",
  "./images/troll.png?v=27",
  "./images/fisherman.png?v=27",
  "./images/messenger.png?v=27",
  "./images/warrior.png?v=27",
  "./images/bird.png?v=27",
  "./images/otter.png?v=27",
  "./images/heron.png?v=27",

  // Special dialogue pictures
  "./images/child-back.png?v=27",
  "./images/child-gone.png?v=27",
  "./images/bird-gone.png?v=27",
  "./images/otter-gone.png?v=27",

  "./images/merchant-choice-items.png?v=27",
  "./images/merchant-asking-hand.png?v=27",
  "./images/merchant-reading-list.png?v=27",
  "./images/merchant-offers-sweets.png?v=27",
  "./images/merchant-offers-scroll.png?v=27",

  "./images/guard-map-village-center.png?v=27",
  "./images/guard-map-sections.png?v=27",
  "./images/guard-troll-sketch.png?v=27",
  "./images/guard-delighted.png?v=27",

  "./images/talking-tree-magic-branch.png?v=27",
  "./images/talking-tree-horn-hole.png?v=27",

  "./images/hunter-points-trees.png?v=27",
  "./images/hunter-points-fountain.png?v=27",
  "./images/hunter-points-footprints.png?v=27",
  "./images/hunter-gives-medal.png?v=27",

  "./images/goblin-items-on-ground.png?v=27",
  "./images/goblin-holds-gold-coin.png?v=27",
  "./images/goblin-holds-lucky-pebble.png?v=27",
  "./images/goblin-holds-ruby-sword.png?v=27",
  "./images/goblin-holds-powder-sack.png?v=27",
  "./images/goblin-empty-hand.png?v=27",
  "./images/goblin-holds-staff-of-goblins.png?v=27",
  "./images/goblin-tent-by-tree.png?v=27",

  "./images/troll-blocks-bridge.png?v=27",
  "./images/troll-holds-key.png?v=27",
  "./images/troll-sits-by-bridge.png?v=27",

  "./images/fisherman-points-direction.png?v=27",
  "./images/fisherman-gives-rod.png?v=27",
  "./images/fisherman-empty-hand.png?v=27",
  "./images/fisherman-gives-small-fish.png?v=27",
  "./images/fisherman-sits-on-dock.png?v=27",

  "./images/messenger-open-gloved-hands.png?v=27",
  "./images/messenger-delighted-letters.png?v=27",
  "./images/messenger-delighted-fish.png?v=27",

  "./images/warrior-arms-crossed.png?v=27",
  "./images/warrior-holds-sword.png?v=27",
  "./images/warrior-open-gate-side.png?v=27",
  "./images/warrior-defeated-weaponless.png?v=27",

  // Item pictures
  "./images/sweets.png?v=27",
  "./images/old-scroll.png?v=27",
  "./images/magic-branch.png?v=27",
  "./images/horn-of-trees.png?v=27",
  "./images/bridge-key.png?v=27",
  "./images/golden-medal.png?v=27",
  "./images/mark-of-goblins.png?v=27",
  "./images/priclys-feather.png?v=27",
  "./images/strange-powder.png?v=27",
  "./images/gold-coin.png?v=27",
  "./images/lucky-pebble.png?v=27",
  "./images/ruby-sword.png?v=27",
  "./images/staff-of-goblins.png?v=27",
  "./images/fishing-rod.png?v=27",
  "./images/crystal-shard.png?v=27",
  "./images/blobfish.png?v=27",
  "./images/silver-ring.png?v=27",
  "./images/bundle-of-letters.png?v=27",
  "./images/scroll-with-password.png?v=27",
  "./images/old-boots.png?v=27",
  "./images/great-salmon.png?v=27",
  "./images/fish.png?v=27",

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
