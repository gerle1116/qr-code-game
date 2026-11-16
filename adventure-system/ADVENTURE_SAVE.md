# Stage 4: standalone adventure save management

`adventure-save.js` prepares, checks, migrates and serializes **one gameplay save**.
It never reads or writes localStorage, IndexedDB, player saves or downloaded
packages. No live application script loads it. Reset and replacement return new
data; they do not erase anything. Stage 5 visit conditions are not implemented.

## Save format

The existing gameplay fields remain at their original names and locations with
`schemaVersion: 1`. New fields use a separate `adventureSaveVersion: 1` marker:

```json
{
  "schemaVersion": 1,
  "adventureSaveVersion": 1,
  "adventure": {"id": "linear-demo", "version": "1.0.0", "type": "linear"},
  "scenarioState": {
    "scenarioId": "scenario-a",
    "currentIndex": 1,
    "completedCheckpoints": ["03"]
  },
  "scenarioFinished": false,
  "encounterHistory": {"visits": {"guard-a": 1}, "distinctVisited": 1},
  "completed": false
}
```

This excerpt omits the required original gameplay fields listed below.
`scenarioState` is exactly the Stage 2 `exportState()` snapshot, with no extra
fields. New linear saves start with scenarioId null, index 0 and an empty completed
list. Circular/non-linear saves have scenarioState null and scenarioFinished false.
The scenarioFinished boolean must agree with Stage 2's computed `finished` value.
Adventure `completed` is separate: this module stores it but never triggers an
adventure-completion action or infers it from checkpoint completion.

History `visits` maps resolved encounter/NPC IDs to positive safe-integer counts.
A missing entry means unvisited; presence means visited. `distinctVisited` must
equal the number of entries. In linear adventures use resolved IDs such as
`guard-a`, not a permanent NPC assignment to a physical QR. Circular encounters
normally use their two-digit IDs. History can be stored for every type and remains
independent of checkpoints. The future runtime must record visits only after
successful encounter opening, never per camera detection or preview. Stage 4
provides storage/validation only, with no recording hooks or visit-condition engine.

## Actual legacy gameplay fields

Inspection of `app.js` identified these original fields:

| Field | Preserved mechanics |
| --- | --- |
| `schemaVersion` | Original save format marker, remains 1 |
| `inventory` | Currently owned item IDs, including mod namespaces |
| `hadItems` | Permanent collection history; prevents reclaiming consumed item QRs and supports conditions |
| `knowledge` | Learned knowledge IDs used by the knowledge screen and conditions |
| `quests` | Objective IDs mapped to inactive/active/completed status |
| `encounters` | Saved dialogue page per encounter, including `-1` timer-wait state |
| `timers` | Encounter timers: numeric `endAt`, `resumePage`, optional/null `waitPage` |
| `itemTimers` | Independent item timers with numeric `endAt` |
| `flags.castleOpen` | Castle mechanic |
| `flags.unlockedAreas` | Area permissions used by scans and conditions |
| `itemState.counters` | Finite numeric counters with keys such as `Sweets::eaten` |
| `itemState.usedButtons` | Historical one-time-use markers |
| `itemState.oneTimeRewards` | Historical reward markers |
| `lastSavedAt` | Original numeric timestamp, preserved on migration/load/export |

Unknown JSON properties at the top level and in flags, itemState, timers and other
objects are retained. Marker-map values remain JSON values, matching the original
truthiness-based compatibility checks. Unsupported unsafe keys (`__proto__`,
`constructor`, `prototype`), cyclic/non-JSON values, nonfinite numbers and sparse
arrays return errors rather than being silently dropped. A reserved new-field
name collision in a legacy save also returns an explicit migration conflict.

Conditions themselves live in game data, not saves. Their required inventory,
history, knowledge, quest, area and counter state is preserved. No condition is
evaluated during save handling. References are not filtered against the current
item list: doing so would discard installed-mod or temporarily unavailable content.
Dialogue/timer destinations are checked for usable string shapes, not current
content existence; content resolution and mod compatibility remain future work.

## Creation, loading and migration

CommonJS exports the API below. In a browser load `scenario-engine.js` first,
then `adventure-save.js`, which exposes `QRCQAdventureSave`.

