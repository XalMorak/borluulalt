/* wine stock by location — does not touch beer products */
(function(){
  if(window._wineStock)return; window._wineStock=true;
  var LOCS=["\u041e\u044e\u0443\u0442 \u0431\u0430\u0440","\u041c\u0430\u043d\u043b\u0430\u0439 \u0431\u0430\u0440","POWER"];
  function ensure(w){
    if(!w.stockByLoc||typeof w.stockByLoc!=="object") w.stockByLoc={};
    LOCS.forEach(function(l){ if(w.stockByLoc[l]==null) w.stockByLoc[l]=0; });
    if((w.stock||0)>0 && LOCS.every(function(l){ return !w.stockByLoc[l]; })){
      w.stockByLoc["\u041e\u044e\u0443\u0442 \u0431\u0430\u0440"]=Number(w.stock)||0;
    }
    w.stock=LOCS.reduce(function(s,l){ return s+(Number(w.stockByLoc[l])||0); },0);
    return w;
  }
  function migrate(){
    if(typeof getWines!=="function"||typeof setWines!=="function") return;
    var arr=getWines(), ch=false;
    arr.forEach(function(w){
      var before=JSON.stringify(w.stockByLoc||null)+":"+(w.stock||0);
      ensure(w);
      var after=JSON.stringify(w.stockByLoc)+":"+(w.stock||0);
      if(before!==after) ch=true;
    });
    if(ch) setWines(arr);
  }
  function loc(){
    var el=document.getElementById("wineStockLoc");
    return (el&&el.value)||"\u041e\u044e\u0443\u0442 \u0431\u0430\u0440";
  }
  function ensureTab(){
    var view=document.getElementById("supervisorView"); if(!view) return;
    var tabs=view.querySelector(".tabs");
    if(tabs && !document.getElementById("tabBtnWine")){
      var b=document.createElement("button");
      b.className="tab-btn"; b.id="tabBtnWine"; b.type="button";
      b.textContent="\u0412\u0438\u043d\u043e";
      b.onclick=function(){ if(typeof showTab==="function") showTab("wine"); var p=document.getElementById("tabWine"); if(p){ p.classList.remove("hidden"); p.style.display=""; } draw(); };
      tabs.appendChild(b);
    }
    if(!document.getElementById("tabWine")){
      var pane=document.createElement("div");
      pane.id="tabWine"; pane.className="hidden";
      pane.innerHTML='<div class="header-info"><div><label>\u0411\u0430\u0439\u0440\u0448\u0438\u043b (\u0432\u0438\u043d\u043e \u043d\u04e9\u04e9\u0446)</label><select id="wineStockLoc"><option>\u041e\u044e\u0443\u0442 \u0431\u0430\u0440</option><option>\u041c\u0430\u043d\u043b\u0430\u0439 \u0431\u0430\u0440</option><option>POWER</option></select></div><button type="button" class="btn btn-success" id="wineSaveStock">\u041d\u04e9\u04e9\u0446 \u0445\u0430\u0434\u0433\u0430\u043b\u0430\u0445</button></div><div id="wineAlert"></div><div class="table-wrap"><table><thead><tr><th>#</th><th>\u0411\u0430\u0440\u0430\u0430</th><th>\u04ae\u043d\u044d</th><th>\u041d\u04e9\u04e9\u0446</th></tr></thead><tbody id="wineBody"></tbody></table></div>';
      view.appendChild(pane);
      pane.querySelector("#wineStockLoc").onchange=draw;
      pane.querySelector("#wineSaveStock").onclick=save;
    }
    if(typeof window.showTab==="function" && !window.showTab._winePane){
      var st=window.showTab;
      window.showTab=function(name){
        var r=st.apply(this,arguments);
        var pane=document.getElementById("tabWine");
        if(pane) pane.classList.toggle("hidden", name!=="wine");
        var btn=document.getElementById("tabBtnWine");
        if(btn) btn.classList.toggle("active", name==="wine");
        if(name==="wine") draw();
        return r;
      };
      window.showTab._winePane=true;
    }
  }
  function catOf(w){
    var c=String(w&&w.cat||"").toLowerCase();
    if(c.indexOf("busad")>=0||c.indexOf("\u0431\u0443\u0441\u0430\u0434")>=0) return "busad";
    if(c.indexOf("tsagaan")>=0||c.indexOf("\u0446\u0430\u0433\u0430\u0430\u043d")>=0) return "tsagaan";
    return "ulaan";
  }
  function draw(){
    if(typeof getWines!=="function") return;
    migrate();
    var tb=document.getElementById("wineBody"); if(!tb) return;
    var L=loc();
    var arr=getWines().filter(function(w){ return w&&!w.hidden; });
    var g={busad:[],ulaan:[],tsagaan:[]};
    arr.forEach(function(w){ (g[catOf(w)]||g.ulaan).push(w); });
    function hdr(t){ return '<tr class="wine-sec"><td colspan="4" style="background:#1e3a5f;color:#fff;font-weight:700;text-align:left;padding:8px">'+t+'</td></tr>'; }
    function rows(list){
      return list.map(function(w){
        ensure(w);
        var st=Number(w.stockByLoc[L])||0;
        return '<tr><td>'+w.id+'</td><td>'+String(w.name||"")+'</td><td>'+(Number(w.price)||0).toLocaleString()+'</td><td><input type="number" id="wst_'+w.id+'" value="'+st+'" style="width:80px"></td></tr>';
      }).join("");
    }
    tb.innerHTML=hdr("\u0411\u0443\u0441\u0430\u0434 \u0431\u0430\u0440\u0430\u0430")+rows(g.busad)+hdr("\u0423\u043b\u0430\u0430\u043d \u0432\u0438\u043d\u043e")+rows(g.ulaan)+hdr("\u0426\u0430\u0433\u0430\u0430\u043d \u0432\u0438\u043d\u043e")+rows(g.tsagaan);
  }
  function save(){
    if(typeof getWines!=="function"||typeof setWines!=="function") return;
    var L=loc();
    var arr=getWines();
    arr.forEach(function(w){
      ensure(w);
      var el=document.getElementById("wst_"+w.id);
      if(el) w.stockByLoc[L]=Number(el.value)||0;
      w.stock=LOCS.reduce(function(s,l){ return s+(Number(w.stockByLoc[l])||0); },0);
    });
    setWines(arr);
    if(typeof cloudPush==="function") cloudPush();
    var a=document.getElementById("wineAlert");
    if(a) a.innerHTML='<div class="alert alert-success">'+L+' \u043d\u04e9\u04e9\u0446 \u0445\u0430\u0434\u0433\u0430\u043b\u0430\u0433\u0434\u043b\u0430\u0430</div>';
    draw();
  }
  window.saveWineStock=save;
  window.drawWineStock=draw;
  ensureTab(); migrate();
  setInterval(ensureTab,1500);
})();
