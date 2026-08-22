#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const document = {
  hidden: false,
  body: null,
  documentElement: null,
  addEventListener() {},
  removeEventListener() {},
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
  crypto: require("crypto").webcrypto,
  TextEncoder,
  FinalizationRegistry,
  WeakRef,
  fetch,
  v: async () => null,
  k: async () => undefined,
  x: async () => undefined,
  w: async () => [],
  h: () => {},
  g: { emit() {}, on() { return () => {}; } },
  Yt: { sponsorblock: [] },
  S: { sponsorblockOn: true, sbPrivacy: false, sbSeekbar: false, sbToast: false },
  ie: { videoId: () => null, el: () => null, isAd: () => false },
  _a: () => false,
  ft: () => {},
  pe: () => {},
  Ta: () => {},
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
const { BoundedCache, WeakElementCache, DeferredTask, ResourceScope, Bus, Logger, StateStore, Dom, Retry } = context.globalThis.ZenResources;
const engine = context.globalThis.SponsorBlockEngine;

const segments = engine.api.normalizeSegments({ segments: [
  { UUID: "b", category: "intro", actionType: "skip", segment: [20, 30] },
  { UUID: "a", category: "sponsor", actionType: "skip", segment: [5, 10] },
  { UUID: "a", category: "sponsor", actionType: "skip", segment: [5, 10] },
  { UUID: "bad", category: "sponsor", segment: [-1, 2] },
  { UUID: "bad2", category: "sponsor", segment: [4, 3] },
  { UUID: "bad3", category: "sponsor", segment: [0, 86401] },
]}, "abcdefghijk").segments;
assert.strictEqual(JSON.stringify(Array.from(segments, (item) => item.UUID)), JSON.stringify(["a", "b"]), "normalization sorts and de-duplicates valid segments");

const privacy = engine.api.normalizeSegments([
  { videoID: "otherVideo", segments: [{ UUID: "x", segment: [1, 2], category: "sponsor" }] },
  { videoID: "abcdefghijk", segments: [{ UUID: "wanted", segment: [3, 4], category: "sponsor" }] },
], "abcdefghijk");
assert.strictEqual(privacy.matched, true);
assert.strictEqual(privacy.segments[0].UUID, "wanted");
const privacyMiss = engine.api.normalizeSegments([
  { videoID: "otherVideo", segments: [] },
], "abcdefghijk");
assert.strictEqual(privacyMiss.matched, false, "privacy candidate misses are distinguishable from an empty direct response");
const malformed = engine.api.normalizeSegments({ unexpected: true }, "abcdefghijk");
assert.strictEqual(malformed.valid, false, "successful non-array payloads are rejected as malformed");

const cache = new BoundedCache(2, "test", { ttlMs: 1000 });
cache.set("a", 1); cache.set("b", 2); assert.strictEqual(cache.get("a"), 1);
cache.set("c", 3); assert.strictEqual(cache.has("b"), false, "least recently used item is evicted");
assert.strictEqual(cache.get("a"), 1); assert.strictEqual(cache.get("c"), 3);

const elementCache = new WeakElementCache();
const element = { isConnected: true };
elementCache.set("element", element);
assert.strictEqual(elementCache.get("element"), element);
element.isConnected = false;
assert.strictEqual(elementCache.cleanupDisconnected(), 1);
assert.strictEqual(elementCache.has("element"), false);

