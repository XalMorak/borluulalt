/* overview_date: filter Тойм by date range */
(function(){
  function todayISO(){
    var t=new Date();
    return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0");
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
  function wrapOverview(){
    if(typeof window.renderOverview!=="function"||window.renderOverview._ovDate)return;
    var orig=window.renderOverview;
    window.renderOverview=function(all){
      var filtered=overviewFiltered(all);
      var r=orig(filtered);
      var box=document.getElementById("overallSummary");
      var fromEl=document.getElementById("ovFrom");
      var toEl=document.getElementById("ovTo");
      var from=fromEl&&fromEl.value;
      var to=toEl&&toEl.value;
      if(box&&(from||to)){
        var label=(from&&to&&from===to)?from:((from||"...")+" – "+(to||"..."));
        var note=document.createElement("div");
        note.style.cssText="font-size:.8rem;color:#666;margin-top:8px;width:100%";
        note.textContent="Шүүлт: "+label+" · "+filtered.length+" илгээлт";
        box.appendChild(note);
      }
      return r;
    };
    window.renderOverview._ovDate=true;
  }
  function tick(){ensureBar();wrapOverview();}
  tick();
  setInterval(tick,500);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",tick);
})();
