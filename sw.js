const CACHE = "qr-city-quest-v43";
const VERSION = Number(CACHE.slice(CACHE.lastIndexOf("v") + 1));

const PRECACHE = [
  "./",
  "./index.html",

  "./styles.css?v=42",

  "./language-loader.js?v=43",
  "./app.js?v=43",

  "./mod-system/mod-conditions.js?v=42",
  "./mod-system/mod-validator.js?v=42",
  "./mod-system/mod-registry.js?v=42",
  "./mod-system/mod-zip-reader.js?v=42",
  "./mod-system/mod-storage.js?v=42",
  "./mod-system/mod-installer.js?v=42",
  "./mod-system/mod-runtime.js?v=42",
  "./mod-system/mod-localization.js?v=42",

  "./data/apptext_en.js?v=42",
  "./data/apptext_hu.js?v=42",

  "./data/game-data_en.js?v=42",
  "./data/game-data_hu.js?v=42",

  "./adventure-system/scenario-engine.js?v=42",
  "./adventure-system/encounter-history.js?v=42",
  "./adventure-system/adventure-schemas.js?v=42",
  "./adventure-system/validator.js?v=42",
  "./adventure-system/qr-resolver.js?v=42",
  "./adventure-system/adventure-save.js?v=42",
  "./adventure-system/adventure-catalog.js?v=42",
  "./adventure-system/adventure-zip.js?v=42",
  "./adventure-system/adventure-storage.js?v=42",
  "./adventure-system/adventure-downloader.js?v=42",
  "./adventure-system/adventure-browser.js?v=42",
  "./adventure-system/map-renderer.js?v=42",
  "./adventure-system/adventure-completion.js?v=42",
  "./adventure-system/adventure-victory.js?v=42",
  "./adventure-system/adventure-integration.js?v=42",
  "./adventure-system/adventure-browser.css?v=42",
  "./adventure-system/map-renderer.css?v=42",
  "./adventure-system/adventure-victory.css?v=42",

  // NPC default pictures
  "./images/child.png?v=42",
  "./images/merchant.png?v=42",
  "./images/guard.png?v=42",
  "./images/talking-tree.png?v=42",
  "./images/hunter.png?v=42",
  "./images/goblin.png?v=42",
  "./images/troll.png?v=42",
  "./images/fisherman.png?v=42",
  "./images/messenger.png?v=42",
  "./images/warrior.png?v=42",
  "./images/bird.png?v=42",
  "./images/otter.png?v=42",
  "./images/heron.png?v=42",

  // Special dialogue pictures
  "./images/child-back.png?v=42",
  "./images/child-gone.png?v=42",
  "./images/bird-gone.png?v=42",
  "./images/otter-gone.png?v=42",

  "./images/merchant-choice-items.png?v=42",
  "./images/merchant-asking-hand.png?v=42",
  "./images/merchant-reading-list.png?v=42",
  "./images/merchant-offers-sweets.png?v=42",
  "./images/merchant-offers-scroll.png?v=42",

  "./images/guard-map-village-center.png?v=42",
  "./images/guard-map-sections.png?v=42",
  "./images/guard-troll-sketch.png?v=42",
  "./images/guard-delighted.png?v=42",

  "./images/talking-tree-magic-branch.png?v=42",
  "./images/talking-tree-horn-hole.png?v=42",

  "./images/hunter-points-trees.png?v=42",
  "./images/hunter-points-fountain.png?v=42",
  "./images/hunter-points-footprints.png?v=42",
  "./images/hunter-gives-medal.png?v=42",

  "./images/goblin-items-on-ground.png?v=42",
  "./images/goblin-holds-gold-coin.png?v=42",
  "./images/goblin-holds-lucky-pebble.png?v=42",
  "./images/goblin-holds-ruby-sword.png?v=42",
  "./images/goblin-holds-powder-sack.png?v=42",
  "./images/goblin-empty-hand.png?v=42",
  "./images/goblin-holds-staff-of-goblins.png?v=42",
  "./images/goblin-tent-by-tree.png?v=42",

  "./images/troll-blocks-bridge.png?v=42",
  "./images/troll-holds-key.png?v=42",
  "./images/troll-sits-by-bridge.png?v=42",

  "./images/fisherman-points-direction.png?v=42",
  "./images/fisherman-gives-rod.png?v=42",
  "./images/fisherman-empty-hand.png?v=42",
  "./images/fisherman-gives-small-fish.png?v=42",
  "./images/fisherman-sits-on-dock.png?v=42",

  "./images/messenger-open-gloved-hands.png?v=42",
  "./images/messenger-delighted-letters.png?v=42",
  "./images/messenger-delighted-fish.png?v=42",

  "./images/warrior-arms-crossed.png?v=42",
  "./images/warrior-holds-sword.png?v=42",
  "./images/warrior-open-gate-side.png?v=42",
  "./images/warrior-defeated-weaponless.png?v=42",

  // Item pictures
  "./images/sweets.png?v=42",
  "./images/old-scroll.png?v=42",
  "./images/magic-branch.png?v=42",
  "./images/horn-of-trees.png?v=42",
  "./images/bridge-key.png?v=42",
  "./images/golden-medal.png?v=42",
  "./images/mark-of-goblins.png?v=42",
  "./images/priclys-feather.png?v=42",
  "./images/strange-powder.png?v=42",
  "./images/gold-coin.png?v=42",
  "./images/lucky-pebble.png?v=42",
  "./images/ruby-sword.png?v=42",
  "./images/staff-of-goblins.png?v=42",
  "./images/fishing-rod.png?v=42",
  "./images/crystal-shard.png?v=42",
  "./images/blobfish.png?v=42",
  "./images/silver-ring.png?v=42",
  "./images/bundle-of-letters.png?v=42",
  "./images/scroll-with-password.png?v=42",
  "./images/old-boots.png?v=42",
  "./images/great-salmon.png?v=42",
  "./images/fish.png?v=42",

  "./manifest.webmanifest",

  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/book.png?v=42",
  "./images/worm-book-cover.png?v=42",
  "./images/magic-book-cover.png?v=42",
  "./images/crystal-book-cover.png?v=42",
  "./images/book-too-small.png?v=42",
  "./images/magnifier-card.png?v=42",
  "./images/premium-library-card.png?v=42",
  "./images/straw.png?v=42",
  "./images/mosquito.png?v=42",
  "./images/scribe.png?v=42",
  "./images/scribe-books.png?v=42",
  "./images/scribe-gives-book.png?v=42",
  "./images/scribe-gives-magnifier-card.png?v=42",
  "./images/scribe-premium-card.png?v=42",
  "./images/scribe-annoyed.png?v=42",
];

