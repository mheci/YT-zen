#!/usr/bin/env node


const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const toLf = (text) => text.replace(/\r\n/g, "\n");
const toCrlf = (text) => text.replace(/\n/g, "\r\n");
const read = (file) => toLf(fs.readFileSync(path.join(root, file), "utf8"));

const replaceBetween = (text, anchor, endMarker, replacement) => {
  const at = text.indexOf(anchor);
  if (at < 0) throw new Error(`Missing start marker: ${anchor}`);

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

const resourceStartCurrent =
  "  //  ZenResources — bounded, disposable, visibility-aware resource primitives";
bundle = replaceBetween(
  bundle,
  resourceStartCurrent,
  "\n\n    const oe = {",
  read("src/zen-resources.js"),
);

bundle = replaceBetween(
  bundle,
  "  //  SponsorBlock Engine v2 (YT-zen)",
  "\n\n\n  let St_seekbarMarks",
  read("src/sponsorblock-engine-v2.js"),
);

bundle = replaceBetween(
  bundle,
  "  //  uBlock Filter Interpreter Engine",
  "\n\n    function Cb_norm(e) {",
  read("src/ublock-filter-engine.js"),
);

bundle = replaceBetween(
  bundle,
  "  //  ZenEngine Ecosystem v3.0",
  "\n  (async function () {\n",
  read("src/zen-engine-v3.js"),
);

const pkgVersion = JSON.parse(read("package.json")).version;
const stampVersion = (text) =>
  text.replace(/^\/\/ @version\s+\S+$/m, `// @version      ${pkgVersion}`);
let meta = stampVersion(read("yt-zen.meta.js"));
bundle = stampVersion(bundle);
fs.writeFileSync(path.join(root, "yt-zen.meta.js"), toCrlf(meta));

fs.writeFileSync(path.join(root, "yt-zen.user.js"), toCrlf(bundle));
console.log(`Built yt-zen.user.js from source mirrors (version ${pkgVersion}).`);
