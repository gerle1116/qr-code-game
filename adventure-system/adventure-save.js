/* Stage 4: pure save preparation/validation. No storage or live app integration. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./scenario-engine.js'));
  else root.QRCQAdventureSave = factory(root.QRCQScenarioEngine);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (scenarioAPI) {
  'use strict';
  const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
  const text = v => typeof v === 'string' && v.trim().length > 0;
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const fail = (code, message) => ({ ok: false, code, message });
  const success = save => ({ ok: true, save });
  const LEGACY_ADVENTURE = Object.freeze({ formatVersion: 1, id: 'qr-city-quest', version: '1.0.0', type: 'non-linear' });

  // Reject values JSON.stringify would silently drop or coerce. Also prevent
  // dangerous dictionary keys from reaching future gameplay object lookups.
  function clone(value) {
    const seen = new Set();
    function check(v) {
      if (v === null || typeof v === 'string' || typeof v === 'boolean' || finite(v)) return;
      if (typeof v !== 'object' || seen.has(v) || (!Array.isArray(v) &&
          Object.prototype.toString.call(v) !== '[object Object]')) throw Error('Expected finite, acyclic JSON data.');
      seen.add(v);
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) { if (!own(v, i)) throw Error('Sparse arrays are not save data.'); check(v[i]); }
      } else for (const [key, child] of Object.entries(v)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('Unsafe property in save data.');
        check(child);
      }
      seen.delete(v);
    }
    check(value);
    return JSON.parse(JSON.stringify(value));
  }
  function parse(data) {
    if (data === null || data === undefined || data === '') return fail('MISSING_SAVE', 'No save was supplied; choose explicitly whether to create a new game.');
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (_) { return fail('INVALID_JSON', 'The save is not valid JSON.'); }
    }
    try { return { ok: true, value: clone(data) }; }
    catch (e) { return fail('INVALID_DATA', e.message); }
  }
  function context(adventure) {
    let a;
    try { a = clone(adventure); } catch (_) { return fail('INVALID_ADVENTURE', 'Supply a validated adventure with manifest identifying information.'); }
    const m = a && a.manifest;
    if (!record(m) || m.formatVersion !== 1 || typeof m.id !== 'string' || typeof m.version !== 'string' ||
        !/^[a-z][a-z0-9-]*$/.test(m.id) || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(m.version) ||
        !['linear', 'circular', 'non-linear'].includes(m.type)) return fail('INVALID_ADVENTURE', 'Adventure requires formatVersion 1, a valid ID, version and type.');
    let engine = null;
    if (m.type === 'linear') {
      if (!scenarioAPI || typeof scenarioAPI.createScenarioEngine !== 'function') return fail('ENGINE_UNAVAILABLE', 'Load the Stage 2 scenario engine first.');
      const created = scenarioAPI.createScenarioEngine(a.scenarioData, a.gameData);
      if (!created.ok) return fail('INVALID_ADVENTURE', created.message);
      engine = created.engine;
    } else if (a.scenarioData !== undefined || m.scenarios !== undefined) return fail('INVALID_ADVENTURE', 'Only linear adventures may contain scenarios.');
    return { ok: true, adventure: a, identity: { id: m.id, version: m.version, type: m.type }, engine };
  }
  function defaultGameplay() {
    return { schemaVersion: 1, inventory: [], hadItems: [], knowledge: [], quests: {},
      encounters: {}, timers: {}, itemTimers: {}, flags: { castleOpen: false, unlockedAreas: [] },
      itemState: { counters: {}, usedButtons: {}, oneTimeRewards: {} }, lastSavedAt: Date.now() };
  }
  function createAdventureSave(adventure) {
    const c = context(adventure); if (!c.ok) return c;
    return success({ ...defaultGameplay(), adventureSaveVersion: 1, adventure: c.identity,
      scenarioState: c.engine ? c.engine.exportState() : null, scenarioFinished: false,
      encounterHistory: { visits: {}, distinctVisited: 0 }, completed: false });
  }
  function gameplayErrors(s) {
    const errors = [];
    const strings = v => Array.isArray(v) && v.every(text);
    for (const k of ['inventory', 'hadItems', 'knowledge']) if (!strings(s[k])) errors.push(`${k} must be an array of nonempty strings`);
    for (const k of ['quests', 'encounters', 'timers', 'itemTimers', 'flags', 'itemState']) if (!record(s[k])) errors.push(`${k} must be an object`);
    if (record(s.quests) && !Object.values(s.quests).every(v => ['inactive', 'active', 'completed'].includes(v))) errors.push('quests contain an unsupported status');
    if (record(s.encounters) && !Object.values(s.encounters).every(text)) errors.push('encounters must map IDs to saved dialogue page strings');
    if (record(s.flags) && (typeof s.flags.castleOpen !== 'boolean' || !strings(s.flags.unlockedAreas))) errors.push('flags require castleOpen and unlockedAreas');
    if (record(s.itemState)) {
      for (const k of ['counters', 'usedButtons', 'oneTimeRewards']) if (!record(s.itemState[k])) errors.push(`itemState.${k} must be an object`);
      if (record(s.itemState.counters) && !Object.values(s.itemState.counters).every(finite)) errors.push('counters must contain finite numbers');
      // Historical marker maps are truthy-value maps; preserve their JSON values.
    }
    for (const kind of ['timers', 'itemTimers']) if (record(s[kind])) for (const t of Object.values(s[kind])) {
      if (!record(t) || !finite(t.endAt) || (kind === 'timers' &&
          (!text(t.resumePage) || !(t.waitPage === null || t.waitPage === undefined || text(t.waitPage))))) errors.push(`${kind} contains an invalid timer`);
    }
    if (!finite(s.lastSavedAt) || s.lastSavedAt < 0) errors.push('lastSavedAt must be a nonnegative timestamp');
    if (strings(s.inventory) && strings(s.hadItems) && s.inventory.some(id => !s.hadItems.includes(id))) errors.push('hadItems must include every inventory item');
    return errors;
  }
  function validateAdventureSave(data, adventure) {
    const parsed = parse(data); if (!parsed.ok) return parsed;
    const s = parsed.value;
    if (!record(s)) return fail('INVALID_SAVE', 'Save must be an object.');
    if (s.adventureSaveVersion !== 1 || s.schemaVersion !== 1) return fail('UNSUPPORTED_SAVE_VERSION', 'Expected adventureSaveVersion 1 and legacy schemaVersion 1. Legacy saves require explicit migration.');
    const c = context(adventure); if (!c.ok) return c;
    if (!record(s.adventure) || !['id', 'version', 'type'].every(k => typeof s.adventure[k] === 'string')) return fail('INVALID_SAVE', 'Save is missing its adventure identity.');
    if (s.adventure.id !== c.identity.id) return fail('UNKNOWN_ADVENTURE', 'This save belongs to a different adventure.');
    if (s.adventure.version !== c.identity.version) return fail('INCOMPATIBLE_ADVENTURE_VERSION', 'This adventure version differs from the saved version; an explicit content migration is required.');
    if (s.adventure.type !== c.identity.type) return fail('INVALID_SAVE', 'Saved adventure type does not match.');
    const errors = gameplayErrors(s);
    if (typeof s.completed !== 'boolean' || typeof s.scenarioFinished !== 'boolean') errors.push('completed and scenarioFinished must be booleans');
    if (own(s, 'completedAt') && (!s.completed || !Number.isSafeInteger(s.completedAt) ||
        s.completedAt < 0 || s.completedAt > 8640000000000000)) errors.push('completedAt requires a completed save and a valid timestamp');
    const history = s.encounterHistory;
    if (!record(history) || !record(history.visits) || !Number.isSafeInteger(history.distinctVisited) ||
        history.distinctVisited < 0 || (record(history.visits) &&
        (history.distinctVisited !== Object.keys(history.visits).length ||
        !Object.entries(history.visits).every(([id, count]) => text(id) && Number.isSafeInteger(count) && count > 0)))) errors.push('encounterHistory requires positive visit counts and an exact distinctVisited count');
    if (errors.length) return { ...fail('INVALID_SAVE', errors.join('; ')), errors };
    if (c.engine) {
      const restored = c.engine.restoreState(s.scenarioState);
      if (!restored.ok) return fail(restored.code, restored.message);
      if (s.scenarioFinished !== restored.finished) return fail('INVALID_STATE', 'scenarioFinished must match the Stage 2 checkpoint state.');
    } else if (s.scenarioState !== null || s.scenarioFinished !== false) return fail('INVALID_STATE', 'Unrestricted adventures cannot contain linear scenario progress.');
    return success(s);
  }
  const loadAdventureSave = (data, adventure) => validateAdventureSave(data, adventure);
  function exportAdventureSave(save, adventure) {
    const checked = validateAdventureSave(save, adventure);
    return checked.ok ? { ok: true, data: JSON.stringify(checked.save) } : checked;
  }
  function migrateLegacySave(data, adventure = { manifest: LEGACY_ADVENTURE }) {
    const parsed = parse(data); if (!parsed.ok) return parsed;
    const legacy = parsed.value;
    if (!record(legacy) || legacy.schemaVersion !== 1) return fail('UNSUPPORTED_SAVE_VERSION', 'Legacy migration supports the actual schemaVersion 1 gameplay save.');
    const reserved = ['adventureSaveVersion', 'adventure', 'scenarioState', 'scenarioFinished', 'encounterHistory', 'completed', 'completedAt'];
    if (reserved.some(k => own(legacy, k))) return fail('MIGRATION_CONFLICT', 'Legacy save contains reserved adventure fields; explicit recovery is required.');
    const c = context(adventure); if (!c.ok) return c;
    if (c.identity.id !== LEGACY_ADVENTURE.id || c.identity.version !== LEGACY_ADVENTURE.version || c.identity.type !== 'non-linear') return fail('LEGACY_ADVENTURE_MISMATCH', 'Legacy progress belongs to the original non-linear game, not a new adventure.');
    const created = createAdventureSave(adventure); if (!created.ok) return created;
    const warnings = [];
    const s = { ...created.save, ...legacy };
    for (const k of Object.keys(defaultGameplay())) if (!own(legacy, k)) warnings.push(`Missing ${k}: initialized from the original game defaults.`);
    for (const [key, defaults] of [['flags', created.save.flags], ['itemState', created.save.itemState]]) {
      if (own(legacy, key) && !record(legacy[key])) return fail('INVALID_LEGACY_SAVE', `${key} must be an object; original data was not changed.`);
      s[key] = { ...defaults, ...(legacy[key] || {}) };
      if (record(legacy[key])) for (const field of Object.keys(defaults)) if (!own(legacy[key], field)) warnings.push(`Missing ${key}.${field}: initialized to its default.`);
    }
    if (!own(legacy, 'hadItems') && Array.isArray(s.inventory)) s.hadItems = [...s.inventory];
    if (Array.isArray(s.hadItems) && Array.isArray(s.inventory)) for (const id of s.inventory) if (!s.hadItems.includes(id)) {
      s.hadItems.push(id); warnings.push('Added an owned item to hadItems, matching current game loading.');
    }
    const errors = gameplayErrors(s);
    if (errors.length) return { ...fail('INVALID_LEGACY_SAVE', errors.join('; ')), errors };
    // Match the actual loadSave migration, retaining all old marker properties.
    if (record(s.itemState.counters) && record(s.itemState.oneTimeRewards) && record(s.itemState.usedButtons)) {
      const counters = s.itemState.counters;
      for (const [old, name] of [['Blobfish', 'blobfishCaught'], ['Great Salmon', 'salmonCaught'], ['Old Boots', 'bootsCaught']]) {
        const key = `Fishing Rod::${name}`;
        if (s.itemState.oneTimeRewards[`Fishing Rod::${old}`] && !Number(counters[key])) counters[key] = 1;
      }
      if (s.itemState.usedButtons['Silver Ring::2601::Put it on.'] && !Number(counters['Silver Ring::worn'])) counters['Silver Ring::worn'] = 1;
    }
    const checked = validateAdventureSave(s, adventure);
    return checked.ok ? { ...checked, warnings } : { ...checked, code: 'INVALID_LEGACY_SAVE' };
  }
  function restoreScenarioEngine(save, adventure, existingEngine) {
    const checked = validateAdventureSave(save, adventure); if (!checked.ok) return checked;
    const c = context(adventure); if (!c.ok) return c;
    if (!c.engine) return fail('NOT_LINEAR', 'Only linear adventures have a scenario engine.');
    const engine = existingEngine || c.engine;
    if (!engine || typeof engine.restoreState !== 'function') return fail('INVALID_ENGINE', 'Expected a Stage 2 scenario engine.');
    const restored = engine.restoreState(checked.save.scenarioState);
    return restored.ok ? { ok: true, engine } : restored;
  }
  // Capture the actual Stage 2 export, never a competing progress format.
  function captureScenarioState(save, adventure, engine) {
    const checked = validateAdventureSave(save, adventure); if (!checked.ok) return checked;
    if (checked.save.adventure.type !== 'linear' || !engine || typeof engine.exportState !== 'function') return fail('INVALID_ENGINE', 'Expected a linear Stage 2 engine.');
    let state;
    try { state = clone(engine.exportState()); } catch (_) { return fail('INVALID_ENGINE', 'Engine could not export scenario progress.'); }
    // Restore the previous snapshot first so Stage 2 enforces scenario locking and rollback.
    const c = context(adventure); if (!c.ok) return c;
    c.engine.restoreState(checked.save.scenarioState);
    const restored = c.engine.restoreState(state); if (!restored.ok) return restored;
    return validateAdventureSave({ ...checked.save, scenarioState: state, scenarioFinished: restored.finished }, adventure);
  }
  function prepareAdventureTransition(oldSave, newAdventure) {
    // Old progress may even be corrupt: preparation does not load or replace it.
    let baseline;
    try { baseline = clone(oldSave); } catch (_) { return fail('INVALID_OLD_SAVE', 'Old state must be retained as JSON data or its raw JSON string.'); }
    const created = createAdventureSave(newAdventure); if (!created.ok) return created;
    const checked = validateAdventureSave(created.save, newAdventure); if (!checked.ok) return checked;
    const target = clone(newAdventure);
    // Preview is a copy. Commit uses a private prepared snapshot, never caller edits.
    const prepared = clone(checked.save);
    let committed = false;
    return { ok: true, preparedSave: clone(prepared), commit(currentSave) {
      if (committed) return fail('TRANSITION_COMMITTED', 'This replacement has already been committed.');
      let current;
      try { current = clone(currentSave); } catch (_) { return fail('STALE_TRANSITION', 'Current state differs from the prepared source.'); }
      if (!sameJSON(current, baseline)) return fail('STALE_TRANSITION', 'Gameplay changed after preparation; prepare the switch again.');
      const valid = validateAdventureSave(prepared, target); if (!valid.ok) return valid;
      committed = true;
      return valid; // Caller explicitly assigns this one save; no storage writes here.
    } };
  }
  function sameJSON(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(k => own(b, k) && sameJSON(a[k], b[k]));
  }
  return { LEGACY_ADVENTURE, createAdventureSave, loadAdventureSave, validateAdventureSave,
    migrateLegacySave, exportAdventureSave, resetAdventureSave: createAdventureSave,
    restoreScenarioEngine, captureScenarioState, prepareAdventureTransition };
});
