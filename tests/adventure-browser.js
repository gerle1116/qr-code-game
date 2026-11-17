'use strict';
(async () => {
  let passed = 0, failed = 0; const lines = [];
  const assert = (value, message = 'assertion failed') => { if (!value) throw Error(message); };
  const test = async (name, fn) => { try { await fn(); passed++; lines.push(`PASS ${name}`); } catch (e) { failed++; lines.push(`FAIL ${name}: ${e.stack}`); } document.getElementById('results').textContent = lines.join('\n'); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const key = async (value, shift = false) => { window.__browserKeyRequest = { key: value, shift, done: false }; await until(() => window.__browserKeyRequest.done); };
  const until = async (fn, message = 'waiting for UI') => { for (let i = 0; i < 400; i++) { if (fn()) return; await wait(10); } throw Error(message); };
  function makeZip(files) {
    const chunks = [], directory = []; let offset = 0;
    for (const [name, data] of Object.entries(files)) {
      const n = new TextEncoder().encode(name), crc = QRCQZipReader.crc32(data), local = new Uint8Array(30), cd = new Uint8Array(46);
      const l = new DataView(local.buffer), c = new DataView(cd.buffer);
      l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, n.length, true);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, n.length, true); c.setUint32(42, offset, true);
      chunks.push(local, n, data); directory.push(cd, n); offset += local.length + n.length + data.length;
    }
    const size = directory.reduce((sum, b) => sum + b.length, 0), end = new Uint8Array(22), v = new DataView(end.buffer);
    v.setUint32(0, 0x06054b50, true); v.setUint16(8, Object.keys(files).length, true); v.setUint16(10, Object.keys(files).length, true); v.setUint32(12, size, true); v.setUint32(16, offset, true);
    const out = new Uint8Array(offset + size + end.length); let pos = 0;
    for (const chunk of [...chunks, ...directory, end]) { out.set(chunk, pos); pos += chunk.length; } return out;
  }
  let browser, storage;
  try {
    const host = document.getElementById('host'), originalFetch = window.fetch.bind(window);
    const fixture = await (await originalFetch('../adventure-system/samples/packages/catalog.json')).json(), bytes = {};
    for (const e of fixture.adventures) bytes[e.type] = new Uint8Array(await (await originalFetch(`../adventure-system/samples/packages/${e.type}.zip`)).arrayBuffer());
    const dbName = 'qrcq-stage9-browser-automated-v1', backend = QRCQAdventureStorage.createIndexedDBBackend({ name: dbName });
    storage = QRCQAdventureStorage.createAdventureStorage({ backend }); await storage.clear({ confirmed: true });
    let catalog = structuredClone(fixture), catalogMode = 'normal', downloadMode = 'normal', calls = 0, resolveLate, commitFault = false, invalidBytes, holdCommit = false, resolveCommit;
    const controlledStorage = { ...storage, async commit(...args) { if (commitFault) throw Object.assign(Error('test quota'), { code: 'QuotaExceededError' });
      if (holdCommit) await new Promise(resolve => { resolveCommit = resolve; }); return storage.commit(...args); } };
    const catalogFetch = async () => {
      if (catalogMode === 'network') throw Error('offline');
      if (catalogMode === 'invalid') return new Response('{invalid');
      if (catalogMode === 'late') return new Promise(resolve => { resolveLate = () => resolve(new Response(JSON.stringify(catalog))); });
      if (catalogMode === 'timeout') return new Promise(() => {});
      return new Response(JSON.stringify(catalog));
    };
    const downloadFetch = async (url, options) => {
      calls++; if (downloadMode === 'network') throw Error('offline');
      if (downloadMode === 'late') await new Promise(resolve => { resolveLate = resolve; });
      const e = fixture.adventures.find(a => a.downloadUrl === url); let data = new Uint8Array(bytes[e.type]);
      if (downloadMode === 'checksum') data[0] ^= 1;
      if (downloadMode === 'validation') data = invalidBytes;
      return new Response(data);
    };
    const mount = async (extra = {}) => {
      const { dependencies: addedDependencies, ...rest } = extra;
      await browser?.destroy(); browser = QRCQAdventureBrowser.createAdventureBrowser({ container: host, storage: controlledStorage,
        catalogURL: 'https://example.invalid/catalog.json', ...rest, dependencies: { catalogFetch, downloadFetch, resolveCover: () => null, catalogTimeoutMs: 50, ...addedDependencies } });
      await browser.ready; return browser;
    };
    const q = selector => host.querySelector(selector), all = selector => [...host.querySelectorAll(selector)];
    const cards = () => all('.ab-card');
    const filter = (key, value) => { const input = q(`[data-filter="${key}"]`); input.value = value; input.dispatchEvent(new Event('input')); };
    const open = type => browser.openDetails(fixture.adventures.find(a => a.type === type).id);
    const installButton = () => q('[data-action="install"]');
    const progress = () => q('.ab-progress').textContent;
    const start = async type => { if (browser.getState().selectedId) await browser.back(); open(type); installButton().click(); await until(() => !browser.getState().busy || q('dialog').open, progress()); };
    const activeId = async () => (await storage.getActive())?.save.adventure.id;
    const confirm = async () => { q('[data-action="replace"]').click(); await until(() => !browser.getState().busy, progress()); };
    await mount();
    await test('valid catalog renders three actual sample cards and built-in default', () => { assert(cards().length === 3); assert(q('.ab-current').textContent.includes('built-in')); assert(!q('.ab-current').textContent.includes('linear demo')); });
    await test('cards contain type content language duration age and location', () => { assert(cards()[0].textContent.includes('Adventure language: en')); assert(cards()[0].textContent.includes('10 minutes')); assert(cards()[0].textContent.includes('Ages 6+')); assert(cards()[0].textContent.includes('Practice garden')); });
    await test('name and description search', () => { filter('search', 'linear demo'); assert(cards().length === 2); filter('search', 'validator testing'); assert(cards().length === 3); filter('search', ''); });
    await test('type filter canonical non-linear', () => { filter('type', 'non-linear'); assert(cards().length === 1); assert(cards()[0].dataset.adventureId === 'non-linear-demo'); filter('type', ''); });
    await test('language filter', () => { filter('language', 'hu'); assert(!cards().length); assert(q('.ab-catalog-status').textContent.includes('No adventures match')); filter('language', 'en'); assert(cards().length === 3); filter('language', ''); });
    await test('location filter', () => { filter('location', 'garden'); assert(cards().length === 3); filter('location', 'unknown'); assert(!cards().length); filter('location', ''); });
    await test('age filter inclusive boundary and clear filters', () => { filter('maxMinimumAge', '5'); assert(!cards().length); filter('maxMinimumAge', '6'); assert(cards().length === 3); q('[data-action="clear"]').click(); assert(q('[data-filter="maxMinimumAge"]').value === ''); });
    await test('name and estimated-duration sorting use Stage 7 operations', async () => { filter('sortBy', 'name'); assert(cards()[0].dataset.adventureId === 'circular-demo');
      catalog.adventures.forEach((a, i) => { a.estimatedMinutes = [30, 20, 40][i]; }); await browser.refreshCatalog(); filter('sortBy', 'duration'); assert(cards()[0].dataset.adventureId === 'circular-demo');
      catalog = structuredClone(fixture); await browser.refreshCatalog(); filter('sortBy', '');
    });
    await test('details show full metadata and exact gameplay explanation', () => { open('linear'); assert(q('.ab-details').textContent.includes('first QR scan')); assert(q('.ab-details').textContent.includes('Main navigation: Map')); assert(q('.ab-details').textContent.includes('Created by QR City Quest')); assert(q('.ab-details h2') === document.activeElement); });
    await test('back returns keyboard focus to browser heading', async () => { await browser.back(); assert(!q('.ab-browse').hidden); assert(document.activeElement === q('.ab-heading-row h2')); });
    await test('native Enter opens details from a keyboard-focused card button', async () => { q('.ab-card button').focus(); await key('Enter'); assert(browser.getState().selectedId); assert(q('.ab-details h2') === document.activeElement); await browser.back(); });
    await test('missing covers use attractive placeholders without broken images', () => { assert(all('.ab-card .ab-art[data-placeholder="true"]').length === 3); assert(!q('.ab-card img')); });
    await test('catalog strings cannot inject HTML in cards or details', async () => {
      catalog.adventures[0].name = '<img src=x onerror=alert(1)>'; catalog.adventures[0].description = '<script>bad</script>';
      await browser.refreshCatalog(); open('linear'); assert(q('.ab-details h2').textContent.startsWith('<img')); assert(!q('.ab-details script')); assert(!q('.ab-card img')); await browser.back(); catalog = structuredClone(fixture); await browser.refreshCatalog();
    });
    await test('valid empty catalog differs from no-filter-matches', async () => { catalog = { catalogVersion: 1, adventures: [] }; await browser.refreshCatalog(); assert(q('.ab-catalog-status').textContent.includes('No adventures are published')); assert(q('[data-action="catalog-retry"]').hidden); catalog = structuredClone(fixture); await browser.refreshCatalog(); });
    await test('catalog loading state and network error retry', async () => {
      catalogMode = 'late'; const loading = browser.refreshCatalog(); assert(q('.ab-catalog-status').textContent.includes('Finding')); await until(() => resolveLate); resolveLate(); await loading;
      catalogMode = 'network'; await browser.refreshCatalog(); assert(!q('[data-action="catalog-retry"]').hidden); assert(q('.ab-catalog-status').textContent.includes('offline'));
      catalogMode = 'normal'; q('[data-action="catalog-retry"]').click(); await until(() => cards().length === 3);
    });
    await test('invalid JSON catalog has distinct compatibility message', async () => { catalogMode = 'invalid'; await browser.refreshCatalog(); assert(q('.ab-catalog-status').textContent.includes('not compatible')); catalogMode = 'normal'; await browser.refreshCatalog(); });
    await test('timeout catalog state is distinct', async () => { catalogMode = 'timeout'; await browser.refreshCatalog(); assert(q('.ab-catalog-status').textContent.includes('too long')); catalogMode = 'normal'; await browser.refreshCatalog(); });
    await test('checksum mismatch blocks activation through real Stage 8', async () => { downloadMode = 'checksum'; await start('linear'); assert(progress().includes('checksum')); assert(await activeId() === undefined); downloadMode = 'normal'; });
    await test('correctly hashed but invalid package fails real Stage 1 validation without activation', async () => {
      const files = await QRCQAdventureDownloader.extractAdventurePackage(bytes.linear); delete files['game-data.json']; invalidBytes = makeZip(files);
      catalog.adventures[0].packageSize = invalidBytes.length; catalog.adventures[0].sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', invalidBytes))].map(n => n.toString(16).padStart(2, '0')).join('');
      await browser.refreshCatalog(); downloadMode = 'validation'; await start('linear'); assert(progress().includes('safely validated')); assert(await activeId() === undefined);
      downloadMode = 'normal'; catalog = structuredClone(fixture); await browser.refreshCatalog();
    });
    await test('valid sample installs with correct fresh Stage 4 save', async () => { await start('linear'); assert(await activeId() === 'linear-demo'); assert(progress().includes('installed and available offline')); const a = await storage.getActive(); assert(a.save.inventory.length === 0); assert(a.save.scenarioState.scenarioId === null); });
    await test('active panel shows version unfinished status offline availability and active badge', () => { assert(q('.ab-current').textContent.includes('Unfinished progress saved')); assert(q('.ab-current').textContent.includes('Version 1.0.0')); assert(q('.ab-current').textContent.includes('Installed files available offline')); assert(q('[data-adventure-id="linear-demo"] .ab-active-badge')); });
    await test('explicit unfinished replacement warning defaults focus to keep', async () => { await start('circular'); assert(q('dialog').open); assert(q('dialog').textContent.includes('linear demo')); assert(q('dialog').textContent.includes('circular demo')); assert(document.activeElement === q('[data-action="keep"]')); assert(await activeId() === 'linear-demo'); assert(q('dialog').getAttribute('aria-labelledby')); });
    await test('native keyboard Tab moves within confirmation and Shift-Tab returns to safe default', async () => {
      await key('Tab'); assert(document.activeElement === q('[data-action="replace"]'));
      await key('Tab', true); assert(document.activeElement === q('[data-action="keep"]'));
    });
    await test('keep current cancels staging and preserves exact save', async () => { const before = JSON.stringify((await storage.getActive()).save); q('[data-action="keep"]').click(); await until(() => !browser.getState().busy); assert(JSON.stringify((await storage.getActive()).save) === before); assert((await backend.read()).staging === null); assert(document.activeElement === installButton()); });
    await test('native Escape closes confirmation with safe keep behavior', async () => { await start('circular'); await key('Escape'); await until(() => !browser.getState().busy); assert(!q('dialog').open); assert(await activeId() === 'linear-demo'); });
    await test('explicit Replace activates replacement and removes old package', async () => { await start('circular'); await confirm(); const a = await storage.getActive(); assert(a.save.adventure.id === 'circular-demo'); assert(!a.files['scenarios.json']); assert((await backend.read()).staging === null); assert(!host.textContent.includes('My Downloads')); });
    await test('failed download preserves active package and exact save', async () => { const before = JSON.stringify((await storage.getActive()).save); downloadMode = 'network'; await start('linear'); assert(progress().includes('offline')); assert(JSON.stringify((await storage.getActive()).save) === before); assert(!q('[data-action="install-retry"]').hidden); downloadMode = 'normal'; });
    await test('double click starts one preparation and cancellation ignores a late result', async () => {
      await browser.back(); open('linear'); downloadMode = 'late'; const beforeCalls = calls; resolveLate = null;
      installButton().click(); installButton().click(); await until(() => resolveLate); assert(calls === beforeCalls + 1);
      assert(progress().includes('Downloading')); assert(progress().includes('bytes')); assert(q('progress').hasAttribute('aria-label'));
      await browser.back(); resolveLate(); downloadMode = 'normal'; await wait(50);
      assert(browser.getState().selectedId === null); assert(await activeId() === 'circular-demo'); assert(!q('dialog').open);
    });
    await test('stale revision fails safely and never shows success', async () => {
      await start('linear'); const snap = await storage.snapshot(); snap.active.save.flags.unlockedAreas.push('saved-during-confirmation'); await storage.updateSave(snap.active.save, snap.revision);
      await confirm(); assert(progress().includes('progress changed')); assert(!progress().includes('installed and available')); assert(await activeId() === 'circular-demo');
    });
    await test('failed commit does not show success or delete current save', async () => { await start('linear'); commitFault = true; await confirm(); commitFault = false; assert(progress().includes('not enough browser storage')); assert(await activeId() === 'circular-demo'); });
    await test('completed save follows Stage 8 policy without extra warning', async () => { const snap = await storage.snapshot(); snap.active.save.completed = true; await storage.updateSave(snap.active.save, snap.revision); await start('non-linear'); assert(!q('dialog').open); assert(await activeId() === 'non-linear-demo'); assert(q('.ab-details').textContent.includes('Main navigation: Objectives')); });
    await test('closing during activation allows atomic commit to finish and reopening reads actual state', async () => {
      await start('linear'); holdCommit = true; resolveCommit = null; q('[data-action="replace"]').click(); await until(() => resolveCommit);
      assert(browser.getState().committing); await browser.destroy(); assert(!q('.ab')); holdCommit = false; resolveCommit();
      await until(() => !browser.getState().committing); await mount(); assert(await activeId() === 'linear-demo'); assert(q('.ab-current').textContent.includes('linear demo'));
    });
    await test('installed local cover uses a cached blob URL and cleanup revokes it', async () => {
      const files = await QRCQAdventureDownloader.extractAdventurePackage(bytes.linear), m = JSON.parse(new TextDecoder().decode(files['manifest.json'])); m.cover = 'images/map.png';
      files['manifest.json'] = new TextEncoder().encode(JSON.stringify(m)); invalidBytes = makeZip(files);
      catalog.adventures[0].packageSize = invalidBytes.length; catalog.adventures[0].sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', invalidBytes))].map(n => n.toString(16).padStart(2, '0')).join('');
      await browser.refreshCatalog(); downloadMode = 'validation'; await start('linear'); await confirm();
      await until(() => q('.ab-current img'), 'waiting for installed local cover');
      assert(q('.ab-current img').src.startsWith('blob:')); await q('.ab-current img').decode();
      let revoked = 0; const originalRevoke = URL.revokeObjectURL.bind(URL); URL.revokeObjectURL = url => { revoked++; originalRevoke(url); };
      try { await browser.refreshActive(); assert(revoked > 0); await browser.destroy(); assert(revoked >= 2); }
      finally { URL.revokeObjectURL = originalRevoke; }
      downloadMode = 'normal'; catalog = structuredClone(fixture); await mount();
    });
    await test('reopening reads true persisted active state with network blocked', async () => { catalogMode = 'network'; await mount(); assert(q('.ab-current').textContent.includes('linear demo')); assert(q('.ab-current').textContent.includes('available offline')); assert((await storage.getAsset('game-data.json')).length > 0); catalogMode = 'normal'; await browser.refreshCatalog(); });
    await test('phone-sized component has no horizontal overflow and labeled controls', () => { assert(host.scrollWidth <= 390, String(host.scrollWidth)); assert(q('.ab').getBoundingClientRect().width <= 390); assert(all('.ab-filters input,.ab-filters select').every(input => input.closest('label'))); assert(q('.ab-progress [role="status"]')); });
    await test('Hungarian interface leaves English adventure content unchanged', async () => { await mount({ locale: 'hu' }); assert(q('h1').textContent === 'Válassz kalandot'); assert(host.textContent.includes('Adventure language: en')); assert(cards()[0].textContent.includes('linear demo')); });
    await test('failed cover image is removed and placeholder remains', async () => {
      await mount({ dependencies: { resolveCover: () => 'data:image/png;base64,AAAA' } }); await until(() => !q('.ab-card img'));
      assert(q('.ab-card .ab-art').dataset.placeholder === 'true');
    });
    await test('cleanup cancels pending catalog and removes mounted UI', async () => { catalogMode = 'late'; const pending = browser.refreshCatalog(); await until(() => resolveLate); await browser.destroy(); resolveLate(); await pending; assert(!host.querySelector('.ab')); assert(browser.getState().destroyed); catalogMode = 'normal'; });
    await test('no legacy live save is touched', () => { assert(localStorage.getItem('qr-city-quest-save-v1') === null); });
    await browser.destroy(); await storage.close();
    const frame = document.createElement('iframe'); frame.style.width = '390px'; frame.style.height = '1000px';
    await new Promise(resolve => { frame.onload = resolve; frame.src = '../adventure-system/adventure-browser-tester.html'; document.body.appendChild(frame); });
    let doc = frame.contentDocument;
    await until(() => doc.querySelectorAll('.ab-card').length === 3);
    await test('actual standalone tester mounts real component in clearly labeled Demo Mode', () => { assert(doc.getElementById('mode-description').textContent.includes('not published')); assert(doc.querySelectorAll('.ab-card').length === 3); });
    await test('standalone tester phone viewport does not overflow', () => assert(doc.documentElement.scrollWidth <= 390, String(doc.documentElement.scrollWidth)));
    await test('wide-screen tester uses a two-column card grid', async () => { frame.style.width = '1000px'; await wait(30); assert(frame.contentWindow.getComputedStyle(doc.querySelector('.ab-cards')).gridTemplateColumns.split(' ').length === 2); frame.style.width = '390px'; });
    doc.querySelector('[data-action="details"]').click(); doc.querySelector('[data-action="install"]').click();
    await until(() => doc.querySelector('.ab-progress').textContent.includes('installed and available offline') && doc.querySelector('.ab-current').textContent.includes('linear demo'));
    await test('actual Demo Mode installs real local package through Stage 7/8', () => assert(doc.querySelector('.ab-current').textContent.includes('linear demo')));
    await new Promise(resolve => { frame.onload = resolve; frame.contentWindow.location.reload(); }); doc = frame.contentDocument;
    await until(() => doc.querySelectorAll('.ab-card').length === 3);
    await test('standalone tester reload retains installed adventure', () => assert(doc.querySelector('.ab-current').textContent.includes('linear demo')));
    doc.getElementById('offline').checked = true; doc.getElementById('offline').dispatchEvent(new frame.contentWindow.Event('change'));
    await until(() => !doc.querySelector('[data-action="catalog-retry"]').hidden);
    await test('standalone offline catalog simulation keeps active state visible', () => assert(doc.querySelector('.ab-current').textContent.includes('linear demo')));
    doc.getElementById('offline').checked = false; doc.getElementById('offline').dispatchEvent(new frame.contentWindow.Event('change')); await until(() => doc.querySelectorAll('.ab-card').length === 3);
    doc.querySelector('[data-adventure-id="circular-demo"] [data-action="details"]').click(); doc.getElementById('fail-download').checked = true; doc.querySelector('[data-action="install"]').click();
    await until(() => doc.querySelector('.ab-progress').textContent.includes('offline'));
    await test('standalone simulated download failure retains active adventure', () => assert(doc.querySelector('.ab-current').textContent.includes('linear demo')));
    doc.getElementById('fail-download').checked = false; doc.querySelector('[data-action="install-retry"]').click(); await until(() => doc.querySelector('dialog').open);
    doc.querySelector('[data-action="keep"]').click(); await until(() => !doc.querySelector('dialog').open);
    await test('standalone tester keeps current adventure on replacement cancellation', () => assert(doc.querySelector('.ab-current').textContent.includes('linear demo')));
    doc.querySelector('[data-action="install"]').click(); await until(() => doc.querySelector('dialog').open); doc.querySelector('[data-action="replace"]').click();
    await until(() => doc.querySelector('.ab-current').textContent.includes('circular demo'));
    await test('standalone explicit confirmation installs replacement', () => assert(doc.querySelector('.ab-current').textContent.includes('available offline')));
    frame.remove();
  } catch (e) { failed++; lines.push(`FAIL harness: ${e.stack}`); }
  finally { await browser?.destroy(); await storage?.close(); }
  document.getElementById('results').textContent = lines.join('\n') + `\nBROWSER: ${passed} passed; ${failed} failed; complete`;
})();
