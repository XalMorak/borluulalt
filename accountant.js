/* accountant role, roster filter, supervisor 14-day submissions. Does not wipe data. */
(function(){
  if(window._acctFix) return; window._acctFix=true;
  var ROSTERS=["Оюут бар","Манлай бар","VIP","POWER"];

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
  function keySafe(s){ return String(biz(s)||"").replace(/[.#$\[\]\/]/g,"_"); }
  function ymd(d){
    var m=String(d.getMonth()+1).padStart(2,"0");
    var day=String(d.getDate()).padStart(2,"0");
    return d.getFullYear()+"-"+m+"-"+day;
  }
  function cutoff(days){
    var d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-(days-1));
    return ymd(d);
  }
  function me(){ return window.currentUser||{}; }
  function rosterOf(u){ return (u&&u.roster)||""; }
  function inWindow(s, days){
    var from=cutoff(days);
    return (s.date||"")>=from;
  }
  function inRoster(s, roster){
    if(!roster || roster==="all" || roster==="Бүгд") return true;
    return String(s.location||"")===roster;
  }
  function money(n){ return Math.round(num(n)).toLocaleString()+"₮"; }

  function ensurePanel(){
    if(document.getElementById("accountantView")) return;
    var app=document.getElementById("appSection");
    if(!app) return;
    var el=document.createElement("div");
    el.id="accountantView";
    el.className="hidden";
    el.innerHTML=
      '<div class="header-info">'
      +'<div><label>Ростер</label><select id="acctRoster"></select></div>'
      +'<div><label>Эхлэх</label><input type="date" id="acctFrom"></div>'
      +'<div><label>Дуусах</label><input type="date" id="acctTo"></div>'
      +'<div><label>Төрөл</label><select id="acctKind"><option value="all">Бүгд</option><option value="bar">Пиво</option><option value="wine">Вино</option></select></div>'
      +'<button type="button" class="btn btn-success" id="acctReload">Шинэчлэх</button>'
      +'</div>'
      +'<div id="acctAlert"></div>'
      +'<div class="summary-box" id="acctSummary"></div>'
      +'<div class="table-wrap"><table><thead><tr><th>Огноо</th><th>Ажилтан</th><th>Ростер</th><th>Тек</th><th>Төрөл</th><th>Бодолт</th><th>Цуглуулсан</th><th>Зөрүү</th><th>Төлсөн</th><th>Дүн</th><th></th></tr></thead><tbody id="acctBody"></tbody></table></div>';
    app.appendChild(el);
    document.getElementById("acctReload").onclick=function(){ window.renderAccountant(); };
    document.getElementById("acctRoster").onchange=function(){ window.renderAccountant(); };
  }

  function fillRosterSelect(sel, selected, withAll){
    if(!sel) return;
    var html=withAll?'<option value="all">Бүгд</option>':'';
    ROSTERS.forEach(function(r){
      html+='<option value="'+r+'"'+(r===selected?' selected':'')+'>'+r+'</option>';
    });
    sel.innerHTML=html;
    if(selected) sel.value=selected;
  }

  window.renderAccountant=async function(){
    ensurePanel();
    var view=document.getElementById("accountantView");
    if(!view) return;
    var u=me();
    var sel=document.getElementById("acctRoster");
    if(sel && !sel.options.length) fillRosterSelect(sel, rosterOf(u)||"all", true);
    var roster=sel?sel.value:(rosterOf(u)||"all");
    var fromEl=document.getElementById("acctFrom");
    var toEl=document.getElementById("acctTo");
    if(fromEl && !fromEl.value) fromEl.value=cutoff(14);
    if(toEl && !toEl.value) toEl.value=ymd(new Date());
    var from=fromEl?fromEl.value:cutoff(14);
    var to=toEl?toEl.value:ymd(new Date());
    var kind=document.getElementById("acctKind")?document.getElementById("acctKind").value:"all";
    var base=db();
    var pays={};
    try{
      if(base) pays=(await base.ref("borluulalt/payments").once("value")).val()||{};
    }catch(e){}
    var all=(typeof getSubs==="function"?getSubs():[]).filter(function(s){
      if(!s||s.deleted) return false;
      if(from && (s.date||"")<from) return false;
      if(to && (s.date||"")>to) return false;
      if(!inRoster(s, roster)) return false;
      if(kind!=="all" && kindOf(s)!==kind) return false;
      return true;
    });
    all.sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")) || String(a.employeeName||"").localeCompare(String(b.employeeName||"")); });
    var shortSum=0, overSum=0, paidSum=0;
    var body=document.getElementById("acctBody");
    body.innerHTML="";
    all.forEach(function(s){
      var k=keySafe(s);
      var p=pays[k]||{};
      var diff=num(s.diff);
      if(diff<0) shortSum+=diff; else overSum+=diff;
      if(p.paid) paidSum+=num(p.amount||Math.abs(diff));
      var tr=document.createElement("tr");
      tr.innerHTML=
        '<td>'+(s.date||"")+'</td>'
        +'<td>'+(s.employeeName||s.employeeId||"")+'</td>'
        +'<td>'+(s.location||"")+'</td>'
        +'<td>'+tekOf(s)+'</td>'
        +'<td>'+(kindOf(s)==="wine"?"Вино":"Пиво")+'</td>'
        +'<td>'+money(s.calcTotal)+'</td>'
        +'<td>'+money(s.collected)+'</td>'
        +'<td class="'+(diff<0?"diff-short":(diff>0?"diff-over":"diff-ok"))+'">'+money(diff)+'</td>'
        +'<td><input type="checkbox" data-k="'+k+'" class="acct-paid"'+(p.paid?' checked':'')+'></td>'
        +'<td><input type="number" data-k="'+k+'" class="acct-amt" value="'+(p.amount!=null?p.amount:(diff<0?Math.abs(diff):0))+'" style="width:90px"></td>'
        +'<td><button type="button" class="btn btn-sm" data-save="'+k+'">Хадгалах</button></td>';
      body.appendChild(tr);
    });
    body.querySelectorAll("button[data-save]").forEach(function(btn){
      btn.onclick=function(){ window.savePayment(btn.getAttribute("data-save")); };
    });
    var sum=document.getElementById("acctSummary");
    if(sum) sum.innerHTML=
      '<div class="summary-item"><div class="label">Илгээлт</div><div class="value">'+all.length+'</div></div>'
      +'<div class="summary-item"><div class="label">Илүү</div><div class="value diff-over">'+money(overSum)+'</div></div>'
      +'<div class="summary-item"><div class="label">Дутуу</div><div class="value diff-short">'+money(shortSum)+'</div></div>'
      +'<div class="summary-item"><div class="label">Төлсөн</div><div class="value">'+money(paidSum)+'</div></div>';
  };

  window.savePayment=async function(k){
    var paid=document.querySelector('.acct-paid[data-k="'+k+'"]');
    var amt=document.querySelector('.acct-amt[data-k="'+k+'"]');
    var rec={
      paid:!!(paid&&paid.checked),
      amount:num(amt&&amt.value),
      at:new Date().toISOString(),
      by:(me().id||"")
    };
    var base=db();
    if(!base){ if(typeof showAlert==="function") showAlert("acctAlert","Сервер алга","error"); return; }
    try{
      await base.ref("borluulalt/payments/"+k).set(rec);
      if(typeof showAlert==="function") showAlert("acctAlert","Төлөлт хадгаллаа","success");
      window.renderAccountant();
    }catch(e){
      if(typeof showAlert==="function") showAlert("acctAlert","Хадгалагдсангүй","error");
    }
  };

  function filterForSupervisor(list){
    var u=me();
    var days=14;
    var roster=rosterOf(u);
    return (list||[]).filter(function(s){
      if(!s||s.deleted) return false;
      if(u.role==="supervisor" && !inWindow(s, days)) return false;
      if((u.role==="supervisor"||u.role==="accountant") && !inRoster(s, roster)) return false;
      return true;
    });
  }

  function wrapList(name){
    if(typeof window[name]!=="function" || window[name]._acct) return;
    var prev=window[name];
    window[name]=function(list){
      var src=list||(typeof getSubs==="function"?getSubs():[]);
      return prev.call(this, filterForSupervisor(src));
    };
    window[name]._acct=true;
  }

  function patchUserForm(){
    var role=document.getElementById("newUserRole");
    if(role && !role.querySelector('option[value="accountant"]')){
      var o=document.createElement("option");
      o.value="accountant"; o.textContent="Нягтлан";
      role.appendChild(o);
    }
    if(role && !document.getElementById("newUserRoster")){
      var wrap=document.createElement("div");
      wrap.innerHTML='<label>Ростер</label><select id="newUserRoster"><option value="all">Бүгд</option></select>';
      role.parentNode.parentNode.insertBefore(wrap, role.parentNode.nextSibling);
      fillRosterSelect(document.getElementById("newUserRoster"), "all", true);
    }
    document.querySelectorAll("select[id^='usr_role_']").forEach(function(sel){
      if(!sel.querySelector('option[value="accountant"]')){
        var o=document.createElement("option");
        o.value="accountant"; o.textContent="Нягтлан";
        sel.appendChild(o);
      }
    });
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
      return _sa.apply(this, arguments);
    };
    window.showApp._acct=true;
  }

  if(typeof window.addUser==="function" && !window.addUser._acct){
    var _add=window.addUser;
    window.addUser=async function(){
      var rosterEl=document.getElementById("newUserRoster");
      var roster=rosterEl?rosterEl.value:"all";
      var id=(document.getElementById("newUserId")||{}).value||"";
      id=String(id).trim().toLowerCase();
      await _add.apply(this, arguments);
      if(!id || typeof getUsers!=="function") return;
      var users=getUsers();
      if(users[id]){
        users[id].roster=roster;
        if(typeof setUsers==="function") setUsers(users);
        try{
          var base=db();
          if(base) await base.ref("borluulalt/users/"+id).update({roster:roster, role:users[id].role, name:users[id].name, pin:users[id].pin||""});
        }catch(e){}
      }
    };
    window.addUser._acct=true;
  }

  if(typeof window.saveUserRow==="function" && !window.saveUserRow._acct){
    var _save=window.saveUserRow;
    window.saveUserRow=async function(id){
      await _save.apply(this, arguments);
      var rosterEl=document.getElementById("usr_roster_"+id);
      var roster=rosterEl?rosterEl.value:"all";
      try{
        var users=getUsers();
        if(users[id]){
          users[id].roster=roster;
          setUsers(users);
          var base=db();
          if(base) await base.ref("borluulalt/users/"+id).update({roster:roster});
        }
      }catch(e){}
    };
    window.saveUserRow._acct=true;
  }

  if(typeof window.buildUsersTable==="function" && !window.buildUsersTable._acct){
    var _bt=window.buildUsersTable;
    window.buildUsersTable=function(){
      var r=_bt.apply(this, arguments);
      document.querySelectorAll("select[id^='usr_role_']").forEach(function(sel){
        var id=sel.id.replace("usr_role_","");
        if(!sel.querySelector('option[value="accountant"]')){
          var o=document.createElement("option");
          o.value="accountant"; o.textContent="Нягтлан";
          sel.appendChild(o);
          var users=getUsers();
          if(users[id]&&users[id].role==="accountant") sel.value="accountant";
        }
        var row=sel.closest("tr");
        if(row && !document.getElementById("usr_roster_"+id)){
          var td=document.createElement("td");
          var s=document.createElement("select");
          s.id="usr_roster_"+id;
          var users=getUsers();
          fillRosterSelect(s, (users[id]&&users[id].roster)||"all", true);
          td.appendChild(s);
          var pin=document.getElementById("usr_pin_"+id);
          if(pin && pin.parentNode) pin.parentNode.parentNode.insertBefore(td, pin.parentNode.nextSibling);
        }
      });
      return r;
    };
    window.buildUsersTable._acct=true;
  }

  wrapList("renderSubmissionsList");
  wrapList("renderSubmissionsListEnhanced");
  wrapList("renderOverview");

  setInterval(function(){
    patchUserForm();
    wrapList("renderSubmissionsList");
    wrapList("renderSubmissionsListEnhanced");
  }, 1500);
})();
