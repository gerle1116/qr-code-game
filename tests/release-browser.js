'use strict';
(async () => {
  const root = new URL('../', location.href), url = relative => new URL(relative, root);
  const output = document.getElementById('results');
  const log = [];
  let passed = 0, failed = 0, frame;
  const check = (value, message = 'Expected release gate to pass') => { if (!value) throw Error(message); };
  const wait = async (predicate, message) => {
    for (let i = 0; i < 300; i++) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 45));
    }
    throw Error(message);
  };
  async function test(name, fn) {
    try { await fn(); passed++; log.push('PASS ' + name); }
    catch (error) { failed++; log.push('FAIL ' + name + ': ' + error.message); }
    output.textContent = log.join('\n');
  }
  function open(relative) {
    frame?.remove();
    frame = document.createElement('iframe');
    frame.width = '360'; frame.height = '720'; frame.src = url(relative);
    document.body.append(frame);
  }
  const doc = () => frame?.contentDocument;
  const contains = selector => doc()?.querySelector(selector);
  const getRegistration = () => navigator.serviceWorker.getRegistration(root);
  const network = async offline => {
    window.__browserNetworkRequest = { offline, done: false };
    await wait(() => window.__browserNetworkRequest.done, 'Chromium did not apply network state');
  };
  const key = 'qr-city-quest-save-v1', lang = 'qr-city-quest-language-v1';
  const raw = JSON.stringify({ schemaVersion: 1, inventory: ['Sweets'], hadItems: ['Sweets'], knowledge: [],
    quests: {}, encounters: {}, timers: {}, itemTimers: {}, flags: { castleOpen: false, unlockedAreas: [] },
    itemState: { counters: {}, usedButtons: {}, oneTimeRewards: {} } });
  let prior;
  await test('legacy worker installs under the GitHub Pages subdirectory', async () => {
    prior = await navigator.serviceWorker.register(url('tests/integration-old-worker.js'), { scope: root.href });
    await wait(() => prior.active?.scriptURL.endsWith('integration-old-worker.js'), 'Old worker did not activate');
    check(prior.scope === root.href && root.pathname === '/qr-code-game/');
    localStorage.setItem(key, raw);
    localStorage.setItem(lang, 'en');
  });
  await test('failed required-asset download leaves the previous worker and migrated save in place', async () => {
    const fault = await fetch(url('tests/shell-install-state?fail=1'), { method: 'POST' });
    check(fault.ok);
    const installFailed = new Promise(resolve => {
      prior.addEventListener('updatefound', () => {
        const candidate = prior.installing;
        candidate.addEventListener('statechange', () => {
          if (candidate.state === 'redundant') resolve(true);
        });
      });
    });
    open('index.html');
    await wait(() => contains('#scanBtn'), 'Game failed to open');
    let rejected = false;
    installFailed.then(() => { rejected = true; });
    await wait(() => rejected, 'Failed worker did not become redundant');
    check((await getRegistration()).active.scriptURL.endsWith('integration-old-worker.js'));
    check(localStorage.getItem(key) === raw);
    const snapshot = await frame.contentWindow.QRCQ_ACTIVE_SESSION.storage.snapshot();
    check(snapshot.active.save.inventory.includes('Sweets'));
  });
  await test('retry activates v42 and serves one complete cached shell when the network offers newer HTML', async () => {
    const restored = await fetch(url('tests/shell-install-state?fail=0'), { method: 'POST' });
    check(restored.ok);
    const retry = await navigator.serviceWorker.register(url('sw.js?v=42'), { scope: root.href, updateViaCache: 'none' });
    await wait(() => retry.active?.scriptURL.endsWith('/sw.js?v=42') && retry.active.state === 'activated',
      'v42 did not activate after the required asset returned');
    const cache = await caches.open('qr-city-quest-v42');
    check(await cache.match(url('app.js?v=42')));
    check(!(await cache.keys()).some(request => /\/tests\/|\/samples\//.test(request.url)));
    open('index.html?release-next-shell=1');
    await wait(() => contains('#scanBtn'), 'A network shell replaced the installed generation');
    check(doc().title === 'QR City Quest');
  });
  await test('offline built-in startup and manual QR fallback work at phone width under the subdirectory', async () => {
    await network(true);
    try {
      check(!navigator.onLine);
      open('index.html');
      await wait(() => contains('#scanBtn'), 'Offline built-in screen unavailable');
      frame.contentWindow.ZXingBrowser = undefined;
      contains('#scanBtn').click();
      await wait(() => contains('#manual-qr'), 'Manual QR entry unavailable');
      const input = contains('#manual-qr');
      input.value = '01';
      input.form.requestSubmit();
      await wait(() => contains('.speaker'), 'Original NPC failed to open offline');
      check(doc().documentElement.scrollWidth <= 360);
      check(localStorage.getItem(key) === raw);
    } finally { await network(false); }
  });
  await test('the original Hunter timer and fountain hint survive a reload', async () => {
    const scan = async qr => {
      contains('#scanBtn').click();
      await wait(() => contains('#manual-qr'), 'Manual scanner unavailable');
      const input = contains('#manual-qr');
      input.value = qr;
      input.form.requestSubmit();
      await wait(() => !contains('#manual-qr'), 'Scan did not resolve');
    };
    const clickChoice = async () => {
      await wait(() => contains('[data-button-index="1"]'), 'Expected Hunter choice');
      contains('[data-button-index="1"]').click();
    };
    open('index.html');
    await wait(() => contains('#scanBtn'), 'Game failed to reopen');
    await scan('05');
    await clickChoice();
    await clickChoice();
    await clickChoice();
    await wait(() => contains('#scanBtn'), 'Hunter timer was not committed');
    const storage = frame.contentWindow.QRCQ_ACTIVE_SESSION.storage;
    const { active, revision } = await storage.snapshot();
    check(active.save.encounters['05'] === '-1' && active.save.timers['05'].resumePage === '0506');
    check(active.save.knowledge.includes('grove_magic'));
    const elapsedFixture = active.save;
    elapsedFixture.timers['05'].endAt = 1;
    check((await storage.updateSave(elapsedFixture, revision)).ok);
    open('index.html');
    await wait(() => contains('#scanBtn'), 'Game failed to reload timer fixture');
    await scan('05');
    check(contains('.dialogue').textContent.includes('fountain stones'));
    await clickChoice();
    await wait(() => contains('#scanBtn'), 'Hunter hint was not committed');
    const reopened = await frame.contentWindow.QRCQ_ACTIVE_SESSION.storage.snapshot();
    check(reopened.active.save.knowledge.includes('fountain_shiny_object'));
    await scan(frame.contentWindow.QR_CITY_QUEST_DATA.items['Priclys Feather'].startPage.slice(0, 2));
    const feather = await frame.contentWindow.QRCQ_ACTIVE_SESSION.storage.snapshot();
    check(feather.active.save.inventory.includes('Priclys Feather'));
  });
  output.textContent = log.join('\n') + `\nBROWSER: ${passed} passed; ${failed} failed; complete`;
})();
