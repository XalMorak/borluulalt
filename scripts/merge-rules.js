#!/usr/bin/env node
/* Merge the borluulalt rules into the project's CURRENT rules without touching other
   apps that share the database (e.g. "eahs").
     1. Firebase console -> Realtime Database -> Rules: copy everything into current-rules.json
     2. node scripts/merge-rules.js current-rules.json transition > publish.json
        (or "strict" instead of "transition")
     3. Review publish.json, paste it into the console, Publish.
   Only rules.borluulalt and rules.borluulalt_secret are replaced; every other key is kept.
   Console rules may contain // comments — they are stripped (keep your own backup). */
"use strict";
const fs = require("fs");
const path = require("path");
const [file, which] = process.argv.slice(2);
if (!file || !["transition", "strict"].includes(which)) {
  console.error("usage: node scripts/merge-rules.js <current-rules.json> <transition|strict>");
  process.exit(1);
}
function stripComments(t) {
  let out = "", i = 0, str = false;
  while (i < t.length) {
    const c = t[i], n = t[i + 1];
    if (str) { out += c; if (c === "\\") { out += n; i += 2; continue; } if (c === '"') str = false; i++; continue; }
    if (c === '"') { str = true; out += c; i++; continue; }
    if (c === "/" && n === "/") { while (i < t.length && t[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { i = t.indexOf("*/", i + 2); i = i < 0 ? t.length : i + 2; continue; }
    out += c; i++;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}
const cur = JSON.parse(stripComments(fs.readFileSync(file, "utf8")));
const ours = JSON.parse(fs.readFileSync(path.join(__dirname, "../security/database.rules." + which + ".json"), "utf8"));
if (!cur.rules || typeof cur.rules !== "object") { console.error("no top-level \"rules\" object in " + file); process.exit(1); }
for (const k of [".read", ".write"]) {
  if (cur.rules[k] !== undefined && cur.rules[k] !== false && cur.rules[k] !== "false")
    console.error("WARNING: root " + k + " = " + JSON.stringify(cur.rules[k]) + " grants access to EVERYTHING (rules cascade) and overrides the borluulalt rules. Remove it.");
}
const kept = Object.keys(cur.rules).filter((k) => k !== "borluulalt" && k !== "borluulalt_secret");
const merged = { rules: Object.assign({}, cur.rules, { borluulalt: ours.rules.borluulalt, borluulalt_secret: ours.rules.borluulalt_secret }) };
console.error("kept unchanged: " + (kept.join(", ") || "(none)") + "; replaced: borluulalt, borluulalt_secret (" + which + ")");
process.stdout.write(JSON.stringify(merged, null, 2) + "\n");
