/* GET /api/config -> {mode, requirePin, configured}
   LOGIN_MODE (Vercel env, per Production / Preview):
     legacy      old client-side PIN check + anonymous auth (default)
     transition  server login first; if the server is unreachable / not configured,
                 fall back to the old login (never locks anyone out)
     secure      server login only (use together with the strict rules)
   If the server is not configured, the effective mode is always "legacy". */
"use strict";
const { send } = require("./_lib/http");

module.exports = function handler(req, res) {
  const configured = !!(process.env.FIREBASE_DATABASE_URL &&
    (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_DATABASE_EMULATOR_HOST));
  let mode = String(process.env.LOGIN_MODE || "legacy").toLowerCase();
  if (["legacy", "transition", "secure"].indexOf(mode) < 0) mode = "legacy";
  if (!configured) mode = "legacy";
  return send(res, 200, { mode: mode, requirePin: String(process.env.REQUIRE_PIN || "staff"), configured: configured });
};
