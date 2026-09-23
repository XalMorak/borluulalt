/* Merge submissions on sync. Do not let one device overwrite others. */
(function(){
  if(window._syncMerge) return;
  window._syncMerge = true;

  function toArr(v){
    if(!v) return [];
    if(Array.isArray(v)) return v.filter(Boolean);
    if(typeof v==="object"){
      return Object.keys(v).map(function(k){ return v[k]; }).filter(function(s){ return s && typeof s==="object"; });
    }
    return [];
  }

  function subKey(s){
    if(!s) return "";
    if(s.id) return "id:"+s.id;
    return [s.employeeId||"", s.date||"", s.shift||"", s.location||"", s.receiverName||s.receiver||"", s.kind||s.sheet||"bar"].join("|");
  }

  function newer(a,b){
    return String((a&&a.submittedAt)||"") >= String((b&&b.submittedAt)||"");
  }

  function mergeSubs(cloud, local){
    var map={};
    toArr(cloud).concat(toArr(local)).forEach(function(s){
      var k=subKey(s);
      if(!k) return;
      if(!map[k] || newer(s, map[k])) map[k]=s;
    });
    return Object.keys(map).map(function(k){ return map[k]; });
  }

  if(typeof window.applyAll==="function" && !window.applyAll._mergeArr){
    var _apply=window.applyAll;
    window.applyAll=function(data){
      if(data && data.submissions && !Array.isArray(data.submissions)){
        data=Object.assign({}, data, {submissions: toArr(data.submissions)});
      }
      return _apply.call(this, data);
    };
    window.applyAll._mergeArr=true;
  }

  window._sheetKind = "all";

  function wrapPush(){
    if(typeof window.cloudPush!=="function" || window.cloudPush._mergeSubs) return;
    var orig=window.cloudPush;
    window.cloudPush=async function(){
      try{
        if(typeof initFirebase==="function") initFirebase();
        if(window._fbDb && typeof getSubs==="function" && typeof setSubs==="function"){
          var snap=await window._fbDb.ref("borluulalt/submissions").once("value");
          var merged=mergeSubs(snap.val(), getSubs());
          setSubs(merged);
        }
      }catch(e){ console.warn("sync_merge", e); }
      return orig.apply(this, arguments);
    };
    window.cloudPush._mergeSubs=true;
  }

  function wrapPull(){
    if(typeof window.cloudPull!=="function" || window.cloudPull._mergeSubs) return;
    var orig=window.cloudPull;
    window.cloudPull=async function(){
      var ok=await orig.apply(this, arguments);
      try{
        if(window._fbDb && typeof getSubs==="function" && typeof setSubs==="function"){
          var snap=await window._fbDb.ref("borluulalt/submissions").once("value");
          setSubs(mergeSubs(snap.val(), getSubs()));
        }
      }catch(e){}
      return ok;
    };
    window.cloudPull._mergeSubs=true;
  }

  function wrapLoad(){
    if(typeof window.loadSupervisorData!=="function" || window.loadSupervisorData._mergeSubs) return;
    var orig=window.loadSupervisorData;
    window.loadSupervisorData=function(){
      var all=typeof getSubs==="function"?getSubs():[];
      orig.apply(this, arguments);
      if(typeof renderSubmissionsListEnhanced==="function"){
        renderSubmissionsListEnhanced(all);
      } else if(typeof renderSubmissionsList==="function"){
        renderSubmissionsList(all);
      }
    };
    window.loadSupervisorData._mergeSubs=true;
  }

  function tick(){
    wrapPush();
    wrapPull();
    wrapLoad();
  }
  tick();
  setInterval(tick, 500);
})();
