/* wine loader + iOS draft + mobile polish. Does not write Firebase. */
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
  hide(); setInterval(hide,1500);
})();

(function(){
  if(document.getElementById("ios_mobile_css")) return;
  var css=document.createElement("style");
  css.id="ios_mobile_css";
  css.textContent=[
    "html{-webkit-text-size-adjust:100%;}",
    "body{padding-bottom:calc(28px + env(safe-area-inset-bottom));}",
    "input,select,textarea,button{font-size:16px!important;-webkit-appearance:none;border-radius:10px;}",
    "button,.btn{min-height:44px;padding:10px 14px;}",
    ".table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}",
    "#employeeView input[type=number]{width:64px;min-height:40px;}",
    "#empActionBar{position:sticky;bottom:0;z-index:20;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;",
    "padding:10px 8px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);border-top:1px solid #e5e7eb;}",
    "body.dark #empActionBar{background:rgba(30,30,42,.96);border-top-color:#333;}",
    "@media(max-width:700px){",
    "body{padding:8px 8px 0;}",
    ".card{padding:14px;border-radius:16px;}",
    ".header-info{grid-template-columns:1fr 1fr;gap:8px;}",
    ".header-info label{font-size:12px;}",
    ".user-bar{gap:6px;}",
    ".user-bar .btn{flex:1 1 auto;}",
    "#employeeView table{min-width:540px;font-size:13px;}",
    ".footer-fields{grid-template-columns:1fr;}",
    ".tabs{gap:6px;}",
    ".tab-btn{min-height:40px;}",
    "}"
  ].join("");
  document.head.appendChild(css);
})();

(function(){
  if(window._iosDraft) return; window._iosDraft=true;
  function uid(){ return (window.currentUser&&currentUser.id)||localStorage.getItem("lastLoginId")||"anon"; }
  function key(){ return "borluulalt_emp_draft_"+uid(); }
  function storeSet(k,val){
    try{ localStorage.setItem(k,val); }catch(e){}
    try{ sessionStorage.setItem(k,val); }catch(e){}
  }
  function storeGet(k){
    var v="";
    try{ v=localStorage.getItem(k)||""; }catch(e){}
    if(!v){ try{ v=sessionStorage.getItem(k)||""; }catch(e){} }
    return v;
  }
  function collect(){
    var items={};
    var body=document.getElementById("salesBody");
    if(body){
      body.querySelectorAll("input[id^='prev_']").forEach(function(el){
        var pid=el.id.replace("prev_","");
        var n=document.getElementById("next_"+pid);
        var s=document.getElementById("sold_"+pid);
        items[pid]={prev:el.value||"0",next:n?n.value:"0",sold:s?s.value:"0"};
      });
    }
    function v(id){ var e=document.getElementById(id); return e?e.value:""; }
    return {
      date:v("formDate"),shift:v("shiftType"),location:v("locationName"),
      checkerName:v("checkerName"),receiverName:v("receiverName"),
      cashAmount:v("cashAmount")||"0",cardTotal:v("cardTotal")||"0",
      cashBalance:v("cashBalance")||"0",posNumber:v("posNumber"),
      wineMode:!!window._wineMode, items:items, savedAt:Date.now()
    };
  }
  function restore(d, force){
    if(!d) return;
    function set(id,val){
      var e=document.getElementById(id);
      if(!e||val==null) return;
      if(force || !e.value || e.value==="0" || e.value==="") e.value=val;
    }
    set("formDate",d.date); set("shiftType",d.shift);
    if(d.location){
      set("locationName",d.location);
      if(typeof onLocationChange==="function") onLocationChange();
    }
    set("checkerName",d.checkerName);
    if(d.receiverName){
      var r=document.getElementById("receiverName");
      if(r){
        var ok=false;
        for(var i=0;i<r.options.length;i++) if(r.options[i].value===d.receiverName) ok=true;
        if(!ok){ var o=document.createElement("option"); o.value=d.receiverName; o.textContent=d.receiverName; r.appendChild(o); }
        r.value=d.receiverName;
        r.dispatchEvent(new Event("change"));
      }
    }
    set("posNumber",d.posNumber);
    ["cashAmount","cardTotal","cashBalance"].forEach(function(id){ set(id,d[id]); });
    Object.keys(d.items||{}).forEach(function(pid){
      var it=d.items[pid];
      ["prev","next","sold"].forEach(function(k){
        var e=document.getElementById(k+"_"+pid);
        if(e && it[k]!=null && (force || !e.value || e.value==="0")) e.value=it[k];
      });
      if(typeof calcRow==="function") calcRow(Number(pid));
    });
    if(typeof updateRecon==="function") updateRecon();
  }
  function persist(){
    try{
      var emp=document.getElementById("employeeView");
      if(!emp || emp.classList.contains("hidden")) return false;
      var d=collect();
      storeSet(key(), JSON.stringify(d));
      return true;
    }catch(e){ return false; }
  }
  function loadDraft(){
    try{
      var raw=storeGet(key());
      if(!raw) return;
      restore(JSON.parse(raw), false);
    }catch(e){}
  }
  window.saveTempDraft=function(){
    var ok=persist();
    var box=document.getElementById("empAlert");
    if(box) box.innerHTML=ok
      ? '<div class="alert alert-success">\u0422\u04af\u0440 \u0445\u0430\u0434\u0433\u0430\u043b\u043b\u0430\u0430</div>'
      : '<div class="alert alert-error">\u0425\u0430\u0434\u0433\u0430\u043b\u0436 \u0447\u0430\u0434\u0441\u0430\u043d\u0433\u04af\u0439 (Safari \u0445\u0443\u0432\u0438\u0439 \u0446\u043e\u043d\u0445)</div>';
    window._formDirty=true;
  };
  function ensureBtn(){
    var bar=document.querySelector("#employeeView .no-print");
    if(!bar) return;
    bar.id=bar.id||"empActionBar";
    var btn=document.getElementById("btnTempSave");
    if(!btn){
      btn=document.createElement("button");
      btn.type="button";
      btn.id="btnTempSave";
      btn.className="btn btn-outline";
      btn.textContent="\u0422\u04af\u0440 \u0445\u0430\u0434\u0433\u0430\u043b\u0430\u0445";
      bar.appendChild(btn);
    }
    btn.type="button";
    btn.onclick=function(ev){ ev.preventDefault(); window.saveTempDraft(); };
  }
  var t=null;
  function bump(){ clearTimeout(t); t=setTimeout(persist,400); }
  document.addEventListener("input",function(ev){
    if(ev.target && ev.target.closest && ev.target.closest("#employeeView")) bump();
  },true);
  document.addEventListener("change",function(ev){
    if(ev.target && ev.target.closest && ev.target.closest("#employeeView")) persist();
  },true);
  document.addEventListener("visibilitychange",function(){ if(document.hidden) persist(); });
  window.addEventListener("pagehide",persist);
  window.addEventListener("beforeunload",persist);
  ensureBtn();
  setTimeout(loadDraft,800);
  setTimeout(loadDraft,1800);
  setInterval(function(){ ensureBtn(); hidePricesSafe(); },1200);
  function hidePricesSafe(){}
})();
