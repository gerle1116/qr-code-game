'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validatePackage, parseJSON } = require('../adventure-system/validator.js');
const samples = path.join(__dirname, '../adventure-system/samples');
let passed = 0, failed = 0;
function test(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (e) { failed++; console.error(`FAIL ${name}: ${e.stack}`); }
}
function fixture(type, run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qrcq-adventure-'));
  try { fs.cpSync(path.join(samples, type), temp, { recursive: true }); run(temp); }
  finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
function edit(dir, file, mutate) {
  const target = path.join(dir, file), data = JSON.parse(fs.readFileSync(target, 'utf8'));
  mutate(data); fs.writeFileSync(target, JSON.stringify(data));
}
function rejects(name, file, mutate, expected, type = 'linear') {
  test(name, () => fixture(type, dir => {
    edit(dir, file, mutate);
    const result = validatePackage(dir);
    assert.equal(result.valid, false, JSON.stringify(result));
    assert.match(result.errors.join('\n'), expected);
  }));
}
for (const type of ['linear', 'circular', 'non-linear']) test(`${type} sample passes`, () => {
  const result = validatePackage(path.join(samples, type));
  assert.equal(result.valid, true, result.errors.join('\n'));
});
for (const key of ['formatVersion','id','version','name','description','author','language','type','location','estimatedMinutes','minimumAge','gameData'])
  rejects(`missing manifest ${key}`, 'manifest.json', m => delete m[key], new RegExp(key));
rejects('language array rejected', 'manifest.json', m => m.language = ['en','hu'], /language/);
rejects('second languages field rejected', 'manifest.json', m => m.languages = ['en','hu'], /languages/);
rejects('combined language string rejected', 'manifest.json', m => m.language = 'en,hu', /language/);
rejects('unknown adventure type', 'manifest.json', m => m.type = 'maze', /type/);
rejects('metadata numeric type', 'manifest.json', m => m.estimatedMinutes = 'ten', /estimatedMinutes/);
rejects('manifest version', 'manifest.json', m => m.formatVersion = 2, /formatVersion/);
rejects('game format version', 'game-data.json', g => g.formatVersion = 2, /formatVersion/);
rejects('scenario format version', 'scenarios.json', s => s.formatVersion = 2, /formatVersion/);
rejects('duplicate starts', 'scenarios.json', s => s.scenarios['scenario-b'].startQR = '03', /duplicate starting QR/);
rejects('first sequence QR mismatch', 'scenarios.json', s => s.scenarios['scenario-a'].startQR = '01', /first QR/);
rejects('duplicate sequence QR', 'scenarios.json', s => s.scenarios['scenario-a'].sequence.push('03'), /duplicate entries/);
rejects('invalid QR shape', 'scenarios.json', s => s.scenarios['scenario-a'].sequence[1] = '1', /sequence/);
rejects('missing mapping', 'scenarios.json', s => delete s.scenarios['scenario-a'].encounters['01'], /missing encounter mapping/);
rejects('unknown encounter', 'scenarios.json', s => s.scenarios['scenario-a'].encounters['01'] = 'missing', /unknown encounter/);
rejects('invalid out of order policy', 'scenarios.json', s => s.scenarios['scenario-a'].outOfOrder = 'ignore', /outOfOrder/);
for (const policy of ['block','preview','allow']) test(`supports ${policy}`, () => fixture('linear', dir => {
  edit(dir, 'scenarios.json', s => s.scenarios['scenario-a'].outOfOrder = policy);
  assert.equal(validatePackage(dir).valid, true);
}));
for (const n of [-1,101,'32',null]) rejects(`map coordinate ${n}`, 'manifest.json', m => m.map.markers[0].x = n, /markers.*x/);
for (const n of [0,100]) test(`map coordinate boundary ${n}`, () => fixture('linear', dir => {
  edit(dir, 'manifest.json', m => m.map.markers[0].x = n);
  assert.equal(validatePackage(dir).valid, true);
}));
rejects('map unknown QR', 'manifest.json', m => m.map.markers[0].qr = '99', /unknown physical QR/);
test('circular has no scenarios file', () => { assert.equal(fs.existsSync(path.join(samples,'circular/scenarios.json')),false); assert.equal(validatePackage(path.join(samples,'circular')).valid,true); });
rejects('circular route field rejected', 'game-data.json', g => g.route = ['01','02'], /route/, 'circular');
rejects('circular scenario reference rejected', 'manifest.json', m => m.scenarios = 'scenarios.json', /only linear/, 'circular');
rejects('visit unknown QR', 'game-data.json', g => g.progression.visitConditions[0].qr = '99', /unknown QR/, 'circular');
rejects('invalid visit count', 'game-data.json', g => g.progression.visitConditions[0].minimumVisits = 0, /minimumVisits/, 'circular');
for (const unsafe of ['../map.png','/map.png','C:/map.png','images\\map.png','https://example.com/map.png','images/../map.png','images/%2e%2e/map.png'])
  rejects(`unsafe path ${unsafe}`, 'manifest.json', m => m.map.image = unsafe, /safe relative/);
rejects('missing local image', 'manifest.json', m => m.cover = 'images/missing.png', /cover/);
test('fake image rejected', () => fixture('linear', dir => { fs.writeFileSync(path.join(dir,'images/map.png'),'fake'); assert.match(validatePackage(dir).errors.join('\n'),/signature/); }));
test('executable package member rejected without execution', () => fixture('linear', dir => { fs.writeFileSync(path.join(dir,'code.js'),'throw Error("must never execute")'); assert.match(validatePackage(dir).errors.join('\n'),/unsupported package file/); }));
test('invalid JSON rejected', () => fixture('linear', dir => { fs.writeFileSync(path.join(dir,'game-data.json'),'{bad'); assert.match(validatePackage(dir).errors.join('\n'),/invalid JSON/); }));
test('duplicate scenario IDs rejected', () => fixture('linear', dir => { fs.writeFileSync(path.join(dir,'scenarios.json'),'{"formatVersion":1,"scenarios":{"a":{},"a":{}}}'); assert.match(validatePackage(dir).errors.join('\n'),/duplicate JSON key a/); }));
test('escaped duplicate JSON key rejected', () => assert.throws(() => parseJSON('{"a":1,"\\u0061":2}'),/duplicate/));
test('missing scenarios file rejected', () => fixture('linear', dir => { fs.unlinkSync(path.join(dir,'scenarios.json')); assert.equal(validatePackage(dir).valid,false); }));
const page = g => g.encounters['guard-a'].pages['0101'];
rejects('unknown page destination', 'game-data.json', g => page(g).buttons[0].next = '9999', /unknown dialogue destination/);
rejects('page identity mismatch', 'game-data.json', g => page(g).id = '9999', /must equal page key/);
rejects('missing start page', 'game-data.json', g => g.encounters['guard-a'].startPage = '9999', /startPage/);
rejects('unknown action', 'game-data.json', g => page(g).actions = [{type:'RUN_SCRIPT'}], /unsupported engine action/);
rejects('unknown item', 'game-data.json', g => page(g).actions = [{type:'ADD_ITEM',data:'Missing'}], /unknown item/);
rejects('unknown quest', 'game-data.json', g => page(g).actions = [{type:'START_QUEST',data:'Missing'}], /unknown quest/);
rejects('invalid timer', 'game-data.json', g => page(g).actions = [{type:'START_TIMER',durationMs:0}], /durationMs/);
rejects('missing counter name', 'game-data.json', g => page(g).actions = [{type:'ADD_COUNTER'}], /data/);
rejects('unsafe condition', 'game-data.json', g => page(g).condition = {'1':'process.exit()'}, /safe engine condition/);
rejects('legacy HAS_ITEM condition rejected explicitly', 'game-data.json', g => page(g).condition = {type:'HAS_ITEM',data:'Key'}, /condition/);
test('safe item quest knowledge counter conditions pass', () => fixture('non-linear', dir => {
  edit(dir,'game-data.json',g => {
    g.encounters['01'].pages['0101'].condition={'1':'!had_item.includes("Token") && counter("uses", "Token") >= 0 && save.quests["greeting"] !== "completed" && !knowledge.includes("secret")'};
    g.items.Token.pages['1101'].actions=[{type:'ADD_COUNTER',data:'uses',amount:1},{type:'SET_COUNTER',data:'uses',value:2},{type:'RESET_COUNTER',data:'uses'}];
  });
  const r=validatePackage(dir);assert.equal(r.valid,true,r.errors.join('\n'));
}));
rejects('completion absent', 'game-data.json', g => { for(const e of Object.values(g.encounters)) for(const p of Object.values(e.pages)) for(const b of p.buttons) if(b.next==='TITLE_SCREEN') b.next='HOME'; }, /completion/);
for(const bad of [null,[],5,'bad']) rejects(`malformed page ${JSON.stringify(bad)}`, 'game-data.json', g => g.encounters['guard-a'].pages['0101']=bad, /expected object/);
rejects('malformed button list', 'game-data.json', g => page(g).buttons={}, /buttons/);
rejects('malformed action options', 'game-data.json', g => page(g).actions=[{type:'DROPDOWN_CHOICE',options:{}}], /options/);
test('nonexistent package gives errors', () => assert.equal(validatePackage(path.join(samples,'does-not-exist')).valid,false));
rejects('unknown knowledge entry', 'game-data.json', g => page(g).actions=[{type:'ADD_KNOWLEDGE',data:'missing'}], /unknown knowledge entry/);
rejects('empty button selector', 'game-data.json', g => page(g).actions=[{type:'NEXT_SCAN',buttonIndex:[]}], /at least one/);
rejects('unknown timer wait page', 'game-data.json', g => page(g).actions=[{type:'START_TIMER',durationMs:1000,waitPage:'9999'}], /waitPage/);
rejects('unknown dropdown destination', 'game-data.json', g => page(g).actions=[{type:'DROPDOWN_CHOICE',options:[{label:'Go',next:'9999'}]}], /destination/);
rejects('duplicate page IDs', 'game-data.json', g => g.encounters['merchant-a'].pages['0101']=page(g), /duplicate four-digit/);
rejects('unsupported legacy timer routing', 'game-data.json', g => g.encounters['guard-a'].overdueItemTimers={}, /overdueItemTimers/);
test('supported actions and dropdowns validate together', () => fixture('non-linear', dir => {
  edit(dir,'game-data.json',g => {
    g.knowledgeFolders={garden:'Garden'};
    g.thingsIKnow={secret:{text:'The garden is open.',folder:'garden'}};
    g.encounters['01'].pages['0101'].actions.push(
      {type:'ADD_KNOWLEDGE',data:'secret'}, {type:'START_TIMER',durationMs:1000,waitPage:'0101'},
      {type:'START_ITEM_TIMER',data:'Token',durationMs:1000,unlessHasItem:'Token'},
      {type:'STOP_ITEM_TIMER',data:'Token'}, {type:'OPEN_CASTLE'}, {type:'UNLOCK_AREA',data:'GARDEN'},
      {type:'NEXT_SCAN',buttonIndex:1}, {type:'REMOVE_ITEM',data:'Token'},
      {type:'DROPDOWN_INVENTORY',options:[{label:'Token',value:'Token',next:'0201'}],otherNext:'HOME'},
      {type:'DROPDOWN_CHOICE',options:[{label:'Finish',next:'TITLE_SCREEN'}]}
    );
  });
  const r=validatePackage(dir); assert.equal(r.valid,true,r.errors.join('\n'));
}));
test('completion must be reachable rather than merely present', () => fixture('non-linear', dir => {
  edit(dir,'game-data.json',g => {
    g.encounters['02'].pages['0201'].buttons[0].next='HOME';
    g.encounters['02'].pages['0202']={id:'0202',speaker:'Hidden',text:'Unreachable',buttons:[{index:1,label:'Win',next:'TITLE_SCREEN'}],actions:[],condition:{}};
  });
  assert.match(validatePackage(dir).errors.join('\n'),/completion/);
}));
rejects('scenario cannot borrow another scenario completion', 'game-data.json', g => g.encounters['wizard-a'].pages['0401'].buttons[0].next='0501', /scenario has no reachable completion/);
console.log(`\n${passed} passed; ${failed} failed.`);
process.exitCode = failed ? 1 : 0;
