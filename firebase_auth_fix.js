/* Firebase Auth gate: anonymous sign-in so RTDB rules can require auth != null */
function ensureFirebaseAuth(cb){
  if(typeof firebase==="undefined"){if(cb)cb(false);return Promise.resolve(false);}
  if(typeof firebaseConfig!=="undefined"&&(!firebase.apps||!firebase.apps.length)){
    try{firebase.initializeApp(firebaseConfig);}catch(e){}
  }
  if(!firebase.auth){console.warn("firebase-auth SDK missing");if(cb)cb(false);return Promise.resolve(false);}
  return new Promise(function(resolve){
    var auth=firebase.auth();
    if(auth.currentUser){if(cb)cb(true);resolve(true);return;}
    auth.signInAnonymously().then(function(){
      if(cb)cb(true);resolve(true);
    }).catch(function(err){
      console.warn("anon auth", err);
      if(cb)cb(false);resolve(false);
    });
  });
}

(function wrapInit(){
  function apply(){
    if(window._authGate||typeof window.initFirebase!=="function")return;
    window._authGate=true;
    var _init=window.initFirebase;
    window.initFirebase=function(){
      var ok=_init.apply(this,arguments);
      if(!ok)return false;
      if(firebase.auth&&!firebase.auth().currentUser){
        ensureFirebaseAuth();
      }
      return true;
    };
  }
  apply();setInterval(apply,300);
})();

(function(){
  function wrapAsync(name){
    if(window["_authWrap_"+name]||typeof window[name]!=="function")return;
    window["_authWrap_"+name]=true;
    var orig=window[name];
    window[name]=async function(){
      await ensureFirebaseAuth();
      return await orig.apply(this,arguments);
    };
  }
  function tick(){
    wrapAsync("cloudPull");
    wrapAsync("cloudPush");
    if(typeof startRealtimeSync==="function"&&!window._rtAuthHooked){
      window._rtAuthHooked=true;
      var _s=startRealtimeSync;
      window.startRealtimeSync=function(){
        ensureFirebaseAuth().then(function(ok){if(ok)_s();});
      };
    }
  }
  tick();setInterval(tick,400);
})();
