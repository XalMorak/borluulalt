/* scripts/migrate-pins.js against the database emulator (namespace demo-borluulalt-mig) */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const DB_EMU = process.env.DB_EMU || "127.0.0.1:9400", NS = "demo-borluulalt-mig";
const env = Object.assign({}, process.env, { FIREBASE_DATABASE_EMULATOR_HOST: DB_EMU, FIREBASE_PROJECT_ID: "demo-borluulalt",
  FIREBASE_DATABASE_URL: `https://${NS}.firebaseio.com`, PIN_PEPPER: "pep" });
delete env.FIREBASE_SERVICE_ACCOUNT; delete env.GOOGLE_APPLICATION_CREDENTIALS;
const SCRIPT = path.join(__dirname, "../../scripts/migrate-pins.js");
const run = (...a) => { try { return { code: 0, out: execFileSync("node", [SCRIPT, ...a], { env, encoding: "utf8" }) }; } catch (e) { return { code: e.status, out: e.stdout }; } };
const url = (p) => `http://${DB_EMU}/${p}.json?ns=${NS}`;
const put = (p, v) => fetch(url(p), { method: "PUT", headers: { Authorization: "Bearer owner" }, body: JSON.stringify(v) });
const getv = async (p) => (await fetch(url(p), { headers: { Authorization: "Bearer owner" } })).json();

test("copy -> strip -> generate-missing", async () => {
  process.env.PIN_PEPPER = "pep";
  const { verifyPin } = require("../../api/_lib/pinhash");
  await put("", { borluulalt: { users: { sup1: { name: "A", role: "supervisor", pin: "4321" }, emp1: { name: "B", role: "employee", pin: "111" }, emp2: { name: "C", role: "employee" } } } });
  assert.equal(run("strip", "--apply").code, 2, "strip refuses users without a hash");
  assert.equal((await getv("borluulalt/users/sup1/pin")), "4321");
  assert.match(run("copy").out, /DRY RUN/);
  assert.equal(await getv("borluulalt_secret"), null, "dry run writes nothing");
  assert.equal(run("copy", "--apply").code, 0);
  assert.ok(verifyPin("4321", await getv("borluulalt_secret/pins/sup1")));
  assert.ok(verifyPin("111", await getv("borluulalt_secret/pins/emp1")));
  assert.equal(await getv("borluulalt/users/sup1/pinSet"), true);
  await put("borluulalt/users/sup1/pin", "5555");                         // changed on an old device after copy
  assert.equal(run("strip", "--apply").code, 2);
  assert.equal(await getv("borluulalt/users/sup1/pin"), "5555", "mismatched PIN is not stripped");
  assert.equal(await getv("borluulalt/users/emp1/pin"), null);
  run("copy", "--apply"); assert.equal(run("strip", "--apply").code, 0);
  assert.ok(verifyPin("5555", await getv("borluulalt_secret/pins/sup1")));
  const csv = path.join(os.tmpdir(), "pins-" + process.pid + ".csv");
  assert.equal(run("generate-missing", "--out=" + csv, "--apply").code, 0);
  const pin = fs.readFileSync(csv, "utf8").trim().split("\n")[1].split(",")[3].replace(/"/g, "");
  assert.match(pin, /^\d{6}$/);
  assert.ok(verifyPin(pin, await getv("borluulalt_secret/pins/emp2")));
  fs.unlinkSync(csv);
  assert.match(run("status").out, /0 plain-text PINs, 3 hashes, 0 without PIN/);
});
