/* Bug reports e2e (emulator only): "Алдаа мэдэгдэх" modal for each role, auto-capture (rate limit + dedupe),
   no PIN in reports, accountant "Алдаа" tab + status change. `node e2e-bugs.js [transition|secure|all]` */
const fs = require("fs");
const H = require("./e2e-browser.js");
const fails = [];
const check = (n, ok, info) => { console.log((ok ? "ok   " : "FAIL ") + n + (info !== undefined ? "  " + JSON.stringify(info).slice(0, 260) : "")); if (!ok) fails.push(n); };
const which = process.argv[2] || "all";
const IMG = process.env.BUG_IMG || "/workspace/sloth_palette.png";

async function scenario(browser, mode) {
  const rules = mode === "secure" ? "strict" : "transition";
  console.log(`\n--- ${mode} mode, ${rules} rules`);
  await fetch(`http://127.0.0.1:9499/emulator/v1/projects/demo-borluulalt/accounts`, { method: "DELETE" });
  await H.dbPut("", H.seed()); await H.setRules(rules); process.env.LOGIN_MODE = mode;
  const errs = [], blocked = [];
  const reports = async () => Object.entries((await H.dbGet("borluulalt/reports")) || {}).map(([k, v]) => Object.assign({ key: k }, v));

  for (const [id, pin, role] of [["emp001", "1111", "employee"], ["sup001", "4321", "supervisor"], ["acc001", "9999", "accountant"]]) {
    const P = (await H.newPage(browser, errs, blocked)).page;
    await H.login(P, id, pin);
    const btn = await P.evaluate(() => { const b = document.getElementById("bugBtn"); return b && b.offsetWidth > 0; });
    check(`${mode}/${role}: header button visible`, btn);
    await P.click("#bugBtn"); await H.wait(300);
    check(`${mode}/${role}: modal opens`, await P.evaluate(() => !document.getElementById("bugModal").classList.contains("hidden")));
    await P.click("#bugSend"); await H.wait(300);
    check(`${mode}/${role}: empty text refused`, /бичнэ үү/.test(await P.evaluate(() => document.getElementById("bugAlert").innerText)));
    await P.select("#bugCat", "Илгээлт");
    await P.type("#bugText", role + ": Илгээх дарахад алдаа гарлаа pin=" + pin);
    if (role === "employee" && fs.existsSync(IMG)) { const inp = await P.$("#bugShot"); await inp.uploadFile(IMG); await H.wait(2500); }
    await P.click("#bugSend"); await H.wait(2500);
    const ok = await P.evaluate(() => document.getElementById("bugAlert").innerText);
    check(`${mode}/${role}: sent`, /Илгээлээ/.test(ok), ok);
    const mine = (await reports()).filter((r) => r.by === id && r.kind === "user");
    const r = mine[mine.length - 1] || {};
    check(`${mode}/${role}: stored {at, by, role, kind:user, category, text, status:new, ctx}`, r.role === role && r.status === "new" && r.category === "Илгээлт" && /Илгээх/.test(r.text) && r.ctx && r.ctx.ua && r.ctx.screen && r.ctx.url && "errors" in r.ctx && r.ctx.mode === mode, { role: r.role, ctx: r.ctx && Object.keys(r.ctx) });
    check(`${mode}/${role}: no PIN in the report (scrubbed)`, !JSON.stringify(r).includes(pin) && /pin=\*\*\*/.test(r.text), r.text);
    if (role === "employee") check(`${mode}: screenshot compressed to ≤300KB jpeg`, !fs.existsSync(IMG) || (typeof r.shot === "string" && r.shot.startsWith("data:image/jpeg") && r.shot.length <= 300 * 1024), r.shot && r.shot.length);
    if (role === "employee") {
      /* auto-capture: 8 distinct uncaught errors + duplicates + a rejection → at most 5, deduped */
      /* inline <script> = same origin as the app (errors thrown from page.evaluate show up as "Script error.") */
      await P.evaluate(() => {
        const sc = document.createElement("script");
        sc.textContent = 'for (let i = 0; i < 3; i++) setTimeout(function(){ throw new Error("boom-dup"); }, 10 * i);'
          + 'for (let i = 0; i < 8; i++) setTimeout(function(){ throw new Error("boom-" + i); }, 50 + 10 * i);'
          + 'Promise.reject(new Error("rejected-test"));';
        document.body.appendChild(sc);
        setTimeout(() => { throw new Error("cross-origin-noise"); }, 5);   // arrives as "Script error." → not auto-reported
      });
      await H.wait(5000);
      const auto = (await reports()).filter((x) => x.by === id && x.kind === "auto");
      const msgs = auto.map((x) => x.text);
      check(`${mode}: auto reports rate-limited to 5 per session`, auto.length === 5, msgs);
      check(`${mode}: auto reports deduped, cross-origin "Script error." skipped`, new Set(msgs).size === msgs.length && msgs.filter((m) => /boom-dup/.test(m)).length === 1 && !msgs.some((m) => /Script error/.test(m)), msgs);
      check(`${mode}: auto report has ctx.errors with the captured error`, auto.every((x) => x.status === "new" && /boom|rejected/.test(x.ctx.errors)));
      check(`${mode}: last errors buffer ≤20`, (await P.evaluate(() => window._bugErrors().length)) <= 20);
    }
    if (role === "accountant") {
      await P.evaluate(() => showAcctTab("bugs")); await H.wait(2500);
      const n = await P.evaluate(() => document.querySelectorAll("#bugList .bug-item").length);
      check(`${mode}: accountant sees all reports in Алдаа tab`, n === (await reports()).length, n);
      const key = await P.evaluate(() => { const s = document.querySelector("#bugList select[data-bug]"); s.value = "fixing"; s.dispatchEvent(new Event("change", { bubbles: true })); return s.getAttribute("data-bug"); });
      await H.wait(1500);
      const st = await H.dbGet("borluulalt/reports/" + key);
      check(`${mode}: accountant changes status`, st && st.status === "fixing" && st.statusBy === "acc001", st && st.status);
      await P.select("#bugF", "fixing");
      check(`${mode}: status filter`, (await P.evaluate(() => document.querySelectorAll("#bugList .bug-item").length)) === 1);
      if (mode === "transition") await P.screenshot({ path: (process.env.SHOT_DIR || "/workspace") + "/bugs-acct.png" });
    }
    if (role === "employee" && mode === "transition") { await P.click("#bugBtn"); await H.wait(300); await P.screenshot({ path: (process.env.SHOT_DIR || "/workspace") + "/bugs-modal.png" }); }
    await P.browserContext().close();
  }
  const bad = [...new Set(errs)].filter((e) => !/404|401|403|ERR_FAILED|502|boom|rejected-test|cross-origin-noise/i.test(e));
  check(`${mode}: no other console errors`, bad.length === 0, bad.slice(0, 6));
}

(async () => {
  const browser = await H.launch();
  if (which === "all" || which === "transition") await scenario(browser, "transition");
  if (which === "all" || which === "secure") await scenario(browser, "secure");
  await browser.close();
  console.log(fails.length ? "\n" + fails.length + " FAILED" : "\nall bug-report checks ok");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
