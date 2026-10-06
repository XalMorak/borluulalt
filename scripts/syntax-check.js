const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
function jsIn(dir, deep) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = dir === "." ? d.name : path.join(dir, d.name);
    if (d.isDirectory()) return deep && d.name !== "node_modules" ? jsIn(p, deep) : [];
    return d.name.endsWith(".js") ? [p] : [];
  });
}
const files = [...jsIn(".", false), ...jsIn("api", true), ...jsIn("scripts", false), ...jsIn("security", false), ...jsIn("tests", true)];
if (!files.length) {
  console.error("no js files");
  process.exit(1);
}
for (const f of files) {
  console.log("check", f);
  execFileSync("node", ["--check", f], { stdio: "inherit" });
}
const required = ["index.html", "ui.html", "vercel.json", "app.js", "package.json", "api/login.js", "api/pin.js", "api/config.js",
  "security/database.rules.transition.json", "security/database.rules.strict.json"];
for (const f of required) {
  if (!fs.existsSync(f)) {
    console.error("missing", f);
    process.exit(1);
  }
}
/* rules: valid JSON and identical to what security/build-rules.js generates */
const before = {};
for (const w of ["transition", "strict"]) {
  const f = "security/database.rules." + w + ".json";
  before[w] = fs.readFileSync(f, "utf8");
  const r = JSON.parse(before[w]).rules;
  if (!r || !r.borluulalt || !r.borluulalt_secret) { console.error(f + ": missing borluulalt / borluulalt_secret"); process.exit(1); }
}
execFileSync("node", ["security/build-rules.js"], { stdio: "ignore" });
for (const w of ["transition", "strict"]) {
  const f = "security/database.rules." + w + ".json";
  if (fs.readFileSync(f, "utf8") !== before[w]) { console.error(f + " is out of date: run node security/build-rules.js and commit"); process.exit(1); }
}
console.log("ok", files.length, "js files, rules up to date");
