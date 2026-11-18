# Stage 11 live integration

## Source audit

Before Stage 11, the language loader loaded the English baseline, discovered installed
translations in mod storage, selected UI and game content, merged compatible expansions,
and loaded the original app. The app synchronously read `qr-city-quest-save-v1`
and rendered Home. It wrote the same key through `persist()`. The debug reset removed
the key before replacing it. Debug visibility and language settings use distinct keys.

Gameplay writes originate in physical item pickup, expired encounter timers,
dialogue transitions, and debug editors for encounters, inventory and had-items,
quests, knowledge, counters, flags, timers and save reset. Timer wait screens
read timestamps and link back to scanning. Legacy save fields include inventory,
had-items, knowledge, quests, encounters, encounter and item timers, flags, counters,
used buttons and one-time rewards.

Built-in entry points are the camera, debug scan links, debug NPC open/start/resume,
physical item codes, owned items in Inventory, dropdowns, normal buttons, and
timer wait/resume. The original renderer finds pages by numeric and namespaced IDs,
uses global page links and resolves mod images through the installed runtime.
Downloaded v1 JSON declares explicit encounter and item ownership, and linear QR
codes pass through the selected scenario's encounter mapping.

The original dispatcher supports add/remove item, knowledge, quest start/completion,
item timer start/stop, encounter timer start, castle opening, area unlocking,
counter add/set/reset, both dropdowns and next-scan handoff. Terminal destinations
are `HOME`, `-1` and `TITLE_SCREEN`. The original game also uses overdue item
timer redirects, trusted legacy condition expressions and reward conventions.
Stage 10 originally supported normal buttons and a subset of their effects.

Resolver block mode denies access. Preview permits display. Allow permits
out-of-order viewing and safe local dialogue navigation. Allow grants no
checkpoint, visit, timer, saved page, inventory, quest, flag or victory writes.

## Startup and save authority

`index.html` loads the trusted v41 modules. The language loader resolves the UI
preference, then awaits the live coordinator, which opens the
`qr-city-quest-adventure-v1` IndexedDB database, recovers staging and checks the
active record. A downloaded package is revalidated from installed bytes and
compared to the stored content before gameplay opens. The completion engine and
asset lease are pinned to the same startup revision. A completed save opens its
victory screen. A malformed or incompatible save displays a retry screen and
keeps the original records.

On first startup, the coordinator uses Stage 4 migration through Stage 8's
`adoptBuiltInSave`. Identity is `qr-city-quest`, `1.0.0`, `non-linear`. A successful
migration is followed by a read back from IndexedDB. The original localStorage
key stays untouched as a recovery copy. A future activation at a nonzero
revision cannot resurrect it. Language and debug preferences retain their
existing keys and installed mods retain their separate database.

Built-in gameplay awaits revision-checked IndexedDB commits before displaying
updated progress. The UI blocks other input during the write. Failed writes
restore the last committed in-memory copy and show an error. Downloaded
interactions also wait for a complete Stage 4 save write before rendering their
result. A stale or failed downloaded write opens a recovery screen with a saved
state reload. Timer expiry is processed on an authorized revisit, using
persisted timestamps, so abandoned tabs have no scheduled writes to apply to a
new adventure. Browser transaction guarantees are subject to storage eviction
and device failure.

## Selection, maps and assets

The Home **Adventures** entry mounts Stage 9 and the development-branch GitHub
catalog. Stage 7 and Stage 8 still fetch, verify, validate, stage and commit
packages. The app reloads its active context after a successful commit. An
optional activation callback was added to Stage 9. The live browser shows a
resume action and, while playing a download, a built-in switch action.
`activateBuiltIn(expectedRevision, { confirmed })` is a new Stage 8 transaction.
It preserves the active pair on cancellation, conflicts and failures, and starts
a fresh built-in save in the same slot on success.

Linear and circular Home screens open Stage 6 maps with installed assets. The
linear route displays the selected scenario and real checkpoint count and filters
authored markers to applicable QR codes. Non-linear adventures use the existing
Objectives screen. The inventory and knowledge menus use active content. Stage 8
resolves downloaded pictures to local blob URLs. Missing images fall back to
text, and navigation disposes map listeners. Leaving the document releases its
downloaded and mod asset URLs.

## Scanner and dialogue

Camera, manual input and ordinary debug simulation use `acceptScannedText`.
The built-in path keeps the original namespaced and numeric QR resolution,
first-ever item pickup, required areas, saved dialogue and overdue-item
redirects. Original debug edits remain available through the existing debug
entry. Direct built-in page jumps are labeled as developer overrides.
Downloaded debug tools provide authorized QR selection and read-only inspection
of the active save.

