/* hooks.js — the one place that keeps the page's patches in place.
   Each area registers its "install / keep the DOM right" step with App.keep(fn) instead of running
   its own setInterval. App.settle() runs every registered step, in load order, again and again
   until no global function changes any more (so wrappers end up composed the same way every time),
   and is called: once after all scripts load (js/core/boot.js), and after anything that can change
   the page — DOM changes (one MutationObserver), clicks / input / change, focus and tab visibility.
   Steps must be idempotent (they all check a flag or the DOM first). No timer loops. */
(function(){
  if(window.App && window.App.keep) return;
  var App=window.App=window.App||{};
  var steps=[], busy=false, queued=false, last=0, obs=null, started=false;

  function fnSnapshot(){
    var out=[];
    for(var k in window){
      var v; try{ v=window[k]; }catch(e){ continue; }
      if(typeof v==="function") out.push(k, v);
    }
    return out;
  }
  function same(a,b){
    if(a.length!==b.length) return false;
    for(var i=0;i<a.length;i++) if(a[i]!==b[i]) return false;
    return true;
  }
  /* A step that wraps a global must not hide the flags ("_xyz") of the wrappers below it, or their
     installers would wrap again on the next pass (the old endless-wrapper bug). So whenever a step
     replaces a watched global, the new function inherits the old one's flags it does not set itself. */
  var watched={};
  function inherit(from, to){
    if(typeof from!=="function" || typeof to!=="function" || from===to) return;
    Object.keys(from).forEach(function(k){ if(k.charAt(0)==="_" && !(k in to)) { try{ to[k]=from[k]; }catch(e){} } });
  }
  function runAll(){
    var names=Object.keys(watched);
    for(var i=0;i<steps.length;i++){
      var pre={};
      for(var n=0;n<names.length;n++){ try{ pre[names[n]]=window[names[n]]; }catch(e){} }
      try{ steps[i](); }catch(e){ console.warn("[App.keep]", e); }
      for(n=0;n<names.length;n++){ var cur; try{ cur=window[names[n]]; }catch(e){ continue; } if(cur!==pre[names[n]]) inherit(pre[names[n]], cur); }
    }
  }
  function learn(before, after){
    var bm={}; for(var i=0;i<before.length;i+=2) bm[before[i]]=before[i+1];
    for(var j=0;j<after.length;j+=2) if(bm[after[j]]!==after[j+1]){ watched[after[j]]=1; inherit(bm[after[j]], after[j+1]); }
  }
  App.settle=function(){
    if(busy) return;
    busy=true; last=Date.now();
    if(obs) obs.disconnect();
    try{
      for(var pass=0; pass<6; pass++){
        var before=fnSnapshot();
        runAll();
        var after=fnSnapshot();
        if(same(before, after)){ App._unstable=[]; break; }
        learn(before, after);
        if(pass===5){   /* still changing: someone keeps replacing a global — list who, for tests */
          var bm={}; for(var i=0;i<before.length;i+=2) bm[before[i]]=before[i+1];
          var u=[]; for(var j=0;j<after.length;j+=2) if(bm[after[j]]!==after[j+1]) u.push(after[j]);
          App._unstable=u;
        }
      }
    } finally {
      busy=false;
      if(obs && document.body) obs.observe(document.body, { childList:true, subtree:true });
    }
  };
  /* debounced: at most one settle per ~150 ms, however many changes arrive */
  App.schedule=function(){
    if(queued || !started) return;
    queued=true;
    var wait=Math.max(30, 150-(Date.now()-last));
    setTimeout(function(){ queued=false; App.settle(); }, wait);
  };
  App.keep=function(fn){ if(typeof fn==="function") steps.push(fn); return fn; };

  App.start=function(){
    if(started) return; started=true;
    App.settle();
    if(window.MutationObserver && document.body){
      obs=new MutationObserver(App.schedule);
      obs.observe(document.body, { childList:true, subtree:true });
    }
    ["click","change","input","focusin"].forEach(function(t){ document.addEventListener(t, App.schedule, true); });
    window.addEventListener("load", App.schedule);
    window.addEventListener("focus", App.schedule);
    document.addEventListener("visibilitychange", App.schedule);
  };
})();
