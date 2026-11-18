'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAdventureStorage } = require('../adventure-system/adventure-storage.js');
const { createCompletionEngine } = require('../adventure-system/adventure-completion.js');
const { start } = require('../adventure-system/adventure-integration.js');
const { createGameServer } = require('../tools/serve-integrated-game.js');
const runBrowser = require('./run-stage8-browser.js');

function fixture(type, edit = () => {}) {
  const directory = path.join(__dirname, '../adventure-system/samples', type);
  const names = ['manifest.json', 'game-data.json', ...(type === 'linear' ? ['scenarios.json'] : [])];
  const data = Object.fromEntries(names.map(name => [name, JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'))]));
  edit(data['game-data.json'], data['scenarios.json'], data['manifest.json']);
  const files = Object.fromEntries(names.map(name => [name, Buffer.from(JSON.stringify(data[name]))]));
  if (data['manifest.json'].map) files['images/map.png'] = fs.readFileSync(path.join(directory, 'images/map.png'));
  return { files };
}
function setup() {
  let state = { storageVersion: 1, revision: 0, active: null, staging: null }, abort = false;
  const storage = createAdventureStorage({ backend: {
    read: async () => structuredClone(state),
    async transact(fn) {
      const next = structuredClone(state), result = fn(next);
      if (abort) { abort = false; throw Object.assign(Error('Quota'), { code: 'QuotaExceededError' }); }
      state = next;
      return result;
    }
  } });
  return { storage, abortNext: () => { abort = true; } };
}
async function install(storage, type, edit) {
  const staged = await storage.stage(fixture(type, edit), await storage.snapshot());
  await storage.commit(staged.token, { confirmed: true });
}
async function open(storage) {
  const outcome = await createCompletionEngine({ storage, live: true });
  assert.equal(outcome.ok, true, outcome.code);
  return outcome.engine;
}
const choose = (engine, qr, index = 1, selection) => engine.choose(engine.scan(qr), index, selection);
let passed = 0, failed = 0;
async function test(name, run) {
  try { await run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); }
}

(async () => {
  await test('fresh built-in and persisted startup never reread legacy backup', async () => {
    const { storage } = setup();
    const session = await start({ storage, legacy: () => null });
    assert.equal(session.active.kind, 'builtin');
    assert.equal((await start({ storage, legacy: () => { throw Error('must not read'); } })).active.kind, 'builtin');
  });
  await test('migration preserves original fields and starts one authoritative save', async () => {
    const { storage } = setup();
    const raw = JSON.stringify({ schemaVersion: 1, inventory: ['Sweets'], hadItems: ['Old', 'Sweets'],
      quests: { quest: 'active' }, encounters: { '04': '0401' }, timers: { '03': { endAt: 123, resumePage: '0301' } },
      itemTimers: { Sweets: { endAt: 345 } }, itemState: { usedButtons: { marker: true }, oneTimeRewards: { reward: true },
        counters: { 'Fishing Rod::salmonCaught': 3 } } });
    const session = await start({ storage, legacy: () => raw });
    const save = session.saved();
    for (const name of ['inventory', 'hadItems', 'quests', 'encounters', 'timers', 'itemTimers', 'itemState'])
      assert.deepEqual(save[name], JSON.parse(raw)[name]);
    assert.equal((await session.update({ ...save, inventory: [] })).ok, true);
    assert.deepEqual((await storage.getActive()).save.inventory, []);
    assert.equal(JSON.parse(raw).inventory[0], 'Sweets');
  });
  await test('malformed migration and failed replacement keep the previous committed state', async () => {
    const { storage, abortNext } = setup();
    await assert.rejects(start({ storage, legacy: () => 'malformed' }));
    assert.equal((await storage.snapshot()).active, null);
    await install(storage, 'linear');
    const before = await storage.snapshot();
    assert.equal((await storage.activateBuiltIn(before.revision)).code, 'CONFIRMATION_REQUIRED');
    abortNext();
    await assert.rejects(storage.activateBuiltIn(before.revision, { confirmed: true }), { code: 'QuotaExceededError' });
    assert.deepEqual(await storage.snapshot(), before);
    assert.equal((await storage.activateBuiltIn(before.revision, { confirmed: true })).ok, true);
    assert.equal((await start({ storage, legacy: () => 'stale legacy' })).active.kind, 'builtin');
    assert.deepEqual((await storage.getActive()).files, {});
    await assert.rejects(storage.activateBuiltIn(before.revision, { confirmed: true }), { code: 'STALE_TRANSITION' });
  });
  await test('startup recovers abandoned staging and restores downloaded content from validated files', async () => {
    const { storage } = setup();
    await install(storage, 'circular');
    const staged = await storage.stage(fixture('linear'), await storage.snapshot());
    assert.equal((await start({ storage })).active.adventure.manifest.id, 'circular-demo');
    await assert.rejects(storage.commit(staged.token, { confirmed: true }), { code: 'STALE_TRANSITION' });
  });
  await test('two live save authorities cannot overwrite each other', async () => {
    const { storage } = setup();
    const first = await start({ storage, legacy: () => null });
    const second = await start({ storage, legacy: () => null });
    assert.equal((await first.update({ ...first.saved(), knowledge: ['First'] })).ok, true);
    assert.equal((await second.update({ ...second.saved(), knowledge: ['Second'] })).code, 'STALE_TRANSITION');
    assert.deepEqual((await storage.getActive()).save.knowledge, ['First']);
  });
  await test('linear advance follows authorized dialogue and rejects preview, wrong route and stale view', async () => {
    const { storage } = setup();
    await install(storage, 'linear');
    const engine = await open(storage);
    const first = engine.scan('02');
    assert.equal(first.page.speaker, 'Guard');
    assert.equal((await engine.choose(first, 1)).code, 'DIALOGUE_CLOSED');
    await engine.flush();
    const preview = engine.scan('04');
    assert.equal(preview.readOnly, true);
    assert.deepEqual(engine.choices(preview), []);
    assert.equal((await engine.choose(preview, 1)).ok, false);
    assert.equal((await engine.choose(first, 1)).ok, false);
    assert.equal(engine.getProgress().scenarioState.currentIndex, 1);
  });
  await test('allow offers local read-only navigation without actions or saved visits', async () => {
    const { storage } = setup();
    await install(storage, 'linear', (game, scenarios) => {
      scenarios.scenarios['scenario-a'].outOfOrder = 'allow';
      const npc = game.encounters['wizard-a'];
      npc.pages['0499'] = { ...npc.pages['0401'], id: '0499' };
      npc.pages['0401'].buttons = [{ index: 1, label: 'Continue', next: '0499' }];
      game.questDisplayNames.override = 'Override';
      npc.pages['0401'].actions = [{ type: 'COMPLETE_QUEST', data: 'override' }];
    });
    const engine = await open(storage);
    engine.scan('03');
    const before = engine.getProgress();
    const view = engine.scan('02');
    assert.equal(view.readOnly, true);
    const opened = await engine.choose(view, 1);
    assert.equal(opened.page.id, '0499');
    assert.equal((await engine.choose(opened, 1)).ok, false);
    assert.deepEqual(engine.getProgress(), before);
  });
  await test('physical items cannot be duplicated or reclaimed after consumption', async () => {
    const { storage } = setup();
    await install(storage, 'non-linear', game => {
      game.items.Token.pages['1101'].actions = [{ type: 'REMOVE_ITEM', data: 'Token' }];
    });
    const engine = await open(storage);
    assert.equal(engine.scan('11').ok, true);
    assert.equal(engine.scan('11').ok, true);
    assert.deepEqual(engine.getProgress().inventory, ['Token']);
    assert.equal((await choose(engine, '11')).ok, true);
    assert.equal(engine.scan('11').code, 'ITEM_ALREADY_COLLECTED');
    assert.equal(engine.openItem('Token').ok, false);
  });
  await test('inventory dropdown rechecks ownership and authenticates the exact ending option', async () => {
    const { storage } = setup();
    await install(storage, 'non-linear', game => {
      const page = game.encounters['02'].pages['0201'];
      page.actions = [{ type: 'DROPDOWN_INVENTORY', options: [{ label: 'Token', value: 'Token', next: 'TITLE_SCREEN' }], otherNext: 'HOME' }];
    });
    const engine = await open(storage);
    assert.equal((await choose(engine, '02', 1, 'Token')).code, 'INVALID_SELECTION');
    await choose(engine, '01');
    assert.equal((await choose(engine, '02', 1, 'Token')).completed, true);
  });
  await test('timers survive reload, block early actions and resume the correct owner page', async () => {
    const { storage } = setup();
    await install(storage, 'non-linear', game => {
      const pages = game.encounters['01'].pages;
      pages['0102'] = { ...pages['0101'], id: '0102', actions: [] };
      pages['0101'].buttons = [{ index: 1, label: 'Wait', next: '0102' }];
      pages['0101'].actions = [{ type: 'START_TIMER', durationMs: 60000 }, { type: 'START_ITEM_TIMER', data: 'Token', durationMs: 60000 }];
    });
    const engine = await open(storage);
    assert.equal((await choose(engine, '01')).code, 'DIALOGUE_CLOSED');
    await engine.flush();
    const reopened = await open(storage);
    const waiting = reopened.scan('01');
    assert.ok(waiting.waitingUntil);
    assert.equal((await reopened.choose(waiting, 1)).ok, false);
    const baseline = await storage.snapshot();
    const save = baseline.active.save;
    save.timers['01'].endAt = 1;
    await storage.updateSave(save, baseline.revision);
    const resumed = await open(storage);
    assert.equal(resumed.scan('01').page.id, '0102');
    assert.equal(resumed.getProgress().timers['01'], undefined);
    assert.ok(resumed.getProgress().itemTimers.Token.endAt);
  });
  await test('quota failure leaves victory unavailable and old state intact', async () => {
    const { storage, abortNext } = setup();
    await install(storage, 'non-linear');
    const engine = await open(storage), before = await storage.snapshot();
    abortNext();
    assert.equal((await choose(engine, '02')).code, 'QuotaExceededError');
    assert.equal(engine.getCompletionStatus().completed, false);
    assert.deepEqual(await storage.snapshot(), before);
  });
  console.log(`Stage 11 Node: ${passed} passed; ${failed} failed.`);
  if (process.argv.includes('--browser')) {
    const server = createGameServer({ tests: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qrcq-stage11-browser-'));
    try {
      const browser = process.env.QRCQ_TEST_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      const result = await runBrowser(browser, profile, `http://127.0.0.1:${server.address().port}/tests/integration-browser.html`,
        { network: true, timeoutMs: 90000 });
      console.log(result);
      assert.match(result, /BROWSER: \d+ passed; 0 failed; complete/);
    } catch (error) { failed++; console.error(error.stack); }
    finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(profile, { recursive: true, force: true }); }
  }
  process.exitCode = failed ? 1 : 0;
})();
