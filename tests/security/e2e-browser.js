/* Browser end-to-end test: the real app in headless Chrome against the LOCAL emulators only
   (db 127.0.0.1:9400, auth 127.0.0.1:9499) with /api/* served by the real handlers.
   Every request that is not 127.0.0.1 is aborted and DNS is mapped to nothing, so production
   cannot be reached; the gstatic Firebase SDK files are served from node_modules.
   Run: node e2e-browser.js [secure|transition|legacy|all]   (CHROME=/path/to/chrome) */
const http = require("http"), fs = require("fs"), path = require("path");
const NS = "demo-borluulalt-e2e";
Object.assign(process.env, { FIREBASE_DATABASE_EMULATOR_HOST: "127.0.0.1:9400", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9499",
  FIREBASE_DATABASE_URL: `https://${NS}.firebaseio.com`, FIREBASE_PROJECT_ID: "demo-borluulalt", REQUIRE_PIN: "staff", PIN_PEPPER: "e2e" });
delete process.env.FIREBASE_SERVICE_ACCOUNT;
const ROOT = path.join(__dirname, "../..");
const puppeteer = require("puppeteer-core");
const api = { login: require(ROOT + "/api/login"), pin: require(ROOT + "/api/pin"), config: require(ROOT + "/api/config") };
const SDK = path.dirname(require.resolve("firebase/package.json")) + "/";
let API_DOWN = false;
const PORT = 18932;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const m = /^\/api\/(login|pin|config)$/.exec(u.pathname);
  if (m) {
    if (API_DOWN && m[1] !== "config") { res.statusCode = 502; return res.end("bad gateway"); }
    let data = ""; req.on("data", (c) => (data += c)); req.on("end", () => { try { req.body = data ? JSON.parse(data) : {}; } catch (e) { req.body = {}; } api[m[1]](req, res); });
    return;
  }
  const f = path.join(ROOT, path.normalize(u.pathname === "/" ? "/index.html" : u.pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end("nf"); }
  res.setHeader("Content-Type", MIME[path.extname(f)] || "application/octet-stream"); res.end(fs.readFileSync(f));
});
const EMU_PATCH = `;(function(){var _i=firebase.initializeApp;firebase.initializeApp=function(c,n){c=Object.assign({},c,{databaseURL:"https://${NS}.firebaseio.com",projectId:"demo-borluulalt",apiKey:"fake-key"});var a=_i.call(firebase,c,n);try{a.database().useEmulator("127.0.0.1",9400)}catch(e){console.warn("emu db",e)}try{a.auth().useEmulator("http://127.0.0.1:9499",{disableWarnings:true})}catch(e){console.warn("emu auth",e)}return a;};})();`;

const owner = { Authorization: "Bearer owner" };
const dbUrl = (p) => `http://127.0.0.1:9400/${p}.json?ns=${NS}`;
const dbPut = (p, v) => fetch(dbUrl(p), { method: "PUT", headers: owner, body: JSON.stringify(v) });
const dbGet = async (p) => (await fetch(dbUrl(p), { headers: owner })).json();
const rules = (w) => fs.readFileSync(ROOT + "/security/database.rules." + w + ".json", "utf8");
async function setRules(w) { const r = await fetch(`http://127.0.0.1:9400/.settings/rules.json?ns=${NS}`, { method: "PUT", headers: owner, body: rules(w) }); if (r.status !== 200) throw new Error("rules " + r.status); }
function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
const T = ymd(new Date());
function seed() {
  return { borluulalt: {
    users: { sup001: { name: "Ахлах", role: "supervisor", pin: "4321" }, acc001: { name: "Нягтлан Б", role: "accountant", pin: "9999" },
      emp001: { name: "Бат", role: "employee", pin: "1111" }, emp002: { name: "Саран", role: "employee", pin: "2222" } },
    products: [{ id: 1, name: "Боргио", price: 3500, stock: 50 }, { id: 2, name: "Cass", price: 4000, stock: 12 }],
    wines: [{ id: 101, name: "Sangria", price: 5000, cat: "ulaan", stock: 7 }],
    submissions: [{ id: "s_old", employeeId: "emp002", employeeName: "Саран", date: T, shift: "Орой", location: "VIP", kind: "bar", sheet: "bar",
      items: [{ id: 1, name: "Боргио", price: 3500, prev: 10, next: 5, sold: 5, income: 17500 }], cashAmount: 17500, cardTotal: 0, calcTotal: 17500, collected: 17500, diff: 0, submittedAt: new Date(Date.now() - 3600e3).toISOString() }],
    inbox: {}, rosters: { r1: { name: "R1", start: T, end: T } }, payments: { p0: { paid: true, amount: 1 } }, updatedAt: new Date().toISOString(),
  } };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser, errs, blocked) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1200, height: 1000 });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    const u = r.url();
    if (u.startsWith("http://127.0.0.1:")) return r.continue();
    const m = /gstatic\.com\/firebasejs\/[^/]+\/(firebase-[a-z]+-compat\.js)/.exec(u);
    if (m) { let body = fs.readFileSync(SDK + m[1], "utf8"); if (m[1] === "firebase-app-compat.js") body += EMU_PATCH; return r.respond({ status: 200, contentType: "application/javascript", body }); }
    blocked.push(u); return r.abort();
  });
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text().slice(0, 200)); });
  page.on("dialog", (d) => d.accept());
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load" });
  await wait(2500);
  return { page, ctx };
}
async function login(page, id, pin) {
  await page.evaluate((id, pin) => { document.getElementById("loginId").value = id; document.getElementById("loginPin").value = pin; }, id, pin);
  await page.evaluate(() => doLogin());
  await wait(3500);
  return page.evaluate(() => ({ user: window.currentUser && { id: currentUser.id, role: currentUser.role }, alert: (document.getElementById("loginAlert") || {}).innerText || "",
    app: !document.getElementById("appSection").classList.contains("hidden"),
    fb: (function () { var u = firebase.auth().currentUser; return u ? (u.isAnonymous ? "anonymous" : "token:" + u.uid) : "none"; })(),
    mode: window._secMode && window._secMode(), fallback: !!window._secFallback }));
}
async function empSubmit(page) {
  return page.evaluate(async () => {
    var loc = document.getElementById("locationName"); if (loc) { loc.value = "VIP"; if (window.onLocationChange) onLocationChange(); }
    var p = document.querySelector("[id^=prev_]"); var id = p.id.slice(5); p.value = 8; document.getElementById("next_" + id).value = 3; document.getElementById("sold_" + id).value = 5; if (window.calcIncome) calcIncome(Number(id));
    document.getElementById("cashAmount").value = 17000; if (window.updateRecon) updateRecon();
    await saveSubmission(); await new Promise((r) => setTimeout(r, 2500));
    return document.getElementById("empAlert").innerText;
  });
}
async function logout(page) { await page.evaluate(() => doLogout()); await wait(800); return page.evaluate(() => { var u = firebase.auth().currentUser; return u ? (u.isAnonymous ? "anonymous" : "token") : "none"; }); }

