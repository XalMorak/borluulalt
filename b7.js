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
