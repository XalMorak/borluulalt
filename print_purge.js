/* tek wine + split categories without wiping inputs */
(function(){
  if(!document.getElementById("print_css_fix")){
    var s=document.createElement("style");
    s.id="print_css_fix";
    s.textContent="#empModeTabs,#empModeBar,#empModeWine,#empSheetTitle{display:none!important}.wine-sec td{background:#1e3a5f!important;color:#fff!important;font-weight:700;text-align:left!important;padding:8px 10px!important}";
    document.head.appendChild(s);
  }
  var SNACK=["ундаа","pringless","schoco","max fun","toffifee","kowar","самар","alpen gold","айраг","ерөө говь","ooze","vibez"];
  var WHITE=["colombard","moelleux white","tini rose","trebbiano","tini bianco","grecanico","leonardo white","sauvignon blanc","sweet moscato","kiwi sauvignon","semillon","crema nobile","castel chardonnay","castel sauvignon","bordeaux sauvignon","valdouro white","mondavi chardonnay","ferrandе white","chardonnay","moscato"];
  function nrm(s){return String(s||"").trim().toLowerCase();}
  function hit(list,name){
    name=nrm(name);
    for(var i=0;i<list.length;i++) if(name.indexOf(list[i])>=0) return true;
    return false;
  }
  function catName(name,cat){
    var c=nrm(cat);
    if(c.indexOf("busad")>=0||c.indexOf("\u0431\u0443\u0441\u0430\u0434")>=0||hit(SNACK,name)) return "busad";
    if(c.indexOf("tsagaan")>=0||c.indexOf("\u0446\u0430\u0433\u0430\u0430\u043d")>=0||hit(WHITE,name)) return "tsagaan";
    return "ulaan";
  }
  function hideChrome(){
    document.querySelectorAll("#supervisorView .tab-btn").forEach(function(b){
      if(((b.textContent||"").replace(/\s+/g,"").trim()==="\u04ae\u043d\u044d")||b.id==="tabBtnPrices") b.remove();
    });
    var p=document.getElementById("tabPrices"); if(p) p.remove();
    ["empModeTabs","empModeBar","empModeWine","empSheetTitle"].forEach(function(id){
      var el=document.getElementById(id); if(el) el.style.display="none";
    });
  }
  function syncTek(){
    var sel=document.getElementById("receiverName");
    var want=nrm(sel&&sel.value).indexOf("\u0432\u0438\u043d\u043e")>=0;
    if(!!window._wineMode===want)return;
    if(typeof setWineMode==="function") setWineMode(want);
    else { window._wineMode=want; if(typeof buildSalesTable==="function") buildSalesTable(); }
  }
  function firstHdr(){
    var h=document.querySelector("#salesBody tr.wine-sec td");
    return h?nrm(h.textContent):"";
  }
  function groupWine(){
    if(!window._wineMode)return;
    var tbody=document.getElementById("salesBody"); if(!tbody)return;
    if(firstHdr().indexOf("\u0431\u0443\u0441\u0430\u0434")>=0 && tbody.querySelectorAll(".wine-sec").length>=3) return;
    var wines=typeof getWines==="function"?getWines():[];
    var byId={}; wines.forEach(function(w){ byId[String(w.id)]=catName(w.name,w.cat); });
    if(typeof setWines==="function"){
      var ch=false;
      wines.forEach(function(w){ var c=catName(w.name,w.cat); if(w.cat!==c){w.cat=c;ch=true;} });
      if(ch) setWines(wines);
    }
    var rows=[].slice.call(tbody.querySelectorAll("tr")).filter(function(tr){return !tr.classList.contains("wine-sec");});
    if(!rows.length)return;
    var g={busad:[],ulaan:[],tsagaan:[]};
    rows.forEach(function(tr){
      var name=(tr.cells[1]&&tr.cells[1].textContent)||"";
      var inp=tr.querySelector("input[id^='prev_'],input[id^='sold_']");
      var id=""; if(inp){var m=String(inp.id).match(/_(\d+)$/); if(m)id=m[1];}
      var c=byId[id]||catName(name,"");
      g[c].push(tr);
    });
    function hdr(txt){
      var tr=document.createElement("tr"); tr.className="wine-sec";
      var td=document.createElement("td"); td.colSpan=7; td.textContent=txt; tr.appendChild(td); return tr;
    }
    tbody.innerHTML="";
    tbody.appendChild(hdr("\u0411\u0443\u0441\u0430\u0434 \u0431\u0430\u0440\u0430\u0430")); g.busad.forEach(function(r){tbody.appendChild(r);});
    tbody.appendChild(hdr("\u0423\u043b\u0430\u0430\u043d \u0432\u0438\u043d\u043e")); g.ulaan.forEach(function(r){tbody.appendChild(r);});
    tbody.appendChild(hdr("\u0426\u0430\u0433\u0430\u0430\u043d \u0432\u0438\u043d\u043e")); g.tsagaan.forEach(function(r){tbody.appendChild(r);});
  }
  hideChrome(); syncTek();
  var tek=document.getElementById("receiverName");
  if(tek&&!tek._tekWine){ tek._tekWine=true; tek.addEventListener("change",syncTek); }
  setInterval(function(){ hideChrome(); syncTek(); groupWine(); },900);
})();
