'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const vm = require('node:vm');
const api = require('../adventure-system/adventure-catalog.js');
const { checkSchema } = require('../adventure-system/validator.js');
const { createTesterServer } = require('../tools/serve-adventure-catalog.js');
const fixture = () => JSON.parse(JSON.stringify(require('../adventure-system/samples/catalog/sample-catalog.json')));
const response = data => ({ ok: true, status: 200, text: async () => JSON.stringify(data) });
const url = 'https://example.invalid/catalog.json';
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log(`PASS ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}: ${e.stack}`); } }
async function browserTest() {
  const server = createTesterServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qrcq-catalog-browser-'));
  try {
    const run = await new Promise((resolve, reject) => {
      const child = spawn(process.env.QRCQ_TEST_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`,
          '--disable-background-networking', '--virtual-time-budget=15000', '--dump-dom',
          `http://127.0.0.1:${server.address().port}/tests/catalog-browser.html`], { windowsHide: true });
      let stdout = '', stderr = '';
      const timer = setTimeout(() => { child.kill(); reject(Error('Browser test timed out.')); }, 30000);
      child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('close', status => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
    });
    assert.equal(run.status, 0, run.stderr);
    const result = run.stdout.match(/<pre id="results">([^<]+)<\/pre>/);
    assert.ok(result, run.stdout + run.stderr); console.log(result[1]);
    assert.match(result[1], /BROWSER: \d+ passed; 0 failed; complete/);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(profile, { recursive: true, force: true });
  }
}
(async () => {
  await test('valid fixture and schema agree', () => {
    const c = fixture(), errors = []; checkSchema(c, require('../adventure-system/schemas/catalog.schema.json'), 'catalog', errors);
    assert.deepEqual(errors, []); assert.equal(api.validateCatalog(c).ok, true);
  });
  await test('production catalog is valid and empty', () => { const r = api.validateCatalog(require('../adventure-catalog/catalog.json')); assert.equal(r.ok, true); assert.deepEqual(r.catalog.adventures, []); });
  for (const field of Object.keys(fixture().adventures[0])) await test(`missing required ${field}`, () => {
    const c = fixture(); delete c.adventures[0][field]; const r = api.validateCatalog(c); assert.equal(r.ok, false); assert.match(r.errors.join(';'), new RegExp(field));
    const errors = []; checkSchema(c, require('../adventure-system/schemas/catalog.schema.json'), 'catalog', errors); assert.ok(errors.length);
  });
  for (const c of [null, [], {}, { catalogVersion: 1 }, { catalogVersion: 1, adventures: {} }, { catalogVersion: 1, adventures: [null] }])
    await test(`invalid structure ${JSON.stringify(c)}`, () => assert.equal(api.validateCatalog(c).ok, false));
  await test('unsupported catalog version', () => { const c = fixture(); c.catalogVersion = 2; assert.equal(api.validateCatalog(c).code, 'UNSUPPORTED_VERSION'); });
  await test('duplicate adventure IDs', () => { const c = fixture(); c.adventures[1].id = c.adventures[0].id; assert.match(api.validateCatalog(c).errors.join(';'), /duplicate/); });
  for (const [field, values] of Object.entries({
    id: ['Bad ID', '', '__proto__', 'constructor'], version: ['1', '1.0', 'v1.0.0', '1.0.0-beta'],
    language: [['en', 'hu'], 'en,hu', 'en hu', ''], type: ['sandbox', null, ''],
    minimumAge: [-1, 1.5, '8', Number.MAX_SAFE_INTEGER + 1], estimatedMinutes: [0, -1, Infinity, '30'],
    packageSize: [0, -1, 1.5, '1024', Number.MAX_SAFE_INTEGER + 1], sha256: ['abc', 'g'.repeat(64), 'a'.repeat(63)],
    name: ['', '   ', 123], description: [null], author: [[]], location: ['']
  })) for (const value of values) await test(`rejects ${field} ${JSON.stringify(value)}`, () => {
    const c = fixture(); c.adventures[0][field] = value; assert.equal(api.validateCatalog(c).ok, false);
  });
  for (const field of ['coverUrl', 'downloadUrl']) for (const value of ['http://example.com/a.zip', 'javascript:alert(1)', 'file:///tmp/a.zip', '//example.com/a.zip',
    'https://user:password@example.com/a.zip', 'https://localhost/a.zip', 'https://127.0.0.1/a.zip', 'https://example.com/a.zip#script', 'https://example.com/a.exe'])
    await test(`rejects unsafe ${field} ${value}`, () => { const c = fixture(); c.adventures[0][field] = value; assert.equal(api.validateCatalog(c).ok, false); });
  await test('valid HTTPS GitHub references and uppercase checksum normalize', () => {
    const c = fixture(); c.adventures[0].downloadUrl = 'https://github.com/owner/repo/releases/download/v1/a.zip';
    c.adventures[0].coverUrl = 'https://raw.githubusercontent.com/owner/repo/main/cover.png'; c.adventures[0].sha256 = 'A'.repeat(64);
    const r = api.validateCatalog(c); assert.equal(r.ok, true); assert.equal(r.catalog.adventures[0].sha256, 'a'.repeat(64));
  });
  await test('unknown top-level and entry fields rejected', () => { const c = fixture(); c.adventures[0].gameData = {}; assert.equal(api.validateCatalog(c).ok, false); delete c.adventures[0].gameData; c.extra = true; assert.equal(api.validateCatalog(c).ok, false); });
  for (const type of ['linear', 'circular', 'nonlinear', 'non-linear']) await test(`type ${type} appears in results`, () => {
    const c = fixture(); c.adventures[0].type = type; assert.equal(api.getAdventures(c)[0].type, type === 'nonlinear' ? 'non-linear' : type);
  });
  await test('lookup ID found and missing', () => { assert.equal(api.getAdventureById(fixture(), 'sample-linear').name, 'Castle Clues (sample)'); assert.equal(api.getAdventureById(fixture(), 'absent'), null); });
  await test('filter by type and normalized alias', () => { assert.equal(api.filterAdventures(fixture(), { type: 'circular' })[0].id, 'sample-circular'); assert.equal(api.filterAdventures(fixture(), { type: 'nonlinear' })[0].type, 'non-linear'); });
  await test('filter by language', () => assert.equal(api.filterAdventures(fixture(), { language: 'HU' })[0].id, 'sample-circular'));
  await test('search names case insensitively', () => assert.equal(api.filterAdventures(fixture(), { search: ' CASTLE ' })[0].id, 'sample-linear'));
  await test('search descriptions', () => assert.equal(api.filterAdventures(fixture(), { search: 'wizard' })[0].id, 'sample-circular'));
  await test('filter location substring', () => assert.equal(api.filterAdventures(fixture(), { location: 'HUNGARY' })[0].id, 'sample-circular'));
  await test('filter minimum age includes boundary', () => assert.deepEqual(api.filterAdventures(fixture(), { maxMinimumAge: 8 }).map(a => a.id), ['sample-linear', 'sample-circular']));
  await test('combined filters use AND', () => assert.equal(api.filterAdventures(fixture(), { type: 'circular', language: 'en' }).length, 0));
  await test('sort by name', () => assert.deepEqual(api.filterAdventures(fixture(), { sortBy: 'name' }).map(a => a.id), ['sample-linear', 'sample-circular', 'sample-nonlinear']));
  await test('sort by duration', () => assert.deepEqual(api.filterAdventures(fixture(), { sortBy: 'duration' }).map(a => a.estimatedMinutes), [20, 30, 45]));
  await test('descending sort', () => assert.deepEqual(api.filterAdventures(fixture(), { sortBy: 'duration', order: 'desc' }).map(a => a.estimatedMinutes), [45, 30, 20]));
  await test('equal sort values break ties by ID', () => { const c = fixture(); c.adventures.forEach(a => { a.estimatedMinutes = 10; }); assert.equal(api.filterAdventures(c, { sortBy: 'duration' })[0].id, 'sample-circular'); });
  await test('filtering normalization sorting and returned entries never alias input', () => {
    const c = fixture(), before = JSON.stringify(c); Object.freeze(c.adventures[0]);
    const out = api.filterAdventures(c, { sortBy: 'duration' }); out[0].name = 'changed'; api.getAdventures(c).pop();
    api.getAdventureById(c, 'sample-linear').name = 'changed'; assert.equal(JSON.stringify(c), before);
  });
  for (const filters of [{ type: 'bad' }, { maxMinimumAge: -1 }, { sortBy: 'other' }, { order: 'up' }, { search: [] }, { unknown: 1 }])
    await test(`invalid filter ${JSON.stringify(filters)}`, () => assert.throws(() => api.filterAdventures(fixture(), filters), TypeError));
  await test('data operations reject invalid catalogs explicitly', () => assert.throws(() => api.getAdventures({}), TypeError));
  await test('valid JSON fetch makes exactly one catalog request and no ZIP/cover requests', async () => {
    const calls = []; const r = await api.fetchCatalog(url, { fetch: async (u, options) => { calls.push(u); assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error'); return response(fixture()); } });
    assert.equal(r.ok, true); assert.equal(r.catalog.adventures[2].type, 'non-linear'); assert.deepEqual(calls, [url]);
  });
  await test('network errors', async () => assert.equal((await api.fetchCatalog(url, { fetch: async () => { throw Error('offline'); } })).code, 'NETWORK_ERROR'));
  await test('missing fetch', async () => assert.equal((await api.fetchCatalog(url, { fetch: null })).code, 'NETWORK_UNAVAILABLE'));
  await test('invalid JSON', async () => assert.equal((await api.fetchCatalog(url, { fetch: async () => ({ ok: true, text: async () => 'not JSON' }) })).code, 'INVALID_JSON'));
  for (const status of [404, 403, 500]) await test(`HTTP ${status}`, async () => assert.equal((await api.fetchCatalog(url, { fetch: async () => ({ ok: false, status }) })).code, status === 404 ? 'CATALOG_NOT_FOUND' : 'HTTP_ERROR'));
  await test('fetch timeout works even when injected fetch ignores abort', async () => assert.equal((await api.fetchCatalog(url, { timeoutMs: 10, fetch: () => new Promise(() => {}) })).code, 'TIMEOUT'));
  await test('response body timeout is covered', async () => assert.equal((await api.fetchCatalog(url, { timeoutMs: 10, fetch: async () => ({ ok: true, text: () => new Promise(() => {}) }) })).code, 'TIMEOUT'));
  await test('timeout aborts underlying request', async () => { let aborted = false; const r = await api.fetchCatalog(url, { timeoutMs: 10, fetch: (u, options) => { options.signal.addEventListener('abort', () => { aborted = true; }); return new Promise(() => {}); } }); assert.equal(r.code, 'TIMEOUT'); assert.equal(aborted, true); });
  await test('timeout options validated', async () => assert.equal((await api.fetchCatalog(url, { timeoutMs: 0 })).code, 'INVALID_OPTIONS'));
  await test('invalid catalog rejected after fetching', async () => { const c = fixture(); c.adventures[0].id = c.adventures[1].id; assert.equal((await api.fetchCatalog(url, { fetch: async () => response(c) })).code, 'INVALID_CATALOG'); });
  await test('unsupported fetched catalog version', async () => assert.equal((await api.fetchCatalog(url, { fetch: async () => response({ catalogVersion: 2, adventures: [] }) })).code, 'UNSUPPORTED_VERSION'));
  await test('empty fetched catalog succeeds', async () => assert.equal((await api.fetchCatalog(url, { fetch: async () => response({ catalogVersion: 1, adventures: [] }) })).ok, true));
  await test('response size limit', async () => assert.equal((await api.fetchCatalog(url, { fetch: async () => ({ ok: true, text: async () => ' '.repeat(2 * 1024 * 1024 + 1) }) })).code, 'INVALID_CATALOG'));
  await test('unsafe URL rejected before network access', async () => { let called = false; const r = await api.fetchCatalog('http://example.invalid/catalog.json', { fetch: () => { called = true; } }); assert.equal(r.code, 'INVALID_URL'); assert.equal(called, false); });
  await test('ZIP and cover URLs cannot be fetched as catalogs', async () => {
    let called = false;
    for (const suffix of ['zip', 'png']) assert.equal((await api.fetchCatalog(`https://example.invalid/package.${suffix}`, { fetch: () => { called = true; } })).code, 'INVALID_URL');
    assert.equal(called, false);
  });
  await test('unsafe response URL rejected', async () => assert.equal((await api.fetchCatalog(url, { fetch: async () => ({ ...response(fixture()), url: 'file:///catalog.json' }) })).code, 'INVALID_URL'));
  await test('catalog failures cannot touch active Stage 4 save', async () => {
    const saves = require('../adventure-system/adventure-save.js');
    const save = saves.createAdventureSave({ manifest: require('../adventure-system/samples/circular/manifest.json'), gameData: require('../adventure-system/samples/circular/game-data.json') }).save;
    save.inventory.push('retained'); const before = JSON.stringify(save);
    await api.fetchCatalog(url, { fetch: async () => { throw Error('offline'); } }); assert.equal(JSON.stringify(save), before);
  });
  await test('hosting configuration separates production and development', () => {
    assert.equal(api.DEFAULT_CATALOG_URL, 'https://raw.githubusercontent.com/gerle1116/qr-code-game/main/adventure-catalog/catalog.json');
    assert.ok(api.DEVELOPMENT_CATALOG_URL.includes('/adventure-system/'));
    assert.equal(api.catalogURL({ owner: 'other', repository: 'adventures', ref: 'v1' }), 'https://raw.githubusercontent.com/other/adventures/v1/adventure-catalog/catalog.json');
    assert.throws(() => api.catalogURL({ ref: '../main' }));
  });
  await test('standalone browser global loads without DOM storage or network', () => {
    const context = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../adventure-system/adventure-catalog.js'), 'utf8'), context);
    assert.equal(typeof context.QRCQAdventureCatalog.validateCatalog, 'function');
    assert.equal(vm.runInNewContext('QRCQAdventureCatalog.validateCatalog({catalogVersion:1,adventures:[]}).ok', context), true);
  });
  await test('development server serves fixture and denies gameplay files', async () => {
    const server = createTesterServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try { const base = `http://127.0.0.1:${server.address().port}`;
      assert.equal((await fetch(base + '/adventure-system/samples/catalog/sample-catalog.json')).status, 200);
      assert.equal((await fetch(base + '/app.js')).status, 403); assert.equal((await fetch(base + '/.git/config')).status, 403);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
  if (process.argv.includes('--browser')) await test('real Chromium catalog tester harness', browserTest);
  console.log(`\n${passed} passed; ${failed} failed.${process.argv.includes('--browser') ? '' : ' Browser tests not requested.'}`);
  process.exitCode = failed ? 1 : 0;
})();
