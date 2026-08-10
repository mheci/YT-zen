
  // ===========================================================================
  //  ZenEngine Ecosystem v3.0
  // ---------------------------------------------------------------------------
  //  Cohesive architectural expansion for YT-zen.
  //
  //  Shared Subsystems:
  //    ZenEngine     - Core orchestrator, CSS, shared state, scheduling
  //    ZenDiscovery  - Feed infrastructure, shared discovery host, scoring
  //    ZenPlayback   - Audio analysis, scene detection, adaptive speed
  //    ZenSearch     - Search enhancement, remix templates, credibility
  //    ZenSession    - Watch genome, collections, time budget
  //    ZenQueue      - Intelligent queue management
  //
  //  Features (14):
  //    Discovery:  Discover (unified)
  //    Playback:   Smart Speed
  //    Search:     Credibility Layer, Search Remix, Outdated Detection
  //    Session:    Watch Genome, Collections, Time Budget
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
    const log = ZenResources.Logger.namespace("zen");
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
.zen-btn:disabled{opacity:.5;cursor:default}
.zen-meter{height:3px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden}
.zen-meter-fill{height:100%;border-radius:2px;transition:width .4s}
#ytp-zen-scene{position:absolute;height:14px;z-index:25;pointer-events:none;
  opacity:0.65;transition:opacity .2s;background:rgba(255,255,255,.04);border-radius:3px}
#ytp-zen-scene:hover{opacity:1}
#ytp-zen-scene .zen-scene-mark{position:absolute;top:0;bottom:0;width:2px;
  background:rgba(255,255,255,.55);transition:all .15s;pointer-events:auto;cursor:pointer}
#ytp-zen-scene .zen-scene-mark:hover{background:#ff3d7f;width:4px}
#ytp-zen-dna{position:absolute;left:0;right:0;bottom:100%;height:18px;
  border-radius:3px 3px 0 0;overflow:hidden;pointer-events:none;
  opacity:0.7;transition:opacity .2s;z-index:5}
#ytp-zen-dna:hover{opacity:1}
#ytp-zen-dna canvas{width:100%;height:100%;display:block}
#ytp-zen-budget{position:fixed;bottom:0;left:0;right:0;height:30px;z-index:2147483634;
  background:rgba(14,16,22,.94);border-top:1px solid rgba(255,255,255,.08);
  display:flex;align-items:center;gap:12px;padding:0 16px;font:11px system-ui;color:#ccc;
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
#ytp-zen-budget .zen-budget-track{flex:1;height:5px;background:rgba(255,255,255,.08);
  border-radius:3px;overflow:hidden}
#ytp-zen-budget .zen-budget-fill{height:100%;border-radius:3px;transition:width .5s,background .3s}
#ytp-zen-disco{position:fixed;right:12px;top:12px;z-index:2147483647;width:min(360px,calc(100vw - 24px));
  max-height:calc(100vh - 24px);display:flex;flex-direction:column;margin:0;padding:10px;font-size:12px;
  background:rgba(14,16,22,.96);border:1px solid rgba(255,255,255,.12);border-radius:12px;
  box-shadow:0 16px 44px rgba(0,0,0,.55);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);overflow:hidden}
#ytp-zen-disco.collapsed{display:none}
#ytp-zen-disco .zen-disco-hdr{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
#ytp-zen-disco .zen-disco-title{font-size:13px;font-weight:700;color:#fff}
#ytp-zen-disco .zen-disco-close{background:transparent;border:0;color:#888;cursor:pointer;font-size:15px;line-height:1;
  padding:2px 7px;border-radius:6px;flex-shrink:0}
#ytp-zen-disco .zen-disco-close:hover{color:#fff;background:rgba(255,255,255,.12)}
#ytp-zen-disco .zen-disco-bodies{overflow-y:auto;min-height:0;flex:1 1 auto;max-height:calc(100vh - 170px);padding-right:2px}
#ytp-zen-disco-reopen{position:fixed;right:12px;top:12px;z-index:2147483647;display:none;align-items:center;gap:6px;
  padding:8px 14px;border-radius:999px;cursor:pointer;background:rgba(255,61,127,.92);border:1px solid rgba(255,255,255,.22);
  color:#fff;font:600 12px system-ui;box-shadow:0 10px 28px rgba(0,0,0,.45)}
#ytp-zen-disco-reopen.show{display:inline-flex}
#ytp-zen-disco .zen-disco-tabs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px}
#ytp-zen-disco .zen-disco-tab{padding:3px 9px;border-radius:999px;background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.08);color:#ccc;font:600 10px system-ui;cursor:pointer;transition:all .12s}
#ytp-zen-disco .zen-disco-tab:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.16)}
#ytp-zen-disco .zen-disco-tab.active{background:rgba(255,61,127,.16);border-color:rgba(255,61,127,.35);color:#ff8aa5}
#ytp-zen-disco .zen-disco-sec{display:none}
#ytp-zen-disco .zen-disco-sec.active{display:block}
#ytp-zen-disco .zen-status{font-size:10px;color:#888;margin:6px 0;min-height:12px;word-break:break-word}
#ytp-zen-preview{position:fixed;z-index:2147483640;width:300px;padding:8px;
  background:rgba(14,16,22,.96);border:1px solid rgba(255,255,255,.12);border-radius:10px;
  box-shadow:0 12px 40px rgba(0,0,0,.6);pointer-events:none;font:12px system-ui;color:#eef}
.zen-cred-badge{display:inline-flex;align-items:center;gap:3px;padding:1px 6px;
  border-radius:5px;font:600 9px system-ui;margin-left:4px;vertical-align:middle}
.zen-status{font-size:10.5px;color:#aaa;margin-top:4px;min-height:14px}
.zen-velocity{display:inline-block;padding:1px 6px;border-radius:5px;
  font:600 9.5px system-ui;background:rgba(255,61,127,.14);color:#ff8aa5;margin-left:4px}
#ytp-zen-queue .q-row{display:flex;align-items:center;gap:8px;padding:4px 0;
  border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer}
#ytp-zen-queue .q-row:hover{background:rgba(255,255,255,.05)}
#ytp-zen-queue .q-remove{background:transparent;border:0;color:#888;cursor:pointer;
  font-size:13px;padding:2px 5px}
#ytp-zen-queue .q-remove:hover{color:#ff1a4a}
#ytp-zen-sidebar{font-size:12px;color:#eef;margin-bottom:12px}
#ytp-zen-vibe{margin:8px 16px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
#ytp-zen-vibe input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
  border-radius:99px;color:#fff;padding:6px 14px;font-size:12.5px;outline:none;min-width:220px}
#ytp-zen-vibe input:focus{border-color:rgba(255,61,127,.5)}
#ytp-zen-vibe .zen-hint{font-size:10.5px;color:#777}
.zen-dearrow-chip{display:inline-flex;align-items:center;gap:4px;margin-left:8px;padding:2px 8px;border-radius:99px;
  background:rgba(111,168,220,.14);border:1px solid rgba(111,168,220,.4);color:#8ab4e8;
  font:600 10.5px system-ui;cursor:pointer;vertical-align:middle;transition:all .12s;white-space:nowrap}
