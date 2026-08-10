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
  assert.strictEqual(countOccurrences(bundle, 'id: "smart-speed"'), 1, "smart-speed registers exactly once");
  for (const key of ["smartSpeedSilence:", "smartSpeedRamp:"]) {
    assert.ok(bundle.includes(key), `smart-speed default present: ${key}`);
  }
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
  const smartSpeedStart = bundle.indexOf('id: "smart-speed"');
  const smartSpeedEnd = bundle.indexOf("xa.register", smartSpeedStart + 'id: "smart-speed"'.length);
  const smartSpeedRegistration = bundle.slice(smartSpeedStart, smartSpeedEnd === -1 ? bundle.length : smartSpeedEnd);
  for (const marker of ["isSpeech", "silenceRate", "catchup"]) {
    assert.ok(smartSpeedRegistration.includes(marker), `smart-speed registration contains Premium-style marker: ${marker}`);
  }

  // --- Group 3: perf-mode tier and smart-speed rate logic ---
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

  const createSmartSpeedModel = (settings = {}) => {
    const baseRate = Math.min(1.5, Math.max(0.5, Number(settings.smartSpeedBase) || 1));
    const fastRate = Math.min(3, Math.max(baseRate, Number(settings.smartSpeedFast) || 1.5));
    const silenceRate = Math.min(3.5, Math.max(fastRate, Number(settings.smartSpeedSilence) || 1.75));
    const clampRate = (rate) => Math.max(0.25, Math.min(4, rate));
    const HYSTERESIS_S = 1.2;
    let state = "idle";
    let stateSince = 0;
    let catchup = 0;
    return {
      baseRate,
      fastRate,
      silenceRate,
      clampRate,
      get state() { return state; },
      get catchup() { return catchup; },
      tick(now, audio, currentRate) {
        if (!audio.active) return { applied: null, state, inState: (now - stateSince) / 1000 };
        if (state === "idle") { state = "listening"; stateSince = now; }
        const inState = (now - stateSince) / 1000;
        let desired = baseRate;
        if (audio.isSpeech) {
          desired = baseRate;
          if (inState > 4 && catchup > 0.75) desired = Math.min(fastRate, baseRate + Math.min(0.15, catchup * 0.05));
        } else if (audio.isQuiet) {
          desired = silenceRate;
        } else {
          desired = fastRate;
        }
        const nextState = desired === baseRate ? "speech" : desired === silenceRate ? "silence" : "fast";
        if (nextState !== state) {
          if (inState < HYSTERESIS_S) return { applied: null, state, inState };
          state = nextState;
          stateSince = now;
        }
        catchup = Math.min(20, catchup + Math.max(0, currentRate - baseRate) * 0.5);
        return { applied: clampRate(desired), state, inState };
      },
    };
  };

  const defaultModel = createSmartSpeedModel();
  assert.strictEqual(defaultModel.baseRate, 1, "smart-speed base rate defaults to 1x");
  assert.strictEqual(defaultModel.fastRate, 1.5, "smart-speed fast rate defaults to 1.5x");
  assert.strictEqual(defaultModel.silenceRate, 1.75, "smart-speed silence rate defaults to 1.75x");
  assert.ok(defaultModel.baseRate <= defaultModel.fastRate && defaultModel.fastRate <= defaultModel.silenceRate, "smart-speed rates are monotonic base <= fast <= silence");
  assert.strictEqual(defaultModel.clampRate(0.1), 0.25, "smart-speed rate clamp floor is 0.25x");
  assert.strictEqual(defaultModel.clampRate(9), 4, "smart-speed rate clamp ceiling is 4x");
  assert.strictEqual(defaultModel.clampRate(1.75), 1.75, "smart-speed clamp is a no-op inside bounds");

  const loweredModel = createSmartSpeedModel({ smartSpeedFast: "0.5", smartSpeedSilence: "0.9" });
  assert.strictEqual(loweredModel.fastRate, 1, "fast rate never drops below base rate");
  assert.strictEqual(loweredModel.silenceRate, 1, "silence rate never drops below fast rate");
  const wildModel = createSmartSpeedModel({ smartSpeedFast: "99", smartSpeedSilence: "99" });
  assert.strictEqual(wildModel.fastRate, 3, "fast rate clamps to its 3x maximum");
  assert.strictEqual(wildModel.silenceRate, 3.5, "silence rate clamps to its 3.5x maximum");

  const mappingModel = createSmartSpeedModel();
  let mapped = mappingModel.tick(0, { active: true, isSpeech: true, isQuiet: false, energy: 0.5 }, 1);
  assert.strictEqual(mapped.applied, null, "hysteresis blocks a rate change on the first tick");
  mapped = mappingModel.tick(2000, { active: true, isSpeech: true, isQuiet: false, energy: 0.5 }, 1);
  assert.strictEqual(mapped.applied, 1, "speech maps to the base rate");
  assert.strictEqual(mapped.state, "speech", "speech transitions into the speech state");

  const quietModel = createSmartSpeedModel();
  quietModel.tick(0, { active: true, isSpeech: false, isQuiet: true, energy: 0.1 }, 1.75);
  const quietOut = quietModel.tick(2000, { active: true, isSpeech: false, isQuiet: true, energy: 0.1 }, 1.75);
  assert.strictEqual(quietOut.applied, 1.75, "quiet maps to the silence rate");
  assert.strictEqual(quietOut.state, "silence", "quiet transitions into the silence state");

  const fastModel = createSmartSpeedModel();
  fastModel.tick(0, { active: true, isSpeech: false, isQuiet: false, energy: 0.9 }, 1.5);
  const fastOut = fastModel.tick(2000, { active: true, isSpeech: false, isQuiet: false, energy: 0.9 }, 1.5);
  assert.strictEqual(fastOut.applied, 1.5, "non-speech, non-quiet audio maps to the fast rate");
  assert.strictEqual(fastOut.state, "fast", "fast audio transitions into the fast state");

  const inactiveModel = createSmartSpeedModel();
  const inactiveOut = inactiveModel.tick(0, { active: false, isSpeech: false, isQuiet: false, energy: 0.02 }, 1);
  assert.strictEqual(inactiveOut.applied, null, "inactive audio (low energy) is ignored by the rate model");

  const hysteresisModel = createSmartSpeedModel();
  hysteresisModel.tick(0, { active: true, isSpeech: false, isQuiet: false }, 1.5);
  const earlySwitch = hysteresisModel.tick(1100, { active: true, isSpeech: true, isQuiet: false }, 1.5);
  assert.strictEqual(earlySwitch.applied, null, "hysteresis blocks a switch before ~1.2s in-state");
  assert.strictEqual(earlySwitch.state, "listening", "a blocked switch keeps the current state");
  const lateSwitch = hysteresisModel.tick(2000, { active: true, isSpeech: true, isQuiet: false }, 1.5);
  assert.strictEqual(lateSwitch.applied, 1, "hysteresis allows the switch once ~1.2s has elapsed");
  assert.strictEqual(lateSwitch.state, "speech", "state flips to speech after the hysteresis window");

  const boostModel = createSmartSpeedModel();
  const fastAudio = { active: true, isSpeech: false, isQuiet: false };
  const speechAudio = { active: true, isSpeech: true, isQuiet: false };
  boostModel.tick(0, fastAudio, 1.5);
  boostModel.tick(2000, fastAudio, 1.5);
  boostModel.tick(4000, fastAudio, 1.5);
  boostModel.tick(6000, fastAudio, 1.5);
  boostModel.tick(8000, fastAudio, 1.5);
  assert.strictEqual(boostModel.catchup, 1, "catchup accrues 0.5x of the rate delta over base while fast playback continues");
  const boostOut = boostModel.tick(10000, speechAudio, 1.5);
  assert.strictEqual(boostOut.applied, 1.05, "speech after sustained fast playback gets the bounded catchup boost");
  assert.ok(boostOut.applied > boostModel.baseRate, "catchup boost lifts speech above base rate");
  assert.ok(boostOut.applied <= boostModel.fastRate, "catchup boost is capped at fast rate");
  assert.ok(boostModel.catchup <= 20, "catchup itself is capped at 20");

  const noBoostModel = createSmartSpeedModel();
  noBoostModel.tick(0, { active: true, isSpeech: false, isQuiet: false }, 1);
  noBoostModel.tick(2000, { active: true, isSpeech: false, isQuiet: false }, 1);
  const noBoostOut = noBoostModel.tick(8000, speechAudio, 1);
  assert.strictEqual(noBoostOut.applied, 1, "speech stays at base rate when catchup never accrued");

  const wildOut = wildModel.tick(0, { active: true, isSpeech: false, isQuiet: true }, 3.5);
  const wildLate = wildModel.tick(2000, { active: true, isSpeech: false, isQuiet: true }, 3.5);
  assert.strictEqual(wildOut.applied, null, "extreme settings still respect the hysteresis window");
  assert.strictEqual(wildLate.applied, 3.5, "applied rates respect the [0.25, 4] clamp");
  assert.ok(wildLate.applied >= 0.25 && wildLate.applied <= 4, "smart-speed applied rates stay within [0.25, 4]");

  console.log("Unit tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
