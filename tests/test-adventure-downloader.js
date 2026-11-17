'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const vm = require('node:vm');
const runBrowser = require('./run-stage8-browser.js');
const api = require('../adventure-system/adventure-downloader.js');
const storageAPI = require('../adventure-system/adventure-storage.js');
const zipAPI = require('../adventure-system/adventure-zip.js');
const validator = require('../adventure-system/validator.js');
const saves = require('../adventure-system/adventure-save.js');
const { zip, sampleFiles } = require('../tools/build-adventure-fixtures.js');
const { crc32 } = require('../mod-system/mod-zip-reader.js');
const { createTesterServer } = require('../tools/serve-adventure-catalog.js');
const fixtures = require('../adventure-system/samples/packages/catalog.json').adventures;
let passed = 0, failed = 0;
const copy = structuredClone;
const coded = (code, message = code) => Object.assign(Error(message), { code });
async function test(name, fn) { try { await fn(); passed++; console.log(`PASS ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}: ${e.stack}`); } }
function memoryBackend() {
  let state = { storageVersion: 1, revision: 0, active: null, staging: null }, tail = Promise.resolve(), fault = null;
  return {
    async read() { await tail; return copy(state); },
    transact(fn) {
      const work = tail.then(() => {
        const next = copy(state), result = fn(next), f = fault; fault = null;
        if (f === 'quota' || f === 'before-commit') throw coded(f === 'quota' ? 'QuotaExceededError' : 'SIMULATED_CRASH');
        state = copy(next); if (f === 'after-commit') throw coded('SIMULATED_LOST_ACKNOWLEDGEMENT');
        return copy(result);
      }); tail = work.catch(() => {}); return work;
    },
    failNext(value) { fault = value; }, replace(value) { state = copy(value); }, close() {}
  };
}
const packageBytes = type => new Uint8Array(fs.readFileSync(path.join(__dirname, '../adventure-system/samples/packages', `${type}.zip`)));
const catalogEntry = type => copy(fixtures.find(e => e.type === type));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fetchBytes = bytes => async () => ({ ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) });
// Node-only injected image decoder verifies actual PNG chunks/CRCs and IDAT inflation.
async function decodePNG(bytes) {
  const b = Buffer.from(bytes), compressed = []; let at = 8, ended = false;
  assert.deepEqual([...b.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  while (at + 12 <= b.length) {
    const length = b.readUInt32BE(at), end = at + 12 + length; assert.ok(end <= b.length);
    assert.equal(crc32(b.subarray(at + 4, end - 4)), b.readUInt32BE(end - 4));
    const type = b.toString('ascii', at + 4, at + 8);
    if (type === 'IDAT') compressed.push(b.subarray(at + 8, end - 4));
    if (type === 'IEND') { ended = true; break; } at = end;
  }
  assert.ok(ended && compressed.length); assert.ok(zlib.inflateSync(Buffer.concat(compressed)).length);
}
function setup() { const backend = memoryBackend(); return { backend, storage: storageAPI.createAdventureStorage({ backend }) }; }
async function prepare(storage, type = 'linear', overrides = {}) {
  return api.prepareAdventureInstallation(catalogEntry(type), { storage, fetch: fetchBytes(packageBytes(type)), decodeImage: decodePNG, ...overrides });
}
async function install(storage, type = 'linear') { const r = await prepare(storage, type); assert.equal(r.ok, true, JSON.stringify(r)); const committed = await r.installation.commit({ confirmed: true }); assert.equal(committed.ok, true, JSON.stringify(committed)); return committed; }
function central(bytes) { const b = Buffer.from(bytes); return b.indexOf(Buffer.from([0x50, 0x4b, 1, 2])); }
function mutateZip(field, value) {
  const b = Buffer.from(packageBytes('linear')), at = central(b), offsets = { method: [8, 10], flags: [6, 8], size: [22, 24] }, o = offsets[field];
  if (field === 'size') { b.writeUInt32LE(value, o[0]); b.writeUInt32LE(value, at + o[1]); }
  else { b.writeUInt16LE(value, o[0]); b.writeUInt16LE(value, at + o[1]); }
  return new Uint8Array(b);
}
async function browser() {
  const server = createTesterServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qrcq-downloader-browser-'));
  try {
    const result = await runBrowser(process.env.QRCQ_TEST_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', profile,
      `http://127.0.0.1:${server.address().port}/tests/downloader-browser.html`);
    console.log(result); assert.match(result, /BROWSER: \d+ passed; 0 failed; complete/);
  } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(profile, { recursive: true, force: true }); }
}
(async () => {
  for (const type of ['linear', 'circular', 'non-linear']) await test(`real ${type} fixture size SHA-256 and Stage 1 validation`, async () => {
    const bytes = packageBytes(type), entry = catalogEntry(type); assert.equal(bytes.length, entry.packageSize); assert.equal(hash(bytes), entry.sha256);
    assert.deepEqual(Buffer.from(bytes), zip(sampleFiles(type)));
    const files = await api.extractAdventurePackage(bytes), result = await api.validateAdventurePackage(files, entry, { decodeImage: decodePNG });
    assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.adventure.manifest.type, type);
  });
  await test('browser schema bundle exactly mirrors Stage 1 schema JSON', () => {
    const context = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../adventure-system/adventure-schemas.js'), 'utf8'), context);
    for (const name of ['manifest', 'game-data', 'scenarios']) assert.deepEqual(JSON.parse(JSON.stringify(context.QRCQAdventureSchemas[name])), require(`../adventure-system/schemas/${name}.schema.json`));
  });
  await test('valid ZIP downloads', async () => assert.equal((await api.downloadAdventure(catalogEntry('linear'), { fetch: fetchBytes(packageBytes('linear')) })).ok, true));
  await test('local-host redirects are rejected', async () => {
    const r = await api.downloadAdventure(catalogEntry('linear'), { fetch: async () => ({ ok: true, url: 'https://sub.localhost./archive.zip' }) }); assert.equal(r.code, 'INVALID_URL');
  });
  await test('size mismatch rejected', async () => { const entry = catalogEntry('linear'); entry.packageSize++; assert.equal((await api.downloadAdventure(entry, { fetch: fetchBytes(packageBytes('linear')) })).code, 'SIZE_MISMATCH'); });
  await test('SHA mismatch precedes extraction and staging', async () => {
    const { storage, backend } = setup(), entry = catalogEntry('linear'); entry.sha256 = '0'.repeat(64); let extracted = false;
    const result = await api.prepareAdventureInstallation(entry, { storage, fetch: fetchBytes(packageBytes('linear')), extract: () => { extracted = true; } });
    assert.equal(result.code, 'CHECKSUM_MISMATCH'); assert.equal(extracted, false); assert.equal((await backend.read()).staging, null);
  });
  await test('injected crypto still compares digest', async () => assert.equal((await api.verifyPackageChecksum(packageBytes('linear'), catalogEntry('linear').sha256, { digest: async bytes => hash(bytes) })).ok, true));
  await test('empty archive refused', async () => assert.rejects(() => api.extractAdventurePackage(new Uint8Array())));
  await test('malformed ZIP refused', async () => assert.rejects(() => api.extractAdventurePackage(new Uint8Array(50))));
  await test('native deflate extraction preserves file bytes', async () => {
    const entries = sampleFiles('linear'), files = await api.extractAdventurePackage(zip(entries, { deflate: true }));
    for (const [name, bytes] of entries) assert.deepEqual(files[name], new Uint8Array(bytes));
  });
  await test('inflated output cannot exceed declared size', async () => {
    const bytes = zip(sampleFiles('linear'), { deflate: true });
    await assert.rejects(() => api.extractAdventurePackage(bytes, { inflate: async () => new Uint8Array(100000) }), /size/);
  });
  await test('case-ambiguous directory components refused', async () => assert.rejects(() => api.extractAdventurePackage(zip([['Images/a.png', Buffer.from('a')], ['images/b.png', Buffer.from('b')]])), /Ambiguous/));
  await test('unsupported compression refused', async () => assert.rejects(() => api.extractAdventurePackage(mutateZip('method', 99)), /compression/));
  await test('encrypted flags refused', async () => assert.rejects(() => api.extractAdventurePackage(mutateZip('flags', 1)), /Encrypted/));
  await test('ZIP64 size sentinel refused', async () => assert.rejects(() => api.extractAdventurePackage(mutateZip('size', 0xffffffff)), /ZIP64/));
  await test('multi-volume ZIP refused', async () => { const b = Buffer.from(packageBytes('linear')); b.writeUInt16LE(1, b.length - 18); await assert.rejects(() => api.extractAdventurePackage(b), /multi-disk/); });
  await test('unsupported special device entry refused', async () => { const b = Buffer.from(packageBytes('linear')); b.writeUInt32LE(0x20000000, central(b) + 38); await assert.rejects(() => api.extractAdventurePackage(b), /unsupported ZIP entry/); });
  await test('explicit safe directory entries supported', async () => { const files = await api.extractAdventurePackage(zip([['images/', Buffer.alloc(0)], ['images/map.png', Buffer.from('bytes')]])); assert.deepEqual(Object.keys(files), ['images/map.png']); });
  await test('overlapping local entries refused', async () => {
    const fake = zip([['b.json', Buffer.from('{}')]]), fakeHeader = fake.subarray(0, central(fake));
    const b = zip([['a.json', fakeHeader], ['b.json', Buffer.from('{}')]]), at = central(b), second = at + 46 + b.readUInt16LE(at + 28);
    b.writeUInt32LE(30 + Buffer.byteLength('a.json'), second + 42);
    await assert.rejects(() => api.extractAdventurePackage(b), /Overlapping/);
  });
  await test('symlinks refused', async () => { const b = Buffer.from(packageBytes('linear')); b.writeUInt32LE(0xa0000000, central(b) + 38); await assert.rejects(() => api.extractAdventurePackage(b), /Symlink/); });
  for (const name of ['../manifest.json', '/manifest.json', 'C:/manifest.json', 'images\\..\\map.png', 'images/%2e%2e/map.png', 'images/map.png.', 'images/con.png', 'nested.zip', 'script.js'])
    await test(`unsafe or unsupported archive path ${name}`, async () => assert.rejects(() => api.extractAdventurePackage(zip([[name, Buffer.from('bad')]])), /path/));
  for (const pair of [['manifest.json', 'manifest.json'], ['manifest.json', 'MANIFEST.json'], ['images/map.png', 'images/MAP.png']])
    await test(`duplicate normalized paths ${pair.join(' / ')}`, async () => assert.rejects(() => api.extractAdventurePackage(zip(pair.map(name => [name, Buffer.from('{}')]))), /duplicate|ambiguous/));
  await test('local and central paths must match', async () => { const b = Buffer.from(packageBytes('linear')); b[30] ^= 1; await assert.rejects(() => api.extractAdventurePackage(b), /local ZIP path/); });
  await test('CRC corruption refused', async () => { const b = Buffer.from(packageBytes('linear')); b[30 + b.readUInt16LE(26)] ^= 1; await assert.rejects(() => api.extractAdventurePackage(b), /CRC/); });
  await test('excessive file count refused', async () => assert.rejects(() => api.extractAdventurePackage(packageBytes('linear'), { limits: { maxFiles: 1 } }), /count/));
  await test('per-file uncompressed size refused before inflate', async () => assert.rejects(() => api.extractAdventurePackage(packageBytes('linear'), { limits: { maxFile: 20 } }), /size/));
  await test('total uncompressed size refused', async () => assert.rejects(() => api.extractAdventurePackage(packageBytes('linear'), { limits: { maxTotal: 20 } }), /total/));
  await test('suspicious compression ratio refused before inflate', async () => assert.rejects(() => api.extractAdventurePackage(mutateZip('size', 1000000), { limits: { maxRatio: 2 } }), /ratio/));
  await test('archive maximum refused before fetching', async () => { let called = false; const r = await api.downloadAdventure(catalogEntry('linear'), { limits: { maxArchive: 100 }, fetch: () => { called = true; } }); assert.equal(r.code, 'PACKAGE_TOO_LARGE'); assert.equal(called, false); });
  await test('Content-Length mismatch rejected before reading body', async () => {
    let read = false; const r = await api.downloadAdventure(catalogEntry('linear'), { fetch: async () => ({ ok: true, headers: { get: () => '1' }, arrayBuffer: () => { read = true; } }) }); assert.equal(r.code, 'SIZE_MISMATCH'); assert.equal(read, false);
  });
  await test('streaming overflow cancelled at expected size', async () => {
    let cancelled = false; const reader = { read: async () => ({ done: false, value: new Uint8Array(catalogEntry('linear').packageSize + 1) }), cancel: async () => { cancelled = true; } };
    const r = await api.downloadAdventure(catalogEntry('linear'), { fetch: async () => ({ ok: true, body: { getReader: () => reader } }) }); assert.equal(r.code, 'SIZE_MISMATCH'); assert.equal(cancelled, true);
  });
  await test('network timeout handles fetch ignoring abort', async () => assert.equal((await api.downloadAdventure(catalogEntry('linear'), { timeoutMs: 5, fetch: () => new Promise(() => {}) })).code, 'TIMEOUT'));
  for (const [type, removed] of [['linear', 'manifest.json'], ['linear', 'game-data.json'], ['linear', 'scenarios.json'], ['circular', 'images/map.png']])
    await test(`missing required ${removed}`, async () => {
      const files = Object.fromEntries(sampleFiles(type).filter(([name]) => name !== removed).map(([n, b]) => [n, new Uint8Array(b)]));
      assert.equal((await api.validateAdventurePackage(files, catalogEntry(type), { decodeImage: decodePNG })).code, 'INVALID_PACKAGE');
    });
  for (const key of ['id', 'version', 'language', 'type']) await test(`catalog mismatch ${key}`, async () => {
    const entry = catalogEntry('linear'); entry[key] = { id: 'another', version: '2.0.0', language: 'hu', type: 'circular' }[key];
    assert.equal((await api.validateAdventurePackage(Object.fromEntries(sampleFiles('linear').map(([n, b]) => [n, new Uint8Array(b)])), entry, { decodeImage: decodePNG })).code, 'CATALOG_MISMATCH');
  });
  await test('corrupt image with PNG signature still rejected', async () => {
    const files = Object.fromEntries(sampleFiles('linear').map(([n, b]) => [n, new Uint8Array(b)])); files['images/map.png'] = files['images/map.png'].slice(0, 8);
    assert.equal((await api.validateAdventurePackage(files, catalogEntry('linear'), { decodeImage: decodePNG })).code, 'INVALID_IMAGE');
  });
  for (const [file, value] of [['manifest.json', '{bad'], ['manifest.json', '{"formatVersion":1,"formatVersion":1}'], ['game-data.json', '{}']])
    await test(`invalid JSON/structure in ${file}: ${value.slice(0, 15)}`, async () => {
      const files = Object.fromEntries(sampleFiles('linear').map(([n, b]) => [n, new Uint8Array(b)])); files[file] = new TextEncoder().encode(value);
      assert.equal((await api.validateAdventurePackage(files, catalogEntry('linear'), { decodeImage: decodePNG })).code, 'INVALID_PACKAGE');
    });
  await test('archive JavaScript is never executed', async () => { globalThis.stage8Executed = false; await assert.rejects(() => api.extractAdventurePackage(zip([['evil.js', Buffer.from('globalThis.stage8Executed=true')]]))); assert.equal(globalThis.stage8Executed, false); delete globalThis.stage8Executed; });
  await test('failed download preserves active adventure and save', async () => { const { storage } = setup(); await install(storage); const before = await storage.snapshot(); const r = await prepare(storage, 'circular', { fetch: async () => { throw Error('offline'); } }); assert.equal(r.ok, false); assert.deepEqual(await storage.snapshot(), before); });
  await test('failed validation preserves active adventure and save', async () => { const { storage } = setup(); await install(storage); const before = await storage.snapshot(); const r = await prepare(storage, 'circular', { extract: async () => ({}) }); assert.equal(r.code, 'INVALID_PACKAGE'); assert.deepEqual(await storage.snapshot(), before); });
  await test('staging quota failure preserves old pair', async () => { const { storage, backend } = setup(); await install(storage); const before = await storage.snapshot(); backend.failNext('quota'); const r = await prepare(storage, 'circular'); assert.equal(r.code, 'QuotaExceededError'); assert.deepEqual(await storage.snapshot(), before); });
  await test('activation quota failure preserves old pair and can be retried', async () => {
    const { storage, backend } = setup(); await install(storage); const before = await storage.snapshot(), r = await prepare(storage, 'circular'); backend.failNext('quota');
    assert.equal((await r.installation.commit({ confirmed: true })).code, 'QuotaExceededError'); assert.deepEqual(await storage.snapshot(), before);
    assert.equal((await r.installation.commit({ confirmed: true })).ok, true);
  });
  await test('unfinished save requires structured explicit confirmation', async () => {
    const { storage } = setup(); await install(storage); const before = await storage.snapshot(), r = await prepare(storage, 'circular');
    assert.equal(r.installation.requiresConfirmation, true); assert.equal(r.installation.warning.code, 'UNFINISHED_ADVENTURE');
    assert.equal((await r.installation.commit()).code, 'CONFIRMATION_REQUIRED'); assert.deepEqual(await storage.snapshot(), before);
    assert.equal((await r.installation.commit({ confirmed: true })).ok, true);
  });
  await test('successful switch creates fresh Stage 4 save and removes previous package', async () => {
    const { storage, backend } = setup(); await install(storage); let snap = await storage.snapshot(); snap.active.save.inventory.push('old'); snap.active.save.hadItems.push('old'); await storage.updateSave(snap.active.save, snap.revision);
    await install(storage, 'circular'); snap = await storage.snapshot(); assert.equal(snap.active.adventure.manifest.id, 'circular-demo'); assert.deepEqual(snap.active.save.inventory, []); assert.equal(snap.active.save.adventure.id, 'circular-demo');
    const raw = await backend.read(); assert.equal(raw.staging, null); assert.equal(raw.active.files['scenarios.json'], undefined); assert.deepEqual(Object.keys(raw), ['storageVersion', 'revision', 'active', 'staging']);
  });
  await test('completed save can switch without abandonment confirmation', async () => {
    const { storage } = setup(); await install(storage); const snap = await storage.snapshot(); snap.active.save.completed = true; await storage.updateSave(snap.active.save, snap.revision);
    const r = await prepare(storage, 'circular'); assert.equal(r.installation.requiresConfirmation, false); assert.equal((await r.installation.commit()).ok, true);
  });
  await test('reinstallation protects unfinished save too', async () => { const { storage } = setup(); await install(storage); const r = await prepare(storage); assert.equal((await r.installation.commit()).code, 'CONFIRMATION_REQUIRED'); });
  await test('stale progress refuses commit', async () => { const { storage } = setup(); await install(storage); const r = await prepare(storage, 'circular'), snap = await storage.snapshot(); snap.active.save.flags.unlockedAreas.push('TEST'); await storage.updateSave(snap.active.save, snap.revision); assert.equal((await r.installation.commit({ confirmed: true })).code, 'STALE_TRANSITION'); assert.equal((await storage.getActive()).save.flags.unlockedAreas[0], 'TEST'); });
  await test('only one staged replacement survives concurrent preparations', async () => {
    const { storage } = setup(); await install(storage); const first = await prepare(storage, 'circular'), second = await prepare(storage, 'non-linear');
    assert.equal((await first.installation.commit({ confirmed: true })).code, 'STALE_TRANSITION'); assert.equal((await second.installation.commit({ confirmed: true })).ok, true);
  });
  await test('prepared handle commit is single use', async () => { const { storage } = setup(), r = await prepare(storage); assert.equal((await r.installation.commit()).ok, true); assert.equal((await r.installation.commit()).code, 'INSTALLATION_FINISHED'); });
  await test('interruption after staging recovers old pair and discards staging', async () => {
    const { storage, backend } = setup(); await install(storage); const before = await storage.snapshot(); await prepare(storage, 'circular');
    const reopened = storageAPI.createAdventureStorage({ backend }); assert.equal((await reopened.recover()).discardedStaging, true); assert.deepEqual(await reopened.snapshot(), before); assert.equal((await backend.read()).staging, null);
  });
  for (const point of ['before-commit', 'after-commit']) await test(`simulated crash ${point} recovers consistent pair`, async () => {
    const { storage, backend } = setup(); await install(storage); const r = await prepare(storage, 'circular'); backend.failNext(point);
    assert.equal((await r.installation.commit({ confirmed: true })).ok, false);
    const reopened = storageAPI.createAdventureStorage({ backend }); await reopened.recover(); const { active } = await reopened.snapshot();
    assert.equal(active.adventure.manifest.id, point === 'before-commit' ? 'linear-demo' : 'circular-demo'); assert.equal(active.save.adventure.id, active.adventure.manifest.id);
  });
  await test('cancel before request leaves old state intact', async () => { const { storage } = setup(); await install(storage); const before = await storage.snapshot(), c = new AbortController(); c.abort(); const r = await prepare(storage, 'circular', { signal: c.signal }); assert.equal(r.code, 'CANCELLED'); assert.deepEqual(await storage.snapshot(), before); });
  await test('cancel staged replacement clears staging without touching old pair', async () => { const { storage, backend } = setup(); await install(storage); const before = await storage.snapshot(), r = await prepare(storage, 'circular'); assert.equal((await r.installation.cancel()).ok, true); assert.deepEqual(await storage.snapshot(), before); assert.equal((await backend.read()).staging, null); });
  await test('AbortSignal automatically discards staged replacement', async () => { const { storage, backend } = setup(); await install(storage); const before = await storage.snapshot(), c = new AbortController(); const r = await prepare(storage, 'circular', { signal: c.signal }); assert.equal(r.ok, true); c.abort(); assert.deepEqual(await storage.snapshot(), before); assert.equal((await backend.read()).staging, null); });
  await test('AbortSignal cancels a pending network request', async () => { const { storage } = setup(), c = new AbortController(); const running = prepare(storage, 'linear', { signal: c.signal, fetch: () => new Promise(() => {}) }); setTimeout(() => c.abort(), 5); assert.equal((await running).code, 'CANCELLED'); assert.equal(await storage.getActive(), null); });
  await test('cancel at validation phase never stages replacement', async () => { const { storage, backend } = setup(), c = new AbortController(); const r = await prepare(storage, 'linear', { signal: c.signal, onProgress: e => { if (e.phase === 'validating') c.abort(); } }); assert.equal(r.code, 'CANCELLED'); assert.equal((await backend.read()).staging, null); });
  await test('offline reopen reads complete package save and binary map', async () => {
    const { storage, backend } = setup(); await install(storage); const reopened = storageAPI.createAdventureStorage({ backend }); await reopened.recover();
    const active = await reopened.getActive(); assert.equal(validator.validateFiles(active.files).valid, true); assert.ok(active.adventure.scenarioData); assert.equal(active.save.adventure.id, 'linear-demo');
    assert.deepEqual(await reopened.getAsset('images/map.png'), new Uint8Array(fs.readFileSync(path.join(__dirname, '../adventure-system/samples/linear/images/map.png')))); assert.equal(await reopened.getAsset('../app.js'), null);
  });
  await test('asset lease reuses and revokes blob URLs and refuses use after dispose', async () => {
    const { storage } = setup(); await install(storage); let created = 0, revoked = 0;
    const loader = await storage.createAssetLoader({ URL: { createObjectURL: () => `blob:test-${++created}`, revokeObjectURL: () => { revoked++; } } });
    assert.equal(loader.resolveAsset('images/map.png'), loader.resolveAsset('images/map.png')); assert.equal(created, 1); loader.dispose(); loader.dispose(); assert.equal(revoked, 1); assert.equal(loader.resolveAsset('images/map.png'), undefined);
  });
  await test('progress phases ordered from download to explicit completion', async () => {
    const { storage } = setup(), phases = []; const r = await prepare(storage, 'linear', { onProgress: e => phases.push(e.phase) }); await r.installation.commit();
    assert.deepEqual(phases, ['downloading', 'verifying', 'extracting', 'validating', 'staging', 'awaiting-confirmation', 'activating', 'complete']);
  });
  await test('built-in legacy migration is explicit and protected', async () => {
    const { storage } = setup(); const original = saves.createAdventureSave({ manifest: saves.LEGACY_ADVENTURE }).save;
    const legacy = copy(original); for (const key of ['adventureSaveVersion', 'adventure', 'scenarioState', 'scenarioFinished', 'encounterHistory', 'completed']) delete legacy[key];
    await storage.adoptBuiltInSave(legacy); assert.equal((await storage.getActive()).kind, 'builtin'); const r = await prepare(storage); assert.equal((await r.installation.commit()).code, 'CONFIRMATION_REQUIRED');
    await assert.rejects(() => storage.adoptBuiltInSave(legacy), /already exists/);
  });
  await test('corrupt or unsupported storage is retained for explicit recovery', async () => {
    const { storage, backend } = setup(); const corrupt = { storageVersion: 99, revision: 0, active: null, staging: null }; backend.replace(corrupt);
    await assert.rejects(() => storage.recover(), /Unknown/); assert.deepEqual(await backend.read(), corrupt);
  });
  await test('clear requires explicit confirmation and returns built-in default', async () => { const { storage } = setup(); await install(storage); await assert.rejects(() => storage.clear(), /Confirm/); await storage.clear({ confirmed: true }); assert.equal(await storage.getActive(), null); });
  if (process.argv.includes('--browser')) await test('real browser IndexedDB and standalone tester harness', browser);
  console.log(`\n${passed} passed; ${failed} failed.`); process.exitCode = failed ? 1 : 0;
})();
