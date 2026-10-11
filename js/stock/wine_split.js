/* Force Бусад бараа vs Улаан/Цагаан on employee + supervisor */
(function(){
  if(window._wineSplit) return; window._wineSplit=true;
  var SNACK=[
    "ундаа","pringless","pringles","schoco","rosinen","max fun","toffifee","toffee",
    "kowar","самар","samar","alpen gold","айраг","airag","ерөө говь задгай",
    "еpee говь","ooze","vibez"
  ];
  var WHITE=[
    "colombard","moelleux white","tini rose","trebbiano","tini bianco","grecanico",
    "leonardo white","sauvignon blanc","sweet moscato","kiwi sauvignon","semillon",
    "crema nobile","castel chardonnay","castel sauvignon","bordeaux sauvignon",
    "valdouro white","mondavi chardonnay","ferrandе white","ferrandе white",
    "chardonnay","moscato","pinot grigio","rose"
  ];
  function nrm(s){ return String(s||"").trim().toLowerCase(); }
  function hit(list,name){
    name=nrm(name);
    for(var i=0;i<list.length;i++) if(name.indexOf(list[i])>=0) return true;
    return false;
  }
  function catOf(w){
    var name=(w&&w.name)||"";
    var c=nrm(w&&w.cat);
    if(hit(SNACK,name) || c.indexOf("busad")>=0 || c.indexOf("\u0431\u0443\u0441\u0430\u0434")>=0) return "busad";
    if(hit(WHITE,name) || c.indexOf("tsagaan")>=0 || c.indexOf("\u0446\u0430\u0433\u0430\u0430\u043d")>=0) return "tsagaan";
    return "ulaan";
  }
  function retag(){
    if(typeof getWines!=="function"||typeof setWines!=="function") return;
    var arr=getWines(), ch=false;
    arr.forEach(function(w){
      var c=catOf(w);
      if(w.cat!==c){ w.cat=c; ch=true; }
    });
    if(ch) setWines(arr);
  }
  function hdr(txt,cols){
    var tr=document.createElement("tr"); tr.className="wine-sec";
    var td=document.createElement("td"); td.colSpan=cols||7;
    td.style.cssText="background:#1e3a5f;color:#fff;font-weight:700;text-align:left;padding:8px 10px";
    td.textContent=txt; tr.appendChild(td); return tr;
  }
  function firstLabel(tb){
    var h=tb && tb.querySelector("tr.wine-sec td");
    return h?nrm(h.textContent):"";
  }
  function regroup(tb, cols){
    if(!tb) return;
    if(firstLabel(tb).indexOf("\u0431\u0443\u0441\u0430\u0434")>=0 && tb.querySelectorAll(".wine-sec").length>=3) return;
    var wines=(typeof getWines==="function"?getWines():[])||[];
    var byId={}; wines.forEach(function(w){ byId[String(w.id)]=catOf(w); });
    var rows=[].slice.call(tb.querySelectorAll("tr")).filter(function(tr){ return !tr.classList.contains("wine-sec"); });
    if(!rows.length) return;
    var g={busad:[],ulaan:[],tsagaan:[]};
    rows.forEach(function(tr){
      var name=(tr.cells[1]&&tr.cells[1].textContent)||"";
      var inp=tr.querySelector("input[id^='prev_'],input[id^='sold_'],input[id^='wst_']");
      var id=""; if(inp){ var m=String(inp.id).match(/_(\d+)$/); if(m) id=m[1]; }
      var c=byId[id]||catOf({name:name});
      (g[c]||g.ulaan).push(tr);
    });
    tb.innerHTML="";
    tb.appendChild(hdr("\u0411\u0443\u0441\u0430\u0434 \u0431\u0430\u0440\u0430\u0430",cols)); g.busad.forEach(function(r){tb.appendChild(r);});
    tb.appendChild(hdr("\u0423\u043b\u0430\u0430\u043d \u0432\u0438\u043d\u043e",cols)); g.ulaan.forEach(function(r){tb.appendChild(r);});
    tb.appendChild(hdr("\u0426\u0430\u0433\u0430\u0430\u043d \u0432\u0438\u043d\u043e",cols)); g.tsagaan.forEach(function(r){tb.appendChild(r);});
  }
  function tick(){
    retag();
    if(window._wineMode) regroup(document.getElementById("salesBody"),7);
    regroup(document.getElementById("wineBody"),4);
  }
  tick();
  setInterval(tick,900);
})();
