/* submissions.js — supervisor: lock / edit / delete one submission.
   One definition each, installed once (was: edit_fix.js pinning its versions every 300 ms while
   guard.js, visible_subs.js, dedupe_edit.js, edit_clear.js, edit_select.js and edit_income.js wrapped or
   replaced them on their own timers, so which version ran on a click was random — e.g. guard's
   save used a different cash formula).
   saveEdit = the edit_fix save + the edit_clear follow-up (keep the id, editedAt, one inbox row,
   bump _meta/inbox); delete = sync_stable's sticky delete (tombstone). */
(function(){
  if(window._submissionsJs) return; window._submissionsJs=true;

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

  async function saveEditBase(idx){
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


  function sid(s) {
    if (!s) return "";
    var tek = String((s.receiverName || s.tek || s.receiver) || "").trim();
    var kind = s.kind === "wine" || s.sheet === "wine" ? "wine" : "bar";
    return ["s", s.employeeId || "", s.date || "", s.shift || "", s.location || "", tek, kind].join("_").replace(/[.#$\[\]\/]/g, "_");
  }
  function realDb(){
    try{ if(typeof window._realDb==="function" && window._realDb()) return window._realDb(); }catch(e){}
    try{ if(typeof initFirebase==="function") initFirebase(); }catch(e2){}
    return window._fbDb||null;
  }

  /* after the base save: same id, editedAt, one inbox row for it (no duplicate on other devices) */
  async function saveEdit(idx){
    var before=(window._sortedSubs && window._sortedSubs[idx]) || null;
    var oldId=before && before.id, oldKey=sid(before);
    var r=await saveEditBase(idx);
    var after=(window._sortedSubs && window._sortedSubs[idx]) || null;
    if(!after) return r;
    var keep=oldId || oldKey || after.id || sid(after);
    after.id=keep;
    after.editedAt=new Date().toISOString();
    var all=(typeof getSubs==="function"?getSubs():[]).filter(function(s){
      if(!s) return false;
      if(keep && s.id===keep) return false;
      if(oldKey && (s.id===oldKey || sid(s)===oldKey)) return false;
      if(sid(s)===sid(after)) return false;
      return true;
    });
    all.push(after);
    if(typeof setSubs==="function") setSubs(all);
    if(window._sortedSubs) window._sortedSubs[idx]=after;
    try{
      var base=realDb();
      if(base){
        await base.ref("borluulalt/inbox/"+keep).set(after);
        if(oldKey && oldKey!==keep) await base.ref("borluulalt/inbox/"+oldKey).remove();
        await base.ref("borluulalt/_meta/inbox").set(Date.now()+"-edit");
      }
    }catch(e){}
    if(typeof loadSupervisorData==="function") loadSupervisorData();
    return r;
  }

  function startEdit(idx){
    var r=startEditFixed(idx);
    /* location / tek / shift as dropdowns, and the income cascade on the edit form */
    if(typeof window._editConvertFields==="function") window._editConvertFields();
    if(typeof window._editIncomeBind==="function") window._editIncomeBind();
    return r;
  }

  function deleteSub(idx){
    var u=window.currentUser||{};
    if(u.role!=="supervisor"){ alert("Зөвхөн ахлах устгана"); return; }
    return window.stickyDeleteSubmission(idx);
  }

  window.toggleLock=toggleLockFixed;
  window.startEditSubmission=startEdit;
  window.saveEditSubmission=saveEdit;
  window.deleteSubmission=deleteSub;
})();
