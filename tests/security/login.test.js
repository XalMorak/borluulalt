/* Tests for api/login.js, api/pin.js, api/config.js against the local emulators,
   ending with a browser-SDK sign-in that is checked by the strict rules.
   Never points at production: refuses to run without emulator hosts. */
"use strict";
const DB_EMU = process.env.DB_EMU || "127.0.0.1:9400", AUTH_EMU = process.env.AUTH_EMU || "127.0.0.1:9499";
const NS = "demo-borluulalt-login";
Object.assign(process.env, {
  FIREBASE_DATABASE_EMULATOR_HOST: DB_EMU, FIREBASE_AUTH_EMULATOR_HOST: AUTH_EMU,
  FIREBASE_DATABASE_URL: `https://${NS}.firebaseio.com`, FIREBASE_PROJECT_ID: "demo-borluulalt",
  REQUIRE_PIN: "staff", LOGIN_MODE: "transition", PIN_PEPPER: "test-pepper",
});
delete process.env.FIREBASE_SERVICE_ACCOUNT;

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const login = require("../../api/login");
const pinApi = require("../../api/pin");
const config = require("../../api/config");
const { getAdmin } = require("../../api/_lib/fb");
const { verifyPin } = require("../../api/_lib/pinhash");

function call(handler, { method = "POST", body = {}, headers = {}, ip = "10.0.0.1" } = {}) {
  return new Promise((resolve) => {
    const req = { method, body, headers: Object.assign({ "x-forwarded-for": ip }, headers) };
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      end(txt) { resolve({ status: this.statusCode, body: JSON.parse(txt), headers: this.headers }); } };
    Promise.resolve(handler(req, res)).catch((e) => resolve({ status: 0, error: e }));
  });
}

const SEED = { borluulalt: {
  users: {
    sup1: { name: "Ахлах", role: "supervisor", pin: "4321" },
    acc1: { name: "Нягтлан", role: "accountant", pin: "9999" },
    emp1: { name: "Бат", role: "employee", pin: "1111" },
    emp2: { name: "Саран", role: "employee" },                // no PIN (allowed for employees with REQUIRE_PIN=staff)
    Emp3: { name: "Дорж", role: "employee", pinSet: true },   // hash only, mixed-case key
    sup2: { name: "Шинэ ахлах", role: "supervisor" },          // staff without PIN
    dis1: { name: "Хуучин", role: "employee", pin: "2222", disabled: true },
  },
  products: [{ id: 1, name: "Боргио", price: 3500 }], _meta: { users: "a" },
} };

let db, A;
test.before(async () => {
  A = getAdmin();
  db = A.admin.database();
  /* strict rules on this test namespace */
  const rules = fs.readFileSync(path.join(__dirname, "../../security/database.rules.strict.json"), "utf8");
  const r = await fetch(`http://${DB_EMU}/.settings/rules.json?ns=${NS}`, { method: "PUT", headers: { Authorization: "Bearer owner" }, body: rules });
  assert.equal(r.status, 200, "load rules");
  await fetch(`http://${AUTH_EMU}/emulator/v1/projects/demo-borluulalt/accounts`, { method: "DELETE" });
  await db.ref().set(SEED);
  const { hashPin } = require("../../api/_lib/pinhash");
  await db.ref("borluulalt_secret/pins/Emp3").set(hashPin("5555"));
});
test.after(async () => { await A.app.delete(); });

