# Stage 9: Adventure Selection UI

The reusable Adventure Browser presents catalog discovery, adventure details,
installation progress and safe replacement. It uses the actual Stage 7 catalog
API, Stage 8 download/extraction/validation/storage pipeline, and Stage 4 saves.
No gameplay engine, downloader, manifest format or save manager is duplicated.
The live application does not load this component. Gameplay launch, victory,
original-game switching and Stages 10/11 are not implemented.

## Files

Created:

| File | Purpose |
| --- | --- |
| `adventure-system/adventure-browser.js` | Mountable browser UI, navigation, async lifetime, confirmation and translation helpers |
| `adventure-system/adventure-browser.css` | Scoped responsive forest/earth styling, focus indicators and reduced-motion rules |
| `adventure-system/adventure-browser-tester.html` | Actual component host with clearly separated development controls |
| `adventure-system/adventure-browser-tester.js` | Demo/real-development modes, isolated storage and injected test transport |
| `tests/test-adventure-browser.js` | Node tests and real browser suite entry point |
| `tests/adventure-browser.html` | Browser module and test loading |
| `tests/adventure-browser.js` | Actual Chromium, IndexedDB, verified-package and UI checks |
| `adventure-system/ADVENTURE_BROWSER.md` | This API, workflow and operating guide |

Modified: `tests/run-stage8-browser.js`, the shared development-only Chromium
driver, adds optional native keyboard events and screenshot capture. Its existing
three-argument API remains compatible. No Stage 7/8 runtime API, security limit,
storage policy, production catalog or live game file changes were required.

## Mount and component ownership

Load the Stage 8 browser dependencies in their existing order (the tester HTML
shows the complete list), then `adventure-browser.js` and `adventure-browser.css`.
The browser global is `QRCQAdventureBrowser`; CommonJS exports the same API.

```js
const storage = QRCQAdventureStorage.createAdventureStorage({
  name: 'your-explicit-application-namespace'
});
const browser = QRCQAdventureBrowser.createAdventureBrowser({
  container: document.getElementById('adventures'),
  storage,
  catalogURL: QRCQAdventureCatalog.DEFAULT_CATALOG_URL,
  locale: 'en',
  messages: {},
  dependencies: {}
});
await browser.ready;
// Later, when navigating away:
await browser.destroy();
// The supplied storage belongs to the caller; close it only when appropriate.
```

Mounting creates only one root element in the supplied container. CSS selectors
are scoped to `.ab`. The component owns its selection, DOM, async cancellation,
dialog and asset leases. Use one component per storage namespace at a time.

Startup calls `storage.recover()` once, reads `storage.snapshot()`, then loads the
catalog. Recovery is not called on refresh, details navigation, cancellation or
ordinary rendering. The current adventure appears before catalog fetching ends.
`ready` resolves after startup/catalog handling, including a displayed error state.
A storage error blocks installation rather than treating unreadable progress as
an empty store.

Public operations:

* `refreshCatalog(url?)`: request/validate catalog metadata; optional URL changes
  the source for subsequent refreshes. It never installs or changes an adventure.
* `refreshActive()`: reread the persisted active pair; refresh local cover leases.
* `openDetails(id)`: show a validated catalog entry; returns false when unavailable
  or while an installation is pending.
* `back()`: return from details, cancelling preparation/pending replacement first.
  During activation it returns false: an atomic commit must finish safely.
* `cancelInstallation()`: abort/discard preparation or a pending replacement;
  returns false during commit.
* `destroy()`: remove DOM/listeners, abort catalog/preparation requests, discard a
  pending handle and dispose asset URLs. It does not abort an activation already
  started or close caller-owned storage. Reopening must read persisted state.
* `getState()`: copied UI diagnostics (`busy`, `committing`, phase, selected/active
  ID, destroyed); not a competing installation/save record.

`pagehide` triggers cleanup. Unload-time async work is best effort; Stage 8 recovery
removes abandoned staging on the next opening. If a commit finishes while detached,
its result cannot repaint a destroyed component. There is no live-game launch API.

## Catalog, details and covers

`fetchCatalog` handles HTTPS metadata; `filterAdventures` implements name/description
search, canonical type, full content-language code, location substring, maximum
recommended minimum age, and name/duration sorting. Filters combine with AND and
do not mutate metadata. Clear Filters returns to catalog order. Empty catalogs
show a friendly publication message, while no matches show a different filter
message. Loading, offline/network, invalid catalog and timeout states are distinct.
Fetch errors offer Try Again and leave the active adventure visible.

