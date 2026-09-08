/* wine_page: employee tek -> wine sheet even if wine.js wrapped too early */
(function(){
  if(window._winePage) return; window._winePage=true;
  function nrm(s){ return String(s||"").toLowerCase(); }
  function isWineTek(v){ return nrm(v).indexOf("\u0432\u0438\u043d\u043e")>=0; }
  function wines(){
    var a=[];
    try{ if(typeof getWines==="function") a=(getWines()||[]).filter(function(w){ return w&&w.id&&w.name&&!w.hidden; }); }catch(e){}
    return a;
  }
  function wrapGap(){
    if(typeof window.getActiveProducts!=="function") return;
    if(window.getActiveProducts._page) return;
    var orig=window.getActiveProducts;
    window.getActiveProducts=function(){
      if(window._wineMode) return wines();
      var list=[];
      try{ list=orig.apply(this,arguments)||[]; }catch(e){}
      return list.filter(function(p){ return p && Number(p.id)<100; });
    };
    window.getActiveProducts._page=true;
  }
  function pullThen(cb){
    if(wines().length){ cb&&cb(); return; }
    try{
      if(!window._fbDb){ cb&&cb(); return; }
      _fbDb.ref("borluulalt/wines").once("value").then(function(s){
        var v=s.val(), list=[];
        if(Array.isArray(v)) list=v.filter(function(w){ return w&&w.id&&w.name; });
        else if(v&&typeof v==="object") Object.keys(v).forEach(function(k){ if(v[k]&&v[k].name) list.push(v[k]); });
        if(list.length && typeof setWines==="function") setWines(list);
        cb&&cb();
      }).catch(function(){ cb&&cb(); });
    }catch(e){ cb&&cb(); }
  }
  function applyMode(force){
    wrapGap();
    var sel=document.getElementById("receiverName");
    var want=isWineTek(sel&&sel.value);
    if(!force && !!window._wineMode===want && document.querySelector("#salesBody tr")) {
      if(want && wines().length && !document.querySelector("#salesBody input[id^='prev_11']") && !document.querySelector("#salesBody .wine-sec")){
        /* still beer rows while wine tek */
      } else return;
    }
    window._wineMode=want;
    if(want){
      pullThen(function(){
        window._wineMode=true;
        if(typeof buildSalesTable==="function") buildSalesTable();
        if(typeof updateRecon==="function") updateRecon();
      });
    } else {
      if(typeof buildSalesTable==="function") buildSalesTable();
      if(typeof updateRecon==="function") updateRecon();
    }
  }
  function bind(){
    var sel=document.getElementById("receiverName");
    if(!sel || sel._winePage) return;
    sel._winePage=true;
    sel.addEventListener("change", function(){ applyMode(true); });
  }
  wrapGap();
  bind();
  applyMode(false);
  setInterval(function(){ wrapGap(); bind(); applyMode(false); }, 700);
})();
