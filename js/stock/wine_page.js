/* wine_page: employee wine tek shows wine catalog */
(function(){
  if(window._winePage) return; window._winePage=true;
  function nrm(s){ return String(s||"").toLowerCase(); }
  function isWineTek(v){ return nrm(v).indexOf("\u0432\u0438\u043d\u043e")>=0; }
  function wines(){
    var a=[];
    try{ if(typeof getWines==="function") a=(getWines()||[]).filter(function(w){ return w&&w.id&&w.name&&!w.hidden; }); }catch(e){}
    return a;
  }
  function firstPid(){
    var body=document.getElementById("salesBody"); if(!body) return 0;
    var inp=body.querySelector("input[id^='prev_'],input[id^='sold_']");
    if(!inp) return 0;
    var m=String(inp.id).match(/_(\d+)$/);
    return m?Number(m[1]):0;
  }
  function wrapGap(){
    if(typeof window.getActiveProducts!=="function" || window.getActiveProducts._page) return;
    var orig=window.getActiveProducts;
    window.getActiveProducts=function(){
      if(window._wineMode) return wines();
      var list=[];
      try{ list=orig.apply(this,arguments)||[]; }catch(e){}
      return list.filter(function(p){ return p && Number(p.id)<100; });
    };
    window.getActiveProducts._page=true;
  }
  function rebuild(){
    wrapGap();
    if(typeof buildSalesTable==="function") buildSalesTable();
    if(typeof updateRecon==="function") updateRecon();
  }
  function pullThenRebuild(){
    if(wines().length){ rebuild(); return; }
    try{
      if(!window._fbDb){ rebuild(); return; }
      _fbDb.ref("borluulalt/wines").once("value").then(function(s){
        var v=s.val(), list=[];
        if(Array.isArray(v)) list=v.filter(function(w){ return w&&w.id&&w.name; });
        else if(v&&typeof v==="object") Object.keys(v).forEach(function(k){ if(v[k]&&v[k].name) list.push(v[k]); });
        if(list.length && typeof setWines==="function") setWines(list);
        rebuild();
      }).catch(function(){ rebuild(); });
    }catch(e){ rebuild(); }
  }
  function applyMode(){
    wrapGap();
    var sel=document.getElementById("receiverName");
    var want=isWineTek(sel&&sel.value);
    window._wineMode=want;
    var pid=firstPid();
    if(want && pid<100) pullThenRebuild();
    else if(!want && pid>=100) rebuild();
  }
  function bind(){
    var sel=document.getElementById("receiverName");
    if(!sel||sel._winePage) return;
    sel._winePage=true;
    sel.addEventListener("change", applyMode);
  }
  wrapGap(); bind(); applyMode();
  setInterval(function(){ wrapGap(); bind(); applyMode(); }, 600);
})();
