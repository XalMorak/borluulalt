/* acct_pay.js — Нягтлан: дутуу төлөх, төлөлтийн бүртгэл.
   Хэн, хэзээ, хэдэн төгрөг. Бүртгэл borluulalt/payments/_ledger.
   Дүн нь тухайн ажилтны хамгийн хуучин дутуу илгээлтээс эхэлж хасагдана. */
(function () {
  if (window._acctPay) return;
  window._acctPay = true;

  var _subs = [], _pays = {}, _ledger = [], _loaded = 0;

  function U() { return window._acctUtil || {}; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function money(n) { var f = U().money; return f ? f(n) : Math.round(num(n)).toLocaleString() + "₮"; }
  function esc(v) { var f = U().esc; return f ? f(v) : String(v == null ? "" : v); }
  function today() { var f = U().today; return f ? f() : ""; }
  function me() { var f = U().me; return f ? f() : (window.currentUser || {}); }
  function diffOf(s) { var f = U().diffOf; return f ? f(s) : num(s && s.diff); }
  function keySafe(s) {
    var b = U().biz ? U().biz(s) : "";
    return String(b || "x").replace(/[.#$\[\]\/]/g, "_");
  }
  function listOf(x) {
    var f = U().listOf;
    if (f) return f(x);
    if (Array.isArray(x)) return x.filter(Boolean);
    if (x && typeof x === "object") return Object.keys(x).map(function (k) { return x[k]; }).filter(Boolean);
    return [];
  }

  function db() {
    try {
      if (typeof initFirebase === "function") initFirebase();
      if (typeof firebase !== "undefined" && firebase.database) {
        if ((!firebase.apps || !firebase.apps.length) && typeof firebaseConfig !== "undefined") firebase.initializeApp(firebaseConfig);
        return firebase.database();
      }
    } catch (e) {}
    return window._fbDb || null;
  }
  async function authed() {
    try { if (typeof ensureFirebaseAuth === "function") await ensureFirebaseAuth(); } catch (e) {}
    return db();
  }

  function paidAmt(k) {
    var p = _pays[k] || {};
    return p.paid ? num(p.amount) : 0;
  }
  function dueOf(s) {
    var d = diffOf(s);
    if (d >= -0.5) return 0;
    return Math.max(0, Math.abs(d) - paidAmt(keySafe(s)));
  }
  function shortsOf(empId) {
    return _subs.filter(function (s) { return s && s.employeeId === empId && dueOf(s) > 0.5; })
      .sort(function (a, b) { return String(a.date || "").localeCompare(String(b.date || "")); });
  }
  function empRows() {
    var map = {};
    _subs.forEach(function (s) {
      var id = s.employeeId || "";
      if (!id) return;
      var e = map[id] || (map[id] = { id: id, name: s.employeeName || id, due: 0, n: 0 });
      var due = dueOf(s);
      if (due > 0.5) { e.due += due; e.n++; }
      if (s.employeeName) e.name = s.employeeName;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .filter(function (e) { return e.due > 0.5; })
      .sort(function (a, b) { return b.due - a.due || String(a.name).localeCompare(String(b.name)); });
  }

  async function loadAll() {
    var base = await authed();
    if (!base) return;
    var res = await Promise.all([
      base.ref("borluulalt/submissions").once("value"),
      base.ref("borluulalt/inbox").once("value"),
      base.ref("borluulalt/payments").once("value")
    ]);
    var pays = res[2].val() || {};
    _ledger = [];
    _pays = {};
    Object.keys(pays).forEach(function (k) {
      if (k === "_ledger") {
        var node = pays[k] || {};
        Object.keys(node).forEach(function (id) {
          var row = node[id];
          if (row && typeof row === "object") { row.id = id; _ledger.push(row); }
        });
      } else _pays[k] = pays[k];
    });
    _ledger.sort(function (a, b) { return String(b.at || "").localeCompare(String(a.at || "")); });
    var merged = listOf(res[0].val()).concat(listOf(res[1].val()));
    var by = {};
    merged.forEach(function (s) {
      if (!s || s.deleted) return;
      var k = s.id ? "id:" + s.id : "b:" + (U().biz ? U().biz(s) : "");
      if (!by[k] || String(s.submittedAt || "") >= String((by[k].submittedAt) || "")) by[k] = s;
    });
    var biz = {};
    Object.keys(by).forEach(function (k) {
      var s = by[k], b = U().biz ? U().biz(s) : k;
      if (!biz[b] || String(s.submittedAt || "") >= String((biz[b].submittedAt) || "")) biz[b] = s;
    });
    _subs = Object.keys(biz).map(function (k) { return biz[k]; }).filter(function (s) { return s && !s.deleted; });
    _loaded = Date.now();
  }

  function fillForm(empId) {
    var sel = document.getElementById("payEmp");
    var amt = document.getElementById("payAmt");
    if (sel && empId) sel.value = empId;
    var id = sel ? sel.value : empId;
    var e = empRows().filter(function (x) { return x.id === id; })[0];
    if (amt && e) amt.value = Math.round(e.due);
  }

  function render() {
    var dueBox = document.getElementById("payDue");
    var hist = document.getElementById("payHist");
    var sel = document.getElementById("payEmp");
    if (!dueBox || !hist) return;
    var rows = empRows();
    var dueMap = {};
    rows.forEach(function (e) { dueMap[e.id] = e; });
    var people = [];
    var seen = {};
    if (typeof getUsers === "function") {
      var us = getUsers() || {};
      Object.keys(us).forEach(function (id) {
        var u = us[id] || {};
        if (u.role === "accountant" || u.role === "supervisor") return;
        seen[id] = 1;
        people.push({ id: id, name: u.name || id, due: dueMap[id] ? dueMap[id].due : 0 });
      });
    }
    rows.forEach(function (e) { if (!seen[e.id]) people.push(e); });
    people.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    var cur = sel ? sel.value : "";
    if (sel) {
      sel.innerHTML = '<option value="">Ажилтан сонго</option>' + people.map(function (e) {
        return '<option value="' + esc(e.id) + '">' + esc(e.name) + (e.due ? " · дутуу " + money(e.due) : "") + "</option>";
      }).join("");
      if (cur) sel.value = cur;
    }
    var total = rows.reduce(function (a, e) { return a + e.due; }, 0);
    dueBox.innerHTML = '<div class="summary-box"><div class="summary-item"><div class="label">Дутуутай ажилтан</div><div class="value">' + rows.length + '</div></div><div class="summary-item"><div class="label">Нийт үлдэгдэл</div><div class="value diff-short">' + money(total) + "</div></div></div>"
      + '<div class="table-wrap"><table><thead><tr><th>Ажилтан</th><th>Дутуу илгээлт</th><th>Үлдэгдэл</th><th></th></tr></thead><tbody>'
      + (rows.map(function (e) {
        return '<tr><td style="text-align:left">' + esc(e.name) + ' <small style="color:#888">(' + esc(e.id) + ')</small></td><td>' + e.n + '</td><td class="diff-short"><strong>' + money(e.due) + '</strong></td><td><button type="button" class="btn btn-sm" data-payemp="' + esc(e.id) + '">Төлөх</button></td></tr>';
      }).join("") || '<tr><td colspan="4">Дутуу үлдэгдэл алга</td></tr>')
      + "</tbody></table></div>";
    var filter = (document.getElementById("payHistEmp") || {}).value || "";
    var list = _ledger.filter(function (r) { return !filter || r.employeeId === filter; });
    hist.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Огноо</th><th>Ажилтан</th><th>Үйлдэл</th><th>Дүн</th><th>Тэмдэглэл</th><th>Бүртгэсэн</th><th>Цаг</th><th></th></tr></thead><tbody>'
      + (list.map(function (r) {
        var when = r.at ? new Date(r.at).toLocaleString("mn-MN") : "—";
        var labels = { pay: "Төлөлт", short_add: "Дутуу нэмэх", short_sub: "Дутуу хасах", over_add: "Илүү нэмэх", over_sub: "Илүү хасах" };
        return "<tr><td>" + esc(r.date || "—") + "</td><td style=\"text-align:left\">" + esc(r.employeeName || r.employeeId) + "</td><td>" + esc(labels[r.type] || "Төлөлт") + "</td><td>" + money(r.amount) + "</td><td style=\"text-align:left\">" + esc(r.note || "—") + "</td><td>" + esc(r.byName || r.by || "—") + "</td><td>" + esc(when) + '</td><td><button type="button" class="btn btn-outline btn-sm" data-paydel="' + esc(r.id) + '">Устгах</button></td></tr>';
      }).join("") || '<tr><td colspan="8">Төлөлт алга</td></tr>')
      + "</tbody></table></div>";
    var stamp = document.getElementById("payStamp");
    if (stamp) stamp.textContent = _loaded ? "Уншсан: " + new Date(_loaded).toLocaleTimeString("mn-MN") : "";
  }

  async function allocate(empId, amount, sign) {
    var left = Math.round(num(amount));
    if (left <= 0) return [];
    var rows = shortsOf(empId);
    if (sign < 0) rows.reverse();
    var touched = [];
    var base = await authed();
    if (!base) throw new Error("no db");
    for (var i = 0; i < rows.length && left > 0; i++) {
      var s = rows[i], k = keySafe(s), prev = paidAmt(k);
      var room = sign > 0 ? dueOf(s) : prev;
      var take = Math.min(left, room);
      if (take <= 0) continue;
      var next = Math.max(0, prev + sign * take);
      var rec = { paid: next > 0.5, amount: next, at: new Date().toISOString(), by: me().id || "" };
      await base.ref("borluulalt/payments/" + k).set(rec);
      _pays[k] = rec;
      left -= take;
      touched.push(k);
    }
    return touched;
  }

  async function savePay() {
    var emp = (document.getElementById("payEmp") || {}).value;
    var amount = Math.round(num((document.getElementById("payAmt") || {}).value));
    var date = (document.getElementById("payDate") || {}).value || today();
    var note = ((document.getElementById("payNote") || {}).value || "").trim();
    var type = (document.getElementById("payType") || {}).value || "pay";
    var who = empRows().filter(function (e) { return e.id === emp; })[0];
    var uname = who ? who.name : emp;
    if (typeof getUsers === "function" && getUsers()[emp]) uname = getUsers()[emp].name || uname;
    if (!emp) { if (typeof showAlert === "function") showAlert("payAlert", "Ажилтан сонго", "error"); return; }
    if (amount <= 0) { if (typeof showAlert === "function") showAlert("payAlert", "Дүн оруул", "error"); return; }
    if (type === "pay" && who && amount > who.due + 0.5) { if (typeof showAlert === "function") showAlert("payAlert", "Төлөлт үлдэгдлээс их байна. Илүү нэмэх гэж байвал үйлдлээ солино уу.", "error"); return; }
    var base = await authed();
    if (!base) { if (typeof showAlert === "function") showAlert("payAlert", "Сервер алга", "error"); return; }
    var u = me();
    var rec = { employeeId: emp, employeeName: uname, amount: amount, date: date, note: note, type: type, at: new Date().toISOString(), by: u.id || "", byName: u.name || u.id || "" };
    try {
      var ref = await base.ref("borluulalt/payments/_ledger").push(rec);
      rec.id = ref.key;
      if (type === "pay" || type === "short_sub") await allocate(emp, amount, 1);
      _ledger.unshift(rec);
      if (typeof showAlert === "function") showAlert("payAlert", who.name + " " + money(amount) + " төлөлт бүртгэгдлээ", "success");
      var noteEl = document.getElementById("payNote");
      if (noteEl) noteEl.value = "";
      render();
      fillForm(emp);
      if (typeof window.renderAccountant === "function") window.renderAccountant({ reload: true });
    } catch (e) {
      if (typeof showAlert === "function") showAlert("payAlert", "Бүртгэгдсэнгүй: " + (e && e.message ? e.message : "алдаа"), "error");
    }
  }

  async function deletePay(id) {
    var row = _ledger.filter(function (r) { return r.id === id; })[0];
    if (!row) return;
    if (!window.confirm((row.employeeName || "") + " " + money(row.amount) + " төлөлтийг устгах уу?")) return;
    var base = await authed();
    if (!base) return;
    try {
      await base.ref("borluulalt/payments/_ledger/" + id).remove();
      await allocate(row.employeeId, row.amount, -1);
      _ledger = _ledger.filter(function (r) { return r.id !== id; });
      if (typeof showAlert === "function") showAlert("payAlert", "Төлөлт устгалаа", "success");
      render();
      if (typeof window.renderAccountant === "function") window.renderAccountant({ reload: true });
    } catch (e) {
      if (typeof showAlert === "function") showAlert("payAlert", "Устгасангүй", "error");
    }
  }

  function ensure() {
    var tabs = document.getElementById("acctTabs");
    var root = document.getElementById("accountantView");
    if (!tabs || !root || document.getElementById("acctPanePay")) return;
    if (!tabs.querySelector('button[data-acct-tab="pay"]')) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tab-btn";
      btn.setAttribute("data-acct-tab", "pay");
      btn.textContent = "Төлөлт";
      var report = tabs.querySelector('button[data-acct-tab="report"]');
      if (report) tabs.insertBefore(btn, report);
      else tabs.appendChild(btn);
    }
    var pane = document.createElement("div");
    pane.id = "acctPanePay";
    pane.className = "hidden";
    pane.innerHTML = ''
      + '<h3 style="margin:6px 0">Дутуу төлөх</h3>'
      + '<p style="margin:0 0 8px;color:#5b6570;font-size:.85rem">Төлөлт хамгийн хуучин дутуу илгээлтээс эхэлж хасагдана. Хэн, хэзээ, хэдийг төлснийг доор бүртгэнэ.</p>'
      + '<div id="payAlert"></div>'
      + '<div id="payDue"></div>'
      + '<div class="header-info" style="margin-top:10px">'
      + '<div><label>Ажилтан</label><select id="payEmp"></select></div>'
      + '<div><label>Үйлдэл</label><select id="payType"><option value="pay">Дутуу хасах (төлөлт)</option><option value="short_add">Дутуу нэмэх</option><option value="short_sub">Дутуу хасах</option><option value="over_add">Илүү нэмэх</option><option value="over_sub">Илүү хасах</option></select></div>'
      + '<div><label>Дүн</label><input type="number" id="payAmt" min="0" step="1"></div>'
      + '<div><label>Огноо</label><input type="date" id="payDate"></div>'
      + '<div><label>Тэмдэглэл</label><input id="payNote" placeholder="Жишээ: бэлнээр"></div>'
      + '<div style="display:flex;align-items:flex-end"><button type="button" class="btn btn-success btn-sm" id="paySave">Төлөлт бүртгэх</button></div>'
      + "</div>"
      + '<h4 style="margin:14px 0 6px">Төлөлтийн бүртгэл <small id="payStamp" style="font-weight:400;color:#666"></small></h4>'
      + '<div class="no-print" style="margin-bottom:8px"><label>Шүүх </label><select id="payHistEmp"><option value="">Бүгд</option></select> <button type="button" class="btn btn-sm" id="payReload">Шинэчлэх</button></div>'
      + '<div id="payHist"></div>';
    root.appendChild(pane);
    document.getElementById("payDate").value = today();
    document.getElementById("paySave").onclick = savePay;
    document.getElementById("payReload").onclick = function () { openPay(true); };
    document.getElementById("payEmp").onchange = function () { fillForm(this.value); };
    document.getElementById("payHistEmp").onchange = render;
    pane.addEventListener("click", function (ev) {
      var go = ev.target.closest("[data-payemp]");
      var del = ev.target.closest("[data-paydel]");
      if (go) fillForm(go.getAttribute("data-payemp"));
      if (del) deletePay(del.getAttribute("data-paydel"));
    });
  }

  function fillHistFilter() {
    var sel = document.getElementById("payHistEmp");
    if (!sel) return;
    var cur = sel.value;
    var seen = {};
    _ledger.forEach(function (r) { if (r.employeeId) seen[r.employeeId] = r.employeeName || r.employeeId; });
    sel.innerHTML = '<option value="">Бүгд</option>' + Object.keys(seen).sort(function (a, b) { return String(seen[a]).localeCompare(String(seen[b])); }).map(function (id) {
      return '<option value="' + esc(id) + '">' + esc(seen[id]) + "</option>";
    }).join("");
    if (cur) sel.value = cur;
  }

  async function openPay(reload) {
    ensure();
    ["acctPaneSubs", "acctPaneUsers", "acctPaneRoster", "acctPaneReport"].forEach(function (id) {
      var p = document.getElementById(id); if (p) p.classList.add("hidden");
    });
    var pane = document.getElementById("acctPanePay");
    if (pane) pane.classList.remove("hidden");
    var bar = document.getElementById("acctTabs");
    if (bar) Array.prototype.forEach.call(bar.querySelectorAll("button[data-acct-tab]"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-acct-tab") === "pay");
    });
    window._acctTab = "pay";
    if (reload || !_loaded) {
      try { await loadAll(); } catch (e) { if (typeof showAlert === "function") showAlert("payAlert", "Уншиж чадсангүй", "error"); }
    }
    fillHistFilter();
    render();
  }

  function hook() {
    ensure();
    if (typeof window.showAcctTab === "function" && !window.showAcctTab._pay) {
      var orig = window.showAcctTab;
      var fn = function (name) {
        if (name === "pay") return openPay(false);
        var pane = document.getElementById("acctPanePay");
        if (pane) pane.classList.add("hidden");
        return orig.apply(this, arguments);
      };
      fn._pay = true;
      window.showAcctTab = fn;
    }
  }
  hook();
  setInterval(hook, 800);
})();
