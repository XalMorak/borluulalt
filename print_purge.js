/* print CSS + hide prices + chart + tek-driven wine sheet */
(function(){
  if(!document.getElementById("print_css_fix")){
    var s=document.createElement("style");
    s.id="print_css_fix";
    s.textContent="@media print{body{background:#fff!important;color:#000!important;padding:0!important}.no-print,.tabs,.user-bar,.period-btns,.sync-badge,#loginSection,button,.btn,.tab-btn{display:none!important}.card{box-shadow:none!important;border:none!important;padding:0!important}table{font-size:11px}}#chartBars{min-height:200px;overflow-x:auto}#empModeTabs,#empSheetTitle{display:none!important}";
    document.head.appendChild(s);
  }
})();
(function(){
  function hidePricesTab(){
    document.querySelectorAll("#supervisorView .tab-btn, .tabs .tab-btn").forEach(function(b){
      var t=(b.textContent||"").replace(/\s+/g,"").trim();
      if(t==="\u04ae\u043d\u044d" || b.id==="tabBtnPrices" || (b.getAttribute("onclick")||"").indexOf("prices")>=0) b.remove();
    });
    var pane=document.getElementById("tabPrices");
    if(pane) pane.remove();
  }
  function hideEmpSwitch(){
    ["empModeTabs","empModeBar","empModeWine","empSheetTitle"].forEach(function(id){
      var el=document.getElementById(id);
      if(el) el.style.display="none";
    });
  }
  function isWineTek(v){
    return String(v||"").toLowerCase().indexOf("\u0432\u0438\u043d\u043e")>=0;
  }
  function syncWineFromTek(){
    var sel=document.getElementById("receiverName");
    var want=isWineTek(sel&&sel.value);
    if(!!window._wineMode===want)return;
    if(typeof setWineMode==="function") setWineMode(want);
    else {
      window._wineMode=want;
      if(typeof buildSalesTable==="function") buildSalesTable();
    }
  }
  hidePricesTab(); hideEmpSwitch(); syncWineFromTek();
  var tek=document.getElementById("receiverName");
  if(tek && !tek._tekWine){
    tek._tekWine=true;
    tek.addEventListener("change",syncWineFromTek);
  }
  setInterval(function(){
    hidePricesTab();
    hideEmpSwitch();
    syncWineFromTek();
  },700);
})();
