#!/usr/bin/env node


"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TARGETS = [
  path.join(ROOT, "yt-zen.user.js"),
  ...["zen-resources", "zen-engine-v3", "ublock-filter-engine", "sponsorblock-engine-v2"].map(
    (m) => path.join(ROOT, "src", `${m}.js`),
  ),
];

const RE_ASSIGN = /unsafeWindow\.[A-Za-z_$][\w$]*\s*=/g;
const BRIDGE = /exportFunction|cloneInto|_xp\./;
const RE_PRIMITIVE = /^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\d+|true|false|null|undefined)\s*$/;

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

let violations = 0;
for (const file of TARGETS) {
  let raw;
  try { raw = fs.readFileSync(file, "utf8"); } catch (_) { continue; }
  const src = stripComments(raw);
  RE_ASSIGN.lastIndex = 0;
  let m;
  while ((m = RE_ASSIGN.exec(src))) {
    const start = m.index + m[0].length;
    const end = src.indexOf(";", start);
    const rhs = (end === -1 ? src.slice(start) : src.slice(start, end)).trim();
    const bridged = BRIDGE.test(rhs);
    const primitive = RE_PRIMITIVE.test(rhs);
    if (bridged || primitive) continue;
    const line = src.slice(0, m.index).split("\n").length;
    violations++;
    console.error(`XRAY VIOLATION ${path.relative(ROOT, file)}:${line}: ` +
      `raw \`${m[0].trim()}\` without realm bridge`);
    console.error(`    rhs: ${rhs.slice(0, 90)}`);
  }
}

if (violations) {
  console.error(`\ncheck-xray: ${violations} Xray-unsafe assignment(s) found. ` +
    `Route through exportFunction / cloneInto / _xp.*.`);
  process.exit(1);
}
console.log("check-xray: OK — no raw unsafeWindow function assignments.");
