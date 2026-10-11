/* Behaviour + DOM regression gate for the code cleanup (emulator only).
   1) Feature checks: employee submit, supervisor today panel (илүү/дутуу), supervisor tabs,
      accountant list filters and Excel/CSV export.
   2) DOM snapshot per role and tab (visible ids, buttons, table headers; digits masked) compared
      with dom-baseline.json.  `node e2e-dom.js --update` rewrites the baseline. */
const fs = require("fs");
const path = require("path");
const H = require("./e2e-browser.js");
const BASE = path.join(__dirname, "dom-baseline.json");
const UPDATE = process.argv.includes("--update");
const fails = [];
const check = (n, ok, info) => { console.log((ok ? "ok   " : "FAIL ") + n + (info !== undefined ? "  " + JSON.stringify(info).slice(0, 300) : "")); if (!ok) fails.push(n); };

const snapFn = () => {
  const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const t = (s) => String(s || "").replace(/\s+/g, " ").trim().replace(/\d/g, "#").slice(0, 60);
  const ids = [...document.querySelectorAll("[id]")].filter(vis).map((e) => e.tagName.toLowerCase() + "#" + e.id.replace(/\d+/g, "#"));
  const buttons = [...document.querySelectorAll("button")].filter(vis).map((b) => t(b.textContent)).filter(Boolean);
  const th = [...document.querySelectorAll("th")].filter(vis).map((x) => t(x.textContent));
  const labels = [...document.querySelectorAll("label")].filter(vis).map((x) => t(x.textContent)).filter(Boolean);
  const uniq = (a) => [...new Set(a)].sort();
  /* computed style of the visible id'd elements: catches CSS lost in the stylesheet move */
  const style = [...document.querySelectorAll("[id]")].filter(vis).slice(0, 150).map((e) => { const c = getComputedStyle(e); return e.id.replace(/\d+/g, "#") + "|" + [c.display, c.fontFamily, c.fontSize, c.fontWeight, c.color, c.backgroundColor, c.textAlign, c.minWidth].join(","); });
  return { ids: uniq(ids), buttons: uniq(buttons), th: uniq(th), labels: uniq(labels), style: uniq(style) };
};

