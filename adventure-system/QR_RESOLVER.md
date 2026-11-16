# Stage 3: standalone central QR resolver

`qr-resolver.js` translates an exact physical QR identifier into encounter or item
data and access permissions. It returns objects, renders nothing and never changes
inventory, quests, timers, flags, counters or saves. No application script loads it;
the original non-linear game remains the default. Stage 4 is not implemented.

## Usage

```js
const { createQRResolver } = require('./qr-resolver.js');
const created = createQRResolver({
  manifest: require('./samples/linear/manifest.json'),
  gameData: require('./samples/linear/game-data.json'),
  scenarioData: require('./samples/linear/scenarios.json')
});
if (!created.ok) throw new Error(created.errorId);
const resolver = created.resolver;
const opened = resolver.scan('03');
// Render only after checking the result type and permissions.
// Immediately before ANY persistent side effect:
if (resolver.authorizeMutation(opened)) {
  // A future guarded gameplay dispatcher can perform a validated interaction.
  // Only after that interaction succeeds:
  // resolver.completeCheckpoint(opened);
}
```

For circular/non-linear adventures omit `scenarioData`. Pass parsed Stage 1
validated documents, not paths. The factory copies inputs and checks versions,
types, encounter start pages and linear mappings defensively. It does not replace
the package validator's schemas, reference checks, safe condition validation or
image/path checks. Invalid construction returns `{ok:false, type:'error', code,
errorId, ...deniedPermissions}` without a resolver. No adventure activates itself.

CommonJS loads Stage 2 automatically. For browser scripts load
`scenario-engine.js` before `qr-resolver.js`; the latter exports
`QRCQQRResolver.createQRResolver`. Missing Stage 2 fails closed for linear data.
Neither script needs a DOM, camera, network or storage. Camera and debug callers
can eventually use the same `scan(qr)` method after extracting the identifier.

## Resolution contract

Every scan result includes `ok`, `type`, `code`, `errorId` (null on success), `qr`,
`encounterId`, `encounter`, `scenarioId`, `access`, `readOnly`,
`canCompleteCheckpoint` and `progressionSensitiveActionsAllowed`. Absent encounters
are null. The permission names and values come directly from Stage 2. Linear scans
also retain Stage 2 progress/status fields. Result types are:

| Type | Meaning |
| --- | --- |
| `encounter` | Encounter definition available; inspect permissions before acting |
| `preview` | Encounter available for read-only display |
| `blocked` | Out-of-order block; no encounter content returned |
| `unknown` | Malformed, unknown or ineligible starting QR |
| `error` | Unavailable/invalid data or a finished linear scenario |
| `item` | Unrestricted item QR, with `itemId` and copied `item`; no acquisition |

QRs remain strings, including leading zeros. No trimming or numeric conversion is
performed. Linear QRs follow Stage 2's exact two-digit rule. Unrestricted scans
also retain the original namespaced mod QR syntax (e.g. `london:02`). This is
lookup compatibility, not an adventure/mod loader or an extension of Stage 1's
two-digit authoring format.

Linear scans delegate to Stage 2: the first eligible starting QR selects a fixed
scenario. Future starting QRs cannot switch it. `block`, `preview` and `allow`
keep Stage 2 behavior. Scanning never advances a checkpoint.
`completeCheckpoint(result)` accepts only the current, resolver-issued expected
scan, then calls Stage 2's `completeCheckpoint(qr)`. It must be called only after
the gameplay interaction succeeds. `getStatus()` exposes a copied linear status;
there is no save/restore API in this layer. Final checkpoint behavior belongs to
the existing Stage 2 engine; no adventure-completion actions/UI are implemented.

Circular/non-linear scans directly resolve encounter keys without generating,
tracking or enforcing a route. Dialogue definitions, conditions, quests, required
areas and actions are copied unchanged. Circular visit metadata is not enforced
and no visit history is collected. Unrestricted encounters permit mutations but
never linear checkpoint completion. Existing gameplay conditions and area locks
remain the caller's responsibility.

As in `acceptScannedText`, encounters take precedence over item QRs. Items match
the first definition with the QR prefix of its start page (including namespaces).
An item result does not acquire an item or bypass the original inventory/hadItems
rules. Those rules remain in the unchanged application.

## Preview and execution boundary

`authorizeMutation(result)` is an execution-time contract for **all persistent
mutations**, including collection/removal, inventory/history/knowledge changes,
quests, flags, counters, timers, saved dialogue positions, checkpoints and
completion actions. It returns true only for the current issued full-access result
whose `readOnly` is false and `progressionSensitiveActionsAllowed` is true.
There is no permissive action-name fallback: future or unknown mutation types
require the same guard. Top-level results are frozen, permissions are held privately,
and copied, forged, cross-resolver or stale results cannot authorize changes.
Every scan, even an invalid one, revokes the old context. Completing a checkpoint
also revokes it. Encounter content is a copied data object, never authorization.

For `allow` out of order, Stage 2 still reports full interaction access but forbids
progress-sensitive actions and checkpoint completion. This Stage 3 guard
conservatively denies all persistent mutations in that case; read-only navigation
can remain available. Finer action classification is deferred to dispatcher work.

**This is not enforcement inside the live game.** The resolver executes no actions
and cannot stop a caller that ignores its contract or writes directly to saves.
Do not feed previews into the existing `showPage`, `resolveScan`, dropdown/action
handlers or destination flow: those paths can persist state. Future integration
must guard side effects at execution time, including automatic timer expiration,
item acquisition, saved page navigation and completion destinations, and recheck
the current context in delayed callbacks. Hiding buttons alone is insufficient.
Use the safe condition interpreter for package conditions; the trusted base-game
condition path must not evaluate untrusted adventure expressions.

## Existing scanner and debug behavior

The real scanner sends decoded text to `acceptScannedText`, trims it, validates
the QR syntax, checks encounters first, then handles item acquisition/history.
Encounter resolution checks required areas, saved pages and timer redirection;
it can persist expired timers before rendering. The debug encounter scan buttons
call `resolveScan` directly and do not simulate item collection. Both paths stay
unchanged. Named scenario owners also need a future page-context adapter because
the current application infers encounter ownership from page-ID prefixes.
Loading, images, save migration and circular history remain later-stage work.

## Verification

Run `node tests/test-qr-resolver.js`, `node tests/test-adventure-validator.js` and
`node tests/test-scenario-engine.js`. The Stage 1 README documents the installed
VS Code runtime alternative when Node is not on PATH. Stage 3 fixtures include
both shipped language datasets and namespaced item/encounter lookup; test-only
copies add a format version to historical base data without rewriting it.

The resolver is intentionally standalone: no changes to `app.js`, scanner,
debug menu, interface, game data, service worker or save storage are required.

Verified results: **64 Stage 3 tests passed, 0 failed; 87 Stage 1 tests passed,
0 failed; 85 Stage 2 tests passed, 0 failed.** Existing mod installer (14) and
runtime (10) tests passed. The localization suite passed its first 12 checks,
then failed on the already-documented shipped Spanish preview ZIP mismatch:
`core:es.encounters: keys differ; core:es.items: keys differ`. Its archive and
gameplay files were left unchanged. The legacy Python build check could not run
because the installed Python alias is unavailable; it also references the absent
historical `data/game-data.json`.
