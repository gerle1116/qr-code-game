/* Run with: node tests/test-mod-installer.js */
const assert=require("node:assert/strict");
const zlib=require("node:zlib");
const validator=require("../mod-system/mod-validator.js");
const registry=require("../mod-system/mod-registry.js");
const zip=require("../mod-system/mod-zip-reader.js");
const db=new Map();
globalThis.QRCQModStorage={
  list:async()=>[...db.values()],
  get:async id=>db.get(id),
  put:async item=>db.set(item.id,item),
  remove:async id=>db.delete(id)
};
const installer=require("../mod-system/mod-installer.js");
function fixture(id="london",target=null,lang="en"){
  const manifest={id,name:id,version:"1.0.0",languages:[lang]};
  if(target)manifest.target=target;
  const prefix=target||id;
  const game={formatVersion:1,encounters:{"02":{startPage:"0201",pages:{
    "0201":{id:"0201",speaker:lang==="es"?"Guía":"Guide",
      text:lang==="es"?"Hola":"Hello",buttons:[{label:"Bye",next:"HOME"}],actions:[]}}}},items:{}};
  const assign=(key,x)=>"window."+key+" = "+JSON.stringify(x)+";";
  return {"manifest.js":assign("QR_CITY_QUEST_MOD_MANIFEST",manifest),
    [prefix+"_game_data-"+lang+".js"]:assign("QR_CITY_QUEST_DATA",game),
    [prefix+"_app_data-"+lang+".js"]:assign("QR_CITY_QUEST_APP_TEXT",{greeting:"Hello"})};
}
function archive(files,method=0){
  const h=[],c=[];let off=0;
  const u16=n=>{const b=Buffer.alloc(2);b.writeUInt16LE(n);return b;};
  const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0);return b;};
  for(const [name,text] of Object.entries(files)){
    const n=Buffer.from(name),bytes=Buffer.from(text),def=method===8?zlib.deflateRawSync(bytes):bytes;
    const crc=zip.crc32(bytes);
    const local=Buffer.concat([u32(0x04034b50),u16(20),u16(0),u16(method),u16(0),u16(0),u32(crc),
      u32(def.length),u32(bytes.length),u16(n.length),u16(0),n,def]);
    const central=Buffer.concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(method),u16(0),u16(0),
      u32(crc),u32(def.length),u32(bytes.length),u16(n.length),u16(0),u16(0),u16(0),
      u16(0),u32(0),u32(off),n]);
    h.push(local);c.push(central);off+=local.length;
  }
  const cd=Buffer.concat(c);
  const data=Buffer.concat([...h,cd,u32(0x06054b50),u16(0),u16(0),u16(c.length),u16(c.length),
    u32(cd.length),u32(off),u16(0)]);
  return {name:"test.zip",size:data.length,bytes:data,async arrayBuffer(){
    return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);}};
}
(async()=>{
  let passed=0;
  async function test(title,fn){await fn();passed++;console.log("PASS: "+title);}
  const london=fixture(),spanish=fixture("london-es","london","es");
  await test("English expansion validated",()=>assert.equal(validator.validatePackage(london).valid,true));
  await test("Spanish translation validated",()=>assert.equal(validator.validatePackage(spanish).valid,true));
  await test("Missing app data rejected",()=>{const f={...london};delete f["london_app_data-en.js"];
    assert.equal(validator.validatePackage(f).valid,false);});
  await test("Executable script rejected",()=>assert.equal(validator.validatePackage({
    ...london,"manifest.js":london["manifest.js"]+"alert(1)"}).valid,false));
  await test("Orphan translation rejected",()=>assert.equal(registry.inspectPackages([{files:spanish}]).valid,false));
  await test("English fallback",()=>{
    const state=registry.inspectPackages([{files:london},{files:spanish}]);
    assert.equal(registry.resolveLanguage(state,"london","es").source,"london-es");
    assert.equal(registry.resolveLanguage(state,"london","hu").language,"en");});
  await test("ZIP stored decoding",async()=>assert.equal(
    validator.validatePackage(await zip.readZip(archive(london))).valid,true));
  await test("ZIP deflate decoding",async()=>{
    if(typeof DecompressionStream!=="function"){console.log("SKIP: DecompressionStream unavailable");return;}
    assert.equal(validator.validatePackage(await zip.readZip(archive(london,8))).valid,true);});
  await test("ZIP checksum rejects corruption",async()=>{
    const f=archive(london);f.bytes[50]^=1;
    await assert.rejects(()=>zip.readZip(f),/Checksum mismatch/);});
  await test("Install London",async()=>assert.equal((await installer.install(archive(london))).id,"london"));
  await test("Reject orphan install",async()=>await assert.rejects(
    ()=>installer.install(archive(fixture("orphan-es","orphan","es"))),/required expansion/));
  await test("Install Spanish separately",async()=>assert.equal(
    (await installer.install(archive(spanish))).kind,"language"));
  await test("Block disabling parent while translation enabled",async()=>await assert.rejects(
    ()=>installer.setEnabled("london",false),/required expansion/));
  await test("Disable, enable and remove",async()=>{
    await installer.setEnabled("london-es",false);
    await installer.setEnabled("london",false);
    await installer.setEnabled("london",true);
    await installer.remove("london-es");
    await installer.remove("london");
    assert.equal((await installer.list()).length,0);
  });
  console.log("PASS: "+passed+" mod installer tests");
})().catch(err=>{console.error(err);process.exitCode=1;});
