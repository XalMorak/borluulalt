/* enhancements: realtime, excel tek, archive 60d, line charts */
var ARCHIVE_DAYS=60;

function startRealtimeSync(){
  if(window._rtStarted)return;
  if(typeof initFirebase==="function")initFirebase();
  if(!window._fbDb)return;
  window._rtStarted=true;
  try{
    window._fbDb.ref("borluulalt").on("value", function(snap){
      var data=snap.val();
      if(!data)return;
      if(window._formDirty&&window.currentUser&&currentUser.role==="employee")return;
      if(typeof applyAll==="function")applyAll(data);
      if(window.currentUser&&currentUser.role==="supervisor"&&typeof loadSupervisorData==="function"){
        loadSupervisorData();
      }
      if(typeof updateSyncBadge==="function")updateSyncBadge("ok");
    }, function(err){
      console.warn("realtime", err);
      if(typeof updateSyncBadge==="function")updateSyncBadge("err");
    });
  }catch(e){console.warn(e);window._rtStarted=false;}
}

(function(){
  function tryRt(){
    if(window._fbDb||(typeof initFirebase==="function"&&initFirebase()))startRealtimeSync();
  }
  tryRt();
  setInterval(tryRt,1000);
  var t=setInterval(function(){
    if(window.currentUser){startRealtimeSync();clearInterval(t);}
  },500);
})();

