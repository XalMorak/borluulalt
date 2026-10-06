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
   - Submissions merge: cloud submissions + inbox + local, newest submittedAt wins per id / shift key.
   Sticky delete:
   - Ахлах delete writes a tombstone to borluulalt/deleted/{t_key} = {id, biz, at, ...} and removes
     the inbox copy. Every reader (getSubs, push merge, accountant page) hides a submission that
     matches a tombstone (same id or same employee|date|shift|location|tek|kind) and was submitted
     at or before the delete time. A later re-submission of the same shift shows again.
   Overview render:
   - delete_fix / sheet_toggle / overview_date kept re-wrapping renderOverview on timers (each
     only checks its own flag), so the call chain grew forever. After load we mark the current
     chain with all their flags so nobody wraps it again. */
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

  /* ---------- tombstones (sticky delete) ---------- */
  window._tombs=window._tombs||{};
  function safeKey(v){ return String(v||"x").replace(/[.#$\[\]\/]/g,"_"); }
  function tombMatch(s, tombs){
    if(!s) return false;
    tombs=tombs||window._tombs||{};
    var keys=Object.keys(tombs);
    if(!keys.length) return false;
    var b=biz(s), at=String(s.submittedAt||"");
    for(var i=0;i<keys.length;i++){
      var t=tombs[keys[i]];
      if(!t) continue;
      if((t.id && s.id && t.id===s.id) || (t.biz && t.biz===b)){
        if(!at || at<=String(t.at||"")) return true;
      }
    }
    return false;
  }
  window._tombMatch=tombMatch;
  function dropTombed(list, tombs){ return (list||[]).filter(function(s){ return !tombMatch(s, tombs); }); }

  function wrapGetSubs(){
    var g=window.getSubs;
    if(typeof g!=="function" || g._tomb) return;
    var w=function(){ return dropTombed(g.apply(this, arguments)); };
    Object.keys(g).forEach(function(k){ if(k.charAt(0)==="_") w[k]=g[k]; });
    w._tomb=true;
    window.getSubs=w;
  }

  /* guard's report reads localStorage directly, so also purge tombed rows from local storage */
  function purgeLocal(){
    try{
      if(!Object.keys(window._tombs||{}).length || typeof setSubs!=="function") return false;
      var raw=rawSubs(), kept=dropTombed(raw);
      if(kept.length!==raw.length){ setSubs(kept); return true; }
    }catch(e){}
    return false;
  }
  window._purgeTombed=purgeLocal;
  var _tombTimer=null;
  function onTombs(v){
    var before=JSON.stringify(window._tombs||{});
    window._tombs=v||{};
    if(JSON.stringify(window._tombs)===before) return;
    purgeLocal();
    if(role()==="supervisor" && typeof loadSupervisorData==="function"){
      clearTimeout(_tombTimer);
      _tombTimer=setTimeout(function(){ try{ loadSupervisorData(); }catch(e){} }, 300);
    }
  }
  var _tombListen=false;
  function listenTombs(){
    if(_tombListen) return;
    var base=db();
    if(!base) return;
    _tombListen=true;
    var go=function(){
      try{ base.ref("borluulalt/deleted").on("value", function(snap){ onTombs(snap.val()); }, function(){ _tombListen=false; }); }
      catch(e){ _tombListen=false; }
    };
    if(typeof ensureFirebaseAuth==="function") ensureFirebaseAuth().then(go, go); else go();
  }

  function restoreStock(s){
    try{
      if(!s.items || typeof getProducts!=="function" || typeof setProducts!=="function") return;
      var products=getProducts();
      var LOCS=(window.STOCK_LOCS&&window.STOCK_LOCS.length)?window.STOCK_LOCS:["Оюут бар","Манлай бар","VIP","POWER"];
      var loc=LOCS.indexOf(s.location)>=0?s.location:"Оюут бар";
      s.items.forEach(function(it){
        if(!(Number(it&&it.sold)>0)) return;
        var pi=products.findIndex(function(p){ return p.id===it.id; });
        if(pi<0) return;
        if(!products[pi].stockByLoc) products[pi].stockByLoc={};
        LOCS.forEach(function(l){ if(products[pi].stockByLoc[l]==null) products[pi].stockByLoc[l]=0; });
        products[pi].stockByLoc[loc]=(Number(products[pi].stockByLoc[loc])||0)+(Number(it.sold)||0);
        products[pi].stock=LOCS.reduce(function(a,l){ return a+(Number(products[pi].stockByLoc[l])||0); },0);
      });
      setProducts(products);
    }catch(e){ console.warn("restoreStock", e); }
  }

  async function stickyDelete(idx){
    var s=(window._sortedSubs||[])[idx];
    if(!s){ alert("Илгээлт олдсонгүй"); return; }
    if(s.locked){ alert("Түгжигдсэн илгээлтийг устгахын тулд эхлээд түгжээг тайлана уу"); return; }
    var label=(s.employeeName||"")+" — "+(s.date||"")+(s.shift?" ("+s.shift+")":"")+(s.location?" · "+s.location:"")+(tekOf(s)?" · "+tekOf(s):"");
    if(!confirm(label+"\nустгах уу? (зөвхөн энэ нэг илгээлт)")) return;
    try{ if(typeof ensureFirebaseAuth==="function") await ensureFirebaseAuth(); }catch(e){}
    var base=db();
    if(!base){ alert("Сервертэй холбогдсонгүй. Устгал хадгалагдаагүй — дахин оролдоно уу."); return; }
    var u=(U().me?U().me():window.currentUser)||{};
    var tomb={id:s.id||"", biz:biz(s), employeeId:s.employeeId||"", employeeName:s.employeeName||"", date:s.date||"",
      shift:s.shift||"", location:s.location||"", tek:tekOf(s), submittedAt:s.submittedAt||"", at:new Date().toISOString(), by:u.id||""};
    var key="t_"+safeKey(tomb.biz);
    try{
      await base.ref("borluulalt/deleted/"+key).set(tomb);
    }catch(e){
      alert("Устгал серверт хадгалагдсангүй. Дахин оролдоно уу.");
      return;
    }
    window._tombs=Object.assign({}, window._tombs||{}); window._tombs[key]=tomb;
    if(s.id){
      try{
        var ref=base.ref("borluulalt/inbox/"+safeKey(s.id));
        var cur=(await ref.once("value")).val();
        if(cur && String(cur.submittedAt||"")<=tomb.at) await ref.remove();
      }catch(e){}
    }
    restoreStock(s);
    if(typeof setSubs==="function") setSubs(dropTombed(rawSubs()));
    try{ await window.cloudPush(); }catch(e){}
    var det=document.getElementById("selectedSubmissionDetail");
    if(det){ det.classList.add("hidden"); det.innerHTML=""; }
    if(typeof loadSupervisorData==="function") loadSupervisorData();
    if(typeof showAlert==="function") showAlert("editAlert","Устгагдлаа","success");
    alert("1 илгээлт устгагдлаа");
  }
  window.stickyDeleteSubmission=stickyDelete;
  /* delete_fix and guard keep swapping window.deleteSubmission on timers, so intercept the button. */
  document.addEventListener("click", function(ev){
    var el=ev.target && ev.target.closest && ev.target.closest("[onclick]");
    if(!el) return;
    var m=String(el.getAttribute("onclick")||"").match(/deleteSubmission\(\s*(\d+)\s*\)/);
    if(!m) return;
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    if(role()!=="supervisor"){ alert("Зөвхөн ахлах устгана"); return; }
    stickyDelete(Number(m[1]));
  }, true);

  async function stablePush(){
    if(role()!=="supervisor") return true;
    if(window._syncBusy) return false;
    window._syncBusy=true;
    if(typeof updateSyncBadge==="function") updateSyncBadge("busy");
    try{
      try{ if(typeof ensureFirebaseAuth==="function") await ensureFirebaseAuth(); }catch(e){}
      var base=db();
      if(!base) throw new Error("no db");
      /* reads are served from the local mirror (net_gate.js); refresh only what changed first */
      if(typeof window._deltaSync==="function"){
        try{ await window._deltaSync({nodes:["submissions","inbox","deleted","products","wines","logs"], reason:"pre-push"}); }catch(e){ console.warn("pre-push delta", e); }
      }
      var local=(typeof packAll==="function"?packAll():null)||{};
      var cloud=(await base.ref("borluulalt").once("value")).val()||{};
      var tombs=Object.assign({}, cloud.deleted||{}, window._tombs||{});
      var subs=dropTombed(mergeSubs([cloud.submissions, cloud.inbox, rawSubs(), local.submissions]), tombs);
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
  var OV_FLAGS=["_del2","_sheetSafe","_ovDate","_hideLow","_dedupe","_supToday"];
  var _ovReady=false;
  setTimeout(function(){ _ovReady=true; }, 1500); /* ui_patch's last wrap runs ~800ms after load */
  function pinOverview(){
    if(!_ovReady) return;
    var f=window.renderOverview;
    if(typeof f!=="function" || f._ovPinned) return;
    OV_FLAGS.forEach(function(k){ f[k]=true; });
    f._ovPinned=true;
  }

  pin();
  wrapGetSubs();
  listenTombs();
  setInterval(function(){ pin(); wrapGetSubs(); listenTombs(); pinOverview(); }, 250);
  setInterval(purgeLocal, 3000);
})();
