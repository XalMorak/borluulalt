/* acct_report.js — Нягтлан: Тайлан таб + ростер засах/устгах.
   Шүүлт нь Илгээлт табтай нэг (ростер, огноо, ажилтан, байршил, тек, төрөл).
   Тайлан: хураангуй, өдөр, байршил, ээлж, тек, бараа, тооцоо (үлдэгдэл). */
(function () {
  if (window._acctReport) return;
  window._acctReport = true;

  function U() { return window._acctUtil || {}; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function money(n) { var f = U().money; return f ? f(n) : Math.round(num(n)).toLocaleString() + "₮"; }
  function signed(n) { var f = U().signed; return f ? f(n) : (Math.round(num(n)) > 0 ? "+" : "") + Math.round(num(n)).toLocaleString() + "₮"; }
  function esc(v) { var f = U().esc; return f ? f(v) : String(v == null ? "" : v); }
  function tekOf(s) { var f = U().tekOf; return f ? f(s) : ""; }
  function kindOf(s) { var f = U().kindOf; return f ? f(s) : "bar"; }
  function calcOf(s) { var f = U().calcOf; return f ? f(s) : 0; }
  function collectedOf(s) { var f = U().collectedOf; return f ? f(s) : 0; }
  function diffOf(s) { var f = U().diffOf; return f ? f(s) : 0; }
  function diffCls(d) { var f = U().diffCls; return f ? f(d) : ""; }
  function today() { var f = U().today; return f ? f() : ""; }
  function addDays(iso, n) { var f = U().addDays; return f ? f(iso, n) : iso; }
  function me() { var f = U().me; return f ? f() : (window.currentUser || {}); }

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

  var _view = "sum";

  function rows() { return window._acctRows || []; }

  function payOf(i) {
    var tr = document.querySelector('#acctBody tr[data-i="' + i + '"]');
    if (!tr) return { paid: false, amount: 0 };
    var cb = tr.querySelector(".acct-paid");
    var amt = tr.querySelector(".acct-amt");
    return { paid: !!(cb && cb.checked), amount: num(amt && amt.value) };
  }

  function cashIn(s) { return Math.max(0, num(s && s.cashAmount) - num(s && s.cashBalance)); }
  function cardIn(s) { return num(s && s.cardTotal); }

  function scopeLabel() {
    var roster = document.getElementById("acctRoster");
    var from = (document.getElementById("acctFrom") || {}).value || "";
    var to = (document.getElementById("acctTo") || {}).value || "";
    var emp = document.getElementById("acctEmp");
    var loc = document.getElementById("acctLoc");
    var tek = document.getElementById("acctTek");
    var kind = document.getElementById("acctKind");
    var bits = [];
    if (roster && roster.value) bits.push(roster.options[roster.selectedIndex].text);
    else if (from || to) bits.push((from || "…") + " — " + (to || "…"));
    else bits.push("Бүх хугацаа");
    if (emp && emp.value) bits.push(emp.options[emp.selectedIndex].text);
    if (loc && loc.value) bits.push(loc.value);
    if (tek && tek.value) bits.push(tek.value);
    if (kind && kind.value && kind.value !== "all") bits.push(kind.value === "wine" ? "Вино" : "Пиво");
    return bits.join(" · ");
  }

  function setRange(from, to, roster) {
    var a = document.getElementById("acctFrom");
    var b = document.getElementById("acctTo");
    var r = document.getElementById("acctRoster");
    if (a) a.value = from || "";
    if (b) b.value = to || "";
    if (r && roster !== undefined) r.value = roster;
    if (typeof window.renderAccountant === "function") window.renderAccountant();
  }

  function agg(list) {
    var o = { n: 0, calc: 0, col: 0, cash: 0, card: 0, over: 0, short: 0, paid: 0, due: 0, bar: 0, wine: 0, barN: 0, wineN: 0 };
    list.forEach(function (s, i) {
      var d = diffOf(s), c = calcOf(s), col = collectedOf(s), p = payOf(i);
      var paidAmt = p.paid ? num(p.amount) : 0;
      var due = d < 0 ? Math.max(0, Math.abs(d) - paidAmt) : 0;
      o.n++; o.calc += c; o.col += col; o.cash += cashIn(s); o.card += cardIn(s);
      if (d < 0) o.short += d; else o.over += d;
      o.paid += paidAmt; o.due += due;
      if (kindOf(s) === "wine") { o.wine += c; o.wineN++; } else { o.bar += c; o.barN++; }
    });
    o.net = o.over + o.short;
    return o;
  }

  function group(list, keyFn) {
    var map = {}, order = [];
    list.forEach(function (s, i) {
      var k = keyFn(s, i) || "—";
      if (!map[k]) { map[k] = { key: k, rows: [] }; order.push(k); }
      map[k].rows.push({ s: s, i: i });
    });
    return order.map(function (k) { return map[k]; });
  }

  function aggIndexed(pairs) {
    var fake = pairs.map(function (p) { return p.s; });
    var o = { n: 0, calc: 0, col: 0, cash: 0, card: 0, over: 0, short: 0, paid: 0, due: 0 };
    pairs.forEach(function (p) {
      var s = p.s, d = diffOf(s), c = calcOf(s), col = collectedOf(s), pay = payOf(p.i);
      var paidAmt = pay.paid ? num(pay.amount) : 0;
      o.n++; o.calc += c; o.col += col; o.cash += cashIn(s); o.card += cardIn(s);
      if (d < 0) o.short += d; else o.over += d;
      o.paid += paidAmt;
      if (d < 0) o.due += Math.max(0, Math.abs(d) - paidAmt);
    });
    o.net = o.over + o.short;
    return o;
  }

  function cards(o) {
    return '<div class="summary-box">'
      + item("Илгээлт", o.n)
      + item("Бодолт", money(o.calc))
      + item("Цуглуулсан", money(o.col))
      + item("Бэлэн", money(o.cash))
      + item("Карт", money(o.card))
      + item("Пиво", money(o.bar) + " · " + (o.barN || 0))
      + item("Вино", money(o.wine) + " · " + (o.wineN || 0))
      + item("Илүү", '<span class="diff-over">' + signed(o.over) + "</span>")
      + item("Дутуу", '<span class="diff-short">' + signed(o.short) + "</span>")
      + item("Цэвэр", '<span class="' + diffCls(o.net) + '">' + signed(o.net) + "</span>")
      + item("Төлсөн", money(o.paid))
      + item("Үлдэгдэл", '<span class="' + (o.due > 0.5 ? "diff-short" : "diff-ok") + '">' + money(o.due) + "</span>")
      + "</div>";
  }
  function item(label, value) {
    return '<div class="summary-item"><div class="label">' + label + '</div><div class="value">' + value + "</div></div>";
  }

  function table(heads, body) {
    return '<div class="table-wrap"><table><thead><tr>' + heads.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function viewSum(list) {
    var o = agg(list);
    return cards(o)
      + '<p style="color:#5b6570;font-size:.85rem;margin:8px 0">Бэлэн = бэлэн дүн − эхлэл дүн (0-оос доош буухгүй). Үлдэгдэл = дутуу дүнгээс төлөлтөөр хаагдаагүй хэсэг. Пиво/вино нь бодолтын дүн.</p>';
  }

  function viewGrouped(list, keyFn, title) {
    var groups = group(list, keyFn).map(function (g) {
      var o = aggIndexed(g.rows);
      return { key: g.key, o: o };
    }).sort(function (a, b) { return String(b.key).localeCompare(String(a.key)); });
    if (title === "loc" || title === "shift" || title === "tek") {
      groups.sort(function (a, b) { return b.o.calc - a.o.calc; });
    }
    var body = groups.map(function (g) {
      return "<tr><td style=\"text-align:left\">" + esc(g.key) + "</td><td>" + g.o.n + "</td><td>" + money(g.o.calc) + "</td><td>" + money(g.o.col) + "</td><td>" + money(g.o.cash) + "</td><td>" + money(g.o.card) + "</td><td class=\"diff-over\">" + signed(g.o.over) + "</td><td class=\"diff-short\">" + signed(g.o.short) + "</td><td class=\"" + diffCls(g.o.net) + "\"><strong>" + signed(g.o.net) + "</strong></td><td>" + money(g.o.due) + "</td></tr>";
    }).join("") || '<tr><td colspan="10">Мөр алга</td></tr>';
    var tot = agg(list);
    body += '<tr style="font-weight:700;background:#e8f0fe"><td>НИЙТ</td><td>' + tot.n + "</td><td>" + money(tot.calc) + "</td><td>" + money(tot.col) + "</td><td>" + money(tot.cash) + "</td><td>" + money(tot.card) + "</td><td>" + signed(tot.over) + "</td><td>" + signed(tot.short) + "</td><td>" + signed(tot.net) + "</td><td>" + money(tot.due) + "</td></tr>";
    return table(["Нэр", "Илгээлт", "Бодолт", "Цуглуулсан", "Бэлэн", "Карт", "Илүү", "Дутуу", "Цэвэр", "Үлдэгдэл"], body);
  }

  function viewItems(list) {
    var map = {};
    list.forEach(function (s) {
      (s.items || []).forEach(function (it) {
        if (!it) return;
        var sold = num(it.sold), inc = num(it.income);
        if (!sold && !inc) return;
        var name = String(it.name || it.id || "Бараа");
        var kind = kindOf(s) === "wine" ? "Вино" : "Пиво";
        var k = kind + "|" + name;
        if (!map[k]) map[k] = { name: name, kind: kind, qty: 0, income: 0, price: num(it.price) };
        map[k].qty += sold;
        map[k].income += inc;
        if (it.price) map[k].price = num(it.price);
      });
    });
    var arr = Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.income - a.income || b.qty - a.qty; });
    var max = arr.length ? arr[0].income : 1;
    var body = arr.map(function (it) {
      var w = max ? Math.max(2, Math.round(it.income / max * 100)) : 0;
      return "<tr><td style=\"text-align:left\">" + esc(it.name) + "</td><td>" + esc(it.kind) + "</td><td>" + money(it.price) + "</td><td>" + it.qty.toLocaleString() + "</td><td>" + money(it.income) + "</td><td style=\"min-width:90px\"><div style=\"background:#e5e7eb;border-radius:4px;height:8px\"><div style=\"width:" + w + "%;background:#0f3460;height:8px;border-radius:4px\"></div></div></td></tr>";
    }).join("") || '<tr><td colspan="6">Зарсан бараа алга</td></tr>';
    var qty = arr.reduce(function (a, it) { return a + it.qty; }, 0);
    var inc = arr.reduce(function (a, it) { return a + it.income; }, 0);
    body += '<tr style="font-weight:700;background:#e8f0fe"><td colspan="3">НИЙТ · ' + arr.length + " нэр</td><td>" + qty.toLocaleString() + "</td><td>" + money(inc) + "</td><td></td></tr>";
    return table(["Бараа", "Төрөл", "Үнэ", "Тоо", "Орлого", ""], body);
  }

  function viewSettle(list) {
    var emp = {};
    list.forEach(function (s, i) {
      var id = s.employeeId || "?";
      var e = emp[id] || (emp[id] = { name: s.employeeName || id, id: id, n: 0, short: 0, over: 0, paid: 0, due: 0, calc: 0 });
      var d = diffOf(s), p = payOf(i), paidAmt = p.paid ? num(p.amount) : 0;
      e.n++; e.calc += calcOf(s);
      if (d < 0) { e.short += d; e.due += Math.max(0, Math.abs(d) - paidAmt); }
      else e.over += d;
      e.paid += paidAmt;
    });
    var arr = Object.keys(emp).map(function (k) { return emp[k]; }).sort(function (a, b) { return b.due - a.due || String(a.name).localeCompare(String(b.name)); });
    var body = arr.map(function (e) {
      return '<tr><td style="text-align:left">' + esc(e.name) + (e.id && e.id !== "?" ? ' <small style="color:#888">(' + esc(e.id) + ")</small>" : "") + "</td><td>" + e.n + "</td><td>" + money(e.calc) + "</td><td class=\"diff-short\">" + signed(e.short) + "</td><td class=\"diff-over\">" + signed(e.over) + "</td><td>" + money(e.paid) + "</td><td class=\"" + (e.due > 0.5 ? "diff-short" : "diff-ok") + "\"><strong>" + money(e.due) + "</strong></td></tr>";
    }).join("") || '<tr><td colspan="7">—</td></tr>';
    var due = arr.reduce(function (a, e) { return a + e.due; }, 0);
    var paid = arr.reduce(function (a, e) { return a + e.paid; }, 0);
    var short = arr.reduce(function (a, e) { return a + e.short; }, 0);
    body += '<tr style="font-weight:700;background:#e8f0fe"><td>НИЙТ</td><td>' + list.length + "</td><td>" + money(arr.reduce(function (a, e) { return a + e.calc; }, 0)) + "</td><td>" + signed(short) + "</td><td>" + signed(arr.reduce(function (a, e) { return a + e.over; }, 0)) + "</td><td>" + money(paid) + "</td><td>" + money(due) + "</td></tr>";
    return '<p style="color:#5b6570;font-size:.85rem;margin:0 0 8px">Үлдэгдэл нь тухайн шүүлтэнд багтсан дутуу илгээлтээс төлөлт хасагдсан дүн. Төлөлтийг Илгээлт таб дээр хадгална.</p>' + table(["Ажилтан", "Илгээлт", "Бодолт", "Дутуу", "Илүү", "Төлсөн", "Үлдэгдэл"], body);
  }

  function renderReport() {
    var box = document.getElementById("acctReportBody");
    var scope = document.getElementById("acctReportScope");
    if (!box) return;
    if (scope) scope.textContent = scopeLabel();
    var list = rows();
    var html = "";
    if (_view === "day") html = viewGrouped(list, function (s) { return s.date || "—"; }, "day");
    else if (_view === "loc") html = viewGrouped(list, function (s) { return s.location || "—"; }, "loc");
    else if (_view === "shift") html = viewGrouped(list, function (s) { return s.shift || "—"; }, "shift");
    else if (_view === "tek") html = viewGrouped(list, function (s) { return tekOf(s) || "—"; }, "tek");
    else if (_view === "item") html = viewItems(list);
    else if (_view === "settle") html = viewSettle(list);
    else html = viewSum(list);
    box.innerHTML = html;
    var bar = document.getElementById("acctReportViews");
    if (bar) Array.prototype.forEach.call(bar.querySelectorAll("button[data-rv]"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-rv") === _view);
    });
  }
  window.renderAcctReport = renderReport;

  function exportXls() {
    var area = document.getElementById("acctPrintArea");
    if (!area) return;
    var html = "<html><head><meta charset=\"utf-8\"><title>Нягтлан тайлан</title></head><body>"
      + "<h2>Нягтлангийн тайлан</h2><p>" + esc(scopeLabel()) + "</p>" + area.innerHTML + "</body></html>";
    var blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "nyagtlan_tailan_" + (today() || "report") + ".xls";
    a.click();
  }

  function ensureReport() {
    var tabs = document.getElementById("acctTabs");
    var root = document.getElementById("accountantView");
    if (!tabs || !root || document.getElementById("acctPaneReport")) return;
    if (!tabs.querySelector('button[data-acct-tab="report"]')) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tab-btn";
      btn.setAttribute("data-acct-tab", "report");
      btn.textContent = "Тайлан";
      tabs.appendChild(btn);
    }
    var pane = document.createElement("div");
    pane.id = "acctPaneReport";
    pane.className = "hidden";
    pane.innerHTML = ''
      + '<div class="no-print" style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0">'
      + '<button type="button" class="btn btn-sm" id="arToday">Өнөөдөр</button>'
      + '<button type="button" class="btn btn-outline btn-sm" id="arWeek">7 хоног</button>'
      + '<button type="button" class="btn btn-outline btn-sm" id="arMonth">Энэ сар</button>'
      + '<button type="button" class="btn btn-outline btn-sm" id="arAll">Бүх хугацаа</button>'
      + '<button type="button" class="btn btn-outline btn-sm" id="arPrint">Хэвлэх</button>'
      + '<button type="button" class="btn btn-outline btn-sm" id="arXls">Excel</button>'
      + "</div>"
      + '<p class="no-print" style="margin:0 0 8px;color:#5b6570;font-size:.85rem">Хамрах хүрээ Илгээлт табын шүүлттэй адил. Ростер сонгосон бол ростерын өдөр + гишүүд.</p>'
      + '<div id="acctPrintArea">'
      + '<h3 style="margin:6px 0">Тайлан <small id="acctReportScope" style="font-weight:400;color:#666"></small></h3>'
      + '<div class="tabs no-print" id="acctReportViews" style="margin-bottom:8px">'
      + '<button type="button" class="tab-btn active" data-rv="sum">Хураангуй</button>'
      + '<button type="button" class="tab-btn" data-rv="day">Өдрөөр</button>'
      + '<button type="button" class="tab-btn" data-rv="loc">Байршил</button>'
      + '<button type="button" class="tab-btn" data-rv="shift">Ээлж</button>'
      + '<button type="button" class="tab-btn" data-rv="tek">Тек</button>'
      + '<button type="button" class="tab-btn" data-rv="item">Бараа</button>'
      + '<button type="button" class="tab-btn" data-rv="settle">Тооцоо</button>'
      + "</div>"
      + '<div id="acctReportBody"></div>'
      + "</div>";
    root.appendChild(pane);
    if (!document.getElementById("acctReportPrintCss")) {
      var st = document.createElement("style");
      st.id = "acctReportPrintCss";
      st.textContent = "@media print{body *{visibility:hidden}#acctPrintArea,#acctPrintArea *{visibility:visible}#acctPrintArea{position:absolute;left:0;top:0;width:100%;background:#fff;color:#111}}";
      document.head.appendChild(st);
    }
    document.getElementById("acctReportViews").onclick = function (ev) {
      var b = ev.target.closest("button[data-rv]");
      if (!b) return;
      _view = b.getAttribute("data-rv");
      renderReport();
    };
    document.getElementById("arToday").onclick = function () { var t = today(); setRange(t, t, ""); };
    document.getElementById("arWeek").onclick = function () { var t = today(); setRange(addDays(t, -6), t, ""); };
    document.getElementById("arMonth").onclick = function () {
      var t = today();
      setRange(t.slice(0, 8) + "01", t, "");
    };
    document.getElementById("arAll").onclick = function () { setRange("", "", ""); };
    document.getElementById("arPrint").onclick = function () { window.print(); };
    document.getElementById("arXls").onclick = exportXls;
  }

  function decorateRosters() {
    var list = document.getElementById("rosterList");
    if (!list || !window._rosters) return;
    var rosters = Object.keys(window._rosters).map(function (k) {
      var r = window._rosters[k] || {}; r.id = k; return r;
    }).filter(function (r) { return r.start && r.end; }).sort(function (a, b) { return String(b.start).localeCompare(String(a.start)); });
    list.innerHTML = rosters.map(function (r) {
      var n = Object.keys(r.members || {}).length;
      return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0">'
        + "<span>" + esc(r.name) + " · " + esc(r.start) + " — " + esc(r.end) + " · " + n + " хүн</span>"
        + '<button type="button" class="btn btn-outline btn-sm" data-redit="' + esc(r.id) + '">Засах</button>'
        + '<button type="button" class="btn btn-outline btn-sm" data-rdel="' + esc(r.id) + '">Устгах</button></div>';
    }).join("") || "<div>Ростер алга</div>";
    if (!list._ar) {
      list._ar = true;
      list.addEventListener("click", function (ev) {
        var ed = ev.target.closest("[data-redit]");
        var del = ev.target.closest("[data-rdel]");
        if (ed) editRoster(ed.getAttribute("data-redit"));
        if (del) deleteRoster(del.getAttribute("data-rdel"));
      });
    }
  }

  function editRoster(id) {
    var r = (window._rosters || {})[id];
    if (!r) return;
    var name = document.getElementById("rosterName");
    var start = document.getElementById("rosterStart");
    var end = document.getElementById("rosterEnd");
    if (name) name.value = r.name || "";
    if (start) start.value = r.start || "";
    if (end) end.value = r.end || "";
    document.querySelectorAll(".roster-member").forEach(function (el) {
      el.checked = !!(r.members && r.members[el.value]);
    });
    if (typeof window.showAcctTab === "function") window.showAcctTab("roster");
    if (typeof showAlert === "function") showAlert("acctAlert", "Ростер маягт руу ачааллаа. Хадгалахад энэ эхлэх өдрөөр дарж бичнэ.", "success");
  }

  async function deleteRoster(id) {
    var r = (window._rosters || {})[id];
    if (!r) return;
    if (!window.confirm("Ростер устгах уу?\n" + (r.name || id))) return;
    var base = db();
    try { if (typeof ensureFirebaseAuth === "function") await ensureFirebaseAuth(); } catch (e) {}
    base = db();
    if (!base) { if (typeof showAlert === "function") showAlert("acctAlert", "Сервер алга", "error"); return; }
    try {
      await base.ref("borluulalt/rosters/" + id).remove();
      delete window._rosters[id];
      var sel = document.getElementById("acctRoster");
      if (sel && sel.value === id) sel.value = "";
      if (typeof showAlert === "function") showAlert("acctAlert", "Ростер устгалаа", "success");
      if (typeof window.renderAccountant === "function") window.renderAccountant();
    } catch (e) {
      if (typeof showAlert === "function") showAlert("acctAlert", "Устгасангүй", "error");
    }
  }

  function hook() {
    if (typeof window.showAcctTab === "function" && !window.showAcctTab._ar) {
      var orig = window.showAcctTab;
      var fn = function (name) {
        ensureReport();
        if (name === "report") {
          ["acctPaneSubs", "acctPaneUsers", "acctPaneRoster"].forEach(function (id) {
            var p = document.getElementById(id); if (p) p.classList.add("hidden");
          });
          var rp = document.getElementById("acctPaneReport");
          if (rp) rp.classList.remove("hidden");
          var bar = document.getElementById("acctTabs");
          if (bar) Array.prototype.forEach.call(bar.querySelectorAll("button[data-acct-tab]"), function (b) {
            b.classList.toggle("active", b.getAttribute("data-acct-tab") === "report");
          });
          window._acctTab = "report";
          renderReport();
          return;
        }
        var rp2 = document.getElementById("acctPaneReport");
        if (rp2) rp2.classList.add("hidden");
        return orig.apply(this, arguments);
      };
      fn._ar = true;
      window.showAcctTab = fn;
    }
    if (typeof window.renderAccountant === "function" && !window.renderAccountant._ar) {
      var ra = window.renderAccountant;
      var wrap = async function () {
        var out = await ra.apply(this, arguments);
        try { decorateRosters(); } catch (e) {}
        if (window._acctTab === "report") { try { renderReport(); } catch (e2) {} }
        return out;
      };
      wrap._ar = true;
      window.renderAccountant = wrap;
    }
    ensureReport();
  }

  hook();
  setInterval(hook, 800);
})();
