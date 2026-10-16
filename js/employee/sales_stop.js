/* sales_stop: employee sales page is closed. Past data stays. */
(function(){
  if(window._salesStop) return; window._salesStop=true;
  window._salesStopped=true;

  function notice(){
    var ev=document.getElementById("employeeView");
    if(!ev) return;
    var box=document.getElementById("salesStopBox");
    if(!box){
      box=document.createElement("div");
      box.id="salesStopBox";
      box.style.cssText="margin:16px 0;padding:18px;border-radius:12px;background:#3b1d1d;color:#f6efe3;border:1px solid #8b3a3a;font-size:16px;line-height:1.45";
      box.innerHTML="<strong>Борлуулалтын хуудас зогссон.</strong><br>Шинэ илгээлт хадгалах, түр хадгалах боломжгүй. Ахлах болон нягтлан хуучин илгээлтээ харж болно.";
      ev.insertBefore(box, ev.firstChild);
    }
    ["salesBody","saveBtn","tempSaveBtn"].forEach(function(id){
      var el=document.getElementById(id);
      if(el) el.style.display="none";
    });
    ev.querySelectorAll("button, input, select, textarea").forEach(function(el){
      if(el.id==="logoutBtn" || el.closest("#userBar") || el.closest(".user-bar")) return;
      if(el.closest("#salesStopBox")) return;
      el.disabled=true;
      el.style.pointerEvents="none";
      el.style.opacity="0.45";
    });
    var save=document.querySelector("#employeeView .btn-success, #employeeView button[onclick*='saveSubmission']");
    if(save) save.style.display="none";
  }

  window.saveSubmission=async function(){
    if(typeof showAlert==="function") showAlert("empAlert","Борлуулалт зогссон. Илгээх боломжгүй.","error");
    else alert("Борлуулалт зогссон. Илгээх боломжгүй.");
    return false;
  };
  window.saveSubmission._salesStop=true;

  if(typeof window.tempSave==="function"){
    window.tempSave=function(){
      if(typeof showAlert==="function") showAlert("empAlert","Борлуулалт зогссон.","error");
      return false;
    };
  }

  if(typeof window.showApp==="function" && !window.showApp._salesStop){
    var prev=window.showApp;
    window.showApp=function(){
      var r=prev.apply(this, arguments);
      var u=window.currentUser||{};
      if(u.role==="employee") setTimeout(notice, 50);
      return r;
    };
    window.showApp._salesStop=true;
  }

  setInterval(function(){
    var u=window.currentUser||{};
    if(u.role==="employee") notice();
    if(typeof window.saveSubmission==="function" && !window.saveSubmission._salesStop){
      window.saveSubmission=async function(){
        if(typeof showAlert==="function") showAlert("empAlert","Борлуулалт зогссон. Илгээх боломжгүй.","error");
        return false;
      };
      window.saveSubmission._salesStop=true;
    }
  }, 1200);
})();
