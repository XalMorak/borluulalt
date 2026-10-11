/* bug_report.js — "Алдаа мэдэгдэх" (бүх эрх) + алдааг автоматаар барих.
   - window.onerror / unhandledrejection / console.error → сүүлийн 20-ийг санах ойд.
   - Нэвтэрсэн үед барьсан алдааг kind:"auto" мэдэгдэл болгож илгээнэ (нэг сессэд ≤5, ижил мессежийг 1 удаа).
   - Хэрэглэгчийн мэдэгдэл: тайлбар (≤2000, заавал), ангилал, зураг (≤300KB JPEG data URL, сонголттой).
   Бичилт: borluulalt/reports/<pushId> = {at, by, role, kind, category, text, ctx{…}, status:"new", shot?}.
   PIN / token хэзээ ч орохгүй (ctx-д зөвхөн доорх талбарууд; текстээс pin=… / Bearer … арилгана).
   Хуучин бичлэгийг дахин бичихгүй — шинэ түлхүүр (push) л үүсгэнэ. */
(function(){
  if(window._bugReport) return; window._bugReport=true;
  var MAX_ERR=20, MAX_AUTO=5, TEXT_MAX=2000, SHOT_MAX=300*1024;
  var errs=[], seen={}, autoSent=0, sending=false, cfgVer=null;
  var CATS=["Нэвтрэх","Илгээлт","Нөөц","Тайлан","Хэрэглэгч","Бусад"];

  function scrub(s){
    return String(s==null?"":s)
      .replace(/(pin|password|token|secret)(["'\s:=]+)[^\s"'&,}]+/gi, "$1$2***")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer ***")
      .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "***jwt***");
  }
  function note(kind, msg, src){
    msg=scrub(msg).slice(0, 500);
    if(!msg || /READONLY_TEST/.test(msg)) return;
    errs.push({ t:new Date().toISOString(), k:kind, m:msg, s:scrub(src||"").slice(0, 200) });
    if(errs.length>MAX_ERR) errs.shift();
    /* "Script error." = a cross-origin script (extension, CDN) hid the details: nothing we can fix */
    if(kind!=="console" && !/^Script error\.?$/.test(msg)) queueAuto(msg, src);
  }
  window.addEventListener("error", function(e){
    if(e && e.target && e.target!==window && (e.target.src||e.target.href)) return;   // resource 404s: not code errors
    note("error", e && (e.message || (e.error && e.error.message)) || "error", e && (e.filename+":"+e.lineno+":"+e.colno));
  });
  window.addEventListener("unhandledrejection", function(e){
    var r=e && e.reason; note("rejection", r && (r.message||r.code||String(r)) || "rejection", r && r.stack && String(r.stack).split("\n")[1]);
  });
  var ce=console.error;
  console.error=function(){
    try{ if(!sending) note("console", [].map.call(arguments, function(a){ return a && a.message ? a.message : (typeof a==="object" ? (function(){ try{ return JSON.stringify(a); }catch(x){ return String(a); } })() : String(a)); }).join(" ")); }catch(x){}
    return ce.apply(console, arguments);
  };
  window._bugErrors=function(){ return errs.slice(); };

  function me(){ var u=window.currentUser||{}; return { id:String(u.id||""), role:String(u.role||"") }; }
  function activeTab(){
    var b=[].filter.call(document.querySelectorAll(".tab-btn.active"), function(x){ return x.offsetWidth; })[0];
    return b ? b.textContent.trim().slice(0, 40) : "";
  }
  function mode(){ try{ return typeof window._secMode==="function" ? window._secMode() : ""; }catch(e){ return ""; } }
  async function version(){
    if(cfgVer!==null) return cfgVer;
    try{ var j=await (await fetch("/api/config", { cache:"no-store" })).json(); cfgVer=j && j.version || ""; }catch(e){ cfgVer=""; }
    return cfgVer;
  }
  async function context(){
    var u=location.origin+location.pathname;
    return { tab:activeTab(), ver:await version(), ua:navigator.userAgent.slice(0, 300), screen:screen.width+"x"+screen.height+" @"+(window.devicePixelRatio||1),
      view:innerWidth+"x"+innerHeight, url:u.slice(0, 300), mode:mode(), online:navigator.onLine, lang:navigator.language||"",
      errors:JSON.stringify(errs.slice(-MAX_ERR)).slice(0, 8000) };
  }
  function db(){
    try{ if(typeof window._realDb==="function" && window._realDb()) return window._realDb(); }catch(e){}
    try{ return firebase.database(); }catch(e2){ return null; }
  }
  async function store(rec){
    var base=db(); if(!base) throw new Error("no db");
    try{ if(typeof ensureFirebaseAuth==="function") await ensureFirebaseAuth(); }catch(e){}
    var ref=base.ref("borluulalt/reports").push();
    sending=true;
    try{ await ref.set(rec); } finally { sending=false; }
    return ref.key;
  }
  window._bugStore=store;

  /* ---------- auto ---------- */
  var autoQ=[], autoT=null;
  function queueAuto(msg, src){
    var k=String(msg).slice(0, 160);
    if(seen[k] || autoSent+autoQ.length>=MAX_AUTO || sending) return;
    seen[k]=1; autoQ.push({ msg:msg, src:src });
    if(!autoT) autoT=setTimeout(flushAuto, 1500);   // one-shot debounce, not a loop
  }
  async function flushAuto(){
    autoT=null;
    var u=me(); if(!u.id){ autoQ=[]; return; }      // not signed in: nothing we may write
    while(autoQ.length && autoSent<MAX_AUTO){
      var a=autoQ.shift(); autoSent++;
      try{
        var ctx=await context(); ctx.src=scrub(a.src||"").slice(0, 300);
        await store({ at:new Date().toISOString(), by:u.id, role:u.role, kind:"auto", category:"Бусад", text:scrub(a.msg).slice(0, TEXT_MAX), ctx:ctx, status:"new" });
      }catch(e){ /* silent */ }
    }
  }

  /* ---------- screenshot (user-picked image) ---------- */
  function shrink(file){
    return new Promise(function(res, rej){
      var img=new Image(), url=URL.createObjectURL(file);
      img.onload=function(){
        URL.revokeObjectURL(url);
        var scale=Math.min(1, 1280/Math.max(img.width, img.height)), out=null;
        for(var pass=0; pass<6; pass++){
          var c=document.createElement("canvas");
          c.width=Math.max(1, Math.round(img.width*scale)); c.height=Math.max(1, Math.round(img.height*scale));
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          var q=0.8;
          while(q>=0.35){ out=c.toDataURL("image/jpeg", q); if(out.length<=SHOT_MAX) return res(out); q-=0.15; }
          scale*=0.7;
        }
        rej(new Error("too big"));
      };
      img.onerror=function(){ URL.revokeObjectURL(url); rej(new Error("not an image")); };
      img.src=url;
    });
  }

  /* ---------- modal ---------- */
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function modal(){
    var m=document.getElementById("bugModal");
    if(m) return m;
    m=document.createElement("div");
    m.id="bugModal"; m.className="bug-modal hidden"; m.setAttribute("role","dialog"); m.setAttribute("aria-modal","true");
    m.innerHTML='<div class="bug-box">'
      +'<div class="bug-head"><h3>Алдаа мэдэгдэх</h3><button type="button" class="btn btn-sm btn-outline" id="bugClose" aria-label="Хаах">✕</button></div>'
      +'<label for="bugCat">Ангилал</label><select id="bugCat"><option value="">— Сонгох (заавал биш) —</option>'+CATS.map(function(c){ return '<option>'+c+'</option>'; }).join("")+'</select>'
      +'<label for="bugText">Юу болсон бэ? <span class="req">*</span></label><textarea id="bugText" maxlength="'+TEXT_MAX+'" rows="5" placeholder="Жишээ: Илгээх дарахад «Серверт хадгалагдсангүй» гэж гарсан. Өглөөний ээлж, VIP."></textarea>'
      +'<div class="bug-count"><span id="bugLen">0</span> / '+TEXT_MAX+'</div>'
      +'<label for="bugShot">Зураг (заавал биш)</label><input type="file" id="bugShot" accept="image/*"><div id="bugShotInfo" class="bug-hint"></div>'
      +'<p class="bug-hint">Хамт илгээгдэх: таны ID, эрх, одоогийн таб, хувилбар, төхөөрөмж, сүүлийн алдаанууд. PIN илгээгдэхгүй.</p>'
      +'<div id="bugAlert"></div>'
      +'<div class="bug-actions"><button type="button" class="btn btn-secondary btn-sm" id="bugCancel">Болих</button><button type="button" class="btn btn-success btn-sm" id="bugSend">Илгээх</button></div>'
      +'</div>';
    document.body.appendChild(m);
    var shot=null;
    function close(){ m.classList.add("hidden"); }
    m.addEventListener("click", function(ev){ if(ev.target===m) close(); });
    document.getElementById("bugClose").onclick=close;
    document.getElementById("bugCancel").onclick=close;
    document.addEventListener("keydown", function(ev){ if(ev.key==="Escape" && !m.classList.contains("hidden")) close(); });
    document.getElementById("bugText").oninput=function(){ document.getElementById("bugLen").textContent=this.value.length; };
    document.getElementById("bugShot").onchange=async function(){
      var f=this.files && this.files[0], info=document.getElementById("bugShotInfo"); shot=null; info.textContent="";
      if(!f) return;
      try{ shot=await shrink(f); info.textContent="Зураг бэлэн ("+Math.round(shot.length/1024)+" KB)"; }
      catch(e){ info.textContent="Зургийг багасгаж чадсангүй — зураггүй илгээнэ."; }
    };
    document.getElementById("bugSend").onclick=async function(){
      var btn=this, t=(document.getElementById("bugText").value||"").trim();
      function say(x, k){ if(typeof showAlert==="function") showAlert("bugAlert", x, k||"error"); else document.getElementById("bugAlert").textContent=x; }
      if(!t) return say("Юу болсныг бичнэ үү");
      if(t.length>TEXT_MAX) return say("Хэт урт ("+TEXT_MAX+" тэмдэгтээс ихгүй)");
      var u=me(); if(!u.id) return say("Эхлээд нэвтэрнэ үү");
      btn.disabled=true;
      try{
        var rec={ at:new Date().toISOString(), by:u.id, role:u.role, kind:"user", category:document.getElementById("bugCat").value||"Бусад", text:scrub(t), ctx:await context(), status:"new" };
        if(shot) rec.shot=shot;
        var key=await store(rec);
        window._bugLastKey=key;
        say("Илгээлээ. Баярлалаа! Засаад танд мэдэгдэнэ.", "success");
        document.getElementById("bugText").value=""; document.getElementById("bugLen").textContent="0";
        document.getElementById("bugShot").value=""; document.getElementById("bugShotInfo").textContent=""; shot=null;
        setTimeout(close, 1200);
      }catch(e){ say("Илгээж чадсангүй. Интернэтээ шалгаад дахин оролдоно уу."); }
      btn.disabled=false;
    };
    return m;
  }
  window.openBugReport=function(){
    var m=modal();
    document.getElementById("bugAlert").innerHTML="";
    m.classList.remove("hidden");
    setTimeout(function(){ var t=document.getElementById("bugText"); if(t) t.focus(); }, 30);
  };
})();
