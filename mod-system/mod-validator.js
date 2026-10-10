/* QR City Quest mod format v1. Downloaded .js files are JSON data assignments, NEVER executable scripts. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.QRCQModValidator = api;
})(typeof globalThis !== "undefined" ? globalThis : null, function () {
  "use strict";
  const ID = /^[a-z][a-z0-9-]{1,47}$/;
  const LANG = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/;
  const SEMVER = /^\d+\.\d+\.\d+$/;
  const PAGE = /^\d{4}$/;
  const QR = /^\d{2}$/;
  const TARGETS = new Set(["HOME", "TITLE_SCREEN", "-1"]);
  const VISIBLE = new Set(["speaker","text","label","displayName","description","subtitle","title"]);
  const BAD_KEYS = new Set(["__proto__","prototype","constructor"]);
  const ALLOWED_ACTIONS = new Set(["ADD_ITEM","REMOVE_ITEM","ADD_KNOWLEDGE","START_QUEST",
    "COMPLETE_QUEST","START_TIMER","UNLOCK_AREA","NEXT_SCAN","ADD_COUNTER",
    "SET_COUNTER","RESET_COUNTER","DROPDOWN_CHOICE","DROPDOWN_INVENTORY"]);
  const safeConditions = typeof globalThis!=="undefined" && globalThis.QRCQModConditions ||
    (typeof require==="function" ? require("./mod-conditions.js") : null);
  const LIMITS = Object.freeze({ count: 200, fileBytes: 2000000, totalBytes: 12000000 });
  const record = v => v !== null && typeof v === "object" && !Array.isArray(v);
  const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);

  function safeTree(value, errors, path = "$", depth = 0) {
    if (depth > 80) { errors.push(path + ": nesting too deep"); return; }
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value)) {
      if (BAD_KEYS.has(key)) errors.push(path + ": unsafe property " + key);
      safeTree(value[key], errors, path + "." + key, depth + 1);
    }
  }

  function parseStaticJs(text, name) {
    if (typeof text !== "string") throw Error("Expected UTF-8 text");
    const match = text.trim().match(/^window\.([A-Z_]+)\s*=\s*([\s\S]*);$/);
    if (!match || match[1] !== name) throw Error("Expected one window." + name + " = { ... }; assignment");
    let value;
    try { value = JSON.parse(match[2]); }
    catch (_) { throw Error("File must contain strict JSON, not executable JavaScript"); }
    if (!record(value)) throw Error("Assigned value must be an object");
    const errors = [];
    safeTree(value, errors);
    if (errors.length) throw Error(errors.join("; "));
    return value;
  }

  function safeName(path) {
    return typeof path === "string" && (
      /^[a-z][a-z0-9_-]*\.js$/.test(path) ||
      /^images\/[a-z0-9][a-z0-9_.-]*\.(?:png|jpg|jpeg|webp)$/.test(path)
    );
  }

  function manifestCheck(m, errors) {
    if (!record(m)) { errors.push("manifest must be an object"); return; }
    if (!ID.test(m.id || "") || m.id === "core") errors.push("manifest.id must be unique, lowercase, 2-48 chars and not core");
    if (typeof m.name !== "string" || !m.name.trim() || m.name.length > 100) errors.push("manifest.name is required (up to 100 characters)");
    if (!SEMVER.test(m.version || "")) errors.push("manifest.version must be x.y.z");
    if (!Array.isArray(m.languages) || m.languages.length === 0 ||
        m.languages.some(l => typeof l !== "string" || !LANG.test(l)) ||
        new Set(m.languages).size !== m.languages.length)
      errors.push("manifest.languages must be unique lowercase language codes");
    if (own(m,"type")) errors.push("Do not use manifest.type: target identifies translation packs");
    if (own(m,"target") && (typeof m.target !== "string" ||
        !(m.target === "core" || ID.test(m.target)) || m.target === m.id))
      errors.push("manifest.target must identify a different mod or core");
    if (own(m,"prefix") && (!ID.test(m.prefix || "") || m.prefix === "core" || m.prefix !== m.id))
      errors.push("Expansion prefix must match manifest.id");
    if (own(m,"target") && own(m,"prefix")) errors.push("Translations may not specify a prefix");
    if (!own(m,"target") && Array.isArray(m.languages) && !m.languages.includes("en"))
      errors.push("Expansions must provide English fallback");
    for (const key of ["author","description","gameVersion"])
      if (own(m,key) && (typeof m[key] !== "string" || m[key].length > 500))
        errors.push("manifest." + key + " must be a short string");
  }

  function checkGame(data, errors, file, coreTranslation = false) {
    if (data.formatVersion !== 1) errors.push(file + ": formatVersion must be 1");
    if (own(data,"encounters") && !record(data.encounters)) errors.push(file + ": encounters must be an object");
    if (own(data,"items") && !record(data.items)) errors.push(file + ": items must be an object");
    const encounters = record(data.encounters) ? data.encounters : {};
    const items = record(data.items) ? data.items : {};
    if (!Object.keys(encounters).length && !Object.keys(items).length)
      errors.push(file + ": an encounter or item is required");
    const ids = new Set(), pages = [];
    function ownerCheck(owner, label, expectedQr) {
      if (!record(owner) || !record(owner.pages) || !Object.keys(owner.pages).length ||
          typeof owner.startPage !== "string" || !PAGE.test(owner.startPage) ||
          !own(owner.pages,owner.startPage)) {
        errors.push(file + ": invalid pages or startPage for " + label);
        return;
      }
      if (expectedQr && !owner.startPage.startsWith(expectedQr))
        errors.push(file + ": startPage prefix does not match " + label);
      for (const [id,p] of Object.entries(owner.pages)) {
        if (!PAGE.test(id) || ids.has(id)) errors.push(file + ": invalid or duplicate page ID " + id);
        ids.add(id);
        if (!record(p) || p.id !== id || typeof p.text !== "string" ||
            typeof p.speaker !== "string" || !Array.isArray(p.buttons) || !Array.isArray(p.actions)) {
          errors.push(file + ": invalid page " + id); continue;
        }
        pages.push([id,p]);
      }
    }
    for (const [qr,enc] of Object.entries(encounters)) {
      if (!QR.test(qr)) errors.push(file + ": invalid two-digit QR " + qr);
      ownerCheck(enc,"encounter " + qr,qr);
    }
    for (const [name,item] of Object.entries(items)) {
      if (!name.trim()) errors.push(file + ": empty item ID");
      ownerCheck(item,"item " + name,null);
    }
    for (const [id,page] of pages) {
      if (page.condition!==undefined) {
        if (!record(page.condition)) errors.push(file + ": invalid condition map on " + id);
        else if (!coreTranslation) for (const condition of Object.values(page.condition)) {
          if (typeof condition!=="string" || !safeConditions ||
              safeConditions.validate(condition)!==null)
            errors.push(file + ": unsupported or unsafe condition on " + id);
        }
      }
      for (const button of page.buttons) {
        if (!record(button) || typeof button.label !== "string" || typeof button.next !== "string" ||
            !(ids.has(button.next) || TARGETS.has(button.next)))
          errors.push(file + ": invalid button destination on " + id);
        if (!coreTranslation && record(button) && button.next==="TITLE_SCREEN")
          errors.push(file + ": expansion cannot end the base game on " + id);
      }
      for (const action of page.actions) {
        if (!record(action) || typeof action.type !== "string") {
          errors.push(file + ": invalid action on " + id); continue;
        }
        if (!ALLOWED_ACTIONS.has(action.type) && !(coreTranslation && action.type==="OPEN_CASTLE"))
          errors.push(file + ": unsupported expansion action " + action.type + " on " + id);
        if (typeof action.otherNext==="string" && !ids.has(action.otherNext) && !TARGETS.has(action.otherNext))
          errors.push(file + ": invalid dropdown fallback on " + id);
        if (typeof action.waitPage==="string" && !ids.has(action.waitPage))
          errors.push(file + ": invalid timer waitPage on " + id);
        if (Array.isArray(action.options)) for (const option of action.options)
          if (!record(option) || typeof option.next !== "string" ||
              !(ids.has(option.next) || TARGETS.has(option.next)))
            errors.push(file + ": invalid dropdown destination on " + id);
          else if (!coreTranslation && option.next==="TITLE_SCREEN")
            errors.push(file + ": expansion dropdown cannot end the base game on " + id);
      }
    }
  }

  function compareTranslation(base, translated, path = "$", errors = []) {
    if (Array.isArray(base) || Array.isArray(translated)) {
      if (!Array.isArray(base) || !Array.isArray(translated) || base.length !== translated.length) {
        errors.push(path + ": array structure differs"); return errors;
      }
      base.forEach((v,i)=>compareTranslation(v,translated[i],path+"["+i+"]",errors));
    } else if (record(base) || record(translated)) {
      if (!record(base) || !record(translated)) { errors.push(path+": object structure differs"); return errors; }
      const a=Object.keys(base).sort(), b=Object.keys(translated).sort();
      if (a.join("\0") !== b.join("\0")) { errors.push(path+": keys differ"); return errors; }
      a.forEach(k=>compareTranslation(base[k],translated[k],path+"."+k,errors));
    } else {
      const key=path.split(".").pop();
      if (VISIBLE.has(key) && typeof base === "string" && typeof translated === "string") return errors;
      if ((path.includes(".questDisplayNames.") || path.includes(".knowledgeFolders.")) &&
          typeof base === "string" && typeof translated === "string") return errors;
      if (base !== translated) errors.push(path + ": gameplay/internal data differs");
    }
    return errors;
  }

  function validatePackage(files, options = {}) {
    const errors=[],warnings=[],out={valid:false,errors,warnings,manifest:null,kind:null,prefix:null,data:{}};
    if (!record(files)) { errors.push("Package must contain files"); return out; }
    const names=Object.keys(files);
    if (names.length>LIMITS.count) errors.push("Too many files");
    let total=0;
    for (const name of names) {
      if (!safeName(name)) errors.push("Unsafe or unsupported filename: "+name);
      const image=name.startsWith("images/");
      if (image && !(files[name] instanceof Uint8Array)) { errors.push(name+": expected binary image"); continue; }
      if (!image && typeof files[name] !== "string") { errors.push(name+": expected UTF-8 text"); continue; }
      const bytes=image ? files[name].byteLength : new TextEncoder().encode(files[name]).length;
      if (bytes>LIMITS.fileBytes) errors.push(name+": too large");
      total+=bytes;
    }
    if (total>LIMITS.totalBytes) errors.push("Mod is too large");
    if (!own(files,"manifest.js")) { errors.push("Missing manifest.js"); return out; }
    let m;
    try { m=parseStaticJs(files["manifest.js"],"QR_CITY_QUEST_MOD_MANIFEST"); }
    catch(e) { errors.push("manifest.js: "+e.message); return out; }
    out.manifest=m; manifestCheck(m,errors);
    if (errors.length) return out;
    out.kind=own(m,"target")?"language":"expansion";
    out.prefix=out.kind==="language"?m.target:(m.prefix||m.id);
    const required=new Set(["manifest.js"]);
    for (const lang of m.languages) {
      const gameFile=out.prefix+"_game_data-"+lang+".js";
      const appFile=out.prefix+"_app_data-"+lang+".js";
      required.add(gameFile);required.add(appFile);
      if (!own(files,gameFile)) errors.push("Missing "+gameFile);
      if (!own(files,appFile)) errors.push("Missing "+appFile);
      if (!own(files,gameFile)||!own(files,appFile)) continue;
      let game,app;
      try { game=parseStaticJs(files[gameFile],"QR_CITY_QUEST_DATA"); }
      catch(e) { errors.push(gameFile+": "+e.message); }
      try { app=parseStaticJs(files[appFile],"QR_CITY_QUEST_APP_TEXT"); }
      catch(e) { errors.push(appFile+": "+e.message); }
      // Core language packs are compared against the full trusted English structure
      // by the registry/locale loader. The base game includes non-dialogue placeholder
      // items, so applying expansion-only page rules would reject valid translations.
      if (game && m.target!=="core") checkGame(game,errors,gameFile,false);
      if (app && Object.values(app).some(v=>typeof v!=="string")) errors.push(appFile+": all values must be string templates");
      if (game&&app) out.data[lang]={game,app};
    }
    for (const name of names) if (name.endsWith(".js")&&!required.has(name))
      errors.push("Unexpected .js file: "+name);
    if (out.kind==="expansion" && out.data.en)
      for (const lang of m.languages) if (lang!=="en"&&out.data[lang])
        compareTranslation(out.data.en.game,out.data[lang].game,out.prefix+":"+lang,errors);
    if (out.kind==="language") {
      if (options.targetEnglishGame) for (const lang of m.languages) if (out.data[lang])
        compareTranslation(options.targetEnglishGame,out.data[lang].game,out.prefix+":"+lang,errors);
      else warnings.push("Translation cannot be compared until its target is available");
      if (!options.targetEnglishGame) warnings.push("Translation needs the parent English source for final validation");
    }
    out.valid=errors.length===0;
    return out;
  }
  return { LIMITS, parseStaticJs, validatePackage, compareTranslation };
});
