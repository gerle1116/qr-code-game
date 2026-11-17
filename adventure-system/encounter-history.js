/* Stage 5: standalone visit tracking. No camera, storage or live gameplay. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../mod-system/mod-conditions.js'));
  else root.QRCQEncounterHistory = factory(root.QRCQModConditions);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (conditions) {
  'use strict';
  const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
  const record = v => v !== null && typeof v === 'object' && !Array.isArray(v) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(v));
  const validId = id => typeof id === 'string' &&
    /^(?:[0-9]{2}|[a-z][a-z0-9-]*(?::[0-9]{2})?)$/.test(id) &&
    !['__proto__', 'constructor', 'prototype'].includes(id);
  const fail = (code, message) => ({ ok: false, code, message });

  function validateHistory(data, accepts = validId) {
    if (!record(data) || !record(data.visits) || !Number.isSafeInteger(data.distinctVisited) ||
        data.distinctVisited !== Object.keys(data.visits).length ||
        !Object.entries(data.visits).every(([id, count]) => validId(id) && accepts(id) &&
          Number.isSafeInteger(count) && count > 0))
      return fail('INVALID_HISTORY', 'History requires valid encounter IDs, positive safe counts and exact distinctVisited.');
    return { ok: true, history: { visits: { ...data.visits }, distinctVisited: data.distinctVisited } };
  }

  // Same safe expression parser as Stage 1; visit functions are opt-in here only.
  function conditionContext(encounters, history) {
    return { visitConditions: {
      validId: id => validId(id) && own(encounters, id),
      count: id => id === null ? history.getDistinctVisitedCount() : history.getVisitCount(id)
    } };
  }
  function validateCondition(expression, encounters) {
    try {
      conditions.evaluate(expression, {}, '', conditionContext(encounters, {
        getDistinctVisitedCount: () => 0, getVisitCount: () => 0
      }));
      return null;
    } catch (e) { return e.message; }
  }

  function createEncounterHistory({ gameData, resolver } = {}) {
    if (!gameData || !record(gameData.encounters) || !Object.keys(gameData.encounters).every(validId) ||
        !resolver || typeof resolver.authorizeMutation !== 'function')
      return fail('INVALID_CONTEXT', 'Supply validated gameData and its trusted Stage 3 resolver.');
    const encounters = Object.fromEntries(Object.keys(gameData.encounters).map(id => [id, true]));
    const authorize = resolver.authorizeMutation.bind(resolver);
    let visits = {};
    const consumed = new WeakSet();
    const getVisitCount = id => validId(id) && own(visits, id) ? visits[id] : 0;
    const getDistinctVisitedCount = () => Object.keys(visits).length;
    const exportHistory = () => ({ visits: { ...visits }, distinctVisited: getDistinctVisitedCount() });
    function recordVisit(encounterId, permission) {
      if (!validId(encounterId) || !own(encounters, encounterId) || !authorize(permission) ||
          permission.type !== 'encounter' || permission.encounterId !== encounterId || consumed.has(permission))
        return fail('VISIT_NOT_AUTHORIZED', 'Use a current resolver-issued encounter permission once, after successful opening.');
      const count = getVisitCount(encounterId);
      if (count === Number.MAX_SAFE_INTEGER) return fail('VISIT_OVERFLOW', 'Visit count cannot exceed safe integer precision.');
      visits[encounterId] = count + 1;
      consumed.add(permission);
      return { ok: true, encounterId, count: count + 1 };
    }
    const history = Object.freeze({ recordVisit,
      hasVisited: id => getVisitCount(id) > 0, getVisitCount, getDistinctVisitedCount, exportHistory,
      restoreHistory(data) {
        const checked = validateHistory(data, id => own(encounters, id));
        if (!checked.ok) return checked;
        visits = checked.history.visits; // Replace, never merge or increment.
        return { ok: true };
      },
      resetHistory() { visits = {}; return { ok: true }; },
      evaluateCondition(expression, state = {}, context = {}) {
        return conditions.evaluate(expression, state, '', { ...context, ...conditionContext(encounters, history) });
      }
    });
    return { ok: true, history };
  }
  return { createEncounterHistory, validateHistory, validateCondition };
});
