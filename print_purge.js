/* print CSS + soft-delete purge 30d */
(function(){
  if(!document.getElementById("print_css_fix")){
    var s=document.createElement("style");
    s.id="print_css_fix";
    s.textContent="@media print{body{background:#fff!important;color:#000!important;padding:0!important}.no-print,.tabs,.user-bar,.period-btns,.sync-badge,#loginSection,button,.btn,.tab-btn{display:none!important}.card{box-shadow:none!important;border:none!important;padding:0!important}table{font-size:11px}}";
    document.head.appendChild(s);
  }
})();
(function(){
  var DAYS=30;
  function purgeDeleted(){
    if(typeof getSubs!=="function"||typeof setSubs!=="function")return 0;
    var all=getSubs();
    if(!all||!all.length)return 0;
    var cut=Date.now()-DAYS*24*60*60*1000;
    var kept=[], removed=0;
    all.forEach(function(s){
      if(!s)return;
      if(s.deleted){
        var t=Date.parse(s.deletedAt||s.submittedAt||"")||0;
        if(t && t<cut){removed++;return;}
        kept.push(s);
      }else kept.push(s);
    });
    if(removed){setSubs(kept);console.log("Purged deleted:",removed);}
    return removed;
  }
  function wrapDelete(){
    if(typeof window.deleteSubmission!=="function"||window.deleteSubmission._purge)return;
    var _d=window.deleteSubmission;
    window.deleteSubmission=async function(){
      var r=await _d.apply(this,arguments);
      try{
        var all=getSubs(), changed=false;
        all.forEach(function(s){
          if(s&&s.deleted&&!s.deletedAt){s.deletedAt=new Date().toISOString();changed=true;}
        });
        if(changed)setSubs(all);
      }catch(e){}
      return r;
    };
    window.deleteSubmission._purge=true;
  }
  setInterval(function(){
    wrapDelete();
    if(window.currentUser&&currentUser.role==="supervisor"){
      if(!window._lastPurge||Date.now()-window._lastPurge>120000){
        window._lastPurge=Date.now();
        var n=purgeDeleted();
        if(n&&typeof cloudPush==="function")cloudPush();
      }
    }
  },2000);
  window.purgeDeletedSubs=purgeDeleted;
})();
