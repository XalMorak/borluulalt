/* sec_login.js — server-side login (api/login.js) behind a feature flag.
   Mode comes from GET /api/config (Vercel env LOGIN_MODE), cached in localStorage:
     legacy      old behaviour: PIN checked in the browser, anonymous Firebase auth
     transition  POST /api/login -> custom token. If the server is unreachable or not
                 configured (or the user has no PIN yet) fall back to the old login,
                 so nobody is locked out while rolling out.
     secure      server login only; no anonymous sessions (use with the strict rules)
   localStorage "sec_mode" = legacy|transition|secure overrides the server (testing only;
   the database rules are what actually enforce access).
   Exposes: window._secMode(), window._secSignIn(id,pin), window._secSession,
            window._secIdToken(), window._secApi(path, body). */
(function(){
  if(window._secLoginJs) return;
  window._secLoginJs=true;

  var MODES={legacy:1, transition:1, secure:1};
  var cfg={ mode: MODES[localStorage.getItem("sec_mode_cache")] ? localStorage.getItem("sec_mode_cache") : "legacy",
            requirePin: "staff", configured: false, loaded: false };
  window._secSession=null;     // {id, role} while signed in with a custom token
  window._secFallback=false;   // this login fell back to the old (anonymous) path

  function mode(){
    var o=localStorage.getItem("sec_mode");
    return MODES[o] ? o : cfg.mode;
  }
  window._secMode=mode;
  window._secConfig=function(){ return Object.assign({}, cfg, {mode: mode()}); };

  function timeout(ms){ return new Promise(function(_,rej){ setTimeout(function(){ rej(new Error("timeout")); }, ms); }); }
  function app(){
    if(typeof firebase==="undefined") return null;
    try{ if(typeof firebaseConfig!=="undefined" && (!firebase.apps || !firebase.apps.length)) firebase.initializeApp(firebaseConfig); }catch(e){}
    return firebase.auth ? firebase : null;
  }

  var cfgPromise=(async function loadConfig(){
    try{
      var r=await Promise.race([fetch("/api/config", {cache:"no-store"}), timeout(5000)]);
      if(!r.ok) throw new Error("config "+r.status);
      var j=await r.json();
      if(j && MODES[j.mode]){
        cfg.mode=j.mode; cfg.requirePin=j.requirePin||"staff"; cfg.configured=!!j.configured; cfg.loaded=true;
        localStorage.setItem("sec_mode_cache", j.mode);
      }
    }catch(e){ /* static hosting / offline: keep the cached mode */ }
    return cfg;
  })();
  window._secReady=function(){ return cfgPromise; };

  /* token modes never create anonymous sessions (strict rules give them nothing);
     the old helper is still used in legacy mode and after a transition fallback */
  var legacyEnsure=window.ensureFirebaseAuth;
  if(typeof legacyEnsure==="function" && !legacyEnsure._sec){
    var secEnsure=function(cb){
      if(mode()==="legacy" || window._secFallback) return legacyEnsure(cb);
      var fb=app(), u=fb && fb.auth().currentUser, ok=!!(u && !u.isAnonymous);
      if(cb) cb(ok);
      return Promise.resolve(ok);
    };
    secEnsure._sec=true;
    window.ensureFirebaseAuth=secEnsure;
  }

  async function dropTokenSession(){
    window._secSession=null;
    var fb=app();
    try{ if(fb && fb.auth().currentUser && !fb.auth().currentUser.isAnonymous) await fb.auth().signOut(); }catch(e){}
  }

  /* returns {skip} (legacy), {ok,user}, {fallback,reason} or {error} */
  window._secSignIn=async function(id, pin){
    window._secFallback=false;
    await Promise.race([cfgPromise, timeout(5000)]).catch(function(){});
    var m=mode();
    if(m==="legacy"){ await dropTokenSession(); return {skip:true}; }
    async function fallback(reason, msg){
      if(m==="secure") return {error: msg || "Нэвтрэх сервертэй холбогдож чадсангүй. Дахин оролдоно уу."};
      console.warn("server login unavailable, using the old login:", reason);
      await dropTokenSession();
      window._secFallback=true;
      return {fallback:true, reason:reason};
    }
    var r, j={};
    try{
      r=await Promise.race([fetch("/api/login", {method:"POST", cache:"no-store",
        headers:{"Content-Type":"application/json"}, body: JSON.stringify({id:id, pin:pin})}), timeout(12000)]);
      try{ j=await r.json(); }catch(e){ j={}; }
    }catch(e){ return fallback("network"); }
    if(r.status===404 || r.status>=500) return fallback("http "+r.status, j.error);
    if(r.status!==200 || !j.token){
      if(m==="transition" && j.code==="pin-not-set") return fallback("pin-not-set");
      await dropTokenSession();
      return {error: j.error || ("Нэвтрэх боломжгүй ("+r.status+")")};
    }
    var fb=app();
    if(!fb) return fallback("no-sdk");
    try{
      /* in-memory session: a reload needs a new login anyway, nothing stays on shared devices */
      try{ await fb.auth().setPersistence(fb.auth.Auth.Persistence.NONE); }catch(e){}
      await fb.auth().signInWithCustomToken(j.token);
    }catch(e){ console.warn("signInWithCustomToken", e); return fallback("token"); }
    window._secSession={id:j.user.id, role:j.user.role};
    return {ok:true, user:j.user};
  };

  window._secIdToken=async function(){
    var fb=app(), u=fb && fb.auth().currentUser;
    if(!u || u.isAnonymous) return null;
    return await u.getIdToken();
  };
  /* authenticated call to an /api endpoint (e.g. /api/pin) */
  window._secApi=async function(path, body){
    var tok=await window._secIdToken();
    if(!tok) return {status:401, body:{error:"Серверээр нэвтрээгүй байна (дахин нэвтэрнэ үү)"}};
    try{
      var r=await Promise.race([fetch(path, {method:"POST", cache:"no-store",
        headers:{"Content-Type":"application/json", "Authorization":"Bearer "+tok}, body: JSON.stringify(body||{})}), timeout(12000)]);
      var j={}; try{ j=await r.json(); }catch(e){}
      return {status:r.status, body:j};
    }catch(e){ return {status:0, body:{error:"Сүлжээ алга"}}; }
  };

  /* logout ends the token session too */
  function wrapLogout(){
    var prev=window.doLogout;
    if(typeof prev!=="function" || prev._sec) return;
    var fn=function(){
      var r=prev.apply(this, arguments);
      window._secFallback=false;
      dropTokenSession();
      return r;
    };
    Object.keys(prev).forEach(function(k){ if(k.charAt(0)==="_") fn[k]=prev[k]; });
    fn._sec=true;
    window.doLogout=fn;
  }

  /* supervisor "Хэрэглэгч" tab: in secure mode users are managed by the accountant
     (the strict rules refuse supervisor writes to users) */
  function guardSupervisorUsers(){
    ["addUser","saveUserRow","deleteUser"].forEach(function(name){
      var prev=window[name];
      if(typeof prev!=="function" || prev._sec) return;
      var fn=async function(){
        if(mode()==="secure"){
          if(typeof showAlert==="function") showAlert("userAlert","Хэрэглэгч, PIN-ийг Нягтлан удирдана (Нягтлан → Хэрэглэгч).","error");
          return;
        }
        return prev.apply(this, arguments);
      };
      Object.keys(prev).forEach(function(k){ if(k.charAt(0)==="_") fn[k]=prev[k]; });
      fn._sec=true;
      window[name]=fn;
    });
  }

  wrapLogout(); guardSupervisorUsers();
  setInterval(function(){ wrapLogout(); guardSupervisorUsers(); }, 700);   // local only
})();
