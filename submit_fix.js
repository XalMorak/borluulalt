/* submit_fix: confirm each save on server; do not overwrite others */
(function(){
  if(window._submitFix) return; window._submitFix=true;

  function db(){
    try{
      if(typeof initFirebase==="function") initFirebase();
      if(typeof firebase!=="undefined" && firebase.database){
        if((!firebase.apps||!firebase.apps.length) && typeof firebaseConfig!=="undefined") firebase.initializeApp(firebaseConfig);
        var d=firebase.database();
        if(d && d.ref){ window._fbDb=d; return d; }
      }
    }catch(e){}
    return (window._fbDb && window._fbDb.ref) ? window._fbDb : null;
  }
  function listOf(x){
    if(Array.isArray(x)) return x.filter(Boolean);
    if(x && typeof x==="object") return Object.keys(x).map(function(k){ var v=x[k]; if(v&&typeof v==="object"){ if(!v.id) v.id=k; return v; } return null; }).filter(Boolean);
    return [];
  }
  function tekOf(s){ return String((s&&(s.receiverName||s.tek||s.receiver))||"").trim(); }
  function kindOf(s){
    if(!s) return "bar";
    if(s.kind==="wine"||s.sheet==="wine") return "wine";
    if(String(tekOf(s)).toLowerCase().indexOf("вино")>=0) return "wine";
    return s.kind||"bar";
  }
  function sid(s){
    if(!s) return "";
    if(s.id) return String(s.id).replace(/[.#$\[\]\/]/g,"_");
    return ["s", s.employeeId||"", s.date||"", s.shift||"", s.location||"", tekOf(s), kindOf(s)].join("_").replace(/[.#$\[\]\/]/g,"_");
  }
  function gone(){
    var o={};
    try{ (JSON.parse(localStorage.getItem("deleted_sub_keys")||"[]")||[]).forEach(function(k){ if(k) o[k]=1; }); }catch(e){}
    return o;
  }
  function mergeSubs(a,b){
    var del=gone(), map={};
    listOf(a).concat(listOf(b)).forEach(function(s){
      var k=sid(s);
      if(!k || del[k] || s.deleted) return;
      var cur=map[k];
      if(!cur || String(s.submittedAt||"")>=String(cur.submittedAt||"")) map[k]=s;
    });
    return Object.keys(map).map(function(k){ return map[k]; });
  }
  async function pullInbox(base){
    var inbox=null, cloud=null;
    try{ inbox=(await base.ref("borluulalt/inbox").once("value")).val(); }catch(e){}
    try{ cloud=(await base.ref("borluulalt/submissions").once("value")).val(); }catch(e){}
    var local=(typeof getSubs==="function")?getSubs():[];
    var merged=mergeSubs(mergeSubs(cloud, inbox), local);
    if(typeof setSubs==="function") setSubs(merged);
    return merged;
  }

  window.saveSubmission=async function(){
    window._formDirty=false;
    if(typeof getFormData!=="function"){ alert("Форм алга"); return; }
    var data=getFormData();
    if(!data || !data.date){ if(typeof showAlert==="function") showAlert("empAlert","Огноо алга","error"); return; }
    data.kind=data.kind||(window._wineMode?"wine":"bar");
    data.sheet=data.kind==="wine"?"wine":"bar";
    data.submittedAt=new Date().toISOString();
    data.locked=false;
    if(!data.id) data.id=Date.now()+"_"+(data.employeeId||"e")+"_"+data.kind;
    var key=sid(data);
    var local=(typeof getSubs==="function")?getSubs():[];
    var merged=mergeSubs(local, [data]);
    if(typeof setSubs==="function") setSubs(merged);
    if(typeof addLog==="function") addLog("submit",(data.date||"")+" "+(data.shift||""));
    var base=db();
    if(!base){
      if(typeof showAlert==="function") showAlert("empAlert","Сүлжээ алга. Дахин Хадгалах дар.","error");
      return;
    }
    try{
      await base.ref("borluulalt/inbox/"+key).set(data);
      var snap=await base.ref("borluulalt/inbox/"+key).once("value");
      var got=snap.val();
      if(!got || got.employeeId!==data.employeeId) throw new Error("readback");
      if(typeof showAlert==="function") showAlert("empAlert","Серверт илгээгдлээ ✓","success");
    }catch(e){
      if(typeof showAlert==="function") showAlert("empAlert","Серверт хүрээгүй. Дахин Хадгалах дар.","error");
    }
  };

  if(typeof window.cloudPull==="function" && !window.cloudPull._inbox){
    var _pull=window.cloudPull;
    window.cloudPull=async function(){
      var r=false;
      try{ r=await _pull.apply(this, arguments); }catch(e){}
      try{ var base=db(); if(base) await pullInbox(base); r=true; }catch(e){}
      return r;
    };
    window.cloudPull._inbox=true;
  }

  if(typeof window.cloudPush==="function" && !window.cloudPush._inbox){
    var _push=window.cloudPush;
    window.cloudPush=async function(){
      var u=window.currentUser||{};
      if(u.role!=="supervisor"){
        /* employees must not rewrite the full submissions list */
        return true;
      }
      try{
        var base=db();
        if(base) await pullInbox(base);
      }catch(e){}
      var orig=packAll;
      if(typeof packAll==="function"){
        window.packAll=function(){
          var d=orig.apply(this, arguments)||{};
          delete d.submissions;
          return d;
        };
      }
      var ok=false;
      try{ ok=await _push.apply(this, arguments); }catch(e){ ok=false; }
      if(typeof orig==="function") window.packAll=orig;
      return ok;
    };
    window.cloudPush._inbox=true;
    window.cloudPush._userFix=true;
    window.cloudPush._guard=true;
    window.cloudPush._mergeSubs=true;
  }

  if(typeof window.loadSupervisorData==="function" && !window.loadSupervisorData._inbox){
    var _load=window.loadSupervisorData;
    window.loadSupervisorData=function(){
      var base=db();
      if(base){
        pullInbox(base).then(function(){ _load(); }).catch(function(){ _load(); });
        return;
      }
      _load();
    };
    window.loadSupervisorData._inbox=true;
  }
})();
