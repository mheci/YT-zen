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

if (failed > 0) {
  process.stderr.write(`check: ${failed} file(s) failed syntax validation.\n`);
  process.exit(1);
}
console.log(`check: ${files.length} file(s) passed syntax validation.`);
