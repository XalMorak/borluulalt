/* edit_fix: supervisor can unlock and edit submissions */
(function(){
  function findIdx(all, s){
    if(!s||!all)return -1;
    if(s.id){
      for(var i=0;i<all.length;i++) if(all[i]&&all[i].id===s.id) return i;
    }
    if(s.submittedAt){
      for(var i=0;i<all.length;i++){
        var x=all[i]; if(!x)continue;
        if(x.submittedAt===s.submittedAt&&x.employeeId===s.employeeId&&x.date===s.date) return i;
      }
    }
    for(var i=0;i<all.length;i++){
      var x=all[i]; if(!x||x.deleted)continue;
      if(x.employeeId===s.employeeId&&x.date===s.date&&
         (x.shift||"")===(s.shift||"")&&
         (x.location||"")===(s.location||"")&&
         (x.receiverName||x.receiver||"")===(s.receiverName||s.receiver||"")) return i;
    }
    return -1;
  }

  async function toggleLockFixed(idx){
    var s=window._sortedSubs&&window._sortedSubs[idx];
    if(!s){alert("Илгээлт олдсонгүй");return;}
    if(typeof getSubs!=="function"||typeof setSubs!=="function")return;
    var all=getSubs().slice();
    var i=findIdx(all,s);
    if(i<0){alert("Өгөгдөл олдсонгүй");return;}
    all[i]=Object.assign({},all[i],{locked:!all[i].locked,submittedAt:new Date().toISOString()});
    setSubs(all);
    if(window._sortedSubs[idx]) window._sortedSubs[idx].locked=all[i].locked;
    try{if(typeof cloudPush==="function")await cloudPush();}catch(e){console.warn(e);}
    if(typeof showSubmissionDetail==="function")showSubmissionDetail(idx);
    else if(typeof loadSupervisorData==="function")loadSupervisorData();
  }

  function startEditFixed(idx){
    var s=window._sortedSubs&&window._sortedSubs[idx];
    if(!s){alert("Илгээлт олдсонгүй");return;}
    if(s.deleted){alert("Устгасан илгээлт");return;}
    if(s.locked){
      if(!confirm("Энэ илгээлт түгжигдсэн байна.\nТүгжээг тайлж засах уу?"))return;
      s.locked=false;
      if(typeof getSubs==="function"&&typeof setSubs==="function"){
        var all=getSubs().slice();
        var i=findIdx(all,s);
        if(i>=0){
          all[i]=Object.assign({},all[i],{locked:false,submittedAt:new Date().toISOString()});
          setSubs(all);
          if(typeof cloudPush==="function")cloudPush();
        }
      }
    }
    window._editingIdx=idx;
    var items=s.items||[];
    var html='<div class="card" style="margin-top:12px;padding:14px"><h3>Засах: '+(s.employeeName||"")+' — '+(s.date||"")+'</h3>';
    html+='<div class="header-info">';
    html+='<div><label>Огноо</label><input type="date" id="edit_date" value="'+(s.date||"")+'"></div>';
    html+='<div><label>Ээлж</label><input id="edit_shift" value="'+(s.shift||"")+'"></div>';
    html+='<div><label>Байршил</label><input id="edit_location" value="'+(s.location||"")+'"></div>';
    html+='<div><label>Шалгагч</label><input id="edit_checker" value="'+(s.checkerName||"")+'"></div>';
    html+='<div><label>Тек</label><input id="edit_receiver" value="'+(s.receiverName||s.receiver||"")+'"></div>';
    html+='</div>';
    html+='<div class="table-wrap"><table><thead><tr><th>Бараа</th><th>Өмнөх</th><th>Дараах</th><th>Зарсан</th><th>Орлого</th></tr></thead><tbody>';
    items.forEach(function(it,i){
      html+='<tr><td>'+(it.name||"")+'</td>';
      html+='<td><input type="number" id="edit_prev_'+i+'" value="'+(it.prev||0)+'" oninput="editCalc&&editCalc('+i+')"></td>';
      html+='<td><input type="number" id="edit_next_'+i+'" value="'+(it.next||0)+'" oninput="editCalc&&editCalc('+i+')"></td>';
      html+='<td><input type="number" id="edit_sold_'+i+'" value="'+(it.sold||0)+'" oninput="editCalcIncome&&editCalcIncome('+i+')"></td>';
      html+='<td><input type="number" id="edit_income_'+i+'" value="'+(it.income||0)+'"></td></tr>';
    });
    html+='</tbody></table></div>';
    html+='<div class="footer-fields">';
    html+='<div><label>Бэлэн</label><input type="number" id="edit_cash" value="'+(s.cashAmount||0)+'"></div>';
    html+='<div><label>Карт</label><input type="number" id="edit_card" value="'+(s.cardTotal||0)+'"></div>';
    html+='<div><label>Эхлэл дүн</label><input type="number" id="edit_start" value="'+(s.cashBalance||0)+'"></div>';
    html+='</div>';
    html+='<div style="margin-top:12px">';
    html+='<button class="btn btn-success btn-sm" onclick="saveEditSubmission('+idx+')">Хадгалах</button> ';
    html+='<button class="btn btn-secondary btn-sm" onclick="cancelEdit&&cancelEdit()">Болих</button>';
    html+='</div><div id="editAlert"></div></div>';
    var det=document.getElementById("selectedSubmissionDetail");
    if(det){det.classList.remove("hidden");det.style.display="block";det.innerHTML=html;}
  }

  async function saveEditFixed(idx){
    var s=window._sortedSubs&&window._sortedSubs[idx];
    if(!s){alert("Илгээлт олдсонгүй");return;}
    if(typeof getSubs!=="function"||typeof setSubs!=="function")return;
    var all=getSubs().slice();
    var i=findIdx(all,s);
    if(i<0){alert("Өгөгдөл олдсонгүй");return;}

    var items=(s.items||[]).map(function(it,j){
      return Object.assign({},it,{
        prev:Number((document.getElementById("edit_prev_"+j)||{}).value)||0,
        next:Number((document.getElementById("edit_next_"+j)||{}).value)||0,
        sold:Number((document.getElementById("edit_sold_"+j)||{}).value)||0,
        income:Number((document.getElementById("edit_income_"+j)||{}).value)||0
      });
    });
    var calcTotal=items.reduce(function(a,it){return a+(it.income||0);},0);
    var cash=Number((document.getElementById("edit_cash")||{}).value)||0;
    var card=Number((document.getElementById("edit_card")||{}).value)||0;
    var start=Number((document.getElementById("edit_start")||{}).value)||0;
    var collected=Math.max(0,cash-start)+card;
    var updated=Object.assign({},all[i],{
      date:(document.getElementById("edit_date")||{}).value||s.date,
      shift:(document.getElementById("edit_shift")||{}).value||s.shift,
      location:(document.getElementById("edit_location")||{}).value||s.location,
      checkerName:(document.getElementById("edit_checker")||{}).value||"",
      receiverName:(document.getElementById("edit_receiver")||{}).value||"",
      items:items,
      cashAmount:cash,
      cardTotal:card,
      cashBalance:start,
      calcTotal:calcTotal,
      collected:collected,
      diff:collected-calcTotal,
      locked:false,
      submittedAt:new Date().toISOString()
    });
    all[i]=updated;
    setSubs(all);
    if(window._sortedSubs) window._sortedSubs[idx]=updated;
    try{if(typeof cloudPush==="function")await cloudPush();}catch(e){console.warn(e);}
    alert("Хадгаллаа ✓");
    if(typeof showSubmissionDetail==="function")showSubmissionDetail(idx);
    else if(typeof loadSupervisorData==="function")loadSupervisorData();
  }

  function tick(){
    window.toggleLock=toggleLockFixed;
    window.startEditSubmission=startEditFixed;
    window.saveEditSubmission=saveEditFixed;
  }
  tick();
  setInterval(tick,300);
})();
