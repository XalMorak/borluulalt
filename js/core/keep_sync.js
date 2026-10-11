/* keep_sync.js — өөр төхөөрөмж нэвтрэхэд серверийн сүүлийн илгээлтийг харуулна.
   Хуучин локал хуулбар биш, Firebase-ийн жинхэнэ уншилт. */
(function () {
  if (window._keepSync) return;
  window._keepSync = true;

  /* new wrapper keeps the flags of the one it wraps, so other scripts' interval
     checks (e.g. fn._acct, fn._delta) still see themselves and don't wrap again —
     otherwise two scripts re-wrap each other forever and the chain grows every tick */
  function keepFlags(from, to) { Object.keys(from || {}).forEach(function (k) { if (k.charAt(0) === "_" && !(k in to)) to[k] = from[k]; }); return to; }
  /* reads go through the local mirror (net_gate.js); _deltaSync is the only network reader */
  function mirror() {
    try { if (typeof initFirebase === "function") initFirebase(); } catch (e) {}
    try { if (window._fbDb && window._fbDb.ref) return window._fbDb; } catch (e2) {}
    try { if (typeof firebase !== "undefined" && firebase.database) return firebase.database(); } catch (e3) {}
    return null;
  }
  function real() {
    try { if (typeof window._realDb === "function") return window._realDb(); } catch (e) {}
    try { if (typeof initFirebase === "function") initFirebase(); } catch (e2) {}
    try {
      if (typeof firebase !== "undefined" && firebase.database) {
        if ((!firebase.apps || !firebase.apps.length) && typeof firebaseConfig !== "undefined") firebase.initializeApp(firebaseConfig);
        return firebase.database();
      }
    } catch (e3) {}
    return null;
  }
  function add(list, v) {
    if (!v) return;
    if (Array.isArray(v)) v.forEach(function (s) { if (s) list.push(s); });
    else if (typeof v === "object") Object.keys(v).forEach(function (k) { if (v[k] && typeof v[k] === "object") list.push(v[k]); });
  }
  async function pullFresh() {
    var u = window.currentUser || {};
    if (u.role !== "supervisor" && u.role !== "accountant") return;
    var base = mirror();
    if (!base) return;
    if (typeof window._deltaSync === "function") {
      try {
        /* only what changed; an edit keeps its old submittedAt, so the inbox is pulled in full
           only when _meta/inbox (bumped by every edit / employee save) moved since last time */
        await window._deltaSync({ nodes: ["inbox", "submissions", "deleted"], reason: "device" });
        var m = null;
        try { m = (await base.ref("borluulalt/_meta/inbox").once("value")).val(); } catch (e0) {}
        var seenKey = "keep_sync_inbox_meta";
        if (m != null && String(m) !== String(localStorage.getItem(seenKey) || "")) {
          await window._deltaSync({ nodes: ["inbox"], full: true, reason: "device-inbox" });
          try { localStorage.setItem(seenKey, String(m)); } catch (e1) {}
        }
      } catch (e) {}
    }
    var inbox = null, cloud = null, deleted = null;
    try { inbox = (await base.ref("borluulalt/inbox").once("value")).val(); } catch (e) {}
    try { cloud = (await base.ref("borluulalt/submissions").once("value")).val(); } catch (e2) {}
    try { deleted = (await base.ref("borluulalt/deleted").once("value")).val(); } catch (e5) {}
    var list = [];
    add(list, cloud); add(list, inbox);
    /* this device's old copy only when the server lists are not available at all: otherwise a
       submission deleted or edited on another device came back from here */
    if (cloud == null && inbox == null) { try { add(list, typeof getSubs === "function" ? getSubs() : []); } catch (e3) {} }
    var map = {};
    var tombs = {};
    /* tombstones from the server too: a delete made on another device must not come back
       from this device's local copy */
    var allTombs = Object.assign({}, deleted || {}, window._tombs || {});
    try { Object.keys(allTombs).forEach(function (k) { var tb = allTombs[k] || {}; if (tb.id) tombs[tb.id] = 1; if (tb.biz) tombs[String(tb.biz).toLowerCase()] = 1; }); } catch (e4) {}
    list.forEach(function (s) {
      if (!s || s.deleted) return;
      var biz = [s.employeeId || "", s.date || "", s.shift || "", s.location || "", String(s.receiverName || s.tek || s.receiver || "").trim(), (s.kind || s.sheet || "bar")].join("|").toLowerCase();   // same key as sync_stable biz()
      if (tombs[s.id] || tombs[biz]) return;
      var k = s.id || [s.employeeId, s.date, s.shift, s.location, s.receiverName || "", s.kind || ""].join("|");
      var cur = map[k];
      /* newest edit wins; on a tie the earlier source (submissions, then inbox) is kept */
      if (!cur || String(s.editedAt || s.submittedAt || "") > String(cur.editedAt || cur.submittedAt || "")) map[k] = s;
    });
    var merged = Object.keys(map).map(function (k) { return map[k]; });
    if (!merged.length) return;
    if (typeof setSubs === "function") setSubs(merged);
    if (typeof loadSupervisorData === "function") loadSupervisorData();
    if (typeof window.renderAccountant === "function") window.renderAccountant();
    if (typeof window.renderSupervisorDay === "function") window.renderSupervisorDay();
  }
  function hookSave() {
    if (typeof window.saveSubmission !== "function" || window.saveSubmission._keep) return;
    var orig = window.saveSubmission;
    var fn = async function () {
      var r = await orig.apply(this, arguments);
      try {
        var base = real();
        if (base) await base.ref("borluulalt/_meta/inbox").set(Date.now() + "-" + Math.random().toString(36).slice(2, 8));
      } catch (e) {}
      return r;
    };
    keepFlags(orig, fn); fn._keep = true;
    window.saveSubmission = fn;
  }
  function hookShow() {
    if (typeof window.showApp !== "function" || window.showApp._keep) return;
    var orig = window.showApp;
    var fn = function () {
      var r = orig.apply(this, arguments);
      setTimeout(pullFresh, 200);
      return r;
    };
    keepFlags(orig, fn); fn._keep = true;
    window.showApp = fn;
  }
  function hookRefresh() {
    if (typeof window.refreshData !== "function" || window.refreshData._keep) return;
    var orig = window.refreshData;
    var fn = async function () {
      try { await pullFresh(); } catch (e) {}
      return orig.apply(this, arguments);
    };
    keepFlags(orig, fn); fn._keep = true;
    window.refreshData = fn;
  }
  hookSave(); hookShow(); hookRefresh();
  App.keep(function () { hookSave(); hookShow(); hookRefresh(); });
})();
