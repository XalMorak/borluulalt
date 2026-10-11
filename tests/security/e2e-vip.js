/* VIP location: beer + wine together in one section of one form (kind "vip"), shared "Ерөө говь задгай" stock, and the wine-edit total bug.
   Emulator only. `node e2e-vip.js [strict]` */
const H = require("./e2e-browser.js");
const fails = [];
const check = (n, ok, info) => { console.log((ok ? "ok   " : "FAIL ") + n + (info !== undefined ? "  " + JSON.stringify(info).slice(0, 300) : "")); if (!ok) fails.push(n); };
const L = () => ({ "Оюут бар": 30, "Манлай бар": 0, VIP: 20, POWER: 0 });
(async () => {
  const STRICT = process.argv[2] === "strict";
  const browser = await H.launch();
  const errs = [], blocked = [];
  const sd = H.seed();
  sd.borluulalt.products = [{ id: 1, name: "Боргио", price: 3500, stock: 50, stockByLoc: L() }, { id: 8, name: "ЕРӨӨ говь Задгай", price: 3500, stock: 50, stockByLoc: L() }];
  sd.borluulalt.wines = [{ id: 101, name: "Sangria", price: 5000, cat: "ulaan", stock: 50, stockByLoc: L() }, { id: 102, name: "Ерөө говь задгай", price: 3500, cat: "busad", stock: 50, stockByLoc: L() }];
  await H.dbPut("", sd); await H.setRules(STRICT ? "strict" : "transition"); process.env.LOGIN_MODE = STRICT ? "secure" : "transition";
  console.log("rules:", STRICT ? "strict/secure" : "transition");
  const stock = async () => { const p = await H.dbGet("borluulalt/products"), w = await H.dbGet("borluulalt/wines"); return { p1: p[0].stockByLoc, p8: p[1].stockByLoc, w101: w[0].stockByLoc, w102: w[1].stockByLoc }; };
  const push = (pg) => pg.evaluate(async () => { await cloudPush(); if (window._stockLast) await window._stockLast; await window._stockReconcile(getSubs(), {}); return true; });

  const S = (await H.newPage(browser, errs, blocked)).page;
  await H.login(S, "sup001", "4321"); await H.wait(1200);
  await push(S);   // sets the cutoff
  await H.wait(1200);

  /* ---- 1. VIP нэгдсэн employee form ---- */
  const E = (await H.newPage(browser, errs, blocked)).page;
  await H.login(E, "emp001", "1111"); await H.wait(800);
  const tekOpts = await E.evaluate(async () => {
    const loc = document.getElementById("locationName"); loc.value = "VIP"; loc.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 600));
    return [...document.getElementById("receiverName").options].map((o) => o.value);
  });
  check("VIP keeps its normal тек list (no extra option needed)", tekOpts.includes("VIP") && !tekOpts.some((t) => /нэгдсэн/.test(t)), tekOpts);
  const form = await E.evaluate(async () => {
    const tek = document.getElementById("receiverName"); tek.value = "VIP"; tek.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 1200));
    const ids = [...document.querySelectorAll("#salesBody input[id^='sold_']")].map((x) => Number(x.id.slice(5)));
    const secs = [...document.querySelectorAll("#salesBody tr.vip-sec")].map((x) => x.textContent);
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); };
    set("prev_1", 8); set("next_1", 3);
    set("prev_8", 4); set("next_8", 1);
    set("sold_101", 2);
    const wineLocked = document.getElementById("prev_101").readOnly && document.getElementById("next_101").readOnly;
    const beerOpen = !document.getElementById("prev_1").readOnly;
    set("cashAmount", 38000); if (window.updateRecon) updateRecon();
    const calc = getCalcTotal();
    const recon = (document.getElementById("reconDiff") || {}).textContent;
    window.alert = () => {};
    await saveSubmission(); await new Promise((r) => setTimeout(r, 2500));
    return { ids, secs, wineLocked, beerOpen, calc, recon, vip: window._vipMode, msg: document.getElementById("empAlert").innerText };
  });
  check("combined form lists beer + wines, shared Ерөө only once (as beer id 8)", form.ids.includes(1) && form.ids.includes(8) && form.ids.includes(101) && !form.ids.includes(102), form.ids);
  check("beer and wine together in ONE section", form.secs.length === 1 && form.vip, form.secs);
  check("beer rows prev/next, wine rows sold only", form.wineLocked && form.beerOpen);
  check("one reconciliation: 5×3500 + 3×3500 + 2×5000 = 38000, diff 0", form.calc === 38000 && /^\+?0/.test(String(form.recon).trim()), form);
  check("submitted", /✓/.test(form.msg), form.msg);
  const inbox = Object.values((await H.dbGet("borluulalt/inbox")) || {});
  const vs = inbox.find((s) => s.kind === "vip");
  check("stored kind/sheet 'vip', one calcTotal/diff", vs && vs.sheet === "vip" && vs.calcTotal === 38000 && vs.diff === 0 && vs.location === "VIP" && vs.items.some((i) => i.id === 101 && i.sold === 2), vs && { kind: vs.kind, sheet: vs.sheet, calc: vs.calcTotal, diff: vs.diff });

  /* a wine-sheet submission that sells the wine-catalog Ерөө (id 102) at Оюут бар */
  const now = new Date().toISOString();
  await H.dbPut("borluulalt/inbox/s_w", { id: "s_w", employeeId: "emp002", employeeName: "Саран", date: H.T, shift: "Орой", location: "Оюут бар", receiverName: "Оюут вино", kind: "wine", sheet: "wine",
    items: [{ id: 101, name: "Sangria", price: 5000, sold: 2, income: 10000 }, { id: 102, name: "Ерөө говь задгай", price: 3500, prev: 6, next: 2, sold: 4, income: 14000 }],
    cashAmount: 24000, cardTotal: 0, cashBalance: 0, calcTotal: 24000, collected: 24000, diff: 0, submittedAt: now });
  await H.dbPut("borluulalt/_meta/inbox", "t" + Date.now());

  /* ---- 2. stock: supervisor pulls + pushes ---- */
  await S.evaluate(async () => { await refreshData(); await new Promise((r) => setTimeout(r, 1500)); });
  await push(S); await push(S);
  let s = await stock();
  check("VIP нэгдсэн: beer deducted at VIP (Боргио 20→15)", s.p1.VIP === 15, s.p1);
  check("VIP нэгдсэн: wine deducted at VIP (Sangria 20→18)", s.w101.VIP === 18, s.w101);
  check("Ерөө sold on the beer side (VIP, 3) → shared pool p8", s.p8.VIP === 17, s.p8);
  check("Ерөө sold on the wine sheet (Оюут бар, 4) → same pool p8, wine copy untouched", s.p8["Оюут бар"] === 26 && s.w102["Оюут бар"] === 30 && s.w102.VIP === 20, { p8: s.p8, w102: s.w102 });
  await push(S);
  s = await stock();
  check("exactly once (third push changes nothing)", s.p1.VIP === 15 && s.p8.VIP === 17 && s.p8["Оюут бар"] === 26 && s.w101.VIP === 18);
  const stockTab = await S.evaluate(async () => { if (typeof showTab === "function") showTab("tabStock"); await new Promise((r) => setTimeout(r, 800)); return [...document.querySelectorAll("#smBody tr[data-kind]")].map((t) => t.getAttribute("data-name")); });
  check("stock tab shows the shared item once", stockTab.filter((n) => /ерөө/.test(n || "")).length === 1, stockTab);

  /* ---- 3. wine edit updates the total (bug) ---- */
  const ed = await S.evaluate(async () => {
    window.alert = () => {}; window.confirm = () => true;
    loadSupervisorData(); await new Promise((r) => setTimeout(r, 600));
    const idx = window._sortedSubs.findIndex((x) => x.id === "s_w");
    showSubmissionDetail(idx); await new Promise((r) => setTimeout(r, 300));
    startEditSubmission(idx); await new Promise((r) => setTimeout(r, 600));
    const f = document.getElementById("edit_sold_0"); f.value = 3; f.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    const inc = Number(document.getElementById("edit_income_0").value);
    const box = (document.getElementById("editTotalsBox") || {}).innerText || "";
    await saveEditSubmission(idx); await new Promise((r) => setTimeout(r, 1500));
    return { inc, box };
  });
  check("wine edit: sold 2→3 recomputes income 15000", ed.inc === 15000, ed);
  check("wine edit: on-screen Бодолт total 29,000", /29[,.\s]?000/.test(ed.box), ed.box);
  const after = await H.dbGet("borluulalt/inbox/s_w");
  check("wine edit: saved calcTotal 29000, diff -5000", after && after.calcTotal === 29000 && after.diff === -5000, after && { calc: after.calcTotal, diff: after.diff });
  await push(S); s = await stock();
  check("wine edit: stock follows (Sangria Оюут 28→27)", s.w101["Оюут бар"] === 27, s.w101);

  /* ---- 4. accountant: VIP нэгдсэн kind ---- */
  const A = (await H.newPage(browser, errs, blocked)).page;
  await H.login(A, "acc001", "9999"); await H.wait(2500);
  const acc = await A.evaluate(async () => {
    const all = (window._acct && window._acct.all()) || [];
    const v = all.find((s) => s.kind === "vip");
    const sel = document.getElementById("acctKind");
    const n = async (k) => { sel.value = k; sel.dispatchEvent(new Event("change", { bubbles: true })); await new Promise((r) => setTimeout(r, 500)); return window._acct.rows().map((s) => s.kind || "bar"); };
    return { kind: v && window._acct.kindOf(v), label: v && window._acct.kindLabel(window._acct.kindOf(v)), vip: await n("vip"), bar: await n("bar"), wine: await n("wine") };
  });
  check("accountant: kind 'VIP нэгдсэн'", acc.kind === "vip" && acc.label === "VIP нэгдсэн", acc);
  check("accountant filter: VIP нэгдсэн only / Пиво includes it / Вино excludes it", acc.vip.length >= 1 && acc.vip.every((k) => k === "vip") && acc.bar.includes("vip") && !acc.wine.includes("vip"), acc);

  const bad = [...new Set(errs)].filter((e) => !/404|401|ERR_FAILED|favicon/i.test(e));
  check("no console errors", bad.length === 0, bad.slice(0, 5));
  await browser.close();
  console.log(fails.length ? "\n" + fails.length + " FAILED" : "\nall VIP/stock checks ok");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
