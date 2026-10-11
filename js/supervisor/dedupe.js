/* dedupe_fix: one row per employee+date+shift+location+tek+kind */
(function(){
  if(window._dedupeFix) return; window._dedupeFix=true;

  function tekOf(s){ return String((s&&(s.receiverName||s.tek||s.receiver))||"").trim(); }
  function kindOf(s){
    if(!s) return "bar";
    if(s.kind==="wine"||s.sheet==="wine") return "wine";
    if(String(tekOf(s)).toLowerCase().indexOf("вино")>=0) return "wine";
    return s.kind||s.sheet||"bar";
  }
  function biz(s){
    if(!s||s.deleted) return "";
    return [s.employeeId||"", s.date||"", s.shift||"", s.location||"", tekOf(s), kindOf(s)].join("|").toLowerCase();
  }
  function newer(a,b){
    var ta=String((a&&a.submittedAt)||"");
    var tb=String((b&&b.submittedAt)||"");
    if(ta!==tb) return ta>tb;
    return Number((a&&a.calcTotal)||0) >= Number((b&&b.calcTotal)||0);
  }
  function listOf(x){
    if(Array.isArray(x)) return x.filter(Boolean);
    if(x&&typeof x==="object") return Object.keys(x).map(function(k){ return x[k]; }).filter(function(s){ return s&&typeof s==="object"; });
    return [];
  }
  function dedupe(arr){
    var map={}, order=[];
    listOf(arr).forEach(function(s){
      if(!s||s.deleted) return;
      var k=biz(s);
      if(!k) return;
      if(!map[k]){ map[k]=s; order.push(k); }
      else if(newer(s, map[k])) map[k]=s;
    });
    return order.map(function(k){ return map[k]; });
  }

  if(typeof window.getSubs==="function" && !window.getSubs._dedupe){
    var _g=window.getSubs;
    window.getSubs=function(){ return dedupe(_g.apply(this, arguments)); };
    window.getSubs._dedupe=true;
  }
  if(typeof window.setSubs==="function" && !window.setSubs._dedupe){
    var _s=window.setSubs;
    window.setSubs=function(arr){ return _s.call(this, dedupe(arr)); };
    window.setSubs._dedupe=true;
  }
  if(typeof window.renderSubmissionsList==="function" && !window.renderSubmissionsList._dedupe){
    var _r=window.renderSubmissionsList;
    window.renderSubmissionsList=function(list){ return _r.call(this, dedupe(list|| (typeof getSubs==="function"?getSubs():[]))); };
    window.renderSubmissionsList._dedupe=true;
  }
  if(typeof window.renderSubmissionsListEnhanced==="function" && !window.renderSubmissionsListEnhanced._dedupe){
    var _re=window.renderSubmissionsListEnhanced;
    window.renderSubmissionsListEnhanced=function(list){ return _re.call(this, dedupe(list||[])); };
    window.renderSubmissionsListEnhanced._dedupe=true;
  }
  if(typeof window.renderOverview==="function" && !window.renderOverview._dedupe){
    var _o=window.renderOverview;
    window.renderOverview=function(list){ return _o.call(this, dedupe(list|| (typeof getSubs==="function"?getSubs():[]))); };
    window.renderOverview._dedupe=true;
  }

  window._bizKey=biz;
  window._dedupeSubs=dedupe;
})();