All operations return `{ok:true, ...}` or `{ok:false, code, message}`; validation
can also return an `errors` array. Data-returning operations use `save`; export
uses `data` for its JSON string. All returned saves are independent copies.

```js
const saves = require('./adventure-save.js');
const adventure = {
  manifest: require('./samples/linear/manifest.json'),
  gameData: require('./samples/linear/game-data.json'),
  scenarioData: require('./samples/linear/scenarios.json')
};
const created = saves.createAdventureSave(adventure);
if (!created.ok) throw new Error(created.message);
const encoded = saves.exportAdventureSave(created.save, adventure);
const loaded = saves.loadAdventureSave(encoded.data, adventure);
```

`adventure` follows Stage 3's `{manifest, gameData, scenarioData}` shape. Supply
Stage 1 validated content. This module checks the manifest's identifying fields
(formatVersion, ID, version, type); linear adventures must also pass the actual
Stage 2 engine factory. Non-linear/circular metadata alone is sufficient for save
preparation, because no route needs interpretation. This is **not** full package
validation or activation; the future manager must perform Stage 1 validation first.

- `createAdventureSave(adventure)` returns original default gameplay fields plus
  adventure metadata, empty history, initial scenario state and completion false.
- `resetAdventureSave(adventure)` is the same pure fresh-save operation. It does
  not inspect or clear existing storage. New creation/reset sets lastSavedAt;
  normal capture/export does not update it automatically.
- `loadAdventureSave(data, adventure)` accepts an object or JSON string and
  performs strict validation, without migrating or silently creating a game.
- `validateAdventureSave(save, adventure)` checks versions, identity, field types,
  collection history, timers, counters, history consistency and Stage 2 progress.
- `exportAdventureSave(save, adventure)` validates before returning a JSON string.
- `migrateLegacySave(data)` explicitly converts a copy of schemaVersion 1 data.

The base game currently has no adventure manifest ID/version. Migration therefore
uses the **provisional compatibility identity** exported as `LEGACY_ADVENTURE`:
`qr-city-quest`, version `1.0.0`, type `non-linear`. This identifies the original
game; it is not inferred from an existing package. A later loader must adopt or
explicitly migrate this identity before live integration. Migration cannot relabel
legacy progress as an unrelated downloaded adventure.

Missing legacy fields initialize to original defaults with warnings. Missing
nested flag/itemState members do likewise. Missing hadItems initializes from
inventory; any owned item missing from existing history is added, retaining
consumed-item history. Well-formed existing arrays and string IDs remain unchanged;
unlike the permissive live loader, migration does not trim/filter/deduplicate
identifiers or coerce malformed fields. Incorrect types return an error for user
recovery instead of deleting information. A missing legacy timestamp receives a
new timestamp with a warning. No timestamps or visit counts are inferred from
dialogue progress. Legacy adventure completion is unknown and starts false.

The actual app's historical fishing/ring migrations are reproduced: truthy
`Fishing Rod::Blobfish`, `Fishing Rod::Great Salmon` and `Fishing Rod::Old Boots`
oneTimeRewards initialize `blobfishCaught`, `salmonCaught` and `bootsCaught`
counters under the Fishing Rod prefix when absent/zero. The historical
`Silver Ring::2601::Put it on.` usedButtons marker similarly initializes
`Silver Ring::worn`. Existing nonzero counters and all old markers are retained.

## Linear scenario persistence

```js
const { createScenarioEngine } = require('./scenario-engine.js');
const engine = createScenarioEngine(adventure.scenarioData, adventure.gameData).engine;
engine.scan('03');
// After a successful gameplay interaction:
engine.completeCheckpoint('03');
const captured = saves.captureScenarioState(loaded.save, adventure, engine);
const resumed = saves.restoreScenarioEngine(captured.save, adventure);
// resumed.engine is a real Stage 2 engine with the selected scenario restored.
```

`captureScenarioState` uses `exportState` and checks it through Stage 2 restoration.
It cannot change an already-saved scenario, clear selection or roll progress back.
`restoreScenarioEngine(save, adventure, existingEngine?)` uses Stage 2 `restoreState`.
Supplying an active engine retains its scenario-lock/rollback safeguards and atomic
failure behavior. After successful restoration another scan is required before
checkpoint completion. Scan permissions are never serialized.

