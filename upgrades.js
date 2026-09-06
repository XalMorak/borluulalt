/* upgrades: realtime, excel tek, archive 60d, line chart */
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
      if(window._syncBusy)return;
      if(typeof applyAll==="function")applyAll(data);
      else{
        if(data.submissions&&typeof setSubs==="function"){
          var arr=Array.isArray(data.submissions)?data.submissions:Object.keys(data.submissions).map(function(k){return data.submissions[k];});
          if(typeof _mergeSubs==="function")arr=_mergeSubs(arr, typeof getSubs==="function"?getSubs():[]);
          setSubs(arr);
        }
        if(data.products&&typeof setProducts==="function"){
          var p=Array.isArray(data.products)?data.products:Object.keys(data.products).map(function(k){return data.products[k];});
          setProducts(p);
        }
      }
      try{if(typeof migrateAllProducts==="function")migrateAllProducts();}catch(e){}
      if(window.currentUser&&currentUser.role==="supervisor"){
        if(typeof loadSupervisorData==="function")loadSupervisorData();
      }
      if(typeof updateSyncBadge==="function")updateSyncBadge("ok");
    }, function(err){
      console.warn("realtime", err);
      if(typeof updateSyncBadge==="function")updateSyncBadge("err");
    });
  }catch(e){console.warn(e);window._rtStarted=false;}
}
(function(){
  function tryStart(){
    if(window._rtStarted)return;
    if(typeof initFirebase==="function"){try{initFirebase();}catch(e){}}
    if(window._fbDb)startRealtimeSync();
  }
  tryStart();
  setInterval(tryStart,1000);
  var _login=window.doLogin;
  if(typeof _login==="function"&&!window._rtLoginWrap){
    window._rtLoginWrap=true;
    window.doLogin=async function(){
      var r=await _login.apply(this,arguments);
      setTimeout(startRealtimeSync,500);
      return r;
    };
  }
})();

(function(){
  function wrapExport(){
    if(window._excelTekWrapped)return;
    if(typeof window.exportCSV!=="function")return;
    window._excelTekWrapped=true;
    window.exportCSV=function(){
      var rows=(window._reportRows&&window._reportRows.length)?window._reportRows:(typeof getSubs==="function"?getSubs():[]);
      var csv="Огноо,Ажилтан,ID,Ээлж,Байршил,Тек,Бэлэн,Карт,Эхлэл дүн,Бодсон,Нийт борлуулалт,Зөрүү,Төлөв\n";
      rows.forEach(function(s){
        var calc=s.calcTotal!=null?s.calcTotal:0;
        var cash=s.cashAmount||0, card=s.cardTotal||0, start=s.cashBalance||0;
        var collected=s.collected!=null?s.collected:Math.max(0,cash-start)+card;
        var diff=s.diff!=null?s.diff:(collected-calc);
        var status=Math.abs(diff)<0.01?"Тохирсон":(diff>0?"Илүү":"Дутуу");
        function esc(v){v=String(v==null?"":v);if(/[",\n]/.test(v))return '"'+v.replace(/"/g,'""')+'"';return v;}
        csv+=[s.date,s.employeeName,s.employeeId,s.shift||"",s.location||"",s.receiver||"",cash,card,start,calc,collected,diff,status].map(esc).join(",")+"\n";
      });
      var blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
      var a=document.createElement("a");
      a.href=URL.createObjectURL(blob);
      a.download="borluulalt_report.csv";
      a.click();
    };
  }
  wrapExport();setInterval(wrapExport,400);
})();

function archiveOldSubmissions(){
  if(typeof getSubs!=="function"||typeof setSubs!=="function")return 0;
  var cutoff=new Date();
  cutoff.setDate(cutoff.getDate()-ARCHIVE_DAYS);
  var cut=cutoff.toISOString().slice(0,10);
  var all=getSubs();
  var keep=[], arch=[];
  all.forEach(function(s){
    if((s.date||"")<cut)arch.push(s);
    else keep.push(s);
  });
  if(!arch.length)return 0;
  var prev=[];
  try{prev=JSON.parse(localStorage.getItem("borluulalt_archive")||"[]");}catch(e){}
  var map={};
  prev.concat(arch).forEach(function(s){
    var k=s.id||((s.employeeId||"")+"|"+(s.date||"")+"|"+(s.shift||"")+"|"+(s.submittedAt||""));
    map[k]=s;
  });
  var merged=Object.keys(map).map(function(k){return map[k];});
  localStorage.setItem("borluulalt_archive", JSON.stringify(merged));
  setSubs(keep);
  if(typeof cloudPush==="function"){
    cloudPush().then(function(){
      if(window._fbDb){
        window._fbDb.ref("borluulalt_archive").set(merged).catch(function(){});
      }
    });
  }
  return arch.length;
}
(function(){
  function runArch(){try{archiveOldSubmissions();}catch(e){}}
  setTimeout(runArch,3000);
  setInterval(runArch, 6*60*60*1000);
})();

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
  keys.forEach(function(k){maxVal=Math.max(maxVal,byDate[k].income,byDate[k].over,byDate[k].short);});

  var host=document.getElementById("chartBars");
  if(!host)return;
  var W=Math.max(host.clientWidth||600, 320), H=180, padL=8, padR=8, padT=12, padB=28;
  var plotW=W-padL-padR, plotH=H-padT-padB;
  function xAt(i){return padL+(keys.length<=1?plotW/2:(i/(keys.length-1))*plotW);}
  function yAt(v){return padT+plotH-(v/maxVal)*plotH;}

  function pathFor(field, color){
    var pts=keys.map(function(k,i){return xAt(i)+","+yAt(byDate[k][field]);});
    var d="M "+pts.join(" L ");
    var area="";
    if(field==="income"){
      area='<path d="'+d+" L "+xAt(keys.length-1)+","+(padT+plotH)+" L "+xAt(0)+","+(padT+plotH)+' Z" fill="'+color+'" opacity="0.12"/>';
    }
    return area+'<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'+
      keys.map(function(k,i){
        return '<circle cx="'+xAt(i)+'" cy="'+yAt(byDate[k][field])+'" r="3.5" fill="'+color+'"><title>'+k+': '+byDate[k][field].toLocaleString()+'</title></circle>';
      }).join("");
  }

  var labels=keys.map(function(k,i){
    var step=keys.length>14?3:(keys.length>10?2:1);
    if(i%step!==0&&i!==keys.length-1)return "";
    return '<text x="'+xAt(i)+'" y="'+(H-8)+'" text-anchor="middle" font-size="10" fill="#888">'+k.slice(5)+'</text>';
  }).join("");

  host.innerHTML='<svg width="100%" height="'+H+'" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="display:block">'+
    pathFor("income","#27ae60")+
    pathFor("over","#2980b9")+
    pathFor("short","#c0392b")+
    labels+
    '</svg>';

  var title=document.getElementById("chartTitle");
  if(title)title.textContent="Сүүлийн "+days+" хоног (шугаман)"+(loc?" · "+loc:"")+(tek?" · "+tek:"");
  var fromEl=document.getElementById("reportFrom"), toEl=document.getElementById("reportTo");
  if(fromEl)fromEl.value=from;
  if(toEl)toEl.value=new Date().toISOString().slice(0,10);
  if(typeof runReport==="function")runReport();
}
(function(){
  function pin(){window.showChart=showChart;}
  pin();setInterval(pin,500);
})();
