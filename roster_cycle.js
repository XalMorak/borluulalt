/* roster_cycle.js — 4 ростер, 7 хоногоор зөрүүлсэн 14/14 мөчлөг.
   A эхлэх өдрөөс: A +0, B +7, C +14, D +21. Тус бүр 14 ажил, 14 амралт.
   Заримдаа ажилтан 7 хоног өмнө эсвэл хойш сунана — тухайн ээлж дээр тэмдэглэнэ.
   Хадгалалт: borluulalt/rosters/_cycle (start/end байхгүй тул гарын ростерт орохгүй). */
(function () {
  if (window._rosterCycle) return;
  window._rosterCycle = true;

  var PERIOD = 28, WORK = 14, STAGGER = 7, EXT = 7;
  var COLORS = { A: "#1d4ed8", B: "#047857", C: "#b45309", D: "#6d28d9" };
  var DEFAULT_TEAMS = [
    { id: "A", name: "A", offset: 0 },
    { id: "B", name: "B", offset: 7 },
    { id: "C", name: "C", offset: 14 },
    { id: "D", name: "D", offset: 21 }
  ];
  var cfg = null;

  function U() { return window._acctUtil || {}; }
  function esc(v) { var f = U().esc; return f ? f(v) : String(v == null ? "" : v); }
  function ymd(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function parse(iso) {
    var p = String(iso || "").split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function addDays(iso, n) {
    var d = parse(iso);
    d.setDate(d.getDate() + n);
    return ymd(d);
  }
  function daysBetween(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
  function today() { var f = U().today; return f ? f() : ymd(new Date()); }
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

  function blank() {
    return {
      anchor: "2026-10-01",
      teams: DEFAULT_TEAMS.map(function (t) { return { id: t.id, name: t.name, offset: t.offset, members: {} }; }),
      stretches: [],
      overrides: {}
    };
  }
  function normalize(raw) {
    var b = blank();
    if (!raw || typeof raw !== "object") return b;
    if (raw.anchor) b.anchor = String(raw.anchor).slice(0, 10);
    var byId = {};
    (raw.teams || []).forEach(function (t) { if (t && t.id) byId[t.id] = t; });
    b.teams = DEFAULT_TEAMS.map(function (t) {
      var s = byId[t.id] || {};
      return { id: t.id, name: t.name, offset: t.offset, members: s.members || {} };
    });
    b.stretches = (raw.stretches || []).filter(function (s) { return s && s.employeeId && s.teamId && s.blockStart; });
    b.overrides = raw.overrides && typeof raw.overrides === "object" ? raw.overrides : {};
    return b;
  }

  function users() { return (typeof getUsers === "function") ? getUsers() : {}; }
  function uname(id) { var u = users()[id] || {}; return u.name || id; }
  function employees() {
    var out = [];
    var all = users();
    Object.keys(all).forEach(function (id) {
      var u = all[id] || {};
      if (u.role === "accountant" || u.role === "supervisor") return;
      out.push({ id: id, name: u.name || id });
    });
    out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    return out;
  }
  function teamById(id) {
    var teams = (cfg && cfg.teams) || [];
    for (var i = 0; i < teams.length; i++) if (teams[i].id === id) return teams[i];
    return null;
  }
  function blockStart(team, index) { return addDays(addDays(cfg.anchor, team.offset), index * PERIOD); }
  function stretchOf(empId, teamId, start) {
    var list = (cfg && cfg.stretches) || [];
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (s.employeeId === empId && s.teamId === teamId && s.blockStart === start) return s;
    }
    return null;
  }
  function windowOf(empId, team, start) {
    var st = stretchOf(empId, team.id, start);
    var early = st && st.early ? EXT : 0;
    var late = st && st.late ? EXT : 0;
    return { start: start, end: addDays(start, WORK - 1), from: addDays(start, -early), to: addDays(addDays(start, WORK - 1), late), early: early, late: late };
  }
  function membersFor(team, start) {
    var key = team.id + "|" + start;
    var ov = cfg && cfg.overrides && cfg.overrides[key];
    if (ov && typeof ov === "object") return ov;
    return team.members || {};
  }
  function onBlock(empId, team, start, date) {
    var members = membersFor(team, start);
    if (!members[empId]) return false;
    var w = windowOf(empId, team, start);
    return date >= w.from && date <= w.to;
  }

  window._cycleMatch = function (s, rosterId) {
    if (!cfg || !s) return false;
    var parts = String(rosterId || "").split("_");
    if (parts[0] !== "cyc" || parts.length < 3) return false;
    var team = teamById(parts[1]);
    var start = parts[2].slice(0, 4) + "-" + parts[2].slice(4, 6) + "-" + parts[2].slice(6, 8);
    if (!team) return false;
    return onBlock(s.employeeId, team, start, s.date || "");
  };

  window._cycleRosterOptions = function () {
    if (!cfg || !cfg.anchor) return [];
    var t0 = today();
    var out = [];
    cfg.teams.forEach(function (team) {
      var first = addDays(cfg.anchor, team.offset);
      var diff = daysBetween(first, t0);
      var idx = Math.floor(diff / PERIOD);
      for (var i = idx - 2; i <= idx + 4; i++) {
        if (i < 0) continue;
        var start = blockStart(team, i);
        var end = addDays(start, WORK - 1);
        var mem = membersFor(team, start);
        var n = Object.keys(mem).length;
        out.push({ id: "cyc_" + team.id + "_" + start.replace(/-/g, ""), name: team.name + (n ? "" : " · гишүүн алга"), start: start, end: end, members: mem, _cycle: true });
      }
    });
    out.sort(function (a, b) { return a.start.localeCompare(b.start) || a.name.localeCompare(b.name); });
    return out;
  };

  function activeOn(date) {
    var hits = [];
    if (!cfg) return hits;
    cfg.teams.forEach(function (team) {
      var first = addDays(cfg.anchor, team.offset);
      var diff = daysBetween(first, date);
      var idx = Math.floor(diff / PERIOD);
      [idx - 1, idx, idx + 1].forEach(function (i) {
        if (i < 0) return;
        var start = blockStart(team, i);
        Object.keys(membersFor(team, start)).forEach(function (empId) {
          if (!onBlock(empId, team, start, date)) return;
          var w = windowOf(empId, team, start);
          var stretched = date < w.start || date > w.end;
          hits.push({ team: team, empId: empId, start: start, stretched: stretched, early: date < w.start, late: date > w.end });
        });
      });
    });
    return hits;
  }

  function paint() {
    var box = document.getElementById("cycleBoard");
    if (!box || !cfg) return;
    var t0 = today();
    var from = addDays(t0, -3);
    var days = [];
    for (var i = 0; i < 42; i++) days.push(addDays(from, i));
    var head = "<tr><th>Ростер</th>" + days.map(function (d) {
      var n = Number(d.slice(8));
      var mark = d === t0 ? "background:#fde68a;" : "";
      return '<th style="font-size:.65rem;padding:2px;' + mark + '" title="' + d + '">' + n + "</th>";
    }).join("") + "</tr>";
    var body = cfg.teams.map(function (team) {
      var cells = days.map(function (d) {
        var on = false, stretch = false;
        [0].forEach(function () {
          var first = addDays(cfg.anchor, team.offset);
          var idx = Math.floor(daysBetween(first, d) / PERIOD);
          [idx - 1, idx, idx + 1].forEach(function (k) {
            if (k < 0) return;
            var start = blockStart(team, k);
            Object.keys(membersFor(team, start)).forEach(function (empId) {
              if (!onBlock(empId, team, start, d)) return;
              on = true;
              var w = windowOf(empId, team, start);
              if (d < w.start || d > w.end) stretch = true;
            });
          });
        });
        var base = false;
        var first = addDays(cfg.anchor, team.offset);
        var diff = daysBetween(first, d);
        if (diff >= 0 && diff % PERIOD < WORK) base = true;
        var bg = base ? COLORS[team.id] : (stretch ? COLORS[team.id] : "#f3f4f6");
        var op = stretch && !base ? "opacity:.45;" : "";
        return '<td title="' + d + '" style="height:16px;padding:0;background:' + bg + ";" + op + (d === t0 ? "outline:1px solid #111;" : "") + '"></td>';
      }).join("");
      var n = Object.keys(team.members || {}).length;
      return "<tr><td style=\"text-align:left;white-space:nowrap\">" + esc(team.name) + " · " + n + "</td>" + cells + "</tr>";
    }).join("");
    var who = activeOn(t0);
    var byTeam = {};
    who.forEach(function (h) {
      var k = h.team.id;
      if (!byTeam[k]) byTeam[k] = { team: h.team, names: [] };
      var tag = uname(h.empId) + (h.stretched ? (h.early ? " (7 өмнө)" : " (7 хойш)") : "");
      if (byTeam[k].names.indexOf(tag) < 0) byTeam[k].names.push(tag);
    });
    var todayHtml = Object.keys(byTeam).map(function (k) {
      return "<div><strong style=\"color:" + COLORS[k] + "\">" + esc(byTeam[k].team.name) + "</strong> — " + esc(byTeam[k].names.join(", ")) + "</div>";
    }).join("") || "<div>Өнөөдөр хуваарьт хүн алга. Гишүүдээ сонгоод хадгал.</div>";
    box.innerHTML = '<div style="margin-bottom:8px"><strong>Өнөөдөр (' + t0 + ")</strong>" + todayHtml + "</div>"
      + '<div class="table-wrap"><table style="min-width:720px">' + head + body + "</table></div>"
      + '<p style="font-size:.75rem;color:#5b6570;margin:6px 0 0">Бүдэг өнгө = 7 хоногийн сунгалт. Шар толгой = өнөөдөр. Хоёр ростер зэрэгцэж 7 хоног давхцана.</p>';
  }

  function drawMembers() {
    var host = document.getElementById("cycleTeams");
    if (!host || !cfg) return;
    host.innerHTML = cfg.teams.map(function (team) {
      var boxes = employees().map(function (e) {
        var on = !!(team.members && team.members[e.id]);
        return '<label style="display:block;font-size:.85rem"><input type="checkbox" class="cyc-mem" data-team="' + team.id + '" value="' + esc(e.id) + '"' + (on ? " checked" : "") + "> " + esc(e.name) + "</label>";
      }).join("") || "<span>Ажилтан алга</span>";
      return '<div style="border:1px solid #e5e7eb;border-top:4px solid ' + COLORS[team.id] + ';border-radius:8px;padding:8px;min-width:140px;flex:1"><strong>' + esc(team.name) + "</strong><div style=\"font-size:.75rem;color:#5b6570\">+" + team.offset + " хоног · 14 ажил / 14 амралт</div>" + boxes + "</div>";
    }).join("");
    host.querySelectorAll(".cyc-mem").forEach(function (el) {
      el.onchange = function () {
        if (!el.checked) return;
        host.querySelectorAll('.cyc-mem[value="' + el.value + '"]').forEach(function (other) {
          if (other !== el) other.checked = false;
        });
      };
    });
  }

  function drawStretches() {
    var list = document.getElementById("cycleStretchList");
    var selE = document.getElementById("cycleStretchEmp");
    var selB = document.getElementById("cycleStretchBlock");
    if (!list || !cfg) return;
    var emps = [];
    cfg.teams.forEach(function (team) {
      Object.keys(team.members || {}).forEach(function (id) { emps.push({ id: id, team: team }); });
    });
    if (selE) {
      var cur = selE.value;
      selE.innerHTML = emps.map(function (e) {
        return '<option value="' + esc(e.id) + '" data-team="' + e.team.id + '">' + esc(uname(e.id)) + " · " + esc(e.team.name) + "</option>";
      }).join("") || '<option value="">Эхлээд гишүүн сонго</option>';
      if (cur) selE.value = cur;
    }
    fillBlocks();
    list.innerHTML = (cfg.stretches || []).map(function (s, i) {
      var bits = [];
      if (s.early) bits.push("7 хоног өмнө");
      if (s.late) bits.push("7 хоног хойш");
      return '<div style="display:flex;gap:8px;align-items:center;margin:4px 0"><span>' + esc(uname(s.employeeId)) + " · " + esc((teamById(s.teamId) || {}).name || s.teamId) + " · " + esc(s.blockStart) + " — " + esc(addDays(s.blockStart, WORK - 1)) + " · " + esc(bits.join(", ") || "сунгалтгүй") + '</span><button type="button" class="btn btn-outline btn-sm" data-sdel="' + i + '">Устгах</button></div>';
    }).join("") || "<div>Сунгалт алга</div>";
  }

  function fillBlocks() {
    var selE = document.getElementById("cycleStretchEmp");
    var selB = document.getElementById("cycleStretchBlock");
    if (!selE || !selB || !cfg) return;
    var opt = selE.options[selE.selectedIndex];
    var team = opt ? teamById(opt.getAttribute("data-team")) : null;
    if (!team) { selB.innerHTML = ""; return; }
    var first = addDays(cfg.anchor, team.offset);
    var idx = Math.floor(daysBetween(first, today()) / PERIOD);
    var html = "";
    for (var i = Math.max(0, idx - 1); i <= idx + 4; i++) {
      var start = blockStart(team, i);
      html += '<option value="' + start + '">' + start + " — " + addDays(start, WORK - 1) + "</option>";
    }
    selB.innerHTML = html;
  }

  function readMembers() {
    cfg.teams.forEach(function (team) { team.members = {}; });
    document.querySelectorAll(".cyc-mem:checked").forEach(function (el) {
      var team = teamById(el.getAttribute("data-team"));
      if (team) team.members[el.value] = true;
    });
  }

  async function loadCfg() {
    var base = db();
    try { if (typeof ensureFirebaseAuth === "function") await ensureFirebaseAuth(); } catch (e) {}
    base = db();
    if (!base) { cfg = cfg || blank(); return cfg; }
    try {
      var raw = (await base.ref("borluulalt/rosters/_cycle").once("value")).val();
      cfg = normalize(raw);
    } catch (e) { cfg = cfg || blank(); }
    return cfg;
  }

  async function saveCfg() {
    readMembers();
    var anchor = (document.getElementById("cycleAnchor") || {}).value;
    if (anchor) cfg.anchor = anchor;
    cfg.updatedAt = new Date().toISOString();
    cfg.by = me().id || "";
    var base = db();
    try { if (typeof ensureFirebaseAuth === "function") await ensureFirebaseAuth(); } catch (e) {}
    base = db();
    if (!base) { if (typeof showAlert === "function") showAlert("acctAlert", "Сервер алга", "error"); return; }
    try {
      await base.ref("borluulalt/rosters/_cycle").set(cfg);
      if (typeof showAlert === "function") showAlert("acctAlert", "Мөчлөг хадгаллаа. Илгээлт/Тайлангийн ростер шүүлтэд гарсан.", "success");
      paint();
      drawStretches();
      drawSaved();
      if (typeof window.renderAccountant === "function") window.renderAccountant();
    } catch (e2) {
      if (typeof showAlert === "function") showAlert("acctAlert", "Мөчлөг хадгалагдсангүй", "error");
    }
  }

  function addStretch() {
    readMembers();
    var emp = (document.getElementById("cycleStretchEmp") || {}).value;
    var opt = document.getElementById("cycleStretchEmp");
    var teamId = opt && opt.options[opt.selectedIndex] ? opt.options[opt.selectedIndex].getAttribute("data-team") : "";
    var start = (document.getElementById("cycleStretchBlock") || {}).value;
    var early = document.getElementById("cycleEarly") && document.getElementById("cycleEarly").checked;
    var late = document.getElementById("cycleLate") && document.getElementById("cycleLate").checked;
    if (!emp || !teamId || !start) return;
    if (!early && !late) { if (typeof showAlert === "function") showAlert("acctAlert", "Өмнө эсвэл хойш сунгалтаа сонго", "error"); return; }
    cfg.stretches = (cfg.stretches || []).filter(function (s) { return !(s.employeeId === emp && s.teamId === teamId && s.blockStart === start); });
    cfg.stretches.push({ employeeId: emp, teamId: teamId, blockStart: start, early: !!early, late: !!late });
    saveCfg();
  }


  var _editKey = "";
  function drawSaved() {
    var box = document.getElementById("cycleSaved");
    if (!box || !cfg) return;
    var rows = window._cycleRosterOptions().filter(function (r) { return r.end >= addDays(today(), -14); }).slice(0, 12);
    box.innerHTML = rows.map(function (r) {
      var teamId = r.id.split("_")[1];
      var key = teamId + "|" + r.start;
      var names = Object.keys(r.members || {}).map(uname).sort().join(", ") || "гишүүн алга";
      var edited = cfg.overrides && cfg.overrides[key];
      return '<div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;margin:6px 0;padding:6px 0;border-bottom:1px solid #eee">'
        + '<strong style="color:' + (COLORS[teamId] || "#111") + '">' + esc(r.name.split(" · ")[0]) + '</strong>'
        + '<span>' + esc(r.start) + ' — ' + esc(r.end) + (edited ? ' · <em>зассан</em>' : '') + '</span>'
        + '<span style="flex:1;color:#444">' + esc(names) + '</span>'
        + '<button type="button" class="btn btn-outline btn-sm" data-cedit="' + esc(r.id) + '">Засах</button></div>';
    }).join("") || "<div>Хадгалсан ростер алга. A B C D-г сонгоод хадгал.</div>";
  }
  function openEdit(rosterId) {
    var parts = String(rosterId || "").split("_");
    var team = teamById(parts[1]);
    var start = parts[2] ? parts[2].slice(0, 4) + "-" + parts[2].slice(4, 6) + "-" + parts[2].slice(6, 8) : "";
    if (!team || !start) return;
    _editKey = team.id + "|" + start;
    var mem = membersFor(team, start);
    var box = document.getElementById("cycleEdit");
    var title = document.getElementById("cycleEditTitle");
    var host = document.getElementById("cycleEditMembers");
    if (title) title.textContent = team.name + " засах — " + start + " — " + addDays(start, WORK - 1);
    if (host) host.innerHTML = employees().map(function (e) {
      return '<label style="border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px"><input type="checkbox" class="cyc-edit" value="' + esc(e.id) + '"' + (mem[e.id] ? " checked" : "") + "> " + esc(e.name) + "</label>";
    }).join("") || "Ажилтан алга";
    if (box) { box.classList.remove("hidden"); box.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }
  function saveEdit() {
    if (!_editKey || !cfg) return;
    var members = {};
    document.querySelectorAll(".cyc-edit:checked").forEach(function (el) { members[el.value] = true; });
    cfg.overrides = cfg.overrides || {};
    cfg.overrides[_editKey] = members;
    saveCfg();
  }
  function clearEdit() {
    if (!_editKey || !cfg || !cfg.overrides) return;
    delete cfg.overrides[_editKey];
    saveCfg();
  }

  function ensureUi() {
    var pane = document.getElementById("acctPaneRoster");
    if (!pane || document.getElementById("cycleCard")) return;
    var card = document.createElement("div");
    card.id = "cycleCard";
    card.className = "card";
    card.style.cssText = "padding:14px;margin-bottom:12px;box-shadow:none;border:1px solid #e5e7eb";
    card.innerHTML = ''
      + '<h3 style="margin:0 0 6px">Автомат мөчлөг — A B C D</h3>'
      + '<p style="margin:0 0 8px;color:#5b6570;font-size:.85rem">Жишээний загвар: A-ийн эхлэх өдрөөс 7 хоног тутамд дараагийн ростер орно. Тус бүр 14 хоног ажиллаад 14 хоног амрана. Нэг өдөр хоёр ростер давхцана. Ажилтан заримдаа тухайн ээлжээ 7 хоног өмнө эсвэл хойш сунгана.</p>'
      + '<div class="header-info">'
      + '<div><label>A эхлэх</label><input type="date" id="cycleAnchor"></div>'
      + '<div style="display:flex;align-items:flex-end"><button type="button" class="btn btn-success btn-sm" id="cycleSave">Мөчлөг хадгалах</button></div>'
      + "</div>"
      + '<div id="cycleTeams" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div>'
      + '<div style="margin-top:10px"><button type="button" class="btn btn-success" id="cycleSave2">A B C D хадгалах</button></div>'
      + '<h4 style="margin:16px 0 6px">Хадгалсан ростер</h4>'
      + '<p style="margin:0 0 8px;color:#5b6570;font-size:.85rem">Засах нь зөвхөн тухайн 14 хоногийн бүрэлдэхүүнийг өөрчилнө. Бүх мөчлөгийг солих бол дээрх A B C D-г засаад хадгал.</p>'
      + '<div id="cycleSaved" style="font-size:.85rem"></div>'
      + '<div id="cycleEdit" class="hidden" style="margin-top:10px;border:1px solid #0f3460;border-radius:8px;padding:10px">'
      + '<h4 id="cycleEditTitle" style="margin:0 0 8px">Ээлж засах</h4>'
      + '<div id="cycleEditMembers" style="display:flex;flex-wrap:wrap;gap:8px"></div>'
      + '<div style="margin-top:8px"><button type="button" class="btn btn-success btn-sm" id="cycleEditSave">Энэ ээлжийг хадгалах</button> <button type="button" class="btn btn-outline btn-sm" id="cycleEditClear">Засварыг арилгах</button></div>'
      + '</div>'
      + '<h4 style="margin:14px 0 6px">7 хоногийн сунгалт</h4>'
      + '<div class="header-info">'
      + '<div><label>Ажилтан</label><select id="cycleStretchEmp"></select></div>'
      + '<div><label>Ээлж</label><select id="cycleStretchBlock"></select></div>'
      + '<div style="display:flex;align-items:flex-end;gap:8px"><label><input type="checkbox" id="cycleEarly"> 7 өмнө</label><label><input type="checkbox" id="cycleLate"> 7 хойш</label></div>'
      + '<div style="display:flex;align-items:flex-end"><button type="button" class="btn btn-sm" id="cycleStretchAdd">Сунгалт нэмэх</button></div>'
      + "</div>"
      + '<div id="cycleStretchList" style="margin-top:8px;font-size:.85rem"></div>'
      + '<div id="cycleBoard" style="margin-top:12px"></div>';
    pane.insertBefore(card, pane.firstChild);
    document.getElementById("cycleSave").onclick = function () { saveCfg(); };
    document.getElementById("cycleSave2").onclick = function () { saveCfg(); };
    document.getElementById("cycleSaved").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-cedit]");
      if (b) openEdit(b.getAttribute("data-cedit"));
    });
    document.getElementById("cycleEditSave").onclick = saveEdit;
    document.getElementById("cycleEditClear").onclick = clearEdit;
    var oldCard = document.getElementById("rosterList");
    if (oldCard && oldCard.closest) { var card = oldCard.closest(".card"); if (card && card.id !== "cycleCard") card.style.display = "none"; }
    document.getElementById("cycleStretchAdd").onclick = function () { addStretch(); };
    document.getElementById("cycleStretchEmp").onchange = fillBlocks;
    document.getElementById("cycleAnchor").onchange = function () {
      if (cfg && this.value) { cfg.anchor = this.value; paint(); fillBlocks(); }
    };
    document.getElementById("cycleStretchList").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-sdel]");
      if (!b) return;
      cfg.stretches.splice(Number(b.getAttribute("data-sdel")), 1);
      saveCfg();
    });
  }

  async function refresh() {
    ensureUi();
    if (!document.getElementById("cycleCard")) return;
    if (!cfg) await loadCfg();
    var anchor = document.getElementById("cycleAnchor");
    if (anchor && document.activeElement !== anchor) anchor.value = cfg.anchor;
    drawMembers();
    drawStretches();
    drawSaved();
    paint();
  }

  var origShow = null;
  function hook() {
    if (typeof window.showAcctTab === "function" && !window.showAcctTab._cyc) {
      origShow = window.showAcctTab;
      var fn = function (name) {
        var out = origShow.apply(this, arguments);
        if (name === "roster") refresh();
        return out;
      };
      fn._cyc = true;
      fn._ar = origShow._ar;
      window.showAcctTab = fn;
    }
    ensureUi();
  }
  hook();
  setInterval(hook, 800);
  loadCfg();
})();
