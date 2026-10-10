# QR City Quest — Modding System (Steps 1–4)

The game now has a functioning **Settings → Mods → Install Mod (.zip)** screen. On mobile,
the player picks a ZIP downloaded to the phone; the importer validates it and stores it
locally. Installed mods can be enabled, disabled, updated by reinstalling the same mod
ID, or removed.

**Step 4 is implemented:** Enabled expansion NPCs and items work alongside the base game.
Complete, enabled main-game language packs also appear in **Settings → Language**.
Independent language packs for an expansion translate only that expansion.
The base-game save format and original English/Hungarian content remain compatible.

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
node tests/test-mod-localization.js
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

**Language note:** When the base game is set to a language, each expansion uses
its own matching translation, a separately installed pack targeting that expansion,
or its English fallback. The original English/Hungarian languages remain available
even without installed language packs.

**Testing note:** The Node regression suite checks data integrity and logic.
Real QR scanning, Safari PWA caching, iPhone file storage, and installed image
rendering still require a phone playtest.

## Step 4: independent language packs and dynamic language selection

The app first loads the trusted English main-game data and interface text for
compatibility checks. It then discovers enabled ZIPs whose `manifest.js` includes
`target: "core"`. Only complete, structurally compatible packs become selectable
in **Settings → Language** (and the first-launch language picker).

Example Spanish main-game translation ZIP:

```text
core-spanish.zip
├── manifest.js
├── core_game_data-es.js
└── core_app_data-es.js
```

```javascript
window.QR_CITY_QUEST_MOD_MANIFEST = {
  "id": "spanish-core",
  "name": "Spanish Main Game Translation",
  "version": "1.0.0",
  "target": "core",
  "languages": ["es"]
};
```

**There is no `type` field.** `target: "core"` identifies a main-game translation;
`target: "london"` identifies an independent London translation. Installing only
`london-es` **does not expose Spanish as a whole-game language**; it becomes
usable once a complete Spanish translation for the original game is installed.
A complete pack must include both matching file names, all main-game data
references, and every built-in interface text key. The importer does not
execute any ZIP-provided JavaScript: the `.js` files hold assignments containing
strict JSON objects.

### Core game data

`core_game_data-es.js` contains a static `window.QR_CITY_QUEST_DATA = { ... };`
assignment. Start with the **entire** structure of `data/game-data_en.js` and
translate only visible content (speaker, dialogue text, choice label,
item display names, quest labels, knowledge folder titles). **Never change**
IDs, page destinations, actions, conditions, item identifiers, counters,
flags, logic, or other internal engine values. English/Hungarian built-in
scripts are unchanged.

### Core application text

`core_app_data-es.js` contains static `window.QR_CITY_QUEST_APP_TEXT = { ... };`
using **all** keys from `data/apptext_en.js`. Ordinary keys are translated strings.

For a key that is a function in built-in `apptext_en.js`, use a safe
placeholder template instead of a function. Examples:

```javascript
window.QR_CITY_QUEST_APP_TEXT = {
  "...": "...",
  "modInstalled": "{name} instalado correctamente.",
  "itemAddedToInventory": "{itemName} añadido al inventario.",
  "unknownAction": "Acción desconocida {type} en {page}."
};
```

(The illustration above is **not** a full app text file; all other existing
English app keys must also be present.)

Placeholders must be preserved. Supported placeholder names and associated keys:

| Keys | Required variables |
| --- | --- |
| modInstalled | name |
| itemAddedToInventory | itemName |
| timerDebugLabel | mins |
| encounterWaitingWithoutTimer | id |
| timerMissingPage | id, page |
| pageDoesNotExist, noDropdownDestination, timerOnlyForEncounter, timerNeedsResumePage | page |
| buttonHasNoDestination | button, page |
| counterActionNeedsItem, counterActionNeedsName, counterActionInvalidNumber | type |
| unknownAction | type, page |
| nextScanOnlyForEncounter | page |
| nextScanInvalidPage | page, destination |
| unknownDestination | destination |

The localizer recreates the required interface functions from the strings.
It does **not** use `eval`, imported scripts, or `new Function`.

### Language fallback and removal

- English and Hungarian are always selectable.
- Other languages appear only when an **enabled and complete** main-game
  translation exists.
- Each enabled expansion can ship its own translation or use a separate
  `target: "london"` translation mod. They use English when the selected
  language is not available for that expansion.
- The installer prevents disabling a parent expansion while its dependent
  language pack is enabled.
- Removing/disabling a main-game language pack removes its language from the
  selector on the next reload. If a saved language disappears, the initial
  language picker appears rather than failing to load.
- Switching languages reloads the app but never clears game progress.

Phone test: install an actual complete Spanish main-game language ZIP,
reload, select **español** in Settings → Language, then compare the main game
and `london:02` with and without `london-es` enabled. Verify both can be
played offline after one successful load.
