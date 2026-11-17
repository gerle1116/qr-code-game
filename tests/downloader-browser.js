'use strict';
(async () => {
  let passed = 0, failed = 0; const lines = [];
  const assert = (value, message = 'assertion failed') => { if (!value) throw Error(message); };
  const test = async (name, fn) => { try { await fn(); passed++; lines.push(`PASS ${name}`); } catch (e) { failed++; lines.push(`FAIL ${name}: ${e.stack}`); } document.getElementById('results').textContent = lines.join('\n'); };
  const until = async fn => { for (let i = 0; i < 1000; i++) { if (fn()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw Error('Timed out waiting for tester'); };
  const api = QRCQAdventureDownloader, storeAPI = QRCQAdventureStorage, name = 'qrcq-stage8-automated-browser-v1';
  let storage, backend;
  try {
    const entries = (await (await fetch('../adventure-system/samples/packages/catalog.json')).json()).adventures;
    const buffers = {};
    for (const e of entries) buffers[e.type] = new Uint8Array(await (await fetch(`../adventure-system/samples/packages/${e.type}.zip`)).arrayBuffer());
    backend = storeAPI.createIndexedDBBackend({ name }); storage = storeAPI.createAdventureStorage({ backend }); await storage.clear({ confirmed: true });
    const prepare = async type => api.prepareAdventureInstallation(entries.find(e => e.type === type), { storage, fetch: async () => new Response(buffers[type]) });
    const activate = async type => { const r = await prepare(type); assert(r.ok, JSON.stringify(r)); const c = await r.installation.commit({ confirmed: true }); assert(c.ok, JSON.stringify(c)); return c; };
    await test('actual Web Crypto native image decoding and IndexedDB install', async () => { await activate('linear'); assert((await storage.getActive()).save.adventure.id === 'linear-demo'); });
    await test('real native image decoder rejects signature-only PNG', async () => {
      const files = await api.extractAdventurePackage(buffers.linear); files['images/map.png'] = files['images/map.png'].slice(0, 8);
      const r = await api.validateAdventurePackage(files, entries.find(e => e.type === 'linear')); assert(r.code === 'INVALID_IMAGE', JSON.stringify(r));
    });
    await test('unfinished IDB save blocks commit until confirmation', async () => {
      const r = await prepare('circular'); assert(r.ok, JSON.stringify(r)); assert(r.installation.requiresConfirmation); assert((await r.installation.commit()).code === 'CONFIRMATION_REQUIRED'); assert((await storage.getActive()).save.adventure.id === 'linear-demo'); await r.installation.cancel();
    });
    await test('abandoned staging is discarded on reopen while old pair survives', async () => {
      const r = await prepare('circular'); assert(r.ok); await storage.close();
      backend = storeAPI.createIndexedDBBackend({ name }); storage = storeAPI.createAdventureStorage({ backend });
      const recovery = await storage.recover(); assert(recovery.discardedStaging); assert(recovery.active.save.adventure.id === 'linear-demo'); assert((await backend.read()).staging === null);
    });
    await test('real IDB transaction abort rolls back queued package/save write', async () => {
      const before = JSON.stringify((await storage.getActive()).save);
      await new Promise((resolve, reject) => {
        const request = indexedDB.open(name, 1); request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result, tx = db.transaction('state', 'readwrite'), store = tx.objectStore('state');
          const get = store.get('pair'); get.onsuccess = () => {
            const state = get.result; state.active.save.adventure.id = 'inconsistent-new-save';
            const write = store.put(state, 'pair'); write.onsuccess = () => tx.abort();
          };
          tx.onabort = () => { db.close(); resolve(); }; tx.oncomplete = () => { db.close(); reject(Error('Expected transaction abort')); };
        };
      });
      assert(JSON.stringify((await storage.getActive()).save) === before);
    });
    await test('simulated quota abort through real IDB keeps previous package/save', async () => {
      const before = JSON.stringify((await storage.getActive()).save); let fail = true;
      const failing = storeAPI.createAdventureStorage({ backend: { read: () => backend.read(), transact: fn => backend.transact(state => {
        const value = fn(state); if (fail) { fail = false; throw new DOMException('Simulated quota error', 'QuotaExceededError'); } return value;
      }) } });
      const r = await api.prepareAdventureInstallation(entries[1], { storage: failing, fetch: async () => new Response(buffers.circular) });
      assert(!r.ok && r.code === 'QuotaExceededError', JSON.stringify(r)); assert(JSON.stringify((await storage.getActive()).save) === before);
    });
    await test('successful atomic replacement removes old files and pairs fresh save', async () => {
      await activate('circular'); const active = await storage.getActive(), raw = await backend.read();
      assert(active.adventure.manifest.id === active.save.adventure.id); assert(active.save.adventure.id === 'circular-demo'); assert(!active.files['scenarios.json']); assert(raw.staging === null);
    });
    await test('offline reopening reads actual persistent IndexedDB without fetch', async () => {
      await storage.close(); storage = storeAPI.createAdventureStorage({ name });
      const original = window.fetch; window.fetch = () => { throw Error('network disabled'); };
      try { await storage.recover(); const active = await storage.getActive(); assert(active.save.adventure.id === 'circular-demo'); assert((await storage.getAsset('images/map.png')).length > 8); }
      finally { window.fetch = original; }
    });
    await test('blob asset URL decodes and is revoked on disposal', async () => {
      const lease = await storage.createAssetLoader(), src = lease.resolveAsset('images/map.png');
      assert(src === lease.resolveAsset('images/map.png')); const image = new Image(); image.src = src; await image.decode(); assert(image.naturalWidth > 0); lease.dispose(); assert(lease.resolveAsset('images/map.png') === undefined);
    });
    await test('cancellation removes staged data without changing IDB active pair', async () => {
      const r = await prepare('linear'); assert(r.ok); await r.installation.cancel(); assert((await storage.getActive()).save.adventure.id === 'circular-demo');
    });
    await storage.close();
    const frame = document.createElement('iframe'); frame.style.width = '1000px'; frame.style.height = '1000px';
    await new Promise(resolve => { frame.onload = resolve; frame.src = '../adventure-system/downloader-tester.html'; document.body.appendChild(frame); });
    let doc = frame.contentDocument; const el = id => doc.getElementById(id);
    await until(() => !el('prepare').disabled || el('status').textContent.includes('could not start'));
    await test('actual isolated tester starts with local fixture packages', () => { assert(!el('prepare').disabled, el('status').textContent); assert(el('sample').options.length === 3); });
    el('prepare').click(); await until(() => !el('activate').disabled || el('status').textContent.includes('INVALID_'));
    await test('actual tester prepares real sample ZIP', () => assert(!el('activate').disabled, el('status').textContent));
    el('activate').click(); await until(() => el('status').textContent.includes('Installation complete') && el('map').querySelector('img'));
    await test('actual tester activates paired package/save and displays map', () => { assert(el('active').textContent.includes('linear-demo')); assert(el('map').querySelector('img')); });
    await new Promise(resolve => { frame.onload = resolve; frame.contentWindow.location.reload(); }); doc = frame.contentDocument;
    await until(() => !el('prepare').disabled);
    await test('actual tester reload preserves active adventure and save', () => assert(el('active').textContent.includes('linear-demo')));
    el('offline').checked = true; el('offline').dispatchEvent(new frame.contentWindow.Event('change')); el('refresh').click();
    await test('test-only offline switch leaves installed data readable', () => assert(el('active').textContent.includes('linear-demo')));
    el('prepare').click(); await until(() => el('status').textContent.includes('NETWORK_ERROR'));
    await test('simulated offline install fails without replacing save', () => assert(el('active').textContent.includes('linear-demo')));
    el('offline').checked = false; el('fail').click(); await until(() => el('status').textContent.includes('SIMULATED FAILURE'));
    await test('actual tester labels simulated failure and preserves package', () => assert(el('active').textContent.includes('linear-demo')));
    el('sample').value = '1'; el('prepare').click(); await until(() => !el('activate').disabled);
    await test('actual tester warns before replacing unfinished save', () => assert(el('warning').textContent.includes('unfinished')));
    el('cancel').click(); await until(() => el('activate').disabled);
    await test('actual tester cancel preserves previous adventure', () => assert(el('active').textContent.includes('linear-demo')));
    el('prepare').click(); el('cancel').click(); await until(() => !el('prepare').disabled);
    await test('actual tester cancels during download', () => { assert(el('active').textContent.includes('linear-demo')); assert(el('activate').disabled); });
    frame.remove();
  } catch (e) { failed++; lines.push(`FAIL harness: ${e.stack}`); }
  finally { await storage?.close(); }
  document.getElementById('results').textContent = lines.join('\n') + `\nBROWSER: ${passed} passed; ${failed} failed; complete`;
})();
