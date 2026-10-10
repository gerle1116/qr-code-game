/* Step 4 regression suite: node tests/test-mod-localization.js */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const validator=require("../mod-system/mod-validator.js");
const localization=require("../mod-system/mod-localization.js");
const zipReader=require("../mod-system/mod-zip-reader.js");
const root=path.resolve(__dirname,"..");
const originalGame=validator.parseStaticJs(
  fs.readFileSync(path.join(root,"data/game-data_en.js"),"utf8"),
  "QR_CITY_QUEST_DATA"
);
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,"data/apptext_en.js"),"utf8"),sandbox);
const originalText=sandbox.window.QR_CITY_QUEST_APP_TEXT;
const placeholders={
  modInstalled:["name"],itemAddedToInventory:["itemName"],timerDebugLabel:["mins"],
  encounterWaitingWithoutTimer:["id"],timerMissingPage:["id","page"],
  pageDoesNotExist:["page"],noDropdownDestination:["page"],
  buttonHasNoDestination:["button","page"],timerOnlyForEncounter:["page"],
  timerNeedsResumePage:["page"],counterActionNeedsItem:["type"],
  counterActionNeedsName:["type"],counterActionInvalidNumber:["type"],
  unknownAction:["type","page"],nextScanOnlyForEncounter:["page"],
  nextScanInvalidPage:["page","destination"],unknownDestination:["destination"]
};
function fixture({language="es",id="spanish-core"}={}){
  const source=JSON.parse(JSON.stringify(originalGame));
  source.encounters["02"].pages["0201"].speaker="Mercader";
  source.encounters["02"].pages["0201"].text="¡Hola!";
  const folders=Object.keys(source.knowledgeFolders);
  if(folders.length)source.knowledgeFolders[folders[0]]="Historias";
  const app=Object.fromEntries(Object.entries(originalText).map(([key,value])=>{
    if(typeof value==="string")return [key,value];
    assert.ok(placeholders[key],key+": template parameters must be documented");
    return [key,"Translated "+key+": "+placeholders[key].map(arg=>"{"+arg+"}").join(" ")];
  }));
  app.homeTitle="Aventura urbana";
  app.modInstalled="{name} instalado correctamente.";
  const manifest={id,name:"Core Spanish Test Pack",version:"1.0.0",target:"core",languages:[language]};
  const assignment=(name,data)=>"window."+name+" = "+JSON.stringify(data)+";";
  return {id,manifest,enabled:true,files:{
    "manifest.js":assignment("QR_CITY_QUEST_MOD_MANIFEST",manifest),
    ["core_game_data-"+language+".js"]:assignment("QR_CITY_QUEST_DATA",source),
    ["core_app_data-"+language+".js"]:assignment("QR_CITY_QUEST_APP_TEXT",app)
  }};
}
(async()=>{
  let passed=0;
  async function check(name,fn){await fn();passed++;console.log("PASS: "+name);}
  const pack=fixture();
  await check("Default English and Hungarian always selectable",()=>{
    const d=localization.discover([],originalGame,originalText);
    assert.deepEqual(d.languages.map(x=>x.code),["en","hu"]);
  });
  await check("Core game includes placeholder items but validates faithful translation",()=>{
    const v=validator.validatePackage(pack.files,{targetEnglishGame:originalGame});
    assert.equal(v.valid,true,v.errors.join("; "));
  });
  await check("Dynamic Spanish language is discovered from enabled complete core pack",()=>{
    const d=localization.discover([pack],originalGame,originalText);
    assert.deepEqual(d.languages.map(x=>x.code),["en","hu","es"]);
    assert.equal(d.packs.es.game.encounters["02"].pages["0201"].text,"¡Hola!");
  });
  await check("Strings and parameterized UI messages localize correctly",()=>{
    const d=localization.discover([pack],originalGame,originalText);
    const ui=localization.makeAppText(originalText,d.packs.es.app);
    assert.equal(ui.homeTitle,"Aventura urbana");
    assert.equal(ui.modInstalled("London"),"London instalado correctamente.");
    assert.equal(typeof ui.unknownAction,"function");
    assert.equal(ui.unknownAction("BAD","0501"),"Translated unknownAction: BAD 0501");
  });
  await check("Built-in UI text remains intact after translation",()=>{
    const d=localization.discover([pack],originalGame,originalText);
    localization.makeAppText(originalText,d.packs.es.app);
    assert.equal(originalText.homeTitle,"City Quest");
  });
  await check("Incomplete core app-data pack is not selectable",()=>{
    const invalid=fixture();
    const txt=invalid.files["core_app_data-es.js"];
    const app=validator.parseStaticJs(txt,"QR_CITY_QUEST_APP_TEXT");
    delete app.homeTitle;
    invalid.files["core_app_data-es.js"]="window.QR_CITY_QUEST_APP_TEXT = "+JSON.stringify(app)+";";
    assert.deepEqual(localization.discover([invalid],originalGame,originalText).languages.map(x=>x.code),["en","hu"]);
  });
  await check("Dangerous or missing placeholders block language activation",()=>{
    const bad=fixture();
    const app=validator.parseStaticJs(bad.files["core_app_data-es.js"],"QR_CITY_QUEST_APP_TEXT");
    app.modInstalled="Instalado!";
    bad.files["core_app_data-es.js"]="window.QR_CITY_QUEST_APP_TEXT = "+JSON.stringify(app)+";";
    const errors=localization.discover([bad],originalGame,originalText);
    assert.equal(errors.languages.length,2);
    assert.match(errors.errors[0],/Missing \{name\}/);
  });
  await check("Gameplay mutation is prohibited in a translation",()=>{
    const bad=fixture();
    const g=validator.parseStaticJs(bad.files["core_game_data-es.js"],"QR_CITY_QUEST_DATA");
    g.encounters["02"].pages["0201"].buttons[0].next="0209";
    bad.files["core_game_data-es.js"]="window.QR_CITY_QUEST_DATA = "+JSON.stringify(g)+";";
    const d=localization.discover([bad],originalGame,originalText);
    assert.equal(d.languages.length,2);
    assert.ok(d.errors.length);
  });
  await check("Two core packs for the same locale conflict",()=>{
    const d=localization.discover([pack,fixture({id:"another-es"})],originalGame,originalText);
    assert.equal(d.languages.filter(x=>x.code==="es").length,1);
    assert.match(d.errors.join(" "),/conflicting main-game language/);
  });
  await check("Disabled core pack disappears, without touching save data",()=>{
    const d=localization.discover([{...pack,enabled:false}],originalGame,originalText);
    assert.deepEqual(d.languages.map(x=>x.code),["en","hu"]);
  });
  await check("Expansion-only language pack does not expose incomplete core language",()=>{
    const mod={id:"london-es",enabled:true,manifest:{id:"london-es",target:"london",languages:["es"]},files:{}};
    const d=localization.discover([mod],originalGame,originalText);
    assert.deepEqual(d.languages.map(x=>x.code),["en","hu"]);
  });
  await check("No downloaded JavaScript executes",()=>{
    const bad=fixture();
    bad.files["core_app_data-es.js"]+='; globalThis.hacked=true;';
    const d=localization.discover([bad],originalGame,originalText);
    assert.deepEqual(d.languages.map(x=>x.code),["en","hu"]);
    assert.equal(globalThis.hacked,undefined);
  });
  await check("Shipped Spanish preview ZIP extracts and validates",async()=>{
    const data=fs.readFileSync(path.join(root,"sample-mods/core-spanish-preview.zip"));
    const archive={name:"core-spanish-preview.zip",size:data.length,
      arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};
    const files=await zipReader.readZip(archive);
    const manifest=validator.parseStaticJs(files["manifest.js"],"QR_CITY_QUEST_MOD_MANIFEST");
    const translated=localization.checkCorePack(
      {id:manifest.id,enabled:true,manifest,files},originalGame,originalText
    );
    assert.equal(translated.valid,true,translated.errors.join("; "));
    assert.ok(translated.pack.data.es.game.encounters["02"].pages["0201"].text.includes("¡Hola"));
  });
  console.log("PASS: "+passed+" dynamic-language checks");
})().catch(e=>{console.error(e);process.exitCode=1;});
