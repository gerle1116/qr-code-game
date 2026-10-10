/* Safe, data-only Boolean conditions for downloaded expansions. No eval/Function. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.QRCQModConditions=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
  "use strict";
  const tokenRE=/\s*(===|!==|>=|<=|&&|\|\||==|!=|[()\[\].,!<>]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\d+(?:\.\d+)?|[A-Za-z_]\w*)/y;
  function tokenize(text){
    if(typeof text!=="string"||text.length>1200)throw Error("Invalid or overly long condition");
    let i=0;const tokens=[];
    while(i<text.length){
      if(/^\s*$/.test(text.slice(i)))break;
      tokenRE.lastIndex=i;
      const m=tokenRE.exec(text);
      if(!m)throw Error("Unsupported condition syntax near "+text.slice(i,i+24));
      tokens.push(m[1]);i=tokenRE.lastIndex;
      if(tokens.length>300)throw Error("Condition is too complex");
    }
    return tokens;
  }
  function run(condition,state={},modId="",context={}){
    const tokens=tokenize(condition);let pos=0;
    const peek=()=>tokens[pos];
    const take=s=>{if(peek()!==s)throw Error("Expected '"+s+"' in condition");pos++;};
    const exists=()=>pos<tokens.length;
    const save=state.save||{}, inventory=save.inventory||[],had=save.hadItems||[],
      knowledge=save.knowledge||[],quests=save.quests||{}, flags=save.flags||{},
      counters=(save.itemState&&save.itemState.counters)||{};
    const qualified=id=>modId?modId+":"+id:id;
    function literal(){
      const t=peek();
      if(!t||!(t[0]==='"'||t[0]==="'"))throw Error("Expected quoted string in condition");
      pos++;
      if(t[0]==='"')return JSON.parse(t);
      return JSON.parse('"'+t.slice(1,-1).replace(/\\'/g,"'").replace(/"/g,'\\"')+'"');
    }
    function atom(){
      const t=peek();if(t===undefined)throw Error("Unexpected end of condition");
      if(t==="("){pos++;const value=or();take(")");return value;}
      if(t==="true"||t==="false"){pos++;return t==="true";}
      if(t==="undefined"){pos++;return undefined;}
      if(t==="null"){pos++;return null;}
      if(/^\d/.test(t)){pos++;return Number(t);}
      if(t[0]==='"'||t[0]==="'")return literal();
      if(t==="counter"){
        pos++;take("(");const name=literal();
        let itemName=context.itemName||"";
        if(peek()===","){pos++;itemName=qualified(literal());}
        take(")");
        return Number(counters[itemName+"::"+name]||0);
      }
      if(t==="had_item"||t==="knowledge"||t==="save"){
        pos++;
        let list;
        if(t==="had_item")list=had;
        else if(t==="knowledge")list=knowledge;
        else {
          take(".");const key=peek();pos++;
          if(key==="inventory")list=inventory;
          else if(key==="hadItems")list=had;
          else if(key==="knowledge")list=knowledge;
          else if(key==="quests"){
            take("[");const quest=qualified(literal());take("]");
            return Object.prototype.hasOwnProperty.call(quests,quest)?quests[quest]:undefined;
          } else if(key==="flags"){
            take(".");const flag=peek();pos++;
            if(flag!=="unlockedAreas")throw Error("Unsupported save flag in mod condition");
            list=flags.unlockedAreas||[];
          } else throw Error("Unsupported save field in mod condition");
        }
        take(".");take("includes");take("(");
        const member=literal();take(")");
        return list.includes(qualified(member));
      }
      throw Error("Unsupported condition token: "+t);
    }
    function unary(){if(peek()==="!"){pos++;return !unary();}return atom();}
    function compare(){
      let left=unary();
      while(["===","!==","==","!=","<",">","<=",">="].includes(peek())){
        const op=peek();pos++;const right=unary();
        switch(op){case "===":left=left===right;break;case "!==":left=left!==right;break;
          case "==":left=left==right;break;case "!=":left=left!=right;break;
          case "<":left=left<right;break;case ">":left=left>right;break;
          case "<=":left=left<=right;break;case ">=":left=left>=right;break;}
      }
      return left;
    }
    function and(){let left=compare();while(peek()==="&&"){pos++;const right=compare();left=Boolean(left&&right);}return left;}
    function or(){let left=and();while(peek()==="||"){pos++;const right=and();left=Boolean(left||right);}return left;}
    if(!exists())return true;
    const result=or();
    if(exists())throw Error("Unexpected trailing condition token: "+peek());
    return Boolean(result);
  }
  function validate(condition){
    try{run(condition,{}, "sample",{});return null;}
    catch(error){return error.message||String(error);}
  }
  return {evaluate:run,validate};
});
