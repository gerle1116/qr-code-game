const CACHE = "qr-city-quest-v41";

const PRECACHE = [
  "./",
  "./index.html",

  "./styles.css?v=41",

  "./language-loader.js?v=41",
  "./app.js?v=41",

  "./mod-system/mod-conditions.js?v=41",
  "./mod-system/mod-validator.js?v=41",
  "./mod-system/mod-registry.js?v=41",
  "./mod-system/mod-zip-reader.js?v=41",
  "./mod-system/mod-storage.js?v=41",
  "./mod-system/mod-installer.js?v=41",
  "./mod-system/mod-runtime.js?v=41",
  "./mod-system/mod-localization.js?v=41",

  "./data/apptext_en.js?v=41",
  "./data/apptext_hu.js?v=41",

  "./data/game-data_en.js?v=41",
  "./data/game-data_hu.js?v=41",

  "./adventure-system/scenario-engine.js?v=41",
  "./adventure-system/encounter-history.js?v=41",
  "./adventure-system/adventure-schemas.js?v=41",
  "./adventure-system/validator.js?v=41",
  "./adventure-system/qr-resolver.js?v=41",
  "./adventure-system/adventure-save.js?v=41",
  "./adventure-system/adventure-catalog.js?v=41",
  "./adventure-system/adventure-zip.js?v=41",
  "./adventure-system/adventure-storage.js?v=41",
  "./adventure-system/adventure-downloader.js?v=41",
  "./adventure-system/adventure-browser.js?v=41",
  "./adventure-system/map-renderer.js?v=41",
  "./adventure-system/adventure-completion.js?v=41",
  "./adventure-system/adventure-victory.js?v=41",
  "./adventure-system/adventure-integration.js?v=41",
  "./adventure-system/adventure-browser.css?v=41",
  "./adventure-system/map-renderer.css?v=41",
  "./adventure-system/adventure-victory.css?v=41",

  // NPC default pictures
  "./images/child.png?v=41",
  "./images/merchant.png?v=41",
  "./images/guard.png?v=41",
  "./images/talking-tree.png?v=41",
  "./images/hunter.png?v=41",
  "./images/goblin.png?v=41",
  "./images/troll.png?v=41",
  "./images/fisherman.png?v=41",
  "./images/messenger.png?v=41",
  "./images/warrior.png?v=41",
  "./images/bird.png?v=41",
  "./images/otter.png?v=41",
  "./images/heron.png?v=41",

  // Special dialogue pictures
  "./images/child-back.png?v=41",
  "./images/child-gone.png?v=41",
  "./images/bird-gone.png?v=41",
  "./images/otter-gone.png?v=41",

  "./images/merchant-choice-items.png?v=41",
  "./images/merchant-asking-hand.png?v=41",
  "./images/merchant-reading-list.png?v=41",
  "./images/merchant-offers-sweets.png?v=41",
  "./images/merchant-offers-scroll.png?v=41",

  "./images/guard-map-village-center.png?v=41",
  "./images/guard-map-sections.png?v=41",
  "./images/guard-troll-sketch.png?v=41",
  "./images/guard-delighted.png?v=41",

  "./images/talking-tree-magic-branch.png?v=41",
  "./images/talking-tree-horn-hole.png?v=41",

  "./images/hunter-points-trees.png?v=41",
  "./images/hunter-points-fountain.png?v=41",
  "./images/hunter-points-footprints.png?v=41",
  "./images/hunter-gives-medal.png?v=41",

  "./images/goblin-items-on-ground.png?v=41",
  "./images/goblin-holds-gold-coin.png?v=41",
  "./images/goblin-holds-lucky-pebble.png?v=41",
  "./images/goblin-holds-ruby-sword.png?v=41",
  "./images/goblin-holds-powder-sack.png?v=41",
  "./images/goblin-empty-hand.png?v=41",
  "./images/goblin-holds-staff-of-goblins.png?v=41",
  "./images/goblin-tent-by-tree.png?v=41",

  "./images/troll-blocks-bridge.png?v=41",
  "./images/troll-holds-key.png?v=41",
  "./images/troll-sits-by-bridge.png?v=41",

  "./images/fisherman-points-direction.png?v=41",
  "./images/fisherman-gives-rod.png?v=41",
  "./images/fisherman-empty-hand.png?v=41",
  "./images/fisherman-gives-small-fish.png?v=41",
  "./images/fisherman-sits-on-dock.png?v=41",

  "./images/messenger-open-gloved-hands.png?v=41",
  "./images/messenger-delighted-letters.png?v=41",
  "./images/messenger-delighted-fish.png?v=41",

  "./images/warrior-arms-crossed.png?v=41",
  "./images/warrior-holds-sword.png?v=41",
  "./images/warrior-open-gate-side.png?v=41",
  "./images/warrior-defeated-weaponless.png?v=41",

  // Item pictures
  "./images/sweets.png?v=41",
  "./images/old-scroll.png?v=41",
  "./images/magic-branch.png?v=41",
  "./images/horn-of-trees.png?v=41",
  "./images/bridge-key.png?v=41",
  "./images/golden-medal.png?v=41",
  "./images/mark-of-goblins.png?v=41",
  "./images/priclys-feather.png?v=41",
  "./images/strange-powder.png?v=41",
  "./images/gold-coin.png?v=41",
  "./images/lucky-pebble.png?v=41",
  "./images/ruby-sword.png?v=41",
  "./images/staff-of-goblins.png?v=41",
  "./images/fishing-rod.png?v=41",
  "./images/crystal-shard.png?v=41",
  "./images/blobfish.png?v=41",
  "./images/silver-ring.png?v=41",
  "./images/bundle-of-letters.png?v=41",
  "./images/scroll-with-password.png?v=41",
  "./images/old-boots.png?v=41",
  "./images/great-salmon.png?v=41",
  "./images/fish.png?v=41",

  "./manifest.webmanifest",

  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/book.png?v=41",
  "./images/worm-book-cover.png?v=41",
  "./images/magic-book-cover.png?v=41",
  "./images/crystal-book-cover.png?v=41",
  "./images/book-too-small.png?v=41",
  "./images/magnifier-card.png?v=41",
  "./images/premium-library-card.png?v=41",
  "./images/straw.png?v=41",
  "./images/mosquito.png?v=41",
  "./images/scribe.png?v=41",
  "./images/scribe-books.png?v=41",
  "./images/scribe-gives-book.png?v=41",
  "./images/scribe-gives-magnifier-card.png?v=41",
  "./images/scribe-premium-card.png?v=41",
  "./images/scribe-annoyed.png?v=41",
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
    try {
      const scanner = await fetch(SCANNER, { signal: AbortSignal.timeout(4500) });
      if (scanner.ok) await cache.put(SCANNER, scanner);
    } catch (_) { /* Manual QR entry remains available. */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  // Keep the immediately previous shell available to already open pages.
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => /^qr-city-quest-v\d+$/.test(key) &&
      key !== CACHE && key !== "qr-city-quest-v40").map(key => caches.delete(key)));
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
    // Keep the fallback bound to this exact, installed shell version.
    event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE)).match(scoped("./index.html"))));
    return;
  }
  if (immutable.has(url.href) || (local && url.search === "?v=40")) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
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
