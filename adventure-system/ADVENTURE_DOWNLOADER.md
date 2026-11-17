# Stage 8: Adventure Downloader and Offline Storage

Stage 8 downloads catalog packages, verifies their bytes, extracts data-only files,
runs the actual Stage 1 validator, stages them in IndexedDB, and explicitly commits
one active adventure/save pair. It is standalone. No live app, scanner, debug menu,
service worker, original data or existing gameplay save is read or changed.

## Runtime modules and package format

Browser globals (CommonJS exports have the same APIs):

* `QRCQAdventureZip`: secure ZIP extraction; reuses the mod reader's CRC32.
* `QRCQAdventureValidator`: existing Stage 1 validator, now also accepts in-memory
  file dictionaries through `validateFiles(files)`. Disk `validatePackage` and its
  CLI still work. The rules are shared, not rewritten for the downloader.
* `QRCQAdventureStorage`: IndexedDB and the package/save coordination layer.
* `QRCQAdventureDownloader`: download, verification, validation and staged handles.

Load the shared `mod-conditions.js`, `mod-zip-reader.js`, `scenario-engine.js`,
`encounter-history.js`, generated `adventure-schemas.js`, `validator.js`,
`adventure-save.js`, `adventure-catalog.js`, `adventure-zip.js`,
`adventure-storage.js` and `adventure-downloader.js` in that order. Browser runtime
paths do not require Node APIs or third-party libraries. The Node-only fixture
builder/server/browser driver are development tools.

The ZIP root must contain `manifest.json` and the manifest's JSON `gameData` file.
Linear adventures also require the manifest's JSON `scenarios` file. Circular and
non-linear adventures must not declare scenarios; no route is synthesized. Images
use safe relative paths from the established format, for example:

```text
manifest.json
game-data.json
scenarios.json       # linear only
images/map.png       # when referenced
images/cover.png     # optional, when referenced
images/guard.png     # when referenced by dialogue
```

No enclosing adventure-name directory. Only JSON and PNG/JPEG/WebP files are
allowed, including unreferenced members; no scripts, HTML, SVG or nested archives.
Directories may be explicitly listed or inferred. The manifest, all game/scenario
data, maps and dialogue pictures must be inside the package. Shared core app code
is not bundled. All three existing Stage 1 samples remain valid without changes.

## Downloader API

```js
const storage = QRCQAdventureStorage.createAdventureStorage({
  name: 'your-explicit-adventure-storage-namespace'
});
await storage.recover(); // startup: discard abandoned staging, retain active pair

const controller = new AbortController();
const prepared = await QRCQAdventureDownloader.prepareAdventureInstallation(entry, {
  storage,
  signal: controller.signal,
  timeoutMs: 30000,
  onProgress: event => console.log(event.phase),
  // Optional injected dependencies:
  // fetch, digest, extract, decodeImage, limits
});
if (!prepared.ok) {
  console.error(prepared.code, prepared.message, prepared.errors);
} else {
  const pending = prepared.installation;
  // Show pending.warning and pending.requiresConfirmation to the future UI.
  // This separate operation must follow an explicit user choice:
  const result = await pending.commit({ confirmed: true });
  // Or await pending.cancel(); no active data changes.
}
```

Do not pass `confirmed:true` automatically in future UI code when unfinished
progress exists. `commit()` without it returns `CONFIRMATION_REQUIRED` and leaves
the old pair and staging intact. First installation and replacement of explicitly
completed saves may commit without abandonment confirmation. Reinstallation and
updates follow the same protection rules.

`prepareAdventureInstallation` returns `{ok:true,installation,adventure,warnings}`
or `{ok:false,code,message,errors?}`. It never auto-activates. The public prepared
save is a preview; editing it cannot alter the actual fresh save committed later.
The handle is single use after success or cancellation.

Lower-level operations:

* `downloadAdventure(entry, options)` returns `{ok:true,bytes,entry}` or an error.
  It revalidates the Stage 7 entry, downloads the ZIP, and checks exact size.
* `verifyPackageSize(Uint8Array, expectedSize)` returns `{ok:true}` or a mismatch.
* `verifyPackageChecksum(bytes, sha256, {digest?})` returns an integrity result.
  Native SHA-256 uses Web Crypto; injected digests return hexadecimal or bytes.
* `extractAdventurePackage(bytes, {limits?,signal?,inflate?})` returns a dictionary
  of `Uint8Array` files, or throws a coded ZIP/cancellation error. Inflaters are
  trusted low-level dependencies and must bound allocation during decompression.
