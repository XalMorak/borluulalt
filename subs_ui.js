/* Submissions list: show tek + date filter */
function getSubTek(s){
  return (s && (s.receiverName || s.receiver || "")).toString().trim();
}

function renderSubmissionsListEnhanced(all){
  var list=document.getElementById("submissionsList");
  if(!list)return;
  all=all||(typeof getSubs==="function"?getSubs():[]);
  var fromEl=document.getElementById("subFilterFrom");
  var toEl=document.getElementById("subFilterTo");
  var locEl=document.getElementById("subFilterLoc");
  var from=fromEl?fromEl.value:"";
  var to=toEl?toEl.value:"";
  var loc=locEl?locEl.value:"";
  var filtered=all.filter(function(s){
    if(from && (s.date||"")<from)return false;
    if(to && (s.date||"")>to)return false;
    if(loc && (s.location||"")!==loc)return false;
    return true;
  });
  if(!filtered.length){
    list.innerHTML='<div class="alert alert-info">Илгээлт байхгүй'+(from||to||loc?' (шүүлтээр)':'')+'</div>';
    var det=document.getElementById("selectedSubmissionDetail");
    if(det)det.classList.add("hidden");
    return;
  }
  filtered=filtered.slice().sort(function(a,b){
    return new Date(b.submittedAt||b.date)-new Date(a.submittedAt||a.date);
  });
  window._sortedSubs=filtered;
  list.innerHTML=filtered.map(function(s,idx){
    var calc=s.calcTotal!=null?s.calcTotal:(s.items||[]).reduce(function(a,i){return a+(i.income||0);},0);
    var diff=s.diff!=null?s.diff:((s.cashAmount||0)+(s.cardTotal||0)-calc);
    var tek=getSubTek(s);
    var locLine=(s.location||"")+(tek?" · Тек: "+tek:"");
    var diffCls=Math.abs(diff)<0.01?"diff-ok":(diff>0?"diff-over":"diff-short");
    var diffTxt=Math.abs(diff)<0.01?"✓":(diff>0?"+":"")+Number(diff).toLocaleString();
    return '<div class="sub-item '+(s.locked?"locked":"")+'" onclick="showSubmissionDetail('+idx+')">'+
      '<strong>'+ (s.employeeName||"") +'</strong> ('+(s.employeeId||"")+') — '+(s.date||"")+' ('+(s.shift||"—")+')'+
      (s.locked?" 🔒":"")+
      (locLine?'<br><span style="color:#2980b9;font-weight:600">'+locLine+'</span>':'')+
      '<br><small>'+(s.submittedAt?new Date(s.submittedAt).toLocaleString("mn-MN"):"")+' | '+
      Number(calc).toLocaleString()+'₮ | <span class="'+diffCls+'">'+diffTxt+'</span></small></div>';
  }).join("");
}

function applySubFilter(){
  if(typeof renderSubmissionsListEnhanced==="function")
    renderSubmissionsListEnhanced(typeof getSubs==="function"?getSubs():[]);
}
function clearSubFilter(){
  ["subFilterFrom","subFilterTo","subFilterLoc"].forEach(function(id){
    var el=document.getElementById(id);if(el)el.value="";
  });
  applySubFilter();
}

(function(){
  function wrap(){
    if(typeof window.renderSubmissionsList!=="function")return;
    window.renderSubmissionsList=function(all){renderSubmissionsListEnhanced(all);};
  }
  wrap();setInterval(wrap,400);

  function wrapDetail(){
    if(window._detTek||typeof window.renderDetailView!=="function")return;
    window._detTek=true;
    var _d=window.renderDetailView;
    window.renderDetailView=function(s,idx){
      _d.apply(this,arguments);
      var box=document.getElementById("selectedSubmissionDetail");
      if(!box||!s)return;
      var tek=getSubTek(s);
      if(!tek)return;
      if(box.innerHTML.indexOf("Тек:")>=0)return;
      var p=box.querySelector("p");
      if(p)p.innerHTML+=" · <strong>Тек: "+tek+"</strong>";
      else box.insertAdjacentHTML("afterbegin",'<p><strong>Тек: '+tek+'</strong></p>');
    };
  }
  wrapDetail();setInterval(wrapDetail,500);
})();
