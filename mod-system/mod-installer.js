/* Installs and manages data-only mods; enabled expansion data loads on restart. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.QRCQModInstaller=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(root){
  "use strict";
  const get=()=>({
    validator:root.QRCQModValidator,
    registry:root.QRCQModRegistry,
    zip:root.QRCQZipReader,
    storage:root.QRCQModStorage
  });
  let englishPromise=null;
  function dependencies(){
    const d=get();
    if(Object.values(d).some(x=>!x))throw Error("Mod installer components have not loaded");
    return d;
  }
  async function coreEnglish(){
    if(!englishPromise) {
      englishPromise=(async()=>{
        const response=await fetch("./data/game-data_en.js?v=29");
        if(!response.ok)throw Error("Unable to read original English game data");
        const text=await response.text();
        return dependencies().validator.parseStaticJs(text,"QR_CITY_QUEST_DATA");
      })().catch(err=>{englishPromise=null;throw err;});
    }
    return englishPromise;
  }
  function view(entry){
    const m=entry.manifest;
    return {id:entry.id,name:m.name,version:m.version,author:m.author||"",
      description:m.description||"",languages:m.languages,
      target:m.target||null,kind:entry.kind,enabled:entry.enabled!==false};
  }
  async function list(){
    const rows=await dependencies().storage.list();
    return rows.sort((a,b)=>a.manifest.name.localeCompare(b.manifest.name)).map(view);
  }
  async function testRegistry(entries){
    const d=dependencies();
    const requiresCore=entries.some(e=>e.enabled!==false &&
      e.manifest.target==="core");
    const core=requiresCore?await coreEnglish():undefined;
    const state=d.registry.inspectPackages(entries,{coreEnglishGame:core});
    if(!state.valid)throw Error(state.errors.join("\n"));
    return state;
  }
  async function install(file){
    if(!file || !/\.zip$/i.test(file.name||""))throw Error("Choose a .zip mod package");
    const d=dependencies();
    const files=await d.zip.readZip(file);
    const check=d.validator.validatePackage(files);
    if(!check.valid)throw Error(check.errors.join("\n"));
    const current=await d.storage.list();
    const previous=current.find(entry=>entry.id===check.manifest.id);
    if(previous && (previous.kind!==check.kind||
        (previous.manifest.target||"")!==(check.manifest.target||"")))
      throw Error("This mod ID already belongs to a different kind/target");
    const entry={
      id:check.manifest.id,
      kind:check.kind,
      manifest:check.manifest,
      files,
      enabled:previous?previous.enabled!==false:true,
      installedAt:previous?previous.installedAt:Date.now(),
      updatedAt:Date.now()
    };
    await testRegistry([...current.filter(e=>e.id!==entry.id),entry]);
    // One IndexedDB write commits the archive atomically. Nothing runs as JavaScript.
    await d.storage.put(entry);
    return view(entry);
  }
  async function setEnabled(id,enabled){
    const d=dependencies(),current=await d.storage.list();
    const old=current.find(e=>e.id===id);
    if(!old)throw Error("Mod not found");
    const next={...old,enabled:!!enabled};
    await testRegistry([...current.filter(e=>e.id!==id),next]);
    await d.storage.put(next);
    return view(next);
  }
  async function remove(id){
    const d=dependencies(),current=await d.storage.list();
    if(!current.some(e=>e.id===id))throw Error("Mod not found");
    await testRegistry(current.filter(e=>e.id!==id));
    await d.storage.remove(id);
  }
  return {install,list,setEnabled,remove};
});
