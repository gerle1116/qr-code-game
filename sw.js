const CACHE = "qr-city-quest-v14";

const PRECACHE = [
  "./",
  "./index.html",

  "./styles.css?v=14",

  "./language-loader.js?v=14",
  "./app.js?v=14",

  "./data/apptext_en.js?v=14",
  "./data/apptext_hu.js?v=14",

  "./data/game-data_en.js?v=14",
  "./data/game-data_hu.js?v=14",

  // NPC default pictures
  "./images/child.png",
  "./images/merchant.png",
  "./images/guard.png",
  "./images/talking-tree.png",
  "./images/hunter.png",
  "./images/goblin.png",
  "./images/troll.png",
  "./images/fisherman.png",
  "./images/messenger.png",
  "./images/warrior.png",

  // Special dialogue pictures
  "./images/child-back.png",
  "./images/child-gone.png",

  "./images/merchant-choice-items.png",
  "./images/merchant-asking-hand.png",
  "./images/merchant-reading-list.png",
  "./images/merchant-offers-sweets.png",
  "./images/merchant-offers-scroll.png",

  "./images/guard-map-village-center.png",
  "./images/guard-map-sections.png",
  "./images/guard-troll-sketch.png",
  "./images/guard-delighted.png",

  "./images/talking-tree-magic-branch.png",
  "./images/talking-tree-horn-hole.png",

  "./images/hunter-points-trees.png",
  "./images/hunter-points-fountain.png",
  "./images/hunter-points-footprints.png",
  "./images/hunter-gives-medal.png",

  "./images/goblin-items-on-ground.png",
  "./images/goblin-holds-gold-coin.png",
  "./images/goblin-holds-lucky-pebble.png",
  "./images/goblin-holds-ruby-sword.png",
  "./images/goblin-holds-powder-sack.png",
  "./images/goblin-empty-hand.png",
  "./images/goblin-holds-staff-of-goblins.png",
  "./images/goblin-tent-by-tree.png",

  "./images/troll-blocks-bridge.png",
  "./images/troll-holds-key.png",
  "./images/troll-sits-by-bridge.png",

  "./images/fisherman-points-direction.png",
  "./images/fisherman-gives-rod.png",
  "./images/fisherman-empty-hand.png",
  "./images/fisherman-gives-small-fish.png",
  "./images/fisherman-sits-on-dock.png",

  "./images/messenger-open-gloved-hands.png",
  "./images/messenger-delighted-letters.png",
  "./images/messenger-delighted-fish.png",

  "./images/warrior-arms-crossed.png",
  "./images/warrior-holds-sword.png",
  "./images/warrior-open-gate-side.png",
  "./images/warrior-defeated-weaponless.png",

  // Item pictures
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
