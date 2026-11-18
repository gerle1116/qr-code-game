'use strict';
(async () => {
  const results = document.getElementById('results');
  const legacyKey = 'qr-city-quest-save-v1';
  const langKey = 'qr-city-quest-language-v1';
  const backup = JSON.stringify({ schemaVersion: 1, inventory: ['Sweets'], knowledge: [], quests: {},
    encounters: {}, timers: {}, itemTimers: {}, flags: { castleOpen: false, unlockedAreas: [] },
    itemState: { counters: { 'Fishing Rod::salmonCaught': 2 }, usedButtons: {}, oneTimeRewards: {} } });
  let passed = 0, failed = 0, frame;
  const log = [];
  const check = (value, message = 'assertion failed') => { if (!value) throw Error(message); };
  const update = () => { results.textContent = log.join('\n'); };
  async function test(name, run) {
    try { await run(); passed++; log.push('PASS ' + name); }
    catch (error) { failed++; log.push('FAIL ' + name + ' — ' + error.message); }
    update();
  }
  const win = () => frame.contentWindow;
  const doc = () => frame.contentDocument;
  const find = selector => doc()?.querySelector(selector);
  async function wait(condition, attempts = 160) {
    for (let i = 0; i < attempts; i++) {
      const result = condition();
      if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 35));
    }
    throw Error('Timed out on ' + (doc()?.getElementById('app')?.textContent.trim().replace(/\s+/g, ' ').slice(0, 200) || 'loading'));
  }
  async function click(selector) { (await wait(() => find(selector))).click(); }
  async function home() {
    for (let i = 0; i < 4 && !find('#scanBtn'); i++) await click('#backBtn');
    await wait(() => find('#scanBtn'));
  }
  async function launch(path = '/index.html', ready = '#scanBtn, .av-victory h1') {
    frame?.remove();
    frame = document.createElement('iframe');
    frame.width = '390';
    frame.height = '700';
    frame.src = path;
    document.body.append(frame);
    await wait(() => find(ready));
  }
  const snapshot = () => win().QRCQ_ACTIVE_SESSION.storage.snapshot();
  async function openAdventures() {
    const localFetch = async (address, options) => {
      const url = String(address);
      let file;
      if (url === win().QRCQAdventureCatalog.DEVELOPMENT_CATALOG_URL) file = 'catalog.json';
      else file = /^https:\/\/example\.invalid\/(linear|circular|non-linear)\.zip$/.exec(url)?.[0].split('/').at(-1);
      if (!file) throw Error('External catalog asset unavailable in integration tests.');
      const response = await fetch('/adventure-system/samples/packages/' + file, options);
      return { ok: response.ok, status: response.status, headers: response.headers, body: response.body,
        text: () => response.text(), arrayBuffer: () => response.arrayBuffer() };
    };
    win().fetch = localFetch;
    await click('#adventuresBtn');
    await wait(() => find('.ab-card'));
  }
  async function install(id, { cancelFirst = false, prompt = false } = {}) {
    await openAdventures();
    const choose = async () => {
      await click(`[data-adventure-id="${id}"] [data-action="details"]`);
      await click('[data-action="install"]');
    };
    await choose();
    if (cancelFirst) {
      const before = JSON.stringify(await snapshot());
      const cancel = await wait(() => find('.ab-dialog[open] button:not([data-action="replace"])'));
      cancel.click();
      await wait(() => !find('.ab-dialog[open]'));
      check(JSON.stringify(await snapshot()) === before, 'cancel changed stored data');
      if (!find('.ab-browse').hidden) await choose();
      else await click('[data-action="install"]');
    }
    if (prompt || cancelFirst) await click('.ab-dialog[open] [data-action="replace"]');
    await wait(() => find('#scanBtn') && win().QRCQ_ACTIVE_SESSION.active.adventure.manifest.id === id);
  }
  async function scan(qr) {
    await click('#scanBtn');
    const input = await wait(() => find('#manual-qr'));
    input.value = qr;
    input.form.requestSubmit();
    await wait(() => !find('#manual-qr'));
  }
  async function continueDialogue() { await click('#active-dialogue .choice-btn'); await wait(() => find('#scanBtn, .av-victory h1')); }
  async function replay() {
    const buttons = () => [...doc().querySelectorAll('.av-victory button')];
    buttons().find(button => button.textContent === 'Replay Adventure').click();
    await wait(() => find('.av-victory dialog[open]'));
    buttons().find(button => button.textContent === 'Cancel').click();
    check((await snapshot()).active.save.completed);
    buttons().find(button => button.textContent === 'Replay Adventure').click();
    buttons().find(button => button.textContent === 'Reset and replay').click();
    await wait(() => find('#scanBtn'));
    check(!(await snapshot()).active.save.completed);
  }
  const network = async offline => {
    window.__browserNetworkRequest = { offline, done: false };
    await wait(() => window.__browserNetworkRequest.done);
  };

  await test('an older PWA registration and cache exist before the live app upgrade', async () => {
    const registration = await navigator.serviceWorker.register('/tests/integration-old-worker.js', { scope: '/' });
    await wait(() => registration.active?.scriptURL.endsWith('integration-old-worker.js'));
    check(!!await (await caches.open('qr-city-quest-v40')).match('/old-shell-marker'));
  });
  await test('corrupt legacy progress is preserved and startup offers recovery', async () => {
    localStorage.setItem(langKey, 'en');
    localStorage.setItem(legacyKey, 'bad json');
    await launch('/index.html', '#startup-retry');
    check(localStorage.getItem(legacyKey) === 'bad json');
    check(!find('#scanBtn'));
  });
  await test('the live built-in game migrates inventory and counters without writing the backup', async () => {
    localStorage.setItem(legacyKey, backup);
    await launch('/index.html?debug=1');
    check((await snapshot()).active.save.inventory.includes('Sweets'));
    check((await snapshot()).active.save.itemState.counters['Fishing Rod::salmonCaught'] === 2);
    await scan('01');
    check(find('.speaker') && !find('#active-dialogue'), 'original NPC renderer missing');
    check(localStorage.getItem(legacyKey) === backup);
    await click('#backBtn');
  });
  await test('the new worker activates over the old registration and keeps the backup and previous shell', async () => {
    await wait(() => win().navigator.serviceWorker.controller?.scriptURL.endsWith('/sw.js?v=42'), 420);
    check(!!await (await caches.open('qr-city-quest-v40')).match('/old-shell-marker'));
    check(!!await (await caches.open('qr-city-quest-v42')).match('/adventure-system/adventure-completion.js?v=42'));
    check(localStorage.getItem(legacyKey) === backup);
  });
  await test('original physical item scans persist once and namespaced mods still resolve', async () => {
    const item = Object.entries(win().QR_CITY_QUEST_DATA.items).find(([id, data]) => id !== 'Sweets' &&
      data.pages?.[data.startPage] && !data.startPage.includes(':'));
    check(item);
    const [id, data] = item;
    await scan(data.startPage.slice(0, 2));
    check((await snapshot()).active.save.inventory.includes(id));
    await home();
    await scan(data.startPage.slice(0, 2));
    check((await snapshot()).active.save.inventory.filter(value => value === id).length === 1);
    await home();
    const manifest = { id: 'field-test', name: 'Field test', version: '1.0.0', languages: ['en'] };
    const game = { formatVersion: 1, encounters: { '02': { startPage: '0201', pages: {
      '0201': { id: '0201', speaker: 'Field Tester', text: 'A validated expansion.', actions: [],
        buttons: [{ index: 1, label: 'Back', next: 'HOME' }] }
    } } }, items: {}, questDisplayNames: {}, knowledgeFolders: {}, thingsIKnow: {} };
    const js = (name, value) => 'window.' + name + ' = ' + JSON.stringify(value) + ';';
    await win().QRCQModStorage.put({ id: manifest.id, manifest, enabled: true, files: {
      'manifest.js': js('QR_CITY_QUEST_MOD_MANIFEST', manifest),
      'field-test_game_data-en.js': js('QR_CITY_QUEST_DATA', game),
      'field-test_app_data-en.js': js('QR_CITY_QUEST_APP_TEXT', {})
    } });
    await launch('/index.html?debug=1');
    await scan('field-test:02');
    check(find('.speaker').textContent.includes('Field Tester'), 'enabled namespaced mod was not resolved');
    await click('#backBtn');
  });
  await test('the live Adventure Browser verifies ZIP, warns, cancels and activates linear', async () => {
    await install('linear-demo', { cancelFirst: true });
    check(find('#objectivesBtn').getAttribute('aria-label') === 'Map');
    await click('#objectivesBtn');
    await wait(() => find('.qrcq-map img')?.naturalWidth);
    check(find('.qrcq-map img').src.startsWith('blob:'));
    await click('#backBtn');
  });
  await test('linear A blocks the wrong scan, maps QR 02 and persists its authorized ending', async () => {
    await scan('03'); await continueDialogue();
    const before = await snapshot();
    await scan('02');
    check(!find('#active-dialogue') && (await snapshot()).revision === before.revision);
    await click('#backBtn');
    for (const qr of ['01', '04']) { await scan(qr); await continueDialogue(); }
    await scan('02');
    check(find('#active-dialogue .speaker').textContent === 'Wizard');
    await continueDialogue();
    const { active } = await snapshot();
    check(active.save.completed && active.save.scenarioFinished && active.save.scenarioState.scenarioId === 'scenario-a');
  });
  await test('installed victory reloads offline through the production service worker', async () => {
    await win().navigator.serviceWorker.ready;
    await wait(() => win().navigator.serviceWorker.controller);
    await network(true);
    try {
      check(!navigator.onLine, 'Chromium did not enter offline mode');
      await launch();
      check(find('.av-victory h1')?.textContent === 'Adventure Complete!');
      await replay();
      await click('#objectivesBtn');
      await wait(() => find('.qrcq-map img')?.naturalWidth);
      await click('#backBtn');
    } finally { await network(false); }
  });
  await test('linear B preview is read-only and QR 02 maps to its Guard', async () => {
    await scan('02');
    check(find('#active-dialogue .speaker').textContent === 'Guard');
    await continueDialogue();
    const revision = (await snapshot()).revision;
    await scan('04');
    check(find('#active-dialogue').textContent.includes('Read only') && !find('#active-dialogue button'));
    check((await snapshot()).revision === revision);
    await click('#backBtn');
  });
  await test('circular route honors visit conditions and wins without a checkpoint list', async () => {
    await install('circular-demo', { prompt: true });
    await scan('02');
    check(!find('#active-dialogue').textContent.includes('Finish after meeting'));
    await click('#backBtn');
    for (const qr of ['03', '01', '02']) { await scan(qr); if (qr !== '02') await click('#backBtn'); }
    await continueDialogue();
    const { active } = await snapshot();
    check(active.save.completed && active.save.scenarioState === null && active.save.encounterHistory.distinctVisited === 3);
    await click('#backBtn');
  });
  await test('non-linear supports quest and item effects and preserves authored language', async () => {
    await install('non-linear-demo');
    await scan('01');
    await continueDialogue();
    check((await snapshot()).active.save.inventory.includes('Token'));
    localStorage.setItem(langKey, 'hu');
    await launch();
    check(doc().documentElement.lang === 'hu');
    await scan('02');
    check(find('#active-dialogue .speaker').textContent === 'Keeper');
    await continueDialogue();
    check(find('.av-victory h1').textContent === 'Kaland teljesítve!' && (await snapshot()).active.save.quests.greeting === 'completed');
    await click('#backBtn');
  });
  await test('returning to the built-in game starts fresh with the original backup intact', async () => {
    await openAdventures();
    const switchButton = [...doc().querySelectorAll('#adventure-actions button')].at(-1);
    switchButton.click();
    await wait(() => find('#scanBtn') && win().QRCQ_ACTIVE_SESSION.active.kind === 'builtin');
    check(!(await snapshot()).active.save.inventory.length && localStorage.getItem(legacyKey) === backup);
    check((await win().QRCQModStorage.list()).some(mod => mod.id === 'field-test' && mod.enabled));
  });
  await test('an authored timer expires across an offline reload and exposes its dropdown on rescan', async () => {
    localStorage.setItem(langKey, 'en');
    const pageWindow = win();
    const response = await fetch('/adventure-system/samples/packages/non-linear.zip');
    const files = await pageWindow.QRCQAdventureZip.extractAdventurePackage(new pageWindow.Uint8Array(await response.arrayBuffer()));
    const read = name => JSON.parse(new TextDecoder().decode(files[name]));
    const manifest = read('manifest.json');
    manifest.id = 'timer-demo';
    const game = read('game-data.json');
    const pages = game.encounters['01'].pages;
    pages['0102'] = { ...pages['0101'], id: '0102', speaker: 'Timer Guide',
      actions: [{ type: 'DROPDOWN_CHOICE', options: [{ label: 'Return home', next: 'HOME' }] }] };
    pages['0101'].buttons[0].next = '0102';
    pages['0101'].actions.push({ type: 'START_TIMER', durationMs: 1400 }, { type: 'START_ITEM_TIMER', data: 'Token', durationMs: 1800 });
    files['manifest.json'] = new pageWindow.TextEncoder().encode(JSON.stringify(manifest));
    files['game-data.json'] = new pageWindow.TextEncoder().encode(JSON.stringify(game));
    const storage = win().QRCQ_ACTIVE_SESSION.storage;
    const staged = await storage.stage({ files }, await snapshot());
    await storage.commit(staged.token, { confirmed: true });
    await launch();
    await scan('01');
    await continueDialogue();
    const waitUntil = (await snapshot()).active.save.timers['01'].endAt;
    await network(true);
    try {
      await launch();
      await wait(() => Date.now() >= waitUntil);
      await scan('01');
      check(find('#active-dialogue .speaker').textContent === 'Timer Guide');
      check(find('#active-dialogue select').selectedOptions[0].textContent === 'Return home');
      check(!(await snapshot()).active.save.timers['01']);
      check((await snapshot()).active.save.itemTimers.Token.endAt);
      await continueDialogue();
    } finally { await network(false); }
    await click('#adventuresBtn');
    const switchBack = [...doc().querySelectorAll('#adventure-actions button')].at(-1);
    win().confirm = () => false;
    switchBack.click();
    check((await snapshot()).active.adventure.manifest.id === 'timer-demo');
    win().confirm = () => true;
    switchBack.click();
    await wait(() => find('#scanBtn') && win().QRCQ_ACTIVE_SESSION.active.kind === 'builtin');
  });
  await test('the built-in authored ending commits before victory and uses confirmed replay', async () => {
    localStorage.setItem(langKey, 'en');
    await launch('/index.html?debug=1');
    await click('#settingsBtn');
    await click('#settingsDebugBtn');
    await click('[data-debug-menu="encounters"]');
    find('#jumpPage').value = '1011';
    await click('#jumpBtn');
    await click('[data-button-index="1"]');
    await wait(() => find('.av-victory h1'));
    check((await snapshot()).active.save.completed);
    await replay();
    check(localStorage.getItem(legacyKey) === backup);
  });
  results.textContent = log.join('\n') + `\nBROWSER: ${passed} passed; ${failed} failed; complete`;
})();
