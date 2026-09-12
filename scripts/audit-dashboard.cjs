#!/usr/bin/env node
/*
 * Dashboard coverage gate: every built-in registered feature must be
 * reachable in the settings dashboard. Historically ~37 feature cards
 * carried `hidden: !0`, which made them completely unreachable in the GUI
 * (they still registered/applied, but users could never enable them).
 *
 * The only legitimate hidden registrations are runtime user-created ones
 * (e.g. custom uBlock cosmetic filters), whose id is a variable rather than
 * a static string. Fails CI if a statically-registered card is hidden.
 */
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const bundle = fs
  .readFileSync(path.join(root, "yt-zen.user.js"), "utf8")
  .replace(/\r\n/g, "\n");

const parts = bundle.split("xa.register({").slice(1);
let staticCards = 0;
let dynamicCards = 0;
const hidden = [];
for (const seg of parts) {
  const head = seg.slice(0, 4000);
  const id = /\bid:\s*"([^"]+)"/.exec(head);
  if (!id) {
    dynamicCards++;
    continue;
  }
  staticCards++;
  const name = /\bname:\s*"((?:[^"\\]|\\.)*)"/.exec(head);
  if (/\bhidden:\s*!0/.test(head)) {
    hidden.push(`${id[1]} (${name ? name[1] : "no name"})`);
  }
}

console.log(
  `dashboard audit: ${staticCards} static cards, ${dynamicCards} runtime/dynamic` +
    ` — ${staticCards - hidden.length} visible, ${hidden.length} hidden`,
);
if (hidden.length) {
  console.error("Features missing from the dashboard GUI:\n  " + hidden.join("\n  "));
  process.exit(1);
}
console.log("dashboard audit passed.");
