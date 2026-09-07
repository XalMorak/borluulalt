/* draft_btn: employee temporary save button */
(function(){
  var DRAFT_KEY="borluulalt_emp_draft";

  function draftKey(){
    var uid=(window.currentUser&&currentUser.id)||"anon";
    return DRAFT_KEY+"_"+uid;
  }

  function todayISO(){
    var t=new Date();
    return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0");
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
    var dateEl=document.getElementById("formDate");
    return {
      date:(dateEl&&dateEl.value)||todayISO(),
      shift:(document.getElementById("shiftType")||{}).value||"",
      location:(document.getElementById("locationName")||{}).value||"",
      checkerName:(document.getElementById("checkerName")||{}).value||"",
      receiverName:(document.getElementById("receiverName")||{}).value||"",
      cashAmount:(document.getElementById("cashAmount")||{}).value||"0",
      cardTotal:(document.getElementById("cardTotal")||{}).value||"0",
      cashBalance:(document.getElementById("cashBalance")||{}).value||"0",
      posNumber:(document.getElementById("posNumber")||{}).value||"",
      items:items,
      savedAt:Date.now(),
      temp:true
    };
  }

  function saveTempDraft(){
    if(!window.currentUser||currentUser.role!=="employee"){
      alert("Зөвхөн ажилтан түр хадгална");
      return;
    }
    try{
      var d=collectDraft();
      if(!d){alert("Хадгалах өгөгдөл олдсонгүй");return;}
      localStorage.setItem(draftKey(), JSON.stringify(d));
      window._formDirty=true;
      if(typeof showAlert==="function"){
        showAlert("empAlert","Түр хадгаллаа ✓ (энэ төхөөрөмж дээр)","success");
      }else{
        alert("Түр хадгаллаа ✓");
      }
    }catch(e){
      console.warn(e);
      alert("Түр хадгалах алдаа");
    }
  }

  window.saveTempDraft=saveTempDraft;

  function ensureBtn(){
    var emp=document.getElementById("employeeView");
    if(!emp)return;
    if(document.getElementById("btnTempSave"))return;
    var btns=emp.querySelector(".no-print");
    if(!btns){
      var recon=emp.querySelector(".recon-box");
      if(!recon)return;
      btns=document.createElement("div");
      btns.className="no-print";
      btns.style.cssText="margin-top:14px;text-align:center";
      recon.parentNode.insertBefore(btns, recon.nextSibling);
    }
    var b=document.createElement("button");
    b.id="btnTempSave";
    b.type="button";
    b.className="btn btn-outline";
    b.textContent="Түр хадгалах";
    b.onclick=function(){saveTempDraft();};
    var clearBtn=null;
    btns.querySelectorAll("button").forEach(function(x){
      if((x.textContent||"").indexOf("Цэвэрлэх")>=0)clearBtn=x;
    });
    if(clearBtn)btns.insertBefore(b, clearBtn);
    else{
      var saveBtn=null;
      btns.querySelectorAll("button").forEach(function(x){
        if((x.getAttribute("onclick")||"").indexOf("saveSubmission")>=0)saveBtn=x;
      });
      if(saveBtn&&saveBtn.nextSibling)btns.insertBefore(b, saveBtn.nextSibling);
      else btns.appendChild(b);
    }
  }

  function tick(){ensureBtn();}
  tick();
  setInterval(tick,500);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",tick);
})();
