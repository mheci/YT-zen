#!/usr/bin/env node
/*
 * Source-first build: the shipped userscript bundle is generated output.
 * Subsystems under src/ are the canonical sources and are synced into the
 * bundle by marker replacement. Everything else currently lives in the
 * bundle body and is migrated into src/ incrementally.
 *
 * Line endings: all inputs and outputs are CRLF on disk; processing happens
 * on LF-normalized text so markers are line-ending agnostic.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const toLf = (text) => text.replace(/\r\n/g, "\n");
const toCrlf = (text) => text.replace(/\n/g, "\r\n");
const read = (file) => toLf(fs.readFileSync(path.join(root, file), "utf8"));

const replaceBetween = (text, anchor, endMarker, replacement) => {
  const at = text.indexOf(anchor);
  if (at < 0) throw new Error(`Missing start marker: ${anchor}`);
  // Back up to the beginning of the line containing the anchor, then consume
  // any pure box-decoration or blank lines directly above it. This keeps the
  // replacement idempotent: the anchor's own section markers live in the
  // source file, not in the bundle body.
  let start = at;
  while (start > 0 && text[start - 1] !== "\n") start--;
  for (;;) {
    if (start === 0) break;
    const prevLineStart = text.lastIndexOf("\n", start - 2) + 1;
    const line = text.slice(prevLineStart, start).replace(/\n$/, "");
    if (/^\s*$/.test(line) || /^\s*\/\/\s*[═║╔╗╚╝╠╣╦╩╬─│·=]+$/.test(line)) {
      start = prevLineStart;
    } else {
      break;
    }
  }
  const end = text.indexOf(endMarker, at);
  if (end < 0) throw new Error(`Missing end marker: ${endMarker}`);
  return text.slice(0, start) + replacement.trimEnd() + text.slice(end);
};

let bundle = read("yt-zen.user.js");

// ZenResources runtime: sync the canonical source into the resource block.
// Match the header line only; the box-drawing row above it is prone to
// whitespace/unicode drift and must not gate the build.
const resourceStartCurrent =
  "  //  ZenResources — bounded, disposable, visibility-aware resource primitives";
bundle = replaceBetween(
  bundle,
  resourceStartCurrent,
  "\n\n    const oe = {",
  read("src/zen-resources.js"),
);

// SponsorBlock engine: canonical source is src/sponsorblock-engine-v2.js,
// including its banner (the anchor is the banner header line; the "=" rows
// around it are consumed by the box-decoration logic).
bundle = replaceBetween(
  bundle,
  "  //  SponsorBlock Engine v2 (YT-zen)",
  "\n\n\n  let St_seekbarMarks",
  read("src/sponsorblock-engine-v2.js"),
);

// uBlock filter interpreter: canonical source is src/ublock-filter-engine.js.
bundle = replaceBetween(
  bundle,
  "  //  uBlock Filter Interpreter Engine",
  "\n\n    function Cb_norm(e) {",
  read("src/ublock-filter-engine.js"),
);

// Zen subsystem (core engines + AlgoEngine + feature registrations):
// canonical source is src/zen-engine-v3.js. It spans from the ZenEngine
// banner through the last feature registration, right up to the boot IIFE.
// The anchor is the banner line; the pure "=" row above it is consumed by
// the box-decoration logic so the banner is owned by the source file.
bundle = replaceBetween(
  bundle,
  "  //  ZenEngine Ecosystem v3.0",
  "\n  (async function () {\n",
  read("src/zen-engine-v3.js"),
);

// Version propagation: package.json is the single source of truth for the
// release version. Stamp it into both header files so check-release.js can
// never observe drift between package, artifact, and metadata.
const pkgVersion = JSON.parse(read("package.json")).version;
const stampVersion = (text) =>
  text.replace(/^\/\/ @version\s+\S+$/m, `// @version      ${pkgVersion}`);
let meta = stampVersion(read("yt-zen.meta.js"));
bundle = stampVersion(bundle);
fs.writeFileSync(path.join(root, "yt-zen.meta.js"), toCrlf(meta));

fs.writeFileSync(path.join(root, "yt-zen.user.js"), toCrlf(bundle));
console.log(`Built yt-zen.user.js from source mirrors (version ${pkgVersion}).`);
