/* temp_save standalone - always works */
(function(){
  function key(){var u=window.currentUser&&currentUser.id||"anon";return "borluulalt_emp_draft_"+u;}
  function collect(){
    var items={};
    var body=document.getElementById("salesBody");
    if(body){
      body.querySelectorAll("input[id^='prev_']").forEach(function(el){
        var pid=el.id.slice(5);
        var n=document.getElementById("next_"+pid);
        var s=document.getElementById("sold_"+pid);
        items[pid]={prev:el.value||"0",next:n?n.value:"0",sold:s?s.value:"0"};
      });
    }
    function v(id){var e=document.getElementById(id);return e?e.value:"";}
    return {
      date:v("formDate"),shift:v("shiftType"),location:v("locationName"),
      checkerName:v("checkerName"),receiverName:v("receiverName"),
      cashAmount:v("cashAmount")||"0",cardTotal:v("cardTotal")||"0",
      cashBalance:v("cashBalance")||"0",posNumber:v("posNumber"),
      items:items,savedAt:Date.now()
    };
  }
  function restore(d){
    if(!d)return;
    function set(id,val){var e=document.getElementById(id);if(e&&val!=null&&val!=="")e.value=val;}
    set("formDate",d.date);set("shiftType",d.shift);
    if(d.location){set("locationName",d.location);if(typeof onLocationChange==="function")onLocationChange();}
    set("checkerName",d.checkerName);
    if(d.receiverName){
      var r=document.getElementById("receiverName");
      if(r){
        var ok=false;for(var i=0;i<r.options.length;i++)if(r.options[i].value===d.receiverName)ok=true;
        if(!ok){var o=document.createElement("option");o.value=d.receiverName;o.textContent=d.receiverName;r.appendChild(o);}
        r.value=d.receiverName;
      }
    }
    set("posNumber",d.posNumber);
    ["cashAmount","cardTotal","cashBalance"].forEach(function(id){
      var e=document.getElementById(id);
      if(e&&d[id]!=null&&(e.value==="0"||e.value===""))e.value=d[id];
    });
    Object.keys(d.items||{}).forEach(function(pid){
      var it=d.items[pid];
      ["prev","next","sold"].forEach(function(k){
        var e=document.getElementById(k+"_"+pid);
        if(e&&it[k]!=null&&(!e.value||e.value==="0"))e.value=it[k];
      });
      if(typeof calcRow==="function")calcRow(Number(pid));
    });
    if(typeof updateRecon==="function")updateRecon();
    window._formDirty=true;
  }
  window.saveTempDraft=function(){
    try{
      var d=collect();
      localStorage.setItem(key(),JSON.stringify(d));
      window._formDirty=true;
      if(typeof showAlert==="function")showAlert("empAlert","Түр хадгаллаа ✓","success");
      else alert("Түр хадгаллаа ✓");
    }catch(e){alert("Алдаа: "+e.message);}
  };
  function autoSave(){
    try{
      var emp=document.getElementById("employeeView");
      if(!emp||emp.classList.contains("hidden"))return;
      var d=collect();
      var has=Object.keys(d.items||{}).some(function(k){
        var it=d.items[k];return Number(it.prev)||Number(it.next)||Number(it.sold);
      });
      if(has||Number(d.cashAmount)||Number(d.cardTotal)||d.location){
        localStorage.setItem(key(),JSON.stringify(d));
        window._formDirty=true;
      }
    }catch(e){}
  }
  function autoLoad(){
    try{
      var emp=document.getElementById("employeeView");
      if(!emp||emp.classList.contains("hidden"))return;
      var raw=localStorage.getItem(key());
      if(!raw)return;
      restore(JSON.parse(raw));
    }catch(e){}
  }
  document.addEventListener("visibilitychange",function(){
    if(document.visibilityState==="hidden")autoSave();
    else setTimeout(autoLoad,150);
  });
  window.addEventListener("pagehide",autoSave);
  function bind(){
    var b=document.getElementById("btnTempSave");
    if(b&&!b._ts){b._ts=1;b.addEventListener("click",function(e){e.preventDefault();saveTempDraft();});}
    if(!document.getElementById("btnTempSave")){
      var emp=document.getElementById("employeeView");
      if(!emp)return;
      var row=emp.querySelector(".no-print");
      if(!row)return;
      var btn=document.createElement("button");
      btn.id="btnTempSave";btn.type="button";btn.className="btn btn-outline";
      btn.textContent="Түр хадгалах";
      btn.onclick=function(e){e.preventDefault();saveTempDraft();};
      row.insertBefore(btn,row.children[1]||null);
    }
  }
  function wrap(){
    if(typeof window.buildSalesTable!=="function"||window.buildSalesTable._ts)return;
    var o=window.buildSalesTable;
    window.buildSalesTable=function(){
      autoSave();
      var r=o.apply(this,arguments);
      setTimeout(autoLoad,60);
      return r;
    };
    window.buildSalesTable._ts=1;
  }
  function wrapSave(){
    if(typeof window.saveSubmission!=="function"||window.saveSubmission._ts)return;
    var o=window.saveSubmission;
    window.saveSubmission=async function(){
      var r=await o.apply(this,arguments);
      try{localStorage.removeItem(key());}catch(e){}
      return r;
    };
    window.saveSubmission._ts=1;
  }
  setInterval(function(){bind();wrap();wrapSave();},400);
  setInterval(autoSave,5000);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);
  else bind();
})();
