/* accountant.js — role router + Нягтлан page.
   - Ахлах (supervisor): submissions list / overview show ONLY today's (local date) submissions.
   - Нягтлан (accountant): ALL submissions read straight from Firebase (submissions + inbox),
     filters, per-employee илүү/дутуу, read-only detail, Excel, 14-day roster + payments. */
(function(){
  if(window._acctFix2) return;
  window._acctFix2=true;
  window._acctFix=true;

  /* ---------- helpers ---------- */
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
  async function authed(){
    try{ if(typeof ensureFirebaseAuth==="function") await ensureFirebaseAuth(); }catch(e){}
    return db();
  }
  function num(v){ var n=Number(v); return isFinite(n)?n:0; }
  function money(n){ return Math.round(num(n)).toLocaleString()+"₮"; }
  function signed(n){ n=Math.round(num(n)); return (n>0?"+":"")+n.toLocaleString()+"₮"; }
  function esc(v){ return String(v==null?"":v).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function tekOf(s){ return String((s&&(s.receiverName||s.tek||s.receiver))||"").trim(); }
  function kindOf(s){
    if(!s) return "bar";
    if(s.kind==="wine"||s.sheet==="wine") return "wine";
    if(tekOf(s).toLowerCase().indexOf("вино")>=0) return "wine";
    var items=s.items||[];
    for(var i=0;i<items.length;i++) if(Number(items[i]&&items[i].id)>=100) return "wine";
    return "bar";
  }
  function biz(s){
    if(window._bizKey){ var k=window._bizKey(s); if(k) return k; }
    return [s.employeeId||"", s.date||"", s.shift||"", s.location||"", tekOf(s), kindOf(s)].join("|").toLowerCase();
  }
  function keySafe(s){ return String(biz(s)||"x").replace(/[.#$\[\]\/]/g,"_"); }
  function calcOf(s){
    if(s && s.calcTotal!=null) return num(s.calcTotal);
    return (s&&s.items||[]).reduce(function(a,i){ return a+num(i&&i.income); },0);
  }
  function collectedOf(s){
    if(s && s.collected!=null) return num(s.collected);
    return Math.max(0, num(s&&s.cashAmount)-num(s&&s.cashBalance))+num(s&&s.cardTotal);
  }
  function diffOf(s){ return (s && s.diff!=null) ? num(s.diff) : collectedOf(s)-calcOf(s); }
  function diffCls(d){ return Math.abs(d)<0.01?"diff-ok":(d>0?"diff-over":"diff-short"); }
  function ymd(d){
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  }
  function addDays(iso, n){
    var p=String(iso||"").split("-");
    var d=new Date(Number(p[0]), Number(p[1])-1, Number(p[2]));
    d.setDate(d.getDate()+n);
    return ymd(d);
  }
  function today(){ return ymd(new Date()); }
  /* currentUser lives in app.js (now `var`, so window.currentUser works). Keep a fallback anyway. */
  function me(){
    try{ if(typeof currentUser!=="undefined" && currentUser) return currentUser; }catch(e){}
    return window.currentUser||{};
  }
  function role(){ return me().role||""; }
  function listOf(x){
    if(Array.isArray(x)) return x.filter(function(v){ return v && typeof v==="object"; });
    if(x && typeof x==="object") return Object.keys(x).map(function(k){ var v=x[k]; if(v&&typeof v==="object"&&!v.id) v.id=k; return v; }).filter(function(v){ return v && typeof v==="object"; });
    return [];
  }
  function copyFlags(from, to){
    if(!from||!to) return to;
    Object.keys(from).forEach(function(k){ if(k.charAt(0)==="_") to[k]=from[k]; });
    return to;
  }
  window._acctUtil={num:num,money:money,signed:signed,esc:esc,tekOf:tekOf,kindOf:kindOf,biz:biz,calcOf:calcOf,
    collectedOf:collectedOf,diffOf:diffOf,diffCls:diffCls,ymd:ymd,today:today,addDays:addDays,me:me,role:role,listOf:listOf,copyFlags:copyFlags};

  /* ---------- Ахлах: today only ---------- */
  function filterSubs(list){
    if(role()!=="supervisor") return list||[];
    var t=today();
    return (list||[]).filter(function(s){ return s && !s.deleted && (s.date||"")===t; });
  }
  window._supTodayFilter=filterSubs;
  function wrapList(name){
    var prev=window[name];
    if(typeof prev!=="function" || prev._supToday) return;
    var fn=function(list){
      var src=list||(typeof getSubs==="function"?getSubs():[]);
      return prev.call(this, filterSubs(src));
    };
    copyFlags(prev, fn);
    fn._supToday=true;
    window[name]=fn;
  }

  /* ---------- Rosters ---------- */
  window._rosters={};
  function listRosters(){
    return Object.keys(window._rosters||{}).map(function(k){
      var r=window._rosters[k]||{}; r.id=k; return r;
    }).filter(function(r){ return r.start && r.end; }).sort(function(a,b){ return String(b.start).localeCompare(String(a.start)); });
  }
  function rosterById(id){
    var all=listRosters();
    for(var i=0;i<all.length;i++) if(all[i].id===id) return all[i];
    return null;
  }
  async function loadRosters(){
    var base=await authed();
    if(!base) return window._rosters;
    try{ window._rosters=(await base.ref("borluulalt/rosters").once("value")).val()||{}; }catch(e){}
    return window._rosters;
  }

  /* ---------- All submissions straight from Firebase ---------- */
  var _all=[], _pays={}, _loadedAt=0, _loadErr="";
  function newer(a,b){ return String((a&&a.submittedAt)||"")>=String((b&&b.submittedAt)||""); }
  function mergeAll(list){
    var byId={}, out=[];
    list.forEach(function(s){
      if(!s) return;
      var k=s.id?("id:"+s.id):("b:"+biz(s));
      if(!byId[k] || newer(s, byId[k])) byId[k]=s;
    });
    var byBiz={};
    Object.keys(byId).forEach(function(k){
      var s=byId[k], b=biz(s);
      if(!byBiz[b] || newer(s, byBiz[b])) byBiz[b]=s;
    });
    Object.keys(byBiz).forEach(function(b){ if(!byBiz[b].deleted) out.push(byBiz[b]); });
    return out;
  }
  async function loadAllSubs(){
    var base=await authed();
    _loadErr="";
    if(!base){ _loadErr="Сервертэй холбогдсонгүй — энэ төхөөрөмжийн өгөгдлийг харуулж байна."; _all=mergeAll(typeof getSubs==="function"?getSubs():[]); return _all; }
    try{
      var res=await Promise.all([
        base.ref("borluulalt/submissions").once("value"),
        base.ref("borluulalt/inbox").once("value"),
        base.ref("borluulalt/payments").once("value"),
        base.ref("borluulalt/deleted").once("value")
      ]);
      var tombs=Object.assign({}, res[3].val()||{}, window._tombs||{});
      _all=mergeAll(listOf(res[0].val()).concat(listOf(res[1].val())));
      if(window._tombMatch) _all=_all.filter(function(s){ return !window._tombMatch(s, tombs); });
      _pays=res[2].val()||{};
      _loadedAt=Date.now();
    }catch(e){
      _loadErr="Серверээс уншиж чадсангүй — энэ төхөөрөмжийн өгөгдлийг харуулж байна.";
      _all=mergeAll(typeof getSubs==="function"?getSubs():[]);
    }
    return _all;
  }

  /* ---------- Accountant panel ---------- */
  function ensurePanel(){
    if(document.getElementById("accountantView")) return;
    var app=document.getElementById("appSection");
    var host=(app&&app.querySelector(".card"))||app;
    if(!host) return;
    var el=document.createElement("div");
    el.id="accountantView";
    el.className="hidden";
    el.innerHTML=
      '<div class="tabs acct-tabs no-print" id="acctTabs">'
      +'<button type="button" class="tab-btn active" data-acct-tab="subs">Илгээлт</button>'
      +'<button type="button" class="tab-btn" data-acct-tab="users">Хэрэглэгч</button>'
      +'<button type="button" class="tab-btn" data-acct-tab="roster">Ростер</button>'
      +'</div>'
      +'<div id="acctPaneUsers" class="hidden"></div>'
      +'<div id="acctPaneRoster" class="hidden">'
      +'<div class="card" style="padding:14px;margin-bottom:12px;box-shadow:none;border:1px solid #e5e7eb">'
      +'<h3 style="margin:0 0 8px">Ростер тохируулах — 14 хоног</h3>'
      +'<p style="margin:0 0 10px;color:#5b6570;font-size:.85rem">Ростер нь байршил биш. 14 хоног ирж очих ээлж. Эхлэх өдөр сонгоход дуусах өдөр автоматаар +13 хоног.</p>'
      +'<div class="header-info">'
      +'<div><label>Нэр</label><input id="rosterName" placeholder="Жишээ: 10-р сарын 1-р ээлж"></div>'
      +'<div><label>Эхлэх</label><input type="date" id="rosterStart"></div>'
      +'<div><label>Дуусах</label><input type="date" id="rosterEnd" readonly></div>'
      +'<div style="display:flex;align-items:flex-end"><button type="button" class="btn btn-success btn-sm" id="rosterSave">Ростер хадгалах</button></div>'
      +'</div>'
      +'<div id="rosterMembers" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div>'
      +'<div id="rosterList" style="margin-top:10px;font-size:.85rem"></div>'
      +'</div>'
      +'</div>'
      +'<div id="acctPaneSubs">'
      +'<h3 style="margin:6px 0 8px">Бүх илгээлт</h3>'
      +'<div class="header-info no-print">'
      +'<div><label>Ростер</label><select id="acctRoster"></select></div>'
      +'<div><label>Эхлэх огноо</label><input type="date" id="acctFrom"></div>'
      +'<div><label>Дуусах огноо</label><input type="date" id="acctTo"></div>'
      +'<div><label>Ажилтан</label><select id="acctEmp"><option value="">Бүгд</option></select></div>'
      +'<div><label>Байршил</label><select id="acctLoc"><option value="">Бүгд</option></select></div>'
      +'<div><label>Тек</label><select id="acctTek"><option value="">Бүгд</option></select></div>'
      +'<div><label>Төрөл</label><select id="acctKind"><option value="all">Бүгд</option><option value="bar">Пиво</option><option value="wine">Вино</option></select></div>'
      +'</div>'
      +'<div class="no-print" style="margin-bottom:8px">'
      +'<button type="button" class="btn btn-sm" id="acctReload">Шинэчлэх</button>'
      +'<button type="button" class="btn btn-outline btn-sm" id="acctClear">Шүүлт цэвэрлэх</button>'
      +'<button type="button" class="btn btn-outline btn-sm" id="acctExcel">Excel</button>'
      +'<span id="acctStamp" style="font-size:.75rem;color:#666;margin-left:6px"></span>'
      +'</div>'
      +'<div id="acctAlert"></div>'
      +'<div class="summary-box" id="acctSummary" style="margin-top:6px"></div>'
      +'<h4 style="margin:14px 0 4px">Ажилтан тус бүрийн илүү / дутуу</h4>'
      +'<div class="table-wrap"><table><thead><tr><th>Ажилтан</th><th>Илгээлт</th><th>Бодолт</th><th>Цуглуулсан</th><th>Илүү</th><th>Дутуу</th><th>Цэвэр</th><th>Төлсөн</th></tr></thead><tbody id="acctEmpBody"></tbody></table></div>'
      +'<div id="acctDetail"></div>'
      +'<h4 style="margin:14px 0 4px">Илгээлтүүд <small style="font-weight:400;color:#666">(мөр дээр дарж дэлгэрэнгүй харна)</small></h4>'
      +'<div class="table-wrap"><table><thead><tr><th>Огноо</th><th>Ээлж</th><th>Ажилтан</th><th>Байршил</th><th>Тек</th><th>Төрөл</th><th>Бодолт</th><th>Цуглуулсан</th><th>Зөрүү</th><th>Төлсөн</th><th>Дүн</th><th></th></tr></thead><tbody id="acctBody"></tbody></table></div>'
      +'</div>';
    host.appendChild(el);
    document.getElementById("acctTabs").addEventListener("click", function(ev){
      var b=ev.target.closest("button[data-acct-tab]");
      if(b) window.showAcctTab(b.getAttribute("data-acct-tab"));
    });
    document.getElementById("rosterStart").onchange=function(){
      var v=this.value;
      if(v) document.getElementById("rosterEnd").value=addDays(v, 13);
    };
    document.getElementById("rosterStart").value=today();
    document.getElementById("rosterEnd").value=addDays(today(), 13);
    document.getElementById("rosterSave").onclick=function(){ window.saveRoster(); };
    document.getElementById("acctReload").onclick=function(){ if(typeof window.refreshData==="function") window.refreshData(); else window.renderAccountant({reload:true}); };
    document.getElementById("acctClear").onclick=function(){
      ["acctFrom","acctTo","acctEmp","acctLoc","acctTek"].forEach(function(id){ var e=document.getElementById(id); if(e) e.value=""; });
      document.getElementById("acctRoster").value="";
      document.getElementById("acctKind").value="all";
      window.renderAccountant();
    };
    document.getElementById("acctExcel").onclick=function(){ window.exportAccountantCSV(); };
    ["acctRoster","acctFrom","acctTo","acctEmp","acctLoc","acctTek","acctKind"].forEach(function(id){
      document.getElementById(id).onchange=function(){ window.renderAccountant(); };
    });
    var body=document.getElementById("acctBody");
    body.addEventListener("input", function(ev){ if(ev.target.closest(".acct-amt")) window._acctDirty=true; });
    body.addEventListener("change", function(ev){ if(ev.target.closest(".acct-paid,.acct-amt")) window._acctDirty=true; });
    body.addEventListener("click", function(ev){
      var t=ev.target;
      var save=t.closest("button[data-save]");
      if(save){ ev.stopPropagation(); window.savePayment(save.getAttribute("data-save")); return; }
      if(t.closest("input,button,select,label")) return;
      var tr=t.closest("tr[data-i]");
      if(tr) showDetail(Number(tr.getAttribute("data-i")));
    });
  }

  /* Нягтлан page tabs: Илгээлт | Хэрэглэгч | Ростер */
  window.showAcctTab=function(name){
    var panes={subs:"acctPaneSubs", users:"acctPaneUsers", roster:"acctPaneRoster"};
    if(!panes[name]) name="subs";
    Object.keys(panes).forEach(function(k){
      var p=document.getElementById(panes[k]);
      if(p) p.classList.toggle("hidden", k!==name);
    });
    var bar=document.getElementById("acctTabs");
    if(bar) Array.prototype.forEach.call(bar.querySelectorAll("button[data-acct-tab]"), function(b){
      b.classList.toggle("active", b.getAttribute("data-acct-tab")===name);
    });
    window._acctTab=name;
    if(name==="users" && typeof window.renderAcctUsers==="function") window.renderAcctUsers();
    if(name==="roster") try{ drawMembers(); }catch(e){}
  };

  function drawMembers(selected){
    var box=document.getElementById("rosterMembers");
    if(!box) return;
    if(!selected){
      selected={};
      box.querySelectorAll(".roster-member:checked").forEach(function(el){ selected[el.value]=true; });
    }
    var users=(typeof getUsers==="function")?getUsers():{};
    var html="";
    Object.keys(users).forEach(function(id){
      var u=users[id]||{};
      if(u.role==="accountant"||u.role==="supervisor") return;
      html+='<label style="border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px;font-size:.85rem"><input type="checkbox" class="roster-member" value="'+esc(id)+'"'+(selected[id]?' checked':'')+'> '+esc(u.name||id)+'</label>';
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
    var base=await authed();
    if(!base){ if(typeof showAlert==="function") showAlert("acctAlert","Сервер алга","error"); return; }
    try{
      await base.ref("borluulalt/rosters/"+id).set(rec);
      window._rosters[id]=rec;
      if(typeof showAlert==="function") showAlert("acctAlert","Ростер хадгаллаа: "+esc(name),"success");
      window.renderAccountant();
    }catch(e){
      if(typeof showAlert==="function") showAlert("acctAlert","Ростер хадгалагдсангүй","error");
    }
  };

  function fillSelect(id, values, labels){
    var sel=document.getElementById(id);
    if(!sel) return;
    var cur=sel.value;
    sel.innerHTML='<option value="">Бүгд</option>'+values.map(function(v){
      return '<option value="'+esc(v)+'">'+esc(labels?labels[v]:v)+'</option>';
    }).join("");
    if(cur && values.indexOf(cur)>=0) sel.value=cur;
  }

  function currentFilters(){
    function v(id){ var e=document.getElementById(id); return e?e.value:""; }
    return {roster:v("acctRoster"), from:v("acctFrom"), to:v("acctTo"), emp:v("acctEmp"), loc:v("acctLoc"), tek:v("acctTek"), kind:v("acctKind")||"all"};
  }

  function applyFilters(all, f){
    var r=f.roster?rosterById(f.roster):null;
    var members=r&&r.members&&Object.keys(r.members).length?r.members:null;
    var cycle=f.roster && String(f.roster).indexOf("cyc_")==0 && typeof window._cycleMatch==="function";
    return all.filter(function(s){
      var d=s.date||"";
      if(cycle){ if(!window._cycleMatch(s, f.roster)) return false; }
      else {
        if(r && (d<r.start || d>r.end)) return false;
        if(members && !members[s.employeeId]) return false;
      }
      if(f.from && d<f.from) return false;
      if(f.to && d>f.to) return false;
      if(f.emp && s.employeeId!==f.emp) return false;
      if(f.loc && (s.location||"")!==f.loc) return false;
      if(f.tek && tekOf(s)!==f.tek) return false;
      if(f.kind!=="all" && kindOf(s)!==f.kind) return false;
      return true;
    });
  }

  var _rows=[];
  window.renderAccountant=async function(opts){
    opts=opts||{};
    ensurePanel();
    if(opts.reload || !_loadedAt){
      await Promise.all([loadRosters(), loadAllSubs()]);
    }
    window._acctDirty=false;
    drawMembers();
    var sel=document.getElementById("acctRoster");
    var cur=sel.value;
    var rosters=listRosters();
    if(typeof window._cycleRosterOptions==="function") rosters=rosters.concat(window._cycleRosterOptions());
    sel.innerHTML='<option value="">Бүгд (бүх илгээлт)</option>'+rosters.map(function(r){
      return '<option value="'+esc(r.id)+'">'+esc(r.name)+' ('+r.start+' — '+r.end+')</option>';
    }).join("");
    if(cur && (rosterById(cur) || String(cur).indexOf("cyc_")==0)) sel.value=cur;
    var list=document.getElementById("rosterList");
    if(list) list.innerHTML=rosters.map(function(r){
      var n=Object.keys(r.members||{}).length;
      return '<div>'+esc(r.name)+' · '+r.start+' — '+r.end+' · '+n+' хүн</div>';
    }).join("");

    var users=(typeof getUsers==="function")?getUsers():{};
    var empIds={}, locs={}, teks={};
    _all.forEach(function(s){
      if(s.employeeId) empIds[s.employeeId]=s.employeeName||(users[s.employeeId]&&users[s.employeeId].name)||s.employeeId;
      if(s.location) locs[s.location]=1;
      var t=tekOf(s); if(t) teks[t]=1;
    });
    fillSelect("acctEmp", Object.keys(empIds).sort(function(a,b){ return String(empIds[a]).localeCompare(String(empIds[b])); }), empIds);
    fillSelect("acctLoc", Object.keys(locs).sort());
    fillSelect("acctTek", Object.keys(teks).sort());

    var f=currentFilters();
    var rows=applyFilters(_all, f);
    rows.sort(function(a,b){
      return String(b.date||"").localeCompare(String(a.date||""))
        || String(b.submittedAt||"").localeCompare(String(a.submittedAt||""))
        || String(a.employeeName||"").localeCompare(String(b.employeeName||""));
    });
    _rows=rows;
    window._acctRows=rows;

    var calcSum=0, colSum=0, overSum=0, shortSum=0, paidSum=0, emp={};
    var html=rows.map(function(s,i){
      var k=keySafe(s), p=_pays[k]||{}, d=diffOf(s), c=calcOf(s), col=collectedOf(s);
      calcSum+=c; colSum+=col;
      if(d<0) shortSum+=d; else overSum+=d;
      var paidAmt=p.paid?num(p.amount!=null?p.amount:Math.abs(d)):0;
      paidSum+=paidAmt;
      var e=emp[s.employeeId||"?"]||(emp[s.employeeId||"?"]={name:s.employeeName||s.employeeId||"?", id:s.employeeId||"", n:0, calc:0, col:0, over:0, short:0, paid:0});
      e.n++; e.calc+=c; e.col+=col; if(d<0) e.short+=d; else e.over+=d; e.paid+=paidAmt;
      return '<tr data-i="'+i+'" style="cursor:pointer">'
        +'<td>'+esc(s.date)+'</td><td>'+esc(s.shift||"—")+'</td><td>'+esc(s.employeeName||s.employeeId||"")+'</td><td>'+esc(s.location||"—")+'</td><td>'+esc(tekOf(s)||"—")+'</td><td>'+(kindOf(s)==="wine"?"Вино":"Пиво")+'</td>'
        +'<td>'+money(c)+'</td><td>'+money(col)+'</td>'
        +'<td class="'+diffCls(d)+'">'+signed(d)+'</td>'
        +'<td><input type="checkbox" class="acct-paid" data-k="'+esc(k)+'"'+(p.paid?' checked':'')+'></td>'
        +'<td><input type="number" class="acct-amt" data-k="'+esc(k)+'" value="'+(p.amount!=null?num(p.amount):(d<0?Math.abs(Math.round(d)):0))+'" style="width:90px"></td>'
        +'<td><button type="button" class="btn btn-sm" data-save="'+esc(k)+'">Хадгалах</button></td></tr>';
    }).join("");
    var body=document.getElementById("acctBody");
    body.innerHTML=html||'<tr><td colspan="12">Илгээлт алга</td></tr>';

    var eb=document.getElementById("acctEmpBody");
    var erows=Object.keys(emp).map(function(k){ return emp[k]; }).sort(function(a,b){ return (a.over+a.short)-(b.over+b.short) || String(a.name).localeCompare(String(b.name)); });
    eb.innerHTML=erows.map(function(e){
      var net=e.over+e.short;
      return '<tr><td style="text-align:left">'+esc(e.name)+(e.id?' <small style="color:#888">('+esc(e.id)+')</small>':'')+'</td><td>'+e.n+'</td><td>'+money(e.calc)+'</td><td>'+money(e.col)+'</td>'
        +'<td class="diff-over">'+signed(e.over)+'</td><td class="diff-short">'+signed(e.short)+'</td><td class="'+diffCls(net)+'"><strong>'+signed(net)+'</strong></td><td>'+money(e.paid)+'</td></tr>';
    }).join("")||'<tr><td colspan="8">—</td></tr>';
    if(erows.length>1){
      eb.innerHTML+='<tr style="font-weight:700;background:#e8f0fe"><td>НИЙТ</td><td>'+rows.length+'</td><td>'+money(calcSum)+'</td><td>'+money(colSum)+'</td><td class="diff-over">'+signed(overSum)+'</td><td class="diff-short">'+signed(shortSum)+'</td><td class="'+diffCls(overSum+shortSum)+'">'+signed(overSum+shortSum)+'</td><td>'+money(paidSum)+'</td></tr>';
    }

    var r=f.roster?rosterById(f.roster):null;
    var sum=document.getElementById("acctSummary");
    if(sum) sum.innerHTML=
      '<div class="summary-item"><div class="label">Хамрах хүрээ</div><div class="value" style="font-size:.95rem">'+(r?esc(r.start+" — "+r.end):((f.from||f.to)?esc((f.from||"…")+" — "+(f.to||"…")):"Бүх хугацаа"))+'</div></div>'
      +'<div class="summary-item"><div class="label">Илгээлт</div><div class="value">'+rows.length+' / '+_all.length+'</div></div>'
      +'<div class="summary-item"><div class="label">Бодолт</div><div class="value">'+money(calcSum)+'</div></div>'
      +'<div class="summary-item"><div class="label">Цуглуулсан</div><div class="value">'+money(colSum)+'</div></div>'
      +'<div class="summary-item"><div class="label">Илүү</div><div class="value diff-over">'+signed(overSum)+'</div></div>'
      +'<div class="summary-item"><div class="label">Дутуу</div><div class="value diff-short">'+signed(shortSum)+'</div></div>'
      +'<div class="summary-item"><div class="label">Цэвэр</div><div class="value '+diffCls(overSum+shortSum)+'">'+signed(overSum+shortSum)+'</div></div>'
      +'<div class="summary-item"><div class="label">Төлсөн</div><div class="value">'+money(paidSum)+'</div></div>';
    var stamp=document.getElementById("acctStamp");
    if(stamp) stamp.textContent=_loadedAt?("Серверээс уншсан: "+new Date(_loadedAt).toLocaleTimeString("mn-MN")):"";
    if(_loadErr && typeof showAlert==="function") showAlert("acctAlert", _loadErr, "error");
  };

  function showDetail(i){
    var s=_rows[i];
    var box=document.getElementById("acctDetail");
    if(!s||!box) return;
    var d=diffOf(s);
    var items=(s.items||[]).filter(function(it){ return it && (num(it.sold)||num(it.prev)||num(it.next)||num(it.income)); });
    box.innerHTML='<div class="card" style="margin:12px 0;border:2px solid #0f3460;box-shadow:none">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><h3 style="margin:0">'+esc(s.employeeName||s.employeeId)+' — '+esc(s.date)+' ('+esc(s.shift||"—")+')'+(s.locked?" 🔒":"")+'</h3>'
      +'<button type="button" class="btn btn-secondary btn-sm" id="acctDetailClose">Хаах</button></div>'
      +'<p style="margin:6px 0">'+esc(s.location||"—")+' · Тек: '+esc(tekOf(s)||"—")+' · '+(kindOf(s)==="wine"?"Вино":"Пиво")+(s.checkerName?' · Шалгагч: '+esc(s.checkerName):'')+(s.posNumber?' · POS: '+esc(s.posNumber):'')+'</p>'
      +'<div class="table-wrap"><table><thead><tr><th>Бараа</th><th>Үнэ</th><th>Өмнөх</th><th>Дараах</th><th>Зарсан</th><th>Орлого</th></tr></thead><tbody>'
      +(items.map(function(it){ return '<tr><td style="text-align:left">'+esc(it.name)+'</td><td>'+num(it.price).toLocaleString()+'</td><td>'+num(it.prev)+'</td><td>'+num(it.next)+'</td><td>'+num(it.sold)+'</td><td>'+money(it.income)+'</td></tr>'; }).join("")||'<tr><td colspan="6">Бараа алга</td></tr>')
      +'</tbody></table></div>'
      +'<p>Бэлэн: '+money(s.cashAmount)+' · Эхлэл дүн: '+money(s.cashBalance)+' · Карт: '+money(s.cardTotal)+'</p>'
      +'<p>Бодолт: <strong>'+money(calcOf(s))+'</strong> · Цуглуулсан: <strong>'+money(collectedOf(s))+'</strong> · Зөрүү: <strong class="'+diffCls(d)+'">'+signed(d)+'</strong></p>'
      +'<p style="font-size:.8rem;color:#666">Илгээсэн: '+(s.submittedAt?esc(new Date(s.submittedAt).toLocaleString("mn-MN")):"—")+(s.editedBy?' · Зассан: '+esc(s.editedBy):'')+' · Зөвхөн харах</p>'
      +'</div>';
    document.getElementById("acctDetailClose").onclick=function(){ box.innerHTML=""; };
    box.scrollIntoView({behavior:"smooth", block:"start"});
  }

  window.savePayment=async function(k){
    var paid=document.querySelector('.acct-paid[data-k="'+k+'"]');
    var amt=document.querySelector('.acct-amt[data-k="'+k+'"]');
    var rec={paid:!!(paid&&paid.checked), amount:num(amt&&amt.value), at:new Date().toISOString(), by:me().id||""};
    var base=await authed();
    if(!base){ if(typeof showAlert==="function") showAlert("acctAlert","Сервер алга","error"); return; }
    try{
      await base.ref("borluulalt/payments/"+k).set(rec);
      _pays[k]=rec;
      if(typeof showAlert==="function") showAlert("acctAlert","Төлөлт хадгаллаа","success");
      window.renderAccountant();
    }catch(e){
      if(typeof showAlert==="function") showAlert("acctAlert","Хадгалагдсангүй","error");
    }
  };

  window.exportAccountantCSV=function(){
    var rows=_rows||[];
    function q(v){ v=String(v==null?"":v); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }
    var csv="Огноо,Ээлж,Ажилтан,ID,Байршил,Тек,Төрөл,Бэлэн,Карт,Эхлэл дүн,POS,Бодолт,Цуглуулсан,Зөрүү,Төлөв,Төлсөн,Төлсөн дүн,Илгээсэн\n";
    rows.forEach(function(s){
      var d=diffOf(s), p=_pays[keySafe(s)]||{};
      csv+=[s.date,s.shift,s.employeeName,s.employeeId,s.location,tekOf(s),kindOf(s)==="wine"?"Вино":"Пиво",
        num(s.cashAmount),num(s.cardTotal),num(s.cashBalance),s.posNumber||"",Math.round(calcOf(s)),Math.round(collectedOf(s)),Math.round(d),
        Math.abs(d)<0.01?"Тохирсон":(d>0?"Илүү":"Дутуу"), p.paid?"Тийм":"", p.paid?num(p.amount):"", s.submittedAt||""].map(q).join(",")+"\n";
    });
    var blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    var a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="borluulalt_nyagtlan_"+today()+".csv";
    a.click();
  };

  /* header buttons (Excel / Мэдээлэл шинэчлэх) act on the accountant page for accountants */
  function wrapHeader(){
    if(typeof window.exportCSV==="function" && !window.exportCSV._acctCsv){
      var pe=window.exportCSV;
      var fe=function(){
        if(role()==="accountant") return window.exportAccountantCSV();
        if(role()==="supervisor"){
          /* ахлах: export only today's rows (never fall back to all submissions) */
          var g=window.getSubs, rr=window._reportRows;
          var todayOnly=function(l){ return filterSubs(l||[]); };
          window._reportRows=todayOnly(rr&&rr.length?rr:(typeof g==="function"?g():[]));
          window.getSubs=function(){ return todayOnly(g.apply(this, arguments)); };
          try{ return pe.apply(this, arguments); } finally { window.getSubs=g; window._reportRows=rr; }
        }
        return pe.apply(this, arguments);
      };
      copyFlags(pe, fe); fe._acctCsv=true; window.exportCSV=fe;
    }
    if(typeof window.refreshData==="function" && !window.refreshData._acct){
      var pr=window.refreshData;
      var fr=async function(){
        if(role()==="accountant"){ await window.renderAccountant({reload:true}); if(typeof showAlert==="function") showAlert("acctAlert","Мэдээлэл шинэчлэгдлээ","success"); return; }
        return pr.apply(this, arguments);
      };
      copyFlags(pr, fr); fr._acct=true; window.refreshData=fr;
    }
  }

  /* ---------- role router ---------- */
  function migrateDraft(u){
    try{
      if(!u||u.role!=="employee"||!u.id) return;
      var anon="borluulalt_emp_draft_anon", mine="borluulalt_emp_draft_"+u.id;
      var a=localStorage.getItem(anon);
      if(a && !localStorage.getItem(mine)){ localStorage.setItem(mine, a); localStorage.removeItem(anon); }
    }catch(e){}
  }
  if(typeof window.showApp==="function" && !window.showApp._acct){
    var _sa=window.showApp;
    var sa=function(){
      var u=me();
      if(u.role==="accountant"){
        document.getElementById("loginSection").classList.add("hidden");
        document.getElementById("appSection").classList.remove("hidden");
        document.getElementById("userNameDisplay").textContent=u.name+" ("+u.id+")";
        var badge=document.getElementById("roleBadge");
        if(badge){ badge.textContent="Нягтлан"; badge.className="role-badge role-sup"; badge.style.background="#8e44ad"; }
        var ev=document.getElementById("employeeView"); if(ev) ev.classList.add("hidden");
        var sv=document.getElementById("supervisorView"); if(sv) sv.classList.add("hidden");
        ensurePanel();
        var av=document.getElementById("accountantView");
        if(av){ av.classList.remove("hidden"); av.style.display=""; }
        window.renderAccountant({reload:true});
        if(typeof updateSyncBadge==="function") updateSyncBadge("ok");
        return;
      }
      var badge2=document.getElementById("roleBadge"); if(badge2) badge2.style.background="";
      var av2=document.getElementById("accountantView");
      if(av2) av2.classList.add("hidden");
      migrateDraft(u);
      return _sa.apply(this, arguments);
    };
    copyFlags(_sa, sa); sa._acct=true; window.showApp=sa;
  }

  function patchRole(){
    var r=document.getElementById("newUserRole");
    if(r && !r.querySelector('option[value="accountant"]')){
      var o=document.createElement("option");
      o.value="accountant"; o.textContent="Нягтлан";
      r.appendChild(o);
    }
    document.querySelectorAll("select[id^='usr_role_']").forEach(function(sel){
      if(!sel.querySelector('option[value="accountant"]')){
        var o2=document.createElement("option");
        o2.value="accountant"; o2.textContent="Нягтлан";
        sel.appendChild(o2);
        var id=sel.id.replace("usr_role_","");
        var users=(typeof getUsers==="function")?getUsers():{};
        if(users[id]&&users[id].role==="accountant") sel.value="accountant";
      }
    });
  }

  wrapList("renderSubmissionsList");
  wrapList("renderSubmissionsListEnhanced");
  wrapList("renderOverview");
  wrapHeader();
  setInterval(function(){
    patchRole();
    wrapList("renderSubmissionsList");
    wrapList("renderSubmissionsListEnhanced");
    wrapHeader();
  }, 1500);
  /* no auto-refresh: data is read only on login and on "Шинэчлэх" / "Мэдээлэл шинэчлэх" (delta, see net_gate.js) */
})();
