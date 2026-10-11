/* /api/reports — server-side access to bug reports for the maintainer (assistant), not for the app.
   Auth: header "x-reports-token: <REPORTS_TOKEN>" (Vercel env, ≥24 chars). Missing env → 503, wrong → 401.
     GET  /api/reports?status=new&limit=50&shots=0   -> {reports:[{id, at, by, role, kind, category, text, ctx, status, ...}]}
                                                       (screenshots only with shots=1)
     POST /api/reports {id, status:"new"|"fixing"|"fixed", note?}  -> {ok:true}
   Uses the admin SDK (bypasses rules); only reads borluulalt/reports and writes its status fields. */
"use strict";
const crypto = require("crypto");
const { getAdmin } = require("./_lib/fb");
const { send, readJson, safeKey } = require("./_lib/http");
const STATUS = ["new", "fixing", "fixed"];

function authorized(req) {
  const want = String(process.env.REPORTS_TOKEN || "");
  const got = String(req.headers["x-reports-token"] || "");
  if (!got) return false;
  const a = crypto.createHash("sha256").update(got).digest(), b = crypto.createHash("sha256").update(want).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  if (String(process.env.REPORTS_TOKEN || "").length < 24) return send(res, 503, { error: "REPORTS_TOKEN not configured", code: "not-configured" });
  if (!authorized(req)) return send(res, 401, { error: "unauthorized", code: "unauthorized" });
  let A;
  try { A = getAdmin(); } catch (e) { return send(res, 503, { error: "server not configured", code: "not-configured" }); }
  const db = A.admin.database();
  const url = new URL(req.url, "http://x");
  try {
    if (req.method === "GET") {
      const status = url.searchParams.get("status") || "";
      const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")) || 50));
      const shots = url.searchParams.get("shots") === "1";
      if (status && STATUS.indexOf(status) < 0) return send(res, 400, { error: "bad status" });
      const q = status ? db.ref("borluulalt/reports").orderByChild("status").equalTo(status) : db.ref("borluulalt/reports").orderByChild("at").limitToLast(limit);
      const v = (await q.once("value")).val() || {};
      const reports = Object.keys(v).map((k) => {
        const r = Object.assign({ id: k }, v[k]);
        if (!shots && r.shot) { r.shot = "(" + Math.round(String(r.shot).length / 1024) + " KB, use shots=1)"; }
        return r;
      }).sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))).slice(0, limit);
      return send(res, 200, { reports });
    }
    if (req.method === "POST") {
      const body = await readJson(req);
      const id = safeKey(String(body.id || ""));
      if (!id || STATUS.indexOf(body.status) < 0) return send(res, 400, { error: "need id and status (new|fixing|fixed)" });
      const ref = db.ref("borluulalt/reports/" + id);
      if (!(await ref.child("at").once("value")).exists()) return send(res, 404, { error: "no such report" });
      const patch = { status: body.status, statusAt: new Date().toISOString(), statusBy: "assistant" };
      if (body.note) patch.fixNote = String(body.note).slice(0, 1000);
      await ref.update(patch);
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: "GET or POST" });
  } catch (e) {
    console.error("reports", e && e.message);
    return send(res, 500, { error: "server error" });
  }
};
