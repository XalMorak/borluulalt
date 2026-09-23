/* user_fix: save one user at a time. Never replace the whole user list. */
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
  function rememberDeleted(ids){
    var arr=[];
    try{ arr=JSON.parse(localStorage.getItem(DEL)||"[]")||[]; }catch(e){}
    (ids||[]).forEach(function(id){
      id=String(id||"");
      if(id && arr.indexOf(id)<0) arr.push(id);
    });
    localStorage.setItem(DEL, JSON.stringify(arr.slice(-400)));
  }
  function forgetDeleted(id){
    var arr=[];
    try{ arr=JSON.parse(localStorage.getItem(DEL)||"[]")||[]; }catch(e){}
    id=String(id||"");
    localStorage.setItem(DEL, JSON.stringify(arr.filter(function(x){ return String(x)!==id; })));
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
    if(typeof initFirebase==="function") initFirebase();
    return window._fbDb||null;
  }
  async function writeUser(id, rec){
    var base=db();
    if(!base) throw new Error("db");
    await base.ref("borluulalt/users/"+id).set(clean(rec));
    var snap=await base.ref("borluulalt/users/"+id).once("value");
    var got=snap.val();
    if(!got || got.name!==rec.name) throw new Error("readback");
    return got;
  }

  function installPush(){
    if(window.cloudPush && window.cloudPush._userFix) return;
    window.cloudPush=async function(){
      if(window._syncBusy) return false;
      window._syncBusy=true;
      if(typeof updateSyncBadge==="function") updateSyncBadge("busy");
      try{
        var base=db();
        if(!base){ window._syncBusy=false; return false; }
        var local=(typeof packAll==="function")?(packAll()||{}):{};
        var disk=rawSubs();
        if(disk.length>listOf(local.submissions).length) local.submissions=disk;
        var snap=await base.ref("borluulalt").once("value");
        var cloud=snap.val()||{};
        local.submissions=mergeSubs(local.submissions, cloud.submissions);
        local.users=mergeUsers(local.users, cloud.users);
        if(!local.products||!listOf(local.products).length) local.products=cloud.products;
        if(!local.wines||listOf(local.wines).length<listOf(cloud.wines).length) local.wines=cloud.wines;
        if(typeof setUsers==="function") setUsers(local.users);
        var patch=clean({
          products: local.products||[],
          submissions: local.submissions||[],
          wines: local.wines||[],
          logs: local.logs||[],
          updatedAt: new Date().toISOString()
        });
        await base.ref("borluulalt").update(patch);
        if(local.users && Object.keys(local.users).length){
          await base.ref("borluulalt/users").update(clean(local.users));
        }
        window._lastCloudAt=patch.updatedAt;
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

  function installSave(){
    if(window.saveUserRow && window.saveUserRow._userFix) return;
    window.saveUserRow=async function(id){
      id=String(id||"").trim();
      var nameEl=document.getElementById("usr_name_"+id);
      var roleEl=document.getElementById("usr_role_"+id);
      var pinEl=document.getElementById("usr_pin_"+id);
      var name=(nameEl&&nameEl.value||"").trim();
      var role=(roleEl&&roleEl.value)||"employee";
      var pin=(pinEl&&pinEl.value||"").trim();
      if(!name){ showAlert("userAlert","Нэр хоосон","error"); return; }
      var rec={name:name, role:role, pin:pin};
      var users=asUsers(typeof getUsers==="function"?getUsers():{});
      users[id]=rec;
      if(typeof setUsers==="function") setUsers(users);
      try{
        await writeUser(id, rec);
        showAlert("userAlert","Хадгаллаа: "+name,"success");
      }catch(e){
        showAlert("userAlert","Нэр серверт хадгалагдсангүй. Дахин дар.","error");
      }
      if(typeof buildUsersTable==="function") buildUsersTable();
    };
    window.saveUserRow._userFix=true;
  }

  function installAdd(){
    if(window.addUser && window.addUser._userFix) return;
    window.addUser=async function(){
      var id=(document.getElementById("newUserId").value||"").trim().toLowerCase();
      var name=(document.getElementById("newUserName").value||"").trim();
      var role=document.getElementById("newUserRole").value||"employee";
      if(!id||!name){ showAlert("userAlert","ID болон нэр","error"); return; }
      if(/[.#$\[\]\/\s]/.test(id)){ showAlert("userAlert","ID-д зай, цэг болохгүй","error"); return; }
      var users=asUsers(getUsers());
      if(users[id]){ showAlert("userAlert","ID давхцаж байна","error"); return; }
      forgetDeleted(id);
      var rec={name:name, role:role, pin:""};
      users[id]=rec;
      setUsers(users);
      try{
        await writeUser(id, rec);
        document.getElementById("newUserId").value="";
        document.getElementById("newUserName").value="";
        showAlert("userAlert","Нэмэгдлээ. Нэвтрэх ID: "+id,"success");
      }catch(e){
        showAlert("userAlert","Серверт нэмэгдсэнгүй. Дахин Нэмэх дар.","error");
      }
      if(typeof buildUsersTable==="function") buildUsersTable();
      if(typeof updateLoginHint==="function") updateLoginHint();
    };
    window.addUser._userFix=true;
  }

  function installDelete(){
    if(typeof window.deleteUser!=="function" || window.deleteUser._userFix) return;
    var prev=window.deleteUser;
    window.deleteUser=async function(id){
      id=String(id||"").trim();
      rememberDeleted([id]);
      var r=prev.apply(this, arguments);
      try{
        var base=db();
        if(base) await base.ref("borluulalt/users/"+id).remove();
      }catch(e){}
      return r;
    };
    window.deleteUser._userFix=true;
  }

  function install(){
    installPush(); installApply(); installPull(); installGet(); installSave(); installAdd(); installDelete();
  }
  install();
  setInterval(install, 700);
})();
