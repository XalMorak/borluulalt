/* live extras + iOS draft */
(function(){
  function add(id,src){
    if(document.getElementById(id)) return;
    var s=document.createElement("script"); s.id=id; s.src=src; document.head.appendChild(s);
  }
  var B="https://cdn.jsdelivr.net/gh/XalMorak/borluulalt@";
  add("wine_js_src", B+"e2ce4c149464449e79e0ad80b87515517a5d1f09/wine.js");
  add("runtime_fix_src", B+"f199642bbb0c3a88f5ba9dc181643d6a6478d86e/runtime_fix.js");
  add("wine_stock_src", B+"4e6667232d8ba65b979d1a959a06bdb7b04042cb/wine_stock.js");
})();
(function(){
  if(window._iosDraft) return; window._iosDraft=true;
  function uid(){ return (window.currentUser&&currentUser.id)|| (typeof localStorage!=="undefined"&&localStorage.getItem("lastLoginId"))||"anon"; }
  function key(){ return "borluulalt_emp_draft_"+uid(); }
  function put(k,v){ try{localStorage.setItem(k,v);}catch(e){} try{sessionStorage.setItem(k,v);}catch(e){} }
  function get(k){ var v=""; try{v=localStorage.getItem(k)||"";}catch(e){} if(!v){try{v=sessionStorage.getItem(k)||"";}catch(e){}} return v; }
  function collect(){
    var items={};
    var body=document.getElementById("salesBody");
    if(body) body.querySelectorAll("input[id^='prev_']").forEach(function(el){
      var pid=el.id.replace("prev_","");
      var n=document.getElementById("next_"+pid), s=document.getElementById("sold_"+pid);
      items[pid]={prev:el.value||"0",next:n?n.value:"0",sold:s?s.value:"0"};
    });
    function v(id){ var e=document.getElementById(id); return e?e.value:""; }
    return {date:v("formDate"),shift:v("shiftType"),location:v("locationName"),checkerName:v("checkerName"),receiverName:v("receiverName"),cashAmount:v("cashAmount")||"0",cardTotal:v("cardTotal")||"0",cashBalance:v("cashBalance")||"0",posNumber:v("posNumber"),items:items,savedAt:Date.now()};
  }
  function persist(){
    try{
      var emp=document.getElementById("employeeView");
      if(!emp||emp.classList.contains("hidden")) return false;
      put(key(), JSON.stringify(collect())); return true;
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
  ensureBtn(); setInterval(ensureBtn,1500);
})();