Production defaults to the Stage 7 main-branch raw catalog URL. The tester's real
mode targets the independent `adventure-system` branch URL. An empty production or
development catalog is valid; no demo entries are inserted into it.

Cards show name, short description, type, content language, duration, minimum age
and location. Details add full description, author, version and the existing type
explanation. Linear/circular navigation is Map; non-linear navigation is Objectives.
Circular adventures are not described as fixed routes. Stage 7 normalizes the
`nonlinear` catalog alias to canonical `non-linear` before display.

All catalog text uses DOM `textContent`, not HTML interpolation. Default online
covers use the validated Stage 7 HTTPS `coverUrl`, with no-referrer and lazy loading.
Failed images are removed, leaving a styled placeholder rather than a broken icon.
Remote covers are never required to access stored data. For the current adventure,
only `manifest.cover` from the stored package is used via Stage 8
`createAssetLoader()`. Missing covers use placeholders. Each old lease is disposed
on refresh and destruction; blob URLs are not persisted or accumulated.

The active panel shows the stored name/type/content language/version, unfinished
or completed status, and offline file availability. An exact matching catalog
version gets an Active badge. A different catalog version shows the installed
version and an explicit install-this-version action. Reinstalling/updating uses
the same Stage 8 replacement policy; progress is not silently migrated.

## Installation and explicit confirmation

Download Adventure calls `prepareAdventureInstallation(entry, {storage, signal,
fetch, onProgress})`. The component never directly writes saves, activates package
files or manually deletes an old adventure. Its busy guard blocks duplicate clicks.
Progress displays download bytes when provided and readable messages for verifying,
extracting, validating, staging, awaiting confirmation, activating and completion.

When Stage 8 returns `requiresConfirmation:true`, the native accessible modal shows
both current and replacement names and warns that unfinished progress will be lost.
Keep Current Adventure has initial focus. Keep/Escape calls the handle's cancel
operation and preserves the existing pair. Native dialog focus trapping, Tab,
Shift-Tab and Escape are used; closing returns focus to the installation action.

Only the explicit Replace Adventure button calls `installation.commit` with
`confirmed:true`. It is not inferred from selecting a card, downloading, opening a
dialog, retrying or waiting. First installs and completed-save replacements follow
Stage 8 policy with `confirmed:false`, without adding a contradictory second policy.
If Stage 8 returns `CONFIRMATION_REQUIRED` at commit, the UI opens the warning.

The UI reports success only after `commit` returns `ok:true`. During the final
commit cancellation controls are disabled; closing the entire component allows the
transaction to finish. A subsequent opening recovers/reads the actual stored pair.
Failures use ordinary-language messages for network/HTTP/timeout, ZIP/package/image,
size/hash, metadata mismatch, quota and stale progress; retry starts the real
preparation pipeline again. A failed commit is never reported as success.

Separate generation counters guard catalog requests, active reads and installation
results. Replaced/closed requests cannot select a new adventure, reopen a dialog,
display a stale success or replace the visible active state. Stage 8 revision checks
remain authoritative if saves change during preparation/confirmation.

## Built-in adventure and offline limits

With no downloaded package, the original built-in QR City Quest is clearly shown
as the default. There is no fake built-in catalog ZIP, save-slot selector or My
Downloads library. The component never reads/migrates/resets the original live
localStorage save. It also handles a supplied Stage 8 built-in record without
creating a new legacy persistence scheme.

Downloaded data remains visible through IndexedDB when the catalog/network fails.
The UI does not require fetching the catalog to identify the active adventure or
obtain local cover bytes. This does not mean shared PWA app code or this development
HTML page has been cached for offline launch. No service worker is registered here.
Gameplay launch and original-game switching are marked as pending integration,
with no button that silently clears existing progress.

## UI localization and accessibility

`locale` controls interface text/number formatting independently of the adventure's
single content-language code. `messages` injects translations by key; English is
the fallback. `HU` is an initial partial Hungarian dictionary: missing translations
remain English, deliberately, until completed. No adventure text is translated or
offered in a different content language. Live language files are untouched.

The UI uses semantic headings, explicit nested form labels, native buttons, visible
focus indicators, large touch targets, a named modal with described warning,
screen-reader live status/progress, responsive covers, and reduced-motion CSS.
Details/back navigation moves focus appropriately. Cards use one column on narrow
phone viewports and two on wider screens. No interaction depends on hover.

## Dependency injection for the standalone tester

`dependencies` supports:

* `catalogFetch(url, options)`: injected network transport passed to Stage 7.
* `downloadFetch(url, options)`: injected transport passed to Stage 8.
* `resolveCover(entry)`: optional trusted cover-resource resolver; demo mode returns
  null for sample packages without published cover artwork.