(async () => {
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", headless: "new",
    args: ["--no-sandbox", '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
  const out = {}, errs = [], blocked = [];
  const scen = process.argv[2] || "all";
  try {
    /* ---------- A: secure mode + strict rules (before strip: plain PINs still in users) ---------- */
    if (scen === "all" || scen === "secure") {
      await fetch(`http://127.0.0.1:9499/emulator/v1/projects/demo-borluulalt/accounts`, { method: "DELETE" });
      await dbPut("", seed()); await setRules("strict"); process.env.LOGIN_MODE = "secure"; API_DOWN = false;
      const { page, ctx } = await newPage(browser, errs, blocked);
      const A = out.secure = {};
      A.preLogin = await page.evaluate(() => ({ mode: _secMode(), fb: firebase.auth().currentUser ? (firebase.auth().currentUser.isAnonymous ? "anonymous" : "token") : "none" }));
      A.badPin = await login(page, "emp001", "0000");
      A.empLogin = await login(page, "emp001", "1111");
      A.empProducts = await page.evaluate(() => document.querySelectorAll("[id^=prev_]").length);
      A.empSubmit = await empSubmit(page);
      A.inboxAfter = Object.values((await dbGet("borluulalt/inbox")) || {}).map((s) => s.employeeId + "@" + s.location);
      A.empLogout = await logout(page);
      A.supLogin = await login(page, "sup001", "4321");
      A.supSeesInbox = await page.evaluate(() => (getSubs() || []).map((s) => s.employeeId + ":" + (s.location || "")).sort());
      A.supPush = await page.evaluate(async () => { const ok = await cloudPush(); return ok; });
      const sb = await dbGet("borluulalt/submissions"); A.dbSubmissions = (Array.isArray(sb) ? sb : Object.values(sb || {})).map((s) => s.employeeId).sort();
      A.metaAfterPush = Object.keys((await dbGet("borluulalt/_meta")) || {}).sort();
      A.supAddUserBlocked = await page.evaluate(async () => { document.getElementById("newUserId").value = "x1"; document.getElementById("newUserName").value = "X"; await addUser(); return document.getElementById("userAlert").innerText; });
      A.supRefresh = await page.evaluate(async () => { await refreshData(); return !!window._lastDelta; });
      await logout(page);
      A.accLogin = await login(page, "acc001", "9999");
      await page.evaluate(() => showAcctTab("users")); await wait(1500);
      A.accNote = await page.evaluate(() => document.getElementById("auSecNote").innerText);
      A.accPinCells = await page.evaluate(() => [...document.querySelectorAll("#auBody tr[data-uid]")].map((r) => r.getAttribute("data-uid") + "=" + r.querySelector(".au-pin").value + "|" + r.querySelector(".au-pin").placeholder));
      const msg = () => page.evaluate(() => document.getElementById("auAlert").innerText);
      await page.evaluate(() => { auNewId.value = "emp010"; auNewName.value = "Тест"; auNewRole.value = "employee"; auNewPin.value = "123"; }); await page.evaluate(() => acctAddUser()); await wait(600);
      A.addShortPin = await msg();
      await page.evaluate(() => { auNewPin.value = "4567"; }); await page.evaluate(() => acctAddUser()); await wait(1500);
      A.addUser = await msg();
      A.db_emp010 = await dbGet("borluulalt/users/emp010");
      A.hash_emp010 = !!(await dbGet("borluulalt_secret/pins/emp010"));
      const edit = async (id, pin) => { await page.evaluate((id, pin) => { const tr = document.querySelector('#auBody tr[data-uid="' + id + '"]'); tr.querySelector(".au-pin").value = pin; }, id, pin); await page.evaluate((id) => acctSaveUser(id), id); await wait(1500); return msg(); };
      A.editKeepPin = await edit("emp002", "");
      A.db_emp002 = await dbGet("borluulalt/users/emp002");
      A.editNewPin = await edit("emp001", "7777");
      A.db_emp001 = await dbGet("borluulalt/users/emp001");
      A.delUser = await page.evaluate(async () => { await acctDeleteUser("emp010"); return document.getElementById("auAlert").innerText; }); await wait(800);
      A.hash_emp010_after = await dbGet("borluulalt_secret/pins/emp010");
      A.accPayments = await page.evaluate(async () => { try { await firebase.database().ref("borluulalt/payments/e2e").set({ paid: true, amount: 5 }); return "ok"; } catch (e) { return "denied"; } });
      A.accProducts = await page.evaluate(async () => { try { await firebase.database().ref("borluulalt/products/0/price").set(1); return "ok"; } catch (e) { return "denied"; } });
      await logout(page);
      A.emp001OldPin = await login(page, "emp001", "1111");
      A.emp001NewPin = await login(page, "emp001", "7777");
      A.emp002StillWorks = (await logout(page), await login(page, "emp002", "2222"));
      A.empReadSecret = await page.evaluate(async () => { try { await window._realDb().ref("borluulalt_secret").once("value"); return "read"; } catch (e) { return "denied"; } });
      await logout(page);
      /* anonymous / forced legacy client gets nothing under strict rules */
      A.forcedLegacy = await page.evaluate(async () => { localStorage.setItem("sec_mode", "legacy"); try { await firebase.auth().signInAnonymously(); const s = await window._realDb().ref("borluulalt/users").once("value"); return "read " + Object.keys(s.val() || {}).length; } catch (e) { return "denied: " + (e.code || e.message); } finally { localStorage.removeItem("sec_mode"); await firebase.auth().signOut(); } });
      A.apiDown = (API_DOWN = true, await login(page, "emp002", "2222")); API_DOWN = false;
      await ctx.close();
    }
    /* ---------- B: transition mode + transition rules ---------- */
    if (scen === "all" || scen === "transition") {
      await dbPut("", seed()); await setRules("transition"); process.env.LOGIN_MODE = "transition"; API_DOWN = false;
      const { page, ctx } = await newPage(browser, errs, blocked);
      const B = out.transition = {};
      B.empLogin = await login(page, "emp001", "1111");
      B.lazyHash = !!(await dbGet("borluulalt_secret/pins/emp001"));
      B.empSubmit = await empSubmit(page);
      await logout(page);
      B.badPin = await login(page, "emp001", "9");
      API_DOWN = true;
      B.fallbackLogin = await login(page, "emp002", "2222");
      B.fallbackSubmit = await empSubmit(page);
      B.fallbackBadPin = (await logout(page), await login(page, "emp002", "0"));
      API_DOWN = false;
      B.inbox = Object.values((await dbGet("borluulalt/inbox")) || {}).map((s) => s.employeeId).sort();
      await dbPut("borluulalt/users/sup002", { name: "Шинэ ахлах", role: "supervisor" }); await dbPut("borluulalt/_meta/users", "t" + Date.now());   // staff without PIN -> pin-not-set -> old login
      B.staffNoPin = await login(page, "sup002", "");
      await ctx.close();
    }
    /* ---------- C: server not configured -> legacy (today's behaviour) ---------- */
    if (scen === "all" || scen === "legacy") {
      await dbPut("", seed()); await setRules("transition"); process.env.LOGIN_MODE = "secure";
      const saved = process.env.FIREBASE_DATABASE_URL; delete process.env.FIREBASE_DATABASE_URL;   // /api/config -> legacy
      const { page, ctx } = await newPage(browser, errs, blocked);
      process.env.FIREBASE_DATABASE_URL = saved;
      const C = out.legacy = {};
      C.mode = await page.evaluate(() => _secMode());
      C.empLogin = await login(page, "emp001", "1111");
      C.empSubmit = await empSubmit(page);
      await logout(page);
      C.supLogin = await login(page, "sup001", "4321");
      C.supPush = await page.evaluate(() => cloudPush());
      await ctx.close();
    }
  } finally {
    console.log(JSON.stringify(out, null, 1));
    console.log("BLOCKED (non-local requests)", JSON.stringify([...new Set(blocked)].slice(0, 10)));
    console.log("ERRORS", JSON.stringify([...new Set(errs)].slice(0, 30), null, 1));
    await browser.close(); server.close();
    process.exit(0);   // firebase-admin keeps a connection open
  }
})().catch((e) => { console.error(e); process.exit(1); });
