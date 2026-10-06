/* PIN hashing: scrypt (Node built-in) + optional server-side pepper.
   Format: s1$<salt b64>$<hash b64>   (N=16384, r=8, p=1, 32-byte key) */
"use strict";
const crypto = require("crypto");

const N = 16384, R = 8, P = 1, KEYLEN = 32;

function peppered(pin) {
  const pepper = process.env.PIN_PEPPER || "";
  const s = String(pin == null ? "" : pin);
  return pepper ? crypto.createHmac("sha256", pepper).update(s).digest() : Buffer.from(s, "utf8");
}

function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(peppered(pin), salt, KEYLEN, { N, r: R, p: P });
  return "s1$" + salt.toString("base64") + "$" + key.toString("base64");
}

function verifyPin(pin, stored) {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "s1") return false;
  const salt = Buffer.from(parts[1], "base64");
  const want = Buffer.from(parts[2], "base64");
  const got = crypto.scryptSync(peppered(pin), salt, want.length, { N, r: R, p: P });
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/* constant-time compare for legacy plain-text PINs (transition only) */
function samePlain(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

const PIN_RE = /^[0-9A-Za-z]{4,12}$/;
function validNewPin(pin) { return PIN_RE.test(String(pin || "")); }

/* REQUIRE_PIN: "all" | "staff" (supervisor + accountant, default) | "none" */
function pinRequired(role) {
  const mode = String(process.env.REQUIRE_PIN || "staff").toLowerCase();
  if (mode === "all") return true;
  if (mode === "none") return false;
  return role === "supervisor" || role === "accountant";
}

module.exports = { hashPin, verifyPin, samePlain, validNewPin, pinRequired };
