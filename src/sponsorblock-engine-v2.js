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

  // ─── Constants ───────────────────────────────────────────────────────────
  const Categories = i;
  const Actions = Yi;
  const CACHE_VERSION = 2;
  const CACHE_TTL_MS = 60 * 60 * 1000;          // 1 hour runtime
  const PERSIST_TTL_MS = 24 * 60 * 60 * 1000;   // 24 hours persistent
  const STALE_GRACE_MS = 12 * 60 * 60 * 1000;    // 12 hours stale grace
  const MAX_CACHE_ENTRIES = 128;
  const API_TIMEOUT_MS = 8000;
  const MAX_RETRIES = 2;
  const RETRY_BASE_MS = 500;
  const SKIP_COOLDOWN_MS = 500;
  const SEEK_TOLERANCE = 0.3; // seconds

  // ─── Shared State ────────────────────────────────────────────────────────
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

  // ─── Settings Resolution ─────────────────────────────────────────────────
  const Settings = (() => {
    const getEnabledCategories = () => {
      const enabled = Categories.filter(c => S["sb_" + c.id + "_en"]).map(c => c.id);
      if (enabled.length === 0 && S.sponsorblockOn) {
        return ["sponsor", "selfpromo", "interaction", "intro", "outro"];
      }
      return enabled;
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
      const cats = getEnabledCategories();
      if (cats.length === 5 && !S["sb_sponsor_en"] && !S["sb_selfpromo_en"]) {
        if (["sponsor", "selfpromo", "interaction", "intro", "outro"].includes(categoryId)) return "skip";
      }
      if (!S["sb_" + categoryId + "_en"]) return "disabled";
      return S["sb_" + categoryId + "_act"] || "skip";
    };

    const getConfigKey = () => {
      const privacy = S.sbPrivacy ? "1" : "0";
      return `${privacy}`;
    };

    const getServerUrl = () => {
      return "https://sponsor.ajay.app";
    };

    return {
      getEnabledCategories, getActionTypes, getCategoryAction,
      getConfigKey, getServerUrl,
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

    const invalidate = (videoId) => {
      for (const key of memCache.keys()) {
        if (key.startsWith("sb:" + videoId + ":")) memCache.delete(key);
      }
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

    const voteOnSegment = async (uuid, type, userId) => {
      if (!uuid || !userId) return false;
      const base = Settings.getServerUrl();
      const params = new URLSearchParams({
        UUID: uuid, userID: userId, type: String(type),
      });
      try {
        const resp = await he(base + "/api/voteOnSponsorTime?" + params, {
          method: "POST", signal: AbortSignal.timeout(API_TIMEOUT_MS),
        });
        return resp.ok;
      } catch (_) { return false; }
    };

    const reportViewed = async (uuid) => {
      if (!uuid) return;
      const base = Settings.getServerUrl();
      try {
        await he(base + "/api/viewedVideoSponsorTime?UUID=" + encodeURIComponent(uuid), {
          method: "POST",
        });
      } catch (_) {}
    };

    const getUserInfo = async (userId) => {
      if (!userId) return null;
      const base = Settings.getServerUrl();
      try {
        const resp = await he(base + "/api/userInfo?userID=" + encodeURIComponent(userId), {
          signal: AbortSignal.timeout(API_TIMEOUT_MS),
        });
        if (!resp.ok) return null;
        return await resp.json();
      } catch (_) { return null; }
    };

    return { fetchWithRetry, voteOnSegment, reportViewed, getUserInfo, hashPrefix };
  })();

  // ─── Player Module ───────────────────────────────────────────────────────
  const Player = (() => {
    const findSegmentAtTime = (time) => {
      const segs = State.segments;
      if (!segs.length) return -1;

      let lo = 0, hi = segs.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const s = segs[mid];
        if (s.segment[0] <= time) {
          if (time < s.segment[1]) return mid;
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
        if (currentTime >= s.segment[0] && currentTime < s.segment[1]) {
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
          currentTime < segs[idx].segment[0] || currentTime >= segs[idx].segment[1]) {
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
        const targetTime = seg.segment[1];

        if (State.processedUUIDs.has(uuid) && shouldSkipGuard(targetTime)) return;

        if (!State.processedUUIDs.has(uuid)) {
          State.processedUUIDs.add(uuid);
          const savedSec = Math.max(0, targetTime - currentTime);
          Metrics.recordSkip(savedSec);

          if (S.sbToast) {
            const catMeta = Categories.find(c => c.id === seg.category) || { label: seg.category };
            pe("Skipped " + catMeta.label + " (" + ce(savedSec) + ")", S.sbToastDur || 2200, "success");
          }

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
    let watchdogTimer = 0;

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

      const configKey = Settings.getConfigKey();
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

    const startWatchdog = () => {
      if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = 0; }

      watchdogTimer = setInterval(() => {
        if (!S.sponsorblockOn || !S.sbSeekbar) return;
        if (typeof _a === "function" && _a()) return;
        if (document.hidden) return;
        try { renderSeekbarMarks(); } catch (_) {}
      }, 3000);

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
      if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = 0; }
      if (seekbarObserver) { seekbarObserver.disconnect(); seekbarObserver = null; }
      clearMarks();
    };

    const invalidateRenderCache = () => {
      lastRenderedDuration = -1;
      lastRenderedSegmentCount = -1;
      lastRenderedConfigKey = "";
    };

    return { renderSeekbarMarks, clearMarks, startWatchdog, stopWatchdog, invalidateRenderCache };
  })();

  // ─── Orchestrator ────────────────────────────────────────────────────────
  const init = async (videoId) => {
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

    if (!S.sponsorblockOn || !videoId) {
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

  const invalidate = (videoId) => {
    if (videoId) {
      Cache.invalidate(videoId);
      if (State.videoId === videoId) {
        init(videoId);
      }
    }
  };

  return {
    init,
    destroy,
    invalidate,
    stats: () => Metrics.snapshot(),
    metrics: () => Metrics.snapshot(),
    getSegments: () => State.segments.slice(),
  };
})();