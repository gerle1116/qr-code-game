/* Node 22+: node tests/test-mod-runtime.js
   Verifies Step 3 data isolation, translated expansion fallback and safe conditions. */
"use strict";
const assert=require("node:assert/strict");
const conditions=require("../mod-system/mod-conditions.js");
const validator=require("../mod-system/mod-validator.js");
const registry=require("../mod-system/mod-registry.js");
const runtime=require("../mod-system/mod-runtime.js");
function fixture(id="london",target=null,language="en"){
  const manifest={id,name:id,version:"1.0.0",languages:[language]};
  if(target)manifest.target=target;
  const prefix=target||id;
  const game={
    formatVersion:1,
    encounters:{"02":{startPage:"0201",requiredArea:"TOWN",pages:{
      "0201":{id:"0201",speaker:language==="es"?"Guía":"Guide",
        text:language==="es"?"Hola":"Hello",buttons:[
          {index:1,label:"Accept",next:"0202"},{index:2,label:"Later",next:"HOME"}],
        condition:{"1":'!had_item.includes("Magic Key")'},
        actions:[]},
      "0202":{id:"0202",speaker:"Guide",text:"A reward",buttons:[{index:1,label:"Bye",next:"HOME"}],
        actions:[{type:"ADD_ITEM",data:"Magic Key"},{type:"START_QUEST",data:"Find Tower"},
          {type:"ADD_KNOWLEDGE",data:"localMap"},{type:"UNLOCK_AREA",data:"BRIDGE"}]}
    }}},
    items:{"Magic Key":{startPage:"1101",displayName:"Magic Key",pages:{
      "1101":{id:"1101",speaker:"Magic Key",text:"A key",buttons:[{index:1,label:"Bye",next:"HOME"}],actions:[]}
    }}},
    thingsIKnow:{"localMap":{text:"A secret",folder:"places"}},
    knowledgeFolders:{"places":"Locations"},
    questDisplayNames:{"Find Tower":"Find the Tower"}
  };
  const js=(key,data)=>"window."+key+" = "+JSON.stringify(data)+";";
  return {
    id,manifest,enabled:true,
    files:{"manifest.js":js("QR_CITY_QUEST_MOD_MANIFEST",manifest),
      [prefix+"_game_data-"+language+".js"]:js("QR_CITY_QUEST_DATA",game),
      [prefix+"_app_data-"+language+".js"]:js("QR_CITY_QUEST_APP_TEXT",{greeting:"Hello"})}
  };
}
(async()=>{
  let count=0;
  function pass(name){count++;console.log("PASS",name);}
  const london=fixture(),spanish=fixture("london-es","london","es");
  let entries=[london,spanish];
  globalThis.QRCQModStorage={list:async()=>entries};
  assert.equal(validator.validatePackage(london.files).valid,true);
  assert.equal(validator.validatePackage(spanish.files).valid,true);
  pass("English expansion and independent Spanish translation validate");
  assert.equal(registry.inspectPackages(entries).valid,true);
  pass("Independent language-pack compatibility");
  const core={encounters:{"02":{startPage:"0201",pages:{"0201":{id:"0201",speaker:"Merchant",text:"Hi",buttons:[],actions:[]}}}},
    items:{"Gold Coin":{}},questDisplayNames:{}};
  const build=await runtime.build(core,"en");
  assert.deepEqual(build.errors,[]);
  assert.deepEqual(build.loaded,["london"]);
  assert.equal(build.game.encounters["02"],core.encounters["02"]);
  assert.equal(build.game.items["Gold Coin"],core.items["Gold Coin"]);
  pass("Existing encounters and items are not replaced");
  const encounter=build.game.encounters["london:02"];
  assert.equal(encounter.startPage,"london:0201");
  assert.equal(encounter.requiredArea,"london:TOWN");
  assert.equal(encounter.pages["london:0201"].buttons[0].next,"london:0202");
  assert.equal(encounter.pages["london:0201"].__modId,"london");
  pass("NPC, pages, links, and area flags are namespaced");
  const reward=encounter.pages["london:0202"].actions;
  assert.deepEqual(reward.map(x=>x.data),["london:Magic Key","london:Find Tower","london:localMap","london:BRIDGE"]);
  assert.equal(build.game.items["london:Magic Key"].startPage,"london:1101");
  assert.equal(build.game.questDisplayNames["london:Find Tower"],"Find the Tower");
  assert.equal(build.game.thingsIKnow["london:localMap"].folder,"london:places");
  pass("Inventory, quest, knowledge and area actions isolated");
  const cond=encounter.pages["london:0201"].condition["1"];
  assert.equal(conditions.evaluate(cond,{save:{hadItems:[]}},"london"),true);
  assert.equal(conditions.evaluate(cond,{save:{hadItems:["london:Magic Key"]}},"london"),false);
  assert.notEqual(conditions.validate('alert("evil")'),null);
  pass("Conditions are safe and scoped to the expansion");
  const hungarian=await runtime.build(core,"hu");
  assert.equal(hungarian.game.encounters["london:02"].pages["london:0201"].text,"Hello");
  const spanishBuild=await runtime.build(core,"es");
  assert.equal(spanishBuild.game.encounters["london:02"].pages["london:0201"].text,"Hola");
  pass("Unsupported languages fall back to English; independent pack overrides");
  const malicious=fixture("badmod");
  const m=JSON.parse(malicious.files["badmod_game_data-en.js"].replace(/^window\.QR_CITY_QUEST_DATA = /,"").slice(0,-1));
  m.encounters["02"].pages["0201"].condition["1"]="window.location='bad'";
  malicious.files["badmod_game_data-en.js"]="window.QR_CITY_QUEST_DATA = "+JSON.stringify(m)+";";
  assert.equal(validator.validatePackage(malicious.files).valid,false);
  pass("Unsafe condition is rejected during installation validation");
  entries=[{...london,enabled:false}];
  const disabled=await runtime.build(core,"en");
  assert.deepEqual(disabled.loaded,[]);
  assert.equal(disabled.game,core);
  pass("Disabled mod does not alter game data");
  const unsupported=fixture("winmod");
  const win=JSON.parse(unsupported.files["winmod_game_data-en.js"].replace(/^window\.QR_CITY_QUEST_DATA = /,"").slice(0,-1));
  win.encounters["02"].pages["0201"].buttons[0].next="TITLE_SCREEN";
  unsupported.files["winmod_game_data-en.js"]="window.QR_CITY_QUEST_DATA = "+JSON.stringify(win)+";";
  assert.equal(validator.validatePackage(unsupported.files).valid,false);
  pass("Mods cannot finish the core game's victory screen");
  console.log("PASS: "+count+" expansion runtime tests.");
})().catch(e=>{console.error(e);process.exitCode=1;});
