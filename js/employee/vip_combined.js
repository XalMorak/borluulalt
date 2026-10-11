/* vip_combined.js — Байршил VIP: whatever тек номер, beer + wine are listed together in ONE section of
   ONE form (one cash/card, one илүү/дутуу).
   Sets window._vipMode; getActiveProducts (wine.js / wine_page.js) then returns beer + wines,
   getFormData/submit.js store kind/sheet "vip". Beer rows: prev/next → sold; wine rows: sold only
   (wine_form.js). Shared-stock items (stock_link.js) appear once, as the beer product. */
(function(){
  if(window._vipCombined) return; window._vipCombined=true;
  window._vipMode=false;
  function want(){
    var loc=document.getElementById("locationName"), tek=document.getElementById("receiverName");
    return !!(loc && loc.value==="VIP");
  }
  function sec(label){
    var tr=document.createElement("tr"); tr.className="wine-sec vip-sec";
    var td=document.createElement("td"); td.colSpan=8; td.textContent=label; tr.appendChild(td); return tr;
  }
  function headers(){
    if(!window._vipMode) return;
    var tb=document.getElementById("salesBody"); if(!tb || tb.querySelector(".vip-sec")) return;
    var rows=[].slice.call(tb.querySelectorAll("tr")).filter(function(tr){ return !tr.classList.contains("wine-sec"); });
    if(!rows.length) return;
    tb.insertBefore(sec("VIP — пиво ба вино"), rows[0]);   /* one section, beer then wine */
  }
  function apply(){
    var on=want();
    if(on===window._vipMode){ headers(); return; }
    window._vipMode=on;
    if(on) window._wineMode=false;
    if(typeof buildSalesTable==="function") buildSalesTable();
    if(typeof updateRecon==="function") updateRecon();
    headers();
    var t=document.getElementById("empSheetHint");
    if(!t){ var tb=document.getElementById("salesBody"), tbl=tb && tb.closest("table"); if(tbl){ t=document.createElement("p"); t.id="empSheetHint"; t.className="vip-hint"; tbl.parentNode.insertBefore(t, tbl); } }
    if(t){ t.textContent=on?"VIP: пиво ба вино нэг хэсэгт, нэг илгээлт, нэг тооцоо.":""; t.style.display=on?"":"none"; }
  }
  document.addEventListener("change", function(ev){ var id=ev.target && ev.target.id; if(id==="locationName"||id==="receiverName") setTimeout(apply,0); });
  apply();
  App.keep(apply);
})();
