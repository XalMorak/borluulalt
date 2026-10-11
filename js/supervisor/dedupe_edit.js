/* dedupe_edit.js — зассан илгээлт хуучинтайгаа давхардахгүй.
   Нэг ажилтан + огноо + ээлж + байршил дээр хамгийн сүүлийнхийг л харуулна. */
(function () {
  if (window._dedupeEdit) return;
  window._dedupeEdit = true;

  function tekOf(s) { return String((s && (s.receiverName || s.tek || s.receiver)) || "").trim(); }
  function kindOf(s) { return (s && (s.kind === "wine" || s.sheet === "wine")) ? "wine" : "bar"; }
  function sid(s) {
    if (!s) return "";
    return ["s", s.employeeId || "", s.date || "", s.shift || "", s.location || "", tekOf(s), kindOf(s)].join("_").replace(/[.#$\[\]\/]/g, "_");
  }
  function groupKey(s) {
    return [s.employeeId || "", s.date || "", s.shift || "", s.location || "", kindOf(s)].join("|").toLowerCase();
  }
  function db() {
    try { if (typeof window._realDb === "function" && window._realDb()) return window._realDb(); } catch (e) {}
    return window._fbDb || null;
  }
  function collapse(list) {
    var map = {};
    (list || []).forEach(function (s) {
      if (!s || s.deleted) return;
      var k = groupKey(s);
      var cur = map[k];
      if (!cur) { map[k] = s; return; }
      var a = String(s.editedAt || s.submittedAt || "");
      var b = String(cur.editedAt || cur.submittedAt || "");
      var newer = a >= b ? s : cur;
      var older = newer === s ? cur : s;
      newer._replaced = (newer._replaced || []).concat(older.id || sid(older), sid(older));
      map[k] = newer;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }
  function hookList() {
    if (typeof window.renderSubmissionsList !== "function" || window.renderSubmissionsList._dedupeEdit) return;
    var orig = window.renderSubmissionsList;
    var fn = function (all) {
      return orig.call(this, collapse(all || (typeof getSubs === "function" ? getSubs() : [])));
    };
    fn._dedupeEdit = true;
    window.renderSubmissionsList = fn;
  }
  function hookEdit() {
    if (typeof window.saveEditSubmission !== "function" || window.saveEditSubmission._dedupeEdit) return;
    var orig = window.saveEditSubmission;
    var fn = async function (idx) {
      var before = (window._sortedSubs && window._sortedSubs[idx]) || null;
      var oldId = before && before.id;
      var oldSid = sid(before);
      var r = await orig.apply(this, arguments);
      var after = (window._sortedSubs && window._sortedSubs[idx]) || null;
      if (!after) return r;
      after.editedAt = new Date().toISOString();
      var keep = after.id || oldId || sid(after);
      after.id = keep;
      var all = collapse((typeof getSubs === "function" ? getSubs() : []).filter(function (s) {
        if (!s) return false;
        if (oldId && s.id === oldId) return false;
        if (oldSid && (s.id === oldSid || sid(s) === oldSid)) return false;
        return true;
      }).concat([after]));
      if (typeof setSubs === "function") setSubs(all);
      try {
        var base = db();
        if (base) {
          var newSid = sid(after);
          await base.ref("borluulalt/inbox/" + (keep || newSid)).set(after);
          [oldSid, oldId].forEach(function (k) {
            if (k && k !== keep && k !== newSid) base.ref("borluulalt/inbox/" + k).remove();
          });
          await base.ref("borluulalt/_meta/inbox").set(Date.now() + "-edit");
        }
      } catch (e) {}
      if (typeof loadSupervisorData === "function") loadSupervisorData();
      return r;
    };
    fn._dedupeEdit = true;
    window.saveEditSubmission = fn;
  }
  hookList(); hookEdit();
  setInterval(function () { hookList(); hookEdit(); }, 700);
})();
