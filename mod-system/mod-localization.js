/* Step 4: independent, data-only language packs for the original game. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.QRCQModLocalization=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(root){
  "use strict";
  const BUILTINS=Object.freeze({en:"English",hu:"Magyar"});
  // Ordered positional arguments used by built-in, trusted UI text functions.
  const TEMPLATES=Object.freeze({
    modInstalled:["name"],
    itemAddedToInventory:["itemName"],
    timerDebugLabel:["mins"],
    encounterWaitingWithoutTimer:["id"],
    timerMissingPage:["id","page"],
    pageDoesNotExist:["page"],
    noDropdownDestination:["page"],
    buttonHasNoDestination:["button","page"],
    timerOnlyForEncounter:["page"],
    timerNeedsResumePage:["page"],
    counterActionNeedsItem:["type"],
    counterActionNeedsName:["type"],
    counterActionInvalidNumber:["type"],
    unknownAction:["type","page"],
    nextScanOnlyForEncounter:["page"],
    nextScanInvalidPage:["page","destination"],
    unknownDestination:["destination"]
  });
  const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
  const printable=name=>typeof name==="string"&&name.length<=5000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(name);
  function nameOf(code){
    if(own(BUILTINS,code))return BUILTINS[code];
    try {return new Intl.DisplayNames([code],{type:"language"}).of(code)||code;}
    catch (_) {return code;}
  }
  function checkCoreApp(app,english){
    const errors=[];
    if(!app||typeof app!=="object"||Array.isArray(app))return ["Invalid interface translation"];
    const required=Object.keys(english);
    for(const key of required){
      if(!own(app,key)){errors.push("Missing app text: "+key);continue;}
      if(!printable(app[key]))errors.push("Invalid text template: "+key);
      if(typeof english[key]==="function"){
        const args=TEMPLATES[key];
        if(!args){errors.push("Unsupported interface function: "+key);continue;}
        for(const arg of args)
          if(typeof app[key]==="string"&&!app[key].includes("{"+arg+"}"))
            errors.push("Missing {"+arg+"} in "+key);
        const fields=typeof app[key]==="string"?[...app[key].matchAll(/\{([^{}]+)\}/g)].map(m=>m[1]):[];
        if(fields.some(field=>!args.includes(field)))errors.push("Unknown placeholder in "+key);
      }
    }
    // Prevent typos in the app-data vocabulary from going unnoticed.
    for(const key of Object.keys(app))if(!own(english,key))errors.push("Unknown app text: "+key);
    return errors;
  }
  function checkCorePack(entry,englishGame,englishApp){
    if(!entry||entry.enabled===false||!entry.manifest||entry.manifest.target!=="core")
      return {valid:false,errors:["Not an enabled main-game translation"]};
    const validator=root.QRCQModValidator;
    if(!validator)return {valid:false,errors:["Mod validator unavailable"]};
    const check=validator.validatePackage(entry.files,{targetEnglishGame:englishGame});
    const errors=[...check.errors];
    if(check.valid){
      for(const lang of check.manifest.languages){
        const pair=check.data[lang];
        if(!pair){errors.push("Missing "+lang+" files");continue;}
        errors.push(...checkCoreApp(pair.app,englishApp).map(x=>lang+": "+x));
      }
    }
    return {valid:errors.length===0,errors,pack:check.valid?check:null};
  }
  function discover(entries,englishGame,englishApp){
    const active=(entries||[]).filter(x=>x.enabled!==false);
    const languages=Object.entries(BUILTINS).map(([code,name])=>({code,name,source:"builtin"}));
    const errors=[],packs=Object.create(null);
    for(const entry of active){
      if(!entry.manifest||entry.manifest.target!=="core")continue;
      const check=checkCorePack(entry,englishGame,englishApp);
      if(!check.valid){errors.push(entry.id+": "+check.errors.join("; "));continue;}
      for(const lang of check.pack.manifest.languages){
        if(own(BUILTINS,lang)){errors.push(entry.id+": "+lang+" is already built in");continue;}
        if(own(packs,lang)){errors.push(entry.id+": conflicting main-game language "+lang);continue;}
        packs[lang]={id:entry.id,game:check.pack.data[lang].game,app:check.pack.data[lang].app};
        languages.push({code:lang,name:nameOf(lang),source:entry.id});
      }
    }
    return {languages,packs,errors};
  }
  function makeAppText(english,translations){
    const errors=checkCoreApp(translations,english);
    if(errors.length)throw Error(errors.join("; "));
    const out={};
    for(const [key,original] of Object.entries(english)){
      const value=translations[key];
      if(typeof original==="function"){
        const args=TEMPLATES[key];
        out[key]=(...values)=>{
          const byName=Object.create(null);
          args.forEach((name,i)=>{byName[name]=values[i]===undefined?"":String(values[i]);});
          return value.replace(/\{([^{}]+)\}/g,(token,field)=>own(byName,field)?byName[field]:token);
        };
      }else out[key]=value;
    }
    return out;
  }
  return {discover,checkCorePack,makeAppText,nameOf};
});
