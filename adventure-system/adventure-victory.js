(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(
    require('./adventure-completion.js'), require('./adventure-browser.js'));
  else root.QRCQAdventureVictory = factory(root.QRCQAdventureCompletion, root.QRCQAdventureBrowser);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (completion, browser) {
  'use strict';
  const messages = {
    en: { heading: 'Adventure Complete!', congrats: 'Congratulations! You completed', scenario: 'Scenario',
      summary: 'View Summary', replay: 'Replay Adventure', back: 'Back to Adventures', date: 'Completed',
      visits: 'Distinct NPCs visited', quests: 'Quests finished', warning: 'Replay resets all progress in this adventure.',
      cancel: 'Cancel', confirm: 'Reset and replay', failed: 'Replay could not be saved.', stale: 'The active save changed. Return to Adventures and reopen it.' },
    hu: { heading: 'Kaland teljesítve!', congrats: 'Gratulálunk! Teljesítetted ezt a kalandot:', scenario: 'Forgatókönyv',
      summary: 'Összegzés megtekintése', replay: 'Kaland újrajátszása', back: 'Vissza a kalandokhoz', date: 'Teljesítve',
      visits: 'Felkeresett szereplők', quests: 'Befejezett küldetések', warning: 'Az újrajátszás törli a kalandban elért összes haladást.',
      cancel: 'Mégse', confirm: 'Törlés és újrajátszás', failed: 'Az új játék mentése sikertelen.', stale: 'Az aktív mentés megváltozott. Térj vissza a kalandokhoz, és nyisd meg újra.' }
  };

  async function mountVictory({ container, storage, locale = 'en', expectedRevision, onBack, onReplay } = {}) {
    const victory = await completion.prepareVictory(storage, expectedRevision);
    if (!victory.ok) return victory;
    const language = locale.toLowerCase().split('-')[0] === 'hu' ? 'hu' : 'en';
    const t = key => messages[language][key];
    const doc = container.ownerDocument;
    const controller = new doc.defaultView.AbortController();
    const listen = (node, type, handler) => node.addEventListener(type, handler, { signal: controller.signal });
    function add(parent, tag, value, className) {
      const node = doc.createElement(tag);
      if (value !== undefined) node.textContent = value;
      if (className) node.className = className;
      parent.append(node);
      return node;
    }
    const root = add(container, 'section', undefined, 'av-victory');
    root.lang = language;
    const seal = add(root, 'div', '♛', 'av-seal');
    seal.setAttribute('aria-hidden', 'true');
    const heading = add(root, 'h1', t('heading'));
    heading.tabIndex = -1;
    add(root, 'p', `${t('congrats')} ${victory.adventureName}.`);
    const type = browser.typeInfo(victory.adventureType, browser.createTranslator(language));
    add(root, 'p', [type.label, victory.scenarioId && `${t('scenario')} ${victory.scenarioId}`].filter(Boolean).join(' · '), 'av-type');
    const details = add(root, 'details');
    add(details, 'summary', t('summary'));
    const stats = add(details, 'dl');
    function stat(label, value) {
      if (value == null) return;
      add(stats, 'dt', t(label));
      add(stats, 'dd', String(value));
    }
    stat('date', victory.completedAt == null ? null :
      new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(victory.completedAt));
    stat('visits', victory.distinctVisited);
    stat('quests', victory.finishedQuests);
    const actions = add(root, 'div', undefined, 'av-actions');
    const replay = add(actions, 'button', t('replay'));
    const back = add(actions, 'button', t('back'));
    const status = add(root, 'p', undefined, 'av-status');
    status.setAttribute('role', 'status');
    const dialog = add(root, 'dialog');
    dialog.setAttribute('aria-label', t('replay'));
    add(dialog, 'p', t('warning'));
    const controls = add(dialog, 'div', undefined, 'av-actions');
    const cancel = add(controls, 'button', t('cancel'));
    const confirm = add(controls, 'button', t('confirm'));
    let busy = false;
    function destroy() {
      controller.abort();
      if (dialog.open) dialog.close();
      root.remove();
    }
    listen(back, 'click', () => { destroy(); onBack?.(); });
    listen(replay, 'click', () => { status.textContent = ''; dialog.showModal(); cancel.focus(); });
    listen(cancel, 'click', () => dialog.close());
    listen(dialog, 'cancel', event => { if (busy) event.preventDefault(); });
    listen(dialog, 'close', () => replay.focus());
    listen(confirm, 'click', async () => {
      busy = cancel.disabled = confirm.disabled = true;
      const result = await victory.replay({ confirmed: true });
      if (controller.signal.aborted) return;
      busy = cancel.disabled = confirm.disabled = false;
      if (result.ok) { destroy(); onReplay?.(result); }
      else {
        dialog.close();
        status.textContent = t(result.code === 'STALE_TRANSITION' ? 'stale' : 'failed');
      }
    });
    heading.focus();
    return { ok: true, destroy };
  }
  return { mountVictory };
});
