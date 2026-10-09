/* sup_cut.js — ахлахын Тойм, Тайлан, Түүх хаалттай. Ажилтны ээлжээс Бүтэн хасагдсан.
   Хуучин илгээлтийн «Бүтэн» утгыг устгахгүй. */
(function () {
  if (window._supCut) return;
  window._supCut = true;
  var DROP = { overview: 1, reports: 1, log: 1 };
  function cut() {
    ["tabBtnOverview", "tabBtnReports", "tabBtnLog"].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.remove();
    });
    ["tabOverview", "tabReports", "tabLog"].forEach(function (id) {
      var p = document.getElementById(id);
      if (p) p.classList.add("hidden");
    });
    var subs = document.getElementById("tabBtnSubs");
    var pane = document.getElementById("tabSubmissions");
    var open = document.querySelector("#supervisorView .tab-btn.active");
    if (!open && subs) subs.classList.add("active");
    if (pane && !document.querySelector("#supervisorView .tab-btn.active:not(#tabBtnSubs)")) {
      /* submissions stays available; do not force it over stock/users */
    }
    var shift = document.getElementById("shiftType");
    if (shift) {
      Array.prototype.forEach.call(shift.options, function (o) {
        if (o && (o.value === "Бүтэн" || o.text === "Бүтэн")) o.remove();
      });
      if (shift.value === "Бүтэн") shift.value = "Өглөө";
    }
  }
  if (typeof window.showTab === "function" && !window.showTab._supCut) {
    var orig = window.showTab;
    var fn = function (name) {
      if (DROP[name]) name = "submissions";
      return orig.apply(this, arguments);
    };
    fn._supCut = true;
    window.showTab = fn;
  }
  cut();
  setInterval(function () {
    cut();
    if (typeof window.showTab === "function" && !window.showTab._supCut) {
      var orig2 = window.showTab;
      var fn2 = function (name) {
        if (DROP[name]) name = "submissions";
        return orig2.apply(this, arguments);
      };
      fn2._supCut = true;
      window.showTab = fn2;
    }
  }, 800);
})();
