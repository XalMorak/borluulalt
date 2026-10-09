/* acct_user_show.js — нягтланд нэмсэн хэрэглэгч жагсаалтаас алга болохгүй.
   Хуучин серверийн уншилт шинэ мөрийг дарахгүй нэгтгэнэ. */
(function () {
  if (window._acctUserShow) return;
  window._acctUserShow = true;
  var pending = {};

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function users() {
    var o = {};
    try {
      var raw = typeof getUsers === "function" ? getUsers() : {};
      Object.keys(raw || {}).forEach(function (k) {
        var u = raw[k];
        if (u && typeof u === "object" && (u.name || u.role)) o[String(k)] = u;
      });
    } catch (e) {}
    Object.keys(pending).forEach(function (k) { if (!o[k]) o[k] = pending[k]; });
    return o;
  }
  function roleLabel(r) {
    return r === "supervisor" ? "Ахлах" : r === "accountant" ? "Нягтлан" : "Ажилтан";
  }
  function remember(id, rec) {
    pending[id] = rec;
    try {
      if (typeof getUsers === "function" && typeof setUsers === "function") {
        var all = Object.assign({}, getUsers() || {});
        all[id] = rec;
        setUsers(all);
      }
    } catch (e) {}
    try { localStorage.setItem("deleted_user_ids", JSON.stringify((JSON.parse(localStorage.getItem("deleted_user_ids") || "[]") || []).filter(function (x) { return String(x) !== id; }))); } catch (e2) {}
  }
  function paintMissing() {
    var tb = document.getElementById("auBody");
    if (!tb) return;
    var all = users();
    Object.keys(all).forEach(function (id) {
      if (tb.querySelector('tr[data-uid="' + CSS.escape(id) + '"]')) return;
      var u = all[id] || {};
      var r = u.role || "employee";
      var opts = [["employee", "Ажилтан"], ["supervisor", "Ахлах"], ["accountant", "Нягтлан"]].map(function (x) {
        return '<option value="' + x[0] + '"' + (x[0] === r ? " selected" : "") + ">" + x[1] + "</option>";
      }).join("");
      var tr = document.createElement("tr");
      tr.setAttribute("data-uid", id);
      tr.innerHTML = '<td style="text-align:left"><b>' + esc(id) + '</b> <small style="color:#0f3460">шинэ</small></td>'
        + '<td><input class="au-name" value="' + esc(u.name || "") + '"></td>'
        + '<td><select class="au-role">' + opts + "</select></td>"
        + '<td><input class="au-pin" type="password" value="' + esc(u.pin || "") + '"></td>'
        + '<td class="au-act"><button type="button" class="btn btn-success btn-sm" data-act="save">Хадгалах</button></td>';
      var empty = tb.querySelector("td[colspan]");
      if (empty && empty.parentNode) empty.parentNode.remove();
      tb.insertBefore(tr, tb.firstChild);
    });
    var c = document.getElementById("auCount");
    if (c) c.textContent = "(" + tb.querySelectorAll("tr[data-uid]").length + ")";
  }
  function hook() {
    if (typeof window.acctAddUser === "function" && !window.acctAddUser._show) {
      var orig = window.acctAddUser;
      var fn = async function () {
        var id = ((document.getElementById("auNewId") || {}).value || "").trim().toLowerCase();
        var name = ((document.getElementById("auNewName") || {}).value || "").trim();
        var role = (document.getElementById("auNewRole") || {}).value || "employee";
        var pin = ((document.getElementById("auNewPin") || {}).value || "").trim();
        if (id && name) remember(id, { name: name, role: role, pin: pin });
        var r = await orig.apply(this, arguments);
        paintMissing();
        return r;
      };
      fn._show = true;
      window.acctAddUser = fn;
    }
    if (typeof window.renderAcctUsers === "function" && !window.renderAcctUsers._show) {
      var prev = window.renderAcctUsers;
      var wrapped = async function () {
        var r = await prev.apply(this, arguments);
        paintMissing();
        return r;
      };
      wrapped._show = true;
      window.renderAcctUsers = wrapped;
    }
    var tabs = document.getElementById("acctTabs");
    if (tabs && !tabs._userShow) {
      tabs._userShow = true;
      tabs.addEventListener("click", function (ev) {
        var b = ev.target.closest("button[data-acct-tab]");
        if (!b || b.getAttribute("data-acct-tab") !== "users") return;
        setTimeout(function () { if (typeof window.renderAcctUsers === "function") window.renderAcctUsers(); }, 50);
      });
    }
    paintMissing();
  }
  hook();
  setInterval(hook, 800);
})();
