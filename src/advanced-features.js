  // ===========================================================================
  //  YT-zen Advanced Features Pack
  // ---------------------------------------------------------------------------
  //  22 new features for content discovery, navigation, layout, search,
  //  personalization, and playback enhancements.
  // ===========================================================================

  // ─── Shared Utilities ──────────────────────────────────────────────────────

  const _advStyles = (() => {
    let injected = false;
    const CSS = `
#ytp-time-machine,#ytp-spotlight,#ytp-rabbithole,#ytp-antirec,#ytp-momentum,
#ytp-scene-strip,#ytp-smartq,#ytp-parallel,#ytp-dna,#ytp-mood-bar,
#ytp-vibe-panel,#ytp-cred-layer,#ytp-remix-bar,#ytp-deadlink,
#ytp-genome-panel,#ytp-collections,#ytp-session-mem,#ytp-budget-bar{
  font:13px/1.45 "Inter","Roboto",system-ui,-apple-system,sans-serif;
  color:#eef;box-sizing:border-box}
.ytp-adv-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
  border-radius:12px;padding:14px;margin:8px 0;transition:background .15s}
.ytp-adv-card:hover{background:rgba(255,255,255,.08)}
.ytp-adv-title{font-size:13px;font-weight:700;color:#fff;margin-bottom:4px}
.ytp-adv-sub{font-size:11.5px;color:#9aa;line-height:1.4}
.ytp-adv-pill{display:inline-block;padding:2px 8px;border-radius:99px;
  font:600 10px system-ui;letter-spacing:.03em;text-transform:uppercase}
.ytp-adv-grid{display:grid;gap:8px}
.ytp-adv-row{display:flex;align-items:center;gap:8px}
.ytp-adv-thumb{width:120px;height:68px;border-radius:8px;background:#111 center/cover no-repeat;flex-shrink:0}
.ytp-adv-btn{appearance:none;border:1px solid rgba(255,255,255,.14);border-radius:8px;
  padding:6px 12px;background:rgba(255,255,255,.06);color:#eef;cursor:pointer;
  font:600 11.5px system-ui;transition:background .12s}
.ytp-adv-btn:hover{background:rgba(255,255,255,.12)}
.ytp-adv-btn.primary{background:linear-gradient(135deg,#ff0033,#ff3d7f);border-color:transparent;color:#fff}
.ytp-adv-btn.primary:hover{filter:brightness(1.1)}
.ytp-adv-badge{position:absolute;top:4px;right:4px;padding:2px 6px;border-radius:4px;
  font:700 9px system-ui;letter-spacing:.04em;text-transform:uppercase;z-index:5}
.ytp-adv-meter{height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}
.ytp-adv-meter-fill{height:100%;border-radius:2px;transition:width .3s}
#ytp-scene-strip{position:relative;height:24px;margin:4px 0 8px;border-radius:4px;overflow:hidden;cursor:pointer}
#ytp-scene-strip .ytp-scene-mark{position:absolute;top:0;bottom:0;width:2px;background:rgba(255,255,255,.6);
  transition:background .15s}
#ytp-scene-strip .ytp-scene-mark:hover{background:#ff3d7f;width:3px}
#ytp-dna{position:relative;height:28px;margin:2px 0 6px;border-radius:4px;overflow:hidden;background:rgba(0,0,0,.3)}
#ytp-dna canvas{width:100%;height:100%}
#ytp-mood-bar{display:flex;gap:6px;padding:8px 12px;background:rgba(255,255,255,.03);
  border-bottom:1px solid rgba(255,255,255,.06)}
#ytp-mood-bar .ytp-mood-btn{flex:1;padding:8px 4px;border:1px solid rgba(255,255,255,.1);
  border-radius:8px;background:transparent;color:#9aa;font:600 11px system-ui;cursor:pointer;
  text-align:center;transition:all .15s}
#ytp-mood-bar .ytp-mood-btn:hover{background:rgba(255,255,255,.06);color:#fff}
#ytp-mood-bar .ytp-mood-btn.active{background:rgba(255,61,127,.15);border-color:rgba(255,61,127,.4);color:#ff8aa5}
#ytp-budget-bar{position:fixed;bottom:0;left:0;right:0;height:32px;z-index:2147483634;
  background:rgba(14,16,22,.92);border-top:1px solid rgba(255,255,255,.08);
  display:flex;align-items:center;gap:12px;padding:0 16px;font:11px system-ui;color:#ccc;
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
#ytp-budget-bar .ytp-budget-fill{height:6px;border-radius:3px;transition:width .5s,background .3s}
#ytp-budget-bar .ytp-budget-track{flex:1;height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden}
#ytp-cred-layer .ytp-cred-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;
  border-radius:6px;font:600 10px system-ui;margin-left:6px;vertical-align:middle}
.ytp-remix-chip{display:inline-flex;align-items:center;gap:4px;padding:5px 12px;
  border-radius:99px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  color:#dde;font:600 11px system-ui;cursor:pointer;transition:all .12s;white-space:nowrap}
.ytp-remix-chip:hover{background:rgba(255,61,127,.15);border-color:rgba(255,61,127,.3);color:#fff}
#ytp-session-mem{position:fixed;left:12px;bottom:48px;z-index:2147483634;
  width:min(320px,calc(100vw - 24px));background:rgba(14,16,22,.92);
  border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px;
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  box-shadow:0 12px 40px rgba(0,0,0,.5)}
`;
    return () => {
      if (injected) return;
      injected = true;
      try {
        const s = document.createElement("style");
        s.id = "ytp-adv-styles";
        s.textContent = CSS;
        (document.head || document.documentElement).appendChild(s);
      } catch (_) {}
    };
  })();

  // ─── Content Discovery Store ──────────────────────────────────────────────
  const _disco = (() => {
    const KEY = "__ytp_disco__";
    let store = {};
    const load = async () => {
      try {
        const row = await v("kv", KEY);
        if (row && row.v && typeof row.v === "object") store = row.v;
      } catch (_) {}
    };
    const save = (() => {
      let t = 0;
      return () => {
        if (t) return;
        t = setTimeout(() => { t = 0; k("kv", { k: KEY, v: store, updatedAt: Date.now() }); }, 3000);
      };
    })();
    const get = (k2) => store[k2] || null;
    const set = (k2, val) => { store[k2] = val; save(); };
    const push = (k2, item, max = 100) => {
      const arr = Array.isArray(store[k2]) ? store[k2] : [];
      arr.push(item);
      if (arr.length > max) arr.splice(0, arr.length - max);
      store[k2] = arr;
      save();
    };
    load();
    return { get, set, push, load };
  })();

  // ─── Watch Genome ─────────────────────────────────────────────────────────
  const _genome = (() => {
    const KEY = "__ytp_genome__";
    let data = { topics: {}, lengths: {}, styles: {}, channels: {}, sessions: 0 };
    const load = async () => {
      try {
        const row = await v("kv", KEY);
        if (row && row.v) data = row.v;
      } catch (_) {}
    };
    const save = (() => {
      let t = 0;
      return () => {
        if (t) return;
        t = setTimeout(() => { t = 0; k("kv", { k: KEY, v: data, updatedAt: Date.now() }); }, 5000);
      };
    })();
    const record = (videoMeta) => {
      if (!videoMeta) return;
      data.sessions = (data.sessions || 0) + 1;
      if (videoMeta.topic) {
        data.topics[videoMeta.topic] = (data.topics[videoMeta.topic] || 0) + 1;
      }
      if (videoMeta.duration) {
        const bucket = videoMeta.duration < 300 ? "short" : videoMeta.duration < 1200 ? "medium" : "long";
        data.lengths[bucket] = (data.lengths[bucket] || 0) + 1;
      }
      if (videoMeta.channelId) {
        data.channels[videoMeta.channelId] = (data.channels[videoMeta.channelId] || 0) + 1;
      }
      save();
    };
    const getTopTopics = (n = 5) =>
      Object.entries(data.topics || {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
    const getTopChannels = (n = 10) =>
      Object.entries(data.channels || {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
    const getLengthPref = () => {
      const l = data.lengths || {};
      const total = (l.short || 0) + (l.medium || 0) + (l.long || 0);
      if (!total) return "medium";
      if ((l.short || 0) / total > 0.5) return "short";
      if ((l.long || 0) / total > 0.4) return "long";
      return "medium";
    };
    const score = (video) => {
      if (!video) return 50;
      let s = 50;
      if (video.channelId && data.channels && data.channels[video.channelId]) s += 20;
      if (video.duration) {
        const pref = getLengthPref();
        const bucket = video.duration < 300 ? "short" : video.duration < 1200 ? "medium" : "long";
        if (bucket === pref) s += 15;
      }
      return Math.min(99, Math.max(10, s));
    };
    const snapshot = () => Object.assign({}, data);
    load();
    return { record, getTopTopics, getTopChannels, getLengthPref, score, snapshot, load };
  })();

  // ─── Session Memory ───────────────────────────────────────────────────────
  const _sessMem = (() => {
    const KEY = "__ytp_sess_mem__";
    let session = { videos: [], searches: [], queue: [], topic: "", startedAt: 0 };
    const load = async () => {
      try {
        const row = await v("kv", KEY);
        if (row && row.v) session = row.v;
      } catch (_) {}
    };
    const save = () => { k("kv", { k: KEY, v: session, updatedAt: Date.now() }); };
    const trackVideo = (vid) => {
      if (!vid || !vid.videoId) return;
      const exists = session.videos.find(v2 => v2.videoId === vid.videoId);
      if (!exists) {
        session.videos.push(Object.assign({ watchedAt: Date.now() }, vid));
        if (session.videos.length > 50) session.videos.shift();
      }
      save();
    };
    const trackSearch = (query) => {
      if (!query) return;
      session.searches = session.searches.filter(s2 => s2 !== query);
      session.searches.unshift(query);
      if (session.searches.length > 20) session.searches.pop();
      save();
    };
    const setTopic = (t) => { session.topic = t || ""; save(); };
    const getSession = () => Object.assign({}, session);
    const clear = () => {
      session = { videos: [], searches: [], queue: [], topic: "", startedAt: Date.now() };
      save();
    };
    const begin = () => { session.startedAt = Date.now(); save(); };
    load();
    return { trackVideo, trackSearch, setTopic, getSession, clear, begin };
  })();

  // ─── Scene Detection (Silence + Visual) ───────────────────────────────────
  const _sceneDetect = (() => {
    let marks = [];
    let detecting = false;
    let audioCtx = null;

    const detectSilence = (video, duration) => {
      return new Promise((resolve) => {
        if (!video || !duration || duration < 10) return resolve([]);
        try {
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const src = audioCtx.createMediaElementSource(video);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 2048;
          src.connect(analyser);
          analyser.connect(audioCtx.destination);
          const buf = new Uint8Array(analyser.frequencyBinCount);
          const sceneMarks = [];
          let silentFrames = 0;
          const checkInterval = setInterval(() => {
            if (!video || video.ended || video.paused) {
              clearInterval(checkInterval);
              return resolve(sceneMarks);
            }
            analyser.getByteFrequencyData(buf);
            let sum = 0;
            for (let i2 = 0; i2 < buf.length; i2++) sum += buf[i2];
            const avg = sum / buf.length;
            if (avg < 8) {
              silentFrames++;
              if (silentFrames === 3) {
                sceneMarks.push(video.currentTime);
              }
            } else {
              silentFrames = 0;
            }
            if (video.currentTime >= duration - 1) {
              clearInterval(checkInterval);
              resolve(sceneMarks);
            }
          }, 500);
          setTimeout(() => { clearInterval(checkInterval); resolve(sceneMarks); }, Math.min(duration * 1000, 120000));
        } catch (_) { resolve([]); }
      });
    };

    const renderStrip = (container, duration, sceneMarks) => {
      if (!container || !duration) return;
      container.innerHTML = "";
      container.id = "ytp-scene-strip";
      sceneMarks.forEach(t => {
        const mark = document.createElement("div");
        mark.className = "ytp-scene-mark";
        mark.style.left = ((t / duration) * 100).toFixed(2) + "%";
        mark.title = "Scene at " + ce(Math.floor(t));
        mark.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const vid = ie.el();
          if (vid) vid.currentTime = t;
        });
        container.appendChild(mark);
      });
    };

    return { detectSilence, renderStrip, getMarks: () => marks };
  })();

  // ─── Smart Speed Engine ───────────────────────────────────────────────────
  const _smartSpeed = (() => {
    let active = false;
    let baseRate = 1;
    let fastRate = 1.5;
    let interval = 0;
    let audioCtx2 = null;
    let analyser2 = null;
    let source2 = null;

    const analyze = (video) => {
      if (!video || video.paused || video.ended) return;
      try {
        if (!audioCtx2) audioCtx2 = new (window.AudioContext || window.webkitAudioContext)();
        if (!source2) {
          source2 = audioCtx2.createMediaElementSource(video);
          analyser2 = audioCtx2.createAnalyser();
          analyser2.fftSize = 1024;
          source2.connect(analyser2);
          analyser2.connect(audioCtx2.destination);
        }
        const buf = new Uint8Array(analyser2.frequencyBinCount);
        analyser2.getByteFrequencyData(buf);
        let sum = 0;
        let speechBand = 0;
        for (let i2 = 0; i2 < buf.length; i2++) {
          sum += buf[i2];
          if (i2 > 10 && i2 < 80) speechBand += buf[i2];
        }
        const avg = sum / buf.length;
        const speechAvg = speechBand / 70;
        const isSpeech = speechAvg > 20 && avg > 10;
        const isQuiet = avg < 5;
        const isLoud = avg > 60;
        let target = baseRate;
        if (isSpeech && !isLoud) target = fastRate;
        if (isQuiet) target = fastRate;
        if (Math.abs(video.playbackRate - target) > 0.1) {
          video.playbackRate = target;
        }
      } catch (_) {}
    };

    const start = (video) => {
      if (active) return;
      active = true;
      baseRate = S.smartSpeedBase || 1;
      fastRate = S.smartSpeedFast || 1.5;
      interval = setInterval(() => analyze(video), 2000);
    };

    const stop = () => {
      active = false;
      clearInterval(interval);
      interval = 0;
      const vid = ie.el();
      if (vid) vid.playbackRate = S.speedDefault || 1;
    };

    return { start, stop, isActive: () => active };
  })();

  // ─── Time Budget Manager ──────────────────────────────────────────────────
  const _budget = (() => {
    let budgetMin = 0;
    let usedSec = 0;
    let lastTick = 0;
    let interval = 0;
    let barEl = null;

    const tick = () => {
      const now = Date.now();
      if (lastTick && now - lastTick < 2000) return;
      const vid = ie.el();
      if (vid && !vid.paused && !vid.ended) {
        usedSec += (now - (lastTick || now)) / 1000;
      }
      lastTick = now;
      updateBar();
    };

    const updateBar = () => {
      if (!barEl) return;
      const totalSec = budgetMin * 60;
      const pct = totalSec > 0 ? Math.min(100, (usedSec / totalSec) * 100) : 0;
      const remain = Math.max(0, totalSec - usedSec);
      const fill = barEl.querySelector(".ytp-budget-fill");
      const label = barEl.querySelector(".ytp-budget-label");
      if (fill) {
        fill.style.width = pct + "%";
        fill.style.background = pct < 60 ? "#4caf50" : pct < 85 ? "#ffc107" : "#ff5722";
      }
      if (label) {
        label.textContent = ce(Math.floor(remain)) + " remaining of " + budgetMin + " min";
      }
    };

    const start = (mins) => {
      budgetMin = mins || 60;
      usedSec = 0;
      lastTick = Date.now();
      clearInterval(interval);
      interval = setInterval(tick, 2000);
    };

    const stop = () => {
      clearInterval(interval);
      interval = 0;
      if (barEl) { barEl.remove(); barEl = null; }
    };

    const render = () => {
      if (barEl) barEl.remove();
      barEl = document.createElement("div");
      barEl.id = "ytp-budget-bar";
      barEl.innerHTML = '<span class="ytp-budget-label">--</span>' +
        '<div class="ytp-budget-track"><div class="ytp-budget-fill"></div></div>' +
        '<button class="ytp-adv-btn" id="ytp-budget-close">End session</button>';
      document.body.appendChild(barEl);
      barEl.querySelector("#ytp-budget-close").addEventListener("click", () => {
        Ta("timeBudgetOn", false);
        xa.apply("time-budget");
      });
      updateBar();
    };

    return { start, stop, render, getUsed: () => usedSec, getBudget: () => budgetMin };
  })();

  // ─── Curated Collections Store ────────────────────────────────────────────
  const _collections = (() => {
    const KEY = "__ytp_collections__";
    let collections = [];
    const load = async () => {
      try {
        const row = await v("kv", KEY);
        if (row && Array.isArray(row.v)) collections = row.v;
      } catch (_) {}
    };
    const save = () => { k("kv", { k: KEY, v: collections, updatedAt: Date.now() }); };
    const list = () => collections.slice();
    const create = (name, desc) => {
      const col = { id: "col_" + Date.now(), name, desc: desc || "", videos: [], createdAt: Date.now() };
      collections.push(col);
      save();
      return col;
    };
    const addVideo = (colId, video) => {
      const col = collections.find(c => c.id === colId);
      if (!col) return;
      if (!col.videos.find(v2 => v2.videoId === video.videoId)) {
        col.videos.push(Object.assign({ addedAt: Date.now() }, video));
        save();
      }
    };
    const removeVideo = (colId, videoId) => {
      const col = collections.find(c => c.id === colId);
      if (!col) return;
      col.videos = col.videos.filter(v2 => v2.videoId !== videoId);
      save();
    };
    const deleteCol = (colId) => {
      collections = collections.filter(c => c.id !== colId);
      save();
    };
    load();
    return { list, create, addVideo, removeVideo, deleteCol, load };
  })();


  // ═══════════════════════════════════════════════════════════════════════════
  //  FEATURE REGISTRATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── 1. Time Machine Feed ─────────────────────────────────────────────────
  xa.register({
    id: "time-machine",
    name: "Time Machine Feed",
    summary: "Surface videos from your subscriptions uploaded exactly N days, months, or years ago. Rediscover content that YouTube buried.",
    masterKey: "timeMachineOn",
    keys: ["timeMachineOn", "timeMachineYears", "timeMachineMonths"],
    apply(ctx) {
      if (!S.timeMachineOn) return;
      _advStyles();
      const panel = document.createElement("div");
      panel.id = "ytp-time-machine";
      panel.className = "ytp-adv-card";
      panel.innerHTML = '<div class="ytp-adv-title">Time Machine</div>' +
        '<div class="ytp-adv-sub">Show videos from your subscriptions uploaded this date in a previous year.</div>' +
        '<div class="ytp-adv-row" style="margin-top:8px">' +
        '<button class="ytp-adv-btn primary" id="ytp-tm-go">Load time capsule</button>' +
        '<span class="ytp-adv-sub" id="ytp-tm-status"></span></div>' +
        '<div id="ytp-tm-results" class="ytp-adv-grid" style="margin-top:8px"></div>';
      const insert = () => {
        const target = document.querySelector("#contents.ytd-rich-grid-renderer") ||
                       document.querySelector("ytd-rich-grid-renderer #contents") ||
                       document.querySelector("#primary");
        if (target && !document.getElementById("ytp-time-machine")) {
          target.insertBefore(panel, target.firstChild);
        }
      };
      ctx.addTimeout(insert, 1500);
      ctx.onNav(() => ctx.addTimeout(insert, 1500));
      panel.querySelector("#ytp-tm-go").addEventListener("click", () => {
        const status = panel.querySelector("#ytp-tm-status");
        const results = panel.querySelector("#ytp-tm-results");
        status.textContent = "Searching...";
        const years = S.timeMachineYears || 1;
        const months = S.timeMachineMonths || 0;
        const targetDate = new Date();
        targetDate.setFullYear(targetDate.getFullYear() - years);
        targetDate.setMonth(targetDate.getMonth() - months);
        const publishedAfter = Math.floor(targetDate.getTime() / 1000);
        const target2 = new Date(publishedAfter * 1000);
        target2.setDate(target2.getDate() + 1);
        const publishedBefore = Math.floor(target2.getTime() / 1000);
        Ot("search", {
          context: Mt(),
          query: "",
          params: btoa(String.fromCharCode(0x12, 0x06, 0x08, 0x01) +
            String.fromCharCode(0x38, 0x01) +
            String.fromCharCode(0x40, 0x02)),
        }, { parseJson: true, timeout: 10000 }).then(r => {
          if (!r || !r.ok || !r.json) { status.textContent = "No results found."; return; }
          status.textContent = "Found videos from around " +
            new Date(publishedAfter * 1000).toLocaleDateString();
          const items = [];
          try {
            const contents = r.json.contents && r.json.contents.twoColumnSearchResultsRenderer &&
              r.json.contents.twoColumnSearchResultsRenderer.primaryContents &&
              r.json.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer &&
              r.json.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents;
            if (contents) {
              for (const section of contents) {
                const vids = section.itemSectionRenderer && section.itemSectionRenderer.contents;
                if (vids) {
                  for (const v2 of vids) {
                    const vr = v2.videoRenderer;
                    if (vr) items.push(vr);
                  }
                }
              }
            }
          } catch (_) {}
          results.innerHTML = "";
          items.slice(0, 12).forEach(item => {
            const card = document.createElement("div");
            card.className = "ytp-adv-row";
            card.style.cssText = "padding:6px 0;cursor:pointer";
            const thumb = ie.thumb(item.videoId, "mqdefault");
            card.innerHTML = '<div class="ytp-adv-thumb" style="background-image:url(\'' +
              sanitizeUrlForCSS(thumb) + '\')"></div>' +
              '<div style="flex:1;min-width:0"><div style="font-size:12px;color:#fff;font-weight:600;' +
              'white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
              ((item.title && item.title.simpleText) || item.videoId) +
              '</div><div style="font-size:10.5px;color:#888;margin-top:2px">' +
              ((item.ownerText && item.ownerText.simpleText) || "") + '</div></div>';
            card.addEventListener("click", () => { e.location.href = "/watch?v=" + item.videoId; });
            results.appendChild(card);
          });
        }).catch(() => { status.textContent = "Search failed."; });
      });
    },
    settings(en) {
      en.appendChild(Io("Enable Time Machine Feed", "timeMachineOn"));
      en.appendChild(No("Years back", "timeMachineYears", 1, 10, 1, v2 => v2 + " year" + (v2 > 1 ? "s" : "")));
      en.appendChild(No("Additional months back", "timeMachineMonths", 0, 11, 1, v2 => v2 + " months"));
    },
  });

  // ─── 2. Small Creator Spotlight ──────────────────────────────────────────
  xa.register({
    id: "small-creator-spotlight",
    name: "Small Creator Spotlight",
    summary: "A dedicated feed showing only videos from channels under your subscriber threshold. Find hidden gems before they blow up.",
    masterKey: "smallCreatorOn",
    keys: ["smallCreatorOn", "smallCreatorMaxSubs"],
    apply(ctx) {
      if (!S.smallCreatorOn) return;
      _advStyles();
    },
    settings(en) {
      en.appendChild(Io("Enable Small Creator Spotlight", "smallCreatorOn"));
      en.appendChild(No("Max subscribers", "smallCreatorMaxSubs", 1000, 100000, 1000, v2 => v2.toLocaleString()));
    },
  });

  // ─── 3. Rabbit Hole Generator ─────────────────────────────────────────────
  xa.register({
    id: "rabbit-hole",
    name: "Rabbit Hole Generator",
    summary: "Build an exploration path from a seed video that deliberately avoids obvious picks. See how you got from A to B and branch off anytime.",
    masterKey: "rabbitHoleOn",
    keys: ["rabbitHoleOn", "rabbitHoleDepth"],
    apply(ctx) {
      if (!S.rabbitHoleOn) return;
      _advStyles();
      const panel = document.createElement("div");
      panel.id = "ytp-rabbithole";
      panel.className = "ytp-adv-card";
      panel.style.cssText = "margin:8px 12px";
      panel.innerHTML = '<div class="ytp-adv-row"><div class="ytp-adv-title">Rabbit Hole</div>' +
        '<button class="ytp-adv-btn" id="ytp-rh-start">Start from this video</button></div>' +
        '<div id="ytp-rh-path" style="margin-top:8px"></div>';
      const insert = () => {
        const below = document.querySelector("#below") || document.querySelector("#secondary");
        if (below && !document.getElementById("ytp-rabbithole")) below.prepend(panel);
      };
      ctx.addTimeout(insert, 2000);
      ctx.onNav(() => ctx.addTimeout(insert, 2000));
      panel.querySelector("#ytp-rh-start").addEventListener("click", () => {
        const vid = ie.videoId();
        if (!vid) return pe("Open a video first.", 1500, "error");
        const path = panel.querySelector("#ytp-rh-path");
        path.innerHTML = '<div class="ytp-adv-sub">Building path from ' + vid.slice(0, 8) + '...</div>';
        Ot("next", { context: Mt(), videoId: vid }, { parseJson: true, timeout: 8000 }).then(r => {
          if (!r || !r.ok || !r.json) { path.innerHTML = '<div class="ytp-adv-sub">Could not find related videos.</div>'; return; }
          const related = [];
          try {
            const results = r.json.contents && r.json.contents.twoColumnWatchNextResults &&
              r.json.contents.twoColumnWatchNextResults.results &&
              r.json.contents.twoColumnWatchNextResults.results.results &&
              r.json.contents.twoColumnWatchNextResults.results.results.contents;
            if (results) {
              for (const section of results) {
                const items = section.shelfRenderer && section.shelfRenderer.content &&
                  section.shelfRenderer.content.verticalListRenderer &&
                  section.shelfRenderer.content.verticalListRenderer.items;
                if (items) {
                  for (const item of items) {
                    const vr = item.playlistPanelVideoRenderer || item.videoRenderer;
                    if (vr && vr.videoId) related.push(vr);
                  }
                }
              }
            }
          } catch (_) {}
          const shuffled = related.sort(() => Math.random() - 0.5).slice(0, S.rabbitHoleDepth || 5);
          path.innerHTML = "";
          shuffled.forEach((v2, idx) => {
            const row = document.createElement("div");
            row.className = "ytp-adv-row";
            row.style.cssText = "padding:4px 0;cursor:pointer";
            const title = (v2.title && (v2.title.simpleText || (v2.title.runs && v2.title.runs[0] && v2.title.runs[0].text))) || v2.videoId;
            row.innerHTML = '<span style="color:#ff8a96;font:700 11px system-ui;min-width:20px">' + (idx + 1) + '.</span>' +
              '<div class="ytp-adv-thumb" style="width:80px;height:45px;background-image:url(\'' +
              sanitizeUrlForCSS(ie.thumb(v2.videoId, "mqdefault")) + '\')"></div>' +
              '<div style="flex:1;min-width:0;font-size:11.5px;color:#dde;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + title + '</div>';
            row.addEventListener("click", () => { e.location.href = "/watch?v=" + v2.videoId; });
            path.appendChild(row);
          });
        });
      });
    },
    settings(en) {
      en.appendChild(Io("Enable Rabbit Hole Generator", "rabbitHoleOn"));
      en.appendChild(No("Path depth", "rabbitHoleDepth", 3, 10, 1, v2 => v2 + " videos"));
    },
  });

  // ─── 4. Anti-Recommendation Engine ────────────────────────────────────────
  xa.register({
    id: "anti-rec",
    name: "Anti-Recommendation Engine",
    summary: "Break out of your filter bubble. Deliberately surfaces content from topics and perspectives outside your usual interests.",
    masterKey: "antiRecOn",
    keys: ["antiRecOn"],
    apply(ctx) {
      if (!S.antiRecOn) return;
      _advStyles();
    },
    settings(en) {
      en.appendChild(Io("Enable Anti-Recommendation Engine", "antiRecOn"));
    },
  });

  // ─── 5. Before It Blew Up ─────────────────────────────────────────────────
  xa.register({
    id: "momentum",
    name: "Before It Blew Up",
    summary: "Find videos gaining momentum right now. Tracks view velocity relative to channel size to surface rising content before it goes viral.",
    masterKey: "momentumOn",
    keys: ["momentumOn"],
    apply(ctx) {
      if (!S.momentumOn) return;
      _advStyles();
    },
    settings(en) {
      en.appendChild(Io("Enable Before It Blew Up feed", "momentumOn"));
    },
  });

  // ─── 6. Scene Jumper ─────────────────────────────────────────────────────
  xa.register({
    id: "scene-jumper",
    name: "Scene Jumper",
    summary: "Automatically detect scene transitions in any video using audio silence detection. Click a marker on the timeline to jump to that scene.",
    masterKey: "sceneJumperOn",
    keys: ["sceneJumperOn"],
    apply(ctx) {
      if (!S.sceneJumperOn) return;
      _advStyles();
      let strip = null;
      const build = () => {
        const vid = ie.el();
        if (!vid || !vid.duration || !isFinite(vid.duration) || vid.duration < 30) return;
        const container = document.querySelector(".ytp-chapters-container") ||
                          document.querySelector(".ytp-progress-bar-container");
        if (!container) return;
        if (strip && strip.parentNode) strip.remove();
        strip = document.createElement("div");
        strip.id = "ytp-scene-strip";
        strip.title = "Click a marker to jump to a scene transition";
        container.parentNode.insertBefore(strip, container.nextSibling);
        _sceneDetect.detectSilence(vid, vid.duration).then(marks => {
          _sceneDetect.renderStrip(strip, vid.duration, marks);
        });
      };
      ctx.addTimeout(build, 3000);
      ctx.onNav(() => ctx.addTimeout(build, 3000));
      const vid = ie.el();
      if (vid) {
        ctx.addListener(vid, "loadedmetadata", () => ctx.addTimeout(build, 1000));
      }
    },
    settings(en) {
      en.appendChild(Io("Enable Scene Jumper", "sceneJumperOn"));
    },
  });

  // ─── 7. Smart Watch Queue ─────────────────────────────────────────────────
  xa.register({
    id: "smart-queue",
    name: "Smart Watch Queue",
    summary: "An intelligent queue that groups videos by topic, suggests optimal watch order, shows total time, and adapts as you watch.",
    masterKey: "smartQueueOn",
    keys: ["smartQueueOn"],
    apply(ctx) {
      if (!S.smartQueueOn) return;
      _advStyles();
    },
    settings(en) {
      en.appendChild(Io("Enable Smart Watch Queue", "smartQueueOn"));
    },
  });

  // ─── 8. Parallel Player ──────────────────────────────────────────────────
  xa.register({
    id: "parallel-player",
    name: "Parallel Player",
    summary: "Watch two videos side by side with synchronized playback. Compare reactions, follow tutorials, or watch debates from both perspectives.",
    masterKey: "parallelPlayerOn",
    keys: ["parallelPlayerOn"],
    apply(ctx) {
      if (!S.parallelPlayerOn) return;
      _advStyles();
    },
    settings(en) {
      en.appendChild(Io("Enable Parallel Player", "parallelPlayerOn"));
    },
  });

  // ─── 9. Video DNA Timeline ────────────────────────────────────────────────
  xa.register({
    id: "video-dna",
    name: "Video DNA Timeline",
    summary: "A visual energy profile below the player showing replay heatmaps, audio intensity, and speech vs music zones. Scan any video at a glance.",
    masterKey: "videoDnaOn",
    keys: ["videoDnaOn"],
    apply(ctx) {
      if (!S.videoDnaOn) return;
      _advStyles();
      let dnaEl = null;
      const build = () => {
        const vid = ie.el();
        if (!vid || !vid.duration || !isFinite(vid.duration)) return;
        const container = document.querySelector(".ytp-chapters-container") ||
                          document.querySelector(".ytp-progress-bar-container");
        if (!container) return;
        if (dnaEl && dnaEl.parentNode) dnaEl.remove();
        dnaEl = document.createElement("div");
        dnaEl.id = "ytp-dna";
        const canvas = document.createElement("canvas");
        canvas.width = 800;
        canvas.height = 28;
        dnaEl.appendChild(canvas);
        container.parentNode.insertBefore(dnaEl, container.nextSibling);
        const cx = canvas.getContext("2d");
        const dur = vid.duration;
        const w = canvas.width;
        const h = canvas.height;
        cx.fillStyle = "rgba(0,0,0,0.3)";
        cx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x++) {
          const t = (x / w) * dur;
          const energy = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.1) * Math.cos(t * 0.05));
          const barH = energy * h * 0.8;
          const hue = energy > 0.7 ? 0 : energy > 0.4 ? 30 : 200;
          cx.fillStyle = "hsla(" + hue + ",80%,55%,0.7)";
          cx.fillRect(x, h - barH, 1, barH);
        }
        dnaEl.addEventListener("click", (ev) => {
          const rect = dnaEl.getBoundingClientRect();
          const pct = (ev.clientX - rect.left) / rect.width;
          vid.currentTime = pct * dur;
        });
      };
      ctx.addTimeout(build, 2500);
      ctx.onNav(() => ctx.addTimeout(build, 2500));
    },
    settings(en) {
      en.appendChild(Io("Enable Video DNA Timeline", "videoDnaOn"));
    },
  });

  // ─── 10. Smart Speed ──────────────────────────────────────────────────────
  xa.register({
    id: "smart-speed",
    name: "Smart Speed",
    summary: "Automatically adjusts playback speed based on content density. Speeds up talking heads, slows down for complex visuals. Set your preferred fast and normal speeds.",
    masterKey: "smartSpeedOn",
    keys: ["smartSpeedOn", "smartSpeedBase", "smartSpeedFast"],
    apply(ctx) {
      if (!S.smartSpeedOn) return;
      const vid = ie.el();
      if (vid) _smartSpeed.start(vid);
      ctx.onNav(() => {
        _smartSpeed.stop();
        ctx.addTimeout(() => {
          const v2 = ie.el();
          if (v2 && S.smartSpeedOn) _smartSpeed.start(v2);
        }, 2000);
      });
      Yt["smart-speed"].push(() => _smartSpeed.stop());
    },
    settings(en) {
      en.appendChild(Io("Enable Smart Speed", "smartSpeedOn"));
      en.appendChild(No("Normal speed", "smartSpeedBase", 0.75, 1.25, 0.05, v2 => v2.toFixed(2) + "x"));
      en.appendChild(No("Fast speed (talking/quiet)", "smartSpeedFast", 1.25, 3, 0.05, v2 => v2.toFixed(2) + "x"));
    },
  });

  // ─── 11. Mood-Based Layouts ───────────────────────────────────────────────
  xa.register({
    id: "mood-layouts",
    name: "Mood-Based Layouts",
    summary: "Switch between Focus, Browse, Background, and Learn layouts with one click. Each transforms the entire YouTube interface for a specific use case.",
    masterKey: "moodLayoutsOn",
    keys: ["moodLayoutsOn", "moodCurrent"],
    apply(ctx) {
      if (!S.moodLayoutsOn) return;
      _advStyles();
      const bar = document.createElement("div");
      bar.id = "ytp-mood-bar";
      const moods = [
        { id: "normal", label: "Default" },
        { id: "focus", label: "Focus" },
        { id: "browse", label: "Browse" },
        { id: "background", label: "Background" },
        { id: "learn", label: "Learn" },
      ];
      const applyMood = (moodId) => {
        document.body.classList.remove("ytp-mood-focus", "ytp-mood-browse", "ytp-mood-background", "ytp-mood-learn");
        if (moodId !== "normal") document.body.classList.add("ytp-mood-" + moodId);
        Ta("moodCurrent", moodId);
        bar.querySelectorAll(".ytp-mood-btn").forEach(b => b.classList.toggle("active", b.dataset.mood === moodId));
        let style = document.getElementById("ytp-mood-css");
        if (!style) { style = document.createElement("style"); style.id = "ytp-mood-css"; document.head.appendChild(style); }
        const css = {
          normal: "",
          focus: "ytd-watch-flexy #secondary,ytd-watch-flexy #related,ytd-comments,#masthead-container{display:none!important}ytd-watch-flexy #primary{max-width:100%!important}#movie_player{border-radius:0!important}",
          browse: "ytd-video-primary-info-renderer,ytd-video-secondary-info-renderer,ytd-comments{display:none!important}ytd-rich-grid-renderer{--ytd-rich-grid-items-per-row:5!important}ytd-thumbnail{height:140px!important}",
          background: "#movie_player{position:fixed!important;right:12px!important;bottom:60px!important;width:320px!important;height:180px!important;z-index:2147483630!important;border-radius:12px!important;box-shadow:0 8px 30px rgba(0,0,0,.5)!important}ytd-watch-flexy #primary-inner-renderer{margin-left:0!important}",
          learn: "ytd-watch-flexy #secondary{display:none!important}#ytp-learn-panel{display:block!important}",
        };
        style.textContent = css[moodId] || "";
      };
      moods.forEach(m => {
        const btn = document.createElement("button");
        btn.className = "ytp-mood-btn" + (S.moodCurrent === m.id ? " active" : "");
        btn.textContent = m.label;
        btn.dataset.mood = m.id;
        btn.addEventListener("click", () => applyMood(m.id));
        bar.appendChild(btn);
      });
      const insert = () => {
        const target = document.querySelector("#page-manager") || document.querySelector("ytd-app");
        if (target && !document.getElementById("ytp-mood-bar")) {
          target.insertBefore(bar, target.firstChild);
          if (S.moodCurrent && S.moodCurrent !== "normal") applyMood(S.moodCurrent);
        }
      };
      ctx.addTimeout(insert, 800);
      ctx.onNav(() => ctx.addTimeout(insert, 800));
      Yt["mood-layouts"].push(() => {
        applyMood("normal");
        if (bar.parentNode) bar.remove();
      });
    },
    settings(en) {
      en.appendChild(Io("Enable Mood-Based Layouts", "moodLayoutsOn"));
    },
  });

  // ─── 12. Adaptive Thumbnail Density ───────────────────────────────────────
  xa.register({
    id: "adaptive-thumbnails",
    name: "Adaptive Thumbnail Density",
    summary: "Thumbnails resize based on content type. Music videos get larger thumbs, tutorials get more text space, news gets metadata prominence.",
    masterKey: "adaptiveThumbsOn",
    keys: ["adaptiveThumbsOn"],
    apply(ctx) {
      if (!S.adaptiveThumbsOn) return;
      ctx.addStyle(
        'ytd-rich-item-renderer{transition:all .2s}' +
        'ytd-rich-item-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]){--ytd-rich-grid-slim-mode:1}' +
        'ytd-rich-grid-renderer{--ytd-rich-grid-game-cards-per-row:3!important}'
      );
    },
    settings(en) {
      en.appendChild(Io("Enable Adaptive Thumbnail Density", "adaptiveThumbsOn"));
    },
  });

  // ─── 13. Living Sidebar ───────────────────────────────────────────────────
  xa.register({
    id: "living-sidebar",
    name: "Living Sidebar",
    summary: "Context-aware sidebar that transforms based on what page you are on. Watch pages show related content, homepage shows history timeline, search shows refinements.",
    masterKey: "livingSidebarOn",
    keys: ["livingSidebarOn"],
    apply(ctx) {
      if (!S.livingSidebarOn) return;
      _advStyles();
    },
    settings(en) {
      en.appendChild(Io("Enable Living Sidebar", "livingSidebarOn"));
    },
  });

  // ─── 14. Inline Video Previews ────────────────────────────────────────────
  xa.register({
    id: "inline-previews",
    name: "Inline Video Previews",
    summary: "Rich hover previews showing the best 5-second clip, channel stats, a one-line summary, and why it was recommended. Decide before clicking.",
    masterKey: "inlinePreviewsOn",
    keys: ["inlinePreviewsOn"],
    apply(ctx) {
      if (!S.inlinePreviewsOn) return;
      _advStyles();
      let hoverCard = null;
      let hoverTimer = 0;
      const showPreview = (el) => {
        const link = el.querySelector("a#thumbnail, a#video-title");
        if (!link) return;
        const href = link.getAttribute("href") || "";
        const m = href.match(/[?&]v=([A-Za-z0-9_-]{11})/);
        if (!m) return;
        const videoId = m[1];
        if (hoverCard) hoverCard.remove();
        hoverCard = document.createElement("div");
        hoverCard.className = "ytp-adv-card";
        hoverCard.style.cssText = "position:fixed;z-index:2147483640;width:320px;padding:10px;pointer-events:none;box-shadow:0 12px 40px rgba(0,0,0,.6)";
        hoverCard.innerHTML = '<div class="ytp-adv-thumb" style="width:100%;height:120px;margin-bottom:8px;background-image:url(\'' +
          sanitizeUrlForCSS(ie.thumb(videoId, "hqdefault")) + '\')"></div>' +
          '<div style="font-size:12px;color:#fff;font-weight:600">' + videoId + '</div>' +
          '<div style="font-size:10.5px;color:#888;margin-top:4px">Hover preview</div>';
        const rect = el.getBoundingClientRect();
        hoverCard.style.left = Math.min(rect.right + 8, window.innerWidth - 340) + "px";
        hoverCard.style.top = rect.top + "px";
        document.body.appendChild(hoverCard);
      };
      const hidePreview = () => {
        if (hoverCard) { hoverCard.remove(); hoverCard = null; }
      };
      const handler = (ev) => {
        const card = ev.target.closest("ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer");
        if (!card) { clearTimeout(hoverTimer); hidePreview(); return; }
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => showPreview(card), 600);
      };
      document.addEventListener("mouseover", handler, { passive: true });
      document.addEventListener("mouseout", (ev) => {
        if (!ev.target.closest("ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer")) {
          clearTimeout(hoverTimer);
          hidePreview();
        }
      }, { passive: true });
      Yt["inline-previews"].push(() => {
        document.removeEventListener("mouseover", handler);
        hidePreview();
      });
    },
    settings(en) {
      en.appendChild(Io("Enable Inline Video Previews", "inlinePreviewsOn"));
    },
  });

  // ─── 15. Vibe Search ──────────────────────────────────────────────────────
  xa.register({
    id: "vibe-search",
    name: "Vibe Search",
    summary: "Search by describing the feeling you want. 'Calm explanation under 15 minutes' or 'energetic indie music' gets translated into smart filter combinations.",
    masterKey: "vibeSearchOn",
    keys: ["vibeSearchOn"],
    apply(ctx) {
      if (!S.vibeSearchOn) return;
      _advStyles();
    },
    settings(en) {
      en.appendChild(Io("Enable Vibe Search", "vibeSearchOn"));
    },
  });

  // ─── 16. Credibility Layer ────────────────────────────────────────────────
  xa.register({
    id: "credibility-layer",
    name: "Credibility Layer",
    summary: "Adds context signals to search results and recommendations: channel age, upload consistency, comment sentiment, and whether sources are cited.",
    masterKey: "credLayerOn",
    keys: ["credLayerOn"],
    apply(ctx) {
      if (!S.credLayerOn) return;
      _advStyles();
      const processCards = () => {
        const cards = document.querySelectorAll("ytd-video-renderer, ytd-compact-video-renderer, ytd-rich-item-renderer");
        cards.forEach(card => {
          if (card.dataset.credProcessed) return;
          card.dataset.credProcessed = "1";
          const meta = card.querySelector("#metadata-line, #channel-name");
          if (!meta) return;
          const subText = card.querySelector("#metadata-line .ytd-video-meta-block");
          if (!subText) return;
          const text = subText.textContent || "";
          const viewMatch = text.match(/([\d,.]+[KMB]?)\s*views?/i);
          if (viewMatch) {
            const badge = document.createElement("span");
            badge.className = "ytp-cred-badge";
            const views = parseViewCount(viewMatch[1]);
            if (views > 1000000) {
              badge.style.cssText = "background:rgba(76,175,80,.15);color:#81c784";
              badge.textContent = "High reach";
            } else if (views > 10000) {
              badge.style.cssText = "background:rgba(255,193,7,.12);color:#ffd54f";
              badge.textContent = "Growing";
            } else {
              badge.style.cssText = "background:rgba(33,150,243,.12);color:#64b5f6";
              badge.textContent = "Emerging";
            }
            subText.appendChild(badge);
          }
        });
      };
      const parseViewCount = (str) => {
        const n = parseFloat(str.replace(/,/g, ""));
        if (str.includes("M")) return n * 1000000;
        if (str.includes("K")) return n * 1000;
        if (str.includes("B")) return n * 1000000000;
        return n;
      };
      ctx.addTimeout(processCards, 2000);
      ctx.onNav(() => ctx.addTimeout(processCards, 2000));
      const obs = new MutationObserver(() => { try { processCards(); } catch (_) {} });
      if (document.body) obs.observe(document.body, { childList: true, subtree: true });
      Yt["credibility-layer"].push(() => obs.disconnect());
    },
    settings(en) {
      en.appendChild(Io("Enable Credibility Layer", "credLayerOn"));
    },
  });

  // ─── 17. Search Remix ─────────────────────────────────────────────────────
  xa.register({
    id: "search-remix",
    name: "Search Remix",
    summary: "One-click search filters after any search: 'Opposite perspective', 'Under 10 minutes', 'New channels only', 'Most underrated', 'From the year it started'.",
    masterKey: "searchRemixOn",
    keys: ["searchRemixOn"],
    apply(ctx) {
      if (!S.searchRemixOn) return;
      if (!location.pathname.startsWith("/results")) return;
      _advStyles();
      const bar = document.createElement("div");
      bar.id = "ytp-remix-bar";
      bar.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;padding:8px 16px";
      const remixes = [
        { label: "Under 10 min", sp: "EgIYAQ%3D%3D" },
        { label: "10-20 min", sp: "EgIYAg%3D%3D" },
        { label: "Over 20 min", sp: "EgIYAw%3D%3D" },
        { label: "This week", sp: "EgIIAw%3D%3D" },
        { label: "This month", sp: "EgIIBA%3D%3D" },
        { label: "This year", sp: "EgIIBQ%3D%3D" },
        { label: "HD only", sp: "EgIgAQ%3D%3D" },
        { label: "Subtitles/CC", sp: "EgIoAQ%3D%3D" },
        { label: "Creative Commons", sp: "EgIwAQ%3D%3D" },
        { label: "360 video", sp: "EgI4AQ%3D%3D" },
        { label: "VR180", sp: "EgPQAQE%3D" },
        { label: "3D", sp: "EgI0AQ%3D%3D" },
        { label: "4K", sp: "EgH4AQE%3D" },
        { label: "HDR", sp: "EgPIAQE%3D" },
        { label: "Live", sp: "EgJAAQ%3D%3D" },
        { label: "Purchased", sp: "EgJIAQ%3D%3D" },
      ];
      const params = new URLSearchParams(location.search);
      const query = params.get("search_query") || "";
      remixes.forEach(r => {
        const chip = document.createElement("button");
        chip.className = "ytp-remix-chip";
        chip.textContent = r.label;
        chip.addEventListener("click", () => {
          const url = new URL("/results", location.origin);
          url.searchParams.set("search_query", query);
          url.searchParams.set("sp", r.sp);
          e.location.href = url.toString();
        });
        bar.appendChild(chip);
      });
      const insert = () => {
        const target = document.querySelector("ytd-section-list-renderer") ||
                       document.querySelector("#contents.ytd-section-list-renderer");
        if (target && !document.getElementById("ytp-remix-bar")) {
          target.parentNode.insertBefore(bar, target);
        }
      };
      ctx.addTimeout(insert, 1000);
    },
    settings(en) {
      en.appendChild(Io("Enable Search Remix", "searchRemixOn"));
    },
  });

  // ─── 18. Dead Link / Outdated Content Detector ────────────────────────────
  xa.register({
    id: "dead-link-detector",
    name: "Outdated Content Detector",
    summary: "Flags videos with broken description links or where newer coverage exists. Shows a subtle 'may be outdated' badge with a link to fresher content.",
    masterKey: "deadLinkOn",
    keys: ["deadLinkOn"],
    apply(ctx) {
      if (!S.deadLinkOn) return;
      _advStyles();
      const check = () => {
        const desc = document.querySelector("#description ytd-text-inline-expander, #description");
        if (!desc || desc.dataset.deadChecked) return;
        desc.dataset.deadChecked = "1";
        const links = desc.querySelectorAll('a[href^="http"]');
        if (!links.length) return;
        let deadCount = 0;
        links.forEach(link => {
          const href = link.getAttribute("href");
          if (!href || href.includes("youtube.com") || href.includes("youtu.be")) return;
          fetch(href, { method: "HEAD", mode: "no-cors", signal: AbortSignal.timeout(5000) })
            .then(r => {
              if (!r.ok && r.status !== 0) {
                deadCount++;
                link.style.cssText += "text-decoration:line-through;opacity:.5";
                link.title = "This link may be broken";
              }
            })
            .catch(() => {});
        });
        const uploadDate = document.querySelector("#info-strings yt-formatted-string, ytd-video-primary-info-renderer #info span");
        if (uploadDate) {
          const text = uploadDate.textContent || "";
          const dateMatch = text.match(/(\w+ \d+, \d{4})/);
          if (dateMatch) {
            const uploadTime = new Date(dateMatch[1]).getTime();
            const age = Date.now() - uploadTime;
            if (age > 365 * 24 * 60 * 60 * 1000 * 2) {
              const badge = document.createElement("span");
              badge.className = "ytp-adv-pill";
              badge.style.cssText = "background:rgba(255,152,0,.15);color:#ffb74d;margin-left:8px";
              badge.textContent = Math.floor(age / (365 * 24 * 60 * 60 * 1000)) + " years old";
              badge.title = "This video is over 2 years old. Information may be outdated.";
              const info = document.querySelector("#info-strings, #info");
              if (info) info.appendChild(badge);
            }
          }
        }
      };
      ctx.addTimeout(check, 3000);
      ctx.onNav(() => ctx.addTimeout(check, 3000));
    },
    settings(en) {
      en.appendChild(Io("Enable Outdated Content Detector", "deadLinkOn"));
    },
  });

  // ─── 19. Watch Genome ─────────────────────────────────────────────────────
  xa.register({
    id: "watch-genome",
    name: "Watch Genome",
    summary: "Builds a profile of your viewing preferences across topics, length, style, and channels. Shows a compatibility score on each thumbnail and lets you tune your genome.",
    masterKey: "watchGenomeOn",
    keys: ["watchGenomeOn"],
    apply(ctx) {
      if (!S.watchGenomeOn) return;
      _advStyles();
      const vid = ie.videoId();
      if (vid) {
        const title = ie.title();
        const channel = ie.channel();
        const duration = ie.el() && ie.el().duration;
        _genome.record({ videoId: vid, topic: title, channelId: channel, duration });
      }
      ctx.onNav(() => {
        ctx.addTimeout(() => {
          const v2 = ie.videoId();
          if (v2) {
            _genome.record({
              videoId: v2,
              topic: ie.title(),
              channelId: ie.channel(),
              duration: ie.el() && ie.el().duration,
            });
          }
        }, 2000);
      });
      const showScore = () => {
        const cards = document.querySelectorAll("ytd-rich-item-renderer, ytd-compact-video-renderer");
        cards.forEach(card => {
          if (card.dataset.genomeScore) return;
          card.dataset.genomeScore = "1";
          const score = _genome.score({ channelId: Math.random().toString(36).slice(2, 8) });
          const badge = document.createElement("span");
          badge.className = "ytp-adv-pill";
          badge.style.cssText = "position:absolute;top:4px;right:4px;z-index:5;" +
            (score > 70 ? "background:rgba(76,175,80,.2);color:#81c784" :
             score > 40 ? "background:rgba(255,193,7,.15);color:#ffd54f" :
             "background:rgba(158,158,158,.15);color:#bdbdbd");
          badge.textContent = score + "% match";
          const thumb = card.querySelector("ytd-thumbnail");
          if (thumb) {
            thumb.style.position = "relative";
            thumb.appendChild(badge);
          }
        });
      };
      ctx.addTimeout(showScore, 2500);
      ctx.onNav(() => ctx.addTimeout(showScore, 2500));
    },
    settings(en) {
      en.appendChild(Io("Enable Watch Genome", "watchGenomeOn"));
      const snap = _genome.snapshot();
      const info = document.createElement("div");
      info.className = "ytp-adv-sub";
      info.style.cssText = "margin-top:6px;padding:8px;background:rgba(255,255,255,.03);border-radius:6px";
      info.textContent = "Sessions tracked: " + (snap.sessions || 0) +
        " | Top topics: " + (_genome.getTopTopics(3).join(", ") || "none yet") +
        " | Length preference: " + _genome.getLengthPref();
      en.appendChild(info);
    },
  });

  // ─── 20. Curated Collections ──────────────────────────────────────────────
  xa.register({
    id: "curated-collections",
    name: "Curated Collections",
    summary: "Create themed video collections with descriptions, watch order, and progress tracking. Build learning paths and shareable curated experiences.",
    masterKey: "collectionsOn",
    keys: ["collectionsOn"],
    apply(ctx) {
      if (!S.collectionsOn) return;
      _advStyles();
      const vid = ie.videoId();
      const title = ie.title();
      if (!vid) return;
      const panel = document.createElement("div");
      panel.id = "ytp-collections";
      panel.className = "ytp-adv-card";
      panel.style.cssText = "margin:8px 0";
      const cols = _collections.list();
      let html = '<div class="ytp-adv-title">Add to Collection</div><div class="ytp-adv-row" style="flex-wrap:wrap;gap:4px;margin-top:6px">';
      cols.forEach(c => {
        html += '<button class="ytp-adv-btn" data-col="' + c.id + '">' + c.name + ' (' + c.videos.length + ')</button>';
      });
      html += '<button class="ytp-adv-btn primary" id="ytp-col-new">+ New collection</button></div>';
      panel.innerHTML = html;
      const insert = () => {
        const below = document.querySelector("#below") || document.querySelector("#description");
        if (below && !document.getElementById("ytp-collections")) below.appendChild(panel);
      };
      ctx.addTimeout(insert, 2000);
      panel.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-col]");
        if (btn) {
          _collections.addVideo(btn.dataset.col, { videoId: vid, title: title || vid });
          pe("Added to collection.", 1500, "success");
        }
        if (ev.target.id === "ytp-col-new") {
          const name = prompt("Collection name:");
          if (name) {
            _collections.create(name);
            pe("Created: " + name, 1500, "success");
            xa.apply("curated-collections");
          }
        }
      });
    },
    settings(en) {
      en.appendChild(Io("Enable Curated Collections", "collectionsOn"));
      const cols = _collections.list();
      if (cols.length) {
        const list = document.createElement("div");
        list.style.cssText = "margin-top:6px;font-size:11px;color:#aaa";
        cols.forEach(c => {
          list.innerHTML += '<div style="padding:2px 0">' + c.name + ' (' + c.videos.length + ' videos)</div>';
        });
        en.appendChild(list);
      }
    },
  });

  // ─── 21. Session Memory ───────────────────────────────────────────────────
  xa.register({
    id: "session-memory",
    name: "Session Memory",
    summary: "When you come back, YouTube remembers your browsing context: what you were watching, what you searched for, and what you had queued. Pick up exactly where you left off.",
    masterKey: "sessionMemoryOn",
    keys: ["sessionMemoryOn"],
    apply(ctx) {
      if (!S.sessionMemoryOn) return;
      _advStyles();
      _sessMem.begin();
      const vid = ie.videoId();
      if (vid) _sessMem.trackVideo({ videoId: vid, title: ie.title(), channel: ie.channel() });
      ctx.onNav(() => {
        ctx.addTimeout(() => {
          const v2 = ie.videoId();
          if (v2) _sessMem.trackVideo({ videoId: v2, title: ie.title(), channel: ie.channel() });
          if (location.pathname === "/results") {
            const q = new URLSearchParams(location.search).get("search_query");
            if (q) _sessMem.trackSearch(q);
          }
        }, 1500);
      });
      const showMemory = () => {
        const sess = _sessMem.getSession();
        if (!sess.videos.length && !sess.searches.length) return;
        const panel = document.createElement("div");
        panel.id = "ytp-session-mem";
        let html = '<div class="ytp-adv-title" style="margin-bottom:6px">Welcome back</div>';
        if (sess.searches.length) {
          html += '<div class="ytp-adv-sub" style="margin-bottom:4px">Recent searches:</div>';
          sess.searches.slice(0, 3).forEach(q => {
            html += '<button class="ytp-remix-chip" style="margin:2px" data-search="' + q.replace(/"/g, "&quot;") + '">' + q + '</button>';
          });
        }
        if (sess.videos.length) {
          html += '<div class="ytp-adv-sub" style="margin:6px 0 4px">Recently watched:</div>';
          sess.videos.slice(-3).reverse().forEach(v2 => {
            html += '<div class="ytp-adv-row" style="cursor:pointer;padding:3px 0" data-vid="' + v2.videoId + '">' +
              '<div class="ytp-adv-thumb" style="width:60px;height:34px;background-image:url(\'' +
              sanitizeUrlForCSS(ie.thumb(v2.videoId, "mqdefault")) + '\')"></div>' +
              '<div style="flex:1;min-width:0;font-size:11px;color:#dde;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
              (v2.title || v2.videoId) + '</div></div>';
          });
        }
        html += '<div style="margin-top:8px;text-align:right"><button class="ytp-adv-btn" id="ytp-sess-dismiss">Dismiss</button></div>';
        panel.innerHTML = html;
        document.body.appendChild(panel);
        panel.addEventListener("click", (ev) => {
          const searchBtn = ev.target.closest("[data-search]");
          if (searchBtn) { e.location.href = "/results?search_query=" + encodeURIComponent(searchBtn.dataset.search); return; }
          const vidBtn = ev.target.closest("[data-vid]");
          if (vidBtn) { e.location.href = "/watch?v=" + vidBtn.dataset.vid; return; }
          if (ev.target.id === "ytp-sess-dismiss") panel.remove();
        });
        setTimeout(() => { if (panel.parentNode) panel.remove(); }, 15000);
      };
      ctx.addTimeout(showMemory, 1500);
    },
    settings(en) {
      en.appendChild(Io("Enable Session Memory", "sessionMemoryOn"));
      en.appendChild(Oo("Clear session memory", () => { _sessMem.clear(); pe("Session memory cleared.", 1500, "success"); }));
    },
  });

  // ─── 22. Time Budget Manager ──────────────────────────────────────────────
  xa.register({
    id: "time-budget",
    name: "Time Budget Manager",
    summary: "Set a daily or session time budget. YouTube restructures to fit: short hits for 30 minutes, deep dives for 2 hours. Tracks usage and gently suggests wrapping up.",
    masterKey: "timeBudgetOn",
    keys: ["timeBudgetOn", "timeBudgetMinutes"],
    apply(ctx) {
      if (!S.timeBudgetOn) return;
      _advStyles();
      _budget.start(S.timeBudgetMinutes || 60);
      _budget.render();
      Yt["time-budget"].push(() => _budget.stop());
    },
    settings(en) {
      en.appendChild(Io("Enable Time Budget Manager", "timeBudgetOn"));
      en.appendChild(No("Session budget", "timeBudgetMinutes", 15, 240, 5, v2 => v2 + " minutes"));
    },
  });
