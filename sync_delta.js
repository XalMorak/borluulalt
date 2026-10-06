/* sync_delta.js — loaded LAST. Wires net_gate.js into the app:
   - login: [server login + custom token, see sec_login.js] -> users (version check) -> PIN ok -> one delta sync of the role's nodes
            (full the first time on this device), then the normal login runs and
            reads everything from the local mirror
   - "Мэдээлэл шинэчлэх": one delta sync, then the normal refresh renders from the mirror
   No timers read Firebase. The pins below only keep these two wrappers outermost. */
(function(){
  if(window._syncDelta) return;
  window._syncDelta=true;

  function role(){ return (window.currentUser||{}).role||""; }
  function copyFlags(a,b){ Object.keys(a||{}).forEach(function(k){ if(k.charAt(0)==="_") b[k]=a[k]; }); }
  function badge(s){ try{ if(typeof updateSyncBadge==="function") updateSyncBadge(s); }catch(e){} }
  function stamp(st){ try{ _lastCloudAt=(st&&st.at)||new Date().toISOString(); }catch(e){} badge("ok"); }
  function mirrorUser(id){
    var M=window._mirror?window._mirror():null;
    var users=(M && M.tree && M.tree.borluulalt && M.tree.borluulalt.users)||{};
    id=String(id||"").trim().toLowerCase();
    var keys=Object.keys(users);
    for(var i=0;i<keys.length;i++) if(String(keys[i]).toLowerCase()===id) return users[keys[i]];
    return null;
  }

  function wrapLogin(){
    var prev=window.doLogin;
    if(typeof prev!=="function" || prev._delta) return;
    var fn=async function(){
      var id=((document.getElementById("loginId")||{}).value||"").trim().toLowerCase();
      var pin=((document.getElementById("loginPin")||{}).value||"").trim();
      var sec=null;
      var la=document.getElementById("loginAlert"); if(la) la.innerHTML="";   // no stale error from the previous try
      if(id && typeof window._secSignIn==="function"){
        /* server login (sec_login.js): token modes check the PIN on the server first */
        badge("busy");
        try{ sec=await window._secSignIn(id, pin); }catch(e){ sec={error:"Нэвтрэхэд алдаа гарлаа"}; }
        if(sec && sec.error){
          badge("ok");
          if(typeof showAlert==="function") showAlert("loginAlert", sec.error, "error");
          return;
        }
      }
      if(id && typeof window._deltaSync==="function"){
        badge("busy");
        try{
          await window._deltaSync({nodes:["users"], reason:"login-users"});
          var u=mirrorUser(id);
          if(u && !u.disabled && (!u.pin || String(u.pin)===pin)){
            stamp(await window._deltaSync({nodes:window._deltaNodesFor(u.role||"employee"), reason:"login", reuseMeta:true}));
            /* same as the old page-load pull, but from the fresh local mirror (0 network reads) */
            if(typeof window.cloudPull==="function"){ try{ await window.cloudPull(); }catch(e){} }
            stamp(window._lastDelta);
          } else badge("ok");
        }catch(e){ console.warn("login delta", e); badge("err"); }
      }
      var out=await prev.apply(this, arguments);
      /* the token's uid is the exact users key; inbox rules compare employeeId with it */
      if(sec && sec.ok && window.currentUser && String(window.currentUser.id).toLowerCase()===String(sec.user.id).toLowerCase()){
        window.currentUser.id=sec.user.id;
        window.currentUser.role=sec.user.role;
      }
      return out;
    };
    copyFlags(prev, fn); fn._delta=true; fn._loginFix=true;
    window.doLogin=fn;
  }

  function wrapRefresh(){
    var prev=window.refreshData;
    if(typeof prev!=="function" || prev._delta) return;
    var fn=async function(){
      if(window.currentUser && typeof window._deltaSync==="function"){
        badge("busy");
        try{ stamp(await window._deltaSync({nodes:window._deltaNodesFor(role()), reason:"refresh"})); }
        catch(e){ badge("err"); alert("Шинэчлэхэд алдаа: "+(e&&e.message||e)); return; }
      }
      return prev.apply(this, arguments);
    };
    copyFlags(prev, fn); fn._delta=true; fn._acct=true;
    window.refreshData=fn;
  }

  wrapLogin(); wrapRefresh();
  setInterval(function(){ wrapLogin(); wrapRefresh(); }, 700);   // local only: keeps wrappers outermost
})();
