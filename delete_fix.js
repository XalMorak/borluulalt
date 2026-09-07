/* delete_fix v2: delete only ONE submission; hide deleted in reports */
(function(){
  function visibleSubs(all){
    return (all||[]).filter(function(s){return s&&!s.deleted;});
  }

  function findIndexExact(all, s){
    if(!s||!all)return -1;
    if(s.id){
      for(var i=0;i<all.length;i++){
        if(all[i]&&all[i].id===s.id)return i;
      }
    }
    if(s.submittedAt){
      for(var i=0;i<all.length;i++){
        var x=all[i];
        if(!x||x.deleted)continue;
        if(x.submittedAt===s.submittedAt&&x.employeeId===s.employeeId&&x.date===s.date)return i;
      }
    }
    for(var i=0;i<all.length;i++){
      var x=all[i];
      if(!x||x.deleted)continue;
      if(x.employeeId===s.employeeId&&x.date===s.date&&
         (x.shift||"")===(s.shift||"")&&
         (x.location||"")===(s.location||"")&&
         (x.receiverName||x.receiver||"")===(s.receiverName||s.receiver||"")){
        return i;
      }
    }
    return -1;
  }

  function wrapListRenders(){
    if(typeof window.renderSubmissionsListEnhanced==="function"&&!window.renderSubmissionsListEnhanced._del2){
      var _r=window.renderSubmissionsListEnhanced;
      window.renderSubmissionsListEnhanced=function(all){
        return _r(visibleSubs(all||(typeof getSubs==="function"?getSubs():[])));
      };
      window.renderSubmissionsListEnhanced._del2=true;
    }
    if(typeof window.renderSubmissionsList==="function"&&!window.renderSubmissionsList._del2){
      var _rs=window.renderSubmissionsList;
      window.renderSubmissionsList=function(all){
        return _rs(visibleSubs(all||(typeof getSubs==="function"?getSubs():[])));
      };
      window.renderSubmissionsList._del2=true;
    }
    if(typeof window.renderOverview==="function"&&!window.renderOverview._del2){
      var _o=window.renderOverview;
      window.renderOverview=function(all){return _o(visibleSubs(all));};
      window.renderOverview._del2=true;
    }
  }

  function wrapReports(){
    if(typeof window.runReport==="function"&&!window.runReport._del2){
      var _rr=window.runReport;
      window.runReport=function(){
        if(typeof window.getSubs==="function"){
          var _g=window.getSubs;
          window.getSubs=function(){return visibleSubs(_g());};
          try{return _rr.apply(this,arguments);}
          finally{window.getSubs=_g;}
        }
        return _rr.apply(this,arguments);
      };
      window.runReport._del2=true;
    }
    if(typeof window.showChart==="function"&&!window.showChart._del2){
      var _sc=window.showChart;
      window.showChart=function(){
        if(typeof window.getSubs==="function"){
          var _g=window.getSubs;
          window.getSubs=function(){return visibleSubs(_g());};
          try{return _sc.apply(this,arguments);}
          finally{window.getSubs=_g;}
        }
        return _sc.apply(this,arguments);
      };
      window.showChart._del2=true;
    }
    if(typeof window.exportCSV==="function"&&!window.exportCSV._del2){
      var _ex=window.exportCSV;
      window.exportCSV=function(){
        if(typeof window.getSubs==="function"){
          var _g=window.getSubs;
          window.getSubs=function(){return visibleSubs(_g());};
          try{return _ex.apply(this,arguments);}
          finally{window.getSubs=_g;}
        }
        return _ex.apply(this,arguments);
      };
      window.exportCSV._del2=true;
    }
  }

  async function deleteSubmissionFixed(idx){
    var s=window._sortedSubs&&window._sortedSubs[idx];
    if(!s){alert("Илгээлт олдсонгүй");return;}
    if(s.locked){alert("Түгжигдсэн илгээлтийг устгахын тулд эхлээд түгжээг тайлана уу");return;}
    var label=(s.employeeName||"")+" — "+(s.date||"")+(s.shift?" ("+s.shift+")":"")+(s.location?" · "+s.location:"");
    if(!confirm(label+"\nустгах уу? (зөвхөн энэ нэг илгээлт)"))return;
    if(typeof getSubs!=="function"||typeof setSubs!=="function")return;

    var all=getSubs().slice();
    var i=findIndexExact(all,s);
    if(i<0){
      alert("Илгээлт өгөгдлөөс олдсонгүй");
      return;
    }
    all[i]=Object.assign({},all[i],{deleted:true,submittedAt:new Date().toISOString()});

    try{
      if(s.items&&typeof getProducts==="function"){
        var products=getProducts();
        var loc=s.location||"Оюут бар";
        var LOCS=["Оюут бар","Манлай бар","POWER"];
        if(LOCS.indexOf(loc)<0)loc="Оюут бар";
        s.items.forEach(function(it){
          if(!(it.sold>0))return;
          var pi=products.findIndex(function(p){return p.id===it.id;});
          if(pi<0)return;
          if(!products[pi].stockByLoc)products[pi].stockByLoc={};
          LOCS.forEach(function(l){if(products[pi].stockByLoc[l]==null)products[pi].stockByLoc[l]=0;});
          products[pi].stockByLoc[loc]=(Number(products[pi].stockByLoc[loc])||0)+(it.sold||0);
          products[pi].stock=LOCS.reduce(function(a,l){return a+(Number(products[pi].stockByLoc[l])||0);},0);
        });
        setProducts(products);
      }
    }catch(e){console.warn(e);}

    setSubs(all);
    try{if(typeof cloudPush==="function")await cloudPush();}
    catch(e){console.warn(e);}

    var det=document.getElementById("selectedSubmissionDetail");
    if(det){det.classList.add("hidden");det.innerHTML="";}

    if(typeof loadSupervisorData==="function")loadSupervisorData();
    if(typeof runReport==="function"){try{runReport();}catch(e){}}

    alert("1 илгээлт устгагдлаа");
  }

  function wrapDelete(){window.deleteSubmission=deleteSubmissionFixed;}

  function tick(){
    wrapListRenders();
    wrapReports();
    wrapDelete();
  }
  tick();
  setInterval(tick,300);
})();
