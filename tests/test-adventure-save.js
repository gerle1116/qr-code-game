'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const api = require('../adventure-system/adventure-save.js');
const { createScenarioEngine } = require('../adventure-system/scenario-engine.js');
const copy = v => JSON.parse(JSON.stringify(v));
const fixture = (type = 'linear') => copy({
  manifest: require(`../adventure-system/samples/${type}/manifest.json`),
  ...(type === 'linear' ? { scenarioData: require('../adventure-system/samples/linear/scenarios.json') } : {}),
  gameData: require(`../adventure-system/samples/${type}/game-data.json`)
});
const core = () => ({ manifest: copy(api.LEGACY_ADVENTURE) });
const fresh = a => { const r = api.createAdventureSave(a); assert.equal(r.ok, true, r.message); return r.save; };
const engine = a => createScenarioEngine(a.scenarioData, a.gameData).engine;
// Representative actual schema, including namespaces, historical rewards and timers.
const legacy = () => ({ schemaVersion: 1, inventory: ['Fishing Rod', 'Silver Ring', 'london:Magic Key'],
  hadItems: ['Fishing Rod', 'Silver Ring', 'london:Magic Key', 'Gold Coin'],
  knowledge: ['library', 'london:localMap'], quests: { 'Find Tower': 'active', greeting: 'completed' },
  encounters: { '04': '-1', '03': '0308', 'london:02': 'london:0202' },
  timers: { '04': { endAt: 1900000000000, resumePage: '0405', waitPage: '0403', extra: 'kept' } },
  itemTimers: { 'Fishing Rod': { endAt: 1900000005000 } },
  flags: { castleOpen: true, unlockedAreas: ['CASTLE_SIDE', 'london:BRIDGE'], extensionFlag: 7 },
  itemState: { counters: { 'Sweets::eaten': 2, 'london:Magic Key::uses': 1 },
    usedButtons: { 'Silver Ring::2601::Put it on.': true },
    oneTimeRewards: { 'Fishing Rod::Blobfish': true, 'Fishing Rod::Great Salmon': true, 'Fishing Rod::Old Boots': true },
    customMechanic: { enabled: true } }, lastSavedAt: 1800000000000,
  futureMechanic: { nested: ['keep', 42, false, null] } });
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (e) { failed++; console.error(`FAIL ${name}: ${e.stack}`); }
}
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
for (const type of ['linear', 'circular', 'non-linear']) test(`creates and validates fresh ${type} save`, () => {
  const a = fixture(type), s = fresh(a);
  assert.deepEqual(s.adventure, { id: a.manifest.id, version: a.manifest.version, type });
  assert.equal(s.schemaVersion, 1); assert.equal(s.adventureSaveVersion, 1);
  assert.deepEqual(s.inventory, []); assert.equal(s.completed, false);
  assert.deepEqual(s.scenarioState, type === 'linear' ? { scenarioId: null, currentIndex: 0, completedCheckpoints: [] } : null);
  assert.equal(api.validateAdventureSave(s, a).ok, true);
});
for (const field of ['inventory', 'hadItems', 'knowledge', 'quests', 'flags', 'encounters', 'timers', 'itemTimers', 'lastSavedAt', 'futureMechanic']) {
  test(`legacy migration preserves ${field}`, () => {
    const input = legacy(), migrated = api.migrateLegacySave(input); assert.equal(migrated.ok, true, migrated.message);
    assert.deepEqual(migrated.save[field], input[field]); assert.notEqual(migrated.save, input);
  });
}
test('legacy counters and marker maps survive with fishing/ring migrations', () => {
  const old = legacy(), r = api.migrateLegacySave(old); assert.equal(r.ok, true, r.message);
  assert.equal(r.save.itemState.counters['Sweets::eaten'], 2);
  for (const key of ['blobfishCaught', 'salmonCaught', 'bootsCaught']) assert.equal(r.save.itemState.counters[`Fishing Rod::${key}`], 1);
  assert.equal(r.save.itemState.counters['Silver Ring::worn'], 1);
  assert.deepEqual(r.save.itemState.usedButtons, old.itemState.usedButtons);
  assert.deepEqual(r.save.itemState.oneTimeRewards, old.itemState.oneTimeRewards);
  assert.deepEqual(r.save.itemState.customMechanic, old.itemState.customMechanic);
  assert.deepEqual(old.itemState.counters, legacy().itemState.counters);
});
test('legacy markers do not overwrite existing nonzero counters', () => {
  const old = legacy(); old.itemState.counters['Fishing Rod::blobfishCaught'] = 3;
  assert.equal(api.migrateLegacySave(old).save.itemState.counters['Fishing Rod::blobfishCaught'], 3);
});
test('missing legacy fields initialize with recovery warnings, including collection history', () => {
  const r = api.migrateLegacySave({ schemaVersion: 1, inventory: ['Token'] });
  assert.equal(r.ok, true, r.message); assert.deepEqual(r.save.hadItems, ['Token']); assert.ok(r.warnings.length);
  assert.deepEqual(r.save.encounterHistory, { visits: {}, distinctVisited: 0 });
});
test('legacy partial nested fields retain unknown flags and mechanics', () => {
  const r = api.migrateLegacySave({ schemaVersion: 1, flags: { custom: true }, itemState: { custom: 'yes' } });
  assert.equal(r.ok, true, r.message); assert.equal(r.save.flags.custom, true);
  assert.equal(r.save.itemState.custom, 'yes'); assert.equal(r.save.flags.castleOpen, false);
});
test('inventory is merged into collection history without losing consumed items', () => {
  const old = legacy(); old.hadItems = ['Gold Coin']; const r = api.migrateLegacySave(old);
  assert.equal(r.ok, true, r.message); assert.deepEqual(r.save.hadItems, ['Gold Coin', ...old.inventory]);
});
test('legacy migration is explicit, nonmutating and accepts JSON copies', () => {
  const old = freeze(legacy()), before = JSON.stringify(old);
  const r = api.migrateLegacySave(old); assert.equal(r.ok, true, r.message);
  assert.equal(JSON.stringify(old), before); assert.equal(api.migrateLegacySave(before).ok, true);
  assert.equal(api.loadAdventureSave(old, core()).code, 'UNSUPPORTED_SAVE_VERSION');
});
test('legacy progress cannot be assigned to an unrelated adventure', () => {
  assert.equal(api.migrateLegacySave(legacy(), fixture('non-linear')).code, 'LEGACY_ADVENTURE_MISMATCH');
});
test('legacy reserved field conflicts require recovery rather than data loss', () => {
  assert.equal(api.migrateLegacySave({ ...legacy(), completed: true }).code, 'MIGRATION_CONFLICT');
});
for (const [field, value] of [['inventory', {}], ['quests', []], ['flags', false], ['itemState', null],
  ['timers', { '04': { endAt: 'bad', resumePage: '0405' } }], ['knowledge', ['valid', 9]]]) {
  test(`malformed legacy ${field} fails without resetting data`, () => {
    const old = { ...legacy(), [field]: value }, before = copy(old);
    assert.equal(api.migrateLegacySave(old).ok, false); assert.deepEqual(old, before);
  });
}
test('malformed old counters are not silently replaced by marker migration', () => {
  const old = legacy(); old.itemState.counters['Fishing Rod::blobfishCaught'] = 'bad';
  assert.equal(api.migrateLegacySave(old).code, 'INVALID_LEGACY_SAVE');
});
test('export/load roundtrip preserves all supported and unknown fields', () => {
  const s = api.migrateLegacySave(legacy()).save, encoded = api.exportAdventureSave(s, core());
  assert.equal(encoded.ok, true); assert.deepEqual(api.loadAdventureSave(encoded.data, core()).save, s);
});
test('validation of frozen input returns a separate copy', () => {
  const a = freeze(fixture()), s = freeze(fresh(a)), before = JSON.stringify(s);
  const result = api.validateAdventureSave(s, a); assert.equal(result.ok, true);
  assert.equal(JSON.stringify(s), before); assert.notEqual(result.save, s);
});
test('restore selected Scenario A retains Wizard mapping on QR 02', () => {
  const a = fixture(); a.scenarioData.scenarios['scenario-a'].outOfOrder = 'allow';
  const e = engine(a); e.scan('03'); e.completeCheckpoint('03');
  const s = api.captureScenarioState(fresh(a), a, e); assert.equal(s.ok, true, s.message);
  assert.deepEqual(s.save.scenarioState, e.exportState());
  const roundtrip = api.loadAdventureSave(api.exportAdventureSave(s.save, a).data, a);
  const restored = api.restoreScenarioEngine(roundtrip.save, a);
  assert.equal(restored.ok, true, restored.message);
  assert.equal(restored.engine.scan('02').encounterId, 'wizard-a');
  assert.equal(restored.engine.exportState().currentIndex, 1);
});
test('restored checkpoint requires a fresh scan before completion', () => {
  const a = fixture(), e = engine(a); e.scan('03');
  const saved = api.captureScenarioState(fresh(a), a, e).save;
  const restored = api.restoreScenarioEngine(saved, a).engine;
  assert.equal(restored.completeCheckpoint('03').code, 'SCAN_REQUIRED');
  assert.equal(restored.scan('03').scenarioId, 'scenario-a');
});
test('restoration into an active engine cannot switch scenarios or alter its pending interaction', () => {
  const a = fixture(), active = engine(a), other = engine(a); active.scan('03'); other.scan('02');
  const s = api.captureScenarioState(fresh(a), a, other).save;
  assert.equal(api.restoreScenarioEngine(s, a, active).code, 'SCENARIO_LOCKED');
  assert.equal(active.exportState().scenarioId, 'scenario-a'); assert.equal(active.completeCheckpoint('03').ok, true);
});
test('capture cannot switch or roll back previously saved scenario progress', () => {
  const a = fixture(), e = engine(a); e.scan('03'); e.completeCheckpoint('03');
  const s = api.captureScenarioState(fresh(a), a, e).save;
  const other = engine(a); other.scan('02');
  assert.equal(api.captureScenarioState(s, a, other).code, 'SCENARIO_LOCKED');
  const earlier = engine(a); earlier.scan('03');
  assert.equal(api.captureScenarioState(s, a, earlier).code, 'PROGRESS_ROLLBACK');
});
for (const state of [undefined, {}, { currentIndex: 0, completedCheckpoints: [] },
  { scenarioId: 'missing', currentIndex: 0, completedCheckpoints: [] },
  { scenarioId: null, currentIndex: 1, completedCheckpoints: ['03'] },
  { scenarioId: 'scenario-a', currentIndex: 2, completedCheckpoints: ['03', '04'] },
  { scenarioId: 'scenario-a', currentIndex: -1, completedCheckpoints: [] },
  { scenarioId: 'scenario-a', currentIndex: 0.5, completedCheckpoints: [] },
  { scenarioId: 'scenario-a', currentIndex: 99, completedCheckpoints: [] }]) {
  test(`rejects corrupted scenario state ${JSON.stringify(state)}`, () => {
    const a = fixture(), s = fresh(a);
    if (state === undefined) delete s.scenarioState; else s.scenarioState = state;
    assert.equal(api.loadAdventureSave(s, a).ok, false);
  });
}
test('scenario completion and adventure completion persist independently', () => {
  const a = fixture(), e = engine(a);
  for (const qr of a.scenarioData.scenarios['scenario-a'].sequence) { e.scan(qr); e.completeCheckpoint(qr); }
  const captured = api.captureScenarioState(fresh(a), a, e).save;
  assert.equal(captured.scenarioFinished, true); assert.equal(captured.completed, false);
  captured.completed = true;
  const loaded = api.loadAdventureSave(api.exportAdventureSave(captured, a).data, a);
  assert.equal(loaded.save.completed, true); assert.equal(api.restoreScenarioEngine(loaded.save, a).engine.getStatus().finished, true);
});
test('inconsistent scenarioFinished is rejected', () => {
  const a = fixture(), s = fresh(a); s.scenarioFinished = true;
  assert.equal(api.validateAdventureSave(s, a).code, 'INVALID_STATE');
});
test('circular successful-visit storage stays independent of checkpoint progress', () => {
  const a = fixture('circular'), s = fresh(a);
  // Future runtime supplies these successful-opening counts; no scanner hooks here.
  s.encounterHistory = { visits: { '01': 3, '02': 1 }, distinctVisited: 2 };
  const loaded = api.loadAdventureSave(api.exportAdventureSave(s, a).data, a).save;
  assert.deepEqual(loaded.encounterHistory, s.encounterHistory); assert.equal(loaded.scenarioState, null);
  assert.equal(api.restoreScenarioEngine(loaded, a).code, 'NOT_LINEAR');
});
for (const history of [{ visits: {}, distinctVisited: 1 }, { visits: { '01': 0 }, distinctVisited: 1 },
  { visits: { '01': -1 }, distinctVisited: 1 }, { visits: { '01': 1.5 }, distinctVisited: 1 }, null]) {
  test(`rejects corrupted visit history ${JSON.stringify(history)}`, () => {
    const a = fixture('circular'), s = fresh(a); s.encounterHistory = history;
    assert.equal(api.validateAdventureSave(s, a).ok, false);
  });
}
test('unrestricted saves reject injected linear progress', () => {
  const a = fixture('circular'), s = fresh(a); s.scenarioState = { scenarioId: null, currentIndex: 0, completedCheckpoints: [] };
  assert.equal(api.validateAdventureSave(s, a).code, 'INVALID_STATE');
});
test('transition preparation leaves old state untouched; only explicit commit returns replacement', () => {
  const old = freeze(api.migrateLegacySave(legacy()).save), before = JSON.stringify(old), a = fixture();
  const t = api.prepareAdventureTransition(old, a); assert.equal(t.ok, true, t.message);
  assert.equal(JSON.stringify(old), before); assert.deepEqual(t.preparedSave.inventory, []);
  t.preparedSave.inventory.push('injected'); a.manifest.id = 'changed';
  const committed = t.commit(copy(old)); assert.equal(committed.ok, true, committed.message);
  assert.deepEqual(committed.save.inventory, []); assert.equal(committed.save.adventure.id, 'linear-demo');
  assert.equal(JSON.stringify(old), before); assert.equal(t.commit(old).code, 'TRANSITION_COMMITTED');
});
test('invalid transition leaves old gameplay state intact', () => {
  const old = legacy(), before = copy(old);
  assert.equal(api.prepareAdventureTransition(old, { manifest: { id: 'bad' } }).ok, false); assert.deepEqual(old, before);
});
test('stale transition cannot replace newer gameplay', () => {
  const old = legacy(), t = api.prepareAdventureTransition(old, fixture());
  old.inventory.push('New Item'); assert.equal(t.commit(old).code, 'STALE_TRANSITION');
  assert.ok(old.inventory.includes('New Item'));
});
test('missing current state cannot implicitly commit a switch', () => {
  const t = api.prepareAdventureTransition(legacy(), fixture()); assert.equal(t.commit().ok, false);
});
test('corrupted raw JSON can be retained until explicit replacement', () => {
  const raw = '{corrupt', t = api.prepareAdventureTransition(raw, fixture('circular'));
  assert.equal(t.ok, true); assert.equal(t.commit(raw).ok, true);
});
test('reset creates fresh gameplay and cannot touch preferences or installed mods', () => {
  const unrelated = { 'qr-city-quest-language-v1': 'hu', 'qr-city-quest-debug-visible-v1': '1',
    indexedDB: { 'qr-city-quest-mods-v1': { packages: ['london'], enabled: true } }, otherPreference: 'keep' };
  const before = copy(unrelated), a = fixture('non-linear');
  assert.deepEqual(api.resetAdventureSave(a).save.inventory, []);
  assert.equal(api.prepareAdventureTransition(legacy(), a).commit(legacy()).ok, true);
  assert.deepEqual(unrelated, before);
});
for (const value of [null, undefined, '']) test(`missing save ${String(value)} returns recovery error`, () => assert.equal(api.loadAdventureSave(value, fixture()).code, 'MISSING_SAVE'));
test('invalid JSON never silently resets', () => assert.equal(api.loadAdventureSave('{bad', fixture()).code, 'INVALID_JSON'));
for (const field of ['schemaVersion', 'adventureSaveVersion']) test(`unsupported ${field}`, () => {
  const a = fixture(), s = fresh(a); s[field] = 2; assert.equal(api.loadAdventureSave(s, a).code, 'UNSUPPORTED_SAVE_VERSION');
});
for (const field of ['inventory', 'quests', 'flags', 'itemState', 'encounterHistory', 'completed', 'lastSavedAt']) test(`missing required ${field}`, () => {
  const a = fixture(), s = fresh(a); delete s[field]; assert.equal(api.validateAdventureSave(s, a).ok, false);
});
test('unknown adventure ID and incompatible version fail clearly', () => {
  const a = fixture(), s = fresh(a); s.adventure.id = 'other'; assert.equal(api.loadAdventureSave(s, a).code, 'UNKNOWN_ADVENTURE');
  s.adventure.id = a.manifest.id; s.adventure.version = '9.0.0';
  assert.equal(api.loadAdventureSave(s, a).code, 'INCOMPATIBLE_ADVENTURE_VERSION');
});
for (const value of [Infinity, NaN, undefined, 1n, new Date()]) test(`non-JSON input ${String(value)} is rejected without data loss`, () => {
  const s = { ...legacy(), custom: value }; assert.equal(api.migrateLegacySave(s).ok, false);
});
test('cyclic and unsafe-key data fail without prototype changes', () => {
  const s = legacy(); s.self = s; assert.equal(api.migrateLegacySave(s).ok, false);
  assert.equal(api.migrateLegacySave('{"schemaVersion":1,"__proto__":{"polluted":true}}').ok, false);
  assert.equal({}.polluted, undefined);
});
test('standalone browser works with storage, DOM and network access forbidden', () => {
  const sandbox = {};
  for (const key of ['localStorage', 'indexedDB', 'document', 'fetch']) Object.defineProperty(sandbox, key, { get() { throw Error(`Unexpected access: ${key}`); } });
  for (const file of ['scenario-engine.js', 'adventure-save.js']) vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../adventure-system', file), 'utf8'), sandbox);
  const standalone = sandbox.QRCQAdventureSave;
  const a = fixture(), created = standalone.createAdventureSave(a); assert.equal(created.ok, true);
  assert.equal(standalone.loadAdventureSave(standalone.exportAdventureSave(created.save, a).data, a).ok, true);
  assert.equal(standalone.migrateLegacySave(legacy()).ok, true);
  assert.equal(standalone.prepareAdventureTransition(created.save, fixture('circular')).commit(created.save).ok, true);
});
test('new gameplay fields match the historical built-in save contract', () => {
  // The original app factory was retired when Stage 4 became the live authority.
  const original = { schemaVersion: 1, inventory: [], hadItems: [], knowledge: [],
    quests: {}, encounters: {}, timers: {}, itemTimers: {},
    flags: { castleOpen: false, unlockedAreas: [] },
    itemState: { counters: {}, usedButtons: {}, oneTimeRewards: {} }, lastSavedAt: 0 };
  const s = fresh(core());
  for (const key of Object.keys(original)) {
    if (key !== 'lastSavedAt') assert.deepEqual(s[key], original[key], key);
  }
  assert.equal(api.migrateLegacySave(original).ok, true);
});
for (const change of [a => delete a.manifest.id, a => a.manifest.id = ['demo'],
  a => a.manifest.version = 'latest', a => a.manifest.type = 'unknown',
  a => a.manifest.formatVersion = 9, a => delete a.scenarioData,
  a => a.scenarioData.scenarios['scenario-a'].encounters['03'] = 'missing']) {
  test(`rejects invalid adventure identity/data ${String(change)}`, () => {
    const a = fixture(); change(a); assert.equal(api.createAdventureSave(a).ok, false);
    const old = legacy(), before = copy(old); assert.equal(api.prepareAdventureTransition(old, a).ok, false);
    assert.deepEqual(old, before);
  });
}
test('completed circular adventure survives export and restoration', () => {
  const a = fixture('circular'), s = fresh(a); s.completed = true;
  assert.equal(api.loadAdventureSave(api.exportAdventureSave(s, a).data, a).save.completed, true);
});
test('browser reports missing engine without a crash and can still create unrestricted saves', () => {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../adventure-system/adventure-save.js'), 'utf8'), sandbox);
  assert.equal(sandbox.QRCQAdventureSave.createAdventureSave(fixture()).code, 'ENGINE_UNAVAILABLE');
  assert.equal(sandbox.QRCQAdventureSave.createAdventureSave(fixture('circular')).ok, true);
});
console.log(`\n${passed} passed; ${failed} failed.`);
process.exitCode = failed ? 1 : 0;
