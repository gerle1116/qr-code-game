'use strict';
(async () => {
  const el = id => document.getElementById(id);
  const storage = QRCQAdventureStorage.createAdventureStorage({ name: 'qrcq-stage8-installation-tester-v1' });
  let entries = [], pending = null, controller, renderer, assets, busy = false;
  const status = text => { el('status').textContent = text; };
  function controls() { el('prepare').disabled = el('fail').disabled = busy || !entries.length; el('cancel').disabled = !busy && !pending; el('activate').disabled = !pending || busy; }
  async function showActive() {
    renderer?.destroy(); assets?.dispose(); renderer = assets = null;
    const snapshot = await storage.snapshot(), active = snapshot.active;
    el('active').textContent = active ? JSON.stringify({ id: active.adventure.manifest.id, version: active.adventure.manifest.version,
      type: active.adventure.manifest.type, revision: snapshot.revision, saveAdventure: active.save.adventure,
      completed: active.save.completed, inventory: active.save.inventory, storedFiles: Object.keys(active.files) }, null, 2) : 'Built-in default available; no downloadable adventure or tester save installed.';
    if (active?.adventure.manifest.map) {
      assets = await storage.createAssetLoader();
      const result = QRCQMapRenderer.createMapRenderer({ container: el('map'), adventure: assets.adventure, resolveAsset: assets.resolveAsset });
      if (result.ok) renderer = result.renderer;
    }
  }
  async function prepare(simulateFailure = false) {
    if (busy) return;
    if (pending) { await pending.cancel(); pending = null; }
    busy = true; controller = new AbortController(); controls(); el('warning').textContent = ''; el('progress').textContent = '';
    try {
      const selected = entries[Number(el('sample').value)];
      const result = await QRCQAdventureDownloader.prepareAdventureInstallation(selected, {
        storage, signal: controller.signal,
        fetch: async (url, options) => {
          if (el('offline').checked) throw Error('TEST: simulated offline mode.');
          if (simulateFailure) throw Error('TEST: simulated network failure.');
          // Fixture HTTPS URLs are intentionally mapped to local, real sample ZIP bytes.
          if (url !== selected.downloadUrl) throw Error('Unexpected fixture request.');
          await new Promise((resolve, reject) => {
            const stop = () => { clearTimeout(timer); reject(Error('Cancelled test download.')); };
            const timer = setTimeout(() => { options.signal.removeEventListener('abort', stop); resolve(); }, 350);
            options.signal.addEventListener('abort', stop, { once: true });
          });
          return fetch(`samples/packages/${selected.type}.zip`, { ...options, redirect: 'error' }).then(async response => {
            // A local injected response exposes only bytes/status, not its HTTP URL as a remote download target.
            return { ok: response.ok, status: response.status, headers: response.headers, body: response.body };
          });
        },
        onProgress(event) { el('progress').textContent += `${event.phase}${event.received !== undefined ? ` ${event.received}/${event.total}` : ''}\n`; }
      });
      if (result.ok) {
        pending = result.installation;
        el('warning').textContent = pending.warning?.message || 'Ready to create a fresh save. No unfinished tester save will be replaced.';
        status('Prepared. Review the warning, then explicitly activate or cancel.');
      } else status(`${simulateFailure ? 'SIMULATED FAILURE — ' : ''}${result.code}: ${result.message} ${(result.errors || []).join('; ')}`);
    } catch (e) { status(e.message); }
    finally { busy = false; controls(); await showActive(); }
  }
  el('prepare').onclick = () => prepare(); el('fail').onclick = () => prepare(true);
  el('cancel').onclick = async () => {
    controller?.abort(); if (pending) { await pending.cancel(); pending = null; }
    el('warning').textContent = ''; status('Installation cancelled; previous state retained.'); controls(); await showActive();
  };
  el('activate').onclick = async () => {
    if (!pending || busy) return; busy = true; controls();
    const result = await pending.commit({ confirmed: true }); // This separate button is the explicit confirmation.
    if (result.ok) { pending = null; el('warning').textContent = ''; status('Installation complete. Reload to verify persistence.'); }
    else status(`${result.code}: ${result.message}`);
    busy = false; controls(); await showActive();
  };
  el('refresh').onclick = () => showActive().catch(e => status(e.message));
  el('offline').onchange = () => showActive().catch(e => status(e.message));
  el('clear').onclick = async () => {
    if (busy) return; if (pending) await pending.cancel(); pending = null;
    await storage.clear({ confirmed: true }); el('warning').textContent = ''; status('Isolated tester data cleared.'); controls(); await showActive();
  };
  window.addEventListener('pagehide', () => { renderer?.destroy(); assets?.dispose(); storage.close(); });
  try {
    await storage.recover(); await showActive();
    const response = await fetch('samples/packages/catalog.json', { cache: 'no-store' });
    const result = QRCQAdventureCatalog.validateCatalog(await response.json()); if (!result.ok) throw Error(result.message);
    entries = result.catalog.adventures;
    entries.forEach((entry, index) => { const option = document.createElement('option'); option.value = index; option.textContent = `${entry.type}: ${entry.name} (${entry.packageSize} bytes)`; el('sample').appendChild(option); });
    el('sample').disabled = false; status('Ready. Sample ZIP sizes and SHA-256 values are generated from the existing Stage 1 samples.'); controls();
  } catch (e) { status(`Tester could not start: ${e.message}. Use the local development server.`); }
})();
