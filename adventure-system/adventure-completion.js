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
  function completedSave(save, now = Date.now()) {
    return { ...save, completed: true, completedAt: save.completedAt ?? now, lastSavedAt: now };
  }

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

  async function prepareVictory(storage, expectedRevision) {
    try {
      const { active, revision } = await storage.snapshot();
      if (!active) return fail('NO_ACTIVE_ADVENTURE');
      if (expectedRevision !== undefined && revision !== expectedRevision) return fail('STALE_TRANSITION');
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
  function applyActions(page, save, index, interaction) {
    const outcome = { ok: true };
    for (const action of page.actions || []) {
      const selected = action.buttonIndex;
      if (selected !== undefined && ![selected].flat().includes(index)) continue;
      const id = action.data;
      if (interaction && action.type === 'NEXT_SCAN' && selected === undefined && index !== 1) continue;
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
          const key = (action.item || interaction?.itemId) + '::' + id;
          const counters = save.itemState.counters;
          if (action.type === 'RESET_COUNTER') delete counters[key];
          else if (action.type === 'SET_COUNTER') counters[key] = action.value;
          else counters[key] = (counters[key] ?? 0) + (action.amount ?? 1);
          break;
        }
        case 'DROPDOWN_CHOICE':
        case 'DROPDOWN_INVENTORY':
          if (!interaction) return fail('UNSUPPORTED_ACTION');
          break;
        case 'START_ITEM_TIMER':
          if (!interaction) return fail('UNSUPPORTED_ACTION');
          if (save.inventory.includes(action.unlessHasItem)) delete save.itemTimers[id];
          else save.itemTimers[id] = { endAt: interaction.now + action.durationMs };
          break;
        case 'STOP_ITEM_TIMER':
          if (!interaction) return fail('UNSUPPORTED_ACTION');
          delete save.itemTimers[id];
          break;
        case 'START_TIMER': {
          if (!interaction) return fail('UNSUPPORTED_ACTION');
          const { encounterId, destination, encounter, now } = interaction;
          if (!encounterId || !own(encounter.pages, destination) ||
              (action.waitPage && !own(encounter.pages, action.waitPage))) return fail('INVALID_TIMER_DESTINATION');
          save.timers[encounterId] = { endAt: now + action.durationMs, resumePage: destination, waitPage: action.waitPage || null };
          save.encounters[encounterId] = '-1';
          outcome.waiting = true;
          break;
        }
        case 'NEXT_SCAN':
          if (!interaction) return fail('UNSUPPORTED_ACTION');
          if (!interaction.encounterId || !own(interaction.encounter.pages, interaction.destination)) return fail('INVALID_SCAN_DESTINATION');
          outcome.nextScan = true;
          break;
        default: return fail('UNSUPPORTED_ACTION');
      }
    }
    return outcome;
  }

  async function createCompletionEngine({ storage, live = false, expectedRevision } = {}) {
    let baseline;
    try { baseline = await storage.snapshot(); }
    catch (error) { return fail(error.code || 'STORAGE_ERROR'); }
    if (!baseline.active) return fail('NO_ACTIVE_ADVENTURE');
    if (expectedRevision !== undefined && baseline.revision !== expectedRevision) return fail('STALE_TRANSITION');
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
    const items = adventure.gameData.items;
    const pages = new Map([encounters, items].flatMap((owners, index) =>
      Object.entries(owners).flatMap(([id, owner]) =>
        Object.entries(owner.pages).map(([pageId, page]) => [pageId, { id, page, item: index === 1 }]))));
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
    function openPage(permission, page, encounter, readOnly = false, waitingUntil = null) {
      const view = Object.freeze({ ok: true, code: 'DIALOGUE_READY', page: copy(page),
        picture: page.picture || encounter.defaultPicture, readOnly, waitingUntil });
      current = { permission, page, encounter, view };
      return view;
    }

    function openItem(permission, collect) {
      const id = permission.itemId;
      const item = items[id];
      if (!resolver.authorizeMutation(permission) || !item) return fail('UNKNOWN_ITEM');
      if (item.requiredArea && !progress.flags.unlockedAreas.includes(item.requiredArea)) return fail('AREA_LOCKED');
      if (!progress.inventory.includes(id)) {
        if (!collect || progress.hadItems.includes(id)) return fail('ITEM_ALREADY_COLLECTED');
        progress = { ...progress, inventory: [...progress.inventory, id], hadItems: [...progress.hadItems, id] };
      }
      return openPage(permission, item.pages[item.startPage], item);
    }

    function scan(qr) {
      const denied = locked(); if (denied) return denied;
      current = null;
      const permission = linear && resolver.getStatus().finished
        ? resolver.reopenFinishedCheckpoint(qr) : resolver.scan(qr);
      if (live && permission.type === 'item') return openItem(permission, true);
      const owner = encounters[permission.encounterId];
      if (live && owner?.requiredArea && !progress.flags.unlockedAreas.includes(owner.requiredArea)) return fail('AREA_LOCKED');
      if (live && !linear && !history.getDistinctVisitedCount() &&
          adventure.gameData.progression?.eligibleStarts && !adventure.gameData.progression.eligibleStarts.includes(qr))
        return fail('START_NOT_ELIGIBLE');
      if (permission.type !== 'encounter' || !resolver.authorizeMutation(permission)) {
        if (live && owner && permission.ok) return openPage(permission, owner.pages[owner.startPage], owner, true);
        // Preview content may be displayed without exposing a usable permission.
        return { ok: false, code: permission.code, type: permission.type, expectedQR: permission.expectedQR,
          ...(permission.type === 'preview' ? { page: permission.encounter.pages[permission.encounter.startPage] } : {}) };
      }
      const encounter = encounters[permission.encounterId];
      const id = permission.encounterId;
      const next = copy(progress);
      const timer = live ? next.timers[id] : null;
      const savedPage = pages.get(next.encounters[id]);
      let page = live && savedPage && !savedPage.item && (savedPage.id === id || !linear)
        ? savedPage.page : encounter.pages[encounter.startPage];
      const waiting = timer && Date.now() < timer.endAt;
      if (timer) {
        if (waiting) page = encounter.pages[timer.waitPage] || page;
        else {
          page = encounter.pages[timer.resumePage];
          if (!page) return fail('INVALID_TIMER_DESTINATION');
          delete next.timers[id];
          next.encounters[id] = page.id;
        }
      }
      if (waiting) return openPage(permission, page, encounter, true, timer.endAt);
      const checked = validate(stage(next), adventure);
      if (!checked.ok) return checked;
      const visit = history.recordVisit(permission.encounterId, permission);
      if (!visit.ok) return visit;
      progress = { ...checked.save, encounterHistory: history.exportHistory() };
      return openPage(permission, page, encounter, !!waiting, waiting ? timer.endAt : null);
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
        if (live) pending = checked.save;
        return saved;
      }
      revision = saved.revision;
      persisted = progress = checked.save;
      pending = null;
      return status();
    }

    function isFinal(permission) {
      if (!permission.scenarioId || !permission.canCompleteCheckpoint) return false;
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

    async function choose(view, buttonIndex, selection) {
      const denied = locked(); if (denied) return denied;
      if (!current?.page || view !== current.view || view.waitingUntil) return fail('NO_AUTHORIZED_DIALOGUE');
      const { permission, page, encounter } = current;
      const authorized = resolver.authorizeMutation(permission);
      if (!authorized && (!live || permission.access !== 'full')) return fail('NO_AUTHORIZED_DIALOGUE');
      const button = page.buttons.find(button => button.index === buttonIndex);
      if (!button) return fail('UNKNOWN_BUTTON');
      try {
        if (!condition(page, buttonIndex, permission)) return fail('CONDITION_NOT_MET');
      } catch (_) { return fail('INVALID_CONDITION'); }

      const next = copy(progress);
      const dropdown = live && dropdownFor(page, buttonIndex);
      let destination = button.next;
      if (dropdown) {
        if (!authorized) return fail('NO_AUTHORIZED_DIALOGUE');
        if (dropdown.type === 'DROPDOWN_CHOICE') destination = Number.isInteger(selection) && dropdown.options[selection]?.next;
        else {
          if (selection !== '' && !progress.inventory.includes(selection)) return fail('INVALID_SELECTION');
          destination = dropdown.options.find(option => option.value === selection)?.next || dropdown.otherNext;
        }
        if (!destination) return fail('INVALID_SELECTION');
      }
      if (!authorized) {
        if (destination === 'HOME' || destination === '-1') return { ok: true, code: 'DIALOGUE_CLOSED' };
        if (!own(encounter.pages, destination)) return fail('NO_AUTHORIZED_DIALOGUE');
        return openPage(permission, encounter.pages[destination], encounter, true);
      }
      const pageOwner = pages.get(page.id);
      const applied = applyActions(page, next, buttonIndex, live ? { destination,
        encounter: pageOwner.item ? items[pageOwner.id] : encounters[pageOwner.id],
        encounterId: pageOwner.item ? null : pageOwner.id, itemId: pageOwner.item ? pageOwner.id : null, now: Date.now() } : null);
      if (!applied.ok) return applied;
      if (applied.waiting && applied.nextScan) return fail('CONFLICTING_ACTIONS');
      const checked = validate({ ...next, lastSavedAt: Date.now() }, adventure);
      if (!checked.ok) return checked;
      if (destination === 'TITLE_SCREEN') {
        const routeFinished = linear && resolver.getStatus().finished;
        if (linear && (!permission.encounterId || (!routeFinished && !isFinal(permission)))) return fail('INCOMPLETE_ROUTE');
        const now = checked.save.lastSavedAt;
        if (linear && !routeFinished) {
          const checkpoint = resolver.completeCheckpoint(permission);
          if (!checkpoint.ok || !checkpoint.finished) return fail('INCOMPLETE_ROUTE');
        }
        current = null;
        pending = stage(completedSave(checked.save, now));
        return flush();
      }
      const target = pages.get(destination);
      const crossCheckpoint = linear && permission.encounterId && !resolver.getStatus().finished &&
        target && !own(encounter.pages, destination);
      if (crossCheckpoint && live) {
        const route = adventure.scenarioData.scenarios[permission.scenarioId];
        const nextQR = route.sequence[resolver.getStatus().currentIndex + 1];
        if (target.item || target.id !== route.encounters[nextQR]) return fail('SCAN_REQUIRED');
      }
      if (live && (applied.waiting || applied.nextScan || destination === 'HOME' || destination === '-1' ||
          crossCheckpoint)) {
        const save = checked.save;
        if (permission.encounterId && !applied.waiting)
          save.encounters[permission.encounterId] = applied.nextScan ? destination : encounter.startPage;
        current = null;
        if (linear && permission.canCompleteCheckpoint && !applied.waiting && !applied.nextScan) {
          const checkpoint = resolver.completeCheckpoint(permission);
          if (!checkpoint.ok) return checkpoint;
        }
        progress = stage(save);
        return { ok: true, code: 'DIALOGUE_CLOSED' };
      }
      if (destination === 'HOME' || destination === '-1') {
        progress = checked.save;
        current = { permission };
        return { ok: true, code: 'DIALOGUE_CLOSED' };
      }
      if (!target) return fail('SCAN_REQUIRED');
      if (linear && !own(encounter.pages, destination)) {
        if (!permission.scenarioId) return fail('SCAN_REQUIRED');
        const activeRoute = adventure.scenarioData.scenarios[permission.scenarioId];
        if (target.item || !resolver.getStatus().finished || !Object.values(activeRoute.encounters).includes(target.id))
          return fail('SCAN_REQUIRED');
      }
      if (live) {
        const owner = (target.item ? items : encounters)[target.id];
        if (owner.requiredArea && !next.flags.unlockedAreas.includes(owner.requiredArea)) return fail('AREA_LOCKED');
        if (target.item && !next.inventory.includes(target.id)) return fail('UNKNOWN_ITEM');
      }
      if (live && permission.encounterId) checked.save.encounters[permission.encounterId] = destination;
      progress = checked.save;
      return openPage(permission, target.page, encounter);
    }

    function dropdownFor(page, index) {
      return page.actions.find(action => ['DROPDOWN_CHOICE', 'DROPDOWN_INVENTORY'].includes(action.type) &&
        (action.buttonIndex === undefined ? index === 1 : [action.buttonIndex].flat().includes(index)));
    }
    function condition(page, index, permission) {
      const owner = pages.get(page.id);
      return !own(page.condition || {}, index) ||
        history.evaluateCondition(page.condition[index], { save: progress }, { itemName: owner?.item ? owner.id : permission.itemId });
    }
    function choices(view) {
      if (view !== current?.view || view.waitingUntil || current.permission.access !== 'full') return [];
      return current.page.buttons.filter(button => {
        try { return condition(current.page, button.index, current.permission); }
        catch (_) { return false; }
      }).flatMap(button => {
        const dropdown = dropdownFor(current.page, button.index);
        if (view.readOnly && (dropdown || !['HOME', '-1'].includes(button.next) &&
            !own(current.encounter.pages, button.next))) return [];
        return [{ index: button.index, label: button.label, ...(dropdown ? { dropdown: copy(dropdown) } : {}) }];
      });
    }
    return { ok: true, engine: Object.freeze({ scan, choose, confirmCheckpoint, flush, choices,
      close() { current = null; resolver.close(); },
      openItem(id) {
        const denied = locked(); if (denied) return denied;
        current = null;
        if (!live || !progress.inventory.includes(id)) { resolver.close(); return fail('UNKNOWN_ITEM'); }
        return openItem(resolver.openOwnedItem(id), false);
      }, getCompletionStatus: status, getRevision: () => revision, hasPendingWrite: () => !!pending,
      getCompletionSummary: () => summary(persisted, adventure), getProgress: () => copy(progress) }) };
  }
  // The legacy dispatcher has already executed the trusted original button.
  function finishTrustedBuiltIn(save) {
    return save.adventure?.id === saves.LEGACY_ADVENTURE.id ? completedSave(save) : save;
  }
  return { createCompletionEngine, prepareVictory, finishTrustedBuiltIn };
});
