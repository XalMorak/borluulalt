/* keep_sync.js — өөр төхөөрөмж нэвтрэхэд серверийн сүүлийн илгээлтийг харуулна.
   Хуучин локал хуулбар биш, Firebase-ийн жинхэнэ уншилт. */
(function () {
  if (window._keepSync) return;
  window._keepSync = true;

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
    if (typeof window._deltaSync === "function") {
      try { await window._deltaSync({ nodes: ["inbox", "submissions", "deleted"], full: true, reason: "device" }); } catch (e) {}
    }
    var base = real();
    if (!base) return;
    var inbox = null, cloud = null;
    try { inbox = (await base.ref("borluulalt/inbox").once("value")).val(); } catch (e) {}
    try { cloud = (await base.ref("borluulalt/submissions").once("value")).val(); } catch (e2) {}
    var list = [];
    add(list, cloud); add(list, inbox);
    try { add(list, typeof getSubs === "function" ? getSubs() : []); } catch (e3) {}
    var map = {};
    list.forEach(function (s) {
      if (!s || s.deleted) return;
      var k = s.id || [s.employeeId, s.date, s.shift, s.location, s.receiverName || "", s.kind || ""].join("|");
      var cur = map[k];
      if (!cur || String(s.submittedAt || "") >= String(cur.submittedAt || "")) map[k] = s;
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
    fn._keep = true;
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
    fn._keep = true;
    window.showApp = fn;
  }
  function hookRefresh() {
    if (typeof window.refreshData !== "function" || window.refreshData._keep) return;
    var orig = window.refreshData;
    var fn = async function () {
      try { await pullFresh(); } catch (e) {}
      return orig.apply(this, arguments);
    };
    fn._keep = true;
    fn._delta = true;
    window.refreshData = fn;
  }
  hookSave(); hookShow(); hookRefresh();
  setInterval(function () { hookSave(); hookShow(); hookRefresh(); }, 800);
})();
