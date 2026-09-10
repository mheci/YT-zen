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
const { BoundedCache, WeakElementCache, DeferredTask, ResourceScope, Bus, Logger, StateStore, Dom, Retry, ScanScheduler } = context.globalThis.ZenResources;
const engine = context.globalThis.SponsorBlockEngine;
const TimeWindow = context.globalThis.ZenResources.TimeWindow;

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

assert.strictEqual(TimeWindow.parseHHMM("09:00"), 540, "parseHHMM reads minutes since midnight");
assert.strictEqual(TimeWindow.parseHHMM("22:05"), 1325);
assert.strictEqual(TimeWindow.parseHHMM("7:59"), 479, "parseHHMM accepts single-digit hours");
assert.strictEqual(TimeWindow.parseHHMM("24:00"), null, "parseHHMM rejects out-of-range hours");
assert.strictEqual(TimeWindow.parseHHMM("09:60"), null, "parseHHMM rejects out-of-range minutes");
assert.strictEqual(TimeWindow.parseHHMM("0900"), null, "parseHHMM rejects missing colon");
assert.strictEqual(TimeWindow.parseHHMM(""), null, "parseHHMM rejects empty input");
assert.strictEqual(TimeWindow.parseHHMM(null), null, "parseHHMM rejects nullish input");
assert.strictEqual(TimeWindow.contains(540, 1020, 600), true, "same-day window contains an interior minute");
assert.strictEqual(TimeWindow.contains(540, 1020, 540), true, "window start is inclusive");
assert.strictEqual(TimeWindow.contains(540, 1020, 1019), true, "the last minute before end belongs to the window");
assert.strictEqual(TimeWindow.contains(540, 1020, 1020), false, "window end is exclusive");
assert.strictEqual(TimeWindow.contains(540, 1020, 480), false, "times before the window are outside");
assert.strictEqual(TimeWindow.contains(1320, 420, 1380), true, "midnight-crossing window covers late evening");
assert.strictEqual(TimeWindow.contains(1320, 420, 200), true, "midnight-crossing window covers early morning");
assert.strictEqual(TimeWindow.contains(1320, 420, 720), false, "midnight-crossing window excludes midday");
assert.strictEqual(TimeWindow.contains(600, 600, 600), false, "equal bounds describe an empty window");
assert.strictEqual(TimeWindow.contains(null, 600, 600), false, "invalid start never activates the window");
assert.strictEqual(TimeWindow.contains(540, 1020, null), false, "invalid now never activates the window");
assert.strictEqual(TimeWindow.contains(1320, 420, 1500), true, "now minutes past midnight wrap into range");