(async () => {
  const browser = await H.launch();
  const errs = [], blocked = [];
  const sd = H.seed();
  await H.dbPut("", sd); await H.setRules("transition"); process.env.LOGIN_MODE = "transition";
  const snaps = {};
  const E = (await H.newPage(browser, errs, blocked)).page, S = (await H.newPage(browser, errs, blocked)).page, C = (await H.newPage(browser, errs, blocked)).page;

  /* login screen */
  await H.wait(1500); snaps.login = await E.evaluate(snapFn);

  /* employee */
  await H.login(E, "emp001", "1111"); await H.wait(1500);
  snaps.employee = await E.evaluate(snapFn);
  const form = await E.evaluate(() => ["formDate", "shiftType", "locationName", "receiverName", "checkerName", "cashAmount", "cardTotal", "salesBody"].filter((id) => !document.getElementById(id)));
  check("employee form fields present", form.length === 0, form);
  check("employee submit", /✓/.test(await H.empSubmit(E)));
  const inbox = Object.values((await H.dbGet("borluulalt/inbox")) || {});
  const mine = inbox.find((s) => s.employeeId === "emp001");
  check("submission stored with items, location, cash", !!(mine && mine.location === "VIP" && (mine.items || []).some((i) => i.sold === 5) && Number(mine.cashAmount) === 17000), mine && { loc: mine.location, cash: mine.cashAmount });

  /* supervisor */
  await H.login(S, "sup001", "4321"); await H.wait(2500);
  snaps.supervisor = await S.evaluate(snapFn);
  const today = await S.evaluate(() => document.getElementById("supervisorView").innerText);
  check("supervisor today panel lists today's submission (Бат) with илүү/дутуу", /Бат/.test(today) && /(илүү|дутуу|Илүү|Дутуу)/.test(today), today.slice(0, 200));
  const tabs = await S.evaluate(() => [...document.querySelectorAll("#supervisorView .tab-btn")].filter((b) => b.offsetWidth).map((b) => b.id || b.textContent.trim()));
  check("supervisor tabs", tabs.length >= 3, tabs);
  for (const tb of tabs) {
    await S.evaluate((id) => { const b = document.getElementById(id) || [...document.querySelectorAll("#supervisorView .tab-btn")].find((x) => x.textContent.trim() === id); b && b.click(); }, tb);
    await H.wait(900);
    snaps["supervisor:" + tb] = await S.evaluate(snapFn);
  }

  /* accountant */
  await H.login(C, "acc001", "9999"); await H.wait(2500);
  snaps.accountant = await C.evaluate(snapFn);
  const rows = () => C.evaluate(() => document.querySelectorAll("#acctBody tr[data-i]").length);
  const all = await rows();
  check("accountant lists all submissions", all >= 2, all);
  await C.evaluate(() => { const e = document.getElementById("acctEmp"); e.value = "emp001"; e.dispatchEvent(new Event("change", { bubbles: true })); });
  await H.wait(800);
  const one = await rows();
  check("accountant employee filter", one === 1, { all, one });
  await C.evaluate(() => { const e = document.getElementById("acctEmp"); e.value = ""; e.dispatchEvent(new Event("change", { bubbles: true })); const l = document.getElementById("acctLoc"); l.value = "VIP"; l.dispatchEvent(new Event("change", { bubbles: true })); });
  await H.wait(800);
  check("accountant location filter", (await rows()) === all);
  const csv = await C.evaluate(async () => {
    let out = null; const oc = URL.createObjectURL;
    URL.createObjectURL = (b) => { b.text().then((t) => (out = t)); return "blob:x"; };
    const a = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
    try { document.getElementById("acctExcel").click(); } catch (e) {}
    await new Promise((r) => setTimeout(r, 800));
    URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = a;
    return out;
  });
  check("accountant export contains the submissions", !!csv && /Бат/.test(csv) && /Саран/.test(csv), (csv || "").slice(0, 120));
  for (const tb of ["acctPaneUsers", "acctPaneRoster"]) {
    await C.evaluate((p) => { const b = [...document.querySelectorAll("#acctTabs button")].find((x) => (x.getAttribute("data-p") || x.getAttribute("data-pane") || x.onclick || "").toString().includes(p.replace("acctPane", "").toLowerCase())); if (b) b.click(); }, tb);
    await H.wait(800);
  }
  const acctTabs = await C.evaluate(() => [...document.querySelectorAll("#acctTabs button")].map((b) => b.textContent.trim()));
  for (let i = 0; i < acctTabs.length; i++) {
    await C.evaluate((i) => document.querySelectorAll("#acctTabs button")[i].click(), i); await H.wait(900);
    snaps["accountant:" + acctTabs[i].replace(/\d/g, "#")] = await C.evaluate(snapFn);
  }

  const bad = [...new Set(errs)].filter((e) => !/404|401|ERR_FAILED|502/i.test(e));
  check("no console errors", bad.length === 0, bad.slice(0, 8));

  if (UPDATE || !fs.existsSync(BASE)) { fs.writeFileSync(BASE, JSON.stringify(snaps, null, 1) + "\n"); console.log("baseline written: " + Object.keys(snaps).length + " views"); }
  else {
    const base = JSON.parse(fs.readFileSync(BASE, "utf8"));
    for (const k of Object.keys(base)) {
      const a = base[k], b = snaps[k];
      if (!b) { check("DOM view " + k, false, "missing"); continue; }
      const d = {};
      for (const f of Object.keys(a)) {
        const miss = a[f].filter((x) => !b[f].includes(x)), extra = b[f].filter((x) => !a[f].includes(x));
        if (miss.length || extra.length) d[f] = { missing: miss, extra };
      }
      check("DOM view " + k, !Object.keys(d).length, d);
    }
  }
  await browser.close();
  console.log(fails.length ? "\n" + fails.length + " FAILED" : "\nall DOM/behaviour checks ok");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
