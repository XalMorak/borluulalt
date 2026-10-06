/* acct_users.js — Нягтлан: хэрэглэгч нэмэх / засах / хасах.
   Writes ONLY borluulalt/users/<id> through update() on that one key.
   Never replaces the whole users node or any other node.
   Guards: cannot delete yourself, cannot change your own role,
   cannot delete or demote the last Ахлах (supervisor). */
(function(){
  if(window._acctUsers) return;
  window._acctUsers=true;

  var ROLES=[["employee","Ажилтан"],["supervisor","Ахлах"],["accountant","Нягтлан"]];
  var DEL="deleted_user_ids";      // shared with user_fix.js mergeUsers()
  var _cloud=null;                 // last fresh read of borluulalt/users

  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function roleLabel(r){ for(var i=0;i<ROLES.length;i++) if(ROLES[i][0]===r) return ROLES[i][1]; return r||"Ажилтан"; }
  function me(){ var u=window.currentUser||{}; return {id:String(u.id||"").toLowerCase(), role:u.role||""}; }
  function isAcct(){ return me().role==="accountant"; }
  function db(){
    try{
      if(window._fbDb && window._fbDb.ref) return window._fbDb;
      if(typeof initFirebase==="function") initFirebase();
      if(window._fbDb && window._fbDb.ref) return window._fbDb;
      if(window.firebase && firebase.database) return firebase.database();
    }catch(e){}
    return null;
  }
  async function auth(){ try{ if(typeof ensureFirebaseAuth==="function") await ensureFirebaseAuth(); }catch(e){} }
  function asUsers(v){
    var o={};
    if(!v || typeof v!=="object") return o;
    Object.keys(v).forEach(function(k){ if(v[k] && typeof v[k]==="object" && v[k].name) o[String(k)]=v[k]; });
    return o;
  }
  function alertMsg(t, kind){
    if(typeof showAlert==="function") showAlert("auAlert", t, kind||"success");
    else { var b=document.getElementById("auAlert"); if(b) b.textContent=t; }
  }
  function delList(){ try{ return JSON.parse(localStorage.getItem(DEL)||"[]")||[]; }catch(e){ return []; } }
  function remember(id){ var a=delList(); if(a.indexOf(id)<0) a.push(id); localStorage.setItem(DEL, JSON.stringify(a.slice(-400))); }
  function forget(id){ localStorage.setItem(DEL, JSON.stringify(delList().filter(function(x){ return String(x)!==id; }))); }
  function setLocal(id, rec){
    if(typeof getUsers!=="function" || typeof setUsers!=="function") return;
    var u=Object.assign({}, getUsers()||{});
    if(rec) { u[id]=rec; forget(id); }
    else { delete u[id]; remember(id); }
    setUsers(u);
  }
  function log(action, detail){ try{ if(typeof addLog==="function") addLog(action, detail); }catch(e){} }

  async function readCloud(){
    await auth();
    var base=db();
    if(!base) throw new Error("no-db");
    var snap=await base.ref("borluulalt/users").once("value");
    _cloud=asUsers(snap.val());
    return _cloud;
  }
  function supervisors(users){ return Object.keys(users).filter(function(k){ return (users[k].role||"")==="supervisor" && !users[k].disabled; }); }

  /* the only write primitive: one key under borluulalt/users */
  async function writeOne(id, rec){
    var base=db();
    if(!base) throw new Error("no-db");
    var patch={}; patch[id]=rec;            // rec===null removes just this key
    await base.ref("borluulalt/users").update(patch);
    var back=(await base.ref("borluulalt/users/"+id).once("value")).val();
    if(rec ? !(back && back.name===rec.name && (back.role||"")===rec.role) : back!=null) throw new Error("verify");
  }

  function validId(id){ return /^[a-z0-9_-]{2,32}$/.test(id); }
  function validPin(pin, role){
    if(!pin) return role==="employee" ? "" : "Ахлах / Нягтлан эрхтэй хэрэглэгчид PIN заавал";
    if(!/^[0-9A-Za-z]{3,12}$/.test(pin)) return "PIN 3–12 тэмдэгт (тоо/үсэг), зай байж болохгүй";
    return "";
  }

  window.acctAddUser=async function(){
    if(!isAcct()) return;
    var id=(document.getElementById("auNewId").value||"").trim().toLowerCase();
    var name=(document.getElementById("auNewName").value||"").trim();
    var role=document.getElementById("auNewRole").value||"employee";
    var pin=(document.getElementById("auNewPin").value||"").trim();
    if(!validId(id)) return alertMsg("ID: 2–32 тэмдэгт, зөвхөн латин жижиг үсэг, тоо, _ эсвэл -","error");
    if(!name) return alertMsg("Нэр оруулна уу","error");
    var pe=validPin(pin, role); if(pe) return alertMsg(pe,"error");
    try{
      var cloud=await readCloud();
      if(cloud[id]) return alertMsg("Ийм ID аль хэдийн байна: "+id,"error");
      var rec={name:name, role:role, pin:pin, createdAt:new Date().toISOString(), createdBy:me().id};
      await writeOne(id, rec);
      setLocal(id, rec); _cloud[id]=rec;
      log("user_add", id+" ("+roleLabel(role)+")");
      ["auNewId","auNewName","auNewPin"].forEach(function(k){ document.getElementById(k).value=""; });
      document.getElementById("auNewRole").value="employee";
      alertMsg(name+" ("+id+") нэмэгдлээ","success");
    }catch(e){ console.warn("acctAddUser",e); alertMsg("Серверт хадгалагдсангүй. Дахин оролдоно уу.","error"); }
    draw();
  };

  window.acctSaveUser=async function(id){
    if(!isAcct()) return;
    var tr=document.querySelector('#auBody tr[data-uid="'+CSS.escape(id)+'"]');
    if(!tr) return;
    var name=(tr.querySelector(".au-name").value||"").trim();
    var role=tr.querySelector(".au-role").value||"employee";
    var pin=(tr.querySelector(".au-pin").value||"").trim();
    if(!name) return alertMsg("Нэр хоосон байж болохгүй","error");
    var pe=validPin(pin, role); if(pe) return alertMsg(pe,"error");
    try{
      var cloud=await readCloud();
      var cur=cloud[id];
      if(!cur) return alertMsg("Энэ хэрэглэгч серверт алга (өөр төхөөрөмжөөс устгагдсан байж магадгүй)","error"), draw();
      if(id===me().id && role!==(cur.role||"")) return alertMsg("Өөрийн эрхийг өөрчлөх боломжгүй","error");
      if((cur.role||"")==="supervisor" && role!=="supervisor" && supervisors(cloud).length<=1)
        return alertMsg("Сүүлийн Ахлахын эрхийг өөрчлөх боломжгүй. Эхлээд өөр Ахлах нэмнэ үү.","error");
      var rec=Object.assign({}, cur, {name:name, role:role, pin:pin, updatedAt:new Date().toISOString(), updatedBy:me().id});
      await writeOne(id, rec);
      setLocal(id, rec); _cloud[id]=rec;
      log("user_edit", id);
      alertMsg(name+" ("+id+") хадгалагдлаа","success");
    }catch(e){ console.warn("acctSaveUser",e); alertMsg("Серверт хадгалагдсангүй. Дахин оролдоно уу.","error"); }
    draw();
  };

  window.acctDeleteUser=async function(id){
    if(!isAcct()) return;
    if(id===me().id) return alertMsg("Өөрийгөө устгах боломжгүй","error");
    try{
      var cloud=await readCloud();
      var cur=cloud[id];
      if(!cur){ setLocal(id, null); draw(); return alertMsg("Серверт аль хэдийн алга байсан","success"); }
      if((cur.role||"")==="supervisor" && supervisors(cloud).length<=1)
        return alertMsg("Сүүлийн Ахлахыг устгах боломжгүй. Эхлээд өөр Ахлах нэмнэ үү.","error");
      if(!confirm((cur.name||id)+" ("+id+", "+roleLabel(cur.role)+")\nхэрэглэгчийг устгах уу? Энэ хэрэглэгч дахин нэвтэрч чадахгүй.")) return;
      await writeOne(id, null);
      setLocal(id, null); delete _cloud[id];
      log("user_delete", id);
      alertMsg((cur.name||id)+" устгагдлаа","success");
    }catch(e){ console.warn("acctDeleteUser",e); alertMsg("Серверт устгагдсангүй. Дахин оролдоно уу.","error"); }
    draw();
  };

  function ensureStyle(){
    if(document.getElementById("auStyle")) return;
    var st=document.createElement("style");
    st.id="auStyle";
    st.textContent=
      ".au-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0}"
      +".au-toolbar input,.au-toolbar select{padding:7px;border:1px solid #ccc;border-radius:6px;font-size:16px}"
      +".au-table{min-width:560px}.au-table td{vertical-align:middle}"
      +".au-table input,.au-table select{width:100%;min-width:90px;padding:6px;border:1px solid #ccc;border-radius:6px;font-size:16px}"
      +".au-table td.au-act{white-space:nowrap}.au-table .btn{margin:2px}"
      +".au-me{display:inline-block;margin-left:4px;padding:1px 6px;border-radius:10px;background:#e8f0fe;color:#0f3460;font-size:.7rem}"
      +".au-role-supervisor{color:#c0392b}.au-role-accountant{color:#8e44ad}"
      +"@media(max-width:700px){.au-toolbar>*{flex:1 1 140px}}";
    document.head.appendChild(st);
  }

  function ensurePane(){
    var pane=document.getElementById("acctPaneUsers");
    if(!pane) return null;
    if(document.getElementById("auBody")) return pane;
    ensureStyle();
    var opts=ROLES.map(function(r){ return '<option value="'+r[0]+'">'+r[1]+'</option>'; }).join("");
    pane.innerHTML=
      '<div class="card" style="padding:14px;margin-bottom:12px;box-shadow:none;border:1px solid #e5e7eb">'
      +'<h3 style="margin:0 0 6px">Хэрэглэгч нэмэх</h3>'
      +'<div class="header-info">'
      +'<div><label>ID</label><input id="auNewId" placeholder="emp010" autocomplete="off" autocapitalize="none"></div>'
      +'<div><label>Нэр</label><input id="auNewName" placeholder="Овог нэр"></div>'
      +'<div><label>Эрх</label><select id="auNewRole">'+opts+'</select></div>'
      +'<div><label>PIN</label><input id="auNewPin" type="password" inputmode="numeric" autocomplete="new-password" placeholder="1234"></div>'
      +'<div style="display:flex;align-items:flex-end"><button type="button" class="btn btn-success btn-sm" id="auAdd">+ Нэмэх</button></div>'
      +'</div>'
      +'<p style="margin:0;color:#5b6570;font-size:.8rem">ID нь нэвтрэх нэр. Ахлах / Нягтлан эрхэд PIN заавал.</p>'
      +'</div>'
      +'<div id="auAlert"></div>'
      +'<h3 style="margin:6px 0 4px">Хэрэглэгчид <small id="auCount" style="font-weight:400;color:#666"></small></h3>'
      +'<div class="au-toolbar">'
      +'<input id="auSearch" placeholder="Хайх (ID / нэр)">'
      +'<select id="auRoleFilter"><option value="">Бүх эрх</option>'+opts+'</select>'
      +'<label style="font-size:.85rem"><input type="checkbox" id="auShowPin"> PIN харуулах</label>'
      +'<button type="button" class="btn btn-outline btn-sm" id="auReload">Шинэчлэх</button>'
      +'</div>'
      +'<div class="table-wrap"><table class="au-table"><thead><tr><th>ID</th><th>Нэр</th><th>Эрх</th><th>PIN</th><th></th></tr></thead><tbody id="auBody"></tbody></table></div>';
    document.getElementById("auAdd").onclick=function(){ window.acctAddUser(); };
    document.getElementById("auReload").onclick=function(){ window.renderAcctUsers(); };
    document.getElementById("auSearch").oninput=draw;
    document.getElementById("auRoleFilter").onchange=draw;
    document.getElementById("auShowPin").onchange=function(){
      var t=this.checked?"text":"password";
      document.querySelectorAll("#auBody .au-pin, #auNewPin").forEach(function(el){ el.type=t; });
    };
    document.getElementById("auBody").addEventListener("click", function(ev){
      var b=ev.target.closest("button[data-act]");
      if(!b) return;
      var id=b.closest("tr").getAttribute("data-uid");
      if(b.getAttribute("data-act")==="save") window.acctSaveUser(id);
      else window.acctDeleteUser(id);
    });
    document.getElementById("auBody").addEventListener("input", function(ev){
      var tr=ev.target.closest("tr"); if(tr) tr.style.background="#fffbe6";
    });
    return pane;
  }

  function draw(){
    var tb=document.getElementById("auBody");
    if(!tb) return;
    var users=_cloud || asUsers(typeof getUsers==="function"?getUsers():{});
    var q=((document.getElementById("auSearch")||{}).value||"").trim().toLowerCase();
    var rf=(document.getElementById("auRoleFilter")||{}).value||"";
    var show=(document.getElementById("auShowPin")||{}).checked;
    var myId=me().id;
    var sups=supervisors(users).length;
    var order={accountant:0,supervisor:1,employee:2};
    var ids=Object.keys(users).sort(function(a,b){
      var ra=order[users[a].role||"employee"], rb=order[users[b].role||"employee"];
      if(ra!==rb) return (ra==null?3:ra)-(rb==null?3:rb);
      return a<b?-1:a>b?1:0;
    });
    var shown=0;
    tb.innerHTML=ids.map(function(id){
      var u=users[id], r=u.role||"employee";
      if(rf && r!==rf) return "";
      if(q && (id+" "+(u.name||"")).toLowerCase().indexOf(q)<0) return "";
      shown++;
      var self=id===myId, lastSup=r==="supervisor" && sups<=1;
      var opts=ROLES.map(function(x){ return '<option value="'+x[0]+'"'+(x[0]===r?" selected":"")+'>'+x[1]+'</option>'; }).join("");
      var why=self?"Өөрийгөө устгах боломжгүй":(lastSup?"Сүүлийн Ахлах":"");
      return '<tr data-uid="'+esc(id)+'">'
        +'<td style="text-align:left"><b class="au-role-'+esc(r)+'">'+esc(id)+'</b>'+(self?'<span class="au-me">та</span>':'')+(u.disabled?' <small style="color:#999">(идэвхгүй)</small>':'')+'</td>'
        +'<td><input class="au-name" value="'+esc(u.name||"")+'"></td>'
        +'<td><select class="au-role"'+(self?' disabled title="Өөрийн эрхийг өөрчлөх боломжгүй"':'')+'>'+opts+'</select></td>'
        +'<td><input class="au-pin" type="'+(show?"text":"password")+'" inputmode="numeric" autocomplete="new-password" value="'+esc(u.pin||"")+'" placeholder="—"></td>'
        +'<td class="au-act"><button type="button" class="btn btn-success btn-sm" data-act="save">Хадгалах</button>'
        +'<button type="button" class="btn btn-danger btn-sm" data-act="del"'+(why?' disabled title="'+why+'" style="opacity:.45;cursor:not-allowed"':'')+'>Устгах</button></td>'
        +'</tr>';
    }).join("") || '<tr><td colspan="5" style="color:#888">Хэрэглэгч олдсонгүй</td></tr>';
    var c=document.getElementById("auCount");
    if(c) c.textContent="("+shown+" / "+ids.length+")";
  }

  window.renderAcctUsers=async function(){
    if(!isAcct()) return;
    if(!ensurePane()) return;
    draw();
    try{ await readCloud(); }catch(e){ alertMsg("Серверээс уншиж чадсангүй — дотоод жагсаалт харуулж байна","error"); }
    draw();
  };
})();
