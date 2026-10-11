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
  function runAll(){
    for(var i=0;i<steps.length;i++){ try{ steps[i](); }catch(e){ console.warn("[App.keep]", e); } }
  }
  App.settle=function(){
    if(busy) return;
    busy=true; last=Date.now();
    if(obs) obs.disconnect();
    try{
      for(var pass=0; pass<6; pass++){
        var before=fnSnapshot();
        runAll();
        if(same(before, fnSnapshot())) break;
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
