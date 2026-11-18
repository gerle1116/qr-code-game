'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCompletionEngine, prepareVictory } = require('../adventure-system/adventure-completion.js');
const { createAdventureSave, validateAdventureSave } = require('../adventure-system/adventure-save.js');
const { createAdventureStorage } = require('../adventure-system/adventure-storage.js');
const { createTesterServer } = require('../tools/serve-adventure-catalog.js');
const runBrowser = require('./run-stage8-browser.js');

const load = (type, name) => require(`../adventure-system/samples/${type}/${name}.json`);
async function setup(type, edit = () => {}, editSave = () => {}) {
  const adventure = structuredClone({ manifest: load(type, 'manifest'), gameData: load(type, 'game-data'),
    ...(type === 'linear' ? { scenarioData: load(type, 'scenarios') } : {}) });
  edit(adventure);
  const { save } = createAdventureSave(adventure);
  editSave(save);
  let state = { storageVersion: 1, revision: 1, staging: null,
    active: { kind: 'downloaded', adventure, save, files: { 'sample.png': new Uint8Array([1, 2]) } } };
  let abort = false;
  const storage = createAdventureStorage({ backend: {
    read: async () => structuredClone(state),
    async transact(fn) {
      const next = structuredClone(state), result = fn(next);
      if (abort) { abort = false; throw Error('Aborted test write'); }
      state = next;
      return result;
    }
  } });
  const opened = await createCompletionEngine({ storage });
  assert.equal(opened.ok, true, opened.code);
  return { storage, engine: opened.engine, abortNext: () => { abort = true; } };
}