* `catalogTimeoutMs`: catalog deadline; defaults to 10000.
* `downloadOptions`: trusted additional Stage 8 test/integration options. Storage,
  signal, transport and progress callback remain controlled by the component.

These are application dependencies, not executable code supplied by a package.
Normal operation uses the actual Stage 7/8 exports. There is no mock downloader
inside the component.

## Launch the standalone tester in VS Code on Windows

1. Open this repository folder in VS Code.
2. Select **Terminal → New Terminal**, using PowerShell at the repository root.
3. Run:

   ```powershell
   $env:ELECTRON_RUN_AS_NODE = '1'
   & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools/serve-adventure-catalog.js | Out-Host
   ```

   With Node installed on PATH, `node tools/serve-adventure-catalog.js` also works.
4. Open **http://127.0.0.1:8000/adventure-system/adventure-browser-tester.html**.
5. Demo Mode uses `samples/packages/catalog.json` and the existing real sample ZIPs,
   with their measured sizes and checksums. Its injected transport maps fixture
   HTTPS placeholders to local files; Stage 7 validation/filtering, Web Crypto,
   ZIP extraction, Stage 1 validation, Stage 4 saves and IndexedDB remain real.
6. Search/filter, open details, download a sample, then try another. Choose Keep
   Current Adventure or Replace Adventure after preparation. Reload to check that
   the active adventure persists.
7. Use the clearly labeled simulated offline/network controls to block subsequent
   test requests. Stored data remains visible. Turn them off and retry to recover.
8. Select Development GitHub catalog to request the actual branch-specific catalog;
   it can validly be empty. Demo entries are never advertised as published packages.
9. Ctrl+C in the terminal stops the server. Use a different server/Live Server if
   port 8000 is occupied. Direct `file:///` opening is unsuitable for these tests.

Tester database: **`qrcq-stage9-adventure-browser-tester-v1`**, distinct from live
storage and the Stage 8 tester. Mode/language changes destroy the old component
before mounting another. Failure controls do not recover/discard staging mid-flow.
The test browser uses a temporary profile and another isolated automated database.
No tester touches the original legacy save or an installed real-game adventure.

## Automated verification

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tests/test-adventure-browser.js --browser | Out-Host
```

Or `node tests/test-adventure-browser.js --browser`. Omit `--browser` for the Node
tests only. Browser mode runs actual headless Chromium with the real modules and
IndexedDB, and uses native DevTools keyboard events for Enter, Tab, Shift-Tab and
Escape. Set `QRCQ_TEST_BROWSER` to another Chromium/Edge executable if needed.
Optional `QRCQ_BROWSER_SCREENSHOT` writes a phone-width tester screenshot for review.
Network responses are deterministic injected test transports, not a claim that a
remote GitHub download was exercised. Physical phone/Safari and assistive-technology
certification remain manual checks.

## Stage 11 integration requirements

Stage 11 must supply the real app's storage/locale/container, cache shared app code,
bootstrap the built-in legacy save deliberately before offering live switching,
connect the persisted active pair to gameplay and asset loading, and manage app
navigation/teardown. It must preserve the explicit confirmation contract and use
Stage 8's revision-aware save writes. Offline stored data access is ready, but
actual gameplay launch, scanner wiring, victory and original-game integration are
outside Stage 9. No Stage 10 or Stage 11 work is included.

## Verification on 2026-11-17

Stage 9 passed 27 Node checks and 48 actual Chromium checks, zero failures. The
Node runner reports 28 passes with `--browser`, since its browser harness is counted
as one additional wrapper test. A phone-width screenshot was visually reviewed.
Native keyboard, 390px layout, desktop columns, real ZIP verification/validation,
IndexedDB replacement/reopen, stale/quota failures, close-during-commit and blob
cleanup were exercised. Remote GitHub availability and physical phone/Safari
behavior were not certified.

Stage 1–8 runner results: 96/85/64/89/50/27/128/83 passed respectively, all zero
failures. Their actual Stage 6/7/8 browser harnesses also passed 22/18/20 checks.
Mod runtime passed 10, installer passed 14. Localization passed 12 and failed its
documented Spanish preview ZIP comparison:
`core:es.encounters: keys differ; core:es.items: keys differ`.

Only the eight new Stage 9 source/documentation/test files and the shared
development browser driver changed. Stage 7/8 runtime modules, production catalog,
live app files, original data, scanner and legacy saves remain untouched. No
commit, push, merge, main-branch modification or later-stage work was performed.
