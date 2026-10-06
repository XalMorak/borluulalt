/* POST /api/pin   Authorization: Bearer <Firebase ID token>
     {id, pin}          set / change a user's PIN (stored only as a hash)
     {id, remove:true}  remove the PIN hash and sign the user out everywhere
   Caller must be an active user whose role (read from the database, not the
   token) is listed in PIN_ADMIN_ROLES (default "accountant"). */
"use strict";
const { getAdmin } = require("./_lib/fb");
const { send, readJson, safeKey } = require("./_lib/http");
const { hashPin, validNewPin } = require("./_lib/pinhash");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  let A;
  try { A = getAdmin(); }
  catch (e) { return send(res, 503, { error: "Сервер тохируулагдаагүй", code: "not-configured" }); }
  const db = A.admin.database();
  const m = /^Bearer (.+)$/.exec(String(req.headers.authorization || ""));
  if (!m) return send(res, 401, { error: "Нэвтрээгүй байна", code: "no-token" });
  let caller;
  try { caller = await A.admin.auth().verifyIdToken(m[1], true); }
  catch (e) { return send(res, 401, { error: "Нэвтрэлт хүчингүй. Дахин нэвтэрнэ үү.", code: "bad-token" }); }

  try {
    const admins = String(process.env.PIN_ADMIN_ROLES || "accountant").split(",").map((s) => s.trim());
    const me = (await db.ref("borluulalt/users/" + caller.uid).once("value")).val();
    if (!me || me.disabled || admins.indexOf(me.role) < 0) return send(res, 403, { error: "Эрх хүрэхгүй", code: "forbidden" });

    const body = await readJson(req);
    const id = safeKey(String(body.id || "").trim());
    if (!id) return send(res, 400, { error: "ID алга" });
    const user = (await db.ref("borluulalt/users/" + id).once("value")).val();
    const now = Date.now();
    const patch = {};
    patch["borluulalt/_meta/users"] = "srv-" + now.toString(36);

    if (body.remove) {
      patch["borluulalt_secret/pins/" + id] = null;
      patch["borluulalt_secret/attempts/" + id.toLowerCase()] = null;
      if (user) patch["borluulalt/users/" + id + "/pinSet"] = null;
      await db.ref().update(patch);
      try { await A.admin.auth().revokeRefreshTokens(id); } catch (e) { /* user never signed in */ }
      return send(res, 200, { ok: true, removed: true });
    }

    if (!user) return send(res, 404, { error: "Хэрэглэгч олдсонгүй" });
    const pin = String(body.pin == null ? "" : body.pin).trim();
    if (!validNewPin(pin)) return send(res, 400, { error: "PIN 4–12 тэмдэгт (тоо/латин үсэг)" });
    patch["borluulalt_secret/pins/" + id] = hashPin(pin);
    patch["borluulalt_secret/attempts/" + id.toLowerCase()] = null;   // login keys attempts by lower-case id
    patch["borluulalt/users/" + id + "/pinSet"] = true;
    /* transition: while the old plain-text PIN still exists, keep it equal so the
       legacy login fallback accepts the same PIN */
    if (user.pin != null && String(user.pin) !== "") patch["borluulalt/users/" + id + "/pin"] = pin;
    await db.ref().update(patch);
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error("pin error", e && e.message);
    return send(res, 500, { error: "Серверийн алдаа", code: "server" });
  }
};
