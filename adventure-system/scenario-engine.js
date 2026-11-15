/* Standalone linear scenario engine. Consumes validated Stage 1 JSON data. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QRCQScenarioEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const qrCode = value => typeof value === 'string' && /^\d{2}$/.test(value);
  const clone = value => JSON.parse(JSON.stringify(value));
  const failure = (code, message) => ({ ok: false, code, message });

  function createScenarioEngine(scenarioData, gameData) {
    // Copy input so callers cannot change routes or encounter content mid-playthrough.
    let data, game;
    try { data = clone(scenarioData); game = clone(gameData); }
    catch (_) { return failure('INVALID_DATA', 'Scenario and game data must be serializable JSON objects.'); }
    if (!record(data) || data.formatVersion !== 1 || !record(data.scenarios) ||
        !Object.keys(data.scenarios).length || !record(game) || game.formatVersion !== 1 || !record(game.encounters)) {
      return failure('INVALID_DATA', 'Expected Stage 1 formatVersion 1 scenario and game data.');
    }
    // This is an integrity guard, not a replacement for the Stage 1 package validator.
    const starts = new Map();
    for (const [id, s] of Object.entries(data.scenarios)) {
      if (!/^[a-z][a-z0-9-]*$/.test(id) || ['constructor', 'prototype'].includes(id) || !record(s) ||
          !qrCode(s.startQR) || starts.has(s.startQR) || !Array.isArray(s.sequence) ||
          !s.sequence.length || s.sequence[0] !== s.startQR || !s.sequence.every(qrCode) ||
          new Set(s.sequence).size !== s.sequence.length || !record(s.encounters) ||
          !['block', 'preview', 'allow'].includes(s.outOfOrder)) {
        return failure('INVALID_DATA', `Scenario ${id} has an invalid start, sequence or policy.`);
      }
      if (Object.keys(s.encounters).some(q => !s.sequence.includes(q)) || s.sequence.some(q => {
        if (!own(s.encounters, q) || typeof s.encounters[q] !== 'string' || !own(game.encounters, s.encounters[q])) return true;
        const encounter = game.encounters[s.encounters[q]];
        return !record(encounter) || !record(encounter.pages) || !own(encounter.pages, encounter.startPage);
      })) return failure('INVALID_DATA', `Scenario ${id} has a missing or invalid encounter mapping.`);
      starts.set(s.startQR, id);
    }

    let state = { scenarioId: null, currentIndex: 0, completedCheckpoints: [] };
    let pendingQR = null;
    const active = () => state.scenarioId === null ? null : data.scenarios[state.scenarioId];
    const finished = () => active() !== null && state.currentIndex === active().sequence.length;
    const expected = () => active() && !finished() ? active().sequence[state.currentIndex] : null;
    const exportState = () => clone(state);
    const result = (ok, code, message, extra = {}) => ({
      ok, code, message, scenarioId: state.scenarioId, currentIndex: state.currentIndex,
      expectedQR: expected(), finished: finished(), state: exportState(), ...extra
    });
    const denied = (code, message, extra = {}) => result(false, code, message, {
      access: 'none', encounterId: null, encounter: null, readOnly: true,
      canCompleteCheckpoint: false, progressionSensitiveActionsAllowed: false, ...extra
    });

    function scan(qr) {
      // Any new scan replaces the interaction context, even when that scan fails.
      pendingQR = null;
      if (!qrCode(qr)) return denied('INVALID_QR', 'QR must be an exact two-digit string.');
      if (finished()) return denied('SCENARIO_FINISHED', 'This scenario is finished; scanning cannot restart it.', { qr });
      if (!active()) {
        if (!starts.has(qr)) return denied('INVALID_START', 'This QR is not a starting QR for any scenario.', { qr });
        state.scenarioId = starts.get(qr);
      }
      const scenario = active();
      if (!own(scenario.encounters, qr)) return denied('UNKNOWN_QR', 'This QR is not part of the selected scenario.', { qr });
      const isExpected = qr === expected();
      const alreadyCompleted = state.completedCheckpoints.includes(qr);
      if (!isExpected && scenario.outOfOrder === 'block') {
        return denied('OUT_OF_ORDER', `Scan ${expected()} before opening this encounter.`, {
          qr, access: 'blocked', alreadyCompleted
        });
      }
      const preview = !isExpected && scenario.outOfOrder === 'preview';
      if (isExpected) pendingQR = qr;
      const encounterId = scenario.encounters[qr];
      return result(true, isExpected ? 'ENCOUNTER_READY' : preview ? 'PREVIEW' : 'OUT_OF_ORDER_ALLOWED',
        isExpected ? 'Expected checkpoint encounter is ready.' : preview ?
          'Read-only preview; checkpoint progress is unchanged.' :
          'Encounter is accessible out of order; checkpoint progress is unchanged.', {
          qr, encounterId, encounter: clone(game.encounters[encounterId]),
          access: preview ? 'preview' : 'full', readOnly: preview,
          canCompleteCheckpoint: isExpected, progressionSensitiveActionsAllowed: isExpected,
          alreadyCompleted
        });
    }

    function completeCheckpoint(qr) {
      if (!qrCode(qr)) return result(false, 'INVALID_QR', 'Checkpoint QR must be an exact two-digit string.');
      if (!active()) return result(false, 'NO_SCENARIO', 'Scan a starting QR before completing a checkpoint.');
      if (!own(active().encounters, qr)) return result(false, 'UNKNOWN_QR', 'This QR is not part of the selected scenario.');
      if (state.completedCheckpoints.includes(qr)) return result(false, 'ALREADY_COMPLETED', 'This checkpoint has already been completed.');
      if (finished()) return result(false, 'SCENARIO_FINISHED', 'This scenario is already finished.');
      if (qr !== expected()) return result(false, 'OUT_OF_ORDER', `Only checkpoint ${expected()} can be completed next.`);
      if (pendingQR !== qr) return result(false, 'SCAN_REQUIRED', 'Scan the expected QR before confirming its gameplay interaction.');
      state.completedCheckpoints.push(qr);
      state.currentIndex++;
      pendingQR = null;
      return result(true, finished() ? 'SCENARIO_COMPLETED' : 'CHECKPOINT_COMPLETED',
        finished() ? 'The final checkpoint is complete; the scenario is finished.' : 'Checkpoint completed.', { qr });
    }

    function restoreState(saved) {
      // Validate the complete snapshot before changing any live state or scan context.
      if (!record(saved) || Object.keys(saved).length !== 3 ||
          !['scenarioId', 'currentIndex', 'completedCheckpoints'].every(k => own(saved, k)) ||
          !Number.isInteger(saved.currentIndex) || saved.currentIndex < 0 ||
          !Array.isArray(saved.completedCheckpoints)) {
        return result(false, 'INVALID_STATE', 'Saved progress must contain scenarioId, an integer currentIndex and completedCheckpoints.');
      }
      if (saved.scenarioId === null) {
        if (saved.currentIndex !== 0 || saved.completedCheckpoints.length !== 0)
          return result(false, 'INVALID_STATE', 'Unselected progress must have index 0 and no completed checkpoints.');
      } else {
        if (typeof saved.scenarioId !== 'string' || !own(data.scenarios, saved.scenarioId))
          return result(false, 'INVALID_SCENARIO', 'Saved scenario ID does not exist in the loaded adventure.');
        const sequence = data.scenarios[saved.scenarioId].sequence;
        if (saved.currentIndex > sequence.length || saved.completedCheckpoints.length !== saved.currentIndex ||
            !sequence.slice(0, saved.currentIndex).every((qr, i) => saved.completedCheckpoints[i] === qr))
          return result(false, 'INVALID_STATE', 'Completed checkpoints must exactly match the route prefix before currentIndex.');
      }
      if (state.scenarioId !== null && saved.scenarioId !== state.scenarioId)
        return result(false, 'SCENARIO_LOCKED', 'Progress cannot switch or clear the selected scenario. Use a fresh engine to load another playthrough.');
      if (saved.currentIndex < state.currentIndex)
        return result(false, 'PROGRESS_ROLLBACK', 'Saved progress cannot undo completed checkpoints in an active playthrough.');
      state = { scenarioId: saved.scenarioId, currentIndex: saved.currentIndex, completedCheckpoints: [...saved.completedCheckpoints] };
      pendingQR = null;
      return result(true, 'STATE_RESTORED', 'Progress restored. Scan the expected QR to resume its interaction.');
    }

    return { ok: true, engine: Object.freeze({
      scan, completeCheckpoint, exportState, restoreState,
      getStatus: () => result(true, 'STATUS', 'Current scenario progress.')
    }) };
  }
  return { createScenarioEngine };
});
