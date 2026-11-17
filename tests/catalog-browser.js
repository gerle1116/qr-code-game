'use strict';
(async () => {
  let passed = 0, failed = 0; const lines = [];
  const assert = (v, message = 'assertion failed') => { if (!v) throw Error(message); };
  const test = (name, fn) => { try { fn(); passed++; lines.push(`PASS ${name}`); } catch (e) { failed++; lines.push(`FAIL ${name}: ${e.message}`); } };
  const until = async fn => { for (let i = 0; i < 500; i++) { if (fn()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw Error('Timed out waiting for tester.'); };
  try {
    const frame = document.createElement('iframe'); frame.style.width = '1000px'; frame.style.height = '800px';
    await new Promise(resolve => { frame.onload = resolve; frame.src = '../adventure-system/catalog-tester.html'; document.body.appendChild(frame); });
    const doc = frame.contentDocument, win = frame.contentWindow, el = id => doc.getElementById(id);
    const input = (id, value) => { el(id).value = value; el(id).dispatchEvent(new win.Event('input')); };
    const cards = () => [...doc.querySelectorAll('article')];
    await until(() => cards().length === 3);
    test('actual tester loads all three local sample types', () => { assert(cards().length === 3); assert(cards()[2].textContent.includes('non-linear')); });
    test('samples clearly identified and downloads absent', () => { assert(cards().every(c => c.textContent.includes('SAMPLE ONLY'))); assert(!doc.querySelector('a[download],article button,article img')); });
    test('search descriptions', () => { input('search', 'wizard'); assert(cards().length === 1); assert(cards()[0].textContent.includes('Garden Circle')); input('search', ''); });
    test('type filter', () => { input('type', 'non-linear'); assert(cards().length === 1); input('type', ''); });
    test('language filter', () => { input('language', 'hu'); assert(cards().length === 1); input('language', ''); });
    test('location filter', () => { input('location', 'garden'); assert(cards().length === 1); input('location', ''); });
    test('age filter', () => { input('age', '6'); assert(cards().length === 1); input('age', ''); });
    test('duration sort', () => { input('sort', 'duration'); assert(cards()[0].textContent.includes('Garden Circle')); });
    test('descending name sort', () => { input('sort', 'name'); input('order', 'desc'); assert(cards()[0].textContent.includes('Open Exploration')); });
    test('development and production URL selectors', () => {
      el('production').click(); assert(el('url').value.includes('/main/')); el('development').click(); assert(el('url').value.includes('/adventure-system/'));
    });
    const originalFetch = win.fetch.bind(win), fixture = await (await originalFetch('samples/catalog/sample-catalog.json')).json();
    const calls = []; let mode = 'success';
    win.fetch = async (url, options) => {
      if (!String(url).startsWith('https://example.invalid/')) return originalFetch(url, options);
      calls.push(url);
      if (mode === 'offline') throw Error('offline');
      if (mode === '404') return new win.Response('', { status: 404 });
      if (mode === 'invalid') return new win.Response('invalid JSON');
      const c = JSON.parse(JSON.stringify(fixture)); c.adventures[0].name = '<img src=x onerror=alert(1)>';
      return new win.Response(JSON.stringify(mode === 'empty' ? { catalogVersion: 1, adventures: [] } : c));
    };
    input('sort', ''); input('order', 'asc'); el('url').value = 'https://example.invalid/catalog.json'; el('online').click();
    await until(() => cards().length === 3 && !el('source').textContent.includes('fictional'));
    test('online mode uses actual loader with injected network response', () => { assert(calls.length === 1); assert(!cards()[0].textContent.includes('SAMPLE ONLY')); });
    test('untrusted metadata stays literal text', () => { assert(cards()[0].querySelector('h2').textContent.startsWith('<img')); assert(!cards()[0].querySelector('img')); });
    test('online catalog fetch does not request covers or ZIPs', () => { assert(calls.every(u => u.endsWith('/catalog.json'))); assert(!doc.querySelector('article img,article a')); });
    for (const [value, code] of [['offline', 'NETWORK_ERROR'], ['404', 'CATALOG_NOT_FOUND'], ['invalid', 'INVALID_JSON']]) {
      mode = value; el('online').click(); await until(() => el('status').textContent.includes(code));
      test(`tester displays ${code}`, () => { assert(el('status').textContent.includes(code)); assert(cards().length === 0); });
    }
    mode = 'empty'; el('online').click(); await until(() => el('status').textContent.includes('may be empty'));
    test('empty catalog shown as successful empty state', () => assert(cards().length === 0));
    el('sample').click(); await until(() => cards().length === 3);
    test('local samples remain usable after online failures', () => assert(el('source').textContent.includes('fictional')));
    frame.remove();
  } catch (e) { failed++; lines.push(`FAIL harness: ${e.stack}`); }
  document.getElementById('results').textContent = lines.join('\n') + `\nBROWSER: ${passed} passed; ${failed} failed; complete`;
})();
