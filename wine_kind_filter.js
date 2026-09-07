/* wine_kind_filter: Пиво / Вино / Нэгдсэн */
(function(){
  if(window._wineKindLoaded){window._wineKindLoaded=false;}
  if(window._wineKindV2)return;
  window._wineKindV2=true;
  window._sheetKind=window._sheetKind||"bar";

  function kindOf(s){
    if(!s)return "bar";
    if(s.kind==="wine"||s.sheet==="wine"||s.sheet==="\u0432\u0438\u043d\u043e")return "wine";
    return "bar";
  }
  function filtered(all){
    all=all||(typeof getSubs==="function"?getSubs():[]);
    var k=window._sheetKind||"bar";
    return (all||[]).filter(function(s){
      if(!s||s.deleted)return false;
      if(k==="all")return true;
      return kindOf(s)===k;
    });
  }
  window.sheetFilteredSubs=filtered;

  function wineCtx(){
    var emp=document.getElementById("employeeView");
    if(emp&&!emp.classList.contains("hidden")&&window._wineMode)return true;
    var sup=document.getElementById("supervisorView");
    if(!sup||sup.classList.contains("hidden"))return false;
    if(window._sheetKind!=="wine"&&window._sheetKind!=="all")return false;
    var ov=document.getElementById("tabOverview");
    var rp=document.getElementById("tabReports");
    if(ov&&!ov.classList.contains("hidden")&&window._sheetKind==="wine")return true;
    if(rp&&!rp.classList.contains("hidden")&&window._sheetKind==="wine")return true;
    return false;
  }

  function wrapActive(){
    if(typeof window.getActiveProducts!=="function"||window.getActiveProducts._kindV2)return;
    var prev=window.getActiveProducts;
    window.getActiveProducts=function(){
      if(wineCtx()&&typeof getWines==="function"){
        return getWines().filter(function(w){return w&&!w.hidden;});
      }
      if(window._sheetKind==="all"){
        var beers=[];
        try{beers=prev.apply(this,arguments)||[];}catch(e){}
        var wines=(typeof getWines==="function")?getWines():[];
        return beers.concat(wines.filter(function(w){return w&&!w.hidden;}));
      }
      return prev.apply(this,arguments);
    };
    window.getActiveProducts._kindV2=true;
  }

  function wrapFn(name){
    if(typeof window[name]!=="function"||window[name]._kindV2)return;
    var fn=window[name];
    window[name]=function(all){
      if(Array.isArray(all)||all==null) return fn(filtered(all));
      return fn.apply(this,arguments);
    };
    window[name]._kindV2=true;
  }

  function wrapGetSubsTemp(fn){
    return function(){
      var g=window.getSubs;
      window.getSubs=function(){return filtered(g());};
      try{return fn.apply(this,arguments);}
      finally{window.getSubs=g;}
    };
  }
  function wrapReportFns(){
    ["runReport","showChart","initReportFilters"].forEach(function(name){
      if(typeof window[name]!=="function"||window[name]._kindV2)return;
      window[name]=wrapGetSubsTemp(window[name]);
      window[name]._kindV2=true;
    });
  }

  function label(){
    var k=window._sheetKind||"bar";
    if(k==="wine")return "\u0412\u0438\u043d\u043e";
    if(k==="all")return "\u041d\u044d\u0433\u0434\u0441\u044d\u043d";
    return "\u041f\u0438\u0432\u043e";
  }
  function barHtml(withAll){
    var k=window._sheetKind||"bar";
    var btn=function(id,txt){
      return '<button type="button" class="tab-btn'+(k===id?" active":"")+'" data-kind="'+id+'">'+txt+'</button>';
    };
    var h=btn("bar","\u041f\u0438\u0432\u043e")+btn("wine","\u0412\u0438\u043d\u043e");
    if(withAll) h+=btn("all","\u041d\u044d\u0433\u0434\u0441\u044d\u043d");
    return '<div class="kind-toggle no-print" style="display:flex;gap:8px;margin:0 0 12px;flex-wrap:wrap">'+h+'</div>';
  }
  function ensureBar(tabId, withAll){
    var tab=document.getElementById(tabId);
    if(!tab)return;
    var id="kindBar_"+tabId;
    var el=document.getElementById(id);
    if(!el){
      el=document.createElement("div");
      el.id=id;
      tab.insertBefore(el, tab.firstChild);
    }
    var key=(window._sheetKind||"bar")+(withAll?"_all":"");
    if(el.getAttribute("data-k")===key)return;
    el.setAttribute("data-k",key);
    el.innerHTML=barHtml(withAll);
    el.onclick=function(ev){
      var b=ev.target.closest("[data-kind]");
      if(!b)return;
      window._sheetKind=b.getAttribute("data-kind");
      document.querySelectorAll("[id^='kindBar_']").forEach(function(n){n.removeAttribute("data-k");});
      refresh();
    };
  }

  function refresh(){
    ensureBar("tabOverview",true);
    ensureBar("tabSubmissions",true);
    ensureBar("tabReports",true);
    var all=typeof getSubs==="function"?getSubs():[];
    if(typeof renderOverview==="function")renderOverview(all);
    if(typeof renderSubmissionsListEnhanced==="function")renderSubmissionsListEnhanced(all);
    else if(typeof renderSubmissionsList==="function")renderSubmissionsList(all);
    if(typeof runReport==="function")runReport();
    else if(typeof renderReports==="function")renderReports(all);
  }
  window.setSheetKind=function(k){window._sheetKind=k;refresh();};

  function slimWineTab(){
    var box=document.getElementById("wineSummary");
    if(box)box.style.display="none";
    var table=document.querySelector("#tabWine table");
    if(!table)return;
    var heads=table.querySelectorAll("thead th");
    if(heads.length>=6){
      if(heads[4])heads[4].style.display="none";
      if(heads[5])heads[5].style.display="none";
    }
    table.querySelectorAll("tbody tr").forEach(function(tr){
      if(tr.classList.contains("wine-sec"))return;
      if(tr.cells[4])tr.cells[4].style.display="none";
      if(tr.cells[5])tr.cells[5].style.display="none";
    });
  }

  function tick(){
    wrapActive();
    wrapFn("renderOverview");
    wrapFn("renderSubmissionsList");
    wrapFn("renderSubmissionsListEnhanced");
    wrapReportFns();
    ensureBar("tabOverview",true);
    ensureBar("tabSubmissions",true);
    ensureBar("tabReports",true);
    slimWineTab();
  }
  tick();
  setInterval(tick,900);
})();
