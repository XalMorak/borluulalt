/* edit_income: prev/next change updates sold + income; totals; no data wipe */
(function(){
  if(window._editIncome) window._editIncome = true;
  window._editIncome = true;

  function isSup(){
    var u=window.currentUser||{};
    return u.role==="supervisor" || window._editingIdx!=null;
  }
  function num(v){ var n=Number(v); return isFinite(n)?n:0; }

  function priceOf(id){
    if(typeof getProduct==="function"){
      var p=getProduct(Number(id)||id);
      if(p && p.price) return num(p.price);
    }
    if(typeof getWines==="function"){
      var arr=getWines()||[];
      for(var i=0;i<arr.length;i++) if(String(arr[i].id)===String(id)) return num(arr[i].price);
    }
    var cell=document.querySelector("#salesBody tr td.price-col");
    var row=document.getElementById("prev_"+id);
    if(row){
      row=row.closest("tr");
      if(row){
        var tds=row.querySelectorAll("td");
        for(var j=0;j<tds.length;j++){
          if(tds[j].classList.contains("price-col")) return num(String(tds[j].textContent).replace(/[^\d.-]/g,""));
        }
      }
    }
    return 0;
  }

  function unlockIncome(){
    var nodes=document.querySelectorAll("input[id^='income_'],input[id^='edit_income_']");
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      if(!isSup() && el.id.indexOf("edit_income_")!==0) continue;
      el.readOnly=false;
      el.removeAttribute("readonly");
      el.style.pointerEvents="auto";
      el.style.background="#fff";
    }
  }

  function cascadeEmp(id){
    var prev=document.getElementById("prev_"+id);
    var next=document.getElementById("next_"+id);
    var sold=document.getElementById("sold_"+id);
    var inc=document.getElementById("income_"+id);
    if(!prev||!next||!sold) return;
    var a=num(prev.value), b=num(next.value);
    sold.value=Math.max(0, a-b);
    if(inc){
      var pr=priceOf(id);
      inc.value=Math.round(num(sold.value)*pr);
      inc.dataset.manual="";
    }
    paintTotals();
  }

  function cascadeEdit(i){
    var prev=document.getElementById("edit_prev_"+i);
    var next=document.getElementById("edit_next_"+i);
    var sold=document.getElementById("edit_sold_"+i);
    var inc=document.getElementById("edit_income_"+i);
    if(!prev||!next||!sold) return;
    var a=num(prev.value), b=num(next.value);
    sold.value=Math.max(0, a-b);
    if(inc){
      var price=num(inc.dataset.price);
      if(!price){
        var nameCell=sold.closest("tr") && sold.closest("tr").cells[0];
        var name=nameCell?nameCell.textContent.trim():"";
        if(typeof getProducts==="function"){
          (getProducts()||[]).forEach(function(p){ if(p && p.name===name) price=num(p.price); });
        }
        if(!price && typeof getWines==="function"){
          (getWines()||[]).forEach(function(p){ if(p && p.name===name) price=num(p.price); });
        }
        if(price) inc.dataset.price=String(price);
      }
      inc.value=Math.round(num(sold.value)*price);
      inc.dataset.manual="";
    }
    paintTotals();
  }

  window.editCalc=function(i){ cascadeEdit(i); };
  window.editCalcIncome=function(i){
    var sold=document.getElementById("edit_sold_"+i);
    var inc=document.getElementById("edit_income_"+i);
    if(sold && inc && inc.dataset.manual!=="1"){
      var price=num(inc.dataset.price);
      if(price) inc.value=Math.round(num(sold.value)*price);
    }
    paintTotals();
  };

  function bindEmp(){
    document.querySelectorAll("#salesBody input[id^='prev_'],#salesBody input[id^='next_']").forEach(function(el){
      if(el._rowBound) return;
      el._rowBound=true;
      el.addEventListener("input", function(){
        var m=String(this.id).match(/_(\d+)$/);
        if(m) cascadeEmp(m[1]);
      });
      el.addEventListener("change", function(){
        var m=String(this.id).match(/_(\d+)$/);
        if(m) cascadeEmp(m[1]);
      });
    });
    document.querySelectorAll("#salesBody input[id^='sold_']").forEach(function(el){
      if(el._rowBound) return;
      el._rowBound=true;
      el.addEventListener("input", function(){
        var m=String(this.id).match(/_(\d+)$/);
        if(!m) return;
        var inc=document.getElementById("income_"+m[1]);
        if(inc){
          inc.value=Math.round(num(this.value)*priceOf(m[1]));
          inc.dataset.manual="";
        }
        paintTotals();
      });
    });
  }

  function bindEdit(){
    var i=0;
    while(document.getElementById("edit_prev_"+i) || document.getElementById("edit_sold_"+i)){
      ["edit_prev_","edit_next_"].forEach(function(pre){
        var el=document.getElementById(pre+i);
        if(!el || el._rowBound) return;
        el._rowBound=true;
        (function(idx){
          el.addEventListener("input", function(){ cascadeEdit(idx); });
          el.addEventListener("change", function(){ cascadeEdit(idx); });
        })(i);
      });
      var sold=document.getElementById("edit_sold_"+i);
      if(sold && !sold._rowBound){
        sold._rowBound=true;
        (function(idx){
          sold.addEventListener("input", function(){ if(window.editCalcIncome) window.editCalcIncome(idx); });
        })(i);
      }
      i++;
    }
  }

  function paintEditTotals(){
    var cash=document.getElementById("edit_cash");
    if(!cash) return;
    var box=document.getElementById("editTotalsBox");
    if(!box){
      box=document.createElement("div");
      box.id="editTotalsBox";
      box.className="summary-box";
      box.style.marginTop="12px";
      var host=cash.closest(".footer-fields");
      if(host && host.parentNode) host.parentNode.insertBefore(box, host.nextSibling);
      else (document.getElementById("selectedSubmissionDetail")||cash.parentNode).appendChild(box);
    }
    var sum=0, i=0;
    while(document.getElementById("edit_income_"+i) || document.getElementById("edit_sold_"+i)){
      sum+=num((document.getElementById("edit_income_"+i)||{}).value);
      i++;
    }
    var collected=Math.max(0,num((document.getElementById("edit_cash")||{}).value)-num((document.getElementById("edit_start")||{}).value))+num((document.getElementById("edit_card")||{}).value);
    var diff=collected-sum;
    var cls=Math.abs(diff)<0.01?"diff-ok":(diff>0?"diff-over":"diff-short");
    box.innerHTML=
      '<div class="summary-item"><div class="label">Бодолт орлого</div><div class="value">'+sum.toLocaleString()+'₮</div></div>'+
      '<div class="summary-item"><div class="label">Цуглуулсан</div><div class="value">'+collected.toLocaleString()+'₮</div></div>'+
      '<div class="summary-item"><div class="label">Зөрүү</div><div class="value '+cls+'">'+(diff>=0?"+":"")+diff.toLocaleString()+'₮</div></div>';
  }

  function paintEmpTotals(){
    var host=document.getElementById("employeeView");
    if(!host || host.classList.contains("hidden")) return;
    if(typeof updateRecon==="function"){ try{ updateRecon(); }catch(e){} }
    var box=document.getElementById("empTotalsBox");
    if(!box){
      box=document.createElement("div");
      box.id="empTotalsBox";
      box.className="summary-box";
      box.style.margin="12px 0";
      var cash=document.getElementById("cashAmount");
      var parent=cash && (cash.closest(".footer-fields")||cash.parentNode);
      if(parent && parent.parentNode) parent.parentNode.insertBefore(box, parent.nextSibling);
      else host.appendChild(box);
    }
    var sum=0;
    document.querySelectorAll("#salesBody input[id^='income_']").forEach(function(el){ sum+=num(el.value); });
    var collected=Math.max(0,num((document.getElementById("cashAmount")||{}).value)-num((document.getElementById("cashBalance")||{}).value))+num((document.getElementById("cardTotal")||{}).value);
    var diff=collected-sum;
    var cls=Math.abs(diff)<0.01?"diff-ok":(diff>0?"diff-over":"diff-short");
    box.innerHTML=
      '<div class="summary-item"><div class="label">Бодолт орлого</div><div class="value">'+sum.toLocaleString()+'₮</div></div>'+
      '<div class="summary-item"><div class="label">Бэлэн+карт</div><div class="value">'+collected.toLocaleString()+'₮</div></div>'+
      '<div class="summary-item"><div class="label">Зөрүү</div><div class="value '+cls+'">'+(diff>=0?"+":"")+diff.toLocaleString()+'₮</div></div>';
  }

  function paintTotals(){ paintEditTotals(); paintEmpTotals(); }

  if(typeof window.calcRow==="function" && !window.calcRow._cascade){
    window.calcRow=function(id){ cascadeEmp(id); };
    window.calcRow._cascade=true;
  }
  if(typeof window.calcIncome==="function" && !window.calcIncome._cascade){
    var _ci=window.calcIncome;
    window.calcIncome=function(id){
      var sold=document.getElementById("sold_"+id);
      var inc=document.getElementById("income_"+id);
      if(sold && inc){
        inc.value=Math.round(num(sold.value)*priceOf(id));
        if(isSup()){ inc.readOnly=false; inc.style.pointerEvents="auto"; inc.style.background="#fff"; }
      } else {
        try{ _ci.apply(this, arguments); }catch(e){}
      }
      paintTotals();
    };
    window.calcIncome._cascade=true;
  }

  var _start=window.startEditSubmission;
  if(typeof _start==="function" && !_start._cascade){
    window.startEditSubmission=function(){
      var r=_start.apply(this, arguments);
      setTimeout(function(){ bindEdit(); unlockIncome(); paintEditTotals(); }, 40);
      return r;
    };
    window.startEditSubmission._cascade=true;
  }

  document.addEventListener("input", function(ev){
    var id=ev.target && ev.target.id || "";
    if(id==="cashAmount"||id==="cardTotal"||id==="cashBalance"||id==="edit_cash"||id==="edit_card"||id==="edit_start") paintTotals();
  });

  setInterval(function(){
    if(document.hidden) return;
    bindEmp();
    bindEdit();
    unlockIncome();
  }, 2000);

  if(document.readyState==="complete"){ bindEmp(); bindEdit(); }
  else window.addEventListener("load", function(){ bindEmp(); bindEdit(); });
})();
