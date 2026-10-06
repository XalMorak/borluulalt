/* Rules tests. Needs the emulators running:
     firebase emulators:start --only database,auth --project demo-borluulalt
   with database on 127.0.0.1:9400 (override with DB_EMU=host:port). */
"use strict";
const test = require("node:test");
const fs = require("fs");
const path = require("path");
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const { ref, get, set, update, remove, query, orderByChild, startAt } = require("firebase/database");

const [HOST, PORT] = (process.env.DB_EMU || "127.0.0.1:9400").split(":");
const RULES = (f) => fs.readFileSync(path.join(__dirname, "../../security", f), "utf8");
const T = new Date().toISOString();

const SEED = { borluulalt: {
  users: {
    sup1: { name: "Ахлах", role: "supervisor" }, acc1: { name: "Нягтлан", role: "accountant" },
    emp1: { name: "Бат", role: "employee" }, emp2: { name: "Саран", role: "employee" },
    dis1: { name: "Хуучин", role: "employee", disabled: true },
  },
  products: [{ id: 1, name: "Боргио", price: 3500 }], wines: [{ id: 101, name: "Sangria" }],
  submissions: [{ id: "s0", employeeId: "emp1" }], logs: [{ at: T, user: "sup1" }],
  inbox: { s_emp2: { id: "s_emp2", employeeId: "emp2", submittedAt: T } },
  deleted: { t1: { id: "x", at: T } }, rosters: { r1: { name: "R", start: "2026-10-01", end: "2026-10-14" } },
  payments: { p1: { paid: true, amount: 1 } }, _meta: { users: "a" }, updatedAt: T,
}, borluulalt_secret: { pins: { emp1: "s1$x$y" } } };

let env;
function as(uid, claims) { return env.authenticatedContext(uid, claims === undefined ? { eid: uid, role: "employee" } : claims).database(); }

async function suite(rulesFile, fn) {
  env = await initializeTestEnvironment({ projectId: "demo-borluulalt", database: { host: HOST, port: Number(PORT), rules: RULES(rulesFile) } });
  try { await fn(); } finally { await env.cleanup(); }
}
async function reseed() {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (c) => { await set(ref(c.database(), "/"), SEED); });
}

