/* wine_kind_filter: Пиво/Вино on Тойм, Илгээлт, Тайлан */
(function(){
  if(window._wineKindLoaded)return;
  window._wineKindLoaded=true;
  window._sheetKind=window._sheetKind||"bar";

  function kindOf(s){
    if(!s)return "bar";
    if(s.kind==="wine"||s.sheet==="wine"||s.sheet==="\u0432\u0438\u043d\u043e")return "wine";
    return "bar";
  }
  function filtered(all){
    all=all||(typeof getSubs==="function"?getSubs():[]);
    var k=window._sheetKind||"bar";
    return (all||[]).filter(function(s){return s&&!s.deleted&&kindOf(s)===k;});
  }
  window.sheetFilteredSubs=filtered;

  function wineCtx(){
    var emp=document.getElementById("employeeView");
    if(emp&&!emp.classList.contains("hidden")&&window._wineMode)return true;
    var sup=document.getElementById("supervisorView");
    if(!sup||sup.classList.contains("hidden"))return false;
    if(window._sheetKind!=="wine")return false;
    var ov=document.getElementById("tabOverview");
    var rp=document.getElementById("tabReports");
    if(ov&&!ov.classList.contains("hidden"))return true;
    if(rp&&!rp.classList.contains("hidden"))return true;
    return false;
  }

  function wrapActive(){
    if(typeof window.getActiveProducts!=="function")return;
    if(window.getActiveProducts._kind)return;
    var prev=window.getActiveProducts;
    window.getActiveProducts=function(){
      if(wineCtx()&&typeof getWines==="function"){
        return getWines().filter(function(w){return w&&!w.hidden;});
      }
      return prev.apply(this,arguments);
    };
    window.getActiveProducts._kind=true;
  }

  function wrapOverview(){
    if(typeof window.renderOverview!=="function"||window.renderOverview._kind)return;
    var o=window.renderOverview;
    window.renderOverview=function(all){
      return o(filtered(all));
    };
    window.renderOverview._kind=true;
  }
  function wrapSubs(){
    ["renderSubmissionsList","renderSubmissionsListEnhanced"].forEach(function(name){
      if(typeof window[name]!=="function"||window[name]._kind)return;
      var fn=window[name];
      window[name]=function(all){return fn(filtered(all));};
      window[name]._kind=true;
    });
  }
  function wrapReports(){
    ["renderReports","buildReport","showChart"].forEach(function(name){
      if(typeof window[name]!=="function"||window[name]._kind)return;
      var fn=window[name];
      window[name]=function(){
        var args=[].slice.call(arguments);
        if(!args.length) args=[filtered()];
        else if(Array.isArray(args[0])) args[0]=filtered(args[0]);
        return fn.apply(this,args);
      };
      window[name]._kind=true;
    });
  }

  function barHtml(){
    var k=window._sheetKind||"bar";
    return '<div class="kind-toggle no-print" style="display:flex;gap:8px;margin:0 0 12px">'+
      '<button type="button" class="tab-btn'+(k==="bar"?" active":"")+'" data-kind="bar">\u041f\u0438\u0432\u043e</button>'+
      '<button type="button" class="tab-btn'+(k==="wine"?" active":"")+'" data-kind="wine">\u0412\u0438\u043d\u043e</button></div>';
  }
  function ensureBar(tabId){
    var tab=document.getElementById(tabId);
    if(!tab)return;
    var id="kindBar_"+tabId;
    var el=document.getElementById(id);
    if(!el){
      el=document.createElement("div");
      el.id=id;
      tab.insertBefore(el, tab.firstChild);
    }
    if(el.getAttribute("data-k")===window._sheetKind)return;
    el.setAttribute("data-k",window._sheetKind||"bar");
    el.innerHTML=barHtml();
    el.onclick=function(ev){
      var b=ev.target.closest("[data-kind]");
      if(!b)return;
      window._sheetKind=b.getAttribute("data-kind");
      document.querySelectorAll("[id^='kindBar_']").forEach(function(n){n.removeAttribute("data-k");});
      refresh();
    };
  }

  function refresh(){
    ensureBar("tabOverview");
    ensureBar("tabSubmissions");
    ensureBar("tabReports");
    var all=typeof getSubs==="function"?getSubs():[];
    if(typeof renderOverview==="function")renderOverview(all);
    if(typeof renderSubmissionsListEnhanced==="function")renderSubmissionsListEnhanced(all);
    else if(typeof renderSubmissionsList==="function")renderSubmissionsList(all);
    if(typeof renderReports==="function")renderReports(all);
    else if(typeof buildReport==="function")buildReport();
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
    wrapOverview();
    wrapSubs();
    wrapReports();
    ensureBar("tabOverview");
    ensureBar("tabSubmissions");
    ensureBar("tabReports");
    slimWineTab();
  }
  tick();
  setInterval(tick,900);
})();
