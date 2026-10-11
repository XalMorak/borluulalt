/* sup_users.js — Ахлах → Хэрэглэгч: зөвхөн шинэ АЖИЛТАН нэмнэ.
   - ID + нэр. Эрх үргэлж "employee", PIN талбар байхгүй.
   - Шинэ ажилтан {disabled:true, pending:true}: Нягтлан идэвхжүүлж (PIN тохируулж) байж нэвтэрнэ.
     REQUIRE_PIN=staff үед ажилтан PIN-гүй нэвтэрч чаддаг тул идэвхгүй үүсгэх нь ахлахын нэмсэн
     хүн шууд нэвтрэх боломжийг хаана.
   - Байгаа хэрэглэгчийг засах / устгах / эрх солих / PIN харах боломжгүй (хүснэгт зөвхөн харах, PIN-гүй).
   - Бичилт: зөвхөн borluulalt/users/<шинэ id>, байхгүй үед (transaction). Strict дүрэм ч үүнийг шаардана.
   Нэг удаа суулгана (app2.js-ийн хуучин addUser / saveUserRow / deleteUser / buildUsersTable-г солино). */
(function(){
  if(window._supUsers) return; window._supUsers=true;
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function me(){ var u=window.currentUser||{}; return { id:String(u.id||"").toLowerCase(), role:u.role||"" }; }
  function say(t, kind){ if(typeof showAlert==="function") showAlert("userAlert", t, kind||"error"); }
  function db(){
    try{ if(typeof window._realDb==="function" && window._realDb()) return window._realDb(); }catch(e){}
    try{ if(typeof initFirebase==="function") initFirebase(); }catch(e2){}
    return window._fbDb||null;
  }
  var ROLE={ employee:"Ажилтан", supervisor:"Ахлах", accountant:"Нягтлан" };
  function status(u){ return u.pending ? "Хүлээгдэж буй" : (u.disabled ? "Идэвхгүй" : "Идэвхтэй"); }

  function buildUsersTable(){
    var tb=document.getElementById("usersBody"); if(!tb) return;
    var users=(typeof getUsers==="function"?getUsers():{})||{};
    var order={ accountant:0, supervisor:1, employee:2 };
    var ids=Object.keys(users).filter(function(k){ return users[k] && users[k].name; }).sort(function(a,b){
      var ra=order[users[a].role]!=null?order[users[a].role]:3, rb=order[users[b].role]!=null?order[users[b].role]:3;
      return ra-rb || (a<b?-1:a>b?1:0);
    });
    tb.innerHTML=ids.map(function(id){
      var u=users[id];
      return '<tr data-uid="'+esc(id)+'"><td>'+esc(id)+'</td><td>'+esc(u.name)+'</td><td>'+esc(ROLE[u.role]||u.role||"")+'</td><td class="sup-user-st'+(u.pending?" pending":u.disabled?" off":"")+'">'+status(u)+'</td></tr>';
    }).join("") || '<tr><td colspan="4">—</td></tr>';
  }

  async function addUser(){
    if(me().role!=="supervisor" && me().role!=="accountant") return say("Эрх хүрэхгүй");
    var idEl=document.getElementById("newUserId"), nmEl=document.getElementById("newUserName");
    var id=(idEl&&idEl.value||"").trim().toLowerCase(), name=(nmEl&&nmEl.value||"").trim();
    if(!/^[a-z0-9_-]{2,32}$/.test(id)) return say("ID: 2–32 тэмдэгт, зөвхөн латин жижиг үсэг, тоо, _ эсвэл -");
    if(!name || name.length>80) return say("Нэр оруулна уу");
    var base=db(); if(!base) return say("Сервертэй холбогдсонгүй");
    try{ if(typeof ensureFirebaseAuth==="function") await ensureFirebaseAuth(); }catch(e){}
    var rec={ name:name, role:"employee", disabled:true, pending:true, createdAt:new Date().toISOString(), createdBy:me().id };
    try{
      /* create only: never overwrite an existing user (incl. one this device doesn't know yet) */
      var res=await base.ref("borluulalt/users/"+id).transaction(function(cur){ return cur ? undefined : rec; });
      if(!res.committed) return say("Ийм ID аль хэдийн байна: "+id);
    }catch(e){ console.warn("addUser", e); return say("Серверт нэмэгдсэнгүй. Дахин оролдоно уу."); }
    try{ var users=getUsers()||{}; users[id]=rec; setUsers(users); }catch(e){}
    try{ var ids=JSON.parse(localStorage.getItem("deleted_user_ids")||"[]").filter(function(x){ return x!==id; }); localStorage.setItem("deleted_user_ids", JSON.stringify(ids)); }catch(e){}
    try{ if(typeof addLog==="function") addLog("user_add_pending", id); }catch(e){}
    if(idEl) idEl.value=""; if(nmEl) nmEl.value="";
    say(name+" ("+id+") нэмэгдлээ — Нягтлан идэвхжүүлсний дараа нэвтэрнэ.", "success");
    buildUsersTable();
    if(typeof updateLoginHint==="function") updateLoginHint();
  }
  function denied(){ say("Хэрэглэгч засах, устгах, эрх болон PIN-ийг Нягтлан удирдана (Нягтлан → Хэрэглэгч)."); }

  window.buildUsersTable=buildUsersTable;
  window.addUser=addUser;
  window.saveUserRow=denied;
  window.deleteUser=denied;
})();
