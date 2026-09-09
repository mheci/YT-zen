#!/usr/bin/env node
/* ZenResources primitive regression suite. Run: node scripts/test-zen.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");

function boot() {
  const document = { hidden: false, body: {}, documentElement: {}, addEventListener(){}, removeEventListener(){} };
  const context = vm.createContext({
    console, document, window: {}, globalThis: {}, URL, URLSearchParams,
    AbortController, DOMException, setTimeout, clearTimeout, setInterval, clearInterval,
    performance, crypto: require("crypto").webcrypto, FinalizationRegistry, WeakRef,
  });
  let src = fs.readFileSync(path.join(root, "src/zen-resources.js"), "utf8");
  src += "\n;globalThis.ZenResources = ZenResources;";
  vm.runInContext(src, context, { filename: "src/zen-resources.js" });
  return { Z: context.globalThis.ZenResources, vmDate: vm.runInContext("Date", context) };
}
const { Z, vmDate } = boot();
const { Bus, Logger, Retry, TimeWindow, TrackedBlobURL, DeferredTask, AbortGroup, ResourceScope, StateStore, ScanScheduler, SharedTicker } = Z;

const tests = [];
const t = (name, fn) => tests.push({ name, fn });

// ---- Bus
t("Bus on/emit/off/once/wildcard", () => {
  const b = new Bus("x"); let s = "";
  b.on("a", v => s += "a" + v); const wid = b.on("*", v => s += "*" + v);
  b.emit("a", 1); if (s !== "a1*1") throw new Error("got " + s);
  b.off("*", wid); b.emit("a", 2); if (s !== "a1*1a2") throw new Error("wildcard not removed: " + s);
  const o = new Bus(); let n = 0; o.once("e", () => n++); o.emit("e"); o.emit("e"); if (n !== 1) throw new Error("once");
});
t("Bus listener throw does not break other listeners", () => {
  const b = new Bus(); let called = 0;
  b.on("a", () => { throw new Error("boom"); }); b.on("a", () => called++);
  b.emit("a"); if (called !== 1) throw new Error("sibling not called");
});
// ---- Logger
t("Logger threshold + ring cap", () => {
  Logger.clear(); Logger.setLevel(Logger.LEVELS.warn);
  const L = Logger.namespace("t"); L.debug("d"); L.warn("w");
  const snap = Logger.snapshot(50);
  if (!snap.some(e => e.ns === "t" && e.level === "warn")) throw new Error("warn missing");
  if (snap.some(e => e.level === "debug")) throw new Error("debug below warn threshold leaked");
  for (let i = 0; i < 230; i++) L.warn("x" + i);
  if (Logger.snapshot().length > 200) throw new Error("ring exceeded cap");
  Logger.setLevel(Logger.LEVELS.info);
});
// ---- Retry
t("Retry.backoff retries then resolves on success", async () => {
  let n = 0;
  const v = await Retry.backoff(async () => { n++; if (n < 3) throw new Error("r"); return 42; }, { attempts: 5, baseMs: 1, maxMs: 5 });
  if (v !== 42 || n !== 3) throw new Error("retry semantics");
});
t("Retry.backoff rethrows after exhausting attempts", async () => {
  let n = 0;
  let threw = false;
  try { await Retry.backoff(async () => { n++; throw new Error("always"); }, { attempts: 4, baseMs: 1, maxMs: 5 }); } catch (e) { threw = true; }
  if (!threw || n !== 4) throw new Error("exhaust not thrown");
});
t("Retry.backoff obeys shouldRetry", async () => {
  let n = 0; let threw = false;
  try { await Retry.backoff(async () => { n++; throw new Error("x"); }, { attempts: 10, baseMs: 1, maxMs: 2, shouldRetry: () => false }); } catch (e) { threw = true; }
  if (!threw || n !== 1) throw new Error("shouldRetry false must stop after first");
});
// ---- TimeWindow
t("TimeWindow contains/parse semantics", () => {
  if (TimeWindow.contains(22*60, 7*60, 23*60) !== true) throw new Error("wraps past midnight");
  if (TimeWindow.contains(22*60, 7*60, 9*60) !== false) throw new Error("outside wrap");
  if (TimeWindow.contains(9*60, 17*60, 12*60) !== true) throw new Error("within day");
  if (TimeWindow.contains(9*60, 17*60, 8*60) !== false) throw new Error("before day window");
  if (TimeWindow.contains(5*60, 5*60, 5*60) !== false) throw new Error("empty window inactive");
  if (TimeWindow.parseHHMM("25:00") !== null) throw new Error("hour range");
  if (TimeWindow.parseHHMM("7:5") !== null) throw new Error("minute pad");
  if (TimeWindow.parseHHMM("09:30") !== 9*60+30) throw new Error("parse");
  if (TimeWindow.containsHHMM("22:00","07:00", new vmDate(2026,0,1,23,0)) !== true) throw new Error("HHMM wrap");
  if (TimeWindow.containsHHMM("bad","07:00", new vmDate()) !== false) throw new Error("malformed disables");
});
// ---- AbortGroup
t("AbortGroup group + abortAll", () => {
  const a = AbortGroup.create("g1"); const b2 = AbortGroup.create("g1");
  AbortGroup.abort("g1"); if (!(a.signal.aborted && b2.signal.aborted)) throw new Error("group abort");
  const c = AbortGroup.create("g2"); AbortGroup.abortAll(); if (!c.signal.aborted) throw new Error("abortAll");
});
// ---- ResourceScope
t("ResourceScope.dispose clears intervals/timeouts", async () => {
  const s = new ResourceScope("r"); let fired = 0;
  s.interval(() => fired++, 5); s.timeout(() => fired++, 5);
  s.dispose(); await new Promise(r => setTimeout(r, 25)); if (fired !== 0) throw new Error("timer leaked: " + fired);
});
// ---- StateStore
t("StateStore.update + flush to adapter", async () => {
  const store = {};
  const st = new StateStore("k", { a: 1 }, { storage: { get: async k => store[k], set: async (k, v) => { store[k] = v; } }, flushMs: 5 });
  st.update(d => { d.b = 2; }); st.update(d => { d.c = 3; });
  await new Promise(r => setTimeout(r, 180)); if (!store.k || store.k.c !== 3) throw new Error("flush missed coalesced update");
  st.dispose();
});
// ---- ScanScheduler
t("ScanScheduler start/dispose + adaptive stats", () => {
  const sc = ScanScheduler.create(() => 0, { intervalMs: 500, label: "scan-y" });
  if (!sc) throw new Error("create failed"); sc.start(); sc.request({ priority: true }); sc.dispose();
  if (sc.stats().active !== false) throw new Error("dispose did not stop ticker");
});
// ---- DeferredTask
t("DeferredTask.debounce collapses", async () => {
  let n = 0;
  DeferredTask.debounce("k1", () => n++, 10); DeferredTask.debounce("k1", () => n++, 10); DeferredTask.debounce("k1", () => n++, 10);
  await new Promise(r => setTimeout(r, 50)); if (n !== 1) throw new Error("debounced ran " + n);
  DeferredTask.cancelAll();
});
t("DeferredTask.cancel stops pending", async () => {
  let n = 0; const id = DeferredTask.schedule(() => n++, 5, { mode: "timeout", delayMs: 5 });
  DeferredTask.cancel(id); await new Promise(r => setTimeout(r, 20)); if (n !== 0) throw new Error("cancelled task ran");
});
// ---- SharedTicker
t("SharedTicker runs then stops on remove", async () => {
  let n = 0; const id = SharedTicker.add(() => n++, 20, { pauseHidden: false });
  await new Promise(r => setTimeout(r, 60)); if (n < 1) throw new Error("ticker never ran");
  SharedTicker.remove(id); const after = n; await new Promise(r => setTimeout(r, 60)); if (n !== after) throw new Error("removed task kept ticking");
});

(async () => {
  let pass = 0;
  for (const test of tests) {
    try { await test.fn(); pass++; } catch (e) { console.error("FAIL:", test.name, e.message || e); process.exitCode = 1; return; }
  }
  console.log("[test-zen] passed:", pass + "/" + tests.length);
  process.exit(process.exitCode || 0);
})();
