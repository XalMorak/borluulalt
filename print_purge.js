/* loader extras: wine.js + hide prices. Does not write Firebase. */
(function(){
  if(!window._wineJs && !document.getElementById("wine_js_src")){
    var s=document.createElement("script");
    s.id="wine_js_src";
    s.src="https://cdn.jsdelivr.net/gh/XalMorak/borluulalt@e2ce4c149464449e79e0ad80b87515517a5d1f09/wine.js";
    document.head.appendChild(s);
  }
  function hide(){
    document.querySelectorAll("#supervisorView .tab-btn").forEach(function(b){
      var t=(b.textContent||"").replace(/\s+/g,"").trim();
      if(t==="\u04ae\u043d\u044d"||b.id==="tabBtnPrices") b.remove();
    });
    var p=document.getElementById("tabPrices"); if(p) p.remove();
    ["empModeTabs","empModeBar","empModeWine","empSheetTitle"].forEach(function(id){
      var el=document.getElementById(id); if(el) el.style.display="none";
    });
  }
  hide();
  setInterval(hide,1200);
})();
