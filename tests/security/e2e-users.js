/* User permissions e2e (emulator only).
   Supervisor: Хэрэглэгч tab can only ADD an employee (ID + name) → {role:employee, disabled, pending}, no PIN;
   cannot see PINs, change roles, edit, delete, enable/disable. Accountant: full control, activates pending.
   Runs in "transition" (transition rules) and "secure" (strict rules) — `node e2e-users.js [transition|secure|all]`. */
const H = require("./e2e-browser.js");
const fails = [];
const check = (n, ok, info) => { console.log((ok ? "ok   " : "FAIL ") + n + (info !== undefined ? "  " + JSON.stringify(info).slice(0, 260) : "")); if (!ok) fails.push(n); };
const which = process.argv[2] || "all";

async function scenario(browser, mode) {
  const rules = mode === "secure" ? "strict" : "transition";
  console.log(`\n--- ${mode} mode, ${rules} rules`);
  await fetch(`http://127.0.0.1:9499/emulator/v1/projects/demo-borluulalt/accounts`, { method: "DELETE" });
  await H.dbPut("", H.seed()); await H.setRules(rules); process.env.LOGIN_MODE = mode;
  const errs = [], blocked = [];
  const S = (await H.newPage(browser, errs, blocked)).page;
  const s = await H.login(S, "sup001", "4321");
  check(mode + ": supervisor logged in", s.app && s.user && s.user.role === "supervisor", s);
  await S.evaluate(() => showTab("users")); await H.wait(800);
  const ui = await S.evaluate(() => {
    const t = document.getElementById("tabUsers");
    return { visible: !t.classList.contains("hidden"), html: t.innerHTML, inputs: t.querySelectorAll("#usersBody input, #usersBody select, #usersBody button").length,
      th: [...t.querySelectorAll("th")].map((x) => x.textContent.trim()), role: !!document.getElementById("newUserRole"), rows: t.querySelectorAll("#usersBody tr").length };
  });
  check(mode + ": supervisor users tab is read-only (no inputs / buttons in rows)", ui.visible && ui.inputs === 0 && ui.rows >= 4, { inputs: ui.inputs, rows: ui.rows });
  check(mode + ": no PIN column, no role picker", !ui.th.includes("PIN") && !ui.role, ui.th);
  check(mode + ": no PIN values anywhere in the tab", !/4321|9999|1111|2222/.test(ui.html));

  await S.evaluate(() => { document.getElementById("newUserId").value = "emp010"; document.getElementById("newUserName").value = "Шинэ ажилтан"; return addUser(); }); await H.wait(1500);
  let u = await H.dbGet("borluulalt/users/emp010");
  check(mode + ": supervisor added employee → pending + disabled, no PIN", !!u && u.role === "employee" && u.disabled === true && u.pending === true && !("pin" in u) && u.createdBy === "sup001", u);
  check(mode + ": new employee listed as Хүлээгдэж буй", /Хүлээгдэж буй/.test(await S.evaluate(() => document.getElementById("usersBody").innerText)));

  await S.evaluate(() => { document.getElementById("newUserId").value = "emp001"; document.getElementById("newUserName").value = "Хуурамч"; return addUser(); }); await H.wait(1200);
  u = await H.dbGet("borluulalt/users/emp001");
  check(mode + ": adding an existing ID is refused (no overwrite)", u && u.name === "Бат" && u.pin === "1111" && /аль хэдийн/.test(await S.evaluate(() => document.getElementById("userAlert").innerText)), u);
  await S.evaluate(() => { saveUserRow("emp001"); deleteUser("emp002"); }); await H.wait(800);
  const after = await H.dbGet("borluulalt/users");
  check(mode + ": saveUserRow / deleteUser are refused", after.emp001 && after.emp001.name === "Бат" && after.emp002 && after.emp002.role === "employee", Object.keys(after));
  /* go around the UI: direct database writes as the supervisor */
  const direct = await S.evaluate(async () => {
    const db = window._realDb ? window._realDb() : firebase.database(), r = {};
    const tryIt = async (k, f) => { try { await f(); r[k] = "ok"; } catch (e) { r[k] = "denied"; } };
    await tryIt("promote", () => db.ref("borluulalt/users/emp001/role").set("supervisor"));
    await tryIt("delete", () => db.ref("borluulalt/users/emp002").remove());
    await tryIt("enable", () => db.ref("borluulalt/users/emp010/disabled").remove());
    await tryIt("addSup", () => db.ref("borluulalt/users/x1").set({ name: "X", role: "supervisor" }));
    return r;
  });
  if (rules === "strict") check("strict: direct supervisor writes to users are denied", Object.values(direct).every((v) => v === "denied"), direct);
  else console.log("info transition rules can't tell roles apart (auth != null): direct writes", JSON.stringify(direct));
  if (rules !== "strict") { await H.dbPut("borluulalt/users", H.seed().borluulalt.users); await H.dbPut("borluulalt/users/emp010", { name: "Шинэ ажилтан", role: "employee", disabled: true, pending: true, createdBy: "sup001" }); }

  const E = (await H.newPage(browser, errs, blocked)).page;
  const pend = await H.login(E, "emp010", "");
  check(mode + ": pending employee cannot log in", !pend.app, pend.alert);

  /* accountant */
  const C = (await H.newPage(browser, errs, blocked)).page;
  const c = await H.login(C, "acc001", "9999");
  check(mode + ": accountant logged in", c.app && c.user && c.user.role === "accountant", c);
  await C.evaluate(() => showAcctTab("users")); await H.wait(2000);
  const au = await C.evaluate(() => ({ pending: !!document.querySelector('#auBody tr[data-uid="emp010"] .au-pending'), cols: [...document.querySelectorAll(".au-table th")].map((x) => x.textContent) }));
  check(mode + ": accountant sees the pending badge + Идэвхтэй column", au.pending && au.cols.includes("Идэвхтэй"), au);
  await C.evaluate(() => { const f = document.getElementById("auRoleFilter"); f.value = "pending"; f.dispatchEvent(new Event("change")); });
  check(mode + ": filter Хүлээгдэж буй", (await C.evaluate(() => [...document.querySelectorAll("#auBody tr[data-uid]")].map((t) => t.getAttribute("data-uid")).join(","))) === "emp010");
  await C.evaluate(() => { const f = document.getElementById("auRoleFilter"); f.value = ""; f.dispatchEvent(new Event("change")); });
  await C.evaluate(() => { const tr = document.querySelector('#auBody tr[data-uid="emp010"]'); tr.querySelector(".au-active").checked = true; tr.querySelector(".au-pin").value = "5555"; return acctSaveUser("emp010"); }); await H.wait(2000);
  u = await H.dbGet("borluulalt/users/emp010");
  check(mode + ": accountant activates + sets PIN", u && !u.disabled && !u.pending && (mode === "secure" ? u.pinSet === true && !("pin" in u) : u.pin === "5555"), u);
  const ok = await H.login(E, "emp010", "5555");
  check(mode + ": activated employee logs in with the new PIN", ok.app && ok.user && ok.user.id === "emp010", ok.alert);

  await C.evaluate(() => { const tr = document.querySelector('#auBody tr[data-uid="emp002"]'); tr.querySelector(".au-active").checked = false; tr.querySelector(".au-role").value = "supervisor"; tr.querySelector(".au-pin").value = "7777"; return acctSaveUser("emp002"); }); await H.wait(1800);
  u = await H.dbGet("borluulalt/users/emp002");
  check(mode + ": accountant changes role + disables", u && u.role === "supervisor" && u.disabled === true, u);
  const E2 = (await H.newPage(browser, errs, blocked)).page;
  const dis = await H.login(E2, "emp002", "2222");
  check(mode + ": disabled user cannot log in", !dis.app, dis.alert);
  await C.evaluate(() => acctDeleteUser("emp002")); await H.wait(1800);
  check(mode + ": accountant deletes user", (await H.dbGet("borluulalt/users/emp002")) == null);
  const self = await C.evaluate(async () => { const tr = document.querySelector('#auBody tr[data-uid="acc001"]'); return tr.querySelector(".au-active").disabled; });
  check(mode + ": accountant cannot disable self", self === true);

  const bad = [...new Set(errs)].filter((e) => !/404|401|403|ERR_FAILED|502|PERMISSION_DENIED|permission_denied/i.test(e));
  check(mode + ": no console errors", bad.length === 0, bad.slice(0, 6));
}

(async () => {
  const browser = await H.launch();
  if (which === "all" || which === "transition") await scenario(browser, "transition");
  if (which === "all" || which === "secure") await scenario(browser, "secure");
  await browser.close();
  console.log(fails.length ? "\n" + fails.length + " FAILED" : "\nall user-permission checks ok");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