async function route(engine, qrs) {
  for (const qr of qrs) {
    assert.equal(engine.scan(qr).ok, true);
    assert.equal((await engine.confirmCheckpoint()).ok, true);
  }
}
const ending = (engine, qr) => engine.choose(engine.scan(qr), 1);
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.stack}`); }
}

(async () => {
  await test('Scenario A commits final checkpoint and victory in one revision', async () => {
    const { engine, storage } = await setup('linear');
    await route(engine, ['03', '01', '04']);
    const baseline = await storage.snapshot();
    assert.equal((await ending(engine, '02')).completed, true);
    const { active, revision } = await storage.snapshot();
    assert.equal(revision, baseline.revision + 1);
    assert.equal(active.save.completed, true);
    assert.equal(active.save.scenarioFinished, true);
    assert.deepEqual(active.save.scenarioState.completedCheckpoints, ['03', '01', '04', '02']);
  });
  await test('Scenario B can save the route, reload, and finish from its final encounter', async () => {
    const { engine, storage } = await setup('linear');
    await route(engine, ['02', '01', '03', '04']);
    assert.equal(engine.getCompletionStatus().scenarioFinished, true);
    assert.equal(engine.getCompletionStatus().completed, false);
    const { engine: reopened } = await createCompletionEngine({ storage });
    assert.equal(reopened.scan('99').code, 'COMPLETED_CHECKPOINT_REQUIRED');
    assert.equal((await ending(reopened, '04')).completed, true);
    assert.equal(reopened.getCompletionSummary().scenarioId, 'scenario-b');
  });
  await test('no scenario selection, unknown scan, and raw terminal string are denied', async () => {
    const { engine, storage } = await setup('linear');
    const baseline = await storage.snapshot();
    assert.equal(engine.scan('99').ok, false);
    assert.equal((await engine.choose('TITLE_SCREEN', 1)).code, 'NO_AUTHORIZED_DIALOGUE');
    assert.equal((await engine.confirmCheckpoint()).ok, false);
    assert.deepEqual(await storage.snapshot(), baseline);
  });
  await test('an authorized early ending cannot finish a partial route', async () => {
    const { engine, storage } = await setup('linear', a => { a.gameData.encounters['guard-a'].pages['0101'].buttons[0].next = 'TITLE_SCREEN'; });
    const view = engine.scan('03'), baseline = await storage.snapshot(), progress = engine.getProgress();
    assert.equal((await engine.choose(view, 1)).code, 'INCOMPLETE_ROUTE');
    assert.deepEqual(await storage.snapshot(), baseline);
    assert.deepEqual(engine.getProgress(), progress);
  });
  await test('a Stage 1 ending authored at an earlier checkpoint works after the route is complete', async () => {
    const { engine } = await setup('linear', a => {
      a.gameData.encounters['guard-a'].pages['0101'].buttons[0].next = 'TITLE_SCREEN';
      a.gameData.encounters['wizard-a'].pages['0401'].buttons[0].next = '0101';
    });
    await route(engine, ['03', '01', '04', '02']);
    const final = engine.scan('02');
    const earlier = await engine.choose(final, 1);
    assert.equal(earlier.page.id, '0101');
    assert.equal((await engine.choose(earlier, 1)).completed, true);
  });
  await test('out-of-order blocked QR and wrong scenario cannot win or switch route', async () => {
    const { engine } = await setup('linear');
    engine.scan('03');
    const blocked = engine.scan('02');
    assert.equal(blocked.type, 'blocked');
    assert.equal((await engine.choose(blocked, 1)).ok, false);
    assert.equal(engine.getProgress().scenarioState.scenarioId, 'scenario-a');
  });
  await test('a final encounter preview does not confer authorization', async () => {
    const { engine } = await setup('linear');
    engine.scan('02');
    const preview = engine.scan('04');
    assert.equal(preview.type, 'preview');
    assert.equal(preview.page.buttons[0].next, 'TITLE_SCREEN');
    assert.equal((await engine.choose(preview, 1)).ok, false);
  });
  await test('merely opening the final NPC never finishes a route', async () => {
    const { engine, storage } = await setup('linear');
    await route(engine, ['03', '01', '04']);
    engine.scan('02');
    await engine.flush();
    assert.equal((await storage.getActive()).save.completed, false);
    assert.equal(engine.getCompletionStatus().scenarioFinished, false);
  });
  await test('circular ending enforces its real condition and supports arbitrary order', async () => {
    for (const order of [['01', '03'], ['03', '01']]) {
      const { engine } = await setup('circular');
      assert.equal((await ending(engine, '02')).code, 'CONDITION_NOT_MET');
      for (const qr of order) engine.scan(qr);
      assert.equal(engine.getCompletionStatus().completed, false);
      assert.equal((await ending(engine, '02')).completed, true);
      assert.equal(engine.getCompletionSummary().distinctVisited, 3);
    }
  });
  await test('visit-count branches use authorized history', async () => {
    const { engine } = await setup('circular');
    assert.equal((await engine.choose(engine.scan('01'), 2)).code, 'CONDITION_NOT_MET');
    assert.equal((await engine.choose(engine.scan('01'), 2)).code, 'DIALOGUE_CLOSED');
  });
  await test('non-linear ending permits free exploration and skips an unrelated side quest', async () => {
    const { engine } = await setup('non-linear', a => { a.gameData.questDisplayNames.side = 'Optional'; });
    assert.equal((await ending(engine, '02')).completed, true);
    assert.deepEqual(engine.getProgress().quests, { greeting: 'completed' });
    assert.equal(engine.getCompletionStatus().scenarioFinished, false);
  });
  await test('a real item condition distinguishes exploration from winning', async () => {
    const { engine } = await setup('non-linear', a => {
      a.gameData.encounters['02'].pages['0201'].condition = { 1: 'save.inventory.includes("Token")' };
    });
    assert.equal((await ending(engine, '02')).code, 'CONDITION_NOT_MET');
    await engine.choose(engine.scan('01'), 1);
    assert.deepEqual(engine.getProgress().inventory, ['Token']);
    assert.equal(engine.getCompletionStatus().completed, false);
    assert.equal((await ending(engine, '02')).completed, true);
  });
  await test('stale, cloned and cross-session views cannot execute the ending', async () => {
    const { engine } = await setup('non-linear');
    const old = engine.scan('02');
    engine.scan('99');
    assert.equal((await engine.choose(old, 1)).ok, false);
    const current = engine.scan('02');
    assert.equal((await engine.choose({ ...current }, 1)).ok, false);
    const other = await setup('non-linear');
    assert.equal((await other.engine.choose(current, 1)).ok, false);
  });
  await test('page jumps and modified displayed buttons are ignored', async () => {
    const { engine } = await setup('non-linear');
    const view = engine.scan('01');
    view.page.buttons[0].next = 'TITLE_SCREEN';
    assert.equal((await engine.choose(view, 999)).code, 'UNKNOWN_BUTTON');
    assert.equal((await engine.choose(view, 1)).code, 'DIALOGUE_CLOSED');
    assert.equal(engine.getCompletionStatus().completed, false);
  });
  await test('actual multi-page dialogue proves the path and expires the previous view', async () => {
    const { engine } = await setup('non-linear', a => {
      const pages = a.gameData.encounters['02'].pages;
      pages['0202'] = { ...structuredClone(pages['0201']), id: '0202' };
      pages['0201'].buttons[0].next = '0202';
    });
    const start = engine.scan('02');
    const end = await engine.choose(start, 1);
    assert.equal(end.page.id, '0202');
    assert.equal((await engine.choose(start, 1)).ok, false);
    assert.equal((await engine.choose(end, 1)).completed, true);
  });
  await test('unsupported actions fail closed without applying preceding effects', async () => {
    const { engine } = await setup('non-linear', a => {
      a.gameData.encounters['02'].pages['0201'].actions.push({ type: 'START_TIMER' });
    });
    assert.equal((await ending(engine, '02')).code, 'UNSUPPORTED_ACTION');
    assert.deepEqual(engine.getProgress().quests, {});
  });
  await test('duplicate terminal events do not write or apply actions again', async () => {
    const { engine, storage } = await setup('non-linear');
    const view = engine.scan('02');
    assert.equal((await engine.choose(view, 1)).completed, true);
    const baseline = await storage.snapshot();
    assert.equal((await engine.choose(view, 1)).code, 'ALREADY_COMPLETED');
    assert.equal((await engine.flush()).completed, true);
    assert.deepEqual(await storage.snapshot(), baseline);
  });
  await test('failed linear write retains consistent persisted state and retries once', async () => {
    const { engine, storage, abortNext } = await setup('linear');
    await route(engine, ['03', '01', '04']);
    const baseline = await storage.snapshot();
    abortNext();
    assert.equal((await ending(engine, '02')).code, 'STORAGE_ERROR');
    assert.equal(engine.getCompletionSummary().code, 'NOT_COMPLETED');
    assert.equal(engine.getCompletionStatus().scenarioFinished, false);
    assert.equal(engine.getCompletionStatus().pendingVictory, true);
    assert.deepEqual(await storage.snapshot(), baseline);
    assert.equal((await engine.flush()).completed, true);
  });
  await test('concurrent changes invalidate a pending session', async () => {
    const { engine, storage } = await setup('non-linear');
    const { active, revision } = await storage.snapshot();
    await storage.updateSave({ ...active.save, knowledge: ['newer'] }, revision);
    assert.equal((await ending(engine, '02')).code, 'STALE_TRANSITION');
    assert.equal((await engine.flush()).code, 'STALE_TRANSITION');
    assert.deepEqual((await storage.getActive()).save.knowledge, ['newer']);
    assert.equal((await storage.getActive()).save.completed, false);
  });
  for (const [key, value, code] of [['id', 'different', 'UNKNOWN_ADVENTURE'],
    ['version', '2.0.0', 'INCOMPATIBLE_ADVENTURE_VERSION'], ['type', 'circular', 'INVALID_SAVE']]) {
    await test(`wrong adventure ${key} rejected`, async () => {
      const { storage } = await setup('non-linear');
      const snapshot = await storage.snapshot();
      snapshot.active.save.adventure[key] = value;
      assert.equal((await createCompletionEngine({ storage: { snapshot: async () => snapshot } })).code, code);
    });
  }
  await test('invalid history, timestamp and contradictory linear completion rejected', async () => {
    const { storage } = await setup('linear');
    const snapshot = await storage.snapshot(), { save, adventure } = snapshot.active;
    assert.equal(validateAdventureSave({ ...save, completedAt: 1 }, adventure).ok, false);
    save.completed = true;
    assert.equal((await createCompletionEngine({ storage: { snapshot: async () => snapshot } })).code, 'INCOMPLETE_ROUTE');
    save.completed = false;
    save.encounterHistory = { visits: { unknown: 1 }, distinctVisited: 1 };
    assert.equal((await createCompletionEngine({ storage: { snapshot: async () => snapshot } })).code, 'INVALID_HISTORY');
  });
  await test('replay confirmation and failed transaction preserve all persisted fields', async () => {
    const { engine, storage, abortNext } = await setup('non-linear');
    await ending(engine, '02');
    const victory = await prepareVictory(storage), baseline = await storage.snapshot();
    assert.equal((await victory.replay()).code, 'CONFIRMATION_REQUIRED');
    abortNext();
    assert.equal((await victory.replay({ confirmed: true })).ok, false);
    assert.deepEqual(await storage.snapshot(), baseline);
  });
  await test('confirmed replay resets a populated linear save and retains the package', async () => {
    const { engine, storage } = await setup('linear', undefined, save => {
      Object.assign(save, { inventory: ['Item'], hadItems: ['Item', 'Old'], knowledge: ['Fact'],
        quests: { q: 'active' }, encounters: { test: '0101' }, timers: { test: { endAt: 1, resumePage: '0101' } },
        itemTimers: { Item: { endAt: 1 } }, flags: { castleOpen: true, unlockedAreas: ['Area'] },
        itemState: { counters: { x: 1 }, usedButtons: { x: true }, oneTimeRewards: { y: true } } });
    });
    await route(engine, ['03', '01', '04']);
    await ending(engine, '02');
    const { active } = await storage.snapshot();
    const victory = await prepareVictory(storage);
    assert.equal((await victory.replay({ confirmed: true })).ok, true);
    const reopened = await storage.getActive();
    assert.deepEqual(reopened.adventure, active.adventure);
    assert.deepEqual(reopened.files, active.files);
    assert.deepEqual(reopened.save, { ...createAdventureSave(active.adventure).save, lastSavedAt: reopened.save.lastSavedAt });
    assert.equal((await prepareVictory(storage)).code, 'NOT_COMPLETED');
    assert.equal((await victory.replay({ confirmed: true })).code, 'STALE_TRANSITION');
  });
  await test('a replay lease cannot reset a replacement adventure', async () => {
    const { engine, storage } = await setup('non-linear');
    await ending(engine, '02');
    const victory = await prepareVictory(storage);
    const baseline = await storage.snapshot();
    const files = Object.fromEntries(['manifest', 'game-data'].map(name =>
      [`${name}.json`, Buffer.from(JSON.stringify(load('non-linear', name)).replace('non-linear-demo', 'different-demo'))]));
    const staged = await storage.stage({ files }, baseline);
    await storage.commit(staged.token);
    const replacement = await storage.snapshot();
    assert.equal((await victory.replay({ confirmed: true })).code, 'STALE_TRANSITION');
    assert.deepEqual(await storage.snapshot(), replacement);
  });
  console.log(`Stage 10 Node: ${passed} passed; ${failed} failed.`);
  if (process.argv.includes('--browser')) {
    const server = createTesterServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qrcq-stage10-browser-'));
    try {
      const browser = process.env.QRCQ_TEST_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      const url = `http://127.0.0.1:${server.address().port}/tests/completion-browser.html`;
      for (const [address, options] of [[url, { keyboard: true }], [url + '?restart', {}]]) {
        const result = await runBrowser(browser, profile, address, options);
        console.log(result);
        assert.match(result, /BROWSER: \d+ passed; 0 failed; complete/);
      }
    } catch (error) { failed++; console.error(error.stack); }
    finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(profile, { recursive: true, force: true }); }
  }
  process.exitCode = failed ? 1 : 0;
})();
