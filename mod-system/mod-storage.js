/* Installed mod archive storage. Separate from the game's localStorage save. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.QRCQModStorage=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
  "use strict";
  const DB_NAME="qr-city-quest-mods-v1",STORE="packages";
  function open(){
    if(typeof indexedDB==="undefined")return Promise.reject(Error("This browser does not support local mod storage"));
    return new Promise((resolve,reject)=>{
      let request;
      try{request=indexedDB.open(DB_NAME,1);}catch(e){reject(e);return;}
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"id"});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||Error("Could not open mod storage"));
      request.onblocked=()=>reject(Error("Close other open tabs of this game and try again"));
    });
  }
  async function transact(mode, action) {
    const db=await open();
    return new Promise((resolve,reject)=>{
      let txn,request;
      try{txn=db.transaction(STORE,mode);request=action(txn.objectStore(STORE));}
      catch(e){db.close();reject(e);return;}
      let value;
      request.onsuccess=()=>{value=request.result;};
      request.onerror=()=>{ /* transaction will reject via onabort */ };
      txn.oncomplete=()=>{db.close();resolve(value);};
      txn.onerror=()=>{ /* onabort carries the final error */ };
      txn.onabort=()=>{db.close();reject(txn.error||Error("Mod storage transaction failed"));};
    });
  }
  function list(){return transact("readonly",store=>store.getAll());}
  function get(id){return transact("readonly",store=>store.get(id));}
  function put(entry){return transact("readwrite",store=>store.put(entry));}
  function remove(id){return transact("readwrite",store=>store.delete(id));}
  return {list,get,put,remove};
});
