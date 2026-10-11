/* edit_clear.js — ахлахын засвар хуучин илгээлттэй давхардахгүй.
   Ажилтны Цэвэрлэх бүх мөр, бэлэн, карт, тек, нооргийг арилгана. */
(function () {
  if (window._editClear) return;
  window._editClear = true;

  function sid(s) {
    if (!s) return "";
    var tek = String((s.receiverName || s.tek || s.receiver) || "").trim();
    var kind = s.kind === "wine" || s.sheet === "wine" ? "wine" : "bar";
    return ["s", s.employeeId || "", s.date || "", s.shift || "", s.location || "", tek, kind].join("_").replace(/[.#$\[\]\/]/g, "_");
  }
  function db() {
    try { if (typeof window._realDb === "function" && window._realDb()) return window._realDb(); } catch (e) {}
    try { if (typeof initFirebase === "function") initFirebase(); } catch (e2) {}
    return window._fbDb || null;
  }
  function hookEdit() {
    if (typeof window.saveEditSubmission !== "function" || window.saveEditSubmission._clear) return;
    var orig = window.saveEditSubmission;
    var fn = async function (idx) {
      var before = (window._sortedSubs && window._sortedSubs[idx]) || null;
      var oldId = before && before.id;
      var oldKey = sid(before);
      var r = await orig.apply(this, arguments);
      var after = (window._sortedSubs && window._sortedSubs[idx]) || null;
      if (!after) return r;
      var keep = oldId || oldKey || after.id || sid(after);
      after.id = keep;
      after.editedAt = new Date().toISOString();
      var all = (typeof getSubs === "function" ? getSubs() : []).filter(function (s) {
        if (!s) return false;
        if (keep && s.id === keep) return false;
        if (oldKey && (s.id === oldKey || sid(s) === oldKey)) return false;
        if (sid(s) === sid(after)) return false;
        return true;
      });
      all.push(after);
      if (typeof setSubs === "function") setSubs(all);
      if (window._sortedSubs) window._sortedSubs[idx] = after;
      try {
        var base = db();
        if (base) {
          await base.ref("borluulalt/inbox/" + keep).set(after);
          if (oldKey && oldKey !== keep) await base.ref("borluulalt/inbox/" + oldKey).remove();
          await base.ref("borluulalt/_meta/inbox").set(Date.now() + "-edit");
        }
      } catch (e) {}
      if (typeof loadSupervisorData === "function") loadSupervisorData();
      return r;
    };
    fn._clear = true;
    window.saveEditSubmission = fn;
  }
  function hookReset() {
    if (typeof window.resetForm !== "function" || window.resetForm._clear) return;
    var orig = window.resetForm;
    var fn = function () {
      var r = orig.apply(this, arguments);
      var body = document.getElementById("salesBody");
      if (body) body.querySelectorAll("input").forEach(function (el) { el.value = "0"; });
      ["cashAmount", "cardTotal", "cashBalance", "posNumber", "checkerName"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = id === "posNumber" || id === "checkerName" ? "" : "0";
      });
      var tek = document.getElementById("receiverName");
      if (tek) tek.value = "";
      var loc = document.getElementById("locationName");
      if (loc) loc.value = "";
      try {
        var u = (window.currentUser && currentUser.id) || "anon";
        localStorage.removeItem("borluulalt_emp_draft_" + u);
      } catch (e) {}
      window._formDirty = false;
      if (typeof updateRecon === "function") updateRecon();
      return r;
    };
    fn._clear = true;
    window.resetForm = fn;
  }
  hookEdit(); hookReset();
  setInterval(function () { hookEdit(); hookReset(); }, 700);
})();
