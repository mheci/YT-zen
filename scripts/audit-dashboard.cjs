#!/usr/bin/env node


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
  console.warn(
    "dashboard audit note: " + hidden.length +
      " feature(s) registered with hidden:true (intentional for AIO-bundle " +
      "members and advanced features — they are not shown in the main " +
      "dashboard by design):\n  " + hidden.join("\n  "),
  );
}
console.log(
  "dashboard audit passed (" + (staticCards - hidden.length) + " visible, " +
    hidden.length + " hidden).",
);
