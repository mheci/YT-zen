#!/usr/bin/env node


"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function makeFakeDocument() {
  const elements = new Map();
  const makeNode = (tag) => {
    const node = {
      tagName: String(tag || "div").toUpperCase(),
      nodeType: 1,
      children: [],
      style: {},
      attrs: {},
      _innerHTMLWrites: 0,
      set innerHTML(v) { this._innerHTMLWrites++; this._innerHTML = String(v); },
      get innerHTML() { return this._innerHTML; },
      set className(v) { this._class = String(v); },
      get className() { return this._class || ""; },
      set textContent(v) { this._text = String(v); },
      get textContent() { return this._text || ""; },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      appendChild(child) { this.children.push(child); return child; },
      remove() {},
      matches() { return false; },
      querySelector() { return null; },
      contains() { return false; },
    };
    return node;
  };
  const doc = {
    hidden: true,
    head: makeNode("head"),
    documentElement: makeNode("html"),
    body: makeNode("body"),
    createElement: (tag) => makeNode(tag),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
    getElementById: (id) => elements.get(id) || null,
    addEventListener() {},
    removeEventListener() {},
  };
  return doc;
}

const moLog = [];
class FakeMutationObserver {
  constructor(cb) { this.cb = cb; this.queued = []; this.observing = false; moLog.push(this); }
  observe(root, config) { this.observing = true; this.lastConfig = config; }
  disconnect() { this.observing = false; }
  takeRecords() { const q = this.queued; this.queued = []; return q; }

  inject(records) { this.queued.push(...records); }
}

const document = makeFakeDocument();
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
  crypto: require("crypto").webcrypto,
  TextEncoder,
  FinalizationRegistry,
  WeakRef,
  fetch: () => Promise.reject(new Error("offline")),
  MutationObserver: FakeMutationObserver,

  v: async () => null,
  k: async () => undefined,
  x: async () => undefined,
  w: async () => [],
  h: () => {},
  g: { emit() {}, on() { return () => {}; } },
  Yt: {},
  S: {},
  ie: { videoId: () => null, el: () => null },
  _a: () => false,
  ft: () => {},
  pe: () => {},
  Ta: () => {},
  GM_info: { script: { version: "test" } },
});

const source = fs.readFileSync(path.join(root, "src", "zen-resources.js"), "utf8") +
  "\n;globalThis.ZenResources = ZenResources;\n";
