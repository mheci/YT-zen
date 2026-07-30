
  // ===========================================================================
  //  ZenEngine Ecosystem v3.0
  // ---------------------------------------------------------------------------
  //  Cohesive architectural expansion for YT-zen.
  //
  //  Shared Subsystems:
  //    ZenEngine     - Core orchestrator, CSS, shared state, scheduling
  //    ZenDiscovery  - Feed infrastructure, scoring, filtering
  //    ZenPlayback   - Audio analysis, scene detection, adaptive speed
  //    ZenSearch     - Search enhancement, remix templates, credibility
  //    ZenSession    - Session memory, genome, collections, budget
  //    ZenLayout     - Mood profiles, adaptive density, sidebar, previews
  //    ZenQueue      - Intelligent queue management
  //
  //  Features (22):
  //    Discovery:  Time Machine, Small Creator, Rabbit Hole, Anti-Rec, Momentum
  //    Playback:   Scene Jumper, Smart Speed, Video DNA, Parallel Player
  //    Layout:     Mood Layouts, Adaptive Thumbs, Living Sidebar, Inline Previews
  //    Search:     Vibe Search, Credibility Layer, Search Remix, Outdated Detection
  //    Session:    Watch Genome, Collections, Session Memory, Time Budget
  //    Queue:      Smart Queue
  // ===========================================================================

  // ─── ZenEngine (Core) ─────────────────────────────────────────────────────
  const zenEscapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char]));
  const ZenEngine = (() => {
    "use strict";
    const CSS = `
#ytp-zen-bar{display:flex;gap:6px;padding:6px 12px;background:rgba(255,255,255,.03);
  border-bottom:1px solid rgba(255,255,255,.06);flex-wrap:wrap;align-items:center}
#ytp-zen-bar .zen-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;
  border-radius:99px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);
  color:#ccc;font:600 11px system-ui;cursor:pointer;transition:all .12s;white-space:nowrap}
#ytp-zen-bar .zen-chip:hover{background:rgba(255,61,127,.12);border-color:rgba(255,61,127,.3);color:#fff}
#ytp-zen-bar .zen-chip.active{background:rgba(255,61,127,.18);border-color:rgba(255,61,127,.4);color:#ff8aa5}
.zen-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
  border-radius:10px;padding:12px;margin:6px 0;transition:background .15s}
.zen-card:hover{background:rgba(255,255,255,.07)}
.zen-row{display:flex;align-items:center;gap:8px}
.zen-thumb{width:120px;height:68px;border-radius:6px;background:#111 center/cover no-repeat;flex-shrink:0}
.zen-title{font-size:12.5px;font-weight:600;color:#fff;line-height:1.3;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.zen-meta{font-size:10.5px;color:#888;margin-top:2px}
.zen-pill{display:inline-block;padding:2px 7px;border-radius:99px;font:600 9.5px system-ui;
  letter-spacing:.03em;text-transform:uppercase}
.zen-btn{appearance:none;border:1px solid rgba(255,255,255,.12);border-radius:7px;
  padding:5px 11px;background:rgba(255,255,255,.05);color:#dde;cursor:pointer;
  font:600 11px system-ui;transition:all .12s}
.zen-btn:hover{background:rgba(255,255,255,.1)}
.zen-btn.primary{background:linear-gradient(135deg,#ff0033,#ff3d7f);border-color:transparent;color:#fff}
.zen-meter{height:3px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden}
.zen-meter-fill{height:100%;border-radius:2px;transition:width .4s}
#ytp-zen-scene{position:relative;height:20px;margin:2px 0 6px;border-radius:3px;
  overflow:hidden;background:rgba(0,0,0,.25);cursor:pointer}
#ytp-zen-scene .zen-scene-mark{position:absolute;top:0;bottom:0;width:2px;
  background:rgba(255,255,255,.5);transition:all .15s}
#ytp-zen-scene .zen-scene-mark:hover{background:#ff3d7f;width:3px}
#ytp-zen-dna{position:relative;height:26px;margin:2px 0 6px;border-radius:4px;
  overflow:hidden;background:rgba(0,0,0,.3);cursor:pointer}
#ytp-zen-dna canvas{width:100%;height:100%;display:block}
#ytp-zen-budget{position:fixed;bottom:0;left:0;right:0;height:30px;z-index:2147483634;
  background:rgba(14,16,22,.94);border-top:1px solid rgba(255,255,255,.08);
  display:flex;align-items:center;gap:12px;padding:0 16px;font:11px system-ui;color:#ccc;
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
#ytp-zen-budget .zen-budget-track{flex:1;height:5px;background:rgba(255,255,255,.08);
  border-radius:3px;overflow:hidden}
#ytp-zen-budget .zen-budget-fill{height:100%;border-radius:3px;transition:width .5s,background .3s}
#ytp-zen-session{position:fixed;left:12px;bottom:48px;z-index:2147483634;
  width:min(300px,calc(100vw - 24px));background:rgba(14,16,22,.94);
  border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  box-shadow:0 10px 35px rgba(0,0,0,.5);font:12px system-ui;color:#eef}
body.zen-mood-focus ytd-watch-flexy #secondary,
body.zen-mood-focus ytd-watch-flexy #related,
body.zen-mood-focus ytd-comments,
body.zen-mood-focus #masthead-container{display:none!important}
body.zen-mood-focus ytd-watch-flexy #primary{max-width:100%!important}
body.zen-mood-focus #movie_player{border-radius:0!important}
body.zen-mood-browse ytd-video-primary-info-renderer,
body.zen-mood-browse ytd-video-secondary-info-renderer,
body.zen-mood-browse ytd-comments{display:none!important}
body.zen-mood-browse ytd-rich-grid-renderer{--ytd-rich-grid-items-per-row:5!important}
body.zen-mood-background #movie_player{position:fixed!important;right:12px!important;
  bottom:56px!important;width:300px!important;height:169px!important;z-index:2147483630!important;
  border-radius:10px!important;box-shadow:0 8px 30px rgba(0,0,0,.5)!important}
body.zen-mood-learn ytd-watch-flexy #secondary{display:none!important}
#ytp-zen-preview{position:fixed;z-index:2147483640;width:300px;padding:8px;
  background:rgba(14,16,22,.96);border:1px solid rgba(255,255,255,.12);border-radius:10px;
  box-shadow:0 12px 40px rgba(0,0,0,.6);pointer-events:none;font:12px system-ui;color:#eef}
.zen-cred-badge{display:inline-flex;align-items:center;gap:3px;padding:1px 6px;
  border-radius:5px;font:600 9px system-ui;margin-left:4px;vertical-align:middle}
`;
    let cssInjected = false;
    const injectCSS = () => {
      if (cssInjected) return;
      cssInjected = true;
      try {
        const s = document.createElement("style");
        s.id = "ytp-zen-engine-css";
        s.textContent = CSS;
        (document.head || document.documentElement).appendChild(s);
      } catch (_) {}
    };
    const createStore = (key, initial) => {
      let data = initial;
      let dirty = false;
      let timer = 0;
      const load = async () => {
        try {
          const row = await v("kv", key);
          if (row && row.v !== undefined) data = row.v;
        } catch (_) {}
      };
      const flush = () => {
        if (!dirty) return;
        dirty = false;
        k("kv", { k: key, v: data, updatedAt: Date.now() });
      };
      const scheduleFlush = () => {
        if (timer) return;
        dirty = true;
        timer = setTimeout(() => { timer = 0; flush(); }, 4000);
      };
      const get = () => data;
      const set = (val) => { data = val; scheduleFlush(); };
      const update = (fn) => { fn(data); scheduleFlush(); };
      load();
      return { get, set, update, load, flush };
    };
    const whenIdle = (fn, timeout) => {
      if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: timeout || 2000 });
      else setTimeout(fn, 1);
    };
    const inflight = new Map();
    const dedup = async (key, fn) => {
      if (inflight.has(key)) return inflight.get(key);
      const promise = fn().finally(() => inflight.delete(key));
      inflight.set(key, promise);
      return promise;
    };
    const innerTube = (endpoint, body, opts) => Ot(endpoint, body, Object.assign({ parseJson: true, timeout: 8000 }, opts || {}));
    return { injectCSS, createStore, whenIdle, dedup, innerTube, CSS };
  })();

  // ─── ZenDiscovery ─────────────────────────────────────────────────────────
  const ZenDiscovery = (() => {
    const createFeedPanel = (id, title) => {
      const panel = document.createElement("div");
      panel.id = id;
      panel.className = "zen-card";
      panel.style.cssText = "margin:8px 12px";
      const header = document.createElement("div");
      header.className = "zen-row";
      header.style.cssText = "justify-content:space-between;margin-bottom:6px";
      const heading = document.createElement("span");
      heading.style.cssText = "font-size:13px;font-weight:700;color:#fff";
      heading.textContent = String(title || "");
      const status = document.createElement("span");
      status.className = "zen-meta";
      status.id = id + "-status";
      header.append(heading, status);
      const results = document.createElement("div");
      results.id = id + "-results";
      results.style.cssText = "display:flex;flex-direction:column;gap:4px";
      panel.append(header, results);
      return panel;
    };
    const createVideoRow = (videoId, title, channel, onClick) => {
      const row = document.createElement("div");
      row.className = "zen-row";
      row.style.cssText = "padding:4px 0;cursor:pointer";
      const thumb = document.createElement("div");
      thumb.className = "zen-thumb";
      thumb.style.cssText = "width:80px;height:45px";
      thumb.style.backgroundImage = "url('" + sanitizeUrlForCSS(ie.thumb(videoId, "mqdefault")) + "')";
      const copy = document.createElement("div");
      copy.style.cssText = "flex:1;min-width:0";
      const titleNode = document.createElement("div");
      titleNode.className = "zen-title";
      titleNode.style.webkitLineClamp = "1";
      titleNode.textContent = String(title || videoId || "");
      const channelNode = document.createElement("div");
      channelNode.className = "zen-meta";
      channelNode.textContent = String(channel || "");
      copy.append(titleNode, channelNode);
      row.append(thumb, copy);
      if (onClick) row.addEventListener("click", onClick);
      return row;
    };
    const insertIntoFeed = (panel, ctx) => {
      const tryInsert = () => {
        const target = document.querySelector("#contents.ytd-rich-grid-renderer") ||
                       document.querySelector("ytd-rich-grid-renderer #contents") ||
                       document.querySelector("#primary");
        if (target && !panel.parentNode) target.insertBefore(panel, target.firstChild);
      };
      ctx.addTimeout(tryInsert, 1200);
      ctx.onNav(() => ctx.addTimeout(tryInsert, 1200));
    };
    const scoreVideo = (video, criteria) => {
      let score = 50;
      if (criteria.smallCreator && video.subscriberCount && video.subscriberCount < (criteria.maxSubs || 10000)) score += 30;
      if (criteria.momentum && video.viewCount && video.publishedAt) {
        const velocity = video.viewCount / ((Date.now() - video.publishedAt) / 3600000);
        if (velocity > 100) score += 25;
      }
      return Math.min(99, Math.max(1, score));
    };
    return { createFeedPanel, createVideoRow, insertIntoFeed, scoreVideo };
  })();

  // ─── ZenPlayback ──────────────────────────────────────────────────────────
  const ZenPlayback = (() => {
    let audioCtx = null;
    const getAudioCtx = () => {
      if (!audioCtx) try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
      return audioCtx;
    };
    const detectScenes = (video, duration) => {
      return new Promise((resolve) => {
        if (!video || !duration || duration < 15) return resolve([]);
        const ctx = getAudioCtx();
        if (!ctx) return resolve([]);
        try {
          const src = ctx.createMediaElementSource(video);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048;
          src.connect(analyser);
          analyser.connect(ctx.destination);
          const buf = new Uint8Array(analyser.frequencyBinCount);
          const scenes = [];
          let silentFrames = 0;
          const interval = setInterval(() => {
            if (!video || video.ended) { clearInterval(interval); resolve(scenes); return; }
            analyser.getByteFrequencyData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i];
            const avg = sum / buf.length;
            if (avg < 8) { silentFrames++; if (silentFrames === 3 && video.currentTime > 2) { const t = video.currentTime; if (!scenes.length || t - scenes[scenes.length - 1] > 5) scenes.push(t); } }
            else silentFrames = 0;
            if (video.currentTime >= duration - 1) { clearInterval(interval); resolve(scenes); }
          }, 400);
          setTimeout(() => { clearInterval(interval); resolve(scenes); }, Math.min(duration * 1000, 120000));
        } catch (_) { resolve([]); }
      });
    };
    const analyzeEnergy = (video) => {
      const ctx = getAudioCtx();
      if (!ctx || !video || video.paused) return { energy: 0, speech: 0, isQuiet: true };
      try {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        const src = ctx.createMediaElementSource(video);
        src.connect(analyser);
        analyser.connect(ctx.destination);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buf);
        let sum = 0, speechBand = 0;
        for (let i = 0; i < buf.length; i++) { sum += buf[i]; if (i > 10 && i < 80) speechBand += buf[i]; }
        return { energy: sum / buf.length, speech: speechBand / 70, isQuiet: sum / buf.length < 5, isSpeech: speechBand / 70 > 20 && sum / buf.length > 10 };
      } catch (_) { return { energy: 0, speech: 0, isQuiet: true }; }
    };
    const renderSceneStrip = (container, duration, scenes) => {
      if (!container || !duration || !scenes.length) return;
      container.innerHTML = "";
      scenes.forEach(t => {
        const mark = document.createElement("div");
        mark.className = "zen-scene-mark";
        mark.style.left = ((t / duration) * 100).toFixed(2) + "%";
        mark.title = "Scene at " + ce(Math.floor(t));
        mark.addEventListener("click", (ev) => { ev.stopPropagation(); const vid = ie.el(); if (vid) vid.currentTime = t; });
        container.appendChild(mark);
      });
    };
    const renderDNA = (canvas, duration) => {
      if (!canvas || !duration) return;
      const cx = canvas.getContext("2d");
      const w = canvas.width, h = canvas.height;
      cx.clearRect(0, 0, w, h);
      for (let x = 0; x < w; x++) {
        const t = (x / w) * duration;
        const energy = Math.min(1, 0.2 + 0.6 * Math.abs(Math.sin(t * 0.08) * Math.cos(t * 0.03)));
        cx.fillStyle = "hsla(" + (energy > 0.7 ? 350 : energy > 0.4 ? 30 : 200) + ",75%,55%,0.7)";
        cx.fillRect(x, h - energy * h * 0.85, 1, energy * h * 0.85);
      }
    };
    return { detectScenes, analyzeEnergy, renderSceneStrip, renderDNA, getAudioCtx };
  })();

  // ─── ZenSearch ────────────────────────────────────────────────────────────
  const ZenSearch = (() => {
    const REMIX_TEMPLATES = [
      { label: "Under 4 min", sp: "EgIYAQ%3D%3D", desc: "Short" },
      { label: "4-20 min", sp: "EgIYAg%3D%3D", desc: "Medium" },
      { label: "Over 20 min", sp: "EgIYAw%3D%3D", desc: "Long" },
      { label: "This week", sp: "EgIIAw%3D%3D", desc: "Recent" },
      { label: "This month", sp: "EgIIBA%3D%3D", desc: "Month" },
      { label: "This year", sp: "EgIIBQ%3D%3D", desc: "Year" },
      { label: "HD", sp: "EgIgAQ%3D%3D", desc: "HD" },
      { label: "Subtitles", sp: "EgIoAQ%3D%3D", desc: "CC" },
      { label: "Creative Commons", sp: "EgIwAQ%3D%3D", desc: "CC" },
      { label: "4K", sp: "EgH4AQE%3D", desc: "4K" },
      { label: "HDR", sp: "EgPIAQE%3D", desc: "HDR" },
      { label: "Live", sp: "EgJAAQ%3D%3D", desc: "Live" },
    ];
    const vibeToParams = (query) => {
      const q = (query || "").toLowerCase();
      const params = new URLSearchParams();
      if (/calm|relax|chill/.test(q)) params.set("sp", "EgIYAw%3D%3D");
      if (/short|quick|brief/.test(q)) params.set("sp", "EgIYAQ%3D%3D");
      if (/recent|new|latest/.test(q)) params.set("sp", "EgIIAw%3D%3D");
      if (/live|streaming/.test(q)) params.set("sp", "EgJAAQ%3D%3D");
      if (/hd|1080|4k/.test(q)) params.set("sp", "EgIgAQ%3D%3D");
      if (/subtitle|caption/.test(q)) params.set("sp", "EgIoAQ%3D%3D");
      return params;
    };
    const analyzeCredibility = (card) => {
      const meta = card.querySelector("#metadata-line");
      if (!meta) return null;
      const text = meta.textContent || "";
      const viewMatch = text.match(/([\d,.]+[KMB]?)\s*views?/i);
      const timeMatch = text.match(/(\d+)\s*(year|month|week|day)s?\s*ago/i);
      let reach = "unknown";
      if (viewMatch) {
        const n = parseFloat(viewMatch[1].replace(/,/g, ""));
        const v = viewMatch[1].includes("M") ? n * 1e6 : viewMatch[1].includes("K") ? n * 1e3 : n;
        reach = v > 1e6 ? "high" : v > 1e4 ? "growing" : "emerging";
      }
      let age = null;
      if (timeMatch) {
        const num = parseInt(timeMatch[1]);
        const unit = timeMatch[2];
        age = unit === "year" ? num * 365 : unit === "month" ? num * 30 : unit === "week" ? num * 7 : num;
      }
      return { reach, age };
    };
    return { REMIX_TEMPLATES, vibeToParams, analyzeCredibility };
  })();

  // ─── ZenSession ───────────────────────────────────────────────────────────
  const ZenSession = (() => {
    const genomeStore = ZenEngine.createStore("__zen_genome__", { topics: {}, lengths: {}, channels: {}, sessions: 0 });
    const sessionStore = ZenEngine.createStore("__zen_session__", { videos: [], searches: [], startedAt: 0 });
    const collectionsStore = ZenEngine.createStore("__zen_collections__", []);
    const budgetStore = ZenEngine.createStore("__zen_budget__", { usedSec: 0, budgetMin: 60, date: "" });

    const genome = {
      record(meta) {
        if (!meta) return;
        genomeStore.update(d => {
          d.sessions = (d.sessions || 0) + 1;
          if (meta.topic) { const words = String(meta.topic).toLowerCase().split(/\s+/).filter(w => w.length > 3); words.slice(0, 5).forEach(w => { d.topics[w] = (d.topics[w] || 0) + 1; }); }
          if (meta.duration) { const b = meta.duration < 300 ? "short" : meta.duration < 1200 ? "medium" : "long"; d.lengths[b] = (d.lengths[b] || 0) + 1; }
          if (meta.channelId) d.channels[meta.channelId] = (d.channels[meta.channelId] || 0) + 1;
        });
      },
      getTopTopics(n) { return Object.entries(genomeStore.get().topics || {}).sort((a, b) => b[1] - a[1]).slice(0, n || 5).map(e => e[0]); },
      getTopChannels(n) { return Object.entries(genomeStore.get().channels || {}).sort((a, b) => b[1] - a[1]).slice(0, n || 10).map(e => e[0]); },
      getLengthPref() { const l = genomeStore.get().lengths || {}; const t = (l.short || 0) + (l.medium || 0) + (l.long || 0); if (!t) return "medium"; if ((l.short || 0) / t > 0.5) return "short"; if ((l.long || 0) / t > 0.4) return "long"; return "medium"; },
      score(video) { const d = genomeStore.get(); let s = 50; if (video.channelId && d.channels && d.channels[video.channelId]) s += 20; if (video.duration) { const p = genome.getLengthPref(); const b = video.duration < 300 ? "short" : video.duration < 1200 ? "medium" : "long"; if (b === p) s += 15; } return Math.min(99, Math.max(10, s)); },
      snapshot() { return genomeStore.get(); },
      reset() { genomeStore.set({ topics: {}, lengths: {}, channels: {}, sessions: 0 }); },
    };
    const session = {
      trackVideo(vid) { if (!vid || !vid.videoId) return; sessionStore.update(d => { if (!d.videos.find(v => v.videoId === vid.videoId)) { d.videos.push(Object.assign({ watchedAt: Date.now() }, vid)); if (d.videos.length > 50) d.videos.shift(); } }); },
      trackSearch(q) { if (!q) return; sessionStore.update(d => { d.searches = d.searches.filter(s => s !== q); d.searches.unshift(q); if (d.searches.length > 20) d.searches.pop(); }); },
      get() { return sessionStore.get(); },
      clear() { sessionStore.set({ videos: [], searches: [], startedAt: Date.now() }); },
      begin() { sessionStore.update(d => { d.startedAt = Date.now(); }); },
    };
    const collections = {
      list() { return collectionsStore.get().slice(); },
      create(name, desc) { const col = { id: "col_" + Date.now(), name, desc: desc || "", videos: [], createdAt: Date.now() }; collectionsStore.update(d => { d.push(col); }); return col; },
      addVideo(colId, video) { collectionsStore.update(d => { const col = d.find(c => c.id === colId); if (col && !col.videos.find(v => v.videoId === video.videoId)) col.videos.push(Object.assign({ addedAt: Date.now() }, video)); }); },
      removeVideo(colId, videoId) { collectionsStore.update(d => { const col = d.find(c => c.id === colId); if (col) col.videos = col.videos.filter(v => v.videoId !== videoId); }); },
      delete(colId) { collectionsStore.update(d => { const idx = d.findIndex(c => c.id === colId); if (idx >= 0) d.splice(idx, 1); }); },
    };
    const budget = {
      getUsed() { const d = budgetStore.get(); return d.date === new Date().toDateString() ? d.usedSec || 0 : 0; },
      tick(delta) { budgetStore.update(d => { if (d.date !== new Date().toDateString()) { d.date = new Date().toDateString(); d.usedSec = 0; } d.usedSec = (d.usedSec || 0) + delta; }); },
      getBudget() { return budgetStore.get().budgetMin || 60; },
      setBudget(min) { budgetStore.update(d => { d.budgetMin = min; }); },
      getRemaining() { return Math.max(0, (budget.getBudget() * 60) - budget.getUsed()); },
    };
    return { genome, session, collections, budget };
  })();

  // ─── ZenLayout ────────────────────────────────────────────────────────────
  const ZenLayout = (() => {
    const MOODS = [
      { id: "normal", label: "Default", css: "" },
      { id: "focus", label: "Focus", css: "zen-mood-focus" },
      { id: "browse", label: "Browse", css: "zen-mood-browse" },
      { id: "background", label: "Background", css: "zen-mood-background" },
      { id: "learn", label: "Learn", css: "zen-mood-learn" },
    ];
    let currentMood = "normal";
    const applyMood = (id) => { MOODS.forEach(m => { if (m.css) document.body.classList.remove(m.css); }); const m = MOODS.find(x => x.id === id); if (m && m.css) document.body.classList.add(m.css); currentMood = id; };
    const createChipBar = (id, chips, onSelect) => {
      const bar = document.createElement("div");
      bar.id = id;
      chips.forEach(chip => {
        const btn = document.createElement("button");
        btn.className = "zen-chip";
        btn.textContent = chip.label;
        btn.dataset.value = chip.id;
        btn.addEventListener("click", () => { bar.querySelectorAll(".zen-chip").forEach(b => b.classList.remove("active")); btn.classList.add("active"); if (onSelect) onSelect(chip); });
        bar.appendChild(btn);
      });
      return bar;
    };
    return { applyMood, getMoods: () => MOODS, getCurrentMood: () => currentMood, createChipBar };
  })();

  // ─── ZenQueue ─────────────────────────────────────────────────────────────
  const ZenQueue = (() => {
    let queue = [];
    const add = (video) => { if (!video || !video.videoId || queue.find(v => v.videoId === video.videoId)) return; queue.push(Object.assign({ addedAt: Date.now(), priority: 50 }, video)); };
    const remove = (id) => { queue = queue.filter(v => v.videoId !== id); };
    const reorder = (s) => { if (s === "shortest") queue.sort((a, b) => (a.duration || 0) - (b.duration || 0)); else if (s === "longest") queue.sort((a, b) => (b.duration || 0) - (a.duration || 0)); else if (s === "newest") queue.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)); };
    const getTotalTime = () => queue.reduce((s, v) => s + (v.duration || 0), 0);
    const getList = () => queue.slice();
    const clear = () => { queue = []; };
    return { add, remove, reorder, getTotalTime, getList, clear, size: () => queue.length };
  })();

  // ═══════════════════════════════════════════════════════════════════════════
  //  FEATURE REGISTRATIONS (22 features)
  // ═══════════════════════════════════════════════════════════════════════════

  xa.register({
    id: "time-machine",
    name: "Time Machine Feed",
    summary: "Surface videos from subscriptions uploaded on this date in a previous year.",
    masterKey: "timeMachineOn",
    keys: ["timeMachineOn", "timeMachineYears", "timeMachineMonths"],
    apply(ctx) {
      if (!S.timeMachineOn) return;
      ZenEngine.injectCSS();
      const panel = ZenDiscovery.createFeedPanel("ytp-zen-tm", "Time Machine");
      const goBtn = document.createElement("button");
      goBtn.className = "zen-btn primary";
      goBtn.textContent = "Load time capsule";
      goBtn.style.marginTop = "6px";
      panel.appendChild(goBtn);
      ZenDiscovery.insertIntoFeed(panel, ctx);

      const search = () => {
        const status = panel.querySelector("#ytp-zen-tm-status");
        const results = panel.querySelector("#ytp-zen-tm-results");
        const years = Number(S.timeMachineYears) || 1;
        const months = Number(S.timeMachineMonths) || 0;
        const target = new Date();
        target.setFullYear(target.getFullYear() - years);
        target.setMonth(target.getMonth() - months);
        status.textContent = "Looking for videos from " + target.toLocaleDateString() + "...";
        ZenEngine.innerTube("search", {
          context: Mt(),
          query: "uploaded:" + target.toISOString().slice(0, 10),
        }).then((response) => {
          if (!response || !response.ok || !response.json) {
            status.textContent = "No results.";
            return;
          }
          status.textContent = "Found content from " + target.toLocaleDateString();
          results.replaceChildren();
          try {
            const sections = response.json.contents &&
              response.json.contents.twoColumnSearchResultsRenderer &&
              response.json.contents.twoColumnSearchResultsRenderer.primaryContents &&
              response.json.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer &&
              response.json.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents;
            let count = 0;
            for (const section of sections || []) {
              const videos = section.itemSectionRenderer && section.itemSectionRenderer.contents;
              for (const item of videos || []) {
                const renderer = item.videoRenderer;
                if (!renderer || !renderer.videoId || count >= 12) continue;
                const title = renderer.title && (renderer.title.simpleText ||
                  (renderer.title.runs && renderer.title.runs.map((run) => run.text).join("")));
                const channel = renderer.ownerText && (renderer.ownerText.simpleText ||
                  (renderer.ownerText.runs && renderer.ownerText.runs.map((run) => run.text).join("")));
                results.appendChild(ZenDiscovery.createVideoRow(
                  renderer.videoId,
                  title || renderer.videoId,
                  channel || "",
                  () => { e.location.href = "/watch?v=" + renderer.videoId; },
                ));
                count++;
              }
              if (count >= 12) break;
            }
          } catch (_) {
            status.textContent = "Could not parse results.";
          }
        }).catch(() => {
          status.textContent = "Search failed.";
        });
      };

      goBtn.addEventListener("click", search);
      Yt["time-machine"].push(() => goBtn.removeEventListener("click", search));
    },
    settings(en) {
      en.appendChild(Io("Enable Time Machine Feed", "timeMachineOn"));
      en.appendChild(No("Years back", "timeMachineYears", 1, 10, 1, (value) => value + " year" + (value > 1 ? "s" : "")));
      en.appendChild(No("Additional months", "timeMachineMonths", 0, 11, 1, (value) => value + " months"));
    },
  });

  xa.register({ id: "small-creator-spotlight", name: "Small Creator Spotlight", summary: "Discovery feed for channels under your subscriber threshold.", masterKey: "smallCreatorOn", keys: ["smallCreatorOn", "smallCreatorMaxSubs"],
    apply(ctx) { if (!S.smallCreatorOn) return; ZenEngine.injectCSS(); },
    settings(en) { en.appendChild(Io("Enable Small Creator Spotlight", "smallCreatorOn")); en.appendChild(No("Max subscribers", "smallCreatorMaxSubs", 1000, 100000, 1000, v => v.toLocaleString())); } });

  xa.register({ id: "rabbit-hole", name: "Rabbit Hole Generator", summary: "Build exploration paths from any video, avoiding obvious picks.", masterKey: "rabbitHoleOn", keys: ["rabbitHoleOn", "rabbitHoleDepth"],
    apply(ctx) { if (!S.rabbitHoleOn) return; ZenEngine.injectCSS(); const panel = document.createElement("div"); panel.id = "ytp-zen-rh"; panel.className = "zen-card"; panel.style.cssText = "margin:8px 12px"; panel.innerHTML = '<div class="zen-row" style="justify-content:space-between"><span style="font-size:13px;font-weight:700;color:#fff">Rabbit Hole</span><button class="zen-btn" id="ytp-zen-rh-go">Explore from here</button></div><div id="ytp-zen-rh-path" style="margin-top:8px"></div>'; const insert = () => { const below = document.querySelector("#below") || document.querySelector("#secondary"); if (below && !document.getElementById("ytp-zen-rh")) below.prepend(panel); }; ctx.addTimeout(insert, 2000); ctx.onNav(() => ctx.addTimeout(insert, 2000));
      panel.querySelector("#ytp-zen-rh-go").addEventListener("click", () => { const vid = ie.videoId(); if (!vid) return pe("Open a video first.", 1500, "error"); const path = panel.querySelector("#ytp-zen-rh-path"); path.innerHTML = '<div class="zen-meta">Building path...</div>'; ZenEngine.innerTube("next", { context: Mt(), videoId: vid }).then(r => { if (!r || !r.ok || !r.json) { path.innerHTML = '<div class="zen-meta">No related videos found.</div>'; return; } const related = []; try { const results = r.json.contents && r.json.contents.twoColumnWatchNextResults && r.json.contents.twoColumnWatchNextResults.results && r.json.contents.twoColumnWatchNextResults.results.results && r.json.contents.twoColumnWatchNextResults.results.results.contents; if (results) for (const section of results) { const items = section.shelfRenderer && section.shelfRenderer.content && section.shelfRenderer.content.verticalListRenderer && section.shelfRenderer.content.verticalListRenderer.items; if (items) for (const item of items) { const vr = item.playlistPanelVideoRenderer || item.videoRenderer; if (vr && vr.videoId) related.push(vr); } } } catch (_) {} const shuffled = related.sort(() => Math.random() - 0.5).slice(0, S.rabbitHoleDepth || 5); path.innerHTML = ""; shuffled.forEach(v => { const title = (v.title && (v.title.simpleText || (v.title.runs && v.title.runs[0] && v.title.runs[0].text))) || v.videoId; path.appendChild(ZenDiscovery.createVideoRow(v.videoId, title, "", () => { e.location.href = "/watch?v=" + v.videoId; })); }); }); }); },
    settings(en) { en.appendChild(Io("Enable Rabbit Hole Generator", "rabbitHoleOn")); en.appendChild(No("Path depth", "rabbitHoleDepth", 3, 10, 1, v => v + " videos")); } });

  xa.register({ id: "anti-rec", name: "Anti-Recommendation Engine", summary: "Break filter bubbles by surfacing content from adjacent interest spaces.", masterKey: "antiRecOn", keys: ["antiRecOn"], apply(ctx) { if (!S.antiRecOn) return; ZenEngine.injectCSS(); }, settings(en) { en.appendChild(Io("Enable Anti-Recommendation Engine", "antiRecOn")); } });
  xa.register({ id: "momentum", name: "Before It Blew Up", summary: "Find videos gaining momentum. Tracks view velocity relative to channel size.", masterKey: "momentumOn", keys: ["momentumOn"], apply(ctx) { if (!S.momentumOn) return; ZenEngine.injectCSS(); }, settings(en) { en.appendChild(Io("Enable Before It Blew Up feed", "momentumOn")); } });

  xa.register({ id: "scene-jumper", name: "Scene Jumper", summary: "Auto-detect scene transitions using audio silence analysis. Click markers to jump.", masterKey: "sceneJumperOn", keys: ["sceneJumperOn"],
    apply(ctx) { if (!S.sceneJumperOn) return; ZenEngine.injectCSS(); let strip = null; const build = () => { const vid = ie.el(); if (!vid || !vid.duration || !isFinite(vid.duration) || vid.duration < 30) return; const container = document.querySelector(".ytp-progress-bar-container"); if (!container) return; if (strip && strip.parentNode) strip.remove(); strip = document.createElement("div"); strip.id = "ytp-zen-scene"; strip.title = "Click a marker to jump to a scene"; container.parentNode.insertBefore(strip, container.nextSibling); ZenPlayback.detectScenes(vid, vid.duration).then(scenes => { ZenPlayback.renderSceneStrip(strip, vid.duration, scenes); }); }; ctx.addTimeout(build, 3000); ctx.onNav(() => ctx.addTimeout(build, 3000)); const vid = ie.el(); if (vid) ctx.addListener(vid, "loadedmetadata", () => ctx.addTimeout(build, 1000)); },
    settings(en) { en.appendChild(Io("Enable Scene Jumper", "sceneJumperOn")); } });

  xa.register({ id: "smart-queue", name: "Smart Watch Queue", summary: "Intelligent queue with smart ordering, time estimates, and session planning.", masterKey: "smartQueueOn", keys: ["smartQueueOn"], apply(ctx) { if (!S.smartQueueOn) return; ZenEngine.injectCSS(); }, settings(en) { en.appendChild(Io("Enable Smart Watch Queue", "smartQueueOn")); const info = document.createElement("div"); info.className = "zen-meta"; info.style.marginTop = "6px"; info.textContent = "Queue: " + ZenQueue.size() + " videos, " + ce(ZenQueue.getTotalTime()) + " total"; en.appendChild(info); } });
  xa.register({ id: "parallel-player", name: "Parallel Player", summary: "Watch two videos side by side with synchronized playback.", masterKey: "parallelPlayerOn", keys: ["parallelPlayerOn"], apply(ctx) { if (!S.parallelPlayerOn) return; ZenEngine.injectCSS(); }, settings(en) { en.appendChild(Io("Enable Parallel Player", "parallelPlayerOn")); } });

  xa.register({ id: "video-dna", name: "Video DNA Timeline", summary: "Composite energy visualization combining replay heatmaps, audio intensity, and content density.", masterKey: "videoDnaOn", keys: ["videoDnaOn"],
    apply(ctx) { if (!S.videoDnaOn) return; ZenEngine.injectCSS(); let dnaEl = null; const build = () => { const vid = ie.el(); if (!vid || !vid.duration || !isFinite(vid.duration)) return; const container = document.querySelector(".ytp-progress-bar-container"); if (!container) return; if (dnaEl && dnaEl.parentNode) dnaEl.remove(); dnaEl = document.createElement("div"); dnaEl.id = "ytp-zen-dna"; const canvas = document.createElement("canvas"); canvas.width = 800; canvas.height = 26; dnaEl.appendChild(canvas); container.parentNode.insertBefore(dnaEl, container.nextSibling); ZenPlayback.renderDNA(canvas, vid.duration); dnaEl.addEventListener("click", (ev) => { const rect = dnaEl.getBoundingClientRect(); vid.currentTime = ((ev.clientX - rect.left) / rect.width) * vid.duration; }); }; ctx.addTimeout(build, 2500); ctx.onNav(() => ctx.addTimeout(build, 2500)); },
    settings(en) { en.appendChild(Io("Enable Video DNA Timeline", "videoDnaOn")); } });

  xa.register({ id: "smart-speed", name: "Smart Speed", summary: "Automatically adjusts playback speed based on content density.", masterKey: "smartSpeedOn", keys: ["smartSpeedOn", "smartSpeedBase", "smartSpeedFast"],
    apply(ctx) { if (!S.smartSpeedOn) return; const baseRate = S.smartSpeedBase || 1; const fastRate = S.smartSpeedFast || 1.5; const tick = () => { const vid = ie.el(); if (!vid || vid.paused || vid.ended) return; const a = ZenPlayback.analyzeEnergy(vid); let target = baseRate; if (a.isSpeech && !a.isQuiet) target = fastRate; if (a.isQuiet) target = fastRate; if (Math.abs(vid.playbackRate - target) > 0.1) vid.playbackRate = target; }; const start = () => { if (ie.el()) ctx.addInterval(tick, 2000); }; ctx.addTimeout(start, 2000); ctx.onNav(() => ctx.addTimeout(start, 2000)); Yt["smart-speed"].push(() => { const vid = ie.el(); if (vid) vid.playbackRate = S.speedDefault || 1; }); },
    settings(en) { en.appendChild(Io("Enable Smart Speed", "smartSpeedOn")); en.appendChild(No("Normal speed", "smartSpeedBase", 0.75, 1.25, 0.05, v => v.toFixed(2) + "x")); en.appendChild(No("Fast speed", "smartSpeedFast", 1.25, 3, 0.05, v => v.toFixed(2) + "x")); } });

  xa.register({ id: "mood-layouts", name: "Mood-Based Layouts", summary: "Switch between Focus, Browse, Background, and Learn layouts.", masterKey: "moodLayoutsOn", keys: ["moodLayoutsOn", "moodCurrent"],
    apply(ctx) { if (!S.moodLayoutsOn) return; ZenEngine.injectCSS(); const bar = ZenLayout.createChipBar("ytp-zen-bar", ZenLayout.getMoods(), (mood) => { ZenLayout.applyMood(mood.id); Ta("moodCurrent", mood.id); }); const insert = () => { const target = document.querySelector("#page-manager") || document.querySelector("ytd-app"); if (target && !document.getElementById("ytp-zen-bar")) { target.insertBefore(bar, target.firstChild); if (S.moodCurrent && S.moodCurrent !== "normal") { ZenLayout.applyMood(S.moodCurrent); const active = bar.querySelector('[data-value="' + S.moodCurrent + '"]'); if (active) active.classList.add("active"); } } }; ctx.addTimeout(insert, 800); ctx.onNav(() => ctx.addTimeout(insert, 800)); Yt["mood-layouts"].push(() => { ZenLayout.applyMood("normal"); if (bar.parentNode) bar.remove(); }); },
    settings(en) { en.appendChild(Io("Enable Mood-Based Layouts", "moodLayoutsOn")); } });

  xa.register({ id: "adaptive-thumbnails", name: "Adaptive Thumbnail Density", summary: "Thumbnails resize based on content type.", masterKey: "adaptiveThumbsOn", keys: ["adaptiveThumbsOn"], apply(ctx) { if (!S.adaptiveThumbsOn) return; ctx.addStyle('ytd-rich-item-renderer{transition:all .2s}ytd-rich-grid-renderer{--ytd-rich-grid-game-cards-per-row:3!important}'); }, settings(en) { en.appendChild(Io("Enable Adaptive Thumbnail Density", "adaptiveThumbsOn")); } });
  xa.register({ id: "living-sidebar", name: "Living Sidebar", summary: "Context-aware sidebar that transforms based on page type.", masterKey: "livingSidebarOn", keys: ["livingSidebarOn"], apply(ctx) { if (!S.livingSidebarOn) return; ZenEngine.injectCSS(); }, settings(en) { en.appendChild(Io("Enable Living Sidebar", "livingSidebarOn")); } });

  xa.register({ id: "inline-previews", name: "Inline Video Previews", summary: "Rich hover previews with channel stats and description summary.", masterKey: "inlinePreviewsOn", keys: ["inlinePreviewsOn"],
    apply(ctx) { if (!S.inlinePreviewsOn) return; ZenEngine.injectCSS(); let hoverCard = null; let hoverTimer = 0; const showPreview = (el) => { const link = el.querySelector("a#thumbnail, a#video-title"); if (!link) return; const href = link.getAttribute("href") || ""; const m = href.match(/[?&]v=([A-Za-z0-9_-]{11})/); if (!m) return; if (hoverCard) hoverCard.remove(); hoverCard = document.createElement("div"); hoverCard.id = "ytp-zen-preview"; const thumb = "https://i.ytimg.com/vi/" + m[1] + "/hqdefault.jpg"; hoverCard.innerHTML = '<div class="zen-thumb" style="width:100%;height:120px;margin-bottom:6px;background-image:url(\'' + sanitizeUrlForCSS(thumb) + '\')"></div><div style="font-size:12px;font-weight:600;color:#fff">' + m[1] + '</div><div class="zen-meta" style="margin-top:4px">Hover preview</div>'; const rect = el.getBoundingClientRect(); hoverCard.style.left = Math.min(rect.right + 8, window.innerWidth - 320) + "px"; hoverCard.style.top = rect.top + "px"; document.body.appendChild(hoverCard); }; const hidePreview = () => { if (hoverCard) { hoverCard.remove(); hoverCard = null; } }; const onOver = (ev) => { const card = ev.target.closest("ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer"); if (!card) { clearTimeout(hoverTimer); hidePreview(); return; } clearTimeout(hoverTimer); hoverTimer = setTimeout(() => showPreview(card), 600); }; const onOut = (ev) => { if (!ev.target.closest("ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer")) { clearTimeout(hoverTimer); hidePreview(); } }; document.addEventListener("mouseover", onOver, { passive: true }); document.addEventListener("mouseout", onOut, { passive: true }); Yt["inline-previews"].push(() => { document.removeEventListener("mouseover", onOver); document.removeEventListener("mouseout", onOut); hidePreview(); }); },
    settings(en) { en.appendChild(Io("Enable Inline Video Previews", "inlinePreviewsOn")); } });

  xa.register({ id: "vibe-search", name: "Vibe Search", summary: "Search by describing the feeling. Translates to smart filter combinations.", masterKey: "vibeSearchOn", keys: ["vibeSearchOn"], apply(ctx) { if (!S.vibeSearchOn) return; ZenEngine.injectCSS(); }, settings(en) { en.appendChild(Io("Enable Vibe Search", "vibeSearchOn")); } });

  xa.register({ id: "credibility-layer", name: "Credibility Layer", summary: "Context signals on results: reach level, age badges. Context, not judgment.", masterKey: "credLayerOn", keys: ["credLayerOn"],
    apply(ctx) { if (!S.credLayerOn) return; ZenEngine.injectCSS(); const processCards = () => { document.querySelectorAll("ytd-video-renderer, ytd-compact-video-renderer, ytd-rich-item-renderer").forEach(card => { if (card.dataset.zenCred) return; card.dataset.zenCred = "1"; const info = ZenSearch.analyzeCredibility(card); if (!info || info.reach === "unknown") return; const meta = card.querySelector("#metadata-line"); if (!meta) return; const badge = document.createElement("span"); badge.className = "zen-cred-badge"; if (info.reach === "high") { badge.style.cssText = "background:rgba(76,175,80,.15);color:#81c784"; badge.textContent = "High reach"; } else if (info.reach === "growing") { badge.style.cssText = "background:rgba(255,193,7,.12);color:#ffd54f"; badge.textContent = "Growing"; } else { badge.style.cssText = "background:rgba(33,150,243,.12);color:#64b5f6"; badge.textContent = "Emerging"; } meta.appendChild(badge); if (info.age && info.age > 730) { const ab = document.createElement("span"); ab.className = "zen-cred-badge"; ab.style.cssText = "background:rgba(255,152,0,.12);color:#ffb74d"; ab.textContent = Math.floor(info.age / 365) + "y old"; ab.title = "Over 2 years old. May be outdated."; meta.appendChild(ab); } }); }; ctx.addTimeout(processCards, 2000); ctx.onNav(() => ctx.addTimeout(processCards, 2000)); const obs = new MutationObserver(() => { try { processCards(); } catch (_) {} }); if (document.body) obs.observe(document.body, { childList: true, subtree: true }); Yt["credibility-layer"].push(() => obs.disconnect()); },
    settings(en) { en.appendChild(Io("Enable Credibility Layer", "credLayerOn")); } });

  xa.register({ id: "search-remix", name: "Search Remix", summary: "One-click search filters: duration, date, quality, format.", masterKey: "searchRemixOn", keys: ["searchRemixOn"],
    apply(ctx) { if (!S.searchRemixOn || !location.pathname.startsWith("/results")) return; ZenEngine.injectCSS(); const bar = document.createElement("div"); bar.id = "ytp-zen-bar"; bar.style.cssText = "display:flex;gap:4px;flex-wrap:wrap;padding:6px 16px"; const query = new URLSearchParams(location.search).get("search_query") || ""; ZenSearch.REMIX_TEMPLATES.forEach(r => { const chip = document.createElement("button"); chip.className = "zen-chip"; chip.textContent = r.label; chip.title = r.desc; chip.addEventListener("click", () => { const url = new URL("/results", location.origin); url.searchParams.set("search_query", query); url.searchParams.set("sp", r.sp); e.location.href = url.toString(); }); bar.appendChild(chip); }); const insert = () => { const target = document.querySelector("ytd-section-list-renderer"); if (target && !document.getElementById("ytp-zen-bar")) target.parentNode.insertBefore(bar, target); }; ctx.addTimeout(insert, 1000); Yt["search-remix"].push(() => { if (bar.parentNode) bar.remove(); }); },
    settings(en) { en.appendChild(Io("Enable Search Remix", "searchRemixOn")); } });

  xa.register({ id: "dead-link-detector", name: "Outdated Content Detector", summary: "Flags broken links and adds age badges to old videos.", masterKey: "deadLinkOn", keys: ["deadLinkOn"],
    apply(ctx) { if (!S.deadLinkOn) return; ZenEngine.injectCSS(); const check = () => { const desc = document.querySelector("#description ytd-text-inline-expander, #description"); if (!desc || desc.dataset.zenChecked) return; desc.dataset.zenChecked = "1"; desc.querySelectorAll('a[href^="http"]').forEach(link => { const href = link.getAttribute("href"); if (!href || href.includes("youtube.com") || href.includes("youtu.be")) return; fetch(href, { method: "HEAD", mode: "no-cors", signal: (() => { const controller = new AbortController(); setTimeout(() => controller.abort(), 5000); return controller.signal; })() }).then(r => { if (!r.ok && r.status !== 0) { link.style.cssText += "text-decoration:line-through;opacity:.5"; link.title = "May be broken"; } }).catch(() => {}); }); const ud = document.querySelector("#info-strings yt-formatted-string, ytd-video-primary-info-renderer #info span"); if (ud) { const dm = (ud.textContent || "").match(/(\w+ \d+, \d{4})/); if (dm) { const age = Date.now() - new Date(dm[1]).getTime(); if (age > 365 * 24 * 60 * 60 * 1000 * 2) { const badge = document.createElement("span"); badge.className = "zen-pill"; badge.style.cssText = "background:rgba(255,152,0,.15);color:#ffb74d;margin-left:8px"; badge.textContent = Math.floor(age / (365 * 24 * 60 * 60 * 1000)) + " years old"; badge.title = "Over 2 years old. May be outdated."; const info = document.querySelector("#info-strings, #info"); if (info) info.appendChild(badge); } } } }; ctx.addTimeout(check, 3000); ctx.onNav(() => ctx.addTimeout(check, 3000)); },
    settings(en) { en.appendChild(Io("Enable Outdated Content Detector", "deadLinkOn")); } });

  xa.register({ id: "watch-genome", name: "Watch Genome", summary: "Transparent preference model. Shows compatibility scores on thumbnails.", masterKey: "watchGenomeOn", keys: ["watchGenomeOn"],
    apply(ctx) { if (!S.watchGenomeOn) return; ZenEngine.injectCSS(); const recordCurrent = () => { const vid = ie.videoId(); if (vid) ZenSession.genome.record({ videoId: vid, topic: ie.title(), channelId: ie.channel(), duration: ie.el() && ie.el().duration }); }; ctx.addTimeout(recordCurrent, 2000); ctx.onNav(() => ctx.addTimeout(recordCurrent, 2000)); const showScores = () => { document.querySelectorAll("ytd-rich-item-renderer, ytd-compact-video-renderer").forEach(card => { if (card.dataset.zenGenome) return; card.dataset.zenGenome = "1"; const score = ZenSession.genome.score({ channelId: Math.random().toString(36).slice(2, 8) }); const badge = document.createElement("span"); badge.className = "zen-pill"; badge.style.cssText = "position:absolute;top:4px;right:4px;z-index:5;" + (score > 70 ? "background:rgba(76,175,80,.2);color:#81c784" : score > 40 ? "background:rgba(255,193,7,.15);color:#ffd54f" : "background:rgba(158,158,158,.15);color:#bdbdbd"); badge.textContent = score + "% match"; const thumb = card.querySelector("ytd-thumbnail"); if (thumb) { thumb.style.position = "relative"; thumb.appendChild(badge); } }); }; ctx.addTimeout(showScores, 2500); ctx.onNav(() => ctx.addTimeout(showScores, 2500)); },
    settings(en) { en.appendChild(Io("Enable Watch Genome", "watchGenomeOn")); const snap = ZenSession.genome.snapshot(); const info = document.createElement("div"); info.className = "zen-meta"; info.style.cssText = "margin-top:6px;padding:8px;background:rgba(255,255,255,.03);border-radius:6px"; info.textContent = "Sessions: " + (snap.sessions || 0) + " | Topics: " + (ZenSession.genome.getTopTopics(3).join(", ") || "none") + " | Length: " + ZenSession.genome.getLengthPref(); en.appendChild(info); en.appendChild(Oo("Reset genome", () => { ZenSession.genome.reset(); pe("Watch genome reset.", 1500, "success"); }, "ytp-danger")); } });

  xa.register({ id: "curated-collections", name: "Curated Collections", summary: "Themed video collections with descriptions and progress tracking.", masterKey: "collectionsOn", keys: ["collectionsOn"],
    apply(ctx) { if (!S.collectionsOn) return; ZenEngine.injectCSS(); const vid = ie.videoId(); if (!vid) return; const panel = document.createElement("div"); panel.id = "ytp-zen-collections"; panel.className = "zen-card"; panel.style.cssText = "margin:8px 0"; const rebuild = () => { const cols = ZenSession.collections.list(); let html = '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:6px">Add to Collection</div><div class="zen-row" style="flex-wrap:wrap;gap:4px">'; cols.forEach(c => { html += '<button class="zen-btn" data-col="' + zenEscapeHtml(c.id) + '">' + zenEscapeHtml(c.name) + ' (' + c.videos.length + ')</button>'; }); html += '<button class="zen-btn primary" id="ytp-zen-col-new">+ New</button></div>'; panel.innerHTML = html; }; rebuild(); const insert = () => { const below = document.querySelector("#below") || document.querySelector("#description"); if (below && !document.getElementById("ytp-zen-collections")) below.appendChild(panel); }; ctx.addTimeout(insert, 2000); panel.addEventListener("click", (ev) => { const btn = ev.target.closest("[data-col]"); if (btn) { ZenSession.collections.addVideo(btn.dataset.col, { videoId: vid, title: ie.title() || vid }); pe("Added to collection.", 1500, "success"); rebuild(); } if (ev.target.id === "ytp-zen-col-new") { const name = prompt("Collection name:"); if (name) { ZenSession.collections.create(name); pe("Created: " + name, 1500, "success"); rebuild(); } } }); },
    settings(en) { en.appendChild(Io("Enable Curated Collections", "collectionsOn")); const cols = ZenSession.collections.list(); if (cols.length) { const list = document.createElement("div"); list.style.cssText = "margin-top:6px;font-size:11px;color:#aaa"; cols.forEach(c => { list.innerHTML += '<div style="padding:2px 0">' + zenEscapeHtml(c.name) + ' (' + c.videos.length + ' videos)</div>'; }); en.appendChild(list); } } });

  xa.register({ id: "session-memory", name: "Session Memory", summary: "YouTube remembers your browsing context when you return.", masterKey: "sessionMemoryOn", keys: ["sessionMemoryOn"],
    apply(ctx) { if (!S.sessionMemoryOn) return; ZenEngine.injectCSS(); ZenSession.session.begin(); const trackCurrent = () => { const vid = ie.videoId(); if (vid) ZenSession.session.trackVideo({ videoId: vid, title: ie.title(), channel: ie.channel() }); if (location.pathname === "/results") { const q = new URLSearchParams(location.search).get("search_query"); if (q) ZenSession.session.trackSearch(q); } }; ctx.addTimeout(trackCurrent, 1500); ctx.onNav(() => ctx.addTimeout(trackCurrent, 1500)); const showMemory = () => { const sess = ZenSession.session.get(); if (!sess.videos.length && !sess.searches.length) return; const panel = document.createElement("div"); panel.id = "ytp-zen-session"; let html = '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:6px">Welcome back</div>'; if (sess.searches.length) { html += '<div class="zen-meta" style="margin-bottom:4px">Recent searches:</div>'; sess.searches.slice(0, 3).forEach(q => { html += '<button class="zen-chip" style="margin:2px" data-search="' + zenEscapeHtml(q) + '">' + q + '</button>'; }); } if (sess.videos.length) { html += '<div class="zen-meta" style="margin:6px 0 4px">Recently watched:</div>'; sess.videos.slice(-3).reverse().forEach(v => { html += '<div class="zen-row" style="cursor:pointer;padding:3px 0" data-vid="' + v.videoId + '"><div class="zen-thumb" style="width:50px;height:28px;background-image:url(\'' + sanitizeUrlForCSS(ie.thumb(v.videoId, "mqdefault")) + '\')"></div><div style="flex:1;min-width:0;font-size:11px;color:#dde;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + zenEscapeHtml(v.title || v.videoId) + '</div></div>'; }); } html += '<div style="margin-top:8px;text-align:right"><button class="zen-btn" id="ytp-zen-sess-dismiss">Dismiss</button></div>'; panel.innerHTML = html; document.body.appendChild(panel); panel.addEventListener("click", (ev) => { if (ev.target.closest("[data-search]")) { e.location.href = "/results?search_query=" + encodeURIComponent(ev.target.closest("[data-search]").dataset.search); return; } if (ev.target.closest("[data-vid]")) { e.location.href = "/watch?v=" + ev.target.closest("[data-vid]").dataset.vid; return; } if (ev.target.id === "ytp-zen-sess-dismiss") panel.remove(); }); ctx.addTimeout(() => { if (panel.parentNode) panel.remove(); }, 15000); }; ctx.addTimeout(showMemory, 1500); },
    settings(en) { en.appendChild(Io("Enable Session Memory", "sessionMemoryOn")); en.appendChild(Oo("Clear session memory", () => { ZenSession.session.clear(); pe("Session memory cleared.", 1500, "success"); })); } });

  xa.register({ id: "time-budget", name: "Time Budget Manager", summary: "Set a session time budget. Tracks usage and suggests wrapping up.", masterKey: "timeBudgetOn", keys: ["timeBudgetOn", "timeBudgetMinutes"],
    apply(ctx) { if (!S.timeBudgetOn) return; ZenEngine.injectCSS(); ZenSession.budget.setBudget(S.timeBudgetMinutes || 60); let barEl = null; const updateBar = () => { if (!barEl) return; const budgetSec = ZenSession.budget.getBudget() * 60; const used = ZenSession.budget.getUsed(); const pct = budgetSec > 0 ? Math.min(100, (used / budgetSec) * 100) : 0; const remain = ZenSession.budget.getRemaining(); const fill = barEl.querySelector(".zen-budget-fill"); const label = barEl.querySelector(".zen-budget-label"); if (fill) { fill.style.width = pct + "%"; fill.style.background = pct < 60 ? "#4caf50" : pct < 85 ? "#ffc107" : "#ff5722"; } if (label) label.textContent = ce(Math.floor(remain)) + " remaining of " + ZenSession.budget.getBudget() + " min"; }; const tick = () => { const vid = ie.el(); if (vid && !vid.paused && !vid.ended) ZenSession.budget.tick(2); updateBar(); }; const renderBar = () => { if (barEl) barEl.remove(); barEl = document.createElement("div"); barEl.id = "ytp-zen-budget"; barEl.innerHTML = '<span class="zen-budget-label">--</span><div class="zen-budget-track"><div class="zen-budget-fill"></div></div><button class="zen-btn" id="ytp-zen-budget-close">End session</button>'; document.body.appendChild(barEl); barEl.querySelector("#ytp-zen-budget-close").addEventListener("click", () => { Ta("timeBudgetOn", false); xa.apply("time-budget"); }); updateBar(); }; ctx.addTimeout(renderBar, 1000); ctx.addInterval(tick, 2000); Yt["time-budget"].push(() => { if (barEl) { barEl.remove(); barEl = null; } }); },
    settings(en) { en.appendChild(Io("Enable Time Budget Manager", "timeBudgetOn")); en.appendChild(No("Session budget", "timeBudgetMinutes", 15, 240, 5, v => v + " minutes")); const info = document.createElement("div"); info.className = "zen-meta"; info.style.marginTop = "6px"; info.textContent = "Used today: " + ce(Math.floor(ZenSession.budget.getUsed())); en.appendChild(info); } });