* `validateAdventurePackage(files, entry, {decodeImage?,signal?})` returns validated
  `{adventure,files,warnings}` plus `ok:true`, or actionable errors. It runs all
  Stage 1 structures, cross-file references and completion checks, compares all
  shared catalog metadata, and decodes every raster image. The default image
  decoder uses `createImageBitmap` and closes each bitmap immediately. Tests can
  inject a decoder; Node has no native browser image decoder.

Only the complete prepare pipeline guarantees checksum-before-extraction.
Lower-level functions are exposed for testing and integration, not proof that
their inputs are authenticated. Injected network, digest, extraction and backend
implementations are trusted code; do not accept executable dependencies from ZIPs.

HTTPS download references use Stage 7 URL checks. GitHub releases can redirect to
HTTPS asset hosts; final response URLs are checked again for HTTPS, credentials,
ports and local literals. Redirects are allowed for release hosting, unlike Stage
7 catalog fetching. Size and hash apply to the original ZIP bytes, before any
extraction. Catalog integrity protects against mismatched downloads, not against
a malicious catalog publisher who controls both the package and checksum.

Errors include `SIZE_MISMATCH`, `CHECKSUM_MISMATCH`, `PACKAGE_TOO_LARGE`,
`INVALID_ZIP`, `INVALID_PACKAGE`, `INVALID_IMAGE`, `CATALOG_MISMATCH`,
`HTTP_ERROR`, `NETWORK_ERROR`, `TIMEOUT`, `CANCELLED`, `STALE_TRANSITION`,
`CONFIRMATION_REQUIRED`, `CRYPTO_UNAVAILABLE`, `IMAGE_DECODER_UNAVAILABLE`, and
storage errors such as `QuotaExceededError`. Existing active state is retained
on failures before an atomic activation commits.

## ZIP audit and limits

The existing mod ZIP reader is not reused as an adventure installer: its allowlist
expects JavaScript assignment data, and it lacks the required ratio, normalized
directory and local-range checks. Stage 8 reuses its CRC32 implementation only.
The adventure extractor checks every central and local header before decompression.

Defaults, configurable through `options.limits` (positive safe integers):

| Limit | Default |
| --- | ---: |
| `maxArchive` | 32 MiB |
| `maxFiles` | 256 entries, including directories |
| `maxFile` | 8 MiB uncompressed per file |
| `maxTotal` | 64 MiB uncompressed per archive |
| `maxRatio` | 200 uncompressed/compressed per entry |

It rejects absolute paths, traversal, backslashes, encoded path tricks, Windows
reserved basenames, trailing dots, duplicate names, case-ambiguous names or
directory components, file/directory collisions, symlinks, devices, mismatched
headers, overlapping or hidden local data, ZIP64, multi-volume archives, encrypted
or unsupported flags, unsupported methods, and unsafe extensions. Supported
compression is STORED (0) and DEFLATE (8), using bounded `DecompressionStream` reads.
Declared size, actual output size and CRC must agree. Standard data descriptors
are checked when present. Alternate Unicode path and encryption extras are refused.
No archive entry is written to arbitrary filesystem paths or executed.

Declared catalog size is checked before fetching against the maximum. HTTP
Content-Length is checked when present; streamed bodies stop on overflow. Adapters
without a readable stream fall back to `arrayBuffer`, so that adapter may allocate
the response before the post-read size check. Real browser fetch uses streaming.
Limits bound ZIP/file bytes, not every native decoder's internal pixel allocation.

## Storage, saves and atomic switching

An explicit database namespace is mandatory, so creating a tester cannot silently
choose live storage. Database version 1 has one `state` object store, with key
`pair` containing:

```text
{storageVersion:1, revision,
 active: null | {kind, adventure, files, save},
 staging: null | {token, baselineRevision, baselineSave, adventure, files}}
```

`active.save` is the actual unchanged Stage 4 save format. There is exactly one
active package and one active save, and at most one temporary replacement.
Original ZIP bytes and old-package libraries are not retained. Each stage replaces
the previous staging record. Storage revalidates Stage 1 content before staging;
Stage 4 creates/validates saves and performs the prepared-transition handoff.

Preparation captures the current revision before downloading. Staging refuses
stale revisions. Commit checks the staging token and revision, obtains a fresh
Stage 4 transition from the captured old save, calls its explicit commit against
the current save, and writes the new package/save with staging removed. It uses a
single IndexedDB readwrite transaction and waits for `oncomplete`. The old package
and save are removed by that same record replacement, not by an earlier delete.
Concurrent-tab writes are serialized by IndexedDB and checked with revisions.

`updateSave(save, expectedRevision)` must be used by future gameplay persistence;
it runs Stage 4 validation and increments the revision, making pending switches
stale. Never write a live save to a separate localStorage key while using this
coordinator: cross-storage atomicity is not provided.

