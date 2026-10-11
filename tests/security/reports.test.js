/* Bug reports: strict + transition rules for borluulalt/reports, and api/reports.js auth.
   Emulators only (refuses to run without emulator hosts). */
"use strict";
const DB_EMU = process.env.DB_EMU || "127.0.0.1:9400";
const NS = "demo-borluulalt-reports";
Object.assign(process.env, { FIREBASE_DATABASE_EMULATOR_HOST: DB_EMU, FIREBASE_AUTH_EMULATOR_HOST: process.env.AUTH_EMU || "127.0.0.1:9499",
  FIREBASE_DATABASE_URL: `https://${NS}.firebaseio.com`, FIREBASE_PROJECT_ID: "demo-borluulalt" });
delete process.env.FIREBASE_SERVICE_ACCOUNT;
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const { ref, get, set, update, remove, push } = require("firebase/database");
const [HOST, PORT] = DB_EMU.split(":");
const RULES = (f) => fs.readFileSync(path.join(__dirname, "../../security", f), "utf8");
const T = new Date().toISOString();
const USERS = { sup1: { name: "Ахлах", role: "supervisor" }, acc1: { name: "Нягтлан", role: "accountant" }, emp1: { name: "Бат", role: "employee" }, dis1: { name: "Хуучин", role: "employee", disabled: true } };
const rep = (by, x) => Object.assign({ at: T, by, role: "employee", kind: "user", category: "Илгээлт", text: "Илгээх дарахад алдаа", ctx: { tab: "Илгээлт", ver: "abc1234", online: true, errors: "[]" }, status: "new" }, x || {});

async function withRules(file, fn) {
  const env = await initializeTestEnvironment({ projectId: "demo-borluulalt", database: { host: HOST, port: Number(PORT), rules: RULES(file) } });
  try {
    await env.clearDatabase();
    await env.withSecurityRulesDisabled(async (c) => { await set(ref(c.database(), "/"), { borluulalt: { users: USERS, reports: { r0: rep("emp1") } } }); });
    await fn(env);
  } finally { await env.cleanup(); }
}
const as = (env, uid) => env.authenticatedContext(uid, { eid: uid }).database();

test("strict rules: reports", async () => {
  await withRules("database.rules.strict.json", async (env) => {
    const emp = as(env, "emp1"), sup = as(env, "sup1"), acc = as(env, "acc1"), dis = as(env, "dis1");
    const anon = env.authenticatedContext("anonX", { firebase: { sign_in_provider: "anonymous" } }).database(), none = env.unauthenticatedContext().database();
    await assertSucceeds(set(push(ref(emp, "borluulalt/reports")), rep("emp1")));                                  // employee creates
    await assertSucceeds(set(push(ref(sup, "borluulalt/reports")), rep("sup1", { role: "supervisor", kind: "auto" })));
    await assertSucceeds(set(push(ref(acc, "borluulalt/reports")), rep("acc1", { role: "accountant", shot: "data:image/jpeg;base64,AAAA" })));
    await assertFails(set(push(ref(emp, "borluulalt/reports")), rep("sup1")));                                      // by must be own uid
    await assertFails(set(ref(emp, "borluulalt/reports/r0"), rep("emp1", { text: "overwrite" })));                 // no overwrite
    await assertFails(remove(ref(emp, "borluulalt/reports/r0")));
    await assertFails(set(push(ref(emp, "borluulalt/reports")), rep("emp1", { status: "fixed" })));                // must start "new"
    await assertFails(set(push(ref(emp, "borluulalt/reports")), rep("emp1", { text: "x".repeat(2001) })));         // size
    await assertFails(set(push(ref(emp, "borluulalt/reports")), rep("emp1", { text: "" })));
    await assertFails(set(push(ref(emp, "borluulalt/reports")), rep("emp1", { kind: "admin" })));
    await assertFails(set(push(ref(emp, "borluulalt/reports")), rep("emp1", { pin: "1234" })));                    // unknown field
    await assertFails(set(push(ref(emp, "borluulalt/reports")), rep("emp1", { shot: "javascript:alert(1)" })));
    await assertFails(set(push(ref(emp, "borluulalt/reports")), rep("emp1", { ctx: { errors: "e".repeat(8001) } })));
    await assertFails(set(push(ref(dis, "borluulalt/reports")), rep("dis1")));                                     // disabled user
    await assertFails(set(push(ref(anon, "borluulalt/reports")), rep("anonX")));                                   // anonymous
    await assertFails(set(push(ref(none, "borluulalt/reports")), rep("x")));
    for (const db of [emp, sup, anon, none]) { await assertFails(get(ref(db, "borluulalt/reports"))); await assertFails(get(ref(db, "borluulalt/reports/r0"))); }
    await assertSucceeds(get(ref(acc, "borluulalt/reports")));                                                     // only accountant reads
    await assertFails(update(ref(sup, "borluulalt/reports/r0"), { status: "fixed" }));                             // only accountant updates
    await assertFails(update(ref(emp, "borluulalt/reports/r0"), { status: "fixed" }));
    await assertSucceeds(update(ref(acc, "borluulalt/reports/r0"), { status: "fixing", statusAt: T, statusBy: "acc1" }));
    await assertFails(update(ref(acc, "borluulalt/reports/r0"), { status: "done" }));
    await assertFails(remove(ref(acc, "borluulalt/reports/r0")));                                                  // no deletes
  });
});

