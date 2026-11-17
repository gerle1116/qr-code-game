'use strict';
(async () => {
  let passed = 0, failed = 0; const lines = [];
  const assert = (v, msg = 'assertion failed') => { if (!v) throw Error(msg); };
  const test = (name, fn) => { try { fn(); passed++; lines.push(`PASS ${name}`); } catch (e) { failed++; lines.push(`FAIL ${name}: ${e.message}`); } };
  const waitImage = img => new Promise(resolve => {
    if (img.complete && img.naturalWidth) return resolve();
    img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true });
    setTimeout(resolve, 2000);
  });
  try {
    // Network and storage calls fail immediately; local image decoding remains available.
    window.fetch = () => { throw Error('network forbidden'); };
    window.XMLHttpRequest = function () { throw Error('network forbidden'); };
    Storage.prototype.setItem = () => { throw Error('save mutation forbidden'); };
    const host = document.getElementById('host');
    const adventure = { manifest: { formatVersion: 1, type: 'circular', map: { mode: 'markers', image: 'images/map.png', markers: [
      { id: 'bridge', qr: '02', x: 32, y: 60, label: '<img src=x onerror=alert(1)>', description: '<script>bad</script>' },
      { id: 'garden', qr: '03', x: 65, y: 30 }
    ] } }, gameData: { encounters: { '02': {}, '03': {} } } };
    const before = JSON.stringify(adventure); let selected;
    const result = QRCQMapRenderer.createMapRenderer({ container: host, adventure, resolveAsset: name => {
      selected = name; return new URL('../adventure-system/samples/linear/images/map.png', location.href).href;
    } });
    assert(result.ok); const r = result.renderer, image = host.querySelector('img'); await waitImage(image);
    const viewport = host.querySelector('.qrcq-map-viewport'), plane = host.querySelector('.qrcq-map-plane');
    const markers = host.querySelectorAll('.qrcq-map-marker');
    const aligned = () => {
      const p = plane.getBoundingClientRect(), b = markers[0].getBoundingClientRect();
      return Math.abs((b.left + b.width / 2 - p.left) / p.width - .32) < .001 &&
        Math.abs((b.top + b.height / 2 - p.top) / p.height - .60) < .001;
    };
    test('caller asset selected and decoded locally', () => { assert(selected === 'images/map.png'); assert(r.getView().loaded); });
    test('image proportions preserved', () => { const b = image.getBoundingClientRect(); assert(Math.abs(b.width / b.height - image.naturalWidth / image.naturalHeight) < .001); });
    test('multiple markers at percentage coordinates', () => { assert(markers.length === 2); assert(aligned()); });
    test('zoom button transforms image and markers together', () => { host.querySelectorAll('.qrcq-map-toolbar button')[1].click(); assert(r.getView().scale > 1); assert(aligned()); });
    test('pan changes view while preserving alignment', () => { r.zoom(3); r.pan(40, 20); assert(r.getView().x === 40); assert(aligned()); });
    test('resize to phone width preserves alignment', () => { host.style.width = '320px'; r.resize(); assert(aligned()); assert(plane.getBoundingClientRect().width > 0); });
    test('reset button restores initial view', () => { host.querySelectorAll('.qrcq-map-toolbar button')[2].click(); const v = r.getView(); assert(v.scale === 1 && v.x === 0 && v.y === 0); });
    test('marker click renders literal labels and descriptions safely', () => { markers[0].click(); const info = host.querySelector('.qrcq-map-info'); assert(info.textContent.includes('<script>bad</script>')); assert(!info.querySelector('script,img')); });
    test('optional marker text has QR fallback', () => { markers[1].click(); assert(host.querySelector('.qrcq-map-info').textContent.includes('QR 03')); });
    test('close information returns focus', () => { host.querySelector('.qrcq-map-info button').click(); assert(document.activeElement === markers[1]); assert(markers[1].getAttribute('aria-expanded') === 'false'); });
    test('keyboard zoom pan and reset handlers', () => {
      const key = k => viewport.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      viewport.focus(); key('+'); key('ArrowLeft'); assert(r.getView().scale > 1 && r.getView().x > 0); key('Home'); assert(r.getView().scale === 1);
    });
    test('wheel handler prevents page scrolling', () => { const e = new WheelEvent('wheel', { deltaY: -1, cancelable: true }); viewport.dispatchEvent(e); assert(e.defaultPrevented); assert(r.getView().scale > 1); });
    test('touch surface suppresses page gestures', () => { assert(getComputedStyle(viewport).touchAction === 'none'); });
    test('map interactions leave adventure data unchanged', () => { assert(JSON.stringify(adventure) === before); });
    test('destroy removes DOM and observer', () => { r.destroy(); assert(!host.children.length); });
    const missing = QRCQMapRenderer.createMapRenderer({ container: host, adventure, resolveAsset: () => undefined });
    test('missing asset reported gracefully', () => { assert(missing.ok); assert(!missing.renderer.getView().loaded); assert(host.textContent.includes('could not be loaded')); }); missing.renderer.destroy();
    const remote = QRCQMapRenderer.createMapRenderer({ container: host, adventure, resolveAsset: () => 'https://example.com/map.png' });
    test('remote asset refused without a network request', () => { assert(!remote.renderer.getView().loaded); assert(!host.querySelector('img').hasAttribute('src')); }); remote.renderer.destroy();
    const broken = QRCQMapRenderer.createMapRenderer({ container: host, adventure, resolveAsset: () => 'data:image/png;base64,AAAA' });
    await waitImage(host.querySelector('img'));
    test('invalid image decoding reported', () => { assert(!broken.renderer.getView().loaded); assert(host.textContent.includes('could not be loaded')); }); broken.renderer.destroy();
    adventure.manifest.map = { mode: 'static', image: 'images/map.png' };
    const staticMap = QRCQMapRenderer.createMapRenderer({ container: host, adventure, resolveAsset: () => new URL('../adventure-system/samples/circular/images/map.png', location.href).href });
    await waitImage(host.querySelector('img'));
    test('static image loads without markers', () => { assert(staticMap.renderer.getView().loaded); assert(!host.querySelector('.qrcq-map-marker')); }); staticMap.renderer.destroy();
    const frame = document.createElement('iframe'); frame.style.width = '800px'; frame.style.height = '700px';
    await new Promise(resolve => { frame.onload = resolve; frame.src = '../adventure-system/map-tester.html'; document.body.appendChild(frame); });
    const tester = frame.contentDocument; await waitImage(tester.querySelector('img'));
    test('actual standalone tester opens static sample', () => { assert(tester.querySelector('img').naturalWidth > 0); assert(!tester.querySelector('.qrcq-map-marker')); });
    const select = tester.getElementById('sample'); select.value = 'markers'; select.dispatchEvent(new Event('change'));
    await waitImage(tester.querySelector('img'));
    test('actual tester switches samples and opens marker information', () => { const b = tester.querySelector('.qrcq-map-marker'); assert(b && !b.disabled); b.click(); assert(tester.querySelector('.qrcq-map-info').textContent.includes('Bridge')); });
    test('actual tester zoom and reset controls work', () => {
      const buttons = tester.querySelectorAll('.qrcq-map-toolbar button'), p = tester.querySelector('.qrcq-map-plane');
      buttons[1].click(); assert(p.style.transform.includes('scale(1.25)')); buttons[2].click(); assert(p.style.transform.includes('scale(1)'));
    }); frame.remove();
  } catch (e) { failed++; lines.push(`FAIL harness: ${e.stack}`); }
  document.getElementById('results').textContent = lines.join('\n') + `\nBROWSER: ${passed} passed; ${failed} failed; complete`;
})();