vm.runInContext(source, context, { filename: "src/zen-resources.js" });
const Z = context.globalThis.ZenResources;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {

  {
    const bus = new Z.Bus("t");
    let syncSeen = 0, asyncSeen = 0;
    bus.on("e", () => { syncSeen++; });
    bus.on("e", () => new Promise((res) => { asyncSeen++; setTimeout(res, 5); }));
    const n = bus.emit("e", {});
    assert.strictEqual(n, 2, "ZR-01: emit counts async listeners");
    assert.strictEqual(syncSeen, 1);

    bus.on("e2", () => Promise.reject(new Error("boom")));
    bus.on("e2", () => 1);
    assert.strictEqual(bus.emit("e2", {}), 2, "ZR-01: rejecting listener still counted");
    await sleep(10);
    assert.strictEqual(asyncSeen, 1);
  }

  {
    Z.SharedObserver.clear();
    moLog.length = 0;
    const seen = [];

    const id1 = Z.SharedObserver.subscribe((muts) => seen.push(["a", muts.length]), {});
    assert.ok(moLog.length === 1 && moLog[0].observing, "observer created");
    const mo1 = moLog[0];

    mo1.inject([{ type: "childList", target: document.body, addedNodes: [], removedNodes: [] }]);
    const id2 = Z.SharedObserver.subscribe((muts) => seen.push(["b", muts.length]), { attributes: true, attributeFilter: ["class"] });
    assert.ok(moLog.length === 2, "re-observed on config change");
    await sleep(40);
    const delivered = seen.reduce((acc, [, n]) => acc + n, 0);
    assert.ok(delivered >= 1, "ZR-03: queued record survived reconfigure (delivered=" + delivered + ")");

    const before = moLog.length;
    const id3 = Z.SharedObserver.subscribe(() => {}, { attributes: true, attributeFilter: ["class"] });
    assert.strictEqual(moLog.length, before, "ZR-03: identical config keeps observer");
    Z.SharedObserver.unsubscribe(id1);
    Z.SharedObserver.unsubscribe(id2);
    Z.SharedObserver.unsubscribe(id3);
    Z.SharedObserver.clear();
  }

  {
    const cache = new Z.BoundedCache(8, "t");
    let calls = 0;
    const factory = () => { calls++; return undefined; };
    cache.getOrSet("k", factory);
    cache.getOrSet("k", factory);
    assert.strictEqual(calls, 1, "ZR-04: undefined result cached, no re-fetch loop");
    let calls0 = 0;
    cache.getOrSet("z", () => { calls0++; return 0; });
    assert.strictEqual(cache.getOrSet("z", () => { calls0++; return 999; }), 0);
    assert.strictEqual(calls0, 1, "ZR-04: zero value cached");
  }

  {
    const node = Z.Dom.el("div", { html: "<img src=x onerror=alert(1)>", text: "safe" });
    assert.ok(node, "el() returns node");
    assert.strictEqual(node._innerHTMLWrites, 0, "ZR-05: html prop must not assign innerHTML");
    assert.strictEqual(node.textContent, "safe");
  }

  {
    assert.strictEqual(Z.Dom.esc(`<>&"'`), "&lt;&gt;&amp;&quot;&#39;");
    assert.strictEqual(Z.Dom.esc(null), "");
    assert.strictEqual(Z.Dom.esc(5), "5");
  }

  {
    let stored = { a: 1, fromStorage: "kept", shared: "storage-version" };
    const storage = {
      get: async () => { await sleep(30); return stored; },
      set: async () => {},
    };
    const store = new Z.StateStore("t", { a: 0, shared: "memory-version" }, { storage, flushMs: 50 });
    const p = store.load();
    store.update((d) => { d.a = 42; });
    await p;
    const d = store.get();
    assert.strictEqual(d.a, 42, "ZR-07: in-memory mutation wins");
    assert.strictEqual(d.shared, "memory-version", "ZR-07: overlapping key keeps memory value");
    assert.strictEqual(d.fromStorage, "kept", "ZR-07: stored keys filled in, not discarded");
    store.dispose();
  }

  {
    let failNext = true;
    let setCalls = 0;
    const storage = {
      get: async () => undefined,
      set: async () => { setCalls++; if (failNext) { failNext = false; throw new Error("quota"); } },
    };
    const store = new Z.StateStore("t2", { x: 1 }, { storage, flushMs: 50 });
    store.set({ x: 2 });
    const ok = await store.flush();
    assert.strictEqual(ok, false, "ZR-08: failed persistence reports false");
    assert.strictEqual(store.stats().dirty, true, "ZR-08: store stays dirty after failure");
    const ok2 = await store.flush();
    assert.strictEqual(ok2, true, "ZR-08: retry succeeds");
    assert.strictEqual(store.stats().dirty, false, "ZR-08: clean only after success");
    assert.ok(setCalls >= 2);
    store.dispose();
  }

  {
    const T = Z.TimeWindow;
    assert.strictEqual(T.parseHHMM("07:05"), 425);
    assert.strictEqual(T.parseHHMM("9:5"), null, "single-digit minutes rejected");
    assert.strictEqual(T.parseHHMM("24:00"), null, "hours>23 rejected");
    assert.strictEqual(T.parseHHMM("12:60"), null, "minutes>59 rejected");
    assert.strictEqual(T.parseHHMM("00:00"), 0);
    assert.strictEqual(T.contains(10, 20, 15), true);
    assert.strictEqual(T.contains(20, 10, 5), true, "overnight window");
    assert.strictEqual(T.contains(10, 10, 10), false, "equal start/end = empty");
  }

  {
    const log = Z.Logger.namespace("zrtest");
    const cyc = { n: 1 }; cyc.self = cyc;
    log.info("cyclic", cyc);
    const snap = Z.Logger.snapshot(10).filter((e) => e.ns === "zrtest");
    assert.ok(snap.length === 1, "ZR-11: cyclic log captured");
    assert.ok(/\[Circular\]/.test(snap[0].message), "ZR-11: cycle rendered as [Circular]");
    Z.Logger.clear();
  }

  {

    const order = [];
    const scope = new Z.ResourceScope();
    scope.addCleanup(() => order.push(1));
    scope.addCleanup(() => order.push(2));
    scope.dispose();
    scope.dispose();
    assert.deepStrictEqual(order, [2, 1], "ZR-09: LIFO single-pass cleanups");

    let ticks = 0;
    const id = Z.SharedTicker.add(() => { ticks++; }, 20, { pauseHidden: false });
    await sleep(70);
    Z.SharedTicker.remove(id);
    const after = ticks;
    assert.ok(after >= 2, "ZR-12: ticker fired (" + after + ")");
    await sleep(50);
    assert.strictEqual(ticks, after, "ZR-12: removed task stops");
    Z.SharedTicker.clear();
  }

  console.log("Audit-fix tests (batch 1: ZR) passed.");
})().catch((err) => {
  console.error("AUDIT-FIX TEST FAILURE:", err && err.message ? err.message : err);
  process.exit(1);
});