test("transition rules: reports", async () => {
  await withRules("database.rules.transition.json", async (env) => {
    const anon = env.authenticatedContext("anonX", { firebase: { sign_in_provider: "anonymous" } }).database(), none = env.unauthenticatedContext().database();
    await assertSucceeds(set(push(ref(anon, "borluulalt/reports")), rep("emp1")));
    await assertFails(set(ref(anon, "borluulalt/reports/r0"), rep("emp1", { text: "overwrite" })));
    await assertFails(remove(ref(anon, "borluulalt/reports/r0")));
    await assertSucceeds(update(ref(anon, "borluulalt/reports/r0"), { status: "fixed" }));                         // status only
    await assertFails(set(push(ref(anon, "borluulalt/reports")), rep("emp1", { status: "fixed" })));
    await assertFails(set(push(ref(anon, "borluulalt/reports")), rep("emp1", { text: "x".repeat(2001) })));
    await assertFails(set(push(ref(none, "borluulalt/reports")), rep("emp1")));
    await assertFails(get(ref(none, "borluulalt/reports")));
  });
});

/* ---------- api/reports.js ---------- */
function call(handler, { method = "GET", url = "/api/reports", body, headers = {} } = {}) {
  return new Promise((resolve) => {
    const req = { method, url, body, headers };
    const res = { statusCode: 200, setHeader() {}, end(t) { resolve({ status: this.statusCode, body: JSON.parse(t) }); } };
    Promise.resolve(handler(req, res)).catch((e) => resolve({ status: 0, error: e }));
  });
}
test("api/reports: token auth, list, set status", async () => {
  const api = require("../../api/reports");
  const { getAdmin } = require("../../api/_lib/fb");
  const A = getAdmin(), db = A.admin.database();
  try {
    await db.ref().set({ borluulalt: { reports: { a1: rep("emp1"), a2: rep("sup1", { status: "fixed", at: "2026-01-01T00:00:00Z" }), a3: rep("emp1", { shot: "data:image/jpeg;base64," + "A".repeat(5000) }) } } });
    delete process.env.REPORTS_TOKEN;
    assert.equal((await call(api, { headers: { "x-reports-token": "x" } })).status, 503, "no env -> 503");
    process.env.REPORTS_TOKEN = "t".repeat(32);
    assert.equal((await call(api)).status, 401, "no header");
    assert.equal((await call(api, { headers: { "x-reports-token": "wrong" } })).status, 401, "wrong token");
    assert.equal((await call(api, { headers: { "x-reports-token": "t".repeat(31) } })).status, 401, "prefix");
    const H = { "x-reports-token": "t".repeat(32) };
    const r = await call(api, { url: "/api/reports?status=new", headers: H });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.reports.map((x) => x.id).sort(), ["a1", "a3"]);
    assert.match(r.body.reports.find((x) => x.id === "a3").shot, /KB, use shots=1/);
    const full = await call(api, { url: "/api/reports?status=new&shots=1", headers: H });
    assert.match(full.body.reports.find((x) => x.id === "a3").shot, /^data:image/);
    assert.equal((await call(api, { url: "/api/reports?status=bogus", headers: H })).status, 400);
    assert.equal((await call(api, { method: "POST", headers: H, body: { id: "a1", status: "nope" } })).status, 400);
    assert.equal((await call(api, { method: "POST", headers: H, body: { id: "zz", status: "fixed" } })).status, 404);
    assert.equal((await call(api, { method: "POST", headers: { "x-reports-token": "bad" }, body: { id: "a1", status: "fixed" } })).status, 401);
    assert.equal((await call(api, { method: "POST", headers: H, body: { id: "a1", status: "fixed", note: "fixed in PR #12" } })).status, 200);
    const a1 = (await db.ref("borluulalt/reports/a1").once("value")).val();
    assert.equal(a1.status, "fixed"); assert.equal(a1.statusBy, "assistant"); assert.equal(a1.fixNote, "fixed in PR #12"); assert.equal(a1.text, rep("emp1").text);
    assert.equal((await call(api, { method: "DELETE", headers: H })).status, 405);
  } finally { delete process.env.REPORTS_TOKEN; await A.app.delete(); }
});