An empty store means the built-in original adventure remains the default. The
coordinator never reads the original game's localStorage. A future integration
must explicitly call `adoptBuiltInSave(raw)` with a supplied legacy/Stage 4 save
before offering a switch from unfinished built-in progress. That method uses
Stage 4 migration, preserves the source, and refuses to overwrite an active pair.
No original data or downloaded package is needed for that built-in identity.

Other storage operations:

* `snapshot()` → `{revision,active}`; `getActive()` → active record or null.
* `stage(bundle, baseline)` / `commit(token, {confirmed,signal})` / `discard(token)`
  implement the lower-level handoff. Prefer downloader handles for ordinary use.
* `recover()` clears abandoned staging and returns the existing active pair.
  It also invalidates a pending handle in another tab; that tab must prepare again.
* `clear({confirmed:true})` explicitly removes this namespace's active/staging data;
  unfinished active progress requires confirmation. It never clears preferences,
  mods, original game files or the legacy live save.
* `getAsset(path)` returns copied stored bytes or null, without network access.
* `close()` releases the database connection.

## Recovery guarantees and limits

Before activation, old state remains active even if fetching, integrity checks,
validation, staging, quota allocation or cancellation fails. On startup `recover`
discards a replacement abandoned during preparation/confirmation. No partial
new package is exposed as active.

During the activation transaction, IndexedDB provides an all-or-nothing logical
write of the complete pair. A transaction abort retains the old pair. An observed
successful commit exposes the new pair and no old package. If execution stops
after commit but before the caller receives success, reopen and read the pair;
the outcome may already be the new adventure. Never attempt to restore an old save
alone after an ambiguous interruption.

Tests simulate interruption before commit and loss of acknowledgement after
commit, perform a real IndexedDB abort after a write request succeeds, and reopen
databases/pages to verify consistency and staging cleanup. They do not physically
cut power or kill the OS. Browser/OS durability, user-cleared storage, device loss,
eviction and storage corruption are outside an application's transactional
guarantee. Unknown storage versions or invalid save pairs are retained and reported
for explicit recovery rather than silently reset. No claim of physical power-loss
durability beyond IndexedDB's browser-managed guarantees is made.

## Progress, cancellation and assets

Progress phases: `downloading` (with received/total bytes when streamed), `verifying`,
`extracting`, `validating`, `staging`, `awaiting-confirmation`, `activating`,
`complete`, and `cancelled`. Callback failures cannot corrupt installation.
Preparation accepts an AbortSignal; download timeouts cover request and body.
Cancellation is checked between verification/extraction/validation operations and
while decompression chunks are read. Native crypto/image calls finish their current
operation before cancellation is observed. Cancelling a staged handle removes only
its matching staging token. Once the final transaction begins, it cannot safely
be interrupted by a UI cancel; `cancel()` reports `COMMIT_IN_PROGRESS`. A signal
aborted before the write callback executes is still honored.

For Stage 6 maps:

```js
const assets = await storage.createAssetLoader();
const map = QRCQMapRenderer.createMapRenderer({
  container, adventure: assets.adventure, resolveAsset: assets.resolveAsset
});
// When the map/adventure closes:
map.renderer?.destroy();
assets.dispose();
```

Each lease caches at most one blob URL per stored raster asset. Dispose revokes
all URLs and prevents new creation; it is safe to call twice. Dispose old leases
on replacement/reload. These URLs are not persisted; the stable interface is the
validated package-relative path. Manifest/game/scenario data and all assets can
be read without any network calls after installation.

## Standalone tester: VS Code on Windows

1. Open the repository folder in VS Code, then **Terminal → New Terminal**.
2. In PowerShell at the repository root, run:

   ```powershell
   $env:ELECTRON_RUN_AS_NODE = '1'
   & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools/serve-adventure-catalog.js | Out-Host
   ```

   Or use `node tools/serve-adventure-catalog.js` with Node installed on PATH.
3. Open **http://127.0.0.1:8000/adventure-system/downloader-tester.html** in Chrome/Edge.
4. Select a sample and click **Prepare installation**. Review the progress and
   save-replacement warning; click **Activate prepared adventure** to confirm.
5. Prepare another sample, then cancel it. Try **Simulate failed installation**
   and the clearly labeled simulated offline checkbox. Both retain active data.
6. Reload the page and use **Read installed data again**. Manifest, save and maps
   reload from IndexedDB. **Clear tester data** only clears its isolated namespace.
7. **Ctrl+C** stops the server.

