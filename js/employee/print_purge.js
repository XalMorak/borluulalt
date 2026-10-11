/* iOS draft.
   (The old "live extras" loader that injected pinned jsDelivr copies of wine.js, safe_sync.js,
   wine_stock.js, wine_split.js and wine_form.js was removed: index.html already loads the current
   files, and whichever copy ran first won — the stale CDN wine_stock.js has no VIP location,
   the stale wine.js the old Айраг price.) */
(function(){
  if(window._iosDraft) return; window._iosDraft=true;
  function uid(){ return (window.currentUser&&currentUser.id)|| (typeof localStorage!=="undefined"&&localStorage.getItem("lastLoginId"))||"anon"; }
  function key(){ return "borluulalt_emp_draft_"+uid(); }
  function put(k,v){ try{localStorage.setItem(k,v);}catch(e){} try{sessionStorage.setItem(k,v);}catch(e){} }
  function persist(){
    try{
      var emp=document.getElementById("employeeView");
      if(!emp||emp.classList.contains("hidden")) return false;
      var items={};
      var body=document.getElementById("salesBody");
      if(body) body.querySelectorAll("input[id^='prev_'],input[id^='sold_']").forEach(function(el){
        var m=String(el.id).match(/^(prev|sold)_(\d+)$/); if(!m) return;
        var pid=m[2];
        if(items[pid]) return;
        var p=document.getElementById("prev_"+pid), n=document.getElementById("next_"+pid), s=document.getElementById("sold_"+pid);
        items[pid]={prev:p?p.value:"0",next:n?n.value:"0",sold:s?s.value:"0"};
      });
      function v(id){ var e=document.getElementById(id); return e?e.value:""; }
      put(key(), JSON.stringify({date:v("formDate"),shift:v("shiftType"),location:v("locationName"),checkerName:v("checkerName"),receiverName:v("receiverName"),cashAmount:v("cashAmount")||"0",cardTotal:v("cardTotal")||"0",cashBalance:v("cashBalance")||"0",posNumber:v("posNumber"),items:items,savedAt:Date.now()}));
      return true;
    }catch(e){ return false; }
  }
  window.saveTempDraft=function(){
    var ok=persist();
    var box=document.getElementById("empAlert");
    if(box) box.innerHTML=ok?'<div class="alert alert-success">\u0422\u04af\u0440 \u0445\u0430\u0434\u0433\u0430\u043b\u043b\u0430\u0430</div>':'<div class="alert alert-error">Safari \u0445\u0443\u0432\u0438\u0439 \u0446\u043e\u043d\u0445</div>';
  };
  function ensureBtn(){
    var bar=document.querySelector("#employeeView .no-print"); if(!bar) return;
    var btn=document.getElementById("btnTempSave");
    if(!btn){ btn=document.createElement("button"); btn.type="button"; btn.id="btnTempSave"; btn.className="btn btn-outline"; btn.textContent="\u0422\u04af\u0440 \u0445\u0430\u0434\u0433\u0430\u043b\u0430\u0445"; bar.appendChild(btn); }
    btn.type="button"; btn.onclick=function(ev){ ev.preventDefault(); saveTempDraft(); };
  }
  document.addEventListener("visibilitychange",function(){ if(document.hidden) persist(); });
  window.addEventListener("pagehide",persist);
  ensureBtn(); App.keep(ensureBtn);
})();
