# QR City Quest — Modding System (Steps 1–3)

The game now has a functioning **Settings → Mods → Install Mod (.zip)** screen. On mobile,
the player picks a ZIP downloaded to the phone; the importer validates it and stores it
locally. Installed mods can be enabled, disabled, updated by reinstalling the same mod
ID, or removed.

**Step 3 is playable:** Enabled expansion NPCs and items are added to the game when it
starts (or after **Settings → Mods → Apply changes / Reload**). The original game data
and save format remain compatible. New selectable languages and **core** language
pack activation are reserved for Step 4.

## Package layout

ZIP entries must be at the archive root, without a wrapping folder:

```text
london.zip
  manifest.js
  london_game_data-en.js
  london_app_data-en.js
  london_game_data-es.js    (optional, if listed in the manifest)
  london_app_data-es.js     (required pair)
  images/example.png        (optional)
```

All imported `.js` files contain **a single assignment of strict JSON data**:
no functions, expressions, comments, or executable scripts. The extension stays `.js`
as agreed, but imported files are parsed as JSON and **never executed**.

Example `manifest.js`:

```javascript
window.QR_CITY_QUEST_MOD_MANIFEST = {
  "id": "london",
  "name": "London Expansion",
  "version": "1.0.0",
  "languages": ["en"]
};
```

No `type` is required. A package with `target` is an independent translation:

```javascript
window.QR_CITY_QUEST_MOD_MANIFEST = {
  "id": "london-es",
  "name": "London Spanish",
  "version": "1.0.0",
  "target": "london",
  "languages": ["es"]
};
```

The translation ZIP must contain `london_game_data-es.js` and
`london_app_data-es.js`. Its parent expansion must be installed and enabled.
Use `target: "core"` with `core_game_data-es.js` /
`core_app_data-es.js` for main-game language packs.

## Validation / conflicts

- Valid IDs, version, language lists, required file pairs, filenames and game-data structure.
- Two-digit local encounter IDs / four-digit local page IDs, valid page references.
- No extra `.js` files, path traversal, symlinks, encrypted archives, or ZIP64.
- ZIP CRC32, image file signatures, size limits (12.5 MB archive, 12 MB extracted,
  2 MB/file, maximum 200 ZIP entries).
- Rejects imported JavaScript execution. It never calls `eval` or loads mod scripts.
- Checks translation gameplay equivalence with the parent's English game data.
- Rejects duplicate enabled QR prefixes, conflicting independent translations,
  missing parent expansions and disabling a required parent while a translation is enabled.
- An expansion must contain English; untranslated expansions fall back to English.
- Existing `qr-city-quest-save-v1` gameplay progress stays untouched.

ZIP compression methods: STORED (0) and DEFLATE (8), using the browser's native
`DecompressionStream("deflate-raw")` for compressed entries. Older browsers without
that API show a decompression-support error.

## Storage and UI

`mod-storage.js` uses IndexedDB `qr-city-quest-mods-v1` /
`packages`. Data remains local to the installed browser/PWA; clearing website storage
deletes it. A mod update replaces the archive in a single IndexedDB transaction.
Enabled expansion content now loads at game startup. Removed or disabled expansion items are hidden in inventory, but progress is retained.

`mod-validator.js` and `mod-registry.js` implement the initial Step 1 framework.
`mod-zip-reader.js`, `mod-storage.js`, and `mod-installer.js` implement Step 2.

Run focused Node tests:

```sh
node tests/test-mod-installer.js
node tests/test-mod-runtime.js
```

The browser UI must also be tested manually on a phone before considering Step 2
production-verified. Install London first, then its separate Spanish translation.

## Step 3: Scanning playable expansions

After installing the London example ZIP, press **Apply changes / Reload**.
Scan the QR with text `london:02`, or open
**Settings → Debug Tools → Encounters → Simulate Scan → london:02**
when developer/debug mode is enabled. Existing QR codes like `02` still open
the original Merchant.

Mod data uses **local** IDs in the ZIP, which are automatically prefixed at runtime:

| Local reference | Runtime reference |
| --- | --- |
| Encounter `02` | `london:02` |
| Dialogue page `0201` | `london:0201` |
| Item `Magic Key` | `london:Magic Key` |
| Quest `Find Tower` | `london:Find Tower` |
| Area `BRIDGE` | `london:BRIDGE` |

Buttons and dropdown destinations, items, quests, knowledge, areas, and counter
targets are namespaced. Actions including `ADD_ITEM`, `REMOVE_ITEM`,
`START_QUEST`, `COMPLETE_QUEST`, `NEXT_SCAN`, and `START_TIMER` use the
existing dialogue engine. Mods cannot call `OPEN_CASTLE` or send players to
the original game's `TITLE_SCREEN` ending.

Button conditions in downloaded mods are **not evaluated as JavaScript**.
They accept Boolean expressions using parentheses, `!`, `&&`, `||`,
comparisons, numbers, quoted strings, and the supported read-only queries:
`had_item.includes("Magic Key")`, `save.inventory.includes("Magic Key")`,
`save.quests["Find Tower"] === "active"`,
`knowledge.includes("localMap")`, `save.flags.unlockedAreas.includes("BRIDGE")`,
and `counter("eats")`. References resolve within the current mod's namespace.
Unsupported expressions are rejected during ZIP validation.

Optional images use `images/portrait.png` and `picture: "portrait"` or
`defaultPicture: "portrait"`. Images are read from the installed ZIP and
displayed through local blob URLs, so no hosting is needed.

**Language note:** An expansion with its own Hungarian (`hu`) translation will
display it when the core game is set to Hungarian. Otherwise that expansion
falls back to English. Separate translation packs are supported for existing
selectable languages; adding new choices like Spanish to Settings is Step 4.

**Testing note:** The Node regression suite checks data integrity and logic.
Real QR scanning, Safari PWA caching, iPhone file storage, and installed image
rendering still require a phone playtest.
