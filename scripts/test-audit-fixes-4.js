#!/usr/bin/env node


"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function makeNode(tag) {
  const node = {
    tagName: String(tag || "div").toUpperCase(),
    nodeType: 1,
    children: [],
    style: {},
    attrs: {},
    listeners: {},
    textContent: "",
    setAttribute(k, v) { this.attrs[k] = String(v); },
    appendChild(c) { this.children.push(c); return c; },
    append(...cs) { for (const c of cs) this.appendChild(c); },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    remove() {},
    classList: { add() {}, remove() {}, contains() { return false; } },
  };
  return node;
}

function boot({ algoOn }) {
  const document = {
    hidden: false,
    head: makeNode("head"),
    body: makeNode("body"),
    documentElement: makeNode("html"),
    createElement: (t) => makeNode(t),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  };
  const otCalls = [];
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
    requestAnimationFrame: (fn) => setTimeout(fn, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    performance,
    crypto: require("crypto").webcrypto,
    TextEncoder,
    FinalizationRegistry,
    WeakRef,
    fetch: () => Promise.reject(new Error("offline")),
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },

    e: { location: { href: "https://www.youtube.com/", pathname: "/" }, ytInitialData: null },
    location: { href: "https://www.youtube.com/", pathname: "/", hostname: "www.youtube.com" },

    S: { algoIntelligenceOn: !!algoOn },
    Ta: () => {},
    v: async () => null,
    k: async () => undefined,
    x: async () => undefined,
    w: async () => [],
    h: () => {},
    u: () => {},
    p: () => {},
    g: { emit() {}, on() { return () => {}; } },
    Yt: {},
    ie: { videoId: () => null, el: () => null, thumb: (id) => "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg" },
    _a: () => false,
    ft: () => {},
    pe: () => {},
    qt: () => {},
    he: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    Ot: async (endpoint, body) => { otCalls.push({ endpoint, body }); return { ok: true, json: {} }; },
    Mt: () => ({ client: { clientName: "WEB", clientVersion: "2.0" } }),
    sanitizeUrlForCSS: (s) => String(s == null ? "" : s).replace(/'/g, "\\'"),
    xa: { register: () => {}, apply: () => {}, get: () => null },
    Io: () => makeNode("div"),
    No: () => makeNode("div"),
    To: () => makeNode("div"),
    So: () => makeNode("div"),
    aioEnroll: () => {},
    aioRows: () => {},
    GM_info: { script: { version: "test" } },
  });
  let src = fs.readFileSync(path.join(root, "src", "zen-resources.js"), "utf8");
  src += "\n;globalThis.ZenResources = ZenResources;\n";
  vm.runInContext(src, context, { filename: "src/zen-resources.js" });
  let ze = fs.readFileSync(path.join(root, "src", "zen-engine-v3.js"), "utf8");
  ze += "\n;globalThis.__Z = { ZenEngine, ZenDiscovery, ZenPlayback, ZenSearch, ZenSession, AlgoEngine };\n";
  vm.runInContext(ze, context, { filename: "src/zen-engine-v3.js" });
  return { Z: context.globalThis.__Z, otCalls, S: context.S };
}

(async () => {

  {
    const { Z } = boot({ algoOn: true });
    assert.ok(Z.AlgoEngine, "AlgoEngine present");
    assert.strictEqual(typeof Z.AlgoEngine.SignalInjector.extractFeedbackTokens, "undefined",
      "ZE-02: crude whole-page token extractor removed");
    assert.strictEqual(typeof Z.AlgoEngine.SignalInjector.sendFeedback, "function");
  }

  {
    const { Z, otCalls, S } = boot({ algoOn: false });
    const si = Z.AlgoEngine.SignalInjector;
    assert.strictEqual(await si.sendFeedback("tok", "notInterested"), false, "ZE-03: feedback gated");
    assert.strictEqual(await si.sendLike("abcdefghijk", "like"), false, "ZE-03: like gated");
    assert.strictEqual(await si.simulateWatch("abcdefghijk"), false, "ZE-03: watch gated");
    assert.strictEqual(otCalls.length, 0, "ZE-03: zero InnerTube calls while gated");
    S.algoIntelligenceOn = true;
    assert.strictEqual(await si.sendFeedback("tok", "notInterested"), true, "ZE-03: passes when master on");
    assert.ok(otCalls.length >= 1, "ZE-03: InnerTube used when enabled");
    assert.strictEqual(otCalls[0].endpoint, "feedback");
  }

  {
    const { Z, otCalls } = boot({ algoOn: true });
    let sentBody = null;

    await Z.ZenSearch.search("cats", "EgIYAQ%3D%3D");
    const searchCall = otCalls.find((c) => c.endpoint === "search");
    assert.ok(searchCall, "ZE-05: search issued");
    assert.strictEqual(searchCall.body.params, "EgIYAQ==", "ZE-05: encoded template decoded");
    let threw = false;
    try { await Z.ZenSearch.search("cats", "100% done"); } catch (_) { threw = true; }
    assert.strictEqual(threw, false, "ZE-05: malformed % token no longer throws");
  }

  {
    const { Z } = boot({ algoOn: false });
    const json = {
      contents: { twoColumnSearchResultsRenderer: { primaryContents: { sectionListRenderer: { contents: [
        { itemSectionRenderer: { contents: [
          { videoRenderer: { videoId: "abcdefghijk", title: { simpleText: "ok" } } },
          { videoRenderer: { videoId: "evil&id=1", title: { simpleText: "bad" } } },
          { videoRenderer: { videoId: "short", title: { simpleText: "bad2" } } },
        ]}},
      ]}}}},
    };
    const vids = Z.ZenSearch.parseSearchVideos(json);
    assert.strictEqual(vids.length, 1, "ZE-08: only canonical 11-char ids pass");
    assert.strictEqual(vids[0].videoId, "abcdefghijk");

    let clicked = 0;
    const rowBad = Z.ZenDiscovery.createVideoRow("evil&id=1", "t", "c", () => { clicked++; });
    assert.strictEqual((rowBad.listeners.click || []).length, 0, "ZE-08: invalid id gets no nav handler");
    const rowGood = Z.ZenDiscovery.createVideoRow("abcdefghijk", "t", "c", () => { clicked++; });
    assert.strictEqual(rowGood.listeners.click.length, 1, "ZE-08: valid id keeps handler");
  }

  {
    const { Z } = boot({ algoOn: true });
    const rl = Z.AlgoEngine.RateLimiter;
    rl.setScale(99);
    assert.strictEqual(rl.getScale(), 2.5, "ZE-10: scale clamped high");
    rl.setScale(0.001);
    assert.strictEqual(rl.getScale(), 0.25, "ZE-10: scale clamped low");
    rl.setScale(1);

    let allowed = 0;
    for (let i = 0; i < 15; i++) if (rl.canProceed("like")) allowed++;
    assert.strictEqual(allowed, 10, "ZE-10: like cap enforced (10/min)");
  }

  {
    const { Z } = boot({ algoOn: false });
    assert.ok(Z.ZenPlayback, "ZenPlayback present");

    assert.strictEqual(typeof Z.ZenPlayback.readEnergy, "function");
    const r = Z.ZenPlayback.readEnergy(null);
    assert.strictEqual(r.energy, 0, "ZE-04: null video → zeroed energy, no entry leak");
  }

  console.log("Audit-fix tests (batch 4: ZE) passed.");
})().catch((err) => {
  console.error("AUDIT-FIX TEST FAILURE:", err && err.stack ? err.stack : err);
  process.exit(1);
});
