'use strict';
(() => {
  const api = QRCQAdventureCatalog, el = id => document.getElementById(id);
  let catalog = null, sample = true, generation = 0;
  el('url').value = api.DEVELOPMENT_CATALOG_URL;
  const text = (parent, tag, value) => { const node = document.createElement(tag); node.textContent = value; parent.appendChild(node); return node; };
  function render() {
    el('results').replaceChildren();
    if (!catalog) return;
    try {
      const adventures = api.filterAdventures(catalog, { search: el('search').value, type: el('type').value,
        language: el('language').value.trim(), location: el('location').value,
        ...(el('age').value !== '' ? { maxMinimumAge: Number(el('age').value) } : {}),
        sortBy: el('sort').value, order: el('order').value });
      el('status').textContent = adventures.length ? `${adventures.length} adventure(s) shown.` : 'No adventures match. The catalog may be empty.';
      for (const a of adventures) {
        const card = text(el('results'), 'article', '');
        text(card, 'h2', a.name); text(card, 'p', sample ? 'SAMPLE ONLY — fictional metadata, no downloadable package.' : 'Online catalog metadata — package availability is not verified by this tester.');
        text(card, 'p', a.description);
        text(card, 'p', `${a.author} · ${a.language} · ${a.type} · ${a.location}`);
        text(card, 'p', `Ages ${a.minimumAge}+ · About ${a.estimatedMinutes} minutes · Version ${a.version}`);
      }
    } catch (e) { el('status').textContent = e.message; }
  }
  async function load(local) {
    const token = ++generation; catalog = null; el('results').replaceChildren();
    el('source').textContent = local ? 'Source: local fictional sample fixture.' : `Source: ${el('url').value}`;
    el('status').textContent = 'Loading catalog…';
    let result;
    if (local) {
      try {
        const response = await fetch('samples/catalog/sample-catalog.json', { cache: 'no-store' });
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        result = api.validateCatalog(await response.json());
      } catch (_) { result = { ok: false, message: 'Local samples could not load. Open this tester through a local HTTP server; see ADVENTURE_CATALOG.md.' }; }
    } else result = await api.fetchCatalog(el('url').value);
    if (token !== generation) return; // A late response cannot replace a newer selection.
    if (!result.ok) {
      el('status').textContent = `${result.code ? result.code + ': ' : ''}${result.message} ${(result.errors || []).join('; ')}`; return;
    }
    catalog = result.catalog; sample = local; render();
  }
  for (const id of ['search', 'type', 'language', 'location', 'age', 'sort', 'order']) el(id).addEventListener('input', render);
  el('sample').addEventListener('click', () => load(true));
  el('online').addEventListener('click', () => load(false));
  el('development').addEventListener('click', () => { el('url').value = api.DEVELOPMENT_CATALOG_URL; });
  el('production').addEventListener('click', () => { el('url').value = api.DEFAULT_CATALOG_URL; });
  load(true);
})();
