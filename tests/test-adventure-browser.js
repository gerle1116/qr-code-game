'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const api = require('../adventure-system/adventure-browser.js');
const { createTesterServer } = require('../tools/serve-adventure-catalog.js');
const runBrowser = require('./run-stage8-browser.js');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log(`PASS ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}: ${e.stack}`); } }
(async () => {
  for (const type of ['linear', 'circular', 'non-linear']) await test(`${type} describes existing mechanics and navigation`, () => {
    const info = api.typeInfo(type); assert.ok(info.label && info.description); assert.equal(info.navigation, type === 'non-linear' ? 'Objectives' : 'Map');
    if (type === 'circular') { assert.match(info.description, /freely/); assert.doesNotMatch(info.description, /ordered|fixed route/); }
    if (type === 'linear') assert.match(info.description, /first QR scan/);
  });
  await test('canonical type boundary rejects unknown gameplay types', () => { assert.throws(() => api.typeInfo('nonlinear')); assert.throws(() => api.typeInfo('sandbox')); });
  await test('English fallback for unsupported UI locale', () => assert.equal(api.createTranslator('de')('title'), 'Choose Your Adventure'));
  await test('Hungarian UI is independent from content language', () => { assert.equal(api.createTranslator('hu-HU')('title'), 'Válassz kalandot'); assert.equal(api.typeInfo('linear', api.createTranslator('hu')).navigation, 'Térkép'); });
  await test('missing Hungarian keys fall back to English', () => assert.equal(api.createTranslator('hu')('packageError'), api.EN.packageError));
  await test('injected translation overrides and invalid values fall back', () => { const t = api.createTranslator('en', { title: 'A new journey', current: null }); assert.equal(t('title'), 'A new journey'); assert.equal(t('current'), api.EN.current); });
  for (const code of ['NETWORK_ERROR', 'TIMEOUT', 'INVALID_CATALOG', 'UNSUPPORTED_VERSION', 'INVALID_JSON', 'HTTP_ERROR', 'CATALOG_NOT_FOUND', 'INVALID_ZIP', 'CHECKSUM_MISMATCH', 'SIZE_MISMATCH', 'INVALID_PACKAGE', 'CATALOG_MISMATCH', 'QuotaExceededError', 'CANCELLED', 'STALE_TRANSITION', 'STORAGE_CORRUPT', 'UNEXPECTED'])
    await test(`readable player error for ${code}`, () => { const message = api.errorMessage(code); assert.ok(message.length > 20); assert.ok(!message.includes(code)); });
  await test('invalid mount context rejected before network/storage access', () => assert.throws(() => api.createAdventureBrowser({}), /DOM container/));
  await test('module loads in a browser realm without touching DOM or storage', () => {
    const context = { QRCQAdventureCatalog: {}, QRCQAdventureDownloader: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../adventure-system/adventure-browser.js'), 'utf8'), context);
    assert.equal(typeof context.QRCQAdventureBrowser.createAdventureBrowser, 'function');
  });
  if (process.argv.includes('--browser')) await test('real Stage 9 Chromium integration suite', async () => {
    const server = createTesterServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qrcq-stage9-browser-'));
    try {
      const result = await runBrowser(process.env.QRCQ_TEST_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', profile,
        `http://127.0.0.1:${server.address().port}/tests/adventure-browser.html`, { keyboard: true,
          screenshotPath: process.env.QRCQ_BROWSER_SCREENSHOT,
          screenshotURL: `http://127.0.0.1:${server.address().port}/adventure-system/adventure-browser-tester.html` });
      console.log(result); assert.match(result, /BROWSER: \d+ passed; 0 failed; complete/);
    } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(profile, { recursive: true, force: true }); }
  });
  console.log(`\n${passed} passed; ${failed} failed.`); process.exitCode = failed ? 1 : 0;
})();
