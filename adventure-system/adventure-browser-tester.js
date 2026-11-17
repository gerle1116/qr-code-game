'use strict';
(async () => {
  const el = id => document.getElementById(id);
  const storage = QRCQAdventureStorage.createAdventureStorage({ name: 'qrcq-stage9-adventure-browser-tester-v1' });
  let browser, mountSeq = 0;
  const sampleURL = 'https://example.invalid/stage9-demo-catalog.json';
  async function transport(address, options, catalog = false) {
    if (el('offline').checked || (!catalog && el('fail-download').checked)) throw Error('TEST: simulated offline/network error.');
    const demo = el('mode').value === 'demo';
    if (!demo) return fetch(address, options);
    let local;
    if (catalog && address === sampleURL) local = 'samples/packages/catalog.json';
    else {
      const match = /^https:\/\/example\.invalid\/(linear|circular|non-linear)\.zip$/.exec(address);
      if (!match) throw Error('Unexpected demo package URL.'); local = `samples/packages/${match[1]}.zip`;
      await new Promise((resolve, reject) => {
        const stop = () => { clearTimeout(timer); reject(Error('Test download cancelled.')); };
        const timer = setTimeout(() => { options.signal.removeEventListener('abort', stop); resolve(); }, 200);
        if (options.signal.aborted) stop(); else options.signal.addEventListener('abort', stop, { once: true });
      });
    }
    const response = await fetch(local, { ...options, redirect: 'error' });
    // Adapt only the transport; Stage 7/8 still parse, validate and verify actual bytes.
    return { ok: response.ok, status: response.status, headers: response.headers, body: response.body,
      text: () => response.text(), arrayBuffer: () => response.arrayBuffer() };
  }
  async function mount() {
    const seq = ++mountSeq; await browser?.destroy(); if (seq !== mountSeq) return;
    const demo = el('mode').value === 'demo';
    el('mode-description').textContent = demo ? 'Demo Mode uses local sample ZIPs with real checksums. These samples are not published adventures.' :
      'Real development GitHub catalog. It may be empty; no demo entries are added to it.';
    el('tester-status').textContent = 'Isolated tester storage: qrcq-stage9-adventure-browser-tester-v1. Live saves are never accessed.';
    browser = QRCQAdventureBrowser.createAdventureBrowser({ container: el('browser'), storage,
      catalogURL: demo ? sampleURL : QRCQAdventureCatalog.DEVELOPMENT_CATALOG_URL, locale: el('locale').value,
      dependencies: { catalogFetch: (url, options) => transport(url, options, true), downloadFetch: (url, options) => transport(url, options),
        resolveCover: entry => demo ? null : entry.coverUrl } });
    await browser.ready;
  }
  el('mode').onchange = el('locale').onchange = () => mount().catch(e => { el('tester-status').textContent = e.message; });
  // Toggling failure controls affects subsequent requests without recovering staging mid-operation.
  el('offline').onchange = () => { browser.refreshCatalog(); };
  window.addEventListener('pagehide', () => { browser?.destroy(); });
  try { await mount(); } catch (e) { el('tester-status').textContent = `Could not start the tester: ${e.message}. Use the local HTTP server.`; }
})();
