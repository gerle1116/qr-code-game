'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAdventureStorage } = require('../adventure-system/adventure-storage.js');
const { createCompletionEngine } = require('../adventure-system/adventure-completion.js');
const { validateFiles } = require('../adventure-system/validator.js');
const { createGameServer } = require('../tools/serve-integrated-game.js');
const { sampleFiles } = require('../tools/build-adventure-fixtures.js');
const runBrowser = require('./run-stage8-browser.js');

let passed = 0, failed = 0;
async function test(name, run) {
  try { await run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); }
}
const load = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const files = type => Object.fromEntries(sampleFiles(type));
const packageId = set => JSON.parse(set['manifest.json']).id;

(async () => {
  await test('versioned live dependencies and entry assets coordinate with v42', () => {
    const version = '42';
    const manifest = JSON.parse(load('manifest.webmanifest'));
    const worker = load('sw.js');
    assert.match(worker, /const CACHE = "qr-city-quest-v42"/);
    for (const file of ['index.html', 'app.js', 'language-loader.js']) {
      for (const [, asset] of load(file).matchAll(/["'](?:\.\/)?([^"'\n]+\.(?:js|css))\?v=(\d+)["']/g)) {
        const literal = './' + asset + '?v=' + version;
        assert.ok(asset === 'sw.js' || worker.includes(literal), literal);
      }
      for (const [, value] of load(file).matchAll(/\?v=(\d+)/g)) assert.equal(value, version);
    }
    assert.equal(manifest.scope, './');
    assert.equal(manifest.start_url, './');
    assert.deepEqual(JSON.parse(load('adventure-catalog/catalog.json')).adventures, []);
  });
  await test('all published-format sample maps still validate with the image policy', () => {
    for (const type of ['linear', 'circular', 'non-linear']) {
      const outcome = validateFiles(files(type));
      assert.equal(outcome.valid, true, outcome.errors.join('\n'));
    }
  });
  await test('the image policy rejects an over-limit asset before installation can stage it', () => {
    const bundle = files('linear');
    const image = Buffer.from(bundle['images/map.png']);
    image.writeUInt32BE(4097, 16);
    bundle['images/map.png'] = image;
    const outcome = validateFiles(bundle);
    assert.equal(outcome.valid, false);
    assert.ok(outcome.errors.some(error => error.includes('dimensions exceed')));
  });
  await test('only an authorized interaction advances a live checkpoint across same-version reinstallation', async () => {
    const packageFiles = files('linear');
    let record = { storageVersion: 1, revision: 0, active: null, staging: null };
    const storage = createAdventureStorage({ backend: {
      read: async () => structuredClone(record),
      async transact(fn) {
        const draft = structuredClone(record), result = fn(draft);
        record = draft;
        return result;
      }
    } });
    const install = async () => storage.stage({ files: packageFiles }, await storage.snapshot());
    const first = await install();
    assert.equal((await storage.commit(first.token)).ok, true);
    const old = (await createCompletionEngine({ storage, live: true })).engine;
    const view = old.scan('03');
    assert.equal(view.ok, true);
    assert.equal((await old.confirmCheckpoint()).code, 'GAMEPLAY_TRANSITION_REQUIRED');
    assert.equal(old.getProgress().scenarioState.currentIndex, 0);
    const replacement = await install();
    assert.equal((await storage.commit(replacement.token)).code, 'CONFIRMATION_REQUIRED');
    assert.equal((await storage.commit(replacement.token, { confirmed: true })).ok, true);
    await old.choose(view, 1);
    assert.equal((await old.flush()).code, 'STALE_TRANSITION');
    const { active } = await storage.snapshot();
    assert.equal(active.adventure.manifest.id, packageId(packageFiles));
    assert.equal(active.save.scenarioState.scenarioId, null);
  });
  console.log(`Stage 12 Node: ${passed} passed; ${failed} failed.`);
  if (process.argv.includes('--browser')) {
    const basePath = '/qr-code-game/';
    const server = createGameServer({ tests: true, basePath });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qrcq-stage12-browser-'));
    try {
      const browser = process.env.QRCQ_TEST_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      const results = await runBrowser(browser, profile, `http://127.0.0.1:${server.address().port}${basePath}tests/release-browser.html`,
        { network: true, timeoutMs: 90000 });
      console.log(results);
      assert.match(results, /BROWSER: \d+ passed; 0 failed; complete/);
    } catch (error) { failed++; console.error(error.stack); }
    finally {
      await new Promise(resolve => server.close(resolve));
      try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 }); }
      catch (error) { console.error('Disposable browser profile cleanup:', error.message); }
    }
  }
  process.exitCode = failed ? 1 : 0;
})();
