/* user_fix: merge users on sync. Do not replace doLogin. */
(function(){
  if(window._userFix) return; window._userFix=true;
  var DEL="deleted_user_ids";

  function asUsers(u){
    var o={};
    if(!u) return o;
    if(Array.isArray(u)){
      u.forEach(function(v,i){ if(v&&typeof v==="object") o[String(i)]=v; });
      return o;
    }
    if(typeof u==="object"){
      Object.keys(u).forEach(function(k){ if(u[k]&&typeof u[k]==="object") o[String(k).toLowerCase()]=u[k]; });
    }
    return o;
  }
  function deleted(){
    var o={};
    try{ (JSON.parse(localStorage.getItem(DEL)||"[]")||[]).forEach(function(id){ if(id) o[String(id).toLowerCase()]=1; }); }catch(e){}
    return o;
  }
  function rememberDeleted(ids){
    var arr=[];
    try{ arr=JSON.parse(localStorage.getItem(DEL)||"[]")||[]; }catch(e){}
    (ids||[]).forEach(function(id){
      id=String(id||"").toLowerCase();
      if(id && arr.indexOf(id)<0) arr.push(id);
    });
    localStorage.setItem(DEL, JSON.stringify(arr.slice(-400)));
  }
  function mergeUsers(local, cloud, gone){
    gone=gone||deleted();
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

  function installPush(){
    if(window.cloudPush && window.cloudPush._userFix) return;
    window.cloudPush=async function(){
      if(window._syncBusy) return false;
      window._syncBusy=true;
      if(typeof updateSyncBadge==="function") updateSyncBadge("busy");
      try{
        if(typeof initFirebase==="function") initFirebase();
        if(!window._fbDb){ window._syncBusy=false; return false; }
        var local=(typeof packAll==="function")?(packAll()||{}):{};
        var disk=rawSubs();
        if(disk.length>listOf(local.submissions).length) local.submissions=disk;
        var snap=await window._fbDb.ref("borluulalt").once("value");
        var cloud=snap.val()||{};
        if(Array.isArray(cloud.deletedUsers)) rememberDeleted(cloud.deletedUsers);
        local.submissions=mergeSubs(local.submissions, cloud.submissions);
        local.users=mergeUsers(local.users, cloud.users);
        var gone=deleted();
        local.deletedUsers=Object.keys(gone);
        if(!local.products||!listOf(local.products).length) local.products=cloud.products;
        if(!local.wines||listOf(local.wines).length<listOf(cloud.wines).length) local.wines=cloud.wines;
        if(typeof setUsers==="function") setUsers(local.users);
        local.updatedAt=new Date().toISOString();
        if(typeof applyAll==="function"){
          window._skipUserMerge=true;
          try{ applyAll(local); } finally { window._skipUserMerge=false; }
        }
        await window._fbDb.ref("borluulalt").set(local);
        window._lastCloudAt=local.updatedAt;
        if(typeof updateSyncBadge==="function") updateSyncBadge("ok");
        window._syncBusy=false;
        return true;
      }catch(e){
        if(typeof updateSyncBadge==="function") updateSyncBadge("err");
        window._syncBusy=false;
        return false;
      }
    };
    window.cloudPush._guard=true;
    window.cloudPush._safe=true;
    window.cloudPush._userFix=true;
  }

  function installApply(){
    if(typeof window.applyAll!=="function" || window.applyAll._userFix) return;
    var prev=window.applyAll;
    window.applyAll=function(data){
      if(data && !window._skipUserMerge){
        if(Array.isArray(data.deletedUsers)) rememberDeleted(data.deletedUsers);
        var merged=mergeUsers(typeof getUsers==="function"?getUsers():{}, data.users||{});
        data=Object.assign({}, data, {users:merged});
      }
      return prev.call(this, data);
    };
    window.applyAll._userFix=true;
  }

  function installDelete(){
    if(typeof window.deleteUser!=="function" || window.deleteUser._userFix) return;
    var prev=window.deleteUser;
    window.deleteUser=async function(id){
      rememberDeleted([id]);
      return prev.apply(this, arguments);
    };
    window.deleteUser._userFix=true;
  }

  function installAdd(){
    if(typeof window.addUser!=="function" || window.addUser._userFix) return;
    window.addUser=async function(){
      var id=(document.getElementById("newUserId").value||"").trim().toLowerCase();
      var name=(document.getElementById("newUserName").value||"").trim();
      var role=document.getElementById("newUserRole").value;
      if(!id||!name){ showAlert("userAlert","ID болон нэр","error"); return; }
      if(/[.#$\[\]\/\s]/.test(id)){ showAlert("userAlert","ID-д зай, цэг болохгүй","error"); return; }
      var users=getUsers();
      if(users[id]){ showAlert("userAlert","ID давхцаж байна","error"); return; }
      var gone=deleted(); delete gone[id];
      localStorage.setItem(DEL, JSON.stringify(Object.keys(gone)));
      users[id]={name:name, role:role, pin:""};
      setUsers(users);
      var ok=false;
      try{ ok=await cloudPush(); }catch(e){ ok=false; }
      try{
        if(typeof initFirebase==="function") initFirebase();
        if(window._fbDb) await window._fbDb.ref("borluulalt/users/"+id).set({name:name, role:role, pin:""});
        ok=true;
      }catch(e){}
      document.getElementById("newUserId").value="";
      document.getElementById("newUserName").value="";
      if(!ok) showAlert("userAlert","Хадгалагдсангүй. Дахин Нэмэх дарна уу.","error");
      else showAlert("userAlert","Нэмэгдлээ. Нэвтрэх ID: "+id,"success");
      if(typeof buildUsersTable==="function") buildUsersTable();
      if(typeof updateLoginHint==="function") updateLoginHint();
    };
    window.addUser._userFix=true;
  }

  function install(){
    installPush(); installApply(); installDelete(); installAdd();
  }
  install();
  setInterval(install, 700);
})();
