/* Step 3: register enabled expansion encounters/items before app.js starts.
   The original game data stays unchanged; all mod identifiers are namespaced. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.QRCQModRuntime=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(root){
  "use strict";
  const DESTINATIONS=new Set(["HOME","TITLE_SCREEN","-1"]);
  const ACTIONS=new Set(["ADD_ITEM","REMOVE_ITEM","ADD_KNOWLEDGE","START_QUEST",
    "COMPLETE_QUEST","START_TIMER","UNLOCK_AREA","NEXT_SCAN","ADD_COUNTER",
    "SET_COUNTER","RESET_COUNTER","DROPDOWN_CHOICE","DROPDOWN_INVENTORY"]);
  const IDENT=/^[a-z0-9][a-z0-9_-]*$/;
  const isObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
  const clone=x=>JSON.parse(JSON.stringify(x));
  const namespace=(prefix,id)=>prefix+":"+String(id);
  function destination(prefix,id){
    if(id==="TITLE_SCREEN")throw Error("Expansions cannot end the base game");
    if(DESTINATIONS.has(id))return id;
    if(typeof id!=="string"||!/^[0-9]{4}$/.test(id))throw Error("Invalid page target: "+id);
    return namespace(prefix,id);
  }
  function validateAndPrepare(entry,selectedLanguage,registry){
    const id=entry.manifest.id;
    const target=registry.installed.find(x=>x.manifest.id===id && x.enabled);
    if(!target)throw Error("Expansion is not registered: "+id);
    const override=registry.installed.find(x=>x.enabled && x.kind==="language" &&
      x.manifest.target===id && x.data[selectedLanguage]);
    const source=override ? override.data[selectedLanguage].game :
      target.data[selectedLanguage] ? target.data[selectedLanguage].game : target.data.en.game;
    if(!source)throw Error("Missing playable English game data for "+id);
    const game=clone(source);
    const conditions=root.QRCQModConditions;
    if(!conditions)throw Error("The safe condition engine is not available");
    const images=Object.create(null);
    for(const path of Object.keys(entry.files)){
      const match=/^images\/([a-z0-9][a-z0-9_.-]*)\.(png|jpg|jpeg|webp)$/.exec(path);
      if(match)images[match[1]]=path;
    }
    function pictureName(name){
      if(typeof name!=="string"||!IDENT.test(name))throw Error("Unsafe image name in "+id+": "+name);
      return namespace(id,name);
    }
    function normalizedPage(page) {
      const p=clone(page);
      p.id=destination(id,p.id);
      p.__modId=id;
      if(typeof p.picture==="string")p.picture=pictureName(p.picture);
      if(!Array.isArray(p.buttons)||!Array.isArray(p.actions))throw Error("Invalid page buttons/actions in "+id);
      p.buttons=p.buttons.map(button=>{
        if(!Number.isInteger(button.index)||button.index<1||button.index>10)throw Error("Invalid button index on "+p.id);
        button.next=destination(id,button.next);
        return button;
      });
      if(p.condition!==undefined) {
        if(!isObject(p.condition))throw Error("Invalid conditions on "+p.id);
        for(const condition of Object.values(p.condition)){
          if(typeof condition!=="string")throw Error("Expected string condition on "+p.id);
          const err=conditions.validate(condition);
          if(err)throw Error("Unsupported condition on "+p.id+": "+err);
        }
      }
      p.actions=p.actions.map(action=>{
        if(!ACTIONS.has(action.type))throw Error("Unsupported mod action "+action.type+" on "+p.id);
        if(["ADD_ITEM","REMOVE_ITEM","ADD_KNOWLEDGE","START_QUEST","COMPLETE_QUEST","UNLOCK_AREA"].includes(action.type)) {
          if(typeof action.data!=="string"||!action.data.trim())throw Error("Missing action.data on "+p.id);
          action.data=namespace(id,action.data);
        }
        if(["ADD_COUNTER","SET_COUNTER","RESET_COUNTER"].includes(action.type) && action.item) {
          action.item=namespace(id,action.item);
        }
        if(action.waitPage!==undefined && action.waitPage!==null)
          action.waitPage=destination(id,action.waitPage);
        if(action.options!==undefined){
          if(!Array.isArray(action.options))throw Error("Invalid dropdown options on "+p.id);
          action.options=action.options.map(option=>{
            const result={...option};
            result.next=destination(id,result.next);
            if(action.type==="DROPDOWN_INVENTORY" && typeof result.value==="string" && result.value!=="Other")
              result.value=namespace(id,result.value);
            return result;
          });
        }
        if(action.otherNext!==undefined)action.otherNext=destination(id,action.otherNext);
        return action;
      });
      return p;
    }
    function normalizedOwner(owner){
      const result=clone(owner);
      result.startPage=destination(id,owner.startPage);
      if(typeof result.defaultPicture==="string")result.defaultPicture=pictureName(result.defaultPicture);
      result.pages={};
      for(const [pageId,page] of Object.entries(owner.pages)){
        if(page.id!==pageId)throw Error("Mismatched page ID in "+id);
        result.pages[destination(id,pageId)]=normalizedPage(page);
      }
      if(result.aliases){
        if(!Array.isArray(result.aliases))throw Error("Invalid aliases in "+id);
        result.aliases=result.aliases.map(name=>namespace(id,name));
      }
      if(result.requiredArea)result.requiredArea=namespace(id,result.requiredArea);
      return result;
    }
    const out={encounters:{},items:{},thingsIKnow:{},knowledgeFolders:{},questDisplayNames:{},imageFiles:images};
    for(const [qr,owner] of Object.entries(game.encounters||{})){
      if(!/^\d{2}$/.test(qr))throw Error("Invalid encounter QR "+qr);
      out.encounters[namespace(id,qr)]=normalizedOwner(owner);
    }
    for(const [name,owner] of Object.entries(game.items||{}))
      out.items[namespace(id,name)]=normalizedOwner(owner);
    for(const [key,title] of Object.entries(game.questDisplayNames||{}))
      out.questDisplayNames[namespace(id,key)]=title;
    for(const [key,title] of Object.entries(game.knowledgeFolders||{}))
      out.knowledgeFolders[namespace(id,key)]=title;
    for(const [key,detail] of Object.entries(game.thingsIKnow||{})){
      const item=clone(detail);
      if(item.folder)item.folder=namespace(id,item.folder);
      out.thingsIKnow[namespace(id,key)]=item;
    }
    return out;
  }
  async function build(base,language){
    const result={game:base,images:Object.create(null),loaded:[],errors:[]};
    const store=root.QRCQModStorage, registryAPI=root.QRCQModRegistry;
    if(!store||!registryAPI||!root.QRCQModConditions)return result;
    let entries;
    try{entries=await store.list();}
    catch(e){result.errors.push("Mod storage unavailable: "+e.message);return result;}
    if(!entries.length)return result;
    // Core language packs will be activated in Step 4, not this expansion engine stage.
    const expansions=entries.filter(e=>e.manifest && e.manifest.target!=="core");
    const registry=registryAPI.inspectPackages(expansions);
    if(!registry.valid) {
      result.errors.push(...registry.errors);
      return result;
    }
    if(!expansions.some(entry=>entry.enabled!==false && !entry.manifest.target))
      return result;
    const combined={...base,encounters:{...(base.encounters||{})},items:{...(base.items||{})},
      thingsIKnow:{...(base.thingsIKnow||{})},knowledgeFolders:{...(base.knowledgeFolders||{})},
      questDisplayNames:{...(base.questDisplayNames||{})}};
    const assetFiles=[];
    for(const entry of expansions) {
      if(entry.enabled===false || entry.manifest.target)continue;
      try{
        const prepared=validateAndPrepare(entry,language,registry);
        for(const key of ["encounters","items","thingsIKnow","knowledgeFolders","questDisplayNames"]){
          for(const [name,value] of Object.entries(prepared[key])){
            if(Object.prototype.hasOwnProperty.call(combined[key],name))
              throw Error("Duplicate game ID: "+name);
            combined[key][name]=value;
          }
        }
        for(const [name,path] of Object.entries(prepared.imageFiles))
          assetFiles.push({id:entry.id,key:namespace(entry.id,name),name:path,bytes:entry.files[path]});
        result.loaded.push(entry.manifest.id);
      }catch(e){
        result.errors.push(entry.manifest.id+": "+e.message);
      }
    }
    // All bytes originate from the already-validated local ZIP archives.
    if(typeof URL!=="undefined" && typeof URL.createObjectURL==="function" && typeof Blob!=="undefined"){
      for(const asset of assetFiles) {
        const extension=asset.name.split(".").pop();
        const mime=extension==="png"?"image/png":extension==="webp"?"image/webp":"image/jpeg";
        result.images[asset.key]=URL.createObjectURL(new Blob([asset.bytes],{type:mime}));
      }
    }
    result.game=combined;
    return result;
  }
  return {build,validateAndPrepare};
});
