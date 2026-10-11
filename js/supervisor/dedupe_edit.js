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
  hookList();
  setInterval(hookList, 700);
})();