.zen-dearrow-chip:hover{background:rgba(111,168,220,.26)}
.zen-dearrow-chip.swapped{background:rgba(255,61,127,.16);border-color:rgba(255,61,127,.4);color:#ff8aa5}
.zen-ryd-bar{display:flex;flex-direction:column;gap:2px;margin:6px 0 2px;max-width:340px;cursor:default}
.zen-ryd-track{height:4px;border-radius:2px;background:rgba(255,255,255,.1);overflow:hidden;display:flex}
.zen-ryd-like{background:#3ea6ff;height:100%}
.zen-ryd-dislike{background:#ff5252;height:100%}
.zen-ryd-label{font:600 10.5px system-ui;color:#aaa;display:flex;gap:8px;align-items:center;justify-content:space-between}
#ytp-zen-ai{max-width:640px;margin:12px 0}
#ytp-zen-ai .zen-ai-hdr{display:flex;align-items:center;gap:8px;font:600 11.5px system-ui;color:#fff;margin-bottom:6px}
#ytp-zen-ai button{background:rgba(255,61,127,.14);border:1px solid rgba(255,61,127,.4);color:#ff8aa5;
  font:600 10.5px system-ui;padding:4px 12px;border-radius:99px;cursor:pointer;transition:all .12s}
#ytp-zen-ai button:hover{background:rgba(255,61,127,.26)}
#ytp-zen-ai button:disabled{opacity:.5;cursor:wait}
#ytp-zen-ai .zen-ai-body{font-size:12px;line-height:1.5;color:#ccc;white-space:pre-wrap;margin-top:6px}
#ytp-zen-ai .zen-ai-note{font-size:10.5px;color:#777;margin-top:4px}
`;
    let cssInjected = false;
    const injectCSS = () => {
      if (cssInjected) return;
      cssInjected = true;
      try {
        ZenResources.Dom.css(CSS, "engine");
      } catch (_) {}
    };
    const createStore = (key, initial) => {
      const store = new ZenResources.StateStore(key, initial, {
        storage: {
          get: async (storeKey) => {
            const row = await v("kv", storeKey);
            return row && row.v !== undefined ? row.v : undefined;
          },
          set: async (storeKey, value) => {
            k("kv", { k: storeKey, v: value, updatedAt: Date.now() });
          },
        },
      });
      store.load().catch(() => {});
      return {
        get: () => store.get(),
        set: (value) => store.set(value),
        update: (fn) => store.update(fn),
        load: () => store.load(),
        flush: () => store.flush(),
      };
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
    const fetchJson = (url, opts) => {
      const o = Object.assign({ timeout: 9000, headers: {}, method: "GET" }, opts || {});
      const gmx = (typeof GM_xmlhttpRequest === "function") ? GM_xmlhttpRequest
        : (typeof window !== "undefined" && typeof window.GM_xmlhttpRequest === "function") ? window.GM_xmlhttpRequest : null;
      const wrap = (fn) => {
        if (typeof GM_xmlhttpRequest === "function") return gmx(fn);
        if (typeof window !== "undefined" && typeof window.GM_xmlhttpRequest === "function") return window.GM_xmlhttpRequest(fn);
        return null;
      };
      if (gmx) {
        return new Promise((resolve) => {
          try {
            gmx({
              method: o.method,
              url,
              headers: o.headers,
              data: o.body || undefined,
              timeout: o.timeout,
              onload: (r) => {
                try {
                  let j = null;
                  try { j = JSON.parse(r.responseText); } catch (_) {}
                  resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: j, text: r.responseText || "" });
                } catch (_) { resolve({ ok: false, status: 0, json: null, text: "" }); }
              },
              onerror: () => resolve({ ok: false, status: 0, json: null, text: "" }),
              ontimeout: () => resolve({ ok: false, status: 0, json: null, text: "" }),
            });
          } catch (_) { resolve({ ok: false, status: 0, json: null, text: "" }); }
        });
      }
      return fetch(url, { method: o.method, headers: o.headers, body: o.body || undefined })
        .then(async (r) => {
          const text = await r.text().catch(() => "");
          let j = null;
          try { j = JSON.parse(text); } catch (_) {}
          return { ok: r.ok, status: r.status, json: j, text };
        })
        .catch(() => ({ ok: false, status: 0, json: null, text: "" }));
    };
    // Fast retry mounting for SPA sections: try immediately, then back off a
    // few times. fn() must return truthy when the mount succeeded.
    const scheduleOnReady = (ctx, fn, opts = {}) => {
      const attempts = Math.max(1, Number(opts.attempts) || 5);
      const delayMs = Math.max(50, Number(opts.delayMs) || 400);
      const attempt = (left, ms) => {
        ctx.addTimeout(() => {
          let ok = false;
          try { ok = !!fn(); } catch (_) {}
          if (!ok && left > 1) attempt(left - 1, ms);
        }, ms);
      };
      ctx.addTimeout(() => attempt(attempts, delayMs), 0);
      ctx.onNav(() => attempt(attempts, delayMs));
    };
    return { injectCSS, createStore, whenIdle, dedup, innerTube, fetchJson, scheduleOnReady, log, CSS };
  })();

  // ─── ZenDiscovery ─────────────────────────────────────────────────────────
  const ZenDiscovery = (() => {
    const createVideoRow = (videoId, title, channel, onClick, metaText, compact) => {
      const row = document.createElement("div");
      row.className = "zen-row";
      row.style.cssText = "padding:" + (compact ? "2px 0" : "4px 0") + ";cursor:pointer";
      const thumb = document.createElement("div");
      thumb.className = "zen-thumb";
      thumb.style.cssText = compact ? "width:52px;height:30px" : "width:80px;height:45px";
      thumb.style.backgroundImage = "url('" + sanitizeUrlForCSS(ie.thumb(videoId, "mqdefault")) + "')";
      const copy = document.createElement("div");
      copy.style.cssText = "flex:1;min-width:0";
      const titleNode = document.createElement("div");
      titleNode.className = "zen-title";
      titleNode.style.webkitLineClamp = "1";
      if (compact) titleNode.style.fontSize = "11.5px";
      titleNode.textContent = String(title || videoId || "");
      const channelNode = document.createElement("div");
      channelNode.className = "zen-meta";
      if (compact) channelNode.style.fontSize = "9.5px";
      channelNode.textContent = String(channel || "") + (metaText ? "  ·  " + String(metaText) : "");
      copy.append(titleNode, channelNode);
      row.append(thumb, copy);
      if (onClick) row.addEventListener("click", onClick);
      return row;
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
    const setStatus = (panel, text) => {
      const el = panel && panel.querySelector("[id$=\"-status\"]");
      if (el) el.textContent = String(text || "");
    };
    // Shared compact discovery widget: one slim card in the right sidebar on
    // watch pages (and right-aligned at the top of the feed elsewhere). Every
    // feature that opts in gets a tab inside the same host, so enabling
    // Anti-Rec + Momentum yields one widget, not two stacked feeds.
    let sharedHost = null;
    const createDiscoveryHostCore = (ctx) => {
      const root = document.createElement("div");
      root.id = "ytp-zen-disco";
      root.className = "zen-card zen-disco";
      const header = document.createElement("div");
      header.className = "zen-disco-hdr";
      const title = document.createElement("span");
      title.className = "zen-disco-title";
      title.textContent = "Discover";
      header.appendChild(title);
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "zen-disco-close";
      closeBtn.textContent = "×";
      header.appendChild(closeBtn);
      const tabs = document.createElement("div");
      tabs.className = "zen-disco-tabs";
      const bodies = document.createElement("div");
      bodies.className = "zen-disco-bodies";
      root.append(header, tabs, bodies);
      const reopen = () => {
        const rp = document.getElementById("ytp-zen-disco-reopen");
        if (!rp) return;
        rp.classList.remove("show");
        root.classList.remove("collapsed");
      };
      closeBtn.addEventListener("click", () => {
        root.classList.add("collapsed");
        let rp = document.getElementById("ytp-zen-disco-reopen");
        if (!rp) {
          rp = document.createElement("button");
          rp.id = "ytp-zen-disco-reopen";
          rp.type = "button";
          rp.textContent = "Discover";
          rp.addEventListener("click", () => { rp.classList.remove("show"); root.classList.remove("collapsed"); });
          (document.body || document.documentElement).appendChild(rp);
        }
        rp.classList.add("show");
      });
      const sections = new Map();
      let activeId = null;
      let mountScheduled = false;
      const mount = () => {
        if (root.parentNode) return true;
        if (location.pathname.startsWith("/watch")) {
          const secondary = document.querySelector("#secondary");
          if (secondary) { secondary.prepend(root); return true; }
          return false;
        }
        const target = document.querySelector("ytd-rich-grid-renderer #contents") ||
                       document.querySelector("#contents.ytd-rich-grid-renderer") ||
                       document.querySelector("ytd-section-list-renderer");
        if (target) { target.parentNode.insertBefore(root, target); return true; }
        return false;
      };
      const ensureMount = () => {
        if (mountScheduled) return;
        mountScheduled = true;
        ZenEngine.scheduleOnReady(ctx, mount, { attempts: 8, delayMs: 400 });
      };
      const activate = (id, force) => {
        if (!sections.has(id)) return;
        activeId = id;
        tabs.querySelectorAll(".zen-disco-tab").forEach((b) =>
          b.classList.toggle("active", b.dataset.tab === id),
        );
        bodies.querySelectorAll(".zen-disco-sec").forEach((b) =>
          b.classList.toggle("active", b.dataset.tab === id),
        );
        const sec = sections.get(id);
        if (sec && sec.load && (!sec.loaded || force)) { sec.loaded = true; sec.load(sec.api); }
      };
      const removeSection = (id) => {
        const sec = sections.get(id);
        if (!sec) return;
        sections.delete(id);
        if (sec.btn.parentNode) sec.btn.remove();
        if (sec.body.parentNode) sec.body.remove();
        if (!sections.size) {
          if (root.parentNode) root.remove();
          const rp = document.getElementById("ytp-zen-disco-reopen");
          if (rp && rp.parentNode) rp.remove();
          mountScheduled = false;
          return;
        }
        if (activeId === id) activate([...sections.keys()][0], true);
      };
      const addSection = (id, label, load) => {
        if (sections.has(id)) return sections.get(id).api;
        const api = {};
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "zen-disco-tab";
        btn.dataset.tab = id;
        btn.textContent = label;
        btn.addEventListener("click", () => activate(id, true));
        const body = document.createElement("div");
        body.className = "zen-disco-sec";
        body.dataset.tab = id;
        const status = document.createElement("div");
        status.className = "zen-status";
        const toolbar = document.createElement("div");
        toolbar.style.cssText = "display:flex;gap:4px;flex-wrap:wrap;margin-top:6px";
        const list = document.createElement("div");
        list.style.cssText = "display:flex;flex-direction:column;gap:2px";
        body.append(status, toolbar, list);
        tabs.appendChild(btn);
        bodies.appendChild(body);
        const sec = { id, btn, body, status, toolbar, list, loaded: false, load, api };
        sections.set(id, sec);
        api.status = (text) => { status.textContent = String(text || ""); };
        api.clear = () => { list.replaceChildren(); };
        api.button = (text, cls, onClick) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "zen-btn" + (cls ? " " + cls : "");
          b.style.cssText = "font-size:10px;padding:4px 10px";
          b.textContent = text;
          b.addEventListener("click", onClick);
          toolbar.appendChild(b);
          return b;
        };
        api.row = (video) => {
          const row = createVideoRow(video.videoId, video.title, video.channel, () => {
            e.location.href = "/watch?v=" + video.videoId;
          }, null, true);
          list.appendChild(row);
          return row;
        };
        api.badge = (text) => {
          const chip = document.createElement("span");
          chip.className = "zen-velocity";
          chip.textContent = String(text || "");
          return chip;
        };
        api.refresh = (force) => { activate(id, !!force); };
        api.destroy = () => removeSection(id);
        api.list = list;
        api.body = body;
        if (!activeId) activate(id);
        ensureMount();
        return api;
      };
      return {
        root,
        addSection,
        removeSection,
        refresh: (id) => {
          const sec = sections.get(id);
          if (!sec) return;
          sec.loaded = false;
          if (activeId === id) activate(id, true);
        },
      };
    };
    const discoveryHost = (ctx) => {
      if (!sharedHost) sharedHost = createDiscoveryHostCore(ctx);
      return sharedHost;
    };
    return { createVideoRow, scoreVideo, setStatus, discoveryHost };
  })();

  // ─── ZenPlayback ──────────────────────────────────────────────────────────
  // Shared AudioGraph: exactly ONE MediaElementSource is created per video
  // element (createMediaElementSource throws if called twice on the same
  // element, which previously broke scene detection + smart speed). All
  // consumers share the same analyser; the graph is torn down with the video.
  const ZenPlayback = (() => {
    let audioCtx = null;
    const perVideo = new WeakMap();
    const getAudioCtx = () => {
      if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
      }
      return audioCtx;
    };
    const analyserFor = (video) => {
      if (!video) return null;
      const existing = perVideo.get(video);
      if (existing) return existing;
      const ctx = getAudioCtx();
      if (!ctx) return null;
      try {
        let source = null;
        let stream = null;
        let rerouted = false;
        // YouTube plays via MSE; createMediaElementSource throws on
        // MSE-backed elements, so captureStream() is the supported audio
        // tap — it reads the element's output without rerouting its path.
        if (typeof video.captureStream === "function") {
          const s = video.captureStream();
          if (s && s.getAudioTracks && s.getAudioTracks().length) {
            stream = s;
            source = ctx.createMediaStreamSource(s);
          }
        }
        // Fallback for non-MSE playback (progressive streams): reroute the
        // element through the graph.
        if (!source && typeof ctx.createMediaElementSource === "function") {
          source = ctx.createMediaElementSource(video);
          rerouted = true;
        }
        if (!source) return null;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        if (rerouted) {
          // createMediaElementSource takes over the element's audio output;
          // reconnect to the destination or the video goes silent.
          analyser.connect(ctx.destination);
        }
        const entry = { ctx, source, analyser, stream, rerouted };
        perVideo.set(video, entry);
        if (typeof video.addEventListener === "function") {
          try {
            video.addEventListener("play", () => {
              if (ctx.state === "suspended") { try { ctx.resume(); } catch (_) {} }
            }, { once: false, passive: true });
          } catch (_) {}
        }
        return entry;
      } catch (_) {
        return null;
      }
    };
    const readEnergy = (video) => {
      const entry = analyserFor(video);
      if (!entry) return { energy: 0, speech: 0, isQuiet: true, isSpeech: false, active: false };
      const analyser = entry.analyser;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(buf);
      let sum = 0, speechBand = 0;
      for (let i = 0; i < buf.length; i++) { sum += buf[i]; if (i > 10 && i < 80) speechBand += buf[i]; }
      const avg = sum / buf.length;
      const speech = speechBand / 70;
      return {
        energy: avg,
        speech,
        isQuiet: avg < 5,
        isSpeech: speech > 20 && avg > 10,
        active: !!(video && !video.paused && !video.ended && !video.muted && video.volume > 0 && !document.hidden),
      };
    };
    const release = (video) => {
      const entry = perVideo.get(video);
      if (!entry) return;
      if (entry.rerouted) {
        // createMediaElementSource throws if called twice on the same
        // element, so keep the entry and re-route the source straight to
        // the destination — audio is never left muted.
        try { entry.source.disconnect(); } catch (_) {}
        try { entry.source.connect(entry.ctx.destination); } catch (_) {}
        try { entry.analyser.disconnect(); } catch (_) {}
        return;
      }
      try { entry.source.disconnect(); } catch (_) {}
      // Stop captureStream tracks so the tap releases the element.
      if (entry.stream) {
        try { entry.stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} }); } catch (_) {}
      }
      perVideo.delete(video);
    };
    return {
      readEnergy,
      getAudioCtx,
      release,
      stats: () => ({ videos: perVideo.size, ctxActive: !!(audioCtx && audioCtx.state === "running") }),
    };
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
    const parseCount = (text) => {
      if (!text) return 0;
      const match = String(text).match(/([\d,.]+)\s*([KMB])?/i);
      if (!match) return 0;
      const value = parseFloat(match[1].replace(/,/g, "")) || 0;
      const unit = match[2] ? match[2].toUpperCase() : "";
      return unit === "K" ? value * 1e3 : unit === "M" ? value * 1e6 : unit === "B" ? value * 1e9 : value;
    };
    const parseAgoMs = (text) => {
      if (!text) return 0;
      const match = String(text).match(/([\d.]+)\s*(year|month|week|day|hour|minute)s?\s*ago/i);
      if (!match) return 0;
      const value = parseFloat(match[1]) || 0;
      const unit = match[2].toLowerCase();
      const factors = { year: 365 * 864e5, month: 30 * 864e5, week: 7 * 864e5, day: 864e5, hour: 36e5, minute: 6e4 };
      return Date.now() - value * (factors[unit] || 0);
    };
    const parseDurationSec = (text) => {
      if (!text) return 0;
      const parts = String(text).split(":").map(Number).filter((n) => Number.isFinite(n));
      if (!parts.length) return 0;
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return parts[0];
    };
    const parseSearchVideos = (json) => {
      const videos = [];
      try {
        const sections = json.contents &&
          json.contents.twoColumnSearchResultsRenderer &&
          json.contents.twoColumnSearchResultsRenderer.primaryContents &&
          json.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer &&
          json.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents;
        for (const section of sections || []) {
          const items = section.itemSectionRenderer && section.itemSectionRenderer.contents;
          for (const item of items || []) {
            const renderer = item.videoRenderer;
            if (!renderer || !renderer.videoId) continue;
            const textOf = (node) => node && (node.simpleText || (node.runs || []).map((run) => run.text).join(""));
            videos.push({
              videoId: renderer.videoId,
              title: textOf(renderer.title) || renderer.videoId,
              channel: textOf(renderer.ownerText) || "",
              publishedAt: parseAgoMs(textOf(renderer.publishedTimeText)),
              viewCount: parseCount(textOf(renderer.viewCountText)),
              durationSec: parseDurationSec(textOf(renderer.lengthText)),
            });
          }
        }
      } catch (_) {}
      return videos;
    };
    const search = async (query, sp) => {
      const params = sp ? { sp } : {};
      const response = await ZenEngine.innerTube("search", Object.assign({ context: Mt(), query }, params));
      if (!response || !response.ok || !response.json) return [];
      return parseSearchVideos(response.json);
    };
    return { REMIX_TEMPLATES, vibeToParams, analyzeCredibility, parseSearchVideos, parseCount, parseAgoMs, parseDurationSec, search };
  })();

  // ─── ZenSession ───────────────────────────────────────────────────────────
  const ZenSession = (() => {
    const genomeStore = ZenEngine.createStore("__zen_genome__", { topics: {}, lengths: {}, channels: {}, handles: {}, channelNames: {}, smallChannels: {}, sessions: 0 });
    const collectionsStore = ZenEngine.createStore("__zen_collections__", []);
    const budgetStore = ZenEngine.createStore("__zen_budget__", { usedSec: 0, budgetMin: 60, date: "" });

    const genome = {
      record(meta) {
        if (!meta) return;
        genomeStore.update(d => {
          d.sessions = (d.sessions || 0) + 1;
          if (meta.topic) { const words = String(meta.topic).toLowerCase().split(/\s+/).filter(w => w.length > 3); words.slice(0, 5).forEach(w => { d.topics[w] = (d.topics[w] || 0) + 1; }); }
          if (meta.duration) { const b = meta.duration < 300 ? "short" : meta.duration < 1200 ? "medium" : "long"; d.lengths[b] = (d.lengths[b] || 0) + 1; }
          const identity = meta.channelId || meta.handle;
          if (identity) d.channels[identity] = (d.channels[identity] || 0) + 1;
          if (meta.handle && !d.handles[meta.handle]) d.handles[meta.handle] = meta.channelId || "";
          if (meta.handle && meta.channelName && !d.channelNames[meta.handle]) d.channelNames[meta.handle] = meta.channelName;
        });
      },
      recordSubscribers(handle, channelName, subCount) {
        if (!handle || !subCount) return;
        genomeStore.update(d => {
          const current = d.smallChannels[handle];
          if (!current || subCount < current.subs) {
            d.smallChannels[handle] = { name: channelName || handle, subs: subCount, at: Date.now() };
          }
        });
      },
      getTopTopics(n) { return Object.entries(genomeStore.get().topics || {}).sort((a, b) => b[1] - a[1]).slice(0, n || 5).map(e => e[0]); },
      getTopChannels(n) { return Object.entries(genomeStore.get().channels || {}).sort((a, b) => b[1] - a[1]).slice(0, n || 10).map(e => e[0]); },
      getSmallChannels(n) { return Object.entries(genomeStore.get().smallChannels || {}).sort((a, b) => a[1].subs - b[1].subs).slice(0, n || 8); },
      isKnownSmall(handle) {
        if (!handle) return false;
        const small = genomeStore.get().smallChannels || {};
        const handleKey = handle.toLowerCase();
        return Object.keys(small).some((key) => key.toLowerCase() === handleKey);
      },
      getLengthPref() { const l = genomeStore.get().lengths || {}; const t = (l.short || 0) + (l.medium || 0) + (l.long || 0); if (!t) return "medium"; if ((l.short || 0) / t > 0.5) return "short"; if ((l.long || 0) / t > 0.4) return "long"; return "medium"; },
      score(video) {
        const d = genomeStore.get();
        let s = 50;
        const identity = video.channelId || video.handle;
        if (identity && d.channels && d.channels[identity]) s += 25;
        if (video.duration) {
          const p = genome.getLengthPref();
          const b = video.duration < 300 ? "short" : video.duration < 1200 ? "medium" : "long";
          if (b === p) s += 15;
        }
        if (video.title) {
          const topics = genome.getTopTopics(5);
          const words = String(video.title).toLowerCase().split(/\W+/).filter(w => w.length > 3);
          let overlap = 0;
          for (const word of words) if (topics.includes(word)) overlap++;
          s += Math.min(10, overlap * 5);
        }
        return Math.min(99, Math.max(5, s));
      },
      snapshot() { return genomeStore.get(); },
      reset() { genomeStore.set({ topics: {}, lengths: {}, channels: {}, handles: {}, channelNames: {}, smallChannels: {}, sessions: 0 }); },
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
    return { genome, collections, budget };
  })();

  // ─── ZenQueue ─────────────────────────────────────────────────────────────
  const ZenQueue = (() => {
    let queue = [];
    const add = (video) => {
      if (!video || !video.videoId || queue.find(v => v.videoId === video.videoId)) return false;
      queue.push(Object.assign({ addedAt: Date.now(), priority: 50 }, video));
      return true;
    };
    const remove = (id) => { queue = queue.filter(v => v.videoId !== id); };
    const reorder = (s) => {
      if (s === "shortest") queue.sort((a, b) => (a.duration || 0) - (b.duration || 0));
      else if (s === "longest") queue.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      else if (s === "newest") queue.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    };
    const getTotalTime = () => queue.reduce((s, v) => s + (v.duration || 0), 0);
    const getList = () => queue.slice();
    const clear = () => { queue = []; };
    return { add, remove, reorder, getTotalTime, getList, clear, size: () => queue.length };
  })();
  // ═══════════════════════════════════════════════════════════════════════════
  //  Algorithm Intelligence Engine (AlgoEngine)
  // ---------------------------------------------------------------------------
  //  Autonomous YouTube recommendation algorithm manipulation system.
  //
  //  Subsystems:
  //    SignalTracker    — Monitors all user interactions that send algorithm signals
  //    ProfileAnalyzer  — Classifies the current recommendation profile from homepage
  //    ContentClassifier— Topics/genres extraction from video metadata
  //    SignalInjector   — Sends deliberate signals to shape recommendations
  //    RecommendationAudit — Analyzes what YouTube is recommending and why
  //    TrainingEngine   — Guided sessions to shift the algorithm profile
  //    NegativeSignalManager — Systematic "not interested" / "don't recommend"
  //
  //  Architecture:
  //    All signal injection uses YouTube's own innertube API with the user's
  //    authenticated session (credentials: "include"). Signals are indistinguishable
  //    from organic user behavior. Rate limiting respects YouTube's expectations.
  // ═══════════════════════════════════════════════════════════════════════════

  const AlgoEngine = (() => {
    "use strict";

    // ─── Rate Limiter ────────────────────────────────────────────────────────
    // Prevents sending signals faster than a human reasonably could.
    const RateLimiter = (() => {
      const windows = new Map(); // action → { count, resetAt }
      let scale = 1; // aggression multiplier applied to every limit
      const LIMITS = {
        feedback: { max: 15, windowMs: 60000 },      // 15 per minute
        like: { max: 10, windowMs: 60000 },           // 10 per minute
        subscribe: { max: 5, windowMs: 60000 },       // 5 per minute
        browse: { max: 20, windowMs: 60000 },         // 20 per minute
        player: { max: 10, windowMs: 60000 },         // 10 per minute
        search: { max: 12, windowMs: 60000 },         // 12 per minute
        default: { max: 30, windowMs: 60000 },        // 30 per minute
      };

      const maxFor = (action) => Math.round((LIMITS[action] || LIMITS.default).max * scale);

      const setScale = (factor) => {
        const f = Math.max(0.25, Math.min(2.5, Number(factor) || 1));
        if (f !== scale) { scale = f; windows.clear(); }
      };

      const canProceed = (action) => {
        const limit = LIMITS[action] || LIMITS.default;
        const now = Date.now();
        let w = windows.get(action);
        if (!w || now >= w.resetAt) {
          w = { count: 0, resetAt: now + limit.windowMs };
          windows.set(action, w);
        }
        if (w.count >= maxFor(action)) return false;
        w.count++;
        return true;
      };

      const getRemaining = (action) => {
        const w = windows.get(action);
        if (!w) return maxFor(action);
        if (Date.now() >= w.resetAt) return maxFor(action);
        return Math.max(0, maxFor(action) - w.count);
      };

      return { canProceed, getRemaining, setScale, getScale: () => scale };
    })();

    // ─── Content Classifier ──────────────────────────────────────────────────
    // Extracts topic signals from video metadata. Uses keyword matching against
    // a comprehensive topic taxonomy. Returns weighted topic scores.
    const TOPIC_TAXONOMY = {
      tech: ["programming", "coding", "software", "developer", "linux", "windows", "mac", "computer", "laptop", "hardware", "cpu", "gpu", "ram", "ssd", "tutorial", "code", "python", "javascript", "react", "ai", "machine learning", "web development", "app", "tech review", "gadget", "smartphone", "tablet", "server", "network", "cybersecurity", "database", "api", "github", "open source", "raspberry pi", "arduino", "docker", "kubernetes", "devops", "cloud", "aws", "azure"],
      gaming: ["game", "gaming", "gameplay", "playthrough", "lets play", "walkthrough", "speedrun", "minecraft", "fortnite", "valorant", "league of legends", "call of duty", "gta", "elden ring", "zelda", "mario", "pokemon", "steam", "playstation", "xbox", "nintendo", "pc gaming", "esports", "twitch", "streamer", "mod", "dlc", "patch", "update", "review", "tier list"],
      science: ["science", "physics", "chemistry", "biology", "astronomy", "space", "nasa", "research", "experiment", "theory", "quantum", "evolution", "climate", "environment", "mathematics", "engineering", "medicine", "neuroscience", "genetics", "atom", "molecule", "cell", "organism", "ecosystem", "universe", "planet", "star", "galaxy", "black hole"],
      education: ["education", "learn", "study", "course", "lecture", "school", "university", "college", "student", "teacher", "professor", "academic", "exam", "homework", "textbook", "curriculum", "degree", "certificate", "skill", "training", "workshop", "masterclass"],
      music: ["music", "song", "album", "artist", "band", "concert", "lyrics", "guitar", "piano", "drums", "bass", "vocals", "producer", "beat", "mix", "remix", "cover", "original", "playlist", "genre", "rock", "pop", "hip hop", "rap", "jazz", "classical", "electronic", "edm", "indie", "alternative"],
      news: ["news", "breaking", "politics", "government", "election", "congress", "senate", "president", "policy", "law", "regulation", "democrat", "republican", "liberal", "conservative", "media", "journalism", "reporter", "anchor", "headline", "current events", "world", "international", "domestic", "local"],
      entertainment: ["movie", "film", "tv", "television", "show", "series", "episode", "season", "actor", "actress", "director", "producer", "hollywood", "netflix", "disney", "streaming", "review", "reaction", "trailer", "behind the scenes", "celebrity", "comedy", "drama", "thriller", "horror", "action", "animation"],
      fitness: ["fitness", "workout", "exercise", "gym", "training", "muscle", "strength", "cardio", "yoga", "pilates", "running", "cycling", "swimming", "diet", "nutrition", "protein", "calorie", "weight loss", "bodybuilding", "crossfit", "stretching", "recovery", "health", "wellness"],
      finance: ["finance", "investing", "stock", "market", "money", "budget", "saving", "banking", "crypto", "bitcoin", "ethereum", "trading", "portfolio", "retirement", "401k", "ira", "real estate", "property", "mortgage", "tax", "income", "expense", "debt", "credit", "loan", "interest"],
      cooking: ["cooking", "recipe", "food", "kitchen", "chef", "meal", "ingredient", "baking", "grill", "fry", "boil", "saute", "restaurant", "cuisine", "dish", "flavor", "spice", "herb", "sauce", "dessert", "appetizer", "breakfast", "lunch", "dinner", "snack", "vegan", "vegetarian", "gluten free"],
      travel: ["travel", "trip", "vacation", "destination", "flight", "hotel", "tourism", "explore", "adventure", "backpacking", "road trip", "cruise", "beach", "mountain", "city", "country", "culture", "landmark", "itinerary", "budget travel", "luxury", "solo travel", "family travel"],
      diy: ["diy", "craft", "project", "build", "make", "create", "handmade", "tutorial", "how to", "step by step", "woodworking", "sewing", "knitting", "painting", "drawing", "sculpture", "pottery", "jewelry", "upcycle", "repurpose", "home improvement", "renovation", "repair", "fix"],
      automotive: ["car", "automotive", "vehicle", "driving", "engine", "motor", "transmission", "tire", "brake", "suspension", "exhaust", "turbo", "supercharger", "horsepower", "torque", "mpg", "electric vehicle", "ev", "tesla", "hybrid", "suv", "truck", "sedan", "coupe", "convertible", "review", "test drive"],
      space: ["space", "astronomy", "rocket", "launch", "orbit", "iss", "spacex", "nasa", "mars", "moon landing", "planet", "galaxy", "universe", "astrophysics", "satellite", "telescope", "astrophotography", "solar system", "interstellar", "gravity", "cosmos", "lunar", "comet", "asteroid", "cosmonaut", "astronaut"],
      history: ["history", "historical", "ancient", "medieval", "renaissance", "world war", "civil war", "empire", "dynasty", "archaeology", "artifact", "museum", "documentary", "century", "era", "civilization", "timeline", "egypt", "rome", "greece", "viking", "monarchy", "revolution"],
      art: ["art", "painting", "drawing", "sketch", "digital art", "illustration", "artist", "gallery", "watercolor", "acrylic", "canvas", "portrait", "sculpture", "concept art", "art tutorial", "ink drawing", "painter", "illustrator"],
      philosophy: ["philosophy", "philosopher", "stoicism", "stoic", "existentialism", "nihilism", "ethics", "morality", "consciousness", "meaning of life", "logic", "reasoning", "plato", "aristotle", "nietzsche", "sartre", "camus", "taoism", "zen buddhism", "mindfulness", "wisdom"],
      psychology: ["psychology", "mental health", "therapy", "anxiety", "depression", "mindset", "habit", "behavior", "cognitive", "neuroscience", "personality", "trauma", "adhd", "sleep science", "stress", "emotional intelligence", "psychologist", "counseling", "addiction"],
      business: ["business", "startup", "entrepreneur", "marketing", "sales", "branding", "strategy", "management", "leadership", "product", "growth", "ecommerce", "saas", "fundraising", "venture capital", "pitch", "consulting", "career", "side hustle", "freelance", "business model", "scaling"],
      design: ["design", "ui design", "ux design", "graphic design", "typography", "logo design", "web design", "product design", "figma", "photoshop", "illustrator", "color theory", "layout", "motion design", "brand design", "user experience", "prototype"],
      photography: ["photography", "camera", "lens", "photo", "lightroom", "portrait photography", "landscape photography", "street photography", "iso", "aperture", "shutter speed", "photography tips", "camera gear", "photographer", "photo editing", "cinematic shot"],
      sports: ["sports", "football", "soccer", "basketball", "tennis", "cricket", "olympics", "athlete", "training", "match", "tournament", "championship", "goals", "highlights", "mma", "boxing", "f1", "formula one", "nfl", "nba", "premier league", "sport science"],
      outdoors: ["outdoors", "hiking", "camping", "backpacking", "fishing", "hunting", "survival", "bushcraft", "climbing", "kayaking", "canoeing", "trail", "wildlife", "national park", "wilderness", "outdoor gear", "nature documentary", "adventure"],
      gardening: ["gardening", "garden", "plants", "growing", "seeds", "soil", "compost", "vegetables", "herbs", "flowers", "greenhouse", "pruning", "harvest", "permaculture", "urban gardening", "plant care", "houseplants", "farming"],
      pets: ["pets", "pet", "dog training", "cat", "puppy", "kitten", "aquarium", "fish tank", "reptile", "hamster", "parrot", "pet grooming", "vet", "rescue dog", "adoption", "pet care"],
      anime: ["anime", "manga", "anime review", "anime list", "shonen", "slice of life anime", "ghibli", "anime music", "cosplay", "otaku", "anime reaction", "manga review"],
      literature: ["book", "books", "novel", "reading", "author", "writer", "poetry", "fiction", "fantasy book", "sci-fi novel", "mystery novel", "thriller book", "biography", "audiobook", "book review", "booktube", "book summary", "literature"],
      selfImprovement: ["self improvement", "productivity", "motivation", "discipline", "goals", "habits", "morning routine", "focus", "learning", "growth mindset", "personal development", "journaling", "meditation", "confidence", "procrastination", "success"],
      productivity: ["productivity", "focus", "time management", "deep work", "pomodoro", "study tips", "note taking", "organization", "workflow", "remote work", "efficiency", "productivity tools", "notion", "obsidian", "getting things done"],
      economics: ["economics", "economy", "inflation", "recession", "gdp", "interest rate", "macroeconomics", "microeconomics", "supply chain", "trade", "fiscal policy", "monetary policy", "jobs report", "unemployment", "economic crisis", "housing market"],
      robotics: ["robotics", "robot", "automation", "humanoid", "drone", "bionic", "mechatronics", "iot", "embedded", "machine vision", "agi", "automation tech", "robot arm", "sensor"],
      trueCrime: ["true crime", "murder case", "unsolved mystery", "cold case", "serial killer", "criminal", "investigation", "forensic", "trial", "crime documentary", "court case", "missing person", "crime story"],
      vlogs: ["vlog", "daily vlog", "travel vlog", "life update", "day in the life", "lifestyle", "family vlog", "vlogger", "weekly vlog", "routine"],
      documentaries: ["documentary", "docu-series", "explained", "deep dive", "mini documentary", "documentary film", "storytelling", "investigative", "feature documentary"],
      language: ["language learning", "learn spanish", "learn french", "learn japanese", "learn korean", "learn german", "english grammar", "polyglot", "foreign language", "vocabulary", "fluent", "language tips", "duolingo", "anki"],
    };

    const ContentClassifier = (() => {
      const cache = new ZenResources.BoundedCache(256, "topic-cache");

      const classify = (metadata) => {
        if (!metadata) return {};
        const cacheKey = metadata.videoId || "";
        if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey);

        const text = [
          metadata.title || "",
          metadata.description || "",
          (metadata.keywords || []).join(" "),
          metadata.channelName || "",
          (metadata.tags || []).join(" "),
          metadata.category || "",
        ].join(" ").toLowerCase();

        const scores = {};
        for (const [topic, keywords] of Object.entries(TOPIC_TAXONOMY)) {
          let score = 0;
          for (const kw of keywords) {
            const regex = new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi");
            const matches = text.match(regex);
            if (matches) score += matches.length;
          }
          if (score > 0) scores[topic] = score;
        }

        // Normalize scores to percentages
        const total = Object.values(scores).reduce((a, b) => a + b, 0);
        if (total > 0) {
          for (const topic of Object.keys(scores)) {
            scores[topic] = Math.round((scores[topic] / total) * 100);
          }
        }

        if (cacheKey) cache.set(cacheKey, scores);
        return scores;
      };

      const classifyFromPage = () => {
        try {
          const pr = e.ytInitialPlayerResponse;
          if (!pr || !pr.videoDetails) return {};
          return classify({
            videoId: pr.videoDetails.videoId,
            title: pr.videoDetails.title,
            description: pr.videoDetails.shortDescription,
            keywords: pr.videoDetails.keywords,
            channelName: pr.videoDetails.author,
            category: pr.microformat && pr.microformat.playerMicroformatRenderer && pr.microformat.playerMicroformatRenderer.category,
          });
        } catch (_) { return {}; }
      };

      return { classify, classifyFromPage, TOPIC_TAXONOMY };
    })();

    // ─── Signal Tracker ──────────────────────────────────────────────────────
    // Monitors all user interactions that send algorithm signals.
    // Intercepts innertube API calls to log what signals are being sent.
    const SignalTracker = (() => {
      const store = ZenEngine.createStore("__algo_signals__", {
        events: [],
        watchHistory: {},   // videoId → { watchTime, duration, pct, classified }
        likeHistory: {},     // videoId → { liked, disliked, timestamp }
        subHistory: {},      // channelId → { subscribed, timestamp }
        feedbackHistory: {}, // videoId → { action, timestamp }
        sessionSignals: 0,
      });

      const trackWatch = (videoId, watchTime, duration) => {
        if (!videoId) return;
        const pct = duration > 0 ? Math.min(100, Math.round((watchTime / duration) * 100)) : 0;
        const topics = ContentClassifier.classifyFromPage();
        let channelId = "";
        let channelName = "";
        try {
          const vd = e.ytInitialPlayerResponse && e.ytInitialPlayerResponse.videoDetails;
          if (vd) {
            channelId = vd.channelId || "";
            channelName = vd.author || "";
          }
        } catch (_) {}
        store.update(d => {
          d.watchHistory[videoId] = { watchTime, duration, pct, topics, channelId, channelName, ts: Date.now() };
          // Keep only last 500 entries
          const keys = Object.keys(d.watchHistory);
          if (keys.length > 500) {
            keys.sort((a, b) => (d.watchHistory[a].ts || 0) - (d.watchHistory[b].ts || 0));
            for (const k of keys.slice(0, keys.length - 500)) delete d.watchHistory[k];
          }
          d.events.push({ type: "watch", videoId, pct, ts: Date.now() });
          if (d.events.length > 1000) d.events = d.events.slice(-1000);
          d.sessionSignals++;
        });
      };

      // Recency weight: recent watches shape the profile far more than old ones.
      const recencyWeight = (ts) => {
        const age = Math.max(0, Date.now() - (ts || 0));
        if (age < 24 * 3600e3) return 1;
        if (age < 7 * 24 * 3600e3) return 0.7;
        if (age < 30 * 24 * 3600e3) return 0.4;
        if (age < 90 * 24 * 3600e3) return 0.2;
        return 0.08;
      };

      const getProfile = () => {
        const d = store.get();
        const topicScores = {};
        const watched = Object.values(d.watchHistory);
        for (const entry of watched) {
          if (!entry.topics) continue;
          const weight = (entry.pct || 0) / 100 * recencyWeight(entry.ts); // Watch % × recency
          for (const [topic, score] of Object.entries(entry.topics)) {
            topicScores[topic] = (topicScores[topic] || 0) + score * weight;
          }
        }
        // Normalize
        const maxScore = Math.max(1, ...Object.values(topicScores));
        for (const topic of Object.keys(topicScores)) {
          topicScores[topic] = Math.round((topicScores[topic] / maxScore) * 100);
        }
        return {
          topics: topicScores,
          totalWatched: watched.length,
          totalLikes: Object.values(d.likeHistory).filter(v => v.liked).length,
          totalDislikes: Object.values(d.likeHistory).filter(v => v.disliked).length,
          totalFeedback: Object.keys(d.feedbackHistory).length,
          sessionSignals: d.sessionSignals,
          avgWatchPct: watched.length > 0 ? Math.round(watched.reduce((s, v) => s + (v.pct || 0), 0) / watched.length) : 0,
        };
      };

      // Aggregate channel affinity from watch history.
      const getChannels = (limit = 10) => {
        const d = store.get();
        const map = new Map();
        for (const entry of Object.values(d.watchHistory)) {
          if (!entry.channelId) continue;
          const cur = map.get(entry.channelId) || { name: entry.channelName || entry.channelId, count: 0, totalPct: 0 };
          cur.count++;
          cur.totalPct += entry.pct || 0;
          if (entry.channelName) cur.name = entry.channelName;
          map.set(entry.channelId, cur);
        }
        return Array.from(map.entries())
          .map(([id, info]) => ({ channelId: id, ...info }))
          .sort((a, b) => b.totalPct - a.totalPct)
          .slice(0, limit);
      };

      const getRecentSignals = (limit = 12) => store.get().events.slice(-limit);

      const clearHistory = () => {
        store.update(d => {
          d.events = [];
          d.watchHistory = {};
          d.likeHistory = {};
          d.feedbackHistory = {};
          d.sessionSignals = 0;
        });
      };

      const trackLike = (videoId, action) => {
        if (!videoId) return;
        store.update(d => {
          d.likeHistory[videoId] = { liked: action === "like", disliked: action === "dislike", ts: Date.now() };
          d.events.push({ type: action, videoId, ts: Date.now() });
          if (d.events.length > 1000) d.events = d.events.slice(-1000);
          d.sessionSignals++;
        });
      };

      const trackFeedback = (videoId, action) => {
        if (!videoId) return;
        store.update(d => {
          d.feedbackHistory[videoId] = { action, ts: Date.now() };
          d.events.push({ type: "feedback:" + action, videoId, ts: Date.now() });
          if (d.events.length > 1000) d.events = d.events.slice(-1000);
          d.sessionSignals++;
        });
      };

      return { trackWatch, trackLike, trackFeedback, getProfile, getChannels, getRecentSignals, clearHistory, getStore: () => store };
    })();

    // ─── Signal Injector ─────────────────────────────────────────────────────
    // Sends deliberate signals to YouTube's innertube API to shape recommendations.
    // All calls use the user's authenticated session (credentials: "include").
    const SignalInjector = (() => {

      // Send a feedback signal (not interested, don't recommend, etc.)
      const sendFeedback = async (feedbackToken, action) => {
        if (!RateLimiter.canProceed("feedback")) return false;
        try {
          const result = await Ot("feedback", {
            context: Mt(),
            feedbackTokens: [feedbackToken],
            isFeedbackTokenUnencrypted: false,
            shouldMerge: false,
          });
          if (result && result.ok) {
            SignalTracker.trackFeedback(feedbackToken.slice(0, 20), action || "feedback");
            return true;
          }
        } catch (_) {}
        return false;
      };

      // Extract feedback tokens from the current page's recommendation data
      const extractFeedbackTokens = () => {
        const tokens = { notInterested: [], dontRecommend: [] };
        try {
          const data = e.ytInitialData;
          if (!data) return tokens;
          const json = JSON.stringify(data);
          // Look for feedback tokens in menu items
          const notInterestedRegex = /"feedbackToken":"([^"]+)".*?"notInterested|"notInterested".*?"feedbackToken":"([^"]+)"/gi;
          const dontRecommendRegex = /"feedbackToken":"([^"]+)".*?"dontRecommend|"dontRecommend".*?"feedbackToken":"([^"]+)"/gi;
          let match;
          while ((match = notInterestedRegex.exec(json)) !== null) {
            const token = match[1] || match[2];
            if (token) tokens.notInterested.push(token);
          }
          while ((match = dontRecommendRegex.exec(json)) !== null) {
            const token = match[1] || match[2];
            if (token) tokens.dontRecommend.push(token);
          }
        } catch (_) {}
        return tokens;
      };

      // Send a like signal
      const sendLike = async (videoId, action = "like") => {
        if (!videoId || !RateLimiter.canProceed("like")) return false;
        try {
          const endpoint = action === "like" ? "like/like" : action === "dislike" ? "like/dislike" : "like/removelike";
          const result = await Ot(endpoint, {
            context: Mt(),
            target: { videoId },
          });
          if (result && result.ok) {
            SignalTracker.trackLike(videoId, action);
            return true;
          }
        } catch (_) {}
        return false;
      };

      // Simulate watching a video (sends player signal)
      const simulateWatch = async (videoId, durationSec = 30) => {
        if (!videoId || !RateLimiter.canProceed("player")) return false;
        try {
          const cpn = generateCPN();
          const result = await Ot("player", {
            context: Mt(),
            videoId,
            cpn,
            contentCheckOk: true,
            racyCheckOk: true,
            playbackContext: {
              contentPlaybackContext: {
                vis: 0,
                lactMilliseconds: "1000",
              },
            },
          });
          if (result && result.ok) {
            // Send watch time signal
            await sendWatchTime(videoId, cpn, durationSec);
            SignalTracker.trackWatch(videoId, durationSec, durationSec + 10);
            return true;
          }
        } catch (_) {}
        return false;
      };

      // Send a watch time signal via the stats/watchtime endpoint
      const sendWatchTime = async (videoId, cpn, watchSec) => {
        try {
          // Use the existing qt() function for watch time signaling
          if (typeof qt === "function") {
            qt(videoId, watchSec + 10, watchSec, "playing", cpn);
          }
        } catch (_) {}
      };

      // Generate a random CPN (client playback nonce)
      const generateCPN = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        let cpn = "";
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        for (let i = 0; i < 16; i++) cpn += chars[arr[i] % chars.length];
        return cpn;
      };

      // Browse a channel page (signals interest in the channel)
      const browseChannel = async (channelId) => {
        if (!channelId || !RateLimiter.canProceed("browse")) return false;
        try {
          const result = await Ot("browse", {
            context: Mt(),
            browseId: channelId,
          });
          return result && result.ok;
        } catch (_) {}
        return false;
      };

      // Search for a topic (signals interest in the topic)
      const searchTopic = async (query) => {
        if (!query || !RateLimiter.canProceed("browse")) return false;
        try {
          const result = await Ot("search", {
            context: Mt(),
            query,
          });
          return result && result.ok;
        } catch (_) {}
        return false;
      };

      return { sendFeedback, extractFeedbackTokens, sendLike, simulateWatch, browseChannel, searchTopic, generateCPN };
    })();

    // ─── Profile Analyzer ────────────────────────────────────────────────────
    // Analyzes what YouTube is currently recommending to understand the profile.
    const ProfileAnalyzer = (() => {
      const analyzeHomepage = () => {
        const recommendations = [];
        try {
          const items = document.querySelectorAll("ytd-rich-item-renderer");
          for (const item of items) {
            const titleEl = item.querySelector("#video-title, #video-title-link, .yt-lockup-metadata-view-model__title");
            const channelEl = item.querySelector("#channel-name a, ytd-channel-name a, .ytd-channel-name");
            const linkEl = item.querySelector("a#thumbnail, a#video-title-link");
            if (!titleEl) continue;
            const title = (titleEl.textContent || "").trim();
            const channel = channelEl ? (channelEl.textContent || "").trim() : "";
            const href = linkEl ? (linkEl.getAttribute("href") || "") : "";
            const videoIdMatch = href.match(/[?&]v=([A-Za-z0-9_-]{11})/);
            const videoId = videoIdMatch ? videoIdMatch[1] : "";

            // Extract feedback tokens from the menu
            let notInterestedToken = "";
            let dontRecommendToken = "";
            try {
              const menuData = item.querySelector("ytd-menu-renderer");
              if (menuData && menuData.__data) {
                const dataStr = JSON.stringify(menuData.__data);
                const niMatch = dataStr.match(/notInterested.*?feedbackToken.*?"([^"]+)"/);
                const drMatch = dataStr.match(/dontRecommend.*?feedbackToken.*?"([^"]+)"/);
                if (niMatch) notInterestedToken = niMatch[1];
                if (drMatch) dontRecommendToken = drMatch[1];
              }
            } catch (_) {}

            const topics = ContentClassifier.classify({ title, channelName: channel, videoId });
            recommendations.push({ videoId, title, channel, topics, notInterestedToken, dontRecommendToken });
          }
        } catch (_) {}

        // Aggregate topic distribution
        const topicDist = {};
        for (const rec of recommendations) {
          for (const [topic, score] of Object.entries(rec.topics)) {
            topicDist[topic] = (topicDist[topic] || 0) + score;
          }
        }
        const total = Math.max(1, Object.values(topicDist).reduce((a, b) => a + b, 0));
        for (const topic of Object.keys(topicDist)) {
          topicDist[topic] = Math.round((topicDist[topic] / total) * 100);
        }

        return { recommendations, topicDistribution: topicDist, count: recommendations.length };
      };

      // Compare current profile vs recommended content to find mismatches
      const findMismatches = () => {
        const profile = SignalTracker.getProfile();
        const homepage = analyzeHomepage();
        const mismatches = [];

        for (const rec of homepage.recommendations) {
          for (const [topic, recScore] of Object.entries(rec.topics)) {
            const profileScore = profile.topics[topic] || 0;
            // If YouTube recommends something the profile shows low interest in
            if (recScore > 30 && profileScore < 15) {
              mismatches.push({
                videoId: rec.videoId,
                title: rec.title,
                topic,
                recScore,
                profileScore,
                notInterestedToken: rec.notInterestedToken,
                dontRecommendToken: rec.dontRecommendToken,
              });
            }
          }
        }
        return mismatches;
      };

      return { analyzeHomepage, findMismatches };
    })();

    // ─── Training Engine ─────────────────────────────────────────────────────
    // Guided sessions to shift the algorithm toward desired topics.
    const TrainingEngine = (() => {
      let trainingActive = false;
      let trainingProgress = { completed: 0, total: 0 };

      const startTraining = async (targetTopics, opts = {}) => {
        if (trainingActive) return { ok: false, error: "Training already in progress" };
        trainingActive = true;
        trainingProgress = { completed: 0, total: 0 };

        const actions = [];

        // 1. Search for each target topic (signals interest)
        for (const topic of targetTopics) {
          const keywords = TOPIC_TAXONOMY[topic];
          if (keywords) {
            // Pick 2-3 representative search queries
            const queries = keywords.slice(0, 3);
            for (const q of queries) {
              actions.push({ type: "search", query: q });
            }
          }
        }

        // 2. Send negative signals for unwanted topics on homepage
        const mismatches = ProfileAnalyzer.findMismatches();
        for (const mismatch of mismatches.slice(0, opts.maxNegative || 10)) {
          if (mismatch.notInterestedToken) {
            actions.push({ type: "notInterested", token: mismatch.notInterestedToken, videoId: mismatch.videoId });
          }
        }

        trainingProgress.total = actions.length;

        // Execute actions with human-like pacing; stops immediately on request
        const results = [];
        for (const action of actions) {
          if (!trainingActive) break;
          let ok = false;
          if (action.type === "search") {
            ok = await SignalInjector.searchTopic(action.query);
          } else if (action.type === "notInterested") {
            ok = await SignalInjector.sendFeedback(action.token, "notInterested");
          }
          results.push({ ...action, ok });
          trainingProgress.completed++;
          if (trainingActive && action !== actions[actions.length - 1]) {
            // 1.2-3.5s human-like delay between actions
            await new Promise(r => setTimeout(r, 1200 + Math.random() * 2300));
          }
        }

        trainingActive = false;
        return { ok: true, results, progress: trainingProgress };
      };

      const stopTraining = () => { trainingActive = false; };
      const getProgress = () => trainingProgress;
      const isActive = () => trainingActive;

      return { startTraining, stopTraining, getProgress, isActive };
    })();

    // ─── Negative Signal Manager ─────────────────────────────────────────────
    // Systematically sends "not interested" and "don't recommend" signals
    // for content matching user-defined criteria.
    const NegativeSignalManager = (() => {
      const blockTopics = new Set();
      const blockKeywords = [];

      const addBlockedTopic = (topic) => { blockTopics.add(topic.toLowerCase()); };
      const removeBlockedTopic = (topic) => { blockTopics.delete(topic.toLowerCase()); };
      const addBlockedKeyword = (kw) => { blockKeywords.push(kw.toLowerCase()); };

      const scanAndBlock = async (maxActions = 15) => {
        const homepage = ProfileAnalyzer.analyzeHomepage();
        let actions = 0;

        for (const rec of homepage.recommendations) {
          if (actions >= maxActions) break;

          let shouldBlock = false;
          let blockReason = "";

          // Check topic blocks
          for (const [topic, score] of Object.entries(rec.topics)) {
            if (score > 25 && blockTopics.has(topic)) {
              shouldBlock = true;
              blockReason = "blocked topic: " + topic;
              break;
            }
          }

          // Check keyword blocks
          if (!shouldBlock) {
            const title = (rec.title || "").toLowerCase();
            for (const kw of blockKeywords) {
              if (title.includes(kw)) {
                shouldBlock = true;
                blockReason = "blocked keyword: " + kw;
                break;
              }
            }
          }

          if (shouldBlock && rec.notInterestedToken) {
            const ok = await SignalInjector.sendFeedback(rec.notInterestedToken, "notInterested:" + blockReason);
            if (ok) actions++;
            // 0.9-1.8s human-like delay between feedback signals
            await new Promise(r => setTimeout(r, 900 + Math.random() * 900));
          }
        }

        return { actions, scanned: homepage.recommendations.length };
      };

      return { addBlockedTopic, removeBlockedTopic, addBlockedKeyword, scanAndBlock, getBlockedTopics: () => [...blockTopics], getBlockedKeywords: () => [...blockKeywords] };
    })();

    // ─── Autonomous Watch Optimizer ──────────────────────────────────────────
    // Monitors current video playback and optimizes watch signals:
    // - For wanted topics: ensure sufficient watch time to signal interest
    // - For unwanted topics: minimize watch time to signal disinterest
    const WatchOptimizer = (() => {
      let monitoring = false;
      let intervalId = 0;
      let skipSignals = 0;

      const start = () => {
        if (monitoring) return;
        monitoring = true;

        intervalId = setInterval(() => {
          if (!monitoring) return;
          const vid = ie.el();
          if (!vid || vid.paused || vid.ended) return;
          if (_isLiveStream()) return;

          const videoId = ie.videoId();
          if (!videoId) return;

          const currentTime = vid.currentTime;
          const duration = vid.duration;
          if (!isFinite(duration) || duration < 10) return;

          const topics = ContentClassifier.classifyFromPage();
          const profile = SignalTracker.getProfile();

          // Determine if this content aligns with desired profile
          let wantedScore = 0;
          let unwantedScore = 0;
          for (const [topic, score] of Object.entries(topics)) {
            const profileScore = profile.topics[topic] || 0;
            if (profileScore > 30) wantedScore += score;
            if (NegativeSignalManager.getBlockedTopics().includes(topic)) unwantedScore += score;
          }

          // Track the watch event
          SignalTracker.trackWatch(videoId, currentTime, duration);

          // If unwanted content and we've watched enough to register a skip signal
          if (unwantedScore > wantedScore && currentTime > 5 && currentTime < duration * 0.3) {
            skipSignals++;
          }

          // Micro-feedback: strong alignment → positive signal; blocked topic
          // watched partially → negative signal (both rate-limited).
          const pct = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;
          MicroFeedback.maybeAutoLike(videoId, topics, pct, profile);
          MicroFeedback.maybeAutoDislike(videoId, topics, pct, unwantedScore, wantedScore);
        }, 10000); // Check every 10 seconds
      };

      const stop = () => {
        monitoring = false;
        clearInterval(intervalId);
        intervalId = 0;
      };

      const getSkipCount = () => skipSignals;

      return { start, stop, isMonitoring: () => monitoring, getSkipCount };
    })();

    // ─── Channel Affinity ────────────────────────────────────────────────────
    // Channel-level learning: which creators you actually watch, a channel
    // blocklist, and the ability to signal interest in favorite channels.
    const ChannelAffinity = (() => {
      const blocked = new Set();

      const addBlocked = (c) => { const v = String(c || "").trim().toLowerCase(); if (v) blocked.add(v); };
      const removeBlocked = (c) => { blocked.delete(String(c || "").trim().toLowerCase()); };
      const isBlocked = (c) => blocked.has(String(c || "").trim().toLowerCase());
      const getBlocked = () => [...blocked];
      const getTopChannels = (limit = 8) => SignalTracker.getChannels(limit);

      // Browse the pages of your most-watched channels (strong interest signal).
      const boostTopChannels = async (max = 3) => {
        let done = 0;
        for (const ch of SignalTracker.getChannels(10)) {
          if (done >= max || !RateLimiter.canProceed("browse")) break;
          try {
            const ok = await SignalInjector.browseChannel(ch.channelId);
            if (ok) { done++; SignalTracker.trackWatch(ch.channelId, 1, 1); }
          } catch (_) {}
          await new Promise(r => setTimeout(r, 900 + Math.random() * 900));
        }
        return done;
      };

      return { addBlocked, removeBlocked, isBlocked, getBlocked, getTopChannels, boostTopChannels };
    })();

    // ─── Interest Booster ────────────────────────────────────────────────────
    // Proactive positive signals: periodically re-asserts your profile by
    // searching top topics, liking aligned recommendations, and browsing
    // favorite channels — reshaping the algorithm toward your interests.
    const InterestBooster = (() => {
      const runBoost = async (maxActions = 6) => {
        const profile = SignalTracker.getProfile();
        const topics = Object.entries(profile.topics).sort((a, b) => b[1] - a[1]).slice(0, 3).map(t => t[0]);
        if (!topics.length) return { searches: 0, likes: 0, browsed: 0, reason: "no profile yet" };

        let searches = 0;
        let likes = 0;
        let browsed = 0;
        let budget = Math.max(2, maxActions);

        // 1. Search the top profile topics (signals interest).
        for (const topic of topics) {
          if (budget <= 0) break;
          const keywords = TOPIC_TAXONOMY[topic] || [];
          const query = keywords[Math.floor(Math.random() * Math.min(4, keywords.length))] || topic;
          if (await SignalInjector.searchTopic(query)) {
            searches++;
            budget--;
          }
          await new Promise(r => setTimeout(r, 1100 + Math.random() * 1200));
        }

        // 2. Like recommendations that strongly match the profile.
        if (budget > 0) {
          try {
            const home = ProfileAnalyzer.analyzeHomepage();
            const topTopics = new Set(topics);
            for (const rec of home.recommendations) {
              if (budget <= 0) break;
              const recTopics = Object.entries(rec.topics).filter(([t, s]) => topTopics.has(t) && s >= 20);
              if (recTopics.length && rec.videoId && (SignalTracker.getProfile().topics[recTopics[0][0]] || 0) >= 35) {
                if (await SignalInjector.sendLike(rec.videoId, "like")) {
                  likes++;
                  budget--;
                }
                await new Promise(r => setTimeout(r, 1000 + Math.random() * 1200));
              }
            }
          } catch (_) {}
        }

        // 3. Browse a favorite channel.
        if (budget > 0 && RateLimiter.canProceed("browse")) {
          try {
            if (await ChannelAffinity.boostTopChannels(1)) browsed++;
          } catch (_) {}
        }

        return { searches, likes, browsed };
      };

      return { runBoost };
    })();

    // ─── Diversity Manager ───────────────────────────────────────────────────
    // Detects filter-bubble concentration (one topic dominating the feed) and
    // widens the recommendation space with exploratory signals from
    // underrepresented adjacent topics.
    const DiversityManager = (() => {
      const analyze = () => {
        const dist = ProfileAnalyzer.analyzeHomepage().topicDistribution;
        let total = 0;
        let dominant = "";
        let maxShare = 0;
        for (const [topic, share] of Object.entries(dist)) {
          total += share;
          if (share > maxShare) { maxShare = share; dominant = topic; }
        }
        return { dist, dominant, maxShare, count: Object.keys(dist).length };
      };

      const widen = async (max = 4) => {
        const profile = SignalTracker.getProfile();
        const known = new Set(Object.keys(profile.topics));
        const available = Object.keys(TOPIC_TAXONOMY).filter(t => !known.has(t));
        if (!available.length) return 0;
        // Shuffle and pick 2 underrepresented topics.
        for (let i = available.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [available[i], available[j]] = [available[j], available[i]];
        }
        let done = 0;
        for (const topic of available.slice(0, 2)) {
          if (done >= max) break;
          const keywords = TOPIC_TAXONOMY[topic] || [];
          const query = keywords[0] || topic;
          if (await SignalInjector.searchTopic(query)) done++;
          await new Promise(r => setTimeout(r, 1200 + Math.random() * 1500));
        }
        return done;
      };

      const maybeWiden = async () => {
        const a = analyze();
        const threshold = Math.max(45, Math.min(90, Number(S.algoDiversityMax) || 60));
        if (a.maxShare >= threshold && a.count >= 3) {
          const widened = await widen(2);
          if (widened > 0) {
            try { pe("Zen Algorithm: feed was too concentrated on '" + a.dominant + "' — widened your bubble.", 2800, "info"); } catch (_) {}
          }
          return widened;
        }
        return 0;
      };

      return { analyze, widen, maybeWiden };
    })();

    // ─── Micro Feedback ──────────────────────────────────────────────────────
    // Implicit signal inference: converts natural viewing behavior into
    // deliberate algorithm signals (auto-like aligned watches, auto-dislike
    // stray unwanted content), all rate-limited.
    const MicroFeedback = (() => {
      const maybeAutoLike = (videoId, topics, pct, profile) => {
        if (!videoId || !S.algoAutoLikeOn) return;
        if (pct < (Number(S.algoAutoLikePct) || 85)) return;
        if (SignalTracker.getStore().get().likeHistory[videoId]) return;
        const topTopic = Object.entries(topics).sort((a, b) => b[1] - a[1])[0];
        if (!topTopic) return;
        if ((profile.topics[topTopic[0]] || 0) >= 35) {
          SignalInjector.sendLike(videoId, "like");
        }
      };

      const maybeAutoDislike = (videoId, topics, pct, unwantedScore, wantedScore) => {
        if (!videoId || !S.algoAutoLikeOn) return;
        if (pct < 15 || pct > 60) return;
        if (SignalTracker.getStore().get().likeHistory[videoId]) return;
        if (unwantedScore > wantedScore && unwantedScore >= 25) {
          SignalInjector.sendLike(videoId, "dislike");
        }
      };

      return { maybeAutoLike, maybeAutoDislike };
    })();

    // ─── Shorts Signals ──────────────────────────────────────────────────────
    // Extends interest shaping to the Shorts feed: scans visible shorts and
    // sends "not interested" for content matching blocked topics/keywords.
    const ShortsSignals = (() => {
      const scan = async (max = 5) => {
        if (!location.pathname.startsWith("/shorts")) return { actions: 0, scanned: 0 };
        const items = Array.from(document.querySelectorAll("ytd-reel-video-renderer"));
        let actions = 0;
        for (const item of items.slice(0, 12)) {
          if (actions >= max) break;
          try {
            const titleEl = item.querySelector("#video-title, .ytLockupViewModelHostTitle, [title]");
            const title = (titleEl ? (titleEl.getAttribute("title") || titleEl.textContent || "") : "").trim();
            if (!title) continue;
            const topics = ContentClassifier.classify({ title, videoId: "" });
            let shouldBlock = false;
            let reason = "";
            for (const [topic, score] of Object.entries(topics)) {
              if (score >= 25 && NegativeSignalManager.getBlockedTopics().includes(topic)) {
                shouldBlock = true; reason = "topic: " + topic; break;
              }
            }
            if (!shouldBlock) {
              const low = title.toLowerCase();
              for (const kw of NegativeSignalManager.getBlockedKeywords()) {
                if (low.includes(kw)) { shouldBlock = true; reason = "keyword: " + kw; break; }
              }
            }
            if (!shouldBlock) continue;
            const token = extractTokenFromItem(item);
            if (token) {
              const ok = await SignalInjector.sendFeedback(token, "notInterested:" + reason);
              if (ok) actions++;
            }
            await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
          } catch (_) {}
        }
        return { actions, scanned: items.length };
      };

      // Extract a "not interested" feedback token from a shorts item's data.
      const extractTokenFromItem = (item) => {
        try {
          const dataStr = JSON.stringify(item.__data || "");
          const m = dataStr.match(/"feedbackToken":"([^"]+)"/);
          return m ? m[1] : "";
        } catch (_) { return ""; }
      };

      return { scan };
    })();

    // ─── Public API ──────────────────────────────────────────────────────────
    return {
      // Core
      RateLimiter,
      ContentClassifier,
      SignalTracker,
      SignalInjector,
      ProfileAnalyzer,
      TrainingEngine,
      NegativeSignalManager,
      WatchOptimizer,
      ChannelAffinity,
      InterestBooster,
      DiversityManager,
      MicroFeedback,
      ShortsSignals,

      // Convenience
      getProfile: () => SignalTracker.getProfile(),
      getChannels: (n) => SignalTracker.getChannels(n),
      getRecentSignals: (n) => SignalTracker.getRecentSignals(n),
      analyzeHomepage: () => ProfileAnalyzer.analyzeHomepage(),
      analyzeDiversity: () => DiversityManager.analyze(),
      findMismatches: () => ProfileAnalyzer.findMismatches(),
      train: (topics, opts) => TrainingEngine.startTraining(topics, opts),
      stopTraining: () => TrainingEngine.stopTraining(),
      blockTopic: (topic) => NegativeSignalManager.addBlockedTopic(topic),
      unblockTopic: (topic) => NegativeSignalManager.removeBlockedTopic(topic),
      blockKeyword: (kw) => NegativeSignalManager.addBlockedKeyword(kw),
      blockChannel: (c) => ChannelAffinity.addBlocked(c),
      unblockChannel: (c) => ChannelAffinity.removeBlocked(c),
      scanAndBlock: (max) => NegativeSignalManager.scanAndBlock(max),
      scanShorts: (max) => ShortsSignals.scan(max),
      boost: (max) => InterestBooster.runBoost(max),
      widen: (max) => DiversityManager.widen(max),
      maybeWiden: () => DiversityManager.maybeWiden(),
      clearSignalHistory: () => SignalTracker.clearHistory(),
      startMonitoring: () => WatchOptimizer.start(),
      stopMonitoring: () => WatchOptimizer.stop(),
      applyStrength: (level) => {
        const f = level === "light" ? 0.4 : level === "aggressive" ? 1.6 : 1;
        RateLimiter.setScale(f);
      },
      stats: () => ({
        profile: SignalTracker.getProfile(),
        channels: SignalTracker.getChannels(5),
        recentSignals: SignalTracker.getRecentSignals(8),
        rateLimits: {
          feedback: RateLimiter.getRemaining("feedback"),
          like: RateLimiter.getRemaining("like"),
          subscribe: RateLimiter.getRemaining("subscribe"),
          browse: RateLimiter.getRemaining("browse"),
          search: RateLimiter.getRemaining("search"),
        },
        training: TrainingEngine.getProgress(),
        monitoring: WatchOptimizer.isMonitoring(),
        skipSignals: WatchOptimizer.getSkipCount(),
        blockedTopics: NegativeSignalManager.getBlockedTopics(),
        blockedKeywords: NegativeSignalManager.getBlockedKeywords(),
        blockedChannels: ChannelAffinity.getBlocked(),
      }),
    };
  })();



  // ═══════════════════════════════════════════════════════════════════════════
  //  FEATURE REGISTRATIONS (14 features)
  // ═══════════════════════════════════════════════════════════════════════════

  const DISCOVER_CATEGORIES = {
    tech: { label: "Technology", query: "technology" },
    gaming: { label: "Gaming", query: "gaming" },
    science: { label: "Science", query: "science" },
    education: { label: "Education", query: "education" },
    music: { label: "Music", query: "music" },
    news: { label: "News", query: "news" },
    entertainment: { label: "Movies & TV", query: "movies and tv" },
    fitness: { label: "Fitness", query: "fitness workout" },
    finance: { label: "Finance", query: "personal finance" },
    cooking: { label: "Cooking", query: "cooking recipes" },
    travel: { label: "Travel", query: "travel" },
    diy: { label: "DIY & Crafts", query: "diy projects" },
    automotive: { label: "Automotive", query: "cars" },
  };
  const DISCOVER_DEFAULT_NICHE = ["tech", "gaming", "science"];
  // Relevance, then this week / this month / this year — enough variants to
  // always surface at least 10 never-watched picks per topic.
  const DISCOVER_SEARCH_SP = [null, "EgIIAw%3D%3D", "EgIIBA%3D%3D", "EgIIBQ%3D%3D"];
  const DISCOVER_MIN_TOPICS = 8;
  const DISCOVER_MIN_VIDEOS = 10;
  const DISCOVER_MAX_VIDEOS = 20;
  xa.register({
    id: "discover",
    name: "Discover",
    summary: "One unified discovery toggle: pick a niche (or step outside it) and browse fresh videos from 8+ categories. Every pick is filtered against your watch history, so nothing you have already seen is ever shown again.",
    masterKey: "discoverOn",
    keys: ["discoverOn"],
    apply(ctx) {
      if (!S.discoverOn) return;
      ZenEngine.injectCSS();
      ctx.addStyle(
        ".zen-disco-mode{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px}" +
        ".zen-disco-mode .zen-mode-btn{padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#ccc;font:600 10.5px system-ui;cursor:pointer;transition:all .12s}" +
        ".zen-disco-mode .zen-mode-btn:hover{background:rgba(255,255,255,.09)}" +
        ".zen-disco-mode .zen-mode-btn.active{background:rgba(255,61,127,.16);border-color:rgba(255,61,127,.35);color:#ff8aa5}" +
        ".zen-disco-grid{display:flex;gap:4px;flex-wrap:wrap;margin:2px 0 6px}" +
        ".zen-disco-grid .zen-topic-btn{padding:3px 9px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#ccc;font:600 10px system-ui;cursor:pointer;transition:all .12s}" +
        ".zen-disco-grid .zen-topic-btn:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.16)}" +
        ".zen-disco-grid .zen-topic-btn.active{background:rgba(255,61,127,.16);border-color:rgba(255,61,127,.35);color:#ff8aa5}"
      );
      const host = ZenDiscovery.discoveryHost(ctx);
      let api = null;
      let mode = "niche";
      let activeTopic = null;
      let grid = null;
      const sessionShown = new Set();
      // Categories shown for the current mode. "My niche" ranks your watch
      // genome, pads to at least 8, and "Outside my niche" is everything else
      // (13 minus your top 3 = 10). The set is dynamic: it follows your genome.
      const topicsForMode = () => {
        let ranked = [];
        try {
          const words = ZenSession.genome.getTopTopics(12);
          if (words.length) {
            const scores = AlgoEngine.ContentClassifier.classify({ title: words.join(" ") });
            ranked = Object.entries(scores || {}).sort((a, b) => b[1] - a[1]).map(e => e[0]);
          }
        } catch (_) {}
        const top = ranked.slice(0, 3).length ? ranked.slice(0, 3) : DISCOVER_DEFAULT_NICHE.slice();
        const all = Object.keys(DISCOVER_CATEGORIES);
        if (mode === "outside") return all.filter(k => !top.includes(k));
        const niche = top.slice();
        for (const k of all) {
          if (niche.length >= DISCOVER_MIN_TOPICS) break;
          if (!niche.includes(k)) niche.push(k);
        }
        return niche.slice(0, DISCOVER_MIN_TOPICS);
      };
      // A video counts as watched when a row exists in the always-on local
      // history store, so picks never repeat anything you have already seen.
      const isWatched = async (videoId) => {
        try { return !!(await v("history", videoId)); } catch (_) { return false; }
      };
      const fetchFresh = async (category) => {
        const spec = DISCOVER_CATEGORIES[category];
        if (!spec) return [];
        const fresh = [];
        const seen = new Set();
        for (const sp of DISCOVER_SEARCH_SP) {
          if (fresh.length >= DISCOVER_MIN_VIDEOS) break;
          let list = [];
          try { list = await ZenSearch.search(spec.query, sp); } catch (_) {}
          for (const video of list) {
            if (!video || !video.videoId || seen.has(video.videoId) || sessionShown.has(video.videoId)) continue;
            if (await isWatched(video.videoId)) continue;
            seen.add(video.videoId);
            fresh.push(video);
          }
        }
        return fresh.slice(0, DISCOVER_MAX_VIDEOS);
      };
      const renderGrid = () => {
        if (!grid) return;
        grid.replaceChildren();
        for (const key of topicsForMode()) {
          const spec = DISCOVER_CATEGORIES[key];
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "zen-topic-btn" + (activeTopic === key ? " active" : "");
          btn.textContent = spec.label;
          btn.addEventListener("click", () => {
            if (activeTopic === key) { api.refresh(true); return; }
            activeTopic = key;
            load();
          });
          grid.appendChild(btn);
        }
      };
      function load() {
        if (!api) return;
        const key = activeTopic;
        if (!key) {
          api.status("Pick a topic above to browse fresh videos you haven't watched.");
          api.clear();
          return;
        }
        const spec = DISCOVER_CATEGORIES[key];
        renderGrid();
        api.clear();
        api.status("Loading " + spec.label + "…");
        fetchFresh(key).then(videos => {
          if (activeTopic !== key) return;
          api.clear();
          if (!videos.length) {
            api.status("Nothing fresh found for " + spec.label + ". Try another topic.");
            return;
          }
          videos.forEach(video => {
            sessionShown.add(video.videoId);
            api.list.appendChild(ZenDiscovery.createVideoRow(
              video.videoId,
              video.title,
              video.channel,
              () => { e.location.href = "/watch?v=" + video.videoId; },
              null,
              true,
            ));
          });
          api.status("Showing " + videos.length + " never-watched picks from " + spec.label);
        }).catch(() => {
          if (activeTopic === key) { api.clear(); api.status("Search failed. Try again."); }
        });
      }
      api = host.addSection("discover", "Discover", load);
      api.button("Surprise me", "primary", () => {
        const candidates = Object.keys(DISCOVER_CATEGORIES).filter(k => k !== activeTopic);
        if (!candidates.length) return;
        activeTopic = candidates[Math.floor(Math.random() * candidates.length)];
        load();
      });
      // Mode toggle + topic grid sit above the status line inside the section.
      const ensureUi = () => {
        if (grid || !api.body) return;
        const modeRow = document.createElement("div");
        modeRow.className = "zen-disco-mode";
        const nicheBtn = document.createElement("button");
        nicheBtn.type = "button";
        nicheBtn.className = "zen-mode-btn active";
        nicheBtn.textContent = "My niche";
        const outsideBtn = document.createElement("button");
        outsideBtn.type = "button";
        outsideBtn.className = "zen-mode-btn";
        outsideBtn.textContent = "Outside my niche";
        const setMode = (next) => {
          mode = next;
          nicheBtn.classList.toggle("active", next === "niche");
          outsideBtn.classList.toggle("active", next === "outside");
          activeTopic = null;
          renderGrid();
          load();
        };
        nicheBtn.addEventListener("click", () => setMode("niche"));
        outsideBtn.addEventListener("click", () => setMode("outside"));
        modeRow.append(nicheBtn, outsideBtn);
        grid = document.createElement("div");
        grid.className = "zen-disco-grid";
        api.body.prepend(grid);
        api.body.prepend(modeRow);
        renderGrid();
      };
      // Freshness is enforced against the always-on local history store, so
      // picks never repeat anything already seen, even before this toggle.
      ctx.onNav(() => { ensureUi(); host.refresh("discover"); });
      ctx.addTimeout(() => {
        ensureUi();
        load();
      }, 0);
      Yt["discover"].push(() => api.destroy());
    },
    settings(en) {
      en.appendChild(Io("Enable Discover", "discoverOn"));
      en.appendChild(To("div", "ytp-discover-note",
        "One toggle for discovery. Browse 8+ categories inside or outside your niche; every pick is filtered against your watch history and never repeats a video you have already seen."));
    } });

  xa.register({ id: "smart-speed", name: "Smart Speed", summary: "Premium-style adaptive speed: audio-driven detection of speech, silence, and slow segments with smooth ramping to reclaim wasted time. Always reverts to normal speed during speech, never fights manual overrides, and stays off live streams.", masterKey: "smartSpeedOn", keys: ["smartSpeedOn", "smartSpeedBase", "smartSpeedFast", "smartSpeedSilence", "smartSpeedRamp"],
    apply(ctx) {
      if (!S.smartSpeedOn) return;
      const baseRate = Math.min(1.5, Math.max(0.5, Number(S.smartSpeedBase) || 1));
      const fastRate = Math.min(3, Math.max(baseRate, Number(S.smartSpeedFast) || 1.5));
      const silenceRate = Math.min(3.5, Math.max(fastRate, Number(S.smartSpeedSilence) || 1.75));
      const rampStep = Math.max(0.05, Math.min(0.3, Number(S.smartSpeedRamp) || 0.1));
      let lastTarget = 0;
      let state = "idle";
      let stateSince = 0;
      let catchup = 0;
      const clampRate = (r) => Math.max(0.25, Math.min(4, r));
      const applyRate = (vid, target) => { if (Math.abs(vid.playbackRate - target) > 0.05) { vid.playbackRate = target; lastTarget = target; } };
      const tick = (now) => {
        const vid = ie.el();
        if (!vid || vid.paused || vid.ended || document.hidden) return;
        if (_isLiveStream()) { if (Math.abs(vid.playbackRate - baseRate) > 0.05) applyRate(vid, baseRate); return; }
        if (state === "manual") return;
        // Manual override: if the rate deviates from the last one Smart
        // Speed applied (or seeded at start), the user took control — yield.
        if (lastTarget && Math.abs(vid.playbackRate - lastTarget) > 0.12) { state = "manual"; return; }
        const a = ZenPlayback.readEnergy(vid);
        if (!a.active) return;
        const t = now || Date.now();
        if (state === "idle") { state = "listening"; stateSince = t; }
        const inState = (t - stateSince) / 1000;
        let desired = baseRate;
        if (a.isSpeech) {
          desired = baseRate;
          if (inState > 4 && catchup > 0.75) desired = Math.min(fastRate, baseRate + Math.min(0.15, catchup * 0.05));
        } else if (a.isQuiet) {
          desired = silenceRate;
        } else {
          desired = fastRate;
        }
        const nextState = desired === baseRate ? "speech" : desired === silenceRate ? "silence" : "fast";
        if (nextState !== state) {
          if (inState < 1.2) return;
          state = nextState;
          stateSince = t;
        }
        catchup = Math.min(20, catchup + Math.max(0, vid.playbackRate - baseRate) * 0.5);
        const next = clampRate(desired);
        const cur = vid.playbackRate;
        if (Math.abs(cur - next) > 0.05) {
          const step = cur < next ? rampStep : rampStep * 1.5;
          applyRate(vid, cur < next ? Math.min(next, cur + step) : Math.max(next, cur - step));
        }
      };
      const start = () => {
        const vid = ie.el();
        if (vid) {
          ctx.addInterval(() => tick(), 700);
          ctx.onNav(() => {
            lastTarget = (ie.el() && ie.el().playbackRate) || 0;
            state = "idle";
            catchup = 0;
          });
          if (!ctx._zenSpeedStarted) {
            ctx._zenSpeedStarted = true;
            ctx.addListener(vid, "play", () => ctx.addTimeout(() => tick(), 250));
            ctx.addListener(vid, "ratechange", () => {
              // Any rate the user sets manually (hotkey, menu, memory)
              // permanently switches Smart Speed to manual — it never
              // fights an explicit override. Our own applyRate sets
              // lastTarget synchronously, so self-ramps never trip this.
              if (state === "manual") return;
              if (lastTarget && Math.abs(vid.playbackRate - lastTarget) > 0.12) state = "manual";
            });
          }
          lastTarget = vid.playbackRate || 0;
        }
      };
      ZenEngine.scheduleOnReady(ctx, start, { attempts: 8, delayMs: 400 });
      Yt["smart-speed"].push(() => {
        const vid = ie.el();
        if (vid && lastTarget) { vid.playbackRate = S.speedDefault || 1; lastTarget = 0; }
        ZenPlayback.release(vid);
      });
    },
    settings(en) {
      en.appendChild(Io("Enable Smart Speed", "smartSpeedOn"));
      en.appendChild(No("Normal speed (speech)", "smartSpeedBase", 0.5, 1.5, 0.05, v => v.toFixed(2) + "x"));
      en.appendChild(No("Boost speed (ambient)", "smartSpeedFast", 1.25, 3, 0.05, v => v.toFixed(2) + "x"));
      en.appendChild(No("Silence speed (gaps)", "smartSpeedSilence", 1.25, 3.5, 0.05, v => v.toFixed(2) + "x"));
      en.appendChild(No("Ramp step per tick", "smartSpeedRamp", 0.05, 0.3, 0.05, v => v.toFixed(2) + "x"));
    } });
  xa.register({ id: "credibility-layer", name: "Credibility Layer", summary: "Context signals on results: reach level, age badges. Context, not judgment.", masterKey: "credLayerOn", keys: ["credLayerOn"],
    apply(ctx) {
      if (!S.credLayerOn) return;
      ZenEngine.injectCSS();
      const processCards = () => {
        document.querySelectorAll("ytd-video-renderer, ytd-compact-video-renderer, ytd-rich-item-renderer").forEach(card => {
          if (card.dataset.zenCred) return;
          card.dataset.zenCred = "1";
          const info = ZenSearch.analyzeCredibility(card);
          if (!info || info.reach === "unknown") return;
          const meta = card.querySelector("#metadata-line");
          if (!meta) return;
          const badge = document.createElement("span");
          badge.className = "zen-cred-badge";
          if (info.reach === "high") {
            badge.style.cssText = "background:rgba(76,175,80,.15);color:#81c784";
            badge.textContent = "High reach";
          } else if (info.reach === "growing") {
            badge.style.cssText = "background:rgba(255,193,7,.12);color:#ffd54f";
            badge.textContent = "Growing";
          } else {
            badge.style.cssText = "background:rgba(33,150,243,.12);color:#64b5f6";
            badge.textContent = "Emerging";
          }
          meta.appendChild(badge);
          if (info.age && info.age > 730) {
            const ab = document.createElement("span");
            ab.className = "zen-cred-badge";
            ab.style.cssText = "background:rgba(255,152,0,.12);color:#ffb74d";
            ab.textContent = Math.floor(info.age / 365) + "y old";
            ab.title = "Over 2 years old. May be outdated.";
            meta.appendChild(ab);
          }
        });
      };
      ctx.addTimeout(processCards, 0);
      ctx.onNav(() => ctx.addTimeout(processCards, 0));
      ctx.addObserver(document.body, () => { ctx.addTimeout(processCards, 0); }, { childList: true, subtree: true });
      Yt["credibility-layer"].push(() => {});
    },
    settings(en) { en.appendChild(Io("Enable Credibility Layer", "credLayerOn")); } });

  xa.register({ id: "search-remix", name: "Search Remix", summary: "One-click search filters: duration, date, quality, format.", masterKey: "searchRemixOn", keys: ["searchRemixOn"],
    apply(ctx) {
      if (!S.searchRemixOn || !location.pathname.startsWith("/results")) return;
      ZenEngine.injectCSS();
      const bar = document.createElement("div");
      bar.id = "ytp-zen-bar";
      bar.style.cssText = "display:flex;gap:4px;flex-wrap:wrap;padding:6px 16px";
      const query = new URLSearchParams(location.search).get("search_query") || "";
      ZenSearch.REMIX_TEMPLATES.forEach(r => {
        const chip = document.createElement("button");
        chip.className = "zen-chip";
        chip.textContent = r.label;
        chip.title = r.desc;
        chip.addEventListener("click", () => {
          const url = new URL("/results", location.origin);
          url.searchParams.set("search_query", query);
          url.searchParams.set("sp", r.sp);
          e.location.href = url.toString();
        });
        bar.appendChild(chip);
      });
      const insert = () => {
        if (bar.parentNode) return true;
        const target = document.querySelector("ytd-section-list-renderer");
        if (!target) return false;
        target.parentNode.insertBefore(bar, target);
        return true;
      };
      ZenEngine.scheduleOnReady(ctx, insert, { attempts: 8, delayMs: 400 });
      Yt["search-remix"].push(() => { if (bar.parentNode) bar.remove(); });
    },
    settings(en) { en.appendChild(Io("Enable Search Remix", "searchRemixOn")); } });

  xa.register({ id: "dead-link-detector", name: "Outdated Content Detector", summary: "Adds age badges to old videos so you can spot potentially outdated content.", masterKey: "deadLinkOn", keys: ["deadLinkOn"],
    apply(ctx) {
      if (!S.deadLinkOn) return;
      ZenEngine.injectCSS();
      const check = () => {
        const ud = document.querySelector("#info-strings yt-formatted-string, ytd-video-primary-info-renderer #info span");
        if (!ud || ud.dataset.zenChecked) return;
        ud.dataset.zenChecked = "1";
        const dm = (ud.textContent || "").match(/(\w+ \d+, \d{4})/);
        if (!dm) return;
        const age = Date.now() - new Date(dm[1]).getTime();
        if (age <= 365 * 24 * 60 * 60 * 1000 * 2) return;
        const badge = document.createElement("span");
        badge.className = "zen-pill";
        badge.style.cssText = "background:rgba(255,152,0,.15);color:#ffb74d;margin-left:8px";
        badge.textContent = Math.floor(age / (365 * 24 * 60 * 60 * 1000)) + " years old";
        badge.title = "Over 2 years old. May be outdated.";
        const info = document.querySelector("#info-strings, #info");
        if (info) info.appendChild(badge);
      };
      ZenEngine.scheduleOnReady(ctx, check, { attempts: 8, delayMs: 600 });
      Yt["dead-link-detector"].push(() => {});
    },
    settings(en) { en.appendChild(Io("Enable Outdated Content Detector", "deadLinkOn")); } });

  xa.register({ id: "watch-genome", name: "Watch Genome", summary: "Transparent preference model. Shows compatibility scores on thumbnails.", masterKey: "watchGenomeOn", keys: ["watchGenomeOn"],
    apply(ctx) {
      if (!S.watchGenomeOn) return;
      ZenEngine.injectCSS();
      const channelInfo = () => {
        let channelId = "", handle = "", channelName = "";
        try {
          const link = document.querySelector("ytd-watch-metadata #channel-name a, #owner ytd-channel-name a, ytd-video-secondary-info-renderer a[href*=\"/channel/\"]");
          if (link) {
            const href = link.getAttribute("href") || "";
            const idMatch = href.match(/\/channel\/(UC[\w-]+)/);
            const handleMatch = href.match(/\/@([^/?#]+)/);
            if (idMatch) channelId = idMatch[1];
            if (handleMatch) handle = handleMatch[1];
          }
          const nameEl = document.querySelector("ytd-watch-metadata #channel-name, #owner ytd-channel-name");
          channelName = nameEl ? (nameEl.textContent || "").trim() : "";
          const subsEl = document.querySelector("#owner-sub-count, ytd-video-secondary-info-renderer #owner-sub-count");
          const subsMatch = subsEl && (subsEl.textContent || "").match(/([\d,.]+[KMB]?)/);
          if (subsMatch) {
            ZenSession.genome.recordSubscribers(handle, channelName, ZenSearch.parseCount(subsMatch[1]));
          }
        } catch (_) {}
        return { channelId, handle, channelName };
      };
      const recordCurrent = () => {
        const vid = ie.videoId();
        if (!vid) return;
        const info = channelInfo();
        ZenSession.genome.record({
          videoId: vid,
          topic: ie.title(),
          channelId: info.channelId || undefined,
          handle: info.handle || undefined,
          channelName: info.channelName || undefined,
          duration: ie.el() && ie.el().duration,
        });
        return true;
      };
      ZenEngine.scheduleOnReady(ctx, recordCurrent, { attempts: 6, delayMs: 800 });
      ctx.onNav(() => ctx.addTimeout(() => { try { recordCurrent(); } catch (e) {} }, 1200));
      const showScores = () => {
        document.querySelectorAll("ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer").forEach(card => {
          if (card.dataset.zenGenome) return;
          const link = card.querySelector("a[href*=\"/watch?v=\"]");
          const channelLink = card.querySelector("a[href*=\"/channel/\"], a[href*=\"/@\"]");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          const idMatch = href.match(/[?&]v=([A-Za-z0-9_-]{11})/);
          if (!idMatch) return;
          const chHref = channelLink ? (channelLink.getAttribute("href") || "") : "";
          const cid = (chHref.match(/\/channel\/(UC[\w-]+)/) || [])[1] || "";
          const chandle = (chHref.match(/\/@([^/?#]+)/) || [])[1] || "";
          const title = (card.querySelector("#video-title, a#video-title") || {}).textContent || "";
          const score = ZenSession.genome.score({
            channelId: cid || undefined,
            handle: chandle || undefined,
            title,
            duration: ZenSearch.parseDurationSec((card.querySelector("ytd-thumbnail-overlay-time-status-renderer span") || {}).textContent),
          });
          card.dataset.zenGenome = "1";
          const badge = document.createElement("span");
          badge.className = "zen-pill";
          badge.style.cssText = "position:absolute;top:4px;right:4px;z-index:5;" + (score > 70 ? "background:rgba(76,175,80,.2);color:#81c784" : score > 40 ? "background:rgba(255,193,7,.15);color:#ffd54f" : "background:rgba(158,158,158,.15);color:#bdbdbd");
          badge.textContent = score + "% match";
          badge.title = "Estimated from your watch history";
          const thumb = card.querySelector("ytd-thumbnail");
          if (thumb) {
            thumb.style.position = "relative";
            thumb.appendChild(badge);
          }
        });
      };
      ctx.addTimeout(showScores, 0);
      ctx.onNav(() => ctx.addTimeout(showScores, 0));
      Yt["watch-genome"].push(() => {});
    },
    settings(en) {
      en.appendChild(Io("Enable Watch Genome", "watchGenomeOn"));
      const snap = ZenSession.genome.snapshot();
      const info = document.createElement("div");
      info.className = "zen-meta";
      info.style.cssText = "margin-top:6px;padding:8px;background:rgba(255,255,255,.03);border-radius:6px";
      info.textContent = "Sessions: " + (snap.sessions || 0) + " | Topics: " + (ZenSession.genome.getTopTopics(3).join(", ") || "none") + " | Length: " + ZenSession.genome.getLengthPref();
      en.appendChild(info);
      en.appendChild(Oo("Reset genome", () => { ZenSession.genome.reset(); pe("Watch genome reset.", 1500, "success"); }, "ytp-danger"));
    } });

  xa.register({ id: "curated-collections", name: "Curated Collections", summary: "Themed video collections with descriptions and progress tracking.", masterKey: "collectionsOn", keys: ["collectionsOn"],
    apply(ctx) {
      if (!S.collectionsOn) return;
      ZenEngine.injectCSS();
      const vid = ie.videoId();
      if (!vid) return;
      const panel = document.createElement("div");
      panel.id = "ytp-zen-collections";
      panel.className = "zen-card";
      panel.style.cssText = "margin:8px 0";
      const rebuild = () => {
        const cols = ZenSession.collections.list();
        let html = '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:6px">Add to Collection</div><div class="zen-row" style="flex-wrap:wrap;gap:4px">';
        cols.forEach(c => {
          html += '<button class="zen-btn" data-col="' + zenEscapeHtml(c.id) + '">' + zenEscapeHtml(c.name) + ' (' + c.videos.length + ')</button>';
        });
        html += '<button class="zen-btn primary" id="ytp-zen-col-new">+ New</button></div>';
        panel.innerHTML = html;
      };
      rebuild();
      const insert = () => {
        if (panel.parentNode) return true;
        const below = document.querySelector("#below") || document.querySelector("#description");
        if (!below) return false;
        below.appendChild(panel);
        return true;
      };
      ZenEngine.scheduleOnReady(ctx, insert, { attempts: 8, delayMs: 500 });
      panel.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-col]");
        if (btn) {
          ZenSession.collections.addVideo(btn.dataset.col, { videoId: vid, title: ie.title() || vid });
          pe("Added to collection.", 1500, "success");
          rebuild();
        }
        if (ev.target.id === "ytp-zen-col-new") {
          const name = prompt("Collection name:");
          if (name) {
            ZenSession.collections.create(name);
            pe("Created: " + name, 1500, "success");
            rebuild();
          }
        }
      });
      Yt["curated-collections"].push(() => { if (panel.parentNode) panel.remove(); });
    },
    settings(en) {
      en.appendChild(Io("Enable Curated Collections", "collectionsOn"));
      const cols = ZenSession.collections.list();
      if (cols.length) {
        const list = document.createElement("div");
        list.style.cssText = "margin-top:6px;font-size:11px;color:#aaa";
        cols.forEach(c => {
          list.innerHTML += '<div style="padding:2px 0">' + zenEscapeHtml(c.name) + ' (' + c.videos.length + ' videos)</div>';
        });
        en.appendChild(list);
      }
    } });

  xa.register({ id: "time-budget", name: "Time Budget Manager", summary: "Set a session time budget. Tracks usage and suggests wrapping up.", masterKey: "timeBudgetOn", keys: ["timeBudgetOn", "timeBudgetMinutes"],
    apply(ctx) {
      if (!S.timeBudgetOn) return;
      ZenEngine.injectCSS();
      ZenSession.budget.setBudget(S.timeBudgetMinutes || 60);
      let barEl = null;
      const updateBar = () => {
        if (!barEl) return;
        const budgetSec = ZenSession.budget.getBudget() * 60;
        const used = ZenSession.budget.getUsed();
        const pct = budgetSec > 0 ? Math.min(100, (used / budgetSec) * 100) : 0;
        const remain = ZenSession.budget.getRemaining();
        const fill = barEl.querySelector(".zen-budget-fill");
        const label = barEl.querySelector(".zen-budget-label");
        if (fill) { fill.style.width = pct + "%"; fill.style.background = pct < 60 ? "#4caf50" : pct < 85 ? "#ffc107" : "#ff5722"; }
        if (label) label.textContent = ce(Math.floor(remain)) + " remaining of " + ZenSession.budget.getBudget() + " min";
      };
      const tick = () => {
        const vid = ie.el();
        if (vid && !vid.paused && !vid.ended && !document.hidden) ZenSession.budget.tick(2);
        updateBar();
      };
      const renderBar = () => {
        if (barEl) barEl.remove();
        barEl = document.createElement("div");
        barEl.id = "ytp-zen-budget";
        barEl.innerHTML = '<span class="zen-budget-label">--</span><div class="zen-budget-track"><div class="zen-budget-fill"></div></div><button class="zen-btn" id="ytp-zen-budget-close">End session</button>';
        document.body.appendChild(barEl);
        barEl.querySelector("#ytp-zen-budget-close").addEventListener("click", () => {
          Ta("timeBudgetOn", false);
          xa.apply("time-budget");
        });
        updateBar();
      };
      const insert = () => {
        if (barEl && barEl.parentNode) return true;
        if (!document.body) return false;
        renderBar();
        return true;
      };
      ZenEngine.scheduleOnReady(ctx, insert, { attempts: 6, delayMs: 300 });
      ctx.addInterval(tick, 2000);
      Yt["time-budget"].push(() => { if (barEl) { barEl.remove(); barEl = null; } });
    },
    settings(en) {
      en.appendChild(Io("Enable Time Budget Manager", "timeBudgetOn"));
      en.appendChild(No("Session budget", "timeBudgetMinutes", 15, 240, 5, v => v + " minutes"));
      const info = document.createElement("div");
      info.className = "zen-meta";
      info.style.marginTop = "6px";
      info.textContent = "Used today: " + ce(Math.floor(ZenSession.budget.getUsed()));
      en.appendChild(info);
    } });

  // ─── Algorithm Intelligence Feature (V2: full-spectrum) ────────────────────
  xa.register({
    id: "algo-intelligence",
    name: "Algorithm Intelligence",
    summary: "Full-spectrum recommendation algorithm manipulation: watch profiling with recency decay, channel affinity, interest boosting, filter-bubble diversity management, micro-feedback (auto like/dislike), Shorts feed shaping, negative-signal scanning, training sessions, and an aggression dial — all using organic, rate-limited signals.",
    masterKey: "algoIntelligenceOn",
    keys: ["algoIntelligenceOn", "algoAutoTrain", "algoBlockTopics", "algoBlockKeywords", "algoBlockChannels", "algoScanInterval", "algoStrength", "algoBoostOn", "algoBoostInterval", "algoDiversityOn", "algoDiversityMax", "algoAutoLikeOn", "algoAutoLikePct", "algoShortsOn"],
    apply(ctx) {
      if (!S.algoIntelligenceOn) {
        AlgoEngine.stopMonitoring();
        return;
      }

      // Strength dial scales every signal rate limit.
      AlgoEngine.applyStrength(S.algoStrength || "balanced");

      // Start watch optimizer (monitors playback and tracks signals)
      AlgoEngine.startMonitoring();
      Yt["algo-intelligence"].push(() => AlgoEngine.stopMonitoring());

      // Parse blocked topics / keywords / channels from settings
      for (const t of String(S.algoBlockTopics || "").split(/[,;\n]+/)) {
        const trimmed = t.trim().toLowerCase();
        if (trimmed) AlgoEngine.blockTopic(trimmed);
      }
      for (const kw of String(S.algoBlockKeywords || "").split(/[,;\n]+/)) {
        const trimmed = kw.trim().toLowerCase();
        if (trimmed) AlgoEngine.blockKeyword(trimmed);
      }
      for (const c of String(S.algoBlockChannels || "").split(/[,;\n]+/)) {
        const trimmed = c.trim().toLowerCase();
        if (trimmed) AlgoEngine.blockChannel(trimmed);
      }

      const scanInterval = Math.max(30, Number(S.algoScanInterval) || 120) * 1000;

      // Periodic negative-signal scanning (mismatch cleanup)
      if (S.algoAutoTrain) {
        const doScan = async () => {
          if (document.hidden || _a()) return;
          try { await AlgoEngine.scanAndBlock(10); } catch (_) {}
        };
        ctx.addTimeout(doScan, 5000);
        ctx.addInterval(doScan, scanInterval);
      }

      // Interest boosting: re-assert top interests at a configurable cadence.
      if (S.algoBoostOn) {
        const boostInterval = Math.max(10, Number(S.algoBoostInterval) || 20) * 60 * 1000;
        const doBoost = async () => {
          if (document.hidden || _a()) return;
          if (!location.pathname.startsWith("/shorts")) {
            try { await AlgoEngine.boost(6); } catch (_) {}
          }
        };
        ctx.addTimeout(doBoost, 30000);
        ctx.addInterval(doBoost, boostInterval);
      }

      // Diversity management: widen a concentrated feed.
      if (S.algoDiversityOn) {
        const doDiversity = async () => {
          if (document.hidden || _a()) return;
          try { await AlgoEngine.maybeWiden(); } catch (_) {}
        };
        ctx.addTimeout(doDiversity, 45000);
        ctx.addInterval(doDiversity, scanInterval * 2);
      }

      // Shorts feed shaping.
      if (S.algoShortsOn) {
        const doShorts = async () => {
          if (document.hidden) return;
          try { await AlgoEngine.scanShorts(5); } catch (_) {}
        };
        ctx.addTimeout(doShorts, 8000);
        ctx.addInterval(doShorts, scanInterval);
      }
    },
    settings(en) {
      en.appendChild(Io("Enable Algorithm Intelligence", "algoIntelligenceOn"));
      en.appendChild(Ro("Signal strength", "algoStrength", {
        light: "Light — gentle, minimal signals",
        balanced: "Balanced (recommended) — natural pacing",
        aggressive: "Aggressive — maximum reshaping speed",
      }));
      en.appendChild(Io("Auto-scan and block mismatched recommendations", "algoAutoTrain"));
      en.appendChild(No("Scan interval (seconds)", "algoScanInterval", 30, 600, 10, v => v + "s"));
      en.appendChild(Io("Auto-boost your top interests (searches + likes)", "algoBoostOn"));
      en.appendChild(No("Boost interval (minutes)", "algoBoostInterval", 10, 120, 5, v => v + "m"));
      en.appendChild(Io("Widen feed when one topic dominates (anti filter-bubble)", "algoDiversityOn"));
      en.appendChild(No("Diversity trigger (dominant topic %)", "algoDiversityMax", 45, 90, 5, v => v + "%"));
      en.appendChild(Io("Auto-like strongly-aligned watches", "algoAutoLikeOn"));
      en.appendChild(No("Auto-like at watch %", "algoAutoLikePct", 50, 100, 5, v => v + "%"));
      en.appendChild(Io("Shape the Shorts feed too", "algoShortsOn"));
      en.appendChild(Ho(
        "Blocked topics (comma-separated)",
        "algoBlockTopics",
        "gaming, news, entertainment"
      ));
      en.appendChild(Ho(
        "Blocked keywords (comma-separated)",
        "algoBlockKeywords",
        "drama, clickbait, reaction"
      ));
      en.appendChild(Ho(
        "Blocked channels (comma-separated)",
        "algoBlockChannels",
        ""
      ));

      // Live profile display
      const profileDiv = document.createElement("div");
      profileDiv.className = "ytp-hist-note";
      profileDiv.style.cssText = "margin-top:8px;padding:8px;background:rgba(255,255,255,.03);border-radius:6px";
      const updateProfile = () => {
        const p = AlgoEngine.getProfile();
        const topicEntries = Object.entries(p.topics || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
        let html = "<strong>Your Algorithm Profile</strong><br>";
        html += "Videos: " + p.totalWatched + " | Avg watch: " + p.avgWatchPct + "% | Signals: " + p.sessionSignals;
        const chans = AlgoEngine.getChannels(3);
        if (chans.length) html += " | Top channel: " + zenEscapeHtml(chans[0].name || "?") + " (" + chans[0].count + ")";
        html += "<br>";
        if (topicEntries.length) {
          html += "Top topics: ";
          html += topicEntries.map(([t, s]) => zenEscapeHtml(t) + " (" + s + "%)").join(", ");
        } else {
          html += "Watch some videos to build your profile.";
        }
        const d = AlgoEngine.analyzeDiversity();
        if (d && d.dominant) html += "<br>Feed focus: " + zenEscapeHtml(d.dominant) + " at " + d.maxShare + "% of recommendations";
        profileDiv.innerHTML = html;
      };
      updateProfile();
      en.appendChild(profileDiv);

      // Action buttons
      const actions = document.createElement("div");
      actions.className = "ytp-rowb";
      actions.style.marginTop = "8px";

      const scanBtn = Oo("Scan & Block Now", async () => {
        scanBtn.disabled = true;
        scanBtn.textContent = "Scanning...";
        try {
          const result = await AlgoEngine.scanAndBlock(15);
          pe("Blocked " + result.actions + " of " + result.scanned + " mismatched recommendations.", 3000, "success");
        } catch (_) {
          pe("Scan failed.", 2000, "error");
        }
        scanBtn.disabled = false;
        scanBtn.textContent = "Scan & Block Now";
        updateProfile();
      }, "primary");

      const boostBtn = Oo("Boost Interests", async () => {
        boostBtn.disabled = true;
        boostBtn.textContent = "Boosting...";
        try {
          const r = await AlgoEngine.boost(6);
          pe("Boost sent: " + r.searches + " searches, " + r.likes + " likes, " + r.browsed + " channel visits.", 3000, "success");
        } catch (_) {
          pe("Boost failed.", 2000, "error");
        }
        boostBtn.disabled = false;
        boostBtn.textContent = "Boost Interests";
        updateProfile();
      });

      const widenBtn = Oo("Widen Bubble", async () => {
        widenBtn.disabled = true;
        widenBtn.textContent = "Widening...";
        try {
          const n = await AlgoEngine.widen(4);
          pe("Explored " + n + " new topics outside your bubble.", 3000, "success");
        } catch (_) {
          pe("Widen failed.", 2000, "error");
        }
        widenBtn.disabled = false;
        widenBtn.textContent = "Widen Bubble";
        updateProfile();
      });

      const shortsBtn = Oo("Scan Shorts", async () => {
        shortsBtn.disabled = true;
        shortsBtn.textContent = "Scanning shorts...";
        try {
          const r = await AlgoEngine.scanShorts(5);
          pe("Shorts: blocked " + r.actions + " of " + r.scanned + " visible shorts.", 3000, "success");
        } catch (_) {
          pe("Shorts scan failed.", 2000, "error");
        }
        shortsBtn.disabled = false;
        shortsBtn.textContent = "Scan Shorts";
      });

      const analyzeBtn = Oo("Analyze Feed", () => {
        const analysis = AlgoEngine.analyzeHomepage();
        const mismatches = AlgoEngine.findMismatches();
        const div = AlgoEngine.analyzeDiversity();
        let msg = "Feed analysis: " + analysis.count + " recommendations. ";
        msg += "Topic distribution: " + Object.entries(analysis.topicDistribution).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, s]) => t + " " + s + "%").join(", ");
        msg += ". Mismatches: " + mismatches.length;
        if (div && div.dominant) msg += ". Most concentrated topic: " + div.dominant + " (" + div.maxShare + "%)";
        pe(msg, 6000, "info");
      });

      const resetBtn = Oo("Reset Signal History", () => {
        AlgoEngine.clearSignalHistory();
        pe("Algorithm signal history cleared.", 2000, "success");
        updateProfile();
      });

      actions.appendChild(scanBtn);
      actions.appendChild(boostBtn);
      actions.appendChild(widenBtn);
      actions.appendChild(shortsBtn);
      actions.appendChild(analyzeBtn);
      actions.appendChild(resetBtn);
      en.appendChild(actions);

      // Recent signal activity log
      const logDiv = document.createElement("div");
      logDiv.className = "ytp-hist-note";
      logDiv.style.cssText = "margin-top:6px;padding:6px 8px;background:rgba(255,255,255,.02);border-radius:6px;font-size:10.5px;color:#999";
      const updateLog = () => {
        const events = AlgoEngine.getRecentSignals(6);
        logDiv.textContent = "Recent signals: " + (events.length ? events.map(ev => ev.type + (ev.pct !== undefined ? " " + ev.pct + "%" : "")).join(" · ") : "none yet — watch some videos and scan the feed.");
      };
      updateLog();
      const timer = setInterval(updateLog, 4000);
      Co.push(() => clearInterval(timer));
      en.appendChild(logDiv);
    },
  });

  // -- DeArrow: clickbait-free titles & thumbnails (community-sourced) --
  xa.register({ id: "dearrow", name: "DeArrow Titles & Thumbnails", summary: "Show crowdsourced clickbait-free titles and thumbnails from the DeArrow community.", masterKey: "dearrowOn", keys: ["dearrowOn", "dearrowSwapThumb"],
    apply(ctx) {
      if (!S.dearrowOn) return;
      ZenEngine.injectCSS();
      const cache = new Map();
      const api = (vid, kind) => {
        const key = vid + ":" + kind;
        if (cache.has(key)) return cache.get(key);
        const p = ZenEngine.fetchJson("https://sponsor.ajay.app/api/branded" + (kind === "title" ? "Title" : "Thumbnail") + "?videoID=" + encodeURIComponent(vid))
          .then((r) => (r.ok && r.json && r.json.title ? r.json : null))
          .catch(() => null);
        cache.set(key, p);
        return p;
      };
      // Watch page: toggle chip next to the title.
      const watchMount = () => {
        if (!location.pathname.startsWith("/watch")) return true;
        const vid = ie.videoId();
        if (!vid || document.querySelector("[data-zen-dearrow-watch]")) return true;
        const titleEl = document.querySelector("#title h1 yt-formatted-string") ||
          document.querySelector("#title h1") ||
          document.querySelector("h1.title");
        if (!titleEl) return false;
        api(vid, "title").then((alt) => {
          if (!alt || !alt.title) return;
          const original = titleEl.textContent;
          if (String(alt.title).trim() === String(original).trim()) return;
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "zen-dearrow-chip";
          chip.dataset.zenDearrowWatch = "1";
          chip.textContent = "DeArrow title";
          let swapped = false;
          chip.addEventListener("click", () => {
            swapped = !swapped;
            titleEl.textContent = swapped ? alt.title : original;
            chip.classList.toggle("swapped", swapped);
            chip.textContent = swapped ? "Original title" : "DeArrow title";
          });
          const row = titleEl.closest("#title") || titleEl.parentElement;
          if (row) row.appendChild(chip);
        });
        return true;
      };
      ZenEngine.scheduleOnReady(ctx, watchMount, { attempts: 8, delayMs: 400 });
      ctx.onNav(() => ctx.addTimeout(watchMount, 0));
      Yt["dearrow"].push(() => {
        document.querySelectorAll("[data-zen-dearrow-watch]").forEach((e) => e.remove());
      });
    },
    settings(en) {
      en.appendChild(Io("Enable DeArrow Titles & Thumbnails", "dearrowOn"));
    } });

  // -- Return YouTube Dislike: like/dislike ratio + rating --
  xa.register({ id: "ryd-votes", name: "Dislike Meter", summary: "Estimated like/dislike ratio via Return YouTube Dislike.", masterKey: "rydVotesOn", keys: ["rydVotesOn"],
    apply(ctx) {
      if (!S.rydVotesOn) return;
      ZenEngine.injectCSS();
      const mount = () => {
        if (!location.pathname.startsWith("/watch")) return true;
        const vid = ie.videoId();
        if (!vid || document.querySelector(".zen-ryd-bar")) return true;
        const seg = document.querySelector("ytd-segmented-like-dislike-button-renderer");
        if (!seg) return false;
        ZenEngine.fetchJson("https://returnyoutubedislikeapi.com/votes?videoId=" + encodeURIComponent(vid))
          .then((r) => {
            const d = r.ok && r.json ? r.json : null;
            if (!d || typeof d.likes !== "number" || typeof d.dislikes !== "number") return;
            const total = d.likes + d.dislikes;
            if (!total) return;
            const pct = Math.round((d.likes / total) * 100);
            const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(n);
            const bar = document.createElement("div");
            bar.className = "zen-ryd-bar";
            bar.title = "Estimated from Return YouTube Dislike";
            const track = document.createElement("div");
            track.className = "zen-ryd-track";
            const like = document.createElement("div");
            like.className = "zen-ryd-like";
            like.style.width = pct + "%";
            const dislike = document.createElement("div");
            dislike.className = "zen-ryd-dislike";
            dislike.style.width = (100 - pct) + "%";
            track.append(like, dislike);
            const label = document.createElement("div");
            label.className = "zen-ryd-label";
            label.innerHTML = "<span style=\"color:#3ea6ff\">" + pct + "% like</span><span>" + fmt(d.likes) + " vs " + fmt(d.dislikes) + "</span>";
            bar.append(track, label);
            seg.parentElement.insertBefore(bar, seg.nextSibling);
          });
        return true;
      };
      ZenEngine.scheduleOnReady(ctx, mount, { attempts: 8, delayMs: 400 });
      ctx.onNav(() => ctx.addTimeout(mount, 0));
      Yt["ryd-votes"].push(() => {
        document.querySelectorAll(".zen-ryd-bar").forEach((e) => e.remove());
      });
    },
    settings(en) {
      en.appendChild(Io("Enable Dislike Meter (Return YouTube Dislike)", "rydVotesOn"));
    } });

  // -- Keep Screen Awake (Wake Lock API) --
  xa.register({ id: "screen-wake", name: "Keep Screen Awake", summary: "Prevents the screen from sleeping while a video plays (Wake Lock API).", masterKey: "screenWakeOn", keys: ["screenWakeOn"],
    apply(ctx) {
      if (!S.screenWakeOn) return;
      if (!navigator.wakeLock || typeof navigator.wakeLock.request !== "function") return;
      let lock = null;
      const release = () => {
        if (!lock) return;
        try { lock.release().catch(() => {}); } catch (_) {}
        lock = null;
      };
      const acquire = () => {
        if (lock) return;
        navigator.wakeLock.request("screen").then((l) => { lock = l; }).catch(() => {});
      };
      const onState = () => {
        const vid = ie.el();
        if (vid && !vid.paused && !vid.ended && document.visibilityState === "visible") acquire();
        else release();
      };
      const vid = ie.el();
      if (vid) {
        ctx.addListener(vid, "play", onState);
        ctx.addListener(vid, "pause", onState);
        ctx.addListener(vid, "ended", onState);
      }
      ctx.addListener(document, "visibilitychange", onState);
      ctx.addListener(document, "yt-navigate-finish", () => { release(); onState(); });
      ctx.addTimeout(onState, 500);
      Yt["screen-wake"].push(() => release());
    },
    settings(en) { en.appendChild(Io("Keep the screen awake while playing", "screenWakeOn")); } });

  xa.register({
    id: "perf-mode",
    name: "Performance Mode",
    summary: "Performance engine with five presets (light, balanced, aggressive, extreme, maximum) plus granular switches: CSS containment, content-visibility virtualization, lazy thumbnails, comment virtualization, paint reduction, memory trimming, prefetching, animation/effects killing, thumbnail downgrade, moving-thumbnail disabling, and player quality caps.",
    masterKey: "perfModeOn",
    keys: ["perfModeOn", "perfModeLevel", "perfModeAuto", "perfContainment", "perfLazyThumbs", "perfLazyComments", "perfKillAnim", "perfKillBlur", "perfThumbQuality", "perfDisablePreviews", "perfMemoryTrim", "perfPrefetch", "perfPreconnect", "perfBgThrottle", "perfPaintReduction", "perfQualityCap"],
    apply(ctx) {
      const prev = Yt["perf-mode"] || [];
      if (prev.length) { for (const fn of prev) { try { fn(); } catch (e) {} } Yt["perf-mode"] = []; }
      Xt.perfMode = !!S.perfModeOn;
      Xt.perfLevel = S.perfModeLevel || "balanced";
      const shouldAuto = S.perfModeAuto && (Xt.batteryLow || Xt.cpuConstrained || Xt.lowMemory || Xt.saveData);
      const isActive = Xt.perfMode || shouldAuto;
      Xt.perfMode = isActive;
      if (!isActive) {
        try { const el = document.getElementById("ytp-perf-style"); if (el) el.remove(); } catch (e) {}
        return;
      }
      const LEVEL = Xt.perfLevel;
      const TIERS = {
        light: { containment: 1, lazyThumbs: 1, preconnect: 1 },
        balanced: { containment: 1, lazyThumbs: 1, lazyComments: 1, preconnect: 1, prefetch: 1, memory: 1, paint: 1, bgThrottle: 1 },
        aggressive: { containment: 1, lazyThumbs: 1, lazyComments: 1, preconnect: 1, prefetch: 1, memory: 1, paint: 1, bgThrottle: 1, killAnim: 1, killBlur: 1, thumbQuality: 1 },
        extreme: { containment: 1, lazyThumbs: 1, lazyComments: 1, preconnect: 1, prefetch: 1, memory: 1, paint: 1, bgThrottle: 1, killAnim: 1, killBlur: 1, thumbQuality: 1, disablePreviews: 1, qualityCap: 1 },
        maximum: { containment: 1, lazyThumbs: 1, lazyComments: 1, preconnect: 1, prefetch: 1, memory: 1, paint: 1, bgThrottle: 1, killAnim: 1, killBlur: 1, thumbQuality: 1, disablePreviews: 1, qualityCap: 1, maxPaint: 1 },
      };
      const tier = TIERS[LEVEL] || TIERS.balanced;
      const on = (k) => !!S["perf" + k] || !!tier[k];

      // Level ⇄ toggle sync: writing the level writes the granular keys so the
      // settings checkboxes always reflect exactly what the level enables.
      const syncLevelToggles = () => {
        const lvl = S.perfModeLevel || "balanced";
        const t = TIERS[lvl] || TIERS.balanced;
        const map = [
          ["perfContainment", "containment"],
          ["perfLazyThumbs", "lazyThumbs"],
          ["perfLazyComments", "lazyComments"],
          ["perfKillAnim", "killAnim"],
          ["perfKillBlur", "killBlur"],
          ["perfThumbQuality", "thumbQuality"],
          ["perfDisablePreviews", "disablePreviews"],
          ["perfMemoryTrim", "memory"],
          ["perfPrefetch", "prefetch"],
          ["perfPreconnect", "preconnect"],
          ["perfBgThrottle", "bgThrottle"],
          ["perfPaintReduction", "paint"],
          ["perfQualityCap", "qualityCap"],
        ];
        for (const [key, tierKey] of map) {
          const target = !!t[tierKey];
          if (!!S[key] !== target) {
            S[key] = target;
            try { g.emit("cfg.changed", { key, val: target }); } catch (_) {}
          }
        }
      };
      syncLevelToggles();
      const levelUnsub = So("cfg.changed", ({ key: k }) => {
        if (k === "perfModeLevel") {
          syncLevelToggles();
          try { xa.apply("perf-mode"); } catch (_) {}
        }
      });
      Yt["perf-mode"].push(() => { try { if (typeof levelUnsub === "function") levelUnsub(); } catch (_) {} });
      let perfStyle = document.getElementById("ytp-perf-style");
      if (!perfStyle) {
        perfStyle = document.createElement("style");
        perfStyle.id = "ytp-perf-style";
        perfStyle.textContent = "";
        (document.head || document.documentElement).appendChild(perfStyle);
        Yt["perf-mode"].push(() => { try { perfStyle.remove(); } catch (e) {} });
      } else {
        perfStyle.textContent = "";
      }
      const addPerfCss = (css) => { try { perfStyle.textContent += "\n" + css; } catch (e) {} };
      if (on("Containment")) {
        addPerfCss("ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-rich-shelf-renderer, ytd-reel-item-renderer { contain: layout style paint; }");
        addPerfCss("ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer { content-visibility: auto; contain-intrinsic-size: 0 300px; }");
        addPerfCss("#secondary, #secondary-inner-renderer { contain: layout style; }");
        addPerfCss("#movie_player, .html5-video-player { will-change: transform; transform: translateZ(0); }");
        addPerfCss("@font-face { font-display: swap !important; }");
        addPerfCss("#description, #description-inner, ytd-text-inline-expander { contain: layout style; }");
        addPerfCss("ytd-playlist-panel-renderer, #playlist-items { contain: layout style paint; }");
      }
      if (on("LazyComments")) {
        addPerfCss("#comments, ytd-comments, ytd-comment-thread-renderer, ytd-comment-renderer { content-visibility: auto; contain-intrinsic-size: 0 200px; }");
      }
      if (on("KillAnim")) {
        addPerfCss("*, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }");
        addPerfCss(".ytp-chrome-bottom, .ytp-progress-bar-container, .ytp-tooltip { transition: opacity 0.1s !important; }");
        addPerfCss("html, body { scroll-behavior: auto !important; }");
      }
      if (on("KillBlur")) {
        addPerfCss("* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; text-shadow: none !important; box-shadow: none !important; }");
        addPerfCss("#cinematics, #cinematic-container, ytd-cinematic-container-renderer { display: none !important; }");
        addPerfCss("ytd-watch-flexy[theater], .ytp-gradient-bottom, .ytp-gradient-top { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }");
      }
      if (on("DisablePreviews")) {
        addPerfCss("ytd-moving-thumbnail-renderer, ytd-moving-thumbnail, ytd-thumbnail-overlay-resume-playback-renderer { display: none !important; }");
      }
      if (on("ThumbQuality") || on("DisablePreviews")) {
        addPerfCss("ytd-thumbnail img, ytd-rich-grid-media img, #thumbnail img { content-visibility: auto; decoding: async; }");
        addPerfCss("ytd-thumbnail, ytd-thumbnail::before, #thumbnail { border-radius: 0 !important; }");
      }
      if (on("MaxPaint") || (on("KillAnim") && on("KillBlur"))) {
        addPerfCss("ytd-badge-supported-renderer, .ytd-badge-supported-renderer { display: none !important; }");
        addPerfCss("*:focus { outline-offset: 0 !important; }");
        addPerfCss("::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 4px; }");
      }
      if (on("LazyThumbs")) {
        try {
          const thumbObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset && img.dataset.ytpPerfSrc) { try { img.src = img.dataset.ytpPerfSrc; delete img.dataset.ytpPerfSrc; } catch (e) {} }
                if (typeof img.decode === "function") { try { img.decode().catch(() => {}); } catch (e) {} }
                thumbObserver.unobserve(img);
              }
            }
          }, { rootMargin: "500px 0px", threshold: 0.01 });
          const observeThumbs = () => {
            try {
              const thumbs = document.querySelectorAll("ytd-thumbnail img:not([data-ytp-perf-observed]), #thumbnail img:not([data-ytp-perf-observed]), .ytp-videowall-still-image:not([data-ytp-perf-observed])");
              for (const img of thumbs) {
                if (!img.src || img.loading === "lazy") continue;
                try {
                  img.loading = "lazy";
                  img.decoding = "async";
                  img.dataset.ytpPerfObserved = "1";
                  if (on("ThumbQuality") && img.src.includes("hqdefault")) {
                    const low = img.src.replace("hqdefault", "mqdefault");
                    if (low !== img.src) { img.dataset.ytpPerfSrc = img.src; img.src = low; }
                  }
                  thumbObserver.observe(img);
                } catch (e) {}
              }
            } catch (e) {}
          };
          observeThumbs();
          let thumbObsTimer = 0;
          const bodyObs = new MutationObserver(() => {
            if (thumbObsTimer) return;
            thumbObsTimer = setTimeout(() => { thumbObsTimer = 0; try { requestAnimationFrame(observeThumbs); } catch (e) {} }, 500);
          });
          if (document.body) bodyObs.observe(document.body, { childList: true, subtree: true });
          Yt["perf-mode"].push(() => { try { bodyObs.disconnect(); } catch (e) {} });
          Yt["perf-mode"].push(() => { try { thumbObserver.disconnect(); } catch (e) {} });
          Yt["perf-mode"].push(() => { clearTimeout(thumbObsTimer); });
          ctx.addInterval(observeThumbs, 5000);
        } catch (e) {}
      }
      if (on("MemoryTrim")) {
        try {
          ctx.addInterval(() => {
            try {
              if (_mp && _mp.runMaintenance) _mp.runMaintenance();
              if (typeof Ve !== "undefined" && Ve.size > 32) {
                const keys = Array.from(Ve.keys()).slice(0, 8);
                for (const k of keys) { try { const url = Ve.get(k); if (url) URL.revokeObjectURL(url); Ve.delete(k); } catch (e) {} }
              }
              if (typeof de !== "undefined" && de.size > 256) {
                const keys = Array.from(de.keys()).slice(0, 64);
                for (const k of keys) de.delete(k);
              }
            } catch (e) {}
          }, 30000);
        } catch (e) {}
      }
      if (on("Prefetch")) {
        try {
          const prefetchNext = () => {
            try {
              if (!Xt.visible || !Xt.focused) return;
              const nextBtn = document.querySelector(".ytp-next-button, a.ytp-next-button");
              if (!nextBtn) return;
              const doPrefetch = () => {
                try {
                  const href = nextBtn.href || nextBtn.getAttribute("href");
                  if (!href || !href.includes("/watch")) return;
                  if (document.querySelector("link[data-ytp-prefetch=\"" + href + "\"]")) return;
                  const link = document.createElement("link");
                  link.rel = "prefetch";
                  link.href = href;
                  link.as = "document";
                  link.dataset.ytpPrefetch = href;
                  document.head.appendChild(link);
                  setTimeout(() => { try { link.remove(); } catch (e) {} }, 15000);
                } catch (e) {}
              };
              if (typeof requestIdleCallback === "function") requestIdleCallback(doPrefetch, { timeout: 2000 });
              else setTimeout(doPrefetch, 1500);
            } catch (e) {}
          };
          ctx.addInterval(prefetchNext, 15000);
          ctx.onNav(() => { ctx.addTimeout(prefetchNext, 3000); });
        } catch (e) {}
      }
      if (on("Preconnect")) {
        try {
          const domains = ["https://i.ytimg.com", "https://yt3.ggpht.com", "https://www.google.com", "https://fonts.gstatic.com", "https://yt4.ggpht.com"];
          for (const domain of domains) {
            if (document.querySelector("link[rel=\"preconnect\"][href=\"" + domain + "\"]")) continue;
            const link = document.createElement("link");
            link.rel = "preconnect";
            link.href = domain;
            link.crossOrigin = "anonymous";
            document.head.appendChild(link);
          }
        } catch (e) {}
      }
      if (on("BgThrottle")) {
        try {
          const onVisChange = () => { Xt.perfHidden = document.hidden; };
          document.addEventListener("visibilitychange", onVisChange, { passive: true });
          Yt["perf-mode"].push(() => { document.removeEventListener("visibilitychange", onVisChange); Xt.perfHidden = false; });
          const passiveScroll = () => {};
          window.addEventListener("scroll", passiveScroll, { passive: true, capture: true });
          Yt["perf-mode"].push(() => { window.removeEventListener("scroll", passiveScroll, { capture: true }); });
        } catch (e) {}
      }
      if (on("PaintReduction")) {
        try {
          const paintObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
              const el = entry.target;
              el.style.contentVisibility = entry.isIntersecting ? "" : "hidden";
            }
          }, { rootMargin: "200px 0px" });
          const observePaint = () => {
            try {
              const targets = document.querySelectorAll("ytd-guide-section-renderer, ytd-guide-collapsible-entry-renderer, #footer, #guide-links-primary, ytd-rich-shelf-renderer");
              for (const t of targets) { if (!t.dataset.ytpPaintObserved) { t.dataset.ytpPaintObserved = "1"; paintObserver.observe(t); } }
            } catch (e) {}
          };
          ctx.addTimeout(observePaint, 2000);
          ctx.onNav(() => ctx.addTimeout(observePaint, 2000));
          Yt["perf-mode"].push(() => { try { paintObserver.disconnect(); } catch (e) {} });
        } catch (e) {}
      }
      if (on("QualityCap")) {
        try {
          const capQuality = () => {
            try {
              const p = document.querySelector("#movie_player");
              if (p && typeof p.setPlaybackQuality === "function") p.setPlaybackQuality("hd720");
            } catch (e) {}
          };
          ctx.addTimeout(capQuality, 1200);
          ctx.onNav(() => ctx.addTimeout(capQuality, 1200));
          ctx.addInterval(capQuality, 20000);
          Yt["perf-mode"].push(() => { try { const p = document.querySelector("#movie_player"); if (p && typeof p.setPlaybackQualityRange === "function") p.setPlaybackQualityRange("auto", "auto"); } catch (e) {} });
        } catch (e) {}
      }
      try {
        ctx.addInterval(() => {
          const shouldAutoNow = S.perfModeAuto && (Xt.batteryLow || Xt.cpuConstrained || Xt.lowMemory || Xt.saveData);
          const isActiveNow = !!S.perfModeOn || shouldAutoNow;
          if (isActiveNow !== Xt.perfMode) { try { xa.apply("perf-mode"); } catch (e) {} }
        }, 10000);
      } catch (e) {}
      Xt.perfLogSuppressed = true;
      Yt["perf-mode"].push(() => { Xt.perfMode = false; Xt.perfLogSuppressed = false; Xt.perfHidden = false; });
    },
    settings(en) {
      en.appendChild(Io("Enable Performance Mode", "perfModeOn"));
      en.appendChild(Ro("Level", "perfModeLevel", {
        light: "Light — containment, lazy thumbs, preconnect only",
        balanced: "Balanced (recommended) — + virtualization, prefetch, memory, paint",
        aggressive: "Aggressive — + kill animations, kill blur, thumbnail downgrade",
        extreme: "Extreme — + disable moving previews, cap player quality at 720p",
        maximum: "Maximum — everything on, maximum paint reduction",
      }));
      en.appendChild(Io("Auto-enable when battery low / CPU constrained / Save-Data", "perfModeAuto"));
      en.appendChild(Io("Granular: CSS containment", "perfContainment"));
      en.appendChild(Io("Granular: lazy thumbnails", "perfLazyThumbs"));
      en.appendChild(Io("Granular: comment virtualization", "perfLazyComments"));
      en.appendChild(Io("Granular: kill animations & transitions", "perfKillAnim"));
      en.appendChild(Io("Granular: kill blur, shadows, ambient", "perfKillBlur"));
      en.appendChild(Io("Granular: downgrade offscreen thumbnails", "perfThumbQuality"));
      en.appendChild(Io("Granular: disable moving thumbnails", "perfDisablePreviews"));
      en.appendChild(Io("Granular: memory trimming", "perfMemoryTrim"));
      en.appendChild(Io("Granular: next-video prefetch", "perfPrefetch"));
      en.appendChild(Io("Granular: CDN preconnect", "perfPreconnect"));
      en.appendChild(Io("Granular: background throttling", "perfBgThrottle"));
      en.appendChild(Io("Granular: paint reduction", "perfPaintReduction"));
      en.appendChild(Io("Granular: cap player quality at 720p", "perfQualityCap"));
      const info = document.createElement("div");
      info.className = "ytp-hist-note";
      info.style.marginTop = "8px";
      info.innerHTML = "<strong>Level presets:</strong> each preset turns on a set of optimizations. Granular switches add individual optimizations on top of the selected level. Maximum disables moving thumbnails, caps video quality, and maximizes paint reduction.";
      en.appendChild(info);
    } });
  xa.register({
    id: "overlay-hub",
    name: "Monolith Overlay Hub",
    summary: "Groups every floating monitor (Live FPS Counter, Buffer Health Monitor, Dropped Frame Counter, Playback Performance Overlay, Activity Monitor) into one extendable glass widget instead of separate boxes. Monitors join and leave automatically as you toggle them at run time.",
    masterKey: "overlayHubOn",
    keys: ["overlayHubOn", "overlayHubPos"],
    apply(ctx) {
      const CONTAINER_ID = "ytp-zen-monolith";
      const STYLE_ID = "ytp-zen-monolith-style";
      const ADOPT_SELECTOR = "#ytp-fps-box, #ytp-buf-box, #ytp-drop-box, #ytp-stats, #ytp-diag";
      let container = null;
      let collapsed = false;

      const position = () => {
        if (!container) return;
        const pos = S.overlayHubPos || "bl";
        container.style.top = "tl" === pos || "tr" === pos ? "8px" : "";
        container.style.bottom = "bl" === pos || "br" === pos ? "48px" : "";
        container.style.left = "tl" === pos || "bl" === pos ? "8px" : "";
        container.style.right = "tr" === pos || "br" === pos ? "8px" : "";
      };

      const ensureStyle = () => {
        if (document.getElementById(STYLE_ID)) return;
        const st = document.createElement("style");
        st.id = STYLE_ID;
        st.textContent = [
          "#ytp-zen-monolith{position:fixed;z-index:2147483635;padding:6px 8px 7px;background:rgba(20,22,28,.82);border:1px solid rgba(255,255,255,.12);border-radius:10px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 6px 20px rgba(0,0,0,.4);font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;color:#ddd;min-width:180px;max-width:250px;pointer-events:none}",
          "#ytp-zen-monolith .ytp-mon-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px;pointer-events:auto;cursor:move;user-select:none}",
          "#ytp-zen-monolith .ytp-mon-title{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff}",
          "#ytp-zen-monolith .ytp-mon-toggle{background:transparent;border:0;color:#8ab;cursor:pointer;font-size:11px;line-height:1;padding:2px 4px;border-radius:4px}",
          "#ytp-zen-monolith .ytp-mon-toggle:hover{background:rgba(255,255,255,.1)}",
          "#ytp-zen-monolith #ytp-fps-box,#ytp-zen-monolith #ytp-buf-box,#ytp-zen-monolith #ytp-drop-box,#ytp-zen-monolith #ytp-stats,#ytp-zen-monolith #ytp-diag{position:static!important;top:auto!important;bottom:auto!important;left:auto!important;right:auto!important;width:100%!important;min-width:0!important;box-sizing:border-box!important;margin:0 0 6px!important;padding:4px 6px!important;background:rgba(255,255,255,.05)!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:6px!important;box-shadow:none!important;pointer-events:none!important}",
          "#ytp-zen-monolith .ytp-mon-empty{color:#667;font-size:10.5px;padding:2px 0}",
        ].join("\n");
        (document.head || document.documentElement).appendChild(st);
      };

      const getHub = () => {
        ensureStyle();
        if (container && container.parentNode) return container;
        container = document.createElement("div");
        container.id = CONTAINER_ID;
        const hdr = document.createElement("div");
        hdr.className = "ytp-mon-hdr";
        const title = document.createElement("span");
        title.className = "ytp-mon-title";
        title.textContent = "Zen Monitors";
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "ytp-mon-toggle";
        toggle.textContent = "–";
        toggle.title = "Collapse / expand";
        toggle.addEventListener("click", () => {
          collapsed = !collapsed;
          toggle.textContent = collapsed ? "+" : "–";
          if (container) container.style.display = collapsed ? "none" : "";
        });
        hdr.append(title, toggle);
        container.appendChild(hdr);
        document.body.appendChild(container);
        position();
        return container;
      };

      const removeContainer = () => {
        if (container && container.parentNode) { try { container.parentNode.removeChild(container); } catch (_) {} }
        container = null;
        const st = document.getElementById(STYLE_ID);
        if (st) { try { st.remove(); } catch (_) {} }
      };

      const adopt = () => {
        try {
          if (!S.overlayHubOn || !document.body) { removeContainer(); return; }
          const widgets = document.querySelectorAll(ADOPT_SELECTOR);
          let count = 0;
          for (const w of widgets) {
            if (w.closest("#" + CONTAINER_ID)) { count++; continue; }
            const hub = getHub();
            if (!hub) return;
            hub.appendChild(w);
            count++;
          }
          const hub = document.getElementById(CONTAINER_ID);
          if (!hub) return;
          if (count === 0) {
            if (collapsed) return;
            if (!hub.querySelector(".ytp-mon-empty")) {
              const empty = document.createElement("div");
              empty.className = "ytp-mon-empty";
              empty.textContent = "Enable a monitor to attach it here.";
              hub.appendChild(empty);
            }
            return;
          }
          const emptyEl = hub.querySelector(".ytp-mon-empty");
          if (emptyEl) emptyEl.remove();
          position();
        } catch (_) {}
      };

      adopt();
      ctx.addInterval(adopt, 500);
      ctx.onNav(() => ctx.addTimeout(adopt, 600));

      const unsub = So("cfg.changed", ({ key: k }) => {
        if (k === "overlayHubOn") adopt();
        if (k === "overlayHubPos") position();
      });
      Yt["overlay-hub"].push(() => {
        try { if (typeof unsub === "function") unsub(); } catch (_) {}
        removeContainer();
      });
    },
    settings(en) {
      en.appendChild(Io("Group all floating monitors into one widget", "overlayHubOn"));
      en.appendChild(Ro("Widget position", "overlayHubPos", {
        tl: "Top-left",
        tr: "Top-right",
        bl: "Bottom-left",
        br: "Bottom-right",
      }));
      const info = document.createElement("div");
      info.className = "ytp-hist-note";
      info.style.marginTop = "8px";
      info.innerHTML = "<strong>Monolith:</strong> when enabled, every floating monitor (FPS, buffer, dropped frames, playback stats, activity) is gathered into a single widget that grows and shrinks as you toggle monitors on and off.";
      en.appendChild(info);
    },
  });
