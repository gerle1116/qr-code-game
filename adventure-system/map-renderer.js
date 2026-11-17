/* Stage 6: local, standalone navigation aid. No gameplay or storage dependencies. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QRCQMapRenderer = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const safePath = v => typeof v === 'string' && /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*\.(png|jpe?g|webp)$/.test(v) &&
    v.split('/').every(p => p !== '.' && p !== '..');
  const fail = (code, message) => ({ ok: false, code, message });
  function readMap(adventure) {
    const m = adventure && adventure.manifest;
    if (!record(m) || m.formatVersion !== 1 || !['linear', 'circular', 'non-linear'].includes(m.type))
      return fail('INVALID_ADVENTURE', 'Supply a validated Stage 1 adventure.');
    if (m.type === 'non-linear') return { ok: true, map: null }; // Keep Objectives.
    const map = m.map;
    if (!record(map) || !['static', 'markers'].includes(map.mode) || !safePath(map.image))
      return fail('INVALID_MAP', 'Map needs a valid mode and safe relative image path.');
    if ((map.mode === 'static' && map.markers !== undefined) ||
        (map.mode === 'markers' && !Array.isArray(map.markers)))
      return fail('INVALID_MARKERS', 'Only marker maps require a marker array.');
    const physical = new Set(m.type === 'linear' ? Object.values(adventure.scenarioData?.scenarios || {})
      .flatMap(s => Object.keys(s.encounters || {})) : Object.keys(adventure.gameData?.encounters || {}));
    const ids = new Set();
    for (const marker of map.markers || []) {
      if (!record(marker) || typeof marker.id !== 'string' || !marker.id.trim() || ids.has(marker.id) ||
          !/^\d{2}$/.test(marker.qr) || !physical.has(marker.qr) ||
          ![marker.x, marker.y].every(n => Number.isFinite(n) && n >= 0 && n <= 100) ||
          (marker.label !== undefined && (typeof marker.label !== 'string' || !marker.label.trim())) ||
          (marker.description !== undefined && typeof marker.description !== 'string'))
        return fail('INVALID_MARKERS', 'Check marker IDs, physical QRs, coordinates and text.');
      ids.add(marker.id);
    }
    return { ok: true, map: JSON.parse(JSON.stringify(map)) };
  }
  // Only loader-supplied local resources are accepted; never resolve package paths ourselves.
  function localResource(value) {
    return typeof value === 'string' && (/^blob:[^\s]+$/.test(value) ||
      /^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=\s]+$/.test(value) ||
      /^file:\/\/\//.test(value) || safePath(value));
  }
  function createMapRenderer({ container, adventure, resolveAsset } = {}) {
    const checked = readMap(adventure);
    if (!checked.ok) return checked;
    if (!checked.map) return { ok: true, renderer: null, reason: 'OBJECTIVES' };
    if (!container || !container.ownerDocument || typeof resolveAsset !== 'function')
      return fail('INVALID_CONTEXT', 'Supply a DOM container and trusted local asset resolver.');
    const map = checked.map, doc = container.ownerDocument;
    let source;
    try { source = resolveAsset(map.image); } catch (_) { /* Report missing assets below. */ }
    const root = doc.createElement('section'); root.className = 'qrcq-map';
    const make = (tag, parent, text, cls) => {
      const el = doc.createElement(tag);
      if (text !== undefined) el.textContent = text;
      if (cls) el.className = cls;
      parent.appendChild(el); return el;
    };
    const toolbar = make('div', root, undefined, 'qrcq-map-toolbar');
    const viewport = make('div', root, undefined, 'qrcq-map-viewport');
    viewport.tabIndex = 0; viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-label', 'Adventure map. Arrow keys pan; plus and minus zoom; Home resets.');
    const plane = make('div', viewport, undefined, 'qrcq-map-plane');
    const image = make('img', plane); image.alt = 'Adventure map'; image.draggable = false;
    const info = make('div', root, '', 'qrcq-map-info'); info.setAttribute('aria-live', 'polite');
    const status = make('p', root, 'Loading map…', 'qrcq-map-status'); status.setAttribute('role', 'status');
    container.appendChild(root);
    let scale = 1, x = 0, y = 0, loaded = false, destroyed = false, activeMarker = null;
    const listeners = [], pointers = new Map();
    const on = (el, type, fn, options) => {
      el.addEventListener(type, fn, options); listeners.push(() => el.removeEventListener(type, fn, options));
    };
    const bounds = () => viewport.getBoundingClientRect();
    function paint() {
      if (destroyed) return;
      const b = bounds();
      if (loaded && b.width > 0 && b.height > 0) {
        const fit = Math.min(b.width / image.naturalWidth, b.height / image.naturalHeight);
        const w = image.naturalWidth * fit, h = image.naturalHeight * fit;
        x = Math.max(-w * (scale - 1) / 2, Math.min(w * (scale - 1) / 2, x));
        y = Math.max(-h * (scale - 1) / 2, Math.min(h * (scale - 1) / 2, y));
        plane.style.width = `${w}px`; plane.style.height = `${h}px`;
      }
      plane.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
      zoomOut.disabled = !loaded || scale <= 1; zoomIn.disabled = !loaded || scale >= 4;
    }
    function zoom(value) {
      if (!loaded || !Number.isFinite(value)) return;
      const next = Math.max(1, Math.min(4, value)); x *= next / scale; y *= next / scale; scale = next; paint();
    }
    function pan(dx, dy) {
      if (!loaded || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
      x += dx; y += dy; paint();
    }
    function reset() { scale = 1; x = y = 0; paint(); }
    function button(label, fn) { const b = make('button', toolbar, label); b.type = 'button'; on(b, 'click', fn); return b; }
    const zoomOut = button('Zoom out', () => zoom(scale / 1.25));
    const zoomIn = button('Zoom in', () => zoom(scale * 1.25));
    button('Reset view', reset);
    const markers = [];
    for (const marker of map.markers || []) {
      const b = make('button', plane, marker.label || `QR ${marker.qr}`, 'qrcq-map-marker');
      b.type = 'button'; b.style.left = `${marker.x}%`; b.style.top = `${marker.y}%`;
      b.setAttribute('aria-expanded', 'false');
      on(b, 'click', () => {
        if (!loaded) return;
        if (activeMarker) activeMarker.setAttribute('aria-expanded', 'false');
        activeMarker = b; b.setAttribute('aria-expanded', 'true');
        info.replaceChildren(); make('strong', info, marker.label || `QR ${marker.qr}`);
        make('p', info, `Physical QR: ${marker.qr}`);
        if (marker.description) make('p', info, marker.description);
        const close = make('button', info, 'Close information'); close.type = 'button';
        close.onclick = () => { info.replaceChildren(); b.setAttribute('aria-expanded', 'false'); activeMarker = null; b.focus(); };
      });
      markers.push(b); b.disabled = true;
    }
    const error = () => {
      loaded = false; plane.hidden = true; status.textContent = 'Map image is missing or could not be loaded.';
      markers.forEach(b => { b.disabled = true; }); paint();
    };
    on(image, 'load', () => {
      if (!image.naturalWidth || !image.naturalHeight) return error();
      loaded = true; plane.hidden = false; status.textContent = 'Drag to pan. Pinch or use the zoom buttons.';
      markers.forEach(b => { b.disabled = false; }); reset();
    });
    on(image, 'error', error);
    on(viewport, 'keydown', e => {
      if (e.target !== viewport) return;
      const moves = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] };
      if (moves[e.key]) pan(...moves[e.key]);
      else if (['+', '='].includes(e.key)) zoom(scale * 1.25);
      else if (e.key === '-') zoom(scale / 1.25);
      else if (e.key === 'Home') reset(); else return;
      e.preventDefault();
    });
    const distance = () => { const p = [...pointers.values()]; return p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0; };
    on(viewport, 'pointerdown', e => {
      if (e.target.closest('button') || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault(); viewport.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    on(viewport, 'pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      const old = pointers.get(e.pointerId), before = distance();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) pan(e.clientX - old.x, e.clientY - old.y);
      else if (before > 0) zoom(scale * distance() / before);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) on(viewport, type, e => pointers.delete(e.pointerId));
    on(viewport, 'wheel', e => { e.preventDefault(); zoom(scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });
    const win = doc.defaultView;
    const observer = win?.ResizeObserver ? new win.ResizeObserver(paint) : null;
    if (observer) observer.observe(viewport); else if (win) on(win, 'resize', paint);
    paint();
    if (localResource(source)) image.src = source; else error();
    return { ok: true, renderer: Object.freeze({ zoom, pan, reset, resize: paint,
      getView: () => ({ scale, x, y, loaded }),
      destroy() { destroyed = true; observer?.disconnect(); listeners.forEach(remove => remove()); pointers.clear(); root.remove(); }
    }) };
  }
  return { readMap, createMapRenderer };
});
