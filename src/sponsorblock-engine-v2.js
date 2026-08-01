
  // ===========================================================================
  // ===========================================================================
  //  SponsorBlock Engine v2 (YT-zen)
  // ---------------------------------------------------------------------------
  //  Complete redesign from first principles.
  //
  //  Architecture:
  //    SponsorBlockEngine  — Orchestrator (lifecycle, init, public API)
  //    SponsorBlockAPI     — Networking, retries, response validation
  //    SponsorBlockCache   — Two-tier cache, deduplication, stale-while-revalidate
  //    SponsorBlockPlayer  — Playback sync, skip state machine, mute handling
  //    SponsorBlockUI      — Seekbar marks, notifications, HUD updates
  //    SponsorBlockMetrics — Statistics, time-saved tracking, diagnostics
  //
  //  Design principles:
  //    • Zero polling when idle (paused, ended, no segments, background tab)
  //    • Single in-flight promise per (videoId, configKey) — no duplicates
  //    • Stale-while-revalidate for instant perceived load times
  //    • Skip guard prevents duplicate seeks and oscillation
  //    • All API responses validated before use
  //    • Full AbortController lifecycle — cancelled requests never leak
  //    • Background tab awareness via visibilitychange
  //    • Structured error handling — network failures never break playback
  // ===========================================================================
  const SponsorBlockEngine = (() => {
    "use strict";

    // ─── Constants & Configuration ───────────────────────────────────────────
    const Categories = [
      { id: "sponsor", label: "Sponsor", color: "#00d400", desc: "Paid promotions, paid referrals, and direct advertisements" },
      { id: "selfpromo", label: "Unpaid/Self Promotion", color: "#ffff00", desc: "Self-promotion, merchandise plugs, and channel shoutouts" },
      { id: "interaction", label: "Interaction Reminder", color: "#cc00ff", desc: "Subscribe, like, comment, and follow reminders" },
      { id: "intro", label: "Intermission/Intro", color: "#00ffff", desc: "Opening animations, intros, and recurring transitions" },
      { id: "outro", label: "Endcards/Credits", color: "#0202ed", desc: "End screens, credits, and closing callouts" },
      { id: "preview", label: "Preview/Recap", color: "#008fd6", desc: "Previews, recaps, and hooks before the main content" },
      { id: "hook", label: "Hook", color: "#ff6f00", desc: "Attention-grabbing teaser at the very start of a video" },
      { id: "filler", label: "Filler/Tangent", color: "#7300ab", desc: "Off-topic tangents and filler not needed to understand the main content" },
      { id: "music_offtopic", label: "Non-Music Section", color: "#ff9900", desc: "Non-music sections in music videos (spoken parts, intros)" },
      { id: "poi_highlight", label: "Highlight", color: "#ff1684", desc: "The most interesting or important moment in the video" },
      { id: "exclusive_access", label: "Exclusive Access", color: "#008a5c", desc: "Entire video is only available to paying members or subscribers" },
      { id: "chapter", label: "Chapter", color: "#ffffff", desc: "Community-defined chapter markers with titles" }
    ];

    const Actions = {
      skip: "Skip",
      mute: "Mute",
      poi: "Jump to highlight",
      chapter: "Show chapters",
      full: "Label only",
      disabled: "Off"
    };

    const CACHE_VERSION = 5;
    const CACHE_TTL_MS = 60 * 60 * 1000;          // Fresh in-memory data
    const PERSIST_TTL_MS = 24 * 60 * 60 * 1000;   // Persistent cache lifetime
    const STALE_GRACE_MS = 12 * 60 * 60 * 1000;   // Offline fallback window
    const MAX_CACHE_ENTRIES = 128;
    const API_TIMEOUT_MS = 8000;
    const MAX_RETRIES = 2;
    const RETRY_BASE_MS = 500;
    const SKIP_COOLDOWN_MS = 500;
    const SEEK_TOLERANCE = 0.3; // seconds
    const POINT_SEGMENT_EPSILON = 0.05;
    const MAX_SEGMENT_TIME = 24 * 60 * 60;
    const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
    const PRIVACY_HASH_LENGTH = 4;
    const API_PROFILE_VERSION = "all-categories-v2";

    // ─── Shared State Context ────────────────────────────────────────────────
    const State = {
      videoId: null,
      segments: [],
      hidden: false,
      generation: 0,
      backgroundControllers: new Set(),
      lifecycleAttached: false,
      lifecycleCleanup: null,
      lastWakeLookupAt: 0,
      processedUUIDs: new Set(),
      activeSegmentIndex: -1,
      abortController: null,
      initialized: false,
      mutedActive: false,
      originalVolume: null,
      originalMuted: false,
      lastSkipTime: 0,
      lastSkipTarget: 0,
      listenersAttached: false,
      userId: null,
      lastFetchPlan: "",
      lastLookupTrace: [],
      initPromise: null,
      initPromiseVideoId: null,
      lastInitCompletedAt: 0,
      // Submission Creator Editor State
      editor: {
        active: false,
        start: null,
        end: null,
        category: "sponsor",
        description: "",
        preview: false,
        element: null
      }
    };

    // Initialize local persistent User ID
    const initUserId = () => {
      let uid = S.sbUserId;
      if (!uid || uid.length !== 30) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        uid = "";
        try {
          const arr = new Uint8Array(30);
          crypto.getRandomValues(arr);
          for (let i = 0; i < 30; i++) uid += chars.charAt(arr[i] % 62);
        } catch (_) {
          for (let i = 0; i < 30; i++) uid += chars.charAt(Math.floor(Math.random() * 62));
        }
        Ta("sbUserId", uid);
      }
      State.userId = uid;
    };

    // ─── Metrics Module ──────────────────────────────────────────────────────
    const Metrics = (() => {
      let timeSaved = 0;
      let skipsCount = 0;
      let segmentsLoaded = 0;
      let cacheHits = 0;
      let cacheMisses = 0;
      let apiErrors = 0;
      let staleServed = 0;
      let dedupedRequests = 0;
      let apiRequests = 0;
      let apiFallbacks = 0;
      let voteRequests = 0;
      let submitRequests = 0;
      let viewedReports = 0;
      let userInfoRequests = 0;

      const load = async () => {
        try {
          const saved = await v("kv", "__sb_saved__");
          if (saved && typeof saved.v === "number") timeSaved = saved.v;
        } catch (_) {}
        try {
          const skips = await v("kv", "__sb_skips__");
          if (skips && typeof skips.v === "number") skipsCount = skips.v;
        } catch (_) {}
      };

      const persistStats = (() => {
        let pending = null;
        return () => {
          if (pending) return;
          pending = setTimeout(() => {
            pending = null;
            k("kv", { k: "__sb_saved__", v: timeSaved });
            k("kv", { k: "__sb_skips__", v: skipsCount });
          }, 2000);
        };
      })();

      const recordSkip = (savedSec) => {
        timeSaved += Math.max(0, savedSec);
        skipsCount++;
        persistStats();
      };

      const recordSegments = (count) => { segmentsLoaded = count; };
      const recordCacheHit = () => { cacheHits++; };
      const recordCacheMiss = () => { cacheMisses++; };
      const recordApiError = () => { apiErrors++; };
      const recordStaleServed = () => { staleServed++; };
      const recordDeduped = () => { dedupedRequests++; };
      const recordApiRequest = () => { apiRequests++; };
      const recordApiFallback = () => { apiFallbacks++; };
      const recordVoteRequest = () => { voteRequests++; };
      const recordSubmitRequest = () => { submitRequests++; };
      const recordViewedReport = () => { viewedReports++; };
      const recordUserInfoRequest = () => { userInfoRequests++; };
      const recordFetchPlan = (planId) => { State.lastFetchPlan = planId || ""; };
      const recordLookupTrace = (trace) => { State.lastLookupTrace = Array.isArray(trace) ? trace.slice(-8) : []; };

      const snapshot = () => ({
        saved: timeSaved,
        skips: skipsCount,
        segments: State.segments.length,
        segmentsLoaded,
        cacheHits,
        cacheMisses,
        apiErrors,
        staleServed,
        dedupedRequests,
        apiRequests,
        apiFallbacks,
        voteRequests,
        submitRequests,
        viewedReports,
        userInfoRequests,
        lastFetchPlan: State.lastFetchPlan || "",
        lastLookupTrace: State.lastLookupTrace.slice(),
        hitRate: (cacheHits + cacheMisses) > 0
          ? Math.round((cacheHits / (cacheHits + cacheMisses)) * 100) : 0,
      });

      load();

      return {
        recordSkip,
        recordSegments,
        recordCacheHit,
        recordCacheMiss,
        recordApiError,
        recordStaleServed,
        recordDeduped,
        recordApiRequest,
        recordApiFallback,
        recordVoteRequest,
        recordSubmitRequest,
        recordViewedReport,
        recordUserInfoRequest,
        recordFetchPlan,
        recordLookupTrace,
        snapshot,
        load,
      };
    })();

    // ─── Hidden Video State ──────────────────────────────────────────────────
    const HiddenVideos = (() => {
      const STORAGE_KEY = "__sb_hidden__";
      let cacheSet = null;
      let cacheLoadedAt = 0;
      const CACHE_TTL_MS = 15000;

      const normalize = (value) => {
        if (!Array.isArray(value)) return [];
        return Array.from(new Set(value.filter((item) => typeof item === "string" && item)));
      };

      const load = async (force = false) => {
        if (!force && cacheSet && (Date.now() - cacheLoadedAt) < CACHE_TTL_MS) return cacheSet;
        let list = [];
        try {
          const row = await v("kv", STORAGE_KEY);
          if (row && Array.isArray(row.v)) list = row.v;
        } catch (_) {}
        cacheSet = new Set(normalize(list));
        cacheLoadedAt = Date.now();
        return cacheSet;
      };

      const persist = async (set) => {
        const list = Array.from(set).slice(-500);
        cacheSet = new Set(list);
        cacheLoadedAt = Date.now();
        await k("kv", { k: STORAGE_KEY, v: list, updatedAt: Date.now() });
        return list;
      };

      const isHidden = async (videoId) => {
        if (!videoId) return false;
        const set = await load(false);
        return set.has(videoId);
      };

      const hide = async (videoId) => {
        if (!videoId) return false;
        const set = await load(false);
        set.add(videoId);
        await persist(set);
        return true;
      };

      const unhide = async (videoId) => {
        if (!videoId) return false;
        const set = await load(false);
        set.delete(videoId);
        await persist(set);
        return true;
      };

      const clearCache = () => {
        cacheSet = null;
        cacheLoadedAt = 0;
      };

      return { load, isHidden, hide, unhide, clearCache };
    })();

    // ─── Settings Resolution ─────────────────────────────────────────────────
    const Settings = (() => {
      const getEnabledCategories = () => {
        return Categories.filter(c => S["sb_" + c.id + "_en"]).map(c => c.id);
      };

      const getActionTypes = () => {
        const types = new Set();
        const cats = getEnabledCategories();
        Categories.forEach(c => {
          if (!cats.includes(c.id)) return;
          const act = S["sb_" + c.id + "_act"] || "skip";
          if (act === "skip" || act === "mute") types.add("skip");
          if (act === "mute") types.add("mute");
          if (c.id === "poi_highlight" && act !== "disabled") types.add("poi");
          if (c.id === "chapter" && act !== "disabled") types.add("chapter");
          if (c.id === "exclusive_access" && act !== "disabled") types.add("full");
        });
        return Array.from(types);
      };

      const getActionOptions = (categoryId) => {
        const options = {
          skip: Actions.skip,
          full: Actions.full,
          disabled: Actions.disabled,
        };
        if (categoryId === "poi_highlight") {
          return { skip: Actions.skip, poi: Actions.poi, full: Actions.full, disabled: Actions.disabled };
        }
        if (categoryId === "chapter") {
          return { skip: Actions.skip, chapter: Actions.chapter, full: Actions.full, disabled: Actions.disabled };
        }
        if (categoryId !== "exclusive_access") options.mute = Actions.mute;
        return options;
      };

      const getCategoryAction = (categoryId) => {
        if (!S["sb_" + categoryId + "_en"]) return "disabled";
        const action = S["sb_" + categoryId + "_act"] || "skip";
        return Object.prototype.hasOwnProperty.call(getActionOptions(categoryId), action) ? action : "skip";
      };

      const getConfigKey = () => {
        const privacy = S.sbPrivacy ? "1" : "0";
        // The API request always asks for every supported category/action type.
        // Keep the server profile in the key so future API-profile changes can
        // never reuse an incompatible cached response.
        return API_PROFILE_VERSION + ":" + privacy;
      };

      const getRenderKey = () => {
        const profile = Categories.map((category) => {
          const enabled = S["sb_" + category.id + "_en"] ? "1" : "0";
          const action = S["sb_" + category.id + "_act"] || "skip";
          return category.id + ":" + enabled + ":" + action;
        }).join("|");
        return getConfigKey() + "|" + profile;
      };

      const getServerUrl = () => {
        return "https://sponsor.ajay.app";
      };

      return {
        getEnabledCategories, getActionTypes, getCategoryAction, getActionOptions,
        getConfigKey, getRenderKey, getServerUrl,
      };
    })();

    // ─── Cache Module ────────────────────────────────────────────────────────
    const Cache = (() => {
      const memCache = new Map();
      const inFlight = new Map();

      const computeChecksum = (data) => {
        let hash = 0;
        const str = typeof data === "string" ? data : JSON.stringify(data);
        for (let i = 0; i < str.length && i < 2000; i++) {
          hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return Math.abs(hash).toString(16);
      };

      const evictIfNeeded = () => {
        if (memCache.size <= MAX_CACHE_ENTRIES) return;
        const toRemove = memCache.size - MAX_CACHE_ENTRIES + 8;
        const keys = memCache.keys();
        for (let i = 0; i < toRemove; i++) {
          const key = keys.next().value;
          if (key === undefined) break;
          memCache.delete(key);
        }
      };

      const isUsableEntry = (entry, videoId) => !!(
        entry && entry.version === CACHE_VERSION &&
        entry.videoId === videoId && Array.isArray(entry.segments) &&
        typeof entry.expiresAt === "number" &&
        typeof entry.fetchedAt === "number"
      );

      const runtimeEntry = (entry) => Object.assign({}, entry, {
        // Persistent entries live longer than the in-memory freshness window.
        // Never accidentally promote the persistent TTL into RAM.
        expiresAt: Math.min(entry.expiresAt, entry.fetchedAt + CACHE_TTL_MS),
      });

      const get = async (videoId, configKey, allowStale = false) => {
        const cacheKey = "sb:" + videoId + ":" + configKey;
        const now = Date.now();

        // Layer 1: Memory
        if (memCache.has(cacheKey)) {
          const entry = memCache.get(cacheKey);
          memCache.delete(cacheKey);
          memCache.set(cacheKey, entry); // LRU: move to end
          if (!isUsableEntry(entry, videoId)) {
            memCache.delete(cacheKey);
          } else if (entry.expiresAt > now) {
            Metrics.recordCacheHit();
            return { data: entry.segments, fresh: true };
          } else if (allowStale && entry.expiresAt + STALE_GRACE_MS > now) {
            Metrics.recordStaleServed();
            return { data: entry.segments, fresh: false };
          } else {
            memCache.delete(cacheKey);
          }
        }

        // Layer 2: Persistent (IDB)
        try {
          const row = await v("kv", "cache:" + cacheKey);
          if (row && row.v) {
            const entry = row.v;
            if (!isUsableEntry(entry, videoId)) {
              await x("kv", "cache:" + cacheKey);
              return null;
            }
            if (entry.expiresAt > now) {
              memCache.set(cacheKey, runtimeEntry(entry));
              evictIfNeeded();
              Metrics.recordCacheHit();
              return { data: entry.segments, fresh: true };
            }
            if (allowStale && entry.expiresAt + STALE_GRACE_MS > now) {
              memCache.set(cacheKey, runtimeEntry(entry));
              evictIfNeeded();
              Metrics.recordStaleServed();
              return { data: entry.segments, fresh: false };
            }
            if (entry.expiresAt + STALE_GRACE_MS < now) {
              await x("kv", "cache:" + cacheKey);
            }
          }
        } catch (err) {
          try { h("[SB][cache] persistent read error:", err); } catch (_) {}
        }

        Metrics.recordCacheMiss();
        return null;
      };

      const set = async (videoId, configKey, segments) => {
        const cacheKey = "sb:" + videoId + ":" + configKey;
        const now = Date.now();
        const entry = {
          version: CACHE_VERSION,
          videoId,
          segments,
          fetchedAt: now,
          expiresAt: now + CACHE_TTL_MS,
          apiVersion: "v1",
          checksum: computeChecksum(segments),
          lastValidated: now,
          configHash: configKey,
        };

        memCache.set(cacheKey, entry);
        evictIfNeeded();

        const persistEntry = Object.assign({}, entry, {
          expiresAt: now + PERSIST_TTL_MS,
        });
        try {
          await k("kv", {
            k: "cache:" + cacheKey,
            v: persistEntry,
            updatedAt: now,
          });
        } catch (err) {
          try { h("[SB][cache] persistent write error:", err); } catch (_) {}
        }
      };

      const getInFlight = (key) => inFlight.get(key);
      const clearInFlightForVideo = (videoId) => {
        if (!videoId) return;
        for (const key of Array.from(inFlight.keys())) {
          if (key.startsWith(String(videoId) + ":")) inFlight.delete(key);
        }
      };
      const setInFlight = (key, promise) => { inFlight.set(key, promise); };
      const clearInFlight = (key, promise) => {
        if (!promise || inFlight.get(key) === promise) inFlight.delete(key);
      };

      const invalidate = async (videoId) => {
        if (!videoId) return;
        const prefix = "sb:" + videoId + ":";
        const cacheKeys = new Set();
        for (const key of Array.from(memCache.keys())) {
          if (key.startsWith(prefix)) {
            memCache.delete(key);
            cacheKeys.add(key);
          }
        }
        for (const key of Array.from(inFlight.keys())) {
          if (key.startsWith(videoId + ":")) inFlight.delete(key);
        }
        // Enumerate the shared kv store instead of assuming the config key is
        // only 0/1. This also removes entries written by older builds.
        try {
          const rows = await w("kv");
          for (const row of Array.isArray(rows) ? rows : []) {
            if (row && typeof row.k === "string" && row.k.startsWith("cache:" + prefix)) {
              cacheKeys.add(row.k.slice("cache:".length));
            }
          }
        } catch (_) {}
        await Promise.all(Array.from(cacheKeys, (cacheKey) => x("kv", "cache:" + cacheKey)));
      };

      return { get, set, getInFlight, setInFlight, clearInFlight, clearInFlightForVideo, invalidate };
    })();

    // ─── API Module ──────────────────────────────────────────────────────────
    const API = (() => {
      const ALL_CATEGORIES = Categories.map(c => c.id);
      const ALL_ACTION_TYPES = ["skip", "mute", "poi", "chapter", "full"];
      const userInfoCache = new ZenResources.BoundedCache(32, "sb-user-info", { ttlMs: 10 * 60 * 1000 });

      const hashPrefix = async (videoId) => {
        try {
          const buffer = await crypto.subtle.digest(
            "SHA-256", new TextEncoder().encode(videoId)
          );
          return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("")
            .slice(0, 4);
        } catch (_) {
          let h = 0;
          for (let i = 0; i < videoId.length; i++) h = ((h << 5) - h + videoId.charCodeAt(i)) | 0;
          return Math.abs(h).toString(16).padStart(4, "0").slice(0, 4);
        }
      };

      const actionTypeForCategory = (categoryId) => {
        if (categoryId === "poi_highlight") return "poi";
        if (categoryId === "chapter") return "chapter";
        if (categoryId === "exclusive_access") return "full";
        return "skip";
      };

      const createParams = (videoId, categories, actionTypes, mode, prefixValue) => {
        const params = new URLSearchParams();
        if (videoId) params.set("videoID", videoId);
        if (prefixValue) params.set("prefix", prefixValue);
        params.set("service", "YouTube");
        if (mode === "json") {
          params.set("categories", JSON.stringify(categories));
          if (actionTypes && actionTypes.length) params.set("actionTypes", JSON.stringify(actionTypes));
        } else {
          categories.forEach((category) => params.append("category", category));
          (actionTypes || []).forEach((actionType) => params.append("actionType", actionType));
        }
        return params;
      };

      const buildFetchPlans = async (videoId, usePrivacy, categories, actionTypes) => {
        const base = Settings.getServerUrl();
        const prefix = (await hashPrefix(videoId)).slice(0, PRIVACY_HASH_LENGTH);
        const plans = [];
        const pushPlan = (id, url, privacy = false) => plans.push({ id, url, privacy });

        if (!usePrivacy) {
          // Both encodings are accepted by SponsorBlock deployments. The
          // repeated form is the most compatible with older server versions.
          pushPlan(
            "direct-repeated",
            base + "/api/skipSegments?" + createParams(videoId, categories, actionTypes, "repeated").toString()
          );
          pushPlan(
            "direct-json",
            base + "/api/skipSegments?" + createParams(videoId, categories, actionTypes, "json").toString()
          );
        } else {
          // A privacy lookup must never fall back to a full videoID query.
          // The path form is the canonical API and returns candidate videos;
          // the client filters those candidates to the requested video.
          pushPlan(
            "privacy-path-json",
            base + "/api/skipSegments/" + prefix + "?" + createParams(null, categories, actionTypes, "json").toString(),
            true
          );
          pushPlan(
            "privacy-path-repeated",
            base + "/api/skipSegments/" + prefix + "?" + createParams(null, categories, actionTypes, "repeated").toString(),
            true
          );
        }
        return plans;
      };

      const validateSegment = (seg, index) => {
        if (!seg || typeof seg !== "object") return null;
        const rawSegment = Array.isArray(seg.segment) ? seg.segment : [seg.startTime, seg.endTime];
        if (rawSegment.length < 2) return null;

        const start = Number(rawSegment[0]);
        const end = Number(rawSegment[1]);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
        if (start < 0 || end < 0 || start > MAX_SEGMENT_TIME || end > MAX_SEGMENT_TIME) return null;
        if (start > end && !(start === 0 && end === 0)) return null;

        const category = typeof seg.category === "string" && seg.category.trim()
          ? seg.category.trim().slice(0, 64)
          : "sponsor";
        const UUID = typeof seg.UUID === "string" && seg.UUID.trim()
          ? seg.UUID.trim().slice(0, 128)
          : ("idx-" + index + "-" + start + "-" + end);
        const actionType = typeof seg.actionType === "string" && seg.actionType
          ? seg.actionType
          : actionTypeForCategory(category);
        const numberOrZero = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

        return {
          category,
          segment: [start, end],
          UUID,
          actionType,
          votes: numberOrZero(seg.votes),
          locked: numberOrZero(seg.locked),
          views: numberOrZero(seg.views),
          videoDuration: Math.max(0, Math.min(MAX_SEGMENT_TIME, numberOrZero(seg.videoDuration))),
          description: typeof seg.description === "string" ? seg.description.slice(0, 500) : "",
          userID: typeof seg.userID === "string" ? seg.userID.slice(0, 128) : "",
          hidden: numberOrZero(seg.hidden),
          shadowHidden: numberOrZero(seg.shadowHidden),
        };
      };

      const extractSegmentArray = (payload, videoId) => {
        if (Array.isArray(payload)) {
          if (!payload.length) return { segments: [], matched: true, prefixed: false, valid: true };
          const prefixed = payload.some((entry) => entry && Array.isArray(entry.segments));
          if (prefixed) {
            const hit = payload.find((entry) => entry && entry.videoID === videoId && Array.isArray(entry.segments));
            return { segments: hit ? hit.segments : [], matched: !!hit, prefixed: true, valid: true };
          }
          return { segments: payload, matched: true, prefixed: false, valid: true };
        }
        if (payload && Array.isArray(payload.segments)) {
          return {
            segments: payload.segments,
            matched: !payload.videoID || payload.videoID === videoId,
            prefixed: !!payload.videoID,
            valid: true,
          };
        }
        return { segments: [], matched: false, prefixed: false, valid: false };
      };

      const normalizeSegments = (payload, videoId) => {
        const extracted = extractSegmentArray(payload, videoId);
        const normalized = [];
        const seen = new Set();
        for (let idx = 0; idx < extracted.segments.length; idx++) {
          const valid = validateSegment(extracted.segments[idx], idx);
          if (!valid) continue;
          const key = valid.UUID + "|" + valid.segment[0] + "|" + valid.segment[1] + "|" + valid.category + "|" + valid.actionType;
          if (seen.has(key)) continue;
          seen.add(key);
          normalized.push(valid);
        }
        normalized.sort((a, b) => a.segment[0] - b.segment[0] || a.segment[1] - b.segment[1] || a.UUID.localeCompare(b.UUID));
        return {
          segments: normalized,
          matched: extracted.matched,
          prefixed: extracted.prefixed,
          valid: extracted.valid,
        };
      };

      const requestJson = async (url, abortSignal, opts = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs || API_TIMEOUT_MS);
        let onAbort = null;

        if (abortSignal) {
          if (abortSignal.aborted) {
            clearTimeout(timeoutId);
            throw new DOMException("Aborted", "AbortError");
          }
          onAbort = () => controller.abort();
          abortSignal.addEventListener("abort", onAbort, { once: true });
        }

        try {
          Metrics.recordApiRequest();
          const response = await he(url, {
            method: opts.method || "GET",
            headers: opts.headers,
            body: opts.body,
            signal: controller.signal,
          });

          if (response.status === 404) {
            const err = new Error("HTTP 404");
            err.status = 404;
            throw err;
          }
          if (response.status === 400) {
            const err = new Error("HTTP 400");
            err.status = 400;
            throw err;
          }
          if (!response.ok) {
            const err = new Error("HTTP " + response.status);
            err.status = response.status;
            throw err;
          }

          let body = null;
          try {
            body = await response.json();
          } catch (_) {
            const err = new Error("Malformed JSON response");
            err.status = response.status;
            throw err;
          }

          if (body === null || body === undefined) {
            const err = new Error("Empty JSON response");
            err.status = response.status;
            throw err;
          }

          return { response, body };
        } finally {
          clearTimeout(timeoutId);
          if (abortSignal && onAbort) {
            try { abortSignal.removeEventListener("abort", onAbort); } catch (_) {}
          }
        }
      };

      const fetchSegments = async (videoId, abortSignal) => {
        if (!VIDEO_ID_RE.test(String(videoId || ""))) return [];
        const usePrivacy = !!S.sbPrivacy;
        const plans = await buildFetchPlans(videoId, usePrivacy, ALL_CATEGORIES, ALL_ACTION_TYPES);
        const trace = [];
        let lastError = null;
        let notFoundCount = 0;
        let privacyNoMatch = false;

        for (let idx = 0; idx < plans.length; idx++) {
          const plan = plans[idx];
          if (idx > 0) Metrics.recordApiFallback();
          try {
            const { response, body } = await requestJson(plan.url, abortSignal);
            const normalized = normalizeSegments(body, videoId);
            if (!normalized.valid) {
              const malformed = new Error("SponsorBlock response was not a segment array");
              malformed.status = response.status;
              throw malformed;
            }
            // A privacy response is a candidate list. A successful response
            // with no matching video is not a successful lookup; try the
            // alternate encoding instead of caching a false empty result.
            if (plan.privacy && normalized.prefixed && !normalized.matched) {
              trace.push({ plan: plan.id, status: response.status, count: 0, matched: false });
              privacyNoMatch = true;
              lastError = new Error("Privacy response did not contain requested video");
              continue;
            }
            trace.push({ plan: plan.id, status: response.status, count: normalized.segments.length, matched: true });
            Metrics.recordFetchPlan(plan.id);
            Metrics.recordLookupTrace(trace);
            return normalized.segments;
          } catch (err) {
            if (err && err.name === "AbortError") throw err;
            if (err && err.status === 404) notFoundCount++;
            trace.push({ plan: plan.id, status: err && err.status ? err.status : 0, error: err && err.message ? err.message : String(err) });
            lastError = err;
          }
        }

        Metrics.recordLookupTrace(trace);
        if (plans.length && notFoundCount === plans.length) {
          Metrics.recordFetchPlan(plans[plans.length - 1].id);
          return [];
        }
        if (privacyNoMatch) {
          Metrics.recordFetchPlan(plans[plans.length - 1].id);
          return [];
        }
        throw lastError || new Error("All SponsorBlock lookup plans failed");
      };

      const fetchWithRetry = async (videoId, abortSignal) => {
        let lastError = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            return await fetchSegments(videoId, abortSignal);
          } catch (err) {
            lastError = err;
            if (err && err.name === "AbortError") throw err;
            if (attempt < MAX_RETRIES) {
              const delay = RETRY_BASE_MS * Math.pow(2, attempt);
              await new Promise(r => setTimeout(r, delay));
              if (abortSignal && abortSignal.aborted) throw new DOMException("Aborted", "AbortError");
            }
          }
        }
        Metrics.recordApiError();
        throw lastError;
      };

      const requestResponse = async (url, opts = {}, abortSignal = null) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs || API_TIMEOUT_MS);
        let onAbort = null;
        if (abortSignal) {
          if (abortSignal.aborted) {
            clearTimeout(timeoutId);
            throw new DOMException("Aborted", "AbortError");
          }
          onAbort = () => controller.abort();
          abortSignal.addEventListener("abort", onAbort, { once: true });
        }
        try {
          const response = await he(url, {
            method: opts.method || "GET",
            headers: opts.headers,
            body: opts.body,
            signal: controller.signal,
          });
          if (!response || !response.ok) {
            const error = new Error("HTTP " + (response && response.status || 0));
            error.status = response && response.status || 0;
            throw error;
          }
          return response;
        } finally {
          clearTimeout(timeoutId);
          if (abortSignal && onAbort) {
            try { abortSignal.removeEventListener("abort", onAbort); } catch (_) {}
          }
        }
      };

      const currentVideoId = () => State.videoId || (ie && typeof ie.videoId === "function" ? ie.videoId() : null);

      const postVote = async (params) => {
        const videoId = currentVideoId();
        if (!params || !params.UUID || !State.userId || !VIDEO_ID_RE.test(String(videoId || ""))) return false;
        const base = Settings.getServerUrl();
        const query = new URLSearchParams(Object.assign({
          UUID: params.UUID,
          videoID: videoId,
          userID: State.userId,
        }, params));
        try {
          Metrics.recordVoteRequest();
          await requestResponse(base + "/api/voteOnSponsorTime?" + query.toString(), { method: "POST" });
          return true;
        } catch (_) { return false; }
      };

      const voteOnSegment = async (uuid, type) => postVote({ UUID: uuid, type: String(type) });
      const undoVote = async (uuid) => postVote({ UUID: uuid, type: "20" });
      const changeCategory = async (uuid, category) => category ? postVote({ UUID: uuid, category: String(category) }) : false;

      const submitSegment = async (videoId, start, end, category, description = "") => {
        if (!VIDEO_ID_RE.test(String(videoId || "")) || !State.userId) return false;
        const cleanStart = Number(start);
        const cleanEnd = Number(end);
        if (!Number.isFinite(cleanStart) || !Number.isFinite(cleanEnd) || cleanStart < 0 || cleanEnd <= cleanStart || cleanEnd > MAX_SEGMENT_TIME) return false;
        const base = Settings.getServerUrl();
        const duration = ie && typeof ie.el === "function" && ie.el() ? Number(ie.el().duration) : 0;
        const bodyData = {
          videoID: videoId,
          userID: State.userId,
          userAgent: "YT-zen/" + (typeof GM_info !== "undefined" && GM_info.script ? GM_info.script.version : "3.9.1"),
          service: "YouTube",
          videoDuration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
          segments: [{
            segment: [cleanStart, cleanEnd],
            category: String(category || "sponsor"),
            actionType: actionTypeForCategory(category),
            description: String(description || "").slice(0, 500),
          }],
        };
        try {
          Metrics.recordSubmitRequest();
          await requestResponse(base + "/api/skipSegments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyData),
          });
          return true;
        } catch (_) { return false; }
      };

      const reportViewed = async (uuid) => {
        const videoId = currentVideoId();
        if (!uuid || !VIDEO_ID_RE.test(String(videoId || ""))) return false;
        const base = Settings.getServerUrl();
        try {
          Metrics.recordViewedReport();
          await requestResponse(base + "/api/viewedVideoSponsorTime?UUID=" + encodeURIComponent(uuid) + "&videoID=" + encodeURIComponent(videoId), { method: "POST" });
          return true;
        } catch (_) { return false; }
      };

      const getUserInfo = async (userId, abortSignal, force = false) => {
        const cleanUserId = typeof userId === "string" ? userId.trim() : "";
        if (!cleanUserId) return null;
        if (!force) {
          const cached = userInfoCache.get(cleanUserId);
          if (cached !== undefined) return cached;
        }
        const base = Settings.getServerUrl();
        try {
          Metrics.recordUserInfoRequest();
          const { body } = await requestJson(
            base + "/api/userInfo?userID=" + encodeURIComponent(cleanUserId),
            abortSignal,
            { timeoutMs: API_TIMEOUT_MS }
          );
          if (!body || typeof body !== "object") return null;
          userInfoCache.set(cleanUserId, body);
          return body;
        } catch (_) {
          return null;
        }
      };

      return {
        fetchWithRetry,
        voteOnSegment,
        undoVote,
        changeCategory,
        submitSegment,
        reportViewed,
        getUserInfo,
        hashPrefix,
        normalizeSegments,
      };
    })();

    // ─── Player Module ───────────────────────────────────────────────────────
    const Player = (() => {
      const segmentEndOf = (seg) => Math.max(seg.segment[1], seg.segment[0] + POINT_SEGMENT_EPSILON);
      const isTimeInSegment = (seg, time) => time >= seg.segment[0] && time < segmentEndOf(seg);

      const findSegmentAtTime = (time) => {
        const segs = State.segments;
        if (!segs.length) return -1;

        let lo = 0, hi = segs.length - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const s = segs[mid];
          if (s.segment[0] <= time) {
            if (time < segmentEndOf(s)) return mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        return -1;
      };

      const resetMuteState = () => {
        if (!State.mutedActive) return;
        const videoEl = ie.el();
        if (videoEl) {
          try {
            videoEl.volume = State.originalVolume !== null ? State.originalVolume : 1;
            videoEl.muted = State.originalMuted;
          } catch (_) {}
        }
        State.mutedActive = false;
        State.originalVolume = null;
      };

      const shouldSkipGuard = (targetTime) => {
        const now = performance.now();
        if (now - State.lastSkipTime < SKIP_COOLDOWN_MS &&
            Math.abs(State.lastSkipTarget - targetTime) < SEEK_TOLERANCE) {
          return true;
        }
        return false;
      };

      const recordSkip = (targetTime) => {
        State.lastSkipTime = performance.now();
        State.lastSkipTarget = targetTime;
      };

      const handlePlaybackTick = () => {
        if (State.hidden) return;
        if (ie.isAd && ie.isAd()) {
          resetMuteState();
          return;
        }
        if (typeof _a === "function" && _a()) {
          resetMuteState();
          return;
        }

        const videoEl = ie.el();
        if (!videoEl || videoEl.paused || videoEl.ended) {
          resetMuteState();
          State.activeSegmentIndex = -1;
          return;
        }

        const currentTime = videoEl.currentTime;
        const segs = State.segments;
        let idx = State.activeSegmentIndex;

        if (idx >= 0 && idx < segs.length && segs[idx]) {
          const s = segs[idx];
          if (isTimeInSegment(s, currentTime)) {
            const action = Settings.getCategoryAction(s.category);
            if (action === "mute" && State.mutedActive) return;
            if (action !== "skip" && action !== "mute") {
              resetMuteState();
              return;
            }
          } else {
            resetMuteState();
            idx = -1;
          }
        }

        if (idx < 0 || idx >= segs.length || !segs[idx] ||
            currentTime < segs[idx].segment[0] || currentTime >= segmentEndOf(segs[idx])) {
          idx = findSegmentAtTime(currentTime);
          State.activeSegmentIndex = idx;
        }

        if (idx < 0) {
          resetMuteState();
          return;
        }

        const seg = segs[idx];
        const action = Settings.getCategoryAction(seg.category);

        if (action === "disabled" || action === "poi" || action === "full" || action === "chapter") {
          resetMuteState();
          return;
        }

        if (action === "mute") {
          if (!State.mutedActive) {
            State.originalVolume = videoEl.volume;
            State.originalMuted = videoEl.muted;
            try { videoEl.muted = true; } catch (_) {}
            State.mutedActive = true;
          }
          return;
        }

        if (action === "skip") {
          const uuid = seg.UUID || ("idx-" + idx + "-" + seg.segment[0]);
          const targetTime = Math.max(seg.segment[1], seg.segment[0] + POINT_SEGMENT_EPSILON);

          if (State.processedUUIDs.has(uuid) && shouldSkipGuard(targetTime)) return;

          if (!State.processedUUIDs.has(uuid)) {
            State.processedUUIDs.add(uuid);
            const savedSec = Math.max(0, targetTime - currentTime);
            Metrics.recordSkip(savedSec);

            // Trigger floating HUD
            UI.showFloatingHUD(seg, savedSec);

            API.reportViewed(uuid);

            try { ft(); } catch (_) {}
          }

          if (!shouldSkipGuard(targetTime)) {
            recordSkip(targetTime);
            try { videoEl.currentTime = targetTime; } catch (_) {}
          }
        }
      };

      const handleSeeked = () => {
        State.activeSegmentIndex = -1;
        resetMuteState();
      };

      const handleRateChange = () => {
        State.activeSegmentIndex = -1;
      };

      const handleVideoEmptied = () => {
        resetMuteState();
        State.activeSegmentIndex = -1;
        State.processedUUIDs.clear();
      };

      const handleEvent = (ev) => {
        const videoEl = ie.el();
        if (!videoEl || ev.target !== videoEl) return;

        switch (ev.type) {
          case "timeupdate":
            handlePlaybackTick();
            break;
          case "seeked":
            handleSeeked();
            UI.renderSeekbarMarks();
            break;
          case "seeking":
            State.activeSegmentIndex = -1;
            break;
          case "ratechange":
            handleRateChange();
            break;
          case "emptied":
            handleVideoEmptied();
            break;
          case "loadedmetadata":
          case "durationchange":
            UI.renderSeekbarMarks();
            break;
          case "ended":
            resetMuteState();
            State.activeSegmentIndex = -1;
            break;
          case "pause":
            resetMuteState();
            break;
        }
      };

      const events = ["timeupdate", "seeked", "seeking", "ratechange", "emptied", "loadedmetadata", "durationchange", "ended", "pause"];

      const attachListeners = () => {
        if (State.listenersAttached) return;
        events.forEach(type => {
          document.addEventListener(type, handleEvent, true);
        });
        State.listenersAttached = true;

        Yt["sponsorblock"].push(() => {
          detachListeners();
        });
      };

      const detachListeners = () => {
        if (!State.listenersAttached) return;
        events.forEach(type => {
          document.removeEventListener(type, handleEvent, true);
        });
        State.listenersAttached = false;
      };

      return {
        handlePlaybackTick, attachListeners, detachListeners,
        resetMuteState, findSegmentAtTime,
      };
    })();

    // ─── UI Module ───────────────────────────────────────────────────────────
    const UI = (() => {
      let lastRenderedDuration = -1;
      let lastRenderedSegmentCount = -1;
      let lastRenderedConfigKey = "";
      let seekbarObserver = null;
      let watchdogTaskId = 0;
      let hudTimer = 0;

      const getColorForCategory = (catId) => {
        const meta = Categories.find(c => c.id === catId);
        return (meta && meta.color) || "#ffffff";
      };

      const renderSeekbarMarks = () => {
        if (State.hidden) {
          clearMarks();
          return;
        }
        if (!S.sponsorblockOn || !S.sbSeekbar) {
          clearMarks();
          return;
        }

        const videoEl = ie.el();
        if (!videoEl || !videoEl.duration || !isFinite(videoEl.duration)) return;

        const duration = videoEl.duration;
        const segments = State.segments;

        const configKey = Settings.getRenderKey();
        if (duration === lastRenderedDuration &&
            segments.length === lastRenderedSegmentCount &&
            configKey === lastRenderedConfigKey) {
          return;
        }

        const listContainer = document.querySelector(".ytp-progress-list") ||
                              document.querySelector(".ytp-progress-bar");
        if (!listContainer) return;

        lastRenderedDuration = duration;
        lastRenderedSegmentCount = segments.length;
        lastRenderedConfigKey = configKey;

        const desired = new Map();
        for (let idx = 0; idx < segments.length; idx++) {
          const seg = segments[idx];
          if (!S["sb_" + seg.category + "_en"]) continue;
          const key = seg.UUID || ("i" + idx);
          desired.set(key, { seg, idx });
        }

        for (const [k, el] of St_seekbarMarks) {
          if (!desired.has(k)) {
            try { el.remove(); } catch (_) {}
            St_seekbarMarks.delete(k);
          }
        }

        for (const [key, info] of desired) {
          const seg = info.seg;
          const start = (seg.segment[0] / duration) * 100;
          const end = (seg.segment[1] / duration) * 100;
          const width = Math.max(0.15, end - start);
          const color = getColorForCategory(seg.category);

          let el = St_seekbarMarks.get(key);
          if (!el) {
            el = document.createElement("div");
            el.dataset.sbKey = key;
            el.className = "ytp-sb-mark";
            listContainer.appendChild(el);
            St_seekbarMarks.set(key, el);
          }

          const css = "position:absolute;top:0;bottom:0;left:" + start +
            "%;width:" + width + "%;background:" + color +
            ";opacity:0.75;pointer-events:none;z-index:31;border-radius:1px;";
          if (el.style.cssText !== css) el.style.cssText = css;
        }
      };

      const clearMarks = () => {
        St_seekbarMarks.forEach(el => { try { el.remove(); } catch (_) {} });
        St_seekbarMarks.clear();
        lastRenderedDuration = -1;
        lastRenderedSegmentCount = -1;
        lastRenderedConfigKey = "";
      };

      const clearWatchdogTask = () => {
        if (!watchdogTaskId) return;
        try { ZenResources.SharedTicker.remove(watchdogTaskId); } catch (_) {}
        watchdogTaskId = 0;
      };

      const startWatchdog = () => {
        clearWatchdogTask();

        watchdogTaskId = ZenResources.SharedTicker.add(() => {
          if (!S.sponsorblockOn || !S.sbSeekbar) return;
          if (typeof _a === "function" && _a()) return;
          if (document.hidden) return;
          try { renderSeekbarMarks(); } catch (_) {}
        }, 3000, { pauseHidden: true, label: "sb-seekbar-watchdog" });

        if (seekbarObserver) { seekbarObserver.disconnect(); seekbarObserver = null; }
        try {
          const player = document.querySelector("#movie_player") || document.querySelector(".html5-video-player");
          if (player) {
            seekbarObserver = new MutationObserver(() => {
              if (document.hidden) return;
              try { renderSeekbarMarks(); } catch (_) {}
            });
            seekbarObserver.observe(player, { childList: true, subtree: true });
          }
        } catch (_) {}
      };

      const stopWatchdog = () => {
        clearWatchdogTask();
        if (seekbarObserver) { seekbarObserver.disconnect(); seekbarObserver = null; }
        clearMarks();
      };

      const invalidateRenderCache = () => {
        lastRenderedDuration = -1;
        lastRenderedSegmentCount = -1;
        lastRenderedConfigKey = "";
      };

      const showFloatingHUD = (seg, savedSec) => {
        if (!S.sbToast) return;
        clearTimeout(hudTimer);

        let hud = document.getElementById("yt-zen-sb-hud");
        if (!hud) {
          hud = document.createElement("div");
          hud.id = "yt-zen-sb-hud";
          document.body.appendChild(hud);
        }

        const known = Categories.find(c => c.id === seg.category);
        const catMeta = known || { label: "Segment", color: "#fff" };
        const esc = ZenResources.Dom.esc;

        hud.innerHTML = `
          <div class="hud-header" style="border-left: 4px solid ${esc(catMeta.color)}">
            <span style="font-weight:700">Skipped ${esc(catMeta.label)}</span>
            <span>(${savedSec.toFixed(1)}s saved)</span>
          </div>
          <div class="hud-actions">
            <button class="hud-btn undo-btn" id="hud-undo-btn">Undo</button>
            <button class="hud-btn vote-btn" id="hud-vote-up" title="Upvote segment">👍</button>
            <button class="hud-btn vote-btn" id="hud-vote-down" title="Downvote segment">👎</button>
            <button class="hud-btn close-btn" id="hud-close-btn">&times;</button>
          </div>
        `;

        hud.className = "show";

        // Bind Undo Action
        hud.querySelector("#hud-undo-btn").addEventListener("click", () => {
          const videoEl = ie.el();
          if (videoEl) {
            videoEl.currentTime = seg.segment[0];
            pe("Returned to start of " + catMeta.label, 1500, "info");
          }
          hud.className = "";
        });

        // Bind Vote Actions
        hud.querySelector("#hud-vote-up").addEventListener("click", () => {
          API.voteOnSegment(seg.UUID, 1).then(success => {
            pe(success ? "Upvote submitted" : "Vote failed", 1500, success ? "success" : "error");
          });
          hud.className = "";
        });

        hud.querySelector("#hud-vote-down").addEventListener("click", () => {
          API.voteOnSegment(seg.UUID, 0).then(success => {
            pe(success ? "Downvote submitted" : "Vote failed", 1500, success ? "success" : "error");
          });
          hud.className = "";
        });

        hud.querySelector("#hud-close-btn").addEventListener("click", () => {
          hud.className = "";
        });

        hudTimer = setTimeout(() => {
          hud.className = "";
        }, S.sbToastDur || 6000);
      };

      const toggleSubmissionEditor = () => {
        if (State.editor.active) {
          closeSubmissionEditor();
          return;
        }

        const videoEl = ie.el();
        if (!videoEl) {
          pe("Open a video first", 1800, "error");
          return;
        }

        State.editor.active = true;
        State.editor.start = videoEl.currentTime;
        State.editor.end = videoEl.currentTime + 10;
        State.editor.category = "sponsor";
        State.editor.description = "";

        let panel = document.getElementById("yt-zen-sb-editor");
        if (!panel) {
          panel = document.createElement("div");
          panel.id = "yt-zen-sb-editor";
          document.body.appendChild(panel);
        }

        State.editor.element = panel;
        renderEditorUI();
        panel.className = "show";
        pe("Segment submission editor opened", 1500, "info");
      };

      const renderEditorUI = () => {
        const panel = State.editor.element;
        if (!panel) return;

        let catOptions = "";
        const esc = ZenResources.Dom.esc;
        Categories.forEach(c => {
          catOptions += `<option value="${esc(c.id)}" ${State.editor.category === c.id ? "selected" : ""}>${esc(c.label)}</option>`;
        });

        panel.innerHTML = `
          <div style="font-weight:700;font-size:14px;color:#fff;margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:6px">
            Submit Sponsorship Segment
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span class="zen-meta">Start time:</span>
              <div>
                <input type="text" class="editor-input" id="ed-start-val" value="${State.editor.start.toFixed(2)}">
                <button class="editor-btn mini-btn" id="ed-start-now">Set Current</button>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span class="zen-meta">End time:</span>
              <div>
                <input type="text" class="editor-input" id="ed-end-val" value="${State.editor.end.toFixed(2)}">
                <button class="editor-btn mini-btn" id="ed-end-now">Set Current</button>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span class="zen-meta">Category:</span>
              <select class="editor-select" id="ed-cat-val">
                ${catOptions}
              </select>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <span class="zen-meta">Description / Chapter title:</span>
              <input type="text" class="editor-text-input" id="ed-desc-val" value="${ZenResources.Dom.esc(State.editor.description)}" placeholder="Optional chapter title...">
            </div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="editor-btn primary-btn" style="flex:1" id="ed-submit">Submit</button>
              <button class="editor-btn" style="flex:1" id="ed-preview">Preview Segment</button>
              <button class="editor-btn danger-btn" id="ed-cancel">Cancel</button>
            </div>
          </div>
        `;

        // Bind events
        panel.querySelector("#ed-start-now").addEventListener("click", () => {
          const videoEl = ie.el();
          if (videoEl) {
            State.editor.start = videoEl.currentTime;
            panel.querySelector("#ed-start-val").value = State.editor.start.toFixed(2);
          }
        });

        panel.querySelector("#ed-end-now").addEventListener("click", () => {
          const videoEl = ie.el();
          if (videoEl) {
            State.editor.end = videoEl.currentTime;
            panel.querySelector("#ed-end-val").value = State.editor.end.toFixed(2);
          }
        });

        panel.querySelector("#ed-cat-val").addEventListener("change", (ev) => {
          State.editor.category = ev.target.value;
        });

        panel.querySelector("#ed-desc-val").addEventListener("input", (ev) => {
          State.editor.description = ev.target.value;
        });

        panel.querySelector("#ed-preview").addEventListener("click", () => {
          const start = parseFloat(panel.querySelector("#ed-start-val").value);
          const end = parseFloat(panel.querySelector("#ed-end-val").value);
          if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
            pe("Invalid segment times", 1800, "error");
            return;
          }
          State.segments.push({
            category: State.editor.category,
            segment: [start, end],
            UUID: "preview-uuid-" + Date.now(),
            actionType: "skip",
            votes: 1,
            locked: 0,
            videoDuration: ie.el() ? ie.el().duration : 0,
            description: State.editor.description
          });
          State.segments.sort((a, b) => a.segment[0] - b.segment[0]);
          invalidateRenderCache();
          renderSeekbarMarks();
          pe("Preview segment added locally", 1800, "success");
        });

        panel.querySelector("#ed-submit").addEventListener("click", () => {
          const videoId = ie.videoId();
          const start = parseFloat(panel.querySelector("#ed-start-val").value);
          const end = parseFloat(panel.querySelector("#ed-end-val").value);
          if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
            pe("Invalid segment times", 1800, "error");
            return;
          }
          pe("Submitting segment...", 1500, "info");
          API.submitSegment(videoId, start, end, State.editor.category, State.editor.description)
            .then(success => {
              if (success) {
                pe("Segment submitted successfully!", 2000, "success");
                // Clear local previews and re-fetch
                SponsorBlockEngine.invalidate(videoId);
                closeSubmissionEditor();
              } else {
                pe("Submission failed", 2000, "error");
              }
            });
        });

        panel.querySelector("#ed-cancel").addEventListener("click", () => {
          closeSubmissionEditor();
        });
      };

      const closeSubmissionEditor = () => {
        State.editor.active = false;
        const panel = document.getElementById("yt-zen-sb-editor");
        if (panel) {
          panel.className = "";
        }
      };

      return {
        renderSeekbarMarks,
        clearMarks,
        startWatchdog,
        stopWatchdog,
        invalidateRenderCache,
        showFloatingHUD,
        toggleSubmissionEditor
      };
    })();

    // ─── Orchestrator ────────────────────────────────────────────────────────
    const attachLifecycleListeners = () => {
      if (State.lifecycleAttached || typeof document === "undefined") return;
      const cleanup = [];
      const queueCurrentLookup = (force = false) => {
        if (!S.sponsorblockOn) return;
        const videoId = ie && typeof ie.videoId === "function" ? ie.videoId() : null;
        if (!VIDEO_ID_RE.test(String(videoId || ""))) return;
        if (!force && State.videoId === videoId) return;
        Promise.resolve(init(videoId, force ? { revalidate: true } : {})).catch(() => {});
      };
      const onVisibility = () => {
        if (document.visibilityState === "visible") {
          const now = Date.now();
          if (now - State.lastWakeLookupAt < 15000) return;
          State.lastWakeLookupAt = now;
          queueCurrentLookup(true);
        }
      };
      const onNavigation = () => queueCurrentLookup(false);
      const onMediaState = (event) => {
        if (event.type === "timeupdate" && State.videoId) return;
        queueCurrentLookup(false);
      };
      document.addEventListener("visibilitychange", onVisibility, { passive: true });
      document.addEventListener("yt-navigate-finish", onNavigation, true);
      document.addEventListener("loadedmetadata", onMediaState, true);
      document.addEventListener("playing", onMediaState, true);
      document.addEventListener("emptied", onMediaState, true);
      cleanup.push(() => document.removeEventListener("visibilitychange", onVisibility));
      cleanup.push(() => document.removeEventListener("yt-navigate-finish", onNavigation, true));
      cleanup.push(() => document.removeEventListener("loadedmetadata", onMediaState, true));
      cleanup.push(() => document.removeEventListener("playing", onMediaState, true));
      cleanup.push(() => document.removeEventListener("emptied", onMediaState, true));
      if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("focus", onVisibility, { passive: true });
        window.addEventListener("popstate", onNavigation, true);
        cleanup.push(() => window.removeEventListener("focus", onVisibility));
        cleanup.push(() => window.removeEventListener("popstate", onNavigation, true));
      }
      const dispose = () => {
        while (cleanup.length) {
          try { cleanup.pop()(); } catch (_) {}
        }
        State.lifecycleAttached = false;
        State.lifecycleCleanup = null;
      };
      State.lifecycleAttached = true;
      State.lifecycleCleanup = dispose;
      if (Yt && Yt["sponsorblock"]) Yt["sponsorblock"].push(() => {
        if (State.lifecycleCleanup === dispose) dispose();
      });
    };

    const detachLifecycleListeners = () => {
      if (State.lifecycleCleanup) State.lifecycleCleanup();
    };

    const abortActiveRequests = () => {
      if (State.abortController) {
        try { State.abortController.abort(); } catch (_) {}
        State.abortController = null;
      }
      for (const controller of Array.from(State.backgroundControllers || [])) {
        try { controller.abort(); } catch (_) {}
      }
      if (State.backgroundControllers) State.backgroundControllers.clear();
    };

    const canCommit = (videoId, generation) =>
      State.videoId === videoId && State.generation === generation;

    const applySegments = (videoId, generation, segments, hidden, meta = {}) => {
      if (!canCommit(videoId, generation)) return false;
      State.segments = Array.isArray(segments) ? segments.slice() : [];
      Metrics.recordSegments(State.segments.length);
      State.activeSegmentIndex = -1;
      if (hidden) {
        Player.detachListeners();
        UI.clearMarks();
      } else {
        UI.invalidateRenderCache();
        UI.renderSeekbarMarks();
        Player.attachListeners();
        UI.startWatchdog();
      }
      g.emit("sb.segments", Object.assign({
        videoId,
        count: State.segments.length,
        cached: !!meta.cached,
        stale: !!meta.stale,
        hidden: !!hidden,
      }, meta));
      if (hidden) g.emit("sb.hidden", { videoId, hidden: true });
      return true;
    };

    const fetchAndCache = async (videoId, configKey, abortSignal) => {
      try {
        const segments = await API.fetchWithRetry(videoId, abortSignal);
        await Cache.set(videoId, configKey, segments);
        return segments;
      } catch (err) {
        if (err && err.name === "AbortError") throw err;
        Metrics.recordApiError();
        try {
          const fallback = await Cache.get(videoId, configKey, true);
          return fallback && Array.isArray(fallback.data) ? fallback.data : [];
        } catch (_) {
          return [];
        }
      }
    };

    const performInit = async (videoId, options = {}) => {
      initUserId();
      const generation = ++State.generation;
      abortActiveRequests();
      Player.resetMuteState();
      Player.detachListeners();
      State.videoId = null;
      State.hidden = false;
      State.segments = [];
      State.processedUUIDs.clear();
      State.activeSegmentIndex = -1;
      UI.clearMarks();

      if (!videoId || !VIDEO_ID_RE.test(String(videoId))) {
        State.lastInitCompletedAt = Date.now();
        return [];
      }
      if (!S.sponsorblockOn) {
        State.lastInitCompletedAt = Date.now();
        return [];
      }
      if (options.force || options.revalidate) Cache.clearInFlightForVideo(videoId);

      attachLifecycleListeners();
      State.videoId = videoId;
      // Hiding a video suppresses playback/UI actions, not the lookup. A
      // hidden video's cache must still be refreshed so the next unhide is
      // immediate and every watch navigation performs an API check.
      const hidden = await HiddenVideos.isHidden(videoId);
      if (!canCommit(videoId, generation)) return [];
      State.hidden = hidden;
      const configKey = Settings.getConfigKey();
      const inFlightKey = videoId + ":" + configKey;

      try {
        const cached = await Cache.get(videoId, configKey, false);
        if (!canCommit(videoId, generation)) return [];

        if (cached && cached.fresh) {
          applySegments(videoId, generation, cached.data, hidden, { cached: true });
          // Do not trust a fresh cache as the final authority: revalidate on
          // every video load, while deduplicating concurrent lookups.
          backgroundRefresh(videoId, configKey, inFlightKey, generation);
          State.lastInitCompletedAt = Date.now();
          return State.segments.slice();
        }

        const stale = cached || await Cache.get(videoId, configKey, true);
        if (stale && canCommit(videoId, generation)) {
          applySegments(videoId, generation, stale.data, hidden, { cached: true, stale: true });
        }

        let fetchPromise = Cache.getInFlight(inFlightKey);
        if (fetchPromise) {
          Metrics.recordDeduped();
        } else {
          const controller = new AbortController();
          State.abortController = controller;
          fetchPromise = fetchAndCache(videoId, configKey, controller.signal);
          Cache.setInFlight(inFlightKey, fetchPromise);
          fetchPromise.then(
            () => Cache.clearInFlight(inFlightKey, fetchPromise),
            () => Cache.clearInFlight(inFlightKey, fetchPromise),
          );
        }

        const freshSegments = await fetchPromise;
        if (canCommit(videoId, generation)) {
          applySegments(videoId, generation, freshSegments, hidden, { cached: false });
          State.lastInitCompletedAt = Date.now();
        }
        return canCommit(videoId, generation) ? State.segments.slice() : [];
      } catch (err) {
        if (err && err.name !== "AbortError") {
          try { h("[SB] init error for " + videoId + ":", err); } catch (_) {}
          Metrics.recordApiError();
        }
        if (canCommit(videoId, generation)) {
          // A stale cache may already be displayed; do not erase it on a
          // transient failure. Cold-cache failures simply expose no segments.
          if (!State.segments.length) applySegments(videoId, generation, [], hidden, { cached: false, error: true });
          State.lastInitCompletedAt = Date.now();
          return State.segments.slice();
        }
        return [];
      } finally {
        if (State.abortController && State.abortController.signal && State.abortController.signal.aborted) {
          State.abortController = null;
        }
      }
    };

    const init = async (videoId, opts = {}) => {
      const force = !!(opts && opts.force);
      const revalidate = !!(opts && opts.revalidate);
      const recentWindowMs = 2000;
      if (!force && State.initPromise && State.initPromiseVideoId === videoId) {
        Metrics.recordDeduped();
        return State.initPromise;
      }
      if (!force && !revalidate && videoId && State.videoId === videoId && Date.now() - State.lastInitCompletedAt < recentWindowMs) {
        return State.segments.slice();
      }
      const promise = performInit(videoId, { force, revalidate }).finally(() => {
        if (State.initPromise === promise) {
          State.initPromise = null;
          State.initPromiseVideoId = null;
        }
      });
      State.initPromise = promise;
      State.initPromiseVideoId = videoId || null;
      return promise;
    };

    const backgroundRefresh = async (videoId, configKey, inFlightKey, generation) => {
      if (Cache.getInFlight(inFlightKey)) return Cache.getInFlight(inFlightKey);
      const controller = new AbortController();
      if (!State.backgroundControllers) State.backgroundControllers = new Set();
      State.backgroundControllers.add(controller);
      const refreshPromise = fetchAndCache(videoId, configKey, controller.signal)
        .then((segments) => {
          if (canCommit(videoId, generation)) applySegments(videoId, generation, segments, State.hidden, { cached: false, background: true });
          return segments;
        })
        .catch((err) => {
          if (err && err.name !== "AbortError") Metrics.recordApiError();
          return [];
        })
        .finally(() => {
          State.backgroundControllers && State.backgroundControllers.delete(controller);
          Cache.clearInFlight(inFlightKey, refreshPromise);
        });
      Cache.setInFlight(inFlightKey, refreshPromise);
      return refreshPromise;
    };

    const destroy = () => {
      const previousVideoId = State.videoId;
      State.generation++;
      abortActiveRequests();
      detachLifecycleListeners();
      Cache.clearInFlightForVideo(previousVideoId);
      // Do not let a promise from a disabled feature suppress the next
      // enable/navigation lookup.
      State.initPromise = null;
      State.initPromiseVideoId = null;
      Player.detachListeners();
      Player.resetMuteState();
      UI.stopWatchdog();
      State.videoId = null;
      State.hidden = false;
      State.segments = [];
      State.processedUUIDs.clear();
      State.activeSegmentIndex = -1;
    };

    const invalidate = async (videoId) => {
      if (!videoId) return;
      await Cache.invalidate(videoId);
      if (State.videoId === videoId) {
        await init(videoId, { force: true });
      }
    };

    const hideVideo = async (videoId) => {
      if (!videoId) return false;
      await HiddenVideos.hide(videoId);
      await invalidate(videoId);
      return true;
    };

    const unhideVideo = async (videoId) => {
      if (!videoId) return false;
      await HiddenVideos.unhide(videoId);
      await invalidate(videoId);
      return true;
    };

    const refreshCurrent = async () => {
      const videoId = State.videoId || ie.videoId();
      if (!videoId) return [];
      await invalidate(videoId);
      return State.segments.slice();
    };

    const getLocalUserId = () => {
      initUserId();
      return State.userId || "";
    };

    const copyLocalUserId = async () => {
      const userId = getLocalUserId();
      if (!userId) return "";
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          await navigator.clipboard.writeText(userId);
        }
      } catch (_) {}
      return userId;
    };

    const debugInfo = () => ({
      videoId: State.videoId,
      segments: State.segments.length,
      lastFetchPlan: State.lastFetchPlan || "",
      lastLookupTrace: State.lastLookupTrace.slice(),
      hidden: State.videoId ? !!State.hidden : null,
    });

    return {
      init,
      destroy,
      invalidate,
      hideVideo,
      unhideVideo,
      refreshCurrent,
      getLocalUserId,
      copyLocalUserId,
      isVideoHidden: (videoId) => HiddenVideos.isHidden(videoId),
      getUserInfo: (userId, force = false) => API.getUserInfo(userId, null, force),
      voteUp: (uuid) => API.voteOnSegment(uuid, 1),
      voteDown: (uuid) => API.voteOnSegment(uuid, 0),
      undoVote: (uuid) => API.undoVote(uuid),
      changeSegmentCategory: (uuid, category) => API.changeCategory(uuid, category),
      stats: () => Metrics.snapshot(),
      metrics: () => Metrics.snapshot(),
      debugInfo,
      getActionOptions: Settings.getActionOptions,
      getSegments: () => State.segments.slice(),
      api: {
        fetchWithRetry: API.fetchWithRetry,
        voteOnSegment: API.voteOnSegment,
        undoVote: API.undoVote,
        changeCategory: API.changeCategory,
        submitSegment: API.submitSegment,
        reportViewed: API.reportViewed,
        getUserInfo: API.getUserInfo,
        hashPrefix: API.hashPrefix,
        normalizeSegments: API.normalizeSegments,
      },
      toggleSubmissionEditor: () => UI.toggleSubmissionEditor()
    };
  })();
