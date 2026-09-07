/* form_persist: keep employee inputs across refresh; report one-day */
(function(){
  var DRAFT_KEY="borluulalt_emp_draft";

  function draftKey(){
    var uid=(window.currentUser&&currentUser.id)||"anon";
    var d=(document.getElementById("formDate")||{}).value||"";
    return DRAFT_KEY+"_"+uid+"_"+d;
  }

  function collectDraft(){
    if(!window.currentUser||currentUser.role!=="employee")return null;
    var items={};
    if(typeof getActiveProducts==="function"){
      getActiveProducts().forEach(function(p){
        var prev=document.getElementById("prev_"+p.id);
        var next=document.getElementById("next_"+p.id);
        var sold=document.getElementById("sold_"+p.id);
        if(!prev&&!next&&!sold)return;
        items[p.id]={
          prev:prev?prev.value:"0",
          next:next?next.value:"0",
          sold:sold?sold.value:"0"
        };
      });
    }
    return {
      date:(document.getElementById("formDate")||{}).value||"",
      shift:(document.getElementById("shiftType")||{}).value||"",
      location:(document.getElementById("locationName")||{}).value||"",
      checkerName:(document.getElementById("checkerName")||{}).value||"",
      receiverName:(document.getElementById("receiverName")||{}).value||"",
      cashAmount:(document.getElementById("cashAmount")||{}).value||"0",
      cardTotal:(document.getElementById("cardTotal")||{}).value||"0",
      cashBalance:(document.getElementById("cashBalance")||{}).value||"0",
      posNumber:(document.getElementById("posNumber")||{}).value||"",
      items:items,
      savedAt:Date.now()
    };
  }

  function saveDraft(){
    try{
      var d=collectDraft();
      if(!d)return;
      var has=false;
      Object.keys(d.items||{}).forEach(function(k){
        var it=d.items[k];
        if(Number(it.prev)||Number(it.next)||Number(it.sold))has=true;
      });
      if(Number(d.cashAmount)||Number(d.cardTotal)||Number(d.cashBalance)||d.checkerName||d.receiverName||d.location)has=true;
      if(!has)return;
      localStorage.setItem(draftKey(), JSON.stringify(d));
      window._formDirty=true;
    }catch(e){}
  }

  function loadDraft(){
    try{
      if(!window.currentUser||currentUser.role!=="employee")return;
      var raw=localStorage.getItem(draftKey());
      if(!raw)return;
      var d=JSON.parse(raw);
      if(!d||!d.items)return;
      if(d.shift){var s=document.getElementById("shiftType");if(s)s.value=d.shift;}
      if(d.location){
        var loc=document.getElementById("locationName");
        if(loc){loc.value=d.location;if(typeof onLocationChange==="function")onLocationChange();}
      }
      if(d.checkerName){var c=document.getElementById("checkerName");if(c&&!c.value)c.value=d.checkerName;}
      if(d.receiverName){var r=document.getElementById("receiverName");if(r)r.value=d.receiverName;}
      if(d.posNumber){var p=document.getElementById("posNumber");if(p&&!p.value)p.value=d.posNumber;}
      ["cashAmount","cardTotal","cashBalance"].forEach(function(id){
        var el=document.getElementById(id);
        if(el&&d[id]!=null&&(el.value==="0"||el.value===""))el.value=d[id];
      });
      Object.keys(d.items).forEach(function(pid){
        var it=d.items[pid];
        ["prev","next","sold"].forEach(function(k){
          var el=document.getElementById(k+"_"+pid);
          if(el&&it[k]!=null){
            if(!el.value||el.value==="0")el.value=it[k];
          }
        });
        if(typeof calcRow==="function")calcRow(Number(pid));
      });
      if(typeof updateRecon==="function")updateRecon();
      window._formDirty=true;
    }catch(e){console.warn("draft load",e);}
  }

  function clearDraft(){
    try{localStorage.removeItem(draftKey());}catch(e){}
    window._formDirty=false;
  }

  function wrapBuild(){
    if(typeof window.buildSalesTable!=="function"||window.buildSalesTable._draft)return;
    var _b=window.buildSalesTable;
    window.buildSalesTable=function(){
      saveDraft();
      var r=_b.apply(this,arguments);
      setTimeout(function(){loadDraft();bindDraftEvents();},30);
      return r;
    };
    window.buildSalesTable._draft=true;
  }

  function wrapSave(){
    if(typeof window.saveSubmission!=="function"||window.saveSubmission._draft)return;
    var _s=window.saveSubmission;
    window.saveSubmission=async function(){
      var r=await _s.apply(this,arguments);
      clearDraft();
      return r;
    };
    window.saveSubmission._draft=true;
  }

  function bindDraftEvents(){
    var root=document.getElementById("employeeView");
    if(!root||root._draftBound)return;
    root._draftBound=true;
    root.addEventListener("input",function(){saveDraft();},{passive:true});
    root.addEventListener("change",function(){saveDraft();},{passive:true});
  }

  document.addEventListener("visibilitychange",function(){
    if(document.visibilityState==="hidden")saveDraft();
    if(document.visibilityState==="visible")setTimeout(loadDraft,100);
  });
  window.addEventListener("pagehide",saveDraft);
  window.addEventListener("beforeunload",saveDraft);

  function ensureReportDayUI(){
    var area=document.querySelector("#tabReports .period-btns");
    if(!area||area._dayBtn)return;
    area._dayBtn=true;
    var b=document.createElement("button");
    b.className="btn btn-sm";
    b.textContent="Өнөөдөр";
    b.onclick=function(){
      var t=new Date();
      var iso=t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0");
      var f=document.getElementById("reportFrom");
      var to=document.getElementById("reportTo");
      if(f)f.value=iso;
      if(to)to.value=iso;
      if(typeof runReport==="function")runReport();
      if(typeof showChart==="function")showChart(1);
    };
    area.insertBefore(b, area.firstChild);

    if(typeof window.showChart==="function"&&!window.showChart._day){
      var _sc=window.showChart;
      window.showChart=function(days){
        days=Number(days)||7;
        if(days<1)days=1;
        return _sc.apply(this,arguments);
      };
      window.showChart._day=true;
    }
  }

  function wrapReport(){
    if(typeof window.runReport!=="function"||window.runReport._day)return;
    var _rr=window.runReport;
    window.runReport=function(){
      var r=_rr.apply(this,arguments);
      var f=(document.getElementById("reportFrom")||{}).value||"";
      var t=(document.getElementById("reportTo")||{}).value||"";
      var title=document.getElementById("chartTitle");
      if(title&&f&&t&&f===t)title.textContent="Тайлан: "+f+" (1 өдөр)";
      return r;
    };
    window.runReport._day=true;
  }

  function tick(){
    wrapBuild();
    wrapSave();
    bindDraftEvents();
    ensureReportDayUI();
    wrapReport();
  }
  tick();
  setInterval(tick,400);
  setInterval(function(){
    if(window.currentUser&&currentUser.role==="employee"){
      var el=document.getElementById("prev_1")||document.querySelector("#salesBody input");
      if(el&&(el.value==="0"||el.value===""))loadDraft();
    }
  },1500);
})();