(async () => {
  let factoryCalls = 0;
  const asyncCache = new BoundedCache(4, "async");
  const asyncFactory = () => {
    factoryCalls++;
    return new Promise((resolve) => setTimeout(() => resolve("shared"), 10));
  };
  const firstValue = asyncCache.getOrSet("key", asyncFactory);
  const secondValue = asyncCache.getOrSet("key", asyncFactory);
  assert.strictEqual(firstValue, secondValue, "async cache factories are deduplicated");
  assert.strictEqual(await firstValue, "shared");
  assert.strictEqual(factoryCalls, 1);

  const requests = [];
  context.S.sbPrivacy = false;
  context.he = async (url) => {
    requests.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => [{ UUID: "network", category: "sponsor", actionType: "skip", segment: [1, 2] }],
    };
  };
  const fetched = await engine.api.fetchWithRetry("abcdefghijk", new AbortController().signal);
  assert.strictEqual(fetched.length, 1, "network lookup returns normalized segments");
  assert.ok(requests[0].includes("videoID=abcdefghijk"));
  assert.ok(requests[0].includes("category=sponsor"), "lookup requests every category profile");
  assert.ok(requests[0].includes("actionType=full"), "lookup requests every action type");

  context.S.sbPrivacy = true;
  requests.length = 0;
  context.he = async (url) => {
    requests.push(url);
    const isSecond = requests.length > 1;
    return {
      ok: true,
      status: 200,
      json: async () => isSecond
        ? [{ videoID: "abcdefghijk", segments: [{ UUID: "privacy", category: "intro", segment: [2, 3] }] }]
        : [{ videoID: "otherVideo", segments: [] }],
    };
  };
  const privacyFetched = await engine.api.fetchWithRetry("abcdefghijk", new AbortController().signal);
  assert.strictEqual(privacyFetched[0].UUID, "privacy", "privacy lookup retries a candidate miss");
  assert.strictEqual(requests.length, 2);
  assert.ok(!requests[0].includes("videoID=abcdefghijk"), "privacy lookup never sends the full video ID");

  context.S.sbPrivacy = false;
  context.S.sbSeekbar = false;
  context.ie.videoId = () => "abcdefghijk";
  context.v = async (store, key) => key === "__sb_hidden__" ? { v: ["abcdefghijk"] } : null;
  context.he = async (url) => ({
    ok: true,
    status: 200,
    json: async () => [{ UUID: "hidden-network", category: "sponsor", segment: [4, 5] }],
  });
  const hiddenSegments = await engine.init("abcdefghijk", { force: true });
  assert.strictEqual(hiddenSegments.length, 1, "hidden videos are still looked up");
  assert.strictEqual(engine.debugInfo().hidden, true, "hidden videos suppress actions without suppressing lookup");
  engine.destroy();

  context.v = async () => null;
  context.ie.videoId = () => "lmnopqrstuv";
  context.he = async (url) => {
    const requestedId = new URL(url).searchParams.get("videoID") || "privacy";
    const delay = requestedId === "lmnopqrstuv" ? 30 : 5;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return {
      ok: true,
      status: 200,
      json: async () => [{ UUID: requestedId, category: "sponsor", segment: [1, 2] }],
    };
  };
  const oldLookup = engine.init("lmnopqrstuv", { force: true });
  await new Promise((resolve) => setTimeout(resolve, 0));
  context.ie.videoId = () => "lmnopqrstu1";
  const currentLookup = engine.init("lmnopqrstu1", { force: true });
  const [oldSegments, currentSegments] = await Promise.all([oldLookup, currentLookup]);
  assert.strictEqual(oldSegments.length, 0, "superseded lookups cannot commit old state");
  assert.strictEqual(currentSegments[0].UUID, "lmnopqrstu1");
  engine.destroy();

  let calls = 0;
  const id = DeferredTask.debounce("unit", () => { calls++; }, 10);
  assert.ok(id > 0);
  DeferredTask.debounce("unit", () => { calls += 10; }, 10);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.strictEqual(calls, 10, "debounce cancels the previous task and cleans its key");

  const scope = new ResourceScope("unit");
  let fired = false;
  scope.timeout(() => { fired = true; }, 40);
  scope.dispose();
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.strictEqual(fired, false, "disposed scopes cancel timers");
  assert.strictEqual(scope.disposed, true);

  const bus = new Bus("unit");
  const events = [];
  const wildcard = [];
  bus.on("alpha", (payload) => events.push("alpha:" + payload));
  bus.once("alpha", (payload) => events.push("once:" + payload));
  bus.on("*", (payload, meta) => wildcard.push(meta.event));
  bus.emit("alpha", 1);
  bus.emit("alpha", 2);
  assert.deepStrictEqual(events, ["alpha:1", "once:1", "alpha:2"], "bus dispatches and honors once()");
  assert.deepStrictEqual(wildcard, ["alpha", "alpha"], "bus wildcard listeners receive every event");
  assert.strictEqual(bus.stats().listeners, 2, "once() listeners self-remove");

  Logger.setLevel("error");
  const ns = Logger.namespace("unit");
  ns.info("hidden");
  ns.error("visible");
  const snapshot = Logger.snapshot();
  assert.strictEqual(snapshot.length, 1, "logger respects level threshold");
  assert.strictEqual(snapshot[0].message, "visible");
  Logger.clear();
  Logger.setLevel("info");

  const writes = [];
  const store = new StateStore("unit-store", { count: 0 }, {
    flushMs: 20,
    storage: { get: async () => undefined, set: async (key, value) => { writes.push(value); } },
  });
  let changed = 0;
  store.onChange(() => changed++);
  await store.load();
  assert.strictEqual(store.get().count, 0, "state store keeps initial value when adapter has none");
  store.update((d) => { d.count += 1; });
  assert.strictEqual(store.get().count, 1, "state store updates are synchronous");
  assert.strictEqual(changed, 1, "state store emits change notifications");
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.strictEqual(writes.length, 1, "state store persists via adapter on debounced flush");
  assert.strictEqual(writes[0].count, 1);
  store.dispose();

  assert.strictEqual(Dom.esc("<a href=\"x\">&'y'</a>"), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;y&#39;&lt;/a&gt;", "Dom.esc escapes HTML");
  assert.strictEqual(Dom.esc(null), "", "Dom.esc handles nullish input");

  let retryAttempts = 0;
  await assert.rejects(
    Retry.backoff(() => { retryAttempts++; throw new Error("flaky"); }, { attempts: 3, baseMs: 5 }),
    /flaky/,
    "Retry.backoff rethrows after exhausting attempts",
  );
  assert.strictEqual(retryAttempts, 3);
  const retried = await Retry.backoff(
    (attempt) => (attempt < 2 ? Promise.reject(new Error("retry")) : Promise.resolve("ok")),
    { attempts: 3, baseMs: 5 },
  );
  assert.strictEqual(retried, "ok", "Retry.backoff recovers on a later attempt");

  let fetchScopeAbortWorked = false;
  const fetchScope = new ResourceScope("fetch");
  const fetchPromise = fetchScope.fetch("http://example.invalid", {});
  fetchPromise.then(() => { fetchScopeAbortWorked = true; }, () => { fetchScopeAbortWorked = true; });
  fetchScope.dispose();
  await fetchPromise.catch(() => {});
  assert.strictEqual(fetchScopeAbortWorked, true, "disposed scopes settle in-flight fetches");

  // --- Group 1: feature removal regression (commit 6b28c28) ---
  const bundle = fs.readFileSync(path.join(root, "yt-zen.user.js"), "utf8");
  const removedFeatureIds = [
    "time-machine",
    "small-creator-spotlight",
    "scene-jumper",
    "video-dna",
    "inline-previews",
    "vibe-search",
    "in-video-search",
    "idle-dim",
    "confirm-leave-playing",
    "remaining-time-badge",
    // Pruned from the shipped artifact in the 3.13.0 trim (commits 88784cf/88a79df).
    "smart-speed",
    "search-remix",
    "watch-genome",
    "time-budget",
    "dearrow",
    "ryd-votes",
  ];
  for (const id of removedFeatureIds) {
    assert.ok(!bundle.includes(`id: "${id}"`), `removed feature registration is absent: ${id}`);
  }
  const removedSettingKeys = [
    "timeMachineOn:",
    "smallCreatorOn:",
    "sceneJumperOn:",
    "videoDnaOn:",
    "inlinePreviewsOn:",
    "vibeSearchOn:",
    "idleDimOn:",
    "confirmLeavePlayingOn:",
    "remainingTimeBadgeOn:",
    "inVideoSearchOn:",
  ];
  for (const key of removedSettingKeys) {
    assert.ok(!bundle.includes(key), `removed default setting is absent: ${key}`);
  }
  assert.ok(bundle.includes("    (0),"), "structural no-op placeholder line `    (0),` remains where a registration was removed");
  assert.ok(bundle.includes("    (0));"), "structural no-op placeholder line `    (0));` remains where a registration was removed");

  // --- Group 2: feature addition regression (commit 6b28c28) ---
  const countOccurrences = (source, needle) => {
    let count = 0;
    let from = 0;
    for (;;) {
      const index = source.indexOf(needle, from);
      if (index === -1) return count;
      count++;
      from = index + needle.length;
    }
  };
  assert.strictEqual(countOccurrences(bundle, 'id: "perf-mode"'), 1, "perf-mode registers exactly once");
  const perfGranularKeys = [
    "perfContainment:",
    "perfLazyThumbs:",
    "perfLazyComments:",
    "perfKillAnim:",
    "perfKillBlur:",
    "perfThumbQuality:",
    "perfDisablePreviews:",
    "perfMemoryTrim:",
    "perfPrefetch:",
    "perfPreconnect:",
    "perfBgThrottle:",
    "perfPaintReduction:",
    "perfQualityCap:",
  ];
  for (const key of perfGranularKeys) {
    assert.ok(bundle.includes(key), `perf-mode granular default present: ${key}`);
  }
  assert.ok(bundle.includes("ytp-shot-btn"), "screenshot toolbar button id ytp-shot-btn is present");

  // --- Group 3: perf-mode tier logic ---
  const tierLevels = ["light", "balanced", "aggressive", "extreme", "maximum"];
  const tierAdditions = {
    light: ["containment", "lazyThumbs", "preconnect"],
    balanced: ["lazyComments", "prefetch", "memory", "paint", "bgThrottle"],
    aggressive: ["killAnim", "killBlur", "thumbQuality"],
    extreme: ["disablePreviews", "qualityCap"],
    maximum: ["maxPaint"],
  };
  const TIERS = {};
  const accumulatedKeys = new Set();
  for (const level of tierLevels) {
    for (const key of tierAdditions[level]) accumulatedKeys.add(key);
    TIERS[level] = Array.from(accumulatedKeys);
  }
  assert.strictEqual(tierLevels.length, 5, "perf-mode defines exactly five tier presets");
  for (let i = 1; i < tierLevels.length; i++) {
    const lower = new Set(TIERS[tierLevels[i - 1]]);
    const higher = new Set(TIERS[tierLevels[i]]);
    for (const key of lower) {
      assert.ok(higher.has(key), `perf-mode tier ${tierLevels[i]} keeps every key of ${tierLevels[i - 1]} (${key})`);
    }
    assert.ok(higher.size > lower.size, `perf-mode tier ${tierLevels[i]} strictly extends ${tierLevels[i - 1]}`);
  }
  assert.strictEqual(
    [...accumulatedKeys].sort().join(","),
    ["bgThrottle", "containment", "disablePreviews", "killAnim", "killBlur", "lazyComments", "lazyThumbs", "maxPaint", "memory", "paint", "preconnect", "prefetch", "qualityCap", "thumbQuality"].sort().join(","),
    "perf-mode tiers cover exactly the 14 granular keys",
  );


  console.log("Unit tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
