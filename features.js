/* borluulalt features: dark, auto-prev, chart, tek report */
var TEK_BY_LOC={"Оюут бар":["1-р тек","2-р тек","3-р тек","Урд монгол","Урд гадаад","ХАБ гадаад","ХАБ монгол"],"Манлай бар":["1-р тек","2-р тек"],"VIP":["VIP-1","VIP-2","VIP-3"],"POWER":["POWER 1-р тек"]};
var TEK_REPORT=TEK_BY_LOC;

function onLocationChange(){
  var loc=document.getElementById("locationName");
  var sel=document.getElementById("receiverName");
  if(!loc||!sel)return;
  var opts=TEK_BY_LOC[loc.value]||[];
  sel.innerHTML='<option value="">— Сонгох —</option>'+opts.map(function(t){return '<option value="'+t+'">'+t+'</option>';}).join("");
}

function toggleDark(){
  document.body.classList.toggle("dark");
  var on=document.body.classList.contains("dark");
  try{localStorage.setItem("borluulalt_dark",on?"1":"0");}catch(e){}
  var b=document.getElementById("darkBtn");
  if(b)b.textContent=on?"☀️":"🌙";
}
(function(){try{if(localStorage.getItem("borluulalt_dark")==="1"){document.body.classList.add("dark");var b=document.getElementById("darkBtn");if(b)b.textContent="☀️";}}catch(e){}})();

function autoFillEmployeeForm(){
  if(!window.currentUser||currentUser.role!=="employee")return;
  if(typeof getSubs!=="function")return;
  var all=getSubs().filter(function(s){return s.employeeId===currentUser.id;});
  all.sort(function(a,b){return (a.date||"").localeCompare(b.date||"")||(a.shift||"").localeCompare(b.shift||"");});
  var last=all[all.length-1];
  if(!last||!last.items)return;
  last.items.forEach(function(it){
    var el=document.getElementById("prev_"+it.id);
    if(el&&(Number(el.value)||0)===0)el.value=it.next!=null?it.next:0;
  });
  var locEl=document.getElementById("locationName");
  if(locEl&&!locEl.value&&last.location){locEl.value=last.location;onLocationChange();}
  var tekEl=document.getElementById("receiverName");
  if(tekEl&&!tekEl.value&&last.receiver){
    var found=false;for(var i=0;i<tekEl.options.length;i++)if(tekEl.options[i].value===last.receiver)found=true;
    if(!found){var o=document.createElement("option");o.value=last.receiver;o.textContent=last.receiver;tekEl.appendChild(o);}
    tekEl.value=last.receiver;
  }
  if(typeof updateRecon==="function")updateRecon();
}

function onReportLocChange(){
  var loc=(document.getElementById("reportLoc")||{}).value||"";
  var sel=document.getElementById("reportTek");
  if(!sel)return;
  var opts=[];
  if(loc)opts=TEK_REPORT[loc]||[];
  else{var u={};Object.keys(TEK_REPORT).forEach(function(k){TEK_REPORT[k].forEach(function(t){u[t]=1;});});opts=Object.keys(u);}
  sel.innerHTML='<option value="">Бүгд</option>'+opts.map(function(t){return '<option value="'+t+'">'+t+'</option>';}).join("");
}

function filterReportRows(){
  var from=(document.getElementById("reportFrom")||{}).value||"";
  var to=(document.getElementById("reportTo")||{}).value||"";
  var emp=(document.getElementById("reportEmp")||{}).value||"";
  var loc=(document.getElementById("reportLoc")||{}).value||"";
  var tek=(document.getElementById("reportTek")||{}).value||"";
  var all=(typeof getSubs==="function"?getSubs():[]).slice();
  if(from)all=all.filter(function(s){return s.date>=from;});
  if(to)all=all.filter(function(s){return s.date<=to;});
  if(emp)all=all.filter(function(s){return s.employeeId===emp;});
  if(loc)all=all.filter(function(s){return s.location===loc;});
  if(tek)all=all.filter(function(s){return (s.receiver||"")===tek;});
  return all;
}

