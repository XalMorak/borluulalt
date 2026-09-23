/* login_fix: refresh users from Firebase, then use original doLogin/showApp */
(function(){
  if(window._loginFix) return;
  window._loginFix=true;

  function asUsers(u){
    var o={};
    if(!u) return o;
    if(Array.isArray(u)){
      u.forEach(function(v,i){
        if(v && typeof v==="object" && v.name){
          o[String(v.id||v.uid||i)]=v;
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

  function wrap(){
    if(typeof window.doLogin!=="function" || window.doLogin._loginFix) return;
    var orig=window.doLogin;
    window.doLogin=async function(){
      var raw=(document.getElementById("loginId").value||"").trim();
      if(!raw){ if(typeof showAlert==="function") showAlert("loginAlert","ID оруулна уу","error"); return; }
      try{
        var users=mergeUsers(typeof getUsers==="function"?getUsers():{}, await fetchUsers());
        if(typeof setUsers==="function") setUsers(users);
        var hit=findUser(users, raw);
        if(hit){
          document.getElementById("loginId").value=hit.id;
        }
      }catch(e){ console.warn("login_fix", e); }
      return orig.apply(this, arguments);
    };
    window.doLogin._loginFix=true;
  }
  wrap();
  setInterval(wrap, 400);
})();