test("strict rules", async (t) => {
  await suite("database.rules.strict.json", async () => {
    await reseed();
    const anon = env.authenticatedContext("anonUid", { firebase: { sign_in_provider: "anonymous" } }).database();
    const none = env.unauthenticatedContext().database();
    const emp = as("emp1"), emp2 = as("emp2"), sup = as("sup1", { eid: "sup1", role: "supervisor" }), acc = as("acc1", { eid: "acc1", role: "accountant" });

    await t.test("no access without our custom token", async () => {
      await assertFails(get(ref(none, "borluulalt/products")));
      await assertFails(get(ref(anon, "borluulalt/products")));
      await assertFails(get(ref(anon, "borluulalt/users")));
      await assertFails(set(ref(anon, "borluulalt/inbox/x"), { employeeId: "anonUid", submittedAt: T }));
      await assertFails(get(ref(as("ghost"), "borluulalt/products")));                 // unknown user
      await assertFails(get(ref(as("dis1"), "borluulalt/products")));                  // disabled user
      await assertFails(get(ref(as("emp1", { eid: "sup1" }), "borluulalt/products"))); // eid != uid
    });

    await t.test("employee reads what delta sync needs, nothing more", async () => {
      for (const p of ["users", "products", "wines", "inbox", "deleted", "_meta", "updatedAt"]) await assertSucceeds(get(ref(emp, "borluulalt/" + p)));
      await assertSucceeds(get(query(ref(emp, "borluulalt/inbox"), orderByChild("submittedAt"), startAt(T))));
      await assertSucceeds(get(query(ref(emp, "borluulalt/deleted"), orderByChild("at"), startAt(T))));
      for (const p of ["submissions", "logs", "payments", "rosters"]) await assertFails(get(ref(emp, "borluulalt/" + p)));
      await assertFails(get(ref(emp, "borluulalt")));
      await assertFails(get(ref(emp, "borluulalt_secret/pins")));
    });

    await t.test("employee writes only own inbox entries", async () => {
      await assertSucceeds(set(ref(emp, "borluulalt/inbox/s_emp1"), { id: "s_emp1", employeeId: "emp1", submittedAt: T }));
      await assertSucceeds(set(ref(emp, "borluulalt/inbox/s_emp1"), { id: "s_emp1", employeeId: "emp1", submittedAt: T, collected: 5 }));
      await assertFails(set(ref(emp, "borluulalt/inbox/s_fake"), { employeeId: "emp2", submittedAt: T }));   // as someone else
      await assertFails(set(ref(emp, "borluulalt/inbox/s_emp2"), { employeeId: "emp1", submittedAt: T }));   // overwrite other's
      await assertFails(remove(ref(emp, "borluulalt/inbox/s_emp1")));                                         // delete
      await assertFails(set(ref(emp, "borluulalt/inbox/s_bad"), { employeeId: "emp1" }));                    // no submittedAt
      await assertFails(set(ref(emp, "borluulalt/products/0/price"), 1));
      await assertFails(update(ref(emp, "borluulalt/users/emp1"), { role: "supervisor" }));                  // self-promotion
      await assertFails(set(ref(emp, "borluulalt/deleted/t2"), { at: T }));
      await assertFails(set(ref(emp, "borluulalt/_meta/users"), "x"));
      await assertFails(set(ref(emp, "borluulalt_secret/pins/emp1"), "x"));
      await assertFails(set(ref(emp, "borluulalt"), {}));
    });

    await t.test("forged role claim does not help (role comes from the database)", async () => {
      const forged = as("emp1", { eid: "emp1", role: "supervisor" });
      await assertFails(set(ref(forged, "borluulalt/products"), []));
      await assertFails(get(ref(forged, "borluulalt/submissions")));
    });

    await t.test("supervisor: push, sticky delete; no users/payments/rosters writes", async () => {
      for (const p of ["submissions", "logs", "rosters", "payments", "users", "inbox"]) await assertSucceeds(get(ref(sup, "borluulalt/" + p)));
      await assertSucceeds(update(ref(sup, "borluulalt"), { submissions: [{ id: "s1" }], updatedAt: T, products: [{ id: 1, name: "B", price: 1 }], wines: [{ id: 101, name: "W" }], logs: [], "_meta/submissions": "t", "_meta/updatedAt": T }));
      await assertSucceeds(set(ref(sup, "borluulalt/deleted/t_x"), { id: "s_emp2", at: T }));
      await assertSucceeds(remove(ref(sup, "borluulalt/inbox/s_emp2")));
      await assertFails(update(ref(sup, "borluulalt/users/emp1"), { name: "X", role: "employee" }));
      await assertFails(set(ref(sup, "borluulalt/payments/p2"), { paid: true }));
      await assertFails(set(ref(sup, "borluulalt/rosters/r2"), { name: "R" }));
      await assertFails(set(ref(sup, "borluulalt/inbox/s_sup1"), { employeeId: "sup1", submittedAt: T }));
      await assertFails(set(ref(sup, "borluulalt"), {}));
      await assertFails(get(ref(sup, "borluulalt_secret")));
      await assertFails(set(ref(sup, "borluulalt/newnode"), 1));
    });

    await t.test("accountant: users (no pin), rosters, payments; not stock/submissions", async () => {
      await reseed();
      for (const p of ["users", "submissions", "inbox", "deleted", "payments", "rosters", "products", "wines"]) await assertSucceeds(get(ref(acc, "borluulalt/" + p)));
      await assertSucceeds(update(ref(acc, "borluulalt/users"), { emp9: { name: "Шинэ", role: "employee", pinSet: true } }));
      await assertSucceeds(update(ref(acc, "borluulalt/_meta"), { users: "tok" }));
      await assertFails(update(ref(acc, "borluulalt/users"), { emp8: { name: "PIN-тэй", role: "employee", pin: "1234" } }));
      await assertFails(update(ref(acc, "borluulalt/users"), { emp8: { name: "Bad", role: "admin" } }));
      await assertFails(update(ref(acc, "borluulalt/users"), { emp8: { role: "employee" } }));
      await assertSucceeds(update(ref(acc, "borluulalt/users"), { emp9: null }));
      await assertSucceeds(set(ref(acc, "borluulalt/payments/p2"), { paid: true, amount: 5 }));
      await assertSucceeds(set(ref(acc, "borluulalt/rosters/r2"), { name: "R2" }));
      await assertFails(set(ref(acc, "borluulalt/products"), []));
      await assertFails(set(ref(acc, "borluulalt/submissions"), []));
      await assertFails(set(ref(acc, "borluulalt/inbox/s_acc1"), { employeeId: "acc1", submittedAt: T }));
      await assertFails(get(ref(acc, "borluulalt_secret/pins")));
    });

    await t.test("deleted user loses access immediately", async () => {
      await assertSucceeds(get(ref(emp2, "borluulalt/products")));
      await env.withSecurityRulesDisabled(async (c) => { await remove(ref(c.database(), "borluulalt/users/emp2")); });
      await assertFails(get(ref(emp2, "borluulalt/products")));
    });
  });
});

test("transition rules", async (t) => {
  await suite("database.rules.transition.json", async () => {
    await reseed();
    const anon = env.authenticatedContext("anonUid", { firebase: { sign_in_provider: "anonymous" } }).database();
    const none = env.unauthenticatedContext().database();
    await t.test("anonymous (legacy app) keeps today's access", async () => {
      await assertSucceeds(get(ref(anon, "borluulalt")));
      await assertSucceeds(update(ref(anon, "borluulalt"), { submissions: [], updatedAt: T, "_meta/submissions": "t" }));
      await assertSucceeds(set(ref(anon, "borluulalt/inbox/s1"), { employeeId: "emp1", submittedAt: T }));
      await assertSucceeds(set(ref(anon, "borluulalt/users/emp5"), { name: "A", role: "employee", pin: "1111" }));
      await assertSucceeds(get(query(ref(anon, "borluulalt/inbox"), orderByChild("submittedAt"), startAt(T))));
    });
    await t.test("but no whole-node overwrite, no secret, no unauthenticated", async () => {
      await assertFails(set(ref(anon, "borluulalt"), { users: {} }));
      await assertFails(get(ref(anon, "borluulalt_secret")));
      await assertFails(set(ref(anon, "borluulalt_secret/pins/emp1"), "x"));
      await assertFails(get(ref(none, "borluulalt")));
    });
    await t.test("custom-token users work too", async () => {
      await assertSucceeds(get(ref(as("emp1"), "borluulalt/products")));
      await assertSucceeds(set(ref(as("emp1"), "borluulalt/inbox/s2"), { employeeId: "emp1", submittedAt: T }));
    });
  });
});