function showChart(days){
  days=days||7;
  var cutoff=new Date();cutoff.setDate(cutoff.getDate()-days+1);
  var from=cutoff.toISOString().slice(0,10);
  var loc=(document.getElementById("reportLoc")||{}).value||"";
  var tek=(document.getElementById("reportTek")||{}).value||"";
  var emp=(document.getElementById("reportEmp")||{}).value||"";
  var all=(typeof getSubs==="function"?getSubs():[]).filter(function(s){
    if((s.date||"")<from)return false;
    if(loc&&s.location!==loc)return false;
    if(tek&&(s.receiver||"")!==tek)return false;
    if(emp&&s.employeeId!==emp)return false;
    return true;
  });
  var byDate={};
  for(var i=0;i<days;i++){var d=new Date();d.setDate(d.getDate()-(days-1-i));byDate[d.toISOString().slice(0,10)]={income:0,over:0,short:0};}
  all.forEach(function(s){
    if(!byDate[s.date])byDate[s.date]={income:0,over:0,short:0};
    byDate[s.date].income+=(s.calcTotal!=null?s.calcTotal:0);
    var diff=s.diff!=null?s.diff:0;
    if(diff>0)byDate[s.date].over+=diff;else byDate[s.date].short+=Math.abs(diff);
  });
  var keys=Object.keys(byDate).sort(),maxVal=1;
  keys.forEach(function(k){maxVal=Math.max(maxVal,byDate[k].income,byDate[k].over,byDate[k].short);});
  var bars=document.getElementById("chartBars");
  if(!bars)return;
  bars.innerHTML=keys.map(function(k){
    var v=byDate[k];
    var hi=Math.round((v.income/maxVal)*140),ho=Math.round((v.over/maxVal)*140),hs=Math.round((v.short/maxVal)*140);
    return '<div class="chart-bar-col" title="'+k+' орлого '+v.income.toLocaleString()+' илүү '+v.over.toLocaleString()+' дутуу '+v.short.toLocaleString()+'"><div class="chart-bar income" style="height:'+hi+'px"></div><div class="chart-bar over" style="height:'+ho+'px;margin-top:2px"></div><div class="chart-bar short" style="height:'+hs+'px;margin-top:2px"></div><div class="chart-label">'+k.slice(5)+'</div></div>';
  }).join("");
  var title=document.getElementById("chartTitle");
  if(title)title.textContent="Сүүлийн "+days+" хоног"+(loc?" · "+loc:"")+(tek?" · "+tek:"");
  var fromEl=document.getElementById("reportFrom"),toEl=document.getElementById("reportTo");
  if(fromEl)fromEl.value=from;
  if(toEl)toEl.value=new Date().toISOString().slice(0,10);
  if(typeof runReport==="function")runReport();
}

async function refreshData(){
  try{
    if(typeof updateSyncBadge==="function")updateSyncBadge("busy");
    if(typeof cloudPull==="function")await cloudPull();
    if(currentUser&&currentUser.role==="supervisor"&&typeof loadSupervisorData==="function")loadSupervisorData();
    else if(currentUser&&currentUser.role==="employee"&&typeof buildSalesTable==="function"&&!window._formDirty)buildSalesTable();
    if(typeof updateSyncBadge==="function")updateSyncBadge("ok");
    alert("Мэдээлэл шинэчлэгдлээ");
  }catch(e){alert("Шинэчлэхэд алдаа: "+e.message);}
}

