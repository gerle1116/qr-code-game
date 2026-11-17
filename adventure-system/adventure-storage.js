/* Stage 8 persistence coordinator. Package + Stage 4 save share one IDB record. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./adventure-save.js'), require('./validator.js'));
  else root.QRCQAdventureStorage = factory(root.QRCQAdventureSave, root.QRCQAdventureValidator);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (saves, validator) {
  'use strict';
  const fail = (code, message) => { throw Object.assign(Error(message), { code }); };
  const initial = () => ({ storageVersion: 1, revision: 0, active: null, staging: null });
  function check(state) {
    if (!state || state.storageVersion !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0) fail('STORAGE_VERSION', 'Unknown or corrupt storage state; original data retained.');
    if (state.active && !saves.validateAdventureSave(state.active.save, state.active.adventure).ok) fail('STORAGE_CORRUPT', 'Stored adventure/save pair is inconsistent; original data retained.');
    return state;
  }
  function createIndexedDBBackend({ name, indexedDB = globalThis.indexedDB } = {}) {
    if (typeof name !== 'string' || !name.trim() || !indexedDB) fail('STORAGE_UNAVAILABLE', 'Supply an explicit database namespace and IndexedDB.');
    let opened;
    function open() {
      if (!opened) opened = new Promise((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('state');
        request.onerror = () => { opened = null; reject(request.error); };
        request.onblocked = () => { /* Existing tabs may finish; normal IDB semantics apply. */ };
        request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); opened = null; }; resolve(db); };
      });
      return opened;
    }
    async function run(fn, write) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('state', write ? 'readwrite' : 'readonly'), store = tx.objectStore('state');
        let result, thrown; const request = store.get('pair');
        request.onsuccess = () => {
          try { const state = check(request.result || initial()); result = fn(state); if (write) store.put(state, 'pair'); }
          catch (e) { thrown = e; tx.abort(); }
        };
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(thrown || tx.error || Object.assign(Error('Storage transaction aborted.'), { code: 'STORAGE_ERROR' }));
        tx.onerror = () => {}; // onabort reports the final transaction result.
      });
    }
    return { read: () => run(state => state, false), transact: fn => run(fn, true),
      async close() { if (opened) (await opened).close(); opened = null; } };
  }
  function adventureFromFiles(files) {
    const validation = validator.validateFiles(files);
    if (!validation.valid) fail('INVALID_PACKAGE', validation.errors.join('; '));
    const parse = path => validator.parseJSON(new TextDecoder('utf-8', { fatal: true }).decode(files[path]));
    const manifest = parse('manifest.json');
    return { manifest, gameData: parse(manifest.gameData), ...(manifest.type === 'linear' ? { scenarioData: parse(manifest.scenarios) } : {}) };
  }
  function createAdventureStorage({ backend, name, indexedDB } = {}) {
    backend = backend || createIndexedDBBackend({ name, indexedDB });
    const read = async () => check(await backend.read());
    const transact = fn => backend.transact(state => fn(check(state)));
    const snapshot = async () => { const state = await read(); return { revision: state.revision, active: state.active }; };
    const abort = signal => { if (signal?.aborted) fail('CANCELLED', 'Installation cancelled before commit.'); };
    async function stage(bundle, baseline, { signal } = {}) {
      abort(signal);
      const files = structuredClone(bundle.files), adventure = adventureFromFiles(files);
      return transact(state => {
        abort(signal);
        if (state.revision !== baseline.revision) fail('STALE_TRANSITION', 'Active progress changed; prepare the installation again.');
        const transition = saves.prepareAdventureTransition(state.active?.save || null, adventure);
        if (!transition.ok) fail(transition.code, transition.message);
        const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
        state.staging = { token, baselineRevision: state.revision, baselineSave: state.active?.save || null, adventure, files };
        return { token, requiresConfirmation: !!state.active && state.active.save.completed !== true,
          preparedSave: transition.preparedSave,
          warning: state.active && state.active.save.completed !== true ? { code: 'UNFINISHED_ADVENTURE', message: 'Replacing this adventure will discard its unfinished save. Confirm explicitly to continue.', adventure: state.active.save.adventure } : null };
      });
    }
    async function commit(token, { confirmed = false, signal } = {}) {
      abort(signal);
      return transact(state => {
        abort(signal); const staged = state.staging;
        if (!staged || staged.token !== token || staged.baselineRevision !== state.revision) fail('STALE_TRANSITION', 'Installation is absent or progress changed. Prepare again.');
        if (state.active && state.active.save.completed !== true && confirmed !== true)
          return { ok: false, code: 'CONFIRMATION_REQUIRED', message: 'Explicit confirmation is required to abandon unfinished progress.' };
        const transition = saves.prepareAdventureTransition(staged.baselineSave, staged.adventure);
        if (!transition.ok) fail(transition.code, transition.message);
        const committed = transition.commit(state.active?.save || null);
        if (!committed.ok) fail(committed.code, committed.message);
        state.revision++;
        state.active = { kind: 'downloaded', adventure: staged.adventure, files: staged.files, save: committed.save };
        state.staging = null; // Old package and save disappear in the same transaction.
        return { ok: true, revision: state.revision, adventure: staged.adventure.manifest, save: committed.save };
      });
    }
    async function discard(token) { return transact(state => { if (state.staging?.token === token) state.staging = null; }); }
    async function recover() {
      return transact(state => { const discardedStaging = !!state.staging; state.staging = null; return { ok: true, discardedStaging, revision: state.revision, active: state.active }; });
    }
    async function updateSave(save, expectedRevision) {
      return transact(state => {
        if (!state.active || state.revision !== expectedRevision) fail('STALE_TRANSITION', 'Save write conflicts with newer active state.');
        const checked = saves.validateAdventureSave(save, state.active.adventure);
        if (!checked.ok) fail(checked.code, checked.message);
        state.active.save = checked.save; state.revision++; return { ok: true, revision: state.revision };
      });
    }
    async function adoptBuiltInSave(raw) {
      const adventure = { manifest: saves.LEGACY_ADVENTURE };
      const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch (_) { return raw; } })() : raw;
      const result = parsed?.adventureSaveVersion ? saves.validateAdventureSave(parsed, adventure) : saves.migrateLegacySave(raw, adventure);
      if (!result.ok) fail(result.code, result.message);
      return transact(state => {
        if (state.active) fail('ACTIVE_EXISTS', 'An active adventure already exists.');
        state.active = { kind: 'builtin', adventure, files: {}, save: result.save }; state.revision++;
        return { ok: true, revision: state.revision };
      });
    }
    async function clear({ confirmed = false } = {}) {
      return transact(state => {
        if (state.active?.save.completed !== true && state.active && !confirmed) fail('CONFIRMATION_REQUIRED', 'Confirm clearing unfinished adventure data.');
        state.active = null; state.staging = null; state.revision++; return { ok: true };
      });
    }
    async function getAsset(path) {
      const state = await read(); const bytes = state.active?.files[path];
      return bytes instanceof Uint8Array ? new Uint8Array(bytes) : null;
    }
    async function createAssetLoader({ URL: urls = globalThis.URL } = {}) {
      const { active } = await snapshot(); if (!active || active.kind !== 'downloaded') return null;
      const created = new Map(); let disposed = false;
      return { adventure: active.adventure, save: active.save,
        resolveAsset(path) {
          if (disposed || !Object.hasOwn(active.files, path) || !/\.(png|jpe?g|webp)$/.test(path)) return undefined;
          if (!created.has(path)) {
            const type = path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
            created.set(path, urls.createObjectURL(new Blob([active.files[path]], { type })));
          }
          return created.get(path);
        },
        dispose() { if (!disposed) for (const url of created.values()) urls.revokeObjectURL(url); disposed = true; created.clear(); }
      };
    }
    return { snapshot, stage, commit, discard, recover, updateSave, adoptBuiltInSave, clear, getAsset, createAssetLoader,
      getActive: async () => (await snapshot()).active, close: () => backend.close?.() };
  }
  return { createIndexedDBBackend, createAdventureStorage, adventureFromFiles };
});
