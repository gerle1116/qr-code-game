# Adventure System — Stage 1

This directory contains an authoring format, a local validator and three example
adventures. Nothing here is loaded by the game. There is no downloader, browser,
scenario selector, save migration or new runtime behavior.

## Validate and test

Requires Node.js 22 or later; no npm packages or installation step are needed.

```sh
node adventure-system/validator.js adventure-system/samples/linear
node adventure-system/validator.js adventure-system/samples/circular
node adventure-system/validator.js adventure-system/samples/non-linear
node tests/test-adventure-validator.js
```

The command prints `{valid, errors, warnings}` and exits with code 1 for invalid
packages, 0 for valid packages. Errors name the file and field. The exported
`validatePackage(directory)` function returns the same result. Tests mutate
temporary copies, never the supplied examples or original gameplay data.

On the development machine Node is not on PATH. Tests can also run through the
installed VS Code runtime in PowerShell:

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tests/test-adventure-validator.js
```

## Package layout and manifest

The directory supplied to the validator is the package root:

```text
adventure-name/
  manifest.json
  game-data.json
  scenarios.json       # linear only
  images/map.png       # when referenced
```

The manifest defines one `language` string, metadata, `formatVersion: 1`, a
three-part numeric version, a gameplay `type`, and a `gameData` JSON path.
Estimated minutes must be a positive integer; minimum age is a nonnegative
integer. Cover images are optional. Extra manifest fields (including `languages`)
are rejected. All player-facing text in a package belongs to that language;
the validator checks the structure, not the natural language of prose.

Linear and circular packages require a map. The eventual UI contract is **Map**
for these types and **Objectives** for non-linear adventures. No buttons are
changed in Stage 1. Static maps have an image only. Marker maps also have markers
with unique IDs, existing physical QR codes and x/y percentages in [0, 100].
Markers identify physical locations, so a marker does not permanently name an NPC.
The small sample PNGs depict a garden, river and path; they are illustrative maps.

Manifest, scenario and gameplay JSON Schemas live in `schemas/`. The validator
implements the exact subset used there: local `$ref`, type, const, enum, pattern,
minLength, minimum/maximum, required, properties, additionalProperties,
minProperties, minItems, uniqueItems and items. Metadata and nested shape checks
use those files directly. Cross-file references, paths, completion, type-specific
requirements and condition syntax require the validator too; using a schema
alone is insufficient.

## Existing data and compatibility

The current sources are `data/game-data_en.js` and `data/game-data_hu.js`, each
containing a `window.QR_CITY_QUEST_DATA = { ... };` assignment. There is no current
`data/game-data.json`; the old README/build validator still refers to that former
layout. The original sources were inspected without executing their assignments.

Their actual gameplay object contains:

- `encounters`: numeric two-digit QR keys, each with `startPage`, nested `pages`,
  optional `defaultPicture`, `requiredArea` and legacy `overdueItemTimers`.
- `items`: inventory names mapped to owners with `displayName`, `startPage`,
  nested `pages` and optional pictures. Some original items are unimplemented
  placeholders with empty pages.
- Pages: `id`, `speaker`, `text`, `buttons`, `actions`, `condition` and optional
  `picture`. Buttons contain numeric `index`, `label` and string `next`.
- `questDisplayNames`: internal quest names mapped to objective labels.
- `knowledgeFolders` and `thingsIKnow`: knowledge categories and entries with
  `text` and `folder`.
- Compiler provenance/notes/warnings, which are not runtime mechanics and are
  deliberately omitted from adventure packages.

Adventure JSON preserves the nested owners/pages/buttons/actions model.
Four-digit page IDs are globally unique across encounters and items. Destinations
must be existing pages, `HOME`, `TITLE_SCREEN` or `-1`. An owner's start page must
belong to that owner. Items referenced by inventory/timer/counter actions must be
defined; quests and knowledge actions reference their respective dictionaries.

Validated engine actions are ADD_ITEM, REMOVE_ITEM, ADD_KNOWLEDGE, START_QUEST,
COMPLETE_QUEST, START_TIMER, START_ITEM_TIMER, STOP_ITEM_TIMER, OPEN_CASTLE,
UNLOCK_AREA, ADD_COUNTER, SET_COUNTER, RESET_COUNTER, NEXT_SCAN,
DROPDOWN_INVENTORY and DROPDOWN_CHOICE. Timers require positive durations in
milliseconds. Counters use `data` for their name and `item` for an explicit item
(otherwise the current item owner); SET_COUNTER requires a finite `value`.
Dropdowns validate option destinations and inventory item values/fallbacks.

Conditions retain the current map of button index to expression string. Validation
reuses `mod-system/mod-conditions.js`, which parses a restricted expression grammar
without executing JavaScript. It supports inventory/history/knowledge membership,
quest state, unlocked areas, item counters, comparisons and Boolean operators.
Arbitrary calls, scripts and unsupported legacy expressions are rejected. The
older `{type: "HAS_ITEM", data: ...}` form is rejected explicitly: convert it to a
supported button expression rather than assuming it works in the current engine.

The following need a future compatibility adapter and are NOT implemented here:

- Named linear encounter IDs such as `guard-a` must be resolved to the selected
  scenario and mapped to numeric runtime owners/page lookup. The engine currently
  derives encounter ownership from the first two page-ID digits.
- Package image paths must be resolved by a loader; the original engine uses
  symbolic picture names. Stage 1 requires actual local PNG/JPEG/WebP paths.
- Conditions must use the safe interpreter at runtime. Passing adventure
  conditions through the trusted base-game `eval` path is not acceptable.
- Unimplemented item placeholders and `overdueItemTimers` are rejected rather
  than silently treated as validated. Convert placeholders to complete items;
  legacy overdue routing needs a dedicated format and validation in a later stage.

## Linear scenarios

Only linear adventures reference `scenarios.json`. Each named scenario has a
unique starting QR, a nonempty sequence of distinct two-digit QRs, a complete
QR-to-encounter mapping and `block`, `preview` or `allow` out-of-order policy.
Its first sequence QR must equal its starting QR. Mapping keys must occur in that
sequence and mapping values must name existing encounters. Duplicate JSON object
keys are rejected before parsing can overwrite them. The two sample scenarios
use different routes and assign different characters to the same QR.

Contract for a later runtime: the first eligible scan selects exactly one scenario
for the playthrough. Stage 1 defines and validates this data without performing
selection, enforcing route order or resolving scans.

## Circular adventures

Circular packages contain no route or scenarios file. Numeric encounter keys
identify eligible physical locations. Dialogue tells the player where to go.
The optional `progression` metadata declares `eligibleStarts`, `trackVisits: true`
and visit requirements as `{qr, minimumVisits}`. References and positive counts
are validated. Stage 5 provides standalone visit recording and safe button
expressions; see [ENCOUNTER_HISTORY.md](ENCOUNTER_HISTORY.md). Live integration
remains future work. Existing safe quest, inventory,
knowledge and area expressions may still be authored. No route array is needed.

## Safety and validation limits

Packages contain JSON and local PNG/JPEG/WebP files only. Paths must be relative,
use forward slashes and contain no traversal, URL, drive prefix or encoded path
characters. Referenced files must exist; symlinks and executable package members
are rejected. Image extensions and file signatures are checked, not complete image
decoding. ZIP extraction, archive limits and remote downloads are outside Stage 1;
this validator accepts an already extracted local directory.

Completion requires a graph path from an encounter start to `TITLE_SCREEN`, and
each linear scenario must have access to a completion path. This is a structural
check: it does not prove condition satisfiability, timer behavior, inventory
availability, physical route feasibility or that the author wrote a solvable
story. Warnings expose this limitation on valid results. Scan transitions and
multiple encounters can contribute to completion; conditions are not simulated.

## Verification

The Stage 1 suite checks all three valid samples, required metadata, one-language
structure, versions, QR/mapping errors, scenarios, both map modes, coordinate
bounds, safe paths, images, JSON duplicate keys, missing files, supported actions,
conditions, counters, timers, invalid shapes and reachable completion.
Latest result: **87 passed, 0 failed**.

Existing installer and runtime suites also pass. The existing localization suite
fails its final shipped-Spanish-preview-ZIP check with
`core:es.encounters: keys differ; core:es.items: keys differ`; the archive differs
from the current base data. It imports none of the Stage 1 files. The legacy Python
build check also targets the missing historical `data/game-data.json`, and Python
is unavailable on this machine; it was not run. These existing files were kept
unchanged as requested.
