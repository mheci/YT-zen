#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const pkg = JSON.parse(read("package.json"));
const bundle = read("yt-zen.user.js");
const meta = read("yt-zen.meta.js");
const versionOf = (text) => {
  const match = text.match(/@version\s+([^\s]+)/);
  if (!match) throw new Error("Missing userscript version");
  return match[1];
};

if (versionOf(bundle) !== pkg.version || versionOf(meta) !== pkg.version) {
  throw new Error(`Version mismatch: package=${pkg.version}, bundle=${versionOf(bundle)}, meta=${versionOf(meta)}`);
}
if (!/@inject-into\s+content/.test(bundle)) {
  throw new Error("Bundle is missing @inject-into content — without it Violentmonkey on Firefox uses page-context injection, which YouTube's CSP blocks on regular reloads (the script then never runs).");
}
if (!/@sandbox\s+JavaScript/.test(bundle)) {
  throw new Error("Bundle is missing @sandbox JavaScript — without it Tampermonkey injects a page-context inline script that YouTube's CSP blocks on cold navigations (the 'only works after hard refresh' regression).");
}
if (!meta.includes("@sandbox JavaScript") && !meta.includes("@sandbox")) {
  throw new Error("Meta is missing @sandbox — metadata and bundle headers have diverged.");
}
for (const required of [
  "all-categories-v2",
  "privacy-path-json",
  "privacy-path-repeated",
  "clearInFlightForVideo",
  "videoID=",
  "viewedVideoSponsorTime?UUID=",
  "normalizeSegments",
]) {
  if (!bundle.includes(required)) throw new Error(`Bundle is missing required production guard: ${required}`);
}
if (bundle.includes("privacy-query-json") || bundle.includes("privacy-query-repeated")) {
  throw new Error("Deprecated prefix query fallback remains in the bundle");
}
const resourceHeaders = (bundle.match(/ZenResources — bounded, disposable, visibility-aware resource primitives/g) || []).length;
if (resourceHeaders !== 1) throw new Error(`Expected one ZenResources header, found ${resourceHeaders}`);
console.log(`Release checks passed for YT-zen ${pkg.version}.`);
