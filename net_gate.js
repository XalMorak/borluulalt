/* net_gate.js — load right after the Firebase SDK, before app.js.

   Goal: no background reads. Firebase is read ONLY on login and on
   "Мэдээлэл шинэчлэх" (refresh), and then only what changed (delta).

   How:
   1. firebase.database() is wrapped. Every .once()/.get()/.on('value') made by
      the app (including the many old *_fix.js files and their timers) is
      answered from a local mirror of the database (IndexedDB), never from the
      network. .on() becomes a local listener that fires when the mirror changes.
   2. Writes (set/update/remove/transaction/push) go to Firebase exactly as
      before. When the server confirms, the same change is applied to the
      mirror (so the user sees their own change at once) and a tiny change marker
      borluulalt/_meta/<node> is written so other devices know what to pull.
   3. window._deltaSync({nodes}) is the ONLY code that reads the network:
        - small/array nodes (users, products, wines, submissions, logs,
          rosters, payments): pulled only when _meta/<node> (or the legacy
          root updatedAt) differs from the mirror
        - keyed append-style nodes: inbox (orderByChild submittedAt) and
          deleted (orderByChild at) are queried from lastSync-15min
        - first time per device (or after 7 days) a node is pulled in full.
*/
(function(){
  if(window._netGate) return;
  window._netGate=true;

  var ROOT="borluulalt";
  var KEYED={ inbox:"submittedAt", deleted:"at" };              // delta by child timestamp
  var VERSIONED=["users","products","wines","submissions","logs","rosters","payments"];
  var ROOT_STAMPED={ submissions:1, products:1, wines:1, logs:1 }; // written together with root updatedAt
  var ALL_NODES=VERSIONED.concat(Object.keys(KEYED));
  var MARGIN_MS=15*60*1000;          // clock-skew safety for keyed delta queries
  var FULL_AFTER_MS=7*24*3600*1000;  // safety full re-pull of a node once a week

  /* ---------- mirror (IndexedDB, memory fallback) ---------- */
  var M={ tree:{}, nodes:{}, v:1 };
  var IDB_NAME="borluulalt_cache", IDB_STORE="kv", IDB_KEY="mirror_v1";
  function idb(){
    return new Promise(function(res){
      try{
        if(!window.indexedDB) return res(null);
        var rq=indexedDB.open(IDB_NAME,1);
        rq.onupgradeneeded=function(){ try{ rq.result.createObjectStore(IDB_STORE); }catch(e){} };
        rq.onsuccess=function(){ res(rq.result); };
        rq.onerror=function(){ res(null); };
        rq.onblocked=function(){ res(null); };
      }catch(e){ res(null); }
    });
  }
  var _idb=null;
  var ready=idb().then(function(d){
    _idb=d;
    if(!d) return;
    return new Promise(function(res){
      try{
        var g=d.transaction(IDB_STORE,"readonly").objectStore(IDB_STORE).get(IDB_KEY);
        g.onsuccess=function(){ var v=g.result; if(v && v.tree && v.nodes) M=v; res(); };
        g.onerror=function(){ res(); };
      }catch(e){ res(); }
    });
  }).catch(function(){});
  var _saveT=null;
  function saveSoon(){
    if(!_idb) return;
    clearTimeout(_saveT);
    _saveT=setTimeout(function(){
      try{ _idb.transaction(IDB_STORE,"readwrite").objectStore(IDB_STORE).put(M, IDB_KEY); }catch(e){ console.warn("mirror save", e); }
    }, 300);
  }
  window._mirrorReady=ready;
  window._mirror=function(){ return M; };

  /* ---------- tree helpers ---------- */
  function parts(p){ return String(p==null?"":p).split("/").filter(Boolean); }
  function clone(v){ return v==null ? null : JSON.parse(JSON.stringify(v)); }
  function getIn(o, ps){ for(var i=0;i<ps.length;i++){ if(o==null || typeof o!=="object") return null; o=o[ps[i]]; } return o===undefined?null:o; }
  function resolveSV(v){
    if(v && typeof v==="object"){
      if(v[".sv"]==="timestamp") return Date.now();
      if(Array.isArray(v)) return v.map(resolveSV);
      var o={}; Object.keys(v).forEach(function(k){ if(v[k]!==undefined) o[k]=resolveSV(v[k]); }); return o;
    }
    return v===undefined?null:v;
  }
  function putIn(ps, v){
    v=clone(resolveSV(v));
    if(!ps.length){ M.tree=(v && typeof v==="object")?v:{}; return; }
    var o=M.tree;
    for(var i=0;i<ps.length-1;i++){
      if(o[ps[i]]==null || typeof o[ps[i]]!=="object") o[ps[i]]={};
      o=o[ps[i]];
    }
    var k=ps[ps.length-1];
    if(v==null){ if(Array.isArray(o)) o[k]=null; else delete o[k]; }
    else o[k]=v;
  }

  /* ---------- local listeners (replace network .on) ---------- */
  var L=[];
  function related(a,b){ return a===b || a.indexOf(b+"/")===0 || b.indexOf(a+"/")===0 || a==="" || b===""; }
  function fire(changedPath){
    L.slice().forEach(function(l){
      if(changedPath!=null && !related(l.path, changedPath)) return;
      setTimeout(function(){ if(L.indexOf(l)>=0){ try{ l.cb(snapAt(l.path, l.q)); }catch(e){ console.warn("listener", e); } } }, 0);
    });
  }

  /* ---------- snapshots from the mirror ---------- */
  function applyQuery(v, q){
    if(!q || !q.by || v==null || typeof v!=="object") return {v:v, keys:null};
    var keys=Object.keys(v).filter(function(k){ return v[k]!=null; });
    function sk(k){ if(q.by==="key") return k; if(q.by==="value") return v[k]; var x=v[k]; return (x && typeof x==="object") ? x[q.child] : undefined; }
    keys=keys.filter(function(k){
      var x=sk(k);
      if(q.start!==undefined && !(x!=null && (q.after ? x>q.start : x>=q.start))) return false;
      if(q.end!==undefined && !(x!=null && (q.before ? x<q.end : x<=q.end))) return false;
      if(q.eq!==undefined && x!==q.eq) return false;
      return true;
    });
    keys.sort(function(a,b){ var x=sk(a), y=sk(b); if(x==null&&y!=null) return -1; if(y==null&&x!=null) return 1; return x<y?-1:x>y?1:(a<b?-1:a>b?1:0); });
    if(q.last) keys=keys.slice(-q.last);
    if(q.first) keys=keys.slice(0,q.first);
    var out={}; keys.forEach(function(k){ out[k]=v[k]; });
    return {v: keys.length?out:null, keys:keys};
  }
  function mkSnap(path, v, orderKeys){
    var ps=parts(path);
    var s={
      key: ps.length?ps[ps.length-1]:null,
      val: function(){ return clone(v); },
      exportVal: function(){ return clone(v); },
      toJSON: function(){ return clone(v); },
      exists: function(){ return v!=null; },
      hasChildren: function(){ return !!(v && typeof v==="object" && Object.keys(v).length); },
      numChildren: function(){ return (v && typeof v==="object") ? Object.keys(v).filter(function(k){ return v[k]!=null; }).length : 0; },
      hasChild: function(p){ return getIn(v, parts(p))!=null; },
      child: function(p){ return mkSnap(path+"/"+p, getIn(v, parts(p))); },
      forEach: function(cb){
        if(!v || typeof v!=="object") return false;
        var ks=orderKeys || Object.keys(v);
        for(var i=0;i<ks.length;i++){ if(v[ks[i]]==null) continue; if(cb(mkSnap(path+"/"+ks[i], v[ks[i]]))===true) return true; }
        return false;
      },
      priority: null
    };
    return s;
  }
  function snapAt(path, q){
    var r=applyQuery(getIn(M.tree, parts(path)), q);
    return mkSnap(path, r.v, r.keys);
  }

  /* ---------- change markers ---------- */
  function token(){ return Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8); }
  function same(a,b){ try{ return JSON.stringify(resolveSV(a))===JSON.stringify(resolveSV(b)); }catch(e){ return false; } }
  function touched(op, path, v){
    var ps=parts(path);
    if(ps[0]!==ROOT) return [];
    if(ps.length===1){
      if(op!=="update") return ALL_NODES.slice();
      var seen={};
      Object.keys(v||{}).forEach(function(k){ var n=k.split("/")[0]; if(n!=="_meta" && n!=="updatedAt") seen[n]=1; });
      return Object.keys(seen);
    }
    return ps[1]==="_meta" ? [] : [ps[1]];
  }

  /* ---------- gated database ---------- */
  var _orig=null, _gated=null, _realDb=null;
  function realDb(){
    if(_realDb) return _realDb;
    try{ if(_orig) _realDb=_orig.call(window.firebase); }catch(e){ console.warn("realDb", e); }
    return _realDb;
  }
  window._realDb=realDb;

  function writeThrough(op, path, v){
    var ps=parts(path);
    if(op==="set") putIn(ps, v);
    else if(op==="remove") putIn(ps, null);
    else if(op==="update") Object.keys(v||{}).forEach(function(k){ putIn(ps.concat(parts(k)), v[k]); });
    fire(path);
    saveSoon();
  }

  function gref(path, q){
    path=parts(path).join("/");
    function real(){ var d=realDb(); return path ? d.ref(path) : d.ref(); }
    function withQ(extra){ return gref(path, Object.assign({}, q||{}, extra)); }
    var r={
      key: parts(path).length ? parts(path)[parts(path).length-1] : null,
      toString: function(){ return "gated:/"+path; },
      child: function(c){ return gref(path+"/"+c); },
      orderByChild: function(c){ return withQ({by:"child", child:c}); },
      orderByKey: function(){ return withQ({by:"key"}); },
      orderByValue: function(){ return withQ({by:"value"}); },
      startAt: function(x){ return withQ({start:x}); },
      startAfter: function(x){ return withQ({start:x, after:true}); },
      endAt: function(x){ return withQ({end:x}); },
      endBefore: function(x){ return withQ({end:x, before:true}); },
      equalTo: function(x){ return withQ({eq:x}); },
      limitToFirst: function(n){ return withQ({first:n}); },
      limitToLast: function(n){ return withQ({last:n}); },
      /* reads: always from the mirror */
      once: function(ev, cb){
        return ready.then(function(){ var s=snapAt(path, q); if(typeof cb==="function") cb(s); return s; });
      },
      get: function(){ return ready.then(function(){ return snapAt(path, q); }); },
      on: function(ev, cb){
        if(ev!=="value" || typeof cb!=="function") return cb;
        var l={path:path, q:q, cb:cb}; L.push(l);
        ready.then(function(){ if(L.indexOf(l)>=0) cb(snapAt(path, q)); });
        return cb;
      },
      off: function(ev, cb){ L=L.filter(function(l){ return !(l.path===path && (!cb || l.cb===cb)); }); },
      /* writes: to Firebase as before, then mirror + marker */
      set: function(v){ return bumped("set", v); },
      update: function(v){ return bumped("update", v); },
      remove: function(){ return bumped("remove", null); },
      push: function(v){
        var k=real().push().key, c=gref(path+"/"+k);
        var p=(v===undefined)?Promise.resolve():c.set(v);
        c.then=function(a,b){ return p.then(a,b); }; c.catch=function(b){ return p.catch(b); };
        return c;
      },
      transaction: function(fn, onComplete, applyLocally){
        return real().transaction(fn, onComplete, applyLocally).then(function(res){
          if(res && res.committed && res.snapshot){ writeThrough("set", path, res.snapshot.val()); markAfter(touched("set", path)); }
          return res;
        });
      },
      onDisconnect: function(){ return real().onDisconnect(); }
    };
    r.ref=r;
    function bumped(op, v){
      var nodes=touched(op, path, v).filter(function(n){ return !KEYED[n]; });
      var ps=parts(path);
      if(op==="update" && ps.length===1 && ps[0]===ROOT){
        /* root multi-path update (supervisor push): put markers in the same write,
           only for nodes whose content actually changes */
        var cur=getIn(M.tree,[ROOT])||{}, v2=Object.assign({}, v), tk=token();
        nodes.forEach(function(n){ if(!same(v[n], cur[n])) v2["_meta/"+n]=tk; });
        if(v.updatedAt!==undefined) v2["_meta/updatedAt"]=v.updatedAt;
        return real().update(v2).then(function(x){ writeThrough("update", path, v2); return x; });
      }
      var p=(op==="remove") ? real().remove() : real()[op](v);
      return p.then(function(x){ writeThrough(op, path, v); markAfter(nodes); return x; });
    }
    return r;
  }
  function markAfter(nodes){
    if(!nodes || !nodes.length) return;
    var patch={}, tk=token();
    nodes.forEach(function(n){ patch[n]=tk; });
    try{
      realDb().ref(ROOT+"/_meta").update(patch).then(function(){ writeThrough("update", ROOT+"/_meta", patch); }, function(e){ console.warn("meta", e); });
    }catch(e){}
  }
  function gatedDb(){
    if(_gated) return _gated;
    _gated={
      ref: function(p){ return gref(p||""); },
      goOffline: function(){ var d=realDb(); if(d) d.goOffline(); },
      goOnline: function(){ var d=realDb(); if(d) d.goOnline(); },
      _gated: true
    };
    try{ Object.defineProperty(_gated, "app", { get:function(){ var d=realDb(); return d && d.app; } }); }catch(e){}
    return _gated;
  }
  function install(){
    if(!window.firebase || typeof window.firebase.database!=="function") return false;
    if(window.firebase.database._gated) return true;
    _orig=window.firebase.database;
    var g=function(){ return gatedDb(); };
    Object.keys(_orig).forEach(function(k){ try{ g[k]=_orig[k]; }catch(e){} });
    ["ServerValue","Reference","Query","DataSnapshot","Database","enableLogging"].forEach(function(k){ try{ if(_orig[k]!==undefined) g[k]=_orig[k]; }catch(e){} });
    g._gated=true;
    window.firebase.database=g;
    return true;
  }
  if(!install()){
    var t=setInterval(function(){ if(install()) clearInterval(t); }, 20);
  }

  /* REST reads of the database (login_fix users.json fallback) -> mirror */
  if(window.fetch && !window.fetch._gated){
    var _fetch=window.fetch;
    var gf=function(input, init){
      try{
        var url=String((input && input.url) || input || "");
        var method=String((init && init.method) || (input && input.method) || "GET").toUpperCase();
        var m=/^https:\/\/[^/]*firebasedatabase\.app\/(.*?)\.json(\?|$)/.exec(url);
        if(m && method==="GET"){
          return ready.then(function(){
            var v=getIn(M.tree, parts(decodeURIComponent(m[1])));
            return new Response(JSON.stringify(v==null?null:v), {status:200, headers:{"Content-Type":"application/json"}});
          });
        }
      }catch(e){}
      return _fetch.apply(this, arguments);
    };
    gf._gated=true;
    window.fetch=gf;
  }

  /* ---------- the only network reader ---------- */
  function iso(ms){ return new Date(ms).toISOString(); }
  function sizeOf(v){ try{ return v==null?4:JSON.stringify(v).length; }catch(e){ return 0; } }
  var _queue=Promise.resolve(), _lastMeta=null;

  async function doSync(opts){
    opts=opts||{};
    await ready;
    try{ if(typeof ensureFirebaseAuth==="function") await ensureFirebaseAuth(); }catch(e){}
    var d=realDb();
    if(!d) throw new Error("Firebase алга");
    var nodes=(opts.nodes||ALL_NODES).filter(function(n){ return ALL_NODES.indexOf(n)>=0; });
    var now=Date.now(), stats={ at:iso(now), reason:opts.reason||"", calls:0, bytes:0, nodes:{} };
    async function read(ref){ var s=await ref.once("value"); var v=s.val(); stats.calls++; stats.bytes+=sizeOf(v); return v; }

    var meta, serverUpd;
    if(opts.reuseMeta && _lastMeta && now-_lastMeta.t<5000){ meta=_lastMeta.meta; serverUpd=_lastMeta.upd; }
    else {
      meta=(await read(d.ref(ROOT+"/_meta")))||{};
      serverUpd=await read(d.ref(ROOT+"/updatedAt"));
      _lastMeta={ t:now, meta:meta, upd:serverUpd };
    }
    var mroot=getIn(M.tree,[ROOT])||{};
    var mmeta=mroot._meta||{};
    var legacyChanged=serverUpd!=null && serverUpd!==meta.updatedAt && serverUpd!==mroot.updatedAt;
    var changed=[];

    await Promise.all(nodes.map(async function(n){
      var st=M.nodes[n];
      var full=opts.full || !st || !st.fullAt || (now-st.fullAt)>FULL_AFTER_MS;
      if(full){
        var v=await read(d.ref(ROOT+"/"+n));
        putIn([ROOT,n], v);
        M.nodes[n]={ fullAt:now, lastSync:now };
        stats.nodes[n]="full "+sizeOf(v)+"B"; changed.push(n);
        return;
      }
      if(KEYED[n]){
        var since=iso(Math.max(0, (st.lastSync||0)-MARGIN_MS));
        var dv=await read(d.ref(ROOT+"/"+n).orderByChild(KEYED[n]).startAt(since));
        var cnt=0;
        if(dv && typeof dv==="object"){
          Object.keys(dv).forEach(function(k){
            var cur=getIn(M.tree,[ROOT,n,k]);
            if(!same(cur, dv[k])){ putIn([ROOT,n,k], dv[k]); cnt++; }
          });
        }
        st.lastSync=now;
        stats.nodes[n]="delta +"+cnt; if(cnt) changed.push(n);
        return;
      }
      var differs=(meta[n]||null)!==(mmeta[n]||null) || (ROOT_STAMPED[n] && legacyChanged);
      if(differs){
        var v2=await read(d.ref(ROOT+"/"+n));
        putIn([ROOT,n], v2);
        stats.nodes[n]="changed "+sizeOf(v2)+"B"; changed.push(n);
      } else stats.nodes[n]="same";
      st.lastSync=now;
    }));

    /* inbox rows removed elsewhere (sticky delete) -> drop them using the tombstones */
    var tombs=getIn(M.tree,[ROOT,"deleted"])||{}, inbox=getIn(M.tree,[ROOT,"inbox"]);
    if(inbox && typeof inbox==="object"){
      var tombIds={};
      Object.keys(tombs).forEach(function(k){ var t=tombs[k]; if(t && t.id) tombIds[t.id]=String(t.at||""); });
      Object.keys(inbox).forEach(function(k){ var s=inbox[k]; if(s && s.id && tombIds[s.id]!=null && String(s.submittedAt||"")<=tombIds[s.id]){ delete inbox[k]; if(changed.indexOf("inbox")<0) changed.push("inbox"); } });
    }
    putIn([ROOT,"_meta"], meta);
    if(serverUpd!=null) putIn([ROOT,"updatedAt"], serverUpd);
    M.lastSync=now;
    saveSoon();
    changed.forEach(function(n){ fire(ROOT+"/"+n); });
    stats.changed=changed;
    window._lastDelta=stats;
    (window._deltaLog=window._deltaLog||[]).push(stats);
    if(window._deltaLog.length>50) window._deltaLog.shift();
    return stats;
  }
  window._deltaSync=function(opts){
    var p=_queue.then(function(){ return doSync(opts); });
    _queue=p.catch(function(){});
    return p;
  };
  window._deltaNodesFor=function(role){
    if(role==="supervisor") return ["users","products","wines","submissions","inbox","deleted","logs","rosters"];
    if(role==="accountant") return ["users","products","wines","submissions","inbox","deleted","payments","rosters"];
    return ["users","products","wines","inbox","deleted"];
  };
  window._mirrorHas=function(node){ return !!(M.nodes[node] && M.nodes[node].fullAt); };
})();
