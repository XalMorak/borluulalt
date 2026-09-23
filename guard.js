/* guard: report stays on, cloud merge, precise delete/edit */
(function(){
  if(window._guardFix) return; window._guardFix=true;

  function nrm(s){ return String(s||"").toLowerCase(); }
  function tekOf(s){ return String((s&&(s.receiverName||s.tek||s.receiver))||"").trim(); }
  function kindOf(s){
    if(!s) return "bar";
    if(s.kind==="wine"||s.sheet==="wine") return "wine";
    if(nrm(tekOf(s)).indexOf("\u0432\u0438\u043d\u043e")>=0) return "wine";
    var items=s.items||[];
    for(var i=0;i<items.length;i++) if(Number(items[i]&&items[i].id)>=100) return "wine";
    return "bar";
  }
  function sid(s){
    if(!s) return "";
    if(s.id) return "id:"+s.id;
    return ["k", s.employeeId||"", s.date||"", s.shift||"", s.location||"", tekOf(s), kindOf(s)].join("|");
  }
  function listOf(x){
    if(Array.isArray(x)) return x.filter(Boolean);
    if(x && typeof x==="object") return Object.keys(x).map(function(k){ return x[k]; }).filter(Boolean);
    return [];
  }
  function rawSubs(){
    try{ return JSON.parse(localStorage.getItem("submissions")||"[]")||[]; }
    catch(e){ return []; }
  }
  function deletedSet(){
    var o={};
    try{ (JSON.parse(localStorage.getItem("deleted_sub_keys")||"[]")||[]).forEach(function(k){ if(k) o[k]=1; }); }
    catch(e){}
    return o;
  }
  function markDeleted(k){
    if(!k) return;
    var arr=[];
    try{ arr=JSON.parse(localStorage.getItem("deleted_sub_keys")||"[]")||[]; }catch(e){}
    if(arr.indexOf(k)<0) arr.push(k);
    localStorage.setItem("deleted_sub_keys", JSON.stringify(arr.slice(-800)));
  }
  function mergeSubs(local, cloud){
    var gone=deletedSet();
    var map={};
    listOf(cloud).forEach(function(s){ var k=sid(s); if(k && !gone[k]) map[k]=s; });
    listOf(local).forEach(function(s){ var k=sid(s); if(k && !gone[k]) map[k]=s; });
    return Object.keys(map).map(function(k){ return map[k]; });
  }
  function filtered(){
    var all=rawSubs().filter(function(s){ return s && !s.deleted && !deletedSet()[sid(s)]; });
    var k=window._sheetKind||"all";
    if(k!=="all") all=all.filter(function(s){ return kindOf(s)===k; });
    var from=(document.getElementById("reportFrom")||{}).value||"";
    var to=(document.getElementById("reportTo")||{}).value||"";
    var emp=(document.getElementById("reportEmp")||{}).value||"";
    var loc=(document.getElementById("reportLoc")||{}).value||"";
    var tek=(document.getElementById("reportTek")||{}).value||"";
    if(from) all=all.filter(function(s){ return (s.date||"")>=from; });
    if(to) all=all.filter(function(s){ return (s.date||"")<=to; });
    if(emp) all=all.filter(function(s){ return s.employeeId===emp; });
    if(loc) all=all.filter(function(s){ return (s.location||"")===loc; });
    if(tek) all=all.filter(function(s){ return tekOf(s)===tek; });
    all.sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")); });
    return all;
  }
  function safeRun(){
    var all=filtered();
    window._reportRows=all;
    var totalIncome=0,totalOver=0,totalShort=0;
    all.forEach(function(s){
      totalIncome+=(s.calcTotal!=null?s.calcTotal:0);
      var d=s.diff!=null?s.diff:0;
      if(d>0) totalOver+=d; else totalShort+=Math.abs(d);
    });
    var sum=document.getElementById("reportSummary");
    if(sum){
      sum.innerHTML=
        '<div class="summary-item"><div class="label">\u0418\u043b\u0433\u044d\u044d\u043b\u0442</div><div class="value">'+all.length+'</div></div>'
        +'<div class="summary-item"><div class="label">\u041e\u0440\u043b\u043e\u0433\u043e</div><div class="value">'+totalIncome.toLocaleString()+'\u20ae</div></div>'
        +'<div class="summary-item"><div class="label">\u0418\u043b\u04af\u04af</div><div class="value">'+totalOver.toLocaleString()+'</div></div>'
        +'<div class="summary-item"><div class="label">\u0414\u0443\u0442\u0443\u0443</div><div class="value">'+totalShort.toLocaleString()+'</div></div>';
    }
    var tbody=document.getElementById("reportBody");
    if(!tbody) return;
    tbody.innerHTML=all.map(function(s){
      var income=s.calcTotal!=null?s.calcTotal:0;
      var diff=s.diff!=null?s.diff:0;
      var cls=Math.abs(diff)<0.01?"diff-ok":(diff>0?"diff-over":"diff-short");
      return "<tr><td>"+(s.date||"")+"</td><td>"+(s.employeeName||"")+"</td><td>"+(s.shift||"\u2014")+"</td><td>"+(s.location||"\u2014")+"</td><td>"+(tekOf(s)||"\u2014")+"</td><td>"+income.toLocaleString()+"\u20ae</td><td class=\""+cls+"\">"+diff.toLocaleString()+"</td></tr>";
    }).join("") || '<tr><td colspan="7">\u0425\u043e\u043e\u0441\u043e\u043d</td></tr>';
  }
  safeRun._sheetSafe=true;
  safeRun._reportFix=true;
  safeRun._guard=true;

  function pushGuard(){
    if(window.cloudPush && window.cloudPush._guard) return;
    window.cloudPush=async function(){
      if(window._syncBusy) return false;
      window._syncBusy=true;
      if(typeof updateSyncBadge==="function") updateSyncBadge("busy");
      try{
        if(typeof initFirebase==="function") initFirebase();
        if(!window._fbDb){ window._syncBusy=false; return false; }
        var local=(typeof packAll==="function")? (packAll()||{}) : {};
        var disk=rawSubs();
        if(disk.length>(listOf(local.submissions).length)) local.submissions=disk;
        var snap=await window._fbDb.ref("borluulalt").once("value");
        var cloud=snap.val()||{};
        local.submissions=mergeSubs(local.submissions, cloud.submissions);
        if(!local.products || !listOf(local.products).length) local.products=cloud.products;
        if(!local.wines || listOf(local.wines).length < listOf(cloud.wines).length) local.wines=cloud.wines;
        if(!local.users || !Object.keys(local.users||{}).length) local.users=cloud.users;
        local.updatedAt=new Date().toISOString();
        if(typeof applyAll==="function") applyAll(local);
        await window._fbDb.ref("borluulalt").set(local);
        window._lastCloudAt=local.updatedAt;
        if(typeof updateSyncBadge==="function") updateSyncBadge("ok");
        window._syncBusy=false;
        return true;
      }catch(e){
        if(typeof updateSyncBadge==="function") updateSyncBadge("err");
        window._syncBusy=false;
        return false;
      }
    };
    window.cloudPush._guard=true;
    window.cloudPush._safe=true;
  }

  function sameRow(a,b){ return sid(a)===sid(b); }

  function wrapRowOps(){
    if(typeof window.deleteSubmission==="function" && !window.deleteSubmission._guard){
      window.deleteSubmission=async function(idx){
        var s=(window._sortedSubs||[])[idx];
        if(!s) return;
        var label=(s.employeeName||"")+" \u2014 "+(s.date||"")+" "+(tekOf(s)||"");
        if(!confirm(label+" \u0443\u0441\u0442\u0433\u0430\u0445 \u0443\u0443?")) return;
        markDeleted(sid(s));
        if(s.id) markDeleted("id:"+s.id);
        try{
          var products=(typeof getProducts==="function")?getProducts():[];
          (s.items||[]).forEach(function(it){
            var pi=products.findIndex(function(p){ return p.id===it.id; });
            if(pi>=0) products[pi].stock=(products[pi].stock||0)+(it.sold||0);
          });
          if(typeof setProducts==="function") setProducts(products);
        }catch(e){}
        if(typeof setSubs==="function") setSubs(rawSubs().filter(function(sub){ return !sameRow(sub,s); }));
        await window.cloudPush();
        var det=document.getElementById("selectedSubmissionDetail");
        if(det) det.classList.add("hidden");
        if(typeof loadSupervisorData==="function") loadSupervisorData();
      };
      window.deleteSubmission._guard=true;
    }
    if(typeof window.toggleLock==="function" && !window.toggleLock._guard){
      window.toggleLock=async function(idx){
        var s=(window._sortedSubs||[])[idx];
        if(!s) return;
        var all=rawSubs();
        var i=all.findIndex(function(sub){ return sameRow(sub,s); });
        if(i>=0){ all[i].locked=!all[i].locked; if(typeof setSubs==="function") setSubs(all); await window.cloudPush(); if(typeof loadSupervisorData==="function") loadSupervisorData(); }
      };
      window.toggleLock._guard=true;
    }
    if(typeof window.saveEditSubmission==="function" && !window.saveEditSubmission._guard){
      window.saveEditSubmission=async function(idx){
        var s=(window._sortedSubs||[])[idx];
        if(!s) return;
        var oldKey=sid(s);
        var oldSold={};
        (s.items||[]).forEach(function(it){ oldSold[it.id]=it.sold||0; });
        var items=(s.items||[]).map(function(it,i){
          return Object.assign({}, it, {
            prev:Number((document.getElementById("edit_prev_"+i)||{}).value)||0,
            next:Number((document.getElementById("edit_next_"+i)||{}).value)||0,
            sold:Number((document.getElementById("edit_sold_"+i)||{}).value)||0,
            income:Number((document.getElementById("edit_income_"+i)||{}).value)||0
          });
        });
        var products=(typeof getProducts==="function")?getProducts():[];
        items.forEach(function(it){
          var d=(oldSold[it.id]||0)-(it.sold||0);
          var pi=products.findIndex(function(p){ return p.id===it.id; });
          if(pi>=0) products[pi].stock=Math.max(0,(products[pi].stock||0)+d);
        });
        if(typeof setProducts==="function") setProducts(products);
        var calcTotal=items.reduce(function(a,it){ return a+(it.income||0); },0);
        var cashAmount=Number((document.getElementById("edit_cash")||{}).value)||0;
        var cardTotal=Number((document.getElementById("edit_card")||{}).value)||0;
        var updated=Object.assign({}, s, {
          date:(document.getElementById("edit_date")||{}).value||s.date,
          shift:(document.getElementById("edit_shift")||{}).value||s.shift,
          checkerName:(document.getElementById("edit_checker")||{}).value,
          receiverName:(document.getElementById("edit_receiver")||{}).value,
          items:items,
          cashAmount:cashAmount,
          cardTotal:cardTotal,
          posNumber:(document.getElementById("edit_pos")||{}).value,
          cashBalance:Number((document.getElementById("edit_balance")||{}).value)||0,
          calcTotal:calcTotal,
          collected:cashAmount+cardTotal,
          diff:(cashAmount+cardTotal)-calcTotal,
          submittedAt:new Date().toISOString()
        });
        if(window.currentUser) updated.editedBy=window.currentUser.id;
        if(sid(updated)!==oldKey) markDeleted(oldKey);
        if(typeof setSubs==="function") setSubs(rawSubs().map(function(sub){ return sameRow(sub,s)?updated:sub; }));
        await window.cloudPush();
        if(typeof showAlert==="function") showAlert("editAlert","\u0417\u0430\u0441\u0430\u0433\u0434\u043b\u0430\u0430!","success");
        setTimeout(function(){ if(typeof loadSupervisorData==="function") loadSupervisorData(); },400);
      };
      window.saveEditSubmission._guard=true;
    }
  }

  function install(){
    window.filterReportRows=filtered;
    if(window.runReport!==safeRun) window.runReport=safeRun;
    window.runReport._sheetSafe=true;
    pushGuard();
    wrapRowOps();
  }
  install();
  setInterval(install, 700);
})();
