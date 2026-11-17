/* Stage 9 presentation only. Stage 7 owns catalogs; Stage 8 owns installations. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./adventure-catalog.js'), require('./adventure-downloader.js'));
  else root.QRCQAdventureBrowser = factory(root.QRCQAdventureCatalog, root.QRCQAdventureDownloader);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (catalogAPI, downloaderAPI) {
  'use strict';
  const EN = Object.freeze({
    title: 'Choose Your Adventure', eyebrow: 'QR CITY QUEST · A WORLD TO DISCOVER', intro: 'A new place. A curious clue. A story that starts with you.',
    current: 'Current Adventure', available: 'Available Adventures', builtIn: 'Original QR City Quest',
    builtInText: 'The original built-in adventure remains your default. No downloadable adventure is installed.',
    integration: 'Gameplay launch and switching to the original game will be connected in a later stage.',
    offline: 'Installed files available offline', unfinished: 'Unfinished progress saved', completed: 'Adventure completed',
    active: 'Active', installedVersion: 'Installed version', version: 'Version', contentLanguage: 'Adventure language', navigation: 'Main navigation',
    linear: 'Linear', circular: 'Circular', 'non-linear': 'Non-linear', map: 'Map', objectives: 'Objectives',
    linearText: 'Follow a story with ordered checkpoints. Your first QR scan determines which scenario you play.',
    circularText: 'Explore freely, return to characters, and discover where their clues lead.',
    'non-linearText': 'Explore in any order, collect items, complete quests and make your own discoveries.',
    loading: 'Finding your next adventure…', empty: 'New stories are on the horizon. No adventures are published in this catalog yet.',
    noMatches: 'No adventures match your filters. Try another search or clear your filters.',
    search: 'Search adventures', searchHint: 'A name or a clue…', type: 'Adventure type', language: 'Content language', location: 'Location',
    age: 'Player age', any: 'All', sort: 'Sort by', catalogOrder: 'Catalog order', name: 'Name', duration: 'Estimated duration',
    clear: 'Clear filters', refresh: 'Refresh catalog', retry: 'Try Again', details: 'Explore adventure', back: 'Back to adventures',
    download: 'Download Adventure', reinstall: 'Reinstall Adventure', update: 'Install this version',
    author: 'Created by', minutes: 'minutes', ages: 'Ages', about: 'About this adventure', artwork: 'A story awaits',
    catalogError: 'The adventure catalog could not be loaded. Your installed adventure is still available.',
    networkError: 'You appear to be offline, or the connection failed. Check your connection and try again.',
    timeoutError: 'The request took too long. Please try again when your connection is ready.',
    invalidCatalog: 'This catalog is not compatible or contains invalid information. Please try another catalog later.',
    httpError: 'The server could not provide this file. Please try again later.',
    integrityError: 'The downloaded file did not match its published size or checksum. Nothing was installed.',
    packageError: 'This adventure package could not be safely validated. Your current adventure has been kept.',
    quotaError: 'There is not enough browser storage to install this adventure. Free some space and try again.',
    staleError: 'Your saved progress changed while this adventure was being prepared. Please download it again.',
    storageError: 'Your stored adventure could not be read. Existing data has been kept; try reopening the browser.',
    browserError: 'This browser cannot verify or store this adventure. Use a supported browser over HTTPS and allow local storage.',
    genericError: 'The installation could not finish. Your current adventure has been kept. Please try again.',
    cancel: 'Cancel installation', cancelled: 'Installation cancelled. Your current adventure and save have been kept.',
    downloading: 'Downloading your adventure…', verifying: 'Checking download integrity…', extracting: 'Unpacking adventure files…',
    validating: 'Checking the story and its artwork…', staging: 'Preparing offline storage…',
    'awaiting-confirmation': 'Your adventure is ready. Review the replacement warning.', activating: 'Activating your adventure. Please wait…',
    complete: 'Your adventure is installed and available offline.', replaceTitle: 'Replace your current adventure?',
    replaceText: 'Your current adventure and its unfinished progress will be lost when the new adventure becomes active. The new adventure has already been downloaded and checked.',
    keep: 'Keep Current Adventure', replace: 'Replace Adventure', replacing: 'Current adventure', replacement: 'New adventure',
    results: 'adventure(s)', ageError: 'Enter a whole player age of zero or more.', preparing: 'Preparing installation…'
  });
  // Partial initial dictionary: absent keys deliberately use the English fallback.
  const HU = Object.freeze({ title: 'Válassz kalandot', current: 'Jelenlegi kaland', available: 'Elérhető kalandok',
    builtIn: 'Eredeti QR City Quest', search: 'Kalandok keresése', type: 'Kaland típusa', language: 'A kaland nyelve',
    location: 'Helyszín', age: 'Játékos életkora', any: 'Mind', sort: 'Rendezés', clear: 'Szűrők törlése', refresh: 'Katalógus frissítése',
    details: 'Kaland részletei', back: 'Vissza a kalandokhoz', download: 'Kaland letöltése', keep: 'Jelenlegi kaland megtartása',
    replace: 'Kaland lecserélése', cancel: 'Telepítés megszakítása', retry: 'Újrapróbálás', map: 'Térkép', objectives: 'Feladatok' });
  function createTranslator(locale = 'en', messages = {}) {
    const dictionary = String(locale).toLowerCase().split('-')[0] === 'hu' ? HU : {};
    return key => Object.hasOwn(messages, key) && typeof messages[key] === 'string' ? messages[key] : dictionary[key] ?? EN[key] ?? key;
  }
  function typeInfo(type, translate = createTranslator()) {
    if (!['linear', 'circular', 'non-linear'].includes(type)) throw new TypeError('Expected a canonical adventure type.');
    return { label: translate(type), description: translate(type + 'Text'), navigation: translate(type === 'non-linear' ? 'objectives' : 'map') };
  }
  function errorMessage(code, translate = createTranslator()) {
    const keys = { NETWORK_ERROR: 'networkError', NETWORK_UNAVAILABLE: 'networkError', TIMEOUT: 'timeoutError',
      INVALID_CATALOG: 'invalidCatalog', UNSUPPORTED_VERSION: 'invalidCatalog', INVALID_JSON: 'invalidCatalog',
      HTTP_ERROR: 'httpError', CATALOG_NOT_FOUND: 'httpError', INVALID_URL: 'httpError',
      SIZE_MISMATCH: 'integrityError', CHECKSUM_MISMATCH: 'integrityError', INVALID_ZIP: 'packageError', INVALID_PACKAGE: 'packageError',
      INVALID_IMAGE: 'packageError', CATALOG_MISMATCH: 'packageError', PACKAGE_TOO_LARGE: 'packageError',
      QuotaExceededError: 'quotaError', STALE_TRANSITION: 'staleError', CANCELLED: 'cancelled', AbortError: 'cancelled',
      STORAGE_CORRUPT: 'storageError', STORAGE_VERSION: 'storageError', STORAGE_UNAVAILABLE: 'storageError', STORAGE_ERROR: 'storageError',
      CRYPTO_UNAVAILABLE: 'browserError', IMAGE_DECODER_UNAVAILABLE: 'browserError' };
    return translate(keys[code] || 'genericError');
  }
  function createAdventureBrowser({ container, storage, catalogURL = catalogAPI.DEFAULT_CATALOG_URL, locale = 'en', messages = {}, dependencies = {} } = {}) {
    if (!container?.ownerDocument || !storage?.recover || !storage?.snapshot) throw new TypeError('Supply a DOM container and Stage 8 storage.');
    const doc = container.ownerDocument, win = doc.defaultView, t = createTranslator(locale, messages);
    const root = doc.createElement('section'); root.className = 'ab'; root.lang = locale;
    const listeners = new AbortController();
    const make = (tag, parent, text, cls) => { const node = doc.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; parent.appendChild(node); return node; };
    const on = (node, event, fn) => node.addEventListener(event, fn, { signal: listeners.signal });
    const button = (parent, text, fn, cls = 'ab-button') => { const b = make('button', parent, text, cls); b.type = 'button'; b.onclick = fn; return b; };
    let destroyed = false, catalog = null, active = null, selected = null, pending = null, busy = false, committing = false;
    let catalogSeq = 0, operationSeq = 0, activeSeq = 0, catalogAbort, installAbort, assetLease, lastEntry, initialized = false;
    let phase = '', activeUnavailable = false;
    const filters = {};
    const hero = make('header', root, undefined, 'ab-hero'); make('p', hero, t('eyebrow'), 'ab-eyebrow');
    make('h1', hero, t('title')); make('p', hero, t('intro'), 'ab-intro'); make('span', hero, '✧', 'ab-hero-star').setAttribute('aria-hidden', 'true');
    const activeSection = make('section', root, undefined, 'ab-current'); make('h2', activeSection, t('current'));
    const activeBody = make('div', activeSection, '', 'ab-current-body');
    const browse = make('section', root, undefined, 'ab-browse');
    const headingRow = make('div', browse, undefined, 'ab-heading-row'), heading = make('h2', headingRow, t('available')); heading.tabIndex = -1;
    const refreshButton = button(headingRow, t('refresh'), () => refreshCatalog(), 'ab-button ab-secondary'); refreshButton.dataset.action = 'refresh';
    const filterForm = make('form', browse, undefined, 'ab-filters'); filterForm.setAttribute('role', 'search');
    on(filterForm, 'submit', event => event.preventDefault());
    function field(key, label, values) {
      const wrapper = make('label', filterForm, t(label)), input = make(values ? 'select' : 'input', wrapper);
      input.name = key; input.dataset.filter = key;
      if (values) for (const [value, caption] of values) { const option = make('option', input, caption); option.value = value; }
      else { input.type = key === 'maxMinimumAge' ? 'number' : key === 'search' ? 'search' : 'text'; if (key === 'maxMinimumAge') { input.min = '0'; input.step = '1'; } }
      if (key === 'search') input.placeholder = t('searchHint');
      on(input, 'input', () => renderCards()); filters[key] = input; return input;
    }
    field('search', 'search'); field('type', 'type', [['', t('any')], ...['linear', 'circular', 'non-linear'].map(v => [v, t(v)])]);
    field('language', 'language'); field('location', 'location'); field('maxMinimumAge', 'age');
    field('sortBy', 'sort', [['', t('catalogOrder')], ['name', t('name')], ['duration', t('duration')]]);
    button(filterForm, t('clear'), () => { Object.values(filters).forEach(input => { input.value = ''; }); renderCards(); }, 'ab-button ab-secondary').dataset.action = 'clear';
    const catalogStatus = make('p', browse, '', 'ab-catalog-status'); catalogStatus.setAttribute('role', 'status'); catalogStatus.setAttribute('aria-live', 'polite');
    const catalogRetry = button(browse, t('retry'), () => refreshCatalog(), 'ab-button ab-secondary'); catalogRetry.hidden = true; catalogRetry.dataset.action = 'catalog-retry';
    const cards = make('div', browse, undefined, 'ab-cards');
    const detail = make('section', root, undefined, 'ab-details'); detail.hidden = true;
    const progressPanel = make('section', root, undefined, 'ab-progress'); progressPanel.hidden = true;
    const progressText = make('p', progressPanel); progressText.setAttribute('role', 'status'); progressText.setAttribute('aria-live', 'polite');
    const meter = make('progress', progressPanel); meter.max = 100; meter.setAttribute('aria-label', t('preparing'));
    const byteText = make('p', progressPanel, '', 'ab-small');
    const cancelButton = button(progressPanel, t('cancel'), () => cancelInstallation()); cancelButton.dataset.action = 'cancel-install';
    const retryInstall = button(progressPanel, t('retry'), () => lastEntry && startInstallation(lastEntry)); retryInstall.hidden = true; retryInstall.dataset.action = 'install-retry';
    const dialog = make('dialog', root, undefined, 'ab-dialog');
    const dialogTitle = make('h2', dialog, t('replaceTitle')); dialogTitle.id = 'ab-confirm-' + Math.random().toString(36).slice(2);
    dialog.setAttribute('aria-labelledby', dialogTitle.id);
    const dialogCopy = make('p', dialog, t('replaceText')); dialogCopy.id = dialogTitle.id + '-description'; dialog.setAttribute('aria-describedby', dialogCopy.id);
    const names = make('p', dialog, '', 'ab-replacement-names'), dialogActions = make('div', dialog, undefined, 'ab-dialog-actions');
    const keepButton = button(dialogActions, t('keep'), () => cancelInstallation()); keepButton.dataset.action = 'keep';
    const replaceButton = button(dialogActions, t('replace'), () => commitInstallation(true), 'ab-button ab-danger'); replaceButton.dataset.action = 'replace';
    on(dialog, 'cancel', event => { event.preventDefault(); if (!committing) cancelInstallation(); });
    container.appendChild(root);
    function cover(parent, entry, source) {
      const frame = make('div', parent, undefined, 'ab-art ab-art-' + (entry.type || 'linear'));
      const symbol = make('span', frame, '✧', 'ab-compass'); symbol.setAttribute('aria-hidden', 'true');
      make('span', frame, t('artwork'), 'ab-art-caption');
      if (source) {
        const image = make('img', frame); image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
        image.onerror = () => { image.remove(); frame.dataset.placeholder = 'true'; };
        image.onload = () => { frame.dataset.loaded = 'true'; }; image.src = source;
      } else frame.dataset.placeholder = 'true';
      return frame;
    }
    function onlineCover(entry) {
      // Called only for validated Stage 7 entries. Demo transport may suppress covers.
      return dependencies.resolveCover ? dependencies.resolveCover(entry) : entry.coverUrl;
    }
    function metadata(parent, entry) {
      const row = make('div', parent, undefined, 'ab-meta');
      for (const value of [typeInfo(entry.type, t).label, `${t('contentLanguage')}: ${entry.language}`, `${entry.estimatedMinutes} ${t('minutes')}`, `${t('ages')} ${entry.minimumAge}+`]) make('span', row, value);
      make('p', parent, entry.location, 'ab-location');
    }
    function actionLabel(entry) {
      return active?.adventure.manifest.id === entry.id ? t(active.adventure.manifest.version === entry.version ? 'reinstall' : 'update') : t('download');
    }
    function syncButtons() {
      root.querySelectorAll('[data-action="install"]').forEach(b => { b.disabled = busy || !initialized || activeUnavailable; });
      cancelButton.hidden = !busy || committing; retryInstall.hidden = busy || !lastEntry;
      keepButton.disabled = replaceButton.disabled = committing;
      root.querySelectorAll('[data-action="back"]').forEach(b => { b.disabled = committing; });
    }
    async function refreshActive() {
      if (destroyed) return;
      const seq = ++activeSeq;
      try {
        const snapshot = await storage.snapshot();
        if (destroyed || seq !== activeSeq) return;
        assetLease?.dispose(); assetLease = null; active = snapshot.active; activeUnavailable = false; activeBody.replaceChildren();
        if (!active || active.kind === 'builtin') {
          make('h3', activeBody, t('builtIn')); make('p', activeBody, t('builtInText')); make('p', activeBody, t('integration'), 'ab-small');
          if (active) make('p', activeBody, t(active.save.completed ? 'completed' : 'unfinished'));
        } else {
          const m = active.adventure.manifest;
          let source;
          if (m.cover) {
            const lease = await storage.createAssetLoader();
            if (destroyed || seq !== activeSeq) { lease?.dispose(); return; }
            if (lease && lease.adventure.manifest.id === m.id && lease.adventure.manifest.version === m.version) {
              assetLease = lease; source = lease.resolveAsset(m.cover);
            } else lease?.dispose();
          }
          cover(activeBody, m, source);
          const text = make('div', activeBody, undefined, 'ab-current-copy'); make('h3', text, m.name);
          make('p', text, `${typeInfo(m.type, t).label} · ${t('contentLanguage')}: ${m.language} · ${t('version')} ${m.version}`, 'ab-small');
          make('p', text, t(active.save.completed ? 'completed' : 'unfinished'), 'ab-save-status');
          make('span', text, t('offline'), 'ab-offline'); make('p', text, t('integration'), 'ab-small');
        }
        renderCards(); if (selected) renderDetails(false); syncButtons();
      } catch (_) {
        if (destroyed || seq !== activeSeq) return; activeUnavailable = true; activeBody.textContent = t('storageError'); syncButtons();
      }
    }
    function renderCards() {
      cards.replaceChildren(); if (!catalog) return;
      try {
        if (!catalog.adventures.length) { catalogStatus.textContent = t('empty'); return; }
        const options = Object.fromEntries(Object.entries(filters).filter(([key, input]) => key !== 'maxMinimumAge' || input.value !== '').map(([key, input]) => [key, key === 'maxMinimumAge' ? Number(input.value) : input.value]));
        const list = catalogAPI.filterAdventures(catalog, options);
        catalogStatus.textContent = list.length ? `${list.length} ${t('results')}` : t('noMatches');
        for (const entry of list) {
          const card = make('article', cards, undefined, 'ab-card'); card.dataset.adventureId = entry.id;
          cover(card, entry, onlineCover(entry)); const body = make('div', card, undefined, 'ab-card-body');
          if (active?.adventure.manifest.id === entry.id) make('span', body, active.adventure.manifest.version === entry.version ?
            `${t('active')} · ${t('version')} ${entry.version}` : `${t('installedVersion')} ${active.adventure.manifest.version}`, 'ab-active-badge');
          make('h3', body, entry.name); make('p', body, entry.description, 'ab-summary'); metadata(body, entry);
          button(body, t('details'), () => openDetails(entry.id), 'ab-button ab-secondary').dataset.action = 'details';
        }
      } catch (_) { catalogStatus.textContent = t('ageError'); }
    }
    async function refreshCatalog(url = catalogURL) {
      if (destroyed) return; catalogURL = url; const seq = ++catalogSeq;
      catalogAbort?.abort(); catalogAbort = new AbortController(); const requestAbort = catalogAbort;
      catalog = null; cards.replaceChildren(); catalogStatus.textContent = t('loading'); catalogRetry.hidden = true;
      const links = [];
      try {
        const result = await catalogAPI.fetchCatalog(url, { timeoutMs: dependencies.catalogTimeoutMs || 10000,
          fetch: (address, options) => {
            const cancel = () => requestAbort.abort(); options.signal.addEventListener('abort', cancel, { once: true });
            links.push(() => options.signal.removeEventListener('abort', cancel));
            return (dependencies.catalogFetch || win.fetch.bind(win))(address, { ...options, signal: requestAbort.signal });
          } });
        if (destroyed || seq !== catalogSeq) return;
        if (!result.ok) { catalogStatus.textContent = errorMessage(result.code, t); catalogRetry.hidden = false; return result; }
        catalog = result.catalog; renderCards(); return result;
      } catch (_) { if (!destroyed && seq === catalogSeq) { catalogStatus.textContent = t('catalogError'); catalogRetry.hidden = false; } }
      finally { links.forEach(remove => remove()); }
    }
    function renderDetails(focus = true) {
      if (!selected) return;
      const focusedAction = detail.contains(doc.activeElement) ? doc.activeElement.dataset.action : null;
      detail.replaceChildren(); const entry = selected;
      button(detail, '← ' + t('back'), () => back(), 'ab-button ab-back').dataset.action = 'back';
      const layout = make('div', detail, undefined, 'ab-detail-layout'); cover(layout, entry, onlineCover(entry));
      const body = make('div', layout, undefined, 'ab-detail-copy'), title = make('h2', body, entry.name); title.tabIndex = -1;
      make('p', body, `${t('author')} ${entry.author}`, 'ab-small'); metadata(body, entry);
      make('p', body, `${t('version')} ${entry.version}`, 'ab-small'); make('h3', body, t('about')); make('p', body, entry.description);
      const type = typeInfo(entry.type, t); make('p', body, type.description, 'ab-type-explanation'); make('p', body, `${t('navigation')}: ${type.navigation}`);
      const install = button(body, actionLabel(entry), () => startInstallation(entry)); install.dataset.action = 'install'; syncButtons();
      if (focus) title.focus();
      else if (focusedAction === 'install') install.focus();
      else if (focusedAction === 'back') detail.querySelector('[data-action="back"]').focus();
    }
    function openDetails(id) {
      if (destroyed || busy || !catalog) return false;
      const entry = catalogAPI.getAdventureById(catalog, id); if (!entry) return false;
      selected = entry; browse.hidden = true; detail.hidden = false; renderDetails(); return true;
    }
    function closeDialog() {
      if (dialog.open) dialog.close();
      syncButtons();
      (detail.querySelector('[data-action="install"]') || heading).focus();
    }
    function showConfirmation() {
      names.textContent = `${t('replacing')}: ${active?.adventure.manifest.name || t('builtIn')} → ${t('replacement')}: ${lastEntry.name}`;
      if (!dialog.open) dialog.showModal(); keepButton.focus();
    }
    function showProgress(event) {
      phase = event.phase; progressPanel.hidden = false; progressText.textContent = t(event.phase); retryInstall.hidden = true;
      if (event.received !== undefined && event.total > 0) { meter.value = 100 * event.received / event.total; byteText.textContent = `${event.received.toLocaleString(locale)} / ${event.total.toLocaleString(locale)} bytes`; }
      else meter.removeAttribute('value');
      syncButtons();
    }
    function installationError(result) {
      phase = 'error';
      progressPanel.hidden = false; progressText.textContent = errorMessage(result.code, t); meter.hidden = true;
      byteText.textContent = ''; busy = false; syncButtons();
    }
    async function startInstallation(entry) {
      if (destroyed || busy || !initialized || activeUnavailable) return;
      const seq = ++operationSeq; busy = true; lastEntry = entry; installAbort = new AbortController();
      meter.hidden = false; showProgress({ phase: 'downloading' }); syncButtons();
      try {
        const result = await downloaderAPI.prepareAdventureInstallation(entry, { ...(dependencies.downloadOptions || {}), storage,
          fetch: dependencies.downloadFetch || win.fetch.bind(win), signal: installAbort.signal,
          onProgress: event => { if (!destroyed && seq === operationSeq && event.phase !== 'complete') showProgress(event); } });
        if (destroyed || seq !== operationSeq) { if (result.ok) await result.installation.cancel(); return; }
        if (!result.ok) { installationError(result); return; }
        pending = result.installation; await refreshActive();
        if (destroyed || seq !== operationSeq) return;
        if (pending.requiresConfirmation) { showProgress({ phase: 'awaiting-confirmation' }); showConfirmation(); }
        else await commitInstallation(false);
      } catch (e) { if (!destroyed && seq === operationSeq) installationError(e); }
    }
    async function commitInstallation(confirmed) {
      if (!pending || committing || destroyed) return;
      committing = true; const seq = operationSeq, handle = pending; showProgress({ phase: 'activating' }); syncButtons();
      try {
        const result = await handle.commit({ confirmed });
        if (destroyed || seq !== operationSeq) return;
        committing = false;
        if (!result.ok) {
          if (result.code === 'CONFIRMATION_REQUIRED') { showConfirmation(); return; }
          await handle.cancel(); pending = null; closeDialog(); installationError(result); await refreshActive(); return;
        }
        pending = null; busy = false; closeDialog(); showProgress({ phase: 'complete' }); meter.value = 100; meter.hidden = false; byteText.textContent = '';
        lastEntry = null; await refreshActive(); syncButtons();
      } catch (e) {
        if (!destroyed && seq === operationSeq) { committing = false; await handle.cancel().catch(() => {}); pending = null; closeDialog(); installationError(e); await refreshActive(); }
      } finally { committing = false; }
    }
    async function cancelInstallation() {
      if (committing || destroyed) return false;
      ++operationSeq; installAbort?.abort(); const handle = pending; pending = null;
      try { if (handle) await handle.cancel(); }
      catch (_) { /* Startup recovery can discard staging if browser storage is unavailable. */ }
      if (destroyed) return true;
      busy = false; phase = 'cancelled'; closeDialog(); progressPanel.hidden = false; progressText.textContent = t('cancelled'); meter.hidden = true; byteText.textContent = ''; lastEntry = null;
      syncButtons(); await refreshActive(); return true;
    }
    async function back() {
      if (committing || destroyed) return false;
      if (busy) await cancelInstallation(); selected = null; detail.hidden = true; browse.hidden = false; heading.focus(); return true;
    }
    async function destroy() {
      if (destroyed) return; destroyed = true; ++catalogSeq; ++operationSeq; ++activeSeq;
      const handle = pending;
      listeners.abort(); catalogAbort?.abort(); assetLease?.dispose();
      if (dialog.open) dialog.close();
      root.querySelectorAll('button').forEach(b => { b.onclick = null; });
      root.querySelectorAll('img').forEach(image => { image.onload = image.onerror = null; image.removeAttribute('src'); });
      root.remove(); root.replaceChildren();
      assetLease = active = catalog = selected = pending = lastEntry = null;
      if (!committing) { installAbort?.abort(); await handle?.cancel().catch(() => {}); }
    }
    on(win, 'pagehide', () => { destroy(); });
    const ready = (async () => {
      try { await storage.recover(); if (destroyed) return; initialized = true; await refreshActive(); if (!destroyed) await refreshCatalog(); }
      catch (_) { if (!destroyed) { activeUnavailable = true; activeBody.textContent = t('storageError'); syncButtons(); } }
    })();
    return { ready, refreshCatalog, refreshActive, openDetails, back, cancelInstallation, destroy,
      getState: () => ({ destroyed, busy, committing, phase, selectedId: selected?.id || null, activeId: active?.adventure.manifest.id || null }) };
  }
  return { EN, HU, createTranslator, typeInfo, errorMessage, createAdventureBrowser };
});