test("config", async () => {
  const r = await call(config, { method: "GET" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { mode: "transition", requirePin: "staff", configured: true });
  assert.equal(r.headers["cache-control"], "no-store");
});

test("plain-text PIN login upgrades to a hash", async () => {
  const r = await call(login, { body: { id: "EMP1", pin: "1111" } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.user, { id: "emp1", name: "Бат", role: "employee" });
  assert.ok(r.body.token.length > 20);
  const h = (await db.ref("borluulalt_secret/pins/emp1").once("value")).val();
  assert.ok(verifyPin("1111", h) && !verifyPin("1112", h));
  assert.equal((await db.ref("borluulalt/users/emp1/pinSet").once("value")).val(), true);
  assert.match((await db.ref("borluulalt/_meta/users").once("value")).val(), /^srv-/);
});

test("hash-only login (mixed-case key, case-insensitive id)", async () => {
  assert.equal((await call(login, { body: { id: "emp3", pin: "5555" } })).status, 200);
  const r = await call(login, { body: { id: "emp3", pin: "5556" } });
  assert.equal(r.status, 401);
  assert.equal(r.body.error, "ID эсвэл PIN буруу");
});

test("unknown id and wrong PIN look the same", async () => {
  const a = await call(login, { body: { id: "nobody", pin: "1" }, ip: "10.0.0.9" });
  const b = await call(login, { body: { id: "sup1", pin: "0000" }, ip: "10.0.0.9" });
  assert.equal(a.status, 401); assert.deepEqual(a.body, b.body);
});

test("PIN policy: employee without PIN ok, staff without PIN refused", async () => {
  assert.equal((await call(login, { body: { id: "emp2", pin: "" } })).status, 200);
  const r = await call(login, { body: { id: "sup2", pin: "" } });
  assert.equal(r.status, 403); assert.equal(r.body.code, "pin-not-set");
  process.env.REQUIRE_PIN = "all";
  assert.equal((await call(login, { body: { id: "emp2", pin: "" } })).body.code, "pin-not-set");
  process.env.REQUIRE_PIN = "staff";
});

test("disabled user: refused (only revealed after a correct PIN)", async () => {
  assert.equal((await call(login, { body: { id: "dis1", pin: "0000" }, ip: "10.0.0.3" })).status, 401);
  const r = await call(login, { body: { id: "dis1", pin: "2222" }, ip: "10.0.0.3" });
  assert.equal(r.status, 403); assert.equal(r.body.code, "disabled");
});

test("brute force: 5 wrong PINs lock the ID for 10 minutes", async () => {
  for (let i = 0; i < 5; i++) assert.equal((await call(login, { body: { id: "acc1", pin: "000" + i }, ip: "10.1.0." + i })).status, 401);
  const r = await call(login, { body: { id: "acc1", pin: "9999" }, ip: "10.2.0.1" });
  assert.equal(r.status, 429); assert.equal(r.body.code, "locked");
  await db.ref("borluulalt_secret/attempts/acc1").remove();   // admin unlock
  assert.equal((await call(login, { body: { id: "acc1", pin: "9999" }, ip: "10.2.0.1" })).status, 200);
});

test("brute force: 30 failures from one IP lock that IP", async () => {
  for (let i = 0; i < 30; i++) await call(login, { body: { id: "x" + i, pin: "1" }, ip: "10.9.9.9" });
  assert.equal((await call(login, { body: { id: "emp1", pin: "1111" }, ip: "10.9.9.9" })).status, 429);
  assert.equal((await call(login, { body: { id: "emp1", pin: "1111" }, ip: "10.9.9.10" })).status, 200);
});

test("bad input", async () => {
  assert.equal((await call(login, { method: "GET" })).status, 405);
  assert.equal((await call(login, { body: { id: "", pin: "1" } })).status, 400);
  assert.equal((await call(login, { body: { id: "a".repeat(65), pin: "1" } })).status, 400);
});

/* browser SDK, like the real page */
const { initializeApp, deleteApp } = require("firebase/app");
const { getAuth, connectAuthEmulator, signInWithCustomToken, signInAnonymously, signOut } = require("firebase/auth");
const { getDatabase, connectDatabaseEmulator, ref, get, set, update } = require("firebase/database");
let n = 0;
function client() {
  const app = initializeApp({ apiKey: "fake-key", projectId: "demo-borluulalt", databaseURL: `https://${NS}.firebaseio.com` }, "c" + (n++));
  const auth = getAuth(app); connectAuthEmulator(auth, "http://" + AUTH_EMU, { disableWarnings: true });
  const d = getDatabase(app); const [h, p] = DB_EMU.split(":"); connectDatabaseEmulator(d, h, Number(p));
  return { app, auth, d };
}
async function signedIn(id, pin) {
  const r = await call(login, { body: { id, pin }, ip: "10.5.5." + (n % 200) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const c = client(); await signInWithCustomToken(c.auth, r.body.token); return c;
}
const ok = (p) => p.then(() => true, () => false);

test("end-to-end: custom token -> rules", async () => {
  const emp = await signedIn("emp1", "1111");
  assert.equal(emp.auth.currentUser.uid, "emp1");
  const claims = (await emp.auth.currentUser.getIdTokenResult()).claims;
  assert.equal(claims.role, "employee"); assert.equal(claims.eid, "emp1");
  assert.ok(await ok(get(ref(emp.d, "borluulalt/products"))));
  assert.ok(await ok(set(ref(emp.d, "borluulalt/inbox/s1"), { employeeId: "emp1", submittedAt: new Date().toISOString() })));
  assert.ok(!(await ok(set(ref(emp.d, "borluulalt/inbox/s2"), { employeeId: "emp2", submittedAt: new Date().toISOString() }))));
  assert.ok(!(await ok(get(ref(emp.d, "borluulalt_secret/pins")))));

  const anon = client(); await signInAnonymously(anon.auth);
  assert.ok(!(await ok(get(ref(anon.d, "borluulalt/products")))), "anonymous blocked by strict rules");

  /* accountant sets / removes PINs through /api/pin */
  const acc = await signedIn("acc1", "9999");
  const accTok = await acc.auth.currentUser.getIdToken();
  const empTok = await emp.auth.currentUser.getIdToken();
  assert.equal((await call(pinApi, { body: { id: "emp2", pin: "7777" } })).status, 401);
  assert.equal((await call(pinApi, { body: { id: "emp2", pin: "7777" }, headers: { authorization: "Bearer " + empTok } })).status, 403);
  assert.equal((await call(pinApi, { body: { id: "emp2", pin: "12" }, headers: { authorization: "Bearer " + accTok } })).status, 400);
  assert.equal((await call(pinApi, { body: { id: "emp2", pin: "7777" }, headers: { authorization: "Bearer " + accTok } })).status, 200);
  assert.equal((await call(login, { body: { id: "emp2", pin: "" } })).status, 401, "PIN now required for emp2");
  assert.equal((await call(login, { body: { id: "emp2", pin: "7777" } })).status, 200);
  assert.equal((await db.ref("borluulalt/users/emp2/pin").once("value")).val(), null, "no plain PIN created");
  /* changing a PIN while the plain one still exists keeps both equal */
  assert.equal((await call(pinApi, { body: { id: "emp1", pin: "8888" }, headers: { authorization: "Bearer " + accTok } })).status, 200);
  assert.equal((await db.ref("borluulalt/users/emp1/pin").once("value")).val(), "8888");
  assert.equal((await call(login, { body: { id: "emp1", pin: "1111" } })).status, 401);
  assert.equal((await call(login, { body: { id: "emp1", pin: "8888" } })).status, 200);
  /* accountant can manage users but cannot write a pin field */
  assert.ok(await ok(update(ref(acc.d, "borluulalt/users"), { emp7: { name: "Шинэ", role: "employee" } })));
  assert.ok(!(await ok(update(ref(acc.d, "borluulalt/users"), { emp7: { name: "Шинэ", role: "employee", pin: "1" } }))));
  /* remove */
  assert.equal((await call(pinApi, { body: { id: "emp2", remove: true }, headers: { authorization: "Bearer " + accTok } })).status, 200);
  assert.equal((await db.ref("borluulalt_secret/pins/emp2").once("value")).val(), null);
  /* disabling a signed-in user cuts access at once (rules read the users node) */
  await db.ref("borluulalt/users/emp1/disabled").set(true);
  assert.ok(!(await ok(get(ref(emp.d, "borluulalt/products")))));
  await db.ref("borluulalt/users/emp1/disabled").remove();
  /* a disabled accountant cannot use /api/pin */
  await db.ref("borluulalt/users/acc1/disabled").set(true);
  assert.equal((await call(pinApi, { body: { id: "emp2", pin: "7777" }, headers: { authorization: "Bearer " + accTok } })).status, 403);
  await db.ref("borluulalt/users/acc1/disabled").remove();
  for (const c of [emp, anon, acc]) { await signOut(c.auth); await deleteApp(c.app); }
});

test("not configured -> config says legacy", async () => {
  const saved = process.env.FIREBASE_DATABASE_URL;
  delete process.env.FIREBASE_DATABASE_URL;
  assert.equal((await call(config, { method: "GET" })).body.mode, "legacy");
  process.env.FIREBASE_DATABASE_URL = saved;
});
