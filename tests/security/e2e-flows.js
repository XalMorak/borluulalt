/* Multi-device regression run (emulator only): supervisor A edits / deletes / saves stock, supervisor B
   refreshes, accountant logs in; wrapper chains must stay stable; refresh must stay a small delta;
   a deleted user must not log in from a device's old local copy. Exit code 1 on any failure. */
const H = require("./e2e-browser.js");
const fails = [];
const check = (name, ok, info) => { console.log((ok ? "ok   " : "FAIL ") + name + (info !== undefined ? "  " + JSON.stringify(info) : "")); if (!ok) fails.push(name); };

(async () => {
  const browser = await H.launch();
  const errs = [], blocked = [];
  const sd = H.seed(); sd.borluulalt.users.sup002 = { name: "Ахлах 2", role: "supervisor", pin: "5555" };
  await H.dbPut("", sd); await H.setRules("transition"); process.env.LOGIN_MODE = "transition";
  const E = (await H.newPage(browser, errs, blocked)).page;
  const A = (await H.newPage(browser, errs, blocked)).page;
  const B = (await H.newPage(browser, errs, blocked)).page;
  const C = (await H.newPage(browser, errs, blocked)).page;
  const cdp = await B.target().createCDPSession(); await cdp.send("Network.enable");
  const net = { q: 0 }; cdp.on("Network.webSocketFrameSent", (e) => { if (/"a":"q"/.test(e.response.payloadData)) net.q++; });
  const subs = (p) => p.evaluate(() => (getSubs() || []).filter((s) => s && !s.deleted).map((s) => s.employeeId + "|" + (s.cashAmount || 0)).sort().join(","));

  await H.login(E, "emp001", "1111"); await H.empSubmit(E);
  await H.login(A, "sup001", "4321"); await H.login(B, "sup002", "5555"); await H.wait(2000);
  check("both supervisors see the new submission", (await subs(A)).includes("emp001") && (await subs(B)).includes("emp001"));

  /* wrapper chains: no global keeps being re-wrapped (it grew every tick before) */
  const churn = await B.evaluate(async () => {
    const names = ["refreshData", "showApp", "saveSubmission", "buildSalesTable", "showTab", "doLogin", "cloudPull", "cloudPush", "saveEditSubmission", "startEditSubmission", "toggleLock", "deleteSubmission"];
    const a = {}; names.forEach((n) => (a[n] = window[n])); const ch = {};
    for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 1000)); names.forEach((n) => { if (window[n] !== a[n]) { ch[n] = (ch[n] || 0) + 1; a[n] = window[n]; } }); }
    return ch;
  });
  check("wrapper chains are stable", Object.keys(churn).length === 0, churn);

  await A.evaluate(async () => {
    loadSupervisorData(); await new Promise((r) => setTimeout(r, 500));
    const idx = window._sortedSubs.findIndex((s) => s.employeeId === "emp001");
    showSubmissionDetail(idx); await new Promise((r) => setTimeout(r, 300));
    startEditSubmission(idx); await new Promise((r) => setTimeout(r, 500));
    window.__editForm = ["edit_location", "edit_receiver", "edit_shift"].map((id) => (document.getElementById(id) || {}).tagName).join(",");
    document.getElementById("edit_cash").value = 20000;
    await saveEditSubmission(idx); await new Promise((r) => setTimeout(r, 2500));
  });
  check("edit form: location / tek / shift are dropdowns", (await A.evaluate(() => window.__editForm)) === "SELECT,SELECT,SELECT", await A.evaluate(() => window.__editForm));
  check("A sees its edit once", (await subs(A)) === "emp001|20000,emp002|17500", await subs(A));
  const ed = await A.evaluate(() => { const x = getSubs().find((s) => s.employeeId === "emp001"); return { collected: x.collected, start: x.cashBalance || 0, card: x.cardTotal || 0, diff: x.diff, calc: x.calcTotal, editedAt: !!x.editedAt }; });
  check("edit uses the cash formula collected = max(0, cash - start) + card, and marks editedAt", ed.collected === Math.max(0, 20000 - ed.start) + ed.card && ed.diff === ed.collected - ed.calc && ed.editedAt, ed);
  net.q = 0; await B.evaluate(() => refreshData()); await H.wait(3500);
  check("B sees A's edit after refresh", (await subs(B)) === "emp001|20000,emp002|17500", await subs(B));
  check("refresh is a small delta read", net.q <= 30, net.q);

  await A.evaluate(async () => {
    loadSupervisorData(); await new Promise((r) => setTimeout(r, 500));
    /* the Delete button is intercepted by sync_stable.js -> stickyDeleteSubmission */
    await stickyDeleteSubmission(window._sortedSubs.findIndex((s) => s.employeeId === "emp002")); await new Promise((r) => setTimeout(r, 2500));
  });
  await B.evaluate(() => refreshData()); await H.wait(3500);
  check("B drops a submission deleted on A", (await subs(B)) === "emp001|20000", await subs(B));

  const st = await A.evaluate(async () => {
    showTab("stock"); await new Promise((r) => setTimeout(r, 1200));
    const i = document.getElementById("sm_stock_beer_1"); i.value = 33; i.dispatchEvent(new Event("input", { bubbles: true }));
    await saveMergedStock(); await new Promise((r) => setTimeout(r, 2000));
    return getProducts()[0].stockByLoc["Оюут бар"];
  });
  await B.evaluate(() => refreshData()); await H.wait(3500);
  check("stock saved on A reaches B", st === 33 && (await B.evaluate(() => getProducts()[0].stockByLoc["Оюут бар"])) === 33);

  await H.login(C, "acc001", "9999"); await H.wait(2500);
  check("accountant sees the edited list", (await subs(C)) === "emp001|20000", await subs(C));

  /* deleted user, same device, server reachable / server down */
  for (const down of [false, true]) {
    await H.dbPut("", H.seed()); H.setApiDown(false);
    const { page, ctx } = await H.newPage(browser, errs, blocked);
    await H.login(page, "emp002", "2222"); await H.logout(page);
    await H.dbPut("borluulalt/users/emp002", null); await H.dbPut("borluulalt/_meta/users", "t" + Date.now());
    H.setApiDown(down);
    const r = await H.login(page, "emp002", "2222"); H.setApiDown(false);
    check("deleted user cannot log in from local cache" + (down ? " (api down)" : ""), !r.app, r.alert);
    await ctx.close();
  }
  const bad = [...new Set(errs)].filter((e) => !/404|401|ERR_FAILED|502|Bad Gateway/i.test(e));
  check("no console errors", bad.length === 0, bad.slice(0, 10));
  const out = blocked.filter((u) => !/^data:|fonts\.googleapis\.com/.test(u));
  check("no request left the box (fonts aside)", out.length === 0, out.slice(0, 5));
  await browser.close();
  console.log(fails.length ? "\n" + fails.length + " FAILED" : "\nall flows ok");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
