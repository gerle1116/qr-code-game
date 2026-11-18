# Stage 10 adventure completion and replay

Stage 10 runs against the single installed adventure and save in Stage 8 storage.
It uses the existing v1 packages and the original game's winning destination.
In the original game, a transition to `TITLE_SCREEN` calls `showWin()`.
In this standalone module, only an executed, authorized transition to that
destination can commit victory.

## Completion rules

- **Linear.** The Stage 3 resolver runs the Stage 2 engine and restores its validated
  checkpoint prefix. The first valid starting QR locks the scenario. Only the
  expected checkpoint gets progression permission. Confirming the final checkpoint
  saves `scenarioFinished: true`. The player must also choose an eligible ending
  button in the locked scenario for `completed` to become true.
- **Circular.** Stage 5 tracks visits on authorized encounter openings and supplies the
  existing visit functions to the safe condition evaluator. In the sample, the
  Merchant's ending option requires at least three distinct visits. Any visit
  order can satisfy this, and the player still has to choose the option.
- **Non-linear.** The engine follows the adventure's authored dialogue and checks each
  selected button's condition against gameplay state. For example, a button can
  require an item or a completed quest. The sample gives a Token and starts a
  quest through the Guide's button, and finishes the quest through the Keeper's
  ending button. The sample allows the Keeper's ending without visiting the Guide.

The two linear events can be ordered either way. If the ending is chosen while
the final checkpoint is open, Stage 10 confirms the checkpoint through Stage 3
and writes both flags in one transaction. If the final checkpoint is confirmed
first, its route-only state can be saved and reopened after reload. The resolver
can then issue a new permission for a confirmed QR of the locked route. This
also handles authors who placed the ending at an earlier checkpoint. Such an
ending is denied during the incomplete route and can be chosen on return.
Ordinary Stage 3 callers retain their original finished-route scan behavior.
While the route is in progress, linear cross-encounter links require a new scan.
After route completion, authored cross-encounter links can visit pages in the
same scenario.

## Session API

`adventure-completion.js` exports `QRCQAdventureCompletion` in a browser and
supports CommonJS. Load Stage 2–5 and Stage 8 dependencies first.

```js
const opened = await QRCQAdventureCompletion.createCompletionEngine({ storage });
if (!opened.ok) return opened;
const { engine } = opened;
const view = engine.scan(qr);
if (view.ok) {
  // Render view.page. Bind each displayed button to this specific view.
  const outcome = await engine.choose(view, buttonIndex);
}
```

The session owns the resolver, Stage 5 tracker, save snapshot, and current
dialogue. `choose(view, buttonIndex)` checks object identity for the current
view, checks the underlying resolver permission, finds the original content
button, evaluates its condition, and applies supported actions before following
its destination. A scan, including an invalid one, expires the prior view.
Following a page link also replaces the view. Preview content can be displayed
with disabled controls. The engine accepts no caller-supplied page ID,
destination, completion flag, or replacement save. Data is never executed as
JavaScript.

`confirmCheckpoint()` confirms the open linear checkpoint and saves progress.
The tester exposes it as a developer control. Live gameplay must call it only
after the checkpoint interaction has succeeded. `flush()` saves ordinary
in-memory progress or retries a failed checkpoint or victory write.
`getProgress()` returns a copy for inspection.
`getCompletionStatus()` reports persisted completion flags and whether a
victory write is pending. `getCompletionSummary()` returns `NOT_COMPLETED`
until victory is persisted.

The standalone dispatcher supports ordinary dialogue buttons and the sample
quest and item actions, plus knowledge, area, castle flag and counter updates.
It uses the safe Stage 5 condition path for supported expressions. Timers,
dropdowns, item encounters, and scanner-handoff actions require a live dispatcher
that can verify and execute those interactions. Unsupported actions fail closed.
Stage 11 needs to connect those gameplay paths and the checkpoint callback to a
trusted dispatcher, using the active revision and the same principles for
authorizing each transition. The system is client-side. A player who can edit
JavaScript or IndexedDB can alter their own local state.

## Save, errors and replay