Downloaded sessions pass `live: true` to Stage 10. Resolver-issued view identity,
the original button or dropdown option, and the current safe condition are
checked before applying actions. The resolver now supports closing its current
permission and opening a known owned item when the session verifies ownership.
Linear checkpoint confirmation uses Stage 3 and the Stage 2 prefix. A successful
closing transition can advance a checkpoint. A timer or `NEXT_SCAN` handoff
retains the current checkpoint until that interaction finishes. A button that
links to the next scenario encounter returns to scanning without opening that
encounter or inventing its location. A circular package's declared eligibility
applies to its first encounter. Later scans remain unrestricted.

Live Stage 10 executes the v1 item, knowledge, quest, area, castle and counter
actions alongside both dropdowns and the encounter/item timer and scan handoff
actions. The shared safe interpreter also recognizes `save.flags.castleOpen`.
Timer resumes and `NEXT_SCAN` destinations for downloaded packages must stay
within the authored encounter. During a timer wait, dialogue remains read-only.
Built-in overdue-item redirects are supported by the existing dispatcher.
Stage 1 v1 validation still excludes the legacy `overdueItemTimers` package
field. The original game retains its special legacy mechanics. Downloaded game
content never enters its trusted condition evaluator.

The built-in dispatcher uses Stage 10's completion save preparation after
executing its trusted authorized button. Downloads use the Stage 10 completion
session directly. Both flows wait for storage before showing the localized
victory and confirmation UI. Replay updates the same slot and reloads the game.
The Stage 10 standalone API and tester remain available.

## Languages, mods and offline

English, Hungarian, and installed interface language packs still load through
the original loader. Downloaded story strings and display names use the package's
one authored language. Original expansions merge only into the built-in game.
The Mods settings and installer remain available with any active adventure.

The v41 worker installs its versioned app shell as a required batch and keeps
the prior v40 cache during the upgrade. It also tries to cache the pinned
ZXing scanner separately. If the CDN is unavailable, manual entry remains
available. Service worker startup, installed assets and built-in scripts require
a successful initial shell installation. Catalog availability is independent
of local play. Sample ZIPs and browser test files are outside the production
precache. Physical camera access still depends on browser support, permissions,
and a secure context.

## App functions and shared APIs changed

Original functions changed in `app.js`: `persist`, `shell`, `showHome`,
`pictureUrl`, `openItemDialogue`, `showSettings`, `showScanner`,
`acceptScannedText`, `resolveScan`, `checkButtonCondition`, `confirmDropdown`,
`handleTransition`, `resolveDestination`, `showDataError`, `showDebug`,
`showDebugEncounters`, `showDebugInventory`, `showDebugQuests`,
`showDebugKnowledge`, `showDebugCounters`, `showDebugFlags`, `showDebugTimers`,
`showDebugSaveTools`, and `registerOffline`. The old `loadSave`, `defaultSave`
and `showWin` were retired. Startup and page-hide handlers were updated. The
language loader changes are in `start` and `initialize`.

Shared changes are the Stage 8 built-in activation method, the Stage 9 activation
callback, the Stage 3 permission lifecycle additions, and live dispatch,
item/dropdown and progress operations on the Stage 10 session. Stage 10 adds an
optional startup revision guard and a trusted built-in completion helper. The
save schema and existing sample files are unchanged. Stage 4's baseline test
now checks the documented original save contract after retirement of the
duplicated app factory.

## Run the actual integrated app on Windows

```powershell
Set-Location -LiteralPath 'C:\Users\gulya\Desktop\github repo\qr-code-game'
node tools/serve-integrated-game.js
# When Node is available only through VS Code:
$env:ELECTRON_RUN_AS_NODE = '1'
& "$env:LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" tools/serve-integrated-game.js
```

Open `http://127.0.0.1:8000/`. Use a disposable browser profile or a different
port/origin from any existing local playthrough. Run automated checks with
`node tests/test-adventure-integration.js --browser`. Browser tests use real
Chromium, IndexedDB, worker activation and offline network emulation. The test
transport supplies local ZIPs to the live browser for deterministic download
verification. It does not publish those samples to the catalog.

Manual checks:

1. Pick English, then switch to Hungarian in Settings. Verify the original
   NPC and item scans and use Inventory, Objectives and Things I Know.
2. Grant camera access and scan a real QR. Check repeated pickup of a physical
   item, a dialogue image and an enabled mod's namespaced QR. Use a phone on a
   secure HTTPS origin for physical mobile camera and PWA testing.
3. Open Adventures. With a published development package available, install it
   and exercise replacement cancel and confirm. The built-in choice remains
   available when the catalog is empty or offline. The automated suite supplies
   Stage 1 samples for testing all three types without published packages.
4. Play a linear route and check expected, blocked and preview scans. Test a
   circular visit-gated ending and use a non-linear item's dialogue and quests.
5. Complete an adventure, reload, review the summary, cancel replay, then
   confirm it. Switch back to the original and check that it starts fresh.
6. Once the service worker controls the app, use browser offline mode and
   reopen an installed adventure. Check dialogue, map and the active save.

Stage 12 remains responsible for release preparation, production publishing and
broader device verification. A manual QR submission or automated browser scan
simulation cannot establish physical camera reliability.
