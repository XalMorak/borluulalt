/* Server-side stock deduction (stock_ledger.js), emulator only. Two supervisors push at the same time,
   retries, edit, delete, re-submit, beer + wine, VIP, a submission from before the cutoff, a crashed
   (pending) ledger entry, and a stock count in the merged stock tab. Exit 1 on failure. */
const H = require("./e2e-browser.js");
const fails = [];
const check = (n, ok, info) => { console.log((ok ? "ok   " : "FAIL ") + n + (info !== undefined ? "  " + JSON.stringify(info) : "")); if (!ok) fails.push(n); };
const LOCS = { "Оюут бар": 30, "Манлай бар": 0, VIP: 20, POWER: 0 };
(async () => {
  const browser = await H.launch();
  const errs = [], blocked = [];
  const sd = H.seed();
  sd.borluulalt.users.sup002 = { name: "Ахлах 2", role: "supervisor", pin: "5555" };
  sd.borluulalt.products = [{ id: 1, name: "Боргио", price: 3500, stock: 50, stockByLoc: Object.assign({}, LOCS) }, { id: 2, name: "Cass", price: 4000, stock: 50, stockByLoc: Object.assign({}, LOCS) }];
  sd.borluulalt.wines = [{ id: 101, name: "Sangria", price: 5000, cat: "ulaan", stock: 7, stockByLoc: { "Оюут бар": 0, "Манлай бар": 0, VIP: 7, POWER: 0 } }];
  const STRICT = process.argv[2] === "strict";   // strict rules + secure login, or transition (default)
  await H.dbPut("", sd); await H.setRules(STRICT ? "strict" : "transition"); process.env.LOGIN_MODE = STRICT ? "secure" : "transition";
  console.log("rules:", STRICT ? "strict/secure" : "transition");
  const E = (await H.newPage(browser, errs, blocked)).page, A = (await H.newPage(browser, errs, blocked)).page, B = (await H.newPage(browser, errs, blocked)).page;
  const stock = async () => { const p = await H.dbGet("borluulalt/products"), w = await H.dbGet("borluulalt/wines"); return { p1: p[0].stockByLoc, p2: p[1].stockByLoc, w101: w[0].stockByLoc, p1total: p[0].stock }; };
  const push = (pg) => pg.evaluate(async () => { await cloudPush(); if (window._stockLast) await window._stockLast; return true; });
  const both = async () => { await Promise.all([push(A), push(B)]); await Promise.all([push(A), push(B)]); };

  await H.login(A, "sup001", "4321"); await H.login(B, "sup002", "5555"); await H.wait(1500);
  await push(A);   // first run sets the cutoff; s_old (1 h old, VIP Боргио 5) must stay untouched
  const cut = await H.dbGet("borluulalt/stockLedger/_cutoff");
  check("cutoff set once by the first supervisor run", !!(cut && cut.at && cut.day), cut);
  check("submission from before the cutoff not deducted", (await stock()).p1.VIP === 20, (await stock()).p1);

  await H.login(E, "emp001", "1111");
  check("employee submit", /✓/.test(await H.empSubmit(E)));
  check("employee device wrote no stock", (await stock()).p1.VIP === 20);
  await H.dbPut("borluulalt/inbox/s_emp002_wine", { id: "s_emp002_wine", employeeId: "emp002", employeeName: "Саран", date: H.T, shift: "Өглөө", location: "VIP", kind: "wine", sheet: "wine",
    items: [{ id: 101, name: "Sangria", price: 5000, sold: 2, income: 10000 }], cashAmount: 10000, submittedAt: new Date().toISOString() });
  await H.dbPut("borluulalt/_meta/inbox", "t" + Date.now());

  await both();
  let s = await stock();
  check("two supervisors + retry: beer deducted once at VIP", s.p1.VIP === 15 && s.p1["Оюут бар"] === 30 && s.p1total === 45, s.p1);
  check("two supervisors + retry: wine (id 101) deducted once at VIP", s.w101.VIP === 5, s.w101);
  const led = await H.dbGet("borluulalt/stockLedger");
  check("ledger has no pending entries", Object.keys(led).filter((k) => led[k] && led[k].pending).length === 0, Object.keys(led));

  /* edit on A: sold 5 -> 3 */
  const ed = await A.evaluate(async () => {
    loadSupervisorData(); await new Promise((r) => setTimeout(r, 500));
    const idx = window._sortedSubs.findIndex((x) => x.employeeId === "emp001");
    showSubmissionDetail(idx); await new Promise((r) => setTimeout(r, 300));
    startEditSubmission(idx); await new Promise((r) => setTimeout(r, 500));
    const f = document.getElementById("edit_sold_0"); if (!f) return "no field";
    f.value = 3; f.dispatchEvent(new Event("input", { bubbles: true }));
    await saveEditSubmission(idx); await new Promise((r) => setTimeout(r, 1500));
    await cloudPush(); if (window._stockLast) await window._stockLast; return "ok";
  });
  await push(B);
  s = await stock();
  check("edit applies only the difference (5 -> 3)", ed === "ok" && s.p1.VIP === 17, { ed, vip: s.p1.VIP });

  /* delete on B, then both push again: stock returned once */
  await B.evaluate(async () => {
    window.confirm = () => true; window.alert = () => {};
    loadSupervisorData(); await new Promise((r) => setTimeout(r, 500));
    await stickyDeleteSubmission(window._sortedSubs.findIndex((x) => x.employeeId === "emp001"));
    if (window._stockLast) await window._stockLast;
  });
  await both();
  s = await stock();
  check("delete returns the stock once", s.p1.VIP === 20, s.p1);

  /* the employee submits the same shift again */
  await H.wait(1000);
  check("re-submit", /✓/.test(await H.empSubmit(E)));
  await both();
  s = await stock();
  check("re-submit after delete deducts again", s.p1.VIP === 15, s.p1);

  /* a tab closed mid-way: claimed but not applied (stale pending) -> finished once */
  const wk = Object.keys(await H.dbGet("borluulalt/stockLedger")).find((k) => k.includes("wine"));
  const we = await H.dbGet("borluulalt/stockLedger/" + wk);
  we.applied = { "w101@VIP": 3 }; we.ver = (we.ver || 0) + 1; we.pending = { op: wk + "~" + we.ver, delta: { "w101@VIP": 1 }, at: new Date(Date.now() - 60000).toISOString() };
  we.at = new Date().toISOString();
  await H.dbPut("borluulalt/stockLedger/" + wk, we);
  await both();
  s = await stock();
  /* claimed sold 2 -> 3 but never applied; finishing it takes 1 more, then it is settled back to the sub (2): net 5 */
  check("stale pending finished once and settled to the submission", s.w101.VIP === 5, s.w101);

  /* stock count in the merged stock tab (Оюут бар) keeps VIP sales */
  const cnt = await A.evaluate(async () => {
    showTab("stock"); await new Promise((r) => setTimeout(r, 1500));
    const i = document.getElementById("sm_stock_beer_2"); if (!i) return "no input";
    i.value = 9; i.dispatchEvent(new Event("input", { bubbles: true }));
    await saveMergedStock(); await new Promise((r) => setTimeout(r, 2500)); return "ok";
  });
  s = await stock();
  check("stock count sets only the counted location", cnt === "ok" && s.p2["Оюут бар"] === 9 && s.p2.VIP === 20 && s.p1.VIP === 15, { cnt, p2: s.p2, p1: s.p1.VIP });
  check("supervisor screen shows the server stock", (await B.evaluate(async () => { await refreshData(); await new Promise((r) => setTimeout(r, 2500)); return getProducts()[0].stockByLoc.VIP; })) === 15);

  const bad = [...new Set(errs)].filter((e) => !/404|401|ERR_FAILED|502/i.test(e));
  check("no console errors", bad.length === 0, bad.slice(0, 8));
  await browser.close();
  console.log(fails.length ? "\n" + fails.length + " FAILED" : "\nall stock checks ok");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
