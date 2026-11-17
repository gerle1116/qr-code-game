/* Local file friendly: trusted minimal fixtures mirror the Stage 1 samples.
   No fetch, app scripts, service worker registration, or save access. */
'use strict';
(() => {
  let renderer;
  const select = document.getElementById('sample');
  function show() {
    renderer?.destroy();
    const markers = select.value === 'markers';
    const adventure = { manifest: { formatVersion: 1, type: markers ? 'linear' : 'circular',
      map: { mode: markers ? 'markers' : 'static', image: 'images/map.png', ...(markers ? { markers: [
        { id: 'bridge', qr: '02', label: 'Bridge', x: 32, y: 60, description: 'A physical location. The NPC depends on the selected scenario.' },
        { id: 'garden', qr: '03', label: 'Garden', x: 65, y: 30 }
      ] } : {}) } }, gameData: { encounters: { '01': {}, '02': {}, '03': {} } },
      scenarioData: { scenarios: { 'scenario-a': { encounters: { '02': 'wizard-a', '03': 'guard-a' } } } } };
    const result = QRCQMapRenderer.createMapRenderer({ container: document.getElementById('map'), adventure,
      resolveAsset: () => `samples/${markers ? 'linear' : 'circular'}/images/map.png` });
    if (result.ok) renderer = result.renderer;
    else document.getElementById('map').textContent = result.message;
  }
  select.addEventListener('change', show); show();
})();
