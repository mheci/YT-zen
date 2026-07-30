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
const { BoundedCache, WeakElementCache, DeferredTask, ResourceScope } = context.globalThis.ZenResources;
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

  console.log("Unit tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
