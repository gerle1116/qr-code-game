/* Standalone Stage 3 resolution. No rendering, action execution or persistence. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./scenario-engine.js'));
  else root.QRCQQRResolver = factory(root.QRCQScenarioEngine);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (scenarioAPI) {
  'use strict';
  const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
  const copy = v => JSON.parse(JSON.stringify(v));
  const qrPattern = /^(?:[0-9]{2}|[a-z][a-z0-9-]{1,47}:[0-9]{2})$/;
  const failure = code => ({ ok: false, type: 'error', code, errorId: code,
    qr: null, encounterId: null, scenarioId: null, encounter: null,
    access: 'none', readOnly: true, canCompleteCheckpoint: false,
    progressionSensitiveActionsAllowed: false });

  // Inputs must already have passed Stage 1 package validation. These guards
  // protect the resolution boundary; they do not validate files or dialogue code.
  function createQRResolver(options) {
    let manifest, game, scenarios;
    try {
      manifest = copy(options.manifest);
      game = copy(options.gameData);
      scenarios = options.scenarioData === undefined ? undefined : copy(options.scenarioData);
    } catch (_) { return failure('INVALID_DATA'); }
    if (!record(manifest) || manifest.formatVersion !== 1 ||
        !['linear', 'circular', 'non-linear'].includes(manifest.type) ||
        !record(game) || game.formatVersion !== 1 || !record(game.encounters) ||
        !Object.keys(game.encounters).length || !record(game.items) || !record(game.questDisplayNames)) {
      return failure('INVALID_DATA');
    }
    for (const [id, encounter] of Object.entries(game.encounters)) {
      if (['__proto__', 'constructor', 'prototype'].includes(id) ||
          (manifest.type !== 'linear' && !qrPattern.test(id)) ||
          !record(encounter) || typeof encounter.startPage !== 'string' ||
          !record(encounter.pages) || !own(encounter.pages, encounter.startPage) ||
          !record(encounter.pages[encounter.startPage])) return failure('INVALID_DATA');
    }
    let engine = null;
    if (manifest.type === 'linear') {
      if (!scenarioAPI || typeof scenarioAPI.createScenarioEngine !== 'function') return failure('ENGINE_UNAVAILABLE');
      const created = scenarioAPI.createScenarioEngine(scenarios, game);
      if (!created.ok) return failure(created.code);
      engine = created.engine;
      if (options.initialScenarioState !== undefined) {
        const restored = engine.restoreState(options.initialScenarioState);
        if (!restored.ok) return failure(restored.code);
      }
    } else if (scenarios !== undefined || manifest.scenarios !== undefined) return failure('INVALID_DATA');

    let current = null;
    const issued = new WeakMap();
    function publish(result) {
      current = Object.freeze(result);
      // Keep a private permission snapshot: returned encounter content is data,
      // never executable authorization. Forged/copied/old results cannot authorize.
      issued.set(current, { mutation: result.ok && result.access === 'full' &&
        !result.readOnly && result.progressionSensitiveActionsAllowed === true,
        checkpoint: result.canCompleteCheckpoint === true, qr: result.qr });
      return current;
    }
    function scan(qr) {
      current = null; // Every scan, including invalid scans, revokes old context.
      if (engine) {
        const r = engine.scan(qr);
        const type = r.ok ? (r.readOnly ? 'preview' : 'encounter') :
          r.code === 'OUT_OF_ORDER' ? 'blocked' :
          ['INVALID_QR', 'INVALID_START', 'UNKNOWN_QR'].includes(r.code) ? 'unknown' : 'error';
        return publish({ ...r, qr, type, errorId: r.ok ? null : r.code });
      }
      const base = { ...failure('UNKNOWN_QR'), type: 'unknown', qr };
      if (typeof qr !== 'string' || !qrPattern.test(qr)) {
        return publish({ ...base, code: 'INVALID_QR', errorId: 'INVALID_QR' });
      }
      if (own(game.encounters, qr)) return publish({ ...base, ok: true,
        type: 'encounter', code: 'ENCOUNTER_READY', errorId: null,
        encounterId: qr, encounter: copy(game.encounters[qr]), access: 'full',
        readOnly: false, progressionSensitiveActionsAllowed: true });
      // Match the original scanner: encounter first, then first item whose
      // start-page prefix matches. Resolving an item never collects it.
      for (const [name, item] of Object.entries(game.items)) {
        const page = String(item && item.startPage || '');
        const colon = page.indexOf(':');
        const itemQR = (colon >= 0 ? page.slice(0, colon + 1) : '') + page.slice(colon + 1, colon + 3);
        if (itemQR === qr) return publish({ ...base, ok: true, type: 'item',
          code: 'ITEM_READY', errorId: null, itemId: name, item: copy(item),
          access: 'full', readOnly: false, progressionSensitiveActionsAllowed: true });
      }
      return publish(base);
    }
    function authorizeMutation(result) {
      return result === current && issued.has(result) && issued.get(result).mutation === true;
    }
    function openOwnedItem(id) {
      current = null;
      if (!own(game.items, id)) return failure('UNKNOWN_ITEM');
      // Ownership is checked by the session before asking the resolver to open it.
      return publish({ ...failure('UNKNOWN_ITEM'), ok: true, code: 'ITEM_READY',
        type: 'item', itemId: id, access: 'full', readOnly: false, progressionSensitiveActionsAllowed: true });
    }
    function completeCheckpoint(result) {
      if (!engine || !authorizeMutation(result) || !issued.get(result).checkpoint) return failure('CHECKPOINT_NOT_AUTHORIZED');
      const completed = engine.completeCheckpoint(issued.get(result).qr);
      current = null;
      return completed;
    }
    // Stage 10 can resume authored route dialogue after route-only progress was saved.
    // Ordinary scans retain their Stage 3 behavior on a finished route.
    function reopenFinishedCheckpoint(qr) {
      current = null;
      const status = engine?.getStatus();
      if (!status?.finished || !status.state.completedCheckpoints.includes(qr))
        return failure('COMPLETED_CHECKPOINT_REQUIRED');
      const encounterId = scenarios.scenarios[status.scenarioId].encounters[qr];
      return publish({ ...status, qr, type: 'encounter', encounterId, encounter: copy(game.encounters[encounterId]),
        access: 'full', readOnly: false, canCompleteCheckpoint: false, progressionSensitiveActionsAllowed: true });
    }
    return { ok: true, resolver: Object.freeze({ scan, authorizeMutation, completeCheckpoint,
      reopenFinishedCheckpoint, openOwnedItem, close: () => { current = null; },
      getStatus: () => engine ? engine.getStatus() : { ok: true, scenarioId: null } }) };
  }
  return { createQRResolver };
});