The session starts from a real `storage.snapshot()`, validates the save against
the installed adventure ID, version, and type, and uses
`storage.updateSave(save, expectedRevision)` for writes. Stage 4 validates outgoing
state and Stage 8 validates again in the same IndexedDB transaction. A successful
victory sets the existing `completed` flag and records optional `completedAt` in
epoch milliseconds. Earlier v1 completed saves can omit the timestamp. A
contradictory linear save with `completed: true` and an unfinished route cannot
open in Stage 10.

An aborted write leaves the previous save intact and keeps the UI from showing
victory. The session holds the validated update in memory so retrying a failed
write does not apply actions twice. A revision conflict returns
`STALE_TRANSITION` and requires reopening the stored save. Closing the tester
discards in-memory progress and unsaved retries. Repeated terminal input after
success is rejected with `ALREADY_COMPLETED`; flushing an already completed
session returns its status without another write.

`prepareVictory(storage)` reads and validates the persisted result and binds
replay to that revision. Replay requires `replay({ confirmed: true })` and creates
a fresh Stage 4 save in the existing slot. It clears items, history, quests,
flags, timers, counters, completion time, and linear selection. The package and
assets stay installed. A concurrent write or package replacement invalidates the
confirmation. Cancel leaves the save intact.

## Victory UI and offline behavior

`QRCQAdventureVictory.mountVictory({ container, storage, locale, onBack, onReplay })`
loads only a persisted victory. The native summary and confirmation dialog
support keyboard use. Labels are in English and Hungarian and reuse the Stage 9
localized adventure type. The package language and narrative remain as authored.
The summary uses the real title, type, optional scenario ID and completion time,
distinct visits, and completed quest count. Adventure strings render as text.
Invoke `destroy()` on unmount to remove the screen and its event listeners.

The tester calls the existing Stage 9 `refreshActive()` after victory or replay.
Recognition, storage, summary and reset use local installed content. The tester
document and its scripts still need to be available from the local development
server on initial navigation or document reload. Its offline toggle blocks
test network requests while leaving IndexedDB and already loaded code available.
Stage 10 adds no service-worker behavior.

## Run the standalone tester

1. From the repository root run `node tools/serve-adventure-catalog.js`. If Node
   is available through VS Code on Windows, set `$env:ELECTRON_RUN_AS_NODE='1'`
   and run `& "$env:LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" tools/serve-adventure-catalog.js`.
2. Open `http://127.0.0.1:8000/adventure-system/completion-tester.html` in Chrome.
   The database is `qrcq-stage10-completion-tester-v1`.
3. Select a sample and choose **Install local sample**. You can also install a
   sample through the embedded Stage 9 browser, then choose **Reopen stored save**.
4. **Linear A:** scan `03` and confirm it. Scan `02` early to see the block.
   Scan and confirm `01` and `04`, then scan `02` and choose **Finish**.
   **Linear B:** scan and confirm `02`, `01`, and `03`. You can scan `04` early
   to see its preview. At the correct point scan `04` and choose **Finish**,
   or confirm `04`, reload, rescan `04` and choose **Finish**.
5. **Circular:** start with `02` and try the ending option. Visit `01` and `03`
   in either order. Visit `01` twice to try its repeat-visit option. Return to
   `02` and choose the ending option. **Non-linear:** scan `01` and choose
   **Continue**. Inspect the Token and active quest, then scan `02` and choose
   **Finish**.
6. Open the summary and check the active status in Stage 9. Reload and verify
   victory reopens. Choose **Replay Adventure**, cancel once, then reopen the
   dialog and explicitly confirm. Reload to verify the package is still active
   with fresh progress. To change the UI language, go back, select the language,
   and open the saved victory again.
7. **Faults:** before a winning click, select **Abort the next save transaction**.
   For a replay failure, use **Back to Adventures**, select the same checkbox,
   reopen the saved victory, then confirm replay. A failed victory can be retried with **Save progress
   or retry failed write**. Select **Simulate another tab saving** before the
   winning click to see a stale revision. Reopen the stored save and perform the
   ending again. With a package installed, block tester network requests and
   finish, view, or replay directly from IndexedDB.

Run `node tests/test-adventure-completion.js` for the Node suite and append
`--browser` for real Chromium checks. The runner accepts `QRCQ_TEST_BROWSER`
to select the installed browser binary.
