'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createQRResolver } = require('../adventure-system/qr-resolver.js');
const { createEncounterHistory, validateCondition } = require('../adventure-system/encounter-history.js');
const saves = require('../adventure-system/adventure-save.js');
const { validatePackage } = require('../adventure-system/validator.js');
const clone = v => JSON.parse(JSON.stringify(v));
function setup(type = 'circular', policy) {
  const data = clone({
    manifest: require(`../adventure-system/samples/${type}/manifest.json`),
    gameData: require(`../adventure-system/samples/${type}/game-data.json`),
    ...(type === 'linear' ? { scenarioData: require('../adventure-system/samples/linear/scenarios.json') } : {})
  });
  if (policy) data.scenarioData.scenarios['scenario-a'].outOfOrder = policy;
  const resolver = createQRResolver(data).resolver;
  const created = createEncounterHistory({ gameData: data.gameData, resolver });
  assert.equal(created.ok, true);
  const history = created.history;
  const open = qr => { const permission = resolver.scan(qr); return history.recordVisit(permission.encounterId, permission); };
  return { data, resolver, history, open };
}
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (e) { failed++; console.error(`FAIL ${name}\n${e.stack}`); }
}
test('first successful opening and repeated openings', () => {
  const { history: h, open } = setup();
  assert.equal(open('01').ok, true); assert.equal(h.getVisitCount('01'), 1);
  assert.equal(open('01').ok, true); assert.equal(h.getVisitCount('01'), 2);
  assert.equal(h.getDistinctVisitedCount(), 1);
});
test('three NPCs count separately without route data', () => {
  const { history: h, open, data } = setup();
  assert.equal(data.scenarioData, undefined); assert.equal(data.gameData.route, undefined);
  for (const q of ['03', '01', '02', '03']) assert.equal(open(q).ok, true);
  assert.equal(h.getDistinctVisitedCount(), 3);
  assert.deepEqual(h.exportHistory().visits, { '01': 1, '02': 1, '03': 2 });
});
test('camera detection and resolution alone record nothing', () => {
  const { resolver: r, history: h } = setup(); r.scan('01'); r.scan('02');
  assert.equal(h.getDistinctVisitedCount(), 0);
});
for (const policy of ['block', 'preview', 'allow']) test(`${policy} out of order cannot mutate history`, () => {
  const { resolver: r, history: h } = setup('linear', policy);
  r.scan('03'); const p = r.scan('02');
  assert.equal(h.recordVisit(p.encounterId, p).ok, false);
  assert.equal(h.getDistinctVisitedCount(), 0);
});
test('unknown QR and invalid permissions record nothing', () => {
  const { resolver: r, history: h } = setup();
  for (const p of [r.scan('99'), null, undefined, {}, 1, '01', { readOnly: false }])
    assert.equal(h.recordVisit('01', p).ok, false);
  assert.equal(h.getDistinctVisitedCount(), 0);
});
test('copied, forged, foreign and mismatched permissions fail', () => {
  const { resolver: r, history: h } = setup(); const p = r.scan('01');
  for (const fake of [{ ...p }, { ...p, readOnly: false }, setup().resolver.scan('01')])
    assert.equal(h.recordVisit('01', fake).ok, false);
  assert.equal(h.recordVisit('02', p).ok, false);
  assert.equal(h.recordVisit('01', p).ok, true);
  assert.equal(h.recordVisit('01', p).ok, false); // duplicate opening callback
});
for (const qr of ['01', '02', '99', null]) test(`scan ${qr} revokes old permission`, () => {
  const { resolver: r, history: h } = setup(); const p = r.scan('01'); r.scan(qr);
  assert.equal(h.recordVisit('01', p).ok, false);
});
test('checkpoint completion revokes visit permission', () => {
  const { resolver: r, history: h } = setup('linear'); const p = r.scan('03');
  assert.equal(r.completeCheckpoint(p).ok, true);
  assert.equal(h.recordVisit(p.encounterId, p).ok, false);
});
test('linear visit recording leaves checkpoint state unchanged', () => {
  const { resolver: r, history: h } = setup('linear'); const p = r.scan('03');
  const before = r.getStatus(); assert.equal(h.recordVisit(p.encounterId, p).ok, true);
  assert.deepEqual(r.getStatus(), before); assert.equal(h.hasVisited('guard-a'), true);
  assert.equal(h.hasVisited('03'), false);
});
test('same physical QR resolves to different NPCs in separate scenarios', () => {
  const a = setup('linear'), b = setup('linear');
  for (const qr of ['03', '01', '04']) assert.equal(a.resolver.completeCheckpoint(a.resolver.scan(qr)).ok, true);
  assert.equal(a.open('02').ok, true); assert.equal(b.open('02').ok, true);
  assert.equal(a.history.hasVisited('wizard-a'), true);
  assert.equal(b.history.hasVisited('guard-b'), true);
});
test('all visit conditions and existing flags quests counters combine read-only', () => {
  const { history: h, open } = setup();
  assert.equal(h.evaluateCondition('HAS_VISITED("01")'), false);
  open('01'); open('02'); open('03');
  assert.equal(h.evaluateCondition('VISIT_COUNT("01", 2)'), false); open('01');
  const before = h.exportHistory();
  for (const expression of ['HAS_VISITED("01")', 'VISIT_COUNT("01", 2)', 'DISTINCT_VISITED_COUNT(3)',
    'HAS_VISITED("03") && save.quests["quest"] === "active" && save.flags.unlockedAreas.includes("GARDEN") && counter("uses", "Key") >= 2'])
    assert.equal(h.evaluateCondition(expression, { save: { quests: { quest: 'active' }, flags: { unlockedAreas: ['GARDEN'] }, itemState: { counters: { 'Key::uses': 2 } } } }), true);
  assert.equal(h.evaluateCondition('DISTINCT_VISITED_COUNT(4)'), false);
  assert.deepEqual(h.exportHistory(), before);
});
for (const expr of ['HAS_VISITED()', 'HAS_VISITED("99")', 'VISIT_COUNT("01")', 'VISIT_COUNT("01", 0)',
  'VISIT_COUNT("01", -1)', 'VISIT_COUNT("01", 1.5)', 'VISIT_COUNT("01", "2")',
  'DISTINCT_VISITED_COUNT(0)', 'DISTINCT_VISITED_COUNT(9007199254740992)', 'UNKNOWN(1)', 'HAS_VISITED("constructor")'])
  test(`invalid expression ${expr}`, () => {
    const { data, history: h } = setup();
    assert.notEqual(validateCondition(expr, data.gameData.encounters), null);
    assert.throws(() => h.evaluateCondition(expr));
    assert.equal(h.getDistinctVisitedCount(), 0);
  });
