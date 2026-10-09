/* keep_sync.js — шинэ илгээлт шинэчлэхэд, өөр ахлах нэвтрэхэд алга болохгүй.
   Ажилтан хадгалахад _meta/inbox шинэчлэгдэнэ. Ахлах/нягтлан шинэчлэхэд inbox+submissions-ийг серверээс бүтэн татна. */
(function () {
  if (window._keepSync) return;
  window._keepSync = true;

  function db() {
    try { if (typeof initFirebase === "function") initFirebase(); } catch (e) {}
    try {
      if (typeof firebase !== "undefined" && firebase.database) {
        if ((!firebase.apps || !firebase.apps.length) && typeof firebaseConfig !== "undefined") firebase.initializeApp(firebaseConfig);
        return firebase.database();
      }
    } catch (e2) {}
    return window._fbDb || null;
  }
  async function pullFresh() {
    if (typeof window._deltaSync !== "function") return;
    await window._deltaSync({ nodes: ["inbox", "submissions", "deleted"], full: true, reason: "keep" });
    var base = db();
    if (!base) return;
    var inbox = null, cloud = null;
    try { inbox = (await base.ref("borluulalt/inbox").once("value")).val(); } catch (e) {}
    try { cloud = (await base.ref("borluulalt/submissions").once("value")).val(); } catch (e2) {}
    var list = [];
    function add(v) {
      if (!v) return;
      if (Array.isArray(v)) v.forEach(function (s) { if (s) list.push(s); });
      else if (typeof v === "object") Object.keys(v).forEach(function (k) { if (v[k]) list.push(v[k]); });
    }
    add(cloud); add(inbox);
    try { add(typeof getSubs === "function" ? getSubs() : []); } catch (e3) {}
    var map = {};
    list.forEach(function (s) {
      if (!s || s.deleted) return;
      var k = s.id || [s.employeeId, s.date, s.shift, s.location, s.receiverName || "", s.kind || ""].join("|");
      var cur = map[k];
      if (!cur || String(s.submittedAt || "") >= String(cur.submittedAt || "")) map[k] = s;
    });
    var merged = Object.keys(map).map(function (k) { return map[k]; });
    if (typeof setSubs === "function") setSubs(merged);
    if (typeof loadSupervisorData === "function") loadSupervisorData();
    if (typeof window.renderAccountant === "function") window.renderAccountant();
  }
  function hookSave() {
    if (typeof window.saveSubmission !== "function" || window.saveSubmission._keep) return;
    var orig = window.saveSubmission;
    var fn = async function () {
      var r = await orig.apply(this, arguments);
      try {
        var base = db();
        if (base) await base.ref("borluulalt/_meta/inbox").set(Date.now() + "-" + Math.random().toString(36).slice(2, 8));
      } catch (e) {}
      return r;
    };
    fn._keep = true;
    window.saveSubmission = fn;
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
  function hookLogin() {
    if (typeof window.doLogin !== "function" || window.doLogin._keep) return;
    var orig = window.doLogin;
    var fn = async function () {
      var r = await orig.apply(this, arguments);
      var u = window.currentUser || {};
      if (u.role === "supervisor" || u.role === "accountant") {
        setTimeout(function () { pullFresh(); }, 400);
      }
      return r;
    };
    fn._keep = true;
    window.doLogin = fn;
  }
  hookSave(); hookRefresh(); hookLogin();
  setInterval(function () { hookSave(); hookRefresh(); hookLogin(); }, 800);
})();
