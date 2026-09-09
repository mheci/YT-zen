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
// Parse-only validation. Node exposes `node --check`; Bun has no parse-only
// CLI flag (its --check would execute the file), so use Bun.Transpiler there.
const isBun = typeof Bun !== "undefined";
const bunTranspiler = isBun ? new Bun.Transpiler({ loader: "js" }) : null;
for (const file of files) {
  let failedMessage = "";
  try {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    if (isBun) {
      bunTranspiler.transformSync(source);
    } else {
      const result = spawnSync(process.execPath, ["--check", path.join(root, file)], {
        encoding: "utf8",
      });
      if (result.status !== 0) failedMessage = result.stderr || "node --check failed";
    }
  } catch (error) {
    failedMessage = error && error.message ? String(error.message) : String(error);
  }
  if (failedMessage) {
    failed++;
    process.stderr.write(`Syntax error in ${file}\n${failedMessage}\n`);
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

// Theme table guard: the Nr array (~4k lines of static color data) is pure
// JSON, so parse it and validate structure — a hand-edit that drops a var
// key, introduces a duplicate id, or typos a color would otherwise ship
// silently. Also verifies every theme id is referenced by nothing else is
// needed: ids are consumed dynamically by themeSelected.
(function validateThemes() {
  const start = bundle.indexOf("const Nr = [");
  if (start < 0) {
    failed++;
    process.stderr.write("check: theme table (const Nr = [) not found in bundle.\n");
    return;
  }
  const end = bundle.indexOf("\n  ];", start);
  if (end < 0) {
    failed++;
    process.stderr.write("check: theme table terminator missing.\n");
    return;
  }
  // end points at the \n before "  ];" — include the "]" but not the ";".
  const json = bundle.slice(start + "const Nr =".length, end + 4).replace(/\r?\n/g, "");
  let themes;
  try {
    // The table is static data from our own build (object keys are minified,
    // so it is not valid JSON) — eval via Function is fine in a build script.
    themes = new Function("return (" + json + ")")();
  } catch (e) {
    failed++;
    process.stderr.write("check: theme table is not valid data: " + e.message + "\n");
    return;
  }
  const REQUIRED_VARS = [
    "base-background", "raised-background", "menu-background",
    "general-background-a", "general-background-b", "general-background-c",
    "text-primary", "text-secondary", "text-disabled",
    "badge-chip-background", "outline", "call-to-action",
    "call-to-action-inverse", "icon-active-other", "icon-inactive",
    "10-percent-layer", "shadow",
  ];
  const COLOR = /^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\))$/;
  const seen = new Set();
  for (const t of themes) {
    const label = t && t.id ? t.id : "(unknown)";
    if (!t.id || !/^[a-z0-9-]+$/.test(t.id)) { failed++; process.stderr.write(`check: theme ${label} has a bad id.\n`); }
    if (seen.has(t.id)) { failed++; process.stderr.write(`check: duplicate theme id "${t.id}".\n`); }
    seen.add(t.id);
    if (t.mode !== "dark" && t.mode !== "light" && t.mode !== "auto") { failed++; process.stderr.write(`check: theme ${label} has invalid mode "${t.mode}".\n`); }
    if (t.id === "none") continue; // the default theme carries no vars
    if (!t.vars) { failed++; process.stderr.write(`check: theme ${label} has no vars.\n`); continue; }
    for (const key of REQUIRED_VARS) {
      if (!(key in t.vars)) { failed++; process.stderr.write(`check: theme ${label} missing var "${key}".\n`); continue; }
      if (!COLOR.test(t.vars[key])) { failed++; process.stderr.write(`check: theme ${label} var "${key}" is not a color: ${t.vars[key]}\n`); }
    }
    for (const key of Object.keys(t.vars)) {
      if (!REQUIRED_VARS.includes(key)) { failed++; process.stderr.write(`check: theme ${label} has unexpected var "${key}".\n`); }
    }
  }
  if (themes.length < 30) {
    failed++;
    process.stderr.write(`check: theme table shrank to ${themes.length} entries (expected 30+).\n`);
  }
  if (failed === 0) console.log(`check: theme table OK (${themes.length} themes).`);
})();

if (failed > 0) {
  process.stderr.write(`check: ${failed} file(s) failed syntax validation.\n`);
  process.exit(1);
}
console.log(`check: ${files.length} file(s) passed syntax validation.`);
