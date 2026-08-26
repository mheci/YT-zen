
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
#ytp-zen-focus-overlay,#ytp-zen-shorts-gate{position:fixed;inset:0;z-index:2147483642;display:flex;
  align-items:center;justify-content:center;background:rgba(8,9,12,.72);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);animation:zenFocusIn .35s ease}
.zen-focus-card{max-width:min(420px,calc(100vw - 48px));padding:28px 26px;text-align:center;
  background:rgba(18,20,27,.92);border:1px solid rgba(255,255,255,.1);border-radius:16px;
  box-shadow:0 24px 70px rgba(0,0,0,.55)}
.zen-focus-card::before{content:"";display:block;width:44px;height:3px;margin:0 auto 18px;
  border-radius:2px;background:linear-gradient(90deg,transparent,#ff3d7f,transparent);
  animation:zenBreath 2.6s ease-in-out infinite}
.zen-focus-title{font:700 17px system-ui;color:#fff;margin-bottom:10px}
.zen-focus-body{font:400 13px/1.6 system-ui;color:#aab;margin:0 0 20px}
.zen-focus-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
@keyframes zenFocusIn{from{opacity:0}to{opacity:1}}
@keyframes zenBreath{0%,100%{opacity:.45;transform:scaleX(.7)}50%{opacity:1;transform:scaleX(1)}}
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
    //
    // Retries use fire-and-forget timers on purpose: registering every retry
    // as a ctx-tracked cleanup grows the context's teardown array by one
    // entry per attempt per navigation for the whole session. The chains are
    // self-terminating (bounded attempts), fn() is expected to be idempotent,
    // and failures are swallowed, so untracked timers are safe here.
    const scheduleOnReady = (ctx, fn, opts = {}) => {
      const attempts = Math.max(1, Number(opts.attempts) || 5);
      const delayMs = Math.max(50, Number(opts.delayMs) || 400);
      const attempt = (left, ms) => {
        setTimeout(() => {
          let ok = false;
          try { ok = !!fn(); } catch (_) {}
          if (!ok && left > 1) attempt(left - 1, ms);
        }, ms);
      };
      attempt(attempts, 0);
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
      // Status nodes carry only a class; the old [id$="-status"] query
      // never matched anything.
      const el = panel && panel.querySelector(".zen-status");
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
        // The resume-on-play listener below only covers FUTURE play events;
        // a context created while autoplay-blocked during active playback
        // stayed suspended forever (silent output + zeroed analysis).
        try { if (ctx.state === "suspended") ctx.resume(); } catch (_) {}
        // One reusable frequency buffer per analyser: readEnergy() runs on a
        // cadence and allocating a fresh Uint8Array per read churned GC.
        const entry = { ctx, source, analyser, stream, rerouted, buf: new Uint8Array(analyser.frequencyBinCount) };
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
      const buf = entry.buf;
      entry.analyser.getByteFrequencyData(buf);
      let sum = 0, speechBand = 0;
      for (let i = 0; i < buf.length; i++) { sum += buf[i]; if (i > 10 && i < 80) speechBand += buf[i]; }
      const avg = sum / buf.length;
      // Bins 11..79 inclusive = 69 samples; dividing by 70 skewed the
      // speech metric ~1.4% below the energy scale it is thresholded on.
      const speech = speechBand / Math.max(1, Math.min(69, buf.length - 11));
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
      // InnerTube expects duration/date filters under the `params` body key
      // as RAW base64; the stored templates are percent-encoded for URLs, so
      // decode here. Sending `sp:` (the old shape) made every filter a no-op.
      const p = sp ? { params: decodeURIComponent(String(sp)) } : {};
      const response = await ZenEngine.innerTube("search", Object.assign({ context: Mt(), query }, p));
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

      // Compile the whole taxonomy exactly once. Compiling per classify()
      // call built ~1,000 RegExp objects per video card (and re-ran for every
      // homepage card on every scan), which dominated CPU during scans and
      // watch tracking.
      let compiledTaxonomy = null;
      const escapeRe = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const compileTaxonomy = () => {
        if (compiledTaxonomy) return compiledTaxonomy;
        const compiled = [];
        for (const [topic, keywords] of Object.entries(TOPIC_TAXONOMY)) {
          const patterns = [];
          for (const kw of keywords) {
            try { patterns.push(new RegExp("\\b" + escapeRe(kw) + "\\b", "gi")); } catch (_) {}
          }
          if (patterns.length) compiled.push([topic, patterns]);
        }
        compiledTaxonomy = compiled;
        return compiled;
      };

      const classify = (metadata) => {
        if (!metadata) return {};
        // Cards without a video id (some feed renderers) previously bypassed
        // the cache entirely; fall back to a stable text-derived key.
        const cacheKey = metadata.videoId ||
          (metadata.title ? "t:" + String(metadata.title).toLowerCase() : "");
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
        let total = 0;
        for (const [topic, patterns] of compileTaxonomy()) {
          let score = 0;
          for (const regex of patterns) {
            const matches = text.match(regex);
            if (matches) score += matches.length;
          }
          if (score > 0) { scores[topic] = score; total += score; }
        }

        // Normalize scores to percentages
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

      // Watch-progress milestones: while a video plays, playback monitors
      // call trackWatch() on a fixed cadence, and every call used to rewrite
      // the whole signals blob to storage (debounced). Recording only when
      // the watch percentage moved meaningfully keeps the profile identical
      // while removing most of those writes.
      const MILESTONE_PCT = 5;
      const MILESTONE_MIN_MS = 45000;
      const lastMilestone = new Map();

      const shouldRecordWatch = (videoId, pct) => {
        const at = Date.now();
        const prev = lastMilestone.get(videoId);
        if (!prev) {
          lastMilestone.set(videoId, { at, pct });
          if (lastMilestone.size > 64) {
            let oldestKey = null;
            let oldestAt = Infinity;
            for (const [key, value] of lastMilestone) {
              if (value.at < oldestAt) { oldestAt = value.at; oldestKey = key; }
            }
            if (oldestKey !== null && oldestKey !== videoId) lastMilestone.delete(oldestKey);
          }
          return true;
        }
        if (Math.abs(pct - prev.pct) >= MILESTONE_PCT || at - prev.at >= MILESTONE_MIN_MS) {
          lastMilestone.set(videoId, { at, pct });
          return true;
        }
        return false;
      };

      const trackWatch = (videoId, watchTime, duration) => {
        if (!videoId) return;
        const pct = duration > 0 ? Math.min(100, Math.round((watchTime / duration) * 100)) : 0;
        if (!shouldRecordWatch(videoId, pct)) return;
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
        lastMilestone.clear();
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
            SignalTracker.trackFeedback(feedbackToken, action || "feedback");
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
        // Draw from the dedicated "search" bucket: sharing "browse" with
        // channel boosts drained both budgets and left stats().search
        // permanently reporting a bucket nothing consumed.
        if (!query || !RateLimiter.canProceed("search")) return false;
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
    //
    // Feedback tokens are extracted lazily: serializing every card's Polymer
    // data on each scan cost tens of JSON.stringify calls over large objects,
    // while only the handful of cards actually being blocked ever needs a
    // token. Extraction prefers Polymer's public element `.data` and falls
    // back to the private `__data` for older builds.
    const extractMenuTokens = (menuEl) => {
      const empty = { notInterestedToken: "", dontRecommendToken: "" };
      try {
        if (!menuEl) return empty;
        const source = menuEl.data !== undefined ? menuEl.data : menuEl.__data;
        if (!source) return empty;
        const dataStr = typeof source === "string" ? source : JSON.stringify(source);
        if (!dataStr) return empty;
        // Anchor tokens to their intent marker within a bounded window; the
        // previous lazy pattern captured ":" between quotes on real payloads
        // and missed case variants entirely.
        const niMatch = dataStr.match(/[Nn]ot[Ii]nterested[\s\S]{0,240}?"feedbackToken":"([^"]+)"/);
        const drMatch = dataStr.match(/[Dd]ont[Rr]ecommend[\s\S]{0,240}?"feedbackToken":"([^"]+)"/);
        return {
          notInterestedToken: niMatch ? niMatch[1] : "",
          dontRecommendToken: drMatch ? drMatch[1] : "",
        };
      } catch (_) {
        return empty;
      }
    };
    const recWithLazyTokens = (rec, menuEl) => {
      Object.defineProperties(rec, {
        notInterestedToken: { configurable: true, get() { return extractMenuTokens(menuEl).notInterestedToken; } },
        dontRecommendToken: { configurable: true, get() { return extractMenuTokens(menuEl).dontRecommendToken; } },
      });
      return rec;
    };
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
            const menuEl = item.querySelector("ytd-menu-renderer");

            const topics = ContentClassifier.classify({ title, channelName: channel, videoId });
            recommendations.push(recWithLazyTokens({ videoId, title, channel, topics }, menuEl));
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
        // Number.isFinite so an explicit maxNegative:0 (disable the negative
        // phase) is honored instead of coerced to the default 10.
        const negLimit = Number.isFinite(opts.maxNegative) ? opts.maxNegative : 10;
        for (const mismatch of mismatches.slice(0, negLimit)) {
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
      let tickerId = 0;
      let skipSignals = 0;
      const skipLatched = new Set();

      const start = () => {
        if (monitoring) return;
        monitoring = true;

        // SharedTicker pauses in hidden tabs, so a backgrounded player never
        // burns cycles on classification and profile scans.
        tickerId = ZenResources.SharedTicker.add(() => {
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

          // If unwanted content and we've watched enough to register a skip
          // signal. Latch per video: the 10s ticker otherwise counts one
          // partial view as ~dozens of "skips".
          if (!skipLatched.has(videoId) && unwantedScore > wantedScore && currentTime > 5 && currentTime < duration * 0.3) {
            skipLatched.add(videoId);
            skipSignals++;
          }

          // Micro-feedback: strong alignment → positive signal; blocked topic
          // watched partially → negative signal (both rate-limited).
          const pct = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;
          MicroFeedback.maybeAutoLike(videoId, topics, pct, profile);
          MicroFeedback.maybeAutoDislike(videoId, topics, pct, unwantedScore, wantedScore);
        }, 10000, { pauseHidden: true, label: "algo-watch-optimizer" });
      };

      const stop = () => {
        monitoring = false;
        if (tickerId) {
          ZenResources.SharedTicker.remove(tickerId);
          tickerId = 0;
        }
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
            // Deliberately NOT recorded via trackWatch: channel ids are not
            // video ids, and a fabricated 100%-watch row poisoned the topic
            // profile and watch statistics.
            if (ok) done++;
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
        // Deliberately separate from the auto-LIKE gate: silently sending
        // dislike signals as a side effect of enabling auto-like was a
        // surprising, user-hostile coupling. Auto-dislike is its own opt-in.
        if (!videoId || !S.algoAutoDislikeOn) return;
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
      // Prefer Polymer's public element data; `__data` is the legacy fallback.
      const extractTokenFromItem = (item) => {
        try {
          const source = item && item.data !== undefined ? item.data : (item && item.__data);
          if (!source) return "";
          const dataStr = typeof source === "string" ? source : JSON.stringify(source);
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
    summary: "Replaces algorithmic traps with a clean, topic-filtered video discovery engine cross-checked against your history.",
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
      // Lookups run in small parallel batches: one IDB round-trip per
      // candidate in series stalled every topic load noticeably.
      const HISTORY_BATCH = 12;
      const seen = new Set();
      const isWatched = async (videoId) => {
        try { return !!(await v("history", videoId)); } catch (_) { return false; }
      };
      const filterUnwatched = async (videos) => {
        const kept = [];
        for (let i = 0; i < videos.length; i += HISTORY_BATCH) {
          const chunk = videos.slice(i, i + HISTORY_BATCH);
          const watched = await Promise.all(chunk.map((video) => isWatched(video && video.videoId)));
          for (let j = 0; j < chunk.length; j++) {
            const video = chunk[j];
            if (!video || !video.videoId || seen.has(video.videoId) || sessionShown.has(video.videoId)) continue;
            if (watched[j]) continue;
            seen.add(video.videoId);
            kept.push(video);
          }
        }
        return kept;
      };
      const fetchFresh = async (category) => {
        const spec = DISCOVER_CATEGORIES[category];
        if (!spec) return [];
        const fresh = [];
        for (const sp of DISCOVER_SEARCH_SP) {
          if (fresh.length >= DISCOVER_MIN_VIDEOS) break;
          let list = [];
          try { list = await ZenSearch.search(spec.query, sp); } catch (_) {}
          fresh.push(...await filterUnwatched(list));
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
            // Bound retention: a very long session resets the seen-set instead
            // of growing it without limit across route changes.
            if (sessionShown.size > 2000) sessionShown.clear();
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

  xa.register({ id: "credibility-layer", name: "Credibility Layer", summary: "Adds informational metadata badges including upload age, reach tiers, and historical consistency to video cards.", masterKey: "credLayerOn", keys: ["credLayerOn"],
    apply(ctx) {
      if (!S.credLayerOn) return;
      ZenEngine.injectCSS();
      const processCards = () => {
        let added = 0;
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
          added++;
          if (info.age && info.age > 730) {
            const ab = document.createElement("span");
            ab.className = "zen-cred-badge";
            ab.style.cssText = "background:rgba(255,152,0,.12);color:#ffb74d";
            ab.textContent = Math.floor(info.age / 365) + "y old";
            ab.title = "Over 2 years old. May be outdated.";
            meta.appendChild(ab);
          }
        });
        return added;
      };
      // Platform-managed rescan cadence: nudged by mutations and navigation
      // (priority — new cards are badged within the minimum gap), with an
      // idle tick that backs off while scans report nothing new. Hidden tabs
      // never scan.
      const scanner = ZenResources.ScanScheduler.create(processCards, {
        intervalMs: 3000,
        minGapMs: 250,
        maxBackoffMs: 10000,
        label: "credibility",
      });
      scanner.request({ priority: true });
      scanner.start();
      ctx.onNav(() => scanner.request({ priority: true }));
      ctx.addObserver(document.body, () => scanner.request({ priority: true }), { childList: true, subtree: true });
      Yt["credibility-layer"].push(() => scanner.dispose());
    },
    settings(en) { en.appendChild(Io("Enable Credibility Layer", "credLayerOn")); } });

  xa.register({ id: "dead-link-detector", name: "Outdated Content Detector", summary: "Flags outdated videos and stale technical tutorials with visible age warning indicators on search thumbnails.", masterKey: "deadLinkOn", keys: ["deadLinkOn"],
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

  xa.register({ id: "curated-collections", name: "Curated Collections", summary: "Organize your saved videos into custom-themed collections with progress tracking and exportable playlists.", masterKey: "collectionsOn", keys: ["collectionsOn"],
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

  // ─── Algorithm Intelligence Feature (V2: full-spectrum) ────────────────────
  xa.register({
    id: "algo-intelligence",
    name: "Algorithm Intelligence",
    summary: "Advanced algorithmic feed shaping: organic interest boosting, recency decay control, and diversity enforcement.",
    masterKey: "algoIntelligenceOn",
    keys: ["algoIntelligenceOn", "algoAutoTrain", "algoBlockTopics", "algoBlockKeywords", "algoBlockChannels", "algoScanInterval", "algoStrength", "algoBoostOn", "algoBoostInterval", "algoDiversityOn", "algoDiversityMax", "algoAutoLikeOn", "algoAutoLikePct", "algoAutoDislikeOn", "algoShortsOn"],
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
      en.appendChild(Io("Auto-dislike clearly-unwanted watches", "algoAutoDislikeOn"));
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
  // -- Return YouTube Dislike: like/dislike ratio + rating --
  // -- Keep Screen Awake (Wake Lock API) --
  xa.register({ id: "screen-wake", name: "Keep Screen Awake", summary: "Prevents system sleep, screensavers, and display timeouts during active video playback via the Wake Lock API.", masterKey: "screenWakeOn", keys: ["screenWakeOn"],
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
    summary: "Five comprehensive optimization presets (light to maximum) with DOM containment and lazy-loading virtualization.",
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
      // on() is called with display-case keys ("MemoryTrim") but TIERS use
      // camelCase — normalize so tier contributions actually resolve
      // instead of always reading undefined.
      const on = (k) => !!S["perf" + k] || !!tier[k[0].toLowerCase() + k.slice(1)];

      // Level ⇄ toggle sync: writing the level writes the granular keys so the
      // settings checkboxes always reflect exactly what the level enables.
      // Gated by a persisted per-level marker: syncing unconditionally on
      // every apply snapped the user's granular overrides back to the preset.
      const syncLevelToggles = (force) => {
        const lvl = S.perfModeLevel || "balanced";
        if (!force && S.perfLevelSyncedFor === lvl) return;
        S.perfLevelSyncedFor = lvl;
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
          syncLevelToggles(true);
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
    summary: "Consolidates all floating performance monitors, counters, and diagnostic tools into a single docked glass HUD.",
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
          if (!S.overlayHubOn || !document.body) { removeContainer(); return 0; }
          const widgets = document.querySelectorAll(ADOPT_SELECTOR);
          let count = 0;
          for (const w of widgets) {
            if (w.closest("#" + CONTAINER_ID)) continue;
            const hub = getHub();
            if (!hub) return count;
            hub.appendChild(w);
            count++;
          }
          const hub = document.getElementById(CONTAINER_ID);
          if (!hub) return count;
          if (count === 0) {
            if (collapsed) return 0;
            if (!hub.querySelector(".ytp-mon-empty")) {
              const empty = document.createElement("div");
              empty.className = "ytp-mon-empty";
              empty.textContent = "Enable a monitor to attach it here.";
              hub.appendChild(empty);
            }
            return 0;
          }
          const emptyEl = hub.querySelector(".ytp-mon-empty");
          if (emptyEl) emptyEl.remove();
          position();
          return count;
        } catch (_) {
          return 0;
        }
      };

      adopt();
      // Safety-net sweep with idle backoff: the poll exists to catch monitor
      // widgets injected outside our hooks. After six consecutive empty scans
      // it sweeps at most once per ~4s instead of every 500ms; any hit or
      // direct adopt() call (toggle/nav paths) restores fast sweeping. The
      // early-out is counter-only, so idling creates no timers and no
      // teardown entries.
      const wakeSweep = () => {
        quietScans = 0;
        idleTicks = 0;
        return adopt();
      };
      let quietScans = 0;
      let idleTicks = 0;
      ctx.addInterval(() => {
        if (quietScans >= 6) {
          idleTicks += 1;
          if (idleTicks % 8 !== 0) return;
          idleTicks = 0;
        }
        const found = adopt();
        if (found > 0) { quietScans = 0; idleTicks = 0; }
        else if (quietScans < 6) quietScans += 1;
      }, 500);
      ctx.onNav(() => ctx.addTimeout(wakeSweep, 600));

      const unsub = So("cfg.changed", ({ key: k }) => {
        if (k === "overlayHubOn") wakeSweep();
        if (k === "overlayHubPos") position();
      });
      Yt["overlay-hub"].push(() => {
        try { if (typeof unsub === "function") unsub(); } catch (_) {}
        removeContainer();
      });
    },
    settings(en) {
      en.appendChild(Io("Enable Monolith Overlay Hub", "overlayHubOn"));
      en.appendChild(Ro("Hub Position", "overlayHubPos", {
        tl: "Top-left",
        tr: "Top-right",
        bl: "Bottom-left",
        br: "Bottom-right",
      }));
      en.appendChild(To("div", "ytp-elem-sec-title", "Monitors & Overlays"));
      en.appendChild(Io("Live FPS Counter", "fpsCounterOn"));
      en.appendChild(Io("Buffer Health Monitor", "bufferHealthOn"));
      en.appendChild(Io("Dropped Frame Counter", "droppedFrameOn"));
      en.appendChild(Io("Playback Performance Overlay", "statsOverlay"));
      en.appendChild(Io("Activity Diagnostic Monitor", "diagConsole"));
      en.appendChild(Io("Feature Performance Tracker", "perfProfilerOn"));
      const info = document.createElement("div");
      info.className = "ytp-hist-note";
      info.style.marginTop = "8px";
      info.innerHTML = "<strong>Monolith Overlay Hub:</strong> Consolidates all active floating performance meters and diagnostic tools into a single, unified docked glass HUD.";
      en.appendChild(info);
    },
  });

  // ─── Watch-Budget Focus Mode ───────────────────────────────────────────────
  // A gentle daily watch budget. Usage accrues one second at a time, only
  // while a video is actually playing on a visible watch page; the interval
  // is registry-managed, so hidden tabs never count. At 80% a single toast
  // nudges; at 100% a calm full-screen invitation appears with real escape
  // hatches: break until midnight (persisted), up to three five-minute
  // extensions per day (persisted), or Esc for ten minutes (in memory).
  // Nothing is ever force-paused — "Take a break" pauses as a courtesy.
  xa.register({
    id: "watch-budget",
    name: "Watch-Budget Focus Mode",
    summary: "Sets a gentle daily watch budget with soft nudges and a calm stop screen; only visible playback counts toward it.",
    masterKey: "watchBudgetOn",
    keys: ["watchBudgetOn", "watchBudgetMinutes"],
    apply(ctx) {
      if (!S.watchBudgetOn) return;
      ZenEngine.injectCSS();
      const EXTENSION_SEC = 300;
      const MAX_EXTENSIONS = 3;
      const focusStore = ZenEngine.createStore("__zen_focus__", { date: "", nudged: false, extCount: 0, snoozedDay: "" });
      const today = () => new Date().toDateString();
      const rollDay = () => focusStore.update(d => {
        if (d.date !== today()) { d.date = today(); d.nudged = false; d.extCount = 0; d.snoozedDay = ""; }
      });
      const budgetMin = () => Math.max(5, Math.min(1440, Number(S.watchBudgetMinutes) || 90));
      const usedSec = () => { try { return ZenSession.budget.getUsed(); } catch (_) { return 0; } };
      const limitSec = () => {
        rollDay();
        return budgetMin() * 60 + (focusStore.get().extCount || 0) * EXTENSION_SEC;
      };
      const remainingMin = () => Math.max(0, Math.round((limitSec() - usedSec()) / 60));
      const snoozedToday = () => { rollDay(); return focusStore.get().snoozedDay === today(); };

      let overlay = null;
      let softSnoozeUntil = 0;
      const removeOverlay = () => {
        if (overlay && overlay.parentNode) overlay.remove();
        overlay = null;
      };
      const showStatus = () => {
        if (snoozedToday()) pe("Zen focus: today's budget is done. See you tomorrow.", 3200, "info");
        else {
          const left = remainingMin();
          pe(left > 0
            ? "Zen focus: about " + left + " min left of your " + budgetMin() + " min daily budget."
            : "Zen focus: today's watch budget is used up.", 3200, "info");
        }
      };
      const buildOverlay = () => {
        overlay = document.createElement("div");
        overlay.id = "ytp-zen-focus-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-label", "Daily watch budget reached");
        const card = document.createElement("div");
        card.className = "zen-focus-card";
        const title = document.createElement("div");
        title.className = "zen-focus-title";
        title.textContent = "Today's watch budget is used up";
        const body = document.createElement("p");
        body.className = "zen-focus-body";
        card.append(title, body);
        const row = document.createElement("div");
        row.className = "zen-focus-row";
        const breakBtn = document.createElement("button");
        breakBtn.type = "button";
        breakBtn.className = "zen-btn primary";
        breakBtn.textContent = "Take a break";
        breakBtn.addEventListener("click", () => {
          try { ie.pause(); } catch (_) {}
          focusStore.update(d => { d.snoozedDay = today(); });
          removeOverlay();
        });
        const moreBtn = document.createElement("button");
        moreBtn.type = "button";
        moreBtn.className = "zen-btn";
        moreBtn.addEventListener("click", () => {
          rollDay();
          focusStore.update(d => { d.extCount = Math.min(MAX_EXTENSIONS, (d.extCount || 0) + 1); });
          removeOverlay();
        });
        row.append(breakBtn, moreBtn);
        card.appendChild(row);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
      };
      const refreshOverlay = () => {
        rollDay();
        const ext = focusStore.get().extCount || 0;
        const left = remainingMin();
        const body = overlay.querySelector(".zen-focus-body");
        if (body) body.textContent = "You have watched through your " + budgetMin() + " minute budget" +
          (ext ? " plus " + ext * 5 + " extension minutes" : "") + ". About " + left +
          " grace minutes are shown only because time keeps counting while you decide.";
        const moreBtn = overlay.querySelector(".zen-focus-row button:not(.primary)");
        if (moreBtn) {
          moreBtn.textContent = ext >= MAX_EXTENSIONS
            ? "No extensions left"
            : "5 more minutes (" + (MAX_EXTENSIONS - ext) + " left)";
          moreBtn.disabled = ext >= MAX_EXTENSIONS;
        }
      };
      const ensureOverlay = () => {
        if (!document.body) return;
        if (!overlay) buildOverlay();
        refreshOverlay();
      };

      ctx.addInterval(() => {
        try {
          if (!location.pathname.startsWith("/watch")) { removeOverlay(); return; }
          if (Date.now() < softSnoozeUntil) return;
          if (snoozedToday()) { removeOverlay(); return; }
          const vid = ie.el();
          if (!vid || vid.paused || vid.ended) return;
          try { ZenSession.budget.tick(1); } catch (_) {}
          const limit = limitSec();
          const used = usedSec();
          rollDay();
          if (!focusStore.get().nudged && used >= limit * 0.8 && used < limit) {
            focusStore.update(d => { d.nudged = true; });
            pe("Zen focus: about " + remainingMin() + " min left in today's watch budget.", 4000, "info");
          }
          if (used >= limit) ensureOverlay();
          else removeOverlay();
        } catch (_) {}
      }, 1000);

      // SPA navigation closes the invitation; the next playing second under
      // an exhausted budget re-opens it. Dismissal stays a decision, not a
      // side effect of browsing.
      ctx.onNav(() => removeOverlay());

      ctx.addListener(document, "keydown", (ev) => {
        if (ev.repeat) return;
        const t = ev.target;
        const tag = t && t.tagName ? String(t.tagName).toUpperCase() : "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!(t && t.isContentEditable)) return;
        try {
          if (ev.key === "Escape" && overlay) {
            softSnoozeUntil = Date.now() + 600000;
            removeOverlay();
            return;
          }
          if (ev.shiftKey && !ev.ctrlKey && !ev.altKey && !ev.metaKey &&
              (ev.code === "KeyB" || ev.key === "B" || ev.key === "b")) {
            ev.preventDefault();
            showStatus();
          }
        } catch (err) {
          m("hotkey watch budget", err);
        }
      });

      Yt["watch-budget"].push(() => removeOverlay());
    },
    settings(en) {
      en.appendChild(Io("Enable Watch-Budget Focus Mode", "watchBudgetOn"));
      en.appendChild(No("Daily budget (minutes)", "watchBudgetMinutes", 15, 480, 5, v => v + "m"));
      const info = document.createElement("div");
      info.className = "ytp-hist-note";
      info.style.marginTop = "8px";
      info.innerHTML = "<strong>How it counts:</strong> only visible playback on watch pages accrues time. At 80% you get one gentle nudge; at 100% a calm screen offers a break or three five-minute extensions per day. Shortcut: Shift+B.";
      en.appendChild(info);
    },
  });

  // ─── Shorts Policy Schedule ────────────────────────────────────────────────
  // Time-window policy for /shorts beyond simple hide-or-block: "block"
  // pauses Shorts inside the configured window (work hours); "allow"
  // permits them only inside it (wind-down). Midnight-crossing windows are
  // handled by ZenResources.TimeWindow; malformed times deactivate the gate
  // instead of guessing. A session override keeps repeated visits calm.
  xa.register({
    id: "shorts-policy",
    name: "Shorts Policy Schedule",
    summary: "Time-window based Shorts handling: block Shorts during chosen hours, or allow them only within a wind-down window.",
    masterKey: "shortsScheduleOn",
    keys: ["shortsScheduleOn", "shortsScheduleMode", "shortsScheduleStart", "shortsScheduleEnd"],
    apply(ctx) {
      if (!S.shortsScheduleOn) return;
      ZenEngine.injectCSS();
      let gate = null;
      let overrideUntil = 0;
      const mode = () => (S.shortsScheduleMode === "allow" ? "allow" : "block");
      const windowText = () => String(S.shortsScheduleStart || "??:??") + " to " + String(S.shortsScheduleEnd || "??:??");
      const blockedNow = () => {
        if (overrideUntil && Date.now() < overrideUntil) return false;
        // Malformed/unset times deactivate the gate in BOTH modes: the old
        // `!active` made "allow" mode block Shorts 24/7 when the window was
        // missing or typo'd, contradicting the documented contract.
        if (!S.shortsScheduleStart || !S.shortsScheduleEnd) return false;
        if (ZenResources.TimeWindow.parseHHMM(S.shortsScheduleStart) === null) return false;
        if (ZenResources.TimeWindow.parseHHMM(S.shortsScheduleEnd) === null) return false;
        const active = ZenResources.TimeWindow.containsHHMM(S.shortsScheduleStart, S.shortsScheduleEnd);
        return mode() === "block" ? active : !active;
      };
      const removeGate = () => {
        if (gate && gate.parentNode) gate.remove();
        gate = null;
      };
      const enforce = () => {
        if (!location.pathname.startsWith("/shorts") || !blockedNow()) { removeGate(); return; }
        if (gate || !document.body) return;
        gate = document.createElement("div");
        gate.id = "ytp-zen-shorts-gate";
        gate.setAttribute("role", "dialog");
        gate.setAttribute("aria-label", "Shorts policy window active");
        const card = document.createElement("div");
        card.className = "zen-focus-card";
        const title = document.createElement("div");
        title.className = "zen-focus-title";
        const body = document.createElement("p");
        body.className = "zen-focus-body";
        if (mode() === "block") {
          title.textContent = "Shorts are paused right now";
          body.textContent = "You asked YT-zen to pause Shorts between " + windowText() + ". Everything else is still here.";
        } else {
          title.textContent = "Shorts are resting outside your window";
          body.textContent = "Shorts are available between " + windowText() + ". The rest of YouTube is untouched.";
        }
        const row = document.createElement("div");
        row.className = "zen-focus-row";
        const homeBtn = document.createElement("button");
        homeBtn.type = "button";
        homeBtn.className = "zen-btn primary";
        homeBtn.textContent = "Open YouTube Home";
        homeBtn.addEventListener("click", () => { try { e.location.href = "/"; } catch (_) {} });
        const anywayBtn = document.createElement("button");
        anywayBtn.type = "button";
        anywayBtn.className = "zen-btn";
        anywayBtn.textContent = "Watch anyway (30 min)";
        anywayBtn.addEventListener("click", () => {
          overrideUntil = Date.now() + 1800000;
          removeGate();
        });
        row.append(homeBtn, anywayBtn);
        card.append(title, body, row);
        gate.appendChild(card);
        document.body.appendChild(gate);
      };

      enforce();
      ctx.onNav(() => ctx.addTimeout(enforce, 0));
      // Window transitions can happen while parked on /shorts; re-check
      // gently. The interval is registry-managed and pauses when hidden.
      ctx.addInterval(enforce, 30000);
      Yt["shorts-policy"].push(() => removeGate());
    },
    settings(en) {
      en.appendChild(Io("Enable Shorts Policy Schedule", "shortsScheduleOn"));
      en.appendChild(Ro("Policy", "shortsScheduleMode", {
        block: "Block during the window (e.g. work hours)",
        allow: "Allow only during the window (e.g. wind-down)",
      }));
      en.appendChild(_o("Window start (HH:MM)", "shortsScheduleStart"));
      en.appendChild(_o("Window end (HH:MM)", "shortsScheduleEnd"));
      const info = document.createElement("div");
      info.className = "ytp-hist-note";
      info.style.marginTop = "8px";
      info.textContent = "Times use your local clock and may cross midnight (22:00 to 07:00). Malformed times keep the gate off rather than guessing.";
      en.appendChild(info);
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  FEATURE PACK v3.16 — 30 new advanced features
  // ---------------------------------------------------------------------------
  //  Domains: playback intelligence, study tools, wellbeing, privacy,
  //  accessibility, diagnostics. Every feature follows the registry contract:
  //  masterKey gate, ctx-managed timers/listeners, Yt[id] teardown, and an
  //  explicit settings panel.
  // ═══════════════════════════════════════════════════════════════════════════

  // Shared pack helpers ─────────────────────────────────────────────────────
  const ZenPack = (() => {
    // Bind a listener to the persistent media element exactly once per
    // element per apply-lifetime (registry is not cleared on SPA nav).
    const elBinder = () => {
      const bound = new WeakSet();
      return (ctx, ev, fn, opts) => {
        const el = ie.el();
        if (!el || bound.has(el)) return;
        bound.add(el);
        ctx.addListener(el, ev, fn, opts);
      };
    };
    const guardKey = (ev) => {
      const t = ev.target;
      const tag = t && t.tagName ? String(t.tagName).toUpperCase() : "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return !!(t && t.isContentEditable);
    };
    const fmtTs = (sec) => {
      const s = Math.max(0, Math.floor(sec || 0));
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
      return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(ss).padStart(2, "0");
    };
        const exportHooks = [];
    const settingsExportHook = { push(f) { if (typeof f === 'function') exportHooks.push(f); }, fire() { for (const f of exportHooks) { try { f(); } catch (_) {} } } };
    return { elBinder, guardKey, fmtTs, settingsExportHook };
  })();

  // ─── 1. Silence Skipper ──────────────────────────────────────────────────
  // Uses the shared audio graph: sustained quiet stretches fast-forward at a
  // configurable rate until sound returns. Never touches live streams or
  // Smart-Speed-managed playback.
  xa.register({
    id: "silence-skipper", name: "Silence Fast-Forward",
    summary: "Detects silent stretches through the audio analyser and quietly speeds through them.",
    masterKey: "silenceSkipOn", keys: ["silenceSkipOn", "silenceSkipRate"],
    apply(ctx) {
      if (!S.silenceSkipOn) return;
      ZenEngine.injectCSS();
      let boosted = false, prevRate = 1, quietMs = 0;
      const targetRate = () => Math.max(2, Math.min(8, Number(S.silenceSkipRate) || 4));
      const tick = () => {
        const vid = ie.el();
        if (!vid || vid.paused || vid.ended || _isLiveStream() || S.smartSpeedOn) {
          if (boosted && vid) { try { vid.playbackRate = prevRate; } catch (_) {} }
          boosted = false; quietMs = 0; return;
        }
        let energy = 128;
        try { energy = ZenPlayback.readEnergy(vid).energy; } catch (_) {}
        if (energy < 4) quietMs += 500; else quietMs = 0;
        if (quietMs >= 1500 && !boosted) { try { prevRate = vid.playbackRate || 1; vid.playbackRate = targetRate(); boosted = true; } catch (_) {} }
        else if (energy >= 4 && boosted) { try { vid.playbackRate = prevRate; } catch (_) {} boosted = false; quietMs = 0; }
      };
      const id = ZenResources.SharedTicker.add(tick, 500, { pauseHidden: true, label: "zen-silence-skip" });
      Yt["silence-skipper"].push(() => {
        ZenResources.SharedTicker.remove(id);
        const vid = ie.el();
        if (boosted && vid) { try { vid.playbackRate = prevRate; } catch (_) {} }
      });
    },
    settings(en) {
      en.appendChild(Io("Fast-forward silent stretches", "silenceSkipOn"));
      en.appendChild(Ro("Skip speed", "silenceSkipRate", { 2: "2× gentle", 4: "4× (recommended)", 6: "6× brisk", 8: "8× aggressive" }));
    },
  });

  // ─── 2. Chapter Auto-Skip ────────────────────────────────────────────────
  // Skips chapters whose titles match user keywords, using YouTube's own
  // chapter markers extracted from ytInitialData.
  xa.register({
    id: "chapter-auto-skip", name: "Chapter Auto-Skip",
    summary: "Automatically skips chapters titled intro, outro, sponsor, and your own keywords.",
    masterKey: "chapterAutoSkipOn", keys: ["chapterAutoSkipOn", "chapterSkipWords"],
    apply(ctx) {
      if (!S.chapterAutoSkipOn) return;
      const words = () => String(S.chapterSkipWords || "").split(/[,;\n]+/).map(w => w.trim().toLowerCase()).filter(Boolean);
      let chapters = null, chVid = "";
      const loadChapters = () => {
        try {
          const vid = ie.videoId(); if (!vid || vid === chVid) return; chVid = vid;
          chapters = null;
          const pr = e.ytInitialPlayerResponse || {};
          const bar = pr.playerOverlays && pr.playerOverlays.playerOverlayRenderer &&
            pr.playerOverlays.playerOverlayRenderer.decoratedPlayerBarRenderer;
          const map = bar && bar.decoratedPlayerBarRenderer && bar.decoratedPlayerBarRenderer.playerBar &&
            bar.decoratedPlayerBarRenderer.playerBar.multiMarkersPlayerBarRenderer;
          const entries = map && map.markersMap && map.markersMap[0] && map.markersMap[0].value;
          const list = entries && entries.chapters;
          if (!Array.isArray(list)) return;
          chapters = list.map(c => ({
            t: (c.chapterRenderer && c.chapterRenderer.timeRangeStartMillis || 0) / 1000,
            title: (c.chapterRenderer && c.chapterRenderer.title && c.chapterRenderer.title.simpleText ||
              ((c.chapterRenderer.title.runs || []).map(r => r.text).join("")) || "").toLowerCase(),
          })).filter(c => c.title);
        } catch (_) { chapters = null; }
      };
      const binder = ZenPack.elBinder();
      const check = () => {
        loadChapters();
        if (!chapters || !chapters.length) return;
        const vid = ie.el(); if (!vid || vid.paused || _isLiveStream()) return;
        const kw = words(); if (!kw.length) return;
        const t = vid.currentTime;
        for (const c of chapters) {
          if (Math.abs(t - c.t) < 1.5 && kw.some(w => c.title.includes(w))) {
            const idx = chapters.indexOf(c);
            const next = chapters[idx + 1];
            if (next) { vid.currentTime = next.t + 0.5; pe("Zen skipped chapter: " + c.title.slice(0, 40), 1800, "info"); }
            break;
          }
        }
      };
      binder(ctx, "timeupdate", ZenResources.DeferredTask.debounce.bind(null, "zen-chskip", check, 400));
      ctx.addInterval(check, 2000);
      Yt["chapter-auto-skip"].push(() => { chapters = null; chVid = ""; });
    },
    settings(en) {
      en.appendChild(Io("Auto-skip matching chapters", "chapterAutoSkipOn"));
      en.appendChild(Ho("Skip keywords (comma-separated)", "chapterSkipWords", "intro, outro, sponsor, thanks"));
    },
  });

  // ─── 3. Video Bookmarks ──────────────────────────────────────────────────
  // Timestamped bookmarks persisted per video with a jumpable dashboard list.
  xa.register({
    id: "video-bookmarks", name: "Timestamp Bookmarks",
    summary: "Drop named bookmarks at timestamps (Alt+B), stored locally and jumpable anytime.",
    masterKey: "videoBookmarksOn", keys: ["videoBookmarksOn"],
    apply(ctx) {
      if (!S.videoBookmarksOn) return;
      ZenEngine.injectCSS();
      const marks = ZenEngine.createStore("__zen_bookmarks__", {});
      const cur = () => ie.videoId() || "";
      const add = async () => {
        const vid = cur(), el = ie.el(); if (!vid || !el) return;
        const row = { t: el.currentTime, note: "", at: Date.now() };
        marks.update(d => { (d[vid] = d[vid] || []).push(row); });
        pe("Bookmark at " + ZenPack.fmtTs(row.t), 1400, "success");
      };
      ctx.addListener(document, "keydown", (ev) => {
        if (ev.altKey && !ev.ctrlKey && !ev.metaKey && ev.code === "KeyB" && !ZenPack.guardKey(ev)) {
          ev.preventDefault(); add();
        }
      });
      // Jump list lives under the description area.
      const panel = document.createElement("div");
      panel.id = "ytp-zen-bm";
      panel.style.cssText = "display:none;margin:8px 0;font-size:12px;color:#eee";
      const render = () => {
        const vid = cur(); const list = marks.get()[vid] || [];
        panel.replaceChildren();
        const head = document.createElement("div");
        head.textContent = "Bookmarks (" + list.length + ") — Alt+B to add";
        head.style.cssText = "font-weight:600;margin-bottom:4px";
        panel.appendChild(head);
        list.forEach((row, i) => {
          const b = document.createElement("button");
          b.className = "zen-btn"; b.style.marginRight = "6px"; b.style.marginBottom = "4px";
          b.textContent = ZenPack.fmtTs(row.t);
          b.addEventListener("click", () => { const el = ie.el(); if (el) el.currentTime = row.t; });
          panel.appendChild(b);
        });
        panel.style.display = list.length ? "block" : "none";
      };
      marks.onChange(render);
      ZenEngine.scheduleOnReady(ctx, () => {
        const below = document.querySelector("#below") || document.querySelector("#description");
        if (!below) return false;
        if (!panel.parentNode) below.appendChild(panel);
        render(); return true;
      }, { attempts: 8, delayMs: 500 });
      ctx.onNav(render);
      Yt["video-bookmarks"].push(() => { if (panel.parentNode) panel.remove(); });
    },
    settings(en) { en.appendChild(Io("Enable timestamp bookmarks (Alt+B)", "videoBookmarksOn")); },
  });

  // ─── 4. Timestamped Notes ────────────────────────────────────────────────
  // Quick capture pad while watching; notes carry timestamps and export as
  // Markdown via download.
  xa.register({
    id: "timestamp-notes", name: "Study Notes",
    summary: "Jot timestamped notes while watching (Alt+N); export everything as Markdown.",
    masterKey: "timestampNotesOn", keys: ["timestampNotesOn"],
    apply(ctx) {
      if (!S.timestampNotesOn) return;
      ZenEngine.injectCSS();
      const notesStore = ZenEngine.createStore("__zen_notes__", {});
      let box = null;
      const cur = () => ie.videoId() || "";
      const capture = () => {
        const text = box && box.value.trim();
        if (!text) return;
        const el = ie.el();
        const row = { t: el ? el.currentTime : 0, text, at: Date.now() };
        notesStore.update(d => { (d[cur()] = d[cur()] || []).push(row); });
        if (box) box.value = "";
        pe("Note captured at " + ZenPack.fmtTs(row.t), 1200, "success");
      };
      const build = () => {
        if (box || !document.body) return false;
        box = document.createElement("textarea");
        box.id = "ytp-zen-notes";
        box.placeholder = "Quick note… (Ctrl+Enter to save)";
        box.style.cssText = "position:fixed;right:14px;bottom:52px;z-index:2147483639;width:260px;height:70px;" +
          "background:rgba(16,18,24,.95);color:#eee;border:1px solid rgba(255,255,255,.16);" +
          "border-radius:10px;padding:8px;font:12px system-ui;display:none;resize:vertical";
        box.addEventListener("keydown", (ev) => {
          if (ev.key === "Escape") { box.style.display = "none"; }
          if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") capture();
        });
        document.body.appendChild(box);
        return true;
      };
      ctx.addListener(document, "keydown", (ev) => {
        if (ev.altKey && !ev.ctrlKey && !ev.metaKey && ev.code === "KeyN" && !ZenPack.guardKey(ev)) {
          ev.preventDefault();
          if (build()) box.style.display = box.style.display === "none" ? "block" : "none";
        }
      });
      ctx.onNav(() => { if (box) box.style.display = "none"; });
      // Markdown export button in settings panel.
      ZenEngine.scheduleOnReady(ctx, () => !!document.body, { attempts: 1, delayMs: 50 });
      ZenPack.settingsExportHook.push(async () => {
        const d = notesStore.get(); const lines = ["# YT-zen notes", ""];
        for (const [vid, rows] of Object.entries(d)) {
          lines.push("## https://youtu.be/" + vid);
          for (const r of rows) lines.push("- `" + ZenPack.fmtTs(r.t) + "` " + r.text.replace(/\n/g, " "));
          lines.push("");
        }
        const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "yt-zen-notes.md"; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      });
      Yt["timestamp-notes"].push(() => { if (box) { box.remove(); box = null; } });
    },
    settings(en) {
      en.appendChild(Io("Enable study notes (Alt+N)", "timestampNotesOn"));
      en.appendChild(Eo([Oo("Export notes as Markdown", () => { try { ZenPack.settingsExportHook.fire(); } catch (_) {} })]));
    },
  });

  // ─── 5. Pause Auto-Rewind ────────────────────────────────────────────────
  // Replays a few seconds whenever you pause — ideal for note-takers.
  xa.register({
    id: "pause-auto-rewind", name: "Pause Rewind",
    summary: "Hops back a configurable number of seconds each time you pause.",
    masterKey: "pauseRewindOn", keys: ["pauseRewindOn", "pauseRewindSec"],
    apply(ctx) {
      if (!S.pauseRewindOn) return;
      const secs = () => Math.max(1, Math.min(30, Number(S.pauseRewindSec) || 3));
      const binder = ZenPack.elBinder();
      binder(ctx, "pause", () => {
        const el = ie.el();
        if (!el || el.ended || _isLiveStream()) return;
        try { el.currentTime = Math.max(0, el.currentTime - secs()); } catch (_) {}
      });
    },
    settings(en) {
      en.appendChild(Io("Rewind slightly on every pause", "pauseRewindOn"));
      en.appendChild(No("Seconds back", "pauseRewindSec", 1, 30, 1, v => v + "s"));
    },
  });

  // ─── 6. Instant Replay Hotkey ────────────────────────────────────────────
  xa.register({
    id: "instant-replay", name: "Instant Replay",
    summary: "Alt+J replays the last few seconds instantly — perfect for missed lines.",
    masterKey: "instantReplayOn", keys: ["instantReplayOn", "instantReplaySec"],
    apply(ctx) {
      if (!S.instantReplayOn) return;
      ctx.addListener(document, "keydown", (ev) => {
        if (ev.altKey && !ev.ctrlKey && !ev.metaKey && ev.code === "KeyJ" && !ZenPack.guardKey(ev)) {
          ev.preventDefault();
          const el = ie.el(); if (!el) return;
          const back = Math.max(2, Math.min(60, Number(S.instantReplaySec) || 10));
          try { el.currentTime = Math.max(0, el.currentTime - back); } catch (_) {}
        }
      });
    },
    settings(en) {
      en.appendChild(Io("Enable instant replay (Alt+J)", "instantReplayOn"));
      en.appendChild(No("Replay length", "instantReplaySec", 2, 60, 1, v => v + "s"));
    },
  });

  // ─── 7. Sleep Timer with Fade ────────────────────────────────────────────
  // Alt+O arms a timer; volume fades over the final minute, then playback
  // pauses and volume is restored.
  xa.register({
    id: "sleep-timer", name: "Sleep Timer",
    summary: "Alt+O cycles 30 → 60 → 90 → off minutes; volume fades out before pausing.",
    masterKey: "sleepTimerOn", keys: ["sleepTimerOn", "sleepTimerMin"],
    apply(ctx) {
      if (!S.sleepTimerOn) return;
      let deadline = 0, armed = 0, origVol = null, fadeTask = 0;
      const mins = () => Math.max(5, Math.min(240, Number(S.sleepTimerMin) || 30));
      const disarm = (restoreVol) => {
        if (fadeTask) { ZenResources.DeferredTask.cancel(fadeTask); fadeTask = 0; }
        deadline = 0;
        if (restoreVol && origVol !== null) {
          const el = ie.el(); if (el) { try { el.volume = origVol; } catch (_) {} }
        }
        origVol = null;
      };
      const stopPlayback = () => {
        const el = ie.el(); if (!el) return;
        try { el.pause(); } catch (_) {}
        disarm(true);
        pe("Sleep timer: paused. Good night.", 2500, "info");
      };
      ctx.addListener(document, "keydown", (ev) => {
        if (ev.altKey && !ev.ctrlKey && !ev.metaKey && ev.code === "KeyO" && !ZenPack.guardKey(ev)) {
          ev.preventDefault();
          const cycle = [0, 30, 60, 90];
          armed = cycle[(cycle.indexOf(armed) + 1) % cycle.length];
          disarm(false);
          if (!armed) { pe("Sleep timer off", 1400, "info"); return; }
          deadline = Date.now() + armed * 60000;
          origVol = (ie.el() || {}).volume ?? 1;
          pe("Sleep timer armed: " + armed + " min", 2200, "success");
        }
      });
      const id = ZenResources.SharedTicker.add(() => {
        if (!deadline) return;
        const left = deadline - Date.now();
        const el = ie.el(); if (!el) return;
        if (left <= 0) { stopPlayback(); return; }
        if (left <= 60000 && origVol !== null) {
          try { el.volume = Math.max(0, origVol * (left / 60000)); } catch (_) {}
        }
      }, 1000, { pauseHidden: false, label: "zen-sleep-timer" });
      Yt["sleep-timer"].push(() => { ZenResources.SharedTicker.remove(id); disarm(true); });
    },
    settings(en) {
      en.appendChild(Io("Enable sleep timer (Alt+O cycles)", "sleepTimerOn"));
      en.appendChild(No("Default duration (minutes)", "sleepTimerMin", 5, 240, 5, v => v + "m"));
    },
  });

  // ─── 8. Stretch Reminder ─────────────────────────────────────────────────
  // Nudges you to move after continuous watching; resets when you pause away.
  xa.register({
    id: "stretch-reminder", name: "Stretch Reminder",
    summary: "A calm nudge after uninterrupted watching so marathons don't glue you to the chair.",
    masterKey: "stretchReminderOn", keys: ["stretchReminderOn", "stretchEveryMin"],
    apply(ctx) {
      if (!S.stretchReminderOn) return;
      let watched = 0, lastPauseAt = Date.now();
      const every = () => Math.max(15, Math.min(120, Number(S.stretchEveryMin) || 45)) * 60000;
      const binder = ZenPack.elBinder();
      binder(ctx, "pause", () => { lastPauseAt = Date.now(); });
      const id = ZenResources.SharedTicker.add(() => {
        const el = ie.el();
        if (!el || el.paused || document.hidden) { lastPauseAt = Date.now(); return; }
        if (Date.now() - lastPauseAt > 300000) { lastPauseAt = Date.now(); watched = 0; }
        watched += 1000;
        if (watched >= every()) {
          watched = 0;
          pe("You have been watching a while — stand up and stretch?", 4200, "info");
        }
      }, 1000, { pauseHidden: true, label: "zen-stretch" });
      Yt["stretch-reminder"].push(() => ZenResources.SharedTicker.remove(id));
    },
    settings(en) {
      en.appendChild(Io("Remind me to stretch", "stretchReminderOn"));
      en.appendChild(No("Every (minutes)", "stretchEveryMin", 15, 120, 5, v => v + "m"));
    },
  });

  // ─── 9. Session Intention Lock ───────────────────────────────────────────
  // One optional prompt per session: "What are you here for?" — the answer
  // floats quietly in the corner while you watch. Purely local.
  xa.register({
    id: "intention-lock", name: "Session Intention",
    summary: "Ask yourself what you came for; your intention stays visible while you watch.",
    masterKey: "intentionLockOn", keys: ["intentionLockOn"],
    apply(ctx) {
      if (!S.intentionLockOn) return;
      ZenEngine.injectCSS();
      let chip = null;
      const show = () => {
        if (!document.body || document.getElementById("ytp-zen-intent")) return;
        const card = document.createElement("div");
        card.id = "ytp-zen-intent";
        card.style.cssText = "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483638;" +
          "background:rgba(16,18,24,.96);border:1px solid rgba(255,255,255,.14);border-radius:12px;" +
          "padding:10px 12px;font:12px system-ui;color:#eee;display:flex;gap:8px;align-items:center;" +
          "box-shadow:0 12px 34px rgba(0,0,0,.5)";
        const label = document.createElement("span"); label.textContent = "What are you here for?";
        const input = document.createElement("input");
        input.maxLength = 80;
        input.style.cssText = "background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:8px;padding:5px 9px;width:220px;outline:none";
        const go = document.createElement("button");
        go.className = "zen-btn primary"; go.textContent = "Set";
        const done = (val) => {
          card.remove();
          if (!val) return;
          chip = document.createElement("div");
          chip.id = "ytp-zen-intent-chip";
          chip.textContent = "🎯 " + val;
          chip.title = "Click to clear. Your session intention.";
          chip.style.cssText = "position:fixed;left:12px;bottom:44px;z-index:2147483637;background:rgba(16,18,24,.85);" +
            "border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:4px 11px;font:600 11px system-ui;color:#ffd7e3";
          chip.addEventListener("click", () => { chip.remove(); chip = null; });
          document.body.appendChild(chip);
        };
        go.addEventListener("click", () => done(input.value.trim()));
        input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") done(input.value.trim()); if (ev.key === "Escape") card.remove(); });
        card.append(label, input, go);
        document.body.appendChild(card);
        try { input.focus(); } catch (_) {}
      };
      ctx.addTimeout(show, 1200);
      Yt["intention-lock"].push(() => {
        const c1 = document.getElementById("ytp-zen-intent"); if (c1) c1.remove();
        if (chip) { chip.remove(); chip = null; }
      });
    },
    settings(en) { en.appendChild(Io("Ask my intention once per session", "intentionLockOn")); },
  });

  // ─── 10. End-of-Video Wind-Down ──────────────────────────────────────────
  // When a video ends, a calm interstitial with a short breathing pause stands
  // between you and autoplay. Continue is a decision, not a reflex.
  xa.register({
    id: "end-winddown", name: "End-of-Video Wind-Down",
    summary: "A calm pause between videos: autoplay waits behind a gentle screen until you continue.",
    masterKey: "endWindDownOn", keys: ["endWindDownOn", "windDownSec"],
    apply(ctx) {
      if (!S.endWindDownOn) return;
      ZenEngine.injectCSS();
      let gateActive = false, overlay = null;
      const secs = () => Math.max(3, Math.min(60, Number(S.windDownSec) || 10));
      const showGate = () => {
        if (!document.body || overlay) return;
        gateActive = true;
        overlay = document.createElement("div");
        overlay.id = "ytp-zen-winddown";
        overlay.setAttribute("role", "dialog");
        overlay.style.cssText = "position:fixed;inset:0;z-index:2147483641;background:rgba(8,9,12,.82);" +
          "display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px)";
        const card = document.createElement("div");
        card.className = "zen-focus-card";
        const title = document.createElement("div"); title.className = "zen-focus-title"; title.textContent = "That's the end.";
        const body = document.createElement("p"); body.className = "zen-focus-body";
        body.textContent = "Autoplay is held for a moment. Breathe — continue only if you mean it.";
        const row = document.createElement("div"); row.className = "zen-focus-row";
        const cont = document.createElement("button"); cont.className = "zen-btn primary"; cont.textContent = "Continue (" + secs() + "s)";
        const stop = document.createElement("button"); stop.className = "zen-btn"; stop.textContent = "Stop here";
        cont.addEventListener("click", () => dismiss(true));
        stop.addEventListener("click", () => dismiss(false));
        row.append(cont, stop); card.append(title, body, row); overlay.appendChild(card);
        document.body.appendChild(overlay);
        let left = secs();
        cont.textContent = "Continue (" + left + "s)";
        const iv = setInterval(() => {
          left -= 1;
          if (left <= 0) { clearInterval(iv); cont.disabled = false; cont.textContent = "Continue"; }
          else cont.textContent = "Continue (" + left + "s)";
        }, 1000);
        cont.disabled = true;
      };
      const releasePlay = () => { gateActive = false; };
      const dismiss = (allowNext) => {
        if (overlay) { overlay.remove(); overlay = null; }
        if (allowNext) { releasePlay(); }
        else {
          // Block exactly one upcoming play attempt (autoplay), then yield.
          gateActive = true;
          setTimeout(() => { gateActive = false; }, 8000);
        }
      };
      const protoPlay = HTMLMediaElement.prototype.play;
      let patched = false;
      const patch = () => {
        if (patched) return; patched = true;
        HTMLMediaElement.prototype.play = function (...args) {
          if (gateActive) { return Promise.resolve(); }
          return protoPlay.apply(this, args);
        };
      };
      const unpatch = () => { if (patched) { try { HTMLMediaElement.prototype.play = protoPlay; } catch (_) {} patched = false; } };
      patch();
      const binder = ZenPack.elBinder();
      binder(ctx, "ended", () => { if (!overlay) showGate(); });
      ctx.onNav(() => { if (overlay) { overlay.remove(); overlay = null; } gateActive = false; });
      ctx.addListener(document, "keydown", (ev) => {
        if (ev.key === "Escape" && overlay) dismiss(false);
      });
      Yt["end-winddown"].push(() => { unpatch(); if (overlay) { overlay.remove(); overlay = null; } gateActive = false; });
    },
    settings(en) {
      en.appendChild(Io("Hold autoplay behind a calm pause", "endWindDownOn"));
      en.appendChild(No("Continue button unlocks after (seconds)", "windDownSec", 3, 60, 1, v => v + "s"));
    },
  });

  // ─── 11. Shorts Marathon Guard ───────────────────────────────────────────
  // Counts consecutive Shorts; past the limit, a single calm toast suggests
  // moving on. No gates, no blocking — just awareness.
  xa.register({
    id: "shorts-marathon-guard", name: "Shorts Marathon Guard",
    summary: "After N Shorts in a row, one quiet nudge reminds you the reel has no bottom.",
    masterKey: "shortsMarathonOn", keys: ["shortsMarathonOn", "shortsMarathonN"],
    apply(ctx) {
      if (!S.shortsMarathonOn) return;
      let count = 0, lastVid = "", nudgedAt = 0;
      ctx.onNav(() => {
        if (!location.pathname.startsWith("/shorts")) { count = 0; lastVid = ""; return; }
        const vid = ie.videoId() || location.pathname.split("/").pop() || "";
        if (vid && vid !== lastVid) {
          lastVid = vid; count += 1;
          const limit = Math.max(3, Math.min(100, Number(S.shortsMarathonN) || 15));
          if (count > 0 && count % limit === 0 && Date.now() - nudgedAt > 120000) {
            nudgedAt = Date.now();
            pe(count + " Shorts in a row. The feed never ends — but you can.", 4000, "info");
          }
        }
      });
    },
    settings(en) {
      en.appendChild(Io("Count my Shorts streak", "shortsMarathonOn"));
      en.appendChild(No("Nudge every N Shorts", "shortsMarathonN", 3, 100, 1, v => v + ""));
    },
  });

  // ─── 12. Feed Freshness Filter ───────────────────────────────────────────
  // Hides home-feed videos older than the chosen age using the metadata line.
  xa.register({
    id: "feed-freshness", name: "Feed Freshness Filter",
    summary: "Keeps the home feed recent by hiding uploads older than your chosen age.",
    masterKey: "feedFreshnessOn", keys: ["feedFreshnessOn", "feedMaxAgeMonths"],
    apply(ctx) {
      if (!S.feedFreshnessOn || !location.pathname.startsWith("/")) return;
      ZenEngine.injectCSS();
      const months = () => Math.max(1, Math.min(60, Number(S.feedMaxAgeMonths) || 6));
      const parseAgeDays = (text) => {
        const m = String(text || "").match(/(\d+)\s*(year|month|week|day|hour)/i);
        if (!m) return -1;
        const v = parseInt(m[1], 10) || 0;
        const f = { year: 365, month: 30, week: 7, day: 1, hour: 0.04 }[m[2].toLowerCase()];
        return v * f;
      };
      const scan = () => {
        if (!location.pathname.startsWith("/")) return;
        document.querySelectorAll("ytd-rich-item-renderer ytd-video-meta-block #metadata-line").forEach((meta) => {
          const item = meta.closest("ytd-rich-item-renderer");
          if (!item) return;
          const age = parseAgeDays(meta.textContent);
          if (age < 0) return;
          const stale = age > months() * 30;
          if (stale && !item.dataset.zenStale) {
            item.dataset.zenStale = "1"; item.style.display = "none";
          } else if (!stale && item.dataset.zenStale) {
            delete item.dataset.zenStale; item.style.display = "";
          }
        });
      };
      ctx.addObserver(document.body, ZenResources.DeferredTask.debounce.bind(null, "zen-fresh", scan, 300), { childList: true, subtree: true });
      ctx.addInterval(scan, 5000);
      ctx.onNav(scan);
      Yt["feed-freshness"].push(() => {
        document.querySelectorAll("[data-zen-stale]").forEach((el) => { el.style.display = ""; delete el.dataset.zenStale; });
      });
    },
    settings(en) {
      en.appendChild(Io("Hide old uploads on the home feed", "feedFreshnessOn"));
      en.appendChild(No("Older than (months)", "feedMaxAgeMonths", 1, 60, 1, v => v + "mo"));
    },
  });

  // ─── 13. Channel Snooze ──────────────────────────────────────────────────
  // Mutes chosen channels in feeds/subscriptions until the snooze expires.
  xa.register({
    id: "channel-snooze", name: "Channel Snooze",
    summary: "Mute specific channels from feeds and subscriptions for a set number of days.",
    masterKey: "channelSnoozeOn", keys: ["channelSnoozeOn", "channelSnoozeList"],
    apply(ctx) {
      if (!S.channelSnoozeOn) return;
      ZenEngine.injectCSS();
      const list = () => String(S.channelSnoozeList || "").split(/[,;\n]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
      const match = (nameText) => {
        const nm = String(nameText || "").normalize("NFC").toLowerCase();
        return list().some((c) => nm.includes(c));
      };
      const scan = () => {
        document.querySelectorAll("ytd-video-renderer, ytd-compact-video-renderer, ytd-rich-item-renderer").forEach((card) => {
          const owner = card.querySelector("ytd-channel-name a, #owner-name a, ytd-video-owner-renderer a");
          if (!owner) return;
          const hit = match(owner.textContent);
          if (hit && !card.dataset.zenSnoozed) { card.dataset.zenSnoozed = "1"; card.style.display = "none"; }
          else if (!hit && card.dataset.zenSnoozed) { delete card.dataset.zenSnoozed; card.style.display = ""; }
        });
      };
      ctx.addObserver(document.body, ZenResources.DeferredTask.debounce.bind(null, "zen-snooze", scan, 350), { childList: true, subtree: true });
      ctx.onNav(scan);
      Yt["channel-snooze"].push(() => {
        document.querySelectorAll("[data-zen-snoozed]").forEach((el) => { el.style.display = ""; delete el.dataset.zenSnoozed; });
      });
    },
    settings(en) {
      en.appendChild(Io("Snooze channels I list", "channelSnoozeOn"));
      en.appendChild(Ho("Channels to snooze (comma-separated)", "channelSnoozeList", "example channel, another one"));
    },
  });

  // ─── 14. Duplicate Title Spotter ─────────────────────────────────────────
  // On search pages, badges near-duplicate uploads (reuploads, spam waves).
  xa.register({
    id: "dup-title-spotter", name: "Duplicate Title Spotter",
    summary: "Highlights search results whose normalized titles repeat — reuploads stand out.",
    masterKey: "dupTitleSpotterOn", keys: ["dupTitleSpotterOn"],
    apply(ctx) {
      if (!S.dupTitleSpotterOn) return;
      ZenEngine.injectCSS();
      const norm = (t) => String(t || "").normalize("NFC").toLowerCase().replace(/[^a-z0-9]+/g, "");
      const scan = () => {
        if (!location.pathname.startsWith("/results")) return;
        const rows = [...document.querySelectorAll("ytd-video-renderer")];
        const seen = new Map();
        rows.forEach((row) => {
          const t = row.querySelector("#video-title");
          if (!t) return;
          const key = norm(t.textContent).slice(0, 90);
          const badge = row.querySelector(".zen-dup-badge");
          if (!key || key.length < 12) { if (badge) badge.remove(); return; }
          if (seen.has(key)) {
            if (!badge) {
              const b = document.createElement("span");
              b.className = "zen-dup-badge zen-velocity";
              b.textContent = "dup title";
              t.parentNode && t.parentNode.appendChild(b);
            }
          } else if (badge) badge.remove();
          seen.set(key, true);
        });
      };
      ctx.addObserver(document.body, ZenResources.DeferredTask.debounce.bind(null, "zen-dup", scan, 350), { childList: true, subtree: true });
      ctx.onNav(() => ctx.addTimeout(scan, 700));
      Yt["dup-title-spotter"].push(() => {
        document.querySelectorAll(".zen-dup-badge").forEach((b) => b.remove());
      });
    },
    settings(en) { en.appendChild(Io("Flag duplicate titles on search", "dupTitleSpotterOn")); },
  });

  // ─── 15. Playlist Watched Marker ─────────────────────────────────────────
  // On any playlist page, checks each entry against local history and marks
  // already-watched ones — instant orientation on long courses.
  xa.register({
    id: "playlist-watched-marker", name: "Playlist Watch-Marks",
    summary: "Dims playlist entries you have already watched, straight from local history.",
    masterKey: "playlistWatchedMarkerOn", keys: ["playlistWatchedMarkerOn"],
    apply(ctx) {
      if (!S.playlistWatchedMarkerOn) return;
      ZenEngine.injectCSS();
      const scan = async () => {
        if (!location.pathname.startsWith("/playlist") && !location.search.includes("list=")) return;
        const rows = [...document.querySelectorAll("ytd-playlist-panel-video-renderer, ytd-playlist-video-renderer")];
        const ids = [];
        rows.forEach((r) => {
          const a = r.querySelector("a#wc-endpoint, a[href*='/watch']");
          const m = a && (a.getAttribute("href") || "").match(/[?&]v=([A-Za-z0-9_-]{11})/);
          ids.push(m ? m[1] : null);
        });
        const flags = await Promise.all(ids.map((id) => id ? v("history", id).then(Boolean).catch(() => false) : false));
        rows.forEach((r, i) => {
          const title = r.querySelector("#video-title") || r;
          if (flags[i]) {
            title.style.opacity = ".45";
            if (!title.dataset.zenWatched) {
              title.dataset.zenWatched = "1";
              title.setAttribute("title", (title.getAttribute("title") || "") + " ✓ watched");
            }
          } else {
            title.style.opacity = "";
            delete title.dataset.zenWatched;
          }
        });
      };
      ctx.addObserver(document.body, ZenResources.DeferredTask.debounce.bind(null, "zen-plmark", scan, 400), { childList: true, subtree: true });
      ctx.onNav(() => ctx.addTimeout(scan, 800));
      Yt["playlist-watched-marker"].push(() => {
        document.querySelectorAll("[data-zen-watched]").forEach((t) => { t.style.opacity = ""; delete t.dataset.zenWatched; });
      });
    },
    settings(en) { en.appendChild(Io("Mark watched entries in playlists", "playlistWatchedMarkerOn")); },
  });

  // ─── 16. Comment Keyword Filter ──────────────────────────────────────────
  xa.register({
    id: "comment-filter", name: "Comment Filter",
    summary: "Hides comments whose text matches your keyword list — same zen as the video filter.",
    masterKey: "commentFilterOn", keys: ["commentFilterOn", "commentBlockWords"],
    apply(ctx) {
      if (!S.commentFilterOn) return;
      ZenEngine.injectCSS();
      const words = () => String(S.commentBlockWords || "").split(/[,;\n]+/).map(w => w.trim().toLowerCase()).filter(Boolean);
      const scan = () => {
        const kw = words(); if (!kw.length) return;
        document.querySelectorAll("ytd-comment-thread-renderer").forEach((thread) => {
          const body = thread.querySelector("#content-text");
          if (!body) return;
          const hit = kw.some((k) => body.textContent.toLowerCase().includes(k));
          if (hit && !thread.dataset.zenCf) { thread.dataset.zenCf = "1"; thread.style.display = "none"; }
          else if (!hit && thread.dataset.zenCf) { delete thread.dataset.zenCf; thread.style.display = ""; }
        });
      };
      ctx.addObserver(document.body, ZenResources.DeferredTask.debounce.bind(null, "zen-cf", scan, 400), { childList: true, subtree: true });
      ctx.onNav(() => ctx.addTimeout(scan, 900));
      Yt["comment-filter"].push(() => {
        document.querySelectorAll("[data-zen-cf]").forEach((el) => { el.style.display = ""; delete el.dataset.zenCf; });
      });
    },
    settings(en) {
      en.appendChild(Io("Filter comments by keywords", "commentFilterOn"));
      en.appendChild(Ho("Hide comments containing", "commentBlockWords", "first, giveaway, subscribe"));
    },
  });

  // ─── 17. History Local Hide ──────────────────────────────────────────────
  // Masks rows in YouTube's history feed without touching their servers.
  xa.register({
    id: "history-local-hide", name: "History Local Hide",
    summary: "Keep select videos out of your history view locally — nothing is deleted upstream.",
    masterKey: "historyLocalHideOn", keys: ["historyLocalHideOn"],
    apply(ctx) {
      if (!S.historyLocalHideOn || !location.pathname.startsWith("/feed/history")) return;
      ZenEngine.injectCSS();
      const hidden = ZenEngine.createStore("__zen_hist_hide__", []);
      const isHidden = (id) => hidden.get().indexOf(id) !== -1;
      const scan = async () => {
        const rows = [...document.querySelectorAll("ytd-video-renderer, ytd-compact-video-renderer")];
        const ids = rows.map((r) => {
          const a = r.querySelector("a[href*='/watch']");
          const m = a && (a.getAttribute("href") || "").match(/[?&]v=([A-Za-z0-9_-]{11})/);
          return m ? m[1] : null;
        });
        for (let i = 0; i < rows.length; i++) {
          const id = ids[i]; if (!id) continue;
          const hide = await isHidden(id);
          if (hide && !rows[i].dataset.zenHistHidden) { rows[i].dataset.zenHistHidden = "1"; rows[i].style.display = "none"; }
          else if (!hide && rows[i].dataset.zenHistHidden) { delete rows[i].dataset.zenHistHidden; rows[i].style.display = ""; }
        }
      };
      // Shift+click a row's thumbnail to toggle local hiding.
      ctx.addListener(document.body, "click", (ev) => {
        if (!ev.shiftKey) return;
        const row = ev.target.closest("ytd-video-renderer, ytd-compact-video-renderer");
        if (!row) return;
        const a = row.querySelector("a[href*='/watch']");
        const m = a && (a.getAttribute("href") || "").match(/[?&]v=([A-Za-z0-9_-]{11})/);
        if (!m) return;
        ev.preventDefault(); ev.stopPropagation();
        hidden.update((d) => {
          const at = d.indexOf(m[1]);
          if (at === -1) { d.push(m[1]); pe("Hidden from history view.", 1500, "success"); }
          else { d.splice(at, 1); pe("Restored to history view.", 1500, "info"); }
        });
      }, true);
      ctx.addObserver(document.body, ZenResources.DeferredTask.debounce.bind(null, "zen-hlh", scan, 350), { childList: true, subtree: true });
      ctx.onNav(() => ctx.addTimeout(scan, 700));
      Yt["history-local-hide"].push(() => {
        document.querySelectorAll("[data-zen-hist-hidden]").forEach((el) => { el.style.display = ""; delete el.dataset.zenHistHidden; });
      });
    },
    settings(en) {
      en.appendChild(Io("Enable local history hiding (Shift+click)", "historyLocalHideOn"));
    },
  });

  // ─── 18. Copy Link Cleaner ───────────────────────────────────────────────
  // Strips tracking parameters from YouTube URLs you copy.
  xa.register({
    id: "copy-link-cleaner", name: "Copy Link Cleaner",
    summary: "YouTube links you copy lose si/feature/utm tracking baggage automatically.",
    masterKey: "copyLinkCleanerOn", keys: ["copyLinkCleanerOn"],
    apply(ctx) {
      if (!S.copyLinkCleanerOn) return;
      const clean = (urlText) => {
        try {
          const u = new URL(urlText);
          if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname)) return null;
          const junk = ["si", "feature", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"];
          let touched = false;
          junk.forEach((k) => { if (u.searchParams.has(k)) { u.searchParams.delete(k); touched = true; } });
          return touched ? u.toString() : null;
        } catch (_) { return null; }
      };
      ctx.addListener(document.body, "copy", (ev) => {
        try {
          const txt = (ev.clipboardData || window.clipboardData).getData("text");
          if (!txt) return;
          const cleaned = clean(txt.trim());
          if (cleaned && cleaned !== txt.trim()) {
            ev.clipboardData.setData("text/plain", cleaned);
            ev.preventDefault();
            pe("Link cleaned before copying.", 1200, "info");
          }
        } catch (_) {}
      }, true);
    },
    settings(en) { en.appendChild(Io("Strip tracking params on copy", "copyLinkCleanerOn")); },
  });

  // ─── 19. Night Theme Scheduler ───────────────────────────────────────────
  // Applies YouTube's dark attribute inside your evening window and restores
  // it after — built on the pure TimeWindow primitive.
  xa.register({
    id: "night-scheduler", name: "Night Theme Scheduler",
    summary: "Dark theme after hours, light theme after sunrise — automatic, on your clock.",
    masterKey: "nightSchedulerOn", keys: ["nightSchedulerOn", "nightStart", "nightEnd"],
    apply(ctx) {
      if (!S.nightSchedulerOn) return;
      const valid = () => ZenResources.TimeWindow.parseHHMM(S.nightStart) !== null &&
                          ZenResources.TimeWindow.parseHHMM(S.nightEnd) !== null;
      const wantDark = () => !valid() ? null : ZenResources.TimeWindow.containsHHMM(S.nightStart, S.nightEnd);
      const enforce = () => {
        const w = wantDark(); if (w === null) return;
        const app = document.querySelector("ytd-app");
        if (!app) return;
        const isDark = document.documentElement.hasAttribute("dark") || app.hasAttribute("dark");
        if (w && !isDark) { document.documentElement.setAttribute("dark", ""); app.setAttribute("dark", ""); }
        else if (!w && isDark) { document.documentElement.removeAttribute("dark"); app.removeAttribute("dark"); }
      };
      ctx.addInterval(enforce, 60000);
      ctx.onNav(() => ctx.addTimeout(enforce, 800));
      ctx.addTimeout(enforce, 1500);
      Yt["night-scheduler"].push(() => {});
    },
    settings(en) {
      en.appendChild(Io("Schedule dark theme by clock", "nightSchedulerOn"));
      en.appendChild(_o("Dark from (HH:MM)", "nightStart"));
      en.appendChild(_o("Light from (HH:MM)", "nightEnd"));
    },
  });

  // ─── 20. Text Scale Booster ──────────────────────────────────────────────
  xa.register({
    id: "text-scale", name: "Reading Size Boost",
    summary: "Larger description and comment text without zooming the whole page.",
    masterKey: "textScaleOn", keys: ["textScaleOn", "textScalePct"],
    apply(ctx) {
      if (!S.textScaleOn) return;
      const pct = Math.max(100, Math.min(180, Number(S.textScalePct) || 115));
      const css = "#description-inline-expander, ytd-text-inline-expander, #description {" +
        "font-size:" + pct + "% !important;line-height:1.5 !important}" +
        "ytd-comment-view-model #content-text, ytd-comment-thread-renderer #content-text {" +
        "font-size:" + pct + "% !important}";
      const undo = ZenResources.Dom.css(css, "zen-textscale");
      Yt["text-scale"].push(undo);
    },
    settings(en) {
      en.appendChild(Io("Bigger reading text", "textScaleOn"));
      en.appendChild(No("Size", "textScalePct", 100, 180, 5, v => v + "%"));
    },
  });

  // ─── 21. Ambient Glow ────────────────────────────────────────────────────
  // Samples the video into a 16×9 canvas twice a second while playing and
  // tints a soft box-shadow around the player — bias lighting, no add-ons.
  xa.register({
    id: "ambient-glow", name: "Ambient Glow",
    summary: "Bias lighting for the player: its edges breathe with the colors on screen.",
    masterKey: "ambientGlowOn", keys: ["ambientGlowOn"],
    apply(ctx) {
      if (!S.ambientGlowOn) return;
      const glow = document.createElement("div");
      glow.id = "ytp-zen-glow";
      glow.style.cssText = "position:fixed;pointer-events:none;z-index:5;border-radius:14px;display:none";
      const sample = document.createElement("canvas");
      sample.width = 16; sample.height = 9;
      const sctx = sample.getContext("2d", { willReadFrequently: true });
      let last = 0;
      const tick = () => {
        const vid = ie.el();
        const player = document.getElementById("movie_player") || document.querySelector(".html5-video-player");
        if (!vid || !player || vid.paused || document.hidden || vid.readyState < 2) {
          glow.style.display = "none"; return;
        }
        const rect = player.getBoundingClientRect();
        if (rect.width < 40) { glow.style.display = "none"; return; }
        Object.assign(glow.style, {
          display: "block",
          left: rect.left - 10 + "px", top: rect.top - 10 + "px",
          width: rect.width + 20 + "px", height: rect.height + 20 + "px",
          boxShadow: glow.style.boxShadow || "0 0 90px 12px rgba(80,80,120,.35)",
        });
        const now = Date.now();
        if (now - last < 500) return;
        last = now;
        try {
          sctx.drawImage(vid, 0, 0, 16, 9);
          const d = sctx.getImageData(0, 0, 16, 9).data;
          let r = 0, g = 0, b = 0;
          for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
          const px = d.length / 4;
          r /= px; g /= px; b /= px;
          glow.style.boxShadow = "0 0 110px 18px rgba(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + ",.42)";
        } catch (_) {}
      };
      const mount = () => {
        if (!document.body || glow.parentNode) return !!glow.parentNode;
        document.body.appendChild(glow); return true;
      };
      ZenEngine.scheduleOnReady(ctx, mount, { attempts: 6, delayMs: 500 });
      const id = ZenResources.SharedTicker.add(tick, 250, { pauseHidden: true, label: "zen-glow" });
      ctx.addListener(window, "resize", tick, { passive: true });
      Yt["ambient-glow"].push(() => {
        ZenResources.SharedTicker.remove(id);
        glow.remove();
      });
    },
    settings(en) { en.appendChild(Io("Enable ambient bias lighting", "ambientGlowOn")); },
  });

  // ─── 22. Storage Dashboard ───────────────────────────────────────────────
  // Shows YT-zen's IndexedDB footprint per store plus browser quota, with a
  // one-click trim.
  xa.register({
    id: "storage-dashboard", name: "Storage Dashboard",
    summary: "See exactly how much local space YT-zen uses — per store — and trim it.",
    masterKey: "storageDashboardOn", keys: ["storageDashboardOn"],
    apply(ctx) { /* panel renders through settings() */ },
    settings(en) {
      en.appendChild(Io("Show storage overview", "storageDashboardOn"));
      const out = document.createElement("div");
      out.className = "ytp-hist-note"; out.style.marginTop = "8px";
      en.appendChild(out);
      const fmtBytes = (n) => n > 1073741824 ? (n / 1073741824).toFixed(2) + " GB"
        : n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : (n / 1024).toFixed(0) + " KB";
      const render = async () => {
        out.textContent = "Counting…";
        const lines = [];
        try { const est = await navigator.storage.estimate(); if (est) lines.push("Browser quota used: ~" + fmtBytes(est.usage || 0) + " of " + fmtBytes(est.quota || 0)); } catch (_) {}
        for (const storeName of ["kv", "history", "thumbCache", "replay"]) {
          try {
            const rows = await w(storeName);
            let bytes = 0;
            for (const r of (rows || [])) { try { bytes += JSON.stringify(r).length; } catch (_) {} }
            lines.push(storeName + ": " + (rows ? rows.length : 0) + " rows ≈ " + fmtBytes(bytes));
          } catch (_) { lines.push(storeName + ": unavailable"); }
        }
        out.innerHTML = "";
        const pre = document.createElement("div");
        pre.style.whiteSpace = "pre-line";
        pre.textContent = lines.join("\n");
        out.appendChild(pre);
        const trim = Oo("Trim old caches now", () => {
          try {
            if (typeof YtpCache !== "undefined" && YtpCache.cleanup) YtpCache.cleanup();
            ZenResources.TrackedBlobURL.revokeOlderThan(30000);
            pe("Cache trim requested.", 1600, "success");
          } catch (_) { pe("Trim failed.", 1600, "error"); }
        });
        out.appendChild(trim);
      };
      render();
    },
  });

  // ─── 23. Health Check Panel ──────────────────────────────────────────────
  // One-glance self-diagnostics: engine stats, SponsorBlock counters,
  // quarantined features, selector sanity probes.
  xa.register({
    id: "health-check", name: "Health Check",
    summary: "Self-diagnostics board: subsystem stats, quarantines, and live DOM probes.",
    masterKey: "healthCheckOn", keys: ["healthCheckOn"],
    apply(ctx) { },
    settings(en) {
      en.appendChild(Io("Show health check", "healthCheckOn"));
      const box = document.createElement("div");
      box.className = "ytp-hist-note"; box.style.marginTop = "8px";
      box.style.whiteSpace = "pre-line";
      en.appendChild(box);
      const render = () => {
        const L = [];
        try {
          const rs = ZenResources.stats();
          L.push("Observers: " + rs.sharedObserver.subscribers + " subs (" + (rs.sharedObserver.active ? "active" : "idle") + ")");
          L.push("Tickers: " + rs.sharedTicker.tasks + " tasks");
          L.push("Blob URLs alive: " + rs.blobURLs.active);
          L.push("Deferred tasks: " + rs.deferred.pending);
          L.push("Abort groups: " + rs.abortGroups.groups);
        } catch (_) { L.push("ZenResources: unavailable"); }
        try {
          const sb = SponsorBlockEngine.stats();
          L.push("SponsorBlock: " + sb.skips + " skips all-time, cache hit " + sb.hitRate + "%");
        } catch (_) { L.push("SponsorBlock: off"); }
        try {
          const q = xa.list().filter((f) => xa.isQuarantined(f.id));
          L.push(q.length ? "Quarantined features: " + q.map((f) => f.id).join(", ") : "No quarantined features ✓");
        } catch (_) {}
        // Live DOM probes against current YouTube selectors.
        for (const probe of [
          ["video element", "video.html5-main-video"],
          ["player shell", "#movie_player"],
          ["home grid", "ytd-rich-grid-renderer #contents"],
        ]) {
          let ok = false;
          try { ok = !!document.querySelector(probe[1]); } catch (_) {}
          L.push("Probe " + probe[0] + ": " + (ok ? "found ✓" : "not on this page"));
        }
        box.textContent = L.join("\n");
      };
      render();
      const btn = Oo("Re-run checks", render); en.appendChild(btn);
    },
  });

  // ─── 24. Queue Shuffle ───────────────────────────────────────────────────
  // Fisher-Yates shuffle over the local queue with Alt+U anywhere.
  xa.register({
    id: "queue-shuffle", name: "Queue Shuffle",
    summary: "Shuffle your local watch queue instantly with Alt+U.",
    masterKey: "queueShuffleOn", keys: ["queueShuffleOn"],
    apply(ctx) {
      if (!S.queueShuffleOn) return;
      const shuffle = () => {
        const list = ZenQueue.getList();
        if (list.length < 2) { pe("Queue too small to shuffle.", 1400, "info"); return; }
        for (let i = list.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [list[i], list[j]] = [list[j], list[i]];
        }
        ZenQueue.clear();
        list.forEach((v) => ZenQueue.add(v));
        g.emit("zen.queue.shuffled", { size: list.length });
        pe("Queue shuffled (" + list.length + ").", 1600, "success");
      };
      ctx.addListener(document, "keydown", (ev) => {
        if (ev.altKey && !ev.ctrlKey && !ev.metaKey && ev.code === "KeyU" && !ZenPack.guardKey(ev)) {
          ev.preventDefault(); shuffle();
        }
      });
      ZenEngine.scheduleOnReady(ctx, () => {
        const host = document.querySelector("#ytp-zen-queue");
        if (!host) return false;
        if (host.querySelector(".zen-q-shuffle")) return true;
        const b = document.createElement("button");
        b.className = "zen-btn zen-q-shuffle"; b.textContent = "Shuffle";
        b.style.marginTop = "6px";
        b.addEventListener("click", shuffle);
        host.appendChild(b);
        return true;
      }, { attempts: 6, delayMs: 600 });
    },
    settings(en) { en.appendChild(Io("Enable queue shuffle (Alt+U)", "queueShuffleOn")); },
  });

  // ─── 25. Frame Stepper ───────────────────────────────────────────────────
  // Player buttons + hotkeys that nudge by exactly one frame at your FPS.
  xa.register({
    id: "frame-stepper", name: "Frame Stepper",
    summary: "Precise frame-by-frame nudges (‹ › buttons and Alt+, / Alt+.) at any FPS.",
    masterKey: "frameStepperOn", keys: ["frameStepperOn", "frameFps"],
    apply(ctx) {
      if (!S.frameStepperOn) return;
      ZenEngine.injectCSS();
      const fps = () => Math.max(12, Math.min(120, Number(S.frameFps) || 30));
      const step = (dir) => {
        const el = ie.el(); if (!el) return;
        try { el.pause(); el.currentTime += dir / fps(); } catch (_) {}
      };
      ctx.addListener(document, "keydown", (ev) => {
        if (!ev.altKey || ev.ctrlKey || ev.metaKey || ZenPack.guardKey(ev)) return;
        if (ev.code === "Comma") { ev.preventDefault(); step(-1); }
        if (ev.code === "Period") { ev.preventDefault(); step(1); }
      });
      ZenEngine.scheduleOnReady(ctx, () => {
        const bar = document.querySelector(".ytp-right-controls");
        if (!bar || bar.querySelector("#ytp-zen-frameback")) return !!bar.querySelector("#ytp-zen-frameback");
        const mk = (id, label, dir) => {
          const b = document.createElement("button");
          b.id = id; b.className = "ytp-button"; b.title = label; b.textContent = dir < 0 ? "‹·" : "·›";
          b.addEventListener("click", (ev) => { ev.stopPropagation(); step(dir); });
          bar.prepend(b);
          return b;
        };
        mk("ytp-zen-frameback", "Back one frame (Alt+,)", -1);
        mk("ytp-zen-framefwd", "Forward one frame (Alt+.)", 1);
        return true;
      }, { attempts: 8, delayMs: 500 });
      Yt["frame-stepper"].push(() => {
        ["ytp-zen-frameback", "ytp-zen-framefwd"].forEach((id) => {
          const b = document.getElementById(id); if (b) b.remove();
        });
      });
    },
    settings(en) {
      en.appendChild(Io("Enable frame stepping", "frameStepperOn"));
      en.appendChild(No("Assumed FPS", "frameFps", 12, 120, 1, v => v + " fps"));
    },
  });

  // ─── 26. Playlist Position Memory ────────────────────────────────────────
  // Long course playlist? Reopening it offers to resume exactly where the
  // playlist left off — index and timestamp.
  xa.register({
    id: "playlist-resume", name: "Playlist Resume",
    summary: "Remembers where each playlist stopped and offers one-click resumption.",
    masterKey: "playlistResumeOn", keys: ["playlistResumeOn"],
    apply(ctx) {
      if (!S.playlistResumeOn) return;
      ZenEngine.injectCSS();
      const store = ZenEngine.createStore("__zen_pl_resume__", {});
      const plId = () => { try { return new URL(location.href).searchParams.get("list"); } catch (_) { return null; } };
      let saveTick = 0;
      const binder = ZenPack.elBinder();
      binder(ctx, "timeupdate", () => {
        const p = plId(), el = ie.el();
        if (!p || !el || !Number.isFinite(el.currentTime)) return;
        const now = Date.now();
        if (now - saveTick < 5000) return;
        saveTick = now;
        let idx = null;
        try {
          const api = ie.api();
          idx = api && typeof api.getPlaylistIndex === "function" ? api.getPlaylistIndex() : null;
        } catch (_) {}
        store.update(d => { d[p] = { v: ie.videoId(), i: idx, t: el.currentTime, at: now }; });
      });
      const offer = () => {
        const p = plId(); if (!p) return;
        const rec = store.get()[p];
        if (!rec || !rec.v || rec.t < 15) return;
        const curVid = ie.videoId();
        if (curVid === rec.v) return; // already there
        const toastHost = document.getElementById("ytp-zen-plresume") || document.createElement("button");
        toastHost.id = "ytp-zen-plresume";
        toastHost.className = "zen-btn primary";
        toastHost.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:52px;z-index:2147483636;padding:8px 16px";
        toastHost.textContent = "↩ Resume this playlist at " + ZenPack.fmtTs(rec.t);
        toastHost.onclick = () => {
          try { e.location.href = "/watch?v=" + rec.v + "&list=" + p + (rec.i != null ? "&index=" + (rec.i + 1) : "") + "&t=" + Math.floor(rec.t); } catch (_) {}
          toastHost.remove();
        };
        if (!toastHost.parentNode) document.body.appendChild(toastHost);
        setTimeout(() => { if (toastHost.parentNode) toastHost.remove(); }, 12000);
      };
      ctx.onNav(() => ctx.addTimeout(offer, 1200));
      Yt["playlist-resume"].push(() => {
        const b = document.getElementById("ytp-zen-plresume"); if (b) b.remove();
      });
    },
    settings(en) { en.appendChild(Io("Offer playlist resume points", "playlistResumeOn")); },
  });

  // ─── 27. Per-Channel Volume Memory ───────────────────────────────────────
  // Some channels are whisper-quiet, others deafening. Remember volume per
  // channel and restore it automatically.
  xa.register({
    id: "channel-volume", name: "Per-Channel Volume",
    summary: "Remembers your preferred loudness for every channel and applies it quietly.",
    masterKey: "channelVolumeOn", keys: ["channelVolumeOn"],
    apply(ctx) {
      if (!S.channelVolumeOn) return;
      const store = ZenEngine.createStore("__zen_ch_vol__", {});
      let appliedFor = "";
      const binder = ZenPack.elBinder();
      binder(ctx, "loadedmetadata", tryApply);
      binder(ctx, "play", tryApply);
      function tryApply() {
        const el = ie.el(), ch = ie.channel();
        if (!el || !ch || ch === appliedFor) return;
        const pref = store.get()[ch];
        if (pref && Number.isFinite(pref.v)) {
          try { el.volume = Math.max(0, Math.min(1, pref.v)); } catch (_) {}
          appliedFor = ch;
        }
      }
      // Learn: remember volume 3s after user adjusts it.
      const binder2 = ZenPack.elBinder();
      binder2(ctx, "volumechange", () => {
        const el = ie.el(), ch = ie.channel();
        if (!el || !ch) return;
        clearTimeout(tryApply._t);
        tryApply._t = setTimeout(() => {
          const cur = ie.el();
          if (!cur || cur !== el) return;
          store.update(d => { d[ch] = { v: el.volume, at: Date.now() }; });
        }, 3000);
      });
      Yt["channel-volume"].push(() => { clearTimeout(tryApply._t); });
    },
    settings(en) { en.appendChild(Io("Remember volume per channel", "channelVolumeOn")); },
  });

  // ─── 28. Quick Collection Send ───────────────────────────────────────────
  // One click under the player sends the current video into any collection.
  xa.register({
    id: "quick-collection-send", name: "Quick Save to Collection",
    summary: "A small ▤ menu under the player drops the current video into any collection.",
    masterKey: "quickCollectionSendOn", keys: ["quickCollectionSendOn"],
    apply(ctx) {
      if (!S.quickCollectionSendOn) return;
      ZenEngine.injectCSS();
      const mount = () => {
        const below = document.querySelector("#below #owner, #below ytd-watch-metadata #actions");
        if (!below || below.querySelector(".zen-qsend")) return !!below;
        const wrap = document.createElement("div");
        wrap.className = "zen-qsend";
        wrap.style.cssText = "margin:8px 0;display:inline-flex;gap:6px;align-items:center";
        const btn = document.createElement("button");
        btn.className = "zen-btn"; btn.textContent = "▤ Save to…";
        const sel = document.createElement("select");
        sel.style.cssText = "display:none;background:#16181f;color:#eee;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:4px 8px;font-size:12px";
        const fill = () => {
          sel.replaceChildren();
          const cols = ZenSession.collections.list();
          if (!cols.length) { const o = document.createElement("option"); o.textContent = "(no collections yet)"; sel.appendChild(o); return; }
          cols.forEach((c) => { const o = document.createElement("option"); o.value = c.id; o.textContent = c.name + " (" + c.videos.length + ")"; sel.appendChild(o); });
        };
        btn.addEventListener("click", () => { fill(); sel.style.display = sel.style.display === "none" ? "inline-block" : "none"; });
        sel.addEventListener("change", () => {
          const vid = ie.videoId(); if (!vid || !sel.value) return;
          ZenSession.collections.addVideo(sel.value, { videoId: vid, title: ie.title() || vid });
          pe("Saved to collection.", 1500, "success");
          sel.style.display = "none";
        });
        wrap.append(btn, sel);
        below.appendChild(wrap);
        return true;
      };
      ZenEngine.scheduleOnReady(ctx, mount, { attempts: 10, delayMs: 500 });
      Yt["quick-collection-send"].push(() => {
        document.querySelectorAll(".zen-qsend").forEach((w) => w.remove());
      });
    },
    settings(en) { en.appendChild(Io("Show quick-save under the player", "quickCollectionSendOn")); },
  });

  // ─── 29. Reader Mode ─────────────────────────────────────────────────────
  // Expands the description into a clean overlay: big type, zero clutter.
  xa.register({
    id: "reader-mode", name: "Description Reader",
    summary: "Open long descriptions in a calm reader panel — large type, no chrome.",
    masterKey: "readerModeOn", keys: ["readerModeOn"],
    apply(ctx) {
      if (!S.readerModeOn) return;
      ZenEngine.injectCSS();
      let overlay = null;
      const open = () => {
        const descEl = document.querySelector("#description-inline-expander, #description, ytd-text-inline-expander");
        if (!descEl || !document.body) return;
        close();
        overlay = document.createElement("div");
        overlay.id = "ytp-zen-reader";
        overlay.setAttribute("role", "dialog");
        overlay.style.cssText = "position:fixed;inset:0;z-index:2147483640;background:rgba(10,11,15,.94);" +
          "display:flex;align-items:center;justify-content:center;padding:24px;overflow:auto";
        const inner = document.createElement("div");
        inner.style.cssText = "max-width:720px;width:100%;background:rgba(18,20,27,.98);border-radius:14px;" +
          "padding:26px 30px;border:1px solid rgba(255,255,255,.1);color:#e8e8ee;" +
          "font:15px/1.65 system-ui;white-space:pre-wrap;max-height:86vh;overflow:auto";
        inner.textContent = descEl.innerText || descEl.textContent || "";
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "× Close";
        closeBtn.className = "zen-btn";
        closeBtn.style.cssText = "float:right;margin-left:12px";
        closeBtn.addEventListener("click", close);
        inner.prepend(closeBtn);
        overlay.appendChild(inner);
        overlay.addEventListener("click", (ev) => { if (ev.target === overlay) close(); });
        document.body.appendChild(overlay);
      };
      const close = () => { if (overlay) { overlay.remove(); overlay = null; } };
      const mount = () => {
        const meta = document.querySelector("#description-inline-expander, ytd-text-inline-expander");
        if (!meta || meta.querySelector(".zen-reader-open")) return !!meta;
        const b = document.createElement("button");
        b.className = "zen-btn zen-reader-open";
        b.style.cssText = "margin-top:6px";
        b.textContent = "📖 Reader mode";
        b.addEventListener("click", open);
        meta.appendChild(b);
        return true;
      };
      ZenEngine.scheduleOnReady(ctx, mount, { attempts: 10, delayMs: 500 });
      ctx.addListener(document, "keydown", (ev) => { if (ev.key === "Escape") close(); });
      ctx.onNav(close);
      Yt["reader-mode"].push(close);
    },
    settings(en) { en.appendChild(Io("Add reader mode to descriptions", "readerModeOn")); },
  });

  // ─── 30. Zen Breather ────────────────────────────────────────────────────
  // Alt+G opens a 60-second guided breathing overlay — a hard reset for doom-
  // scroll fingers. Esc exits anytime.
  xa.register({
    id: "zen-breather", name: "Zen Breather",
    summary: "Alt+G dims everything for a one-minute breathing circle. Esc leaves anytime.",
    masterKey: "zenBreatherOn", keys: ["zenBreatherOn"],
    apply(ctx) {
      if (!S.zenBreatherOn) return;
      ZenEngine.injectCSS();
      let ov = null, raf = 0;
      const close = () => {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        if (ov) { ov.remove(); ov = null; }
      };
      const open = () => {
        if (!document.body || ov) return;
        ov = document.createElement("div");
        ov.id = "ytp-zen-breather";
        ov.style.cssText = "position:fixed;inset:0;z-index:2147483643;background:rgba(6,7,10,.93);" +
          "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px";
        const circle = document.createElement("div");
        circle.style.cssText = "width:130px;height:130px;border-radius:50%;border:2px solid rgba(255,138,165,.75);" +
          "transition:transform 4s ease-in-out, opacity 4s ease-in-out;opacity:.55";
        const label = document.createElement("div");
        label.style.cssText = "font:600 13px system-ui;color:#ffd7e3;letter-spacing:.08em;text-transform:uppercase";
        label.textContent = "in";
        const hint = document.createElement("div");
        hint.style.cssText = "font:11px system-ui;color:#889";
        hint.textContent = "Esc to finish · 4s in, 4s out";
        ov.append(circle, label, hint);
        ov.addEventListener("click", close);
        document.body.appendChild(ov);
        let phase = 0, t0 = performance.now();
        const anim = (now) => {
          if (!ov) return;
          const el = (now - t0) / 1000;
          const cycle = Math.floor(el / 4) % 2;
          const k = Math.min(1, (el % 4) / 4);
          if (cycle === 0) { circle.style.transform = "scale(" + (0.72 + 0.38 * k) + ")"; circle.style.opacity = String(0.55 + 0.45 * k); label.textContent = "in"; }
          else { circle.style.transform = "scale(" + (1.1 - 0.38 * k) + ")"; circle.style.opacity = String(1 - 0.45 * k); label.textContent = "out"; }
          raf = requestAnimationFrame(anim);
        };
        raf = requestAnimationFrame(anim);
      };
      ctx.addListener(document, "keydown", (ev) => {
        if (ev.altKey && !ev.ctrlKey && !ev.metaKey && ev.code === "KeyG" && !ZenPack.guardKey(ev)) {
          ev.preventDefault(); ov ? close() : open();
        }
        if (ev.key === "Escape") close();
      });
      Yt["zen-breather"].push(close);
    },
    settings(en) { en.appendChild(Io("Enable breather (Alt+G)", "zenBreatherOn")); },
  });