const SCANNER = "https://unpkg.com/@zxing/browser@0.2.1";
const scoped = path => new URL(path, self.registration.scope).href;
const immutable = new Set(PRECACHE.filter(path => path.includes("?v=")).map(scoped));
const shellURLs = new Set(["./", "./index.html"].map(scoped));

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // The previous worker remains active if any required shell resource fails.
    await cache.addAll(PRECACHE.map(path => new Request(scoped(path), { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  // Retain two recent shells for tabs still using their immutable resources.
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => /^qr-city-quest-v\d+$/.test(key) &&
      Number(key.slice(key.lastIndexOf("v") + 1)) < VERSION - 2).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  const local = url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
  if (request.mode === "navigate" && local && shellURLs.has(url.origin + url.pathname)) {
    // Serve a complete installed generation while the browser checks for a worker update.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(scoped("./index.html"))) || fetch(request);
    })());
    return;
  }
  if (immutable.has(url.href)) {
    event.respondWith((async () => (await caches.open(CACHE)).match(request))().then(hit => hit || Response.error()));
    return;
  }
  const oldVersion = local && /^\?v=(\d+)$/.exec(url.search);
  if (oldVersion && Number(oldVersion[1]) < VERSION && !url.pathname.endsWith("/sw.js")) {
    event.respondWith((async () => {
      const key = `qr-city-quest-v${oldVersion[1]}`;
      if (!(await caches.has(key))) return Response.error();
      return (await (await caches.open(key)).match(request)) || Response.error();
    })());
    return;
  }
  if (url.href === SCANNER) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(SCANNER);
      if (hit) return hit;
      const response = await fetch(SCANNER, { mode: "cors" });
      if (response.ok) await cache.put(SCANNER, response.clone());
      return response;
    })());
    return;
  }
  if (local && PRECACHE.some(path => scoped(path) === url.href)) {
    event.respondWith((async () => (await caches.open(CACHE)).match(request))().then(hit => hit || fetch(request)));
  }
});
