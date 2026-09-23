const fs = require("fs");
const { execFileSync } = require("child_process");
const files = fs.readdirSync(".").filter((f) => f.endsWith(".js"));
if (!files.length) {
  console.error("no js files");
  process.exit(1);
}
for (const f of files) {
  console.log("check", f);
  execFileSync("node", ["--check", f], { stdio: "inherit" });
}
const required = ["index.html", "ui.html", "vercel.json", "app.js", "package.json"];
for (const f of required) {
  if (!fs.existsSync(f)) {
    console.error("missing", f);
    process.exit(1);
  }
}
console.log("ok", files.length, "js files");
