/* wine.js — catalog, tek switch, categories, kind filter. Does not touch beer products. */
(function(){
  if(window._wineJs)return; window._wineJs=true;
  var WINE_KEY="borluulalt_wines_v1";
  var SNACKS=[
    ["\u0423\u043d\u0434\u0430\u0430",4000],["pringless",8000],["Schoco rosinen",8000],["Max fun (\u0448\u043e\u043a\u043e\u043b\u0430\u0434)",9000],
    ["Toffifee",10000],["Kowar mix",7000],["\u0441\u0430\u043c\u0430\u0440",4000],["Alpen gold",5500],
    ["\u0410\u0439\u0440\u0430\u0433",6900],["\u0415\u0440\u04e9\u04e9 \u0433\u043e\u0432\u044c \u0437\u0430\u0434\u0433\u0430\u0439",3500],["Ooze",7400],["Vibez",4000]
  ];
  var REDS=[
    ["Sangria",5000],["Australian Passion Merlot New",5500],["Australian Passion Shiraz Cabernet New",5500],["Australian Passion Shiraz",5500],
    ["Montmeyrac Moelleux Red",5500],["Tini Vino Rosso Semi Sweet",5500],["Tini Vino Rosso",5500],["Tini Sangiovese",5500],["Tini Sangiovese Cabernet",5500],
    ["Luigi Leonardo Red",6000],["Campo de Chile Cabernet Sauvignon",7000],["Vina Maipo Cabernet Sauvignon",7000],["Vina Maipo Merlot",7000],
    ["Vina Maipo Carmenere",7000],["Vina Maipo Sweet Red",7000],["Cuvee Kiwi Pinot Noir 2019 Vin de France",7700],["Cuvee Kiwi Shiraz 2015 Vin de France",7700],
    ["Badgers Creek Cabernet-Shiraz",8000],["Louis Eschenauer Merlot",8000],["Calvet Varietals Cabernet Sauvignon Vin de Pays",8300],
    ["Castel Merlot",8500],["Castel Cabernet Sauvignon",8500],["Castel Grenache",8500],["Hans Baer Pinot Noir Red",8900],["Piccini Pinocchio Rosso",9500],
    ["Louis Eschenauer Bordeaux Red",9500],["Calvet Cahors Red",10000],["Azahara Shiraz",11500],["Porto Valdouro Red",11500],
    ["Robert Mondavi Pinot Noir",18400],["Chateau Ferrande Red",33000]
  ];
  var WHITES=[
    ["Australian Passion Colombard Chardonnay",5500],["Montmeyrac Moelleux White",5500],["Tini Rose",5500],["Tini Trebbiano Chardonnay",5500],
    ["Tini Bianco",5500],["Tini Grecanico Pinot Grigio",5500],["Luigi Leonardo White",6000],["Campo de Chile Cabernet Sauvignon",7000],
    ["Vina Maipo Sauvignon Blanc",7000],["Vina Maipo Sweet Moscato",7000],["Cuvee Kiwi Sauvignon 2015 Vin de France",7700],
    ["Badgers Creek Semillon Chardonnay",8000],["Crema Nobile al Cioccolata New",8000],["Calvet Varietals Sauvignon Blanc Vin de Pays",8300],
    ["Castel Merlot Rose",8500],["Castel Chardonnay",8500],["Castel Sauvignon Blanc",8500],["Louis Eschenauer Bordeaux Sauvignon",9500],
    ["Porto Valdouro White",11500],["Robert Mondavi Chardonnay",18400],["Chateau Ferrande White",33000]
  ];
  function nrm(s){return String(s||"").trim().toLowerCase().replace(/\s+/g," ");}
  function getWines(){
    try{
      var raw=localStorage.getItem(WINE_KEY);
      if(raw){ var a=JSON.parse(raw); if(Array.isArray(a)&&a.length) return a; }
    }catch(e){}
    return [];
  }
  function setWines(arr){ try{ localStorage.setItem(WINE_KEY, JSON.stringify(arr||[])); }catch(e){} }
  window.getWines=getWines; window.setWines=setWines;

  function seedMissing(){
    var arr=getWines();
    var have={}; arr.forEach(function(w){ have[nrm(w.name)]=w; });
    var maxId=100; arr.forEach(function(w){ if((w.id||0)>maxId) maxId=w.id; });
    var added=false;
    function add(list,cat){
      list.forEach(function(row){
        var name=row[0], price=row[1];
        if(have[nrm(name)]){
          if(!have[nrm(name)].cat) have[nrm(name)].cat=cat;
          return;
        }
        maxId++;
        var w={id:maxId,name:name,price:price,stock:0,cat:cat};
        arr.push(w); have[nrm(name)]=w; added=true;
      });
    }
    add(SNACKS,"busad"); add(REDS,"ulaan"); add(WHITES,"tsagaan");
    if(added) setWines(arr);
  }

  function extraTek(){
    if(typeof TEK_BY_LOC!=="object") window.TEK_BY_LOC={};
    var o=TEK_BY_LOC["\u041e\u044e\u0443\u0442 \u0431\u0430\u0440"]||[];
    ["\u041e\u044e\u0443\u0442 \u0432\u0438\u043d\u043e","\u0425\u0410\u0411 \u0432\u0438\u043d\u043e"].forEach(function(t){ if(o.indexOf(t)<0) o.push(t); });
    TEK_BY_LOC["\u041e\u044e\u0443\u0442 \u0431\u0430\u0440"]=o;
    var m=TEK_BY_LOC["\u041c\u0430\u043d\u043b\u0430\u0439 \u0431\u0430\u0440"]||[];
    if(m.indexOf("\u041c\u0430\u043d\u043b\u0430\u0439 \u0432\u0438\u043d\u043e")<0) m.push("\u041c\u0430\u043d\u043b\u0430\u0439 \u0432\u0438\u043d\u043e");
    TEK_BY_LOC["\u041c\u0430\u043d\u043b\u0430\u0439 \u0431\u0430\u0440"]=m;
  }

  function isWineTek(v){ return nrm(v).indexOf("\u0432\u0438\u043d\u043e")>=0; }
  window._wineMode=false;
  window.setWineMode=function(on){
    window._wineMode=!!on;
    if(typeof buildSalesTable==="function") buildSalesTable();
    if(typeof updateRecon==="function") updateRecon();
    setTimeout(groupEmp,0);
  };

  if(typeof window.getActiveProducts==="function" && !window.getActiveProducts._w){
    var _gap=window.getActiveProducts;
    window.getActiveProducts=function(){
      if(window._wineMode) return getWines().filter(function(w){ return w && !w.hidden; });
      return (_gap.apply(this,arguments)||[]).filter(function(p){ return p && (p.id||0)<100; });
    };
    window.getActiveProducts._w=true;
  }
  if(typeof window.getFormData==="function" && !window.getFormData._w){
    var _gf=window.getFormData;
    window.getFormData=function(){
      var d=_gf.apply(this,arguments);
      if(d){ d.kind=window._wineMode?"wine":"bar"; if(window._wineMode) d.sheet="wine"; }
      return d;
    };
    window.getFormData._w=true;
  }
  if(typeof window.packAll==="function" && !window.packAll._w){
    var _p=window.packAll;
    window.packAll=function(){ var d=_p.apply(this,arguments)||{}; d.wines=getWines(); return d; };
    window.packAll._w=true;
  }
  if(typeof window.applyAll==="function" && !window.applyAll._w){
    var _a=window.applyAll;
    window.applyAll=function(data){
      var r=_a.apply(this,arguments);
      if(data && Array.isArray(data.wines) && data.wines.length) setWines(data.wines);
      return r;
    };
    window.applyAll._w=true;
  }

  function catOf(w){
    var c=nrm(w&&w.cat), name=nrm(w&&w.name);
    if(c==="busad"||c.indexOf("\u0431\u0443\u0441\u0430\u0434")>=0) return "busad";
    if(c==="tsagaan"||c.indexOf("\u0446\u0430\u0433\u0430\u0430\u043d")>=0) return "tsagaan";
    if(c==="ulaan"||c.indexOf("\u0443\u043b\u0430\u0430\u043d")>=0) return "ulaan";
    for(var i=0;i<SNACKS.length;i++) if(nrm(SNACKS[i][0])===name) return "busad";
    for(i=0;i<WHITES.length;i++) if(nrm(WHITES[i][0])===name) return "tsagaan";
    return "ulaan";
  }
  function hdr(label,cols){
    var tr=document.createElement("tr"); tr.className="wine-sec";
    var td=document.createElement("td"); td.colSpan=cols||7;
    td.style.cssText="background:#1e3a5f;color:#fff;font-weight:700;text-align:left;padding:8px 10px";
    td.textContent=label; tr.appendChild(td); return tr;
  }
  function groupEmp(){
    if(!window._wineMode) return;
    var tb=document.getElementById("salesBody"); if(!tb) return;
    if(tb.querySelectorAll(".wine-sec").length>=3) return;
    var wines=getWines(), byId={};
    wines.forEach(function(w){ byId[String(w.id)]=catOf(w); });
    var rows=[].slice.call(tb.querySelectorAll("tr")).filter(function(tr){ return !tr.classList.contains("wine-sec"); });
    if(!rows.length) return;
    var g={busad:[],ulaan:[],tsagaan:[]};
    rows.forEach(function(tr){
      var inp=tr.querySelector("input[id^='prev_'],input[id^='sold_']");
      var id=""; if(inp){ var m=String(inp.id).match(/_(\d+)$/); if(m) id=m[1]; }
      var c=byId[id]||"ulaan";
      (g[c]||g.ulaan).push(tr);
    });
    tb.innerHTML="";
    tb.appendChild(hdr("\u0411\u0443\u0441\u0430\u0434 \u0431\u0430\u0440\u0430\u0430")); g.busad.forEach(function(r){tb.appendChild(r);});
    tb.appendChild(hdr("\u0423\u043b\u0430\u0430\u043d \u0432\u0438\u043d\u043e")); g.ulaan.forEach(function(r){tb.appendChild(r);});
    tb.appendChild(hdr("\u0426\u0430\u0433\u0430\u0430\u043d \u0432\u0438\u043d\u043e")); g.tsagaan.forEach(function(r){tb.appendChild(r);});
  }

  function hideEmpSwitch(){
    ["empModeTabs","empModeBar","empModeWine","empSheetTitle"].forEach(function(id){
      var el=document.getElementById(id); if(el) el.style.display="none";
    });
  }
  function syncTek(){
    extraTek();
    var sel=document.getElementById("receiverName");
    var want=isWineTek(sel&&sel.value);
    if(!!window._wineMode!==want) window.setWineMode(want);
    hideEmpSwitch();
    groupEmp();
  }

  window._sheetKind=window._sheetKind||"bar";
  function kindOf(s){ return (s&&(s.kind==="wine"||s.sheet==="wine"))?"wine":"bar"; }
  function filtered(all){
    all=all||(typeof getSubs==="function"?getSubs():[]);
    var k=window._sheetKind||"bar";
    return (all||[]).filter(function(s){ return s&&!s.deleted&&(k==="all"||kindOf(s)===k); });
  }
  function ensureKindBar(tabId){
    var tab=document.getElementById(tabId); if(!tab) return;
    var id="kindBar_"+tabId;
    if(document.getElementById(id)) return;
    var el=document.createElement("div"); el.id=id; el.style.cssText="display:flex;gap:8px;margin:0 0 12px;flex-wrap:wrap";
    el.innerHTML='<button type="button" class="tab-btn" data-kind="bar">\u041f\u0438\u0432\u043e</button><button type="button" class="tab-btn" data-kind="wine">\u0412\u0438\u043d\u043e</button><button type="button" class="tab-btn" data-kind="all">\u041d\u044d\u0433\u0434\u0441\u044d\u043d</button>';
    tab.insertBefore(el, tab.firstChild);
    el.onclick=function(ev){
      var b=ev.target.closest("[data-kind]"); if(!b) return;
      window._sheetKind=b.getAttribute("data-kind");
      el.querySelectorAll(".tab-btn").forEach(function(x){ x.classList.toggle("active", x===b); });
      var all=typeof getSubs==="function"?getSubs():[];
      if(typeof renderOverview==="function") renderOverview(filtered(all));
      if(typeof renderSubmissionsListEnhanced==="function") renderSubmissionsListEnhanced(filtered(all));
      else if(typeof renderSubmissionsList==="function") renderSubmissionsList(filtered(all));
      if(typeof runReport==="function") runReport();
    };
  }

  function hidePrices(){
    document.querySelectorAll("#supervisorView .tab-btn").forEach(function(b){
      if(((b.textContent||"").replace(/\s+/g,"")==="\u04ae\u043d\u044d")||b.id==="tabBtnPrices") b.remove();
    });
    var pane=document.getElementById("tabPrices"); if(pane) pane.remove();
  }

  function tick(){
    seedMissing();
    extraTek();
    hideEmpSwitch();
    hidePrices();
    syncTek();
    ensureKindBar("tabOverview");
    ensureKindBar("tabSubmissions");
    ensureKindBar("tabReports");
  }
  tick();
  setInterval(tick,1000);
})();
