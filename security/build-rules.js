/* Generates database.rules.transition.json and database.rules.strict.json.
   Run: node security/build-rules.js
   Only the "borluulalt" and "borluulalt_secret" keys are produced. Paste them
   into the console rules NEXT TO the existing keys of other apps (e.g. "eahs")
   — or use scripts/merge-rules.js to do that safely. */
"use strict";
const fs = require("fs");
const path = require("path");

const U = "root.child('borluulalt/users/'+auth.uid)";
/* signed in with OUR custom token (anonymous tokens have no eid), user exists and is not disabled */
const ACTIVE = `auth != null && auth.token.eid === auth.uid && ${U}.child('name').exists() && ${U}.child('disabled').val() !== true`;
/* role is read from the database (authoritative, changes apply immediately), not from the token */
const role = (...rs) => `(${ACTIVE} && (${rs.map((r) => `${U}.child('role').val() === '${r}'`).join(" || ")}))`;
const ACT = `(${ACTIVE})`, SUP = role("supervisor"), ACC = role("accountant"), SA = role("supervisor", "accountant");
const EMP = role("employee");
const SUP_ADD = `(${SUP} && !data.exists() && newData.child('role').val() === 'employee' && newData.child('disabled').val() === true && newData.child('pending').val() === true && !newData.hasChild('pin') && !newData.hasChild('pinSet'))`;
const EMP_OWN = `(${EMP} && newData.exists() && newData.child('employeeId').val() === auth.uid && (!data.exists() || data.child('employeeId').val() === auth.uid))`;

const strict = { rules: {
  borluulalt: {
    /* _meta/inbox is a "something in the inbox changed" marker: employees bump it after a save
       (keep_sync.js), supervisors after an edit (edit_clear.js / dedupe_edit.js) */
    _meta: { ".read": ACT, inbox: { ".write": ACT, ".validate": "newData.isString() && newData.val().length <= 64" }, $n: { ".write": SA } },
    updatedAt: { ".read": ACT, ".write": SUP },
    /* accountant: full control. supervisor: may only CREATE a new, pending, disabled employee
       without any PIN (sup_users.js); never edit, delete, enable or promote anyone. */
    users: { ".read": ACT, $uid: { ".write": `${ACC} || ${SUP_ADD}`,
      ".validate": "!newData.exists() || (newData.child('name').isString() && newData.child('name').val().length > 0 && newData.child('name').val().length <= 80 && newData.child('role').isString() && newData.child('role').val().matches(/^(employee|supervisor|accountant)$/) && !newData.hasChild('pin'))" } },
    products: { ".read": ACT, ".write": SUP },
    wines: { ".read": ACT, ".write": SUP },
    submissions: { ".read": SA, ".write": SUP },
    logs: { ".read": SA, ".write": SUP },
    /* employees create/update their own entries; the supervisor edits them (edit_clear.js /
       dedupe_edit.js) and removes merged ones (sync_stable) */
    inbox: { ".read": ACT, ".indexOn": ["submittedAt"], $sid: { ".write": `${SUP} || ${EMP_OWN}`,
      ".validate": "!newData.exists() || (newData.child('employeeId').isString() && newData.child('submittedAt').isString())" } },
    deleted: { ".read": ACT, ".indexOn": ["at"], $k: { ".write": SUP } },
    /* server-side stock deduction ledger (stock_ledger.js), written by supervisors only */
    stockLedger: { ".read": SA, ".indexOn": ["at"], $k: { ".write": SUP } },
    rosters: { ".read": SA, $id: { ".write": ACC } },
    payments: { ".read": SA, $k: { ".write": ACC } },
    $other: { ".read": SA, ".write": false },
  },
  borluulalt_secret: { ".read": false, ".write": false },
} };

const A = "auth != null";
const tb = { ".read": A };
["_meta", "updatedAt", "users", "products", "wines", "submissions", "logs", "rosters", "payments"].forEach((n) => { tb[n] = { ".write": A }; });
tb.inbox = { ".write": A, ".indexOn": ["submittedAt"] };
tb.deleted = { ".write": A, ".indexOn": ["at"] };
tb.stockLedger = { ".write": A, ".indexOn": ["at"] };
tb.$other = { ".write": A };
/* same access as today (auth != null) except: whole-node set() of borluulalt is refused,
   PIN hashes are server-only, and the delta-sync indexes exist */
const transition = { rules: { borluulalt: tb, borluulalt_secret: { ".read": false, ".write": false } } };

const dir = __dirname;
fs.writeFileSync(path.join(dir, "database.rules.strict.json"), JSON.stringify(strict, null, 2) + "\n");
fs.writeFileSync(path.join(dir, "database.rules.transition.json"), JSON.stringify(transition, null, 2) + "\n");
console.log("wrote security/database.rules.{transition,strict}.json");
