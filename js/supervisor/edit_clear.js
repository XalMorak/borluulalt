/* edit_clear.js — ахлахын засвар хуучин илгээлттэй давхардахгүй.
   Ажилтны Цэвэрлэх бүх мөр, бэлэн, карт, тек, нооргийг арилгана. */
(function () {
  if (window._editClear) return;
  window._editClear = true;

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
  hookReset();
  setInterval(hookReset, 700);
})();
