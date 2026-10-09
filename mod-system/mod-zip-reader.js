/* Browser ZIP reader for limited, data-only mod archives. Modern browsers: DecompressionStream("deflate-raw"). */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.QRCQZipReader=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
  "use strict";
  const MAX_ARCHIVE=12500000,MAX_COUNT=200,MAX_FILE=2000000,MAX_TOTAL=12000000;
  const utf8=new TextDecoder("utf-8",{fatal:true});
  function error(text){throw Error("ZIP: "+text);}
  function crc32(bytes) {
    let crc=-1;
    for(const byte of bytes) {
      crc^=byte;
      for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xEDB88320:0);
    }
    return (crc^-1)>>>0;
  }
  function safe(name) {
    return name==="images/" || /^[a-z][a-z0-9_-]*\.js$/.test(name) ||
      /^images\/[a-z0-9][a-z0-9_.-]*\.(png|jpg|jpeg|webp)$/.test(name);
  }
  function imageType(name,buf){
    const ends=name.split(".").pop();
    const png=buf.length>=8&&[137,80,78,71,13,10,26,10].every((x,i)=>buf[i]===x);
    const jpg=buf.length>=3&&buf[0]===255&&buf[1]===216&&buf[2]===255;
    const webp=buf.length>=12&&utf8.decode(buf.subarray(0,4))==="RIFF"&&utf8.decode(buf.subarray(8,12))==="WEBP";
    return ends==="png"?png:ends==="jpg"||ends==="jpeg"?jpg:webp;
  }
  async function inflateRaw(compressed, expected) {
    if(typeof DecompressionStream!=="function") error("This phone/browser does not support ZIP decompression");
    let stream;
    try {stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));}
    catch(_) {error("This browser does not support deflate-raw ZIP files");}
    const reader=stream.getReader(),parts=[];let count=0;
    try {
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        count+=value.length;
        if(count>expected||count>MAX_FILE){await reader.cancel();error("Decompressed size exceeds limit");}
        parts.push(value);
      }
    } catch(e) {try{await reader.cancel();}catch(_){}
      throw Error("ZIP decompression failed: "+e.message);
    }
    const output=new Uint8Array(count);
    let offset=0;
    for(const part of parts){output.set(part,offset);offset+=part.length;}
    return output;
  }
  async function readZip(file){
    if(!file||typeof file.arrayBuffer!=="function")error("Please select a ZIP file");
    if(file.size>MAX_ARCHIVE)error("Archive is too large (12.5 MB max)");
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(bytes.length<22)error("Archive is incomplete");
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const u16=i=>v.getUint16(i,true),u32=i=>v.getUint32(i,true);
    const within=(i,size)=>i>=0&&size>=0&&i+size<=bytes.length;
    let end=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-22-65535);i--){
      if(u32(i)===0x06054b50&&within(i,22+u16(i+20))&&i+22+u16(i+20)===bytes.length) {end=i;break;}
    }
    if(end<0)error("Cannot find ZIP central directory");
    if(u16(end+4)!==0||u16(end+6)!==0)error("Multi-volume ZIP archives are unsupported");
    const count=u16(end+10),entriesOnDisk=u16(end+8);
    if(count!==entriesOnDisk||count>MAX_COUNT||count===0)error("Invalid number of ZIP files");
    const cdSize=u32(end+12),cdAt=u32(end+16);
    if(cdAt===0xffffffff||cdSize===0xffffffff||count===0xffff)error("ZIP64 is unsupported");
    if(!within(cdAt,cdSize)||cdAt+cdSize>end)error("Invalid central directory");
    let pos=cdAt,total=0;
    const items=[];
    const names=new Set();
    for(let i=0;i<count;i++){
      if(!within(pos,46)||u32(pos)!==0x02014b50)error("Damaged central directory");
      const flags=u16(pos+8),method=u16(pos+10);
      const checksum=u32(pos+16),compressed=u32(pos+20),size=u32(pos+24);
      const nameLen=u16(pos+28),extraLen=u16(pos+30),commentLen=u16(pos+32);
      const local=u32(pos+42),external=u32(pos+38);
      if(!within(pos,46+nameLen+extraLen+commentLen)||pos+46+nameLen+extraLen+commentLen>cdAt+cdSize)error("Damaged file listing");
      let name;
      try{name=utf8.decode(bytes.subarray(pos+46,pos+46+nameLen));}catch(_){error("Filename is not valid UTF-8");}
      if(!safe(name))error("Unsafe/unsupported filename: "+name);
      if(names.has(name))error("Duplicate filename: "+name);
      names.add(name);
      if(flags&1||flags&0x40||flags&0x2000)error("Encrypted ZIP entries are not supported");
      if(method!==0&&method!==8)error("Unsupported ZIP compression method");
      if(local===0xffffffff||compressed===0xffffffff||size===0xffffffff)error("ZIP64 is unsupported");
      if(name==="images/"&&size!==0)error("Invalid images directory");
      if(name!=="images/") {
        if(size>MAX_FILE)error("File too large: "+name);
        total+=size;
        if(total>MAX_TOTAL)error("Extracted files exceed 12 MB");
      }
      // ZIP Unix mode: reject symbolic links and other special file types.
      const mode=(external>>>16)&0xffff,type=mode&0xf000;
      if(type!==0&&type!==0x8000&&type!==0x4000)error("ZIP contains an unsupported file type");
      items.push({name,flags,method,compressed,size,checksum,local,nameLen});
      pos+=46+nameLen+extraLen+commentLen;
    }
    if(pos!==cdAt+cdSize)error("Unexpected ZIP central directory bytes");
    const files=Object.create(null);
    for(const entry of items){
      if(entry.name==="images/")continue;
      const offset=entry.local;
      if(!within(offset,30)||u32(offset)!==0x04034b50)error("Invalid local file header");
      const localFlags=u16(offset+6),localMethod=u16(offset+8);
      const localNameLength=u16(offset+26),localExtraLength=u16(offset+28);
      if(localFlags!==entry.flags||localMethod!==entry.method)error("ZIP headers disagree");
      const start=offset+30+localNameLength+localExtraLength;
      if(!within(offset+30,localNameLength+localExtraLength)||!within(start,entry.compressed)||start+entry.compressed>cdAt)
        error("File extends beyond ZIP data");
      let localName;
      try{localName=utf8.decode(bytes.subarray(offset+30,offset+30+localNameLength));}
      catch(_){error("Invalid local filename");}
      if(localName!==entry.name)error("ZIP filenames disagree");
      const source=bytes.subarray(start,start+entry.compressed);
      const out=entry.method===0?source:await inflateRaw(source,entry.size);
      if(out.length!==entry.size)error("Unexpected decompressed size: "+entry.name);
      if(crc32(out)!==entry.checksum)error("Checksum mismatch: "+entry.name);
      if(entry.name.startsWith("images/")) {
        if(!imageType(entry.name,out))error("Invalid image format: "+entry.name);
        files[entry.name]=new Uint8Array(out);
      } else {
        try{files[entry.name]=utf8.decode(out);}
        catch(_){error("Invalid UTF-8 text in "+entry.name);}
      }
    }
    return files;
  }
  return {readZip,crc32,MAX_ARCHIVE};
});
