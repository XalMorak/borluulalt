/* emp_date: employee form date is today and locked */
(function(){
  if(window._empDate) return; window._empDate=true;

  function today(){
    var d=new Date();
    var m=String(d.getMonth()+1).padStart(2,"0");
    var day=String(d.getDate()).padStart(2,"0");
    return d.getFullYear()+"-"+m+"-"+day;
  }
  function isEmp(){
    var u=window.currentUser||{};
    return u.role!=="supervisor";
  }
  function lock(){
    var el=document.getElementById("formDate");
    if(!el) return;
    if(!isEmp()){
      el.readOnly=false;
      el.disabled=false;
      el.style.pointerEvents="";
      el.style.background="";
      return;
    }
    el.value=today();
    el.readOnly=true;
    el.disabled=true;
    el.style.pointerEvents="none";
    el.style.background="#eef2f7";
    el.title="Огноо автоматаар өнөөдөр";
  }
  if(typeof window.getFormData==="function" && !window.getFormData._empDate){
    var prev=window.getFormData;
    window.getFormData=function(){
      var d=prev.apply(this, arguments)||{};
      if(isEmp()) d.date=today();
      return d;
    };
    window.getFormData._empDate=true;
  }
  setInterval(lock, 1500);
  if(document.readyState==="complete") lock();
  else window.addEventListener("load", lock);
})();
