/* stock_ledger.js — the server stock follows the submissions, exactly once.
   Employees never write stock. A supervisor device reconciles after each push (sync_stable.js):
     desired(sub) = sold qty per item at the sub's location (beer -> products, id >= 100 -> wines)
     ledger borluulalt/stockLedger/<key> = { applied, ver, pending, id, date, at }
   1) a transaction on the ledger entry claims the change: pending = desired - applied, applied = desired
   2) each stock item is changed by its own transaction on products/<i> | wines/<i>; the item keeps
      the op id in _ops, so a retry / a second supervisor never applies the same op twice
   3) a transaction clears pending. A pending left by a closed tab is finished by the next run.
   Edits apply the difference, deletes (tombstone, or the same id under a new key) return the stock,
   a re-submit after a delete deducts again. Only submissions after the cutoff count:
     borluulalt/stockLedger/_cutoff = { at, day } — set once, by the first supervisor run after deploy. */
(function(){
  if(window._stockLedger) return; window._stockLedger=true;
  var ROOT="borluulalt", LED=ROOT+"/stockLedger";
  var LOCS=["Оюут бар","Манлай бар","VIP","POWER"];
  var KEEP_DAYS=60, PENDING_STALE_MS=20000, OPS_KEEP=150;

  function db(){
    try{ if(typeof initFirebase==="function") initFirebase(); }catch(e){}
    try{ if(typeof firebase!=="undefined" && firebase.database){ var d=firebase.database(); if(d && d.ref) return d; } }catch(e){}
    return window._fbDb||null;
  }
  function role(){ var u=window.currentUser||{}; return u.role||""; }
  function mirror(path){
    var M=window._mirror?window._mirror():null, t=M&&M.tree;
    String(path).split("/").forEach(function(p){ t=(t&&typeof t==="object")?t[p]:undefined; });
    return t;
  }
  function list(x){
    if(Array.isArray(x)) return x;
    if(x && typeof x==="object") return Object.keys(x).sort(function(a,b){ return a-b; }).map(function(k){ return x[k]; });
    return [];
  }
  function ubDay(ms){ return new Date((ms||Date.now())+8*3600e3).toISOString().slice(0,10); }   // Asia/Ulaanbaatar
  function tekOf(s){ return String((s&&(s.receiverName||s.tek||s.receiver))||"").trim(); }
  function bizOf(s){
    if(window._bizKey){ try{ var k=window._bizKey(s); if(k) return k; }catch(e){} }
    return [s.employeeId||"",s.date||"",s.shift||"",s.location||"",tekOf(s),(s.kind||s.sheet||"bar")].join("|").toLowerCase();
  }
  function keyOf(s){ return "k_"+String(bizOf(s)).replace(/[.#$\[\]\/]/g,"_").slice(0,700); }
  function locOf(s){ return LOCS.indexOf(s.location)>=0 ? s.location : LOCS[0]; }
  function isWineId(id){ return Number(id)>=100; }
  /* "p3@VIP" -> qty */
  function soldMap(s){
    var m={}, loc=locOf(s);
    (s.items||[]).forEach(function(it){
      var q=Number(it&&it.sold)||0, id=Number(it&&it.id);
      if(!q || !id) return;
      var link=isWineId(id) && window._stockLinkOf ? window._stockLinkOf(id) : 0;   // shared stock (stock_link.js)
      var k=(link ? "p"+link : (isWineId(id)?"w":"p")+id)+"@"+loc;
      m[k]=(m[k]||0)+q;
    });
    return m;
  }
  function diff(want, have){
    var d={}, n=0;
    Object.keys(Object.assign({}, want||{}, have||{})).forEach(function(k){
      var v=(Number((want||{})[k])||0)-(Number((have||{})[k])||0);
      if(v){ d[k]=v; n++; }
    });
    return n?d:null;
  }

  async function cutoff(base){
    var c=mirror(LED+"/_cutoff");
    if(c && c.at) return c;
    var res=await base.ref(LED+"/_cutoff").transaction(function(cur){
      if(cur && cur.at) return;            // already set: keep it
      var now=Date.now();
      return { at:new Date(now).toISOString(), day:ubDay(now), by:(window.currentUser||{}).id||"" };
    });
    return (res && res.snapshot && res.snapshot.val()) || c || null;
  }

  /* one stock item: add "delta" at "loc" unless op was already applied */
  async function bump(base, kind, id, loc, delta, op){
    var node=kind==="w"?"wines":"products";
    for(var attempt=0; attempt<3; attempt++){
      var arr=list(mirror(ROOT+"/"+node));
      if(!arr.length){ try{ arr=list((await base.ref(ROOT+"/"+node).once("value")).val()); }catch(e){} }
      var idx=-1; arr.forEach(function(x,i){ if(x && Number(x.id)===Number(id)) idx=i; });
      if(idx<0) return "missing";
      var moved=false, done=false;
      await base.ref(ROOT+"/"+node+"/"+idx).transaction(function(item){
        if(item==null) return null;                          // first local guess; the server answers with the real value
        if(Number(item.id)!==Number(id)){ moved=true; return; }
        var ops=Object.assign({}, item._ops||{});
        if(ops[op]){ done=true; return; }                    // already applied
        var sbl=Object.assign({}, item.stockByLoc||{});
        LOCS.forEach(function(l){ if(sbl[l]==null) sbl[l]=0; });
        if(!item.stockByLoc && Number(item.stock)>0) sbl[LOCS[0]]=Number(item.stock);
        sbl[loc]=(Number(sbl[loc])||0)+delta;
        ops[op]=Date.now();
        var ks=Object.keys(ops);
        if(ks.length>OPS_KEEP) ks.sort(function(a,b){ return ops[a]-ops[b]; }).slice(0, ks.length-OPS_KEEP).forEach(function(k){ delete ops[k]; });
        item.stockByLoc=sbl;
        item.stock=LOCS.reduce(function(a,l){ return a+(Number(sbl[l])||0); },0);
        item._ops=ops;
        return item;
      });
      if(!moved) return done?"dup":"ok";
      try{ if(window._deltaSync) await window._deltaSync({nodes:[node], full:true, reason:"stock-moved"}); }catch(e){}
    }
    return "moved";
  }

  async function finish(base, key, pending){
    var ks=Object.keys(pending.delta||{});
    for(var i=0;i<ks.length;i++){
      var m=/^([pw])(\d+)@(.+)$/.exec(ks[i]); if(!m) continue;
      await bump(base, m[1], Number(m[2]), m[3], -(Number(pending.delta[ks[i]])||0),   // more sold = less stock
      String(pending.op).replace(/[.#$\[\]\/]/g,"_"));
    }
    await base.ref(LED+"/"+key).transaction(function(cur){
      if(cur==null) return null;
      if(!cur.pending || cur.pending.op!==pending.op) return;
      delete cur.pending; cur.at=new Date().toISOString();
      return cur;
    });
  }

  /* bring one ledger entry to "want" (null/{} = nothing deducted) */
  async function settle(base, key, want, info){
    var claimed=null, leftover=null;
    await base.ref(LED+"/"+key).transaction(function(cur){
      claimed=null; leftover=null;
      if(cur && cur.pending){
        if(Date.now()-Date.parse(cur.pending.at||0) > PENDING_STALE_MS || info.force) leftover=cur.pending;
        return;                                            // finish that first
      }
      var have=(cur && cur.applied)||{};
      var d=diff(want, have);
      if(!d) return cur==null ? null : undefined;          // null: let the server confirm it really is empty
      var ver=((cur && cur.ver)||0)+1;
      var now=new Date().toISOString();
      claimed={ op:key+"~"+ver, delta:d, at:now };
      var next=Object.assign({}, cur||{}, { applied:want||{}, ver:ver, pending:claimed, at:now, by:(window.currentUser||{}).id||"" });
      if(info.id) next.id=info.id;
      if(info.date) next.date=info.date;
      if(!want || !Object.keys(want).length) next.gone=true; else delete next.gone;
      return next;
    });
    if(leftover){ await finish(base, key, leftover); return settle(base, key, want, info); }
    if(claimed){ await finish(base, key, claimed); return 1; }
    return 0;
  }

  var _busy=null;
  window._stockReconcile=function(subs, tombs){
    if(role()!=="supervisor") return Promise.resolve(0);
    if(_busy) return _busy;
    _busy=run(subs, tombs).catch(function(e){ console.warn("stockReconcile", e); return 0; }).then(function(n){ _busy=null; return n; });
    return _busy;
  };
  async function run(subs, tombs){
    var base=db(); if(!base) return 0;
    if(window._deltaSync){ try{ await window._deltaSync({nodes:["stockLedger","products","wines"], reason:"stock"}); }catch(e){} }
    var cut=await cutoff(base); if(!cut || !cut.at) return 0;
    var led=mirror(LED)||{};
    var horizon=ubDay(Date.now()-KEEP_DAYS*864e5);
    var live={}, liveIds={}, n=0;
    (subs||[]).forEach(function(s){
      if(!s || s.deleted || !s.employeeId) return;
      var k=keyOf(s);
      live[k]=s; if(s.id) liveIds[s.id]=k;
    });
    var jobs=[];
    Object.keys(live).forEach(function(k){
      var s=live[k], e=led[k];
      if(String(s.date||"")<horizon) return;
      var eligible=!!(e && e.applied) || (String(s.submittedAt||"")>=cut.at && String(s.date||"")>=cut.day);
      if(!eligible) return;
      var want=soldMap(s);
      if(e && !e.pending && !diff(want, e.applied)) return;
      jobs.push([k, want, { id:s.id||"", date:s.date||"" }]);
    });
    /* entries whose submission is gone: deleted (tombstone) or moved to a new key (same id) */
    var tombKeys={}, tombIds={};
    Object.keys(tombs||{}).forEach(function(t){ var tb=tombs[t]||{}; if(tb.biz) tombKeys["k_"+String(tb.biz).replace(/[.#$\[\]\/]/g,"_").slice(0,700)]=1; if(tb.id) tombIds[tb.id]=1; });
    Object.keys(led).forEach(function(k){
      if(k==="_cutoff" || live[k]) return;
      var e=led[k]||{};
      if(e.pending){ jobs.push([k, e.applied||{}, { id:e.id, date:e.date, force:false }]); return; }
      if(!e.applied || !Object.keys(e.applied).length) return;
      var moved=e.id && liveIds[e.id] && liveIds[e.id]!==k;
      if(moved || tombKeys[k] || (e.id && tombIds[e.id])) jobs.push([k, {}, { id:e.id, date:e.date }]);
    });
    for(var i=0;i<jobs.length;i++) n+=await settle(base, jobs[i][0], jobs[i][1], jobs[i][2]);
    if(n || jobs.length){
      if(window._deltaSync){ try{ await window._deltaSync({nodes:["products","wines"], reason:"stock-after"}); }catch(e){} }
      showServerStock();
    }
    return n;
  }

  /* the device shows what the server has */
  function showServerStock(){
    var P=mirror(ROOT+"/products"), W=mirror(ROOT+"/wines");
    if(P && typeof setProducts==="function") setProducts(list(P).filter(Boolean));
    if(W && typeof setWines==="function") setWines(list(W).filter(Boolean));
    if(typeof window.drawMergedStock==="function") try{ window.drawMergedStock(); }catch(e){}
  }
  window._stockShowServer=showServerStock;

  /* supervisor count in the stock tab: set stockByLoc[loc] to the counted value (txn per item) */
  window._stockSetCounts=async function(edits){
    var base=db(); if(!base || !edits || !edits.length) return true;
    var ok=true;
    for(var i=0;i<edits.length;i++){
      var e=edits[i], node=e.kind==="w"?"wines":"products";
      var arr=list(mirror(ROOT+"/"+node));
      var idx=-1; arr.forEach(function(x,j){ if(x && Number(x.id)===Number(e.id)) idx=j; });
      if(idx<0) continue;                                   // new item: written whole by the push
      try{
        await base.ref(ROOT+"/"+node+"/"+idx).transaction(function(item){
          if(item==null) return null;
          if(Number(item.id)!==Number(e.id)) return;
          var sbl=Object.assign({}, item.stockByLoc||{});
          LOCS.forEach(function(l){ if(sbl[l]==null) sbl[l]=0; });
          sbl[e.loc]=Number(e.stock)||0;
          item.stockByLoc=sbl;
          item.stock=LOCS.reduce(function(a,l){ return a+(Number(sbl[l])||0); },0);
          if(e.name) item.name=e.name;
          if(Number(e.price)>0) item.price=Number(e.price);
          return item;
        });
      }catch(err){ ok=false; console.warn("stock count", err); }
    }
    return ok;
  };

  /* the push may only carry the catalog (names, prices, new / removed items), never stock numbers:
     returns the array to write (server stock kept for known ids) or null when nothing changed */
  var STOCKF={ stock:1, stockByLoc:1, _ops:1 };
  function catalogSig(x){ var o={}; Object.keys(x||{}).sort().forEach(function(k){ if(!STOCKF[k]) o[k]=x[k]; }); return JSON.stringify(o); }
  window._stockCatalogPatch=function(local, cloud){
    var L=list(local).filter(Boolean), C=list(cloud).filter(Boolean);
    if(!L.length) return null;
    var byId={}; C.forEach(function(x){ byId[x.id]=x; });
    var changed=L.length!==C.length || L.some(function(x,i){ return !C[i] || C[i].id!==x.id || catalogSig(x)!==catalogSig(C[i]); });
    if(!changed) return null;
    return L.map(function(x){
      var c=byId[x.id]; if(!c) return x;
      var y=Object.assign({}, x);
      ["stock","stockByLoc","_ops"].forEach(function(f){ if(c[f]!==undefined) y[f]=c[f]; else delete y[f]; });
      return y;
    });
  };
  window._stockKeyOf=keyOf; window._stockSoldMap=soldMap;
})();