test('save export restart and repeated restore preserve counts without aliasing', () => {
  const { history: h, open, data } = setup(); open('01'); open('01'); open('02');
  const save = saves.createAdventureSave(data).save; save.encounterHistory = h.exportHistory();
  const encoded = saves.exportAdventureSave(save, data); assert.equal(encoded.ok, true);
  const loaded = saves.loadAdventureSave(encoded.data, data); assert.equal(loaded.ok, true);
  const resumed = setup().history; const snapshot = loaded.save.encounterHistory;
  assert.equal(resumed.restoreHistory(snapshot).ok, true);
  assert.equal(resumed.restoreHistory(snapshot).ok, true);
  assert.deepEqual(resumed.exportHistory(), h.exportHistory());
  snapshot.visits['01'] = 99; assert.equal(resumed.getVisitCount('01'), 2);
  const out = resumed.exportHistory(); out.visits['01'] = 50; assert.equal(resumed.getVisitCount('01'), 2);
  assert.equal(saves.createAdventureSave(data).save.encounterHistory.distinctVisited, 0);
});
for (const data of [null, [], {}, { visits: {}, distinctVisited: 1 },
  ...[-1, 0, 1.5, NaN, Infinity, '1', Number.MAX_SAFE_INTEGER + 1].map(n => ({ visits: { '01': n }, distinctVisited: 1 })),
  ...['', ' ', '99', 'bad id', 'constructor', '__proto__'].map(id => ({ visits: Object.fromEntries([[id, 1]]), distinctVisited: 1 }))])
  test(`corrupt restore rejected ${JSON.stringify(data)}`, () => {
    const { history: h, open } = setup(); open('01'); const before = h.exportHistory();
    assert.equal(h.restoreHistory(data).ok, false); assert.deepEqual(h.exportHistory(), before);
  });
test('overflow cannot corrupt counts', () => {
  const { history: h, open } = setup();
  h.restoreHistory({ visits: { '01': Number.MAX_SAFE_INTEGER }, distinctVisited: 1 });
  assert.equal(open('01').ok, false); assert.equal(h.getVisitCount('01'), Number.MAX_SAFE_INTEGER);
});
test('reset clears history and does not replay consumed permission', () => {
  const { history: h, resolver: r } = setup(); const p = r.scan('01'); h.recordVisit('01', p);
  h.resetHistory(); assert.deepEqual(h.exportHistory(), { visits: {}, distinctVisited: 0 });
  assert.equal(h.recordVisit('01', p).ok, false);
});
test('non-linear adventures retain existing behavior and support visits', () => {
  const { history: h, open, resolver: r } = setup('non-linear');
  for (const qr of ['02', '01', '02']) assert.equal(open(qr).ok, true);
  assert.equal(h.getVisitCount('02'), 2); assert.equal(r.getStatus().scenarioId, null);
  const p = r.scan('11'); assert.equal(p.type, 'item');
  assert.equal(h.recordVisit('01', p).ok, false);
});
test('all samples validate with Stage 5 expressions', () => {
  for (const type of ['linear', 'circular', 'non-linear']) {
    const result = validatePackage(path.join(__dirname, '../adventure-system/samples', type));
    assert.equal(result.valid, true, result.errors.join('\n'));
  }
});
test('browser module needs no DOM storage or network', () => {
  const context = {}; const root = path.join(__dirname, '..');
  for (const file of ['mod-system/mod-conditions.js', 'adventure-system/scenario-engine.js',
    'adventure-system/qr-resolver.js', 'adventure-system/encounter-history.js'])
    vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  // Create all data inside the browser realm, as JSON loading would.
  context.fixtureJSON = JSON.stringify(setup().data);
  vm.runInNewContext('const d = JSON.parse(fixtureJSON); const r = QRCQQRResolver.createQRResolver(d).resolver; const h = QRCQEncounterHistory.createEncounterHistory({gameData:d.gameData,resolver:r}).history; const p = r.scan("01"); if (!h.recordVisit("01",p).ok || !h.evaluateCondition(\'HAS_VISITED("01")\')) throw Error("browser history failed");', context);
});
console.log(`\n${passed} passed; ${failed} failed.`);
process.exitCode = failed ? 1 : 0;