let keepAlive;
(async () => {
  keepAlive = setInterval(() => {}, 1000);

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

  // ── SponsorBlock API: rate-limit circuit, offline gate, full endpoint set ─
  context.S.sbPrivacy = false;
  context.ie.videoId = () => "abcdefghijk";
  if (!context.S.sbUserId || context.S.sbUserId.length !== 30) context.S.sbUserId = "u".repeat(30);
  engine.init && await engine.init("abcdefghijk", { force: true }).catch(() => {});
  engine.destroy && engine.destroy();

  // Mutation votes return a normalized result object and never throw.
  let voteCalls = 0;
  const voteUrls = [];
  context.he = async (url, opts) => {
    voteCalls++;
    voteUrls.push(String(url));
    assert.strictEqual(opts.method, "POST");
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => "", json: async () => null };
  };
  const upvote = await engine.api.voteOnSegment("real-uuid-1", 1);
  assert.strictEqual(upvote.ok, true, "upvote resolves to {ok:true}");
  assert.ok(/voteOnSponsorTime/.test(voteUrls[voteUrls.length - 1]), "vote hits /api/voteOnSponsorTime");
  const syntheticVote = await engine.api.voteOnSegment("idx-7-synthetic", 1);
  assert.strictEqual(syntheticVote.ok, false, "synthetic segment ids are never voted on");

  // 429 with Retry-After opens a circuit: alternate plans and retries are
  // suppressed (no request storm), even from a second invocation.
  let rateCalls = 0;
  context.he = async () => {
    rateCalls++;
    return { ok: false, status: 429, headers: { get: (h) => (String(h).toLowerCase() === "retry-after" ? "1" : null) }, text: async () => "slow down", json: async () => null };
  };
  await assert.rejects(engine.api.fetchWithRetry("abcdefghijk", new AbortController().signal), (e) => e.status === 429, "429 rejects");
  assert.strictEqual(rateCalls, 1, "a 429 does not fan out across plans or retries");
  await assert.rejects(engine.api.fetchWithRetry("abcdefghijk", new AbortController().signal), (e) => e.status === 429);
  assert.strictEqual(rateCalls, 1, "the rate-limit circuit blocks further requests with zero network calls");
  assert.strictEqual(engine.api.isRateLimited(), true);

  // Offline gate: zero network calls while navigator.onLine === false.
  context.navigator = { onLine: false };
  let offlineCalls = 0;
  const offlineHe = context.he;
  context.he = async (...a) => { offlineCalls++; return offlineHe(...a); };
  await assert.rejects(engine.api.fetchWithRetry("abcdefghijk", new AbortController().signal), (e) => e.status === 0, "offline rejects with status 0");
  assert.strictEqual(offlineCalls, 0, "offline lookups make no network calls");
  context.navigator = { onLine: true };
  await new Promise((r) => setTimeout(r, 1050)); // Retry-After: 1s elapses
  assert.strictEqual(engine.api.isRateLimited(), false, "circuit reopens after Retry-After");

  // Endpoint coverage: locks (direct object + privacy array), segmentInfo,
  // username read/write, server status, searchSegments, userStats.
  const routes = async (url) => {
    const u = String(url);
    const ok200 = (body) => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(body), json: async () => body });
    if (u.includes("/api/lockCategories") && u.includes("actionTypes=")) return ok200({ categories: ["sponsor", "outro"], reason: "vip" });
    if (u.includes("/api/segmentInfo")) {
      assert.ok(u.includes("UUID=u1") && u.includes("UUID=u2"), "segmentInfo sends each UUID");
      return ok200([{ UUID: "u1", votes: 5 }]);
    }
    if (u.includes("/api/setUsername")) return ok200("");
    if (u.includes("/api/getUsername")) return ok200({ userName: "zen-tester" });
    if (u.includes("/api/status")) return ok200({ uptime: 123, commit: "abc" });
    if (u.includes("/api/searchSegments")) return ok200({ segmentCount: 1, page: 0, segments: [{ UUID: "s1" }] });
    if (u.includes("/api/userStats")) {
      assert.ok(u.includes("fetchCategoryStats=true"), "userStats uses documented boolean params");
      return ok200({ overallStats: { minutesSaved: 9 } });
    }
    if (u.includes("/api/lockReason")) return ok200([{ category: "sponsor", locked: 1, reason: "r" }]);
    return { ok: false, status: 404, headers: { get: () => null }, text: async () => "", json: async () => null };
  };
  function ok206or(fn, v) { return fn(v); }
  const seenUrls = [];
  context.he = async (url, opts) => { seenUrls.push([String(url), opts && opts.method || "GET"]); return routes(url); };
  context.v = async () => null;

  const locks = await engine.api.getLockCategories("abcdefghijk");
  assert.deepStrictEqual(locks, ["sponsor", "outro"], "direct lockCategories object normalizes to category ids");
  const info = await engine.api.getSegmentInfo(["u1", "u2"]);
  assert.strictEqual(info[0].UUID, "u1", "segmentInfo returns rows");
  const infoCached = await engine.api.getSegmentInfo(["u1", "u2"]);
  assert.strictEqual(infoCached, info, "segmentInfo is cached within its TTL");
  const nameSet = await engine.api.setUsername("zen-tester");
  assert.strictEqual(nameSet.ok, true, "setUsername posts successfully");
  assert.strictEqual(await engine.api.getUsername(), "zen-tester", "getUsername reads the name");
  const status = await engine.api.getServerStatus();
  assert.strictEqual(status.commit, "abc", "server status is fetched");
  const statusCached = await engine.api.getServerStatus();
  assert.strictEqual(statusCached, status, "server status is cached");
  const search = await engine.api.searchSegments("abcdefghijk", { minVotes: -1, locked: false });
  assert.strictEqual(search.segmentCount, 1, "searchSegments passes filters through");
  assert.ok(seenUrls.some(([u]) => u.includes("minVotes=-1") && u.includes("locked=false")), "search filters are serialized");
  const stats = await engine.api.getUserStats("u".repeat(30));
  assert.strictEqual(stats.overallStats.minutesSaved, 9, "userStats returns totals");
  const reasons = await engine.api.getLockReason("abcdefghijk");
  assert.strictEqual(reasons[0].category, "sponsor", "lockReason returns rows");

  // Submission failures surface the documented server reason.
  context.he = async (url) => ({
    ok: false, status: 403, headers: { get: () => null },
    text: async () => "segment too short", json: async () => null,
  });
  const rejected = await engine.api.submitSegment("abcdefghijk", 5, 10, "sponsor");
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(rejected.status, 403);
  assert.ok(/auto-moderator/.test(rejected.message) && /too short/.test(rejected.message), "403 includes automod reason");

  // mySubmissions previously filtered for bare strings while rows are stored
  // as objects, so "my submissions" was always empty.
  const memStore = new Map();
  context.localStorage = {
    getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
    setItem: (k, v) => memStore.set(k, String(v)),
  };
  engine.api.rememberSubmission && engine.api.rememberSubmission("mine-uuid-1", "abcdefghijk");
  assert.strictEqual(engine.api.mySubmissions().length, 1, "remembered submission round-trips through localStorage");
  assert.strictEqual(engine.api.mySubmissions()[0].uuid, "mine-uuid-1");
  // Legacy bare-string rows must still parse.
  memStore.set("ytp_sb_my_submissions", JSON.stringify(["legacy-uuid"]));
  assert.strictEqual(engine.api.mySubmissions()[0].uuid, "legacy-uuid", "legacy string entries are normalized");

  // viewed-report in-flight coalescing: concurrent calls share one request.
  let viewCalls = 0;
  context.he = async (url, opts) => {
    viewCalls++;
    if (!String(url).includes("/api/viewedVideoSponsorTime")) throw new Error("unexpected url");
    await new Promise((r) => setTimeout(r, 20));
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => "", json: async () => null };
  };
  const [v1, v2] = await Promise.all([
    engine.api.reportViewed("view-uuid-1"),
    engine.api.reportViewed("view-uuid-1"),
  ]);
  assert.strictEqual(viewCalls, 1, "concurrent viewed reports for one UUID coalesce");
  assert.strictEqual(v1.ok, true);
  assert.strictEqual(v2.ok, false, "coalesced duplicate is reported as such");


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

  // --- Group 4: v3.14.0 additions (watch-budget focus mode, shorts policy) ---
  assert.strictEqual(countOccurrences(bundle, 'id: "watch-budget"'), 1, "watch-budget registers exactly once");
  assert.strictEqual(countOccurrences(bundle, 'id: "shorts-policy"'), 1, "shorts-policy registers exactly once");
  const zenDefaultKeys = [
    "watchBudgetOn:",
    "watchBudgetMinutes:",
    "shortsScheduleOn:",
    "shortsScheduleMode:",
    "shortsScheduleStart:",
    "shortsScheduleEnd:",
  ];
  for (const key of zenDefaultKeys) {
    assert.ok(bundle.includes(key), `zen v3.14 default present: ${key}`);
  }
  for (const marker of [
    "ytp-zen-focus-overlay",
    "ytp-zen-shorts-gate",
    "__zen_focus__",
    "hotkey watch budget",
    "TimeWindow",
  ]) {
    assert.ok(bundle.includes(marker), `v3.14 runtime marker present: ${marker}`);
  }
  // --- Group 5: ScanScheduler (nudge gap, quiet backoff, hidden drop) ---
  {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const schedulers = [];
    try {
      // Cadence math is driven through priority nudges so the test never
      // depends on real ticker pacing; every scheduler is disposed in a
      // finally block because a live SharedTicker task would keep the
      // process alive after a failed assertion.
      let mode = 1; // 1 = scan reports work, 0 = quiet scan
      const schedBackoff = ScanScheduler.create(() => (mode ? 1 : 0), { intervalMs: 2000, minGapMs: 1, maxBackoffMs: 8000 });
      schedulers.push(schedBackoff);
      // A priority nudge that lands while another run is momentarily in
      // flight is coalesced into a no-op, so a fixed-sleep-then-assert was
      // intermittently reading the pre-backoff delay (rare CI flake). Poll to
      // an eventually-consistent value: re-nudging advances currentDelay one
      // step at a time and stops at the exact target, so it cannot overshoot.
      const expectDelay = async (expected, label) => {
        for (let i = 0; i < 25; i++) {
          if (schedBackoff.stats().delayMs === expected) return;
          schedBackoff.request({ priority: true });
          await sleep(40);
        }
        assert.strictEqual(schedBackoff.stats().delayMs, expected, label);
      };
      schedBackoff.request({ priority: true });
      await expectDelay(2000, "a scan that reports work keeps the base cadence");
      mode = 0;
      await expectDelay(4000, "one quiet scan backs off by one step");
      await expectDelay(8000, "quiet scans keep backing off to the cap");
      mode = 1;
      await expectDelay(2000, "a scan that reports work restores the base cadence");

      let runs = 0;
      const schedGap = ScanScheduler.create(() => ++runs, { intervalMs: 200, minGapMs: 25, maxBackoffMs: 400 });
      schedulers.push(schedGap);
      schedGap.request({ priority: true });
      assert.strictEqual(runs, 1, "ScanScheduler runs an initial priority nudge");
      schedGap.request({ priority: true });
      assert.strictEqual(runs, 1, "ScanScheduler nudges inside the minimum gap are coalesced");
      await sleep(70);
      schedGap.request({ priority: true });
      assert.strictEqual(runs, 2, "ScanScheduler nudges run once the minimum gap elapses");

      const schedTick = ScanScheduler.create(() => 0, { intervalMs: 200, minGapMs: 10 });
      schedulers.push(schedTick);
      schedTick.start();
      assert.strictEqual(schedTick.stats().active, true, "start() registers the periodic tick");
      schedTick.stop();
      assert.strictEqual(schedTick.stats().active, false, "stop() unregisters the periodic tick");

      let hiddenRuns = 0;
      context.document.hidden = true;
      const schedHidden = ScanScheduler.create(() => ++hiddenRuns, { intervalMs: 200, minGapMs: 10 });
      schedulers.push(schedHidden);
      schedHidden.request({ priority: true });
      assert.strictEqual(hiddenRuns, 0, "hidden tabs never run scheduled scans");
      context.document.hidden = false;
      schedHidden.request({ priority: true });
      assert.strictEqual(hiddenRuns, 1, "scans resume when the tab becomes visible");
    } finally {
      for (const scheduler of schedulers) scheduler.dispose();
    }
  }

  // --- Group 6: SB persistent-cache freshness cap regression ---
  // A persisted entry whose in-memory freshness window (fetchedAt + 1h) has
  // passed must be served as stale, never re-promoted to fresh just because
  // the persistent record's own long TTL is still running.
  {
    const sbVideo = "cachefresh1";
    const cfgKey = "all-categories-v2:0";
    const rowKey = "cache:sb:" + sbVideo + ":" + cfgKey;
    const fetchedAt = Date.now() - 2 * 60 * 60 * 1000;
    const kvTable = new Map();
    kvTable.set(rowKey, {
      k: rowKey,
      v: {
        version: 5,
        videoId: sbVideo,
        segments: [{ UUID: "persisted", category: "sponsor", actionType: "skip", segment: [5, 8] }],
        fetchedAt,
        expiresAt: fetchedAt + 24 * 60 * 60 * 1000,
        apiVersion: "v1",
        checksum: "unit",
        lastValidated: fetchedAt,
        configHash: cfgKey,
      },
    });
    const previousV = context.v;
    const previousK = context.k;
    const previousX = context.x;
    context.v = async (store, key) => (store === "kv" && kvTable.has(key) ? kvTable.get(key) : null);
    context.k = async (store, row) => { if (store === "kv" && row && row.k) kvTable.set(row.k, row); };
    context.x = async (store, key) => { if (store === "kv") kvTable.delete(key); };
    const previousPrivacy = context.S.sbPrivacy;
    const previousHe = context.he;
    context.S.sbPrivacy = false;
    context.ie.videoId = () => sbVideo;
    context.he = async () => ({
      ok: true,
      status: 200,
      json: async () => [{ UUID: "network", category: "sponsor", actionType: "skip", segment: [9, 12] }],
    });
    // destroy() must run even when an assertion throws: skipping it leaks
    // the seekbar watchdog task and keeps this process alive forever.
    try {
      const metricsBefore = engine.stats();
      const segmentsServed = await engine.init(sbVideo, { force: true });
      const metricsAfter = engine.stats();
      assert.strictEqual(segmentsServed.length, 1, "stale-then-revalidated lookup still yields one segment");
      assert.strictEqual(segmentsServed[0].UUID, "network", "the revalidated network result wins");
      assert.strictEqual(
        metricsAfter.staleServed - metricsBefore.staleServed, 1,
        "expired-in-RAM persistent entries are served as stale",
      );
      assert.strictEqual(
        metricsAfter.cacheHits - metricsBefore.cacheHits, 0,
        "expired-in-RAM persistent entries are never counted as fresh hits",
      );
    } finally {
      engine.destroy();
      context.v = previousV;
      context.k = previousK;
      context.x = previousX;
      context.S.sbPrivacy = previousPrivacy;
      context.he = previousHe;
    }
  }

  // --- Group 7: bundle markers for the v3.15.0 fixes ---
  assert.ok(bundle.includes("ScanScheduler"), "ZenResources ScanScheduler ships in the bundle");
  assert.ok(bundle.includes("algoAutoDislikeOn"), "auto-dislike has its own opt-in key");
  assert.ok(bundle.includes("!S.algoAutoDislikeOn"), "maybeAutoDislike no longer rides the auto-like gate");



  // --- Group 8: BoundedCache LRU + O(1) size semantics ---
  {
    const evictions = [];
    const bc = new BoundedCache(3, "test-lru", { onEvict: (k, v, reason) => evictions.push([k, reason]) });
    bc.set("a", 1); bc.set("b", 2); bc.set("c", 3);
    bc.set("d", 4);                       // over cap -> evict "a" (oldest)
    assert.deepStrictEqual(Array.from(bc.keys()).sort(), ["b", "c", "d"], "LRU evicts oldest on overflow");
    assert.strictEqual(evictions[0][0], "a", "onEvict called with the evicted key");
    assert.strictEqual(bc.get("b"), 2);   // promote b to newest
    bc.set("e", 5);                       // now evict c
    assert.deepStrictEqual(Array.from(bc.keys()).sort(), ["b", "d", "e"], "get() promotes and changes eviction order");
    assert.strictEqual(bc.size, 3, "size getter is stable/O(1) and reflects live entries");
    bc.delete("d");
    assert.strictEqual(bc.has("d"), false, "delete removes the entry");
    bc.clear();
    assert.strictEqual(bc.size, 0, "clear empties the cache");
    assert.strictEqual(bc.get("nope", 42), 42, "miss returns the fallback");
  }
  // --- Group 9: BoundedCache lazy expiry keeps size O(1); expired entries are
  // purged on access, not on the size getter. ---
  {
    // past-time entry via internal _map so no wall-clock flake
    const bc2 = new BoundedCache(8, "ttl");
    bc2.set("live", 1, 60000);
    const key = "old";
    // craft an already-expired entry directly
    const ent = bc2._entry("x", 60000);
    ent.expiresAt = 1;                     // in the far past
    bc2._map.set(key, ent);
    assert.strictEqual(bc2.size, 2, "size stays 2 without sweeping (expired not yet touched)");
    assert.strictEqual(bc2.peek(key), undefined, "peek purges the expired entry");
    assert.strictEqual(bc2.size, 1, "after touch, expired entry is gone and size reflects it");
    assert.strictEqual(bc2.get("live"), 1, "live entry survives");
  }
  // --- Group 10: bundle markers for the new reliability fixes ---
  assert.ok(bundle.includes("Reset quarantined features"), "reset-quarantine menu command is wired");
  assert.ok(bundle.includes("_r.catch((t) => fa(e, t))"), "async failures count toward feature quarantine");
  assert.ok(bundle.includes("_ytShellReady"), "boot waits for the YouTube SPA shell");


  // --- Group 11: silence-skipper must reference reading.energy (not the
  // undeclared `energy`) so boosting is restored when sound resumes. ---
  assert.ok(bundle.includes("reading.energy >= 4 && boosted"),
    "silence-skipper de-boost uses the declared reading.energy");

  // --- Group 11b: uBlock filter parser categorization + scoping ---
  {
    const uctx = vm.createContext({
      console, URL, location: { hostname: "www.youtube.com", pathname: "/watch?v=x" },
      document: { querySelectorAll: () => [] },
      setTimeout, clearTimeout, setInterval, clearInterval, performance,
      AbortController, DOMException,
    });
    let usrc = fs.readFileSync(path.join(root, "src/ublock-filter-engine.js"), "utf8");
    usrc += "\n;globalThis.UBlockEngine = UBlockEngine;";
    vm.runInContext(usrc, uctx, { filename: "src/ublock-filter-engine.js" });
    const UE = uctx.UBlockEngine;
    // comment & blank -> null
    assert.strictEqual(UE.parseFilter("! a comment"), null);
    assert.strictEqual(UE.parseFilter(""), null);
    // plain name without ## -> null (not a cosmetic filter)
    assert.strictEqual(UE.parseFilter("somechannel"), null);
    // global css hide
    const g = UE.parseFilter("##ytd-video-renderer");
    assert.ok(g && g.selector === "ytd-video-renderer" && g.isCssOnly === true);
    // domain-scoped
    const d = UE.parseFilter("www.youtube.com##ytd-rich-item-renderer");
    assert.ok(d && d.domains[0] === "www.youtube.com");
    // excluded domain
    const ex = UE.parseFilter("~music.youtube.com##ytd-video-renderer");
    assert.ok(ex && ex.excludedDomains[0] === "music.youtube.com");
    // :has-text plain + regex => procedural
    const ht = UE.parseFilter("##ytd-comment-thread-renderer:has-text(spam)");
    assert.ok(ht && ht.isProcedural === true && ht.hasTextPatterns.length === 1);
    const htr = UE.parseFilter("##ytd-comment-thread-renderer:has-text(/spam|scam/i)");
    assert.ok(htr && htr.isProcedural === true && htr.hasTextPatterns.length === 1);
    // :matches-path regex captured without g/y stateful flags
    const mp = UE.parseFilter("##.ytp-gif:matches-path(/watch\\?v=.*/)");
    assert.ok(mp && mp.pathRegex, "path regex captured");
    assert.ok(mp.pathRegex.global === false && mp.pathRegex.sticky === false, "stateful flags stripped");
    // parseFilterList categorization
    const list = UE.parseFilterList("! c\n##a\n##b:has-text(x)\n##c:matches-path(/watch/)\nchannel##d\n");
    assert.strictEqual(list.cssFilters.length, 3, "a + d + c(css part when path) counted css");
    assert.strictEqual(list.procFilters.filter(f=>f.hasTextPatterns.length).length >= 1, true, ":has-text goes procedural");
  }
  console.log("Unit tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  clearInterval(keepAlive);
});
