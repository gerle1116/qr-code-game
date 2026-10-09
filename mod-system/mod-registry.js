/* Dependency checks and language resolution; no mod code is ever executed. */
(function (root, factory) {
  const api = factory(root && root.QRCQModValidator);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.QRCQModRegistry = api;
})(typeof globalThis !== "undefined" ? globalThis : null, function (browserValidator) {
  "use strict";
  const validator = browserValidator || (typeof require === "function" ? require("./mod-validator.js") : null);

  function inspectPackages(packages, options = {}) {
    if (!validator) throw Error("Validator must be loaded first");
    const errors=[],warnings=[],installed=[],ids=new Set(),byId=new Map();
    for (const entry of packages) {
      const result=validator.validatePackage(entry.files);
      if (!result.valid) {
        errors.push(...result.errors.map(e=>"[package] "+e));continue;
      }
      const id=result.manifest.id;
      if (ids.has(id)) errors.push("Duplicate mod ID: "+id);
      ids.add(id);
      const mod={...result,enabled:entry.enabled!==false};
      installed.push(mod);byId.set(id,mod);
    }
    const prefixes=new Set(),translated=new Set();
    for (const mod of installed) {
      if (!mod.enabled) continue;
      if (mod.kind==="expansion") {
        if (prefixes.has(mod.prefix)) errors.push("QR prefix conflict: "+mod.prefix);
        prefixes.add(mod.prefix);
      }
    }
    for (const mod of installed) {
      if (!mod.enabled || mod.kind!=="language") continue;
      const target=mod.manifest.target;
      if (target!=="core" && (!byId.has(target)||!byId.get(target).enabled||
          byId.get(target).kind!=="expansion")) {
        errors.push(mod.manifest.id+": required expansion '"+target+"' is not enabled");
        continue;
      }
      const source=target==="core"?options.coreEnglishGame:byId.get(target).data.en.game;
      if (!source) errors.push(mod.manifest.id+": missing English source for "+target);
      else for (const lang of mod.manifest.languages)
        validator.compareTranslation(source,mod.data[lang].game,mod.manifest.id+":"+lang,errors);
      for (const lang of mod.manifest.languages) {
        const key=target+":"+lang;
        if (translated.has(key)) errors.push("Multiple translation packs for "+key);
        translated.add(key);
      }
    }
    return {valid:!errors.length,errors,warnings,installed};
  }

  function resolveLanguage(registry,modId,language) {
    const active=(registry.installed||[]).filter(m=>m.enabled);
    const parent=active.find(m=>m.kind==="expansion"&&m.manifest.id===modId);
    if (!parent) return null;
    const override=active.find(m=>m.kind==="language"&&m.manifest.target===modId&&m.data[language]);
    if (override) return {language,source:override.manifest.id};
    if (parent.data[language]) return {language,source:modId};
    return {language:"en",source:modId,fallback:true};
  }
  return {inspectPackages,resolveLanguage};
});
