/* delete_fix: soft-delete submissions so merge does not restore them */
(function(){
  function subMatch(a,b){
    if(!a||!b)return false;
    if(a.id&&b.id&&a.id===b.id)return true;
    return a.employeeId===b.employeeId&&a.date===b.date&&(a.shift||"")===(b.shift||"");
  }
  function visibleSubs(all){
    return (all||[]).filter(function(s){return s&&!s.deleted;});
  }

  function wrapRender(){
    if(typeof window.renderSubmissionsListEnhanced==="function"){
      var _r=window.renderSubmissionsListEnhanced;
      if(!_r._delWrap){
        window.renderSubmissionsListEnhanced=function(all){
          return _r(visibleSubs(all||(typeof getSubs==="function"?getSubs():[])));
        };
        window.renderSubmissionsListEnhanced._delWrap=true;
      }
    }
    if(typeof window.renderSubmissionsList==="function"&&!window.renderSubmissionsList._delWrap){
      var _rs=window.renderSubmissionsList;
      window.renderSubmissionsList=function(all){
        return _rs(visibleSubs(all||(typeof getSubs==="function"?getSubs():[])));
      };
      window.renderSubmissionsList._delWrap=true;
    }
  }

  async function deleteSubmissionFixed(idx){
    var s=window._sortedSubs&&window._sortedSubs[idx];
    if(!s){alert("Илгээлт олдсонгүй");return;}
    if(s.locked){alert("Түгжигдсэн илгээлтийг устгахын тулд эхлээд түгжээг тайлана уу");return;}
    if(!confirm((s.employeeName||"")+" — "+(s.date||"")+" устгах уу?"))return;
    if(typeof getSubs!=="function"||typeof setSubs!=="function")return;
    var all=getSubs();
    var found=false;
    for(var i=0;i<all.length;i++){
      if(subMatch(all[i],s)){
        all[i].deleted=true;
        all[i].submittedAt=new Date().toISOString();
        found=true;
      }
    }
    if(!found){
      all=all.filter(function(sub){return !subMatch(sub,s);});
    }
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
    try{
      if(typeof cloudPush==="function")await cloudPush();
    }catch(e){console.warn(e);alert("Cloud sync алдаа — локал устгагдсан");}
    var det=document.getElementById("selectedSubmissionDetail");
    if(det){det.classList.add("hidden");det.innerHTML="";}
    if(typeof loadSupervisorData==="function")loadSupervisorData();
    else if(typeof renderSubmissionsList==="function")renderSubmissionsList(getSubs());
    alert("Устгагдлаа");
  }

  function wrapDelete(){
    window.deleteSubmission=deleteSubmissionFixed;
  }

  function wrapOverview(){
    if(typeof window.renderOverview!=="function"||window.renderOverview._del)return;
    var _o=window.renderOverview;
    window.renderOverview=function(all){return _o(visibleSubs(all));};
    window.renderOverview._del=true;
  }

  function tick(){
    wrapRender();wrapDelete();wrapOverview();
  }
  tick();setInterval(tick,300);
})();
