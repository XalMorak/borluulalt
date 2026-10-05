/* sync_stable.js — one stable, non-destructive cloudPush; stop cloudPull from re-wrapping forever.
   Why: runtime_fix / guard / user_fix / sync_merge kept replacing each other's cloudPush on timers.
   At random moments the active version was runtime_fix's `ref("borluulalt").set(...)`, which
   overwrites the whole node and deletes inbox / rosters / payments. And sync_merge + user_fix kept
   wrapping cloudPull every ~0.5s, so one pull did more and more Firebase reads over time.
   Rules here:
   - Only the supervisor (ахлах) pushes. Employees save via inbox (submit_fix); accountant writes
     rosters/payments directly. Users are written one-by-one by user_fix.
   - Push uses update() on known children only: products, wines, submissions, logs, updatedAt.
     Never touches inbox, rosters, payments, users.
   - Submissions merge: cloud submissions + inbox + local, newest submittedAt wins per id / shift key. */
(function(){
  if(window._syncStable) return;
  window._syncStable=true;

  var FLAGS=["_safe","_guard","_userFix","_mergeSubs","_inbox","_price","_strongPull"];
  function flag(fn){ if(fn) FLAGS.forEach(function(k){ fn[k]=true; }); fn._stable=true; return fn; }

  function U(){ return window._acctUtil||{}; }
  function role(){ var u=(U().me?U().me():window.currentUser)||{}; return u.role||""; }
  function db(){
    try{ if(typeof initFirebase==="function") initFirebase(); }catch(e){}
    try{ if(typeof firebase!=="undefined" && firebase.database){ var d=firebase.database(); if(d&&d.ref){ window._fbDb=d; return d; } } }catch(e){}
    return window._fbDb||null;
  }
  function listOf(x){
    if(Array.isArray(x)) return x.filter(function(v){ return v && typeof v==="object"; });
    if(x && typeof x==="object") return Object.keys(x).map(function(k){ return x[k]; }).filter(function(v){ return v && typeof v==="object"; });
    return [];
  }
  function clean(v){ return v===undefined?null:JSON.parse(JSON.stringify(v)); }
  function rawSubs(){ try{ return JSON.parse(localStorage.getItem("submissions")||"[]")||[]; }catch(e){ return []; } }
  function goneSet(){
    var o={};
    try{ (JSON.parse(localStorage.getItem("deleted_sub_keys")||"[]")||[]).forEach(function(k){ if(k) o[k]=1; }); }catch(e){}
    return o;
  }
  function tekOf(s){ return String((s&&(s.receiverName||s.tek||s.receiver))||"").trim(); }
  function biz(s){
    if(window._bizKey){ var k=window._bizKey(s); if(k) return k; }
    return [s.employeeId||"",s.date||"",s.shift||"",s.location||"",tekOf(s),(s.kind||s.sheet||"bar")].join("|").toLowerCase();
  }
  function isGone(s, gone){
    if(!s) return true;
    if(s.deleted) return true;
    var b=biz(s);
    if(gone[b]) return true;
    if(s.id && (gone["id:"+s.id] || gone[s.id])) return true;
    var k=["k",s.employeeId||"",s.date||"",s.shift||"",s.location||"",tekOf(s),s.kind||s.sheet||""].join("|");
    return !!gone[k];
  }
  function newer(a,b){ return String((a&&a.submittedAt)||"")>=String((b&&b.submittedAt)||""); }
  function mergeSubs(lists){
    var gone=goneSet(), byId={}, byBiz={};
    lists.forEach(function(l){ listOf(l).forEach(function(s){
      if(isGone(s, gone)) return;
      var k=s.id?("id:"+s.id):("b:"+biz(s));
      if(!byId[k] || newer(s, byId[k])) byId[k]=s;
    }); });
    Object.keys(byId).forEach(function(k){ var s=byId[k], b=biz(s); if(!byBiz[b] || newer(s, byBiz[b])) byBiz[b]=s; });
    return Object.keys(byBiz).map(function(b){ return byBiz[b]; });
  }

  async function stablePush(){
    if(role()!=="supervisor") return true;
    if(window._syncBusy) return false;
    window._syncBusy=true;
    if(typeof updateSyncBadge==="function") updateSyncBadge("busy");
    try{
      try{ if(typeof ensureFirebaseAuth==="function") await ensureFirebaseAuth(); }catch(e){}
      var base=db();
      if(!base) throw new Error("no db");
      var local=(typeof packAll==="function"?packAll():null)||{};
      var cloud=(await base.ref("borluulalt").once("value")).val()||{};
      var subs=mergeSubs([cloud.submissions, cloud.inbox, rawSubs(), local.submissions]);
      var patch={ submissions: subs, updatedAt: new Date().toISOString() };
      if(listOf(local.products).length) patch.products=local.products;
      if(Array.isArray(local.wines) && local.wines.length && local.wines.length>=listOf(cloud.wines).length) patch.wines=local.wines;
      if(Array.isArray(local.logs)) patch.logs=local.logs.slice(-500);
      await base.ref("borluulalt").update(clean(patch));
      if(typeof setSubs==="function") setSubs(subs);
      window._lastCloudAt=patch.updatedAt;
      if(typeof updateSyncBadge==="function") updateSyncBadge("ok");
      return true;
    }catch(e){
      console.warn("stablePush", e);
      if(typeof updateSyncBadge==="function") updateSyncBadge("err");
      return false;
    }finally{
      window._syncBusy=false;
    }
  }
  flag(stablePush);
  window._stablePush=stablePush;

  function pin(){
    if(window.cloudPush!==stablePush) window.cloudPush=stablePush;
    var p=window.cloudPull;
    if(typeof p==="function" && !p._stable) flag(p);
  }
  pin();
  setInterval(pin, 250);
})();
