/* acct_bugs.js — Нягтлан → "Алдаа": ирсэн алдааны мэдэгдлүүд (зөвхөн харах) + төлөв солих
   (new → fixing → fixed). Бичилт: зөвхөн borluulalt/reports/<id>/{status,statusAt,statusBy}. */
(function(){
  if(window._acctBugs) return; window._acctBugs=true;
  var ST={ new:"Шинэ", fixing:"Засаж байна", fixed:"Зассан" };
  var _list=[], _err="";
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function db(){
    try{ if(typeof window._realDb==="function" && window._realDb()) return window._realDb(); }catch(e){}
    try{ return firebase.database(); }catch(e2){ return null; }
  }
  function ensure(){
    var tabs=document.getElementById("acctTabs"), root=document.getElementById("accountantView");
    if(!tabs || !root || document.getElementById("acctPaneBugs")) return;
    if(!tabs.querySelector('button[data-acct-tab="bugs"]')){
      var b=document.createElement("button"); b.type="button"; b.className="tab-btn"; b.setAttribute("data-acct-tab","bugs"); b.textContent="Алдаа";
      tabs.appendChild(b);
    }
    var pane=document.createElement("div"); pane.id="acctPaneBugs"; pane.className="hidden";
    pane.innerHTML='<h3 style="margin:6px 0">Алдааны мэдэгдэл</h3>'
      +'<div class="header-info no-print"><div><label>Төлөв</label><select id="bugF"><option value="">Бүгд</option><option value="new">Шинэ</option><option value="fixing">Засаж байна</option><option value="fixed">Зассан</option></select></div>'
      +'<div><label>Төрөл</label><select id="bugK"><option value="">Бүгд</option><option value="user">Хэрэглэгч</option><option value="auto">Автомат</option></select></div>'
      +'<div style="display:flex;align-items:flex-end"><button type="button" class="btn btn-sm" id="bugReload">Шинэчлэх</button></div></div>'
      +'<div id="bugListAlert"></div><div id="bugList" class="bug-list"></div>';
    root.appendChild(pane);
    document.getElementById("bugF").onchange=draw;
    document.getElementById("bugK").onchange=draw;
    document.getElementById("bugReload").onclick=function(){ load().then(draw); };
    pane.addEventListener("change", function(ev){
      var s=ev.target.closest("select[data-bug]"); if(s) setStatus(s.getAttribute("data-bug"), s.value);
    });
    pane.addEventListener("click", function(ev){
      var a=ev.target.closest("[data-shot]"); if(!a) return;
      var r=_list.find(function(x){ return x.key===a.getAttribute("data-shot"); });
      if(r && r.shot){ var w=window.open(); if(w) w.document.write('<img src="'+r.shot+'" style="max-width:100%">'); }
    });
  }
  async function load(){
    _err="";
    var base=db(); if(!base){ _err="Сервер алга"; return; }
    try{
      var v=(await base.ref("borluulalt/reports").orderByChild("at").limitToLast(300).once("value")).val()||{};
      _list=Object.keys(v).map(function(k){ var r=v[k]||{}; r.key=k; return r; }).sort(function(a,b){ return String(b.at||"").localeCompare(String(a.at||"")); });
    }catch(e){ _err="Уншиж чадсангүй: "+(e && e.code || e); }
  }
  function draw(){
    var box=document.getElementById("bugList"); if(!box) return;
    var f=(document.getElementById("bugF")||{}).value||"", k=(document.getElementById("bugK")||{}).value||"";
    if(_err && typeof showAlert==="function") showAlert("bugListAlert", _err, "error");
    var rows=_list.filter(function(r){ return (!f || r.status===f) && (!k || r.kind===k); });
    var counts={ new:0, fixing:0, fixed:0 }; _list.forEach(function(r){ if(counts[r.status]!=null) counts[r.status]++; });
    box.innerHTML='<div class="bug-counts">Шинэ: <b>'+counts.new+'</b> · Засаж байна: <b>'+counts.fixing+'</b> · Зассан: <b>'+counts.fixed+'</b></div>'
      +(rows.map(function(r){
        var c=r.ctx||{};
        return '<div class="bug-item st-'+esc(r.status)+'" data-key="'+esc(r.key)+'">'
          +'<div class="bug-item-h"><span class="bug-kind '+esc(r.kind)+'">'+(r.kind==="auto"?"Автомат":"Хэрэглэгч")+'</span> <b>'+esc(r.category||"Бусад")+'</b> · '+esc(r.by)+' ('+esc(r.role)+') · '+esc(r.at?new Date(r.at).toLocaleString("mn-MN"):"")
          +'<select data-bug="'+esc(r.key)+'" class="bug-st">'+Object.keys(ST).map(function(s){ return '<option value="'+s+'"'+(r.status===s?" selected":"")+'>'+ST[s]+'</option>'; }).join("")+'</select></div>'
          +'<div class="bug-text">'+esc(r.text)+'</div>'
          +'<div class="bug-ctx">'+esc([c.tab&&("таб: "+c.tab), c.ver&&("хувилбар: "+c.ver), c.mode, c.view, c.online===false?"офлайн":""].filter(Boolean).join(" · "))
          +(r.shot?' · <a href="#" data-shot="'+esc(r.key)+'" onclick="return false">зураг</a>':'')+'</div>'
          +'</div>';
      }).join("") || '<div class="bug-empty">Мэдэгдэл алга</div>');
  }
  async function setStatus(key, st){
    if(!ST[st]) return;
    var base=db(); if(!base) return;
    var u=window.currentUser||{};
    try{
      await base.ref("borluulalt/reports/"+key).update({ status:st, statusAt:new Date().toISOString(), statusBy:String(u.id||"") });
      var r=_list.find(function(x){ return x.key===key; }); if(r) r.status=st;
      if(typeof showAlert==="function") showAlert("bugListAlert", "Төлөв: "+ST[st], "success");
    }catch(e){ if(typeof showAlert==="function") showAlert("bugListAlert", "Хадгалагдсангүй", "error"); }
    draw();
  }
  window.renderAcctBugs=async function(){ ensure(); await load(); draw(); };
  ensure();
  App.keep(ensure);
})();
