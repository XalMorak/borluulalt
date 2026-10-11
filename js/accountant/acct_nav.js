/* acct_nav.js — нягтлангийн таб нэг удаа солигдоно.
   Өмнө нь showAcctTab 800 мс тутамд дахин ороогдож, Илгээлт/Хэрэглэгч дарахад хариу өгөхгүй болсон. */
(function () {
  if (window._acctNav) return;
  window._acctNav = true;
  var PANES = { subs: "acctPaneSubs", users: "acctPaneUsers", roster: "acctPaneRoster", report: "acctPaneReport", pay: "acctPanePay" };

  function show(name) {
    if (!PANES[name]) name = "subs";
    Object.keys(PANES).forEach(function (k) {
      var p = document.getElementById(PANES[k]);
      if (p) p.classList.toggle("hidden", k !== name);
    });
    var bar = document.getElementById("acctTabs");
    if (bar) Array.prototype.forEach.call(bar.querySelectorAll("button[data-acct-tab]"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-acct-tab") === name);
      b.style.pointerEvents = "auto";
    });
    window._acctTab = name;
    if (name === "users" && typeof window.renderAcctUsers === "function") window.renderAcctUsers();
    if (name === "roster" && typeof window._cycleRefresh === "function") window._cycleRefresh();
    if (name === "report" && typeof window.renderAcctReport === "function") window.renderAcctReport();
    if (name === "pay" && typeof window.openAcctPay === "function") window.openAcctPay();
  }
  show._ar = true;
  show._pay = true;
  show._cyc = true;
  window.showAcctTab = show;

  function bind() {
    var bar = document.getElementById("acctTabs");
    if (!bar || bar._nav) return;
    bar._nav = true;
    bar.style.position = "relative";
    bar.style.zIndex = "5";
    bar.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-acct-tab]");
      if (!b) return;
      ev.preventDefault();
      show(b.getAttribute("data-acct-tab"));
    });
  }
  bind();
  setInterval(function () {
    window.showAcctTab = show;
    bind();
  }, 1000);
})();
