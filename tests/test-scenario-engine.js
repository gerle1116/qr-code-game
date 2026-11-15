'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createScenarioEngine } = require('../adventure-system/scenario-engine.js');
const { validatePackage } = require('../adventure-system/validator.js');
const sample = path.join(__dirname, '../adventure-system/samples/linear');
const scenarios = JSON.parse(fs.readFileSync(path.join(sample, 'scenarios.json'), 'utf8'));
const game = JSON.parse(fs.readFileSync(path.join(sample, 'game-data.json'), 'utf8'));
const copy = value => JSON.parse(JSON.stringify(value));
const initial = { scenarioId: null, currentIndex: 0, completedCheckpoints: [] };
let passed = 0, failed = 0;
function test(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.stack}`); }
}
function engine(policy) {
  const data = copy(scenarios);
  if (policy) for (const s of Object.values(data.scenarios)) s.outOfOrder = policy;
  const created = createScenarioEngine(data, game);
  assert.equal(created.ok, true, created.message);
  return created.engine;
}
function advance(e, qr) {
  assert.equal(e.scan(qr).canCompleteCheckpoint, true);
  const result = e.completeCheckpoint(qr);
  assert.equal(result.ok, true, result.message);
  return result;
}

test('Stage 1 primary sample is valid', () => assert.equal(validatePackage(sample).valid, true));
test('new engine has no selected scenario', () => assert.deepEqual(engine().exportState(), initial));
test('03 selects scenario-a and its guard encounter', () => {
  const r = engine().scan('03');
  assert.equal(r.scenarioId, 'scenario-a'); assert.equal(r.encounterId, 'guard-a');
  assert.equal(r.encounter.pages['0101'].speaker, 'Guard');
});
test('02 selects scenario-b and its guard encounter', () => {
  const r = engine().scan('02');
  assert.equal(r.scenarioId, 'scenario-b'); assert.equal(r.encounterId, 'guard-b');
});
test('02 maps to Wizard in A and Guard in B', () => {
  const a = engine('allow'), b = engine(); a.scan('03');
  assert.equal(a.scan('02').encounterId, 'wizard-a');
  assert.equal(b.scan('02').encounterId, 'guard-b');
});
test('later starting QR cannot change scenario', () => {
  const e = engine(); e.scan('03'); e.scan('02'); assert.equal(e.exportState().scenarioId, 'scenario-a');
});
test('invalid starting QR leaves engine unselected, then valid start works', () => {
  const e = engine(); assert.equal(e.scan('01').code, 'INVALID_START');
  assert.deepEqual(e.exportState(), initial); assert.equal(e.scan('02').scenarioId, 'scenario-b');
});
for (const qr of [undefined, null, 3, '3', '003', ' 03', '03 ', '', {}, ['03']])
  test(`malformed scan ${JSON.stringify(qr)} is safe`, () => {
    const e = engine(); assert.equal(e.scan(qr).code, 'INVALID_QR'); assert.deepEqual(e.exportState(), initial);
  });
test('scans alone do not complete checkpoints', () => {
  const e = engine('allow'); e.scan('03'); e.scan('01'); e.scan('04'); e.scan('02');
  assert.deepEqual(e.exportState(), {scenarioId:'scenario-a',currentIndex:0,completedCheckpoints:[]});
});
test('repeated expected scans resolve without advancing', () => {
  const e = engine(); const one = e.scan('03'), two = e.scan('03');
  assert.deepEqual(one.state, two.state); assert.equal(two.canCompleteCheckpoint, true); assert.equal(two.encounterId, one.encounterId);
});
test('explicit completion advances exactly one checkpoint', () => {
  const e = engine(); const r = advance(e, '03');
  assert.equal(r.code, 'CHECKPOINT_COMPLETED'); assert.equal(r.expectedQR, '01');
  assert.deepEqual(e.exportState(), {scenarioId:'scenario-a',currentIndex:1,completedCheckpoints:['03']});
});
test('correct order resolves each scenario-a encounter', () => {
  const e = engine();
  for (const [qr, id] of Object.entries({'03':'guard-a','01':'merchant-a','04':'king-a','02':'wizard-a'})) {
    assert.equal(e.scan(qr).encounterId, id); assert.equal(e.completeCheckpoint(qr).ok, true);
  }
  assert.equal(e.getStatus().finished, true);
});
test('scenario-b follows its own sequence and encounters', () => {
  const e = engine();
  for (const [qr,id] of [['02','guard-b'],['01','hunter-b'],['03','wizard-b'],['04','merchant-b']]) {
    assert.equal(e.scan(qr).encounterId,id); assert.equal(e.completeCheckpoint(qr).ok,true);
  }
  assert.equal(e.getStatus().finished,true);
});
for (const policy of ['block','preview','allow']) {
  test(`${policy}: future checkpoint access and progress rules`, () => {
    const e = engine(policy); e.scan('03'); const before=e.exportState(), r=e.scan('02');
    assert.equal(r.ok,policy!=='block'); assert.equal(r.access,{block:'blocked',preview:'preview',allow:'full'}[policy]);
    assert.equal(r.readOnly,policy!=='allow'); assert.equal(r.canCompleteCheckpoint,false);
    assert.equal(r.progressionSensitiveActionsAllowed,false);
    assert.equal(r.encounterId,policy==='block'?null:'wizard-a');
    assert.equal(e.completeCheckpoint('02').code,'OUT_OF_ORDER'); assert.deepEqual(e.exportState(),before);
  });
  test(`${policy}: completed checkpoints cannot advance twice`, () => {
    const e=engine(policy); advance(e,'03'); const before=e.exportState(), r=e.scan('03');
    assert.equal(r.alreadyCompleted,true); assert.equal(r.canCompleteCheckpoint,false);
    assert.equal(r.access,{block:'blocked',preview:'preview',allow:'full'}[policy]);
    assert.equal(e.completeCheckpoint('03').code,'ALREADY_COMPLETED'); assert.deepEqual(e.exportState(),before);
  });
  test(`${policy}: expected checkpoint always has full access`, () => {
    const e=engine(policy); advance(e,'03'); const r=e.scan('01');
    assert.equal(r.access,'full'); assert.equal(r.readOnly,false); assert.equal(r.canCompleteCheckpoint,true);
    assert.equal(r.progressionSensitiveActionsAllowed,true);
  });
}
test('unknown QR does not change progress', () => {
  const e=engine(); e.scan('03'); const before=e.exportState(), r=e.scan('99');
  assert.equal(r.code,'UNKNOWN_QR'); assert.equal(r.encounter,null); assert.deepEqual(e.exportState(),before);
});
test('cannot complete before selecting scenario', () => assert.equal(engine().completeCheckpoint('03').code,'NO_SCENARIO'));
test('unknown completion QR is rejected', () => {
  const e=engine(); e.scan('03'); assert.equal(e.completeCheckpoint('99').code,'UNKNOWN_QR');
});
test('cannot complete expected checkpoint without scanning it', () => {
  const e=engine(); advance(e,'03'); assert.equal(e.completeCheckpoint('01').code,'SCAN_REQUIRED');
});
test('a new scan replaces pending interaction context', () => {
  const e=engine(); e.scan('03'); e.scan('99');
  assert.equal(e.completeCheckpoint('03').code,'SCAN_REQUIRED');
  assert.equal(advance(e,'03').ok,true);
});
test('failed out-of-order completion does not advance or consume valid interaction', () => {
  const e=engine('allow'); e.scan('03'); assert.equal(e.completeCheckpoint('02').ok,false);
  assert.equal(e.completeCheckpoint('03').ok,true);
});
test('state round-trips through JSON into a fresh engine', () => {
  const e=engine(); advance(e,'03'); const saved=JSON.parse(JSON.stringify(e.exportState())), resumed=engine();
  assert.equal(resumed.restoreState(saved).ok,true); assert.deepEqual(resumed.exportState(),saved);
  assert.equal(resumed.scan('01').encounterId,'merchant-a'); assert.equal(resumed.completeCheckpoint('01').ok,true);
});
test('unselected state can be restored', () => assert.equal(engine().restoreState(copy(initial)).ok,true));
test('restore requires rescan, never restores gameplay permission', () => {
  const e=engine(); e.scan('03'); const resumed=engine(); resumed.restoreState(e.exportState());
  assert.equal(resumed.completeCheckpoint('03').code,'SCAN_REQUIRED');
});
test('valid restore clears previous interaction context', () => {
  const e=engine(); e.scan('03'); assert.equal(e.restoreState(e.exportState()).ok,true);
  assert.equal(e.completeCheckpoint('03').code,'SCAN_REQUIRED');
});
const savedA = {scenarioId:'scenario-a',currentIndex:1,completedCheckpoints:['03']};
const corrupt = [null, [], {}, 'not JSON state', { ...savedA, scenarioId:'missing' },
  { ...savedA, scenarioId:'constructor' }, { ...savedA, scenarioId:2 },
  { ...savedA, currentIndex:-1 }, { ...savedA, currentIndex:1.5 }, { ...savedA, currentIndex:'1' },
  { ...savedA, currentIndex:Infinity }, { ...savedA, currentIndex:NaN }, { ...savedA, currentIndex:99 },
  { ...savedA, completedCheckpoints:[] }, { ...savedA, completedCheckpoints:['01'] },
  { ...savedA, currentIndex:2, completedCheckpoints:['03','03'] },
  { ...savedA, completedCheckpoints:['03','01'] }, { ...savedA, completedCheckpoints:'03' },
  { ...savedA, extra:true }, {scenarioId:null,currentIndex:1,completedCheckpoints:['03']},
  {scenarioId:null,currentIndex:0,completedCheckpoints:['03']}, {currentIndex:0,completedCheckpoints:[]}];
corrupt.forEach((saved,i) => test(`corrupt state ${i+1} is rejected atomically`, () => {
  const e=engine(); e.scan('03'); const before=e.exportState(), r=e.restoreState(saved);
  assert.equal(r.ok,false); assert.equal(typeof r.message,'string'); assert.deepEqual(e.exportState(),before);
  assert.equal(e.completeCheckpoint('03').ok,true,'failed restore must preserve pending interaction');
}));
test('saved state cannot switch active scenarios', () => {
  const e=engine(); e.scan('03');
  assert.equal(e.restoreState({scenarioId:'scenario-b',currentIndex:0,completedCheckpoints:[]}).code,'SCENARIO_LOCKED');
  assert.equal(e.exportState().scenarioId,'scenario-a');
});
test('saved state cannot clear selected scenario', () => {
  const e=engine(); e.scan('03'); assert.equal(e.restoreState(copy(initial)).code,'SCENARIO_LOCKED');
});
test('saved state cannot roll back active progress', () => {
  const e=engine(); advance(e,'03');
  assert.equal(e.restoreState({scenarioId:'scenario-a',currentIndex:0,completedCheckpoints:[]}).code,'PROGRESS_ROLLBACK');
});
test('changed route rejects incompatible saved prefix', () => {
  const data=copy(scenarios); data.scenarios['scenario-a'].sequence=['03','04','01','02'];
  const e=createScenarioEngine(data,game).engine;
  assert.equal(e.restoreState({scenarioId:'scenario-a',currentIndex:2,completedCheckpoints:['03','01']}).ok,false);
});
test('final completion produces a finished state with no expected QR', () => {
  const e=engine(); let r;
  for (const qr of scenarios.scenarios['scenario-a'].sequence) r=advance(e,qr);
  assert.equal(r.code,'SCENARIO_COMPLETED'); assert.equal(r.finished,true); assert.equal(r.expectedQR,null);
  assert.deepEqual(e.exportState(),{scenarioId:'scenario-a',currentIndex:4,completedCheckpoints:['03','01','04','02']});
});
test('post-completion scans cannot reopen or restart a scenario', () => {
  const e=engine(); for(const qr of scenarios.scenarios['scenario-a'].sequence) advance(e,qr);
  const before=e.exportState();
  for(const qr of ['03','02','99']) { const r=e.scan(qr); assert.equal(r.code,'SCENARIO_FINISHED'); assert.equal(r.encounter,null); }
  assert.equal(e.completeCheckpoint('02').code,'ALREADY_COMPLETED'); assert.deepEqual(e.exportState(),before);
});
test('finished state survives export and restore', () => {
  const e=engine(); for(const qr of scenarios.scenarios['scenario-a'].sequence) advance(e,qr);
  const resumed=engine(); assert.equal(resumed.restoreState(e.exportState()).finished,true);
  assert.equal(resumed.scan('02').code,'SCENARIO_FINISHED');
});
test('single-checkpoint scenario finishes only after explicit completion', () => {
  const data={formatVersion:1,scenarios:{solo:{startQR:'03',sequence:['03'],encounters:{'03':'guard-a'},outOfOrder:'block'}}};
  const e=createScenarioEngine(data,game).engine;
  assert.equal(e.scan('03').finished,false); assert.equal(e.completeCheckpoint('03').finished,true);
});
test('input data mutations cannot rewrite an active route or encounter', () => {
  const data=copy(scenarios), content=copy(game), e=createScenarioEngine(data,content).engine;
  data.scenarios['scenario-a'].startQR='99'; data.scenarios['scenario-a'].encounters['03']='wizard-a';
  content.encounters['guard-a'].pages['0101'].speaker='Changed';
  const r=e.scan('03'); assert.equal(r.encounterId,'guard-a'); assert.equal(r.encounter.pages['0101'].speaker,'Guard');
});
test('returned state and encounter mutations cannot change engine internals', () => {
  const e=engine(), r=e.scan('03'); r.state.scenarioId='scenario-b'; r.state.completedCheckpoints.push('03');
  r.encounter.pages['0101'].speaker='Changed'; const saved=e.exportState(); saved.currentIndex=99;
  assert.equal(e.getStatus().currentIndex,0); assert.equal(e.scan('03').encounter.pages['0101'].speaker,'Guard');
});
test('restored state is copied rather than shared', () => {
  const saved=copy(savedA), e=engine(); e.restoreState(saved); saved.completedCheckpoints[0]='99';
  assert.deepEqual(e.exportState(),savedA);
});
for (const [name, mutate] of [
  ['unsupported version',d=>d.formatVersion=2], ['empty scenarios',d=>d.scenarios={}],
  ['duplicate starting QRs',d=>d.scenarios['scenario-b'].startQR='03'],
  ['unknown mapped encounter',d=>d.scenarios['scenario-a'].encounters['03']='missing'],
  ['missing mapping',d=>delete d.scenarios['scenario-a'].encounters['03']],
  ['invalid policy',d=>d.scenarios['scenario-a'].outOfOrder='ignore'],
  ['repeated sequence QR',d=>d.scenarios['scenario-a'].sequence.push('03')],
  ['invalid scenario record',d=>d.scenarios['scenario-a']=null]
]) test(`factory safely rejects ${name}`, () => {
  const data=copy(scenarios); mutate(data); const r=createScenarioEngine(data,game);
  assert.equal(r.ok,false); assert.equal(r.code,'INVALID_DATA'); assert.equal(r.engine,undefined);
});
test('nonserializable and missing input fail without exceptions', () => {
  const cyclic={}; cyclic.self=cyclic;
  for(const value of [undefined,null,cyclic,1n]) assert.equal(createScenarioEngine(value,game).ok,false);
  assert.equal(createScenarioEngine(scenarios,undefined).ok,false);
});
test('missing encounter start page is rejected defensively', () => {
  const content=copy(game); content.encounters['guard-a'].startPage='9999';
  assert.equal(createScenarioEngine(scenarios,content).ok,false);
});
test('browser-style export works without DOM, Node imports, network or storage', () => {
  const context={};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../adventure-system/scenario-engine.js'),'utf8'),context);
  const e=context.QRCQScenarioEngine.createScenarioEngine(scenarios,game).engine;
  assert.equal(e.scan('03').encounterId,'guard-a'); assert.equal(e.completeCheckpoint('03').ok,true);
});
console.log(`\n${passed} passed; ${failed} failed.`);
process.exitCode=failed?1:0;
