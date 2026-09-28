/* edit_income: supervisor can edit income; show totals; less freeze. Does not wipe submissions. */
(function(){
  if(window._editIncome) return; window._editIncome=true;

  function isSup(){
    var u=window.currentUser||{};
    return u.role==="supervisor" || window._editingIdx!=null;
  }
  function num(v){ var n=Number(v); return isFinite(n)?n:0; }

  function unlockIncome(){
    var nodes=document.querySelectorAll("input[id^='income_'],input[id^='edit_income_']");
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      if(!isSup() && el.id.indexOf("edit_income_")!==0) continue;
      el.readOnly=false;
      el.removeAttribute("readonly");
      el.style.pointerEvents="auto";
      el.style.background="#fff";
      if(!el._incBound){
        el._incBound=true;
        el.addEventListener("input", function(){
          this.dataset.manual="1";
          paintTotals();
        });
      }
    }
  }

  function rowIncome(i){
    var el=document.getElementById("edit_income_"+i);
    return el?num(el.value):0;
  }
  function paintEditTotals(){
    var box=document.getElementById("editTotalsBox");
    if(!box){
      var cash=document.getElementById("edit_cash");
      if(!cash) return;
      box=document.createElement("div");
      box.id="editTotalsBox";
      box.className="summary-box";
      box.style.marginTop="12px";
      cash.closest(".footer-fields") && cash.closest(".footer-fields").parentNode.insertBefore(box, cash.closest(".footer-fields").nextSibling);
      if(!document.getElementById("editTotalsBox")){
        var host=document.getElementById("selectedSubmissionDetail")||cash.parentNode.parentNode;
        host.appendChild(box);
      }
    }
    var sum=0, i=0;
    while(document.getElementById("edit_income_"+i) || document.getElementById("edit_sold_"+i)){
      sum+=rowIncome(i);
      i++;
    }
    var cash=num((document.getElementById("edit_cash")||{}).value);
    var card=num((document.getElementById("edit_card")||{}).value);
    var start=num((document.getElementById("edit_start")||{}).value);
    var collected=Math.max(0,cash-start)+card;
    var diff=collected-sum;
    var cls=Math.abs(diff)<0.01?"diff-ok":(diff>0?"diff-over":"diff-short");
    box.innerHTML=
      '<div class="summary-item"><div class="label">Бодолт орлого</div><div class="value">'+sum.toLocaleString()+'₮</div></div>'+
      '<div class="summary-item"><div class="label">Цуглуулсан</div><div class="value">'+collected.toLocaleString()+'₮</div></div>'+
      '<div class="summary-item"><div class="label">Зөрүү</div><div class="value '+cls+'">'+(diff>=0?"+":"")+diff.toLocaleString()+'₮</div></div>';
  }

  function paintEmpTotals(){
    if(typeof updateRecon==="function"){
      try{ updateRecon(); }catch(e){}
    }
    var host=document.getElementById("employeeView");
    if(!host || host.classList.contains("hidden")) return;
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
    var cash=num((document.getElementById("cashAmount")||{}).value);
    var card=num((document.getElementById("cardTotal")||{}).value);
    var start=num((document.getElementById("cashBalance")||{}).value);
    var collected=Math.max(0,cash-start)+card;
    var diff=collected-sum;
    var cls=Math.abs(diff)<0.01?"diff-ok":(diff>0?"diff-over":"diff-short");
    box.innerHTML=
      '<div class="summary-item"><div class="label">Бодолт орлого</div><div class="value">'+sum.toLocaleString()+'₮</div></div>'+
      '<div class="summary-item"><div class="label">Бэлэн+карт</div><div class="value">'+collected.toLocaleString()+'₮</div></div>'+
      '<div class="summary-item"><div class="label">Зөрүү</div><div class="value '+cls+'">'+(diff>=0?"+":"")+diff.toLocaleString()+'₮</div></div>';
  }

  function paintTotals(){
    paintEditTotals();
    paintEmpTotals();
  }

  window.editCalc=function(i){
    var p=document.getElementById("edit_prev_"+i);
    var n=document.getElementById("edit_next_"+i);
    var s=document.getElementById("edit_sold_"+i);
    var inc=document.getElementById("edit_income_"+i);
    if(p && n && s && document.activeElement!==s){
      var a=num(p.value), b=num(n.value);
      if(a>0||b>0) s.value=Math.max(0,a-b);
    }
    if(inc && inc.dataset.manual!=="1" && s){
      var price=0;
      var row=s.closest("tr");
      if(row && row.cells && row.cells.length){
        /* keep existing income if already set */
      }
    }
    paintEditTotals();
  };
  window.editCalcIncome=function(i){
    var s=document.getElementById("edit_sold_"+i);
    var inc=document.getElementById("edit_income_"+i);
    if(s && inc && inc.dataset.manual!=="1"){
      /* do not force overwrite when supervisor is typing income */
    }
    paintEditTotals();
  };

  if(typeof window.calcIncome==="function" && !window.calcIncome._unlock){
    var _ci=window.calcIncome;
    window.calcIncome=function(id){
      var r=_ci.apply(this, arguments);
      var inc=document.getElementById("income_"+id);
      if(inc && isSup()){
        inc.readOnly=false;
        inc.style.pointerEvents="auto";
        inc.style.background="#fff";
      }
      paintTotals();
      return r;
    };
    window.calcIncome._unlock=true;
  }

  ["edit_cash","edit_card","edit_start","cashAmount","cardTotal","cashBalance"].forEach(function(id){
    document.addEventListener("input", function(ev){
      if(ev.target && ev.target.id===id) paintTotals();
    });
  });

  var _start=window.startEditSubmission;
  if(typeof _start==="function" && !_start._tot){
    window.startEditSubmission=function(){
      var r=_start.apply(this, arguments);
      setTimeout(function(){
        unlockIncome();
        ["edit_cash","edit_card","edit_start"].forEach(function(id){
          var el=document.getElementById(id);
          if(el && !el._totBound){ el._totBound=true; el.addEventListener("input", paintEditTotals); }
        });
        var n=0;
        while(document.getElementById("edit_income_"+n)){
          (function(i){
            var el=document.getElementById("edit_income_"+i);
            if(el && !el._totBound){ el._totBound=true; el.addEventListener("input", function(){ el.dataset.manual="1"; paintEditTotals(); }); }
            ["edit_prev_","edit_next_","edit_sold_"].forEach(function(pre){
              var x=document.getElementById(pre+i);
              if(x && !x._totBound){ x._totBound=true; x.addEventListener("input", function(){ if(window.editCalc) window.editCalc(i); }); }
            });
          })(n);
          n++;
        }
        paintEditTotals();
      }, 30);
      return r;
    };
    window.startEditSubmission._tot=true;
  }

  /* cut freeze: live_fix recalcAll every 1.5s locks income and janks the page */
  if(window._liveFixTimer) try{ clearInterval(window._liveFixTimer); }catch(e){}
  var last=0;
  setInterval(function(){
    var now=Date.now();
    if(now-last<2500) return;
    last=now;
    unlockIncome();
    if(document.hidden) return;
    paintTotals();
  }, 2500);

  if(document.readyState==="complete"){ unlockIncome(); paintTotals(); }
  else window.addEventListener("load", function(){ unlockIncome(); paintTotals(); });
})();
