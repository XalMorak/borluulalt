/* hide supervisor Үнэ tab */
(function(){
  function hide(){
    var btn=document.getElementById("tabBtnPrices")||document.querySelector("#supervisorView .tabs [onclick*=\"prices\"]");
    if(!btn){
      document.querySelectorAll("#supervisorView .tab-btn").forEach(function(b){
        if((b.textContent||"").trim()==="\u04ae\u043d\u044d") btn=b;
      });
    }
    if(btn) btn.style.display="none";
    var pane=document.getElementById("tabPrices");
    if(pane){
      pane.classList.add("hidden");
      pane.style.display="none";
    }
  }
  hide();
  setInterval(hide,800);
})();
