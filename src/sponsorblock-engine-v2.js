  const SponsorBlockEngine = (() => {
    "use strict";

    // ─── Categories & Action Types ───────────────────────────────────────────
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

    const CACHE_VERSION = 4;
    const CACHE_TTL_MS = 60 * 60 * 1000;
    const PERSIST_TTL_MS = 24 * 60 * 60 * 1000;
    const STALE_GRACE_MS = 12 * 60 * 60 * 1000;
    const MAX_CACHE_ENTRIES = 128;
    const API_TIMEOUT_MS = 8000;
    const MAX_RETRIES = 2;
    const RETRY_BASE_MS = 500;
    const SKIP_COOLDOWN_MS = 600;
    const SEEK_TOLERANCE = 0.3;

    // ─── Reactive State Manager (Proxy-Based) ────────────────────────────────
    const State = {
      videoId: null,
      segments: [],
      activeSegmentIndex: -1,
      mutedActive: false,
      originalVolume: null,
      originalMuted: false,
      processedUUIDs: new Set(),
      lastSkipTime: 0,
      lastSkipTarget: 0,
      abortController: null,
      listenersAttached: false,
      userId: null,
      editor: {
        active: false,
        start: 0,
        end: 0,
        category: "sponsor",
        description: "",
        element: null
      }
    };

    // Initialize random local SponsorBlock User ID (30 chars)
    const getUserId = () => {
      if (State.userId) return State.userId;
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
      return uid;
    };

    // ─── Settings Resolver ───────────────────────────────────────────────────
    const Settings = {
      getEnabledCategories: () => {
        const enabled = Categories.filter(c => S["sb_" + c.id + "_en"]).map(c => c.id);
        if (enabled.length === 0 && S.sponsorblockOn) {
          return ["sponsor", "selfpromo", "interaction", "intro", "outro"];
        }
        return enabled;
      },
      getCategoryAction: (categoryId) => {
        const cats = Settings.getEnabledCategories();
        if (cats.length === 5 && !S["sb_sponsor_en"] && !S["sb_selfpromo_en"]) {
          if (["sponsor", "selfpromo", "interaction", "intro", "outro"].includes(categoryId)) return "skip";
        }
        if (!S["sb_" + categoryId + "_en"]) return "disabled";
        return S["sb_" + categoryId + "_act"] || "skip";
      },
      getConfigKey: () => {
        return S.sbPrivacy ? "1" : "0";
      }
    };

    // ─── Cache Layer (Memory LRU & IDB SWR) ──────────────────────────────────
    const Cache = (() => {
      const memCache = new Map();
      const inFlight = new Map();

      const get = async (videoId, configKey, allowStale = false) => {
        const cacheKey = `sb:${videoId}:${configKey}`;
        const now = Date.now();

        if (memCache.has(cacheKey)) {
          const entry = memCache.get(cacheKey);
          memCache.delete(cacheKey);
          memCache.set(cacheKey, entry); // LRU promote
          if (entry.version === CACHE_VERSION) {
            if (entry.expiresAt > now) return { data: entry.segments, fresh: true };
            if (allowStale && entry.expiresAt + STALE_GRACE_MS > now) return { data: entry.segments, fresh: false };
          }
          memCache.delete(cacheKey);
        }

        try {
          const row = await v("kv", "cache:" + cacheKey);
          if (row && row.v && row.v.version === CACHE_VERSION) {
            const entry = row.v;
            if (entry.expiresAt > now) {
              memCache.set(cacheKey, entry);
              return { data: entry.segments, fresh: true };
            }
            if (allowStale && entry.expiresAt + STALE_GRACE_MS > now) {
              memCache.set(cacheKey, entry);
              return { data: entry.segments, fresh: false };
            }
            await x("kv", "cache:" + cacheKey);
          }
        } catch (_) {}
        return null;
      };

      const set = async (videoId, configKey, segments) => {
        const cacheKey = `sb:${videoId}:${configKey}`;
        const now = Date.now();
        const entry = {
          version: CACHE_VERSION,
          videoId,
          segments,
          expiresAt: now + CACHE_TTL_MS
        };

        memCache.set(cacheKey, entry);
        if (memCache.size > MAX_CACHE_ENTRIES) {
          const firstKey = memCache.keys().next().value;
          memCache.delete(firstKey);
        }

        try {
          await k("kv", {
            k: "cache:" + cacheKey,
            v: Object.assign({}, entry, { expiresAt: now + PERSIST_TTL_MS }),
            updatedAt: now
          });
        } catch (_) {}
      };

      return { get, set, inFlight };
    })();

    // ─── API Layer (CORS bypass via he) ──────────────────────────────────────
    const API = (() => {
      const getHashPrefix = async (videoId) => {
        try {
          const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(videoId));
          return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 4);
        } catch (_) {
          let h = 0;
          for (let i = 0; i < videoId.length; i++) h = ((h << 5) - h + videoId.charCodeAt(i)) | 0;
          return Math.abs(h).toString(16).padStart(4, "0").slice(0, 4);
        }
      };

      const buildUrl = async (videoId) => {
        const base = "https://sponsor.ajay.app";
        if (S.sbPrivacy) {
          const prefix = await getHashPrefix(videoId);
          return `${base}/api/skipSegments/${prefix}?categories=["sponsor","selfpromo","interaction","intro","outro","preview","hook","filler","music_offtopic","poi_highlight","exclusive_access","chapter"]`;
        }
        return `${base}/api/skipSegments?videoID=${videoId}&categories=["sponsor","selfpromo","interaction","intro","outro","preview","hook","filler","music_offtopic","poi_highlight","exclusive_access","chapter"]`;
      };

      const validateSegment = (seg, idx) => {
        if (!seg || typeof seg !== "object") return null;
        if (!Array.isArray(seg.segment) || seg.segment.length < 2) return null;
        const start = Number(seg.segment[0]);
        const end = Number(seg.segment[1]);
        if (isNaN(start) || isNaN(end) || start < 0 || end < start) return null;
        return {
          category: typeof seg.category === "string" ? seg.category : "sponsor",
          segment: [start, end],
          UUID: typeof seg.UUID === "string" ? seg.UUID : `idx-${idx}-${start}`,
          actionType: typeof seg.actionType === "string" ? seg.actionType : "skip",
          votes: typeof seg.votes === "number" ? seg.votes : 0,
          locked: typeof seg.locked === "number" ? seg.locked : 0,
          videoDuration: typeof seg.videoDuration === "number" ? seg.videoDuration : 0,
          description: typeof seg.description === "string" ? seg.description : ""
        };
      };

      const fetchSegments = async (videoId, abortSignal) => {
        const url = await buildUrl(videoId);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        if (abortSignal) {
          abortSignal.addEventListener("abort", () => controller.abort(), { once: true });
        }

        try {
          const response = await he(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (response.status === 404) return [];
          if (!response.ok) throw new Error("HTTP " + response.status);

          let body = await response.json();
          if (S.sbPrivacy && Array.isArray(body)) {
            const hit = body.find(v => v && v.videoID === videoId);
            body = (hit && Array.isArray(hit.segments)) ? hit.segments : [];
          }

          if (!Array.isArray(body)) return [];
          return body.map(validateSegment).filter(Boolean).sort((a, b) => a.segment[0] - b.segment[0]);
        } catch (err) {
          clearTimeout(timeoutId);
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
              await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
            }
          }
        }
        throw lastError;
      };

      const voteOnSegment = async (uuid, type) => {
        const uid = getUserId();
        const url = `https://sponsor.ajay.app/api/voteOnSponsorTime?UUID=${uuid}&userID=${uid}&type=${type}`;
        try {
          const resp = await he(url, { method: "POST", signal: AbortSignal.timeout(API_TIMEOUT_MS) });
          return resp.ok;
        } catch (_) { return false; }
      };

      const submitSegment = async (videoId, start, end, category, description = "") => {
        const uid = getUserId();
        const url = "https://sponsor.ajay.app/api/skipSegments";
        const bodyData = {
          videoID: videoId,
          userID: uid,
          userAgent: "YT-zen/3.5.7",
          service: "YouTube",
          segments: [{
            segment: [start, end],
            category: category,
            actionType: category === "poi_highlight" ? "poi" : category === "exclusive_access" ? "full" : category === "chapter" ? "chapter" : "skip",
            description: description
          }]
        };

        try {
          const resp = await he(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyData),
            signal: AbortSignal.timeout(API_TIMEOUT_MS)
          });
          return resp.ok;
        } catch (_) { return false; }
      };

      return { fetchWithRetry, voteOnSegment, submitSegment };
    })();

    // ─── Playback Engine Module ──────────────────────────────────────────────
    const Player = (() => {
      const getActiveSegmentAt = (time) => {
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
        return (now - State.lastSkipTime < SKIP_COOLDOWN_MS && Math.abs(State.lastSkipTarget - targetTime) < SEEK_TOLERANCE);
      };

      const executeActionForSegment = (idx) => {
        const videoEl = ie.el();
        if (!videoEl) return;

        const seg = State.segments[idx];
        if (!seg) return;

        const action = Settings.getCategoryAction(seg.category);
        if (action === "disabled" || action === "poi" || action === "chapter" || action === "full") {
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
          const uuid = seg.UUID;
          const targetTime = seg.segment[1];

          if (State.processedUUIDs.has(uuid) && shouldSkipGuard(targetTime)) return;

          if (!State.processedUUIDs.has(uuid)) {
            State.processedUUIDs.add(uuid);
            const savedSec = Math.max(0, targetTime - videoEl.currentTime);
            UI.showHUD(seg, savedSec);
          }

          if (!shouldSkipGuard(targetTime)) {
            State.lastSkipTime = performance.now();
            State.lastSkipTarget = targetTime;
            try { videoEl.currentTime = targetTime; } catch (_) {}
          }
        }
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

        if (idx < 0 || idx >= segs.length || !segs[idx] || currentTime < segs[idx].segment[0] || currentTime >= segs[idx].segment[1]) {
          idx = getActiveSegmentAt(currentTime);
        }

        if (idx !== State.activeSegmentIndex) {
          State.activeSegmentIndex = idx;
          if (idx !== -1) executeActionForSegment(idx);
        }
      };

      const handleEvent = (ev) => {
        const videoEl = ie.el();
        if (!videoEl || ev.target !== videoEl) return;

        switch (ev.type) {
          case "timeupdate":
            handlePlaybackTick();
            break;
          case "seeked":
            State.activeSegmentIndex = -1;
            resetMuteState();
            UI.renderSeekbarMarks();
            break;
          case "seeking":
            State.activeSegmentIndex = -1;
            break;
          case "emptied":
            resetMuteState();
            State.activeSegmentIndex = -1;
            State.processedUUIDs.clear();
            break;
          case "loadedmetadata":
          case "durationchange":
            UI.renderSeekbarMarks();
            break;
          case "ended":
          case "pause":
            resetMuteState();
            State.activeSegmentIndex = -1;
            break;
        }
      };

      const events = ["timeupdate", "seeked", "seeking", "emptied", "loadedmetadata", "durationchange", "ended", "pause"];

      const attachListeners = () => {
        if (State.listenersAttached) return;
        events.forEach(type => {
          document.addEventListener(type, handleEvent, true);
        });
        State.listenersAttached = true;
        Yt["sponsorblock"].push(() => detachListeners());
      };

      const detachListeners = () => {
        if (!State.listenersAttached) return;
        events.forEach(type => {
          document.removeEventListener(type, handleEvent, true);
        });
        State.listenersAttached = false;
      };

      return { attachListeners, detachListeners, resetMuteState, executeActionForSegment };
    })();

    // ─── UI Rendering Module ─────────────────────────────────────────────────
    const UI = (() => {
      let lastRenderedDuration = -1;
      let lastRenderedSegmentCount = -1;
      let lastRenderedConfigKey = "";
      let watchdogTimer = 0;
      let seekbarObserver = null;
      let hudTimer = 0;

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
        if (duration === lastRenderedDuration && segments.length === lastRenderedSegmentCount && configKey === lastRenderedConfigKey) {
          return;
        }

        const listContainer = document.querySelector(".ytp-progress-list") || document.querySelector(".ytp-progress-bar");
        if (!listContainer) return;

        lastRenderedDuration = duration;
        lastRenderedSegmentCount = segments.length;
        lastRenderedConfigKey = configKey;

        const desired = new Map();
        for (let idx = 0; idx < segments.length; idx++) {
          const seg = segments[idx];
          if (!S["sb_" + seg.category + "_en"]) continue;
          desired.set(seg.UUID || `i-${idx}`, { seg, idx });
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
          const color = (Categories.find(c => c.id === seg.category) || { color: "#fff" }).color;

          let el = St_seekbarMarks.get(key);
          if (!el) {
            el = document.createElement("div");
            el.dataset.sbKey = key;
            el.className = "ytp-sb-mark";
            listContainer.appendChild(el);
            St_seekbarMarks.set(key, el);
          }

          const css = `position:absolute;top:0;bottom:0;left:${start}%;width:${width}%;background:${color};opacity:0.75;pointer-events:none;z-index:31;border-radius:1px;`;
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

      const showHUD = (seg, savedSec) => {
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
          <div class="hud-header" style="border-left:4px solid ${catMeta.color}">
            <span style="font-weight:700">Skipped ${catMeta.label}</span>
            <span>(${savedSec.toFixed(1)}s saved)</span>
          </div>
          <div class="hud-actions">
            <button class="hud-btn undo-btn" id="hud-undo-btn">Undo</button>
            <button class="hud-btn vote-btn" id="hud-vote-up">👍</button>
            <button class="hud-btn vote-btn" id="hud-vote-down">👎</button>
            <button class="hud-btn close-btn" id="hud-close-btn">&times;</button>
          </div>
        `;
        hud.className = "show";

        hud.querySelector("#hud-undo-btn").addEventListener("click", () => {
          const videoEl = ie.el();
          if (videoEl) {
            videoEl.currentTime = seg.segment[0];
            pe("Returned to start of segment", 1500, "info");
          }
          hud.className = "";
        });

        hud.querySelector("#hud-vote-up").addEventListener("click", () => {
          API.voteOnSegment(seg.UUID, 1).then(ok => pe(ok ? "Upvoted!" : "Vote failed", 1500, ok ? "success" : "error"));
          hud.className = "";
        });

        hud.querySelector("#hud-vote-down").addEventListener("click", () => {
          API.voteOnSegment(seg.UUID, 0).then(ok => pe(ok ? "Downvoted!" : "Vote failed", 1500, ok ? "success" : "error"));
          hud.className = "";
        });

        hud.querySelector("#hud-close-btn").addEventListener("click", () => {
          hud.className = "";
        });

        hudTimer = setTimeout(() => { hud.className = ""; }, S.sbToastDur || 6000);
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

        let catOptions = Categories.map(c => `<option value="${c.id}" ${State.editor.category === c.id ? "selected" : ""}>${c.label}</option>`).join("");

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
          lastRenderedDuration = -1; // Force re-render
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
                invalidateRenderCache();
                init(videoId); // Re-fetch
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
        if (panel) panel.className = "";
      };

      const invalidateRenderCache = () => {
        lastRenderedDuration = -1;
        lastRenderedSegmentCount = -1;
        lastRenderedConfigKey = "";
      };

      return { renderSeekbarMarks, clearMarks, startWatchdog, stopWatchdog, invalidateRenderCache, showHUD, toggleSubmissionEditor };
    })();

    // ─── Orchestrator Context ────────────────────────────────────────────────
    const init = async (videoId) => {
      getUserId();

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
      const inFlightKey = `${videoId}:${configKey}`;

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

        const existing = Cache.inFlight.get(inFlightKey);
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

          Cache.inFlight.set(inFlightKey, fetchPromise);
          const freshSegments = await fetchPromise;
          Cache.inFlight.delete(inFlightKey);

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
      if (Cache.inFlight.has(inFlightKey)) return;

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

      Cache.inFlight.set(inFlightKey, refreshPromise);
      refreshPromise.finally(() => Cache.inFlight.delete(inFlightKey));
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
        if (State.videoId === videoId) init(videoId);
      }
    };

    return {
      init,
      destroy,
      invalidate,
      stats: () => Metrics.snapshot(),
      metrics: () => Metrics.snapshot(),
      getSegments: () => State.segments.slice(),
      toggleSubmissionEditor: () => UI.toggleSubmissionEditor()
    };
  })();
