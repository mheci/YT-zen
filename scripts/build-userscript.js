#!/usr/bin/env node
/*
 * Keep the shipped userscript's mirrored subsystems reproducible.
 * The rest of yt-zen is intentionally kept in the canonical bundle because
 * the userscript manager installs one file, while the files under src/ are
 * reviewable source mirrors for the high-risk subsystems.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const replaceBetween = (text, startMarker, endMarker, replacement) => {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing start marker: ${startMarker}`);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`Missing end marker: ${endMarker}`);
  return text.slice(0, start) + replacement.trimEnd() + text.slice(end);
};

let bundle = read("yt-zen.user.js");
const legacyResourceStart = "  // ═══════════════════════════════════════════════════════════════════════════\n  //  ZenResources — Memory Safety & Resource Efficiency Layer";
const currentResourceStart = "  // ═══════════════════════════════════════════════════════════════════════════\n  //  ZenResources — bounded, disposable, visibility-aware resource primitives";
bundle = replaceBetween(
  bundle,
  bundle.includes(legacyResourceStart) ? legacyResourceStart : currentResourceStart,
  "\n\n    const oe = {",
  read("src/zen-resources.js"),
);
bundle = replaceBetween(
  bundle,
  "  const SponsorBlockEngine = (() => {",
  "\n\n\n  let St_seekbarMarks",
  read("src/sponsorblock-engine-v2.js"),
);

// The source mirror contains the repaired Time Machine registration. The
// bundle has a later algorithm registration that is not in the legacy mirror,
// so sync only this registration rather than replacing the entire tail.
const engine = read("src/zen-engine-v3.js");
const timeMachineStart = "  xa.register({\n    id: \"time-machine\"";
const timeMachineEnd = "  xa.register({ id: \"small-creator-spotlight\"";
const sourceStart = engine.indexOf(timeMachineStart);
const sourceEnd = engine.indexOf(timeMachineEnd, sourceStart);
if (sourceStart < 0 || sourceEnd < 0) throw new Error("Time Machine markers missing from source");
bundle = replaceBetween(
  bundle,
  timeMachineStart,
  timeMachineEnd,
  engine.slice(sourceStart, sourceEnd),
);

fs.writeFileSync(path.join(root, "yt-zen.user.js"), bundle);
console.log("Built yt-zen.user.js from source mirrors.");
