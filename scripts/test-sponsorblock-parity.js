#!/usr/bin/env node


"use strict";
const fs = require("fs");
const path = require("path");

const noop = () => {};
const elStub = () => ({
  style: {}, dataset: {}, classList: { add: noop, remove: noop },
  appendChild: noop, append: noop, remove: noop, addEventListener: noop,
  setAttribute: noop, querySelector: () => null, querySelectorAll: () => [],
});
globalThis.window = { addEventListener: noop, removeEventListener: noop, dispatchEvent: noop };
globalThis.document = {
  addEventListener: noop, removeEventListener: noop, getElementById: () => null,
  querySelector: () => null, querySelectorAll: () => [], createElement: elStub,
  body: elStub(), hidden: false,
};

try {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true, userAgent: "node-test" },
    configurable: true, writable: true,
  });
} catch (_) {
  try { globalThis.navigator.onLine = true; } catch (_) {}
}
globalThis.GM_info = { script: { version: "3.18.7" } };
globalThis.AbortController = globalThis.AbortController || class { constructor(){ this.signal={aborted:false,addEventListener:noop,removeEventListener:noop}; } abort(){} };
globalThis.URLSearchParams = URLSearchParams;
globalThis.TextEncoder = TextEncoder;
globalThis.performance = globalThis.performance || { now: () => Date.now() };

globalThis.MutationObserver = class { observe(){} disconnect(){} };
globalThis.ZenResources = {
  BoundedCache: class { constructor(){} get(){ return undefined; } set(){} clear(){} stats(){return {};} },
  Dom: { esc: (s) => String(s) },
  DeferredTask: { debounce: noop, cancel: noop, schedule: () => 0 },
  SharedTicker: { add: () => 0, remove: noop, stats: () => ({}) },
  Stats: {},
};

const S = {
  sponsorblockOn: true, sbPrivacy: false, sbToast: true, sbToastDur: 2200,
  sbSeekbar: true, sbHud: false, sbUserId: "",
  sbOnlySkipIfVip: false, sbIncognito: false, sbSkipCountdown: false,
  sbSkipCountdownTime: 3, sbBetterBeAware: "interaction,selfpromo",
  sb_sponsor_en: true, sb_sponsor_act: "skip", sb_sponsor_sb: true,
  sb_selfpromo_en: true, sb_selfpromo_act: "full", sb_selfpromo_sb: true,
  sb_interaction_en: true, sb_interaction_act: "full", sb_interaction_sb: true,
  sb_intro_en: true, sb_intro_act: "skip", sb_intro_sb: false,
  sb_outro_en: true, sb_outro_act: "skip", sb_outro_sb: true,
  sb_preview_en: true, sb_preview_act: "skip", sb_preview_sb: true,
  sb_hook_en: true, sb_hook_act: "skip", sb_hook_sb: true,
  sb_filler_en: true, sb_filler_act: "skip", sb_filler_sb: true,
  sb_music_offtopic_en: true, sb_music_offtopic_act: "skip", sb_music_offtopic_sb: true,
  sb_poi_highlight_en: true, sb_poi_highlight_act: "poi", sb_poi_highlight_sb: true,
  sb_exclusive_access_en: true, sb_exclusive_access_act: "skip", sb_exclusive_access_sb: true,
  sb_chapter_en: true, sb_chapter_act: "chapter", sb_chapter_sb: true,
};
globalThis.S = S;
globalThis.Ta = noop;
globalThis.ie = { el: () => null, videoId: () => "dQw4w9WgXcQ", isAd: () => false, channel: () => null, title: () => null };
globalThis.he = async () => { throw new Error("network disabled in test"); };
globalThis.v = async () => null;
globalThis.k = async () => {};
globalThis.x = async () => {};
globalThis.w = async () => [];
globalThis.p = noop; globalThis.h = noop; globalThis.m = noop;
globalThis.pe = noop; globalThis.ft = noop;
globalThis.g = { emit: noop, once: noop, on: noop };
globalThis.Yt = {};

let src = fs.readFileSync(path.resolve(__dirname, "..", "src/sponsorblock-engine-v2.js"), "utf8");
src += "\n;globalThis.SponsorBlockEngine = SponsorBlockEngine;";

(0, eval)(src);
const SB = globalThis.SponsorBlockEngine;

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; } else { fail++; console.error("FAIL: " + name); } };

ok("intro showInSeekbar=false (per-cat override)", SB.getConfigFlags().showInSeekbar("intro") === false);
ok("sponsor showInSeekbar=true (default)", SB.getConfigFlags().showInSeekbar("sponsor") === true);
ok("unknown category defaults to shown", SB.getConfigFlags().showInSeekbar("nope") === true);

ok("onlySkipIfVip reflects config", SB.getConfigFlags().onlySkipIfVip === false);
ok("skipCountdown flag shape", SB.getConfigFlags().skipCountdown.enabled === false && SB.getConfigFlags().skipCountdown.time === 3);
ok("betterBeAwareCats parsed", JSON.stringify(SB.getConfigFlags().betterBeAwareCats) === JSON.stringify(["interaction","selfpromo"]));

ok("poi_highlight offers 'Jump to highlight'", !!SB.getActionOptions("poi_highlight").poi);
ok("chapter offers 'Show chapters'", !!SB.getActionOptions("chapter").chapter);
ok("sponsor offers skip+mute", !!SB.getActionOptions("sponsor").skip && !!SB.getActionOptions("sponsor").mute);
ok("exclusive_access has no mute", !SB.getActionOptions("exclusive_access").mute);

const norm = SB.api.normalizeSegments(
  [{ segment: [10, 20], category: "sponsor", UUID: "abc", actionType: "skip" },
   { segment: [-5, 30], category: "sponsor" }],
  "dQw4w9WgXcQ"
);
ok("normalizeSegments drops invalid segment", norm.segments.length === 1 && norm.segments[0].segment[0] === 10);

(async () => {
  S.sbIncognito = true;
  S.sbUserId = "abcdefghijklmnopqrstuvwxyz0123";
  SB.getLocalUserId();
  const sub = await SB.api.submitSegment("dQw4w9WgXcQ", 1, 5, "sponsor", "");
  ok("incognito blocks submitSegment", sub.ok === false && /Incognito/.test(sub.message));
  const vote = await SB.voteUp("abc");
  ok("incognito blocks voteUp", vote.ok === false && /Incognito/.test(vote.message));

  S.sbIncognito = false;
  const sub2 = await SB.api.submitSegment("dQw4w9WgXcQ", 5, 5, "sponsor", "");
  ok("non-incognito submit rejects invalid times (no network needed)", sub2.ok === false && sub2.status === 400);

  console.log(`\nSponsorBlock parity test: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
