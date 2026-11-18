(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(
    require('./adventure-storage.js'), require('./adventure-save.js'));
  else root.QRCQAdventureIntegration = factory(root.QRCQAdventureStorage, root.QRCQAdventureSave);
})(globalThis, function (storageAPI, saves) {
  'use strict';
  const LEGACY_KEY = 'qr-city-quest-save-v1';
  const DATABASE = 'qr-city-quest-adventure-v1';

  async function start({ storage = storageAPI.createAdventureStorage({ name: DATABASE }),
    legacy = () => localStorage.getItem(LEGACY_KEY) } = {}) {
    await storage.recover();
    let snapshot = await storage.snapshot();
    if (!snapshot.active) {
      const raw = snapshot.revision === 0 ? legacy() : null;
      try {
        if (raw === null) await storage.activateBuiltIn(snapshot.revision);
        else await storage.adoptBuiltInSave(raw);
      } catch (error) {
        if (!['ACTIVE_EXISTS', 'STALE_TRANSITION'].includes(error.code)) throw error;
      }
      snapshot = await storage.snapshot();
      if (!snapshot.active) throw Error('Active adventure could not be initialized.');
    }
    const { active } = snapshot;
    if (active.kind === 'downloaded') {
      const checked = storageAPI.adventureFromFiles(active.files);
      if (JSON.stringify(checked) !== JSON.stringify(active.adventure))
        throw Object.assign(Error('Installed content does not match its stored files.'), { code: 'STORAGE_CORRUPT' });
    } else if (active.kind !== 'builtin' || active.save.adventure.id !== saves.LEGACY_ADVENTURE.id) {
      throw Object.assign(Error('Unknown active adventure kind.'), { code: 'STORAGE_CORRUPT' });
    }
    let revision = snapshot.revision;
    let committed = structuredClone(active.save);
    let writing = false;
    return { storage, active, revision: () => revision, saved: () => structuredClone(committed),
      fresh: () => saves.createAdventureSave(active.adventure).save,
      async update(save) {
        if (writing) return { ok: false, code: 'SAVE_IN_PROGRESS' };
        writing = true;
        try {
          const checked = saves.validateAdventureSave(save, active.adventure);
          if (!checked.ok) return checked;
          const result = await storage.updateSave(checked.save, revision);
          if (result.ok) {
            revision = result.revision;
            committed = checked.save;
          }
          return result;
        } catch (error) { return { ok: false, code: error.code || 'STORAGE_ERROR' }; }
        finally { writing = false; }
      } };
  }
  return { DATABASE, LEGACY_KEY, start };
});
