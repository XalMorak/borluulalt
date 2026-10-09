/* supervisor_day.js — Ахлах: only today's submissions + per-employee илүү/дутуу for today.
   Data filter itself lives in accountant.js (_supTodayFilter); this file locks the date inputs
   to today (Тойм, Илгээлт, Тайлан), hides the multi-day period buttons and chart on Тайлан, and
   draws the илүү/дутуу panel on Тойм and Илгээлт tabs. */
(function(){
  if(window._supDay) return;
  window._supDay=true;

  function U(){ return window._acctUtil||{}; }
  function today(){
    if(U().today) return U().today();
    var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  }
  function role(){ var u=(U().me?U().me():window.currentUser)||{}; return u.role||""; }
  function isSup(){ return role()==="supervisor"; }
  function num(v){ var n=Number(v); return isFinite(n)?n:0; }
  function esc(v){ return U().esc?U().esc(v):String(v==null?"":v); }
  function signed(n){ return U().signed?U().signed(n):String(Math.round(num(n))); }
  function money(n){ return U().money?U().money(n):String(Math.round(num(n))); }
  function diffCls(d){ return Math.abs(d)<0.01?"diff-ok":(d>0?"diff-over":"diff-short"); }

  function lockInput(id, t){
    var el=document.getElementById(id);
    if(!el) return false;
    var changed=el.value!==t;
    if(changed) el.value=t;
    el.disabled=true;
    el.title="Ахлах зөвхөн өнөөдрийн илгээлт харна";
    return changed;
  }
  function unlockInput(id){
    var el=document.getElementById(id);
    if(el && el.disabled && el.title.indexOf("Ахлах")===0){ el.disabled=false; el.title=""; }
  }
  function note(tabId, t){
    var tab=document.getElementById(tabId);
    if(!tab) return;
    var id="supDayNote_"+tabId, n=document.getElementById(id);
    if(!n){
      n=document.createElement("div");
      n.id=id;
      n.className="no-print";
      n.style.cssText="margin:0 0 10px;padding:8px 12px;border-radius:10px;background:#fff7e6;border:1px solid #f5c26b;font-size:.85rem;color:#7a4b00";
      tab.insertBefore(n, tab.firstChild);
    }
    n.textContent="Зөвхөн өнөөдрийн илгээлт: "+t;
  }
  function hideAllBtn(){
    document.querySelectorAll("#ovFilterBar button").forEach(function(b){
      if((b.getAttribute("onclick")||"").indexOf("clearOverviewFilter")>=0) b.style.display=isSup()?"none":"";
    });
  }

  function kind(){ return window._sheetKind||"all"; }
  function todayRows(){
    var t=today(), k=kind();
    var kindOf=U().kindOf||function(s){ return (s&&(s.kind==="wine"||s.sheet==="wine"))?"wine":"bar"; };
    var all=(typeof getSubs==="function"?getSubs():[])||[];
    return all.filter(function(s){ return s && !s.deleted && (s.date||"")===t && (k==="all"||kindOf(s)===k); });
  }
  function compute(){
    var users=(typeof getUsers==="function"?getUsers():{})||{};
    var calcOf=U().calcOf||function(s){ return num(s.calcTotal); };
    var colOf=U().collectedOf||function(s){ return num(s.collected); };
    var diffOf=U().diffOf||function(s){ return num(s.diff); };
    var emp={};
    todayRows().forEach(function(s){
      var id=s.employeeId||"?";
      var known=users[id]||{};
      var e=emp[id]||(emp[id]={id:id, name:s.employeeName||known.name||id, n:0, calc:0, col:0, over:0, short:0});
      var d=diffOf(s);
      e.n++; e.calc+=calcOf(s); e.col+=colOf(s);
      if(d<0) e.short+=d; else e.over+=d;
    });
    return Object.keys(emp).map(function(k){ return emp[k]; }).sort(function(a,b){
      if(!!a.n!==!!b.n) return a.n?-1:1;
      return (a.over+a.short)-(b.over+b.short) || String(a.name).localeCompare(String(b.name));
    });
  }
  function panelHtml(rows, t){
    var tot={n:0,calc:0,col:0,over:0,short:0};
    var sent=rows.filter(function(e){ return e.n; });
    var body=sent.map(function(e){
      tot.n+=e.n; tot.calc+=e.calc; tot.col+=e.col; tot.over+=e.over; tot.short+=e.short;
      var net=e.over+e.short;
      return '<tr><td style="text-align:left">'+esc(e.name)+' <small style="color:#888">('+esc(e.id)+')</small></td><td>'+e.n+'</td><td>'+money(e.calc)+'</td><td>'+money(e.col)+'</td>'
        +'<td class="diff-over">'+signed(e.over)+'</td><td class="diff-short">'+signed(e.short)+'</td><td class="'+diffCls(net)+'"><strong>'+signed(net)+'</strong></td></tr>';
    }).join("");
    var kl={all:"Нэгдсэн",bar:"Пиво",wine:"Вино"}[kind()]||"";
    return '<h4 style="margin:4px 0 6px">Өнөөдрийн илүү / дутуу — '+esc(t)+(kl?' · '+kl:'')+' <small style="font-weight:400;color:#666">· '+sent.length+' ажилтан илгээсэн</small></h4>'
      +'<div class="table-wrap"><table style="margin:4px 0 14px"><thead><tr><th>Ажилтан</th><th>Илгээлт</th><th>Бодолт</th><th>Цуглуулсан</th><th>Илүү</th><th>Дутуу</th><th>Цэвэр</th></tr></thead><tbody>'
      +(body||'<tr><td colspan="7">Өнөөдөр илгээлт алга</td></tr>')
      +'<tr style="font-weight:700;background:#e8f0fe"><td>НИЙТ</td><td>'+tot.n+'</td><td>'+money(tot.calc)+'</td><td>'+money(tot.col)+'</td><td class="diff-over">'+signed(tot.over)+'</td><td class="diff-short">'+signed(tot.short)+'</td><td class="'+diffCls(tot.over+tot.short)+'">'+signed(tot.over+tot.short)+'</td></tr>'
      +'</tbody></table></div>';
  }

  function soldHtml(t){
    var kindOf=U().kindOf||function(s){ return "bar"; };
    var map={};
    todayRows().forEach(function(s){
      var kind=kindOf(s)==="wine"?"Вино":"Пиво";
      (s.items||[]).forEach(function(it){
        if(!it) return;
        var qty=num(it.sold);
        var inc=num(it.income)||qty*num(it.price);
        if(!qty && !inc) return;
        var name=String(it.name||it.id||"Бараа");
        var k=kind+"|"+name;
        if(!map[k]) map[k]={name:name, kind:kind, qty:0, income:0};
        map[k].qty+=qty; map[k].income+=inc;
      });
    });
    var arr=Object.keys(map).map(function(k){ return map[k]; }).sort(function(a,b){ return b.income-a.income || b.qty-a.qty; });
    var qty=arr.reduce(function(a,it){ return a+it.qty; },0);
    var inc=arr.reduce(function(a,it){ return a+it.income; },0);
    var body=arr.map(function(it){
      return '<tr><td style="text-align:left">'+esc(it.name)+'</td><td>'+esc(it.kind)+'</td><td>'+it.qty.toLocaleString()+'</td><td>'+money(it.income)+'</td></tr>';
    }).join("")||'<tr><td colspan="4">Өнөөдөр зарсан бараа алга</td></tr>';
    return '<h4 style="margin:8px 0 6px">Өнөөдөр зарагдсан — '+esc(t)+'</h4>'
      +'<div class="table-wrap"><table style="margin:4px 0 14px"><thead><tr><th>Бараа</th><th>Төрөл</th><th>Тоо</th><th>Нийт дүн</th></tr></thead><tbody>'
      +body
      +'<tr style="font-weight:700;background:#e8f0fe"><td colspan="2">НИЙТ</td><td>'+qty.toLocaleString()+'</td><td>'+money(inc)+'</td></tr>'
      +'</tbody></table></div>';
  }
  function mountPanel(tabId, beforeId){
    var tab=document.getElementById(tabId);
    if(!tab) return null;
    var id="supDiff_"+tabId, el=document.getElementById(id);
    if(!el){
      el=document.createElement("div");
      el.id=id;
      el.className="sup-diff-panel";
      var before=beforeId&&document.getElementById(beforeId);
      if(before && before.parentNode===tab) tab.insertBefore(el, before);
      else tab.appendChild(el);
    }
    return el;
  }

  /* Тайлан: guard.js re-installs its own runReport every 700ms and reads reportFrom/reportTo from
     the DOM, so the lock is done on those inputs. Multi-day buttons and the chart are hidden. */
  var REPORT_KEEP=/runReport|exportCSV|printReport/;
  function lockReport(t){
    var ch=lockInput("reportFrom", t)|lockInput("reportTo", t);
    var sup=isSup();
    document.querySelectorAll("#tabReports .period-btns button").forEach(function(b){
      var keep=REPORT_KEEP.test(b.getAttribute("onclick")||"");
      if(!keep) b.style.display=sup?"none":"";
    });
    var chart=document.getElementById("chartArea");
    if(chart) chart.style.display=sup?"none":"";
    return ch;
  }
  function unlockReport(){
    unlockInput("reportFrom"); unlockInput("reportTo");
    document.querySelectorAll("#tabReports .period-btns button").forEach(function(b){ b.style.display=""; });
    var chart=document.getElementById("chartArea"); if(chart) chart.style.display="";
  }
  function wrapReportDays(){
    var f=window.setReportDays;
    if(typeof f!=="function" || f._supDay) return;
    var w=function(n){
      if(isSup()){ lockReport(today()); if(typeof runReport==="function") runReport(); return; }
      return f.apply(this, arguments);
    };
    w._supDay=true;
    window.setReportDays=w;
  }

  var lastSig="", lastDay=today();
  function tick(){
    var t=today();
    if(!isSup()){
      ["subFilterFrom","subFilterTo","ovFrom","ovTo"].forEach(unlockInput);
      unlockReport();
      hideAllBtn();
      return;
    }
    var subCh=lockInput("subFilterFrom", t)|lockInput("subFilterTo", t);
    var ovCh=lockInput("ovFrom", t)|lockInput("ovTo", t);
    try{ if(ovCh && typeof applyOverviewFilter==="function") applyOverviewFilter(); }catch(e){}
    try{ if(subCh && typeof applySubFilter==="function") applySubFilter(); }catch(e){}
    var repCh=lockReport(t);
    try{ if(repCh && typeof runReport==="function") runReport(); }catch(e){}
    note("tabReports", t);
    hideAllBtn();
    note("tabSubmissions", t);
    note("tabOverview", t);
    if(t!==lastDay){
      lastDay=t;
      if(typeof loadSupervisorData==="function") loadSupervisorData();
    }
    var rows=compute();
    var sig=t+"|"+kind()+"|"+JSON.stringify(rows)+"|"+todayRows().length;
    var p1=mountPanel("tabSubmissions","submissionsList");
    var p2=mountPanel("tabOverview","overallSummary");
    if(sig===lastSig && p1 && p1.innerHTML && p2 && p2.innerHTML) return;
    lastSig=sig;
    var html=panelHtml(rows, t)+soldHtml(t);
    if(p1) p1.innerHTML=html;
    if(p2) p2.innerHTML=html;
  }
  window.renderSupervisorDay=function(){ lastSig=""; tick(); };

  /* "Цэвэрлэх" on the Илгээлт filter must not open other days for ахлах */
  function wrapClear(){
    var f=window.clearSubFilter;
    if(typeof f!=="function" || f._supDay) return;
    var w=function(){ var r=f.apply(this, arguments); if(isSup()) window.renderSupervisorDay(); return r; };
    if(U().copyFlags) U().copyFlags(f, w);
    w._supDay=true;
    window.clearSubFilter=w;
  }

  tick();
  wrapReportDays();
  setInterval(function(){ wrapClear(); wrapReportDays(); tick(); }, 1000);
  /* re-lock right after any click inside Тайлан (period buttons set dates programmatically) */
  document.addEventListener("click", function(ev){
    if(!isSup() || !ev.target || !ev.target.closest || !ev.target.closest("#tabReports")) return;
    setTimeout(function(){ if(lockReport(today()) && typeof runReport==="function") runReport(); }, 0);
  }, false);
})();
