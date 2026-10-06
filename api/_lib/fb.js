/* firebase-admin bootstrap for Vercel functions.
   Env:
     FIREBASE_SERVICE_ACCOUNT  service-account JSON (raw or base64)  — production
     FIREBASE_DATABASE_URL     https://<db>.firebasedatabase.app
     FIREBASE_PROJECT_ID       (emulator/tests only, when no service account)
   With FIREBASE_DATABASE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST set,
   firebase-admin talks to the local emulators and needs no credentials. */
"use strict";
let admin = null, app = null, initError = null;

function parseSA(raw) {
  if (!raw) return null;
  let txt = String(raw).trim();
  if (!txt.startsWith("{")) txt = Buffer.from(txt, "base64").toString("utf8");
  const sa = JSON.parse(txt);
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  return sa;
}

function getAdmin() {
  if (app) return { admin, app };
  if (initError) throw initError;
  try {
    admin = require("firebase-admin");
    const sa = parseSA(process.env.FIREBASE_SERVICE_ACCOUNT);
    const databaseURL = process.env.FIREBASE_DATABASE_URL;
    const emulator = !!(process.env.FIREBASE_DATABASE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
    if (!databaseURL || (!sa && !emulator)) {
      const e = new Error("not-configured");
      e.code = "not-configured";
      throw e;
    }
    const opts = { databaseURL };
    if (sa) { opts.credential = admin.credential.cert(sa); opts.projectId = sa.project_id; }
    else opts.projectId = process.env.FIREBASE_PROJECT_ID || "demo-borluulalt";
    app = admin.apps.length ? admin.app() : admin.initializeApp(opts);
    return { admin, app };
  } catch (e) {
    if (e.code === "not-configured") throw e;   // retry on next call (env may be fixed)
    initError = e;
    throw e;
  }
}

module.exports = { getAdmin };
