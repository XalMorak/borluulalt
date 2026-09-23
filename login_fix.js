/* login_fix: pull latest users from Firebase (SDK + REST) before ID check */
(function(){
  if(window._loginFix) return;
  window._loginFix=true;

  function asUsers(u){
    var o={};
    if(!u) return o;
    if(Array.isArray(u)){
      u.forEach(function(v,i){
        if(v && typeof v==="object" && v.name){
          var id=String(v.id||v.uid||i);
          o[id]=v;
        }
      });
      return o;
    }
    if(typeof u==="object"){
      Object.keys(u).forEach(function(k){
        var v=u[k];
        if(v && typeof v==="object" && v.name) o[String(k)]=v;
      });
    }
    return o;
  }
  function mergeUsers(a,b){
    var out=asUsers(a);
    var add=asUsers(b);
    Object.keys(add).forEach(function(k){ out[k]=add[k]; });
    return out;
  }
  function norm(s){
    return String(s||"").trim().toLowerCase().replace(/\s+/g,"");
  }
  function findUser(users, raw){
    var want=norm(raw);
    if(!want) return null;
    if(users[raw]) return {id:String(raw), rec:users[raw]};
    if(users[want]) return {id:want, rec:users[want]};
    var keys=Object.keys(users);
    for(var i=0;i<keys.length;i++){
      if(norm(keys[i])===want) return {id:keys[i], rec:users[keys[i]]};
    }
    return null;
  }
  function dbUrl(){
    try{
      if(typeof firebaseConfig!=="undefined" && firebaseConfig.databaseURL) return firebaseConfig.databaseURL.replace(/\/$/,"");
    }catch(e){}
    return "https://borluulalt-f9d70-default-rtdb.asia-southeast1.firebasedatabase.app";
  }
  async function fetchUsers(){
    var cloud=null;
    try{
      if(typeof ensureFirebaseAuth==="function") await ensureFirebaseAuth();
      if(typeof initFirebase==="function") initFirebase();
      if(window._fbDb){
        var snap=await Promise.race([
          window._fbDb.ref("borluulalt/users").once("value"),
          new Promise(function(_,rej){ setTimeout(function(){ rej(new Error("timeout")); },8000); })
        ]);
        cloud=snap.val();
      }
    }catch(e){ console.warn("login users sdk", e); }
    if(!cloud){
      try{
        var res=await Promise.race([
          fetch(dbUrl()+"/borluulalt/users.json", {cache:"no-store"}),
          new Promise(function(_,rej){ setTimeout(function(){ rej(new Error("timeout")); },8000); })
        ]);
        if(res && res.ok) cloud=await res.json();
      }catch(e){ console.warn("login users rest", e); }
    }
    return asUsers(cloud);
  }

  window.doLogin=async function(){
    var raw=(document.getElementById("loginId").value||"").trim();
    var pin=(document.getElementById("loginPin").value||"").trim();
    if(!raw){ if(typeof showAlert==="function") showAlert("loginAlert","ID оруулна уу","error"); return; }
    var users=asUsers(typeof getUsers==="function"?getUsers():{});
    var cloud=await fetchUsers();
    users=mergeUsers(users, cloud);
    if(typeof setUsers==="function") setUsers(users);
    var hit=findUser(users, raw);
    if(!hit){
      if(typeof showAlert==="function") showAlert("loginAlert","Ийм ID алга: "+raw,"error");
      return;
    }
    var user=hit.rec;
    if(user.disabled){ if(typeof showAlert==="function") showAlert("loginAlert","ID идэвхгүй","error"); return; }
    if(user.pin && String(user.pin)!==pin){ if(typeof showAlert==="function") showAlert("loginAlert","PIN буруу","error"); return; }
    window.currentUser={id:hit.id, name:user.name, role:user.role||"employee"};
    try{ localStorage.setItem("lastLoginId", hit.id); }catch(e){}
    try{ if(typeof addLog==="function") addLog("login","Нэвтэрсэн"); }catch(e){}
    window._formDirty=false;
    if(typeof showApp==="function") showApp();
  };
})();
