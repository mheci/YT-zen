#!/usr/bin/env node
/*
 * Cross-platform syntax gate: validates the generated bundle and every
 * source file under src/ with node --check (parse only, no execution).
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const files = ["yt-zen.user.js", "yt-zen.meta.js"]
  .concat(
    fs
      .readdirSync(path.join(root, "src"))
      .filter((f) => f.endsWith(".js"))
      .map((f) => path.join("src", f)),
  )
  .concat(
    fs
      .readdirSync(path.join(root, "scripts"))
      .filter((f) => f.endsWith(".js") && f !== "check.js")
      .map((f) => path.join("scripts", f)),
  );

const hasExplosion = (text) => {
  let run = 0;
  for (const line of text.split(/\r?\n/)) {
    run = line.length === 1 ? run + 1 : 0;
    if (run >= 20) return true;
  }
  return false;
};

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", path.join(root, file)], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    failed++;
    process.stderr.write(`Syntax error in ${file}\n${result.stderr || ""}\n`);
  }
}

// Corruption guard: a line that got character-exploded (one char per line)
// is still syntactically valid, so node --check cannot catch it. Fail on any
// run of 20+ single-character lines, and require the ZenDiscovery export to
// exist as a single intact line.
const bundle = fs.readFileSync(path.join(root, "yt-zen.user.js"), "utf8");
if (hasExplosion(bundle)) {
  failed++;
  process.stderr.write("check: yt-zen.user.js contains a character-exploded line run (corruption).\n");
}
for (const file of fs.readdirSync(path.join(root, "src")).filter((f) => f.endsWith(".js"))) {
  if (hasExplosion(fs.readFileSync(path.join(root, "src", file), "utf8"))) {
    failed++;
    process.stderr.write(`check: src/${file} contains a character-exploded line run (corruption).\n`);
  }
}
if (!bundle.includes("return { createVideoRow, scoreVideo, setStatus, discoveryHost };")) {
  failed++;
  process.stderr.write("check: ZenDiscovery export line missing from bundle.\n");
}

if (failed > 0) {
  process.stderr.write(`check: ${failed} file(s) failed syntax validation.\n`);
  process.exit(1);
}
console.log(`check: ${files.length} file(s) passed syntax validation.`);
