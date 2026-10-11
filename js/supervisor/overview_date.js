/* overview_date: date filter + cash/card totals on Тойм */
(function(){
  if(window._ovDateLoaded)return;
  window._ovDateLoaded=true;

  function todayISO(){
    var t=new Date();
    return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0");
  }
  function money(n){
    return Math.round(Number(n)||0).toLocaleString()+"₮";
  }
  function overviewFiltered(all){
    var list=(all||[]).filter(function(s){return s&&!s.deleted;});
    var fromEl=document.getElementById("ovFrom");
    var toEl=document.getElementById("ovTo");
    var from=fromEl?fromEl.value:"";
    var to=toEl?toEl.value:"";
    if(from) list=list.filter(function(s){return (s.date||"")>=from;});
    if(to) list=list.filter(function(s){return (s.date||"")<=to;});
    return list;
  }
  function item(label, value){
    return '<div class="summary-item"><div class="label">'+label+'</div><div class="value">'+value+'</div></div>';
  }
  function renderMoney(list){
    var cash=0, card=0;
    (list||[]).forEach(function(s){
      var raw=Number(s.cashAmount)||0;
      var start=Number(s.cashBalance)||0;
      cash += Math.max(0, raw-start);
      card += Number(s.cardTotal)||0;
    });
    var box=document.getElementById("ovMoneyBox");
    if(!box){
      var host=document.getElementById("overallSummary");
      box=document.createElement("div");
      box.id="ovMoneyBox";
      box.className="summary-box";
      box.style.marginTop="8px";
      if(host&&host.parentNode) host.parentNode.insertBefore(box, host.nextSibling);
    }
    box.innerHTML=
      item("Бэлэн мөнгө нийт", money(cash))+
      item("Карт нийт", money(card))+
      item("Бэлэн + карт", money(cash+card));
  }
  function setNote(text){
    var n=document.getElementById("ovFilterNote");
    if(!n){
      var box=document.getElementById("ovMoneyBox")||document.getElementById("overallSummary");
      n=document.createElement("div");
      n.id="ovFilterNote";
      n.style.cssText="font-size:.8rem;color:#666;margin:6px 0 8px;width:100%";
      if(box&&box.parentNode) box.parentNode.insertBefore(n, box.nextSibling);
    }
    n.textContent=text||"";
    n.style.display=text?"block":"none";
  }
  function applyOverviewFilter(){
    if(typeof renderOverview==="function") renderOverview(typeof getSubs==="function"?getSubs():[]);
  }
  window.applyOverviewFilter=applyOverviewFilter;
  window.setOverviewToday=function(){
    var iso=todayISO();
    var f=document.getElementById("ovFrom");
    var t=document.getElementById("ovTo");
    if(f)f.value=iso;
    if(t)t.value=iso;
    applyOverviewFilter();
  };
  window.clearOverviewFilter=function(){
    var f=document.getElementById("ovFrom");
    var t=document.getElementById("ovTo");
    if(f)f.value="";
    if(t)t.value="";
    applyOverviewFilter();
  };
  function ensureBar(){
    var tab=document.getElementById("tabOverview");
    if(!tab||document.getElementById("ovFilterBar"))return;
    var bar=document.createElement("div");
    bar.id="ovFilterBar";
    bar.className="header-info no-print";
    bar.style.marginBottom="10px";
    bar.innerHTML=
      '<div><label>Эхлэх огноо</label><input type="date" id="ovFrom" onchange="applyOverviewFilter()"></div>'+
      '<div><label>Дуусах огноо</label><input type="date" id="ovTo" onchange="applyOverviewFilter()"></div>'+
      '<div style="display:flex;align-items:flex-end;gap:6px;flex-wrap:wrap">'+
      '<button class="btn btn-sm" type="button" onclick="setOverviewToday()">Өнөөдөр</button>'+
      '<button class="btn btn-outline btn-sm" type="button" onclick="clearOverviewFilter()">Бүгд</button>'+
      '</div>';
    tab.insertBefore(bar, tab.firstChild);
  }
  var wrappedFn=null;
  function wrapOverview(){
    if(typeof window.renderOverview!=="function")return;
    if(window.renderOverview===wrappedFn)return;
    if(window.renderOverview._ovDate){wrappedFn=window.renderOverview;return;}
    var orig=window.renderOverview;
    function wrapped(all){
      var filtered=overviewFiltered(all);
      var r=orig(filtered);
      renderMoney(filtered);
      var fromEl=document.getElementById("ovFrom");
      var toEl=document.getElementById("ovTo");
      var from=fromEl&&fromEl.value;
      var to=toEl&&toEl.value;
      if(from||to){
        var label=(from&&to&&from===to)?from:((from||"...")+" – "+(to||"..."));
        setNote("Шүүлт: "+label+" · "+filtered.length+" илгээлт");
      } else setNote("");
      return r;
    }
    wrapped._ovDate=true;
    window.renderOverview=wrapped;
    wrappedFn=wrapped;
  }
  function tick(){ensureBar();wrapOverview();}
  tick();
  setInterval(tick,800);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",tick);
})();
