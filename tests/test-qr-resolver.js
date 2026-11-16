'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createQRResolver } = require('../adventure-system/qr-resolver.js');
const root = path.join(__dirname, '..');
const copy = v => JSON.parse(JSON.stringify(v));
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const fixture = (type = 'linear') => ({
  manifest: require(`../adventure-system/samples/${type}/manifest.json`),
  gameData: require(`../adventure-system/samples/${type}/game-data.json`),
  ...(type === 'linear' ? { scenarioData: require('../adventure-system/samples/linear/scenarios.json') } : {})
});
const make = (type = 'linear', policy) => {
  const data = copy(fixture(type));
  if (policy) data.scenarioData.scenarios['scenario-a'].outOfOrder = policy;
  const created = createQRResolver(data);
  assert.equal(created.ok, true);
  return created.resolver;
};
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (e) { failed++; console.error(`FAIL ${name}\n${e.stack}`); }
}
test('Scenario A QR 02 is Wizard after required checkpoints', () => {
  const r = make();
  for (const qr of ['03', '01', '04']) assert.equal(r.completeCheckpoint(r.scan(qr)).ok, true);
  const result = r.scan('02');
  assert.equal(result.encounterId, 'wizard-a');
  assert.equal(result.encounter.pages[result.encounter.startPage].speaker, 'Wizard');
});
test('Scenario B QR 02 is Guard', () => {
  const result = make().scan('02');
  assert.equal(result.encounterId, 'guard-b');
  assert.equal(result.encounter.pages[result.encounter.startPage].speaker, 'Guard');
});
for (const [qr, id] of [['03', 'scenario-a'], ['02', 'scenario-b']]) {
  test(`starting QR ${qr} selects ${id}`, () => assert.equal(make().scan(qr).scenarioId, id));
}
test('invalid starts do not select a scenario', () => {
  const r = make(); assert.equal(r.scan('01').code, 'INVALID_START');
  assert.equal(r.getStatus().scenarioId, null); assert.equal(r.scan('02').scenarioId, 'scenario-b');
});
test('later starting QR cannot switch scenarios', () => {
  const r = make('linear', 'preview'); r.scan('03');
  assert.equal(r.scan('02').encounterId, 'wizard-a');
  assert.equal(r.getStatus().scenarioId, 'scenario-a');
});
for (const type of ['circular', 'non-linear']) {
  test(`${type} resolves in arbitrary order without route or scenario state`, () => {
    const r = make(type);
    for (const qr of ['02', '01', '02']) {
      const result = r.scan(qr);
      assert.equal(result.type, 'encounter'); assert.equal(result.encounterId, qr);
      assert.equal(result.scenarioId, null); assert.equal(result.access, 'full');
      assert.equal(result.canCompleteCheckpoint, false); assert.equal(r.authorizeMutation(result), true);
      assert.deepEqual(result.encounter, fixture(type).gameData.encounters[qr]);
      assert.equal(r.completeCheckpoint(result).ok, false);
    }
  });
}
for (const type of ['linear', 'circular', 'non-linear']) {
  test(`${type} unknown QR denies access`, () => {
    const r = make(type); if (type === 'linear') r.scan('03');
    const result = r.scan('99'); assert.equal(result.type, 'unknown');
    assert.equal(result.errorId, 'UNKNOWN_QR'); assert.equal(result.encounter, null);
    assert.equal(r.authorizeMutation(result), false);
  });
}
test('block prevents interaction', () => {
  const r = make(); r.scan('03'); const result = r.scan('02');
  assert.equal(result.type, 'blocked'); assert.equal(result.access, 'blocked');
  assert.equal(result.encounter, null); assert.equal(r.authorizeMutation(result), false);
  assert.equal(r.completeCheckpoint(result).ok, false);
});
test('preview carries Stage 2 read-only permissions', () => {
  const r = make('linear', 'preview'); r.scan('03'); const result = r.scan('02');
  assert.equal(result.type, 'preview'); assert.equal(result.access, 'preview');
  assert.equal(result.readOnly, true); assert.equal(result.canCompleteCheckpoint, false);
  assert.equal(result.progressionSensitiveActionsAllowed, false);
  assert.equal(r.authorizeMutation(result), false); assert.equal(r.completeCheckpoint(result).ok, false);
});
test('allow retains checkpoint and progress-sensitive restrictions', () => {
  const r = make('linear', 'allow'); r.scan('03'); const result = r.scan('02');
  assert.equal(result.type, 'encounter'); assert.equal(result.access, 'full');
  assert.equal(result.readOnly, false); assert.equal(result.canCompleteCheckpoint, false);
  assert.equal(result.progressionSensitiveActionsAllowed, false);
  assert.equal(r.authorizeMutation(result), false); assert.equal(r.completeCheckpoint(result).ok, false);
});
test('scanning never advances checkpoints', () => {
  const r = make('linear', 'allow');
  for (const qr of ['03', '03', '01', '02', '99', '04']) r.scan(qr);
  assert.equal(r.getStatus().currentIndex, 0); assert.deepEqual(r.getStatus().state.completedCheckpoints, []);
});
test('expected interaction can explicitly complete only once', () => {
  const r = make(); const result = r.scan('03'); assert.equal(r.authorizeMutation(result), true);
  assert.equal(r.completeCheckpoint(result).expectedQR, '01');
  assert.equal(r.completeCheckpoint(result).ok, false); assert.equal(r.authorizeMutation(result), false);
});
for (const action of ['ADD_ITEM', 'REMOVE_ITEM', 'ADD_KNOWLEDGE', 'START_QUEST', 'COMPLETE_QUEST',
  'SET_FLAG', 'OPEN_CASTLE', 'UNLOCK_AREA', 'ADD_COUNTER', 'SET_COUNTER', 'RESET_COUNTER',
  'START_TIMER', 'STOP_TIMER', 'START_ITEM_TIMER', 'STOP_ITEM_TIMER', 'NEXT_SCAN', 'COMPLETION', 'FUTURE_ACTION']) {
  test(`preview cannot authorize ${action} or any persistent mutation`, () => {
    const r = make('linear', 'preview'); r.scan('03'); const result = r.scan('02');
    let mutations = 0;
    // Future dispatchers must apply this guard before every side effect.
    if (r.authorizeMutation(result)) mutations++;
    assert.equal(mutations, 0); assert.equal(r.completeCheckpoint(result).ok, false);
  });
}
test('copied or forged permissions cannot authorize mutations', () => {
  const r = make('linear', 'preview'); const expected = r.scan('03');
  assert.equal(r.authorizeMutation({ ...expected }), false);
  const preview = r.scan('02');
  assert.throws(() => { preview.readOnly = false; }, TypeError);
  assert.equal(r.authorizeMutation({ ...preview, readOnly: false, progressionSensitiveActionsAllowed: true }), false);
  for (const value of [null, undefined, {}, 1, '03']) assert.equal(r.authorizeMutation(value), false);
});
for (const qr of ['03', '99', '02', null]) test(`new scan ${qr} revokes previous authorization`, () => {
  const r = make(); const old = r.scan('03'); r.scan(qr);
  assert.equal(r.authorizeMutation(old), false); assert.equal(r.completeCheckpoint(old).ok, false);
});
for (const qr of [2, null, undefined, '2', ' 02 ', '002', 'constructor', '__proto__']) {
  test(`invalid identifier ${String(qr)} is not coerced`, () => {
    const result = make('non-linear').scan(qr);
    assert.equal(result.code, 'INVALID_QR'); assert.equal(result.qr, qr);
  });
}
test('input and returned encounter mutations do not change resolution', () => {
  const data = copy(fixture('non-linear')); const r = createQRResolver(data).resolver;
  const original = copy(data.gameData.encounters['01']);
  data.gameData.encounters['01'].startPage = '9999';
  r.scan('01').encounter.startPage = '8888';
  assert.deepEqual(r.scan('01').encounter, original);
});
for (const [name, change] of [
  ['unknown type', d => d.manifest.type = 'other'], ['unsupported version', d => d.gameData.formatVersion = 2],
  ['missing items', d => delete d.gameData.items], ['missing encounters', d => delete d.gameData.encounters],
  ['invalid start page', d => d.gameData.encounters['guard-a'].startPage = '9999'],
  ['null page', d => d.gameData.encounters['guard-a'].pages['0101'] = null],
  ['invalid policy', d => d.scenarioData.scenarios['scenario-a'].outOfOrder = 'other'],
  ['missing mapping', d => delete d.scenarioData.scenarios['scenario-a'].encounters['03']],
  ['missing scenarios', d => delete d.scenarioData]
]) test(`invalid data: ${name}`, () => {
  const data = copy(fixture()); change(data); const result = createQRResolver(data);
  assert.equal(result.ok, false); assert.equal(result.errorId, 'INVALID_DATA');
  assert.equal(result.resolver, undefined); assert.equal(result.access, 'none');
});
test('nonserializable and missing options fail safely', () => {
  const cyclic = {}; cyclic.self = cyclic;
  for (const data of [null, undefined, {}, { manifest: cyclic }, { manifest: 1n }]) {
    assert.equal(createQRResolver(data).errorId, 'INVALID_DATA');
  }
});
test('route data on unrestricted adventures is rejected', () => {
  for (const type of ['circular', 'non-linear']) {
    const data = copy(fixture(type)); data.scenarioData = fixture().scenarioData;
    assert.equal(createQRResolver(data).ok, false);
  }
});
test('no DOM, camera, network, storage or Node imports needed in browser', () => {
  const context = {};
  vm.runInNewContext(read('adventure-system/scenario-engine.js'), context);
  vm.runInNewContext(read('adventure-system/qr-resolver.js'), context);
  assert.equal(context.QRCQQRResolver.createQRResolver(fixture()).resolver.scan('02').encounterId, 'guard-b');
  assert.equal(context.QRCQQRResolver.createQRResolver(fixture('circular')).resolver.scan('01').encounterId, '01');
});
test('missing browser engine fails closed for linear only', () => {
  const context = {}; vm.runInNewContext(read('adventure-system/qr-resolver.js'), context);
  assert.equal(context.QRCQQRResolver.createQRResolver(fixture()).errorId, 'ENGINE_UNAVAILABLE');
  assert.equal(context.QRCQQRResolver.createQRResolver(fixture('non-linear')).ok, true);
});
for (const language of ['en', 'hu']) test(`shipped ${language} encounters and item identifiers remain compatible`, () => {
  const context = { window: {} }; vm.runInNewContext(read(`data/game-data_${language}.js`), context);
  const game = copy(context.window.QR_CITY_QUEST_DATA);
  const r = createQRResolver({ manifest: fixture('non-linear').manifest, gameData: { ...game, formatVersion: 1 } }).resolver;
  assert.ok(r);
  for (const [qr, encounter] of Object.entries(game.encounters)) {
    const result = r.scan(qr); assert.equal(result.qr, qr); assert.equal(result.encounterId, qr);
    assert.deepEqual(result.encounter, encounter);
  }
  for (const [name, item] of Object.entries(game.items)) {
    if (!item.startPage) continue;
    const qr = item.startPage.slice(0, 2), result = r.scan(qr);
    if (game.encounters[qr]) assert.equal(result.type, 'encounter');
    else { assert.equal(result.type, 'item'); assert.equal(result.itemId, name); assert.deepEqual(result.item, item); }
  }
  assert.deepEqual(game, copy(context.window.QR_CITY_QUEST_DATA));
});
test('namespaced non-linear QR formatting and encounter precedence match original lookup', () => {
  const data = copy(fixture('non-linear'));
  data.gameData.encounters['london:02'] = data.gameData.encounters['02'];
  data.gameData.items.Key = { startPage: 'london:0201', pages: {} };
  let r = createQRResolver(data).resolver;
  assert.equal(r.scan('london:02').encounterId, 'london:02');
  delete data.gameData.encounters['london:02']; r = createQRResolver(data).resolver;
  assert.equal(r.scan('london:02').itemId, 'Key');
});
console.log(`\n${passed} passed; ${failed} failed.`);
process.exitCode = failed ? 1 : 0;
