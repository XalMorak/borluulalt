/* report_fix: Taiylan must not recurse getSubs */
(function(){
  if(window._reportFix) return; window._reportFix=true;
  function nrm(s){ return String(s||"").toLowerCase(); }
  function tekOf(s){ return String((s&&(s.receiverName||s.tek||s.receiver))||"").trim(); }
  function kindOf(s){
    if(!s) return "bar";
    if(s.kind==="wine"||s.sheet==="wine") return "wine";
    if(nrm(tekOf(s)).indexOf("\u0432\u0438\u043d\u043e")>=0) return "wine";
    var items=s.items||[];
    for(var i=0;i<items.length;i++) if(Number(items[i]&&items[i].id)>=100) return "wine";
    return "bar";
  }
  function rawSubs(){
    var list=[];
    try{
      list=JSON.parse(localStorage.getItem("submissions")||"[]")||[];
    }catch(e){ list=[]; }
    if(!list.length){
      try{
        if(window.getSubs && window.getSubs._raw) list=window.getSubs._raw()||[];
      }catch(e2){}
    }
    return (list||[]).filter(function(s){ return s && !s.deleted; });
  }
  function filtered(){
    var all=rawSubs();
    var k=window._sheetKind||"all";
    if(k!=="all") all=all.filter(function(s){ return kindOf(s)===k; });
    var from=(document.getElementById("reportFrom")||{}).value||"";
    var to=(document.getElementById("reportTo")||{}).value||"";
    var emp=(document.getElementById("reportEmp")||{}).value||"";
    var loc=(document.getElementById("reportLoc")||{}).value||"";
    var tek=(document.getElementById("reportTek")||{}).value||"";
    if(from) all=all.filter(function(s){ return (s.date||"")>=from; });
    if(to) all=all.filter(function(s){ return (s.date||"")<=to; });
    if(emp) all=all.filter(function(s){ return s.employeeId===emp; });
    if(loc) all=all.filter(function(s){ return (s.location||"")===loc; });
    if(tek) all=all.filter(function(s){ return tekOf(s)===tek; });
    all=all.slice().sort(function(a,b){
      return String(b.date||"").localeCompare(String(a.date||""));
    });
    return all;
  }
  window.filterReportRows=filtered;
  window.runReport=function(){
    var all=filtered();
    window._reportRows=all;
    var totalIncome=0,totalOver=0,totalShort=0,totalDiff=0;
    all.forEach(function(s){
      totalIncome+=(s.calcTotal!=null?s.calcTotal:0);
      var d=s.diff!=null?s.diff:0;
      totalDiff+=d;
      if(d>0) totalOver+=d; else totalShort+=Math.abs(d);
    });
    var sum=document.getElementById("reportSummary");
    if(sum){
      sum.innerHTML=
        '<div class="summary-item"><div class="label">\u0418\u043b\u0433\u044d\u044d\u043b\u0442</div><div class="value">'+all.length+'</div></div>'
        +'<div class="summary-item"><div class="label">\u041e\u0440\u043b\u043e\u0433\u043e</div><div class="value">'+totalIncome.toLocaleString()+'\u20ae</div></div>'
        +'<div class="summary-item"><div class="label">\u0418\u043b\u04af\u04af</div><div class="value">'+totalOver.toLocaleString()+'</div></div>'
        +'<div class="summary-item"><div class="label">\u0414\u0443\u0442\u0443\u0443</div><div class="value">'+totalShort.toLocaleString()+'</div></div>';
    }
    var tbody=document.getElementById("reportBody");
    if(!tbody) return;
    tbody.innerHTML=all.map(function(s){
      var income=s.calcTotal!=null?s.calcTotal:0;
      var diff=s.diff!=null?s.diff:0;
      var cls=Math.abs(diff)<0.01?"diff-ok":(diff>0?"diff-over":"diff-short");
      return "<tr><td>"+(s.date||"")+"</td><td>"+(s.employeeName||"")+"</td><td>"+(s.shift||"\u2014")+"</td><td>"+(s.location||"\u2014")+"</td><td>"+(tekOf(s)||"\u2014")+"</td><td>"+income.toLocaleString()+"\u20ae</td><td class=\""+cls+"\">"+diff.toLocaleString()+"</td></tr>";
    }).join("") || '<tr><td colspan="7">\u0425\u043e\u043e\u0441\u043e\u043d</td></tr>';
  };
  window.runReport._reportFix=true;
  function bind(){
    ["reportFrom","reportTo","reportEmp","reportLoc","reportTek"].forEach(function(id){
      var el=document.getElementById(id);
      if(el && !el._rf){ el._rf=true; el.addEventListener("change", function(){ window.runReport(); }); }
    });
  }
  bind();
  setInterval(function(){
    bind();
    var pane=document.getElementById("tabReports");
    if(pane && !pane.classList.contains("hidden")){
      var tb=document.getElementById("reportBody");
      if(tb && !tb.querySelector("tr")) window.runReport();
    }
  }, 800);
})();
