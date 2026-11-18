'use strict';
(() => {
  const el = id => document.getElementById(id);
  const name = 'qrcq-stage10-completion-tester-v1';
  const backend = QRCQAdventureStorage.createIndexedDBBackend({ name });
  const storage = QRCQAdventureStorage.createAdventureStorage({ backend: {
    ...backend,
    transact(fn) {
      return backend.transact(state => {
        const result = fn(state);
        if (el('fail').checked) {
          el('fail').checked = false;
          throw Object.assign(Error('Developer control aborted the IndexedDB transaction.'), { code: 'TEST_ABORT' });
        }
        return result;
      });
    }
  } });
  const catalogURL = 'https://example.invalid/stage10-demo-catalog.json';
  async function transport(address, options) {
    if (el('offline').checked) throw Error('Tester network requests are blocked.');
    const match = /^https:\/\/example\.invalid\/(linear|circular|non-linear)\.zip$/.exec(address);
    if (!match && address !== catalogURL) throw Error('Unknown local sample.');
    const file = match ? `${match[1]}.zip` : 'catalog.json';
    const response = await fetch(`samples/packages/${file}`, { ...options, redirect: 'error' });
    return { ok: response.ok, status: response.status, headers: response.headers, body: response.body,
      text: () => response.text(), arrayBuffer: () => response.arrayBuffer() };
  }
  let engine, victory, view, busy = false;
  const browser = QRCQAdventureBrowser.createAdventureBrowser({ container: el('browser'), storage, catalogURL,
    dependencies: { catalogFetch: transport, downloadFetch: transport, resolveCover: () => null } });

  function draw() {
    el('progress').textContent = engine ? JSON.stringify({ status: engine.getCompletionStatus(), save: engine.getProgress() }, null, 2) : '';
    const interaction = el('interaction');
    interaction.replaceChildren();
    if (!view) return;
    const { page } = view;
    const opened = view;
    const text = document.createElement('p');
    text.textContent = `${page.speaker} · ${page.text}`;
    interaction.append(text);
    for (const choice of page.buttons) {
      const button = document.createElement('button');
      button.textContent = choice.label;
      button.disabled = !opened.ok;
      button.onclick = () => run(() => engine.choose(opened, choice.index));
      interaction.append(button);
    }
  }
  async function load() {
    victory?.destroy();
    el('controls').hidden = false;
    const opened = await QRCQAdventureCompletion.createCompletionEngine({ storage });
    engine = opened.engine;
    view = null;
    await browser.refreshActive();
    return opened.ok ? engine.getCompletionStatus() : opened;
  }
  async function openVictory() {
    victory?.destroy();
    const opened = await QRCQAdventureVictory.mountVictory({ container: el('victory-screen'), storage,
      locale: el('locale').value,
      onBack() { el('controls').hidden = false; el('victory').focus(); browser.refreshActive(); },
      onReplay() { run(load).then(() => el('qr').focus()); }
    });
    if (opened.ok) {
      victory = opened;
      el('controls').hidden = true;
    }
    return opened;
  }
  async function run(operation) {
    if (busy) return;
    busy = true;
    el('controls').disabled = true;
    try {
      const result = await operation();
      if (result.page || result.code === 'DIALOGUE_CLOSED' || result.completed) view = result.page ? result : null;
      const status = result.code || (result.completed ? 'Victory saved.' : 'Ready.');
      el('status').textContent = status;
      if (result.completed) { await browser.refreshActive(); await openVictory(); }
    } catch (error) { el('status').textContent = error.message; }
    finally { busy = false; el('controls').disabled = false; draw(); }
  }
  el('load').onclick = () => run(load);
  el('install').onclick = () => run(async () => {
    const baseline = await storage.snapshot();
    if (baseline.active && !window.confirm('Replace the current isolated test save?')) return { code: 'Cancelled.' };
    el('fail').checked = false;
    const response = await transport(`https://example.invalid/${el('sample').value}.zip`);
    if (!response.ok) throw Error('Sample ZIP could not be loaded.');
    const files = await QRCQAdventureZip.extractAdventurePackage(new Uint8Array(await response.arrayBuffer()));
    const staged = await storage.stage({ files }, baseline);
    await storage.commit(staged.token, { confirmed: true });
    return load();
  });
  el('scan-form').onsubmit = event => {
    event.preventDefault();
    run(() => { view = null; return engine?.scan(el('qr').value) || { code: 'Open or install a sample first.' }; });
  };
  el('checkpoint').onclick = () => run(async () => {
    const result = await engine?.confirmCheckpoint();
    if (result?.ok) view = null;
    return result || { code: 'Open or install a sample first.' };
  });
  el('save').onclick = () => run(() => engine?.flush() || { code: 'Open or install a sample first.' });
  el('victory').onclick = () => run(openVictory);
  el('offline').onchange = () => browser.refreshCatalog();
  el('stale').onclick = () => run(async () => {
    const other = QRCQAdventureStorage.createAdventureStorage({ name });
    try {
      const { active, revision } = await other.snapshot();
      if (!active) return { code: 'Install a sample first.' };
      await other.updateSave(active.save, revision);
      return { code: 'Stored revision advanced. Try saving from the open session.' };
    } finally { await other.close(); }
  });
  browser.ready.then(() => run(load));
})();
