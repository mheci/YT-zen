#!/usr/bin/env node


"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function makeContext({ withSubtle }) {
  const document = {
    hidden: false,
    body: null,
    documentElement: null,
    addEventListener() {},
    removeEventListener() {},
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const context = vm.createContext({
    console,
    document,
    window: {},
    globalThis: {},
    URL,
    URLSearchParams,
    AbortController,
    DOMException,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance,

    crypto: withSubtle ? require("crypto").webcrypto : { getRandomValues: (a) => a },
    TextEncoder,
    FinalizationRegistry,
    WeakRef,
    fetch: () => Promise.reject(new Error("offline")),
    v: async () => null,
    k: async () => undefined,
    x: async () => undefined,
    w: async () => [],
    h: () => {},
    u: () => {},
    p: () => {},
    g: { emit() {}, on() { return () => {}; } },
    Yt: { sponsorblock: [] },
    S: {
      sponsorblockOn: true,
      sbPrivacy: false,
      sbSeekbar: false,
      sbToast: false,
      sbUserId: "abcdefghijklmnopqrstuvwxyz0123",
    },
    ie: { videoId: () => "abcdefghijk", el: () => null, isAd: () => false },
    _a: () => false,
    ft: () => {},
    pe: () => {},
    Ta: () => {},
    he: async () => ({ ok: true, status: 200, json: async () => [] }),
    St_seekbarMarks: new Map(),
    GM_info: { script: { version: "test" } },
  });
  const run = (file, expose) => {
    let source = fs.readFileSync(path.join(root, file), "utf8");
    if (expose) source += `\n;globalThis.${expose} = ${expose};\n`;
    vm.runInContext(source, context, { filename: file });
  };
  run("src/zen-resources.js", "ZenResources");
  run("src/sponsorblock-engine-v2.js", "SponsorBlockEngine");
  return context;
}