The optional engine must belong to the supplied adventure: Stage 2 snapshots have
no package fingerprint, and structurally identical routes cannot prove identity.
Exact saved adventure ID/version checks protect the surrounding save. Route
prefix corruption is rejected by Stage 2. Neither format authenticates player
actions or detects content changes published under an unchanged version number.

Stage 3 deliberately exposes no restore/injected-engine API. This module restores
the standalone Stage 2 engine directly; wiring that restored engine into the QR
resolver is future integration work. Earlier stage APIs and their preview guards
remain unchanged. Passing this new save through the existing live `loadSave`
would discard its new metadata, so it must not be connected until that integration
is implemented and tested.

## Preparing and explicitly committing one replacement

```js
const transition = saves.prepareAdventureTransition(currentSave, nextAdventure);
if (!transition.ok) {
  // Show transition.message; retain currentSave.
} else {
  // transition.preparedSave is a preview, not an active save.
  // Only when the future caller explicitly chooses to replace progress:
  const committed = transition.commit(currentSave);
  if (committed.ok) currentSave = committed.save;
}
```

Preparation validates the new identity/content boundary, creates a fresh save,
validates it and retains a private snapshot. It never changes the supplied old
save. Failed preparation returns an error without a commit operation. Editing the
public preview or adventure object cannot change the private prepared state.
Commit requires the current old-state value, rejects stale progress, validates
again and can succeed once. The caller must assign the returned save explicitly.
There are no slots, per-adventure saves or abandoned-adventure lists. An old raw
corrupted JSON string can be retained during preparation until explicit commit;
the manager never silently repairs or overwrites it. For no previous save use
null as the old/current value.

This is an in-memory handoff, **not a storage transaction**. The future Adventure
Manager must coordinate content validation, user flow, persistence errors and
activation, and must keep the old save until a replacement write succeeds.
Concurrent tabs and durable storage transactions are outside Stage 4. No packages
are downloaded, activated or deleted.

## Settings and recovery boundaries

The current gameplay key is `qr-city-quest-save-v1`. Unrelated keys include
`qr-city-quest-language-v1` and `qr-city-quest-debug-visible-v1`. Installed mods
and their enabled/configuration data live separately in IndexedDB database
`qr-city-quest-mods-v1`, object store `packages`. The module accesses none of
these; callers eventually must target only the gameplay save. No blanket storage
clear operation or deletion is implemented.

Missing data returns `MISSING_SAVE`; broken JSON returns `INVALID_JSON`;
unsupported format markers return `UNSUPPORTED_SAVE_VERSION`. Different IDs
return `UNKNOWN_ADVENTURE`, different versions return
`INCOMPATIBLE_ADVENTURE_VERSION`, and malformed gameplay/history returns
`INVALID_SAVE`. Stage 2 scenario errors retain its actual codes, such as
`INVALID_SCENARIO`, `INVALID_STATE`, `SCENARIO_LOCKED` and `PROGRESS_ROLLBACK`.
Malformed legacy input returns a recovery error without modifying its source.
Nothing automatically resets a corrupted save, updates a package version,
migrates real players or writes a new save. The future UI decides recovery.

## Verification

Run `node tests/test-adventure-save.js`, followed by the Stage 1 validator,
Stage 2 scenario, Stage 3 resolver and existing mod suites. The Stage 1 README
documents the VS Code runtime alternative if Node is not on PATH. Tests use only
fixtures/copies, including a realistic legacy save and the actual original
defaultSave factory extracted without running the app. Browser tests forbid
storage, DOM and network access. No real player saves are accessed.

Verified results: **89 Stage 4 tests passed, 0 failed**. Stage 1: 87 passed,
Stage 2: 85 passed, Stage 3: 64 passed, all with 0 failures. Existing mod installer
tests (14) and runtime tests (10) passed. Localization passed 12 checks and then
failed on the previously documented shipped Spanish preview ZIP mismatch:
`core:es.encounters: keys differ; core:es.items: keys differ`. The legacy Python
build check still targets the absent historical `data/game-data.json` and was
not rerun. These unrelated files were left unchanged.
