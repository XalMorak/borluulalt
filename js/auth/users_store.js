/* users_store: read / merge the users list (local cache + server). Writes live in js/accountant/acct_users.js (accountant: full control) and js/supervisor/sup_users.js (supervisor: add employee only). */
(function(){
  if(window._userFix) return; window._userFix=true;
  var DEL="deleted_user_ids";

  function asUsers(u){
    var o={};
    if(!u) return o;
    if(Array.isArray(u)){
      u.forEach(function(v,i){ if(v&&typeof v==="object"&&v.name) o[String(i)]=v; });
      return o;
    }
    if(typeof u==="object"){
      Object.keys(u).forEach(function(k){
        if(u[k]&&typeof u[k]==="object"&&u[k].name) o[String(k)]=u[k];
      });
    }
    return o;
  }
  function deleted(){
    var o={};
    try{ (JSON.parse(localStorage.getItem(DEL)||"[]")||[]).forEach(function(id){ if(id) o[String(id)]=1; }); }catch(e){}
    return o;
  }
  function mergeUsers(local, cloud){
    var gone=deleted();
    var out={};
    var c=asUsers(cloud), l=asUsers(local);
    Object.keys(c).forEach(function(k){ if(!gone[k]) out[k]=c[k]; });
    Object.keys(l).forEach(function(k){ if(!gone[k]) out[k]=l[k]; });
    return out;
  }
  function listOf(x){
    if(Array.isArray(x)) return x.filter(Boolean);
    if(x&&typeof x==="object") return Object.keys(x).map(function(k){ return x[k]; }).filter(Boolean);
    return [];
  }
  function clean(v){
    if(Array.isArray(v)) return v.map(clean).filter(function(x){ return x!==undefined; });
    if(v&&typeof v==="object"){
      var o={};
      Object.keys(v).forEach(function(k){
        if(v[k]!==undefined) o[k]=clean(v[k]);
      });
      return o;
    }
    return v===undefined?null:v;
  }
  function rawSubs(){
    try{ return JSON.parse(localStorage.getItem("submissions")||"[]")||[]; }catch(e){ return []; }
  }
  function sid(s){
    if(!s) return "";
    if(s.id) return "id:"+s.id;
    var tek=String((s.receiverName||s.tek||s.receiver)||"").trim();
    return ["k", s.employeeId||"", s.date||"", s.shift||"", s.location||"", tek, s.kind||s.sheet||""].join("|");
  }
  function goneSubs(){
    var o={};
    try{ (JSON.parse(localStorage.getItem("deleted_sub_keys")||"[]")||[]).forEach(function(k){ if(k) o[k]=1; }); }catch(e){}
    return o;
  }
  function mergeSubs(local, cloud){
    var gone=goneSubs(), map={};
    listOf(cloud).forEach(function(s){ var k=sid(s); if(k&&!gone[k]) map[k]=s; });
    listOf(local).forEach(function(s){ var k=sid(s); if(k&&!gone[k]) map[k]=s; });
    return Object.keys(map).map(function(k){ return map[k]; });
  }
  function db(){
    try{ if(typeof initFirebase==="function") initFirebase(); }catch(e){}
    try{
      if(typeof firebase!=="undefined" && firebase.database){
        if((!firebase.apps||!firebase.apps.length) && typeof firebaseConfig!=="undefined"){
          firebase.initializeApp(firebaseConfig);
        }
        var d=firebase.database();
        if(d && d.ref){ window._fbDb=d; return d; }
      }
    }catch(e){}
    return (window._fbDb && window._fbDb.ref) ? window._fbDb : null;
  }


  function installApply(){
    if(typeof window.applyAll!=="function" || window.applyAll._userFix) return;
    var prev=window.applyAll;
    window.applyAll=function(data){
      if(data && !window._skipUserMerge){
        var merged=mergeUsers(typeof getUsers==="function"?getUsers():{}, data.users||{});
        try{ if(typeof setUsers==="function") setUsers(merged); }catch(e){}
        data=Object.assign({}, data, {users:merged});
      }
      return prev.call(this, data);
    };
    window.applyAll._userFix=true;
  }

  function installPull(){
    if(typeof window.cloudPull!=="function" || window.cloudPull._userFix) return;
    var prev=window.cloudPull;
    window.cloudPull=async function(){
      var r=false;
      try{ r=await prev.apply(this, arguments); }catch(e){ r=false; }
      try{
        var base=db();
        if(base){
          var snap=await base.ref("borluulalt/users").once("value");
          var merged=mergeUsers(typeof getUsers==="function"?getUsers():{}, snap.val()||{});
          if(typeof setUsers==="function") setUsers(merged);
          r=true;
        }
      }catch(e){}
      return r;
    };
    window.cloudPull._userFix=true;
  }

  function installGet(){
    if(typeof window.getUser!=="function" || window.getUser._userFix) return;
    window.getUser=function(id){
      var users=(typeof getUsers==="function")?asUsers(getUsers()):{};
      var key=String(id||"").trim().toLowerCase();
      if(users[key]) return users[key];
      if(users[String(id||"").trim()]) return users[String(id||"").trim()];
      var keys=Object.keys(users);
      for(var i=0;i<keys.length;i++){
        if(String(keys[i]).toLowerCase()===key) return users[keys[i]];
      }
      return null;
    };
    window.getUser._userFix=true;
  }




  function install(){
    installApply(); installPull(); installGet();
  }
  install();
  App.keep(install);
})();
