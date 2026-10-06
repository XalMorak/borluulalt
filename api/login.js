/* POST /api/login  {id, pin}  ->  {ok, token, user:{id,name,role}}
   Checks the PIN on the server and returns a Firebase custom token
   (uid = user id, claims {role, eid}). The browser then calls
   firebase.auth().signInWithCustomToken(token).

   PIN source, in order:
     1. borluulalt/users/<id>/pin (plain text) while it still exists — transition.
        A successful login stores a hash so the later "strip" step loses nothing.
     2. borluulalt_secret/pins/<id> (scrypt hash) — after migration.
   Brute force: 5 wrong PINs per ID or 30 per IP in 15 min -> 10 min lock. */
"use strict";
const crypto = require("crypto");
const { getAdmin } = require("./_lib/fb");
const { send, readJson, clientIp, safeKey } = require("./_lib/http");
const { hashPin, verifyPin, samePlain, pinRequired } = require("./_lib/pinhash");

const ROLES = ["employee", "supervisor", "accountant"];
const WINDOW_MS = 15 * 60 * 1000, LOCK_MS = 10 * 60 * 1000, MAX_ID = 5, MAX_IP = 30;

function lockedFor(a, now) { return a && a.until && a.until > now ? a.until - now : 0; }
function bump(ref, max, now) {
  return ref.transaction((a) => {
    a = a && a.first && now - a.first < WINDOW_MS ? a : { n: 0, first: now };
    a.n = (a.n || 0) + 1;
    a.at = now;
    if (a.n >= max) { a.until = now + LOCK_MS; a.n = 0; a.first = now; }
    return a;
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  let A;
  try { A = getAdmin(); }
  catch (e) { return send(res, 503, { error: "Нэвтрэх сервер тохируулагдаагүй", code: "not-configured" }); }
  const db = A.admin.database();
  const body = await readJson(req);
  const rawId = String(body.id || "").trim().toLowerCase();
  const pin = String(body.pin == null ? "" : body.pin).trim();
  const now = Date.now();
  if (!rawId || rawId.length > 64 || pin.length > 64) return send(res, 400, { error: "ID / PIN буруу хэлбэртэй" });

  const ipKey = crypto.createHash("sha256").update(clientIp(req)).digest("hex").slice(0, 24);
  const idRef = db.ref("borluulalt_secret/attempts/" + safeKey(rawId));
  const ipRef = db.ref("borluulalt_secret/ipAttempts/" + ipKey);
  try {
    const [a, b] = await Promise.all([idRef.once("value"), ipRef.once("value")]);
    const wait = Math.max(lockedFor(a.val(), now), lockedFor(b.val(), now));
    if (wait) return send(res, 429, { error: "Олон удаа буруу оруулсан. " + Math.ceil(wait / 60000) + " минутын дараа дахин оролдоно уу.", code: "locked" });

    let uid = safeKey(rawId);
    let user = (await db.ref("borluulalt/users/" + uid).once("value")).val();
    if (!user) {
      const all = (await db.ref("borluulalt/users").once("value")).val() || {};
      const hit = Object.keys(all).find((k) => k.toLowerCase() === rawId);
      if (hit) { uid = hit; user = all[hit]; }
    }
    const fail = async () => {
      await Promise.all([bump(idRef, MAX_ID, now), bump(ipRef, MAX_IP, now)]);
      return send(res, 401, { error: "ID эсвэл PIN буруу", code: "bad-credentials" });
    };
    if (!user || typeof user !== "object" || !user.name) return fail();
    const role = ROLES.indexOf(user.role) >= 0 ? user.role : "employee";

    const hash = (await db.ref("borluulalt_secret/pins/" + uid).once("value")).val();
    const plain = user.pin != null && String(user.pin) !== "" ? String(user.pin) : null;
    let ok = false, upgrade = false;
    if (plain !== null) {
      ok = samePlain(pin, plain);
      if (ok && !(hash && verifyPin(pin, hash))) upgrade = true;
    } else if (hash) {
      ok = verifyPin(pin, hash);
    } else {
      if (pinRequired(role)) return send(res, 403, { error: "PIN тохируулаагүй байна. Нягтланд хандаж PIN авна уу.", code: "pin-not-set" });
      ok = true;   // no PIN configured and the policy allows it (same as the old client check)
    }
    if (!ok) return fail();
    if (user.disabled) return send(res, 403, { error: "ID идэвхгүй", code: "disabled" });   // only told after a correct PIN

    const patch = {};
    patch["borluulalt_secret/attempts/" + safeKey(rawId)] = null;
    if (upgrade) {
      patch["borluulalt_secret/pins/" + uid] = hashPin(pin);
      if (!user.pinSet) {
        patch["borluulalt/users/" + uid + "/pinSet"] = true;
        patch["borluulalt/_meta/users"] = "srv-" + now.toString(36);
      }
    }
    await db.ref().update(patch);
    const token = await A.admin.auth().createCustomToken(uid, { role: role, eid: uid });
    return send(res, 200, { ok: true, token: token, user: { id: uid, name: String(user.name), role: role } });
  } catch (e) {
    console.error("login error", e && e.message);
    return send(res, 500, { error: "Серверийн алдаа. Дахин оролдоно уу.", code: "server" });
  }
};