(async () => {

  {
    const ctx = makeContext({ withSubtle: true });
    const engine = ctx.globalThis.SponsorBlockEngine;
    assert.strictEqual(await engine.api.hashPrefix("dQw4w9WgXcQ"), "5f6b",
      "SB-03: real SHA-256 prefix for dQw4w9WgXcQ");
  }
  {
    const ctx = makeContext({ withSubtle: false });
    const engine = ctx.globalThis.SponsorBlockEngine;
    const prefix = await engine.api.hashPrefix("dQw4w9WgXcQ");
    assert.strictEqual(prefix, null, "SB-03: no subtle → null (fail closed, no wrong bucket)");

    ctx.S.sbPrivacy = true;
    let calls = 0;
    ctx.he = async () => { calls++; return { ok: true, status: 200, json: async () => [] }; };
    const segs = await engine.api.fetchWithRetry("dQw4w9WgXcQ", new AbortController().signal);
    assert.strictEqual(calls, 0, "SB-03: privacy lookup skipped entirely without SHA-256");
    assert.strictEqual(segs.length, 0);
  }

  {
    const ctx = makeContext({ withSubtle: true });
    const engine = ctx.globalThis.SponsorBlockEngine;
    const out = engine.api.normalizeSegments([
      { UUID: "A", category: "sponsor", segment: [0, 10] },
      { UUID: "Z", category: "sponsor", segment: [5, 5] },
      { UUID: "B", category: "sponsor", segment: [6, 20] },
      { UUID: "C", category: "sponsor", segment: [8, 10] },
    ], "abcdefghijk");
    assert.strictEqual(out.segments.length, 2, "SB-09: degenerate + crushed segments dropped");
    assert.strictEqual(out.segments[0].UUID, "A");
    assert.strictEqual(out.segments[1].UUID, "B", "SB-09: survivor contained within predecessor");
    assert.strictEqual(out.segments[1].segment.join(","), "10,20");
  }

  {
    const ctx = makeContext({ withSubtle: true });
    const engine = ctx.globalThis.SponsorBlockEngine;
    assert.strictEqual(engine._audit.addPreviewSegment(1, 5, "sponsor", ""), true);
    assert.strictEqual(engine._audit.addPreviewSegment(9, 12, "intro", ""), true);
    assert.strictEqual(engine._audit.counts().previews, 1, "SB-01: preview is a single slot");
    assert.strictEqual(engine._audit.addPreviewSegment(5, 5, "sponsor", ""), false, "invalid rejected");
    engine._audit.closeSubmissionEditor();
    assert.strictEqual(engine._audit.counts().previews, 0, "SB-01: close drops previews");
  }

  {
    const ctx = makeContext({ withSubtle: true });
    const engine = ctx.globalThis.SponsorBlockEngine;
    engine._audit.markUndone("uuid-1");
    assert.strictEqual(engine._audit.isUndone("uuid-1"), true, "SB-04: undo recorded");
    assert.strictEqual(engine._audit.isUndone("uuid-2"), false);
  }

  {
    const ctx = makeContext({ withSubtle: true });
    const engine = ctx.globalThis.SponsorBlockEngine;

    const mine = "aaaabbbbccccddddeeeeffffgggghh";
    ctx.he = async () => ({
      ok: true, status: 200,
      json: async () => [
        { UUID: "seg-other-user", category: "sponsor", segment: [1, 2], userID: "someoneelse00000000000000000" },
        { UUID: mine.slice(0, 22), category: "sponsor", segment: [3, 4], userID: ctx.S.sbUserId },
      ],
    });
    await engine.init("abcdefghijk", { force: true });
    const known = new Set();
    const remembered = [];

    const localStorage = {
      getItem: () => null,
      setItem: (k, v) => { if (k.indexOf("my_submissions") >= 0) remembered.push(v); },
    };
    ctx.window.localStorage = localStorage;
    ctx.localStorage = localStorage;
    const n = engine._audit.rememberOwnedSegments("abcdefghijk", known);
    assert.strictEqual(n, 1, "SB-02: exactly the owned segment is claimed");
    engine.destroy();
  }

  {
    const ctx = makeContext({ withSubtle: true });
    const engine = ctx.globalThis.SponsorBlockEngine;
    ctx.he = async () => ({ ok: true, status: 200, json: async () => [] });
    await engine.init("abcdefghijk", { force: true });
    const urls = [];
    ctx.he = async (url, opts) => { urls.push(String(url)); return { ok: true, status: 200, text: async () => "ok" }; };
    await engine.api.voteOnSegment("aaaa1111bbbb2222cccc3333", 1);
    const voteUrl = urls.find((u) => u.indexOf("voteOnSponsorTime") >= 0);
    assert.ok(voteUrl, "SB-06: vote request issued");
    const keys = Array.from(new URL(voteUrl).searchParams.keys());
    const allowed = new Set(["UUID", "videoID", "userID", "type", "category"]);
    for (const k of keys) assert.ok(allowed.has(k), "SB-06: unexpected param '" + k + "'");
    assert.ok(keys.indexOf("type") >= 0, "SB-06: whitelisted type present");
    engine.destroy();
  }

  {
    const ctx = makeContext({ withSubtle: true });
    const engine = ctx.globalThis.SponsorBlockEngine;
    for (let i = 0; i < 300; i++) engine._audit.rememberVip("user-" + i, i % 2 === 0);
    const c = engine._audit.counts();
    assert.ok(c.vip <= 256, "SB-10: vip map capped (got " + c.vip + ")");
    assert.strictEqual(c.vip, 256);
    engine.destroy();
  }

  {
    const ctx = makeContext({ withSubtle: true });
    const engine = ctx.globalThis.SponsorBlockEngine;
    ctx.he = async () => ({ ok: true, status: 200, json: async () => [
      { UUID: "s1", category: "sponsor", segment: [1, 2] },
    ]});
    await engine.init("abcdefghijk", { force: true });
    engine._audit.markUndone("s1");
    engine.destroy();
    const c = engine._audit.counts();
    assert.strictEqual(c.segments, 0, "SB-12: segments cleared");
    assert.strictEqual(c.undone, 0, "SB-12: undone cleared");
    assert.strictEqual(c.vip, 0, "SB-12: vip map cleared");
    assert.strictEqual(c.warned, 0, "SB-12: aware-warned cleared");
    assert.strictEqual(c.wakeAt, 0, "SB-12: wake throttle reset");
  }

  console.log("Audit-fix tests (batch 3: SB) passed.");
})().catch((err) => {
  console.error("AUDIT-FIX TEST FAILURE:", err && err.stack ? err.stack : err);
  process.exit(1);
});
