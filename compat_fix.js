function escapeHtml(s){
  return String(s==null?"":s).replace(/[&<>"']/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
  });
}
function showAlert(id,msg,type){
  var el=document.getElementById(id);
  if(!el)return;
  el.textContent="";
  var d=document.createElement("div");
  d.className="alert alert-"+type;
  d.textContent=msg;
  el.appendChild(d);
  if(type==="success")setTimeout(function(){ if(el.contains(d)) el.removeChild(d); },4000);
}
function updateLoginHint(){
  var el=document.getElementById("loginHint");
  if(el) el.textContent="ID болон PIN-ээ оруулна уу";
}
(function(){
  if(window._compatSave) return;
  window._compatSave=true;
  function locOf(s){ return String((s&&s.location)||"").trim(); }
  function wrap(){
    if(typeof window.saveSubmission!=="function"||window._compatSaveWrapped) return;
    window._compatSaveWrapped=true;
    var orig=window.saveSubmission;
    window.saveSubmission=async function(){
      window._formDirty=false;
      if(typeof getFormData!=="function") return orig.apply(this,arguments);
      var data=getFormData();
      if(!data.date){ showAlert("empAlert","Огноо сонгоно уу","error"); return; }
      if(!data.id) data.id="sub_"+Date.now()+"_"+Math.random().toString(36).slice(2,8);
      var all=getSubs();
      var existingIdx=all.findIndex(function(s){
        return s.employeeId===data.employeeId && s.date===data.date && s.shift===data.shift && locOf(s)===locOf(data);
      });
      if(existingIdx>=0){
        if(all[existingIdx].locked){ showAlert("empAlert","Энэ ээлж түгжигдсэн","error"); return; }
        data.id=all[existingIdx].id||data.id;
        all[existingIdx]=data;
      } else all.push(data);
      setSubs(all);
      addLog("submit",data.date+" "+data.shift+" "+locOf(data));
      await cloudPush();
      showAlert("empAlert","Амжилттай хадгаллаа ✓","success");
    };
  }
  wrap();
})();
