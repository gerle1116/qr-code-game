'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { readMap, createMapRenderer } = require('../adventure-system/map-renderer.js');
const { validatePackage } = require('../adventure-system/validator.js');
const { createQRResolver } = require('../adventure-system/qr-resolver.js');
const saves = require('../adventure-system/adventure-save.js');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`PASS ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}: ${e.stack}`); } }
const fixture = (type = 'linear') => JSON.parse(JSON.stringify({
  manifest: require(`../adventure-system/samples/${type}/manifest.json`),
  gameData: require(`../adventure-system/samples/${type}/game-data.json`),
  ...(type === 'linear' ? { scenarioData: require('../adventure-system/samples/linear/scenarios.json') } : {})
}));
test('static configuration and correct image', () => { const r = readMap(fixture('circular')); assert.equal(r.ok, true); assert.equal(r.map.mode, 'static'); assert.equal(r.map.image, 'images/map.png'); });
test('marker configuration and percentage coordinates', () => { const r = readMap(fixture()); assert.equal(r.ok, true); assert.deepEqual([r.map.markers[0].x, r.map.markers[0].y], [32, 60]); });
test('configuration is copied', () => { const a = fixture(), r = readMap(a); a.manifest.map.markers[0].x = 99; assert.equal(r.map.markers[0].x, 32); });
for (const value of [-1, 101, NaN, Infinity, '32', null]) test(`rejects coordinate ${value}`, () => { const a = fixture(); a.manifest.map.markers[0].x = value; assert.equal(readMap(a).ok, false); });
test('missing image rejected', () => { const a = fixture(); delete a.manifest.map.image; assert.equal(readMap(a).ok, false); });
test('unknown mode rejected', () => { const a = fixture(); a.manifest.map.mode = 'route'; assert.equal(readMap(a).ok, false); });
test('duplicate marker IDs rejected', () => { const a = fixture(); a.manifest.map.markers.push({ ...a.manifest.map.markers[0] }); assert.equal(readMap(a).ok, false); });
test('unknown physical QR rejected', () => { const a = fixture(); a.manifest.map.markers[0].qr = '99'; assert.equal(readMap(a).ok, false); });
test('descriptions and labels are optional', () => { const a = fixture(); delete a.manifest.map.markers[0].label; assert.equal(readMap(a).ok, true); a.manifest.map.markers[0].description = 'Bridge'; assert.equal(readMap(a).ok, true); });
for (const key of ['label', 'description']) test(`invalid ${key} type rejected`, () => { const a = fixture(); a.manifest.map.markers[0][key] = 12; assert.equal(readMap(a).ok, false); });
for (const image of ['../map.png', 'https://example.com/map.png', 'images/%2e%2e/map.png', 'C:/map.png']) test(`unsafe image ${image}`, () => { const a = fixture(); a.manifest.map.image = image; assert.equal(readMap(a).ok, false); });
test('marker arrays required only in markers mode', () => { const a = fixture(); delete a.manifest.map.markers; assert.equal(readMap(a).ok, false); });
test('circular has no route or scenario requirement', () => { const a = fixture('circular'); assert.equal(a.gameData.route, undefined); assert.equal(readMap(a).ok, true); });
test('non-linear retains Objectives without DOM or assets', () => { const r = createMapRenderer({ adventure: fixture('non-linear') }); assert.equal(r.ok, true); assert.equal(r.renderer, null); assert.equal(r.reason, 'OBJECTIVES'); });
test('physical QR stays scenario-dependent without renderer scans', () => {
  const a = fixture(), before = JSON.stringify(a), ra = createQRResolver(a).resolver, rb = createQRResolver(a).resolver;
  readMap(a); for (const qr of ['03', '01', '04']) assert.equal(ra.completeCheckpoint(ra.scan(qr)).ok, true);
  assert.equal(ra.scan('02').encounterId, 'wizard-a'); assert.equal(rb.scan('02').encounterId, 'guard-b');
  assert.equal(JSON.stringify(a), before);
});
test('map preparation leaves Stage 4 save unchanged', () => { const a = fixture(); const save = saves.createAdventureSave(a).save; const before = JSON.stringify(save); readMap(a); assert.equal(JSON.stringify(save), before); });
test('Stage 1 accepts optional descriptions and absent labels', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qrcq-map-validation-'));
  try { fs.cpSync(path.join(__dirname, '../adventure-system/samples/linear'), temp, { recursive: true });
    const a = fixture(); delete a.manifest.map.markers[0].label; a.manifest.map.markers[0].description = 'A bridge';
    fs.writeFileSync(path.join(temp, 'manifest.json'), JSON.stringify(a.manifest));
    const r = validatePackage(temp); assert.equal(r.valid, true, r.errors.join('\n'));
    a.manifest.map.markers[0].description = 1; fs.writeFileSync(path.join(temp, 'manifest.json'), JSON.stringify(a.manifest));
    assert.equal(validatePackage(temp).valid, false);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
if (process.argv.includes('--browser')) test('real Chromium DOM interaction harness', () => {
  const browser = process.env.QRCQ_TEST_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qrcq-map-browser-'));
  try {
    const run = spawnSync(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${profile}`, '--allow-file-access-from-files', '--disable-background-networking',
      '--virtual-time-budget=10000', '--dump-dom', pathToFileURL(path.join(__dirname, 'map-renderer-browser.html')).href],
    { encoding: 'utf8', timeout: 30000, maxBuffer: 2e6, windowsHide: true });
    assert.ifError(run.error); assert.equal(run.status, 0, run.stderr);
    const result = run.stdout.match(/<pre id="results">([^<]+)<\/pre>/);
    assert.ok(result, run.stdout + run.stderr); console.log(result[1]); assert.match(result[1], /BROWSER: \d+ passed; 0 failed; complete/);
  } finally { fs.rmSync(profile, { recursive: true, force: true }); }
});
console.log(`\n${passed} passed; ${failed} failed.${process.argv.includes('--browser') ? '' : ' Browser tests not requested (use --browser).'}`);
process.exitCode = failed ? 1 : 0;
