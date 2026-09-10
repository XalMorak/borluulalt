/* sheet_toggle: Пиво | Вино | Нэгдсэн on Тойм + Тайлан */
(function(){
  if(window._sheetToggle) return; window._sheetToggle=true;
  window._sheetKind=window._sheetKind||"all";

  function nrm(s){ return String(s||"").toLowerCase(); }
  function beers(){
    var a=[];
    try{ a=(typeof getProducts==="function"?getProducts():[])||[]; }catch(e){}
    return a.filter(function(p){ return p && !p.deleted && Number(p.id)<100; });
  }
  function wines(){
    var a=[];
    try{ a=(typeof getWines==="function"?getWines():[])||[]; }catch(e){}
    return a.filter(function(w){ return w && w.id && w.name && !w.hidden; });
  }
  function catalog(){
    var k=window._sheetKind||"all";
    if(k==="wine") return wines();
    if(k==="bar") return beers();
    return beers().concat(wines());
  }
  function kindOf(s){
    if(!s) return "bar";
    if(s.kind==="wine"||s.sheet==="wine") return "wine";
    var tek=nrm(s.receiverName||s.tek||s.receiver||"");
    if(tek.indexOf("\u0432\u0438\u043d\u043e")>=0) return "wine";
    var items=s.items||[];
    for(var i=0;i<items.length;i++){
      if(Number(items[i]&&items[i].id)>=100) return "wine";
    }
    return "bar";
  }
  function filterKind(list){
    var k=window._sheetKind||"all";
    return (list||[]).filter(function(s){
      if(!s||s.deleted) return false;
      if(k==="all") return true;
      return kindOf(s)===k;
    });
  }
  function wrapGetSubs(){
    if(typeof window.getSubs!=="function"||window.getSubs._sheet) return;
    var raw=window.getSubs;
    window.getSubs=function(){
      var list=raw.apply(this,arguments)||[];
      if(window._sheetRaw) return list;
      return filterKind(list);
    };
    window.getSubs._sheet=true;
    window.getSubs._raw=raw;
  }
  function wrapOverview(){
    if(typeof window.renderOverview!=="function"||window.renderOverview._sheet) return;
    var orig=window.renderOverview;
    window.renderOverview=function(all){
      wrapGetSubs();
      if(!all){
        window._sheetRaw=true;
        try{ all=(window.getSubs._raw?window.getSubs._raw():(typeof getSubs==="function"?getSubs():[])); }
        finally{ window._sheetRaw=false; }
      }
      all=filterKind(all);
      var prev=window.getActiveProducts;
      window.getActiveProducts=catalog;
      try{ return orig(all); }
      finally{
        window.getActiveProducts=prev;
        groupTable();
      }
    };
    window.renderOverview._sheet=true;
  }
  function groupTable(){
    var tb=document.getElementById("productTotalsBody"); if(!tb) return;
    var rows=[].slice.call(tb.querySelectorAll("tr"));
    if(!rows.length) return;
    if(tb.querySelector(".sheet-sec")) return;
    var beer=[], wine=[], total=null;
    rows.forEach(function(tr){
      var t=tr.textContent||"";
      if(t.indexOf("\u041d\u0418\u0419\u0422")>=0){ total=tr; return; }
      var id=Number((tr.cells[0]&&tr.cells[0].textContent)||0);
      if(id>=100) wine.push(tr); else beer.push(tr);
    });
    if(!wine.length||!beer.length) return;
    function hdr(label){
      var tr=document.createElement("tr"); tr.className="sheet-sec";
      tr.innerHTML='<td colspan="6" style="background:#1e3a5f;color:#fff;font-weight:700;text-align:left;padding:8px">'+label+'</td>';
      return tr;
    }
    tb.innerHTML="";
    tb.appendChild(hdr("\u041f\u0438\u0432\u043e")); beer.forEach(function(r){ tb.appendChild(r); });
    tb.appendChild(hdr("\u0412\u0438\u043d\u043e")); wine.forEach(function(r){ tb.appendChild(r); });
    if(total) tb.appendChild(total);
  }
  function refresh(){
    wrapGetSubs(); wrapOverview();
    var all;
    window._sheetRaw=true;
    try{ all=window.getSubs._raw?window.getSubs._raw():(typeof getSubs==="function"?getSubs():[]); }
    finally{ window._sheetRaw=false; }
    if(typeof renderOverview==="function") renderOverview(all);
    if(typeof applyOverviewFilter==="function") try{ applyOverviewFilter(); }catch(e){}
    if(typeof renderSubmissionsListEnhanced==="function") renderSubmissionsListEnhanced(filterKind(all));
    else if(typeof renderSubmissionsList==="function") renderSubmissionsList(filterKind(all));
    if(typeof runReport==="function") runReport();
    paint();
  }
  function paint(){
    document.querySelectorAll("[data-sheet-kind]").forEach(function(b){
      var on=b.getAttribute("data-sheet-kind")===(window._sheetKind||"all");
      b.style.background=on?"#1b7a4a":"#fff";
      b.style.color=on?"#fff":"#123";
      b.style.borderColor=on?"#1b7a4a":"#c5d0dc";
    });
  }
  function barHtml(){
    return '<span style="font-weight:700;color:#1e3a5f;margin-right:4px">Хуваах:</span>'
      + btn("bar","Пиво")+btn("wine","Вино")+btn("all","Нэгдсэн");
  }
  function btn(k,label){
    return '<button type="button" data-sheet-kind="'+k+'" style="padding:8px 16px;border-radius:999px;border:1px solid #c5d0dc;background:#fff;font-weight:700;cursor:pointer">'+label+'</button>';
  }
  function mount(tabId){
    var tab=document.getElementById(tabId); if(!tab) return;
    var old=document.getElementById("kindBar_"+tabId); if(old) old.style.display="none";
    var id="sheetBar_"+tabId;
    var el=document.getElementById(id);
    if(!el){
      el=document.createElement("div");
      el.id=id;
      el.style.cssText="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px;padding:10px 12px;background:#e8f4ee;border:1px solid #b7dbc8;border-radius:12px";
      el.innerHTML=barHtml();
      el.addEventListener("click",function(ev){
        var b=ev.target.closest("[data-sheet-kind]"); if(!b) return;
        window._sheetKind=b.getAttribute("data-sheet-kind");
        refresh();
      });
      tab.insertBefore(el, tab.firstChild);
    }
    paint();
  }
  function boot(){
    wrapGetSubs(); wrapOverview();
    mount("tabOverview");
    mount("tabSubmissions");
    mount("tabReports");
  }
  boot();
  setInterval(boot,800);
})();
