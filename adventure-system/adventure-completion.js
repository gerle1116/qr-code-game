/* Stage 10 standalone, data-only dialogue and completion session. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(
    require('./adventure-save.js'), require('./qr-resolver.js'), require('./encounter-history.js'));
  else root.QRCQAdventureCompletion = factory(root.QRCQAdventureSave, root.QRCQQRResolver, root.QRCQEncounterHistory);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (saves, qrAPI, historyAPI) {
  'use strict';
  const fail = code => ({ ok: false, code });
  const own = Object.hasOwn;
  const copy = value => JSON.parse(JSON.stringify(value));

  function validate(save, adventure) {
    const checked = saves.validateAdventureSave(save, adventure);
    if (!checked.ok) return checked;
    save = checked.save;
    return save.adventure.type === 'linear' && save.completed && !save.scenarioFinished
      ? fail('INCOMPLETE_ROUTE') : checked;
  }

  function summary(save, adventure) {
    const checked = validate(save, adventure);
    if (!checked.ok) return checked;
    save = checked.save;
    if (!save.completed) return fail('NOT_COMPLETED');
    const { id, type, name } = adventure.manifest;
    return { ok: true, completed: true, adventureId: id, adventureName: name || id, adventureType: type,
      scenarioId: save.scenarioState?.scenarioId || null, completedAt: save.completedAt ?? null,
      distinctVisited: save.encounterHistory.distinctVisited,
      finishedQuests: Object.values(save.quests).filter(status => status === 'completed').length };
  }

  async function write(storage, save, revision) {
    try { return await storage.updateSave(save, revision); }
    catch (error) { return fail(error.code || 'STORAGE_ERROR'); }
  }

  async function prepareVictory(storage) {
    try {
      const { active, revision } = await storage.snapshot();
      if (!active) return fail('NO_ACTIVE_ADVENTURE');
      const result = summary(active.save, active.adventure);
      if (!result.ok) return result;
      let replayed = false;
      return { ...result, async replay({ confirmed = false } = {}) {
        if (confirmed !== true) return fail('CONFIRMATION_REQUIRED');
        if (replayed) return fail('STALE_TRANSITION');
        const fresh = saves.createAdventureSave(active.adventure);
        if (!fresh.ok) return fresh;
        const checked = validate(fresh.save, active.adventure);
        if (!checked.ok) return checked;
        const saved = await write(storage, checked.save, revision);
        if (saved.ok) replayed = true;
        return saved;
      } };
    } catch (error) { return fail(error.code || 'STORAGE_ERROR'); }
  }

  // Transition actions supported by this standalone dispatcher. Reject
  // other selected actions before changing the current interaction or save.
  function applyActions(page, save, index) {
    for (const action of page.actions || []) {
      const selected = action.buttonIndex;
      if (selected !== undefined && ![selected].flat().includes(index)) continue;
      const id = action.data;
      switch (action.type) {
        case 'START_QUEST':
          if (save.quests[id] !== 'completed') save.quests[id] = 'active';
          break;
        case 'COMPLETE_QUEST': save.quests[id] = 'completed'; break;
        case 'ADD_ITEM':
          if (!save.inventory.includes(id)) save.inventory.push(id);
          if (!save.hadItems.includes(id)) save.hadItems.push(id);
          break;
        case 'REMOVE_ITEM': save.inventory = save.inventory.filter(item => item !== id); break;
        case 'ADD_KNOWLEDGE':
          if (!save.knowledge.includes(id)) save.knowledge.push(id);
          break;
        case 'UNLOCK_AREA':
          if (!save.flags.unlockedAreas.includes(id)) save.flags.unlockedAreas.push(id);
          break;
        case 'OPEN_CASTLE': save.flags.castleOpen = true; break;
        case 'ADD_COUNTER':
        case 'SET_COUNTER':
        case 'RESET_COUNTER': {
          const key = action.item + '::' + id;
          const counters = save.itemState.counters;
          if (action.type === 'RESET_COUNTER') delete counters[key];
          else if (action.type === 'SET_COUNTER') counters[key] = action.value;
          else counters[key] = (counters[key] ?? 0) + (action.amount ?? 1);
          break;
        }
        default: return fail('UNSUPPORTED_ACTION');
      }
    }
    return { ok: true };
  }

  async function createCompletionEngine({ storage } = {}) {
    let baseline;
    try { baseline = await storage.snapshot(); }
    catch (error) { return fail(error.code || 'STORAGE_ERROR'); }
    if (!baseline.active) return fail('NO_ACTIVE_ADVENTURE');
    const adventure = copy(baseline.active.adventure);
    const initial = validate(baseline.active.save, adventure);
    if (!initial.ok) return initial;
    const created = qrAPI.createQRResolver({ ...adventure, initialScenarioState: initial.save.scenarioState });
    if (!created.ok) return created;
    const { resolver } = created;
    const tracked = historyAPI.createEncounterHistory({ gameData: adventure.gameData, resolver });
    if (!tracked.ok) return tracked;
    const { history } = tracked;
    const restored = history.restoreHistory(initial.save.encounterHistory);
    if (!restored.ok) return restored;

    const linear = adventure.manifest.type === 'linear';
    const encounters = adventure.gameData.encounters;
    const pages = new Map(Object.entries(encounters).flatMap(([id, encounter]) =>
      Object.entries(encounter.pages).map(([pageId, page]) => [pageId, { id, page }])));
    let revision = baseline.revision;
    let progress = initial.save, persisted = initial.save;
    let current, pending, busy = false, stale = false;
    const status = () => ({ ok: true, completed: persisted.completed,
      scenarioFinished: persisted.scenarioFinished, scenarioId: progress.scenarioState?.scenarioId || null,
      adventureId: adventure.manifest.id, adventureType: adventure.manifest.type, pendingVictory: !!pending?.completed });
    const locked = () => stale ? fail('STALE_TRANSITION') : busy ? fail('SAVE_IN_PROGRESS') :
      pending ? fail('SAVE_PENDING') : persisted.completed ? fail('ALREADY_COMPLETED') : null;
    const stage = save => {
      if (!linear) return save;
      const { state, finished } = resolver.getStatus();
      return { ...save, scenarioState: state, scenarioFinished: finished };
    };
    function openPage(permission, page, encounter) {
      const view = Object.freeze({ ok: true, code: 'DIALOGUE_READY', page: copy(page) });
      current = { permission, page, encounter, view };
      return view;
    }

    function scan(qr) {
      const denied = locked(); if (denied) return denied;
      current = null;
      const permission = linear && resolver.getStatus().finished
        ? resolver.reopenFinishedCheckpoint(qr) : resolver.scan(qr);
      if (permission.type !== 'encounter' || !resolver.authorizeMutation(permission)) {
        // Preview content may be displayed without exposing a usable permission.
        return { ok: false, code: permission.code, type: permission.type,
          ...(permission.type === 'preview' ? { page: permission.encounter.pages[permission.encounter.startPage] } : {}) };
      }
      const encounter = encounters[permission.encounterId];
      const page = encounter.pages[encounter.startPage];
      const checked = validate(stage(progress), adventure);
      if (!checked.ok) return checked;
      const visit = history.recordVisit(permission.encounterId, permission);
      if (!visit.ok) return visit;
      progress = { ...checked.save, encounterHistory: history.exportHistory() };
      return openPage(permission, page, encounter);
    }

    async function flush() {
      if (stale) return fail('STALE_TRANSITION');
      if (busy) return fail('SAVE_IN_PROGRESS');
      if (persisted.completed) return status();
      const checked = validate(pending || { ...progress, lastSavedAt: Date.now() }, adventure);
      if (!checked.ok) return checked;
      busy = true;
      const saved = await write(storage, checked.save, revision);
      busy = false;
      if (!saved.ok) {
        stale = saved.code === 'STALE_TRANSITION';
        return saved;
      }
      revision = saved.revision;
      persisted = progress = checked.save;
      pending = null;
      return status();
    }

    function isFinal(permission) {
      const route = adventure.scenarioData.scenarios[permission.scenarioId];
      return permission.qr === route.sequence.at(-1) && resolver.getStatus().expectedQR === permission.qr;
    }

    async function confirmCheckpoint() {
      const denied = locked(); if (denied) return denied;
      if (!linear || !current || !resolver.authorizeMutation(current.permission)) return fail('NO_AUTHORIZED_CHECKPOINT');
      if (!current.permission.canCompleteCheckpoint) return fail('NO_AUTHORIZED_CHECKPOINT');
      const confirmed = resolver.completeCheckpoint(current.permission);
      if (!confirmed.ok) return confirmed;
      current = null;
      pending = stage({ ...progress, lastSavedAt: Date.now() });
      return flush();
    }

    async function choose(view, buttonIndex) {
      const denied = locked(); if (denied) return denied;
      if (!current?.page || view !== current.view || !resolver.authorizeMutation(current.permission)) return fail('NO_AUTHORIZED_DIALOGUE');
      const { permission, page, encounter } = current;
      const button = page.buttons.find(button => button.index === buttonIndex);
      if (!button) return fail('UNKNOWN_BUTTON');
      try {
        if (own(page.condition || {}, buttonIndex) &&
            !history.evaluateCondition(page.condition[buttonIndex], { save: progress })) return fail('CONDITION_NOT_MET');
      } catch (_) { return fail('INVALID_CONDITION'); }

      const next = copy(progress);
      const applied = applyActions(page, next, buttonIndex);
      if (!applied.ok) return applied;
      const destination = button.next;
      const checked = validate({ ...next, lastSavedAt: Date.now() }, adventure);
      if (!checked.ok) return checked;
      if (destination === 'TITLE_SCREEN') {
        const routeFinished = linear && resolver.getStatus().finished;
        if (linear && !routeFinished && !isFinal(permission)) return fail('INCOMPLETE_ROUTE');
        const now = checked.save.lastSavedAt;
        if (linear && !routeFinished) {
          const checkpoint = resolver.completeCheckpoint(permission);
          if (!checkpoint.ok || !checkpoint.finished) return fail('INCOMPLETE_ROUTE');
        }
        current = null;
        pending = stage({ ...checked.save, completed: true, completedAt: now });
        return flush();
      }
      if (destination === 'HOME' || destination === '-1') {
        progress = checked.save;
        current = { permission };
        return { ok: true, code: 'DIALOGUE_CLOSED' };
      }
      const target = pages.get(destination);
      if (!target) return fail('SCAN_REQUIRED');
      if (linear && !own(encounter.pages, destination)) {
        const activeRoute = adventure.scenarioData.scenarios[permission.scenarioId];
        if (!resolver.getStatus().finished || !Object.values(activeRoute.encounters).includes(target.id))
          return fail('SCAN_REQUIRED');
      }
      progress = checked.save;
      return openPage(permission, target.page, encounter);
    }

    return { ok: true, engine: Object.freeze({ scan, choose, confirmCheckpoint, flush, getCompletionStatus: status,
      getCompletionSummary: () => summary(persisted, adventure), getProgress: () => copy(progress) }) };
  }
  return { createCompletionEngine, prepareVictory };
});
