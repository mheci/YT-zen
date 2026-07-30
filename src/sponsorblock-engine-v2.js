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

    const CACHE_VERSION = 3;
    const CACHE_TTL_MS = 60 * 60 * 1000;          // 1 hour runtime
    const PERSIST_TTL_MS = 24 * 60 * 60 * 1000;   // 24 hours persistent
    const STALE_GRACE_MS = 12 * 60 * 60 * 1000;    // 12 hours stale grace
    const MAX_CACHE_ENTRIES = 128;
    const API_TIMEOUT_MS = 8000;
    const MAX_RETRIES = 2;
    const RETRY_BASE_MS = 500;
    const SKIP_COOLDOWN_MS = 500;
    const SEEK_TOLERANCE = 0.3; // seconds
    const POINT_SEGMENT_EPSILON = 0.05;

    // ─── Shared State Context ────────────────────────────────────────────────
    const State = {
      videoId: null,
      segments: [],
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
        hitRate: (cacheHits + cacheMisses) > 0
          ? Math.round((cacheHits / (cacheHits + cacheMisses)) * 100) : 0,
      });

      load();

      return {
        recordSkip, recordSegments, recordCacheHit, recordCacheMiss,
        recordApiError, recordStaleServed, recordDeduped, snapshot, load,
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

      const getCategoryAction = (categoryId) => {
        if (!S["sb_" + categoryId + "_en"]) return "disabled";
        return S["sb_" + categoryId + "_act"] || "skip";
      };

      const getConfigKey = () => {
        const privacy = S.sbPrivacy ? "1" : "0";
        return `${privacy}`;
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
        getEnabledCategories, getActionTypes, getCategoryAction,
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

      const get = async (videoId, configKey, allowStale = false) => {
        const cacheKey = "sb:" + videoId + ":" + configKey;
        const now = Date.now();

        // Layer 1: Memory
        if (memCache.has(cacheKey)) {
          const entry = memCache.get(cacheKey);
          memCache.delete(cacheKey);
          memCache.set(cacheKey, entry); // LRU: move to end
          if (entry.version !== CACHE_VERSION) {
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
            if (entry.version !== CACHE_VERSION) {
              await x("kv", "cache:" + cacheKey);
              return null;
            }
            if (entry.expiresAt > now) {
              memCache.set(cacheKey, entry);
              evictIfNeeded();
              Metrics.recordCacheHit();
              return { data: entry.segments, fresh: true };
            }
            if (allowStale && entry.expiresAt + STALE_GRACE_MS > now) {
              memCache.set(cacheKey, entry);
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
      const setInFlight = (key, promise) => { inFlight.set(key, promise); };
      const clearInFlight = (key) => { inFlight.delete(key); };

      const invalidate = async (videoId) => {
        if (!videoId) return;
        const cacheKeys = new Set();
        for (const key of Array.from(memCache.keys())) {
          if (key.startsWith("sb:" + videoId + ":")) {
            memCache.delete(key);
            cacheKeys.add(key);
          }
        }
        for (const key of Array.from(inFlight.keys())) {
          if (key.startsWith(videoId + ":")) inFlight.delete(key);
        }
        cacheKeys.add("sb:" + videoId + ":0");
        cacheKeys.add("sb:" + videoId + ":1");
        await Promise.all(Array.from(cacheKeys, (cacheKey) => x("kv", "cache:" + cacheKey)));
      };

      return { get, set, getInFlight, setInFlight, clearInFlight, invalidate };
    })();

    // ─── API Module ──────────────────────────────────────────────────────────
    const API = (() => {
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

      const buildUrl = async (videoId, usePrivacy, categories, actionTypes) => {
        const base = Settings.getServerUrl();
        const params = new URLSearchParams();

        if (usePrivacy) {
          const prefix = await hashPrefix(videoId);
          return base + "/api/skipSegments/" + prefix + "?categories=" +
            encodeURIComponent(JSON.stringify(categories)) +
            (actionTypes.length ? "&actionTypes=" + encodeURIComponent(JSON.stringify(actionTypes)) : "");
        } else {
          params.set("videoID", videoId);
          categories.forEach(c => params.append("category", c));
          if (actionTypes.length) {
            actionTypes.forEach(a => params.append("actionType", a));
          }
          return base + "/api/skipSegments?" + params.toString();
        }
      };

      const validateSegment = (seg, index) => {
        if (!seg || typeof seg !== "object") return null;
        if (!Array.isArray(seg.segment) || seg.segment.length < 2) return null;

        const start = Number(seg.segment[0]);
        const end = Number(seg.segment[1]);

        if (!isFinite(start) || !isFinite(end)) return null;
        if (start < 0 || end < 0) return null;
        if (start > end && !(start === 0 && end === 0)) return null;

        const category = typeof seg.category === "string" ? seg.category : "";
        if (!category) return null;

        const UUID = typeof seg.UUID === "string" ? seg.UUID : ("idx-" + index + "-" + start);
        const actionType = typeof seg.actionType === "string" ? seg.actionType : "skip";
        const votes = typeof seg.votes === "number" ? seg.votes : 0;
        const locked = typeof seg.locked === "number" ? seg.locked : 0;
        const videoDuration = typeof seg.videoDuration === "number" ? seg.videoDuration : 0;
        const description = typeof seg.description === "string" ? seg.description : "";

        return { category, segment: [start, end], UUID, actionType, votes, locked, videoDuration, description };
      };

      const fetchSegments = async (videoId, abortSignal) => {
        const usePrivacy = !!S.sbPrivacy;
        const allCategories = Categories.map(c => c.id);
        const allActionTypes = ["skip", "mute", "poi", "chapter", "full"];

        const url = await buildUrl(videoId, usePrivacy, allCategories, allActionTypes);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        if (abortSignal) {
          const onAbort = () => controller.abort();
          abortSignal.addEventListener("abort", onAbort, { once: true });
        }

        try {
          const response = await he(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (response.status === 404) return [];
          if (response.status === 400) {
            throw new Error("Bad request (400) — invalid parameters");
          }
          if (!response.ok) {
            throw new Error("HTTP " + response.status);
          }

          let body;
          try {
            body = await response.json();
          } catch (_) {
            throw new Error("Malformed JSON response");
          }

          if (usePrivacy && Array.isArray(body)) {
            const videoHit = body.find(v => v && v.videoID === videoId);
            body = (videoHit && Array.isArray(videoHit.segments)) ? videoHit.segments : [];
          }

          if (!Array.isArray(body)) return [];

          const valid = [];
          for (let idx = 0; idx < body.length; idx++) {
            const seg = validateSegment(body[idx], idx);
            if (seg) valid.push(seg);
          }

          valid.sort((a, b) => a.segment[0] - b.segment[0]);

          return valid;
        } catch (err) {
          clearTimeout(timeoutId);
          if (err.name === "AbortError") throw err;
          throw err;
        }
      };

      const fetchWithRetry = async (videoId, abortSignal) => {
        let lastError = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            return await fetchSegments(videoId, abortSignal);
          } catch (err) {
            lastError = err;
            if (err.name === "AbortError") throw err;
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

      const voteOnSegment = async (uuid, type) => {
        if (!uuid || !State.userId) return false;
        const base = Settings.getServerUrl();
        const params = new URLSearchParams({
          UUID: uuid,
          userID: State.userId,
          type: String(type)
        });
        try {
          const resp = await he(base + "/api/voteOnSponsorTime?" + params, {
            method: "POST",
            signal: AbortSignal.timeout(API_TIMEOUT_MS)
          });
          return resp.ok;
        } catch (_) { return false; }
      };

      const submitSegment = async (videoId, start, end, category, description = "") => {
        if (!videoId || !State.userId) return false;
        const base = Settings.getServerUrl();
        const bodyData = {
          videoID: videoId,
          userID: State.userId,
          userAgent: "YT-zen/" + (typeof GM_info !== "undefined" ? GM_info.script.version : "3.6.0"),
          service: "YouTube",
          segments: [{
            segment: [start, end],
            category: category,
            actionType: category === "poi_highlight" ? "poi" : category === "exclusive_access" ? "full" : category === "chapter" ? "chapter" : "skip",
            description: description
          }]
        };

        try {
          const resp = await he(base + "/api/skipSegments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyData),
            signal: AbortSignal.timeout(API_TIMEOUT_MS)
          });
          return resp.ok;
        } catch (_) { return false; }
      };

      const reportViewed = async (uuid) => {
        if (!uuid) return;
        const base = Settings.getServerUrl();
        try {
          await he(base + "/api/viewedVideoSponsorTime?UUID=" + encodeURIComponent(uuid), {
            method: "POST"
          });
        } catch (_) {}
      };

      return { fetchWithRetry, voteOnSegment, submitSegment, reportViewed, hashPrefix };
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
        if (ie.isAd && ie.isAd()) return;
        if (typeof _a === "function" && _a()) return;

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

        const catMeta = Categories.find(c => c.id === seg.category) || { label: seg.category, color: "#fff" };

        hud.innerHTML = `
          <div class="hud-header" style="border-left: 4px solid ${catMeta.color}">
            <span style="font-weight:700">Skipped ${catMeta.label}</span>
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
        Categories.forEach(c => {
          catOptions += `<option value="${c.id}" ${State.editor.category === c.id ? "selected" : ""}>${c.label}</option>`;
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
              <input type="text" class="editor-text-input" id="ed-desc-val" value="${State.editor.description}" placeholder="Optional chapter title...">
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
    const init = async (videoId) => {
      initUserId();

      if (State.abortController) {
        try { State.abortController.abort(); } catch (_) {}
        State.abortController = null;
      }

      Player.resetMuteState();
      Player.detachListeners();
      State.videoId = null;
      State.segments = [];
      State.processedUUIDs.clear();
      State.activeSegmentIndex = -1;

      if (!videoId) {
        UI.clearMarks();
        return;
      }

      if (await HiddenVideos.isHidden(videoId)) {
        UI.clearMarks();
        g.emit("sb.hidden", { videoId, hidden: true });
        return;
      }

      if (!S.sponsorblockOn) {
        UI.clearMarks();
        return;
      }

      State.videoId = videoId;
      UI.clearMarks();

      const configKey = Settings.getConfigKey();
      const inFlightKey = videoId + ":" + configKey;

      try {
        const categories = Settings.getEnabledCategories();
        if (!categories.length) return;

        let cached = await Cache.get(videoId, configKey, false);

        if (cached && cached.fresh) {
          State.segments = cached.data;
          Metrics.recordSegments(State.segments.length);
          UI.renderSeekbarMarks();
          Player.attachListeners();
          UI.startWatchdog();
          g.emit("sb.segments", { videoId, count: State.segments.length, cached: true });
          backgroundRefresh(videoId, configKey, inFlightKey);
          return;
        }

        let staleData = cached || await Cache.get(videoId, configKey, true);
        if (staleData) {
          State.segments = staleData.data;
          Metrics.recordSegments(State.segments.length);
          UI.renderSeekbarMarks();
          Player.attachListeners();
          UI.startWatchdog();
          g.emit("sb.segments", { videoId, count: State.segments.length, cached: true, stale: true });
        }

        const existing = Cache.getInFlight(inFlightKey);
        if (existing) {
          Metrics.recordDeduped();
          State.segments = await existing;
        } else {
          State.abortController = new AbortController();
          const fetchPromise = (async () => {
            try {
              const segments = await API.fetchWithRetry(videoId, State.abortController.signal);
              Metrics.recordSegments(segments.length);
              await Cache.set(videoId, configKey, segments);
              return segments;
            } catch (err) {
              if (err.name === "AbortError") return State.segments;
              Metrics.recordApiError();
              const fallback = await Cache.get(videoId, configKey, true);
              return (fallback && fallback.data) || State.segments;
            }
          })();

          Cache.setInFlight(inFlightKey, fetchPromise);
          const freshSegments = await fetchPromise;
          Cache.clearInFlight(inFlightKey);

          if (State.videoId === videoId) {
            State.segments = freshSegments;
            UI.invalidateRenderCache();
            UI.renderSeekbarMarks();
            Player.attachListeners();
            UI.startWatchdog();
            g.emit("sb.segments", { videoId, count: State.segments.length, cached: false });
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          try { h("[SB] init error for " + videoId + ":", err); } catch (_) {}
          Metrics.recordApiError();
        }
        State.segments = [];
      }
    };

    const backgroundRefresh = async (videoId, configKey, inFlightKey) => {
      if (Cache.getInFlight(inFlightKey)) return;

      const refreshPromise = (async () => {
        try {
          const ctrl = new AbortController();
          const segments = await API.fetchWithRetry(videoId, ctrl.signal);
          await Cache.set(videoId, configKey, segments);
          if (State.videoId === videoId) {
            State.segments = segments;
            UI.invalidateRenderCache();
            UI.renderSeekbarMarks();
          }
          return segments;
        } catch (_) {
          return State.segments;
        }
      })();

      Cache.setInFlight(inFlightKey, refreshPromise);
      refreshPromise.finally(() => Cache.clearInFlight(inFlightKey));
    };

    const destroy = () => {
      if (State.abortController) {
        try { State.abortController.abort(); } catch (_) {}
        State.abortController = null;
      }
      Player.detachListeners();
      Player.resetMuteState();
      UI.stopWatchdog();
      State.videoId = null;
      State.segments = [];
      State.processedUUIDs.clear();
      State.activeSegmentIndex = -1;
    };

    const invalidate = async (videoId) => {
      if (!videoId) return;
      await Cache.invalidate(videoId);
      if (State.videoId === videoId) {
        await init(videoId);
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

    return {
      init,
      destroy,
      invalidate,
      hideVideo,
      unhideVideo,
      isVideoHidden: (videoId) => HiddenVideos.isHidden(videoId),
      stats: () => Metrics.snapshot(),
      metrics: () => Metrics.snapshot(),
      getSegments: () => State.segments.slice(),
      toggleSubmissionEditor: () => UI.toggleSubmissionEditor()
    };
  })();
