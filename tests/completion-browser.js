'use strict';
(async () => {
  const el = id => document.getElementById(id);
  const phaseKey = 'qrcq-stage10-browser-phase';
  const phase = sessionStorage.getItem(phaseKey);
  const counts = phase ? JSON.parse(sessionStorage.getItem('qrcq-stage10-results')) : { passed: 0, failed: 0, log: [] };
  const assert = (value, message = 'Assertion failed') => { if (!value) throw Error(message); };
  async function test(label, operation) {
    try { await operation(); counts.passed++; counts.log.push('PASS ' + label); }
    catch (error) { counts.failed++; counts.log.push('FAIL ' + label + ': ' + error.message); }
    el('results').textContent = counts.log.join('\n');
  }
  const wait = async condition => {
    for (let i = 0; i < 100; i++) {
      if (condition()) return;
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    throw Error('Timed out waiting for the UI');
  };
  const key = async name => {
    window.__browserKeyRequest = { key: name };
    await wait(() => window.__browserKeyRequest.done);
  };
  const reload = next => {
    sessionStorage.setItem('qrcq-stage10-results', JSON.stringify(counts));
    sessionStorage.setItem(phaseKey, next);
    location.reload();
  };
  let abort = false;
  const backend = QRCQAdventureStorage.createIndexedDBBackend({ name: 'qrcq-stage10-browser-suite' });
  const storage = QRCQAdventureStorage.createAdventureStorage({ backend: { ...backend, transact: fn =>
    backend.transact(state => { const result = fn(state); if (abort) { abort = false; throw Error('Test transaction abort'); } return result; })
  } });
  async function install(type, name) {
    const response = await fetch(`../adventure-system/samples/packages/${type}.zip`);
    const files = await QRCQAdventureZip.extractAdventurePackage(new Uint8Array(await response.arrayBuffer()));
    if (name) {
      const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
      manifest.name = name;
      files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
    }
    const staged = await storage.stage({ files }, await storage.snapshot());
    return storage.commit(staged.token, { confirmed: true });
  }
  const open = async () => {
    const result = await QRCQAdventureCompletion.createCompletionEngine({ storage });
    assert(result.ok, result.code);
    return result.engine;
  };
  const choose = (engine, qr, index = 1) => engine.choose(engine.scan(qr), index);
  const mount = options => QRCQAdventureVictory.mountVictory({ container: el('victory'), storage, ...options });
  const select = selector => el('victory').querySelector(selector);
  const button = label => [...el('victory').querySelectorAll('button')].find(node => node.textContent === label);
  let ui;
  try {
    if (new URL(location.href).searchParams.has('restart')) {
      await test('a new browser process reopens the same completed IndexedDB save', async () => {
        const victory = (await open()).getCompletionSummary();
        assert(victory.completed && victory.adventureType === 'non-linear');
      });
      await storage.close();
      el('results').textContent = counts.log.join('\n') + `\nBROWSER: ${counts.passed} passed; ${counts.failed} failed; complete`;
      return;
    }
    if (!phase) {
      await test('all three local ZIPs install and win through real IndexedDB', async () => {
        await install('linear');
        let engine = await open();
        for (const qr of ['02', '01', '03']) {
          assert(engine.scan(qr).ok);
          assert((await engine.confirmCheckpoint()).ok);
        }
        assert((await choose(engine, '04')).completed);
        await install('circular');
        engine = await open();
        assert((await choose(engine, '02')).code === 'CONDITION_NOT_MET');
        engine.scan('03');
        engine.scan('01');
        assert((await choose(engine, '02')).completed);
        await install('non-linear', '<img src=x onerror=alert(1)>');
        engine = await open();
        assert((await choose(engine, '01')).ok);
        assert(engine.getProgress().inventory.includes('Token'));
      });
      await test('a separate IndexedDB connection prevents stale victory from overwriting progress', async () => {
        const stale = await open();
        const other = QRCQAdventureStorage.createAdventureStorage({ name: 'qrcq-stage10-browser-suite' });
        try {
          const { active, revision } = await other.snapshot();
          await other.updateSave({ ...active.save, knowledge: ['Newer progress'] }, revision);
          assert((await choose(stale, '02')).code === 'STALE_TRANSITION');
          assert((await storage.getActive()).save.knowledge.includes('Newer progress'));
          assert(!(await storage.getActive()).save.completed);
        } finally { await other.close(); }
      });
      const engine = await open();
      await choose(engine, '01');
      await test('aborted real victory transaction preserves revision and keeps victory hidden', async () => {
        const before = await storage.snapshot();
        abort = true;
        assert(!(await choose(engine, '02')).ok);
        assert((await storage.snapshot()).revision === before.revision);
        assert(!(await mount()).ok && !select('h1'));
      });
      await test('retry persists victory and one active package/save', async () => {
        assert((await engine.flush()).completed);
        const state = await backend.read();
        assert(state.active.save.completed && state.staging === null);
        assert(Object.keys(state).sort().join(',') === 'active,revision,staging,storageVersion');
      });
      await storage.close();
      reload('victory');
      return;
    }
    if (phase === 'victory') {
      await test('real document reload preserves victory timestamp, visits and quest', async () => {
        const summary = (await open()).getCompletionSummary();
        assert(summary.completed && summary.completedAt && summary.distinctVisited === 2 && summary.finishedQuests === 1);
      });
      await test('English victory uses safe text and opens the summary with keyboard', async () => {
        ui = await mount();
        assert(select('h1').textContent === 'Adventure Complete!');
        assert(el('victory').textContent.includes('<img src=x onerror=alert(1)>') && !select('img'));
        assert(document.activeElement === select('h1'));
        await key('Tab');
        assert(document.activeElement === select('summary'));
        await key('Enter');
        assert(select('details').open && select('dl').textContent.includes('Quests finished'));
      });
      await test('keyboard replay prompts, focuses Cancel, and Escape preserves the save', async () => {
        const baseline = await storage.snapshot();
        await key('Tab');
        assert(document.activeElement === button('Replay Adventure'));
        await key('Enter');
        assert(select('dialog').open && document.activeElement === button('Cancel'));
        await key('Escape');
        await wait(() => !select('dialog').open);
        assert((await storage.snapshot()).revision === baseline.revision);
      });
      await test('Back destroys handlers and returns to browser; Hungarian labels work', async () => {
        ui.destroy();
        let returned = 0;
        ui = await mount({ locale: 'hu-HU', onBack: () => returned++ });
        assert(select('h1').textContent === 'Kaland teljesítve!');
        const back = button('Vissza a kalandokhoz');
        back.click();
        back.click();
        assert(returned === 1 && !select('h1'));
      });
      await test('phone-width iframe has no horizontal overflow', async () => {
        const frame = document.createElement('iframe');
        frame.width = '390';
        frame.height = '640';
        document.body.append(frame);
        try {
          const doc = frame.contentDocument;
          const css = doc.createElement('link');
          css.rel = 'stylesheet'; css.href = '../adventure-system/adventure-victory.css';
          const loaded = new Promise((resolve, reject) => { css.onload = resolve; css.onerror = reject; });
          doc.head.append(css);
          await loaded;
          const mounted = await QRCQAdventureVictory.mountVictory({ container: doc.body, storage, locale: 'hu' });
          assert(mounted.ok);
          assert(doc.defaultView.innerWidth === 390 && doc.documentElement.scrollWidth <= 390);
          assert(doc.querySelector('button').getBoundingClientRect().height >= 44);
          mounted.destroy();
        } finally { frame.remove(); }
      });
      await test('Stage 9 refresh reports completed while catalog requests fail', async () => {
        const browser = QRCQAdventureBrowser.createAdventureBrowser({ container: el('browser'), storage,
          dependencies: { catalogFetch() { throw Error('Network unavailable'); } } });
        try {
          await browser.ready;
          await browser.refreshActive();
          assert(el('browser').querySelector('.ab-save-status').textContent === QRCQAdventureBrowser.EN.completed);
        } finally { await browser.destroy(); }
      });
      await test('failed replay leaves victory visible and its package intact', async () => {
        ui = await mount();
        const baseline = await storage.snapshot();
        button('Replay Adventure').click();
        abort = true;
        button('Reset and replay').click();
        await wait(() => select('.av-status').textContent.includes('could not'));
        assert((await storage.snapshot()).revision === baseline.revision);
        assert(!!select('h1'));
      });
      await test('offline local access works across a closed and reopened IndexedDB connection', async () => {
        const originalFetch = window.fetch;
        window.fetch = () => Promise.reject(Error('Offline simulation'));
        try {
          await storage.close();
          assert((await open()).getCompletionSummary().completed);
          assert((await storage.getActive()).save.inventory.includes('Token'));
        } finally { window.fetch = originalFetch; }
      });
      await test('confirmed replay atomically resets progress and keeps installed bytes', async () => {
        const baseline = (await storage.snapshot()).active;
        button('Replay Adventure').click();
        button('Reset and replay').click();
        await wait(() => !select('h1'));
        const { adventure, files, save } = await storage.getActive();
        assert(adventure.manifest.name === baseline.adventure.manifest.name);
        assert(Object.keys(files).every(name => String(files[name]) === String(baseline.files[name])));
        assert(!save.completed && !save.scenarioFinished && save.encounterHistory.distinctVisited === 0 && !save.inventory.length);
      });
      await storage.close();
      reload('replay');
      return;
    }
    await test('real reload after replay stays reset and cannot mount victory', async () => {
      assert(!(await open()).getCompletionStatus().completed);
      assert(!(await mount()).ok);
    });
    await test('older completed saves without a timestamp still render', async () => {
      const { active, revision } = await storage.snapshot();
      await storage.updateSave({ ...active.save, completed: true }, revision);
      ui = await mount();
      assert(ui.ok && !select('dl').textContent.includes('Completed'));
      ui.destroy();
    });
    await test('standalone tester loads, installs and drives a real ending while network is toggled off', async () => {
      const frame = document.createElement('iframe');
      frame.src = '../adventure-system/completion-tester.html';
      document.body.append(frame);
      try {
        const get = id => frame.contentDocument?.getElementById(id);
        await wait(() => get('status')?.textContent === 'NO_ACTIVE_ADVENTURE');
        get('sample').value = 'non-linear';
        get('install').click();
        await wait(() => get('status').textContent === 'Ready.');
        get('offline').click();
        get('qr').value = '02';
        get('scan-form').requestSubmit();
        await wait(() => get('interaction').querySelector('button'));
        get('interaction').querySelector('button').click();
        await wait(() => get('victory-screen').querySelector('h1')?.textContent === 'Adventure Complete!');
      } finally { frame.remove(); }
    });
  } catch (error) {
    counts.failed++;
    counts.log.push(error.stack);
  }
  await storage.close();
  el('results').textContent = counts.log.join('\n') + `\nBROWSER: ${counts.passed} passed; ${counts.failed} failed; complete`;
})();
