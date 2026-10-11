/* sheet_toggle: UI filter only — never wrap getSubs (that wiped wine submits) */
(function(){
  if(window._sheetSafe) return; window._sheetSafe=true;
  window._sheetKind="all";

  if(window.getSubs && window.getSubs._sheet && window.getSubs._raw){
    window.getSubs=window.getSubs._raw;
  }

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
  function allSubs(){
    var list=[];
    try{
      if(window.getSubs && window.getSubs._raw) list=window.getSubs._raw()||[];
      else if(typeof getSubs==="function") list=getSubs()||[];
    }catch(e){}
    return (list||[]).filter(function(s){ return s && !s.deleted; });
  }
  function filterKind(list){
    var k=window._sheetKind||"all";
    return (list||[]).filter(function(s){
      if(!s||s.deleted) return false;
      if(k==="all") return true;
      return kindOf(s)===k;
    });
  }
  if(typeof window.packAll==="function" && !window.packAll._sheetSafe){
    var _pack=window.packAll;
    window.packAll=function(){
      var raw=window.getSubs && window.getSubs._raw ? window.getSubs._raw : window.getSubs;
      var keep=typeof raw==="function"?raw:null;
      if(window.getSubs && window.getSubs._sheet && window.getSubs._raw) window.getSubs=window.getSubs._raw;
      var d=_pack.apply(this,arguments)||{};
      return d;
    };
    window.packAll._sheetSafe=true;
  }
  function wrapOverview(){
    if(typeof window.renderOverview!=="function"||window.renderOverview._sheetSafe) return;
    var orig=window.renderOverview;
    window.renderOverview=function(all){
      if(!all) all=allSubs();
      all=filterKind(all);
      var prev=window.getActiveProducts;
      window.getActiveProducts=catalog;
      try{ return orig(all); }
      finally{
        window.getActiveProducts=prev;
        groupTable();
      }
    };
    window.renderOverview._sheetSafe=true;
  }
  function wrapReport(){
    if(typeof window.runReport!=="function"||window.runReport._sheetSafe) return;
    var orig=window.runReport;
    window.runReport=function(){
      var prev=window.getSubs;
      window.getSubs=function(){ return filterKind(allSubs()); };
      try{ return orig.apply(this,arguments); }
      finally{ window.getSubs=prev; }
    };
    window.runReport._sheetSafe=true;
  }
  function groupTable(){
    var tb=document.getElementById("productTotalsBody"); if(!tb) return;
    var rows=[].slice.call(tb.querySelectorAll("tr"));
    if(!rows.length || tb.querySelector(".sheet-sec")) return;
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
    wrapOverview(); wrapReport();
    var all=allSubs();
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
      el.innerHTML='<span style="font-weight:700;color:#1e3a5f;margin-right:4px">\u0425\u0443\u0432\u0430\u0430\u0445:</span>'
        +btn("bar","\u041f\u0438\u0432\u043e")+btn("wine","\u0412\u0438\u043d\u043e")+btn("all","\u041d\u044d\u0433\u0434\u0441\u044d\u043d");
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
    if(window.getSubs && window.getSubs._sheet && window.getSubs._raw) window.getSubs=window.getSubs._raw;
    wrapOverview(); wrapReport();
    mount("tabOverview"); mount("tabSubmissions"); mount("tabReports");
  }
  boot();
  setInterval(boot,800);
})();
