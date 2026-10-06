/* stock_merged.js — Ахлах: Нөөц + Вино нөөц нэг таб.
   One table for beer/bar products (products node, id < 100) and wine/other
   drinks (wines node, id >= 100). Filter Бүгд / Пиво / Вино, search, one save.
   Data model unchanged: products[].stockByLoc / stock, wines[].stockByLoc / stock.
   Replaces the separate "Вино" tab (hidden, showTab("wine") -> "stock"). */
(function(){
  if(window._stockMerged) return;
  window._stockMerged=true;

  var LOCS=(window.STOCK_LOCS && window.STOCK_LOCS.length) ? window.STOCK_LOCS.slice() : ["Оюут бар","Манлай бар","VIP","POWER"];
  var CATS=[["busad","Бусад бараа"],["ulaan","Улаан вино"],["tsagaan","Цагаан вино"]];
  var LOW=function(){ return Number(window.LOW_STOCK)||10; };
  var _kind="all", _dirty=false, _sig="", _loc=LOCS[0];

  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function nrm(s){ return String(s||"").trim().toLowerCase().replace(/\s+/g," "); }
  function num(v){ var n=Number(v); return isFinite(n)?n:0; }
  function role(){ return (window.currentUser||{}).role||""; }
  function prods(){ return (typeof getProducts==="function" ? getProducts() : [])||[]; }
  function wines(){ return ((typeof getWines==="function" ? getWines() : [])||[]).filter(function(w){ return w && w.id && w.name; }); }
  function catOf(w){
    var c=String((w&&w.cat)||"").toLowerCase();
    if(c.indexOf("busad")>=0||c.indexOf("бусад")>=0) return "busad";
    if(c.indexOf("tsagaan")>=0||c.indexOf("цагаан")>=0) return "tsagaan";
    return "ulaan";
  }
  function ensureLoc(x){
    if(!x.stockByLoc || typeof x.stockByLoc!=="object") x.stockByLoc={};
    var empty=LOCS.every(function(l){ return !num(x.stockByLoc[l]); });
    LOCS.forEach(function(l){ if(x.stockByLoc[l]==null) x.stockByLoc[l]=0; });
    if(empty && num(x.stock)>0) x.stockByLoc[LOCS[0]]=num(x.stock);   // legacy single stock
    return x;
  }
  function total(x){ return LOCS.reduce(function(s,l){ return s+num(x.stockByLoc&&x.stockByLoc[l]); },0); }
  function alertMsg(t, kind){ if(typeof showAlert==="function") showAlert("smAlert", t, kind||"success"); }
  function sig(){ try{ return JSON.stringify([prods(), wines()]); }catch(e){ return String(Math.random()); } }
  function setDirty(v){
    _dirty=!!v;
    var d=document.getElementById("smDirty");
    if(d) d.textContent=_dirty?"Хадгалаагүй өөрчлөлт байна":"";
  }
  async function push(){
    if(typeof cloudPush!=="function") return true;
    for(var i=0;i<8;i++){
      var r=await cloudPush();
      if(r!==false) return true;
      await new Promise(function(res){ setTimeout(res, 400); });
    }
    return false;
  }

  function ensureStyle(){
    if(document.getElementById("smStyle")) return;
    var st=document.createElement("style");
    st.id="smStyle";
    st.textContent=
      ".sm-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:10px}"
      +".sm-bar label{display:block;font-weight:600;color:#555;font-size:.85rem}"
      +".sm-bar select,.sm-bar input{padding:8px;border:1px solid #ccc;border-radius:6px;font-size:16px;margin-top:3px}"
      +".sm-seg{display:inline-flex;border:1px solid #0f3460;border-radius:8px;overflow:hidden;margin-top:3px}"
      +".sm-seg button{border:0;background:#fff;color:#0f3460;padding:8px 14px;font-size:.9rem;cursor:pointer}"
      +".sm-seg button+button{border-left:1px solid #0f3460}.sm-seg button.on{background:#0f3460;color:#fff}"
      +".sm-actions{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin:6px 0}"
      +"#smDirty{color:#d35400;font-size:.85rem;font-weight:600}"
      +".sm-table{min-width:560px}.sm-table td{vertical-align:middle}"
      +".sm-table input{width:100%;min-width:64px;padding:6px;border:1px solid #ccc;border-radius:6px;font-size:16px;text-align:center}"
      +".sm-table input.sm-name{text-align:left;min-width:120px}"
      +".sm-table tr.sm-sec td{background:#1e3a5f;color:#fff;font-weight:700;text-align:left;padding:7px 8px}"
      +".sm-table tr.sm-sec.sm-beer td{background:#0f3460}"
      +".sm-table tr.sm-chg td{background:#fffbe6}"
      +".sm-table td.stock-low input{border-color:#c0392b;color:#c0392b;font-weight:700}"
      +".sm-tag{display:inline-block;font-size:.7rem;padding:1px 6px;border-radius:10px;background:#eef2f7;color:#555}"
      +"#smAdd summary{cursor:pointer;font-weight:600;color:#0f3460;margin:4px 0 8px}"
      +"@media(max-width:700px){.sm-table{min-width:440px}.sm-table th:first-child,.sm-table td:first-child:not([colspan]){display:none}.sm-table input.sm-name{min-width:100px}.sm-bar>div{flex:1 1 45%}.sm-bar select,.sm-bar input{width:100%}.sm-seg{display:flex}.sm-seg button{flex:1}}";
    document.head.appendChild(st);
  }

  function mount(){
    var pane=document.getElementById("tabStock");
    if(!pane) return null;
    if(document.getElementById("smBody")) return pane;
    ensureStyle();
    // keep the legacy markup (ids used by older scripts) but hidden
    var legacy=document.createElement("div");
    legacy.id="stockLegacy"; legacy.className="hidden";
    while(pane.firstChild) legacy.appendChild(pane.firstChild);
    var locOpts=LOCS.map(function(l){ return '<option value="'+esc(l)+'">'+esc(l)+'</option>'; }).join("");
    var box=document.createElement("div");
    box.id="stockMerged";
    box.innerHTML=
      '<div class="sm-bar">'
      +'<div><label>Байршил</label><select id="smLoc">'+locOpts+'</select></div>'
      +'<div><label>Харах</label><div class="sm-seg" id="smKind"><button type="button" data-k="all" class="on">Бүгд</button><button type="button" data-k="beer">Пиво</button><button type="button" data-k="wine">Вино</button></div></div>'
      +'<div><label>Хайх</label><input id="smSearch" placeholder="Барааны нэр"></div>'
      +'</div>'
      +'<details id="smAdd"><summary>+ Бараа нэмэх</summary>'
      +'<div class="header-info">'
      +'<div><label>Төрөл</label><select id="smNewKind"><option value="beer">Пиво / бар</option>'+CATS.map(function(c){ return '<option value="'+c[0]+'">'+c[1]+'</option>'; }).join("")+'</select></div>'
      +'<div><label>Нэр</label><input id="smNewName"></div>'
      +'<div><label>Үнэ</label><input type="number" min="0" id="smNewPrice" placeholder="5000"></div>'
      +'<div><label>Нөөц (сонгосон байршил)</label><input type="number" min="0" id="smNewStock" value="0"></div>'
      +'<div style="display:flex;align-items:flex-end"><button type="button" class="btn btn-success btn-sm" id="smAddBtn">Нэмэх</button></div>'
      +'</div></details>'
      +'<div id="smAlert"></div>'
      +'<div class="sm-actions"><span id="smDirty"></span><button type="button" class="btn btn-success" id="smSave">Бүгдийг хадгалах</button></div>'
      +'<div class="table-wrap"><table class="sm-table"><thead><tr><th>#</th><th>Бараа</th><th>Үнэ</th><th id="smLocHead">Нөөц</th><th>Нийт</th><th></th></tr></thead><tbody id="smBody"></tbody></table></div>'
      +'<div class="sm-actions"><button type="button" class="btn btn-success" id="smSave2">Бүгдийг хадгалах</button></div>';
    pane.appendChild(box);
    pane.appendChild(legacy);

    document.getElementById("smLoc").onchange=async function(){
      var next=this.value;
      if(_dirty){
        if(confirm("“"+_loc+"” байршлын хадгалаагүй өөрчлөлт байна. Хадгалах уу?\n(Болих = өөрчлөлтийг хаях)")){
          this.value=_loc; await window.saveMergedStock(); this.value=next;
        }
      }
      _loc=next; setDirty(false); draw();
    };
    document.getElementById("smKind").onclick=function(ev){
      var b=ev.target.closest("button[data-k]"); if(!b) return;
      _kind=b.getAttribute("data-k"); applyFilter();
    };
    document.getElementById("smSearch").oninput=applyFilter;
    document.getElementById("smSave").onclick=function(){ window.saveMergedStock(); };
    document.getElementById("smSave2").onclick=function(){ window.saveMergedStock(); };
    document.getElementById("smAddBtn").onclick=function(){ window.addMergedItem(); };
    var body=document.getElementById("smBody");
    body.addEventListener("input", function(ev){
      var tr=ev.target.closest("tr[data-key]"); if(tr) tr.classList.add("sm-chg");
      setDirty(true);
    });
    body.addEventListener("click", function(ev){
      var b=ev.target.closest("button[data-del]"); if(!b) return;
      window.deleteMergedItem(b.getAttribute("data-del"));
    });
    return pane;
  }

  function row(kind, x){
    ensureLoc(x);
    var key=kind+"_"+x.id, st=num(x.stockByLoc[_loc]);
    return '<tr data-key="'+key+'" data-kind="'+kind+'" data-name="'+esc(nrm(x.name))+'">'
      +'<td>'+esc(x.id)+'</td>'
      +'<td><input class="sm-name" id="sm_name_'+key+'" value="'+esc(x.name||"")+'"></td>'
      +'<td><input type="number" min="0" id="sm_price_'+key+'" value="'+num(x.price)+'"></td>'
      +'<td class="'+(st<=LOW()?"stock-low":"stock-ok")+'"><input type="number" min="0" id="sm_stock_'+key+'" value="'+st+'"></td>'
      +'<td>'+total(x)+'</td>'
      +'<td><button type="button" class="btn btn-danger btn-sm" data-del="'+key+'">Устгах</button></td>'
      +'</tr>';
  }
  function sec(kind, label, n){
    return '<tr class="sm-sec sm-'+kind+'" data-sec="'+kind+'"><td colspan="6">'+esc(label)+' <span class="sm-tag">'+n+'</span></td></tr>';
  }

  function draw(){
    if(!mount()) return;
    var tb=document.getElementById("smBody");
    var sel=document.getElementById("smLoc");
    if(sel && sel.value!==_loc) sel.value=_loc;
    var h=document.getElementById("smLocHead"); if(h) h.textContent="Нөөц ("+_loc+")";
    var beer=prods().filter(function(p){ return p && !p.deleted && num(p.id)<100; });
    var g={busad:[],ulaan:[],tsagaan:[]};
    wines().filter(function(w){ return !w.hidden; }).forEach(function(w){ g[catOf(w)].push(w); });
    var html=sec("beer","Пиво / бар бараа",beer.length)+beer.map(function(p){ return row("beer",p); }).join("");
    CATS.forEach(function(c){
      if(!g[c[0]].length) return;
      html+=sec("wine",c[1],g[c[0]].length)+g[c[0]].map(function(w){ return row("wine",w); }).join("");
    });
    tb.innerHTML=html;
    _sig=sig();
    setDirty(false);
    applyFilter();
  }

  function applyFilter(){
    var seg=document.getElementById("smKind");
    if(seg) Array.prototype.forEach.call(seg.querySelectorAll("button"), function(b){ b.classList.toggle("on", b.getAttribute("data-k")===_kind); });
    var q=nrm((document.getElementById("smSearch")||{}).value);
    var rows=document.querySelectorAll("#smBody tr");
    var lastSec=null, secHas=false;
    function closeSec(){ if(lastSec) lastSec.style.display=secHas?"":"none"; }
    Array.prototype.forEach.call(rows, function(tr){
      if(tr.hasAttribute("data-sec")){
        closeSec(); lastSec=tr; secHas=false;
        return;
      }
      var k=tr.getAttribute("data-kind");
      var ok=(_kind==="all"||_kind===k) && (!q || (tr.getAttribute("data-name")||"").indexOf(q)>=0);
      tr.style.display=ok?"":"none";
      if(ok) secHas=true;
    });
    closeSec();
  }

  function readRow(key){
    var n=document.getElementById("sm_name_"+key), p=document.getElementById("sm_price_"+key), s=document.getElementById("sm_stock_"+key);
    if(!n||!p||!s) return null;
    return {name:n.value.trim(), price:Math.max(0,num(p.value)), stock:Math.max(0,num(s.value))};
  }

  window.saveMergedStock=async function(){
    if(role()!=="supervisor") return;
    var loc=_loc, nb=0, nw=0;
    var P=prods(), W=(typeof getWines==="function"?getWines():[])||[];
    P.forEach(function(p){
      if(!p || p.deleted) return;
      var r=readRow("beer_"+p.id); if(!r) return;
      ensureLoc(p);
      if(r.name) p.name=r.name;
      p.price=r.price;
      p.stockByLoc[loc]=r.stock;
      p.stock=total(p); nb++;
    });
    W.forEach(function(w){
      if(!w || !w.id || w.hidden) return;
      var r=readRow("wine_"+w.id); if(!r) return;
      ensureLoc(w);
      if(r.name) w.name=r.name;
      if(r.price>0) w.price=r.price;
      w.stockByLoc[loc]=r.stock;
      w.stock=total(w); nw++;
    });
    if(typeof setProducts==="function") setProducts(P);
    if(typeof setWines==="function") setWines(W);
    var ok=await push();
    draw();
    if(ok) alertMsg("Нөөц хадгалагдлаа — "+loc+": пиво "+nb+", вино/бусад "+nw,"success");
    else { setDirty(true); alertMsg("Дотор хадгалсан ч серверт илгээгдсэнгүй. Дахин “Бүгдийг хадгалах” дарна уу.","error"); }
    return ok;
  };
  window.saveAllStock=window.saveMergedStock;

  window.addMergedItem=async function(){
    if(role()!=="supervisor") return;
    var kind=document.getElementById("smNewKind").value;
    var name=(document.getElementById("smNewName").value||"").trim();
    var price=num(document.getElementById("smNewPrice").value);
    var stock=Math.max(0,num(document.getElementById("smNewStock").value));
    if(!name) return alertMsg("Нэр оруулна уу","error");
    if(price<=0) return alertMsg("Үнэ оруулна уу","error");
    if(_dirty && !confirm("Хүснэгтэд хадгалаагүй өөрчлөлт байна. Түүнийг хаяад шинэ бараа нэмэх үү?")) return;
    var sbl={}; LOCS.forEach(function(l){ sbl[l]=0; }); sbl[_loc]=stock;
    if(kind==="beer"){
      var P=prods();
      if(P.some(function(p){ return p && !p.deleted && nrm(p.name)===nrm(name); })) return alertMsg("Ийм нэртэй бараа байна","error");
      var id=P.reduce(function(m,p){ var i=num(p&&p.id); return i<100&&i>m?i:m; },0)+1;
      if(id>=100) return alertMsg("Пивоны ID дүүрсэн (99). Хуучин барааг ашиглана уу.","error");
      P.push({id:id,name:name,price:price,stock:stock,stockByLoc:sbl});
      setProducts(P);
    } else {
      var W=(typeof getWines==="function"?getWines():[])||[];
      if(W.some(function(w){ return w && !w.hidden && nrm(w.name)===nrm(name); })) return alertMsg("Ийм нэртэй бараа байна","error");
      var wid=W.reduce(function(m,w){ var i=num(w&&w.id); return i>m?i:m; },100)+1;
      W.push({id:wid,name:name,price:price,stock:stock,cat:kind,stockByLoc:sbl});
      setWines(W);
    }
    var ok=await push();
    ["smNewName","smNewPrice"].forEach(function(k){ document.getElementById(k).value=""; });
    document.getElementById("smNewStock").value="0";
    draw();
    alertMsg(ok?name+" нэмэгдлээ":"Дотор нэмсэн ч серверт илгээгдсэнгүй. “Бүгдийг хадгалах” дарна уу.", ok?"success":"error");
  };

  window.deleteMergedItem=async function(key){
    if(role()!=="supervisor") return;
    var m=/^(beer|wine)_(\d+)$/.exec(key||""); if(!m) return;
    var id=Number(m[2]);
    var list=m[1]==="beer"?prods():((typeof getWines==="function"?getWines():[])||[]);
    var x=list.find(function(i){ return i && Number(i.id)===id; });
    if(!x) return;
    if(!confirm((x.name||id)+" — устгах уу?\n(Түүх, хуучин илгээлтүүд хэвээр үлдэнэ)")) return;
    if(m[1]==="beer"){ x.deleted=true; setProducts(list); } else { x.hidden=true; setWines(list); }
    var ok=await push();
    draw();
    alertMsg(ok?(x.name+" устгагдлаа"):"Серверт илгээгдсэнгүй. Дахин оролдоно уу.", ok?"success":"error");
  };

  /* routing: hide the old Вино tab, send showTab("wine") to the merged stock tab */
  function pinShowTab(){
    var cur=window.showTab;
    if(typeof cur!=="function" || cur._stockMerged) return;
    var w=function(name){
      if(name==="wine") name="stock";
      var r=cur.call(this, name);
      if(name==="stock") draw();
      return r;
    };
    ["_noPrice","_winePane","_stockMerged"].forEach(function(f){ w[f]=true; });
    window.showTab=w;
  }
  function hideWineTab(){
    var b=document.getElementById("tabBtnWine");
    if(b && b.style.display!=="none") b.style.display="none";
    var p=document.getElementById("tabWine");
    if(p && !p.classList.contains("hidden")) p.classList.add("hidden");
  }
  function tick(){
    pinShowTab();
    hideWineTab();
    if(window.saveAllStock!==window.saveMergedStock) window.saveAllStock=window.saveMergedStock;
    var pane=document.getElementById("tabStock");
    if(!pane || pane.classList.contains("hidden") || role()!=="supervisor") return;
    if(!document.getElementById("smBody")) { draw(); return; }
    // refresh from cloud pulls only when the user has not started editing
    var a=document.activeElement;
    if(!_dirty && !(a && a.closest && a.closest("#stockMerged")) && sig()!==_sig) draw();
  }
  window.drawMergedStock=draw;
  tick();
  setInterval(tick, 1500);
})();
