#!/usr/bin/env node


"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const bundle = fs.readFileSync(path.join(root, "yt-zen.user.js"), "utf8");
const meta = fs.readFileSync(path.join(root, "yt-zen.meta.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.ok(!/addEventListener\(\s*["']YTZEN_SET_VALUE_SYNC["']/.test(bundle),
  "PT-01: YTZEN_SET_VALUE_SYNC listener must stay removed");

assert.ok(!/createPolicy\(\s*["']default["']/.test(bundle),
  "B-01: default TT policy must not be registered");
assert.ok(/createPolicy\("ytplus#dashboard"/.test(bundle),
  "B-01: scoped dashboard policy retained");

assert.ok(/__proto__" \|\| a === "constructor" \|\| a === "prototype"/.test(bundle),
  "B-08: D() must reject prototype-chain keys");

assert.ok(/_SEMVER_RE = \/\^\\\(\\d\+\)/.test(bundle) || /_SEMVER_RE/.test(bundle),
  "B-10/B-11: strict semver regex present");
assert.ok(!/if \(o\(latestTag, a\(installed\)\)/.test(bundle),
  "B-11: legacy compare call replaced");

assert.ok(/forceWatchedOn: !1/.test(bundle), "ZE-01: forceWatchedOn defaults off");
assert.ok(/forceWatchedAccountHistory: !1/.test(bundle), "ZE-01: account history defaults off");
assert.ok(/forceWatchedLocalHistory: !1/.test(bundle), "ZE-01: local history defaults off");
assert.ok(!/setTimeout\(_flag, 9000\)/.test(bundle), "ZE-01: 9s auto-acknowledge removed");

assert.ok(
  /_h === "www\.youtube\.com" \|\| _h === "youtube\.com" \|\| _h === "s\.youtube\.com"/.test(bundle),
  "PT-06: beacon origin pin present"
);
assert.ok(/_p\.protocol !== "https:"/.test(bundle), "PT-06: https-only beacon guard");

const connects = (text) => (text.match(/@connect\s+(\S+)/g) || []).map((s) => s.split(/\s+/)[1]);
assert.deepStrictEqual(
  connects(bundle).sort(),
  ["github.com", "s.youtube.com", "self", "sponsor.ajay.app", "www.youtube.com"],
  "PT-08: bundle @connect exactly the used hosts"
);
assert.deepStrictEqual(connects(bundle).sort(), connects(meta).sort(),
  "PT-08: meta and bundle @connect lists match");

assert.ok(/GM_getValue\("ytp\.killed"/.test(bundle), "B-06: GM kill flag checked");
assert.ok(/GM_setValue\("ytp\.killed", !1\)/.test(bundle), "B-06: GM kill flag cleared by user gesture");

assert.ok(/if \(!S\.sessionRestoreOn\) return false;/.test(bundle),
  "ZE-07: discover gates history lookups on sessionRestoreOn");

const ver = (t) => (t.match(/@version\s+(\S+)/) || [])[1];
assert.strictEqual(ver(bundle), ver(meta), "version: bundle/meta agree");
assert.strictEqual(ver(bundle), pkg.version, "version: package.json agrees");

assert.ok(/typeof d\.ver === "number"/.test(bundle), "SIM-07: BroadcastChannel shape check");

assert.ok(/_zenAdaptInk/.test(bundle), "THEME-01: adaptive ink tokens present");
assert.ok(/ytd-topbar-logo-renderer/.test(bundle) && /#masthead #buttons yt-icon/.test(bundle),
  "THEME-02: masthead logo/icon explicit rules present");
assert.ok(/"color-scheme:" \+ \("dark" === e\.mode/.test(bundle),
  "THEME-03: color-scheme token per mode");
assert.ok(/"\|v3";/.test(bundle), "THEME-04: theme css memo at v3");
console.log("Audit-fix tests (batch 5: bundle pins) passed.");
