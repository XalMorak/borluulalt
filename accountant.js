/* Roster = 14-day rotation set by accountant. Not a location. */
(function(){
  if(window._acctFix) window._acctFix=true;
  window._acctFix=true;

  function db(){
    try{
      if(typeof initFirebase==="function") initFirebase();
      if(typeof firebase!=="undefined" && firebase.database){
        if((!firebase.apps||!firebase.apps.length) && typeof firebaseConfig!=="undefined") firebase.initializeApp(firebaseConfig);
        var d=firebase.database();
        if(d&&d.ref){ window._fbDb=d; return d; }
      }
    }catch(e){}
    return window._fbDb||null;
  }
  function num(v){ var n=Number(v); return isFinite(n)?n:0; }
  function money(n){ return Math.round(num(n)).toLocaleString()+"₮"; }
  function tekOf(s){ return String((s&&(s.receiverName||s.tek||s.receiver))||"").trim(); }
  function kindOf(s){
    if(!s) return "bar";
    if(s.kind==="wine"||s.sheet==="wine") return "wine";
    if(tekOf(s).toLowerCase().indexOf("вино")>=0) return "wine";
    return s.kind||"bar";
  }
  function biz(s){
    if(window._bizKey) return window._bizKey(s);
    return [s.employeeId||"", s.date||"", s.shift||"", s.location||"", tekOf(s), kindOf(s)].join("|").toLowerCase();
  }
  function keySafe(s){ return String(biz(s)||"x").replace(/[.#$\[\]\/]/g,"_"); }
  function ymd(d){
    var m=String(d.getMonth()+1).padStart(2,"0");
    var day=String(d.getDate()).padStart(2,"0");
    return d.getFullYear()+"-"+m+"-"+day;
  }
  function addDays(iso, n){
    var p=String(iso||"").split("-");
    var d=new Date(Number(p[0]), Number(p[1])-1, Number(p[2]));
    d.setDate(d.getDate()+n);
    return ymd(d);
  }
  function today(){ return ymd(new Date()); }
  function me(){ return window.currentUser||{}; }

  window._rosters={};
  function listRosters(){
    return Object.keys(window._rosters||{}).map(function(k){
      var r=window._rosters[k]||{};
      r.id=k;
      return r;
    }).filter(function(r){ return r.start && r.end; }).sort(function(a,b){ return String(b.start).localeCompare(String(a.start)); });
  }
  function rosterById(id){
    var all=listRosters();
    for(var i=0;i<all.length;i++) if(all[i].id===id) return all[i];
    return null;
  }
  function currentRoster(){
    var t=today();
    var all=listRosters();
    for(var i=0;i<all.length;i++){
      if(all[i].start<=t && t<=all[i].end) return all[i];
    }
    return all[0]||null;
  }
  function inRoster(s, r){
    if(!r) return (s.date||"")>=addDays(today(), -13);
    return (s.date||"")>=r.start && (s.date||"")<=r.end;
  }

  async function loadRosters(){
    var base=db();
    if(!base) return window._rosters;
    try{ window._rosters=(await base.ref("borluulalt/rosters").once("value")).val()||{}; }catch(e){}
    return window._rosters;
  }

  function ensurePanel(){
    if(document.getElementById("accountantView")) return;
    var app=document.getElementById("appSection");
    if(!app) return;
    var el=document.createElement("div");
    el.id="accountantView";
    el.className="hidden";
    el.innerHTML=
      '<div class="card" style="padding:14px;margin-bottom:12px">'
      +'<h3 style="margin:0 0 8px">Ростер тохируулах — 14 хоног</h3>'
      +'<p style="margin:0 0 10px;color:#5b6570">Ростер нь байршил биш. 14 хоног ирж очих ээлж. Эхлэх өдөр сонгоход дуусах өдөр автоматаар +13 хоног.</p>'
      +'<div class="header-info">'
      +'<div><label>Нэр</label><input id="rosterName" placeholder="Жишээ: 10-р сарын 1-р ээлж"></div>'
      +'<div><label>Эхлэх</label><input type="date" id="rosterStart"></div>'
      +'<div><label>Дуусах</label><input type="date" id="rosterEnd" readonly></div>'
      +'<button type="button" class="btn btn-success" id="rosterSave">Ростер хадгалах</button>'
      +'</div>'
      +'<div id="rosterMembers" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div>'
      +'<div id="rosterList" style="margin-top:10px"></div>'
      +'</div>'
      +'<div class="header-info">'
      +'<div><label>Харах ростер</label><select id="acctRoster"></select></div>'
      +'<div><label>Төрөл</label><select id="acctKind"><option value="all">Бүгд</option><option value="bar">Пиво</option><option value="wine">Вино</option></select></div>'
      +'<button type="button" class="btn" id="acctReload">Шинэчлэх</button>'
      +'</div>'
      +'<div id="acctAlert"></div>'
      +'<div class="summary-box" id="acctSummary"></div>'
      +'<div class="table-wrap"><table><thead><tr><th>Огноо</th><th>Ажилтан</th><th>Байршил</th><th>Тек</th><th>Төрөл</th><th>Бодолт</th><th>Цуглуулсан</th><th>Зөрүү</th><th>Төлсөн</th><th>Дүн</th><th></th></tr></thead><tbody id="acctBody"></tbody></table></div>';
    app.appendChild(el);
    document.getElementById("rosterStart").onchange=function(){
      var v=this.value;
      if(v) document.getElementById("rosterEnd").value=addDays(v, 13);
    };
    document.getElementById("rosterStart").value=today();
    document.getElementById("rosterEnd").value=addDays(today(), 13);
    document.getElementById("rosterSave").onclick=window.saveRoster;
    document.getElementById("acctReload").onclick=function(){ window.renderAccountant(); };
    document.getElementById("acctRoster").onchange=function(){ window.renderAccountant(); };
  }

  function drawMembers(selected){
    var box=document.getElementById("rosterMembers");
    if(!box) return;
    var users=(typeof getUsers==="function")?getUsers():{};
    var html="";
    Object.keys(users).forEach(function(id){
      var u=users[id]||{};
      if(u.role==="accountant") return;
      var on=selected && selected[id];
      html+='<label style="border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px"><input type="checkbox" class="roster-member" value="'+id+'"'+(on?' checked':'')+'> '+(u.name||id)+'</label>';
    });
    box.innerHTML=html||'<span>Ажилтан алга</span>';
  }

  window.saveRoster=async function(){
    var start=document.getElementById("rosterStart").value;
    var end=document.getElementById("rosterEnd").value||addDays(start,13);
    var name=(document.getElementById("rosterName").value||"").trim()|| (start+" — "+end);
    if(!start){ if(typeof showAlert==="function") showAlert("acctAlert","Эхлэх өдөр сонго","error"); return; }
    var members={};
    document.querySelectorAll(".roster-member:checked").forEach(function(el){ members[el.value]=true; });
    var id="r_"+start.replace(/-/g,"");
    var rec={name:name, start:start, end:end, members:members, updatedAt:new Date().toISOString(), by:me().id||""};
    var base=db();
    if(!base){ if(typeof showAlert==="function") showAlert("acctAlert","Сервер алга","error"); return; }
    try{
      await base.ref("borluulalt/rosters/"+id).set(rec);
      window._rosters[id]=rec;
      if(typeof showAlert==="function") showAlert("acctAlert","Ростер хадгаллаа: "+name,"success");
      window.renderAccountant();
    }catch(e){
      if(typeof showAlert==="function") showAlert("acctAlert","Ростер хадгалагдсангүй","error");
    }
  };

  window.renderAccountant=async function(){
    ensurePanel();
    await loadRosters();
    drawMembers();
    var sel=document.getElementById("acctRoster");
    var cur=sel&&sel.value;
    var all=listRosters();
    sel.innerHTML=all.map(function(r){
      return '<option value="'+r.id+'">'+r.name+' ('+r.start+' — '+r.end+')</option>';
    }).join("") || '<option value="">Ростер алга</option>';
    if(cur && rosterById(cur)) sel.value=cur;
    else if(currentRoster()) sel.value=currentRoster().id;
    var list=document.getElementById("rosterList");
    if(list) list.innerHTML=all.map(function(r){
      var n=Object.keys(r.members||{}).length;
      return '<div>'+r.name+' · '+r.start+' — '+r.end+' · '+n+' хүн</div>';
    }).join("");
    var roster=rosterById(sel.value)||currentRoster();
    var kind=document.getElementById("acctKind")?document.getElementById("acctKind").value:"all";
    var pays={};
    try{ var base=db(); if(base) pays=(await base.ref("borluulalt/payments").once("value")).val()||{}; }catch(e){}
    var rows=(typeof getSubs==="function"?getSubs():[]).filter(function(s){
      if(!s||s.deleted) return false;
      if(!inRoster(s, roster)) return false;
      if(kind!=="all" && kindOf(s)!==kind) return false;
      return true;
    });
    rows.sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")) || String(a.employeeName||"").localeCompare(String(b.employeeName||"")); });
    var shortSum=0, overSum=0, paidSum=0;
    var body=document.getElementById("acctBody");
    body.innerHTML="";
    rows.forEach(function(s){
      var k=keySafe(s);
      var p=pays[k]||{};
      var diff=num(s.diff);
      if(diff<0) shortSum+=diff; else overSum+=diff;
      if(p.paid) paidSum+=num(p.amount||Math.abs(diff));
      var tr=document.createElement("tr");
      tr.innerHTML=
        '<td>'+(s.date||"")+'</td><td>'+(s.employeeName||s.employeeId||"")+'</td><td>'+(s.location||"")+'</td><td>'+tekOf(s)+'</td><td>'+(kindOf(s)==="wine"?"Вино":"Пиво")+'</td>'
        +'<td>'+money(s.calcTotal)+'</td><td>'+money(s.collected)+'</td>'
        +'<td class="'+(diff<0?"diff-short":(diff>0?"diff-over":"diff-ok"))+'">'+money(diff)+'</td>'
        +'<td><input type="checkbox" class="acct-paid" data-k="'+k+'"'+(p.paid?' checked':'')+'></td>'
        +'<td><input type="number" class="acct-amt" data-k="'+k+'" value="'+(p.amount!=null?p.amount:(diff<0?Math.abs(diff):0))+'" style="width:90px"></td>'
        +'<td><button type="button" class="btn btn-sm" data-save="'+k+'">Хадгалах</button></td>';
      body.appendChild(tr);
    });
    body.querySelectorAll("button[data-save]").forEach(function(btn){
      btn.onclick=function(){ window.savePayment(btn.getAttribute("data-save")); };
    });
    var sum=document.getElementById("acctSummary");
    if(sum) sum.innerHTML=
      '<div class="summary-item"><div class="label">Ростер</div><div class="value">'+(roster?roster.start+" — "+roster.end:"14 хоног")+'</div></div>'
      +'<div class="summary-item"><div class="label">Илгээлт</div><div class="value">'+rows.length+'</div></div>'
      +'<div class="summary-item"><div class="label">Илүү</div><div class="value diff-over">'+money(overSum)+'</div></div>'
      +'<div class="summary-item"><div class="label">Дутуу</div><div class="value diff-short">'+money(shortSum)+'</div></div>'
      +'<div class="summary-item"><div class="label">Төлсөн</div><div class="value">'+money(paidSum)+'</div></div>';
  };

  window.savePayment=async function(k){
    var paid=document.querySelector('.acct-paid[data-k="'+k+'"]');
    var amt=document.querySelector('.acct-amt[data-k="'+k+'"]');
    var rec={paid:!!(paid&&paid.checked), amount:num(amt&&amt.value), at:new Date().toISOString(), by:me().id||""};
    var base=db();
    if(!base) return;
    try{
      await base.ref("borluulalt/payments/"+k).set(rec);
      if(typeof showAlert==="function") showAlert("acctAlert","Төлөлт хадгаллаа","success");
    }catch(e){
      if(typeof showAlert==="function") showAlert("acctAlert","Хадгалагдсангүй","error");
    }
  };

  function filterSubs(list){
    var u=me();
    if(u.role!=="supervisor" && u.role!=="accountant") return list||[];
    var r=currentRoster();
    return (list||[]).filter(function(s){ return s && !s.deleted && inRoster(s, r); });
  }
  function wrapList(name){
    if(typeof window[name]!=="function" || window[name]._roster14) return;
    var prev=window[name];
    window[name]=function(list){
      var src=list||(typeof getSubs==="function"?getSubs():[]);
      return prev.call(this, filterSubs(src));
    };
    window[name]._roster14=true;
    window[name]._acct=true;
  }

  if(typeof window.showApp==="function" && !window.showApp._acct){
    var _sa=window.showApp;
    window.showApp=function(){
      var u=me();
      if(u.role==="accountant"){
        document.getElementById("loginSection").classList.add("hidden");
        document.getElementById("appSection").classList.remove("hidden");
        document.getElementById("userNameDisplay").textContent=u.name+" ("+u.id+")";
        var badge=document.getElementById("roleBadge");
        if(badge){ badge.textContent="Нягтлан"; badge.className="role-badge role-sup"; }
        var ev=document.getElementById("employeeView"); if(ev) ev.classList.add("hidden");
        var sv=document.getElementById("supervisorView"); if(sv) sv.classList.add("hidden");
        ensurePanel();
        var av=document.getElementById("accountantView");
        if(av){ av.classList.remove("hidden"); av.style.display=""; }
        window.renderAccountant();
        if(typeof updateSyncBadge==="function") updateSyncBadge("ok");
        return;
      }
      var av=document.getElementById("accountantView");
      if(av) av.classList.add("hidden");
      var r=_sa.apply(this, arguments);
      loadRosters().then(function(){
        if(typeof loadSupervisorData==="function" && u.role==="supervisor") loadSupervisorData();
      });
      return r;
    };
    window.showApp._acct=true;
  }

  function patchRole(){
    var role=document.getElementById("newUserRole");
    if(role && !role.querySelector('option[value="accountant"]')){
      var o=document.createElement("option");
      o.value="accountant"; o.textContent="Нягтлан";
      role.appendChild(o);
    }
    document.querySelectorAll("select[id^='usr_role_']").forEach(function(sel){
      if(!sel.querySelector('option[value="accountant"]')){
        var o=document.createElement("option");
        o.value="accountant"; o.textContent="Нягтлан";
        sel.appendChild(o);
        var id=sel.id.replace("usr_role_","");
        var users=(typeof getUsers==="function")?getUsers():{};
        if(users[id]&&users[id].role==="accountant") sel.value="accountant";
      }
    });
  }

  wrapList("renderSubmissionsList");
  wrapList("renderSubmissionsListEnhanced");
  wrapList("renderOverview");
  setInterval(function(){
    patchRole();
    wrapList("renderSubmissionsList");
    wrapList("renderSubmissionsListEnhanced");
  }, 1500);
  loadRosters();
})();
