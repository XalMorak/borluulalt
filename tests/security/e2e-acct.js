/* Accountant v2 e2e (emulator only): dashboard KPIs, periods, breakdowns, table search / sort /
   pages / unpaid filter, bulk pay (payments/<key> = {paid, amount, at, by}), summary CSV.
   Also writes screenshots: SHOT_DIR (default /workspace) acct-v2.png, acct-v2-mobile.png. */
const H = require("./e2e-browser.js");
const fails = [];
const check = (n, ok, info) => { console.log((ok ? "ok   " : "FAIL ") + n + (info !== undefined ? "  " + JSON.stringify(info).slice(0, 300) : "")); if (!ok) fails.push(n); };
const SHOT = process.env.SHOT_DIR || "/workspace";

function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
(async () => {
  const sd = H.seed(), b = sd.borluulalt;
  const emps = [["emp001", "Бат"], ["emp002", "Саран"]];
  const locs = ["VIP", "Оюут бар", "Манлай бар"];
  const subs = [];
  let expCalc = 0, expShortUnpaid = 0;
  for (let i = 0; i < 120; i++) {
    const d = new Date(); d.setDate(d.getDate() - (i % 40));
    const [eid, en] = emps[i % 2], calc = 10000 + (i % 7) * 1000, diff = i % 5 === 0 ? -500 * (1 + (i % 3)) : i % 7 === 0 ? 300 : 0;
    subs.push({ id: "s" + i, employeeId: eid, employeeName: en, date: ymd(d), shift: i % 2 ? "Орой" : "Өглөө", location: locs[i % 3], receiverName: "1-р тек", kind: "bar", sheet: "bar",
      items: [{ id: 1, name: "Боргио", price: 1000, prev: 20, next: 10, sold: 10, income: calc }], cashAmount: calc + diff, cardTotal: 0, cashBalance: 0, calcTotal: calc, collected: calc + diff, diff,
      submittedAt: new Date(Date.now() - i * 60e3).toISOString() });
    expCalc += calc; if (diff < 0) expShortUnpaid += -diff;
  }
  b.submissions = subs;
  const browser = await H.launch();
  const errs = [], blocked = [];
  await H.dbPut("", sd); await H.setRules("transition"); process.env.LOGIN_MODE = "transition";
  const C = (await H.newPage(browser, errs, blocked)).page;
  await H.login(C, "acc001", "9999"); await H.wait(3000);
  const ev = (f, a) => C.evaluate(f, a);
  const kpi = () => ev(() => Object.fromEntries([...document.querySelectorAll(".acct-kpi-card")].map((c) => [c.id, c.querySelector(".v").textContent.replace(/[^\d+-]/g, "")])));
  const vis = () => ev(() => [...document.querySelectorAll("#acctBody tr[data-i]")].filter((t) => t.style.display !== "none").length);

  let k = await kpi();
  check("dashboard KPI cards (8)", Object.keys(k).length === 8, k);
  check("KPI: total sales over all submissions", Number(k.kpiSales) === expCalc, { got: k.kpiSales, expCalc });
  check("KPI: submission count", Number(k.kpiCount) === 120, k.kpiCount);
  check("KPI: unpaid shortage", Number(k.kpiUnpaid) === expShortUnpaid, { got: k.kpiUnpaid, expShortUnpaid });
  check("breakdown by location: 3 rows", (await ev(() => document.querySelectorAll("#acctByLoc tr").length)) === 3);
  check("breakdown by day: bars", (await ev(() => document.querySelectorAll("#acctByDay .acct-bar").length)) >= 30);
  check("pagination: 50 rows on page 1", (await vis()) === 50, await vis());
  check("pager shows 1 / 3", /1 \/ 3/.test(await ev(() => document.getElementById("acctPager").textContent)));
  await ev(() => document.querySelector('#acctPager button[data-pg="1"]').click());
  check("page 2 has 50 rows", (await vis()) === 50);

  await ev(() => document.querySelector('#acctPeriod [data-period="today"]').click()); await H.wait(800);
  k = await kpi();
  const todayN = subs.filter((s) => s.date === ymd(new Date())).length;
  check("period Өнөөдөр: dates set and count", Number(k.kpiCount) === todayN && (await ev(() => document.getElementById("acctFrom").value)) === ymd(new Date()), { k: k.kpiCount, todayN });
  await ev(() => document.querySelector('#acctPeriod [data-period="all"]').click()); await H.wait(800);
  check("period Бүгд: back to 120", Number((await kpi()).kpiCount) === 120);

  await ev(() => { const s = document.getElementById("acctSearch"); s.value = "Саран"; s.dispatchEvent(new Event("input", { bubbles: true })); });
  check("search filters by employee (60 → page of 50)", /^60 \//.test(await ev(() => document.getElementById("acctCount").textContent)));
  await ev(() => { const s = document.getElementById("acctSearch"); s.value = ""; s.dispatchEvent(new Event("input", { bubbles: true })); });

  await ev(() => document.querySelectorAll("#acctBody")[0].closest("table").querySelectorAll("thead th")[8].click());
  const sorted = await ev(() => { const r = window._acctVisible; return r.slice(0, 3).map((s) => s.diff); });
  check("sort by Зөрүү (click header)", sorted[0] >= sorted[1] && sorted[1] >= sorted[2], sorted);

  await ev(() => { const u = document.getElementById("acctUnpaid"); u.checked = true; u.dispatchEvent(new Event("change", { bubbles: true })); });
  const nShort = subs.filter((s) => s.diff < 0).length;
  check("unpaid filter shows only shortages", (await ev(() => window._acctVisible.length)) === nShort && (await ev(() => document.querySelectorAll("#acctBody tr.acct-row-short").length)) === nShort, nShort);
  await C.screenshot({ path: SHOT + "/acct-v2-unpaid.png", fullPage: false });

  await ev(() => document.getElementById("acctBulkPay").click()); await H.wait(3500);
  const pays = (await H.dbGet("borluulalt/payments")) || {};
  const recs = Object.keys(pays).filter((x) => x !== "p0" && x !== "_ledger").map((x) => pays[x]);
  check("bulk pay wrote one record per shortage", recs.length === nShort, recs.length);
  check("payment record shape {paid, amount, at, by}", recs.every((r) => r.paid === true && r.amount > 0 && r.at && r.by === "acc001"), recs[0]);
  check("KPI unpaid is 0 after bulk pay", Number((await kpi()).kpiUnpaid) === 0);
  check("paid rows are marked", (await ev(() => document.querySelectorAll("#acctBody tr.acct-row-paid").length)) === nShort);

  const csv = await ev(async () => {
    let out = null; const oc = URL.createObjectURL;
    URL.createObjectURL = (bl) => { bl.text().then((t) => (out = t)); return "blob:x"; };
    const a = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
    try { document.getElementById("acctSummaryCsv").click(); } catch (e) {}
    await new Promise((r) => setTimeout(r, 800));
    URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = a;
    return out;
  });
  check("summary CSV: KPI + per employee / location / day", !!csv && /Нийт борлуулалт/.test(csv) && /Ажилтнаар/.test(csv) && /Байршлаар/.test(csv) && /Өдрөөр/.test(csv) && csv.includes(String(expCalc)), (csv || "").slice(0, 160));
  check("old accountant CSV still works", typeof (await ev(() => typeof window.exportAccountantCSV)) === "string");

  await ev(() => { const u = document.getElementById("acctUnpaid"); u.checked = false; u.dispatchEvent(new Event("change", { bubbles: true })); window.scrollTo(0, 0); });
  await C.setViewport({ width: 1280, height: 1500 }); await H.wait(500);
  await C.screenshot({ path: SHOT + "/acct-v2.png", fullPage: false });
  const M = (await H.newPage(browser, errs, blocked)).page;
  await M.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); await H.wait(2500);
  await H.login(M, "acc001", "9999"); await H.wait(3000);
  check("mobile: accountant dashboard visible", await M.evaluate(() => !!document.getElementById("kpiSales") && document.getElementById("kpiSales").offsetWidth > 0));
  await M.screenshot({ path: SHOT + "/acct-v2-mobile.png", fullPage: false });
  await M.evaluate(() => document.getElementById("acctTools").scrollIntoView());
  await M.screenshot({ path: SHOT + "/acct-v2-mobile-table.png", fullPage: false });
  const overflow = await M.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("mobile: no horizontal page overflow", overflow <= 2, overflow);

  const bad = [...new Set(errs)].filter((e) => !/404|401|ERR_FAILED|502/i.test(e));
  check("no console errors", bad.length === 0, bad.slice(0, 8));
  await browser.close();
  console.log(fails.length ? "\n" + fails.length + " FAILED" : "\nall accountant v2 checks ok");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