The tester uses the actual downloader, Stage 1 validator, Stage 4 Save Manager,
IndexedDB backend and Stage 6 renderer. Database name:
`qrcq-stage8-installation-tester-v1`. No live-game storage is used. The injected test
transport maps fixture HTTPS placeholders to real local sample ZIPs; sizes and
SHA-256 values are generated from those ZIP bytes. It does not claim that these
fixtures have been published to GitHub. The production catalog remains empty.

This test-only offline switch blocks downloads; it does not cache the development
HTML/app code. Localhost must serve the tester page itself. Direct `file:///`
opening is unsuitable for IndexedDB/fetch/Web Crypto testing. The localhost helper
serves only tester resources and the two shared mod dependencies, plus precisely
the three fixture ZIP paths; it does not serve the live app or original game data.

Regenerate deterministic ZIPs, real size/checksum metadata, and the browser schema
bundle after changing samples/schemas:

```powershell
& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools/build-adventure-fixtures.js | Out-Host
```

Tests (same `ELECTRON_RUN_AS_NODE` environment):

```powershell
& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tests/test-adventure-downloader.js --browser | Out-Host
```

Browser mode uses installed Chrome (override `QRCQ_TEST_BROWSER` for Chromium/Edge),
a temporary browser profile, a localhost server, actual image/crypto/IndexedDB APIs,
and real-time DevTools polling. Temporary profiles are deleted after completion.
Node tests inject a transactional memory backend and PNG decoder; they are
distinguished from actual IndexedDB/browser tests. Physical phone/Safari tests and
real remote GitHub download availability have not been certified.

## Future integration boundaries

Stage 9 can render catalog/install progress and confirmation dialogs around the
existing handles. It must not auto-confirm unfinished progress. There is no
library or My Downloads interface, and none is required by this design.

Stage 11 must cache/load shared app code in the existing PWA, bootstrap/migrate the
built-in save explicitly, recover before gameplay starts, load the active pair
without a network dependency, replace live persistence with coordinator revisions,
connect map/encounter assets and safe dialogue actions, dispose leases on switch,
and test offline launches on phones. Requesting persistent storage and presenting
eviction/quota recovery also belong to live integration. Neither Stage 9 UI nor
Stage 11 service-worker/gameplay integration is implemented here.

## Verified results and file inventory

On 2026-11-17, Stage 8 passed 83 runner checks, including the browser harness;
that harness executed 20 browser checks, all passing. Stage 1–7 runner counts were
96, 85, 64, 89, 50, 27 and 128 respectively, with zero failures. Stage 6's 22 and
Stage 7's 18 browser checks also passed. Mod runtime passed 10, installer passed
14. Localization passed 12 before the existing Spanish preview ZIP mismatch:
`core:es.encounters: keys differ; core:es.items: keys differ`.

Created files:

| File | Purpose |
| --- | --- |
| `adventure-system/adventure-downloader.js` | Integrity-checked download and prepared installation API |
| `adventure-system/adventure-zip.js` | ZIP metadata checks and bounded extraction |
| `adventure-system/adventure-storage.js` | Single-pair IndexedDB coordination and asset leases |
| `adventure-system/adventure-schemas.js` | Generated browser copy of Stage 1 JSON schemas |
| `adventure-system/downloader-tester.html` | Isolated tester page and script dependencies |
| `adventure-system/downloader-tester.js` | Actual install/confirm/cancel/offline test controls |
| `adventure-system/samples/packages/linear.zip` | Real deterministic Stage 1 linear sample package |
| `adventure-system/samples/packages/circular.zip` | Real deterministic Stage 1 circular sample package |
| `adventure-system/samples/packages/non-linear.zip` | Real deterministic Stage 1 non-linear sample package |
| `adventure-system/samples/packages/catalog.json` | Local fixture metadata with measured sizes and real hashes |
| `tests/test-adventure-downloader.js` | Node integrity/security/switching tests and browser entry point |
| `tests/downloader-browser.html` | Actual browser module/test loading |
| `tests/downloader-browser.js` | Actual IndexedDB, crypto, image, recovery and tester checks |
| `tests/run-stage8-browser.js` | Real-time headless Chrome driver for asynchronous IndexedDB tests |
| `tools/build-adventure-fixtures.js` | Rebuild sample ZIPs, hashes and schema bundle |
| `adventure-system/ADVENTURE_DOWNLOADER.md` | APIs, boundaries, guarantees and launch instructions |

Modified files:

* `adventure-system/validator.js`: shares the existing Stage 1 validation logic
  between disk and extracted files; adds a browser export without Node dependencies.
* `tools/serve-adventure-catalog.js`: serves the three local fixture ZIPs and two
  shared mod dependencies required by the standalone tester.

All live gameplay files and the Stage 4 Save Manager remain unchanged. There was
no publication, commit, push, merge, live-storage installation or Stage 9 work.
