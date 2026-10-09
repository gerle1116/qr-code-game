# QR City Quest — Mod Installer (Step 2)

The game now has a functioning **Settings → Mods → Install Mod (.zip)** screen. On mobile,
the player picks a ZIP downloaded to the phone; the importer validates it and stores it
locally. Installed mods can be enabled, disabled, updated by reinstalling the same mod
ID, or removed.

**Important:** This is *installation and management only*. Installed expansions do not
yet add encounters to the runtime, and installed language packs do not yet appear in
Settings → Language. Those features belong to the next engine/localization stages.

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
- An expansion must contain English; untranslated expansions later fall back to English.
- Existing `qr-city-quest-save-v1` gameplay progress stays untouched.

ZIP compression methods: STORED (0) and DEFLATE (8), using the browser's native
`DecompressionStream("deflate-raw")` for compressed entries. Older browsers without
that API show a decompression-support error.

## Storage and UI

`mod-storage.js` uses IndexedDB `qr-city-quest-mods-v1` /
`packages`. Data remains local to the installed browser/PWA; clearing website storage
deletes it. A mod update replaces the archive in a single IndexedDB transaction.
Existing mod *content* is not loaded into gameplay at this stage.

`mod-validator.js` and `mod-registry.js` implement the initial Step 1 framework.
`mod-zip-reader.js`, `mod-storage.js`, and `mod-installer.js` implement Step 2.

Run focused Node tests:

```sh
node tests/test-mod-installer.js
```

The browser UI must also be tested manually on a phone before considering Step 2
production-verified. Install London first, then its separate Spanish translation.