function exportCSVEnhanced(){
  var rows=(window._reportRows&&window._reportRows.length)?window._reportRows:(typeof getSubs==="function"?getSubs():[]);
  var csv="Огноо,Ажилтан,ID,Ээлж,Байршил,Тек,Бэлэн,Карт,Эхлэл дүн,Орлого,Нийт борлуулалт,Зөрүү,Төлөв\n";
  rows.forEach(function(s){
    var calc=s.calcTotal!=null?s.calcTotal:0;
    var diff=s.diff!=null?s.diff:0;
    var collected=s.collected!=null?s.collected:((s.cashAmount||0)+(s.cardTotal||0));
    var status=Math.abs(diff)<0.01?"Тохирсон":(diff>0?"Илүү":"Дутуу");
    function esc(v){v=String(v==null?"":v);if(/[",\n]/.test(v))return '"'+v.replace(/"/g,'""')+'"';return v;}
    csv+=[s.date,s.employeeName,s.employeeId,s.shift||"",s.location||"",s.receiver||"",
      s.cashAmount||0,s.cardTotal||0,s.cashBalance||0,calc,collected,diff,status].map(esc).join(",")+"\n";
  });
  var blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="borluulalt_report_"+new Date().toISOString().slice(0,10)+".csv";
  a.click();
}
(function(){
  function wrap(){
    if(window._csvWrap)return;
    if(typeof window.exportCSV!=="function")return;
    window._csvWrap=true;
    window.exportCSV=exportCSVEnhanced;
  }
  wrap();setInterval(wrap,400);
})();

function archiveCutoffDate(){
  var d=new Date();
  d.setDate(d.getDate()-ARCHIVE_DAYS);
  return d.toISOString().slice(0,10);
}
function runArchiveCleanup(){
  if(typeof getSubs!=="function"||typeof setSubs!=="function")return;
  var all=getSubs();
  var cut=archiveCutoffDate();
  var active=[], archived=[];
  all.forEach(function(s){
    if((s.date||"")>=cut)active.push(s);
    else archived.push(s);
  });
  try{
    var prev=JSON.parse(localStorage.getItem("borluulalt_archive")||"[]");
    var map={};
    prev.concat(archived).forEach(function(s){
      var k=(s.id||"")+"|"+(s.employeeId||"")+"|"+(s.date||"")+"|"+(s.shift||"");
      map[k]=s;
    });
    localStorage.setItem("borluulalt_archive", JSON.stringify(Object.keys(map).map(function(k){return map[k];})));
  }catch(e){}
  if(archived.length&&active.length!==all.length){
    setSubs(active);
    if(typeof cloudPush==="function")cloudPush();
  }
}
(function(){
  function wrapLoad(){
    if(window._archWrap)return;
    if(typeof window.loadSupervisorData!=="function")return;
    window._archWrap=true;
    var _l=window.loadSupervisorData;
    window.loadSupervisorData=function(){
      runArchiveCleanup();
      return _l.apply(this,arguments);
    };
  }
  wrapLoad();setInterval(wrapLoad,500);
  setTimeout(function(){try{runArchiveCleanup();}catch(e){}},3000);
})();

function showChartLines(days){
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
  for(var i=0;i<days;i++){
    var d=new Date();d.setDate(d.getDate()-(days-1-i));
    byDate[d.toISOString().slice(0,10)]={income:0,over:0,short:0};
  }
  all.forEach(function(s){
    if(!byDate[s.date])byDate[s.date]={income:0,over:0,short:0};
    byDate[s.date].income+=(s.calcTotal!=null?s.calcTotal:0);
    var diff=s.diff!=null?s.diff:0;
    if(diff>0)byDate[s.date].over+=diff;
    else byDate[s.date].short+=Math.abs(diff);
  });
  var keys=Object.keys(byDate).sort();
  var maxVal=1;
  keys.forEach(function(k){
    maxVal=Math.max(maxVal, byDate[k].income, byDate[k].over, byDate[k].short);
  });
  var bars=document.getElementById("chartBars");
  if(!bars)return;
  var W=Math.max(560, keys.length*36);
  var H=180, padL=8, padR=8, padT=12, padB=28;
  var innerW=W-padL-padR, innerH=H-padT-padB;
  function xAt(i){return padL+(keys.length===1?innerW/2:(i/(keys.length-1))*innerW);}
  function yAt(v){return padT+innerH-(v/maxVal)*innerH;}
  function pathFor(field, color){
    var pts=keys.map(function(k,i){return xAt(i)+","+yAt(byDate[k][field]);}).join(" ");
    return '<polyline fill="none" stroke="'+color+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="'+pts+'"/>'+
      keys.map(function(k,i){
        return '<circle cx="'+xAt(i)+'" cy="'+yAt(byDate[k][field])+'" r="3.5" fill="'+color+'"><title>'+k+': '+byDate[k][field].toLocaleString()+'</title></circle>';
      }).join("");
  }
  var labels=keys.map(function(k,i){
    return '<text x="'+xAt(i)+'" y="'+(H-8)+'" text-anchor="middle" font-size="10" fill="#666">'+k.slice(5)+'</text>';
  }).join("");
  var legend='<div style="display:flex;gap:14px;font-size:12px;margin-bottom:6px;flex-wrap:wrap">'+
    '<span style="color:#27ae60">● Орлого</span>'+
    '<span style="color:#2980b9">● Илүү</span>'+
    '<span style="color:#c0392b">● Дутуу</span></div>';
  bars.innerHTML=legend+'<div style="overflow-x:auto"><svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="max-width:100%">'+
    '<line x1="'+padL+'" y1="'+(padT+innerH)+'" x2="'+(W-padR)+'" y2="'+(padT+innerH)+'" stroke="#ddd" stroke-width="1"/>'+
    pathFor("income","#27ae60")+pathFor("over","#2980b9")+pathFor("short","#c0392b")+
    labels+'</svg></div>';
  var title=document.getElementById("chartTitle");
  if(title)title.textContent="Сүүлийн "+days+" хоног (шугаман график)"+(loc?" · "+loc:"")+(tek?" · "+tek:"");
  var fromEl=document.getElementById("reportFrom"), toEl=document.getElementById("reportTo");
  if(fromEl)fromEl.value=from;
  if(toEl)toEl.value=new Date().toISOString().slice(0,10);
  if(typeof runReport==="function")runReport();
}
(function(){
  function wrapChart(){
    if(typeof window.showChart!=="function")return;
    window.showChart=showChartLines;
  }
  wrapChart();setInterval(wrapChart,400);
})();
