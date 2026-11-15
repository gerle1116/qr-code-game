# Stage 2: standalone linear scenario engine

`scenario-engine.js` interprets the existing Stage 1 `scenarios.json` format.
It does not load packages or modify the game. It requires no DOM, camera, network,
storage or third-party dependencies. The module exports `createScenarioEngine`
through CommonJS, or `QRCQScenarioEngine` when loaded as a standalone browser script.
No original application files load this module yet.

## Usage

Pass the parsed, Stage 1 validated scenario document and gameplay document:

```js
const { createScenarioEngine } = require('./scenario-engine.js');
const scenarios = require('./samples/linear/scenarios.json');
const gameData = require('./samples/linear/game-data.json');
const created = createScenarioEngine(scenarios, gameData);
if (!created.ok) {
  console.error(created.code, created.message);
} else {
  const engine = created.engine;
  const opened = engine.scan('03'); // scenario-a, guard-a, full access
  // The caller performs the required gameplay interaction here.
  const completed = engine.completeCheckpoint('03');
  console.log(completed.expectedQR); // '01'
  const serialized = JSON.stringify(engine.exportState());

  const resumed = createScenarioEngine(scenarios, gameData).engine;
  const restored = resumed.restoreState(JSON.parse(serialized));
  console.log(restored.ok, resumed.scan('01').encounterId); // true, merchant-a
}
```

The factory returns `{ok: true, engine}` or `{ok: false, code, message}`. It copies
input data and defensively checks scenario versions, routes, starting QR uniqueness,
policies and encounter mappings. It expects full package validation to have already
been performed by Stage 1; it does not replace that validator.

## Operations and results

- `scan(qr)` selects a scenario on the first eligible starting QR, then resolves
  all subsequent scans in that scenario. QR codes must remain exact two-digit
  strings, including leading zeros. It never completes a checkpoint.
- `completeCheckpoint(qr)` confirms that the caller finished the required
  interaction. Only the current expected, scanned checkpoint can complete. It
  increments the checkpoint index by one and records the QR exactly once.
- `exportState()` returns a separate JSON-compatible snapshot.
- `restoreState(snapshot)` validates and copies a snapshot atomically. A rejected
  restore preserves both progress and the pending interaction.
- `getStatus()` returns current progress, expected QR and finished status.

Operation results include `ok`, a stable `code`, an understandable `message`,
`scenarioId`, `currentIndex`, `expectedQR`, `finished` and a copied `state`.
Scan results also contain `qr` (when well formed), `encounterId`, a copied
`encounter`, `access`, `readOnly`, `canCompleteCheckpoint` and
`progressionSensitiveActionsAllowed`. Known mapped scans include `alreadyCompleted`.
Failures never return an encounter to open.

| Scan situation | Access | Read-only | May complete checkpoint | Progress-sensitive actions |
| --- | --- | --- | --- | --- |
| Expected checkpoint, any policy | `full` | false | true | allowed |
| Out of order, `block` | `blocked` | true | false | forbidden |
| Out of order, `preview` | `preview` | true | false | forbidden |
| Out of order, `allow` | `full` | false | false | forbidden |

`preview` returns a successful read-only encounter resolution. `allow` permits
ordinary interaction but still cannot complete a future or already completed
checkpoint. Previously completed QRs follow the same out-of-order policy.
Unknown, malformed, invalid-start and post-completion scans use `access: 'none'`.

The engine does not run dialogue actions. A future caller must honor read-only
access and `progressionSensitiveActionsAllowed` before applying side effects.
The engine cannot determine whether an actual gameplay interaction succeeded;
the caller is responsible for when it calls `completeCheckpoint`.

## Interaction context

Scanning the expected QR authorizes a subsequent completion call for that QR.
Any new scan replaces this authorization, including blocked or unknown scans.
This prevents a delayed interaction from an earlier screen from advancing progress
after a different QR was scanned. Repeated scans of the expected QR are harmless.
Successful completion or restoration clears the authorization. After restoring,
scan the expected QR again before completing its interaction. Failed completion
calls do not consume an otherwise valid pending interaction.

## Saved state and completion

```json
{
  "scenarioId": "scenario-a",
  "currentIndex": 1,
  "completedCheckpoints": ["03"]
}
```

An unselected engine has `scenarioId: null`, index 0 and an empty completed list.
For a selected scenario, `currentIndex` is the next checkpoint's zero-based
position, and `completedCheckpoints` must be exactly the sequence prefix before
that index. Negative, fractional, oversized or nonnumeric indices, unknown scenario
IDs, duplicate/skipped/reordered QRs and unexpected state fields are rejected.

Restoring into a fresh engine loads that playthrough. Restoring into an active
engine cannot switch or clear the selected scenario, or move its progress backward.
A valid same-scenario snapshot may restore equal or later progress. Use a fresh
engine to load a different playthrough. Snapshots are trusted application data:
structural validation cannot authenticate whether interactions really occurred.
The three-field state format has no adventure ID or revision fingerprint; callers
must store it with the correct adventure/version. A route change that invalidates
the saved prefix is rejected, but changes to uncompleted steps or encounter text
cannot be identified from this state alone.

Completing the last checkpoint returns `SCENARIO_COMPLETED`. At that point the
index equals the sequence length, `finished` is true and `expectedQR` is null.
Further well-formed scans return `SCENARIO_FINISHED` without opening an encounter,
selecting another scenario or changing progress. The completed state can be saved
and restored without restarting the adventure.

## Tests

```sh
node tests/test-scenario-engine.js
node tests/test-adventure-validator.js
```

On this machine use the VS Code runtime command documented in the Stage 1 README
with either test path. Stage 2 tests use the unchanged Stage 1 linear sample as
their primary fixture; additional policies and broken inputs are in-memory copies.
No Stage 1 schema or sample changes were necessary.

Latest results: **85 Stage 2 tests passed, 0 failed; 87 Stage 1 tests passed,
0 failed.** Scanner integration, action execution, existing saves and all other
gameplay remain outside this module. Stage 3 has not been implemented.
