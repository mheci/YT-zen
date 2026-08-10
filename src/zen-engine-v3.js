
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
  //  Features (21):
  //    Discovery:  Discover (unified), Time Machine, Small Creator, Rabbit Hole
  //    Playback:   Scene Jumper, Smart Speed, Video DNA
  //    Layout:     Living Sidebar, Inline Previews
  //    Search:     Vibe Search, Credibility Layer, Search Remix, Outdated Detection
  //    Session:    Watch Genome, Collections, Time Budget
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
      status.className = "zen-status";
      status.id = id + "-status";
      header.append(heading, status);
      const results = document.createElement("div");
      results.id = id + "-results";
      results.style.cssText = "display:flex;flex-direction:column;gap:4px";
      panel.append(header, results);
      return panel;
    };
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
    const insertIntoFeed = (panel, ctx) => {
      const tryInsert = () => {
        if (panel.parentNode) return true;
        const target = document.querySelector("#contents.ytd-rich-grid-renderer") ||
                       document.querySelector("ytd-rich-grid-renderer #contents") ||
                       document.querySelector("#primary");
        if (target) { target.insertBefore(panel, target.firstChild); return true; }
        return false;
      };
      ZenEngine.scheduleOnReady(ctx, tryInsert, { attempts: 8, delayMs: 500 });
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
    // feature that opts in gets a tab inside the same host, so enabling the
    // unified Discover toggle yields one widget, not stacked feeds.
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
    return { createFeedPanel, createVideoRow, insertIntoFeed, scoreVideo, setStatus, discoveryHost };
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
        const source = ctx.createMediaElementSource(video);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        const entry = { ctx, source, analyser };
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
    const detectScenes = (video, duration) => {
      return new Promise((resolve) => {
        if (!video || !duration || duration < 15) { resolve([]); return; }
        const entry = analyserFor(video);
        if (!entry) { resolve([]); return; }
        const analyser = entry.analyser;
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const scenes = [];
        let silentFrames = 0;
        let finished = false;
        const finish = (result) => {
          if (finished) return;
          finished = true;
          clearInterval(timer);
          clearTimeout(deadline);
          resolve(result);
        };
        const timer = setInterval(() => {
          if (!video || video.ended) { finish(scenes); return; }
          analyser.getByteFrequencyData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i];
          const avg = sum / buf.length;
          if (avg < 8) {
            silentFrames++;
            if (silentFrames === 3 && video.currentTime > 2) {
              const t = video.currentTime;
              if (!scenes.length || t - scenes[scenes.length - 1] > 5) scenes.push(t);
            }
          } else {
            silentFrames = 0;
          }
          if (video.currentTime >= duration - 1) finish(scenes);
        }, 400);
        const deadline = setTimeout(() => finish(scenes), Math.min(duration * 1000, 120000));
      });
    };
    const renderSceneStrip = (container, duration, scenes) => {
      if (!container || !duration || !scenes.length) return;
      container.innerHTML = "";
      scenes.forEach(t => {
        const mark = document.createElement("div");
        mark.className = "zen-scene-mark";
        mark.style.left = ((t / duration) * 100).toFixed(2) + "%";
        mark.title = "Scene at " + ce(Math.floor(t));
        mark.addEventListener("click", (ev) => { ev.stopPropagation(); const vid = ie.el(); if (vid && !_isLiveStream()) vid.currentTime = t; });
        container.appendChild(mark);
      });
    };
    const getHeatmap = () => {
      try {
        const pr = e.ytInitialPlayerResponse;
        const overlay = pr && pr.playerOverlays && pr.playerOverlays.playerOverlayRenderer;
        const bar = overlay && overlay.decoratedPlayerBarRenderer && overlay.decoratedPlayerBarRenderer.decoratedPlayerBarRenderer;
        const markers = bar && bar.playerBar && bar.playerBar.multiMarkersPlayerBarRenderer && bar.playerBar.multiMarkersPlayerBarRenderer.markers;
        const out = [];
        for (const marker of markers || []) {
          const heat = marker && marker.heatmapRenderer;
          if (heat) {
            out.push({
              start: heat.timeRangeStartMillis || 0,
              end: heat.timeRangeEndMillis || heat.timeRangeStartMillis || 0,
              intensity: typeof heat.intensityScoreNormalized === "number" ? heat.intensityScoreNormalized : 0,
            });
          }
        }
        return out;
      } catch (_) {
        return [];
      }
    };
    const renderDNA = (canvas, duration, heatmap) => {
      if (!canvas || !duration) return;
      const cx = canvas.getContext("2d");
      const w = canvas.width, h = canvas.height;
      cx.clearRect(0, 0, w, h);
      if (heatmap && heatmap.length) {
        for (let x = 0; x < w; x++) {
          const tMs = (x / w) * duration * 1000;
          let intensity = 0;
          for (const marker of heatmap) {
            if (tMs >= marker.start && tMs < marker.end) {
              intensity = Math.max(intensity, marker.intensity);
            }
          }
          const bar = Math.max(0.08, Math.min(1, intensity));
          cx.fillStyle = "hsla(" + (bar > 0.7 ? 350 : bar > 0.4 ? 30 : 200) + ",75%,55%,0.7)";
          cx.fillRect(x, h - bar * h * 0.85, 1, bar * h * 0.85);
        }
        return;
      }
      for (let x = 0; x < w; x++) {
        const t = (x / w) * duration;
        const energy = Math.min(1, 0.2 + 0.6 * Math.abs(Math.sin(t * 0.08) * Math.cos(t * 0.03)));
        cx.fillStyle = "hsla(" + (energy > 0.7 ? 350 : energy > 0.4 ? 30 : 200) + ",75%,55%,0.7)";
        cx.fillRect(x, h - energy * h * 0.85, 1, energy * h * 0.85);
      }
    };
    const release = (video) => {
      const entry = perVideo.get(video);
      if (!entry) return;
      perVideo.delete(video);
      try { entry.source.disconnect(); } catch (_) {}
      try { entry.analyser.disconnect(); } catch (_) {}
    };
    return {
      detectScenes,
      readEnergy,
      renderSceneStrip,
      getHeatmap,
      renderDNA,
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
      const LIMITS = {
        feedback: { max: 15, windowMs: 60000 },      // 15 per minute
        like: { max: 10, windowMs: 60000 },           // 10 per minute
        subscribe: { max: 5, windowMs: 60000 },       // 5 per minute
        browse: { max: 20, windowMs: 60000 },         // 20 per minute
        player: { max: 10, windowMs: 60000 },         // 10 per minute
        default: { max: 30, windowMs: 60000 },        // 30 per minute
      };

      const canProceed = (action) => {
        const limit = LIMITS[action] || LIMITS.default;
        const now = Date.now();
        let w = windows.get(action);
        if (!w || now >= w.resetAt) {
          w = { count: 0, resetAt: now + limit.windowMs };
          windows.set(action, w);
        }
        if (w.count >= limit.max) return false;
        w.count++;
        return true;
      };

      const getRemaining = (action) => {
        const limit = LIMITS[action] || LIMITS.default;
        const w = windows.get(action);
        if (!w) return limit.max;
        if (Date.now() >= w.resetAt) return limit.max;
        return Math.max(0, limit.max - w.count);
      };

      return { canProceed, getRemaining };
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
        store.update(d => {
          d.watchHistory[videoId] = { watchTime, duration, pct, topics, ts: Date.now() };
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

      const getProfile = () => {
        const d = store.get();
        const topicScores = {};
        const watched = Object.values(d.watchHistory);
        for (const entry of watched) {
          if (!entry.topics) continue;
          const weight = (entry.pct || 0) / 100; // Higher watch % = stronger signal
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

      return { trackWatch, trackLike, trackFeedback, getProfile, getStore: () => store };
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
            // The user is watching unwanted content - this is a signal we want to minimize
            // We don't auto-skip (that would be disruptive) but we log it
          }
        }, 10000); // Check every 10 seconds
      };

      const stop = () => {
        monitoring = false;
        clearInterval(intervalId);
        intervalId = 0;
      };

      return { start, stop, isMonitoring: () => monitoring };
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

      // Convenience
      getProfile: () => SignalTracker.getProfile(),
      analyzeHomepage: () => ProfileAnalyzer.analyzeHomepage(),
      findMismatches: () => ProfileAnalyzer.findMismatches(),
      train: (topics, opts) => TrainingEngine.startTraining(topics, opts),
      stopTraining: () => TrainingEngine.stopTraining(),
      blockTopic: (topic) => NegativeSignalManager.addBlockedTopic(topic),
      unblockTopic: (topic) => NegativeSignalManager.removeBlockedTopic(topic),
      blockKeyword: (kw) => NegativeSignalManager.addBlockedKeyword(kw),
      scanAndBlock: (max) => NegativeSignalManager.scanAndBlock(max),
      startMonitoring: () => WatchOptimizer.start(),
      stopMonitoring: () => WatchOptimizer.stop(),
      stats: () => ({
        profile: SignalTracker.getProfile(),
        rateLimits: {
          feedback: RateLimiter.getRemaining("feedback"),
          like: RateLimiter.getRemaining("like"),
          subscribe: RateLimiter.getRemaining("subscribe"),
          browse: RateLimiter.getRemaining("browse"),
        },
        training: TrainingEngine.getProgress(),
        monitoring: WatchOptimizer.isMonitoring(),
        blockedTopics: NegativeSignalManager.getBlockedTopics(),
        blockedKeywords: NegativeSignalManager.getBlockedKeywords(),
      }),
    };
  })();



  // ═══════════════════════════════════════════════════════════════════════════
  //  FEATURE REGISTRATIONS (21 features)
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
        const status = panel.querySelector("[id$=\"-status\"]");
        const results = panel.querySelector("[id$=\"-results\"]");
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
          const videos = ZenSearch.parseSearchVideos(response.json).slice(0, 12);
          status.textContent = videos.length
            ? "Found " + videos.length + " videos from " + target.toLocaleDateString()
            : "Nothing found from that date.";
          results.replaceChildren();
          videos.forEach(video => {
            results.appendChild(ZenDiscovery.createVideoRow(
              video.videoId,
              video.title,
              video.channel,
              () => { e.location.href = "/watch?v=" + video.videoId; },
            ));
          });
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

  xa.register({ id: "small-creator-spotlight", name: "Small Creator Spotlight", summary: "Spotlights channels you watch that are under your subscriber threshold. YT-zen records subscriber counts from watch pages.", masterKey: "smallCreatorOn", keys: ["smallCreatorOn", "smallCreatorMaxSubs"],
    apply(ctx) {
      if (!S.smallCreatorOn) return;
      ZenEngine.injectCSS();
      const panel = ZenDiscovery.createFeedPanel("ytp-zen-scs", "Small Creators");
      ZenDiscovery.insertIntoFeed(panel, ctx);

      const render = () => {
        const results = panel.querySelector("[id$=\"-results\"]");
        const status = panel.querySelector("[id$=\"-status\"]");
        results.replaceChildren();
        const small = ZenSession.genome.getSmallChannels(8);
        if (!small.length) {
          status.textContent = "Watch videos with this feature on; YT-zen records channels under " + (Number(S.smallCreatorMaxSubs) || 10000).toLocaleString() + " subscribers.";
          return;
        }
        status.textContent = small.length + " small channel(s) recorded from your watch history";
        small.forEach(([handle, info]) => {
          const row = document.createElement("div");
          row.className = "zen-row";
          row.style.cssText = "padding:4px 0;cursor:pointer;justify-content:space-between";
          const name = document.createElement("span");
          name.style.cssText = "flex:1;min-width:0;font-size:11.5px;color:#dde;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
          name.textContent = info.name || handle;
          name.title = handle;
          const subs = document.createElement("span");
          subs.className = "zen-meta";
          subs.textContent = info.subs.toLocaleString() + " subs";
          row.append(name, subs);
          row.addEventListener("click", () => {
            e.location.href = "/" + handle.replace(/^UC/, "") + "/videos";
          });
          results.appendChild(row);
        });
      };
      render();
      ctx.onNav(() => render());
      Yt["small-creator-spotlight"].push(() => {});
      // Badge matching cards in the feed
      const badgeCards = () => {
        document.querySelectorAll("ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer").forEach(card => {
          if (card.dataset.zenSmall) return;
          const link = card.querySelector("a[href*=\"/@\"], a[href*=\"/channel/\"]");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          const handleMatch = href.match(/\/@([^/?#]+)/);
          const handle = handleMatch ? handleMatch[1].toLowerCase() : "";
          if (!handle || !ZenSession.genome.isKnownSmall(handle)) return;
          card.dataset.zenSmall = "1";
          const badge = document.createElement("span");
          badge.className = "zen-cred-badge";
          badge.style.cssText = "background:rgba(33,150,243,.12);color:#64b5f6";
          badge.textContent = "Small creator";
          const meta = card.querySelector("#metadata-line");
          if (meta) meta.appendChild(badge);
        });
      };
      ctx.addTimeout(badgeCards, 0);
      ctx.onNav(() => ctx.addTimeout(badgeCards, 0));
      Yt["small-creator-spotlight"].push(() => {});
    },
    settings(en) {
      en.appendChild(Io("Enable Small Creator Spotlight", "smallCreatorOn"));
      en.appendChild(No("Max subscribers", "smallCreatorMaxSubs", 1000, 100000, 1000, v => v.toLocaleString()));
    } });

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

  xa.register({ id: "scene-jumper", name: "Scene Jumper", summary: "Auto-detect scene transitions using audio silence analysis. Click markers to jump.", masterKey: "sceneJumperOn", keys: ["sceneJumperOn"],
    apply(ctx) {
      if (!S.sceneJumperOn) return;
      ZenEngine.injectCSS();
      let strip = null;
      let ro = null;
      let active = true;
      // The marker strip is a passive overlay ABOVE the seekbar: it never
      // touches .ytp-progress-bar-container, so seeking/scrubbing keeps
      // working. The strip itself ignores pointer events; only the markers
      // are interactive.
      const position = () => {
        if (!strip || !strip.parentNode) return;
        const player = document.querySelector("#movie_player");
        const container = document.querySelector(".ytp-progress-bar-container");
        if (!player || !container) { strip.style.display = "none"; return; }
        const p = player.getBoundingClientRect();
        const c = container.getBoundingClientRect();
        if (!p.width || !c.width) { strip.style.display = "none"; return; }
        strip.style.display = "";
        strip.style.left = (c.left - p.left) + "px";
        strip.style.width = c.width + "px";
        strip.style.bottom = (p.bottom - c.bottom + 6) + "px";
      };
      const build = () => {
        if (!active) return false;
        const vid = ie.el();
        if (!vid || !vid.duration || !isFinite(vid.duration) || vid.duration < 30) return false;
        const player = document.querySelector("#movie_player");
        const container = document.querySelector(".ytp-progress-bar-container");
        if (!player || !container) return false;
        if (!strip) {
          strip = document.createElement("div");
          strip.id = "ytp-zen-scene";
          strip.title = "Click a marker to jump to a scene";
          player.appendChild(strip);
          if (!ro && typeof ResizeObserver === "function") {
            try {
              ro = new ResizeObserver(position);
              ro.observe(player);
            } catch (_) {}
          }
        }
        position();
        ZenPlayback.detectScenes(vid, vid.duration).then(scenes => {
          if (active && strip && strip.parentNode) ZenPlayback.renderSceneStrip(strip, vid.duration, scenes);
        });
        return true;
      };
      ZenEngine.scheduleOnReady(ctx, build, { attempts: 10, delayMs: 500 });
      const vid = ie.el();
      if (vid) ctx.addListener(vid, "loadedmetadata", () => ctx.addTimeout(build, 0));
      ctx.addListener(document, "yt-navigate-finish", () => {
        ctx.addTimeout(build, 0);
      });
      ctx.addListener(window, "resize", () => ctx.addTimeout(position, 50));
      Yt["scene-jumper"].push(() => {
        active = false;
        if (ro) { try { ro.disconnect(); } catch (_) {} }
        ro = null;
        if (strip && strip.parentNode) strip.remove();
        strip = null;
        ZenPlayback.release(ie.el());
      });
    },
    settings(en) { en.appendChild(Io("Enable Scene Jumper", "sceneJumperOn")); } });

  xa.register({ id: "smart-queue", name: "Smart Watch Queue", summary: "Queue videos, reorder by duration or recency, and play through with total time estimates.", masterKey: "smartQueueOn", keys: ["smartQueueOn"],
    apply(ctx) {
      if (!S.smartQueueOn) return;
      ZenEngine.injectCSS();
      const panel = document.createElement("div");
      panel.id = "ytp-zen-queue";
      panel.className = "zen-card";
      panel.style.cssText = "margin:8px 0";
      const header = document.createElement("div");
      header.className = "zen-row";
      header.style.cssText = "justify-content:space-between;margin-bottom:6px";
      const heading = document.createElement("span");
      heading.style.cssText = "font-size:13px;font-weight:700;color:#fff";
      heading.textContent = "Watch Queue";
      const total = document.createElement("span");
      total.className = "zen-meta";
      total.id = "ytp-zen-queue-total";
      header.append(heading, total);
      const controls = document.createElement("div");
      controls.className = "zen-row";
      controls.style.cssText = "flex-wrap:wrap;gap:4px;margin-bottom:6px";
      const addBtn = document.createElement("button");
      addBtn.className = "zen-btn";
      addBtn.textContent = "+ Queue this video";
      const playBtn = document.createElement("button");
      playBtn.className = "zen-btn primary";
      playBtn.textContent = "Play next";
      const sort = document.createElement("select");
      sort.className = "zen-btn";
      sort.style.cssText = "appearance:auto;padding:4px 6px";
      ["manual", "shortest", "longest", "newest"].forEach(mode => {
        const option = document.createElement("option");
        option.value = mode;
        option.textContent = mode;
        sort.appendChild(option);
      });
      const clearBtn = document.createElement("button");
      clearBtn.className = "zen-btn";
      clearBtn.textContent = "Clear";
      controls.append(addBtn, playBtn, sort, clearBtn);
      const list = document.createElement("div");
      list.style.cssText = "display:flex;flex-direction:column";
      panel.append(header, controls, list);

      const render = () => {
        list.replaceChildren();
        const items = ZenQueue.getList();
        total.textContent = items.length ? items.length + " videos · " + ce(Math.floor(ZenQueue.getTotalTime())) + " total" : "Empty";
        items.forEach(video => {
          const row = document.createElement("div");
          row.className = "q-row";
          const copy = document.createElement("div");
          copy.style.cssText = "flex:1;min-width:0";
          const title = document.createElement("div");
          title.className = "zen-title";
          title.style.webkitLineClamp = "1";
          title.textContent = video.title || video.videoId;
          const meta = document.createElement("div");
          meta.className = "zen-meta";
          meta.textContent = (video.duration ? ce(Math.floor(video.duration)) : "?") + (video.channel ? " · " + video.channel : "");
          copy.append(title, meta);
          const remove = document.createElement("button");
          remove.className = "q-remove";
          remove.textContent = "×";
          remove.title = "Remove";
          remove.addEventListener("click", (ev) => {
            ev.stopPropagation();
            ZenQueue.remove(video.videoId);
            render();
          });
          row.append(copy, remove);
          row.addEventListener("click", () => { e.location.href = "/watch?v=" + video.videoId; });
          list.appendChild(row);
        });
      };
      addBtn.addEventListener("click", () => {
        const vid = ie.videoId();
        if (!vid) { pe("No video loaded.", 1500, "error"); return; }
        const added = ZenQueue.add({ videoId: vid, title: ie.title() || vid, channel: ie.channel() || "", duration: ie.el() && ie.el().duration });
        pe(added ? "Queued: " + (ie.title() || vid) : "Already in queue.", 1500, added ? "success" : "info");
        render();
      });
      playBtn.addEventListener("click", () => {
        const first = ZenQueue.getList()[0];
        if (!first) { pe("Queue is empty.", 1500, "info"); return; }
        e.location.href = "/watch?v=" + first.videoId;
      });
      sort.addEventListener("change", () => {
        ZenQueue.reorder(sort.value);
        render();
      });
      clearBtn.addEventListener("click", () => { ZenQueue.clear(); render(); });

      const insert = () => {
        if (panel.parentNode) return true;
        const below = document.querySelector("#below") || document.querySelector("#secondary");
        if (!below) return false;
        below.prepend(panel);
        return true;
      };
      ZenEngine.scheduleOnReady(ctx, insert, { attempts: 10, delayMs: 500 });
      ctx.onNav(() => { render(); });
      render();
      Yt["smart-queue"].push(() => { if (panel.parentNode) panel.remove(); });
    },
    settings(en) { en.appendChild(Io("Enable Smart Watch Queue", "smartQueueOn")); } });

  xa.register({ id: "video-dna", name: "Video DNA Timeline", summary: "Watch-time intensity from YouTube's own heatmap when available, overlaid on the progress bar. Click to seek.", masterKey: "videoDnaOn", keys: ["videoDnaOn"],
    apply(ctx) {
      if (!S.videoDnaOn) return;
      ZenEngine.injectCSS();
      let dnaEl = null;
      let active = true;
      const build = () => {
        if (!active) return false;
        const vid = ie.el();
        if (!vid || !vid.duration || !isFinite(vid.duration)) return false;
        const progressBar = document.querySelector(".ytp-progress-bar-container");
        if (!progressBar) return false;
        if (dnaEl && dnaEl.parentNode) dnaEl.remove();
        dnaEl = document.createElement("div");
        dnaEl.id = "ytp-zen-dna";
        const canvas = document.createElement("canvas");
        canvas.width = 800;
        canvas.height = 18;
        dnaEl.appendChild(canvas);
        progressBar.style.position = "relative";
        progressBar.appendChild(dnaEl);
        ZenPlayback.renderDNA(canvas, vid.duration, ZenPlayback.getHeatmap());
        return true;
      };
      ZenEngine.scheduleOnReady(ctx, build, { attempts: 10, delayMs: 500 });
      ctx.addListener(document, "yt-navigate-finish", () => ctx.addTimeout(build, 0));
      Yt["video-dna"].push(() => {
        active = false;
        if (dnaEl && dnaEl.parentNode) dnaEl.remove();
        dnaEl = null;
      });
    },
    settings(en) { en.appendChild(Io("Enable Video DNA Timeline", "videoDnaOn")); } });

  xa.register({ id: "smart-speed", name: "Smart Speed", summary: "Automatically adjusts playback speed based on content density.", masterKey: "smartSpeedOn", keys: ["smartSpeedOn", "smartSpeedBase", "smartSpeedFast"],
    apply(ctx) {
      if (!S.smartSpeedOn) return;
      const baseRate = S.smartSpeedBase || 1;
      const fastRate = S.smartSpeedFast || 1.5;
      let lastTarget = 0;
      const tick = () => {
        const vid = ie.el();
        if (!vid || vid.paused || vid.ended) return;
        if (_isLiveStream()) { if (Math.abs(vid.playbackRate - 1) > 0.01) vid.playbackRate = 1; return; }
        const a = ZenPlayback.readEnergy(vid);
        if (!a.active) return;
        let target = baseRate;
        if (a.isSpeech && !a.isQuiet) target = fastRate;
        if (a.isQuiet) target = fastRate;
        if (Math.abs(vid.playbackRate - target) > 0.1) {
          vid.playbackRate = target;
          lastTarget = target;
        }
      };
      const start = () => {
        const vid = ie.el();
        if (vid) {
          ctx.addInterval(tick, 1500);
          if (!ctx._zenSpeedStarted) {
            ctx._zenSpeedStarted = true;
            ctx.addListener(vid, "play", () => ctx.addTimeout(tick, 300));
          }
        }
      };
      ZenEngine.scheduleOnReady(ctx, start, { attempts: 8, delayMs: 400 });
      Yt["smart-speed"].push(() => {
        const vid = ie.el();
        if (vid && lastTarget) vid.playbackRate = S.speedDefault || 1;
        lastTarget = 0;
        ZenPlayback.release(vid);
      });
    },
    settings(en) {
      en.appendChild(Io("Enable Smart Speed", "smartSpeedOn"));
      en.appendChild(No("Normal speed", "smartSpeedBase", 0.75, 1.25, 0.05, v => v.toFixed(2) + "x"));
      en.appendChild(No("Fast speed", "smartSpeedFast", 1.25, 3, 0.05, v => v.toFixed(2) + "x"));
    } });

  xa.register({ id: "living-sidebar", name: "Living Sidebar", summary: "Context-aware sidebar that transforms based on page type.", masterKey: "livingSidebarOn", keys: ["livingSidebarOn"],
    apply(ctx) {
      if (!S.livingSidebarOn) return;
      ZenEngine.injectCSS();
      let panel = null;
      const build = () => {
        if (panel && panel.parentNode) return true;
        const secondary = document.querySelector("#secondary");
        if (!secondary) return false;
        if (!panel) {
          panel = document.createElement("div");
          panel.id = "ytp-zen-sidebar";
        }
        panel.replaceChildren();
        const heading = document.createElement("div");
        heading.style.cssText = "font-size:13px;font-weight:700;color:#fff;margin-bottom:6px";
        heading.textContent = "Zen Sidebar";
        panel.appendChild(heading);
        const meta = document.createElement("div");
        meta.className = "zen-meta";
        meta.textContent = "Based on your watch genome";
        meta.style.marginBottom = "8px";
        panel.appendChild(meta);
        const topics = ZenSession.genome.getTopTopics(6);
        if (topics.length) {
          topics.forEach(topic => {
            const chip = document.createElement("button");
            chip.className = "zen-chip";
            chip.style.margin = "2px";
            chip.textContent = topic;
            chip.addEventListener("click", () => { e.location.href = "/results?search_query=" + encodeURIComponent(topic); });
            panel.appendChild(chip);
          });
        } else {
          const hint = document.createElement("div");
          hint.className = "zen-meta";
          hint.textContent = "Watch a few videos to build topic shortcuts here.";
          panel.appendChild(hint);
        }
        const queueLine = document.createElement("div");
        queueLine.className = "zen-row";
        queueLine.style.cssText = "margin-top:8px;justify-content:space-between";
        const queueText = document.createElement("span");
        queueText.className = "zen-meta";
        queueText.textContent = "Queue: " + ZenQueue.size() + " videos · " + ce(Math.floor(ZenQueue.getTotalTime()));
        const queueBtn = document.createElement("button");
        queueBtn.className = "zen-btn";
        queueBtn.textContent = "Open queue";
        queueBtn.style.fontSize = "10px";
        queueBtn.addEventListener("click", () => {
          const vid = ie.videoId();
          if (vid) ZenQueue.add({ videoId: vid, title: ie.title() || vid, channel: ie.channel() || "", duration: ie.el() && ie.el().duration });
          pe("Queued current video.", 1200, "success");
        });
        queueLine.append(queueText, queueBtn);
        panel.appendChild(queueLine);
        const small = ZenSession.genome.getSmallChannels(3);
        if (small.length) {
          const smallHeading = document.createElement("div");
          smallHeading.className = "zen-meta";
          smallHeading.style.cssText = "margin:8px 0 4px";
          smallHeading.textContent = "Small creators you watch";
          panel.appendChild(smallHeading);
          small.forEach(([handle, info]) => {
            const chip = document.createElement("button");
            chip.className = "zen-chip";
            chip.style.margin = "2px";
            chip.textContent = info.name || handle;
            chip.addEventListener("click", () => { e.location.href = "/" + handle.replace(/^UC/, "") + "/videos"; });
            panel.appendChild(chip);
          });
        }
        secondary.prepend(panel);
        return true;
      };
      ZenEngine.scheduleOnReady(ctx, build, { attempts: 8, delayMs: 500 });
      ctx.onNav(() => ctx.addTimeout(build, 0));
      Yt["living-sidebar"].push(() => { if (panel && panel.parentNode) panel.remove(); panel = null; });
    },
    settings(en) { en.appendChild(Io("Enable Living Sidebar", "livingSidebarOn")); } });

  xa.register({ id: "inline-previews", name: "Inline Video Previews", summary: "Rich hover previews with channel stats and description summary.", masterKey: "inlinePreviewsOn", keys: ["inlinePreviewsOn"],
    apply(ctx) {
      if (!S.inlinePreviewsOn) return;
      ZenEngine.injectCSS();
      let hoverCard = null;
      let hoverTimer = 0;
      const showPreview = (el) => {
        const link = el.querySelector("a#thumbnail, a#video-title");
        if (!link) return;
        const href = link.getAttribute("href") || "";
        const m = href.match(/[?&]v=([A-Za-z0-9_-]{11})/);
        if (!m) return;
        if (hoverCard) hoverCard.remove();
        hoverCard = document.createElement("div");
        hoverCard.id = "ytp-zen-preview";
        const titleText = (el.querySelector("#video-title") || {}).textContent || "";
        const thumb = "https://i.ytimg.com/vi/" + m[1] + "/hqdefault.jpg";
        const titleNode = document.createElement("div");
        titleNode.style.cssText = "font-size:12px;font-weight:600;color:#fff";
        titleNode.textContent = String(titleText || m[1]);
        const metaNode = document.createElement("div");
        metaNode.className = "zen-meta";
        metaNode.style.marginTop = "4px";
        metaNode.textContent = "Preview";
        const thumbNode = document.createElement("div");
        thumbNode.className = "zen-thumb";
        thumbNode.style.cssText = "width:100%;height:120px;margin-bottom:6px;background-image:url('" + sanitizeUrlForCSS(thumb) + "')";
        hoverCard.append(thumbNode, titleNode, metaNode);
        const rect = el.getBoundingClientRect();
        hoverCard.style.left = Math.min(rect.right + 8, window.innerWidth - 320) + "px";
        hoverCard.style.top = rect.top + "px";
        document.body.appendChild(hoverCard);
      };
      const hidePreview = () => {
        if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = 0; }
        if (hoverCard) { hoverCard.remove(); hoverCard = null; }
      };
      const onOver = (ev) => {
        const card = ev.target.closest("ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer");
        if (!card) { clearTimeout(hoverTimer); return; }
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => showPreview(card), 400);
      };
      const onOut = (ev) => {
        if (!ev.target.closest("ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer")) {
          hidePreview();
        }
      };
      document.addEventListener("mouseover", onOver, { passive: true });
      document.addEventListener("mouseout", onOut, { passive: true });
      Yt["inline-previews"].push(() => {
        document.removeEventListener("mouseover", onOver);
        document.removeEventListener("mouseout", onOut);
        hidePreview();
      });
    },
    settings(en) { en.appendChild(Io("Enable Inline Video Previews", "inlinePreviewsOn")); } });

  xa.register({ id: "vibe-search", name: "Vibe Search", summary: "Search by describing the feeling. Translates to smart filter combinations.", masterKey: "vibeSearchOn", keys: ["vibeSearchOn"],
    apply(ctx) {
      if (!S.vibeSearchOn || !location.pathname.startsWith("/results")) return;
      ZenEngine.injectCSS();
      const container = document.createElement("div");
      container.id = "ytp-zen-vibe";
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Describe the vibe… e.g. calm short videos this week";
      input.autocomplete = "off";
      const goBtn = document.createElement("button");
      goBtn.className = "zen-btn";
      goBtn.textContent = "Search vibe";
      const hint = document.createElement("span");
      hint.className = "zen-hint";
      hint.textContent = "try: calm, short, recent, live, hd, subtitles";
      container.append(input, goBtn, hint);
      const submit = () => {
        const vibe = input.value.trim();
        if (!vibe) { pe("Type a vibe first.", 1500, "info"); return; }
        const params = ZenSearch.vibeToParams(vibe);
        const url = new URL("/results", location.origin);
        const current = new URLSearchParams(location.search).get("search_query") || "";
        url.searchParams.set("search_query", current || vibe);
        params.forEach((value, key) => url.searchParams.set(key, value));
        e.location.href = url.toString();
      };
      goBtn.addEventListener("click", submit);
      input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") submit(); });
      const insert = () => {
        if (container.parentNode) return true;
        const target = document.querySelector("ytd-section-list-renderer");
        if (!target) return false;
        target.parentNode.insertBefore(container, target);
        return true;
      };
      ZenEngine.scheduleOnReady(ctx, insert, { attempts: 8, delayMs: 400 });
      Yt["vibe-search"].push(() => {
        goBtn.removeEventListener("click", submit);
        if (container.parentNode) container.remove();
      });
    },
    settings(en) { en.appendChild(Io("Enable Vibe Search", "vibeSearchOn")); } });

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
      };
      ZenEngine.scheduleOnReady(ctx, recordCurrent, { attempts: 6, delayMs: 800 });
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

  // ─── Algorithm Intelligence Feature ───────────────────────────────────────
  xa.register({
    id: "algo-intelligence",
    name: "Algorithm Intelligence",
    summary: "Autonomous recommendation algorithm manipulation. Monitors your signals, classifies your profile, detects mismatches between what you want and what YouTube shows, and sends corrective signals to reshape your feed.",
    masterKey: "algoIntelligenceOn",
    keys: ["algoIntelligenceOn", "algoAutoTrain", "algoBlockTopics", "algoBlockKeywords", "algoScanInterval"],
    apply(ctx) {
      if (!S.algoIntelligenceOn) {
        AlgoEngine.stopMonitoring();
        return;
      }

      // Start watch optimizer (monitors playback and tracks signals)
      AlgoEngine.startMonitoring();
      Yt["algo-intelligence"].push(() => AlgoEngine.stopMonitoring());

      // Parse blocked topics from settings
      const blockedTopicsStr = String(S.algoBlockTopics || "");
      for (const t of blockedTopicsStr.split(/[,;\n]+/)) {
        const trimmed = t.trim().toLowerCase();
        if (trimmed) AlgoEngine.blockTopic(trimmed);
      }
      const blockedKwStr = String(S.algoBlockKeywords || "");
      for (const kw of blockedKwStr.split(/[,;\n]+/)) {
        const trimmed = kw.trim().toLowerCase();
        if (trimmed) AlgoEngine.blockKeyword(trimmed);
      }

      // Periodic negative signal scanning
      if (S.algoAutoTrain) {
        const scanInterval = Math.max(30, Number(S.algoScanInterval) || 120) * 1000;
        const doScan = async () => {
          if (document.hidden || _a()) return;
          try {
            await AlgoEngine.scanAndBlock(10);
          } catch (_) {}
        };
        ctx.addTimeout(doScan, 5000);
        ctx.addInterval(doScan, scanInterval);
      }
    },
    settings(en) {
      en.appendChild(Io("Enable Algorithm Intelligence", "algoIntelligenceOn"));
      en.appendChild(Io("Auto-scan and block mismatched recommendations", "algoAutoTrain"));
      en.appendChild(No("Scan interval (seconds)", "algoScanInterval", 30, 600, 10, v => v + "s"));
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

      // Profile display
      const profileDiv = document.createElement("div");
      profileDiv.className = "ytp-hist-note";
      profileDiv.style.cssText = "margin-top:8px;padding:8px;background:rgba(255,255,255,.03);border-radius:6px";
      const updateProfile = () => {
        const p = AlgoEngine.getProfile();
        const topicEntries = Object.entries(p.topics || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
        let html = "<strong>Your Algorithm Profile</strong><br>";
        html += "Videos tracked: " + p.totalWatched + " | Avg watch: " + p.avgWatchPct + "% | Signals: " + p.sessionSignals + "<br>";
        if (topicEntries.length) {
          html += "Top topics: ";
          html += topicEntries.map(([t, s]) => t + " (" + s + "%)").join(", ");
        } else {
          html += "Watch some videos to build your profile.";
        }
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

      const trainBtn = Oo("Train Algorithm", async () => {
        const topics = prompt("Enter topics to boost (comma-separated):", "tech, science, education");
        if (!topics) return;
        const topicList = topics.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
        trainBtn.disabled = true;
        trainBtn.textContent = "Training...";
        try {
          const result = await AlgoEngine.train(topicList, { maxNegative: 10 });
          const successes = result.results.filter(r => r.ok).length;
          pe("Training complete: " + successes + "/" + result.results.length + " signals sent.", 3000, "success");
        } catch (_) {
          pe("Training failed.", 2000, "error");
        }
        trainBtn.disabled = false;
        trainBtn.textContent = "Train Algorithm";
        updateProfile();
      });

      const analyzeBtn = Oo("Analyze Feed", () => {
        const analysis = AlgoEngine.analyzeHomepage();
        const mismatches = AlgoEngine.findMismatches();
        let msg = "Feed analysis: " + analysis.count + " recommendations. ";
        msg += "Topic distribution: " + Object.entries(analysis.topicDistribution).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, s]) => t + " " + s + "%").join(", ");
        msg += ". Mismatches: " + mismatches.length;
        pe(msg, 5000, "info");
      });

      actions.appendChild(scanBtn);
      actions.appendChild(trainBtn);
      actions.appendChild(analyzeBtn);
      en.appendChild(actions);
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


  // -- Local AI Summaries (Transformers.js, on-device, opt-in) --
  xa.register({ id: "local-ai", name: "Local AI Summaries", summary: "Summarizes video descriptions on-device with Transformers.js. Models download from Hugging Face on first use.", masterKey: "aiSummariesOn", keys: ["aiSummariesOn"],
    apply(ctx) {
      if (!S.aiSummariesOn) return;
      ZenEngine.injectCSS();
      let tx = null;
      const load = async () => {
        if (tx) return tx;
        const r = await ZenEngine.fetchJson("https://cdn.jsdelivr.net/npm/@huggingface/transformers@2.17.2/dist/transformers.min.js", { timeout: 60000 });
        if (!r.ok || !r.text) throw new Error("Failed to download Transformers.js");
        const mod = new Function("self", "window", "globalThis", r.text + "\nreturn typeof transformers !== 'undefined' ? transformers : null;");
        const m = mod(globalThis, globalThis, globalThis);
        if (!m) throw new Error("Transformers.js failed to initialize");
        tx = m;
        return m;
      };
      const mount = () => {
        if (!location.pathname.startsWith("/watch")) return true;
        if (document.getElementById("ytp-zen-ai")) return true;
        const desc = document.querySelector("#description-inline-expander #plain-suggestive-description span, #attributed-description #plain-suggestive-description, ytd-text-inline-expander yt-formatted-string#plain-suggestive-description span, ytd-watch-metadata #description yt-attributed-string, meta[name=\"description\"]");
        if (!desc) return true;
        const box = document.createElement("div");
        box.id = "ytp-zen-ai";
        const hdr = document.createElement("div");
        hdr.className = "zen-ai-hdr";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Summarize on-device";
        hdr.appendChild(btn);
        const body = document.createElement("div");
        body.className = "zen-ai-body";
        const note = document.createElement("div");
        note.className = "zen-ai-note";
        note.textContent = "Runs locally in your browser. First run downloads the model (~250MB) from Hugging Face.";
        box.append(hdr, body, note);
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          btn.textContent = "Loading model\u2026";
          try {
            const m = await load();
            const text = (desc.textContent || desc.content || "").replace(/\s+/g, " ").trim().slice(0, 1200);
            if (!text) { body.textContent = "No description text available to summarize."; return; }
            btn.textContent = "Summarizing\u2026";
            const pipe = await m.pipeline("summarization", "Xenova/distilbart-cnn-6-6");
            const out = await pipe(text, { max_length: 80, min_length: 20 });
            body.textContent = (out && out[0] && out[0].summary_text) || "No summary produced.";
          } catch (err) {
            body.textContent = "Local AI failed: " + (err && err.message ? err.message : String(err));
          } finally {
            btn.disabled = false;
            btn.textContent = "Summarize on-device";
          }
        });
        const anchor = desc.closest("ytd-text-inline-expander, ytd-watch-metadata") || desc.parentElement;
        if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(box, anchor.nextSibling);
        return true;
      };
      ZenEngine.scheduleOnReady(ctx, mount, { attempts: 8, delayMs: 500 });
      ctx.onNav(() => ctx.addTimeout(mount, 0));
      Yt["local-ai"].push(() => {
        const el = document.getElementById("ytp-zen-ai");
        if (el) el.remove();
      });
    },
    settings(en) { en.appendChild(Io("Enable Local AI Summaries (Transformers.js)", "aiSummariesOn")); } });