(function(){
  function wrapIncome(){
    if(window._iw||typeof window.calcIncome!=="function")return;window._iw=true;
    var _c=window.calcIncome;window.calcIncome=function(id){_c(id);autoIncome(id);};
    var _b=window.buildSalesTable;
    if(typeof _b==="function")window.buildSalesTable=function(){_b.apply(this,arguments);setTimeout(function(){lockAll();autoFillEmployeeForm();},30);};
  }
  function autoIncome(id){
    var s=document.getElementById("sold_"+id),e=document.getElementById("income_"+id);if(!s||!e)return;
    var sold=Number(s.value)||0,p=(typeof getProduct==="function")?getProduct(id):null;
    e.value=sold*((p&&p.price)||0);e.readOnly=true;e.style.background="#eef2f7";e.style.pointerEvents="none";
    if(typeof updateRecon==="function")updateRecon();
  }
  function lockAll(){if(typeof getActiveProducts==="function")getActiveProducts().forEach(function(p){autoIncome(p.id);});}
  function wrapRecon(){
    if(window._rw||typeof window.updateRecon!=="function")return;window._rw=true;
    window.updateRecon=function(){
      var calc=(typeof getCalcTotal==="function")?getCalcTotal():0;
      var cash=Number((document.getElementById("cashAmount")||{}).value)||0;
      var card=Number((document.getElementById("cardTotal")||{}).value)||0;
      var start=Number((document.getElementById("cashBalance")||{}).value)||0;
      var cashFromSales=Math.max(0,cash-start),collected=cashFromSales+card,diff=collected-calc;
      var elCalc=document.getElementById("reconCalcTotal");if(!elCalc)return;
      elCalc.textContent=calc.toLocaleString()+" ₮";
      document.getElementById("reconCollected").textContent=collected.toLocaleString()+" ₮";
      var elDiff=document.getElementById("reconDiff");
      elDiff.textContent=(diff>=0?"+":"")+diff.toLocaleString()+" ₮";
      elDiff.className="value "+(Math.abs(diff)<0.01?"diff-ok":(diff>0?"diff-over":"diff-short"));
      var elSt=document.getElementById("reconStatus");
      if(Math.abs(diff)<0.01){elSt.textContent="Тохирсон ✓";elSt.className="value diff-ok";}
      else if(diff>0){elSt.textContent="Илүү +"+diff.toLocaleString();elSt.className="value diff-over";}
      else{elSt.textContent="Дутуу "+Math.abs(diff).toLocaleString();elSt.className="value diff-short";}
    };
    var _g=window.getFormData;
    if(typeof _g==="function")window.getFormData=function(){
      var data=_g.apply(this,arguments);
      if(data){var cash=Number(data.cashAmount)||0,card=Number(data.cardTotal)||0,start=Number(data.cashBalance)||0;
        data.cashFromSales=Math.max(0,cash-start);data.collected=data.cashFromSales+card;data.diff=data.collected-(data.calcTotal||0);}
      return data;
    };
  }
  function wrapReport(){
    if(window._rr||typeof window.runReport!=="function")return;window._rr=true;
    window.runReport=function(){
      var all=filterReportRows();window._reportRows=all;
      var totalIncome=0,totalOver=0,totalShort=0;
      all.forEach(function(s){totalIncome+=(s.calcTotal!=null?s.calcTotal:0);var d=s.diff!=null?s.diff:0;if(d>0)totalOver+=d;else totalShort+=Math.abs(d);});
      var sum=document.getElementById("reportSummary");
      if(sum)sum.innerHTML='<div class="summary-item"><div class="label">Илгээлт</div><div class="value">'+all.length+'</div></div><div class="summary-item"><div class="label">Орлого</div><div class="value">'+totalIncome.toLocaleString()+'₮</div></div><div class="summary-item"><div class="label">Илүү</div><div class="value diff-over">'+totalOver.toLocaleString()+'</div></div><div class="summary-item"><div class="label">Дутуу</div><div class="value diff-short">'+totalShort.toLocaleString()+'</div></div>';
      var tbody=document.getElementById("reportBody");
      if(tbody)tbody.innerHTML=all.map(function(s){var income=s.calcTotal!=null?s.calcTotal:0,diff=s.diff!=null?s.diff:0,cls=Math.abs(diff)<0.01?"diff-ok":(diff>0?"diff-over":"diff-short");
        return "<tr><td>"+s.date+"</td><td>"+s.employeeName+"</td><td>"+(s.shift||"—")+"</td><td>"+(s.location||"—")+"</td><td>"+(s.receiver||"—")+"</td><td>"+income.toLocaleString()+"₮</td><td class=\""+cls+"\">"+diff.toLocaleString()+"</td></tr>";}).join("")||'<tr><td colspan="7">Хоосон</td></tr>';
    };
  }
  function wrapTab(){
    if(window._tw||typeof window.showTab!=="function")return;window._tw=true;
    var orig=window.showTab;
    window.showTab=function(name){orig.apply(this,arguments);if(name==="reports"){onReportLocChange();setTimeout(function(){showChart(7);},80);}};
  }
  function tick(){wrapIncome();wrapRecon();wrapReport();wrapTab();}
  tick();setInterval(tick,400);
})();
