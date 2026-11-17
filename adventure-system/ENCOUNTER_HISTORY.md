# Stage 5: encounter history and circular dialogue

This standalone module remembers successful NPC encounter openings. It does not
load into the live app, use storage, render dialogue, or advance checkpoints.
Circular adventures need no route, next QR, or automatic checkpoint sequence.
Players may begin at any eligible NPC; dialogue and existing game conditions guide
them. The circular sample demonstrates Guard → Merchant → Wizard → Guard and
first-visit, repeat-visit and Wizard-aware choices. The arrows describe story hints,
not an enforced route. Eligible-start metadata remains descriptive, as in Stage 3.

## Record only successful openings

```js
const { createQRResolver } = require('./qr-resolver.js');
const { createEncounterHistory } = require('./encounter-history.js');
const resolver = createQRResolver(adventure).resolver;
const { history } = createEncounterHistory({ gameData: adventure.gameData, resolver });
const permission = resolver.scan('01');
// A trusted caller checks access and required areas, then opens the encounter.
// Only after that opening succeeds, synchronously before another scan:
const recorded = history.recordVisit(permission.encounterId, permission);
```

`recordVisit(id, permission)` returns `{ok:true, encounterId, count}` or
`{ok:false, code, message}`. Use the resolved encounter ID, not the QR. One
resolver-issued result represents at most one opening. Reopening requires a new
scan result, preventing duplicate callbacks from counting the same opening twice.
Camera sightings and scan calls alone do not record anything. Unknown, blocked,
preview, item, forged, copied, foreign, stale and consumed permissions are rejected.
New scans and checkpoint completion revoke older permissions through the unchanged
Stage 3 `authorizeMutation` check. Out-of-order `allow` is conservatively denied
because Stage 3 forbids persistent mutations there; this module does not weaken it.

Construction must receive the application's trusted resolver for this adventure.
A caller-supplied fake resolver is not an authentication authority. The resolver
cannot know whether a screen actually opened, and this module cannot prove that
either: the trusted opening controller must make this call after success, never on
detection or failed rendering. Required-area checks remain the caller's responsibility.
Use one history instance per active adventure. Creating/loading a different game
requires a fresh resolver and history; never transfer in-memory permissions.

Read-only queries are `hasVisited(id)`, `getVisitCount(id)` (zero if absent), and
`getDistinctVisitedCount()`. Repeated visits increase one positive safe integer;
different resolved IDs count separately even when scenarios share physical QRs.
Overflow fails without changing history.

## Conditions retain Stage 1's expression format

Page `condition` remains a map from button index to a safe expression string:

```json
{
  "1": "!VISIT_COUNT(\"01\", 2)",
  "2": "HAS_VISITED(\"03\") && DISTINCT_VISITED_COUNT(3)"
}
```

* `HAS_VISITED("encounter-id")` means at least one opening.
* `VISIT_COUNT("encounter-id", 2)` means at least two openings.
* `DISTINCT_VISITED_COUNT(3)` means at least three different encounters, with no ID.

Minimums must be positive safe integer literals. Missing arguments, unknown IDs,
fractional/negative/zero minimums and unsupported functions fail validation.
The existing `{qr, minimumVisits}` progression metadata remains compatible; it
neither creates a second history nor gates access. New conditions use resolved IDs.

`history.evaluateCondition(expression, {save}, context?)` uses the existing safe
mod condition parser with visit functions explicitly enabled. Existing quest,
knowledge, inventory, unlocked-area and counter expressions combine with visits
using `&&`, `||` and `!`. Mod evaluation without this context remains unchanged.
Evaluation only reads history. Record the current opening before evaluating its
dialogue choices: the first visit has count 1 and the second has count 2.
There is no untrusted JavaScript evaluation and no automatic action execution.

## Save and restart

Stage 4's representation is unchanged:

```json
{"visits":{"01":2,"03":1},"distinctVisited":2}
```

Assign `history.exportHistory()` to a prepared save's `encounterHistory`, then
use Stage 4's `exportAdventureSave(save, adventure)`. After restart, validate/load
the save through Stage 4, create a fresh resolver/history, and call
`history.restoreHistory(loaded.save.encounterHistory)`. Check both return values.
Stage 4 performs save validation; Stage 5 additionally checks encounter ID syntax
and membership in its loaded game data. No save format migration is needed.

Exports are independent copies. Restoration validates first, then replaces history
without mutating input, merging counts, or recording visits. Repeated restoration
does not duplicate counts. Invalid IDs, unknown encounters, nonpositive or unsafe
counts and inconsistent distinct counts fail atomically. An absent visit entry
means zero; explicit zero counts are invalid. `resetHistory()` clears only visits.
Restoring/resetting never makes consumed permissions reusable. New Stage 4 saves
already contain empty history. Linear scenario state remains independent.

CommonJS loads the parser automatically. Browser order is `mod-conditions.js`,
`scenario-engine.js`, `qr-resolver.js`, `encounter-history.js`; the history module
exports `QRCQEncounterHistory`. It needs no DOM, camera, network or storage.

## Scope and verification

Run `node tests/test-encounter-history.js`, the Stage 1–4 suites, and existing mod
runtime/installer/localization suites. Where Node is absent, use the VS Code Node
runtime command in README.md. The localization suite has a previously documented
Spanish preview ZIP mismatch. The legacy Python build check refers to the absent
historical `data/game-data.json`.

Verified Stage 5 results: 50 passed. Stage 1: 96 passed; Stage 2: 85 passed;
Stage 3: 64 passed; Stage 4: 89 passed. Mod runtime: 10 passed; installer: 14
passed. Localization passed 12 checks then failed the existing Spanish archive
comparison (`core:es.encounters: keys differ; core:es.items: keys differ`). Python
was unavailable, so the historical build check could not execute.

Future live integration must connect successful screen opening to the guarded
record call, supply restored save data, evaluate package dialogue through this
safe API, and guard every live action. Stage 3 still has no API for injecting a
restored linear engine. No scanner, debug menu, live save, completion behavior,
downloader, adventure browser or later stage is implemented here.
