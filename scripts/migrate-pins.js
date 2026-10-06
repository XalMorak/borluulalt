#!/usr/bin/env node
/* PIN migration: plain-text borluulalt/users/<id>/pin -> scrypt hash in borluulalt_secret/pins/<id>
   Usage (dry run unless --apply):
     node scripts/migrate-pins.js status
     node scripts/migrate-pins.js copy   [--apply]   hash every plain PIN (keeps the plain one)
     node scripts/migrate-pins.js strip  [--apply]   delete plain PINs that already have a matching hash
     node scripts/migrate-pins.js generate-missing [--roles=all|staff] [--out=new-pins.csv] [--apply]
                                                    random 6-digit PIN for users with no PIN at all;
                                                    the PINs are written ONLY to the local CSV
   Env (same values as the Vercel functions — PIN_PEPPER MUST match or nobody can log in):
     FIREBASE_SERVICE_ACCOUNT  (JSON or base64; or GOOGLE_APPLICATION_CREDENTIALS=path)
     FIREBASE_DATABASE_URL, PIN_PEPPER
   Emulator: FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9400 FIREBASE_PROJECT_ID=demo-borluulalt */
"use strict";
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { hashPin, verifyPin } = require("../api/_lib/pinhash");

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (k, d) => { const a = args.find((x) => x === "--" + k || x.startsWith("--" + k + "=")); return a ? (a.includes("=") ? a.split("=").slice(1).join("=") : true) : d; };
const APPLY = !!opt("apply", false);
if (!["status", "copy", "strip", "generate-missing"].includes(cmd)) {
  console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].replace("/*", "").split("\n").slice(1).join("\n"));
  process.exit(cmd ? 1 : 0);
}

function init() {
  const admin = require("firebase-admin");
  const url = process.env.FIREBASE_DATABASE_URL;
  if (!url) throw new Error("FIREBASE_DATABASE_URL is not set");
  const emu = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  const opts = { databaseURL: url };
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    let t = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
    if (!t.startsWith("{")) t = Buffer.from(t, "base64").toString("utf8");
    const sa = JSON.parse(t); if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
    opts.credential = admin.credential.cert(sa);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    opts.credential = admin.credential.applicationDefault();
  } else if (emu) {
    opts.projectId = process.env.FIREBASE_PROJECT_ID || "demo-borluulalt";
  } else throw new Error("no credentials: set FIREBASE_SERVICE_ACCOUNT (or use the emulator)");
  admin.initializeApp(opts);
  console.log("database:", emu ? "EMULATOR " + emu + " (" + url + ")" : url);
  if (!process.env.PIN_PEPPER) console.log("note: PIN_PEPPER is empty — it must be empty on Vercel too");
  return admin;
}

(async () => {
  const admin = init();
  const db = admin.database();
  const users = (await db.ref("borluulalt/users").once("value")).val() || {};
  const hashes = (await db.ref("borluulalt_secret/pins").once("value")).val() || {};
  const ids = Object.keys(users).filter((k) => users[k] && typeof users[k] === "object" && users[k].name);
  const plain = (u) => (u.pin != null && String(u.pin) !== "" ? String(u.pin) : null);
  const patch = {};
  const report = [];
  const staff = (r) => r === "supervisor" || r === "accountant";

  for (const id of ids) {
    const u = users[id], p = plain(u), h = hashes[id];
    const hashOk = p !== null && h ? verifyPin(p, h) : null;
    if (cmd === "status") {
      report.push([id, u.role || "employee", p !== null ? "plain" : "-", h ? (hashOk === false ? "hash(MISMATCH)" : "hash") : "-", u.disabled ? "disabled" : ""]);
    } else if (cmd === "copy") {
      if (p !== null && !hashOk) {
        patch["borluulalt_secret/pins/" + id] = hashPin(p);
        if (!u.pinSet) patch["borluulalt/users/" + id + "/pinSet"] = true;
        report.push([id, h ? "re-hash (plain PIN changed)" : "hash"]);
      }
    } else if (cmd === "strip") {
      if (p !== null) {
        if (hashOk) { patch["borluulalt/users/" + id + "/pin"] = null; report.push([id, "strip"]); }
        else report.push([id, "SKIPPED: no matching hash — run copy first"]);
      }
    } else if (cmd === "generate-missing") {
      const roles = opt("roles", "all");
      if (p === null && !h && !u.disabled && (roles === "all" || staff(u.role))) {
        const pin = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
        patch["borluulalt_secret/pins/" + id] = hashPin(pin);
        patch["borluulalt/users/" + id + "/pinSet"] = true;
        report.push([id, u.name, u.role || "employee", pin]);
      }
    }
  }

  if (cmd === "status") {
    console.table(report.map((r) => ({ id: r[0], role: r[1], plain: r[2], hash: r[3], note: r[4] })));
    const nPlain = report.filter((r) => r[2] === "plain").length, nHash = report.filter((r) => r[3] !== "-").length;
    console.log(`${ids.length} users, ${nPlain} plain-text PINs, ${nHash} hashes, ${report.filter((r) => r[2] === "-" && r[3] === "-").length} without PIN`);
    process.exit(0);
  }
  if (cmd === "generate-missing") {
    const out = path.resolve(String(opt("out", "new-pins.csv")));
    console.log(report.length + " users without a PIN" + (report.length ? ":" : ""));
    report.forEach((r) => console.log("  " + r[0] + " (" + r[2] + ")"));
    if (APPLY && report.length) {
      fs.writeFileSync(out, "id,name,role,pin\n" + report.map((r) => r.map((x) => '"' + String(x).replace(/"/g, '""') + '"').join(",")).join("\n") + "\n", { mode: 0o600 });
      console.log("PINs written to " + out + " — hand them out, then delete the file.");
    }
  } else {
    report.forEach((r) => console.log("  " + r.join(": ")));
    console.log(Object.keys(patch).length ? "" : "nothing to do");
  }
  if (Object.keys(patch).length) {
    patch["borluulalt/_meta/users"] = "mig-" + Date.now().toString(36);
    if (!APPLY) console.log("DRY RUN — " + (Object.keys(patch).length - 1) + " writes planned. Add --apply to write.");
    else { await db.ref().update(patch); console.log("applied " + (Object.keys(patch).length - 1) + " writes"); }
  }
  process.exit(report.some((r) => String(r[1]).startsWith("SKIPPED")) ? 2 : 0);
})().catch((e) => { console.error("error:", e.message); process.exit(1); });
