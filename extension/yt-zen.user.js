// ==UserScript==
// @name         YT-zen
// @namespace    https://github.com/mheci/YT-zen
// @version      1.3.0
// @description  Clean, lightweight, and customizable client-side interface for YouTube.
// @author       YT-zen Team
// @license      Unlicense
// @homepageURL  https://github.com/mheci/YT-zen
// @supportURL   https://github.com/mheci/YT-zen/issues
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @match        https://music.youtube.com/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_info
// @grant        unsafeWindow
// @connect      sponsor.ajay.app
// @connect      www.youtube.com
// @connect      self
// @connect      googlevideo.com
// @connect      ytimg.com
// @connect      ggpht.com
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @connect      objects.githubusercontent.com
// @icon         https://raw.githubusercontent.com/mheci/YT-zen/main/icon.png
// @noframes
// @updateURL    https://github.com/mheci/YT-zen/releases/latest/download/yt-zen.meta.js
// @downloadURL  https://github.com/mheci/YT-zen/releases/latest/download/yt-zen.user.js
// ==/UserScript==
(() => {
  "use strict";
  const e = "undefined" != typeof unsafeWindow ? unsafeWindow : window;
  if (e.__YTPLUS_LOADED__) return;
  e.__YTPLUS_LOADED__ = !0;

  const __pristineXHROpen__ = XMLHttpRequest.prototype.open,
    __pristineXHRSend__ = XMLHttpRequest.prototype.send,
    __pristineFetch__ = e.fetch,
    __pristineBeacon__ = navigator.sendBeacon;
  try {
    const e = ("undefined" != typeof location && location.search) || "",
      t = /[?&]ytplus=on\b/i.test(e);
    if (t) {
      try {
        localStorage.removeItem("ytplus_killed");
      } catch (e) {}
      try {
        sessionStorage.removeItem("ytplus_kill");
      } catch (e) {}
    }
    const a = !t && /[?&]ytplus=off\b/i.test(e),
      n =
        !t &&
        (() => {
          try {
            return "1" === localStorage.getItem("ytplus_killed");
          } catch (e) {
            return !1;
          }
        })(),
      r =
        !t &&
        (() => {
          try {
            return "1" === sessionStorage.getItem("ytplus_kill");
          } catch (e) {
            return !1;
          }
        })();
    if (a || n || r) {
      try {
        console.warn("[YT-zen] kill-switch active - script aborted.");
      } catch (e) {}
      try {
        "function" == typeof GM_registerMenuCommand &&
          GM_registerMenuCommand(
            "YT-zen is off - click to turn it back on",
            () => {
              try {
                localStorage.removeItem("ytplus_killed");
              } catch (e) {}
              try {
                sessionStorage.removeItem("ytplus_kill");
              } catch (e) {}
              location.reload();
            },
          );
      } catch (e) {}
      return;
    }
  } catch (e) {}
  try {
    if (
      e.trustedTypes &&
      "function" == typeof e.trustedTypes.createPolicy &&
      !e.trustedTypes.defaultPolicy
    )
      try {
        e.trustedTypes.createPolicy("default", {
          createHTML: (e) => e,
          createScriptURL: (e) => e,
          createScript: (e) => e,
        });
      } catch (e) {}
  } catch (e) {}

  const _mp = (() => {
    "use strict";

    let _nextId = 1;

    const _byId = new Map();
    const _byKind = new Map();
    const _allocLog = [];
    const _maxLog = 200;

    const _caches = [];

    let _finalizer = null;

    let _running = true;

    let _lastHeap = 0;
    let _lastHeapWarn = 0;

    let _maintTimer = 0;

    let _softCleanupLast = 0;

    let _totalAcquired = 0;
    let _totalReleased = 0;
    let _doubleFreeAttempts = 0;
    let _finalizerRecoveries = 0;

    const _log = (kind, msg, ref) => {
      try {
        _allocLog.push({ t: Date.now(), k: kind, m: String(msg).slice(0, 160) });
        if (_allocLog.length > _maxLog) _allocLog.shift();
        if (kind === "double-free") {
          try { h && h("[YT-zen][mp] " + msg, ref); } catch (e) {}
        } else if (kind === "leak-suspect") {
          try { h && h("[YT-zen][mp] " + msg, ref); } catch (e) {}
        }
      } catch (e) {}
    };

    const acquire = (kind, owner, payload) => {
      if (!_running) {

        return {
          id: 0,
          kind: kind || "unknown",
          owner: owner || "?",
          ref: payload && payload.ref,
          released: true,
          dispose: () => {},
        };
      }
      const id = _nextId++;
      const handle = {
        id,
        kind: kind || "unknown",
        owner: owner || "?",
        t: Date.now(),
        ref: payload && payload.ref,
        meta: payload && payload.meta,
        released: false,
        releaseFn: (payload && payload.release) || null,
        dispose() {
          if (this.released) {
            _doubleFreeAttempts++;
            _log(
              "double-free",
              "double dispose on " + kind + " #" + id + " (" + owner + ")",
              this.ref,
            );
            return;
          }
          this.released = true;
          _totalReleased++;
          _byId.delete(id);
          const cnt = _byKind.get(kind) || 0;
          if (cnt <= 1) _byKind.delete(kind);
          else _byKind.set(kind, cnt - 1);
          try {
            if (typeof this.releaseFn === "function") this.releaseFn(this.ref);
          } catch (e) {}
          if (this.ref && _finalizer) {
            try {
              _finalizer.unregister(this._token);
            } catch (e) {}
            this._token = null;
          }
        },

        alive() {
          return !this.released && _byId.has(id);
        },
      };
      _byId.set(id, handle);
      _byKind.set(kind, (_byKind.get(kind) || 0) + 1);
      _totalAcquired++;

      if (payload && payload.ref && typeof WeakRef === "function" && _finalizer) {
        try {
          handle._token = _finalizer.register(
            payload.ref,
            handle,
            handle,
          );
        } catch (e) {}
      }
      return handle;
    };

    const releaseById = (id) => {
      const h = _byId.get(id);
      if (h) h.dispose();
    };

    const releaseKind = (kind) => {
      const ids = [];
      for (const h of _byId.values()) if (h.kind === kind) ids.push(h.id);
      for (const id of ids) releaseById(id);
    };

    const safeSetTimeout = (fn, ms, owner) => {
      let id = 0;
      try {
        id = setTimeout(() => {
          try { fn(); } catch (e) {}
        }, ms);
      } catch (e) {
        return acquire("timeout", owner || "?", { ref: null });
      }
      return acquire("timeout", owner || "?", {
        ref: null,
        release: () => {
          try { clearTimeout(id); } catch (e) {}
        },
      });
    };
    const safeSetInterval = (fn, ms, owner) => {
      let id = 0;
      try {
        id = setInterval(() => {
          try { fn(); } catch (e) {}
        }, ms);
      } catch (e) {
        return acquire("interval", owner || "?", { ref: null });
      }
      return acquire("interval", owner || "?", {
        ref: null,
        release: () => {
          try { clearInterval(id); } catch (e) {}
        },
      });
    };

    const safeObserver = (kind, factory, owner) => {
      let obs = null;
      try {
        obs = factory();
      } catch (e) {
        return acquire("observer", owner || "?", { ref: null });
      }
      return acquire("observer", owner || "?", {
        ref: obs,
        meta: { kind },
        release: () => {
          try { obs && obs.disconnect && obs.disconnect(); } catch (e) {}
        },
      });
    };

    const safeListener = (target, event, fn, opts, owner) => {
      let added = false;
      try {
        target.addEventListener(event, fn, opts);
        added = true;
      } catch (e) {
        return acquire("listener", owner || "?", { ref: null });
      }
      return acquire("listener", owner || "?", {
        ref: { target, event, fn, opts },
        release: () => {
          try {
            if (added)
              target.removeEventListener(event, fn, opts);
          } catch (e) {}
        },
      });
    };

    const safeBlobURL = (blob, owner) => {
      let u = "";
      try {
        u = URL.createObjectURL(blob);
      } catch (e) {
        return acquire("blobURL", owner || "?", { ref: null });
      }
      return acquire("blobURL", owner || "?", {
        ref: { url: u },
        release: () => {
          try { u && URL.revokeObjectURL(u); } catch (e) {}
        },
      });
    };

    const safeElement = (el, owner) => {
      if (!el) return acquire("element", owner || "?", { ref: null });
      return acquire("element", owner || "?", {
        ref: el,
        release: () => {
          try {
            if (el.parentNode) el.parentNode.removeChild(el);
          } catch (e) {}
          try { el.remove && el.remove(); } catch (e) {}
        },
      });
    };

    const safeWrap = (fn, owner) => {
      return function (...args) {
        try {
          return fn.apply(this, args);
        } catch (e) {
          try {
            h && h("[YT-zen][mp] error in " + (owner || "?"), e);
          } catch (e2) {}
        }
      };
    };

    const registerCache = (name, map, cap, onEvict) => {
      if (!map || typeof map.size !== "number") return;
      _caches.push({
        name: name || "cache",
        map: map,
        cap: cap || 64,
        onEvict: onEvict || null,
      });
    };
    const evictCachePct = (name, pct) => {
      const c = _caches.find((c) => c.name === name);
      if (!c) return 0;
      const target = Math.max(1, Math.floor((c.map.size || 0) * pct));
      let n = 0;

      while (n < target && c.map.size > 0) {
        const firstKey = c.map.keys().next().value;
        if (firstKey === undefined) break;
        const val = c.map.get(firstKey);
        c.map.delete(firstKey);
        if (typeof c.onEvict === "function") {
          try { c.onEvict(firstKey, val); } catch (e) {}
        }
        n++;
      }
      return n;
    };

    const _maintTick = () => {
      if (!_running) return;

      try { typeof YtpCache !== "undefined" && YtpCache && YtpCache.cleanup(); } catch (e) {}

      try {
        const m = performance && performance.memory;
        if (m && typeof m.usedJSHeapSize === "number") {
          _lastHeap = m.usedJSHeapSize;
          const lim = m.jsHeapSizeLimit || 0;
          if (lim > 0) {
            const pct = _lastHeap / lim;
            if (pct > 0.8 && Date.now() - _lastHeapWarn > 6e4) {
              _lastHeapWarn = Date.now();
              _log("leak-suspect", "JSHeap > 80% (" + (pct * 100).toFixed(1) + "%), running soft cleanup");
              _softCleanup();
            }
          }
        }
      } catch (e) {}

      for (const c of _caches) {
        if (c.map && c.map.size > c.cap) {

          while (c.map.size > c.cap) {
            const firstKey = c.map.keys().next().value;
            if (firstKey === undefined) break;
            const val = c.map.get(firstKey);
            c.map.delete(firstKey);
            if (typeof c.onEvict === "function") {
              try { c.onEvict(firstKey, val); } catch (e) {}
            }
          }
        }
      }

      try {
        if (performance && performance.mark) {
          performance.mark("ytp-mp-tick");
        }
      } catch (e) {}
    };
    const _softCleanup = () => {

      for (const c of _caches) {
        try { evictCachePct(c.name, 0.25); } catch (e) {}
      }

      _softCleanupLast = Date.now();
    };
    const runMaintenance = () => {
      _maintTick();
    };

    const snapshot = () => {
      const counts = {};
      for (const [k, v] of _byKind) counts[k] = v;
      const cacheNames = _caches.map((c) => ({
        name: c.name,
        size: c.map && c.map.size,
        cap: c.cap,
      }));

      let score = 0;
      score += Math.min(50, (_byId.size / 200) * 50);
      if (_totalAcquired > 0) {
        score += Math.min(40, (_doubleFreeAttempts / _totalAcquired) * 400);
      }
      if (_lastHeap > 0) {
        const m = performance && performance.memory;
        if (m && m.jsHeapSizeLimit) {
          const pct = _lastHeap / m.jsHeapSizeLimit;
          if (pct > 0.8) score += 25;
        }
      }
      score = Math.min(100, Math.round(score));
      return {
        version: 1,
        live: _byId.size,
        acquired: _totalAcquired,
        released: _totalReleased,
        doubleFreeAttempts: _doubleFreeAttempts,
        finalizerRecoveries: _finalizerRecoveries,
        byKind: counts,
        caches: cacheNames,
        heap: {
          used: _lastHeap,
          jsHeapSizeLimit:
            (performance && performance.memory &&
              performance.memory.jsHeapSizeLimit) || 0,
        },
        leakScore: score,
        lastSoftCleanup: _softCleanupLast,
        ts: Date.now(),
      };
    };

    const audit = () => {
      const out = [];
      for (const h of _byId.values()) {
        out.push({
          id: h.id,
          kind: h.kind,
          owner: h.owner,
          age: Date.now() - (h.t || 0),
          meta: h.meta || null,
        });
      }
      return {
        live: out.length,
        byKind: Object.assign({}, snapshot().byKind),
        leakScore: snapshot().leakScore,
        resources: out.slice(0, 200), 
      };
    };

    const disposeAll = () => {

      const ids = Array.from(_byId.keys());
      for (const id of ids) releaseById(id);

      try { clearInterval(_maintTimer); } catch (e) {}
      _maintTimer = 0;
      _running = false;
    };

    return {
      acquire,
      releaseById,
      releaseKind,
      safeSetTimeout,
      safeSetInterval,
      safeObserver,
      safeListener,
      safeBlobURL,
      safeElement,
      safeWrap,
      registerCache,
      evictCachePct,
      runMaintenance,
      snapshot,
      audit,
      disposeAll,
      _internal: {
        softCleanup: _softCleanup,
        setFinalizer: (f) => { _finalizer = f; },
        bumpFinalizer: () => { _finalizerRecoveries++; },
        isRunning: () => _running,
        markRunning: (v) => { _running = !!v; },
      },
    };
  })();

  try {
    if (typeof FinalizationRegistry === "function" && typeof WeakRef === "function") {
      const _fr = new FinalizationRegistry((held) => {
        try {

          if (held && !held.released) {
            _mp._internal.bumpFinalizer();
            try { p("warn", "[YT-zen][mp] GC recovered " + held.kind + " #" + held.id + " (" + held.owner + ")"); } catch (e) {}
            try { held.dispose(); } catch (e) {}
          }
        } catch (e) {}
      });
      _mp._internal.setFinalizer(_fr);
    }
  } catch (e) {}

  const YtpCache = (() => {
    const _memCache = new Map();
    const _inFlight = new Map();

    const getChecksum = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash).toString(16);
    };

    const get = async (key, options = {}) => {
      const { source = "idb", allowExpired = false } = options;
      const now = Date.now();

      if (_memCache.has(key)) {
        const entry = _memCache.get(key);
        if (allowExpired || entry.expires > now) {
          return entry.data;
        }
        _memCache.delete(key);
      }

      if (source === "gm") {
        try {
          const valStr = GM_getValue && GM_getValue("cache:" + key);
          if (valStr) {
            const entry = JSON.parse(valStr);
            if (allowExpired || entry.expires > now) {
              _memCache.set(key, entry);
              return entry.data;
            }
            GM_deleteValue && GM_deleteValue("cache:" + key);
          }
        } catch (e) {
          try { h("[YT-zen][cache] GM read failed for " + key, e); } catch (_) {}
        }
      } else {
        try {
          const entry = await v("kv", "cache:" + key);
          if (entry && entry.v) {
            const parsed = entry.v;
            if (allowExpired || parsed.expires > now) {
              _memCache.set(key, parsed);
              return parsed.data;
            }
            await x("kv", "cache:" + key);
          }
        } catch (e) {
          try { h("[YT-zen][cache] IDB read failed for " + key, e); } catch (_) {}
        }
      }
      return null;
    };

    const set = async (key, data, ttlMs, options = {}) => {
      const { source = "idb", version = 1 } = options;
      const now = Date.now();
      const expires = now + ttlMs;
      const checksum = getChecksum(typeof data === "string" ? data : JSON.stringify(data));

      const entry = {
        data,
        timestamp: now,
        expires,
        version,
        source,
        checksum,
        ttl: ttlMs,
      };

      _memCache.set(key, entry);

      if (source === "gm") {
        try {
          GM_setValue && GM_setValue("cache:" + key, JSON.stringify(entry));
        } catch (e) {
          try { h("[YT-zen][cache] GM write failed for " + key, e); } catch (_) {}
        }
      } else {
        try {
          await k("kv", {
            k: "cache:" + key,
            v: entry,
            updatedAt: now,
          });
        } catch (e) {
          try { h("[YT-zen][cache] IDB write failed for " + key, e); } catch (_) {}
        }
      }
    };

    const remove = async (key, options = {}) => {
      const { source = "idb" } = options;
      _memCache.delete(key);
      if (source === "gm") {
        try { GM_deleteValue && GM_deleteValue("cache:" + key); } catch (e) {}
      } else {
        try { await x("kv", "cache:" + key); } catch (e) {}
      }
    };

    const getOrFetch = async (key, fetchFn, ttlMs, options = {}) => {
      const cachedData = await get(key, options);
      if (cachedData !== null) {
        return cachedData;
      }

      if (_inFlight.has(key)) {
        return _inFlight.get(key);
      }

      const promise = (async () => {
        try {
          const freshData = await fetchFn();
          if (freshData !== null && freshData !== undefined) {
            await set(key, freshData, ttlMs, options);
          }
          return freshData;
        } finally {
          _inFlight.delete(key);
        }
      })();

      _inFlight.set(key, promise);
      return promise;
    };

    const cleanup = async () => {
      const now = Date.now();
      for (const [key, entry] of _memCache.entries()) {
        if (entry.expires <= now) {
          _memCache.delete(key);
        }
      }
      try {
        const allRows = await w("kv");
        for (const row of allRows) {
          if (row.k && row.k.startsWith("cache:")) {
            if (row.v && row.v.expires <= now) {
              await x("kv", row.k);
            }
          }
        }
      } catch (e) {}
    };

    return {
      get,
      set,
      remove,
      getOrFetch,
      cleanup,
    };
  })();

  try {
    setTimeout(() => {
      try { _mp.registerCache("sb-segments", typeof yt !== "undefined" ? yt : null, 64, null); } catch (e) {}
      try { _mp.registerCache("time-format", typeof de !== "undefined" ? de : null, 512, null); } catch (e) {}
      try {
        if (typeof Ve !== "undefined" && Ve && Ve.size !== undefined) {
          _mp.registerCache("thumb-blob", Ve, 24, (k, v) => {
            try { if (v && typeof v === "string") URL.revokeObjectURL(v); } catch (e) {}
          });
        }
      } catch (e) {}
    }, 0);
  } catch (e) {}

  try {

    const _mpMaintHandle = _mp.safeSetInterval(
      () => {
        try {
          if (
            typeof document !== "undefined" &&
            document.visibilityState === "hidden"
          )
            return;
          _mp.runMaintenance();
        } catch (e) {}
      },
      3e4, 
      "memory-maint",
    );

    try {
      _mp.safeListener(
        typeof window !== "undefined" ? window : null,
        "pagehide",
        () => {
          try { _mp.runMaintenance(); } catch (e) {}
        },
        { capture: true },
        "memory-pagehide-checkpoint",
      );
    } catch (e) {}
  } catch (e) {}

  const t = (() => {
      try {
        if (e.trustedTypes && e.trustedTypes.createPolicy)
          return e.trustedTypes.createPolicy("ytplus#dashboard", {
            createHTML: (e) => e,
          });
      } catch (e) {}
      return null;
    })(),
    a = (a, n) => {
      try {
        a.innerHTML = ((a) => {
          if (t) return t.createHTML(a);
          if (e.trustedTypes && e.trustedTypes.defaultPolicy)
            try {
              return e.trustedTypes.defaultPolicy.createHTML(a);
            } catch (e) {}
          return a;
        })(n);
      } catch (e) {
        try {
          const e = document.implementation.createHTMLDocument("");
          ((e.body.innerHTML = n), (a.textContent = ""));
          const t = document.createDocumentFragment();
          for (; e.body.firstChild; ) t.appendChild(e.body.firstChild);
          a.appendChild(t);
        } catch (e) {
          a.textContent = n.replace(/<[^>]*>/g, "");
        }
      }
    },
    n =
      ("undefined" != typeof GM_info &&
        GM_info.script &&
        GM_info.script.version) ||
      "3.1.0",
    r = "https://sponsor.ajay.app",
    o = (() => {
      try {
        return CSS.supports("selector(:has(*))");
      } catch (e) {
        return !1;
      }
    })(),

    i = [
      { id: "sponsor", label: "Sponsor", color: "#00d400" },
      { id: "selfpromo", label: "Self-Promo", color: "#ffff00" },
      { id: "interaction", label: "Interaction", color: "#cc00ff" },
      { id: "intro", label: "Intro", color: "#00ffff" },
      { id: "outro", label: "Endcards", color: "#0202ed" },
      { id: "preview", label: "Preview", color: "#008fd6" },
      { id: "music_offtopic", label: "Non-Music", color: "#ff9900" },
      { id: "poi_highlight", label: "Highlight", color: "#ff1684" },
      { id: "filler", label: "Filler", color: "#7300ab" },
      { id: "exclusive_access", label: "Exclusive", color: "#008a5c" },
      { id: "chapter", label: "Chapter", color: "#ffffff" },
      { id: "hook", label: "Hook", color: "#ff6f00" },
    ],

    Yi = {
      skip: "Skip",
      mute: "Mute",
      info: "Display Only",
      disabled: "Off",
    },

    Zi = [
      { id: "ajay", name: "SponsorBlock (official)", url: "https://sponsor.ajay.app" },
    ],
    d = {
      hd2160: "4K",
      hd1440: "1440p",
      hd1080: "1080p",
      hd720: "720p",
      large: "480p",
      medium: "360p",
      small: "240p",
      tiny: "144p",
      auto: "Auto",
    },
    c = (() => {
      const e = {};
      return (
        i.forEach((t) => {

          const defEn = "sponsor" === t.id;
          const defAct =
            t.id === "poi_highlight" || t.id === "chapter" ? "poi" : "skip";
          e["sb_" + t.id + "_en"] = defEn;
          e["sb_" + t.id + "_act"] = defAct;
        }),
        e
      );
    })(),
    s = Object.assign(
      {
        safeMode: !1,
        privacyShieldOn: !1,
        telemetryOptIn: !1,
        hotkeyOptIn: !1,
        silentToasts: !1,
        speedDefault: 1,
        speedRemember: !1,

        speedStep: 0.25,

        speedPerChannelOn: !1,

        perfModeOn: !1,
        perfModeLevel: "balanced",
        perfModeAuto: !1,

        cookieControlOn: !0,
        cookieControlLive: !0,
        cookieControlNotify: !1,
        cookieControlAutoBackup: !1,
        cookieControlFavorites: "",
        cookieControlCategories: "",
        loopVideo: !1,
        frameStep: !1,
        abLoopOn: !1,
        abA: -1,
        abB: -1,
        smartQualityOn: !1,
        smartQualityWifi: "hd1080",
        smartQualityCell: "medium",
        autoHD: !1,
        qualityPref: "hd1080",
        skipIntroOn: !1,
        skipIntroSec: 0,
        forceCC: !1,
        forceCCLang: "",
        ccNativePrefs: !0,
        ccFontSize: 28,
        ccFontFamily: "Roboto, Arial, sans-serif",
        ccFontWeight: "700",
        ccTextColor: "#ffffff",
        ccBgColor: "#000000",
        ccBgOpacity: 72,
        ccTextShadow: "outline",
        ccLineHeight: 1.25,
        ccBottomOffset: 5,
        ccUppercase: !1,
        ccRadius: 4,
        ccFallbackLangs: "en,en-US,en-GB",
        ccKindPref: "any",
        ccAutoTranslate: !1,
        ccTranslateTo: "",
        ccSkipMusic: !0,
        ccSkipShorts: !1,
        ccRespectManualOff: !0,
        ccReEngageOnPlay: !0,
        ccLetterSpacing: 0,
        autoSkipAdBtn: !1,
        adMute: !1,
        adSpeed: !1,
        hideBannerAds: !1,
        sponsorblockOn: !1,
        sbServer: r,
        sbPrivacy: !0,
        sbToast: !0,
        sbToastDur: 2200,
        sbMinVotes: 0,
        sbHud: !0,
        sbSeekbar: !0,

        sbMinViews: 0,
        sbMaxViews: 0, 
        sbIncludeLocked: !1,
        sbIncludeHidden: !1,
        sbIncludeIgnored: !1,

        sbTrimUUIDs: !0,

        sbSegOverrides: "",
        sbChanOverrides: "",

        sbChapterRules: "",

        sbUpNextSec: 12,

        sbColorOverrides: "",

        sbServerPreset: "ajay",

        sbHudStatus: !1,
        sessionRestoreOn: !1,
        sessionResumeMode: "card",
        sessionResumeDesign: "default",
        fpsCounterOn: !1,
        fpsCounterPos: "tl",
        bufferHealthOn: !1,
        longTaskWarnerOn: !1,
        longTaskWarnerThreshold: 50,
        droppedFrameOn: !1,
        droppedFramePos: "tr",
        droppedFrameShowRate: !1,
        droppedFrameResetOnNav: !0,
        videoStatsOn: !1,
        videoStatsPos: "bl",
        blockNumberSeekOn: !1,
        defaultOriginalAudioOn: !1,
        restoreFsScrollOn: !1,
        removeRedirectUrlsOn: !1,
        shortenShareUrlOn: !1,
        skipPausedContinueOn: !1,
        logoToSubsOn: !1,
        defaultChannelTab: "featured",
        blurThumbnailsOn: !1,
        blurThumbnailsAmount: 12,
        hideTopLiveGamesOn: !1,
        hfrAllowOn: !1,
        openSettingsOnHoverOn: !1,
        autoRecoverOn: !1,
        bgPlayersPauseOn: !1,
        forwardRewindOn: !1,
        forwardRewindSec: 10,
        reversePlaylistOn: !1,
        flipVideoOn: !1,
        flipVideoH: !1,
        flipVideoV: !1,
        bookmarksOn: !1,
        pipOn: !1,
        screenshotOn: !1,
        screenshotFmt: "png",
        screenshotScale: 1,

        screenshotClipboard: !1,
        sleepTimerOn: !1,
        sleepTimerMin: 30,
        forceWatchedOn: !1,

        forceWatchedAccountHistory: !0,
        forceWatchedLocalHistory: !0,
        theaterDefault: !1,
        wideTheater: !1,
        cinemaMode: !1,
        cinemaOp: 0.85,
        ambientMode: !1,
        ambientBlur: 24,
        ambientOp: 0.55,
        compactUI: !1,
        customCSSOn: !1,
        customCSS: "",
        videoFiltersOn: !1,
        vfBright: 100,
        vfContrast: 100,
        vfSat: 100,
        vfHue: 0,
        vfGray: !1,
        vfFlip: !1,
        vfZoom: 100,

        hideShorts: !1,
        hideShortsRedirect: !0,
        hideShortsDomClean: !0,
        hideShortsApiFilter: !0,

        hideAutoDubbedOn: !1,
        hideAutoDubbedPreferOriginal: !0,
        hideRecs: !1,
        hideComments: !1,
        hideEndscreen: !1,
        hideLivechat: !1,
        hideWatermark: !1,
        hideCards: !1,
        hideMasthead: !1,
        channelBlockerOn: !1,
        channelBlockerList: "",
        channelBlockerHideWatch: !0,
        channelBlockerHideBrowse: !0,
        channelBlockerHideComments: !0,
        channelBlockerMatchTitleText: !1,
        keywordFilterOn: !1,
        keywordFilterList: "",
        watchLaterQuick: !1,
        subscribeShortcut: !1,
        idleDimOn: !1,
        idleDimDelay: 60,
        idleDimBlur: 6,
        geoOverrideOn: !1,
        geoRegion: "US",
        geoLang: "en",
        geoTimezone: "",
        geoSafeSearch: !1,
        geoRestrictMode: !1,
        geoAutoReload: !1,
        geoPatchFetch: !1,
        geoPatchXHR: !1,
        geoPatchBeacon: !1,
        geoPatchNavigator: !1,
        sessionSummaryOn: !1,
        sessionSummaryThreshold: 3,
        chapterListOn: !1,
        commentSearchOn: !1,
        heatmapForceOn: !1,
        blockYTAIOn: !1,
        elementsControlOn: !1,
        elementsControlHidden: {},
        statsOverlay: !1,
        netMonitor: !1,
        diagConsole: !1,
        sessionReplay: !1,
        apiExplorer: !1,
        apiExplorerMutations: !1,
        remoteSelectorsOn: !1,
        remoteSelectorsURL: "",
        remoteSelectorsSHA: "",
        adaptiveThrottleOn: !1,
        disableVideoPreviewsOn: !1,
        autoDismissPauseOn: !1,
        alwaysShowProgressBar: !1,
        redirectShortsOn: !1,
        autoExpandDescOn: !1,
        disableAutoplayOn: !1,
        playerDashButtonOn: !0,
        autoPauseHiddenOn: !1,
        autoPauseBlurOn: !1,
        autoResumeAutoPausedOn: !1,
        confirmLeavePlayingOn: !1,
        topProgressBarOn: !1,
        remainingTimeBadgeOn: !1,
        localClockBadgeOn: !1,
        copyTimestampButtonOn: !1,
        copyVideoInfoButtonOn: !1,
        openTranscriptButtonOn: !1,
        videoNotesOn: !1,
        channelNotesOn: !1,
        chapterHotkeysOn: !1,
        chapterButtonsOn: !1,
        feedDimWatchedOn: !1,
        feedHideWatchedOn: !1,
        feedWatchedMode: "off",
        autoPauseMode: "off",
        highlightVideoLengthMode: "off",
        numberSearchResultsOn: !1,
        denseVideoGridOn: !1,
        highlightLongVideosOn: !1,
        longVideoMinSec: 1200,
        highlightShortVideosOn: !1,
        shortVideoMaxSec: 60,
        hideLiveContentOn: !1,
        hidePremieresOn: !1,
        playlistAutoscrollOn: !1,
        compactPlaylistOn: !1,
        shortsAutoMuteOn: !1,
        shortsHideCommentsOn: !1,
        collapseLongCommentsOn: !1,
        collapseLongCommentChars: 1200,
        highlightCreatorCommentsOn: !1,
        highlightTimestampLinksOn: !1,
        endSoonWarningOn: !1,
        endSoonSec: 20,
        compactModeOn: !1,
        themeEngineOn: !1,
        themeSelected: "none",
        themeOverhaulOn: !0,
        themeGlassOverhaulOn: !1,
        themeFxHoverLift: !0,
        themeFxRipple: !0,
        themeFxGlassMasthead: !0,
        themeFxThemeTransition: !0,
        themeFxScrollDriven: !0,
        themeFxScrollbar: !0,
        themeFxFocusRing: !0,
        themeFxButtonShine: !0,
        themeFxSidebarStagger: !0,
        themeFxCardLoadAnim: !0,
        themeFxAccentGradient: !0,
        themeFxReducedMotion: !1,
        themeAccentHue: 215,
        dashX: -1,
        dashY: -1,
        dashW: 460,
        dashH: -1,
        netMonitorOn: !1,
        netMonitorRange: "day",
        netMonitorBadge: !1,
        netMonitorPatchFetch: !0,
        netMonitorPatchXHR: !0,
        netMonitorPatchBeacon: !0,
        netBudgetOn: !1,
        netBudgetGB: 50,
        netBudgetAlerted: {},
        netQualityAttribOn: !1,
        unifiedHeatmapOn: !1,
        unifiedHeatmapShowSB: !0,
        unifiedHeatmapShowChapters: !0,
        unifiedHeatmapShowReplays: !0,

        dataMinimizationOn: !1,
        dataMinBlockStats: !0,
        dataMinBlockPagead: !0,
        dataMinBlockLogEvent: !0,
        dataMinAllowHeartbeat: !0,
        sbSubmitOn: !1,
        sbSubmitUserId: "",
        inVideoSearchOn: !1,
        inVideoSearchHotkey: "Ctrl+KeyF",
        perfProfilerOn: !1,
        hotkeyMap: {},
        stopButtonOn: !1,
      },
      c,
    ),
    l = [];
  function p(e, t, a) {

    if (Xt && Xt.perfMode && e === "info") return;
    (l.push({
      t: Date.now(),
      level: e,
      msg: String(t).slice(0, 200),
      data: "error" === e ? a : void 0,
    }),
      l.length > (Xt && Xt.perfMode ? 30 : 60) && l.shift(),
      "error" === e && console.error("[YTPlus]", t, a || ""));
  }
  const u = (e, t) => p("info", e, t),
    h = (e, t) => p("warn", e, t),
    m = (e, t) => p("error", e, t),
    y = () => l.slice(),
    g = (() => {
      const e = new Map();
      return {
        on: (t, a) => (
          e.has(t) || e.set(t, new Set()),
          e.get(t).add(a),
          () => g.off(t, a)
        ),
        off(t, a) {
          const n = e.get(t);
          n && n.delete(a);
        },
        emit(t, a) {
          const n = e.get(t);
          if (!n || !n.size) return;
          const r = Array.from(n);
          for (let e = 0; e < r.length; e++)
            try {
              r[e](a);
            } catch (e) {
              m("bus handler error for " + t, e);
            }
        },
      };
    })();
  let f = null;
  function b() {
    return (
      f ||
      ((f = new Promise((e) => {
        let t;
        try {
          t = indexedDB.open("ytplus_v2", 3);
        } catch (t) {
          return (h("IDB open threw", t), e(null));
        }
        ((t.onupgradeneeded = (e) => {
          try {
            const a = t.result,
              n = e.target.transaction;
            let r;
            if (
              (a.objectStoreNames.contains("kv") ||
                a.createObjectStore("kv", { keyPath: "k" }),
              a.objectStoreNames.contains("history"))
            ) {
              if (n) {
                r = n.objectStore("history");
                const e = ["lw", "pinned", "completed", "channelId"],
                  t = new Set(r.indexNames);
                for (const a of e)
                  if (!t.has(a))
                    try {
                      "lw" === a
                        ? r.createIndex("lw", "lastWatched", { unique: !1 })
                        : r.createIndex(a, a, { unique: !1 });
                    } catch (e) {}
              }
            } else
              ((r = a.createObjectStore("history", { keyPath: "videoId" })),
                r.createIndex("lw", "lastWatched", { unique: !1 }),
                r.createIndex("pinned", "pinned", { unique: !1 }),
                r.createIndex("completed", "completed", { unique: !1 }),
                r.createIndex("channelId", "channelId", { unique: !1 }));
            (a.objectStoreNames.contains("bookmarks") ||
              a
                .createObjectStore("bookmarks", { keyPath: "id" })
                .createIndex("ts", "ts", { unique: !1 }),
              a.objectStoreNames.contains("replay") ||
                a.createObjectStore("replay", {
                  keyPath: "id",
                  autoIncrement: !0,
                }),
              a.objectStoreNames.contains("thumbCache") ||
                a
                  .createObjectStore("thumbCache", { keyPath: "videoId" })
                  .createIndex("ts", "ts", { unique: !1 }),
              a.objectStoreNames.contains("netBuckets") ||
                a.createObjectStore("netBuckets", { keyPath: "h" }));
          } catch (e) {
            m("IDB upgrade error", e);
          }
        }),
          (t.onsuccess = () => e(t.result)),
          (t.onerror = () => {
            (h("IDB open failed", t.error), (f = null), e(null));
          }),
          (t.onblocked = () => h("IDB upgrade blocked")));
      })),
      f)
    );
  }
  function v(e, t) {
    return b().then((a) =>
      a
        ? new Promise((n) => {
            try {
              const r = a.transaction(e, "readonly").objectStore(e).get(t);
              ((r.onsuccess = () => n(r.result)), (r.onerror = () => n(null)));
            } catch (e) {
              n(null);
            }
          })
        : null,
    );
  }
  function k(e, t) {
    return b().then((a) =>
      a
        ? new Promise((n) => {
            try {
              const r = a.transaction(e, "readwrite");
              (r.objectStore(e).put(t),
                (r.oncomplete = () => n()),
                (r.onerror = () => n()));
            } catch (e) {
              n();
            }
          })
        : null,
    );
  }
  function x(e, t) {
    return b().then((a) =>
      a
        ? new Promise((n) => {
            try {
              const r = a.transaction(e, "readwrite");
              (r.objectStore(e).delete(t),
                (r.oncomplete = () => n()),
                (r.onerror = () => n()));
            } catch (e) {
              n();
            }
          })
        : null,
    );
  }
  function w(e, t, a) {
    return b().then((n) =>
      n
        ? new Promise((r) => {
            try {
              const o = n.transaction(e, "readonly").objectStore(e);
              if (!t && !a && "function" == typeof o.getAll) {
                const e = o.getAll();
                return (
                  (e.onsuccess = () => r(e.result || [])),
                  void (e.onerror = () => r([]))
                );
              }
              if (
                t &&
                (void 0 === a || "next" === a) &&
                "function" == typeof o.index(t).getAll
              ) {
                const e = o.index(t).getAll();
                return (
                  (e.onsuccess = () => r(e.result || [])),
                  void (e.onerror = () => r([]))
                );
              }
              const i = t
                  ? o.index(t).openCursor(null, a || "next")
                  : o.openCursor(),
                d = [];
              ((i.onsuccess = (e) => {
                const t = e.target.result;
                t ? (d.push(t.value), t.continue()) : r(d);
              }),
                (i.onerror = () => r([])));
            } catch (e) {
              r([]);
            }
          })
        : [],
    );
  }
  function C(e) {
    return b().then((t) =>
      t
        ? new Promise((a) => {
            try {
              const n = t.transaction(e, "readwrite");
              (n.objectStore(e).clear(),
                (n.oncomplete = () => a()),
                (n.onerror = () => a()));
            } catch (e) {
              a();
            }
          })
        : null,
    );
  }
  let S = Object.assign({}, s),
    T = !1,
    O = 0,
    M = !1,
    L = null,
    A = 0;
  const E = ["darkTweaks"],
    B = "ytp.cfg",
    P = "ytp.cfg",
    I = "__cfg__";
  let R = null,
    N = !1,
    _ = null,
    H = !1;
  function D(e) {
    if (!e || "object" != typeof e) return {};
    const t = {};
    for (const [a, n] of Object.entries(s)) {
      if (!(a in e)) continue;
      const r = e[a],
        o = typeof n;
      if (null == n) t[a] = r;
      else if ("boolean" === o) t[a] = "boolean" == typeof r ? r : !!r;
      else if ("number" === o) {
        const e = Number(r);
        t[a] = isFinite(e) ? e : n;
      } else
        t[a] =
          "string" === o
            ? "string" == typeof r
              ? r
              : String(r ?? "")
            : "object" === o
              ? r && "object" == typeof r
                ? r
                : n
              : r;
    }
    return t;
  }
  function q() {
    try {
      const e = GM_getValue(P, null);
      if (!e) return null;
      const t = "string" == typeof e ? JSON.parse(e) : e;
      return t && "object" == typeof t ? t : null;
    } catch (e) {
      return null;
    }
  }
  function V() {
    try {
      const e =
        "undefined" != typeof localStorage ? localStorage.getItem(B) : null;
      if (!e) return null;
      const t = JSON.parse(e);
      return t && "object" == typeof t ? t : null;
    } catch (e) {
      return null;
    }
  }
  function F(e) {
    return e.length
      ? (e.sort((e, t) => {
          const a = (t.ver || 0) - (e.ver || 0);
          return 0 !== a ? a : (t.ts || 0) - (e.ts || 0);
        }),
        e[0])
      : null;
  }
  function j(e) {
    const t = D(e),
      a = (function (e) {
        if (!e || "object" != typeof e) return e;
        if (
          (null == e.feedWatchedMode &&
            (e.feedHideWatchedOn
              ? (e.feedWatchedMode = "hide")
              : e.feedDimWatchedOn
                ? (e.feedWatchedMode = "dim")
                : (e.feedWatchedMode = "off")),
          null == e.autoPauseMode)
        ) {
          const t = !!e.autoPauseHiddenOn,
            a = !!e.autoPauseBlurOn;
          e.autoPauseMode = t && a ? "both" : t ? "hidden" : a ? "blur" : "off";
        }
        if (null == e.highlightVideoLengthMode) {
          const t = !!e.highlightLongVideosOn,
            a = !!e.highlightShortVideosOn;
          e.highlightVideoLengthMode =
            t && a ? "both" : t ? "long" : a ? "short" : "off";
        }
        return e;
      })(Object.assign({}, t));
    ((S = Object.assign({}, s, a)),
      (S.feedDimWatchedOn = "dim" === S.feedWatchedMode),
      (S.feedHideWatchedOn = "hide" === S.feedWatchedMode),
      (S.autoPauseHiddenOn =
        "hidden" === S.autoPauseMode || "both" === S.autoPauseMode),
      (S.autoPauseBlurOn =
        "blur" === S.autoPauseMode || "both" === S.autoPauseMode),
      (S.highlightLongVideosOn =
        "long" === S.highlightVideoLengthMode ||
        "both" === S.highlightVideoLengthMode),
      (S.highlightShortVideosOn =
        "short" === S.highlightVideoLengthMode ||
        "both" === S.highlightVideoLengthMode));
    for (const e of E) delete S[e];
  }

  const _GITHUB_RELEASES = "https://github.com/mheci/YT-zen/releases";
  const _GITHUB_LATEST_USERJS =
    "https://github.com/mheci/YT-zen/releases/latest/download/yt-zen.user.js";
  const _GITHUB_API_LATEST =
    "https://api.github.com/repos/mheci/YT-zen/releases/latest";
  const _CHECK_CACHE_KEY = "ytp_update_check_ts";

  function Fu(force) {

    const installed = (() => {
      try { return (GM_info && GM_info.script && String(GM_info.script.version)) || "0.0.0"; }
      catch (_) { return "0.0.0"; }
    })();
    const a = (a) => {
      const b = String(a || "0.0.0").replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
      while (b.length < 3) b.push(0);
      return b;
    };

    const o = (x, y) => {
      const A = Array.isArray(x) ? x : a(x);
      const B = Array.isArray(y) ? y : a(y);
      for (let i = 0; i < 3; i++) {
        if (A[i] !== B[i]) return A[i] < B[i] ? -1 : 1;
      }
      return 0;
    };

    const showUpdateAvailable = (latestTag, installUrl) => {
      pe("YT-zen " + latestTag + " available (you have " + installed + ")", 4000, "info");
      try {

        const b = document.createElement("div");
        b.id = "ytp-update-banner";
        b.style.cssText =
          "position:fixed;right:12px;top:60px;z-index:2147483640;background:linear-gradient(135deg,#ff0033,#ff3d7f);color:#fff;padding:10px 14px;border-radius:10px;font:600 12px/1.35 system-ui;box-shadow:0 8px 24px rgba(255,0,51,.4);max-width:300px;display:flex;align-items:center;gap:10px;cursor:pointer";
        const _upArrow = document.createElement("span");
        _upArrow.style.cssText = "font-size:18px";
        _upArrow.textContent = "\u2191";
        const _upMsg = document.createElement("span");
        _upMsg.style.cssText = "flex:1";
        _upMsg.appendChild(document.createTextNode("YT-zen v"));
        const _upTag = document.createElement("b");
        _upTag.textContent = String(latestTag);
        _upMsg.appendChild(_upTag);
        _upMsg.appendChild(document.createTextNode(" available"));
        b.appendChild(_upArrow);
        b.appendChild(_upMsg);
        b.title = "Click to install the new version";
        b.addEventListener("click", () => {
          try { window.open(installUrl, "_blank", "noopener"); } catch (e) {}
        });

        const old = document.getElementById("ytp-update-banner");
        old && old.remove();
        document.body && document.body.appendChild(b);

        setTimeout(() => {
          const el = document.getElementById("ytp-update-banner");
          el && el.remove();
        }, 60000);
      } catch (e) {}
    };

    const showUpToDate = (latestTag) => {
      try {
        e.__ytplusLastSeenLatest = String(latestTag || "");
      } catch (_) {}
      const toast = pe(
        "YT-zen v" + installed + " is up to date" + (force ? "" : "."),
        4000,
        "success",
      );

      try {
        const t = document.getElementById("ytp-toast");
        if (t && !t._ytpUpToDateBound) {
          t._ytpUpToDateBound = true;
          t.style.cursor = "pointer";
          t.title = "Open the YT-zen releases page";
          t.addEventListener("click", () => {
            try { window.open(_GITHUB_RELEASES, "_blank", "noopener"); } catch (_) {}
          });
        }
      } catch (_) {}
    };

    const showCheckFailed = (errMsg) => {
      const toast = pe(
        "Update check failed: " + (errMsg || "network error") + " (click to retry)",
        4000,
        "error",
      );
      try {
        const t = document.getElementById("ytp-toast");
        if (t && !t._ytpFailedBound) {
          t._ytpFailedBound = true;
          t.style.cursor = "pointer";
          t.title = "Click to retry the update check";
          t.addEventListener("click", () => {

            try { Fu(true); } catch (_) {}
          });
        }
      } catch (_) {}
    };
    const showResult = (latestTag) => {
      const latest = a(latestTag);
      const cmp = o(latest, a(installed));
      if (cmp <= 0) {
        force && showUpToDate(latestTag);
      } else {

        showUpdateAvailable(latestTag, _GITHUB_LATEST_USERJS);
      }
    };
    const onDone = (ok, payload, errMsg) => {
      if (!ok) {
        showCheckFailed(errMsg);

        return;
      }
      try {
        const j = (typeof payload === "string") ? JSON.parse(payload) : payload;
        if (j && j.tag_name) {

          try { GM_setValue && GM_setValue(_CHECK_CACHE_KEY, Date.now()); } catch (_) {}
      try { GM_setValue && GM_setValue("ytp_latest_release", JSON.stringify({ tag: j.tag_name, ts: Date.now() })); } catch (_) {}
          showResult(j.tag_name);
          return;
        }
        force && showCheckFailed("no release found");
      } catch (_) {
        force && showCheckFailed("bad response");
      }
    };
    try {
      if (force) pe("Checking for updates...", 1800, "info");

      const now = Date.now();
      if (!force) {
        const last = Number(GM_getValue && GM_getValue(_CHECK_CACHE_KEY, 0)) || 0;
        if (now - last < 10 * 60 * 1e3) return;
      }
      if (typeof GM_xmlhttpRequest === "function") {
        GM_xmlhttpRequest({
          method: "GET",
          url: _GITHUB_API_LATEST,
          headers: { "Accept": "application/vnd.github+json" },
          onload: (r) => onDone(r && r.status >= 200 && r.status < 300, r && r.responseText, r && r.statusText),
          onerror: (r) => onDone(false, null, (r && r.error) || "network error"),
          ontimeout: () => onDone(false, null, "timeout"),
        });
      } else if (typeof fetch === "function") {
        fetch(_GITHUB_API_LATEST, { headers: { "Accept": "application/vnd.github+json" } })
          .then((r) => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
          .then((j) => onDone(true, j))
          .catch((e2) => onDone(false, null, e2 && e2.message));
      } else {
        force && pe("Update check unavailable (no HTTP API).", 2200, "info");
      }
    } catch (e2) {
      force && pe("Update check failed: " + (e2 && e2.message), 3000, "error");
    }
  }
  function z() {
    const e = [],
      t = q();
    t && e.push({ ts: t.__ts || 0, ver: t.__ver || 0, data: t });
    const a = V();
    a && e.push({ ts: a.__ts || 0, ver: a.__ver || 0, data: a });
    const n = F(e);
    if (n) {
      A = n.ver || 0;
      const e = Object.assign({}, n.data);
      (delete e.__ts, delete e.__ver, j(e));
    }
    return ((T = !0), !!n);
  }
  function W(e, t) {
    const a = Date.now(),
      n = Object.assign({}, e, { __ts: a, __ver: t }),
      r = JSON.stringify(n);
    try {
      GM_setValue(P, r);
    } catch (e) {}
    try {
      "undefined" != typeof localStorage &&
        ((N = !0), localStorage.setItem(B, r), (N = !1));
    } catch (n) {
      if (((N = !1), n && "QuotaExceededError" === n.name)) {
        h("localStorage quota exceeded");
        try {
          const n = Object.assign({}, e);
          (delete n.customCSS,
            delete n.channelBlockerList,
            delete n.keywordFilterList);
          const r = Object.assign({}, n, { __ts: a, __ver: t });
          localStorage.setItem(B, JSON.stringify(r));
        } catch (e) {}
      }
    }
  }
  function U() {
    (A++, _ || (_ = {}));
    for (const e in _) e in S || delete _[e];
    (Object.assign(_, S),
      W(_, A),
      (L = { obj: _, ver: A }),
      K(),
      (function () {
        try {
          R &&
            ((H = !0),
            R.postMessage({ type: "cfg_update", ver: A, ts: Date.now() }),
            setTimeout(() => {
              H = !1;
            }, 50));
        } catch (e) {
          H = !1;
        }
      })(),
      g.emit("cfg.saved"));
  }
  function K() {
    if (M || !L) return;
    const { obj: e, ver: t } = L;
    ((L = null),
      (M = !0),
      Promise.resolve()
        .then(() => k("kv", { k: I, v: e, ver: t, updatedAt: Date.now() }))
        .catch((e) => h("cfg IDB persist failed", e))
        .finally(() => {
          ((M = !1), L && K());
        }));
  }
  function Y() {
    const delay = (typeof Xt !== "undefined" && Xt.perfMode) || (typeof S !== "undefined" && S.perfModeOn) ? 1200 : 600;
    T && (clearTimeout(O), (O = setTimeout(U, delay)));
  }
  function G() {
    T && (clearTimeout(O), (O = 0), U());
  }
  function X() {
    const e = [],
      t = q();
    t && e.push({ ts: t.__ts || 0, ver: t.__ver || 0, data: t });
    const a = V();
    a && e.push({ ts: a.__ts || 0, ver: a.__ver || 0, data: a });
    const n = F(e);
    if (!n) return;
    const r = n.ver || 0;
    if (r <= A) return;
    A = r;
    const o = Object.assign({}, S),
      i = Object.assign({}, n.data);
    (delete i.__ts, delete i.__ver, j(i));
    const d = new Set();
    for (const e of Object.keys(S)) S[e] !== o[e] && d.add(e);
    for (const e of Object.keys(o)) e in S || d.add(e);
    if (!d.size) return;
    (u("Cross-tab sync: " + d.size + " keys updated (v" + A + ")"),
      d.has("silentToasts") && ue());
    const c = new Set();
    for (const e of d) {
      const t = ka.get(e);
      if (t) for (const e of t) c.add(e.id);
    }
    queueMicrotask(() => {
      for (const e of c) xa.apply(e);
      for (const e of d) g.emit("cfg.changed", { key: e, val: S[e] });
    });
  }
  let Z = new AbortController();
  function Q() {
    try {
      Z.abort();
    } catch (e) {}
    ((Z = new AbortController()),
      (oe.vid = void 0),
      (oe.title = void 0),
      (oe.ch = void 0),
      (oe.titleT = 0),
      (oe.chT = 0),
      da && da.clear(),
      g.emit("nav.changed", { url: location.href }));
  }
  let J = !1;
  function $(e, t) {
    let a,
      n = 0,
      r = null;
    return function (...o) {
      a = o;
      const i = performance.now(),
        d = t - (i - n);
      d <= 0
        ? ((n = i), e.apply(this, o))
        : r ||
          (r = setTimeout(() => {
            ((n = performance.now()), (r = null), e.apply(this, a));
          }, d));
    };
  }
  function ee(e, t) {
    let a,
      n = null;
    return function (...r) {
      ((a = r),
        clearTimeout(n),
        (n = setTimeout(() => {
          ((n = null), e.apply(this, a));
        }, t)));
    };
  }
  const te = "function" == typeof e.requestIdleCallback;
  function ae(t, a) {
    if (te)
      try {
        return e.requestIdleCallback(t, { timeout: a || 1500 });
      } catch (e) {}
    return setTimeout(t, 1);
  }
  function ne() {
    return new Promise((t) => {
      if (void 0 !== e.scheduler && e.scheduler.postTask)
        try {
          return void e.scheduler.postTask(t, { priority: "user-blocking" });
        } catch (e) {}
      setTimeout(t, 0);
    });
  }
  function re() {
    const e = new Map();
    return function (t, a) {
      if (e.has(t)) return e.get(t);
      const n = Promise.resolve()
        .then(a)
        .finally(() => e.delete(t));
      return (e.set(t, n), n);
    };
  }
  const oe = {
      vid: void 0,
      vidHref: "",
      title: void 0,
      titleT: 0,
      ch: void 0,
      chT: 0,
    },
    ie = {
      el: () =>
        document.querySelector("video.html5-main-video") ||
        document.querySelector("#movie_player video") ||
        document.querySelector("video"),
      api: () => document.querySelector("#movie_player"),
      isReady: () => !(!ie.el() || !ie.api()),
      videoId() {
        if (void 0 !== oe.vid && oe.vidHref === location.href) return oe.vid;
        const e = location.href.match(/[?&]v=([^&#]+)/);
        return (
          (oe.vid = e ? e[1] : null),
          (oe.vidHref = location.href),
          oe.vid
        );
      },
      title() {
        const t = performance.now();
        if (void 0 !== oe.title && "" !== oe.title && t - oe.titleT < 1e3)
          return oe.title;
        let a = "";
        const n =
          ca("h1.ytd-watch-metadata yt-formatted-string", 1e3) ||
          ca("h1.title yt-formatted-string", 1e3) ||
          ca("h1.title", 1e3) ||
          ca("#title h1", 1e3);
        if ((n && n.textContent && (a = n.textContent.trim()), !a))
          try {
            const t = e.ytInitialPlayerResponse;
            t &&
              t.videoDetails &&
              t.videoDetails.title &&
              (a = String(t.videoDetails.title).trim());
          } catch (e) {}
        if (!a)
          try {
            const e = document.querySelector(
              'meta[property="og:title"], meta[name="title"]',
            );
            e && (a = (e.getAttribute("content") || "").trim());
          } catch (e) {}
        return (
          a || (a = (document.title || "").replace(/ - YouTube$/, "").trim()),
          (oe.title = a),
          (oe.titleT = t),
          a
        );
      },
      channel() {
        const t = performance.now();
        if (void 0 !== oe.ch && "" !== oe.ch && t - oe.chT < 1e3) return oe.ch;
        let a = "";
        const n =
          ca("ytd-video-owner-renderer ytd-channel-name a", 1e3) ||
          ca("ytd-video-owner-renderer #channel-name a", 1e3) ||
          ca("#owner #channel-name a", 1e3) ||
          ca("#owner-name a", 1e3) ||
          ca("ytd-channel-name a", 1e3) ||
          ca("#channel-name a", 1e3);
        if ((n && n.textContent && (a = n.textContent.trim()), !a))
          try {
            const t = e.ytInitialPlayerResponse;
            t &&
              t.videoDetails &&
              t.videoDetails.author &&
              (a = String(t.videoDetails.author).trim());
          } catch (e) {}
        if (!a)
          try {
            const e = document.querySelector(
              'meta[itemprop="author"], link[itemprop="name"]',
            );
            e &&
              (a = (
                e.getAttribute("content") ||
                e.getAttribute("name") ||
                ""
              ).trim());
          } catch (e) {}
        return ((oe.ch = a), (oe.chT = t), a);
      },
      thumb: (e, t) =>
        e
          ? "https://i.ytimg.com/vi/" + e + "/" + (t || "mqdefault") + ".jpg"
          : "",
      thumbCandidates: (e) =>
        e
          ? [
              "https://i.ytimg.com/vi/" + e + "/maxresdefault.jpg",
              "https://i.ytimg.com/vi/" + e + "/sddefault.jpg",
              "https://i.ytimg.com/vi/" + e + "/hqdefault.jpg",
              "https://i.ytimg.com/vi/" + e + "/mqdefault.jpg",
              "https://i.ytimg.com/vi/" + e + "/default.jpg",
            ]
          : [],
      play() {
        const e = ie.el();
        e && e.play().catch(() => {});
      },
      pause() {
        const e = ie.el();
        e && e.pause();
      },
      seek(e) {
        const t = ie.el();
        t && (t.currentTime = e);
      },
      rate(e) {
        const t = ie.el();
        t && (t.playbackRate = e);
      },
      setQuality(e) {
        const t = ie.api();
        if (t && t.setPlaybackQualityRange)
          try {
            t.setPlaybackQualityRange(e, e);
          } catch (e) {}
        if (t && t.setPlaybackQuality)
          try {
            t.setPlaybackQuality(e);
          } catch (e) {}
      },
      levels() {
        const e = ie.api();
        return e && e.getAvailableQualityLevels
          ? e.getAvailableQualityLevels()
          : [];
      },
      isAd: () => !!document.querySelector(".ad-showing,.ad-interrupting"),
    },
    de = new Map();
  function ce(e) {
    e = Math.floor(Math.max(0, Number(e) || 0));
    const t = de.get(e);
    if (void 0 !== t) return t;
    const a = Math.floor(e / 3600),
      n = Math.floor((e % 3600) / 60),
      r = e % 60,
      o = a
        ? a + ":" + (n < 10 ? "0" + n : n) + ":" + (r < 10 ? "0" + r : r)
        : n + ":" + (r < 10 ? "0" + r : r);
    if (de.size > 512) {
      const e = de.keys().next().value;
      de.delete(e);
    }
    return (de.set(e, o), o);
  }
  let se = null,
    le = 0;
  function pe(e, t, a) {
    !S.silentToasts &&
      document.body &&
      (se ||
        ((se = document.createElement("div")),
        (se.id = "ytp-toast"),
        document.body.appendChild(se)),
      (se.textContent = String(e)),
      (se.className = "ytp-t-" + (a || "info") + " show"),
      clearTimeout(le),
      (le = setTimeout(() => {
        se && (se.className = "ytp-t-" + (a || "info"));
      }, t || 1800)));
  }
  function ue() {
    if (!document.body) return;
    const e = !!S.silentToasts;
    e !== document.body.classList.contains("ytp-silent") &&
      document.body.classList.toggle("ytp-silent", e);
  }
  async function he(e, t) {
    if (((t = t || {}), S.safeMode)) throw new Error("SAFE_MODE_BLOCKED");
    const a = new Set([
      "sponsor.ajay.app",
      "www.youtube.com",
    ]);
    try {
      (S.sbServer && a.add(new URL(S.sbServer).host),
        S.remoteSelectorsURL && a.add(new URL(S.remoteSelectorsURL).host));
    } catch (e) {}
    let n;
    try {
      n = new URL(e).host;
    } catch (e) {
      throw new Error("bad URL");
    }
    if (!a.has(n)) throw new Error("host not allowed: " + n);
    return "function" == typeof GM_xmlhttpRequest
      ? new Promise((a, n) => {
          GM_xmlhttpRequest({
            method: t.method || "GET",
            url: e,
            headers: t.headers || {},
            data: t.body,
            timeout: 1e4,
            onload(e) {
              a({
                ok: e.status >= 200 && e.status < 300,
                status: e.status,
                text: () => e.responseText,
                json: () => {
                  try {
                    return JSON.parse(e.responseText);
                  } catch (e) {
                    return null;
                  }
                },
              });
            },
            onerror: n,
            ontimeout() {
              n(new Error("timeout"));
            },
          });
        })
      : fetch(e, t);
  }
  let ve = 0,
    ke = null,
    xe = !1,
    we = 0,
    Ce = !1,
    Se = null,
    Te = null,
    Oe = null,
    Me = null,
    Le = null,
    Ae = null;
  const Ee = (e) => v("history", e),
    Be = (e) => k("history", e),
    Pe = (e) => x("history", e),
    Ie = () => w("history", "lw", "prev"),
    Re = () => C("history");
  function Ne() {

    try {
      const e = document.querySelector(
        "ytd-video-owner-renderer ytd-channel-name a, #owner-name a, ytd-channel-name a, #channel-name a",
      );
      if (e && e.href) {
        const u = new URL(e.href, location.href);
        const p = u.pathname;
        let m = p.match(/\/@([^/?#]+)/);
        if (m && m[1]) return "@" + m[1].toLowerCase();
        m = p.match(/\/(?:channel|c|user)\/([^/?#]+)/i);
        if (m && m[1]) return m[1];
        const parts = p.split("/").filter(Boolean);
        if (parts[0]) return parts[0];
      }
    } catch (e) {}
    try {
      const t = e.ytInitialPlayerResponse;
      if (t && t.videoDetails && t.videoDetails.channelId)
        return t.videoDetails.channelId;
    } catch (e) {}
    try {
      const e = document.querySelector('meta[itemprop="channelId"]');
      if (e) return (e.getAttribute("content") || "").trim();
    } catch (e) {}
    return "";
  }
  function _e() {
    try {
      const e = ie.el();
      if (e && isFinite(e.duration) && e.duration > 0.5) return e.duration;
    } catch (e) {}
    try {
      const e = ie.api();
      if (e && "function" == typeof e.getDuration) {
        const t = e.getDuration();
        if (t && isFinite(t) && t > 0.5) return t;
      }
    } catch (e) {}
    try {
      const t = e.ytInitialPlayerResponse;
      if (t && t.videoDetails && t.videoDetails.lengthSeconds) {
        const e = parseFloat(t.videoDetails.lengthSeconds);
        if (e > 0.5) return e;
      }
    } catch (e) {}
    return 0;
  }
  function He(e) {
    return !!(e && e.title && e.channel && e.thumbnail);
  }
  function De(e, t) {
    return new Promise((a) => {
      const n = Date.now() + (t || 3e3);

      let lastSnap = null;
      const r = () => {
        if (ie.videoId() !== e) return void a(lastSnap);
        const t = (function (e) {
          return {
            videoId: e,
            title: ie.title() || "",
            channel: ie.channel() || "",
            channelId: Ne() || "",
            thumbnail: ie.thumb(e, "mqdefault"),
            duration: _e(),
          };
        })(e);
        lastSnap = t;
        (t.title && t.channel) || Date.now() >= n ? a(t) : setTimeout(r, 200);
      };
      r();
    });
  }

  const _oembedInFlight = new Set();
  async function _oembedFetch(e) {
    if (!e) return null;
    const cacheKey = "oembed:" + e;
    const ttl = 7 * 24 * 60 * 60 * 1000; 
    return YtpCache.getOrFetch(cacheKey, async () => {
      try {
        const r = await he(
          "https://www.youtube.com/oembed?url=" +
            encodeURIComponent("https://www.youtube.com/watch?v=" + e) +
            "&format=json",
        );
        if (!r.ok) return null;
        const j = await r.json();
        if (!j || !j.title) return null;
        return {
          videoId: e,
          title: j.title || "",
          channel: j.author_name || "",
          channelId: "",
          thumbnail: j.thumbnail_url || ie.thumb(e, "hqdefault"),
          duration: 0,
        };
      } catch (err) {
        return null;
      }
    }, ttl, { source: "idb", version: 1 });
  }

  async function _backfillMetadata() {
    if (!S.sessionRestoreOn) return;
    try {
      const list = await Ie();

      const need = list
        .filter((x) => x && x.videoId && (!x.title || !x.channel))
        .sort((a, b) => (b.lastWatched || 0) - (a.lastWatched || 0))
        .slice(0, 20);
      if (!need.length) return;

      for (const r of need) {
        if (!_oembedInFlight.has(r.videoId)) {
          const data = await _oembedFetch(r.videoId);
          if (data) {
            const cur = await Ee(r.videoId);
            if (cur) {
              let n = !1;
              if (!cur.title && data.title) ((cur.title = data.title), (n = !0));
              if (!cur.channel && data.channel) ((cur.channel = data.channel), (n = !0));
              if (!cur.thumbnail && data.thumbnail) ((cur.thumbnail = data.thumbnail), (n = !0));
              if (n) {
                await Be(cur);
                if (cur.thumbnail) We(cur.videoId, cur.thumbnail).catch(() => {});
                g.emit("history.updated", { videoId: cur.videoId });
              }
            }
          }
        }

        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (e) {}
  }
  function qe(e, t) {
    if (!e) return !1;
    let a = !1;
    if (!e.title || e.title === t) {
      const n = ie.title();
      n && n !== t && ((e.title = n), (a = !0));
    }
    if (!e.channel) {
      const t = ie.channel();
      t && ((e.channel = t), (a = !0));
    }
    if (!e.channelId) {
      const t = Ne();
      t && ((e.channelId = t), (a = !0));
    }
    if (!e.thumbnail) {
      const n = ie.thumb(t, "hqdefault");
      n && ((e.thumbnail = n), (a = !0));
    }
    if (!e.duration || e.duration < 1) {
      const t = _e();
      t > 0.5 && ((e.duration = t), (a = !0));
    }
    return a;
  }
  const Ve = new Map(),
    Fe = re();
  async function je(e) {
    if (!e) return null;
    try {
      if (Ve.has(e)) {

        const u = Ve.get(e);
        Ve.delete(e);
        return (Ve.set(e, u), u);
      }
      const t = await v("thumbCache", e);
      if (!t || !t.blob) return null;
      if (Ve.size > 24) {

        const e2 = Ve.keys().next().value;
        try {
          URL.revokeObjectURL(Ve.get(e2));
        } catch (e) {}
        Ve.delete(e2);
      }
      const a = URL.createObjectURL(t.blob);
      return (Ve.set(e, a), a);
    } catch (e) {
      return null;
    }
  }
  async function ze(e, t) {
    try {
      const a = new AbortController(),
        n = setTimeout(() => a.abort(), t || 5e3);
      let r;
      try {
        r = await fetch(e, {
          mode: "cors",
          credentials: "omit",
          signal: a.signal,
        });
      } finally {
        clearTimeout(n);
      }
      if (!r.ok) return null;
      const o = await r.blob();
      return !o || o.size < 600 ? null : o;
    } catch (e) {
      return null;
    }
  }
  async function We(e, t) {
    if (e)
      return Fe("put:" + e, async () => {
        try {
          const a = await v("thumbCache", e);
          if (a && a.blob && Date.now() - a.ts < 6048e5) return;
          const n =
            "string" == typeof t && t
              ? [t].concat(ie.thumbCandidates(e).filter((e) => e !== t))
              : ie.thumbCandidates(e);
          for (const t of n) {
            const a = await ze(t, 5e3);
            if (a) {
              await k("thumbCache", {
                videoId: e,
                blob: a,
                ts: Date.now(),
                src: t,
                version: 1,
              });
              return;
            }
          }

          if (a.blob) {
            const staleUrl = URL.createObjectURL(a.blob);
            Ve.set(e, staleUrl);
          }
        } catch (e) {}
      });
  }
  function Ue() {
    try { clearTimeout(mt); } catch (e) {}
    mt = 0;
    if ((clearInterval(ve), (ve = 0), (ke = null), Te)) {
      try {
        Te();
      } catch (e) {}
      Te = null;
    }
    Ze();
  }
  async function Ke() {
    if (!S.sessionRestoreOn) return;
    if (!Ke._gateInstalled) {
      Ke._gateInstalled = !0;
      try {
        const orig = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
          try {
            if (Ma && Ma.awaitingResume) {
              try {
                this.pause && this.pause();
              } catch (e) {}
              return Promise.resolve();
            }
          } catch (e) {}
          return orig.apply(this, arguments);
        };
      } catch (e) {}
    }

    const e = ie.videoId();
    if (!e || e === ke) return;
    if (((ke = e), (xe = !1), (we = Date.now()), clearInterval(ve), Te)) {
      try {
        Te();
      } catch (e) {}
      Te = null;
    }
    ve = setInterval(() => {
      _a() || document.hidden || Ye();
    }, 5e3);

    setTimeout(() => { try { Ze(); } catch (e) {} }, 30000);
    const t = Date.now();
    let a = await Ee(e);
    (a
      ? ((a.watchCount = (a.watchCount || 0) + 1),
        (a.sessions = (a.sessions || []).slice(-49).concat({ start: t })))
      : (a = {
          videoId: e,
          title: "",
          channel: "",
          channelId: "",
          thumbnail: "",
          firstWatched: t,
          watchCount: 1,
          totalWatchTime: 0,
          sessions: [{ start: t }],
          lastPosition: 0,
          progress: 0,
          completed: !1,
          remaining: 0,
          duration: 0,
          pinned: 0,
          tags: [],
          notes: "",
        }),
      (a.lastWatched = t),
      qe(a, e),
      await Be(a),
      a.thumbnail && We(e, a.thumbnail),
      He(a) ||
        De(e, 3e3).then(async (t) => {

          if (!t) return;
          const a = await Ee(e);
          if (!a) return;
          let n = !1;
          (!a.title && t.title && ((a.title = t.title), (n = !0)),
            !a.channel && t.channel && ((a.channel = t.channel), (n = !0)),
            !a.channelId &&
              t.channelId &&
              ((a.channelId = t.channelId), (n = !0)),
            !a.thumbnail &&
              t.thumbnail &&
              ((a.thumbnail = t.thumbnail), (n = !0)),
            (!a.duration || a.duration < 1) &&
              t.duration > 0.5 &&
              ((a.duration = t.duration),
              a.lastPosition >= 0 &&
                (a.remaining = Math.max(0, a.duration - a.lastPosition)),
              (n = !0)),
            n &&
              (await Be(a),
              a.thumbnail && We(e, a.thumbnail),
              g.emit("history.updated", { videoId: e })));
        }));
    const n = (() => {
      try {
        const e = location.href.match(/[?&]t=(\d+)/);
        return e ? parseInt(e[1], 10) : 0;
      } catch (e) {
        return 0;
      }
    })();
    if (
      (!a.completed &&
        !n &&
        (a.lastPosition || 0) > 5 &&
        !xe &&
        ((xe = !0),
        "silent" === S.sessionResumeMode
          ? (function (e) {
              const t = () => {
                const t = ie.el();
                if (t) {
                  try {
                    t.currentTime = e.lastPosition;
                  } catch (e) {}
                  try {
                    const e = ie.api();
                    e && "function" == typeof e.playVideo
                      ? e.playVideo()
                      : t.play && t.play().catch(() => {});
                  } catch (e) {}
                }
              };
              if (
                (document.querySelector("#movie_player") ||
                  document.querySelector(".html5-video-player")) &&
                ie.el()
              ) {
                t();
                return;
              }
              const n = document.querySelector("ytd-app") || document.documentElement;
              if (!n) return;
              let r = !1;
              const o = new MutationObserver(() => {
                if (r) return;
                const n = document.querySelector("#movie_player"),
                  i = ie.el();
                if (n && i) {
                  r = !0;
                  try { o.disconnect(); } catch (e) {}
                  t();
                }
              });
              try {
                o.observe(n, { childList: !0, subtree: !0 });
              } catch (e) {}
              setTimeout(() => {
                if (!r) { try { o.disconnect(); } catch (e) {} }
              }, 8e3);
            })(a)
          : "overlay" === S.sessionResumeMode
          ? (function (e) {
              const t = () => {
                  const t = ie.el();
                  if (t) {
                    try {
                      t.currentTime = e.lastPosition;
                    } catch (e) {}
                    try {
                      const e = ie.api();
                      e && "function" == typeof e.playVideo
                        ? e.playVideo()
                        : t.play && t.play().catch(() => {});
                    } catch (e) {}
                  }
                },
                a = () => {
                  const e = ie.el();
                  if (e) {
                    try {
                      e.currentTime = 0;
                    } catch (e) {}
                    try {
                      const t = ie.api();
                      t && "function" == typeof t.playVideo
                        ? t.playVideo()
                        : e.play && e.play().catch(() => {});
                    } catch (e) {}
                  }
                };
              if (
                (document.querySelector("#movie_player") ||
                  document.querySelector(".html5-video-player")) &&
                ie.el()
              )
                return void Je(e, t, a);
              const n =
                document.querySelector("ytd-app") || document.documentElement;
              if (!n) return;
              let r = !1;
              const o = new MutationObserver(() => {
                if (r) return;
                const n = document.querySelector("#movie_player"),
                  i = ie.el();
                if (n && i) {
                  r = !0;
                  try {
                    o.disconnect();
                  } catch (e) {}
                  Je(e, t, a);
                }
              });
              try {
                o.observe(n, { childList: !0, subtree: !0 });
              } catch (e) {
                return;
              }
              setTimeout(() => {
                if (!r)
                  try {
                    o.disconnect();
                  } catch (e) {}
              }, 8e3);
            })(a)
          : setTimeout(() => {
              const e = ie.el();
              e &&
                isFinite(e.duration) &&
                (function (e, t) {
                  if (e) {
                    Ma.awaitingResume = !0;
                    Ma.awaitingResumeVid = e.videoId || null;
                    Ma.awaitingResumeSince = Date.now();
                  }
                  if ((Ze(), !document.body)) return;
                  const a = document.createElement("div");
                  a.id = "ytp-resume-card";
                  a.className = "ytp-resume-card-small";
                  const n = ce(e.lastPosition || 0),
                    r = e.duration ? ce(e.duration) : "",
                    o = document.createElement("div");
                  o.className = "ytp-resume-card-row";
                  o.style.cssText =
                    "display:flex;align-items:center;gap:12px;padding:10px 14px";
                  const i = document.createElement("div");
                  i.className = "ytp-resume-thumb";
                  i.style.cssText =
                    "width:64px;height:36px;border-radius:6px;background:#1a1a1a center/cover no-repeat;flex-shrink:0";
                  if (e.thumbnail) {

                    try {
                      const safeThumbUrl = sanitizeUrlForCSS(e.thumbnail || "");
                      i.style.backgroundImage =
                        safeThumbUrl ? ("url('" + encodeURI(safeThumbUrl).replace(/'/g, "%27") + "')") : "none";
                    } catch (err) {
                      i.style.backgroundImage = "none";
                    }
                  }
                  o.appendChild(i);
                  const d = document.createElement("div");
                  d.className = "ytp-resume-info";
                  d.style.cssText =
                    "flex:1;min-width:0;display:flex;flex-direction:column;gap:2px";
                  const c = document.createElement("div");
                  c.className = "ytp-resume-cta";
                  c.style.cssText = "font:600 12px system-ui;color:#fff";
                  c.textContent = "Continue from " + n + (r ? " / " + r : "") + "?";
                  const s = document.createElement("div");
                  s.className = "ytp-resume-title";
                  s.style.cssText =
                    "font:11px system-ui;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
                  s.textContent = e.title || e.videoId;
                  d.appendChild(c);
                  d.appendChild(s);
                  o.appendChild(d);
                  const l = document.createElement("div");
                  l.className = "ytp-resume-actions";
                  function p(e, t, a) {
                    const n = document.createElement("button");
                    n.type = "button";
                    n.className = t ? "ytp-resume-btn-primary" : "ytp-resume-btn-secondary";
                    n.textContent = e;
                    n.style.cssText =
                      "appearance:none;border:0;border-radius:6px;padding:7px 12px;font:600 11px system-ui;cursor:pointer;transition:background .12s,transform .08s;" +
                      (t
                        ? "background:#ff0033;color:#fff"
                        : "background:rgba(255,255,255,.1);color:#ddd");
                    n.addEventListener("click", (e) => {
                      e.stopPropagation();
                      a();
                    });
                    n.addEventListener("mouseenter", () => {
                      n.style.transform = "translateY(-1px)";
                    });
                    n.addEventListener("mouseleave", () => {
                      n.style.transform = "translateY(0)";
                    });
                    return n;
                  }
                  l.style.cssText = "display:flex;gap:6px;flex-shrink:0;align-items:center";
                  l.appendChild(
                    p("Resume", !0, () => {

                      Ze();
                      try { t(); } catch (e) {}
                    }),
                  );
                  l.appendChild(
                    p("Start over", !1, () => {

                      Ze();
                      try {
                        const e = ie.el();
                        if (e) {
                          e.currentTime = 0;
                          if (e.paused) e.play && e.play().catch(() => {});
                        }
                      } catch (e) {}
                    }),
                  );
                  const closeBtn = p("×", !1, () => Ze());
                  closeBtn.className = "ytp-resume-close";
                  l.appendChild(closeBtn);
                  o.appendChild(l);
                  a.appendChild(o);
                  document.body.appendChild(a);
                  Oe = a;
                  setTimeout(() => {
                    Oe === a && Ze();
                  }, 15e3);
                })(a, () => {
                  try {
                    ((e.currentTime = a.lastPosition),
                      e.play && e.play().catch(() => {}));
                  } catch (e) {}
                  pe("Resumed at " + ce(a.lastPosition), 1800, "success");
                });
            }, 1500)),
      !Te)
    ) {
      const e = () => {
          ie.videoId() === ke && Ye();
        },
        t = ie.el();
      t &&
        (t.addEventListener("loadedmetadata", e),
        t.addEventListener("durationchange", e),
        (Te = () => {
          try {
            (t.removeEventListener("loadedmetadata", e),
              t.removeEventListener("durationchange", e));
          } catch (e) {}
        }));
    }
  }
  async function Ye() {
    if (!Ce) {
      Ce = !0;
      try {
        if (!S.sessionRestoreOn) return;
        if (document.hidden) {
          const e = ie.el();
          if (e && e.paused) return;
        }
        const e = ie.videoId();
        if (!e) return;
        const t = ie.el();
        if (!t) return;
        const a = t.currentTime,
          n = _e();
        if (!isFinite(n) || n < 5) return;
        const r = (await Ee(e)) || {
            videoId: e,
            firstWatched: Date.now(),
            watchCount: 1,
            sessions: [],
            pinned: 0,
            tags: [],
            notes: "",
            title: "",
            channel: "",
            channelId: "",
            thumbnail: "",
          },
          o = qe(r, e),
          i = Se && Se.vid === e ? Math.abs(Se.pos - a) : 1 / 0,
          d = !Se || Se.paused !== t.paused;
        if (!o && i < 0.5 && !d) return;
        ((r.lastWatched = Date.now()),
          (r.lastPosition = a),
          (r.duration = n),
          (r.progress = n > 0 ? Math.min(100, Math.round((a / n) * 100)) : 0),
          (r.remaining = Math.max(0, n - a)),
          (r.completed = r.remaining < 15 || r.progress >= 97),
          r.completed && ((r.lastPosition = 0), (r.remaining = 0)));
        const c = Date.now();
        if (!t.paused && we) {
          const e = Math.min((c - we) / 1e3, 10);
          e > 0 && e < 60 && (r.totalWatchTime = (r.totalWatchTime || 0) + e);
        }
        ((we = c),
          await Be(r),
          r.thumbnail && We(e, r.thumbnail),
          (Se = { vid: e, pos: a, paused: t.paused }),
          g.emit("history.updated", { videoId: e }));
      } finally {
        Ce = !1;
      }
    }
  }
  async function Ge() {
    const e = await Ie(),
      t = e
        .slice()
        .sort(
          (e, t) =>
            (t.pinned || 0) - (e.pinned || 0) ||
            (t.lastWatched || 0) - (e.lastWatched || 0),
        );
    if (t.length > 500)
      for (const e of t.slice(500))
        if (!e.pinned)
          try {
            await Pe(e.videoId);
          } catch (e) {}
    {
      const t = Date.now() - 5184e6;
      for (const a of e)
        if (!a.pinned && (a.lastWatched || 0) < t)
          try {
            await Pe(a.videoId);
          } catch (e) {}
    }
    (await (async function (e) {
      try {
        const t = await w("thumbCache", "ts", "next");
        if (t.length <= e) return;
        const a = t.slice(0, t.length - e);
        for (const e of a)
          try {
            await x("thumbCache", e.videoId);
          } catch (e) {}
      } catch (e) {}
    })(Math.max(50, 500)),
      g.emit("history.pruned"));
  }
  async function Xe(e, t) {
    t = t || {};
    let a = await Ee(e);
    const n = Date.now();
    return (
      a ||
        (a = {
          videoId: e,
          title: "",
          channel: "",
          channelId: "",
          thumbnail: "",
          firstWatched: n,
          watchCount: 0,
          totalWatchTime: 0,
          sessions: [],
          pinned: 0,
          tags: [],
          notes: "",
        }),
      qe(a, e),
      !t.title || (a.title && a.title !== e) || (a.title = t.title),
      t.channel && !a.channel && (a.channel = t.channel),
      t.channelId && !a.channelId && (a.channelId = t.channelId),
      t.thumbnail && !a.thumbnail && (a.thumbnail = t.thumbnail),
      a.title || (a.title = e),
      a.thumbnail || (a.thumbnail = ie.thumb(e, "mqdefault")),
      (a.lastWatched = n),
      (a.lastPosition = 0),
      (a.progress = 100),
      (a.completed = !0),
      (a.remaining = 0),
      (a.watchCount = (a.watchCount || 0) + 1),
      t.duration &&
        (!a.duration || t.duration > a.duration) &&
        (a.duration = t.duration),
      (a.totalWatchTime = (a.totalWatchTime || 0) + (a.duration || 0)),
      (a.sessions = (a.sessions || [])
        .slice(-49)
        .concat({ start: n, kind: "forced" })),
      await Be(a),
      a.thumbnail && We(e, a.thumbnail),
      g.emit("history.updated", { videoId: e, forced: !0 }),
      He(a) ||
        (ie.videoId() === e &&
          De(e, 3e3).then(async (t) => {
            if (!t) return;
            const a = await Ee(e);
            if (!a) return;
            let n = !1;
            ((a.title && a.title !== e) ||
              (t.title && ((a.title = t.title), (n = !0))),
              !a.channel && t.channel && ((a.channel = t.channel), (n = !0)),
              !a.channelId &&
                t.channelId &&
                ((a.channelId = t.channelId), (n = !0)),
              n &&
                (await Be(a),
                a.thumbnail && We(e, a.thumbnail),
                g.emit("history.updated", { videoId: e })));
          })),
      a
    );
  }
  function Ze() {
    if (Oe) {
      try {
        Oe.remove();
      } catch (e) {}
      Oe = null;
    }
    Ma.awaitingResume = !1;
    Ma.awaitingResumeVid = null;
  }
  function Qe() {
    if (Le) {
      try {
        Le.disconnect();
      } catch (e) {}
      Le = null;
    }
    if (Ae) {
      try {
        Ae();
      } catch (e) {}
      Ae = null;
    }
    if (Me) {
      try {
        Me.remove();
      } catch (e) {}
      Me = null;
    }
    Ma.awaitingResume = !1;
    Ma.awaitingResumeVid = null;
  }
    function Je(e, t, a) {
    if (e) {
      Ma.awaitingResume = !0;
      Ma.awaitingResumeVid = e.videoId || null;
      Ma.awaitingResumeSince = Date.now();
    }
    if ((Qe(), !e)) return;
    const n =
      document.querySelector("#movie_player") ||
      document.querySelector(".html5-video-player") ||
      document.querySelector("ytd-player");
    if (!n) return;

    if (!Je._playGate) {
      Je._playGate = !0;
      try {
        const _orig = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
          try {
            if (Ma && Ma.awaitingResume) {
              try { this.pause && this.pause(); } catch (e) {}
              return Promise.resolve();
            }
          } catch (e) {}
          return _orig.apply(this, arguments);
        };
      } catch (e) {}
    }

    Ae = (function () {
      const e = ie.api();
      const t = ie.el();
      const a = {};
      try {
        if (e) {
          for (const k of ["playVideo", "playVideoAt"]) {
            if ("function" == typeof e[k]) {
              a[k] = e[k];
              e[k] = function () {};
            }
          }
        }
      } catch (e) {}

      try { t && !t.paused && t.pause(); } catch (e) {}
      try { e && "function" == typeof e.pauseVideo && e.pauseVideo(); } catch (e) {}
      return function () {
        try { if (e) for (const k of Object.keys(a)) e[k] = a[k]; } catch (e) {}
      };
    })();

    const r = document.createElement("div");
    r.id = "ytp-resume-overlay";
    r.classList.add("ytp-resume-" + (S.sessionResumeDesign || "default"));
    r.setAttribute("role", "dialog");
    r.setAttribute("aria-modal", "true");
    r.setAttribute("aria-label", "Resume playback");
    r.style.cssText =
      "position:absolute;inset:0;z-index:2147483640;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,rgba(0,0,0,.85) 0%,rgba(0,0,0,.95) 50%,rgba(0,0,0,.85) 100%);backdrop-filter:blur(14px) saturate(160%);-webkit-backdrop-filter:blur(14px) saturate(160%);font:14px/1.45 system-ui,-apple-system,sans-serif;color:#fff;opacity:0;transition:opacity .22s ease-out";

    const o = document.createElement("div");
    o.className = "ytp-resume-card";
    o.style.cssText =
      "max-width:520px;width:min(86%,520px);background:rgba(20,22,28,.6);border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:24px 26px 22px;box-shadow:0 30px 80px rgba(0,0,0,.65),0 8px 24px rgba(0,0,0,.4);backdrop-filter:blur(28px) saturate(180%);-webkit-backdrop-filter:blur(28px) saturate(180%);display:flex;flex-direction:column;gap:14px;transform:translateY(8px);transition:transform .25s ease-out";

    const i = document.createElement("div");
    i.className = "ytp-resume-head";
    i.style.cssText = "display:flex;gap:14px;align-items:center";

    const d = document.createElement("div");
    d.className = "ytp-resume-thumb";
    d.style.cssText =
      "width:120px;height:68px;border-radius:10px;flex-shrink:0;background:#000 center/cover no-repeat;box-shadow:0 4px 12px rgba(0,0,0,.5);position:relative;overflow:hidden";
    if (e.thumbnail) {

        try {
          const safeThumbUrl = sanitizeUrlForCSS(e.thumbnail || "");
          d.style.backgroundImage =
            safeThumbUrl ? ("url('" + encodeURI(safeThumbUrl).replace(/'/g, "%27") + "')") : "none";
        } catch (e2) {
          d.style.backgroundImage = "none";
        }
    }
    const c = document.createElement("div");
    c.style.cssText =
      "position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.18)";
    const s = document.createElement("div");
    const l = e.duration
      ? Math.min(100, Math.max(0, ((e.lastPosition || 0) / e.duration) * 100))
      : 0;
    s.style.cssText =
      "height:100%;background:#ff0033;width:" + l.toFixed(1) + "%;transition:width .3s";
    c.appendChild(s);
    d.appendChild(c);
    i.appendChild(d);

    const p = document.createElement("div");
    p.className = "ytp-resume-info";
    p.style.cssText =
      "flex:1;min-width:0;display:flex;flex-direction:column;gap:4px";
    const u = document.createElement("div");
    u.className = "ytp-resume-eyebrow";
    u.style.cssText =
      "font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#ff8a96;font-weight:600";
    u.textContent = "Resume watching";
    const h = document.createElement("div");
    h.className = "ytp-resume-title";
    h.style.cssText =
      "font-size:15px;font-weight:600;color:#fff;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden";
    h.textContent = e.title || e.videoId || "this video";
    const m = document.createElement("div");
    m.className = "ytp-resume-meta";
    m.style.cssText = "font-size:12px;color:#aaa";
    const y = ce(e.lastPosition || 0);
    const g = e.duration ? ce(e.duration) : null;
    m.textContent = (e.channel ? e.channel + " - " : "") + (g ? y + " / " + g : "from " + y);
    p.appendChild(u);
    p.appendChild(h);
    p.appendChild(m);
    i.appendChild(p);
    o.appendChild(i);

    const f = document.createElement("div");
    f.className = "ytp-resume-body";
    f.style.cssText = "font-size:13.5px;color:#cdd;line-height:1.5";
    f.textContent =
      "You watched this before. Continue from " + y + " or start over?";
    o.appendChild(f);

    const b = document.createElement("div");
    b.className = "ytp-resume-actions";
    b.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;margin-top:2px";
    function v(e, t, a, n) {
      const r = document.createElement("button");
      r.type = "button";
      r.className = t ? "ytp-resume-btn-primary" : "ytp-resume-btn-secondary";
      r.style.cssText =
        "appearance:none;border:0;cursor:pointer;flex:1;min-width:140px;padding:12px 18px;border-radius:24px;font:600 14px/1.2 inherit;display:flex;flex-direction:column;align-items:center;gap:2px;transition:transform .1s,box-shadow .15s;" +
        (t
          ? "background:#fff;color:#0f0f0f;box-shadow:0 4px 16px rgba(255,255,255,.15)"
          : "background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.14)");
      const o2 = document.createElement("span");
      o2.textContent = e;
      r.appendChild(o2);
      if (a) {
        const e2 = document.createElement("span");
        e2.style.cssText =
          "font-size:10.5px;font-weight:500;opacity:.7;letter-spacing:.02em";
        e2.textContent = a;
        r.appendChild(e2);
      }
      r.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        try { n(); } catch (e) {}
      });
      r.addEventListener("mouseenter", () => {
        r.style.transform = "translateY(-1px)";
        r.style.boxShadow = t
          ? "0 6px 20px rgba(255,255,255,.25)"
          : "0 4px 16px rgba(0,0,0,.4)";
      });
      r.addEventListener("mouseleave", () => {
        r.style.transform = "translateY(0)";
        r.style.boxShadow = t
          ? "0 4px 16px rgba(255,255,255,.15)"
          : "0 0 0 rgba(0,0,0,0)";
      });
      return r;
    }
    const k = v(
      "Resume from " + y,
      !0,
      "Continue where you left off",
      () => {
        Qe();
        try { t && t(); } catch (e) {}
      }
    );
    const x = v(
      "Start over",
      !1,
      "Play from the beginning",
      () => {
        Qe();
        try { a && a(); } catch (e) {}
      }
    );
    b.appendChild(k);
    b.appendChild(x);
    o.appendChild(b);

    const w = document.createElement("div");
    w.className = "ytp-resume-footer";
    w.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#777;margin-top:4px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08)";
    const C = document.createElement("span");
    C.textContent = "YT-zen Session History";
    const S2 = document.createElement("button");
    S2.type = "button";
    S2.className = "ytp-resume-dismiss";
    S2.style.cssText =
      "background:none;border:0;color:#888;cursor:pointer;font:inherit;text-decoration:underline;padding:2px 4px";
    S2.textContent = "Dismiss";
    S2.addEventListener("click", (e) => {
      e.stopPropagation();
      Qe();
    });
    w.appendChild(C);
    w.appendChild(S2);
    o.appendChild(w);
    r.appendChild(o);
    for (const e of [
      "click",
      "mousedown",
      "mouseup",
      "dblclick",
      "contextmenu",
    ])
      r.addEventListener(e, (e) => e.stopPropagation());
    r.addEventListener("wheel", (e) => e.stopPropagation(), { passive: !0 });
    try {
      const cs = getComputedStyle(n);
      if (cs.position === "static") n.style.position = "relative";
    } catch (e) {}
    n.appendChild(r);
    Me = r;
    requestAnimationFrame(() => {
      if (Me) {
        Me.style.opacity = "1";
        o.style.transform = "translateY(0)";
      }
    });
    try { k.focus(); } catch (e) {}
    const T = (e) => {
      if ("Escape" === e.key && Me) {
        e.stopPropagation();
        Qe();
        document.removeEventListener("keydown", T, !0);
      }
    };
    document.addEventListener("keydown", T, !0);
    try {
      Le = new MutationObserver(() => {
        if (Me && Me.parentNode !== n) {
          n.appendChild(Me);
        }
      });
      Le.observe(n, { childList: !0 });
    } catch (e) {}
  }

  const $e = {
    all: Ie,
    get: Ee,
    put: Be,
    del: Pe,
    clear: Re,
    stats: async function () {
      const e = await Ie(),
        t = {
          totalVideos: e.length,
          completed: 0,
          inProgress: 0,
          totalWatchTime: 0,
          totalRemaining: 0,
          channels: {},
        };
      for (const a of e) {
        (a.completed
          ? t.completed++
          : (a.lastPosition || 0) > 0 && t.inProgress++,
          (t.totalWatchTime += a.totalWatchTime || 0),
          (t.totalRemaining += a.remaining || 0));
        const e = a.channel || "Unknown";
        t.channels[e] = (t.channels[e] || 0) + 1;
      }
      return (
        (t.completionRate = t.totalVideos ? t.completed / t.totalVideos : 0),
        (t.topChannels = Object.entries(t.channels)
          .sort((e, t) => t[1] - e[1])
          .slice(0, 8)),
        t
      );
    },
    search: async function (e, t) {
      t = t || {};
      const a = (e || "").trim().toLowerCase();
      let n = await Ie();
      switch (
        (a &&
          (n = n.filter(
            (e) =>
              (e.title || "").toLowerCase().includes(a) ||
              (e.channel || "").toLowerCase().includes(a) ||
              (e.videoId || "").toLowerCase().includes(a),
          )),
        !0 === t.completed && (n = n.filter((e) => e.completed)),
        !1 === t.completed && (n = n.filter((e) => !e.completed)),
        t.pinned && (n = n.filter((e) => e.pinned)),
        t.sort || "recent")
      ) {
        case "recent":
          n.sort((e, t) => (t.lastWatched || 0) - (e.lastWatched || 0));
          break;
        case "oldest":
          n.sort((e, t) => (e.lastWatched || 0) - (t.lastWatched || 0));
          break;
        case "mostWatched":
          n.sort((e, t) => (t.watchCount || 0) - (e.watchCount || 0));
          break;
        case "longest":
          n.sort((e, t) => (t.duration || 0) - (e.duration || 0));
          break;
        case "progress":
          n.sort((e, t) => (t.progress || 0) - (e.progress || 0));
          break;
        case "remaining":
          n.sort((e, t) => (t.remaining || 0) - (e.remaining || 0));
      }
      return (n.sort((e, t) => (t.pinned || 0) - (e.pinned || 0)), n);
    },
    markWatched: Xe,
    cacheThumb: We,
    getCachedThumb: je,
    pin: async (e) => {
      const t = await Ee(e);
      t &&
        ((t.pinned = Date.now()),
        await Be(t),
        g.emit("history.updated", { videoId: e }));
    },
    unpin: async (e) => {
      const t = await Ee(e);
      t &&
        ((t.pinned = 0),
        await Be(t),
        g.emit("history.updated", { videoId: e }));
    },
    prune: Ge,
    saveNow: Ye,
    forceWatched: Xe,
  };
  async function et() {
    const e = ie.el(),
      t = ie.videoId();
    if (!e || !t) return void pe("No video here yet.", 1500, "error");
    const a = e.currentTime,

      n = {
        id: t + "_" + Math.round(100 * a) + "_" + Date.now(),
        videoId: t,
        title: ie.title(),
        channel: ie.channel(),
        thumbnail: ie.thumb(t),
        position: a,
        ts: Date.now(),
        label: ce(a) + " - " + ie.title().slice(0, 60),
      };
    (await k("bookmarks", n),
      pe("Bookmark @ " + ce(a), 1800, "success"),
      g.emit("bookmarks.changed"));
  }

  let tt = [],
    at = null,
    nt = 0,
    rt = 0,
    ot = 0,
    it = new Set(),
    dt = !1,
    ct = null,
    st = !1,
    lt = null,
    pt = null,
    ut = null,
    ht = null,
    mt = 0,
    St_wtInterval = 0,
    St_progObs = null;

  let St_perCat = {};

  let St_perCatSaved = {};

  let St_lastFetch = 0,
    St_lastErr = null,
    St_segmentsRaw = 0;

  let St_backoff = 0,
    St_cacheTTLms = 60 * 60 * 1000; 

  const yt = (function () {
    const e = new Map();
    return {
      get(t) {
        if (!e.has(t)) return;
        const a = e.get(t);
        return (e.delete(t), e.set(t, a), a);
      },
      set(t, a) {
        if ((e.has(t) && e.delete(t), e.set(t, a), e.size > 64)) {
          const t = e.keys().next().value;
          e.delete(t);
        }
      },
      delete(t) {
        e.delete(t);
      },
      clear() {
        e.clear();
      },
      get size() {
        return e.size;
      },
    };
  })();

  const gt = re();

  async function Bt_videoHash(e) {
    const t = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(e),
    );
    return Array.from(new Uint8Array(t))
      .map((e) => e.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 4);
  }

  function Bt_serverUrl() {
    const preset = S.sbServerPreset || "ajay";
    const hit = Zi.find((e) => e.id === preset);
    if (hit && hit.url) return hit.url.replace(/\/$/, "");
    return (S.sbServer || r).replace(/\/$/, "");
  }

  function Bt_buildUrl(e, hash) {
    const n = Bt_serverUrl();
    const enabledCats = i
      .filter((c) => S["sb_" + c.id + "_en"])
      .map((c) => c.id);
    if (!enabledCats.length) return null;
    const params = [];
    enabledCats.forEach((c) => params.push("category=" + encodeURIComponent(c)));
    if (S.sbMinVotes) params.push("minVotes=" + encodeURIComponent(S.sbMinVotes));
    if (S.sbMinViews) params.push("minViews=" + encodeURIComponent(S.sbMinViews));
    if (S.sbMaxViews) params.push("maxViews=" + encodeURIComponent(S.sbMaxViews));
    if (S.sbIncludeLocked) params.push("locked=1");
    if (S.sbIncludeHidden) params.push("hidden=1");
    if (S.sbIncludeIgnored) params.push("ignored=1");
    if (S.sbTrimUUIDs) params.push("trimUUIDs=1");
    params.push("service=YouTube");
    if (S.sbPrivacy) {
      return n + "/api/skipSegments/" + hash + "?" + params.join("&");
    }
    return (
      n + "/api/skipSegments?videoID=" + encodeURIComponent(e) + "&" + params.join("&")
    );
  }

  function Bt_filterSegments(segments) {
    if (!Array.isArray(segments)) return [];
    const minV = Number(S.sbMinVotes) || 0;
    const minVi = Number(S.sbMinViews) || 0;
    const maxVi = Number(S.sbMaxViews) || 0;
    const includeLocked = !!S.sbIncludeLocked;
    const includeHidden = !!S.sbIncludeHidden;
    const includeIgnored = !!S.sbIncludeIgnored;
    const out = [];
    for (const s of segments) {
      if (!s || !Array.isArray(s.segment) || s.segment.length !== 2) continue;
      if (!isFinite(s.segment[0]) || !isFinite(s.segment[1])) continue;
      if (s.segment[1] <= s.segment[0]) continue;
      if ((s.votes || 0) < minV) continue;
      if (minVi && (s.views || 0) < minVi) continue;
      if (maxVi && (s.views || 0) > maxVi) continue;
      if (!includeLocked && s.locked) continue;
      if (!includeHidden && s.hidden) continue;

      if (!includeIgnored && (s.shadowIgnored || s.ignored)) continue;

      out.push(s);
    }
    return out;
  }

  function Bt_resolveAction(seg, channelId) {
    const segOverride = (St_segOverrides || {})[seg.UUID];
    if (segOverride) return segOverride;
    const chanOverride = channelId && (St_chanOverrides || {})[channelId];
    if (chanOverride) return chanOverride;
    const userCfg = S["sb_" + seg.category + "_act"];
    if (userCfg && userCfg !== "skip") return userCfg;

    if (seg.actionType && seg.actionType !== "skip") return seg.actionType;
    return "skip";
  }

  let St_segOverrides = null,
    St_chanOverrides = null,
    St_segOvRaw = "",
    St_chanOvRaw = "",
    St_colorOverrides = null,
    St_colorOvRaw = "",
    St_chapterRules = null,
    St_chapterRulesRaw = "";
  function Bt_loadOverrides() {
    const sRaw = S.sbSegOverrides || "";
    const cRaw = S.sbChanOverrides || "";
    if (sRaw !== St_segOvRaw) {
      try {
        St_segOverrides = sRaw ? JSON.parse(sRaw) : {};
      } catch (e) {
        St_segOverrides = {};
      }
      St_segOvRaw = sRaw;
    }
    if (cRaw !== St_chanOvRaw) {
      try {
        St_chanOverrides = cRaw ? JSON.parse(cRaw) : {};
      } catch (e) {
        St_chanOverrides = {};
      }
      St_chanOvRaw = cRaw;
    }
    const colRaw = S.sbColorOverrides || "";
    if (colRaw !== St_colorOvRaw) {
      try {
        St_colorOverrides = colRaw ? JSON.parse(colRaw) : {};
      } catch (e) {
        St_colorOverrides = {};
      }
      St_colorOvRaw = colRaw;
    }
    const chRaw = S.sbChapterRules || "";
    if (chRaw !== St_chapterRulesRaw) {
      try {
        St_chapterRules = chRaw ? JSON.parse(chRaw) : {};
      } catch (e) {
        St_chapterRules = {};
      }
      St_chapterRulesRaw = chRaw;
    }
  }

  function Bt_color(catId) {
    Bt_loadOverrides();
    const ov = St_colorOverrides && St_colorOverrides[catId];
    if (ov && /^#[0-9a-fA-F]{3,6}$/.test(ov)) return ov;
    const def = i.find((c) => c.id === catId);
    return def ? def.color : "#fff";
  }

  function Bt_health() {
    return {
      lastFetch: St_lastFetch,
      lastErr: St_lastErr,
      backoff: St_backoff,
      segments: St_segmentsRaw,
      perCategory: Object.assign({}, St_perCat),
      perCategorySaved: Object.assign({}, St_perCatSaved),
      cacheSize: yt.size,
    };
  }

  function ft() {
    if (!S.sponsorblockOn) {
      lt && (lt.remove(), (lt = null));
      return;
    }
    if (!S.sbHud) {
      lt && (lt.remove(), (lt = null));
      return;
    }
    if (!lt && document.body) {
      lt = document.createElement("div");
      lt.id = "ytp-sb-hud";
      document.body.appendChild(lt);
    }
    if (!lt) return;
    if (S.sbHudStatus) {
      const health = Bt_health();
      const top = Object.entries(health.perCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => k + " " + v)
        .join("  ");
      const topSaved = Object.entries(health.perCategorySaved)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => k + " " + ce(v))
        .join("  ");
      const ago =
        health.lastFetch > 0
          ? Math.max(0, Math.floor((Date.now() - health.lastFetch) / 1000)) + "s ago"
          : "never";
      const errBit = health.lastErr ? "  err " + health.lastErr : "";
      const ftTextExt = "SB " + ce(rt) + " · " + ot + " skips\nserver: " + ago + errBit + "\n" + (top ? "top: " + top + "  saved: " + ce(0) + "\n" : "") + (topSaved ? "saved: " + topSaved : "");
      if (lt.textContent !== ftTextExt) lt.textContent = ftTextExt;
    } else {
      const ftTextMinimal = "SB " + ce(rt) + " - " + ot + " skips";
      if (lt.textContent !== ftTextMinimal) lt.textContent = ftTextMinimal;
    }
  }

  function bt(e, t) {
    document.body &&
      (ht ||
        ((ht = document.createElement("div")),
        (ht.id = "ytp-sb-ov"),
        document.body.appendChild(ht)),
      (ht.textContent = e + " - " + ce(t) + " left"));
  }
  function vt() {
    ht && (ht.remove(), (ht = null));
  }

  function kt() {
    if (!dt) return;
    const e = ie.el();
    e && ((e.volume = null != ct ? ct : 1), (e.muted = st));
    dt = !1;
    ct = null;
    st = !1;
  }

  function Bt_findActive(t) {
    if (!tt.length) return -1;
    let lo = 0,
      hi = tt.length - 1,
      best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const s = tt[mid];
      if (s.segment[0] <= t) {
        if (t < s.segment[1]) return mid;
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return -1;
  }

  function Bt_findNext(t) {
    if (!tt.length) return -1;
    let lo = 0,
      hi = tt.length - 1,
      best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const s = tt[mid];
      if (s.segment[0] > t) {
        best = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    return best;
  }

  function Bt_sortSegments() {
    tt.sort((a, b) => a.segment[0] - b.segment[0]);
  }

  const _voteInFlight = new Set();
  let St_activeIdx = -1;
  let St_lastTickTime = -1;
  function xt() {
    const e = ie.el();
    if (!e || e.paused || e.ended) {
      kt();
      St_activeIdx = -1;
      return;
    }
    if (!tt.length) {
      St_activeIdx = -1;
      return;
    }
    const t = e.currentTime;

    const upNextSec = Number(S.sbUpNextSec) || 0;
    if (upNextSec > 0) {
      const next = Bt_findNext(t);
      if (next >= 0) {
        const s = tt[next];
        const delta = s.segment[0] - t;
        if (delta > 0 && delta <= upNextSec) {
          Bt_showUpNext(s, delta);
        } else {
          Bt_hideUpNext();
        }
      } else {
        Bt_hideUpNext();
      }
    } else {
      Bt_hideUpNext();
    }

    let idx = St_activeIdx;
    if (
      idx < 0 ||
      idx >= tt.length ||
      !tt[idx] ||
      t < tt[idx].segment[0] ||
      t >= tt[idx].segment[1]
    ) {
      idx = Bt_findActive(t);
      St_activeIdx = idx;
    }
    if (idx < 0) {
      kt();
      vt();
      return;
    }
    const n = tt[idx];
    const r = n.category;
    if (!S["sb_" + r + "_en"] || S["sb_" + r + "_act"] === "disabled") return;
    Bt_loadOverrides();

    const channelId = St_currentChannelId;
    const action = Bt_resolveAction(n, channelId);
    const isMute = action === "mute";
    if (isMute) {
      if (!dt) {
        ct = e.volume;
        st = e.muted;
        e.muted = !0;
        dt = !0;
      }

      if (n.UUID && it.has(n.UUID)) return;
      it.add(n.UUID || ("seg-" + idx + "-" + n.segment[0]));
      const mutedSaved = Math.max(0, n.segment[1] - t);
      St_perCat[r] = (St_perCat[r] || 0) + 1;
      St_perCatSaved[r] = (St_perCatSaved[r] || 0) + mutedSaved;
      bt(
        (i.find((x) => x.id === r) || { label: r }).label,
        n.segment[1] - t,
      );
      return;
    }

    if (n.actionType === "poi" || n.actionType === "chapter") return;
    const alreadyCounted = n.UUID && it.has(n.UUID);
    if (!alreadyCounted) {
      it.add(n.UUID || ("seg-" + idx + "-" + n.segment[0]));
      const a = Math.max(0, n.segment[1] - t);
      rt += a;
      ot++;
      St_perCat[r] = (St_perCat[r] || 0) + 1;
      St_perCatSaved[r] = (St_perCatSaved[r] || 0) + a;
      k("kv", { k: "__sb_saved__", v: rt });
      k("kv", { k: "__sb_skips__", v: ot });
      ft();
      if (S.sbToast) {
        const label = (i.find((x) => x.id === r) || { label: r }).label;
        pe("Skipped " + label + " (" + ce(a) + ")", S.sbToastDur || 2200, "success");
      }

      try {
        Bt_viewedSponsorTime(n.UUID);
      } catch (e2) {}
    }
    try {
      e.currentTime = n.segment[1];
    } catch (e2) {}
  }

  let St_currentChannelId = "";
  function Bt_recordChannelOnce() {
    if (St_currentChannelId) return;
    St_currentChannelId = Ne() || "";
  }

  let St_upNextEl = null;
  let St_upNextHideAt = 0;
  function Bt_showUpNext(seg, deltaSec) {
    if (!document.body) return;
    if (!St_upNextEl) {
      St_upNextEl = document.createElement("div");
      St_upNextEl.id = "ytp-sb-next";
      St_upNextEl.style.cssText =
        "position:fixed;right:12px;bottom:80px;z-index:2147483636;background:rgba(20,22,28,.5);color:#eef;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:6px 12px;font:11px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);box-shadow:0 6px 20px rgba(0,0,0,.4);display:flex;align-items:center;gap:8px;transition:opacity .25s,transform .25s;opacity:0;transform:translateY(6px);";
      const dot = document.createElement("span");
      dot.style.cssText =
        "display:inline-block;width:8px;height:8px;border-radius:50%;";
      St_upNextEl.appendChild(dot);
      St_upNextEl._dot = dot;
      const lbl = document.createElement("span");
      St_upNextEl.appendChild(lbl);
      St_upNextEl._lbl = lbl;
      document.body.appendChild(St_upNextEl);
    }
    const color = Bt_color(seg.category);
    St_upNextEl._dot.style.background = color;
    St_upNextEl._dot.style.boxShadow = "0 0 6px " + color;
    const label = (i.find((x) => x.id === seg.category) || { label: seg.category })
      .label;
    St_upNextEl._lbl.textContent =
      label + " in " + Math.max(0, Math.round(deltaSec)) + "s";
    St_upNextEl.style.opacity = "1";
    St_upNextEl.style.transform = "translateY(0)";
    St_upNextHideAt = Date.now() + 4000;
  }
  function Bt_hideUpNext() {
    if (!St_upNextEl) return;
    if (Date.now() < St_upNextHideAt) return;
    St_upNextEl.style.opacity = "0";
    St_upNextEl.style.transform = "translateY(6px)";
  }

  let St_seekbarMarks = new Map(); 
  function sanitizeUrlForCSS(url) {
    if (!url || typeof url !== "string") return "";
    if (!/^https?:\/\//.test(url)) return "";
    if (/[()\s]/.test(url)) return "";
    return url;
  }
  function wt() {
    if (!S.sponsorblockOn || !S.sbSeekbar) {

      St_seekbarMarks.forEach((el) => {
        try {
          el.remove();
        } catch (e) {}
      });
      St_seekbarMarks.clear();
      return;
    }
    Bt_loadOverrides();
    const t = ie.el();
    if (!t || !t.duration || !isFinite(t.duration)) return;
    const a = t.duration;
    const list = document.querySelector(".ytp-progress-list") || document.querySelector(".ytp-progress-bar");
    if (!list) {

      return;
    }

    const desired = new Map();
    for (let i2 = 0; i2 < tt.length; i2++) {
      const seg = tt[i2];
      const cat = seg.category;
      if (!S["sb_" + cat + "_en"]) continue;
      const key = seg.UUID || "i" + i2;
      desired.set(key, { idx: i2, seg, cat });
    }

    for (const [k, el] of St_seekbarMarks) {
      if (!desired.has(k)) {
        try {
          el.remove();
        } catch (e) {}
        St_seekbarMarks.delete(k);
      }
    }

    for (const [key, info] of desired) {
      const seg = info.seg;
      const cat = info.cat;
      const isPoi = seg.actionType === "poi" || seg.actionType === "chapter";
      const start = (seg.segment[0] / a) * 100;
      const end = (seg.segment[1] / a) * 100;
      const widthPct = Math.max(0.15, end - start);
      const color = Bt_color(cat);
      const label = (i.find((x) => x.id === cat) || { label: cat }).label;
      const title =
        label +
        " " +
        ce(seg.segment[0]) +
        " - " +
        ce(seg.segment[1]) +
        " (" +
        Math.round(seg.segment[1] - seg.segment[0]) +
        "s)";
      let el = St_seekbarMarks.get(key);
      if (!el) {
        el = document.createElement("div");
        el.dataset.sbKey = key;
        el.className = "ytp-sb-mark" + (isPoi ? " ytp-sb-poi" : "");
        el.title = title;
        list.appendChild(el);
        St_seekbarMarks.set(key, el);
      } else if (el.title !== title) {
        el.title = title;
      }

      const css =
        isPoi
          ? "position:absolute;top:0;bottom:0;left:" +
            start +
            "%;width:3px;margin-left:-1.5px;background:" +
            color +
            ";opacity:.95;pointer-events:none;z-index:32;border-radius:1px;box-shadow:0 0 4px " +
            color +
            ";"
          : "position:absolute;top:0;bottom:0;left:" +
            start +
            "%;width:" +
            widthPct +
            "%;background:" +
            color +
            ";opacity:.75;pointer-events:none;z-index:31;border-radius:1px;";
      if (el.style.cssText !== css) el.style.cssText = css;
    }
  }

  function Ct() {
    clearTimeout(mt);
    const delay = Math.max(120, Math.min(2000, Number(S.sbRepaintMs) || 600));
    mt = setTimeout(wt, delay);
  }

  function Bt_invalidateMarks() {
    St_seekbarMarks.forEach((el) => {
      try {
        el.remove();
      } catch (e) {}
    });
    St_seekbarMarks.clear();
    wt();
  }



  async function St(e) {
    if ((nt && (clearInterval(nt), (nt = 0)), pt && ut)) {
      try {
        pt.removeEventListener("timeupdate", ut);
      } catch (e) {}
      pt = null;
      ut = null;
    }
    if (St_wtInterval) {
      try { clearInterval(St_wtInterval); } catch (e) {}
      St_wtInterval = 0;
    }
    if (St_progObs) {
      try { St_progObs.disconnect(); } catch (e) {}
      St_progObs = null;
    }
    tt = [];
    it = new Set();
    St_activeIdx = -1;
    St_perCat = {};
    St_perCatSaved = {};
    St_currentChannelId = "";
    Bt_hideUpNext();
    at = e;
    kt();
    vt();
    Bt_invalidateMarks();
    if (!S.sponsorblockOn) return;
    Bt_recordChannelOnce();
    try {
      const newSegs = await (async function (e) {
        const enabledCats = i
          .filter((c) => S["sb_" + c.id + "_en"])
          .map((c) => c.id);
        if (!enabledCats.length) return [];

        const filterKey = [

          S.sbServerPreset || "ajay",
          S.sbServer || "",
          S.sbPrivacy ? 1 : 0,
          S.sbMinVotes || 0,
          S.sbMinViews || 0,
          S.sbMaxViews || 0,
          S.sbIncludeLocked ? 1 : 0,
          S.sbIncludeHidden ? 1 : 0,
          S.sbIncludeIgnored ? 1 : 0,
          S.sbTrimUUIDs ? 1 : 0,
        ].join("|");
        const ck = "sb:" + e + "|" + enabledCats.join(",") + "|" + filterKey;

        const cachedSegments = await YtpCache.get(ck, { source: "idb" });
        if (cachedSegments) {
          return cachedSegments;
        }

        let hash = null;
        if (S.sbPrivacy) hash = await Bt_videoHash(e);
        const url = Bt_buildUrl(e, hash);
        if (!url) return [];
        return await gt("sb:" + ck, async () => {
          try {
            const r = await he(url);
            if (!r.ok) {

              if (r.status === 429 || r.status >= 500) {
                St_backoff = Math.min(5, St_backoff + 1);
              } else {
                St_backoff = 0;
              }
              St_lastErr = "HTTP " + r.status;
              St_lastFetch = Date.now();
              const stale = await YtpCache.get(ck, { source: "idb", allowExpired: true });
              return stale || [];
            }
            let body = await r.json();
            if (S.sbPrivacy) {

              if (Array.isArray(body)) {
                const hit = body.find(
                  (p) => p && p.videoID && p.videoID === e,
                );
                body = hit && Array.isArray(hit.segments) ? hit.segments : [];
              } else {
                body = [];
              }
            }
            const filtered = Bt_filterSegments(body || []);
            St_backoff = Math.max(0, St_backoff - 1);
            St_lastErr = null;
            St_lastFetch = Date.now();
            St_segmentsRaw = filtered.length;
            const currentTtl = St_cacheTTLms * Math.pow(2, St_backoff);
            await YtpCache.set(ck, filtered, currentTtl, { source: "idb" });
            return filtered;
          } catch (e2) {
            St_lastErr = String((e2 && e2.message) || e2);
            St_lastFetch = Date.now();
            const stale = await YtpCache.get(ck, { source: "idb", allowExpired: true });
            return stale || [];
          }
        });
      })(e);
      tt = newSegs;
      Bt_sortSegments();
    } catch (e) {
      tt = [];
    }
    ft();
    Bt_invalidateMarks();
    g.emit("sb.segments", { videoId: e, count: tt.length });
    const t = ie.el();
    if (t) {
      pt = t;
      ut = () => {
        _a() || xt();
      };
      t.addEventListener("timeupdate", ut);
      
      // Reset active index on user seeking to force re-evaluation instantly!
      const onSeeking = () => {
        St_activeIdx = -1;
        wt(); // Redraw seekbar marks immediately on seek
      };
      t.addEventListener("seeking", onSeeking);
      t.addEventListener("seeked", onSeeking);
      t.addEventListener("loadedmetadata", wt);
      t.addEventListener("durationchange", wt);
      
      Yt["sponsorblock"].push(() => {
        try {
          t.removeEventListener("seeking", onSeeking);
          t.removeEventListener("seeked", onSeeking);
          t.removeEventListener("loadedmetadata", wt);
          t.removeEventListener("durationchange", wt);
        } catch (_) {}
      });
    } else {
      nt = setInterval(() => {
        _a() || document.hidden || xt();
      }, 500);
    }

    try {
      wt();
      St_wtInterval = setInterval(() => {
        try { _a() || wt(); } catch (e) {}
      }, 2000);

      try {
        const obs = new MutationObserver(() => {
          try { wt(); } catch (e) {}
        });
        if (document.body) {
          obs.observe(document.body, { childList: true, subtree: true });
          St_progObs = obs;
        }
      } catch (e) {}
    } catch (e) {}
  }
  function Tt() {
    const e =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let t = "";
    try {
      const a = new Uint8Array(16);
      crypto.getRandomValues(a);
      for (let n = 0; n < 16; n++) t += e.charAt(a[n] % 64);
      return t;
    } catch (a) {
      for (let a = 0; a < 16; a++)
        t += e.charAt(Math.floor(64 * Math.random()));
      return t;
    }
  }
  function Ot(t, a, n) {
    return (
      (n = n || {}),
      new Promise((r) => {
        try {
          if (!e.ytcfg || !e.ytcfg.get) return void r({ ok: !1 });
          const o = e.ytcfg.get("INNERTUBE_API_KEY");
          if (!o) return void r({ ok: !1 });
          const i =
              "/youtubei/v1/" +
              t +
              "?key=" +
              encodeURIComponent(o) +
              "&prettyPrint=false",
            d = new AbortController(),
            c = setTimeout(() => d.abort(), n.timeout || 7e3),
            s = Object.assign(
              {
                "Content-Type": "application/json",
                "X-YouTube-Client-Name": String(
                  e.ytcfg.get("INNERTUBE_CONTEXT_CLIENT_NAME") || "1",
                ),
                "X-YouTube-Client-Version": String(
                  e.ytcfg.get("INNERTUBE_CONTEXT_CLIENT_VERSION") ||
                    e.ytcfg.get("INNERTUBE_CLIENT_VERSION") ||
                    "2.20240101",
                ),
              },
              n.headers || {},
            );
          try {
            const t = e.ytcfg.get("VISITOR_DATA");
            t && (s["X-Goog-Visitor-Id"] = t);
          } catch (e) {}
          fetch(i, {
            method: "POST",
            credentials: "include",
            mode: "same-origin",
            keepalive: !0,
            headers: s,
            body: JSON.stringify(a),
            signal: d.signal,
          })
            .then(async (e) => {
              clearTimeout(c);
              let t = null;
              if (n.parseJson)
                try {
                  t = await e.json();
                } catch (e) {}
              r({ ok: e.ok, status: e.status, json: t });
            })
            .catch(() => {
              (clearTimeout(c), r({ ok: !1 }));
            });
        } catch (e) {
          r({ ok: !1 });
        }
      })
    );
  }
  function Mt() {
    try {
      if (e.ytcfg && e.ytcfg.get) {
        const t = e.ytcfg.get("INNERTUBE_CONTEXT");
        if (t) {
          const a = JSON.parse(JSON.stringify(t));
          try {
            a.client &&
              (a.client.clientName || (a.client.clientName = "WEB"),
              a.client.clientVersion ||
                (a.client.clientVersion =
                  e.ytcfg.get("INNERTUBE_CLIENT_VERSION") || "2.20240101"));
          } catch (e) {}
          return a;
        }
      }
    } catch (e) {}
    return {
      client: {
        clientName: "WEB",
        clientVersion: "2.20240101",
        hl: "en",
        gl: "US",
      },
    };
  }
  function Lt() {
    try {
      if (e.ytcfg && e.ytcfg.get) {
        const t =
          e.ytcfg.get("STS") ||
          (e.ytcfg.get("PLAYER_VARS") && e.ytcfg.get("PLAYER_VARS").sts);
        if (t) return parseInt(t, 10);
      }
    } catch (e) {}
    return 19960;
  }
  async function At(e, t) {
    return Ot("player", {
      context: Mt(),
      videoId: e,
      cpn: t,
      contentCheckOk: !0,
      racyCheckOk: !0,
      playbackContext: {
        contentPlaybackContext: {
          signatureTimestamp: Lt(),
          referer: "https://www.youtube.com/watch?v=" + e,
          currentUrl: "/watch?v=" + e,
          autoplay: !1,
          autoCaptionsDefaultOn: !1,
          html5Preference: "HTML5_PREF_WANTS",
          lactMilliseconds: "1000",
          vis: 0,
        },
      },
    });
  }
  async function Et(e, t) {
    return Ot("next", {
      context: Mt(),
      videoId: e,
      cpn: t,
      racyCheckOk: !0,
      contentCheckOk: !0,
      autonavState: "STATE_NONE",
      playbackContext: { vis: 0, lactMilliseconds: "1000" },
      captionsRequested: !1,
    });
  }
  async function Bt(e, t) {
    return Ot("updated_metadata", { context: Mt(), videoId: e, cpn: t });
  }
  async function Pt(e, t, a) {
    return Ot("browse", {
      context: Mt(),
      browseId: "FEhistory",
      params: "",
      trackingParams: "",
      formData: {
        videoId: e,
        cpn: t,
        durationMs: String(Math.floor(1e3 * (a || 0))),
      },
    });
  }
  async function It(e, t, a) {
    return Ot(
      "log_event",
      (function (e, t, a, n) {
        const r = Date.now();
        return {
          context: n,
          eventLabel:
            "ytlogevent_engagementType_ENGAGEMENT_TYPE_VIDEO_WATCH_COMPLETE",
          ytLoggingDocumentEventsList: [
            {
              serializedDocumentEvent: "EhYIARIFY2xpY2sYwAIqByIFCMABEAEoCQ==",
              eventTimeMs: String(r),
            },
            {
              serializedDocumentEvent:
                "EhsIBhIPdmlkZW9fY29tcGxldGUYwAIqByIFCMABEAEoCQ==",
              eventTimeMs: String(r + 25),
            },
          ],
          payload: {
            videoId: e,
            cpn: t,
            watchTimeSec: Math.floor(a || 0),
            completePct: 100,
            finalStateMs: String(Math.floor(1e3 * (a || 0))),
          },
        };
      })(e, t, a, Mt()),
    );
  }
  async function Rt(e, t) {
    return Ot("feedback", {
      context: Mt(),
      feedbackTokens: [],
      isFeedbackTokenUnencrypted: !1,
      shouldMerge: !1,
      feedbackParams: { videoId: e, cpn: t, action: "WATCH_COMPLETED" },
    });
  }
  async function Nt(e, t) {
    return Ot("att/get", {
      context: Mt(),
      engagementType: "ENGAGEMENT_TYPE_WATCH_COMPLETED",
      videoId: e,
      cpn: t,
    });
  }
  function _t() {
    let t = "",
      a = "2.20240101",
      n = "en",
      r = "US",
      o = "",
      i = "124";
    try {
      e.ytcfg &&
        e.ytcfg.get &&
        ((t = e.ytcfg.get("EVENT_ID") || ""),
        (a = e.ytcfg.get("INNERTUBE_CLIENT_VERSION") || a),
        (n = e.ytcfg.get("HL") || n),
        (r = e.ytcfg.get("GL") || r),
        (o = e.ytcfg.get("VISITOR_DATA") || ""));
    } catch (e) {}
    try {
      const e = navigator.userAgent.match(/Chrome\/(\d+)/);
      e && (i = e[1]);
    } catch (e) {}
    return { ei: t, ver: a, hl: n, gl: r, visitorData: o, chromeVer: i };
  }
  function Ht(e, t, a, n, r, o) {
    const i = _t(),
      d = Math.floor(t || 0),
      c = Math.floor(null != a ? a : d),
      s = o && null != o.rtnDelta ? o.rtnDelta : 5,
      l = [
        "ns=yt",
        "el=detailpage",
        "cpn=" + encodeURIComponent(r),
        "docid=" + encodeURIComponent(e),
        "ver=2",
        "ei=" + encodeURIComponent(i.ei),
        "fmt=" + ((o && o.fmt) || "243"),
        "fs=0",
        "rt=" + c,
        "rtn=" + s,
        "of=" + encodeURIComponent("MS3lEPwEKa0vQUe3qbeAVA"),
        "euri=",
        "lact=" +
          (o && null != o.lact
            ? o.lact
            : Math.floor(1500 * Math.random() + 200)),
        "mos=0",
        "volume=" + (o && null != o.volume ? o.volume : 100),
        "muted=" + (o && o.muted ? "1" : "0"),
        "subscribed=" + (o && o.subscribed ? "1" : "0"),
        "cbr=Chrome",
        "cbrver=" + i.chromeVer + ".0.0.0",
        "c=WEB",
        "cver=" + encodeURIComponent(i.ver),
        "cplayer=UNIPLAYER",
        "cos=Windows",
        "cosver=10.0",
        "cplatform=DESKTOP",
        "hl=" + encodeURIComponent(i.hl),
        "cr=" + encodeURIComponent(i.gl),
        "len=" + d,
        "cmt=" + c,
        "mt=" + c,
        "st=" + Math.max(0, c - s),
        "et=" + c,
        "ns=yt",
        "lct=" + c,
        "lsct=" + c,
        "referrer=" +
          encodeURIComponent("https://www.youtube.com/watch?v=" + e),
        "plid=" + ((o && o.plid) || Tt()),
        "state=" + (n || "paused"),
        "idpj=-2",
        "ldpj=-13",
        "cl=" + (608e6 + Math.floor(1e6 * Math.random())),
        "vm=" + ((o && o.vm) || "CAEQARgB"),
        "vd=" + d,
        "fexp=" + ((o && o.fexp) || "v1"),
        "final=" + ("ended" === n ? "1" : "0"),
      ];
    return (
      i.visitorData && l.push("vis=" + encodeURIComponent(i.visitorData)),
      o && null != o.cdpj && l.push("cdpj=" + o.cdpj),
      l
    );
  }
  function Dt(e) {
    try {
      navigator.sendBeacon && navigator.sendBeacon(e);
    } catch (e) {}
    try {
      fetch(e, {
        method: "GET",
        credentials: "include",
        mode: "no-cors",
        keepalive: !0,
        cache: "no-store",
      }).catch(() => {});
    } catch (e) {}
  }
  function qt(e, t, a, n, r, o) {
    try {
      Dt(
        "https://www.youtube.com/api/stats/watchtime?" +
          Ht(e, t, a, n, r || Tt(), o).join("&"),
      );
    } catch (e) {}
  }
  function Vt(e, t, a, n, r) {
    try {
      const o = _t(),
        i = Math.floor(t || 0),
        d = Math.floor(a);
      Dt(
        "https://www.youtube.com/api/stats/qoe?" +
          [
            "event=" + (r || "streamingstats"),
            "fexp=v1",
            "ns=yt",
            "el=detailpage",
            "cpn=" + encodeURIComponent(n),
            "docid=" + encodeURIComponent(e),
            "ver=2",
            "cmt=" + d,
            "rt=" + d,
            "len=" + i,
            "c=WEB",
            "cver=" + encodeURIComponent(o.ver),
            "cbr=Chrome",
            "cbrver=" + o.chromeVer + ".0.0.0",
            "cos=Windows",
            "cosver=10.0",
            "cplatform=DESKTOP",
            "hl=" + encodeURIComponent(o.hl),
            "cr=" + encodeURIComponent(o.gl),
            "afmt=251",
            "vfmt=243",
            "live=0",
            "bwe=" + (15e5 + Math.floor(2e6 * Math.random())),
            "bh=" + (15 + Math.floor(30 * Math.random())),
            "bat=15,30,45,60",
            "df=0",
            "vis=" + (o.visitorData ? encodeURIComponent(o.visitorData) : ""),
            "ei=" + encodeURIComponent(o.ei),
          ].join("&"),
      );
    } catch (e) {}
  }
  function Ft(t, a) {
    let n = t && t.duration;
    if (n && isFinite(n) && n > 0.5) return n;
    try {
      if (
        a &&
        "function" == typeof a.getDuration &&
        ((n = a.getDuration()), n && isFinite(n) && n > 0.5)
      )
        return n;
    } catch (e) {}
    try {
      const t = e.ytInitialPlayerResponse;
      if (t && t.videoDetails && t.videoDetails.lengthSeconds)
        return parseFloat(t.videoDetails.lengthSeconds);
    } catch (e) {}
    try {
      const e = document.querySelector("span.ytp-time-duration");
      if (e) {
        const t = e.textContent.trim().split(":").map(Number);
        if (3 === t.length) return 3600 * t[0] + 60 * t[1] + t[2];
        if (2 === t.length) return 60 * t[0] + t[1];
      }
    } catch (e) {}
    return null;
  }
  let jt = !1,
    zt = 0;
  const Wt = new Map();
  function Ut() {
    const e = Date.now();
    if (e - zt < 300) return;
    zt = e;
    const t = ie.el(),
      a = ie.api(),
      n = ie.videoId();
    if (!n) return void pe("Open a video first.", 1800, "error");
    if (!t) return void pe("No video here yet.", 1800, "error");
    if (jt)
      return void pe("Already marking this one as watched…", 1200, "info");
    let r = Ft(t, a);
    if (r && isFinite(r) && r > 0.5) return void Kt(t, a, n, r);
    let o = 0;
    const i = setInterval(() => {
      ((r = Ft(t, a)),
        o++,
        ie.videoId() === n
          ? r && isFinite(r) && r > 0.5
            ? (clearInterval(i), Kt(t, a, n, r))
            : o > 60 &&
              (clearInterval(i),
              pe(
                "Couldn’t read the length yet - try again in a second.",
                2200,
                "error",
              ))
          : clearInterval(i));
    }, 50);
  }
  function Kt(e, t, a, n) {
    jt = !0;

    pe("Marked as watched.", 1500, "success");
    const r = {
      loop: e.loop,
      playbackRate: e.playbackRate,
      apiPlayVideo: t ? t.playVideo : null,
      apiPlayVideoAt: t ? t.playVideoAt : null,
      apiSeekTo: t ? t.seekTo : null,
      apiNextVideo: t ? t.nextVideo : null,
      apiLoadVideoByPlayerVars: t ? t.loadVideoByPlayerVars : null,
      apiCueVideoById: t ? t.cueVideoById : null,
      apiLoadVideoById: t ? t.loadVideoById : null,
      apiStopVideo: t ? t.stopVideo : null,
      apiAdvanceToNextItem: t ? t.advanceToNextItem : null,
      apiNextVideoOnAutoplay: t ? t.nextVideoOnAutoplay : null,
      loopCfg: S.loopVideo,
      skipIntroCfg: S.skipIntroOn,
    };
    try {
      e.loop = !1;
    } catch (e) {}
    ((S.loopVideo = !1), (S.skipIntroOn = !1));
    const o = function () {};
    if (t) {
      try {
        t.nextVideo = o;
      } catch (e) {}
      try {
        t.loadVideoByPlayerVars = o;
      } catch (e) {}
      try {
        t.cueVideoById = o;
      } catch (e) {}
      try {
        t.loadVideoById = o;
      } catch (e) {}
      try {
        t.stopVideo = o;
      } catch (e) {}
      try {
        t.advanceToNextItem && (t.advanceToNextItem = o);
      } catch (e) {}
      try {
        t.nextVideoOnAutoplay && (t.nextVideoOnAutoplay = o);
      } catch (e) {}
    }

    if (!1 !== S.forceWatchedLocalHistory) {
      Promise.resolve().then(() => {
        try {
          Xe(a, {
            duration: n,
            title: ie.title(),
            channel: ie.channel(),
            channelId: Ne(),
            thumbnail: ie.thumb(a, "hqdefault"),
          });
        } catch (e) {
          h("fw histMarkWatched", e);
        }
      });
    }

    if (!1 !== S.forceWatchedAccountHistory) {
      Promise.resolve().then(() => {
        (async () => {
          try {
            const track = await (async function (e) {
              try {
                const t = Mt(),
                  a = await Ot(
                    "player",
                    {
                      context: t,
                      videoId: e,
                      contentCheckOk: !0,
                      racyCheckOk: !0,
                      playbackContext: {
                        contentPlaybackContext: {
                          signatureTimestamp: Lt(),
                          referer: "https://www.youtube.com/watch?v=" + e,
                          currentUrl: "/watch?v=" + e,
                          autoplay: !1,
                          autoCaptionsDefaultOn: !1,
                          html5Preference: "HTML5_PREF_WANTS",
                          lactMilliseconds: "1000",
                          vis: 0,
                        },
                      },
                    },
                    { parseJson: !0, timeout: 8e3 },
                  );
                if (!a || !a.ok || !a.json) return null;
                const n = a.json,
                  r = n.playbackTracking || {},
                  o = n.playabilityStatus && n.playabilityStatus.status;
                if (o && "OK" !== o && "LIVE_STREAM_OFFLINE" !== o) return null;
                const i = n.videoDetails || {},
                  d = parseInt(i.lengthSeconds || "0", 10) || 0;
                return {
                  playbackUrl: r.videostatsPlaybackUrl && r.videostatsPlaybackUrl.baseUrl,
                  watchtimeUrl: r.videostatsWatchtimeUrl && r.videostatsWatchtimeUrl.baseUrl,
                  atrUrl: r.atrUrl && r.atrUrl.baseUrl,
                  qoeUrl: r.qoeUrl && r.qoeUrl.baseUrl,
                  ptrackingUrl: r.ptrackingUrl && r.ptrackingUrl.baseUrl,
                  delayplayUrl: r.videostatsDelayplayUrl && r.videostatsDelayplayUrl.baseUrl,
                  lengthSec: d,
                };
              } catch (e) {
                return null;
              }
            })(a);
            if (!track || (!track.playbackUrl && !track.watchtimeUrl)) {

              return;
            }
            const dur = track.lengthSec > 0 ? track.lengthSec : n,
              half = Math.max(15, Math.floor(dur)),
              tail = Math.max(1, half - 1);
            let fired = 0;
            try {
              track.playbackUrl && (Qa(Za(Za(track.playbackUrl, "len", half), "rt", 0)), fired++);
            } catch (e) {}
            try {
              track.atrUrl && (Qa(Za(Za(track.atrUrl, "len", half), "rt", 0)), fired++);
            } catch (e) {}
            try {
              track.delayplayUrl && (Qa(track.delayplayUrl), fired++);
            } catch (e) {}
            if (track.watchtimeUrl) {
              try {
                const e = Math.max(5, Math.floor(half / 2));
                Qa(
                  Za(
                    Za(
                      Za(
                        Za(Za(track.watchtimeUrl, "cmt", e), "et", e),
                        "st",
                        0,
                      ),
                      "mt",
                      e,
                    ),
                    "state",
                    "playing",
                  ),
                );
                fired++;
              } catch (e) {}
              try {
                Qa(
                  Za(
                    Za(
                      Za(
                        Za(Za(track.watchtimeUrl, "cmt", tail), "et", tail),
                        "st",
                        Math.max(0, tail - 5),
                      ),
                      "mt",
                      tail,
                    ),
                    "state",
                    "ended",
                  ),
                );
                fired++;
              } catch (e) {}
            }
            try {
              track.qoeUrl && (Qa(Za(Za(track.qoeUrl, "cmt", tail), "rt", tail)), fired++);
            } catch (e) {}
            try {
              track.ptrackingUrl && (Qa(track.ptrackingUrl), fired++);
            } catch (e) {}
            u("fw account-history tracking URLs fired: " + fired + " for " + a);
          } catch (e) {
            h("fw account-history player fetch", e);
          }
        })();
      });
    }
    const i = (function () {
        try {
          const e = ie.api();
          if (e) {
            if ("function" == typeof e.getVideoStats) {
              const t = e.getVideoStats();
              if (t && t.cpn) return t.cpn;
            }
            if ("function" == typeof e.getDebugText)
              try {
                const t = JSON.parse(e.getDebugText());
                if (t && t.cpn) return t.cpn;
              } catch (e) {}
            if ("function" == typeof e.getPlayerResponse) {
              const t = e.getPlayerResponse();
              if (t && t.playerConfig && t.playerConfig.cpn)
                return t.playerConfig.cpn;
            }
          }
        } catch (e) {}
        return Tt();
      })(),
      d = [Tt(), Tt()],
      c = [i].concat(d),
      s = Tt();
    (u(
      "fw " +
        a +
        " dur=" +
        n +
        " cpn=" +
        i.slice(0, 6) +
        " phantom=" +
        d.length,
    ),
      (async () => {
        try {
          !(function (e, t, a, n) {
            try {
              Dt(
                "https://www.youtube.com/api/stats/playback?" +
                  Ht(
                    e,
                    t,
                    0,
                    "playing",
                    a,
                    Object.assign({ fmt: "243", rtnDelta: 0 }, n || {}),
                  ).join("&"),
              );
            } catch (e) {}
          })(a, n, i, { plid: s });
        } catch (e) {}
        try {
          !(function (e, t) {
            try {
              const a = _t();
              Dt(
                "https://www.youtube.com/api/stats/delayplay?" +
                  [
                    "ns=yt",
                    "el=detailpage",
                    "cpn=" + encodeURIComponent(t),
                    "docid=" + encodeURIComponent(e),
                    "ver=2",
                    "ei=" + encodeURIComponent(a.ei),
                    "c=WEB",
                    "cver=" + encodeURIComponent(a.ver),
                    "cos=Windows",
                    "cosver=10.0",
                    "cplatform=DESKTOP",
                    "hl=" + encodeURIComponent(a.hl),
                    "cr=" + encodeURIComponent(a.gl),
                    "delay=" + (50 + Math.floor(200 * Math.random())),
                    "vis=" +
                      (a.visitorData ? encodeURIComponent(a.visitorData) : ""),
                  ].join("&"),
              );
            } catch (e) {}
          })(a, i);
        } catch (e) {}
        await ne();
        try {
          !(function (e, t, a, n) {
            try {
              Dt(
                "https://www.youtube.com/api/stats/atr?" +
                  Ht(e, t, 0, "atr", n, { fmt: "140", rtnDelta: 0 }).join("&"),
              );
            } catch (e) {}
          })(a, n, 0, i);
        } catch (e) {}
      })());
    const l = (function (e) {
      const t = [];
      let a = 0;
      const n = Math.max(15, e - 1);
      for (; a < n; ) {
        const e = Math.min(n - a, 4 + Math.floor(4 * Math.random())),
          r = Math.min(n, a + e),
          o =
            Math.random() < 0.08 && t.length > 2 && r < n - 8
              ? "paused"
              : "playing";
        (t.push({
          from: a,
          to: r,
          state: o,
          rtnDelta: e,
          lact: Math.floor(2500 * Math.random() + 100),
        }),
          (a = r));
      }
      return (
        t.push({
          from: n,
          to: e,
          state: "ended",
          rtnDelta: Math.max(1, e - n),
          lact: 50,
        }),
        t
      );
    })(n);
    if (
      ((async () => {
        for (let e = 0; e < l.length; e++) {
          const t = l[e];
          for (const e of c)
            try {
              qt(a, n, Math.floor(t.to), t.state, e, {
                rtnDelta: t.rtnDelta,
                lact: t.lact,
                plid: s,
                volume: 100,
                subscribed: !1,
              });
            } catch (e) {}
          (e + 1) % 3 == 0 && (await ne());
        }
      })(),
      setTimeout(() => {
        for (const e of c) {
          try {
            qt(a, n, Math.floor(n), "paused", e, {
              rtnDelta: 0,
              lact: 100,
              plid: s,
            });
          } catch (e) {}
          try {
            qt(a, n, Math.floor(n), "ended", e, {
              rtnDelta: 0,
              lact: 0,
              plid: s,
            });
          } catch (e) {}
        }
      }, 80),
      setTimeout(() => {
        for (const e of c)
          try {
            qt(a, n, Math.floor(n), "ended", e, {
              rtnDelta: 0,
              lact: 0,
              plid: s,
            });
          } catch (e) {}
      }, 320),
      setTimeout(() => {
        try {
          qt(a, n, Math.floor(n), "ended", i, {
            rtnDelta: 0,
            lact: 0,
            plid: s,
          });
        } catch (e) {}
      }, 900),
      setTimeout(() => {
        try {
          Vt(a, n, n, i, "streamingstats");
        } catch (e) {}
        try {
          Vt(a, n, n, i, "qoe");
        } catch (e) {}
      }, 150),
      Promise.allSettled([
        At(a, i),
        Et(a, i),
        Bt(a, i),
        Pt(a, i, n),
        It(a, i, n),
        Rt(a, i),
        Nt(a, i),
        At(a, d[0]),
        Bt(a, d[0]),
        Bt(a, d[1]),
      ]).then((e) => {
        const t = e.filter(
          (e) => "fulfilled" === e.status && e.value && e.value.ok,
        ).length;
        u("fw InnerTube: " + t + "/" + e.length + " endpoints OK");
      }),
      setTimeout(() => {
        Promise.allSettled([Bt(a, i), It(a, i, n)]).catch(() => {});
      }, 1100),
      setTimeout(() => {
        try {
          const e =
            "function" == typeof ie.thumbCandidates
              ? ie.thumbCandidates(a)
              : [ie.thumb(a, "hqdefault")];
          for (const t of e.slice(0, 2))
            fetch(t, {
              method: "GET",
              credentials: "omit",
              mode: "no-cors",
              cache: "no-store",
            }).catch(() => {});
        } catch (e) {}
      }, 50),
      t)
    ) {
      try {
        t.playVideo = r.apiPlayVideo;
      } catch (e) {}
      try {
        t.seekTo = r.apiSeekTo;
      } catch (e) {}
    }
    const p = Math.max(0, n - 0.5);
    try {
      e.currentTime = p;
    } catch (e) {}
    try {
      e.playbackRate = 16;
    } catch (e) {}
    try {
      e.play().catch(() => {});
    } catch (e) {}
    try {
      t && t.playVideo && t.playVideo();
    } catch (e) {}
    !(function (e) {
      try {
        const t = document.createElement("script");
        ((t.textContent =
          "(function(){try{" +
          e +
          "}catch(e){}})();document.currentScript&&document.currentScript.remove();"),
          (document.head || document.documentElement).appendChild(t));
      } catch (e) {}
    })(
      "var p=document.querySelector('#movie_player');var v=document.querySelector('video.html5-main-video');if(v){try{v.currentTime=" +
        p.toFixed(3) +
        ";}catch(e){}try{v.playbackRate=16;}catch(e){}try{v.play&&v.play().catch(function(){});}catch(e){}}if(p){try{p.playVideo&&p.playVideo();}catch(e){}try{p.setPlaybackRate&&p.setPlaybackRate(16);}catch(e){}try{p.seekTo&&p.seekTo(" +
        p.toFixed(3) +
        ",true);}catch(e){}}",
    );
    try {
      e.dispatchEvent(new Event("timeupdate", { bubbles: !0 }));
    } catch (e) {}
    try {
      e.dispatchEvent(new Event("progress", { bubbles: !0 }));
    } catch (e) {}
    try {
      e.dispatchEvent(new Event("seeking", { bubbles: !0 }));
    } catch (e) {}
    try {
      e.dispatchEvent(new Event("seeked", { bubbles: !0 }));
    } catch (e) {}
    !(function (e, t) {
      try {
        const a = new URL(location.href);
        if (a.searchParams.get("v") !== e) return;
        (a.searchParams.set("t", String(Math.floor(t))),
          e.history.replaceState(e.history.state, "", a.toString()));
      } catch (e) {}
    })(a, n);
    const m = () => {
      if ((Wt.delete(a), t)) {
        try {
          r.apiPlayVideo && (t.playVideo = r.apiPlayVideo);
        } catch (e) {}
        try {
          r.apiPlayVideoAt && (t.playVideoAt = r.apiPlayVideoAt);
        } catch (e) {}
        try {
          r.apiSeekTo && (t.seekTo = r.apiSeekTo);
        } catch (e) {}
        try {
          r.apiNextVideo && (t.nextVideo = r.apiNextVideo);
        } catch (e) {}
        try {
          r.apiLoadVideoByPlayerVars &&
            (t.loadVideoByPlayerVars = r.apiLoadVideoByPlayerVars);
        } catch (e) {}
        try {
          r.apiCueVideoById && (t.cueVideoById = r.apiCueVideoById);
        } catch (e) {}
        try {
          r.apiLoadVideoById && (t.loadVideoById = r.apiLoadVideoById);
        } catch (e) {}
        try {
          r.apiStopVideo && (t.stopVideo = r.apiStopVideo);
        } catch (e) {}
        try {
          r.apiAdvanceToNextItem &&
            (t.advanceToNextItem = r.apiAdvanceToNextItem);
        } catch (e) {}
        try {
          r.apiNextVideoOnAutoplay &&
            (t.nextVideoOnAutoplay = r.apiNextVideoOnAutoplay);
        } catch (e) {}
      }
      try {
        e.loop = r.loop;
      } catch (e) {}
      try {
        e.playbackRate = r.playbackRate;
      } catch (e) {}
      ((S.loopVideo = r.loopCfg), (S.skipIntroOn = r.skipIntroCfg), (jt = !1));
    };
    (Wt.set(a, m),
      setTimeout(m, 2500),
      setTimeout(() => {
        if (jt)
          try {
            m();
          } catch (e) {}
      }, 6e3));
  }
  const Yt = {};
  let Gt = 0;
  const Xt = {
    visible:
      "undefined" == typeof document || "visible" === document.visibilityState,
    focused: "undefined" == typeof document || document.hasFocus(),
    saveData: !1,
    batteryLow: !1,
    cpuConstrained:
      "undefined" != typeof navigator &&
      navigator.hardwareConcurrency &&
      navigator.hardwareConcurrency <= 4,
    lowMemory:
      "undefined" != typeof navigator &&
      navigator.deviceMemory &&
      navigator.deviceMemory <= 4,
    perfMode: !1,
    perfLevel: "balanced",
  };
  let Zt = 0;
  try {
    const e = () => {
      Zt = performance.now();
    };
    (window.addEventListener("scroll", e, { passive: !0, capture: !0 }),
      window.addEventListener("wheel", e, { passive: !0, capture: !0 }),
      window.addEventListener("touchmove", e, { passive: !0, capture: !0 }));
  } catch (e) {}
  try {
    "undefined" != typeof navigator &&
      (navigator.connection &&
        ((Xt.saveData = !!navigator.connection.saveData),
        navigator.connection.addEventListener &&
          navigator.connection.addEventListener("change", () => {
            Xt.saveData = !!navigator.connection.saveData;
          })),
      navigator.getBattery &&
        navigator
          .getBattery()
          .then((e) => {
            const t = () => {
              Xt.batteryLow = !e.charging && e.level < 0.25;
            };
            (t(),
              e.addEventListener && e.addEventListener("levelchange", t),
              e.addEventListener && e.addEventListener("chargingchange", t));
          })
          .catch(() => {}));
  } catch (e) {}
  function Qt() {
    let e = 1;
    return (
      Xt.visible || (e *= 8),
      Xt.focused || (e *= 1.5),
      Xt.batteryLow && (e *= 2),
      Xt.saveData && (e *= 1.5),
      Xt.cpuConstrained && (e *= 1.4),
      Xt.lowMemory && (e *= 1.2),
      e
    );
  }
  const Jt = new Map();
  let $t = 1;
  const ea = new Map(),
    ta = new Map();
  function aa(e, t, a) {
    if (!e) return;
    let n = ta.get(e);
    (n ||
      ((n = {
        intervals: 0,
        observers: 0,
        listeners: 0,
        applies: 0,
        totalMs: 0,
        maxMs: 0,
        lastMs: 0,
        lastT: 0,
      }),
      ta.set(e, n)),
      "interval" === t
        ? n.intervals++
        : "observer" === t
          ? n.observers++
          : "apply" === t && n.applies++,
      (n.totalMs += a),
      (n.lastMs = a),
      (n.lastT = performance.now()),
      a > n.maxMs && (n.maxMs = a));
  }
  function na(e) {
    const t = e.baseMs,
      a = Qt(),
      n = Math.max(150, Math.round(t * a * e.backoff)),
      r = setTimeout(() => {
        if ((ea.delete(e.id), !Jt.has(e.id))) return;
        let t = !1;
        const a = performance.now();
        try {
          (e.pauseWhenHidden && !Xt.visible) ||
            (e.skipWhenPopup && _a()) ||
            (t = !1 !== e.fn());
        } catch (t) {
          m("perfInterval " + e.featureId, t);
        }
        const n = performance.now() - a;
        (S.perfProfilerOn && aa(e.featureId, "interval", n),
          n > 12 && e.backoff < 4
            ? (e.backoff = Math.min(4, 1.3 * e.backoff))
            : t && e.backoff > 1
              ? (e.backoff = Math.max(1, 0.8 * e.backoff))
              : !t &&
                e.backoff < 3 &&
                (e.backoff = Math.min(3, 1.15 * e.backoff)),
          na(e));
      }, n);
    ea.set(e.id, r);
  }
  const ra = new Set();
  let oa = null,
    ia = 0;
  (document.addEventListener(
    "visibilitychange",
    () => {
      ((Xt.visible = "visible" === document.visibilityState),
        Xt.visible &&
          ra.size &&
          requestAnimationFrame(() => {
            for (const e of ra)
              try {
                e();
              } catch (e) {}
          }));
    },
    { passive: !0 },
  ),
    window.addEventListener(
      "focus",
      () => {
        Xt.focused = !0;
      },
      { passive: !0 },
    ),
    window.addEventListener(
      "blur",
      () => {
        Xt.focused = !1;
      },
      { passive: !0 },
    ));
  const da = new Map();
  function ca(e, t) {
    const a = da.get(e);
    if (a && performance.now() - a.t < (t || 800)) return a.v;
    const n = document.querySelector(e);
    if ((da.set(e, { v: n, t: performance.now() }), da.size > 50)) {
      const e = da.keys().next().value;
      da.delete(e);
    }
    return n;
  }
  let sa = !1;
  const la = [];
  function pa(e) {
    (la.push(e),
      sa ||
        ((sa = !0),
        requestAnimationFrame(() => {
          sa = !1;
          const e = la.splice(0);
          for (const t of e)
            try {
              t();
            } catch (e) {
              m("rafBatch", e);
            }
        })));
  }
  function ua(e) {
    Yt[e] = Yt[e] || [];
    const t = Yt[e];
    let a = null;
    return {
      addStyle(n) {
        if (a) return ((a.textContent += "\n" + n), a);
        const r = "ytp-style-" + e + "-" + ++Gt,
          o = document.createElement("style");
        return (
          (o.id = r),
          (o.textContent = n),
          (document.head || document.documentElement).appendChild(o),
          (a = o),
          t.push(() => {
            try {
              o.remove();
            } catch (e) {}
            a = null;
          }),
          o
        );
      },
      addListener(a, n, r, o) {
        try {
          if (!a || "function" != typeof a.addEventListener) return;
          const i = function (t) {
              try {
                return r(t);
              } catch (t) {
                fa(e, t);
              }
            },
            d =
              o && "object" == typeof o
                ? o
                : "wheel" === n ||
                    "scroll" === n ||
                    "touchstart" === n ||
                    "touchmove" === n ||
                    "mousemove" === n ||
                    "pointermove" === n
                  ? { passive: !0 }
                  : o;
          (a.addEventListener(n, i, d),
            t.push(() => {
              try {
                a.removeEventListener(n, i, d);
              } catch (e) {}
            }));
        } catch (t) {
          fa(e, t);
        }
      },
      addObserver(a, n, r) {
        try {
          if (!a) return;
          const i = () => {
            if (Xt.visible && !_a())
              try {
                n();
              } catch (t) {
                fa(e, t);
              }
          };
          if (a === document.body && r && r.childList && r.subtree) {
            const e =
              ((o = i),
              !oa &&
                document.body &&
                ((oa = new MutationObserver(() => {
                  ia ||
                    (ia = requestAnimationFrame(() => {
                      if (((ia = 0), Xt.visible))
                        for (const e of ra)
                          try {
                            e();
                          } catch (e) {
                            m("domObs sub", e);
                          }
                    }));
                })),
                oa.observe(document.body, { childList: !0, subtree: !0 })),
              ra.add(o),
              () => {
                if ((ra.delete(o), 0 === ra.size && oa)) {
                  try {
                    oa.disconnect();
                  } catch (e) {}
                  oa = null;
                }
              });
            return void t.push(e);
          }
          const d = new MutationObserver(i);
          (d.observe(a, r),
            t.push(() => {
              try {
                d.disconnect();
              } catch (e) {}
            }));
        } catch (t) {
          fa(e, t);
        }
        var o;
      },
      addInterval(a, n, r) {
        const o = $t++,
          i = {
            id: o,
            featureId: e,
            fn: function () {
              try {
                return a();
              } catch (t) {
                fa(e, t);
              }
            },
            baseMs: n,
            backoff: 1,
            pauseWhenHidden: !1 !== (r = r || {}).pauseWhenHidden,
            skipWhenPopup: !1 !== r.skipWhenPopup,
          };
        return (
          Jt.set(o, i),
          na(i),
          t.push(() =>
            (function (e) {
              const t = ea.get(e);
              (t && (clearTimeout(t), ea.delete(e)), Jt.delete(e));
            })(o),
          ),
          o
        );
      },
      addTimeout(a, n) {
        const r = setTimeout(function () {
          try {
            return a();
          } catch (t) {
            fa(e, t);
          }
        }, n);
        return (t.push(() => clearTimeout(r)), r);
      },
      addRAF(a) {
        let n = 0,
          r = !0;
        const o = () => {
          if (r)
            if (Xt.visible) {
              try {
                a();
              } catch (t) {
                fa(e, t);
              }
              n = requestAnimationFrame(o);
            } else n = setTimeout(o, 250);
        };
        ((n = requestAnimationFrame(o)),
          t.push(() => {
            r = !1;
            try {
              cancelAnimationFrame(n);
            } catch (e) {}
            try {
              clearTimeout(n);
            } catch (e) {}
          }));
      },
      onNav(a) {
        const n = g.on("nav.changed", (...t) => {
          try {
            return a(...t);
          } catch (t) {
            fa(e, t);
          }
        });
        t.push(n);
      },
    };
  }
  function ha(e) {
    const t = Yt[e];
    if (t && t.length) {
      for (let a = t.length - 1; a >= 0; a--)
        try {
          t[a]();
        } catch (t) {
          try {
            h("teardown " + e, t && t.message);
          } catch (e) {}
        }
      Yt[e] = [];
    } else Yt[e] = [];
  }
  const ma = 3,
    ya = new Map(),
    ga = new Set();
  function fa(e, t) {
    const a = (ya.get(e) || 0) + 1;
    ya.set(e, a);
    try {
      m("apply " + e + " #" + a, t);
    } catch (e) {}
    if (a >= ma && !ga.has(e)) {
      ga.add(e);
      try {
        m('[YT-zen] feature "' + e + '" quarantined after ' + a + " crashes");
      } catch (e) {}
      try {
        ha(e);
      } catch (e) {}
      try {
        pe(
          "“" + e + "” ran into trouble and was turned off for now.",
          4e3,
          "error",
        );
      } catch (e) {}
    }
  }
  function ba(e) {
    return ga.has(e);
  }
  const va = new Map(),
    ka = new Map(),
    xa = {
      register(e) {
        if (
          (va.set(e.id, e),
          e.masterKey &&
            (ka.has(e.masterKey) || ka.set(e.masterKey, []),
            ka.get(e.masterKey).push(e)),
          e.keys)
        )
          for (const t of e.keys)
            t !== e.masterKey &&
              (ka.has(t) || ka.set(t, []), ka.get(t).push(e));
      },
      list: () => Array.from(va.values()),
      get: (e) => va.get(e),
      apply(e) {
        const t = va.get(e);
        if (!t) return;
        if (ba(e)) return;
        if (_a())
          return (
            xa._deferred || (xa._deferred = new Set()),
            xa._deferred.add(e),
            void (
              xa._deferTimer ||
              (xa._deferTimer = setInterval(function () {
                if (_a()) return;
                (clearInterval(xa._deferTimer), (xa._deferTimer = 0));
                const e = xa._deferred;
                ((xa._deferred = null),
                  e &&
                    e.forEach(function (e) {
                      xa.apply(e);
                    }));
              }, 300))
            )
          );
        try {
          ha(e);
        } catch (t) {
          return void fa(e, t);
        }
        const a = S.perfProfilerOn ? performance.now() : 0;
        try {
          const a = t.apply(ua(e));
          a && "function" == typeof a.then && a.catch((t) => fa(e, t));
        } catch (t) {
          fa(e, t);
        }
        if (S.perfProfilerOn)
          try {
            aa(e, "apply", performance.now() - a);
          } catch (e) {}
      },
      isQuarantined: ba,
      clearQuarantine(e) {
        e ? (ga.delete(e), ya.delete(e)) : (ga.clear(), ya.clear());
      },
      applyAll() {
        if (_a())
          return void (
            xa._applyAllTimer ||
            (xa._applyAllTimer = setTimeout(function () {
              ((xa._applyAllTimer = 0), xa.applyAll());
            }, 400))
          );
        const e = Array.from(va.values()),
          t = [],
          a = [];
        for (const n of e)
          ("function" == typeof n.settings && n.settings.length > 0
            ? a
            : t
          ).push(n);
        const n = t.concat(a);
        let r = 0;
        const o = Xt.cpuConstrained || Xt.lowMemory || Xt.perfMode || S.perfModeOn ? 3 : 6;
        (async () => {
          for (; r < n.length; ) {
            const e = Math.min(r + o, n.length);
            for (; r < e; r++) xa.apply(n[r].id);
            r < n.length && (await ne());
          }
        })();
      },
    };
  let wa = null;
  function Ca() {
    if (!wa) return;
    const e = Array.from(wa);
    ((wa = null),
      ae(() => {
        (async () => {
          for (let t = 0; t < e.length; t++)
            (xa.apply(e[t]), (t + 1) % 3 == 0 && (await ne()));
        })();
      }, 50));
  }
  function Sa(e) {
    "feedWatchedMode" === e
      ? ((S.feedDimWatchedOn = "dim" === S.feedWatchedMode),
        (S.feedHideWatchedOn = "hide" === S.feedWatchedMode))
      : "autoPauseMode" === e
        ? ((S.autoPauseHiddenOn =
            "hidden" === S.autoPauseMode || "both" === S.autoPauseMode),
          (S.autoPauseBlurOn =
            "blur" === S.autoPauseMode || "both" === S.autoPauseMode))
        : "highlightVideoLengthMode" === e &&
          ((S.highlightLongVideosOn =
            "long" === S.highlightVideoLengthMode ||
            "both" === S.highlightVideoLengthMode),
          (S.highlightShortVideosOn =
            "short" === S.highlightVideoLengthMode ||
            "both" === S.highlightVideoLengthMode));
  }
  function Ta(e, t) {
    if (S[e] === t) {
      if (!T && z() && S[e] === t) return;
      if (T) return;
    }
    ((S[e] = t),
      Sa(e),
      Y(),
      "silentToasts" === e && ue(),
      wa || ((wa = new Set()), queueMicrotask(Ca)));
    const a = ka.get(e);
    if (a) for (const e of a) wa.add(e.id);
    g.emit("cfg.changed", { key: e, val: t });
  }
  function Oa(e) {
    T || z();
    const t = new Set();
    for (const a of Object.keys(e)) S[a] !== e[a] && ((S[a] = e[a]), t.add(a));
    if (!t.size) return;
    for (const e of t) Sa(e);
    (Y(), t.has("silentToasts") && ue());
    const a = new Set();
    for (const e of t)
      for (const t of va.values())
        (t.masterKey !== e && -1 === (t.keys || []).indexOf(e)) || a.add(t.id);
    setTimeout(() => {
      for (const e of a) xa.apply(e);
      for (const e of t) g.emit("cfg.changed", { key: e, val: S[e] });
    }, 200);
  }
  (xa.register({
    id: "speed-controller",
    name: "Playback Speed",
    summary:
      "Pick a default playback speed, or have YT-zen remember the speed you chose for each video.",
    masterKey: "speedRemember",
    keys: ["speedDefault", "speedRemember", "speedStep"],
    apply(e) {
      const t = Math.max(0.0625, Math.min(16, Number(S.speedDefault) || 1)),
        a = () => {
          const e = ie.el();
          e && Math.abs(e.playbackRate - t) > 0.01 && (e.playbackRate = t);
        };
      if ((a(), !S.speedRemember && 1 === S.speedDefault)) return;
      const n = () => {
        const t = ie.el();
        t &&
          (e.addListener(t, "ratechange", a),
          e.addListener(t, "loadedmetadata", a),
          e.addListener(t, "play", a));
      };
      (n(),
        e.onNav(() => {
          (e.addTimeout(a, 800), e.addTimeout(n, 1200));
        }));
    },
    settings(e) {
      (e.appendChild(
        Ro(
          "Default speed",
          "speedDefault",
          Object.fromEntries(
            [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4].map((e) => [
              e,
              e + "x",
            ]),
          ),
        ),
      ),
        e.appendChild(
          Ro("Hotkey step", "speedStep", {
            0.05: "±0.05x",
            0.1: "±0.1x",
            0.25: "±0.25x (default)",
            0.5: "±0.5x",
            1: "±1x",
          }),
        ));
    },
  }),
    xa.register({
      id: "speed-per-channel",
      name: "Per-Channel Speed Memory",
      summary:
        "Remembers the playback speed you last used on each channel and restores it automatically on their videos.",
      masterKey: "speedPerChannelOn",
      keys: ["speedPerChannelOn"],
      apply(e) {
        if (!S.speedPerChannelOn) return;

        let _spdLastVid = "";
        const _rd = () =>
          v("kv", "__perChSpeed__").then((r) =>
            r && "object" == typeof r.v && r.v ? r.v : {},
          );
        const _wr = (map) =>
          k("kv", { k: "__perChSpeed__", v: map, updatedAt: Date.now() });
        const _save = () => {
          const t = ie.el();
          if (!t) return;
          const ch = Ne();
          if (!ch || !isFinite(t.playbackRate)) return;
          _rd()
            .then((m) => {
              const keys = Object.keys(m);
              if (keys.length >= 200) {
                keys.sort(
                  (a2, b2) =>
                    ((m[a2] && m[a2].ts) || 0) - ((m[b2] && m[b2].ts) || 0),
                );
                for (const k2 of keys.slice(0, 50)) delete m[k2];
              }
              m[ch] = { r: t.playbackRate || 1, ts: Date.now() };
              _wr(m);
            })
            .catch(() => {});
        };
        const _restore = () => {
          const t = ie.el(),
            vid = ie.videoId();
          if (!t || !vid || vid === _spdLastVid) return;
          const ch = Ne();
          if (!ch) return;

          _spdLastVid = vid;
          _rd()
            .then((m) => {
              const rec = m && m[ch];
              if (
                rec &&
                isFinite(rec.r) &&
                Math.abs((t.playbackRate || 1) - rec.r) > 0.01
              ) {
                t.playbackRate = rec.r;
                pe(
                  "Speed restored to " + rec.r + "x for this channel",
                  1500,
                  "info",
                );
              }
            })
            .catch(() => {});
        };

        e.addListener(
          document,
          "ratechange",
          (ev) => {
            if (ev.target === ie.el()) _save();
          },
          !0,
        );
        e.addListener(
          document,
          "loadedmetadata",
          (ev) => {
            if (ev.target === ie.el()) e.addTimeout(_restore, 600);
          },
          !0,
        );
        e.onNav(() => {
          ((_spdLastVid = ""), e.addTimeout(_restore, 1200));
        });
        e.addTimeout(_restore, 1500);
      },
      settings() {},
    }),
    xa.register({
      id: "loop-video",
      name: "Loop Video",
      summary: "Repeat the video when it ends.",
      masterKey: "loopVideo",
      keys: ["loopVideo"],
      apply(e) {
        if (!S.loopVideo) {
          const e = ie.el();
          return void (e && (e.loop = !1));
        }
        const t = () => {
          const e = ie.el();
          e && (e.loop = !0);
        };
        t();
        const a = () => {
          const a = ie.el();
          a && e.addListener(a, "loadedmetadata", t);
        };
        (a(),
          e.onNav(() => {
            (e.addTimeout(t, 800), e.addTimeout(a, 1200));
          }));
      },
      settings() {},
    }),
    xa.register({
      id: "ab-repeat",
      name: "Loop a Segment",
      summary:
        "Pick a start point and an end point, and the video will loop between them. Use [ to mark the start, ] to mark the end, and \\ to clear.",
      masterKey: "abLoopOn",
      keys: ["abLoopOn", "abA", "abB"],
      apply(e) {
        if (!S.abLoopOn) return;
        const t = () => {
            if (S.abA < 0 || S.abB <= S.abA) return;
            const e = ie.el();
            e &&
              e.currentTime >= S.abB &&
              ((e.currentTime = S.abA), e.play().catch(() => {}));
          },
          a = () => {
            const a = ie.el();
            a && e.addListener(a, "timeupdate", t);
          };
        (a(), e.onNav(() => e.addTimeout(a, 1200)));
      },
      settings(e) {
        e.appendChild(
          Ao([
            [
              "Set A",
              () => {
                const e = ie.el();
                e && Ta("abA", e.currentTime);
              },
            ],
            [
              "Set B",
              () => {
                const e = ie.el();
                e && Ta("abB", e.currentTime);
              },
            ],
            ["Clear", () => Oa({ abA: -1, abB: -1 })],
          ]),
        );
      },
    }),
    xa.register({
      id: "frame-step",
      name: "Frame Stepping",
      summary:
        "When the video is paused, press , or . to move one frame at a time.",
      masterKey: "frameStep",
      keys: ["frameStep"],
      apply() {},
      settings() {},
    }),
    xa.register({
      id: "smart-quality",
      name: "Smart Quality",
      summary: "Use a higher quality on Wi-Fi and a lower one on mobile data.",
      masterKey: "smartQualityOn",
      keys: ["smartQualityOn", "smartQualityWifi", "smartQualityCell"],
      apply(e) {
        if (!S.smartQualityOn) return;
        const t = () => {
          if (S.privacyShieldOn) return;
          const e = navigator.connection || {};
          let t =
            "cellular" === e.type || e.saveData
              ? S.smartQualityCell
              : S.smartQualityWifi;
          const a = ie.levels();
          if ((a.length && -1 === a.indexOf(t) && (t = a[0]), t))
            try {
              ie.setQuality(t);
            } catch (e) {}
        };
        (t(), e.onNav(() => e.addTimeout(t, 1500)), e.addTimeout(t, 1500));
      },
      settings(e) {
        (e.appendChild(Ro("Wifi quality", "smartQualityWifi", d)),
          e.appendChild(Ro("Cellular quality", "smartQualityCell", d)));
      },
    }),
    xa.register({
      id: "auto-hd",
      name: "Always Use My Preferred Quality",
      summary: "Sets every video to the quality you picked, every time.",
      masterKey: "autoHD",
      keys: ["autoHD", "qualityPref"],
      apply(e) {
        if (!S.autoHD) return;
        const t = () => {
          const e = ie.levels();
          if (!e.length) return;
          let t = S.qualityPref;
          -1 === e.indexOf(t) && (t = e[0]);
          try {
            ie.setQuality(t);
          } catch (e) {}
        };
        t();
        const a = () => {
          const a = ie.el();
          a &&
            (e.addListener(a, "loadedmetadata", t),
            e.addListener(a, "loadeddata", t));
        };
        (a(),
          e.onNav(() => {
            (e.addTimeout(t, 1500), e.addTimeout(a, 1500));
          }));
      },
      settings(e) {
        e.appendChild(Ro("Quality", "qualityPref", d));
      },
    }),

    xa.register({
      id: "in-video-search",
      name: "In-Video Search",
      summary:
        "Search inside the captions of the current video. Results appear as a timeline so you can jump straight to any mention of a word or phrase.",
      masterKey: "inVideoSearchOn",
      keys: ["inVideoSearchOn", "inVideoSearchHotkey"],
      apply(e) {
        if (!S.inVideoSearchOn) return;
        const _ivsGetHotkey = () => S.inVideoSearchHotkey || "Ctrl+KeyF";
        const _ivsGet = () => {
          try {
            const r = e.ytInitialPlayerResponse;
            if (!r) return null;
            const t =
              r.captions &&
              r.captions.playerCaptionsTracklistRenderer &&
              r.captions.playerCaptionsTracklistRenderer.captionTracks;
            if (!Array.isArray(t) || !t.length) return null;
            const p = t[0];
            if (!p || !p.baseUrl) return null;
            return p.baseUrl;
          } catch (e) {
            return null;
          }
        };
        const _ivsFetch = async (vid) => {
          if (!vid) return null;
          if (_ivsCache.vid === vid && _ivsCache.lines) return _ivsCache.lines;
          _ivsCache.vid = vid;
          _ivsCache.lines = null;
          try {
            const u = vid + (vid.indexOf("?") >= 0 ? "&" : "?") + "fmt=json3";
            const r = await he(u);
            if (!r.ok) return null;
            const j = await r.json();
            const events = Array.isArray(j && j.events) ? j.events : [];
            const lines = [];
            for (const ev of events) {
              if (!ev) continue;
              const start = (ev.tStartMs || 0) / 1000;
              const dur = (ev.dDurationMs || 0) / 1000;
              let text = "";
              if (Array.isArray(ev.segs)) {
                for (const s of ev.segs) {
                  if (s && typeof s.utf8 === "string") text += s.utf8;
                }
              }
              text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
                .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c))
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/\s+/g, " ")
                .trim();
              if (text) lines.push({ start: start, end: start + dur, text: text });
            }
            _ivsCache.lines = lines;
            return lines;
          } catch (e) {
            return null;
          }
        };
        const _ivsOpen = async () => {
          const url = _ivsGet();
          if (!url) {
            pe("No captions available for this video.", 2400, "info");
            return;
          }
          _ivsUI.ensure();
          _ivsUI.setQuery("");
          _ivsUI.setStatus("Loading captions...");
          _ivsUI.show();
          const lines = await _ivsFetch(url);
          if (!lines) {
            _ivsUI.setStatus("Could not load captions.");
            return;
          }
          _ivsUI.setStatus(lines.length + " caption lines loaded.");
          _ivsUI.setLines(lines);
          setTimeout(() => {
            try {
              _ivsUI.input && _ivsUI.input.focus();
            } catch (e) {}
          }, 50);
        };
        const _ivsClose = () => {
          _ivsUI.hide();
        };
        const _ivsOnKey = (ev) => {
          if (ev.repeat) return;
          if (ev.key === "Escape" && _ivsUI.isOpen()) {
            _ivsClose();
            ev.preventDefault();
            ev.stopPropagation();
            return;
          }
          if (ei(ev, _ivsGetHotkey())) {
            ev.preventDefault();
            ev.stopPropagation();
            if (_ivsUI.isOpen()) _ivsClose(); else _ivsOpen();
            return;
          }
        };
        e.addListener(document, "keydown", _ivsOnKey, true);
        e.onNav(() => _ivsClose());
      },
      settings(e) {
        e.appendChild(Io("Enable in-video search", "inVideoSearchOn"));
        e.appendChild(
          (function (label, key) {
            const col = To("div", "ytp-col");
            col.appendChild(To("span", "ytp-lbl", label));
            const input = document.createElement("input");
            input.type = "text";
            input.className = "ytp-inp";
            input.placeholder = "e.g. Ctrl+KeyF";
            input.value = S[key] || "";
            input.addEventListener(
              "change",
              () => {
                const v = (input.value || "").trim();

                if (!v || !/^(Ctrl\+)?(Alt\+)?(Shift\+)?(Meta\+)?(Key[A-Z]|Digit\d|[A-Z][a-z]*[A-Z]?|[A-Z])$/i.test(v)) {
                  Ta(key, "Ctrl+KeyF");
                  input.value = "Ctrl+KeyF";
                  pe("Invalid hotkey - reset to Ctrl+KeyF", 1800, "info");
                } else {
                  Ta(key, v);
                }
              },
            );
            So("cfg.changed", ({ key: k }) => {
              if (k === key) input.value = S[key] || "";
            });
            col.appendChild(input);
            return col;
          })("Hotkey to open search", "inVideoSearchHotkey"),
        );
      },
    }),

    xa.register({
      id: "skip-intro",
      name: "Skip Intro",
      summary:
        "Automatically jump past the intro of every new video by the number of seconds you choose.",
      masterKey: "skipIntroOn",
      keys: ["skipIntroOn", "skipIntroSec"],
      apply(e) {
        if (!S.skipIntroOn) return;
        const t = () => {
          const e = Number(S.skipIntroSec) || 0;
          if (e <= 0) return;
          const t = ie.el();
          t && t.currentTime < e && t.currentTime < 2 && (t.currentTime = e);
        };
        (t(), e.onNav(() => e.addTimeout(t, 1500)));
      },
      settings(e) {
        e.appendChild(No("Seconds", "skipIntroSec", 0, 300, 1, (e) => e + "s"));
      },
    }));

  const _ivsCache = { vid: null, lines: null };
  const _ivsUI = (function () {
    let _box = null, _input = null, _status = null, _results = null, _timeline = null, _lines = [];
    const _norm = (s) => (s || "").toLowerCase();
    const _fmt = (sec) => {
      sec = Math.max(0, Math.floor(Number(sec) || 0));
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      return h > 0 ? (h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"))
                   : (m + ":" + String(s).padStart(2, "0"));
    };
    const _setStatus = (msg) => { if (_status) _status.textContent = msg; };
    const _setLines = (lines) => {
      _lines = lines || [];
      _renderTimeline("");
      _renderResults("");
    };
    const _renderTimeline = (q) => {
      if (!_timeline) return;
      _timeline.innerHTML = "";
      if (!_lines.length) return;
      const dur = (() => {
        const e = ie.el();
        return e && isFinite(e.duration) ? e.duration : (_lines[_lines.length - 1].end || 0);
      })();
      if (!dur || dur <= 0) return;
      const needle = _norm(q);
      const markerFrag = document.createDocumentFragment();
      for (const ln of _lines) {
        if (needle && _norm(ln.text).indexOf(needle) < 0) continue;
        const left = (ln.start / dur) * 100;
        const w = Math.max(0.18, ((ln.end - ln.start) / dur) * 100);
        const m = document.createElement("div");
        m.className = "ytp-ivs-mark";
        m.title = _fmt(ln.start) + " - " + ln.text.slice(0, 80);
        m.style.cssText = "position:absolute;top:0;bottom:0;left:" + left.toFixed(2) + "%;width:" + w.toFixed(2) + "%;background:rgba(255,61,127,.7);border-radius:1px;cursor:pointer;transition:background .12s, transform .12s";
        m.addEventListener("click", () => {
          try {
            const e = ie.el();
            if (e) e.currentTime = ln.start;
          } catch (e) {}
        });
        m.addEventListener("mouseenter", () => { m.style.background = "rgba(255,61,127,1)"; m.style.transform = "scaleY(1.3)"; });
        m.addEventListener("mouseleave", () => { m.style.background = "rgba(255,61,127,.7)"; m.style.transform = "scaleY(1)"; });
        markerFrag.appendChild(m);
      }
      _timeline.appendChild(markerFrag);
    };
    const _renderResults = (q) => {
      if (!_results) return;
      _results.innerHTML = "";
      const needle = _norm(q);
      if (!needle) {
        const hint = document.createElement("div");
        hint.className = "ytp-ivs-hint";
        hint.textContent = "Type to search the captions.";
        _results.appendChild(hint);
        return;
      }
      const matches = [];
      for (let i = 0; i < _lines.length; i++) {
        const ln = _lines[i];
        const idx = _norm(ln.text).indexOf(needle);
        if (idx < 0) continue;
        matches.push({ i: i, ln: ln, idx: idx });
      }
      if (!matches.length) {
        const empty = document.createElement("div");
        empty.className = "ytp-ivs-hint";
        empty.textContent = "No matches for \"" + q + "\".";
        _results.appendChild(empty);
        return;
      }
      const cap = 50;
      for (let k = 0; k < Math.min(matches.length, cap); k++) {
        const m = matches[k];
        const ln = m.ln;
        const row = document.createElement("div");
        row.className = "ytp-ivs-row";
        const ts = document.createElement("span");
        ts.className = "ytp-ivs-time";
        ts.textContent = _fmt(ln.start);
        ts.addEventListener("click", () => {
          try {
            const e = ie.el();
            if (e) e.currentTime = ln.start;
          } catch (e) {}
        });
        const txt = document.createElement("span");
        txt.className = "ytp-ivs-text";
        const before = ln.text.slice(0, m.idx);
        const hit = ln.text.slice(m.idx, m.idx + q.length);
        const after = ln.text.slice(m.idx + q.length);
        txt.appendChild(document.createTextNode(before));
        const hl = document.createElement("span");
        hl.className = "ytp-ivs-hl";
        hl.textContent = hit;
        txt.appendChild(hl);
        txt.appendChild(document.createTextNode(after));
        row.appendChild(ts);
        row.appendChild(txt);
        row.addEventListener("click", () => {
          try {
            const e = ie.el();
            if (e) e.currentTime = ln.start;
          } catch (e) {}
        });
        _results.appendChild(row);
      }
      if (matches.length > cap) {
        const more = document.createElement("div");
        more.className = "ytp-ivs-hint";
        more.textContent = "+ " + (matches.length - cap) + " more matches not shown";
        _results.appendChild(more);
      }
    };
    const _ensure = () => {
      if (_box) return _box;
      const b = document.createElement("div");
      b.id = "ytp-ivs";
      b.setAttribute("role", "dialog");
      b.setAttribute("aria-label", "In-video search");
      b.style.cssText = "position:fixed;top:80px;right:24px;width:min(440px,calc(100vw - 48px));max-height:min(560px,calc(100vh - 120px));z-index:2147483641;display:none;flex-direction:column;background:rgba(20,22,28,.7);border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.6),0 8px 24px rgba(0,0,0,.4);backdrop-filter:blur(24px) saturate(170%);-webkit-backdrop-filter:blur(24px) saturate(170%);color:#fff;font:13px/1.45 system-ui,sans-serif;overflow:hidden;animation:ytpIvsIn .18s ease-out";
      const hdr = document.createElement("div");
      hdr.className = "ytp-ivs-hdr";
      const t = document.createElement("div");
      t.className = "ytp-ivs-title";
      t.textContent = "In-video search";
      const close = document.createElement("button");
      close.type = "button";
      close.className = "ytp-ivs-close";
      close.textContent = "x";
      close.addEventListener("click", () => { b.style.display = "none"; });
      hdr.appendChild(t);
      hdr.appendChild(close);
      const input = document.createElement("input");
      input.type = "search";
      input.placeholder = "Search captions...";
      input.className = "ytp-ivs-input";
      input.addEventListener("input", () => {
        const q = input.value || "";
        _renderTimeline(q);
        _renderResults(q);
      });
      const status = document.createElement("div");
      status.className = "ytp-ivs-status";
      const timeline = document.createElement("div");
      timeline.className = "ytp-ivs-timeline";
      const results = document.createElement("div");
      results.className = "ytp-ivs-results";
      b.appendChild(hdr);
      b.appendChild(input);
      b.appendChild(status);
      b.appendChild(timeline);
      b.appendChild(results);
      document.body.appendChild(b);
      _box = b; _input = input; _status = status; _timeline = timeline; _results = results;
      return b;
    };
    const _isOpen = () => !!_box && _box.style.display !== "none";
    const _show = () => { _ensure(); _box.style.display = "flex"; };
    const _hide = () => { if (_box) _box.style.display = "none"; };
    const _setQuery = (q) => { if (_input) { _input.value = q; _input.dispatchEvent(new Event("input")); } };
    return {
      ensure: _ensure, setStatus: _setStatus, setLines: _setLines,
      show: _show, hide: _hide, isOpen: _isOpen, setQuery: _setQuery,
      get input() { return _input; },
    };
  })();

    const Ma = {
    manualOffForVid: null,
    lastEngagedVid: null,
    lastTrackVid: null,
    lastEngageT: 0,
    awaitingResume: !1,
    awaitingResumeVid: null,
    awaitingResumeSince: 0,
    lastVerifyFix: 0,
  };
  function La() {
    if (!S.forceCC) return !1;
    if (
      S.ccSkipMusic &&
      (function () {
        try {
          if (/(^|\.)music\.youtube\.com$/i.test(location.hostname)) return !0;
          const t = e.ytInitialPlayerResponse,
            a =
              t &&
              t.microformat &&
              t.microformat.playerMicroformatRenderer &&
              t.microformat.playerMicroformatRenderer.category;
          if ("string" == typeof a && /music/i.test(a)) return !0;
        } catch (e) {}
        return !1;
      })()
    )
      return !1;
    if (S.ccSkipShorts && /^\/shorts\//i.test(location.pathname)) return !1;
    const t = ie.videoId();
    return !S.ccRespectManualOff || !t || Ma.manualOffForVid !== t;
  }
  function Aa() {
    if (!S.forceCC || !S.ccNativePrefs) return;
    const e = ie.api();
    if (e) {
      try {
        e.loadModule && e.loadModule("captions");
      } catch (e) {}
      try {
        if (e.setOption) {
          e.setOption(
            "captions",
            "fontSize",
            (function (e) {
              const t = Number(e) || 28;
              return t <= 18
                ? -2
                : t <= 23
                  ? -1
                  : t <= 30
                    ? 0
                    : t <= 38
                      ? 1
                      : t <= 48
                        ? 2
                        : 3;
            })(S.ccFontSize),
          );
          e.setOption(
            "captions",
            "fontFamily",
            S.ccFontFamily || "Roboto, Arial, sans-serif",
          );
          e.setOption("captions", "fontColor", S.ccTextColor || "#ffffff");
          e.setOption("captions", "bgColor", S.ccBgColor || "#000000");
          e.setOption(
            "captions",
            "bgOpacity",
            Math.max(0, Math.min(100, Number(S.ccBgOpacity) || 0)) / 100,
          );
          e.setOption(
            "captions",
            "edgeStyle",
            S.ccTextShadow === "none"
              ? 0
              : S.ccTextShadow === "soft"
                ? 1
                : S.ccTextShadow === "heavy"
                  ? 2
                  : 4,
          );
        }
      } catch (e) {}
    }
  }
  function Ea() {
    if (!La()) return !1;
    const t = ie.api();
    if (!t || "function" != typeof t.setOption) return !1;
    const a = (function () {
        try {
          const e = ie.api();
          if (e && "function" == typeof e.getOption) {
            const t = e.getOption("captions", "tracklist", { includeAsr: !0 });
            if (Array.isArray(t) && t.length) return t;
          }
        } catch (e) {}
        try {
          const t = e.ytInitialPlayerResponse,
            a = t && t.captions && t.captions.playerCaptionsTracklistRenderer;
          if (a && Array.isArray(a.captionTracks)) return a.captionTracks;
        } catch (e) {}
        return [];
      })(),
      n = (function (e) {
        if (!e || !e.length) return null;
        const t = [
          S.forceCCLang,
          ...((a = S.ccFallbackLangs),
          String(a || "")
            .split(/[,\s]+/)
            .map((e) => e.trim())
            .filter(Boolean)),
        ]
          .map((e) => String(e || "").trim())
          .filter(Boolean);
        var a;
        const n = String(S.ccKindPref || "any"),
          r = (e) => "asr" === e.kind || /\.asr$/i.test(e.vssId || ""),
          o = (e) => "any" === n || ("human" === n ? !r(e) : r(e)),
          i = (e) => String(e || "").toLowerCase();
        for (const a of t) {
          const t = i(a),
            n = e.find((e) => i(e.languageCode) === t && o(e));
          if (n) return n;
        }
        for (const a of t) {
          const t = i(a).split("-")[0],
            n = e.find((e) => i(e.languageCode).split("-")[0] === t && o(e));
          if (n) return n;
        }
        for (const a of t) {
          const t = i(a),
            n = e.find((e) => i(e.languageCode) === t);
          if (n) return n;
        }
        for (const a of t) {
          const t = i(a).split("-")[0],
            n = e.find((e) => i(e.languageCode).split("-")[0] === t);
          if (n) return n;
        }
        return t.length ? null : e.find((e) => !r(e)) || e[0];
      })(a);
    try {
      if (n && n.languageCode) {
        const e = { languageCode: n.languageCode };
        return (
          n.languageName &&
            n.languageName.simpleText &&
            (e.languageName = n.languageName.simpleText),
          n.kind && (e.kind = n.kind),
          n.vssId && (e.vssId = n.vssId),
          t.setOption("captions", "track", e),
          (Ma.lastTrackVid = ie.videoId()),
          !0
        );
      }
      if (S.ccAutoTranslate && S.ccTranslateTo && a.length) {
        const e = a.find((e) => !1 !== e.isTranslatable) || a[0];
        if (e && e.languageCode)
          return (
            t.setOption("captions", "track", {
              languageCode: e.languageCode,
              translationLanguage: { languageCode: S.ccTranslateTo },
              vssId: e.vssId || void 0,
            }),
            (Ma.lastTrackVid = ie.videoId()),
            !0
          );
      }
      if (!S.forceCCLang && a.length)
        return (
          t.setOption("captions", "track", { languageCode: a[0].languageCode }),
          (Ma.lastTrackVid = ie.videoId()),
          !0
        );
    } catch (e) {}
    return !1;
  }
  function Cc_state() {
    if (!S.forceCC) return { enabled: !1, displayed: !1, reason: "off" };
    if (!La()) return { enabled: !1, displayed: !1, reason: "skipped" };
    const t = ie.api();
    if (!t) return { enabled: !1, displayed: !1, reason: "no_api" };
    let a = null;
    try {
      a = "function" == typeof t.getOption
        ? t.getOption("captions", "track")
        : null;
    } catch (e) {
      a = null;
    }
    const n = !!a && a.languageCode;
    const r = document.querySelector(".ytp-subtitles-button");
    const o = r && "true" === r.getAttribute("aria-pressed");
    const i = document.querySelector(
      ".ytp-caption-window-container,.ytp-caption-window",
    );
    const d = !!i && i.offsetParent !== null && i.getBoundingClientRect().width > 0;
    let l = !1;
    if (i) {
      const e = i.querySelectorAll(".ytp-caption-segment,.caption-visual-line");
      l = Array.from(e).some((e) => (e.textContent || "").trim().length > 0);
    }
    return {
      enabled: n || o,
      displayed: d && l,
      track: a ? a.languageCode : null,
      buttonPressed: !!o,
      reason: !n && !o ? "no_track" : d && l ? "ok" : "track_no_render",
    };
  }
  function Cc_apply() {
    if (!S.forceCC || !La()) return;
    const t = Cc_state();
    if (!t.enabled) {
      try {
        Ea();
      } catch (e) {}
      try {
        Aa();
      } catch (e) {}
      const a = ie.api();
      if (a && "function" == typeof a.toggleSubtitlesOn) {
        try {
          a.toggleSubtitlesOn();
        } catch (e) {}
      } else {
        const t = document.querySelector(".ytp-subtitles-button");
        if (t && "false" === t.getAttribute("aria-pressed")) {
          try {
            t.click();
          } catch (e) {}
        }
      }
    }
    if (S.ccNativePrefs) {
      try {
        Aa();
      } catch (e) {}
    }
    const n = ie.el();
    if (n) {
      const t = "function" == typeof n.querySelector
        ? n.querySelectorAll(
            ".ytp-caption-window-container,.ytp-caption-window",
          )
        : [];
      t.forEach((e) => {
        "function" == typeof e.dispatchEvent &&
          e.dispatchEvent(new Event("ytp-caption-window-changed"));
      });
    }
  }
  function Ba(e) {
    const t = {};
    e && (t[""] = "Player default (auto)");
    try {
      const e = void 0 !== cn && Array.isArray(cn) ? cn : [],
        a = [],
        n = [];
      for (const [t, r] of e)
        /^en(\b|-)/i.test(t) ? a.push([t, r]) : n.push([t, r]);
      n.sort((e, t) => e[1].localeCompare(t[1]));
      for (const [e, r] of a.concat(n)) t[e] = r + "  (" + e + ")";
    } catch (e) {}
    return t;
  }
  function Pa() {
    const e = ie.el();
    e
      ? document.pictureInPictureElement
        ? (document.exitPictureInPicture().catch(() => {}),
          pe("Closed the pop-out window.", 1500, "info"))
        : e
            .requestPictureInPicture()
            .then(() => pe("Video popped out.", 1500, "success"))
            .catch(() => pe("Couldn’t pop the video out.", 1500, "error"))
      : pe("No video", 1500, "error");
  }
  function Ia() {
    const e = ie.el();
    if (e && e.videoWidth)
      try {
        const t = Math.max(0.25, Math.min(4, Number(S.screenshotScale) || 1)),
          a = document.createElement("canvas");
        ((a.width = Math.round(e.videoWidth * t)),
          (a.height = Math.round(e.videoHeight * t)),
          a.getContext("2d").drawImage(e, 0, 0, a.width, a.height));
        const n = "jpg" === S.screenshotFmt,
          r = n ? "jpg" : "png",
          o = n ? "image/jpeg" : "image/png",
          i = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
        const doDownload = () => {
          try {
            const d = document.createElement("a");
            ((d.href = a.toDataURL(o, 0.95)),
              (d.download = "ytplus-" + i + "." + r),
              document.body.appendChild(d),
              d.click(),
              d.remove(),
              pe("Saved " + a.width + "x" + a.height, 1800, "success"));
          } catch (e2) {
            pe("Can’t take a screenshot of this video.", 1800, "error");
          }
        };

        if (
          S.screenshotClipboard &&
          "undefined" != typeof ClipboardItem &&
          navigator.clipboard &&
          "function" == typeof navigator.clipboard.write
        ) {
          try {
            const blobP = new Promise((res, rej) =>
              a.toBlob((b) => (b ? res(b) : rej(new Error("empty blob"))), o, 0.95),
            );
            navigator.clipboard
              .write([new ClipboardItem({ [o]: blobP })])
              .then(
                () => pe("Screenshot copied to clipboard", 1800, "success"),
                () => {
                  pe("Clipboard write failed - downloading instead", 2000, "error");
                  doDownload();
                },
              );
          } catch (e) {
            pe("Clipboard unavailable - downloading instead", 1800, "error");
            doDownload();
          }
          return;
        }
        doDownload();
      } catch (e) {
        pe("Can’t take a screenshot of this video.", 1800, "error");
      }
    else pe("No video", 1500, "error");
  }
  (xa.register({
    id: "force-cc",
    name: "Always Turn On Captions",
    summary:
      "Turn captions on for every video, with a language picker, fallbacks, and full control over how they look.",
    masterKey: "forceCC",
    keys: [
      "forceCC",
      "forceCCLang",
      "ccNativePrefs",
      "ccFontSize",
      "ccFontFamily",
      "ccFontWeight",
      "ccTextColor",
      "ccBgColor",
      "ccBgOpacity",
      "ccTextShadow",
      "ccLineHeight",
      "ccBottomOffset",
      "ccUppercase",
      "ccRadius",
      "ccLetterSpacing",
      "ccFallbackLangs",
      "ccKindPref",
      "ccAutoTranslate",
      "ccTranslateTo",
      "ccSkipMusic",
      "ccSkipShorts",
      "ccRespectManualOff",
      "ccReEngageOnPlay",
    ],
    apply(e) {
      if (!S.forceCC) return;
      e.addStyle(
        (function () {
          const e = (function (e) {
              const t = String(e || "")
                .trim()
                .match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
              if (!t) return [0, 0, 0];
              let h = t[1];
              if (h.length === 3)
                h = h
                  .split("")
                  .map((c) => c + c)
                  .join("");
              const a = parseInt(h, 16);
              return [(a >> 16) & 255, (a >> 8) & 255, 255 & a];
            })(S.ccBgColor),
            t = Math.max(0, Math.min(100, Number(S.ccBgOpacity) || 0)) / 100,
            a = Math.max(10, Math.min(96, Number(S.ccFontSize) || 28)),
            n = Math.max(-20, Math.min(40, Number(S.ccBottomOffset) || 0)),
            r = Math.max(0, Math.min(30, Number(S.ccRadius) || 0)),
            o = String(S.ccFontFamily || "Roboto, Arial, sans-serif").replace(
              /[;{}<>]/g,
              "",
            ),
            i = String(S.ccFontWeight || "700").replace(/[^0-9a-zA-Z -]/g, ""),
            d = Math.max(0.8, Math.min(2.5, Number(S.ccLineHeight) || 1.25)),
            c =
              Math.max(-10, Math.min(40, Number(S.ccLetterSpacing) || 0)) / 100,
            s = S.ccUppercase ? "uppercase" : "none",
            l = String(S.ccTextShadow || "outline"),
            p =
              "none" === l
                ? "none"
                : "soft" === l
                  ? "0 2px 6px rgba(0,0,0,.85)"
                  : "heavy" === l
                    ? "0 0 3px #000,0 0 5px #000,0 2px 4px #000"
                    : "-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000,0 2px 3px #000";
          return [
            ".ytp-caption-window-container{bottom:" + n + "%!important}",
            ".ytp-caption-segment{font-size:" +
              a +
              "px!important;font-family:" +
              o +
              "!important;font-weight:" +
              i +
              "!important;color:" +

              (function () {
                const m = String(S.ccTextColor || "")
                  .trim()
                  .match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
                if (!m) return "#ffffff";
                let h = m[1];
                if (h.length === 3)
                  h = h
                    .split("")
                    .map((c) => c + c)
                    .join("");
                return "#" + h.toLowerCase();
              })() +
              "!important;line-height:" +
              d +
              "!important;letter-spacing:" +
              c.toFixed(2) +
              "em!important;text-transform:" +
              s +
              "!important;text-shadow:" +
              p +
              "!important;background:rgba(" +
              e[0] +
              "," +
              e[1] +
              "," +
              e[2] +
              "," +
              t +
              ")!important;border-radius:" +
              r +
              "px!important;padding:.08em .28em!important;box-decoration-break:clone!important;-webkit-box-decoration-break:clone!important}",
            ".caption-window{font-size:" +
              a +
              "px!important;font-family:" +
              o +
              "!important;line-height:" +
              d +
              "!important}",
            ".caption-visual-line{margin:.08em 0!important}",
          ].join("\n");
        })(),
      );
      const t = ie.videoId();
      t &&
        Ma.lastEngagedVid !== t &&
        Ma.manualOffForVid &&
        Ma.manualOffForVid !== t &&
        (Ma.manualOffForVid = null);
      const a = () => {
          !(function () {
            if (!La()) return !1;
            const e =
              "undefined" != typeof performance && performance.now
                ? performance.now()
                : Date.now();
            if (e - Ma.lastEngageT < 150) return !1;
            Ma.lastEngageT = e;
            const t = ie.api();
            try {
              t && t.loadModule && t.loadModule("captions");
            } catch (e) {}
            let a = !1;
            try {
              t &&
                "function" == typeof t.toggleSubtitlesOn &&
                (t.toggleSubtitlesOn(), (a = !0));
            } catch (e) {}
            const n = ca(".ytp-subtitles-button", 800);
            if (!a && n && "false" === n.getAttribute("aria-pressed"))
              try {
                (n.click(), (a = !0));
              } catch (e) {}
            (Ea(),
              Aa(),
              (() => {
                try {
                  t &&
                    "function" == typeof t.toggleSubtitlesOn &&
                    t.toggleSubtitlesOn();
                } catch (e) {}
              })(),
              (a || (n && "true" === n.getAttribute("aria-pressed"))) &&
                (Ma.lastEngagedVid = ie.videoId()));
          })();
        },
        n = () => {
          (Ea(), Aa());
        };
      (a(), n());
      const r = () => {
        const t = ie.el();
        t &&
          (e.addListener(t, "loadedmetadata", a),
          e.addListener(t, "loadeddata", a),
          e.addListener(t, "playing", () => {
            S.ccReEngageOnPlay && setTimeout(a, 400);
          }));
        const n = ie.api();
        n && e.addListener(n, "onStateChange", a);
      };
      r();
      const o = () => {
        const t = ca(".ytp-subtitles-button", 800);
        t &&
          !t.__ytpCcWatched &&
          ((t.__ytpCcWatched = !0),
          e.addListener(t, "click", () => {
            setTimeout(() => {
              const e = "true" === t.getAttribute("aria-pressed"),
                a = ie.videoId();
              !e && a && S.ccRespectManualOff
                ? (Ma.manualOffForVid = a)
                : e && (Ma.manualOffForVid = null);
            }, 150);
          }),
          e.addObserver(
            t,
            () => {
              "false" === t.getAttribute("aria-pressed") &&
                e.addTimeout(() => {
                  "false" === t.getAttribute("aria-pressed") && La() && a();
                }, 350);
            },
            { attributes: !0, attributeFilter: ["aria-pressed"] },
          ));
      };
      (o(),
        So("cfg.changed", ({ key }) => {
          if (key && (key.startsWith("cc") || key.startsWith("forceCC"))) {
            try {
              Ea();
            } catch (e) {}
            try {
              Aa();
            } catch (e) {}
            try {
              a();
            } catch (e) {}
            try {
              Cc_apply();
            } catch (e) {}
            try {
              e.addStyle(
                (function () {
                  const e = (function (e) {
                      const t = String(e || "")
                        .trim()
                        .match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
                      if (!t) return [0, 0, 0];
                      let h = t[1];
                      if (h.length === 3)
                        h = h.split("").map((c) => c + c).join("");
                      const a = parseInt(h, 16);
                      return [(a >> 16) & 255, (a >> 8) & 255, 255 & a];
                    })(S.ccBgColor),
                    t = Math.max(0, Math.min(100, Number(S.ccBgOpacity) || 0)) / 100,
                    a = Math.max(10, Math.min(96, Number(S.ccFontSize) || 28)),
                    n = Math.max(-20, Math.min(40, Number(S.ccBottomOffset) || 0)),
                    r = Math.max(0, Math.min(30, Number(S.ccRadius) || 0)),
                    o = String(S.ccFontFamily || "Roboto, Arial, sans-serif").replace(
                      /[;{}<>]/g,
                      "",
                    ),
                    i = String(S.ccFontWeight || "700").replace(/[^0-9a-zA-Z -]/g, ""),
                    d = Math.max(0.8, Math.min(2.5, Number(S.ccLineHeight) || 1.25)),
                    c = Math.max(-10, Math.min(40, Number(S.ccLetterSpacing) || 0)) / 100,
                    s = S.ccUppercase ? "uppercase" : "none",
                    l = String(S.ccTextShadow || "outline"),
                    p =
                      "none" === l
                        ? "none"
                        : "soft" === l
                          ? "0 2px 6px rgba(0,0,0,.85)"
                          : "heavy" === l
                            ? "0 0 3px #000,0 0 5px #000,0 2px 4px #000"
                            : "-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000,0 2px 3px #000";
                  return [
                    ".ytp-caption-window-container{bottom:" + n + "%!important}",
                    ".ytp-caption-segment{font-size:" +
                      a +
                      "px!important;font-family:" +
                      o +
                      "!important;font-weight:" +
                      i +
                      "!important;color:" +

                      (function () {
                        const m = String(S.ccTextColor || "")
                          .trim()
                          .match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
                        if (!m) return "#ffffff";
                        let h = m[1];
                        if (h.length === 3)
                          h = h
                            .split("")
                            .map((c) => c + c)
                            .join("");
                        return "#" + h.toLowerCase();
                      })() +
                      "!important;line-height:" +
                      d +
                      "!important;letter-spacing:" +
                      c.toFixed(2) +
                      "em!important;text-transform:" +
                      s +
                      "!important;text-shadow:" +
                      p +
                      "!important;background:rgba(" +
                      e[0] +
                      "," +
                      e[1] +
                      "," +
                      e[2] +
                      "," +
                      t +
                      ")!important;border-radius:" +
                      r +
                      "px!important;padding:.08em .28em!important;box-decoration-break:clone!important;-webkit-box-decoration-break:clone!important}",
                    ".caption-window{font-size:" +
                      a +
                      "px!important;font-family:" +
                      o +
                      "!important;line-height:" +
                      d +
                      "!important}",
                    ".caption-visual-line{margin:.08em 0!important}",
                  ].join("\n");
                })(),
              );
            } catch (e) {}
          }
        }),
        e.addInterval(() => {
          if (!S.forceCC) return;
          try {
            const t = Cc_state();
            if (t.enabled && !t.displayed && Date.now() - (Ma.lastVerifyFix || 0) > 4e3) {
              Ma.lastVerifyFix = Date.now();
              try {
                Ea();
              } catch (e) {}
              try {
                Aa();
              } catch (e) {}
              try {
                a();
              } catch (e) {}
            }
          } catch (e) {}
        }, 2e3),
        e.onNav(() => {
          (ie.videoId() !== Ma.lastEngagedVid && (Ma.manualOffForVid = null),
            e.addTimeout(() => {
              (r(), o(), a(), n());
            }, 300),
            e.addTimeout(a, 400),
            e.addTimeout(a, 900),
            e.addTimeout(a, 1800),
            e.addTimeout(a, 3e3),
            e.addTimeout(a, 5e3),
            e.addTimeout(n, 600),
            e.addTimeout(n, 1500));
        }));
    },
    settings(e) {
      (e.appendChild(Ro("Preferred language", "forceCCLang", Ba(!0))),
        e.appendChild(
          _o("Fallback languages (comma-separated)", "ccFallbackLangs"),
        ),
        e.appendChild(
          Ro("Prefer", "ccKindPref", {
            any: "Any caption track",
            human: "Human-written (skip auto-generated)",
            asr: "Auto-generated only",
          }),
        ),
        e.appendChild(
          Io(
            "Auto-translate when no preferred track is found",
            "ccAutoTranslate",
          ),
        ),
        e.appendChild(Ro("Translate captions to", "ccTranslateTo", Ba(!0))),
        e.appendChild(
          Io(
            "Don't force captions on YouTube Music / music videos",
            "ccSkipMusic",
          ),
        ),
        e.appendChild(Io("Don't force captions on Shorts", "ccSkipShorts")),
        e.appendChild(
          Io(
            "If I turn captions off, leave them off until the next video",
            "ccRespectManualOff",
          ),
        ),
        e.appendChild(
          Io(
            "Re-enable captions when playback resumes after an ad",
            "ccReEngageOnPlay",
          ),
        ),
        e.appendChild(
          Io(
            "Also apply YouTube's built-in caption font size",
            "ccNativePrefs",
          ),
        ),
        e.appendChild(
          No("Font size", "ccFontSize", 10, 72, 1, (e) => e + "px"),
        ),
        e.appendChild(Yp_fontRow("Font family (with preview)", "ccFontFamily")),
        e.appendChild(
          Ro("Font weight", "ccFontWeight", {
            400: "Regular",
            500: "Medium",
            600: "Semi-bold",
            700: "Bold",
            800: "Extra-bold",
            900: "Black",
          }),
        ),
        e.appendChild(Xp("Text color", "ccTextColor")),
        e.appendChild(Xp("Background color", "ccBgColor")),
        e.appendChild(
          No("Background opacity", "ccBgOpacity", 0, 100, 1, (e) => e + "%"),
        ),
        e.appendChild(
          Ro("Text shadow", "ccTextShadow", {
            outline: "Outline",
            soft: "Soft",
            heavy: "Heavy",
            none: "None",
          }),
        ),
        e.appendChild(
          No("Line height", "ccLineHeight", 0.8, 2.2, 0.05, (e) =>
            Number(e).toFixed(2),
          ),
        ),
        e.appendChild(
          No(
            "Letter spacing",
            "ccLetterSpacing",
            -10,
            40,
            1,
            (e) => (Number(e) / 100).toFixed(2) + "em",
          ),
        ),
        e.appendChild(
          No("Bottom offset", "ccBottomOffset", -10, 30, 1, (e) => e + "%"),
        ),
        e.appendChild(
          No("Background radius", "ccRadius", 0, 24, 1, (e) => e + "px"),
        ),
        e.appendChild(Io("Uppercase captions", "ccUppercase")));
    },
  }),
    xa.register({
      id: "autoskip-ad-btn",
      name: "Skip Ads Automatically",
      summary: "Clicks the Skip Ad button as soon as it shows up.",
      masterKey: "autoSkipAdBtn",
      keys: ["autoSkipAdBtn"],
      apply(e) {
        if (!S.autoSkipAdBtn) return;
        const t = () => {
            if (!ie.isAd()) return !1;
            const e = document.querySelector(
              ".ytp-ad-skip-button,.ytp-skip-ad-button,.ytp-ad-skip-button-modern",
            );
            if (e)
              try {
                return (e.click(), !0);
              } catch (e) {}
            return !1;
          },
          a = () => {
            const a = document.querySelector("#movie_player");
            a &&
              e.addObserver(a, ee(t, 200), {
                attributes: !0,
                attributeFilter: ["class"],
              });
          };
        (a(), e.onNav(() => e.addTimeout(a, 1e3)));
      },
      settings() {},
    }),
    xa.register({
      id: "ad-mute",
      name: "Mute Ads",
      summary: "Mute the sound during ads.",
      masterKey: "adMute",
      keys: ["adMute"],
      apply(e) {
        if (!S.adMute) {
          const e = ie.el();
          return void (
            e &&
            null != e.__ytpAdMuteSaved &&
            ((e.muted = e.__ytpAdMuteSaved), delete e.__ytpAdMuteSaved)
          );
        }
        const t = () => {
            const e = ie.el();
            e &&
              (ie.isAd()
                ? null == e.__ytpAdMuteSaved &&
                  ((e.__ytpAdMuteSaved = e.muted), (e.muted = !0))
                : null != e.__ytpAdMuteSaved &&
                  ((e.muted = e.__ytpAdMuteSaved), delete e.__ytpAdMuteSaved));
          },
          a = () => {
            const a = ie.api();
            a &&
              e.addObserver(a, t, {
                attributes: !0,
                attributeFilter: ["class"],
              });
          };
        (a(),
          e.onNav(() => e.addTimeout(a, 1500)),
          e.addInterval(t, 2e3, { pauseWhenHidden: !1 }),
          Yt["ad-mute"].push(() => {
            const e = ie.el();
            e &&
              null != e.__ytpAdMuteSaved &&
              ((e.muted = e.__ytpAdMuteSaved), delete e.__ytpAdMuteSaved);
          }));
      },
      settings() {},
    }),
    xa.register({
      id: "ad-speed",
      name: "Speed Through Ads",
      summary:
        "Fast-forwards unskippable ads at 16× speed so they finish quickly.",
      masterKey: "adSpeed",
      keys: ["adSpeed"],
      apply(e) {
        if (!S.adSpeed) {
          const e = ie.el();
          return void (
            e &&
            null != e.__ytpAdSpeedSaved &&
            ((e.playbackRate = e.__ytpAdSpeedSaved), delete e.__ytpAdSpeedSaved)
          );
        }
        const t = () => {
            const e = ie.el();
            e &&
              (ie.isAd()
                ? (null == e.__ytpAdSpeedSaved &&
                    (e.__ytpAdSpeedSaved = e.playbackRate),
                  16 !== e.playbackRate && (e.playbackRate = 16),
                  isFinite(e.duration) &&
                    e.duration > 0 &&
                    e.currentTime < e.duration - 0.5 &&
                    (e.currentTime = e.duration - 0.3))
                : null != e.__ytpAdSpeedSaved &&
                  ((e.playbackRate = e.__ytpAdSpeedSaved),
                  delete e.__ytpAdSpeedSaved));
          },
          a = () => {
            const a = ie.api();
            if (!a) return;
            e.addObserver(a, t, { attributes: !0, attributeFilter: ["class"] });
            const n = ie.el();
            n && e.addListener(n, "timeupdate", t);
          };
        (a(),
          e.onNav(() => e.addTimeout(a, 1500)),
          Yt["ad-speed"].push(() => {
            const e = ie.el();
            e &&
              null != e.__ytpAdSpeedSaved &&
              ((e.playbackRate = e.__ytpAdSpeedSaved),
              delete e.__ytpAdSpeedSaved);
          }));
      },
      settings() {},
    }),
    xa.register({
      id: "sponsorblock",
      name: "SponsorBlock",
      summary:
        "Skips sponsored sections, intros, outros, and other clutter using the community SponsorBlock database. Choose which kinds to skip and which to keep.",
      masterKey: "sponsorblockOn",
      keys: [
        "sponsorblockOn",
        "sbServer",
        "sbServerPreset",
        "sbPrivacy",
        "sbToast",
        "sbToastDur",
        "sbMinVotes",
        "sbMinViews",
        "sbMaxViews",
        "sbIncludeLocked",
        "sbIncludeHidden",
        "sbIncludeIgnored",
        "sbTrimUUIDs",
        "sbSegOverrides",
        "sbChanOverrides",
        "sbChapterRules",
        "sbUpNextSec",
        "sbColorOverrides",
        "sbHud",
        "sbHudStatus",
        "sbSeekbar",
      ].concat(i.flatMap((e) => ["sb_" + e.id + "_en", "sb_" + e.id + "_act"])),
      apply(e) {
        if ((ft(), !S.sponsorblockOn))
          return (
            clearInterval(nt),
            (nt = 0),
            kt(),
            vt(),
            (tt = []),
            (at = null),
            void wt()
          );
        at = null;
        const t = ie.videoId();
        if (
          (t && St(t),
          e.onNav(() =>
            e.addTimeout(() => {
              const e = ie.videoId();
              e && St(e);
            }, 1200),
          ),
          S.sbSeekbar)
        ) {
          e.addInterval(Ct, 2500);
          const t = ie.el();
          t &&
            (e.addListener(t, "loadedmetadata", Ct),
            e.addListener(t, "durationchange", Ct));
        }
      },
      settings(e) {

        const presetRow = To("div", "ytp-row");
        presetRow.appendChild(To("span", "ytp-lbl", "Server"));
        const presetSel = document.createElement("select");
        presetSel.className = "ytp-sel";
        presetSel.dataset.key = "sbServerPreset";
        Zi.forEach((z) => {
          const opt = document.createElement("option");
          opt.value = z.id;
          opt.textContent = z.name;
          presetSel.appendChild(opt);
        });
        presetSel.value = S.sbServerPreset || "ajay";
        presetSel.addEventListener("change", () =>
          Ta("sbServerPreset", presetSel.value),
        );
        presetRow.appendChild(presetSel);
        e.appendChild(presetRow);
        e.appendChild(_o("Custom server URL (when Server = Custom)", "sbServer"));
        e.appendChild(
          Io("Privacy mode (hide video IDs from database server)", "sbPrivacy"),
        );
        e.appendChild(Io("Skip notifications", "sbToast"));
        e.appendChild(
          No(
            "Notify duration",
            "sbToastDur",
            500,
            6e3,
            100,
            (e2) => (e2 / 1e3).toFixed(1) + "s",
          ),
        );
        e.appendChild(
          No("Minimum votes", "sbMinVotes", 0, 100, 1, (e2) => e2 + " votes"),
        );
        e.appendChild(
          No("Minimum views (0 = no min)", "sbMinViews", 0, 1e6, 10, (e2) =>
            Math.round(e2).toString(),
          ),
        );
        e.appendChild(
          No("Maximum views (0 = no max)", "sbMaxViews", 0, 1e7, 100, (e2) =>
            Math.round(e2).toString(),
          ),
        );
        e.appendChild(Io("Include locked segments", "sbIncludeLocked"));
        e.appendChild(Io("Include hidden segments", "sbIncludeHidden"));
        e.appendChild(Io("Include ignored segments", "sbIncludeIgnored"));
        e.appendChild(Io("Trim UUIDs from response", "sbTrimUUIDs"));
        e.appendChild(Io("Show sponsorship status box on screen", "sbHud"));
        e.appendChild(Io("Show server status in HUD", "sbHudStatus"));
        e.appendChild(
          Io("Show sponsorship sections on the video timeline", "sbSeekbar"),
        );
        e.appendChild(
          No(
            "Up-next preview (seconds, 0 = off)",
            "sbUpNextSec",
            0,
            60,
            1,
            (e2) => e2 + "s",
          ),
        );
        const t = To("div", "ytp-sub");

        i.forEach((e2) => {
          const a = "sb_" + e2.id + "_en",
            n = "sb_" + e2.id + "_act",
            r = To("span", "ytp-cat-dot");
          r.style.background = e2.color;
          const o = To("div", "ytp-row");
          o.appendChild(r);
          o.appendChild(To("span", "ytp-lbl", e2.label));
          o.appendChild(Bo(a));
          o.appendChild(Po(n, Yi));
          const sw = document.createElement("input");
          sw.type = "color";
          sw.className = "ytp-cp-native";
          sw.style.cssText =
            "width:30px;height:28px;padding:0;border:1px solid rgba(255,255,255,.12);border-radius:6px;background:transparent;cursor:pointer";
          try {
            let cur = null;
            try {
              cur =
                S.sbColorOverrides && JSON.parse(S.sbColorOverrides || "{}")[e2.id];
            } catch (e3) {
              cur = null;
            }
            sw.value = /^#[0-9a-fA-F]{6}$/.test(cur || "")
              ? cur
              : /^#[0-9a-fA-F]{6}$/.test(e2.color)
                ? e2.color
                : "#00d400";
          } catch (e3) {
            sw.value = "#00d400";
          }
          sw.addEventListener("input", () => {
            let cur = {};
            try {
              cur = S.sbColorOverrides
                ? JSON.parse(S.sbColorOverrides || "{}")
                : {};
            } catch (e4) {
              cur = {};
            }
            cur[e2.id] = sw.value;
            Ta(
              "sbColorOverrides",
              Object.keys(cur).length ? JSON.stringify(cur) : "",
            );
            Bt_invalidateMarks();
          });
          sw.addEventListener("dblclick", () => {
            let cur = {};
            try {
              cur = JSON.parse(S.sbColorOverrides || "{}");
            } catch (e5) {
              cur = {};
            }
            delete cur[e2.id];
            Ta(
              "sbColorOverrides",
              Object.keys(cur).length ? JSON.stringify(cur) : "",
            );
            sw.value = e2.color;
            Bt_invalidateMarks();
          });
          o.appendChild(sw);
          t.appendChild(o);
        });
        e.appendChild(t);

        e.appendChild(
          Ho(
            "Per-segment overrides (JSON: {uuid: 'skip'|'mute'|'poi'|'disabled'})",
            "sbSegOverrides",
            "Paste a JSON object. UUIDs are in /api/skipSegments response.",
          ),
        );
        e.appendChild(
          Ho(
            "Per-channel overrides (JSON: {channelId: 'skip'|'mute'|'poi'|'disabled'})",
            "sbChanOverrides",
            "Channel IDs are the trailing path segment of /channel/<id> URLs.",
          ),
        );
        e.appendChild(
          Ho(
            "Chapter title regex skip (JSON: {channelId: '/regex/flags'})",
            "sbChapterRules",
            "Chapter title (auto-generated) matching the channel's regex is auto-skipped.",
          ),
        );

        e.appendChild(To("div", "ytp-section-hdr", "This video"));
        const ctrls = To("div", "ytp-rowb");
        ctrls.appendChild(
          Oo(
            "Hide SB on this video",
            () => {
              Bt_hideVideo().then(
                () => g.emit("sb.hidden"),
                (e2) => pe("Hide failed: " + e2.message, 2e3, "error"),
              );
            },
            "ytp-danger",
          ),
        );
        ctrls.appendChild(
          Oo(
            "Un-hide SB on this video",
            () => {
              Bt_unHideVideo().then(
                () => g.emit("sb.hidden"),
                (e2) => pe("Un-hide failed: " + e2.message, 2e3, "error"),
              );
            },
          ),
        );
        ctrls.appendChild(
          Oo(
            "Reload segments",
            () => {
              const vid = ie.videoId();
              if (vid) St(vid);
            },
            "primary",
          ),
        );
        e.appendChild(ctrls);

        if (S.sbSubmitUserId) {
          const statsRow = To("div", "ytp-sbsub-status");
          statsRow.textContent = "Loading SB user stats...";
          e.appendChild(statsRow);
          Bt_getUserInfo().then((info) => {
            if (!info) {
              statsRow.textContent =
                "No SB user stats (userID not registered).";
              return;
            }
            const min = Math.round(info.minutesSaved || 0);
            statsRow.textContent =
              "SB stats: " +
              (info.userName || "(no username)") +
              " - " +
              min +
              " min saved - " +
              (info.segmentCount || 0) +
              " segments";
          });
        } else {
          e.appendChild(
            To(
              "div",
              "ytp-hist-note",
              "Turn on “Submit Sponsorship Segments” to track your own SB stats (time saved, segment count, etc.) on the SB server.",
            ),
          );
        }
      },
    }),
    xa.register({
      id: "session-restore",
      name: "Session History",
      summary:
        "Remembers every video you watch and how far through it you got, so you can pick up where you left off.",
      masterKey: "sessionRestoreOn",
      keys: ["sessionRestoreOn", "sessionResumeMode", "sessionResumeDesign"],
      apply(e) {
        if (!S.sessionRestoreOn) return void Ue();
        (e.onNav(() => {
          (Ke(), e.addTimeout(Ke, 1200));
        }),
          Ke());
        for (const t of [400, 1500, 3e3]) e.addTimeout(Ke, t);
        Yt["session-restore"].push(Ue);
        const t = () => {
            const e = ie.videoId();
            e && Xe(e, { duration: ie.el() ? ie.el().duration : 0 });
          },
          a = ie.el();
        a &&
          (a.addEventListener("ended", t),
          Yt["session-restore"].push(() => {
            try {
              a.removeEventListener("ended", t);
            } catch (e) {}
          }));
      },
      settings(e) {
        e.appendChild(
          Ro("On return to a video", "sessionResumeMode", {
            card: "Small card (bottom)",
            overlay: "Full overlay",
            silent: "Silent Resume",
          }),
        );
        e.appendChild(
          Ro("Resume design", "sessionResumeDesign", {
            default: "Default (balanced)",
            compact: "Compact (small, bottom card)",
            detailed: "Detailed (large, more info)",
            cinema: "Cinema (max glass + glow)",
          }),
        );
        const t = To("div", "ytp-hist-panel");
        (e.appendChild(t),
          (function (e) {
            e.replaceChildren();
            const t = To("div", "ytp-hist-toolbar"),
              a = document.createElement("input");
            ((a.type = "search"),
              (a.className = "ytp-hist-search"),
              (a.placeholder = "Search what you’ve watched…"),
              (a.value = qo.query));
            const r = To("span", "ytp-hist-count", "");
            (t.appendChild(a), t.appendChild(r), e.appendChild(t));
            const o = To("div", "ytp-hist-list");
            e.appendChild(o);
            const i = Oo("Show more", () => {
              ((qo.limit += 30), c());
            });
            (i.classList.add("ytp-hist-loadmore"), e.appendChild(i));
            const d = To("div", "ytp-rowb");
            async function c() {
              o.replaceChildren(To("div", "ytp-hist-loading", "Loading…"));

              _backfillMetadata().catch(() => {});
              const e = (qo.query || "").trim().toLowerCase(),
                t = await Ie(),
                a = e
                  ? t.filter(
                      (t) =>
                        (t.title || "").toLowerCase().includes(e) ||
                        (t.channel || "").toLowerCase().includes(e) ||
                        (t.videoId || "").toLowerCase().includes(e),
                    )
                  : t;
              if (
                ((r.textContent =
                  a.length +
                  (e ? " match" + (1 === a.length ? "" : "es") : " total")),
                o.replaceChildren(),
                !a.length)
              )
                return (
                  o.appendChild(
                    To(
                      "div",
                      "ytp-hist-empty",
                      e ? "No matches." : "No history yet.",
                    ),
                  ),
                  void (i.style.display = "none")
                );
              const n = a.slice(0, qo.limit),
                d = document.createDocumentFragment();
              for (const e of n) d.appendChild(Vo(e, c));
              (o.appendChild(d),
                (i.style.display = a.length > n.length ? "" : "none"));
            }
            (d.appendChild(
              Oo("Export", () =>
                (async function () {
                  const e = await Ie(),
                    t = new Blob(
                      [
                        JSON.stringify(
                          { version: n, ts: Date.now(), history: e },
                          null,
                          2,
                        ),
                      ],
                      { type: "application/json" },
                    ),
                    a = URL.createObjectURL(t),
                    r = document.createElement("a");
                  ((r.href = a),
                    (r.download =
                      "ytplus-history-" +
                      new Date().toISOString().slice(0, 10) +
                      ".json"),
                    document.body.appendChild(r),
                    r.click(),
                    r.remove(),
                    setTimeout(() => URL.revokeObjectURL(a), 6e3),
                    pe(
                      "Saved " + e.length + " entries to a file.",
                      1800,
                      "success",
                    ));
                })(),
              ),
            ),
              d.appendChild(
                Oo("Import", () =>
                  (function (e) {
                    const t = document.createElement("input");
                    ((t.type = "file"),
                      (t.accept = ".json,application/json"),
                      t.addEventListener(
                        "change",
                        () => {
                          const a = t.files && t.files[0];
                          if (!a) return;
                          const n = new FileReader();
                          ((n.onload = (t) => {
                            try {
                              const a = JSON.parse(t.target.result),
                                n = a.history || (Array.isArray(a) ? a : []);
                              Promise.all(
                                n
                                  .filter((e) => e && e.videoId)
                                  .map((e) => Be(e)),
                              ).then(() => {
                                (pe(
                                  "Imported " + n.length + " entries",
                                  1800,
                                  "success",
                                ),
                                  e && e());
                              });
                            } catch (e) {
                              pe("Couldn’t read that file.", 1800, "error");
                            }
                          }),
                            n.readAsText(a));
                        },
                        { once: !0 },
                      ),
                      t.click());
                  })(c),
                ),
              ),
              d.appendChild(
                Oo(
                  "Clear all",
                  () => {
                    Re()
                      .then(() => C("thumbCache"))
                      .then(() => {
                        (pe("History cleared.", 1600, "success"), c());
                      });
                  },
                  "ytp-danger",
                ),
              ),
              e.appendChild(d),
              a.addEventListener(
                "input",
                ee(() => {
                  ((qo.query = a.value), c());
                }, 150),
              ),
              So("history.updated", c),
              c());
          })(t));
      },
    }),
    xa.register({
      id: "timestamp-bookmarks",
      name: "Timestamp Bookmarks",
      summary:
        "Save spots in a video to come back to later. Press B to bookmark the current moment.",
      masterKey: "bookmarksOn",
      keys: ["bookmarksOn"],
      apply() {},
      settings(e) {
        e.appendChild(Eo([Oo("Bookmark now", et, "primary")]));
      },
    }),
    xa.register({
      id: "pip-button",
      name: "Floating Pop-out Window",
      summary:
        "Press P to pop the video out into a small floating window that stays on top while you browse other tabs.",
      masterKey: "pipOn",
      keys: ["pipOn"],
      apply() {},
      settings(e) {
        e.appendChild(Eo([Oo("Toggle PiP now", Pa, "primary")]));
      },
    }),
    xa.register({
      id: "screenshot",
      name: "Screenshot",
      summary:
        "Save the current frame as an image. Press X to grab one instantly.",
      masterKey: "screenshotOn",
      keys: ["screenshotOn", "screenshotFmt", "screenshotScale", "screenshotClipboard"],
      apply() {},
      settings(e) {
        (e.appendChild(
          Ro("Format", "screenshotFmt", { png: "PNG", jpg: "JPEG" }),
        ),
          e.appendChild(
            No("Scale", "screenshotScale", 0.5, 4, 0.5, (e) => e + "x"),
          ),
          e.appendChild(
            Io("Copy to clipboard (no download)", "screenshotClipboard"),
          ),
          e.appendChild(Eo([Oo("Capture now", Ia, "primary")])));
      },
    }),
    xa.register({
      id: "sleep-timer",
      name: "Sleep Timer",
      summary:
        "Pause the video after a set number of minutes - perfect for falling asleep.",
      masterKey: "sleepTimerOn",
      keys: ["sleepTimerOn", "sleepTimerMin"],
      apply(e) {
        if (!S.sleepTimerOn) return;
        const t = Math.max(1, Number(S.sleepTimerMin) || 30);
        e.addTimeout(() => {
          (ie.pause(),
            pe("Time’s up - pausing.", 2e3, "info"),
            Ta("sleepTimerOn", !1));
        }, 6e4 * t);
      },
      settings(e) {
        e.appendChild(
          No("Minutes", "sleepTimerMin", 1, 240, 1, (e) => e + " min"),
        );
      },
    }),
    xa.register({
      id: "force-watched",
      name: "Force Watched (Shift+W)",
      summary:
        "Mark the current video as watched without playing it. Press Shift+W and YouTube records the view straight away. The player won’t restart or rewind.",
      masterKey: "forceWatchedOn",
      keys: [
        "forceWatchedOn",

        "forceWatchedAccountHistory",
        "forceWatchedLocalHistory",
      ],
      apply() {},
      settings(e) {
        e.appendChild(
          Eo([
            Oo("Force watched now", Ut, "primary"),
            Oo("Test (current video)", () => {
              const e = ie.videoId();
              e
                ? (pe("Trying it on " + e + "…", 1200, "info"), Ut())
                : pe("Open a video first.", 1500, "error");
            }),
          ]),
        );

        e.appendChild(
          Io(
            "Mark it in my YouTube history (Account History)",
            "forceWatchedAccountHistory",
          ),
        );
        e.appendChild(
          Io(
            "Also save to YT-zen so it fades out of my feed right away",
            "forceWatchedLocalHistory",
          ),
        );
      },
    }),
    xa.register({
      id: "theater-default",
      name: "Theater Mode Default",
      summary: "Open every video in theater mode so the player fills the page.",
      masterKey: "theaterDefault",
      keys: ["theaterDefault"],
      apply(e) {
        if (!S.theaterDefault) return;
        const t = () => {
          if ("/watch" !== location.pathname) return;
          const e = document.querySelector("ytd-watch-flexy"),
            t = document.querySelector(".ytp-size-button");
          e && !e.hasAttribute("theater") && t && t.click();
        };
        (t(), e.onNav(() => e.addTimeout(t, 1500)), e.addTimeout(t, 1500));
      },
      settings() {},
    }),
    xa.register({
      id: "wide-theater",
      name: "Theater Mode on Wide Screens",
      summary:
        "Switch to theater mode when your window is wider than 1600 pixels.",
      masterKey: "wideTheater",
      keys: ["wideTheater"],
      apply(t) {
        if (!S.wideTheater) return;
        const a = () => {
          if (e.innerWidth > 1600) {
            const e = document.querySelector("ytd-watch-flexy"),
              t = document.querySelector(".ytp-size-button");
            e && !e.hasAttribute("theater") && t && t.click();
          }
        };
        (a(), t.addListener(e, "resize", $(a, 200)), t.addTimeout(a, 1500));
      },
      settings() {},
    }),
    xa.register({
      id: "cinema-mode",
      name: "Cinema Mode",
      summary:
        "Dims everything around the player so the video stands out, like a movie theater.",
      masterKey: "cinemaMode",
      keys: ["cinemaMode", "cinemaOp"],
      apply(e) {
        if (!S.cinemaMode) return;
        const t = document.createElement("div");
        ((t.id = "ytp-cinema"),
          (t.style.cssText =
            "position:fixed;inset:0;z-index:1996;pointer-events:none;background:rgba(0,0,0," +
            S.cinemaOp +
            ")"),
          document.body && document.body.appendChild(t),
          Yt["cinema-mode"].push(() => t.remove()));
      },
      settings(e) {
        e.appendChild(
          No(
            "Opacity",
            "cinemaOp",
            0.1,
            0.95,
            0.05,
            (e) => Math.round(100 * e) + "%",
          ),
        );
      },
    }),
    xa.register({
      id: "ambient-mode",
      name: "Ambient Glow",
      summary:
        "Add a soft colored glow behind the player that matches what’s on screen.",
      hidden: !0,
      masterKey: "ambientMode",
      keys: ["ambientMode", "ambientBlur", "ambientOp"],
      apply(e) {
        if (!S.ambientMode) return;
        const t = document.createElement("canvas");
        ((t.id = "ytp-ambient"),
          (t.style.cssText =
            "position:fixed;z-index:1995;pointer-events:none;width:calc(100% + 100px);height:calc(100% + 100px);top:-50px;left:-50px;object-fit:cover;filter:blur(" +
            S.ambientBlur +
            "px);opacity:" +
            S.ambientOp),
          document.body &&
            document.body.insertBefore(t, document.body.firstChild));
        const a = t.getContext("2d", {
          alpha: !1,
          willReadFrequently: !1,
          desynchronized: !0,
        });
        ((t.width = 48), (t.height = 27));
        let n = 0;
        const r = 1e3 / (Xt.batteryLow ? 2 : Xt.cpuConstrained ? 3 : 5);
        (e.addInterval(
          () => {
            if (_a()) return !1;
            const e = ie.el();
            if (!e || e.paused || e.readyState < 2) return !1;
            const t = performance.now();
            if (t - n < r) return !1;
            n = t;
            try {
              a.drawImage(e, 0, 0, 48, 27);
            } catch (e) {}
            return !0;
          },
          Math.max(160, r),
          { pauseWhenHidden: !0 },
        ),
          Yt["ambient-mode"].push(() => {
            try {
              t.remove();
            } catch (e) {}
          }));
      },
      settings(e) {
        (e.appendChild(No("Blur", "ambientBlur", 0, 80, 1, (e) => e + "px")),
          e.appendChild(
            No(
              "Opacity",
              "ambientOp",
              0.1,
              1,
              0.05,
              (e) => Math.round(100 * e) + "%",
            ),
          ));
      },
    }));
  let Ra = 0,
    Na = !1;
  function _a() {
    const e = performance.now();
    if (e - Ra < 250) return Na;
    Ra = e;
    try {
      const e = document.querySelectorAll("tp-yt-iron-dropdown");
      for (let t = 0; t < e.length; t++) {
        const a = e[t].style;
        if (a && "none" !== a.display && "" !== a.display)
          return ((Na = !0), !0);
        if (e[t].opened || e[t].hasAttribute("opened")) return ((Na = !0), !0);
      }
      const t = document.querySelectorAll(
        "ytd-popup-container tp-yt-paper-dialog, ytd-menu-popup-renderer",
      );
      for (let e = 0; e < t.length; e++)
        if (null !== t[e].offsetParent) return ((Na = !0), !0);
    } catch (e) {}
    return ((Na = !1), !1);
  }
  function Ha(e, t, a, n, r) {
    xa.register({
      id: e,
      name: t,
      summary: a,
      masterKey: n,
      keys: [n],
      apply(e) {
        S[n] && e.addStyle(r);
      },
      settings() {},
    });
  }
  function Cb_norm(e) {
    if (!(e = String(e || "").trim())) return "";
    try {
      if (/^https?:\/\//i.test(e)) {
        const t = new URL(e),
          a = t.pathname.match(/\/@([^/?#]+)/);
        if (a) return "@" + a[1].toLowerCase();
        const n = t.pathname.match(/\/(channel|c|user)\/([^/?#]+)/i);
        if (n) return n[2].toLowerCase();
      }
    } catch (e) {}
    if (
      (e = e
        .replace(/^https?:\/\/(www\.)?youtube\.com\//i, "")
        .replace(/^\//, "")
        .trim()).startsWith("@")
    )
      return "@" + e.slice(1).toLowerCase();
    const t = e.match(/@([A-Za-z0-9._-]+)/);
    return t ? "@" + t[1].toLowerCase() : e.toLowerCase();
  }
  function Cb_parseList() {
    const e = new Set(),
      t = [],
      a = String(S.channelBlockerList || ""),
      n = a.split(/[\n,;|]/),
      r = /\/@\(([^)]+)\)/g;
    let o;
    for (; (o = r.exec(a)); )
      o[1].split("|").forEach((e) => n.push("@" + e.replace(/\\/g, "").trim()));
    for (const a of n) {
      const n = Cb_norm(a);
      n && !e.has(n) && (e.add(n), t.push(n));
    }
    return t;
  }
  function Cb_anchorInfo(e) {
    if (!e) return { handle: "", name: "", href: "" };
    const t = e.href || e.getAttribute("href") || "";
    let a = "";
    try {
      const e = new URL(t, location.href).pathname.match(/\/@([^/?#]+)/);
      e && (a = "@" + e[1].toLowerCase());
    } catch (e) {}
    return {
      handle: a,
      name: (e.title || e.textContent || "").trim(),
      href: t,
    };
  }
  (Ha(
    "compact-ui",
    "Compact UI",
    "Reduce font sizes and padding.",
    "compactUI",
    "ytd-watch-metadata{font-size:13px!important}#title h1{font-size:18px!important}#secondary{font-size:12px!important}",
  ),
    xa.register({
      id: "custom-css",
      name: "Custom Styles",
      summary:
        "Add your own styling rules to customize how any part of YouTube looks.",
      masterKey: "customCSSOn",
      keys: ["customCSSOn", "customCSS"],
      apply(e) {
        S.customCSSOn && S.customCSS && e.addStyle(S.customCSS);
      },
      settings(e) {
        e.appendChild(Ho("Styling rules", "customCSS", "body { }"));
      },
    }),
    xa.register({
      id: "video-filters",
      name: "Video Filters",
      summary:
        "Adjust how the video looks: brightness, contrast, color, mirror, zoom in or out.",
      masterKey: "videoFiltersOn",
      keys: [
        "videoFiltersOn",
        "vfBright",
        "vfContrast",
        "vfSat",
        "vfHue",
        "vfGray",
        "vfFlip",
        "vfZoom",
      ],
      apply(e) {
        if (!S.videoFiltersOn) return;
        const t =
            "brightness(" +
            S.vfBright +
            "%) contrast(" +
            S.vfContrast +
            "%) saturate(" +
            S.vfSat +
            "%) hue-rotate(" +
            S.vfHue +
            "deg)" +
            (S.vfGray ? " grayscale(1)" : ""),
          a =
            "scale(" +
            (S.vfZoom / 100).toFixed(3) +
            ")" +
            (S.vfFlip ? " scaleX(-1)" : "");
        e.addStyle(
          "video.html5-main-video,#movie_player video{filter:" +
            t +
            "!important;transform:" +
            a +
            "!important;transform-origin:center center!important}",
        );
      },
      settings(e) {
        (e.appendChild(No("Brightness", "vfBright", 0, 200, 1, (e) => e + "%")),
          e.appendChild(
            No("Contrast", "vfContrast", 0, 200, 1, (e) => e + "%"),
          ),
          e.appendChild(No("Saturation", "vfSat", 0, 200, 1, (e) => e + "%")),
          e.appendChild(No("Hue", "vfHue", 0, 360, 1, (e) => e + "deg")),
          e.appendChild(No("Zoom", "vfZoom", 50, 200, 1, (e) => e + "%")),
          e.appendChild(Io("Grayscale", "vfGray")),
          e.appendChild(Io("Mirror", "vfFlip")),
          e.appendChild(
            Eo([
              Oo("Reset filters", () =>
                Oa({
                  vfBright: 100,
                  vfContrast: 100,
                  vfSat: 100,
                  vfHue: 0,
                  vfZoom: 100,
                  vfGray: !1,
                  vfFlip: !1,
                }),
              ),
            ]),
          ));
      },
    }),
    xa.register({
      id: "hide-shorts",
      name: "Hide Shorts",
      summary:
        "Removes Shorts from everywhere on YouTube - the home page, sidebar, search, recommendations, all of it.",
      masterKey: "hideShorts",
      keys: ["hideShorts"],
      apply(e) {
        S.hideShorts &&
          (function (e) {
            const t = [
              "ytd-shorts,ytd-reel-shelf-renderer,ytd-rich-shelf-renderer[is-shorts],ytd-reel-video-renderer,ytd-shorts-video-renderer,ytd-shorts-lockup-view-model,ytm-shorts-lockup-view-model,ytd-mini-guide-entry-renderer[aria-label='Shorts'],a[title='Shorts'],a[aria-label='Shorts'],a[href*='/shorts/'],ytd-thumbnail-overlay-time-status-renderer[overlay-style='SHORTS']{display:none!important;visibility:hidden!important;pointer-events:none!important}",
              "ytd-guide-entry-renderer:has(a[title='Shorts']),ytd-guide-entry-renderer:has(a[aria-label='Shorts']),ytd-mini-guide-entry-renderer:has(a[title='Shorts']),ytd-rich-item-renderer:has(a[href*='/shorts/']),ytd-video-renderer:has(a[href*='/shorts/']),ytd-compact-video-renderer:has(a[href*='/shorts/']),ytd-grid-video-renderer:has(a[href*='/shorts/']),ytd-shelf-renderer:has(a[href*='/shorts/']),ytd-rich-section-renderer:has(a[href*='/shorts/']),yt-lockup-view-model:has(a[href*='/shorts/']){display:none!important;visibility:hidden!important;pointer-events:none!important}",
            ].join("\n");
            e.addStyle(t);
            let a = !1;
            const n = async () => {
              if (!a) {
                a = !0;
                try {
                  if (location.pathname.startsWith("/shorts")) {
                    try {
                      (e.history.replaceState(null, "", "/"),
                        e.dispatchEvent(new PopStateEvent("popstate")));
                    } catch (e) {
                      location.replace("/");
                    }
                    return;
                  }
                  const e = [
                      "a[href*='/shorts/']",
                      "a[title='Shorts']",
                      "a[aria-label='Shorts']",
                      "ytd-reel-shelf-renderer",
                      "ytd-rich-shelf-renderer[is-shorts]",
                      "ytd-shorts",
                      "ytd-shorts-video-renderer",
                      "ytd-shorts-lockup-view-model",
                      "ytm-shorts-lockup-view-model",
                    ],
                    t =
                      "ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer,ytd-grid-video-renderer,ytd-shelf-renderer,ytd-rich-section-renderer,ytd-guide-entry-renderer,ytd-mini-guide-entry-renderer,yt-lockup-view-model,ytm-shorts-lockup-view-model,ytd-reel-shelf-renderer,ytd-rich-shelf-renderer";
                  for (const a of e) {
                    const e = document.querySelectorAll(a);
                    for (let a = 0; a < e.length; a++) {
                      const n = e[a],
                        r = n.closest(t) || n;
                      (r.classList.add("ytp-shorts-blocked"),
                        r.style.setProperty("display", "none", "important"),
                        r.style.setProperty(
                          "visibility",
                          "hidden",
                          "important",
                        ),
                        (a + 1) % 60 == 0 && (await ne()));
                    }
                  }
                  const a = document.querySelectorAll(
                    "yt-chip-cloud-chip-renderer,tp-yt-paper-item,ytd-guide-entry-renderer,ytd-mini-guide-entry-renderer",
                  );
                  for (let e = 0; e < a.length; e++) {
                    const n = a[e],
                      r = (n.textContent || "").trim();
                    if (/^#?shorts$/i.test(r) || /^shorts$/i.test(r)) {
                      const e = n.closest(t) || n;
                      (e.classList.add("ytp-shorts-blocked"),
                        e.style.setProperty("display", "none", "important"),
                        e.style.setProperty(
                          "visibility",
                          "hidden",
                          "important",
                        ));
                    }
                    (e + 1) % 60 == 0 && (await ne());
                  }
                } finally {
                  a = !1;
                }
              }
            };
            (ae(n, 800),
              e.addInterval(() => ae(n, 1500), 3e3),
              document.body &&
                e.addObserver(
                  document.body,
                  ee(() => ae(n, 1e3), 400),
                  { childList: !0, subtree: !0 },
                ),
              e.onNav(() => e.addTimeout(() => ae(n, 500), 250)),
              Yt["hide-shorts"].push(() => {
                document
                  .querySelectorAll(".ytp-shorts-blocked")
                  .forEach((e) => {
                    (e.classList.remove("ytp-shorts-blocked"),
                      e.style.removeProperty("display"),
                      e.style.removeProperty("visibility"));
                  });
              }));
          })(e);
      },
      settings() {},
    }),
    Ha(
      "hide-recs",
      "Hide Recommendations",
      "Hide the watch-page right sidebar.",
      "hideRecs",
      "#secondary,#related,ytd-watch-next-secondary-results-renderer{display:none!important}#primary{max-width:100%!important}",
    ),
    Ha(
      "hide-comments",
      "Hide Comments",
      "Hide the comments section.",
      "hideComments",
      "#comments,ytd-comments{display:none!important}",
    ),
    Ha(
      "hide-endscreen",
      "Hide End-screen Cards",
      "Remove overlay cards at end of videos.",
      "hideEndscreen",
      ".ytp-ce-element,.ytp-cards-teaser{display:none!important}",
    ),
    Ha(
      "hide-livechat",
      "Hide Live Chat",
      "Collapse the live chat panel.",
      "hideLivechat",
      "ytd-live-chat-frame{display:none!important}",
    ),
    Ha(
      "hide-watermark",
      "Hide Channel Watermark",
      "Hide the channel watermark overlay.",
      "hideWatermark",
      ".ytp-watermark{display:none!important}",
    ),
    Ha(
      "hide-cards",
      "Hide Info Cards",
      "Hide the (i) info-card teaser.",
      "hideCards",
      ".ytp-cards-button,.ytp-cards-teaser-text{display:none!important}",
    ),
    Ha(
      "hide-masthead",
      "Hide Top Bar",
      "Hide the YouTube top navigation bar.",
      "hideMasthead",
      "ytd-masthead,#masthead{display:none!important}ytd-page-manager{margin-top:0!important}",
    ),
    Ha(
      "hide-banner-ads",
      "Hide Banner Ads",
      "Remove banner & overlay ads.",
      "hideBannerAds",
      "ytd-ad-slot-renderer,ytd-banner-promo-renderer,ytd-promoted-sparkles-web-renderer,#masthead-ad,#player-ads,.ytp-ad-overlay-container,.ytp-ad-text-overlay,ytd-in-feed-ad-layout-renderer{display:none!important}",
    ));
  const Fa = [
      "ytd-rich-item-renderer",
      "ytd-video-renderer",
      "ytd-compact-video-renderer",
      "ytd-grid-video-renderer",
      "ytd-channel-renderer",
      "ytd-playlist-renderer",
      "ytd-playlist-video-renderer",
      "ytd-playlist-panel-video-renderer",
      "ytd-notification-renderer",
      "ytd-comment-thread-renderer",
      "yt-lockup-view-model",
      "ytd-reel-item-renderer",
      "ytd-rich-shelf-renderer",
      "ytd-shelf-renderer",
      "ytd-rich-section-renderer",
      "ytm-media-item",
      "ytm-video-with-context-renderer",
      "ytm-compact-video-renderer",
      "ytm-reel-item-renderer",
    ],
    ja = [
      "#video-title",
      "#video-title-link",
      ".yt-lockup-metadata-view-model__title",
      ".yt-core-attributed-string",
      "yt-formatted-string#video-title",
    ];
  function za(e, t) {
    const a = e.querySelectorAll(
      'a[href*="/@"],a[href^="/@"],a[href*="/channel/"],a[href*="/c/"],a[href*="/user/"],a#channel-name,ytd-channel-name a,#channel-name a,#owner-name a',
    );
    for (const e of a) {
      const a = Cb_anchorInfo(e),
        n = (a.href || "").toLowerCase(),
        r = a.handle ? a.handle.slice(1) : "";
      for (const e of t.handles) {
        if (r && r === e) return !0;
        if (n.includes("/@" + e)) return !0;
      }
      if (t.names.length) {
        const e = (a.name || "").toLowerCase();
        for (const a of t.names)
          if (a && (e.includes(a) || n.includes(a))) return !0;
      }
    }
    if (t.names.length && S.channelBlockerMatchTitleText)
      for (const a of ja) {
        const n = e.querySelector(a);
        if (!n) continue;
        const r = ((n.title || n.textContent || "") + "").toLowerCase();
        for (const e of t.names) if (r.includes(e)) return !0;
      }
    return !1;
  }
  function Wa(e) {
    if (!e || e.dataset.ytpBlockBtn) return;
    const t = Cb_anchorInfo(e),
      a = t.handle || t.name;
    if (!a) return;
    e.dataset.ytpBlockBtn = "1";
    const n = document.createElement("button");
    ((n.type = "button"),
      (n.className = "ytp-channel-block-btn"),
      (n.textContent = "Block"),
      (n.title = "Block " + a + " with YT-zen"),
      n.addEventListener(
        "click",
        (e) => {
          (e.preventDefault(), e.stopPropagation());
          const t = Cb_norm(a),
            n = Cb_parseList();
          (n.includes(t) || n.push(t),
            Oa({ channelBlockerOn: !0, channelBlockerList: n.join("\n") }),
            pe("Hidden: " + t, 1600, "success"));
        },
        !0,
      ),
      e.insertAdjacentElement("afterend", n));
  }
  function Ua() {
    const e = location.pathname || "";
    let t = e.match(
      /^\/(@[^/?#]+)(?:\/(?:featured|videos|shorts|streams|live|releases|playlists|community|about))?\/?$/i,
    );
    return t
      ? { kind: "handle", handle: t[1], raw: t[1] }
      : ((t = e.match(/^\/channel\/(UC[\w-]{20,})(?:\/[^?#]*)?$/i)),
        t
          ? { kind: "ucid", ucid: t[1], raw: t[1] }
          : ((t = e.match(/^\/(c|user)\/([^/?#]+)(?:\/[^?#]*)?$/i)),
            t ? { kind: t[1], legacy: t[2], raw: t[2] } : null));
  }
  xa.register({
    id: "channel-blocker",
    name: "Channel Blocker",
    summary:
      "Hide channels you don’t want to see. Add a channel and you won’t see its videos in your feed, in search, in recommendations, or in comments. You can also hide the channel’s own page entirely.",
    masterKey: "channelBlockerOn",
    keys: [
      "channelBlockerOn",
      "channelBlockerList",
      "channelBlockerHideWatch",
      "channelBlockerHideBrowse",
      "channelBlockerHideComments",
      "channelBlockerMatchTitleText",
    ],
    apply(e) {
      if (!S.channelBlockerOn)
        return (
          document
            .querySelectorAll(".ytp-channel-block-btn")
            .forEach((e) => e.remove()),
          document
            .querySelectorAll(".ytp-channel-blocked")
            .forEach((e) => e.classList.remove("ytp-channel-blocked")),
          void document.documentElement.classList.remove(
            "ytp-channel-path-blocked",
          )
        );
      e.addStyle(
        '.ytp-channel-blocked{display:none!important;visibility:hidden!important}.ytp-channel-block-btn{margin-left:6px;border:0;border-radius:999px;background:rgba(204,0,0,.12);color:#ff7777;padding:2px 7px;font:700 10px system-ui;cursor:pointer;vertical-align:middle}.ytp-channel-block-btn:hover{background:rgba(204,0,0,.25);color:#fff}.ytp-channel-path-blocked ytd-browse[page-subtype="channels"]{display:none!important}',
      );
      const t = (function () {
          const e = [],
            t = [];
          for (const a of Cb_parseList())
            a.startsWith("@") ? e.push(a.slice(1)) : t.push(a);
          return { handles: e, names: t };
        })(),
        a = (function (e) {
          if (!o || !e.length) return "";
          const t =
            ":is(" +
            e
              .map(
                (e) =>
                  'a[href^="/@' + String(e).replace(/["\\]/g, "\\$&") + '" i]',
              )
              .join(",") +
            ")";
          let a =
            Fa.map((e) => e + ":has(" + t + ")").join(",") +
            "{display:none!important}";
          return (
            S.channelBlockerHideWatch &&
              (a +=
                "ytd-watch-flexy:has(ytd-video-owner-renderer " +
                t +
                "){display:none!important}"),
            a
          );
        })(t.handles);
      (a && e.addStyle(a),
        S.channelBlockerHideComments ||
          e.addStyle(
            "ytd-comment-thread-renderer.ytp-channel-blocked{display:revert!important;visibility:revert!important}",
          ));
      const n = () => {
        const e =
          S.channelBlockerHideBrowse &&
          (function (e) {
            if (!e.length) return !1;
            const t = (location.pathname || "").toLowerCase();
            for (const a of e) {
              const e = "/@" + a.toLowerCase();
              if (t === e || t.startsWith(e + "/")) return !0;
            }
            return !1;
          })(t.handles);
        document.documentElement.classList.toggle(
          "ytp-channel-path-blocked",
          e,
        );
      };
      (n(),
        e.addListener(window, "yt-navigate-finish", n),
        e.addListener(window, "popstate", n));
      let r = !1;
      const i = Fa.join(","),
        d = () => t.handles.length > 0 || t.names.length > 0,
        c = async () => {
          if (!_a() && !r && d())
            if (void 0 !== Zt && performance.now() - Zt < 250) ae(c, 500);
            else {
              r = !0;
              try {
                if (!document.hidden) {
                  const e = document.querySelectorAll(
                    'a[href*="/@"],a[href^="/@"],a#channel-name,ytd-channel-name a,#channel-name a,#owner-name a',
                  );
                  for (let t = 0; t < e.length; t++)
                    (Wa(e[t]), (t + 1) % 80 == 0 && (await ne()));
                }
                if (
                  d() &&
                  (!o || t.names.length > 0 || S.channelBlockerMatchTitleText)
                ) {
                  const e = document.querySelectorAll(i);
                  for (let a = 0; a < e.length; a++) {
                    const n = e[a],
                      r = za(n, t);
                    (n.classList.toggle("ytp-channel-blocked", r),
                      (a + 1) % 80 == 0 && (await ne()));
                  }
                }
              } finally {
                r = !1;
              }
            }
        };
      (ae(c, 600),
        e.addInterval(() => ae(c, 1500), 3e3),
        document.body &&
          e.addObserver(
            document.body,
            ee(() => ae(c, 800), 350),
            { childList: !0, subtree: !0 },
          ),
        Yt["channel-blocker"].push(() => {
          (document
            .querySelectorAll(".ytp-channel-blocked")
            .forEach((e) => e.classList.remove("ytp-channel-blocked")),
            document.documentElement.classList.remove(
              "ytp-channel-path-blocked",
            ));
        }));
    },
    settings(e) {
      (e.appendChild(
        Ho(
          "Channels to hide (one per line)",
          "channelBlockerList",
          "@SomeChannel\nAnother Channel Name\nhttps://www.youtube.com/@SomeChannel",
        ),
      ),
        e.appendChild(
          Io(
            "Also hide the watch page if I land on one of their videos",
            "channelBlockerHideWatch",
          ),
        ),
        e.appendChild(
          Io("Also hide the channel’s own page", "channelBlockerHideBrowse"),
        ),
        e.appendChild(
          Io("Also hide their comments", "channelBlockerHideComments"),
        ),
        e.appendChild(
          Io(
            "Also check video titles for these names (a little slower)",
            "channelBlockerMatchTitleText",
          ),
        ));
    },
  });
  function Za(e, t, a) {
    const n = new RegExp("([?&])" + t + "=[^&]*");
    return n.test(e)
      ? e.replace(n, "$1" + t + "=" + encodeURIComponent(a))
      : e + (e.indexOf("?") >= 0 ? "&" : "?") + t + "=" + encodeURIComponent(a);
  }
  function Qa(e) {
    try {
      navigator.sendBeacon && navigator.sendBeacon(e);
    } catch (e) {}
    try {
      fetch(e, {
        method: "GET",
        credentials: "include",
        mode: "no-cors",
        keepalive: !0,
        cache: "no-store",
      }).catch(() => {});
    } catch (e) {}
  }

  function rn(e, t) {
    return Lo(e, Bo(t));
  }
  function on(e) {
    for (const t of e) if (S[t]) return !0;
    return !1;
  }

  (xa.register({
      id: "feed-card-filters-bundle",
      name: "Feed Card Filters",
      summary:
        "Clean up your feed: hide live streams, hide upcoming premieres, or number each video card.",
      masterKey: "_bundleFeedCardFilters",
      keys: ["hideLiveContentOn", "hidePremieresOn", "numberSearchResultsOn"],
      isOn: () =>
        on(["hideLiveContentOn", "hidePremieresOn", "numberSearchResultsOn"]),
      apply() {},
      settings(e) {
        (e.appendChild(rn("Hide live streams", "hideLiveContentOn")),
          e.appendChild(rn("Hide premiere cards", "hidePremieresOn")),
          e.appendChild(
            rn("Number visible video cards", "numberSearchResultsOn"),
          ));
      },
    }),
    xa.register({
      id: "shorts-behavior-bundle",
      name: "Shorts Behaviour",
      summary:
        "Customize how Shorts work: open them in the standard video player instead, mute them automatically, or hide the comments panel.",
      masterKey: "_bundleShortsBehavior",
      keys: ["redirectShortsOn", "shortsAutoMuteOn", "shortsHideCommentsOn"],
      isOn: () =>
        on(["redirectShortsOn", "shortsAutoMuteOn", "shortsHideCommentsOn"]),
      apply() {},
      settings(e) {
        (e.appendChild(
          rn("Open Shorts in the standard video player", "redirectShortsOn"),
        ),
          e.appendChild(
            rn("Mute videos automatically on Shorts pages", "shortsAutoMuteOn"),
          ),
          e.appendChild(
            rn(
              "Hide the comments panel on Shorts pages",
              "shortsHideCommentsOn",
            ),
          ));
      },
    }),
    xa.register({
      id: "playlist-tweaks-bundle",
      name: "Playlist Tweaks",
      summary:
        "Make the playlist panel easier to use: auto-scroll to the current video, or shrink the rows to fit more on screen.",
      masterKey: "_bundlePlaylistTweaks",
      keys: ["playlistAutoscrollOn", "compactPlaylistOn"],
      isOn: () => on(["playlistAutoscrollOn", "compactPlaylistOn"]),
      apply() {},
      settings(e) {
        (e.appendChild(
          rn("Auto-scroll to current entry", "playlistAutoscrollOn"),
        ),
          e.appendChild(rn("Compact row spacing", "compactPlaylistOn")));
      },
    }),
    xa.register({
      id: "comment-tweaks-bundle",
      name: "Comment Tweaks",
      summary:
        "Tidy up comments: shorten very long ones with a click-to-expand, highlight the creator’s replies, and make timestamp links easier to spot.",
      masterKey: "_bundleCommentTweaks",
      keys: [
        "collapseLongCommentsOn",
        "highlightCreatorCommentsOn",
        "highlightTimestampLinksOn",
        "collapseLongCommentChars",
      ],
      isOn: () =>
        on([
          "collapseLongCommentsOn",
          "highlightCreatorCommentsOn",
          "highlightTimestampLinksOn",
        ]),
      apply() {},
      settings(e) {
        (e.appendChild(rn("Clamp long comments", "collapseLongCommentsOn")),
          e.appendChild(
            No(
              "Clamp threshold",
              "collapseLongCommentChars",
              400,
              5e3,
              100,
              (e) => e + " chars",
            ),
          ),
          e.appendChild(
            rn("Highlight creator comments", "highlightCreatorCommentsOn"),
          ),
          e.appendChild(
            rn("Highlight timestamp links", "highlightTimestampLinksOn"),
          ));
      },
    }),
    xa.register({
      id: "chapter-navigation-bundle",
      name: "Chapter Navigation",
      summary:
        "Jump between video chapters with the keyboard. Press N for next, P for previous. You can change these in Custom Shortcuts.",
      masterKey: "chapterHotkeysOn",
      keys: ["chapterHotkeysOn"],
      apply() {},
      settings() {},
    }),
    (() => {
      try {
        const e = va.get("auto-pause");
        if (!e) return;
        const t = e.settings;
        e.settings = function (e) {
          try {
            t.call(this, e);
          } catch (e) {}
          e.appendChild(
            rn("Auto-resume when tab/window returns", "autoResumeAutoPausedOn"),
          );
        };
      } catch (e) {}
    })(),
    xa.register({
      id: "keyword-filter",
      name: "Keyword Filter",
      summary:
        "Hide any video whose title contains words you don’t want to see.",
      masterKey: "keywordFilterOn",
      keys: ["keywordFilterOn", "keywordFilterList"],
      apply(e) {
        if (!S.keywordFilterOn) return;
        const t = (S.keywordFilterList || "")
          .split("\n")
          .map((e) => e.trim())
          .filter(Boolean);
        if (t.length)
          if (o)
            e.addStyle(
              t
                .map((e) => {
                  const t = e.replace(/["\\]/g, "\\$&");
                  return (
                    'ytd-video-renderer:has(#video-title[title*="' +
                    t +
                    '" i]),ytd-compact-video-renderer:has(#video-title[title*="' +
                    t +
                    '" i]),ytd-rich-item-renderer:has(#video-title[title*="' +
                    t +
                    '" i]){display:none!important}'
                  );
                })
                .join(""),
            );
          else {
            const a = t.map((e) => e.toLowerCase()),
              n = () => {
                _a() ||
                  document
                    .querySelectorAll(
                      "ytd-video-renderer,ytd-compact-video-renderer,ytd-rich-item-renderer",
                    )
                    .forEach((e) => {
                      const t = e.querySelector("#video-title");
                      if (!t) return;
                      const n = (t.title || t.textContent || "").toLowerCase();
                      a.some((e) => n.includes(e)) &&
                        (e.style.display = "none");
                    });
              };
            (document.body &&
              e.addObserver(document.body, ee(n, 250), {
                childList: !0,
                subtree: !0,
              }),
              e.addTimeout(n, 500));
          }
      },
      settings(e) {
        e.appendChild(
          Ho("Keywords (one per line)", "keywordFilterList", "keyword"),
        );
      },
    }),
    xa.register({
      id: "watch-later-quick",
      name: "Watch Later Shortcut",
      summary:
        "Press Alt+W to add or remove the current video from your Watch Later list.",
      masterKey: "watchLaterQuick",
      keys: ["watchLaterQuick"],
      apply() {},
      settings() {},
    }),
    xa.register({
      id: "subscribe-shortcut",
      name: "Subscribe Shortcut",
      summary:
        "Press Alt+U to subscribe or unsubscribe from the current channel.",
      masterKey: "subscribeShortcut",
      keys: ["subscribeShortcut"],
      apply() {},
      settings() {},
    }),
    xa.register({
      id: "idle-dim",
      name: "Idle Dim",
      summary:
        "Gently blur the video after you’ve been still for a while - helpful for ambient background watching.",
      masterKey: "idleDimOn",
      keys: ["idleDimOn", "idleDimDelay", "idleDimBlur"],
      apply(e) {
        if (!S.idleDimOn) return;
        let t = !1,
          a = 0;

        const blurPx = (function () {
          const n = Number(S.idleDimBlur);
          if (!isFinite(n)) return 6;
          return Math.max(1, Math.min(20, n));
        })();
        const n =
          "video.html5-main-video,#movie_player video{filter:blur(" +
          blurPx +
          "px)!important;transition:filter 1s}";
        let r = null;
        const o = () => {
            t ||
              ((t = !0),
              (r = document.createElement("style")),
              (r.textContent = n),
              document.head.appendChild(r));
          },
          i = () => {
            (r && (r.remove(), (r = null)), (t = !1));
          },
          d = () => {
            (t && i(),
              a && clearTimeout(a),
              (a = setTimeout(o, 1e3 * (Number(S.idleDimDelay) || 60))));
          };
        for (const t of ["mousemove", "keydown", "click", "touchstart"])
          e.addListener(document, t, $(d, 500), { passive: !0 });
        (d(),
          Yt["idle-dim"].push(() => {
            (a && clearTimeout(a), i());
          }));
      },
      settings(e) {
        (e.appendChild(
          No("Idle after", "idleDimDelay", 5, 600, 5, (e) => e + "s"),
        ),
          e.appendChild(No("Blur", "idleDimBlur", 1, 20, 1, (e) => e + "px")));
      },
    }));
  const dn = [
      ["DZ", "Algeria"],
      ["AR", "Argentina"],
      ["AU", "Australia"],
      ["AT", "Austria"],
      ["AZ", "Azerbaijan"],
      ["BH", "Bahrain"],
      ["BD", "Bangladesh"],
      ["BY", "Belarus"],
      ["BE", "Belgium"],
      ["BO", "Bolivia"],
      ["BA", "Bosnia & Herzegovina"],
      ["BR", "Brazil"],
      ["BG", "Bulgaria"],
      ["KH", "Cambodia"],
      ["CA", "Canada"],
      ["CL", "Chile"],
      ["CO", "Colombia"],
      ["CR", "Costa Rica"],
      ["HR", "Croatia"],
      ["CY", "Cyprus"],
      ["CZ", "Czech Republic"],
      ["DK", "Denmark"],
      ["DO", "Dominican Republic"],
      ["EC", "Ecuador"],
      ["EG", "Egypt"],
      ["SV", "El Salvador"],
      ["EE", "Estonia"],
      ["FI", "Finland"],
      ["FR", "France"],
      ["GE", "Georgia"],
      ["DE", "Germany"],
      ["GH", "Ghana"],
      ["GR", "Greece"],
      ["GT", "Guatemala"],
      ["HN", "Honduras"],
      ["HK", "Hong Kong"],
      ["HU", "Hungary"],
      ["IS", "Iceland"],
      ["IN", "India"],
      ["ID", "Indonesia"],
      ["IQ", "Iraq"],
      ["IE", "Ireland"],
      ["IL", "Israel"],
      ["IT", "Italy"],
      ["JM", "Jamaica"],
      ["JP", "Japan"],
      ["JO", "Jordan"],
      ["KZ", "Kazakhstan"],
      ["KE", "Kenya"],
      ["KW", "Kuwait"],
      ["LA", "Laos"],
      ["LV", "Latvia"],
      ["LB", "Lebanon"],
      ["LY", "Libya"],
      ["LI", "Liechtenstein"],
      ["LT", "Lithuania"],
      ["LU", "Luxembourg"],
      ["MO", "Macao"],
      ["MY", "Malaysia"],
      ["MT", "Malta"],
      ["MX", "Mexico"],
      ["ME", "Montenegro"],
      ["MA", "Morocco"],
      ["NP", "Nepal"],
      ["NL", "Netherlands"],
      ["NZ", "New Zealand"],
      ["NI", "Nicaragua"],
      ["NG", "Nigeria"],
      ["MK", "North Macedonia"],
      ["NO", "Norway"],
      ["OM", "Oman"],
      ["PK", "Pakistan"],
      ["PA", "Panama"],
      ["PG", "Papua New Guinea"],
      ["PY", "Paraguay"],
      ["PE", "Peru"],
      ["PH", "Philippines"],
      ["PL", "Poland"],
      ["PT", "Portugal"],
      ["PR", "Puerto Rico"],
      ["QA", "Qatar"],
      ["RO", "Romania"],
      ["RU", "Russia"],
      ["SA", "Saudi Arabia"],
      ["SN", "Senegal"],
      ["RS", "Serbia"],
      ["SG", "Singapore"],
      ["SK", "Slovakia"],
      ["SI", "Slovenia"],
      ["ZA", "South Africa"],
      ["KR", "South Korea"],
      ["ES", "Spain"],
      ["LK", "Sri Lanka"],
      ["SE", "Sweden"],
      ["CH", "Switzerland"],
      ["TW", "Taiwan"],
      ["TZ", "Tanzania"],
      ["TH", "Thailand"],
      ["TN", "Tunisia"],
      ["TR", "Turkey"],
      ["UG", "Uganda"],
      ["UA", "Ukraine"],
      ["AE", "United Arab Emirates"],
      ["GB", "United Kingdom"],
      ["US", "United States"],
      ["UY", "Uruguay"],
      ["VE", "Venezuela"],
      ["VN", "Vietnam"],
      ["YE", "Yemen"],
      ["ZW", "Zimbabwe"],
    ],
    cn = [
      ["af", "Afrikaans"],
      ["az", "Azerbaijani"],
      ["id", "Bahasa Indonesia"],
      ["ms", "Bahasa Malaysia"],
      ["bs", "Bosanski"],
      ["ca", "Català"],
      ["cs", "Čeština"],
      ["da", "Dansk"],
      ["de", "Deutsch"],
      ["et", "Eesti"],
      ["en-IN", "English (India)"],
      ["en-GB", "English (UK)"],
      ["en", "English (US)"],
      ["es", "Español (España)"],
      ["es-419", "Español (Latam)"],
      ["es-US", "Español (US)"],
      ["eu", "Euskara"],
      ["fil", "Filipino"],
      ["fr", "Français"],
      ["fr-CA", "Français (Canada)"],
      ["gl", "Galego"],
      ["hr", "Hrvatski"],
      ["zu", "IsiZulu"],
      ["is", "Íslenska"],
      ["it", "Italiano"],
      ["sw", "Kiswahili"],
      ["lv", "Latviešu"],
      ["lt", "Lietuvių"],
      ["hu", "Magyar"],
      ["nl", "Nederlands"],
      ["no", "Norsk"],
      ["uz", "O‘zbek"],
      ["pl", "Polski"],
      ["pt-PT", "Português"],
      ["pt", "Português (Brasil)"],
      ["ro", "Română"],
      ["sq", "Shqip"],
      ["sk", "Slovenčina"],
      ["sl", "Slovenščina"],
      ["sr-Latn", "Srpski"],
      ["fi", "Suomi"],
      ["sv", "Svenska"],
      ["vi", "Tiếng Việt"],
      ["tr", "Türkçe"],
      ["be", "Беларуская"],
      ["bg", "Български"],
      ["ky", "Кыргызча"],
      ["kk", "Қазақ"],
      ["mk", "Македонски"],
      ["mn", "Монгол"],
      ["ru", "Русский"],
      ["sr", "Српски"],
      ["uk", "Українська"],
      ["el", "Ελληνικά"],
      ["hy", "Հայերեն"],
      ["he", "עברית"],
      ["ur", "اردو"],
      ["ar", "العربية"],
      ["fa", "فارسی"],
      ["ne", "नेपाली"],
      ["mr", "मराठी"],
      ["hi", "हिन्दी"],
      ["bn", "বাংলা"],
      ["pa", "ਪੰਜਾਬੀ"],
      ["gu", "ગુજરાતી"],
      ["ta", "தமிழ்"],
      ["te", "తెలుగు"],
      ["kn", "ಕನ್ನಡ"],
      ["ml", "മലയാളം"],
      ["si", "සිංහල"],
      ["th", "ไทย"],
      ["lo", "ລາວ"],
      ["my", "မြန်မာ"],
      ["ka", "ქართული"],
      ["am", "አማርኛ"],
      ["km", "ខ្មែរ"],
      ["zh-CN", "中文 (简体)"],
      ["zh-TW", "中文 (繁體)"],
      ["zh-HK", "中文 (香港)"],
      ["ja", "日本語"],
      ["ko", "한국어"],
    ],
    sn = [
      "",
      "Pacific/Midway",
      "Pacific/Honolulu",
      "America/Anchorage",
      "America/Los_Angeles",
      "America/Denver",
      "America/Chicago",
      "America/New_York",
      "America/Caracas",
      "America/Halifax",
      "America/St_Johns",
      "America/Sao_Paulo",
      "Atlantic/South_Georgia",
      "Atlantic/Azores",
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Helsinki",
      "Europe/Moscow",
      "Asia/Dubai",
      "Asia/Karachi",
      "Asia/Kolkata",
      "Asia/Dhaka",
      "Asia/Bangkok",
      "Asia/Shanghai",
      "Asia/Tokyo",
      "Australia/Sydney",
      "Pacific/Auckland",
    ];
  let ln = !1,
    pn = !1,
    un = !1,
    hn = !1,
    mn = null,
    yn = null,
    gn = null,
    fn = null,
    bn = { language: null, languages: null };
  function vn() {
    return (S.geoRegion || "US").toUpperCase();
  }
  function kn() {
    return S.geoLang || "en";
  }
  function xn() {
    return !!S.geoOverrideOn;
  }
  const wn = new Set([
    "/youtubei/v1/browse",
    "/youtubei/v1/search",
    "/youtubei/v1/guide",
    "/youtubei/v1/reel/reel_watch_sequence",
    "/youtubei/v1/notification/get_notification_menu",
    "/youtubei/v1/account/account_menu",
    "/youtubei/v1/comment/create_comment",
    "/youtubei/v1/comment/create_comment_reply",
    "/youtubei/v1/subscription/subscribe",
    "/youtubei/v1/subscription/unsubscribe",
    "/youtubei/v1/playlist/create",
    "/youtubei/v1/share/get_share_panel",
  ]);
  function Cn(e) {
    try {
      const t = new URL(e, /^https?:/i.test(e) ? void 0 : location.origin);
      return !!/(?:^|\.)youtube\.com$/.test(t.hostname) && wn.has(t.pathname);
    } catch (e) {
      return !1;
    }
  }
  function Sn(e) {
    if (!xn() || !e) return e;
    if (!Cn(e)) return e;
    try {
      const t = /^https?:/i.test(e),
        a = new URL(e, t ? void 0 : location.origin),
        n = vn(),
        r = kn();
      let o = !1;
      return (
        a.searchParams.has("gl") && (a.searchParams.set("gl", n), (o = !0)),
        a.searchParams.has("hl") && (a.searchParams.set("hl", r), (o = !0)),
        a.searchParams.has("persist_gl") &&
          (a.searchParams.set("persist_gl", "1"),
          a.searchParams.set("gl", n),
          (o = !0)),
        a.searchParams.has("persist_hl") &&
          (a.searchParams.set("persist_hl", "1"),
          a.searchParams.set("hl", r),
          (o = !0)),
        o ? (t ? a.toString() : a.pathname + a.search + a.hash) : e
      );
    } catch (t) {
      return e;
    }
  }
  function Tn(e, t) {
    if (!xn() || !e || "string" != typeof e) return e;
    if (t && !Cn(t)) return e;
    if (e.length > 5e5 || "{" !== e.charAt(0)) return e;
    try {
      const t = JSON.parse(e);
      let a = !1;
      if (t && t.context && t.context.client) {
        const e = t.context.client;
        ((e.gl = vn()),
          (e.hl = kn()),
          (a = !0),
          void 0 !== e.contentRegion && (e.contentRegion = vn()),
          void 0 !== e.region && (e.region = vn()),
          void 0 !== e.regionCode && (e.regionCode = vn()),
          void 0 !== e.userInterfaceLanguage &&
            (e.userInterfaceLanguage = kn()),
          void 0 !== e.acceptLanguage && (e.acceptLanguage = kn()),
          void 0 !== e.timeZone &&
            S.geoTimezone &&
            (e.timeZone = S.geoTimezone));
      }
      if (t && t.context && t.context.user) {
        const e = t.context.user;
        (void 0 !== e.gl && ((e.gl = vn()), (a = !0)),
          void 0 !== e.hl && ((e.hl = kn()), (a = !0)));
      }
      return (
        t && "string" == typeof t.gl && ((t.gl = vn()), (a = !0)),
        t && "string" == typeof t.hl && ((t.hl = kn()), (a = !0)),
        a ? JSON.stringify(t) : e
      );
    } catch (t) {
      return e;
    }
  }
  function On(e) {
    if (!e) return;
    const t = vn(),
      a = kn();
    try {
      ((e.gl = t),
        (e.hl = a),
        void 0 !== e.contentRegion && (e.contentRegion = t),
        void 0 !== e.region && (e.region = t),
        void 0 !== e.regionCode && (e.regionCode = t),
        void 0 !== e.geo && (e.geo = t),
        void 0 !== e.locale && (e.locale = a),
        void 0 !== e.acceptLanguage && (e.acceptLanguage = a),
        void 0 !== e.userInterfaceLanguage && (e.userInterfaceLanguage = a),
        S.geoTimezone && void 0 !== e.timeZone && (e.timeZone = S.geoTimezone));
    } catch (e) {}
  }
  function Mn() {
    const e = vn(),
      t = kn(),
      a = new Date(Date.now() + 3456e7).toUTCString(),
      n = (function (e, t, a) {
        const n = {};
        return (
          e &&
            e.split("&").forEach((e) => {
              const t = e.indexOf("=");
              t > 0 && (n[e.substring(0, t)] = e.substring(t + 1));
            }),
          (n.gl = t),
          (n.hl = a),
          n.f6 || (n.f6 = "8"),
          Object.keys(n)
            .map((e) => e + "=" + n[e])
            .join("&")
        );
      })(
        (function () {
          try {
            const e = document.cookie.match(/(?:^|;\s*)PREF=([^;]*)/);
            return e ? decodeURIComponent(e[1]) : "";
          } catch (e) {
            return "";
          }
        })(),
        e,
        t,
      ),
      r = [".youtube.com"];
    for (let o = 0; o < r.length; o++) {
      const i =
        "; expires=" + a + "; path=/; domain=" + r[o] + "; SameSite=Lax";
      try {
        if (typeof ti !== 'undefined' && ti.cookieControl && ti.cookieControl.manager) {
          ti.cookieControl.manager.set("PREF", n, { domain: r[o], path: "/", sameSite: "Lax", expires: a });
          ti.cookieControl.manager.set("GL", e, { domain: r[o], path: "/", sameSite: "Lax", expires: a });
          ti.cookieControl.manager.set("HL", t, { domain: r[o], path: "/", sameSite: "Lax", expires: a });
        } else {
          document.cookie = "PREF=" + n + i;
          document.cookie = "GL=" + e + i;
          document.cookie = "HL=" + t + i;
        }
      } catch (e) {
        try { document.cookie = "PREF=" + n + i; } catch (e2) {}
        try { document.cookie = "GL=" + e + i; } catch (e2) {}
        try { document.cookie = "HL=" + t + i; } catch (e2) {}
      }
    }
  }
  function Ln() {
    const e = new Date(0).toUTCString(),
      t = [
        ".youtube.com",
        ".www.youtube.com",
        ".m.youtube.com",
        ".music.youtube.com",
        "",
      ],
      a = ["GL", "HL", "PREF", "VISITOR_PRIVACY_METADATA"];
    for (const n of t)
      for (const t of a) {
        try {
          if (typeof ti !== 'undefined' && ti.cookieControl && ti.cookieControl.manager) {
            ti.cookieControl.manager.delete(t, { domain: n || ".youtube.com", path: "/" });
          } else {
            const a =
              "; expires=" +
              e +
              "; path=/" +
              (n ? "; domain=" + n : "") +
              "; SameSite=Lax";
            document.cookie = t + "=" + a;
          }
        } catch (e2) {
          try {
            const a =
              "; expires=" +
              e +
              "; path=/" +
              (n ? "; domain=" + n : "") +
              "; SameSite=Lax";
            document.cookie = t + "=" + a;
          } catch (e3) {}
        }
      }
  }
  function An() {
    const t = vn(),
      a = kn();
    try {
      if (e.ytcfg && e.ytcfg.set && e.ytcfg.get) {
        if (e.ytcfg.get("GL") === t && e.ytcfg.get("HL") === a) return;
        e.ytcfg.set({
          GL: t,
          HL: a,
          INNERTUBE_CONTEXT_GL: t,
          INNERTUBE_CONTEXT_HL: a,
        });
      }
    } catch (e) {}
    const n = [];
    try {
      e.yt && e.yt.config_ && n.push(e.yt.config_);
    } catch (e) {}
    try {
      e.ytcfg && e.ytcfg.data_ && n.push(e.ytcfg.data_);
    } catch (e) {}
    for (const e of n)
      try {
        ((e.GL = t),
          (e.HL = a),
          (e.INNERTUBE_CONTEXT_GL = t),
          (e.INNERTUBE_CONTEXT_HL = a),
          e.INNERTUBE_CONTEXT &&
            e.INNERTUBE_CONTEXT.client &&
            On(e.INNERTUBE_CONTEXT.client));
      } catch (e) {}
    try {
      if (e.ytcfg && e.ytcfg.get) {
        const t = e.ytcfg.get("INNERTUBE_CONTEXT");
        t && t.client && (On(t.client), e.ytcfg.set({ INNERTUBE_CONTEXT: t }));
      }
    } catch (e) {}
  }

  function En() {

  }
  function Bn() {

  }
  function Pn() {

  }
  function In() {
    (Mn(),
      An(),
      (function () {
        const t = vn(),
          a = kn();
        function n(e) {
          if (e) {
            try {
              const n = e.serviceTrackingParams || [];
              for (const e of n)
                for (const n of e.params || [])
                  (("GL" !== n.key && "gl" !== n.key) || (n.value = t),
                    ("HL" !== n.key && "hl" !== n.key) || (n.value = a),
                    ("cr" !== n.key && "region" !== n.key) || (n.value = t),
                    "locale" === n.key && (n.value = a));
            } catch (e) {}
            try {
              const n = e.webResponseContextExtensionData;
              n &&
                n.ytConfigData &&
                (void 0 !== n.ytConfigData.gl && (n.ytConfigData.gl = t),
                void 0 !== n.ytConfigData.hl && (n.ytConfigData.hl = a));
            } catch (e) {}
          }
        }
        try {
          n(e.ytInitialData && e.ytInitialData.responseContext);
        } catch (e) {}
        try {
          n(
            e.ytInitialPlayerResponse &&
              e.ytInitialPlayerResponse.responseContext,
          );
        } catch (e) {}
        try {
          n(e.ytPlayerConfig && e.ytPlayerConfig.responseContext);
        } catch (e) {}
      })(),
      (function () {
        try {
          const e = document.documentElement;
          e &&
            xn() &&
            e.getAttribute("lang") !== kn() &&
            e.setAttribute("lang", kn());
        } catch (e) {}
      })());
  }
  function Rn(e, t) {
    const a = To("div", "ytp-geo-sel"),
      n = document.createElement("input");
    ((n.type = "text"),
      (n.className = "ytp-inp ytp-geo-input"),
      (n.placeholder = "Type to search…"),
      (n.spellcheck = !1));
    const r = t.find((t) => t[0] === S[e]);
    ((n.value = r ? r[1] + " (" + r[0] + ")" : S[e] || ""),
      (n.dataset.code = S[e] || ""));
    const o = To("div", "ytp-geo-dd");
    function i(a) {
      o.replaceChildren();
      const r = (a || "").toLowerCase().trim(),
        i = (
          r
            ? t.filter(
                (e) =>
                  e[0].toLowerCase().includes(r) ||
                  e[1].toLowerCase().includes(r),
              )
            : t
        ).slice(0, 80);
      i.length
        ? i.forEach((t) => {
            const a = To("div", "ytp-geo-row");
            ((a.dataset.code = t[0]),
              a.appendChild(To("span", "ytp-geo-name", t[1])),
              a.appendChild(To("span", "ytp-geo-code", t[0])),
              t[0] === n.dataset.code && a.classList.add("selected"),
              a.addEventListener("mousedown", (a) => {
                (a.preventDefault(),
                  (n.value = t[1] + " (" + t[0] + ")"),
                  (n.dataset.code = t[0]),
                  (o.style.display = "none"),
                  Ta(e, t[0]));
              }),
              o.appendChild(a));
          })
        : o.appendChild(To("div", "ytp-geo-empty", "No matches"));
    }
    return (
      (o.style.display = "none"),
      n.addEventListener("focus", () => {
        (i(""), (o.style.display = "block"));
      }),
      n.addEventListener("blur", () => {
        setTimeout(() => {
          o.style.display = "none";
          const e = n.dataset.code,
            a = t.find((t) => t[0] === e);
          n.value = a ? a[1] + " (" + a[0] + ")" : e || "";
        }, 150);
      }),
      n.addEventListener("input", () => i(n.value)),
      n.addEventListener("keydown", (e) => {
        if ("Escape" !== e.key) {
          if ("Enter" === e.key) {
            const e = o.querySelector(".ytp-geo-row");
            return void (e && e.dispatchEvent(new MouseEvent("mousedown")));
          }
          if ("ArrowDown" === e.key || "ArrowUp" === e.key) {
            e.preventDefault();
            const t = Array.from(o.querySelectorAll(".ytp-geo-row"));
            if (!t.length) return;
            let a = t.findIndex((e) => e.classList.contains("hot"));
            (t.forEach((e) => e.classList.remove("hot")),
              (a =
                "ArrowDown" === e.key
                  ? (a + 1) % t.length
                  : a <= 0
                    ? t.length - 1
                    : a - 1),
              t[a].classList.add("hot"),
              t[a].scrollIntoView({ block: "nearest" }));
          }
        } else n.blur();
      }),
      So("cfg.changed", (a) => {
        if (a.key !== e) return;
        const r = t.find((t) => t[0] === S[e]);
        ((n.value = r ? r[1] + " (" + r[0] + ")" : S[e] || ""),
          (n.dataset.code = S[e] || ""));
      }),
      a.appendChild(n),
      a.appendChild(o),
      a
    );
  }
  function Nn(e) {
    e.replaceChildren();
    const t = (function () {
        const e = [];
        for (const [t, a] of ta)
          e.push({
            id: t,
            applies: a.applies,
            intervals: a.intervals,
            observers: a.observers,
            totalMs: a.totalMs,
            avgMs:
              a.intervals + a.applies
                ? a.totalMs / (a.intervals + a.applies)
                : 0,
            maxMs: a.maxMs,
            lastMs: a.lastMs,
            lastT: a.lastT,
          });
        return (e.sort((e, t) => t.totalMs - e.totalMs), e);
      })(),
      n = (function () {
        try {
          if (performance && performance.memory) {
            const e = performance.memory;
            return {
              used: e.usedJSHeapSize,
              total: e.totalJSHeapSize,
              limit: e.jsHeapSizeLimit,
            };
          }
        } catch (e) {}
        return null;
      })();
    if (n) {
      const t = To("div", "ytp-perf-mem"),
        r = (n.used / 1048576).toFixed(1),
        o = (n.total / 1048576).toFixed(1),
        i = (n.limit / 1048576).toFixed(0),
        d = ((n.used / n.limit) * 100).toFixed(1);
      (a(
        t,
        "<b>JS Heap</b>: " +
          r +
          " MB used - " +
          o +
          " MB allocated - " +
          i +
          " MB limit (" +
          d +
          "%)",
      ),
        e.appendChild(t));
      const c = To("div", "ytp-perf-membar"),
        s = To("div", "ytp-perf-memfill");
      ((s.style.width = Math.min(100, d) + "%"),
        n.used / n.limit > 0.8
          ? (s.style.background = "#e53935")
          : n.used / n.limit > 0.5 && (s.style.background = "#fb8c00"),
        c.appendChild(s),
        e.appendChild(c));
    } else
      e.appendChild(
        To(
          "div",
          "ytp-hist-note",
          "performance.memory not available in this browser (Firefox / privacy mode). Heap stats unavailable.",
        ),
      );
    const r = Xt,
      o = To("div", "ytp-perf-state");
    if (
      ((o.textContent =
        "Visible: " +
        (r.visible ? "yes" : "no") +
        " - Focused: " +
        (r.focused ? "yes" : "no") +
        " - Battery low: " +
        (r.batteryLow ? "yes" : "no") +
        " - Save-data: " +
        (r.saveData ? "yes" : "no") +
        " - Throttle ×" +
        Qt().toFixed(2)),
      e.appendChild(o),
      !t.length)
    )
      return void e.appendChild(
        To(
          "div",
          "ytp-hist-note",
          "No feature timings recorded yet. Profiler started when this toggle was enabled.",
        ),
      );
    const i = To("div", "ytp-perf-table"),
      d = To("div", "ytp-perf-row ytp-perf-hdr");
    (d.appendChild(To("span", "ytp-perf-c1", "Feature")),
      d.appendChild(To("span", "ytp-perf-c2", "Calls")),
      d.appendChild(To("span", "ytp-perf-c3", "Total")),
      d.appendChild(To("span", "ytp-perf-c4", "Avg")),
      d.appendChild(To("span", "ytp-perf-c5", "Max")),
      i.appendChild(d));
    for (const e of t.slice(0, 30)) {
      const t = To("div", "ytp-perf-row"),
        a = e.applies + e.intervals,
        n = Math.min(1, e.totalMs / 500);
      ((t.style.background =
        "rgba(" +
        Math.round(255 * n) +
        "," +
        Math.round(120 * (1 - n)) +
        "," +
        Math.round(60 * (1 - n)) +
        ",0.10)"),
        t.appendChild(To("span", "ytp-perf-c1", e.id)),
        t.appendChild(To("span", "ytp-perf-c2", String(a))),
        t.appendChild(To("span", "ytp-perf-c3", e.totalMs.toFixed(1) + " ms")),
        t.appendChild(To("span", "ytp-perf-c4", e.avgMs.toFixed(2) + " ms")),
        t.appendChild(To("span", "ytp-perf-c5", e.maxMs.toFixed(1) + " ms")),
        i.appendChild(t));
    }
    e.appendChild(i);
    const c = To("div", "ytp-rowb");
    (c.appendChild(Oo("Refresh", () => Nn(e))),
      c.appendChild(
        Oo(
          "Reset stats",
          () => {
            (ta.clear(), Nn(e));
          },
          "ytp-danger",
        ),
      ),
      e.appendChild(c));
  }
  (xa.register({
    id: "geo-override",
    name: "Country & Language Override",
    summary:
      "Make YouTube think you’re in a different country and language. Useful for unblocking region-restricted content or just browsing as if you were somewhere else.",
    masterKey: "geoOverrideOn",
    keys: [
      "geoOverrideOn",
      "geoRegion",
      "geoLang",
      "geoTimezone",
      "geoSafeSearch",
      "geoRestrictMode",
      "geoAutoReload",
      "geoPatchFetch",
      "geoPatchXHR",
      "geoPatchBeacon",
      "geoPatchNavigator",
    ],
    apply(t) {
      if (!S.geoOverrideOn) return (En(), Bn(), Pn(), void Ln());
      (!(function () {
        if (!hn && S.geoPatchNavigator) {
          hn = !0;
          try {
            bn.language = navigator.language;
          } catch (e) {}
          try {
            bn.languages = navigator.languages;
          } catch (e) {}
          try {
            (Object.defineProperty(navigator, "language", {
              get: () => (xn() ? kn() : bn.language || "en"),
              configurable: !0,
            }),
              Object.defineProperty(navigator, "languages", {
                get() {
                  if (!xn()) return bn.languages || ["en"];
                  const e = kn(),
                    t = e.split("-")[0];
                  return t === e ? [e] : [e, t];
                },
                configurable: !0,
              }));
          } catch (e) {}
          try {
            const e = Intl.DateTimeFormat;
            if (e && !e.__ytpGeo) {
              const t = function (t, a) {
                return (xn() && !t && (t = kn()), new e(t, a));
              };
              ((t.__ytpGeo = !0),
                (t.prototype = e.prototype),
                (t.supportedLocalesOf = e.supportedLocalesOf.bind(e)),
                (Intl.DateTimeFormat = t));
            }
            const t = Intl.NumberFormat;
            if (t && !t.__ytpGeo) {
              const e = function (e, a) {
                return (xn() && !e && (e = kn()), new t(e, a));
              };
              ((e.__ytpGeo = !0),
                (e.prototype = t.prototype),
                (e.supportedLocalesOf = t.supportedLocalesOf.bind(t)),
                (Intl.NumberFormat = e));
            }
          } catch (e) {}
        }
      })(),
        S.geoPatchFetch
          ? !ln &&
            S.geoPatchFetch &&
            ((ln = !0),
            (mn = e.fetch),
            (e.fetch = function (e, t) {
              if (!xn() || !S.geoPatchFetch) return mn.call(this, e, t);
              try {
                if ("string" == typeof e && Cn(e)) {
                  const a = Sn(e);
                  if (t && t.body && "string" == typeof t.body) {
                    const a = Tn(t.body, e);
                    a !== t.body && (t = Object.assign({}, t, { body: a }));
                  }
                  return mn.call(this, a, t);
                }
              } catch (e) {}
              return mn.call(this, e, t);
            }))
          : En(),
        S.geoPatchXHR
          ? !pn &&
            S.geoPatchXHR &&
            ((pn = !0),
            (yn = XMLHttpRequest.prototype.open),
            (gn = XMLHttpRequest.prototype.send),
            (XMLHttpRequest.prototype.open = function () {
              try {
                xn() &&
                  S.geoPatchXHR &&
                  "string" == typeof arguments[1] &&
                  Cn(arguments[1]) &&
                  ((arguments[1] = Sn(arguments[1])), (this.__ytpGeoSafe = !0));
              } catch (e) {}
              return yn.apply(this, arguments);
            }),
            (XMLHttpRequest.prototype.send = function () {
              try {
                xn() &&
                  this.__ytpGeoSafe &&
                  "string" == typeof arguments[0] &&
                  "{" === arguments[0].charAt(0) &&
                  (arguments[0] = Tn(arguments[0]));
              } catch (e) {}
              return gn.apply(this, arguments);
            }))
          : Bn(),
        S.geoPatchBeacon
          ? (function () {
              if (!un && S.geoPatchBeacon && navigator.sendBeacon) {
                un = !0;
                try {
                  fn = navigator.sendBeacon.bind(navigator);
                } catch (e) {
                  return void (un = !1);
                }
                navigator.sendBeacon = function (e, t) {
                  try {
                    xn() &&
                      S.geoPatchBeacon &&
                      "string" == typeof e &&
                      Cn(e) &&
                      ((e = Sn(e)), "string" == typeof t && (t = Tn(t, e)));
                  } catch (e) {}
                  return fn(e, t);
                };
              }
            })()
          : Pn(),
        In(),
        t.onNav(() => {
          for (const e of [100, 500, 1500])
            t.addTimeout(() => {
              (Mn(), An());
            }, e);
        }));
    },
    settings(e) {
      (e.appendChild(
        To("div", "ytp-lbl", "Region (" + dn.length + " available)"),
      ),
        e.appendChild(Rn("geoRegion", dn)),
        e.appendChild(
          To("div", "ytp-lbl", "Language (" + cn.length + " available)"),
        ),
        e.appendChild(Rn("geoLang", cn)),
        e.appendChild(
          Ro(
            "Timezone override",
            "geoTimezone",
            Object.fromEntries(
              [["", "(auto)"]].concat(sn.filter(Boolean).map((e) => [e, e])),
            ),
          ),
        ));
      const t = To("div", "ytp-geo-status");
      function a() {
        const e = vn(),
          a = kn(),
          n = (dn.find((t) => t[0] === e) || [e, e])[1],
          r = (cn.find((e) => e[0] === a) || [a, a])[1];
        t.textContent =
          "Active: " +
          n +
          " / " +
          r +
          " (gl=" +
          e +
          ", hl=" +
          a +
          ")" +
          (S.geoTimezone ? " tz=" + S.geoTimezone : "") +
          " | Patched: " +
          (ln ? "F" : "-") +
          (pn ? "X" : "-") +
          (un ? "B" : "-") +
          (hn ? "N" : "-");
      }
      (a(),
        So("cfg.changed", (e) => {
          e.key.startsWith("geo") && a();
        }),
        e.appendChild(t),
        e.appendChild(
          To("div", "ytp-elem-sec-title", "Interception Techniques"),
        ),
        e.appendChild(
          Io("Intercept fetch() requests (advanced)", "geoPatchFetch"),
        ),
        e.appendChild(Io("Intercept XMLHttpRequest (advanced)", "geoPatchXHR")),
        e.appendChild(Io("Intercept sendBeacon (advanced)", "geoPatchBeacon")),
        e.appendChild(
          Io("Match browser language and time formatting", "geoPatchNavigator"),
        ),
        e.appendChild(Io("Auto-reload on region change", "geoAutoReload")),
        e.appendChild(To("div", "ytp-elem-sec-title", "Actions")));
      const n = To("div", "ytp-rowb");
      (n.appendChild(
        Oo(
          "Re-apply all now",
          () => {
            (In(), pe("Country settings re-applied.", 1500, "success"));
          },
          "primary",
        ),
      ),
        n.appendChild(
          Oo("Reload page", () => {
            (In(), setTimeout(() => location.reload(), 200));
          }),
        ),
        n.appendChild(
          Oo(
            "Clear cookies & restore",
            () => {
              (Ln(),
                En(),
                Bn(),
                Pn(),
                pe(
                  "Country settings cleared. Refresh the page to apply.",
                  2500,
                  "info",
                ));
            },
            "ytp-danger",
          ),
        ),
        e.appendChild(n),
        e.appendChild(
          To(
            "div",
            "ytp-hist-note",
            "Cookies are set at page start so YouTube servers see the new region on load. After changing region, click Reload for full effect. The advanced fetch/XHR/beacon toggles are OFF by default; enable only if cookie+ytcfg patching alone is insufficient.",
          ),
        ));
    },
  }),
    xa.register({
      id: "data-minimization",
      name: "Data Minimization (Kill YouTube Telemetry)",
      summary:
        "When ON, completely kills YouTube's outbound telemetry, playback stats, ad-event beacons, and DoubleClick / pagead tracking without breaking playback. None of these requests gate the video stream, so the player keeps running while Google stops receiving the data.",
      masterKey: "dataMinimizationOn",
      keys: [
        "dataMinimizationOn",
        "dataMinBlockStats",
        "dataMinBlockPagead",
        "dataMinBlockLogEvent",
        "dataMinAllowHeartbeat",
      ],
      isOn: () => !!S.dataMinimizationOn,
      apply() {

        try {
          g.emit("dm.toggle", { on: !!S.dataMinimizationOn });
        } catch (e) {}
      },
      settings(t) {
        const _r = (label, key, desc) => {
          const row = Io(label, key);

          try {
            const c = row.parentElement;
            if (c && !c.querySelector(".ytp-dm-note")) {
              const n = To(
                "div",
                "ytp-dm-note",
                desc || "",
              );
              n.style.cssText =
                "font-size:10.5px;color:#888;line-height:1.4;margin:-2px 0 6px 0;padding:0 4px;";
              c.appendChild(n);
            }
          } catch (e) {}
          t.appendChild(row);
        };
        _r(
          "Block /api/stats/* (watchtime, playback, qoe, ads)",
          "dataMinBlockStats",
          "Drops the playback-statistics beacons YouTube fires throughout a video. No playback impact.",
        );
        _r(
          "Block /pagead/* and DoubleClick (ad tracking)",
          "dataMinBlockPagead",
          "Drops impression/conversion pings to DoubleClick and YouTube's own /pagead/* endpoints. No playback impact.",
        );
        _r(
          "Block /youtubei/v1/log_event (engagement log)",
          "dataMinBlockLogEvent",
          "Drops the generic engagement log. No playback impact.",
        );
        _r(
          "Allow player heartbeat (recommended)",
          "dataMinAllowHeartbeat",
          "Heartbeat is what YouTube uses to keep the stream alive. Keep ON unless you want to risk stalled-playback errors.",
        );

        const counter = To("div", "ytp-dm-counter");
        counter.style.cssText =
          "margin-top:8px;padding:6px 9px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:6px;font:11px ui-monospace,monospace;color:#9aa;";
        const render = () => {
          let s = { dropped: 0 };
          try {
            if (e.YTPlus && e.YTPlus.dataMin) s = e.YTPlus.dataMin.stats();
          } catch (e2) {}
          counter.textContent =
            "Dropped telemetry calls this session: " + (s.dropped || 0);
        };
        render();
        const onBlock = () => render();
        const off = g.on("net.blocked", onBlock);

        const _cleanup = () => {
          try {
            off();
          } catch (e) {}
        };

        t.appendChild(counter);
      },
    }),
    xa.register({
      id: "stats-overlay",
      name: "Playback Performance Overlay",
      summary:
        "Show live frames per second, streaming health, and playback speed directly over the video player.",
      masterKey: "statsOverlay",
      keys: ["statsOverlay"],
      apply(e) {
        if (!S.statsOverlay) return;
        const t = document.createElement("div");
        ((t.id = "ytp-stats"), document.body && document.body.appendChild(t));
        let a = "";
        (e.addInterval(() => {
          const e = ie.el();
          if (!e) return !1;
          const n = e.buffered.length
              ? e.buffered.end(e.buffered.length - 1) - e.currentTime
              : 0,
            r =
              "t=" +
              e.currentTime.toFixed(1) +
              "s - rate=" +
              e.playbackRate +
              "x - buf=" +
              n.toFixed(1) +
              "s";
          return (
            r !== a &&
            ((a = r),
            pa(() => {
              t.textContent = r;
            }),
            !0)
          );
        }, 500),
          Yt["stats-overlay"].push(() => t.remove()));
      },
      settings() {},
    }),
    xa.register({
      id: "diag-console",
      name: "Activity Monitor",
      summary:
        "A small floating window that shows what background actions are happening in real time. Helpful for spotting issues.",
      hidden: !0,
      masterKey: "diagConsole",
      keys: ["diagConsole"],
      apply(e) {
        if (!S.diagConsole) return;
        const t = document.createElement("pre");
        ((t.id = "ytp-diag"), document.body && document.body.appendChild(t));
        let a = 0,
          n = "";
        (e.addInterval(() => {
          const e = y();
          if (e.length === a) return !1;
          a = e.length;
          const r = e
            .slice(-25)
            .map((e) => "[" + e.level + "] " + e.msg)
            .join("\n");
          return (
            r !== n &&
            ((n = r),
            pa(() => {
              t.textContent = r;
            }),
            !0)
          );
        }, 1e3),
          Yt["diag-console"].push(() => t.remove()));
      },
      settings() {},
    }),
    xa.register({
      id: "perf-profiler",
      name: "Feature Performance Tracker",
      summary:
        "See how much computer processing each feature is using, so you can turn off heavy ones on older devices.",
      masterKey: "perfProfilerOn",
      keys: ["perfProfilerOn"],
      apply(e) {
        S.perfProfilerOn || ta.clear();
      },
      settings(e) {
        const t = To("div", "ytp-perf-panel");
        (e.appendChild(t), Nn(t));
        const a = setInterval(() => {
          t.isConnected && S.perfProfilerOn && Nn(t);
        }, 2e3);
        Co.push(() => clearInterval(a));
      },
    }),
    xa.register({
      id: "fps-counter",
      name: "Live FPS Counter",
      summary:
        "Show the current playback frame rate in a small floating overlay so you can spot stutters or low-FPS videos.",
      masterKey: "fpsCounterOn",
      keys: ["fpsCounterOn", "fpsCounterPos"],
      apply(e) {
        let t = null;
        let a = null;
        let r = 0;
        let o = performance.now();
        const i = () => {
          if (!S.fpsCounterOn) return;
          const s = S.fpsCounterPos || "tl";
          if (t) {
            if (t.dataset.pos !== s) {
              (t.className = "ytp-fps-box ytp-fps-" + s),
                (t.dataset.pos = s),
                (t.style.top = "tl" === s || "tr" === s ? "8px" : ""),
                (t.style.bottom = "bl" === s || "br" === s ? "48px" : ""),
                (t.style.left = "tl" === s || "bl" === s ? "8px" : ""),
                (t.style.right = "tr" === s || "br" === s ? "8px" : "");
            }
          } else {
            t = document.createElement("div");
            t.id = "ytp-fps-box";
            t.className = "ytp-fps-box ytp-fps-" + s;
            t.dataset.pos = s;
            t.style.cssText =
              "position:fixed;z-index:2147483635;padding:3px 7px;background:rgba(20,22,28,.78);color:#9ff;border:1px solid rgba(159,255,255,.28);border-radius:6px;font:11px/1 ui-monospace,SFMono-Regular,Consolas,monospace;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:none;min-width:54px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.35)";
            ("tl" === s || "tr" === s) && (t.style.top = "8px"),
              ("bl" === s || "br" === s) && (t.style.bottom = "48px"),
              ("tl" === s || "bl" === s) && (t.style.left = "8px"),
              ("tr" === s || "br" === s) && (t.style.right = "8px"),
              document.body && document.body.appendChild(t);
          }
        };
        const d = () => {
          if (!Xt.visible) {
            a = setTimeout(d, 250);
            return;
          }
          const n = performance.now();
          r++;
          if (n - o < 500) {
            a = requestAnimationFrame(d);
            return;
          }
          const c = Math.round((1e3 * r) / (n - o));
          (r = 0), (o = n);
          const s = (ie.el && ie.el()) ? (ie.el().paused ? "paused" : ie.el().ended ? "ended" : "playing") : "—";
          const l = c < 24 ? "#ff5252" : c < 50 ? "#ffd166" : "#4caf50";
          (i(),
            t && (t.textContent = c + " fps (" + s + ")"),
            t && (t.style.color = l),
            (a = requestAnimationFrame(d)));
        };
        const c = (n) => {
          a && "number" == typeof a
            ? cancelAnimationFrame(a)
            : a && clearTimeout(a),
            (a = null),
            n &&
              ((r = 0), (o = performance.now()), (a = requestAnimationFrame(d)));
        };
        S.fpsCounterOn &&
          ((r = 0), (o = performance.now()), (a = requestAnimationFrame(d))),
          e.onNav(() => {
            c(0), e.addTimeout(() => c(1), 1200);
          }),
          So("cfg.changed", ({ key: n }) => {
            "fpsCounterOn" === n
              ? S.fpsCounterOn
                ? c(1)
                : (c(0),
                  t && (function () { try { t.remove(); } catch (e) {} })(),
                  (t = null))
              : "fpsCounterPos" === n && t && i();
          }),
          Yt["fps-counter"].push(() => {
            c(0);
            if (t) {
              try {
                t.remove();
              } catch (e) {}
              t = null;
            }
          });
      },
      settings(e) {
        e.appendChild(Io("Show live FPS overlay", "fpsCounterOn"));
        e.appendChild(
          Ro("Position", "fpsCounterPos", {
            tl: "Top-left",
            tr: "Top-right",
            bl: "Bottom-left",
            br: "Bottom-right",
          }),
        );
      },
    }),
    xa.register({
      id: "buffer-health",
      name: "Buffer Health Monitor",
      summary:
        "Watch the player's video buffer in real time. Shows buffered seconds, rebuffer events, and a small live health bar.",
      masterKey: "bufferHealthOn",
      keys: ["bufferHealthOn"],
      apply(e) {
        let t = null;
        let n = null;
        let r = 0;
        let o = 0;
        const i = () => {
          if (!S.bufferHealthOn) return;
          const v = ie.el && ie.el();
          if (t) {
            v || (t.style.display = "none");
            return;
          }
          if (!v || !document.body) return;
          t = document.createElement("div");
          t.id = "ytp-buf-box";
          t.style.cssText =
            "position:fixed;z-index:2147483635;left:8px;bottom:48px;padding:6px 10px;background:rgba(20,22,28,.78);color:#ddd;border:1px solid rgba(255,255,255,.14);border-radius:8px;font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);min-width:160px;pointer-events:none;box-shadow:0 6px 20px rgba(0,0,0,.4)";
          const d = document.createElement("div");
          (d.className = "ytp-buf-text"),
            (d.style.cssText = "white-space:nowrap"),
            t.appendChild(d);
          const a = document.createElement("div");
          (a.className = "ytp-buf-bar"),
            (a.style.cssText =
              "height:4px;background:rgba(255,255,255,.12);border-radius:3px;margin-top:4px;overflow:hidden");
          const l = document.createElement("div");
          (l.className = "ytp-buf-fill"),
            (l.style.cssText =
              "height:100%;width:0;background:#4caf50;border-radius:3px;transition:width .3s,background .3s");
          a.appendChild(l);
          t.appendChild(a);
          document.body.appendChild(t);
        };
        const d = () => {
          if (!S.bufferHealthOn) return;
          if (!Xt.visible) {
            n = setTimeout(d, 500);
            return;
          }
          i();
          if (!t) {
            n = setTimeout(d, 1000);
            return;
          }
          const v = ie.el();
          if (!v) {
            (t.style.display = "none"), (n = setTimeout(d, 1000));
            return;
          }
          t.style.display = "";
          let a = 0;
          try {
            const u = v.buffered;
            if (u && u.length) {
              const m = v.currentTime;
              for (let p = 0; p < u.length; p++) {
                if (u.end(p) >= m) {
                  a = u.end(p) - m;
                  break;
                }
              }
            }
          } catch (e) {}
          const l = v.paused
            ? "paused"
            : v.ended
              ? "ended"
              : v.seeking
                ? "seeking"
                : v.readyState < 3
                  ? "loading"
                  : "playing";
          const c = a < 2 ? "#ff5252" : a < 6 ? "#ffd166" : "#4caf50";
          const s = t.querySelector(".ytp-buf-fill");
          s && ((s.style.width = Math.min(100, a * 5) + "%"), (s.style.background = c));
          const h = t.querySelector(".ytp-buf-text");
          h &&
            (h.textContent =
              "Buffer: " +
              a.toFixed(1) +
              "s | Rebuffers: " +
              o +
              " | " +
              l);
          n = setTimeout(d, 750);
        };
        const a = () => {
          const v = ie.el();
          v && !v.paused && !v.ended && ((o += 1), r < 4 && (pe("Rebuffer #" + o, 1200, "info"), (r += 1)));
        };
        const l = () => {
          r = 0;
        };
        const startInterval = () => {
          n && clearTimeout(n);
          n = setTimeout(d, 250);
        };
        const stopInterval = () => {
          n && clearTimeout(n), (n = null);
        };
        S.bufferHealthOn && startInterval();
        e.addListener(ie, "waiting", a);
        e.addListener(ie, "stalled", a);
        e.addListener(ie, "playing", l);
        e.onNav(() => {
          o = 0;
          e.addTimeout(startInterval, 1500);
        });
        So("cfg.changed", ({ key: k }) => {
          "bufferHealthOn" === k &&
            (S.bufferHealthOn
              ? (startInterval(), i())
              : (stopInterval(),
                t && (function () { try { t.remove(); } catch (e) {} })(),
                (t = null),
                (o = 0)));
        });
        Yt["buffer-health"].push(() => {
          stopInterval();
          if (t) {
            try {
              t.remove();
            } catch (e) {}
            t = null;
          }
        });
      },
      settings(e) {
        e.appendChild(Io("Show buffer health overlay", "bufferHealthOn"));
      },
    }),
    xa.register({
      id: "long-task-warner",
      name: "Long Task Warner",
      summary:
        "Log any browser main-thread task that blocks the page for more than the threshold (default 50ms). Helpful for finding what causes stuttering while watching.",
      masterKey: "longTaskWarnerOn",
      keys: ["longTaskWarnerOn", "longTaskWarnerThreshold"],
      apply(e) {
        if (typeof PerformanceObserver === "undefined") return;
        let a = null;
        let r = 0;
        let o = 0;
        const start = () => {
          if (a) return;
          try {
            a = new PerformanceObserver((n) => {
              try {
                const threshold = Math.max(
                  20,
                  Math.min(1000, Number(S.longTaskWarnerThreshold) || 50),
                );
                const entries = Array.from(
                  n.getEntries ? n.getEntries() : [],
                );
                for (const ev of entries) {
                  const dur = ev.duration || 0;
                  if (dur < threshold) continue;
                  let name = "task";
                  try {
                    name = (ev.name || "task").slice(0, 60);
                  } catch (e) {}
                  (r += 1),
                    h(
                      "long task " + dur.toFixed(1) + "ms (" + name + ")",
                      ev,
                    ),
                    dur > threshold * 2 &&
                      (o >= r - 1 && (o = r - 1),
                      pe(
                        "Long task: " + dur.toFixed(0) + "ms (" + name + ")",
                        1800,
                        "info",
                      ),
                      (o = r));
                }
              } catch (e) {}
            });
            a.observe({ entryTypes: ["longtask"] });
          } catch (e) {
            a = null;
          }
        };
        const stop = () => {
          try {
            a && a.disconnect();
          } catch (e) {}
          a = null;
        };
        S.longTaskWarnerOn && start();
        So("cfg.changed", ({ key: k }) => {
          "longTaskWarnerOn" === k &&
            (S.longTaskWarnerOn ? start() : stop());
        });
        Yt["long-task-warner"].push(stop);
      },
      settings(e) {
        (e.appendChild(Io("Warn on long main-thread tasks", "longTaskWarnerOn")),
          e.appendChild(
            No("Threshold (ms)", "longTaskWarnerThreshold", 20, 200, 10, (e) => e + " ms"),
          ));
      },
    }),
    xa.register({
      id: "dropped-frame-counter",
      name: "Dropped Frame Counter",
      summary:
        "Show how many frames the player is dropping. High drop counts mean the video can't keep up with your connection or device.",
      masterKey: "droppedFrameOn",
      keys: ["droppedFrameOn", "droppedFramePos", "droppedFrameResetOnNav", "droppedFrameShowRate"],
      apply(e) {
        let t = null;
        let a = 0;
        let n = 0;
        let r = 0;
        let o = performance.now();
        let running = false;
        const i = () => {
          if (!S.droppedFrameOn) return;
          const p = S.droppedFramePos || "tr";
          if (t && t.dataset.pos !== p) {
            (t.dataset.pos = p),
              (t.className = "ytp-drop-box ytp-drop-" + p),
              (t.style.top = "tl" === p || "tr" === p ? "8px" : ""),
              (t.style.bottom = "bl" === p || "br" === p ? "48px" : ""),
              (t.style.left = "tl" === p || "bl" === p ? "8px" : ""),
              (t.style.right = "tr" === p || "br" === p ? "8px" : "");
            return;
          }
          if (!t && document.body) {
            (t = document.createElement("div")),
              (t.id = "ytp-drop-box"),
              (t.className = "ytp-drop-box ytp-drop-" + p),
              (t.dataset.pos = p),
              (t.style.cssText =
                "position:fixed;z-index:2147483635;padding:4px 8px;background:rgba(20,22,28,.78);color:#ff8a96;border:1px solid rgba(255,138,150,.28);border-radius:6px;font:11px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:none;min-width:80px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.35)"),
              ("tl" === p || "tr" === p) && (t.style.top = "8px"),
              ("bl" === p || "br" === p) && (t.style.bottom = "48px"),
              ("tl" === p || "bl" === p) && (t.style.left = "8px"),
              ("tr" === p || "br" === p) && (t.style.right = "8px"),
              document.body.appendChild(t);
          }
          if (!t) return;
          const v = ie.el && ie.el();
          if (!v || typeof v.getVideoPlaybackQuality !== "function") {
            t.textContent = "dropped: —";
            return;
          }
          let q = 0;
          try {
            q = v.getVideoPlaybackQuality().droppedVideoFrames || 0;
          } catch (e) {}
          const m = q - a;
          a = q;
          if (m > 0) {
            n += m;
            r += m;
          }
          const now = performance.now();
          const dt = (now - o) / 1e3;
          const rate = dt > 0 ? r / dt : 0;
          const showRate = !!S.droppedFrameShowRate;
          const color = n > 60 ? "#ff5252" : n > 15 ? "#ffd166" : "#9ff";
          t.style.color = color;
          t.textContent = showRate
            ? "dropped: " + rate.toFixed(1) + "/s (total " + n + ")"
            : "dropped: " + n;
          (r = 0), (o = now);
        };
        const d = () => {
          if (!running) return;
          if (!Xt.visible) return void setTimeout(d, 500);
          i();
          setTimeout(d, 1000);
        };
        const c = () => {
          (n = 0), (r = 0), (o = performance.now());
        };
        const start = () => {
          if (running) return;
          running = true;
          c();
          d();
        };
        const stop = () => {
          running = false;
          if (t) {
            try {
              t.remove();
            } catch (e) {}
            t = null;
          }
        };
        S.droppedFrameOn && start();
        e.onNav(() => {
          S.droppedFrameResetOnNav && c();
        });
        So("cfg.changed", ({ key: k }) => {
          if ("droppedFrameOn" === k) {
            S.droppedFrameOn ? start() : stop();
          } else if ("droppedFramePos" === k && t) {
            const p = S.droppedFramePos || "tr";
            (t.dataset.pos = ""),
              (t.className = "ytp-drop-box ytp-drop-" + p),
              (t.dataset.pos = p),
              (t.style.top = "tl" === p || "tr" === p ? "8px" : ""),
              (t.style.bottom = "bl" === p || "br" === p ? "48px" : ""),
              (t.style.left = "tl" === p || "bl" === p ? "8px" : ""),
              (t.style.right = "tr" === p || "br" === p ? "8px" : "");
          }
        });
        Yt["dropped-frame-counter"].push(stop);
      },
      settings(e) {
        (e.appendChild(Io("Show dropped-frame counter", "droppedFrameOn")),
          e.appendChild(
            Ro("Position", "droppedFramePos", {
              tl: "Top-left",
              tr: "Top-right",
              bl: "Bottom-left",
              br: "Bottom-right",
            }),
          ),
          e.appendChild(Io("Show rate (frames/sec) instead of total", "droppedFrameShowRate")),
          e.appendChild(
            Io("Reset counter when the video changes", "droppedFrameResetOnNav"),
          ));
      },
    }),
    xa.register({
      id: "video-stats-overlay",
      name: "Video Stats Overlay",
      summary:
        "Show the current video bitrate, codec, resolution, color depth, and HDR status. Includes a small sparkline of bitrate over the last minute.",
      masterKey: "videoStatsOn",
      keys: ["videoStatsOn", "videoStatsPos"],
      apply(e) {
        let t = null;
        let a = null;
        const samples = [];
        const SAMPLE_HZ = 4;
        const SAMPLE_SECONDS = 60;
        const MAX_SAMPLES = SAMPLE_HZ * SAMPLE_SECONDS;
        const i = () => {
          if (!S.videoStatsOn) return;
          const p = S.videoStatsPos || "bl";
          if (t) {
            if (t.dataset.pos !== p) {
              (t.dataset.pos = p),
                (t.className = "ytp-vstats-box ytp-vstats-" + p),
                (t.style.top = "tl" === p || "tr" === p ? "8px" : ""),
                (t.style.bottom = "bl" === p || "br" === p ? "48px" : ""),
                (t.style.left = "tl" === p || "bl" === p ? "8px" : ""),
                (t.style.right = "tr" === p || "br" === p ? "8px" : "");
            }
            return;
          }
          if (!document.body) return;
          (t = document.createElement("div")),
            (t.id = "ytp-vstats-box"),
            (t.className = "ytp-vstats-box ytp-vstats-" + p),
            (t.dataset.pos = p),
            (t.style.cssText =
              "position:fixed;z-index:2147483635;padding:6px 10px;background:rgba(20,22,28,.82);color:#ddd;border:1px solid rgba(255,255,255,.14);border-radius:8px;font:10.5px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:none;min-width:200px;box-shadow:0 6px 20px rgba(0,0,0,.45)"),
            ("tl" === p || "tr" === p) && (t.style.top = "8px"),
            ("bl" === p || "br" === p) && (t.style.bottom = "48px"),
            ("tl" === p || "bl" === p) && (t.style.left = "8px"),
            ("tr" === p || "br" === p) && (t.style.right = "8px"),
            (a = document.createElement("canvas")),
            (a.width = 180),
            (a.height = 24),
            (a.style.cssText = "display:block;margin-top:4px;width:100%;height:24px;background:rgba(0,0,0,.35);border-radius:3px"),
            t.appendChild(document.createElement("div")),
            t.appendChild(a),
            document.body.appendChild(t);
        };
        const d = () => {
          if (!S.videoStatsOn) return;
          if (!Xt.visible) return void (mainTimer = setTimeout(d, 500));
          i();
          if (!t) return void (mainTimer = setTimeout(d, 500));
          const v = ie.el && ie.el();
          if (!v) {
            t.firstChild.textContent = "no video";
            drawSparkline([]);
            return void (mainTimer = setTimeout(d, 500));
          }
          const stats = gatherStats(v);
          t.firstChild.textContent = formatStats(stats);
          drawSparkline(samples);
          mainTimer = setTimeout(d, 250);
        };
        const sampleTick = () => {
          if (!S.videoStatsOn) return;
          const v = ie.el && ie.el();
          if (v) {
            try {
              pushSample(gatherStats(v));
            } catch (e) {}
          }
          sampleTimer = setTimeout(sampleTick, 1e3 / SAMPLE_HZ);
        };
        let mainTimer = null;
        let sampleTimer = null;
        const start = () => {
          if (mainTimer || sampleTimer) return;
          sampleTimer = setTimeout(sampleTick, 1e3 / SAMPLE_HZ);
          mainTimer = setTimeout(d, 250);
        };
        const stop = () => {
          mainTimer && (clearTimeout(mainTimer), (mainTimer = null));
          sampleTimer && (clearTimeout(sampleTimer), (sampleTimer = null));
          if (t) {
            try {
              t.remove();
            } catch (e) {}
            (t = null), (a = null);
          }
          samples.length = 0;
        };
        const gatherStats = (v) => {
          const out = {
            width: v.videoWidth || 0,
            height: v.videoHeight || 0,
            duration: isFinite(v.duration) ? v.duration : 0,
            currentTime: v.currentTime || 0,
            playbackRate: v.playbackRate || 1,
            paused: v.paused,
            ended: v.ended,
            bitrateKbps: 0,
            codec: "—",
            color: "—",
            hdr: false,
            qualityLabel: "—",
          };
          try {
            const q = v.getVideoPlaybackQuality && v.getVideoPlaybackQuality();
            if (q) {
              out.framesDecoded = q.totalVideoFrames || 0;
              out.framesDropped = q.droppedVideoFrames || 0;
            }
          } catch (e) {}
          try {
            if ("webkitDecodedFrameCount" in v) out.framesDecoded = v.webkitDecodedFrameCount || 0;
            if ("webkitDroppedFrameCount" in v) out.framesDropped = v.webkitDroppedFrameCount || 0;
          } catch (e) {}
          try {
            if (out.currentTime > 0.5) {
              const player = ie.api && ie.api();
              if (player && typeof player.getStatsForNerds === "function") {
                const s = player.getStatsForNerds();
                if (s) {
                  if (s.videoBitrate) out.bitrateKbps = Math.round(Number(s.videoBitrate) / 1e3);
                  if (s.videoFormat || s.videoCodec) out.codec = s.videoFormat || s.videoCodec;
                  if (s.colorTransfer || s.colorSpace) out.color = (s.colorTransfer || s.colorSpace) + (s.colorPrimaries ? " / " + s.colorPrimaries : "");
                  if (s.hdr === "HDR" || s.hdr === true || /hdr/i.test(String(s.hdr || ""))) out.hdr = true;
                }
              }
              if (!out.bitrateKbps && v.webkitVideoDecodedByteCount && out.currentTime > 0) {
                const bytes = v.webkitVideoDecodedByteCount;
                out.bitrateKbps = Math.round((bytes * 8) / out.currentTime / 1e3);
              }
            }
          } catch (e) {}
          try {
            if (out.hdr === false && v.colorSpace) {
              out.hdr = /rec.?2020|pq|hlg/i.test(String(v.colorSpace)) || v.highDynamicRange === true;
            }
          } catch (e) {}
          try {
            const player = ie.api && ie.api();
            if (player && typeof player.getPlaybackQuality === "function") {
              out.qualityLabel = player.getPlaybackQuality() || "—";
            }
          } catch (e) {}
          return out;
        };
        const formatStats = (s) => {
          const lines = [];
          (lines.push(
            (s.width && s.height ? s.width + "x" + s.height : "—") +
              " • " +
              (s.bitrateKbps ? s.bitrateKbps + " kbps" : "— kbps") +
              (s.hdr ? " • HDR" : ""),
          ),
            lines.push(
              "codec: " +
                s.codec +
                " • color: " +
                s.color +
                " • " +
                s.qualityLabel,
            ),
            lines.push(
              "decoded " +
                s.framesDecoded +
                " • dropped " +
                s.framesDropped,
            ));
          return lines.join("\n");
        };
        const pushSample = (stats) => {
          const t0 = performance.now();
          samples.push({ t: t0, kbps: stats.bitrateKbps, w: stats.width, h: stats.height });
          while (samples.length > MAX_SAMPLES) samples.shift();
        };
        const drawSparkline = (data) => {
          if (!a) return;
          try {
            const ctx = a.getContext("2d");
            if (!ctx) return;
            const w = a.width;
            const h = a.height;
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = "rgba(255,255,255,0.04)";
            ctx.fillRect(0, 0, w, h);
            if (data.length < 2) return;
            const now = performance.now();
            const cutoff = now - SAMPLE_SECONDS * 1e3;
            const visible = data.filter((d) => d.t >= cutoff);
            if (visible.length < 2) return;
            const values = visible.map((d) => d.kbps).filter((v) => v > 0);
            if (!values.length) return;
            const minV = Math.min.apply(null, values);
            const maxV = Math.max.apply(null, values);
            const range = maxV - minV || 1;
            ctx.strokeStyle = "#4dd0e1";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let i = 0; i < visible.length; i++) {
              const x = ((visible[i].t - cutoff) / (SAMPLE_SECONDS * 1e3)) * w;
              const kbps = visible[i].kbps;
              const y = kbps > 0 ? h - ((kbps - minV) / range) * (h - 4) - 2 : h - 2;
              0 === i ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.fillStyle = "rgba(77,208,225,0.25)";
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.closePath();
            ctx.fill();
          } catch (e) {}
        };
        const sampleInterval = null;
        S.videoStatsOn && start();
        e.onNav(() => {
          samples.length = 0;
        });
        So("cfg.changed", ({ key: k }) => {
          if ("videoStatsOn" === k) {
            S.videoStatsOn ? start() : stop();
          } else if ("videoStatsPos" === k && t) {
            const p = S.videoStatsPos || "bl";
            (t.dataset.pos = ""),
              (t.className = "ytp-vstats-box ytp-vstats-" + p),
              (t.dataset.pos = p),
              (t.style.top = "tl" === p || "tr" === p ? "8px" : ""),
              (t.style.bottom = "bl" === p || "br" === p ? "48px" : ""),
              (t.style.left = "tl" === p || "bl" === p ? "8px" : ""),
              (t.style.right = "tr" === p || "br" === p ? "8px" : "");
          }
        });
        Yt["video-stats-overlay"].push(stop);
      },
      settings(e) {
        (e.appendChild(Io("Show video stats overlay", "videoStatsOn")),
          e.appendChild(
            Ro("Position", "videoStatsPos", {
              tl: "Top-left",
              tr: "Top-right",
              bl: "Bottom-left",
              br: "Bottom-right",
            }),
          ),
          e.appendChild(
            To(
              "div",
              "ytp-hist-note",
              "Shows current resolution, bitrate, codec, color, HDR status, and quality label from the YouTube player. The mini-graph below tracks bitrate over the last 60 seconds.",
            ),
          ));
      },
    }),
    xa.register({
      id: "block-number-seek",
      name: "Block Number Key Seeking",
      summary:
        "Prevents pressing 0-9 from jumping the video to a percentage of its duration. Useful if you keep accidentally pressing number keys while typing comments.",
      masterKey: "blockNumberSeekOn",
      keys: ["blockNumberSeekOn"],
      apply(e) {
        if (!S.blockNumberSeekOn) return;
        const t = (n) => {
          if (!n.key || n.ctrlKey || n.metaKey || n.altKey) return;
          const a = n.target;
          if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) return;
          if (n.key < "0" || n.key > "9") return;
          const i = ie.el && ie.el();
          if (!i || i.paused) return;
          n.preventDefault();
          n.stopPropagation();
        };
        e.addListener(document, "keydown", t, !0);
        Yt["block-number-seek"].push(() => {});
      },
      settings(e) {
        e.appendChild(Io("Block number keys (0-9) from seeking the video", "blockNumberSeekOn"));
      },
    }),
    xa.register({
      id: "default-audio-track",
      name: "Default to Original Audio Track",
      summary:
        "Always switch the audio track to the original language, even if YouTube picked a different track by default.",
      masterKey: "defaultOriginalAudioOn",
      keys: ["defaultOriginalAudioOn"],
      apply(e) {
        if (!S.defaultOriginalAudioOn) return;
        const t = () => {
          const a = ie.api && ie.api();
          if (!a) return;
          if (typeof a.getAvailableAudioTracks !== "function") return;
          try {
            const r = a.getAvailableAudioTracks();
            if (!r || !r.length) return;
            const o = r.find((t) => t.id && /orig/i.test(t.id || "")) || r[0];
            if (o && o.id && a.setAudioTrack) {
              a.setAudioTrack(o, true);
              pe("Audio: " + (o.label || "original"), 1500, "info");
            }
          } catch (e) {}
        };
        (t(),
          e.onNav(() => e.addTimeout(t, 1500)),
          Yt["default-audio-track"].push(() => {}));
      },
      settings(e) {
        e.appendChild(Io("Default to original audio track", "defaultOriginalAudioOn"));
      },
    }),
    xa.register({
      id: "restore-fullscreen-scrolling",
      name: "Allow Scrolling in Fullscreen",
      summary:
        "Re-enables mouse-wheel scrolling while the player is in fullscreen mode. YouTube normally locks the page scroll when the player is fullscreen.",
      masterKey: "restoreFsScrollOn",
      keys: ["restoreFsScrollOn"],
      apply(e) {
        if (!S.restoreFsScrollOn) return;
        const t = document.createElement("style");
        (t.id = "ytp-restore-fs-scroll"),
          (t.textContent =
            ".html5-video-player:-webkit-full-screen{overflow:auto!important}.html5-video-player:fullscreen{overflow:auto!important}"),
          (document.head || document.documentElement).appendChild(t);
        Yt["restore-fullscreen-scrolling"].push(() => {
          try {
            t.remove();
          } catch (e) {}
        });
      },
      settings(e) {
        e.appendChild(Io("Allow scrolling when the player is in fullscreen", "restoreFsScrollOn"));
      },
    }),
    xa.register({
      id: "remove-redirect-urls",
      name: "Skip YouTube /redirect URLs",
      summary:
        "Replaces YouTube's /redirect URLs (used in description links and annotations) with the real destination, so you don't have to click through the warning interstitial.",
      masterKey: "removeRedirectUrlsOn",
      keys: ["removeRedirectUrlsOn"],
      apply(e) {
        if (!S.removeRedirectUrlsOn) return;
        const t = (a) => {
          if (!a || a.tagName !== "A") return;
          const n = a.getAttribute("href") || "";
          if (!/^https?:\/\/(?:www\.)?youtube\.com\/redirect\b/i.test(n)) return;
          try {
            const r = new URL(n);
            const o = r.searchParams.get("q");
            if (o) a.setAttribute("href", o);
          } catch (e) {}
        };
        const n = new MutationObserver((e) => {
          for (const a of e)
            if (a.type === "attributes" && a.attributeName === "href") t(a.target);
            else if (a.type === "childList")
              for (const e of a.addedNodes) {
                if (e.nodeType !== 1) continue;
                if (e.tagName === "A") t(e);
                if (e.querySelectorAll) e.querySelectorAll("a[href]").forEach(t);
              }
        });
        n.observe(document.body || document.documentElement, {
          childList: !0,
          subtree: !0,
          attributes: !0,
          attributeFilter: ["href"],
        });
        document.querySelectorAll && document.querySelectorAll("a[href]").forEach(t);
        Yt["remove-redirect-urls"].push(() => {
          try {
            n.disconnect();
          } catch (e) {}
        });
      },
      settings(e) {
        e.appendChild(Io("Replace /redirect links with their real URLs", "removeRedirectUrlsOn"));
      },
    }),
    xa.register({
      id: "shorten-share-url",
      name: "Shorten Share URLs",
      summary:
        "Strips tracking parameters (si, feature) from youtu.be share links, producing a clean URL that's easier to copy and forward.",
      masterKey: "shortenShareUrlOn",
      keys: ["shortenShareUrlOn"],
      apply(e) {
        if (!S.shortenShareUrlOn) return;
        const t = (a) => {
          if (!a || a.tagName !== "A") return;
          const n = a.getAttribute("href") || "";
          if (!/^https?:\/\/youtu\.be\//i.test(n)) return;
          try {
            const r = new URL(n);
            const o = r.pathname.replace(/^\//, "");
            const i = o + (r.searchParams.get("t") ? "?t=" + r.searchParams.get("t") : "");
            a.setAttribute("href", "https://youtu.be/" + i);
            a.setAttribute("data-shortened", "1");
          } catch (e) {}
        };
        const a = new MutationObserver((e) => {
          for (const a of e)
            if (a.type === "attributes" && a.attributeName === "href") t(a.target);
            else if (a.type === "childList")
              for (const e of a.addedNodes) {
                if (e.nodeType !== 1) continue;
                if (e.tagName === "A") t(e);
                if (e.querySelectorAll) e.querySelectorAll("a[href]").forEach(t);
              }
        });
        a.observe(document.body || document.documentElement, {
          childList: !0,
          subtree: !0,
          attributes: !0,
          attributeFilter: ["href"],
        });
        document.querySelectorAll && document.querySelectorAll("a[href]").forEach(t);
        Yt["shorten-share-url"].push(() => {
          try {
            a.disconnect();
          } catch (e) {}
        });
      },
      settings(e) {
        e.appendChild(Io("Clean up youtu.be share links", "shortenShareUrlOn"));
      },
    }),
    xa.register({
      id: "skip-paused-continue",
      name: "Auto-Continue Paused Video",
      summary:
        "Auto-dismisses the 'Video paused. Continue watching?' dialog that appears when you switch tabs and come back.",
      masterKey: "skipPausedContinueOn",
      keys: ["skipPausedContinueOn"],
      apply(e) {

        if (!S.skipPausedContinueOn) return;
        const run = ee(() => {
          const btn = _ytpPausedDialogConfirmBtn();
          if (btn) {
            try {
              btn.click();
            } catch (err) {}
          }
        }, 250);
        const host =
          document.querySelector("ytd-popup-container") ||
          document.body ||
          document.documentElement;
        e.addObserver(host, run, { childList: !0, subtree: !0 });
        run();
      },
      settings(e) {
        e.appendChild(Io("Auto-click 'Continue watching' in the paused-video dialog", "skipPausedContinueOn"));
      },
    }),
    xa.register({
      id: "click-logo-to-subs",
      name: "Click Logo to Subscriptions",
      summary:
        "Click the YouTube logo in the top-left to go to your Subscriptions feed instead of Home.",
      masterKey: "logoToSubsOn",
      keys: ["logoToSubsOn"],
      apply(e) {
        if (!S.logoToSubsOn) return;
        const t = (n) => {
          const a = n.target && n.target.closest && n.target.closest("#logo, ytd-topbar-logo-renderer, ytd-logo");
          if (!a) return;
          n.preventDefault();
          n.stopPropagation();
          try {
            location.href = "/feed/subscriptions";
          } catch (e) {}
        };
        e.addListener(document, "click", t, !0);
        Yt["click-logo-to-subs"].push(() => {});
      },
      settings(e) {
        e.appendChild(Io("Clicking the YouTube logo goes to Subscriptions", "logoToSubsOn"));
      },
    }),
    xa.register({
      id: "default-channel-tab",
      name: "Default Channel Tab",
      summary:
        "When opening a channel page, jump to the tab you choose (Videos, Shorts, Live, Playlists, Community, About) instead of the default Featured tab.",
      masterKey: "defaultChannelTab",
      keys: ["defaultChannelTab"],
      apply(e) {
        e.onNav(() => {
          const want = S.defaultChannelTab || "featured";
          if (want === "featured") return;
          const r = location.pathname.match(/^\/(@[^\/]+)\/?$/);
          if (!r) return;
          try {
            location.replace(r[1] + "/" + want);
          } catch (e) {}
        });
      },
      settings(e) {
        const tabs = {
          featured: "Featured (default)",
          videos: "Videos",
          shorts: "Shorts",
          live: "Live",
          playlists: "Playlists",
          community: "Community",
          about: "About",
        };
        e.appendChild(Ro("Default channel tab", "defaultChannelTab", tabs));
      },
    }),
    xa.register({
      id: "compact-mode",
      name: "Compact Mode",
      summary:
        "Reduces margins, padding, and gaps across the entire YouTube interface to maximize information density and usability.",
      masterKey: "compactModeOn",
      keys: ["compactModeOn"],
      apply(e) {
        if (!S.compactModeOn) return;
        const t = document.createElement("style");
        (t.id = "ytp-compact-mode"),
          (t.textContent =
            ":root{--ytp-compact-masthead-height:44px!important;--ytp-compact-gap-xs:4px!important;--ytp-compact-gap-sm:8px!important;--ytp-compact-gap-md:12px!important;--ytp-compact-gap-lg:16px!important;--ytp-compact-btn-padding:0 10px!important}ytd-masthead{height:var(--ytp-compact-masthead-height)!important}#container.ytd-masthead{height:var(--ytp-compact-masthead-height)!important;padding:0 8px!important}#search-form.ytd-searchbox,#container.ytd-searchbox,#search-icon-legacy.ytd-searchbox{height:32px!important}#search-icon-legacy.ytd-searchbox{width:48px!important}tp-yt-paper-item.ytd-guide-entry-renderer{min-height:32px!important;height:32px!important}#guide-links-primary.ytd-guide-renderer,#guide-links-secondary.ytd-guide-renderer,#footer.ytd-guide-renderer{padding:8px 16px!important}ytd-guide-section-renderer{padding:4px 0!important}ytd-rich-grid-renderer{--ytd-rich-grid-row-margin:var(--ytp-compact-gap-sm)!important;--ytd-rich-grid-item-margin:var(--ytp-compact-gap-sm)!important}#contents.ytd-rich-grid-renderer{padding-top:var(--ytp-compact-gap-sm)!important}ytd-rich-grid-row,#contents.ytd-rich-grid-row{margin:0!important}ytd-rich-item-renderer{margin-bottom:var(--ytp-compact-gap-md)!important;margin-right:var(--ytp-compact-gap-sm)!important}ytd-compact-video-renderer{padding:2px 0!important;margin-bottom:var(--ytp-compact-gap-xs)!important}#dismissible.ytd-compact-video-renderer{padding:2px 0!important}#owner.ytd-watch-metadata{margin-right:var(--ytp-compact-gap-sm)!important}#actions.ytd-watch-metadata{margin-top:var(--ytp-compact-gap-xs)!important;margin-bottom:var(--ytp-compact-gap-xs)!important}ytd-subscribe-button-renderer{--ytd-subscribe-button-padding:0 12px!important}yt-button-shape{--yt-button-shape-padding:var(--ytp-compact-btn-padding)!important;--yt-button-shape-height:32px!important}#top-row.ytd-watch-metadata{padding-top:var(--ytp-compact-gap-xs)!important;padding-bottom:var(--ytp-compact-gap-xs)!important;margin-bottom:var(--ytp-compact-gap-xs)!important}ytd-comment-thread-renderer{margin-bottom:var(--ytp-compact-gap-sm)!important}ytd-comment-renderer{--ytd-comment-avatar-size:32px!important}#body.ytd-comment-renderer{margin-left:var(--ytp-compact-gap-sm)!important}#author-thumbnail.ytd-comment-renderer,#author-thumbnail.ytd-comment-simplebox-renderer{width:32px!important;height:32px!important}ytd-playlist-panel-video-renderer{padding:4px 8px!important}#playlist-items.ytd-playlist-panel-renderer{padding:var(--ytp-compact-gap-xs) 0!important}ytd-video-renderer{margin-bottom:var(--ytp-compact-gap-sm)!important}#dismissible.ytd-video-renderer{padding:var(--ytp-compact-gap-xs) 0!important}#channel-header{padding:var(--ytp-compact-gap-sm) 0!important}#tabs-inner.ytd-c4-tabbed-header-renderer{height:40px!important}#banner.ytd-c4-tabbed-header-renderer{max-height:180px!important}tp-yt-paper-listbox{padding:var(--ytp-compact-gap-xs) 0!important}ytd-menu-navigation-item-renderer,ytd-menu-service-item-renderer{min-height:32px!important}tp-yt-paper-item{min-height:32px!important}"),
          (document.head || document.documentElement).appendChild(t);
        Yt["compact-mode"].push(() => {
          try {
            t.remove();
          } catch (e) {}
        });
      },
      settings(e) {
        e.appendChild(Io("Enable Compact Mode", "compactModeOn"));
      },
    }),
    xa.register({
      id: "blur-thumbnails",
      name: "Blur Thumbnails",
      summary:
        "Blur video thumbnails until you hover over them. Reduces the visual pull of recommendations and helps you focus.",
      masterKey: "blurThumbnailsOn",
      keys: ["blurThumbnailsOn", "blurThumbnailsAmount"],
      apply(e) {
        if (!S.blurThumbnailsOn) return;
        const t = document.createElement("style");
        (t.id = "ytp-blur-thumbs"),
          (t.textContent =
            "ytd-rich-item-renderer #thumbnail yt-image img, ytd-thumbnail img, ytd-playlist-thumbnail img{filter:blur(" +
            (Number(S.blurThumbnailsAmount) || 12) +
            "px)!important;transition:filter .25s ease-out}ytd-rich-item-renderer:hover #thumbnail yt-image img, ytd-thumbnail:hover img{filter:blur(0)!important}"),
          (document.head || document.documentElement).appendChild(t);
        Yt["blur-thumbnails"].push(() => {
          try {
            t.remove();
          } catch (e) {}
        });
      },
      settings(e) {
        (e.appendChild(Io("Blur video thumbnails until hover", "blurThumbnailsOn")),
          e.appendChild(
            No("Blur strength", "blurThumbnailsAmount", 4, 30, 2, (e) => e + "px"),
          ));
      },
    }),
    xa.register({
      id: "hide-top-live-games",
      name: "Hide Top Live Games",
      summary:
        "Hides the 'Top live games' shelf that YouTube sometimes shows on the Home feed.",
      masterKey: "hideTopLiveGamesOn",
      keys: ["hideTopLiveGamesOn"],
      apply(e) {
        if (!S.hideTopLiveGamesOn) return;
        const t = () => {
          const a = document.querySelectorAll("ytd-shelf-renderer");
          for (const n of a) {
            if (n.dataset && n.dataset.ytpTLGHidden) continue;
            const r = n.querySelector("h2");
            if (r && /top live games/i.test(r.textContent || "")) {
              (n.style.display = "none"), (n.dataset.ytpTLGHidden = "1");
            }
          }
        };
        t();
        const a = new MutationObserver(t);
        a.observe(document.body || document.documentElement, { childList: !0, subtree: !0 });
        Yt["hide-top-live-games"].push(() => {
          try {
            a.disconnect();
          } catch (e) {}
          document.querySelectorAll("ytd-shelf-renderer[data-ytp-tlg-hidden]").forEach((e) => {
            e.style.display = "";
            delete e.dataset.ytpTLGHidden;
          });
        });
      },
      settings(e) {
        e.appendChild(Io("Hide the 'Top live games' shelf on Home", "hideTopLiveGamesOn"));
      },
    }),
    xa.register({
      id: "hfr-allow",
      name: "Allow High Frame Rate",
      summary:
        "Sets the VISITOR_INFO1_LIVE cookie that unlocks 60fps streams. Reload the video after enabling to see HFR options in the quality menu.",
      masterKey: "hfrAllowOn",
      keys: ["hfrAllowOn"],
      apply(e) {
        if (!S.hfrAllowOn) return;
        const t = () => {
          try {
            const n = Math.random().toString(36).slice(2, 14) + "QfX";
            if (typeof ti !== 'undefined' && ti.cookieControl && ti.cookieControl.manager) {
              ti.cookieControl.manager.set("VISITOR_INFO1_LIVE", n, { domain: ".youtube.com", path: "/", maxAge: 6 * 30 * 24 * 60 * 60 });
            } else {
              document.cookie =
                "VISITOR_INFO1_LIVE=" +
                n +
                "; domain=.youtube.com; path=/; max-age=" +
                6 * 30 * 24 * 60 * 60;
            }
            pe(
              "HFR cookie set - reload this video to see 60fps options.",
              3000,
              "info",
            );
          } catch (e) {}
        };
        t();
        Yt["hfr-allow"].push(() => {});
      },
      settings(e) {
        e.appendChild(Io("Enable high frame rate (HFR/60fps) playback", "hfrAllowOn"));
      },
    }),
    xa.register({
      id: "open-settings-on-hover",
      name: "Open YT Settings on Hover",
      summary:
        "Hovering over the player settings (gear) button instantly opens the settings menu, instead of needing a click.",
      masterKey: "openSettingsOnHoverOn",
      keys: ["openSettingsOnHoverOn"],
      apply(e) {
        if (!S.openSettingsOnHoverOn) return;
        let t = null;
        const a = (n) => {
          const r = n.target && n.target.closest && n.target.closest(".ytp-settings-button");
          if (!r) return;
          clearTimeout(t);
          t = setTimeout(() => {
            try {
              r.click();
            } catch (e) {}
          }, 300);
        };
        const n = () => clearTimeout(t);
        e.addListener(document, "mouseover", a, !0);
        e.addListener(document, "mouseout", n, !0);
        Yt["open-settings-on-hover"].push(() => {
          clearTimeout(t);
        });
      },
      settings(e) {
        e.appendChild(Io("Hover the settings button to open the menu", "openSettingsOnHoverOn"));
      },
    }),
    xa.register({
      id: "auto-recover-video",
      name: "Auto-Recover Video on Reconnect",
      summary:
        "If the video pauses because your internet dropped, automatically resume playback once the connection is restored.",
      masterKey: "autoRecoverOn",
      keys: ["autoRecoverOn"],
      apply(e) {
        if (!S.autoRecoverOn) return;
        const t = () => {
          if (!navigator.onLine) return;
          const a = ie.el && ie.el();
          if (!a) return;
          if (a.paused) {
            a.play().catch(() => {});
            pe("Network restored - resuming video", 2000, "success");
          }
        };
        e.addListener(window, "online", t);
        Yt["auto-recover-video"].push(() => {});
      },
      settings(e) {
        e.appendChild(Io("Auto-resume the video when internet comes back", "autoRecoverOn"));
      },
    }),
    xa.register({
      id: "background-players-pause",
      name: "Pause Background Players",
      summary:
        "Pauses YouTube videos in background tabs whenever you switch to another tab. Saves bandwidth and CPU.",
      masterKey: "bgPlayersPauseOn",
      keys: ["bgPlayersPauseOn"],
      apply(e) {
        if (!S.bgPlayersPauseOn) return;
        let t = null;
        const a = () => {
          if (document.visibilityState === "visible") {
            t && (clearTimeout(t), (t = null));
            return;
          }
          t = setTimeout(() => {
            const n = ie.el && ie.el();
            n && !n.paused && !n.ended && n.pause();
          }, 500);
        };
        e.addListener(document, "visibilitychange", a);
        Yt["background-players-pause"].push(() => {
          t && clearTimeout(t);
        });
      },
      settings(e) {
        e.appendChild(Io("Pause the video when the tab is hidden", "bgPlayersPauseOn"));
      },
    }),
    xa.register({
      id: "forward-rewind-buttons",
      name: "Forward / Rewind Buttons",
      summary:
        "Adds forward and rewind buttons to the player. Configurable step (default 10 seconds).",
      masterKey: "forwardRewindOn",
      keys: ["forwardRewindOn", "forwardRewindSec"],
      apply(e) {
        if (!S.forwardRewindOn) return;
        const t = () => {
          const r = document.querySelector("#movie_player .ytp-left-controls, .html5-video-player .ytp-left-controls");
          if (!r || r.querySelector(".ytp-fr-btn")) return;
          const o = ie.el && ie.el();
          if (!o) return;
          const s = Math.max(1, Number(S.forwardRewindSec) || 10);
          const i = document.createElement("button");
          (i.type = "button"),
            (i.className = "ytp-button ytp-extra-btn ytp-fr-btn ytp-fr-rewind"),
            (i.title = "Rewind " + s + " seconds"),
            i.setAttribute("aria-label", "Rewind " + s + " seconds"),
            a(
              i,
              wr('<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 6v12L4 12zM20 6v12l-7-6z"/></svg>'),
            ),
            i.addEventListener(
              "click",
              (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                try {
                  o.currentTime = Math.max(0, o.currentTime - s);
                } catch (e) {}
              },
              !0,
            );
          const l = document.createElement("button");
          (l.type = "button"),
            (l.className = "ytp-button ytp-extra-btn ytp-fr-btn ytp-fr-forward"),
            (l.title = "Forward " + s + " seconds"),
            l.setAttribute("aria-label", "Forward " + s + " seconds"),
            a(
              l,
              wr('<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 6v12l7-6zM4 6v12l7-6z"/></svg>'),
            ),
          l.addEventListener(
            "click",
            (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              try {
                o.currentTime = Math.min(o.duration || 1e9, o.currentTime + s);
              } catch (e) {}
            },
            !0,
          );
          const c = r.querySelector(".ytp-play-button");
          const d = c && c.parentNode === r ? c.nextSibling : null;
          d && d.parentNode === r ? r.insertBefore(i, d) : r.appendChild(i);
          d && d.parentNode === r ? r.insertBefore(l, d) : r.appendChild(l);
        };
        t();
        Mr("forward-rewind", t);
        e.onNav(() => e.addTimeout(t, 700));
        Yt["forward-rewind-buttons"].push(() => {
          document.querySelectorAll(".ytp-fr-btn").forEach((e) => e.remove());
        });
      },
      settings(e) {
        (e.appendChild(Io("Show forward and rewind buttons in the player", "forwardRewindOn")),
          e.appendChild(
            No("Step (seconds)", "forwardRewindSec", 1, 120, 1, (e) => e + "s"),
          ));
      },
    }),
    xa.register({
      id: "reverse-playlist",
      name: "Reverse Playlist Order",
      summary:
        "Adds a button to reverse the order of videos in a playlist. Useful for rewatching or undoing an unintended sort.",
      masterKey: "reversePlaylistOn",
      keys: ["reversePlaylistOn"],
      apply(e) {
        if (!S.reversePlaylistOn) return;
        const t = () => {
          if (!location.pathname.includes("/playlist")) return;
          const a = document.querySelector("ytd-playlist-header-renderer");
          if (!a || a.querySelector("#ytp-reverse-pl-btn")) return;
          const n = document.createElement("button");
          (n.id = "ytp-reverse-pl-btn"),
            (n.type = "button"),
            (n.className = "ytp-btn"),
            (n.textContent = "↕ Reverse"),
            (n.title = "Reverse the playlist order"),
            n.style.cssText = "margin-left:8px";
          n.addEventListener("click", () => {
            try {
              const a = document.querySelectorAll("ytd-playlist-video-renderer");
              if (a.length < 2) {
                pe("Not enough videos to reverse", 1500, "info");
                return;
              }
              const r = a[0] && a[0].parentNode;
              if (r) {
                const o = Array.from(a).reverse();
                o.forEach((e) => r.appendChild(e));
                pe("Playlist reversed (" + a.length + " videos)", 1500, "success");
              }
            } catch (e) {
              pe("Couldn't reverse", 1500, "error");
            }
          });
          const r =
            a.querySelector("#top-level-buttons, #buttons, .metadata-actions, #meta") || a;
          r.appendChild(n);
        };
        t();
        Mr("reverse-playlist", t);
        e.onNav(() => e.addTimeout(t, 800));
        Yt["reverse-playlist"].push(() => {
          const a = document.getElementById("ytp-reverse-pl-btn");
          a && a.remove();
        });
      },
      settings(e) {
        e.appendChild(Io("Show a 'Reverse' button on playlist pages", "reversePlaylistOn"));
      },
    }),
    xa.register({
      id: "flip-video",
      name: "Flip Video",
      summary:
        "Mirror the video horizontally or vertically. Useful for tutorials, screen recordings, or just for fun.",
      masterKey: "flipVideoOn",
      keys: ["flipVideoOn", "flipVideoH", "flipVideoV"],
      apply(e) {
        const t = () => {
          if (!S.flipVideoOn) return;
          const n = ie.el && ie.el();
          if (!n) return;
          const r = (S.flipVideoH ? -1 : 1) + "," + (S.flipVideoV ? -1 : 1);
          try {
            n.style.transform = "scale(" + r + ")";
          } catch (e) {}
        };
        const mount = () => {
          const r = document.querySelector("#movie_player .ytp-right-controls");
          if (!r || r.querySelector(".ytp-flip-btn")) return;
          const o = ie.el && ie.el();
          if (!o) return;
          const i = document.createElement("button");
          (i.type = "button"),
            (i.className = "ytp-button ytp-extra-btn ytp-flip-btn"),
            (i.title = "Flip horizontally"),
            i.setAttribute("aria-label", "Flip horizontally"),
            a(
              i,
              wr('<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 21h2v-2h-2v2zm4-12h-2v2h2V9zm0 4h-2v2h2v-2zm-4-4h-2v6h2V9zm-4 6h2V9H7v6zm12-10V3l-4 4 4 4V7zM5 7v4l4-4-4-4v3H3v2h2z"/></svg>'),
            ),
            i.addEventListener(
              "click",
              (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                Ta("flipVideoH", !S.flipVideoH);
                t();
              },
              !0,
            );
          const l = document.createElement("button");
          (l.type = "button"),
            (l.className = "ytp-button ytp-extra-btn ytp-flip-btn ytp-flip-v"),
            (l.title = "Flip vertically"),
            l.setAttribute("aria-label", "Flip vertically"),
            a(
              l,
              wr('<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 15v2h2v-2H3zm4 0v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm4-2v2H4v-2h15zm0-4H4V7h15v2z"/></svg>'),
            ),
          l.addEventListener(
            "click",
            (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              Ta("flipVideoV", !S.flipVideoV);
              t();
            },
            !0,
          );
          const c = r.querySelector(".ytp-fullscreen-button");
          const d = c && c.parentNode === r ? c : null;
          d && d.parentNode === r ? r.insertBefore(i, d) : r.appendChild(i),
            d && d.parentNode === r ? r.insertBefore(l, d) : r.appendChild(l);
        };
        S.flipVideoOn && (mount(), t());
        Mr("flip-video", () => S.flipVideoOn && mount());
        e.onNav(() => e.addTimeout(() => S.flipVideoOn && (mount(), t()), 1200));
        So("cfg.changed", ({ key: n }) => {
          if ("flipVideoOn" === n) {
            if (S.flipVideoOn) mount(), t();
            else {
              const r = ie.el && ie.el();
              r && (r.style.transform = "");
              document.querySelectorAll(".ytp-flip-btn").forEach((e) => e.remove());
            }
          } else if (n === "flipVideoH" || n === "flipVideoV") t();
        });
        Yt["flip-video"].push(() => {
          const n = ie.el && ie.el();
          n && (n.style.transform = "");
          document.querySelectorAll(".ytp-flip-btn").forEach((e) => e.remove());
        });
      },
      settings(e) {
        e.appendChild(Io("Show flip buttons in the player", "flipVideoOn"));
        e.appendChild(Io("Flip horizontally by default", "flipVideoH"));
        e.appendChild(Io("Flip vertically by default", "flipVideoV"));
      },
    }));
  let _n = null;

  function _nClear() {
    if (!_n) return;
    try {
      _n.btn.classList.remove("listening");
    } catch (e) {}
    if (_n.btn && "press a key…" === _n.btn.textContent) {
      try { _n.btn.textContent = _n.prevText; } catch (e) {}
    }
    if (_n.handler) {
      try {
        document.removeEventListener("keydown", _n.handler, !0);
      } catch (e) {}
    }
    _n = null;
  }
  function Hn(e) {
    e.replaceChildren();
    const t = To(
      "div",
      "ytp-hist-note",
      "Click any box, then press the key combination you want to use. Combinations with Ctrl, Shift, Alt, or Command are supported. Press the [x] button to remove a shortcut. Note that keyboard shortcuts require the master “Keyboard shortcuts” switch at the top of the dashboard to be turned on.",
    );
    e.appendChild(t);
    const a = Oo(
      "Reset all to defaults",
      () => {
        e.confirm("Reset every hotkey to its default?") &&
          (Ta("hotkeyMap", {}), Hn(e));
      },
      "ytp-danger",
    );
    e.appendChild(Eo([a]));
    for (const t of Zo) {
      const a = To("div", "ytp-hk-row");
      a.appendChild(To("div", "ytp-hk-lbl", t.label));
      const n = Qo(t),
        r = document.createElement("button");
      ((r.type = "button"),
        (r.className = "ytp-hk-key" + (n ? "" : " empty")),
        (r.textContent = n ? $o(n) : "unbound"),
        r.addEventListener("click", () => {

          _nClear();
          const e = r.textContent;
          (r.classList.add("listening"), (r.textContent = "press a key…"));
          const a = (n) => {
            if (
              [
                "ShiftLeft",
                "ShiftRight",
                "ControlLeft",
                "ControlRight",
                "AltLeft",
                "AltRight",
                "MetaLeft",
                "MetaRight",
              ].includes(n.code)
            )
              return;
            (n.preventDefault(), n.stopPropagation());
            const o = Jo(n);

            _nClear();
            if ("Escape" === n.key) {
              r.textContent = e;
              return;
            }
            const i = Object.assign({}, S.hotkeyMap || {});
            ((i[t.id] = o),
              Ta("hotkeyMap", i),
              (r.textContent = $o(o)),
              r.classList.remove("empty"));
            for (const e of Zo)
              if (e.id !== t.id && Qo(e) === o) {
                pe(
                  "That shortcut is also used by “" + e.label + "”.",
                  3e3,
                  "info",
                );
                break;
              }
          };

          ((_n = { btn: r, prevText: e, handler: a }),
            document.addEventListener("keydown", a, !0));
        }),
        a.appendChild(r));
      const o = document.createElement("button");
      ((o.type = "button"),
        (o.className = "ytp-hk-clr"),
        (o.textContent = "[x]"),
        (o.title = "Unbind"),
        o.addEventListener("click", () => {
          const e = Object.assign({}, S.hotkeyMap || {});
          ((e[t.id] = ""),
            Ta("hotkeyMap", e),
            (r.textContent = "unbound"),
            r.classList.add("empty"));
        }),
        a.appendChild(o),
        e.appendChild(a));
    }
  }
  (xa.register({
      id: "session-replay",
      name: "Click & Navigation Recorder",
      summary:
        "Keep a local record of where you click and navigate during your session, stored securely on your own computer.",
      masterKey: "sessionReplay",
      keys: ["sessionReplay"],
      apply(e) {
        S.sessionReplay &&
          (e.addListener(
            document,
            "click",
            (e) => {
              k("replay", {
                t: Date.now(),
                kind: "click",
                tag: e.target && e.target.tagName,
                url: location.pathname,
              });
            },
            !0,
          ),
          e.onNav(() =>
            k("replay", { t: Date.now(), kind: "nav", url: location.href }),
          ));
      },
      settings() {},
    }),
    xa.register({
      id: "api-explorer",
      name: "Developer Player Control",
      summary:
        "Allow external tools and browser developer consoles to directly interact with the YouTube video player.",
      hidden: !0,
      masterKey: "apiExplorer",
      keys: ["apiExplorer", "apiExplorerMutations"],
      apply(t) {
        if (S.apiExplorer)
          ((e.YTPlus._api = {
            get player() {
              return ie.api();
            },
            call(e, ...t) {
              if (!S.apiExplorerMutations)
                throw new Error("Enable mutations in feature settings");
              const a = ie.api();
              if (!a || "function" != typeof a[e])
                throw new Error("no such method");
              return a[e](...t);
            },
          }),
            Yt["api-explorer"].push(() => {
              try {
                delete e.YTPlus._api;
              } catch (e) {}
            }));
        else
          try {
            delete e.YTPlus._api;
          } catch (e) {}
      },
      settings(e) {
        e.appendChild(
          Io(
            "Allow external tools to modify player settings",
            "apiExplorerMutations",
          ),
        );
      },
    }));
  const Dn = 36e5;
  function qn(e) {
    return Math.floor((e ?? Date.now()) / Dn);
  }
  const Vn = { h: -1, down: 0, up: 0, reqs: 0, hosts: {} };
  let Fn = 0,
    jn = !1,
    zn = null,
    Wn = null,
    Un = null,
    Kn = null,
    Yn = null;
  const Gn = { sessionDown: 0, sessionUp: 0, sessionReqs: 0 };
  function Xn(e) {
    try {
      return new URL(e, location.origin).host;
    } catch (e) {
      return location.host;
    }
  }
  function Zn(e) {
    return (
      !!e &&
      (e.endsWith("youtube.com") ||
        e.endsWith("ytimg.com") ||
        e.endsWith("googlevideo.com") ||
        e.endsWith("ggpht.com") ||
        e.endsWith("youtu.be") ||
        e.endsWith("youtube-nocookie.com"))
    );
  }
  function Qn(e) {
    if (!e) return 0;
    try {
      if ("string" == typeof e) return new Blob([e]).size;
      if (e instanceof Blob) return e.size;
      if (e instanceof ArrayBuffer) return e.byteLength;
      if (ArrayBuffer.isView(e)) return e.byteLength;
      if (e instanceof FormData) {
        let t = 0;
        for (const [a, n] of e)
          ((t += a.length),
            "string" == typeof n
              ? (t += n.length)
              : n && n.size && (t += n.size));
        return t;
      }
      if (e instanceof URLSearchParams) return e.toString().length;
    } catch (e) {}
    return 0;
  }
  const Jn = {
    160: "144p",
    133: "240p",
    134: "360p",
    135: "480p",
    136: "720p",
    137: "1080p",
    138: "2160p",
    264: "1440p",
    266: "2160p",
    298: "720p60",
    299: "1080p60",
    303: "1080p",
    304: "1440p",
    305: "2160p",
    308: "1440p60",
    278: "144p",
    242: "240p",
    243: "360p",
    244: "480p",
    247: "720p",
    248: "1080p",
    271: "1440p",
    313: "2160p",
    315: "2160p60",
    272: "4320p",
    139: "AAC-48k",
    140: "AAC-128k",
    141: "AAC-256k",
    171: "Vorbis-128k",
    249: "Opus-50k",
    250: "Opus-70k",
    251: "Opus-160k",
    18: "360p-mux",
    22: "720p-mux",
    37: "1080p-mux",
    59: "480p-mux",
    43: "360p-webm",
  };
  function $n(e, t, a, n) {
    if (!e || !Zn(e)) return;
    const r = qn();
    if (
      (Vn.h !== r && (tr(), (Vn.h = r)),
      t > 0 && ((Vn.down += t), (Gn.sessionDown += t)),
      a > 0 && ((Vn.up += a), (Gn.sessionUp += a)),
      (Vn.reqs += 1),
      (Gn.sessionReqs += 1),
      (Vn.hosts[e] = (Vn.hosts[e] || 0) + (t + a)),
      S.netQualityAttribOn &&
        n &&
        (e.endsWith("googlevideo.com") || e.endsWith("ytimg.com")))
    ) {
      const e = (function (e) {
        if (!e) return null;
        const t = String(e).match(/[?&]itag=(\d+)/);
        return t ? t[1] : null;
      })(n);
      if (e) {
        const n = (function (e) {
          if (!e) return "other";
          if (/AAC|Opus|Vorbis/.test(e)) return "audio";
          const t = e.match(/(\d{3,4})p/);
          if (!t) return "other";
          const a = parseInt(t[1], 10);
          return a >= 2160
            ? "4K+"
            : a >= 1440
              ? "1440p"
              : a >= 1080
                ? "1080p"
                : a >= 720
                  ? "720p"
                  : a >= 480
                    ? "480p"
                    : a >= 360
                      ? "360p"
                      : "240p-";
        })(
          (function (e) {
            return Jn[String(e)] || "itag-" + e;
          })(e),
        );
        ((Vn.qualities = Vn.qualities || {}),
          (Vn.qualities[n] = (Vn.qualities[n] || 0) + (t + a)));
      }
    }
    ((jn = !0),
      Fn || (Fn = setTimeout(er, 5e3)),
      S.netMonitorBadge && hr(),
      S.netBudgetOn &&
        (function () {
          const e = Date.now();
          e - sr < 3e4 ||
            ((sr = e),
            (async function () {
              if (!cr) {
                cr = !0;
                try {
                  const e = await lr(),
                    t = 1024 * (Number(S.netBudgetGB) || 0) * 1024 * 1024;
                  if (t <= 0) return;
                  const a = e / t,
                    n = new Date().toISOString().slice(0, 7),
                    r = (S.netBudgetAlerted && S.netBudgetAlerted[n]) || {},
                    o = (t, a, n) => {
                      r[t] ||
                        ((r[t] = Date.now()),
                        pe(
                          "[!] Bandwidth budget " +
                            a +
                            " - " +
                            or(e) +
                            " / " +
                            S.netBudgetGB +
                            " GB",
                          4500,
                          n || "error",
                        ));
                    };
                  a >= 1
                    ? o("100", "EXCEEDED", "error")
                    : a >= 0.95
                      ? o("95", "at 95%", "error")
                      : a >= 0.8 && o("80", "at 80%", "info");
                  const i = Object.assign({}, S.netBudgetAlerted || {});
                  i[n] = r;
                  const d = Object.keys(i).sort();
                  for (; d.length > 6; ) delete i[d.shift()];
                  JSON.stringify(i) !==
                    JSON.stringify(S.netBudgetAlerted || {}) &&
                    Ta("netBudgetAlerted", i);
                } finally {
                  cr = !1;
                }
              }
            })());
        })());
  }
  async function er() {
    if (((Fn = 0), !jn || Vn.h < 0)) return;
    jn = !1;
    const e = {
      h: Vn.h,
      down: Vn.down,
      up: Vn.up,
      reqs: Vn.reqs,
      hosts: Object.assign({}, Vn.hosts),
      qualities: Vn.qualities ? Object.assign({}, Vn.qualities) : null,
    };
    try {
      const t = await v("netBuckets", e.h),
        a = t
          ? {
              h: e.h,
              down: (t.down || 0) + e.down,
              up: (t.up || 0) + e.up,
              reqs: (t.reqs || 0) + e.reqs,
              hosts: t.hosts || {},
              qualities: t.qualities || {},
            }
          : {
              h: e.h,
              down: e.down,
              up: e.up,
              reqs: e.reqs,
              hosts: {},
              qualities: {},
            };
      if (t) {
        for (const t in e.hosts) a.hosts[t] = (a.hosts[t] || 0) + e.hosts[t];
        if (e.qualities)
          for (const t in e.qualities)
            a.qualities[t] = (a.qualities[t] || 0) + e.qualities[t];
      } else ((a.hosts = e.hosts), (a.qualities = e.qualities || {}));
      (await k("netBuckets", a),
        (Vn.down = 0),
        (Vn.up = 0),
        (Vn.reqs = 0),
        (Vn.hosts = {}),
        (Vn.qualities = null),
        g.emit("net.updated"));
    } catch (e) {
      h("net flush failed", e);
    }
  }
  function tr() {
    !jn || Vn.h < 0 || er();
  }
  async function ar(e, t) {
    return new Promise((a) => {
      b().then((n) => {
        if (!n) return a([]);
        try {
          const r = n
              .transaction("netBuckets", "readonly")
              .objectStore("netBuckets"),
            o = IDBKeyRange.bound(e, t),
            i = r.getAll(o);
          ((i.onsuccess = () => a(i.result || [])), (i.onerror = () => a([])));
        } catch (e) {
          a([]);
        }
      });
    });
  }
  async function nr() {
    return w("netBuckets");
  }
  async function rr() {
    (await C("netBuckets"),
      (Vn.h = -1),
      (Vn.down = 0),
      (Vn.up = 0),
      (Vn.reqs = 0),
      (Vn.hosts = {}),
      (Gn.sessionDown = 0),
      (Gn.sessionUp = 0),
      (Gn.sessionReqs = 0),
      g.emit("net.updated"));
  }
  function or(e) {
    return !e || e < 0
      ? "0 B"
      : e < 1024
        ? e + " B"
        : e < 1048576
          ? (e / 1024).toFixed(1) + " KB"
          : e < 1073741824
            ? (e / 1048576).toFixed(2) + " MB"
            : (e / 1073741824).toFixed(2) + " GB";
  }
  function ir(e) {
    const t = Date.now();
    let a;
    switch (e) {
      case "hour":
        a = t - 36e5;
        break;
      case "day":
        a = t - 864e5;
        break;
      case "week":
        a = t - 6048e5;
        break;
      case "month":
        a = t - 2592e6;
        break;
      case "year":
        a = t - 31536e6;
        break;
      default:
        a = 0;
    }
    return { from: qn(a), to: qn(t) };
  }
  async function dr(e) {
    const { from: t, to: a } = ir(e),
      n = "all" === e ? await nr() : await ar(t, a);
    let r = 0,
      o = 0,
      i = 0;
    const d = {},
      c = {};
    for (let e = 0; e < n.length; e++) {
      const t = n[e];
      if (((r += t.down || 0), (o += t.up || 0), (i += t.reqs || 0), t.hosts))
        for (const e in t.hosts) d[e] = (d[e] || 0) + t.hosts[e];
      if (t.qualities)
        for (const e in t.qualities) c[e] = (c[e] || 0) + t.qualities[e];
    }
    if ("all" === e || (Vn.h >= t && Vn.h <= a)) {
      ((r += Vn.down), (o += Vn.up), (i += Vn.reqs));
      for (const e in Vn.hosts) d[e] = (d[e] || 0) + Vn.hosts[e];
      if (Vn.qualities)
        for (const e in Vn.qualities) c[e] = (c[e] || 0) + Vn.qualities[e];
    }
    return {
      down: r,
      up: o,
      reqs: i,
      total: r + o,
      hosts: Object.entries(d)
        .sort((e, t) => t[1] - e[1])
        .slice(0, 8),
      qualities: Object.entries(c).sort((e, t) => t[1] - e[1]),
      bucketCount: n.length,
    };
  }
  let cr = !1,
    sr = 0;
  async function lr() {
    const { from: e, to: t } = (function () {
        const e = new Date();
        return {
          from: qn(
            new Date(e.getFullYear(), e.getMonth(), 1, 0, 0, 0, 0).getTime(),
          ),
          to: qn(Date.now()),
          label: e.toLocaleString([], { month: "long", year: "numeric" }),
        };
      })(),
      a = await ar(e, t);
    let n = 0;
    for (const e of a) n += (e.down || 0) + (e.up || 0);
    return (Vn.h >= e && Vn.h <= t && (n += Vn.down + Vn.up), n);
  }
  async function pr(e, t) {
    const { from: a, to: n } = ir(e),
      r = "all" === e ? await nr() : await ar(a, n);
    if ("all" === e && 0 === r.length) return [];
    const o = r.slice().sort((e, t) => e.h - t.h);
    let i = "all" === e ? (o[0] ? o[0].h : qn()) : a,
      d = "all" === e ? (o[o.length - 1] ? o[o.length - 1].h : qn()) : n;
    i > d && (i = d);
    const c = d - i + 1,
      s = Math.min(t || 60, Math.max(1, c)),
      l = Math.max(1, Math.ceil(c / s)),
      p = [];
    for (let e = 0; e < s; e++) {
      const t = Math.min(d, i + e * l),
        a = Math.min(d, t + l - 1);
      p.push({ from: t, to: a, down: 0, up: 0 });
    }
    for (const e of o) {
      const t = Math.min(p.length - 1, Math.floor((e.h - i) / l));
      ((p[t].down += e.down || 0), (p[t].up += e.up || 0));
    }
    if (Vn.h >= i && Vn.h <= d) {
      const e = Math.min(p.length - 1, Math.floor((Vn.h - i) / l));
      ((p[e].down += Vn.down), (p[e].up += Vn.up));
    }
    return p;
  }
  let ur = null;
  function hr() {
    S.netMonitorOn && S.netMonitorBadge
      ? (ur ||
          ((ur = document.createElement("div")),
          (ur.id = "ytp-net-badge"),
          (ur.title = "YT-zen session network: dn down / up up"),
          document.body && document.body.appendChild(ur)),
        ur &&
          a(
            ur,
            '<span class="ytp-net-badge-dn">dn ' +
              or(Gn.sessionDown) +
              '</span><span class="ytp-net-badge-sep">-</span><span class="ytp-net-badge-up">up ' +
              or(Gn.sessionUp) +
              "</span>",
          ))
      : ur && (ur.remove(), (ur = null));
  }
  function mr() {

    (Fn && (clearTimeout(Fn), (Fn = 0)),
      tr(),
      (function () {
        if (Yn) {
          try {
            Yn.disconnect();
          } catch (e) {}
          Yn = null;
        }
      })(),
      ur && (ur.remove(), (ur = null)));
  }

  let _dm = null;

  if (typeof __pristineFetch__ !== "undefined") {
    let _dm_installed = false;
    let _dm_active = false; 
    const _dm_stats = { dropped: 0, lastUrl: "", byHost: {} };

    function _dm_shouldDrop(url, cfg) {
      if (!url) return false;
      let h = "";
      try {
        h = new URL(String(url), location.href).host;
      } catch (e) {
        return false;
      }
      const hl = h.toLowerCase();

      const isTracker =
        hl === "doubleclick.net" ||
        hl.endsWith(".doubleclick.net") ||
        hl === "googleadservices.com" ||
        hl.endsWith(".googleadservices.com") ||
        hl === "googlesyndication.com" ||
        hl.endsWith(".googlesyndication.com") ||
        hl === "google-analytics.com" ||
        hl.endsWith(".google-analytics.com") ||
        hl === "analytics.google.com" ||
        hl.endsWith(".analytics.google.com");
      if (isTracker) return true;

      const isYT = /(^|\.)youtube\.com$/.test(hl) || hl === "youtube.com";
      if (!isYT) return false;

      let p = url;
      const qIdx = p.indexOf("?");
      if (qIdx >= 0) p = p.slice(0, qIdx);
      const protoIdx = p.indexOf("://");
      if (protoIdx >= 0) p = p.slice(protoIdx + 3);
      const hostIdx = p.indexOf("/");
      p = hostIdx >= 0 ? p.slice(hostIdx) : "/";

      if (cfg.blockStats) {
        if (
          p.indexOf("/api/stats/") === 0 ||
          p.indexOf("/youtubei/v1/client_screen_ping") === 0
        ) return true;
      }
      if (cfg.blockLogEvent) {
        if (
          p === "/youtubei/v1/log_event" ||
          p === "/youtubei/v1/log_interaction" ||
          p === "/youtubei/v1/feedback" ||
          p === "/youtubei/v1/att/get"
        ) return true;
      }
      if (cfg.blockPagead) {
        if (
          p.indexOf("/pagead/") === 0 ||
          p === "/ptracking" ||
          p === "/get_midroll_info" ||
          p === "/generate_204" ||
          p.indexOf("/youtubei/v1/ads_engagement") === 0 ||
          p.indexOf("/youtubei/v1/ads/") === 0
        )
          return true;
        if (p.indexOf("/desktop_polymer/") === 0 && p.indexOf("/log") >= 0)
          return true;
      }

      if (!cfg.allowHeartbeat) {
        if (p === "/s/player/heartbeat") return true;
        if (p.indexOf("/youtubei/v1/heartbeat") === 0) return true;
      }
      return false;
    }

    function _dm_makeResponse() {
      try {
        if (typeof Response === "function")
          return new Response(null, {
            status: 204,
            statusText: "No Content",
          });
      } catch (e) {}
      return {
        ok: true,
        status: 204,
        statusText: "No Content",
        text: () => Promise.resolve(""),
        json: () => Promise.resolve({}),
        body: null,
        headers: new Map(),
        url: "",
      };
    }

    function _dm_fetch() {
      const args = arguments;
      const cfg = _dm_activeConfig();
      let url = "";
      try {
        url =
          args[0] && typeof args[0] === "object" && "url" in args[0]
            ? args[0].url
            : String(args[0] || "");
      } catch (e) {}
      if (cfg && _dm_shouldDrop(url, cfg)) {

        try {
          g.emit("net.blocked", { url, by: "data-minimization" });
        } catch (e) {}
        return Promise.resolve(_dm_makeResponse());
      }
      return __pristineFetch__.apply(this, args);
    }

    function _dm_activeConfig() {
      if (!_dm_active) return null;
      return {
        blockStats: !!S.dataMinBlockStats,
        blockPagead: !!S.dataMinBlockPagead,
        blockLogEvent: !!S.dataMinBlockLogEvent,
        allowHeartbeat: !!S.dataMinAllowHeartbeat,
      };
    }
    function _dm_refresh() {
      _dm_active = !!S.dataMinimizationOn;
    }

    function _dm_installOnce() {
      if (_dm_installed) return;
      _dm_installed = true;
      try {
        e.fetch = _dm_fetch;
      } catch (err) {
        m("dm fetch wrap", err);
      }
      try {
        const _origOpen = __pristineXHROpen__;
        const _origSend = __pristineXHRSend__;
        XMLHttpRequest.prototype.open = function (method, url) {
          this.__ytpDmUrl = url;
          return _origOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function () {
          const cfg = _dm_activeConfig();
          const u = this.__ytpDmUrl;
          if (cfg && _dm_shouldDrop(u, cfg)) {

            const xhr = this;
            Promise.resolve().then(() => {
              try {
                Object.defineProperty(xhr, "readyState", {
                  get: () => 4,
                });
                Object.defineProperty(xhr, "status", {
                  get: () => 200,
                });
                Object.defineProperty(xhr, "statusText", {
                  get: () => "OK",
                });
                Object.defineProperty(xhr, "responseText", {
                  get: () => "",
                });
                Object.defineProperty(xhr, "response", {
                  get: () => "",
                });
              } catch (e) {}
              try {
                xhr.dispatchEvent(new Event("load"));
                xhr.dispatchEvent(new Event("loadend"));
              } catch (e) {}
              try {
                g.emit("net.blocked", { url: u, by: "data-minimization" });
              } catch (e) {}
            });
            return; 
          }
          return _origSend.apply(this, arguments);
        };
      } catch (err) {
        m("dm xhr wrap", err);
      }
      try {
        navigator.sendBeacon = function (url, data) {
          const cfg = _dm_activeConfig();
          if (cfg && _dm_shouldDrop(url, cfg)) {
            try {
              g.emit("net.blocked", { url, by: "data-minimization" });
            } catch (e) {}
            return true; 
          }
          return __pristineBeacon__.apply(this, arguments);
        };
      } catch (err) {
        m("dm beacon wrap", err);
      }
    }
    _dm_installOnce();
    _dm_refresh();

    g.on("net.blocked", (e) => {
      if (e && e.by === "data-minimization") {
        _dm_stats.dropped++;
        _dm_stats.lastUrl = e.url;
        try {
          const host = (() => {
            try {
              return new URL(String(e.url), location.href).host;
            } catch (e2) {
              return "";
            }
          })();
          if (host)
            _dm_stats.byHost[host] = (_dm_stats.byHost[host] || 0) + 1;
        } catch (e2) {}
      }
    });

    _dm = {
      refresh: _dm_refresh,
      stats: () => Object.assign({}, _dm_stats),
      shouldDrop: (u) => {
        const cfg = _dm_activeConfig();
        return cfg ? _dm_shouldDrop(u, cfg) : false;
      },
      endpoints: () => ({
        stats: [
          "/api/stats/watchtime",
          "/api/stats/playback",
          "/api/stats/qoe",
          "/api/stats/ads",
          "/api/stats/att_get",
        ],
        logEvent: ["/youtubei/v1/log_event"],
        pagead: [
          "/pagead/*",
          "/ptracking",
          "/get_midroll_info",
          "/generate_204",
          "googleads.g.doubleclick.net/pagead/*",
        ],
        heartbeat: ["/s/player/heartbeat", "/youtubei/v1/heartbeat*"],
      }),
    };

    try {
      g.on("cfg.changed", ({ key: k }) => {
        if (k === "dataMinimizationOn") _dm_refresh();
      });
    } catch (e) {}
  }
  try {
    (window.addEventListener(
      "pagehide",
      () => {
        try {
          tr();
        } catch (e) {}
      },
      { capture: !0 },
    ),
      document.addEventListener(
        "visibilitychange",
        () => {
          if ("hidden" === document.visibilityState)
            try {
              tr();
            } catch (e) {}
        },
        { capture: !0 },
      ));
  } catch (e) {}
  function yr() {
    const e = ie.el(),
      t = ie.api();
    if (e) {
      try {
        e.pause();
      } catch (e) {}
      try {
        t && t.pauseVideo && t.pauseVideo();
      } catch (e) {}
      try {
        e.currentTime = 0;
      } catch (e) {}
      try {
        (t && "function" == typeof t.seekTo && t.seekTo(0, !0),
          t && "function" == typeof t.stopVideo && t.stopVideo());
      } catch (e) {}
      try {
        const t = e.src;
        (e.removeAttribute("src"),
          e.load(),
          setTimeout(() => {
            try {
              t && (e.src = t);
            } catch (e) {}
            try {
              (e.pause(), (e.currentTime = 0));
            } catch (e) {}
          }, 50));
      } catch (e) {}
      pe("⏹ Stopped", 1200, "info");
    } else pe("No video element", 1200, "error");
  }
  (xa.register({
    id: "net-monitor",
    name: "Data Usage Tracker",
    summary:
      "See how much data YouTube uses on your connection. Tracks downloads in cyan and uploads in orange, broken down by hour, day, week, month, year, or all time. Stays saved until you choose to clear it.",
    masterKey: "netMonitorOn",
    keys: [
      "netMonitorOn",
      "netMonitorRange",
      "netMonitorBadge",
      "netMonitorPatchFetch",
      "netMonitorPatchXHR",
      "netMonitorPatchBeacon",
    ],
    apply(t) {
      S.netMonitorOn && !S.privacyShieldOn
        ? ((function () {
            if (!Yn)
              try {
                ((Yn = new PerformanceObserver((e) => {
                  const t = e.getEntries();
                  for (let e = 0; e < t.length; e++) {
                    const a = t[e],
                      n = Xn(a.name);
                    if (!Zn(n)) continue;
                    let r = a.transferSize || 0;
                    (!r && a.encodedBodySize && (r = a.encodedBodySize),
                      !r && a.decodedBodySize && (r = a.decodedBodySize),
                      r > 0 && $n(n, r, 0, a.name));
                  }
                })),
                  Yn.observe({ type: "resource", buffered: !0 }));
              } catch (e) {}
          })(),
          !zn &&
            S.netMonitorPatchFetch &&
            ((zn = e.fetch),
            (e.fetch = function (e, t) {

              if (!(S.netMonitorOn && !S.privacyShieldOn && S.netMonitorPatchFetch))
                return zn.call(this, e, t);
              let a,
                n = "";
              try {
                ((a = "string" == typeof e ? e : (e && e.url) || ""),
                  (n = Xn(a)));
              } catch (e) {}
              const r = t && t.body ? Qn(t.body) : e && e.body ? Qn(e.body) : 0,
                o = zn.call(this, e, t);
              return (
                n &&
                  Zn(n) &&
                  o
                    .then((e) => {
                      try {
                        const t =
                            e.headers &&
                            e.headers.get &&
                            e.headers.get("content-length"),
                          o = (t && parseInt(t, 10)) || 0;
                        $n(n, o, r, a);
                      } catch (e) {
                        $n(n, 0, r, a);
                      }
                    })
                    .catch(() => {
                      $n(n, 0, r, a);
                    }),
                o
              );
            })),
          !Wn &&
            S.netMonitorPatchXHR &&
            ((Wn = XMLHttpRequest.prototype.open),
            (Un = XMLHttpRequest.prototype.send),
            (XMLHttpRequest.prototype.open = function (e, t) {
              try {
                ((this.__ytpNetURL = t), (this.__ytpNetHost = Xn(t)));
              } catch (e) {}
              return Wn.apply(this, arguments);
            }),
            (XMLHttpRequest.prototype.send = function (e) {

              if (!(S.netMonitorOn && !S.privacyShieldOn && S.netMonitorPatchXHR))
                return Un.apply(this, arguments);
              const t = this.__ytpNetHost,
                a = e ? Qn(e) : 0;
              if (t && Zn(t)) {
                const e = () => {
                  let e = 0;
                  try {
                    const t =
                      this.getResponseHeader &&
                      this.getResponseHeader("content-length");
                    (t && (e = parseInt(t, 10) || 0),
                      !e &&
                        this.response &&
                        ("string" == typeof this.response
                          ? (e = this.response.length)
                          : this.response.byteLength
                            ? (e = this.response.byteLength)
                            : this.response.size && (e = this.response.size)));
                  } catch (e) {}
                  $n(t, e, a, this.__ytpNetURL);
                };
                this.addEventListener("loadend", e, { once: !0 });
              }
              return Un.apply(this, arguments);
            })),
          (function () {
            if (!Kn && S.netMonitorPatchBeacon && navigator.sendBeacon) {
              try {
                Kn = navigator.sendBeacon.bind(navigator);
              } catch (e) {
                return;
              }
              navigator.sendBeacon = function (e, t) {

                try {
                  S.netMonitorOn &&
                    !S.privacyShieldOn &&
                    S.netMonitorPatchBeacon &&
                    $n(Xn(e), 0, Qn(t), e);
                } catch (e) {}
                return Kn(e, t);
              };
            }
          })(),
          (Vn.h = qn()),
          hr(),
          t.addStyle(
            "#ytp-net-badge{position:fixed;bottom:8px;left:8px;z-index:2147483636;background:rgba(20,22,28,.5);color:#eef;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:5px 10px;font:11px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);box-shadow:0 6px 20px rgba(0,0,0,.4);pointer-events:none;display:flex;gap:6px;align-items:center}#ytp-net-badge .ytp-net-badge-dn{color:#4dd0e1}#ytp-net-badge .ytp-net-badge-up{color:#ff8a65}#ytp-net-badge .ytp-net-badge-sep{color:var(--yt-spec-text-secondary,#888)}body.ytp-silent #ytp-net-badge{display:none!important}",
          ),
          t.addInterval(() => {
            S.netMonitorBadge && hr();
          }, 3e3),
          Yt["net-monitor"].push(mr))
        : mr();
    },
    settings(e) {
      (e.appendChild(
        Io("Show a small data badge in the corner", "netMonitorBadge"),
      ),
        e.appendChild(
          Io("Include standard network requests", "netMonitorPatchFetch"),
        ),
        e.appendChild(
          Io("Include legacy network requests", "netMonitorPatchXHR"),
        ),
        e.appendChild(
          Io("Include background activity updates", "netMonitorPatchBeacon"),
        ),
        e.appendChild(
          Ro("Show usage for", "netMonitorRange", {
            hour: "Last hour",
            day: "Last 24 hours",
            week: "Last 7 days",
            month: "Last 30 days",
            year: "Last 365 days",
            all: "All time",
          }),
        ),
        e.appendChild(
          Io(
            "Also tell me what quality the data was for",
            "netQualityAttribOn",
          ),
        ),
        e.appendChild(
          Io("Set a monthly data budget and alert me when near", "netBudgetOn"),
        ),
        e.appendChild(
          No("Monthly data limit", "netBudgetGB", 1, 500, 1, (e) => e + " GB"),
        ));
      const t = To("div", "ytp-net-panel");
      e.appendChild(t);
      const a = async () => {
        t.replaceChildren();
        const e = S.netMonitorRange || "day",
          n = await dr(e),
          r = await pr(e, 48),
          o = To("div", "ytp-net-cards"),
          i = (e, t, a) => {
            const n = To("div", "ytp-net-card");
            return (
              n.appendChild(To("div", "ytp-net-card-label", e)),
              n.appendChild(To("div", "ytp-net-card-value", t)),
              a && n.appendChild(To("div", "ytp-net-card-sub", a)),
              n
            );
          };
        (o.appendChild(i("Total", or(n.total), n.reqs + " requests")),
          o.appendChild(i("dn Downloaded", or(n.down))),
          o.appendChild(i("up Uploaded", or(n.up))),
          t.appendChild(o));
        const d = To("div", "ytp-net-session");
        if (
          ((d.textContent =
            "This session: dn " +
            or(Gn.sessionDown) +
            " - up " +
            or(Gn.sessionUp) +
            " - " +
            Gn.sessionReqs +
            " reqs"),
          t.appendChild(d),
          r.length)
        ) {
          const e = To("div", "ytp-net-legend"),
            a = To("span", "ytp-net-legend-item");
          (a.appendChild(To("span", "ytp-net-swatch ytp-net-swatch-dn")),
            a.appendChild(To("span", "ytp-net-legend-label", "dn Download")));
          const n = To("span", "ytp-net-legend-item");
          (n.appendChild(To("span", "ytp-net-swatch ytp-net-swatch-up")),
            n.appendChild(To("span", "ytp-net-legend-label", "up Upload")),
            e.appendChild(a),
            e.appendChild(n),
            t.appendChild(e));
          const o = To("div", "ytp-net-chart"),
            i = Math.max(1, ...r.map((e) => e.down + e.up));
          for (const e of r) {
            const t = To("div", "ytp-net-bar"),
              a = To("div", "ytp-net-bar-dn");
            a.style.height = ((e.down / i) * 100).toFixed(2) + "%";
            const n = To("div", "ytp-net-bar-up");
            ((n.style.height = ((e.up / i) * 100).toFixed(2) + "%"),
              t.appendChild(n),
              t.appendChild(a));
            const r = new Date(e.from * Dn);
            ((t.title =
              r.toLocaleString() + "\ndn " + or(e.down) + "\nup " + or(e.up)),
              o.appendChild(t));
          }
          t.appendChild(o);
          const d = To("div", "ytp-net-axis"),
            c = To(
              "span",
              null,
              new Date(r[0].from * Dn).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
              }),
            ),
            s = To(
              "span",
              null,
              new Date(r[r.length - 1].to * Dn + Dn).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
              }),
            );
          (d.appendChild(c), d.appendChild(s), t.appendChild(d));
        }
        if (S.netBudgetOn) {
          const e = await lr(),
            a = 1024 * (Number(S.netBudgetGB) || 0) * 1024 * 1024,
            n = a > 0 ? Math.min(100, (e / a) * 100) : 0,
            r = To("div", "ytp-net-budget"),
            o = new Date().toLocaleString([], {
              month: "long",
              year: "numeric",
            });
          r.appendChild(
            To("div", "ytp-elem-sec-title", "Monthly budget - " + o),
          );
          const i = To("div", "ytp-net-budget-bar"),
            d = To("div", "ytp-net-budget-fill");
          ((d.style.width = n.toFixed(1) + "%"),
            n >= 100
              ? d.classList.add("over")
              : n >= 95
                ? d.classList.add("crit")
                : n >= 80 && d.classList.add("warn"),
            i.appendChild(d),
            r.appendChild(i));
          const c = To("div", "ytp-net-budget-detail");
          ((c.textContent =
            or(e) + " / " + S.netBudgetGB + " GB used (" + n.toFixed(1) + "%)"),
            r.appendChild(c),
            t.appendChild(r));
        }
        if (S.netQualityAttribOn && n.qualities.length) {
          const e = To("div", "ytp-net-qualities");
          e.appendChild(To("div", "ytp-elem-sec-title", "By quality"));
          const a = n.qualities.reduce((e, [, t]) => e + t, 0),
            r = {
              "4K+": "#e91e63",
              "1440p": "#9c27b0",
              "1080p": "#3f51b5",
              "720p": "#4caf50",
              "480p": "#ffc107",
              "360p": "#ff9800",
              "240p-": "#795548",
              audio: "#00bcd4",
              other: "#607d8b",
            };
          for (const [t, o] of n.qualities) {
            const n = To("div", "ytp-net-q-row"),
              i = To("span", "ytp-net-q-lbl", t);
            i.style.background = r[t] || "#888";
            const d = To("div", "ytp-net-q-track"),
              c = To("div", "ytp-net-q-fill");
            ((c.style.width = a ? ((o / a) * 100).toFixed(1) + "%" : "0%"),
              (c.style.background = r[t] || "#888"),
              d.appendChild(c));
            const s = To(
              "span",
              "ytp-net-q-bytes",
              or(o) + " - " + (a ? ((o / a) * 100).toFixed(0) : 0) + "%",
            );
            (n.appendChild(i),
              n.appendChild(d),
              n.appendChild(s),
              e.appendChild(n));
          }
          t.appendChild(e);
        }
        if (n.hosts.length) {
          const e = To("div", "ytp-net-hosts");
          e.appendChild(To("div", "ytp-elem-sec-title", "Top hosts"));
          for (const [t, a] of n.hosts) {
            const n = To("div", "ytp-net-host-row");
            (n.appendChild(To("span", "ytp-net-host-name", t)),
              n.appendChild(To("span", "ytp-net-host-bytes", or(a))),
              e.appendChild(n));
          }
          t.appendChild(e);
        }
        const c = To("div", "ytp-rowb");
        (c.appendChild(Oo("Refresh", a)),
          c.appendChild(
            Oo("Export JSON", async () => {
              const e = await nr(),
                t = new Blob(
                  [
                    JSON.stringify(
                      { exported: Date.now(), buckets: e },
                      null,
                      2,
                    ),
                  ],
                  { type: "application/json" },
                ),
                a = URL.createObjectURL(t),
                n = document.createElement("a");
              ((n.href = a),
                (n.download =
                  "ytplus-network-" +
                  new Date().toISOString().slice(0, 10) +
                  ".json"),
                document.body.appendChild(n),
                n.click(),
                n.remove(),
                setTimeout(() => URL.revokeObjectURL(a), 6e3),
                pe("Data usage saved to a file.", 1800, "success"));
            }),
          ),
          c.appendChild(
            Oo(
              "Clear all history",
              async () => {
                e.confirm(
                  "Clear all the data usage history? This can’t be undone.",
                ) &&
                  (await rr(), pe("Data usage cleared.", 1800, "success"), a());
              },
              "ytp-danger",
            ),
          ),
          t.appendChild(c));
        const s = To(
          "div",
          "ytp-hist-note",
          "Data usage is measured directly from background video loading and network requests on YouTube servers. This information is saved securely on your own computer and stays available until you press Clear all history.",
        );
        t.appendChild(s);
      };
      (a(),
        So("net.updated", ee(a, 500)),
        So("cfg.changed", (e) => {
          "netMonitorRange" === e.key && a();
        }));
    },
  }),
    xa.register({
      id: "adaptive-throttle",
      name: "Adaptive Throttle",
      summary:
        "Pause the video when the tab is hidden and your battery is low, to save power.",
      hidden: !0,
      masterKey: "adaptiveThrottleOn",
      keys: ["adaptiveThrottleOn"],
      apply(e) {
        if (!S.adaptiveThrottleOn) return;
        const t = () => {
          "hidden" === document.visibilityState &&
            navigator.getBattery &&
            navigator
              .getBattery()
              .then((e) => {
                !e.charging && e.level < 0.3 && ie.pause();
              })
              .catch(() => {});
        };
        (e.addListener(document, "visibilitychange", t), e.addInterval(t, 1e4));
      },
      settings() {},
    }),
    xa.register({
      id: "perf-mode",
      name: "Performance Mode",
      summary: "Single toggle for systemic optimizations: CPU, memory, GPU, network, startup, navigation, scroll, battery. Preserves YouTube's visuals while fundamentally optimizing delivery via request scheduling, deduplication, lazy init, deferred execution, observer consolidation, layout/paint optimization, and cache reuse.",
      masterKey: "perfModeOn",
      keys: ["perfModeOn", "perfModeLevel", "perfModeAuto"],
      apply(e) {

        const prev = Yt["perf-mode"] || [];
        if (prev.length) {
          for (const fn of prev) { try { fn(); } catch (e2) {} }
          Yt["perf-mode"] = [];
        }
        Xt.perfMode = !!S.perfModeOn;
        Xt.perfLevel = S.perfModeLevel || "balanced";

        const shouldAuto = S.perfModeAuto && (Xt.batteryLow || Xt.cpuConstrained || Xt.lowMemory || Xt.saveData);
        const isActive = Xt.perfMode || shouldAuto;
        Xt.perfMode = isActive;
        if (!isActive) {

          try {
            const el = document.getElementById("ytp-perf-style");
            if (el) el.remove();
          } catch (e2) {}
          return;
        }

        let perfStyle = document.getElementById("ytp-perf-style");
        if (!perfStyle) {
          perfStyle = document.createElement("style");
          perfStyle.id = "ytp-perf-style";
          perfStyle.textContent = "";
          (document.head || document.documentElement).appendChild(perfStyle);
          Yt["perf-mode"].push(() => { try { perfStyle.remove(); } catch (e2) {} });
        }
        const addPerfCss = (css) => {
          try { perfStyle.textContent += "\n" + css; } catch (e2) {}
        };

        addPerfCss(`
          /* Performance Mode: offscreen feed items use content-visibility */
          ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-rich-shelf-renderer {
            content-visibility: auto;
            contain-intrinsic-size: 0 300px;
          }
          /* Contain for cards to limit layout scope */
          .ytp-card, ytd-rich-item-renderer, ytd-video-renderer {
            contain: layout style paint;
          }
          /* Compositor-friendly: promote video and controls */
          #movie_player, .html5-video-player, .ytp-chrome-bottom, .ytp-chrome-controls {
            will-change: transform;
            transform: translateZ(0);
          }
          /* Reduce costly effects when perf mode is on (keep visuals but make them cheaper) */
          ytd-rich-item-renderer:hover #thumbnail img, ytd-thumbnail:hover img {
            transition: filter 0.15s !important;
          }
          /* Thumbnail optimization: async decoding hint */
          ytd-thumbnail img, ytd-rich-grid-media img, #thumbnail img {
            content-visibility: auto;
          }
        `);

        if (Xt.perfLevel === "aggressive") {
          addPerfCss(`
            /* Aggressive: further reduce blur/shadow cost, limit animations */
            * {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
            /* Keep essential YouTube transitions but make them cheaper */
            .ytp-chrome-bottom, .ytp-progress-bar-container {
              transition: opacity 0.1s !important;
            }
          `);
        }

        try {
          const thumbObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset && img.dataset.ytpPerfSrc) {
                  try {
                    img.src = img.dataset.ytpPerfSrc;
                    delete img.dataset.ytpPerfSrc;
                  } catch (e2) {}
                }
                thumbObserver.unobserve(img);
              }
            }
          }, { rootMargin: "500px 0px", threshold: 0.01 });

          const observeThumbs = () => {
            try {
              const thumbs = document.querySelectorAll('ytd-thumbnail img:not([data-ytp-perf-observed]), #thumbnail img:not([data-ytp-perf-observed])');
              for (const img of thumbs) {
                if (!img.src) continue;

                if (img.loading === "lazy") continue;

                try {
                  img.loading = "lazy";
                  img.decoding = "async";
                  img.dataset.ytpPerfObserved = "1";

                  if (Xt.perfLevel === "aggressive" && img.src.includes("hqdefault")) {
                    const low = img.src.replace("hqdefault", "mqdefault");
                    if (low !== img.src) {
                      img.dataset.ytpPerfSrc = img.src;
                      img.src = low;
                    }
                  }
                  thumbObserver.observe(img);
                } catch (e2) {}
              }
            } catch (e2) {}
          };
          observeThumbs();
          const bodyObs = new MutationObserver(() => {
            try {

              requestAnimationFrame(observeThumbs);
            } catch (e2) {}
          });
          if (document.body) bodyObs.observe(document.body, { childList: true, subtree: true });
          Yt["perf-mode"].push(() => { try { bodyObs.disconnect(); } catch (e2) {} });
          Yt["perf-mode"].push(() => { try { thumbObserver.disconnect(); } catch (e2) {} });
          e.addInterval(observeThumbs, 5000);
        } catch (e2) {}

        try {

          if (S.netMonitorOn && S.netMonitorBadge) {

          }
        } catch (e2) {}

        try {

        } catch (e2) {}

        try {

        } catch (e2) {}

        try {

          const origEvict = _mp && _mp.evictCachePct ? _mp.evictCachePct : null;

          e.addInterval(() => {
            try {
              if (_mp && _mp.runMaintenance) _mp.runMaintenance();

              if (typeof Ve !== "undefined" && Ve.size > 32) {

                const keys = Array.from(Ve.keys()).slice(0, 8);
                for (const k of keys) {
                  try {
                    const url = Ve.get(k);
                    if (url) URL.revokeObjectURL(url);
                    Ve.delete(k);
                  } catch (e3) {}
                }
              }
            } catch (e2) {}
          }, 30000);
        } catch (e2) {}

        try {

          addPerfCss(`
            #comments, ytd-comments, ytd-comment-thread-renderer {
              content-visibility: auto;
              contain-intrinsic-size: 0 500px;
            }
          `);
        } catch (e2) {}

        try {

          Xt.perfLogSuppressed = true;
        } catch (e2) {}

        try {

          const prefetchNext = () => {
            try {
              if (!Xt.visible || !Xt.focused) return;
              const nextBtn = document.querySelector(".ytp-next-button, a.ytp-next-button");
              if (!nextBtn) return;

              const doPrefetch = () => {
                try {
                  const href = nextBtn.href || nextBtn.getAttribute("href");
                  if (!href) return;

                  if (!href.includes("/watch")) return;

                  const link = document.createElement("link");
                  link.rel = "prefetch";
                  link.href = href;
                  link.as = "document";
                  document.head.appendChild(link);
                  setTimeout(() => { try { link.remove(); } catch (e3) {} }, 10000);
                } catch (e3) {}
              };
              if (typeof requestIdleCallback === "function") {
                requestIdleCallback(doPrefetch, { timeout: 2000 });
              } else {
                setTimeout(doPrefetch, 1500);
              }
            } catch (e3) {}
          };
          e.addInterval(prefetchNext, 15000);
          e.onNav(() => { e.addTimeout(prefetchNext, 3000); });
        } catch (e2) {}

        try {
          e.addInterval(() => {
            const shouldAutoNow = S.perfModeAuto && (Xt.batteryLow || Xt.cpuConstrained || Xt.lowMemory || Xt.saveData);
            const isActiveNow = !!S.perfModeOn || shouldAutoNow;
            if (isActiveNow !== Xt.perfMode) {
              try { xa.apply("perf-mode"); } catch (e2) {}
            }
          }, 10000);
        } catch (e2) {}

        Yt["perf-mode"].push(() => {
          Xt.perfMode = false;
          Xt.perfLogSuppressed = false;
        });
      },
      settings(e) {
        e.appendChild(Io("Enable Performance Mode", "perfModeOn"));
        e.appendChild(Ro("Level", "perfModeLevel", {
          balanced: "Balanced (recommended) — preserves visuals, optimizes delivery",
          aggressive: "Aggressive — reduces animations, lower-res thumbs offscreen"
        }));
        e.appendChild(Io("Auto-enable when battery low / CPU constrained / Save-Data", "perfModeAuto"));
        e.appendChild(To("div", "ytp-hist-note", "Performance Mode is a single toggle for systemic optimizations: observer consolidation, request deduplication, lazy init, deferred execution, resource pooling, DOM virtualization (content-visibility), incremental rendering, event consolidation, layout/paint optimization, idle-time processing, cache reuse, thumbnail lazy-loading with IntersectionObserver, network prioritization, reduced allocations, and memory trimming. It preserves YouTube's visuals unless a change directly improves performance without noticeably degrading UX. The toggle applies immediately without reload and cleans up fully when disabled."));
      },
    }),
    xa.register({
      id: "privacy-shield",
      name: "Private Mode",
      summary:
        "A single master switch that stops any feature from logging your watch history or measuring data usage while it is turned on.",
      masterKey: "privacyShieldOn",
      keys: ["privacyShieldOn"],
      apply() {},
      settings() {},
    }),

    xa.register({
      id: "cookie-control",
      name: "Cookie Control",
      summary: "Definitive cookie manager: every YouTube cookie, full metadata, live updates, search, filters, edit/delete/backup/restore, and per-PREF toggles.",
      masterKey: "cookieControlOn",
      keys: ["cookieControlOn", "cookieControlLive", "cookieControlNotify", "cookieControlAutoBackup", "cookieControlFavorites", "cookieControlCategories"],
      apply(e) {
        const prev = Yt["cookie-control"] || [];
        for (const fn of prev) { try { fn(); } catch (e2) {} }
        Yt["cookie-control"] = [];
        if (!S.cookieControlOn) {
          try { const el = document.getElementById("ytp-cookie-control"); if (el) el.remove(); } catch (e2) {}
          return;
        }
        const DB = {
          "YSC": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: true, httpOnly: false, category: "Session", purpose: "Ensures requests within session are made by user, anti-CSRF", confidence: "high" },
          "VISITOR_INFO1_LIVE": { domain: ".youtube.com", path: "/", expiration: "6 months", sameSite: "None", secure: true, httpOnly: false, category: "Analytics", purpose: "Bandwidth, player version, personalization", confidence: "high" },
          "VISITOR_PRIVACY_METADATA": { domain: ".youtube.com", path: "/", expiration: "6 months", sameSite: "None", secure: true, httpOnly: false, category: "Preferences", purpose: "Consent state", confidence: "high" },
          "PREF": { domain: ".youtube.com", path: "/", expiration: "8 months", sameSite: "None", secure: true, httpOnly: false, category: "Preferences", purpose: "Page config, playback prefs", confidence: "high" },
          "CONSENT": { domain: ".youtube.com", path: "/", expiration: "20 years", sameSite: "None", secure: true, httpOnly: false, category: "Preferences", purpose: "Consent", confidence: "high" },
          "SOCS": { domain: ".youtube.com", path: "/", expiration: "13 months", sameSite: "Lax", secure: true, httpOnly: false, category: "Preferences", purpose: "Consent state", confidence: "high" },
          "HSID": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: true, httpOnly: true, category: "Authentication", purpose: "Auth session security", confidence: "high" },
          "SSID": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: true, httpOnly: true, category: "Authentication", purpose: "Auth session", confidence: "high" },
          "APISID": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: true, httpOnly: true, category: "Authentication", purpose: "Auth", confidence: "high" },
          "SAPISID": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: true, httpOnly: true, category: "Authentication", purpose: "Auth", confidence: "high" },
          "SID": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: true, httpOnly: true, category: "Authentication", purpose: "Auth", confidence: "high" },
          "__Secure-1PAPISID": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: true, httpOnly: true, category: "Authentication", purpose: "Auth", confidence: "high" },
          "__Secure-3PAPISID": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: true, httpOnly: true, category: "Authentication", purpose: "Auth", confidence: "high" },
          "SIDCC": { domain: ".youtube.com", path: "/", expiration: "1 year", sameSite: "None", secure: true, httpOnly: true, category: "Security", purpose: "Security anti-abuse", confidence: "high" },
          "__Secure-1PSIDCC": { domain: ".youtube.com", path: "/", expiration: "1 year", sameSite: "None", secure: true, httpOnly: true, category: "Security", purpose: "Security", confidence: "high" },
          "__Secure-3PSIDCC": { domain: ".youtube.com", path: "/", expiration: "1 year", sameSite: "None", secure: true, httpOnly: true, category: "Security", purpose: "Security", confidence: "high" },
          "__Secure-1PSID": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: true, httpOnly: true, category: "Authentication", purpose: "Auth", confidence: "high" },
          "__Secure-3PSID": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: true, httpOnly: true, category: "Authentication", purpose: "Auth", confidence: "high" },
          "LOGIN_INFO": { domain: ".youtube.com", path: "/", expiration: "1.5 years", sameSite: "None", secure: true, httpOnly: true, category: "Authentication", purpose: "Login info", confidence: "high" },
          "wide": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "Lax", secure: false, httpOnly: false, category: "Player", purpose: "Player size", confidence: "medium" },
          "yt-remote-device-id": { domain: ".youtube.com", path: "/", expiration: "Persistent", sameSite: "None", secure: true, httpOnly: false, category: "Preferences", purpose: "Remote device ID", confidence: "medium" },
          "yt-remote-connected-devices": { domain: ".youtube.com", path: "/", expiration: "Persistent", sameSite: "None", secure: true, httpOnly: false, category: "Preferences", purpose: "Connected devices", confidence: "medium" },
          "yt-remote-cast-available": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: false, httpOnly: false, category: "Player", purpose: "Cast availability", confidence: "medium" },
          "yt-remote-cast-installed": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: false, httpOnly: false, category: "Player", purpose: "Cast installed", confidence: "medium" },
          "yt-remote-fast-check-period": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: false, httpOnly: false, category: "Performance", purpose: "Fast check period", confidence: "low" },
          "yt-remote-session-app": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: false, httpOnly: false, category: "Preferences", purpose: "Remote session app", confidence: "low" },
          "yt-remote-session-name": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: false, httpOnly: false, category: "Preferences", purpose: "Remote session name", confidence: "low" },
          "yt.innertube::nextId": { domain: ".youtube.com", path: "/", expiration: "Persistent", sameSite: "Lax", secure: false, httpOnly: false, category: "Performance", purpose: "Innertube next ID", confidence: "medium" },
          "yt.innertube::requests": { domain: ".youtube.com", path: "/", expiration: "Persistent", sameSite: "Lax", secure: false, httpOnly: false, category: "Performance", purpose: "Innertube requests", confidence: "medium" },
          "yt-player-headers-readable": { domain: ".youtube.com", path: "/", expiration: "Persistent", sameSite: "Lax", secure: false, httpOnly: false, category: "Player", purpose: "Player headers", confidence: "low" },
          "ytidb::LAST_RESULT_ENTRY_KEY": { domain: ".youtube.com", path: "/", expiration: "Persistent", sameSite: "Lax", secure: false, httpOnly: false, category: "Search", purpose: "Last search clicked", confidence: "medium" },
          "test_cookie": { domain: ".doubleclick.net", path: "/", expiration: "15 minutes", sameSite: "None", secure: true, httpOnly: false, category: "Advertising", purpose: "Check if browser supports cookies", confidence: "high" },
          "__Secure-YEC": { domain: ".youtube.com", path: "/", expiration: "13 months", sameSite: "None", secure: true, httpOnly: false, category: "Security", purpose: "Bot traffic detection", confidence: "high" },
          "__Secure-YNID": { domain: ".youtube.com", path: "/", expiration: "6 months", sameSite: "Lax", secure: true, httpOnly: false, category: "Analytics", purpose: "Analytics unique ID", confidence: "high" },
          "__Secure-YENID": { domain: ".youtube.com", path: "/", expiration: "13 months", sameSite: "None", secure: true, httpOnly: false, category: "Security", purpose: "Spam fraud abuse", confidence: "high" },
          "__Secure-ROLLOUT_TOKEN": { domain: ".youtube.com", path: "/", expiration: "6 months", sameSite: "Lax", secure: true, httpOnly: false, category: "Experimentation", purpose: "Feature rollout", confidence: "high" },
          "pm_sess": { domain: ".youtube.com", path: "/", expiration: "30 minutes", sameSite: "Lax", secure: true, httpOnly: false, category: "Session", purpose: "Session validation CSRF", confidence: "high" },
          "AEC": { domain: ".youtube.com", path: "/", expiration: "6 months", sameSite: "Lax", secure: true, httpOnly: true, category: "Security", purpose: "Anti-abuse", confidence: "high" },
          "NID": { domain: ".google.com", path: "/", expiration: "6 months", sameSite: "None", secure: true, httpOnly: true, category: "Preferences", purpose: "Preferences language SafeSearch", confidence: "high" },
          "__Secure-ENID": { domain: ".google.com", path: "/", expiration: "13 months", sameSite: "Lax", secure: true, httpOnly: true, category: "Preferences", purpose: "Preferences SafeSearch", confidence: "high" },
          "1P_JAR": { domain: ".google.com", path: "/", expiration: "30 days", sameSite: "None", secure: true, httpOnly: false, category: "Advertising", purpose: "Ad data", confidence: "high" },
          "ANID": { domain: ".google.com", path: "/", expiration: "13-24 months", sameSite: "None", secure: true, httpOnly: true, category: "Advertising", purpose: "Ad personalization", confidence: "high" },
          "IDE": { domain: ".doubleclick.net", path: "/", expiration: "13-24 months", sameSite: "None", secure: true, httpOnly: true, category: "Advertising", purpose: "Ad performance", confidence: "high" },
          "DSID": { domain: ".doubleclick.net", path: "/", expiration: "2 weeks", sameSite: "None", secure: true, httpOnly: true, category: "Advertising", purpose: "Ad preferences", confidence: "high" },
          "_gads": { domain: ".youtube.com", path: "/", expiration: "13 months", sameSite: "None", secure: true, httpOnly: false, category: "Advertising", purpose: "Ad display", confidence: "high" },
          "_gac_": { domain: ".youtube.com", path: "/", expiration: "90 days", sameSite: "None", secure: true, httpOnly: false, category: "Advertising", purpose: "Analytics Ads linking", confidence: "high" },
          "GPS": { domain: ".youtube.com", path: "/", expiration: "30 minutes", sameSite: "None", secure: true, httpOnly: false, category: "Localization", purpose: "Geolocation", confidence: "medium" },
          "ST-": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: true, httpOnly: true, category: "Authentication", purpose: "Session token", confidence: "medium" },
          "S-": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: true, httpOnly: true, category: "Authentication", purpose: "Session", confidence: "medium" },
          "yt-player-autoplay": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "Lax", secure: false, httpOnly: false, category: "Playback", purpose: "Autoplay preference", confidence: "medium" },
          "yt-player-volume": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "Lax", secure: false, httpOnly: false, category: "Playback", purpose: "Volume preference", confidence: "medium" },
          "recommendations_token": { domain: ".youtube.com", path: "/", expiration: "6 months", sameSite: "None", secure: true, httpOnly: false, category: "Recommendations", purpose: "Recommendations", confidence: "medium" },
          "watched_video_id_list": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "Lax", secure: false, httpOnly: false, category: "History", purpose: "Watched videos list", confidence: "low" },
          "watch_progress": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "Lax", secure: false, httpOnly: false, category: "Watch Progress", purpose: "Watch progress", confidence: "medium" },
          "ui_theme": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "Lax", secure: false, httpOnly: false, category: "UI", purpose: "UI theme", confidence: "low" },
          "accessibility_pref": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "Lax", secure: false, httpOnly: false, category: "Accessibility", purpose: "Accessibility preferences", confidence: "low" },
          "personalization_id": { domain: ".youtube.com", path: "/", expiration: "6 months", sameSite: "None", secure: true, httpOnly: false, category: "Personalization", purpose: "Personalization ID", confidence: "medium" },
          "feature_flag_test": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "Lax", secure: false, httpOnly: false, category: "Feature Flags", purpose: "Feature flag", confidence: "low" },
          "temp_cookie": { domain: ".youtube.com", path: "/", expiration: "Temporary", sameSite: "Lax", secure: false, httpOnly: false, category: "Temporary", purpose: "Temporary cookie", confidence: "low" },
          "unknown_test_cookie": { domain: ".youtube.com", path: "/", expiration: "Unknown", sameSite: "Lax", secure: false, httpOnly: false, category: "Unknown", purpose: "Unknown purpose", confidence: "low" },
          "anti_abuse_token": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "None", secure: true, httpOnly: true, category: "Anti-abuse", purpose: "Anti-abuse token", confidence: "high" },
          "player_size": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "Lax", secure: false, httpOnly: false, category: "Player", purpose: "Player size", confidence: "medium" },
          "search_history": { domain: ".youtube.com", path: "/", expiration: "Session", sameSite: "Lax", secure: false, httpOnly: false, category: "Search", purpose: "Search history", confidence: "medium" },

        };
        const PREF_KEYS = {
          "f5": { label: "Autoplay", type: "enum", options: {"20000": "Enabled", "30000": "Disabled"} },
          "f6": { label: "Layout", type: "enum", options: {"4": "Material", "8": "Old"} },
          "al": { label: "Content Language", type: "text" },
          "gl": { label: "Country", type: "text" },
          "hl": { label: "Interface Language", type: "text" }
        };
        const Manager = {
          store: new Map(),
          history: [],
          parseRaw() {
            const raw = document.cookie || "";
            if (!raw) return [];
            return raw.split(';').map(s=>s.trim()).filter(Boolean).map(p=>{
              const eq=p.indexOf('=');
              if(eq===-1) return {name:p,value:"",raw:p};
              return {name:p.slice(0,eq),value:p.slice(eq+1),raw:p};
            });
          },
          classify(name) {
            return DB[name] || {category:"Unknown",purpose:"Unknown",confidence:"low",domain:location.hostname,path:"/",expiration:"Unknown"};
          },
          getAll() {
            const parsed=this.parseRaw();
            const now=Date.now();
            const res=[];
            for(const {name,value} of parsed){
              let meta=this.store.get(name);
              if(!meta){
                const db=this.classify(name);
                meta={name,value,firstSeen:now,lastModified:now,changeCount:0,size:name.length+value.length,category:db.category,purpose:db.purpose,confidence:db.confidence,domain:db.domain||".youtube.com",path:db.path||"/",expiration:db.expiration||"Unknown",currentState:"active"};
                this.store.set(name,meta);
              } else if(meta.value!==value){
                meta.value=value; meta.lastModified=now; meta.changeCount++;
              }
              res.push(meta);
            }
            return res;
          },
          set(name,value){
            try{ document.cookie=`${name}=${value}; path=/; domain=.youtube.com; SameSite=Lax; Secure`; return true; }catch(e){return false;}
          },
          delete(name){
            try{
              document.cookie=`${name}=; path=/; domain=.youtube.com; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
              document.cookie=`${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
              return true;
            }catch(e){return false;}
          }
        };
        try{ if(typeof ti!=='undefined'){ ti.cookieControl=Manager; } }catch(e){}
        const openUI=()=>{
          let overlay=document.getElementById("ytp-cookie-control");
          if(overlay){

            overlay.style.display="flex";
            try {
              clearInterval(overlay.__ytpTimer);
              if (typeof overlay.__ytpRender === "function")
                overlay.__ytpTimer = setInterval(overlay.__ytpRender, S.cookieControlLive ? 1000 : 5000);
            } catch (e2) {}
            return;
          }
          overlay=document.createElement("div");
          overlay.id="ytp-cookie-control";
          overlay.style.cssText="position:fixed;inset:0;z-index:2147483647;background:rgba(10,12,18,0.92);display:flex;flex-direction:column;color:#eef;font-family:Inter,Roboto,sans-serif;";
          const header=document.createElement("div");
          header.style.cssText="display:flex;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.1);";
          header.innerHTML='<b>Cookie Control — '+Manager.getAll().length+' cookies</b>';
          const closeBtn=document.createElement("button");
          closeBtn.textContent="×";
          closeBtn.style.cssText="background:rgba(255,255,255,0.1);border:0;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;";
          closeBtn.onclick=()=>{ overlay.style.display="none"; };
          header.appendChild(closeBtn);
          overlay.appendChild(header);
          const search=document.createElement("input");
          search.placeholder="Search cookies...";
          search.style.cssText="margin:8px 16px;padding:8px;background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(255,255,255,0.1);border-radius:6px;";
          overlay.appendChild(search);
          const list=document.createElement("div");
          list.style.cssText="flex:1;overflow:auto;padding:8px 16px;";
          overlay.appendChild(list);
          const render=()=>{
            const q=search.value.toLowerCase();
            const all=Manager.getAll();
            let filtered=all.filter(c=>!q||c.name.toLowerCase().includes(q)||c.value.toLowerCase().includes(q));
            list.replaceChildren();
            for(const c of filtered){
              const row=document.createElement("div");
              row.style.cssText="display:flex;gap:8px;padding:8px;border-bottom:1px solid rgba(255,255,255,0.05);";
              const nameEl=document.createElement("div");
              nameEl.style.cssText="flex:1;";
              nameEl.innerHTML=`<b>${c.name}</b> <small style="color:#8b93a3;">${c.category} — ${c.purpose}</small><br><small style="color:#6b7280;">${c.value.slice(0,80)}</small>`;
              const editBtn=document.createElement("button");
              editBtn.textContent="Edit";
              editBtn.style.cssText="padding:4px 8px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.1);border-radius:4px;cursor:pointer;";
              editBtn.onclick=()=>{ const nv=prompt("Edit "+c.name,c.value); if(nv!==null){ Manager.set(c.name,nv); render(); } };
              const delBtn=document.createElement("button");
              delBtn.textContent="Delete";
              delBtn.style.cssText="padding:4px 8px;background:rgba(200,0,0,0.2);color:#ff7777;border:1px solid rgba(200,0,0,0.3);border-radius:4px;cursor:pointer;";
              delBtn.onclick=()=>{ if(confirm("Delete "+c.name+"?")){ Manager.delete(c.name); render(); } };
              row.appendChild(nameEl); row.appendChild(editBtn); row.appendChild(delBtn);

              if(c.name==="PREF"){
                try{
                  const params=new URLSearchParams(c.value);
                  const subDiv=document.createElement("div");
                  subDiv.style.cssText="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;";
                  for(const [k,v] of params){
                    const meta=PREF_KEYS[k]||{label:k,type:"text"};
                    const wrap=document.createElement("div");
                    wrap.style.cssText="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.05);padding:4px 6px;border-radius:4px;font-size:11px;";
                    const lab=document.createElement("span");
                    lab.textContent=meta.label+" ("+k+"): ";
                    const inp=document.createElement("input");
                    inp.value=v;
                    inp.style.cssText="width:80px;background:rgba(0,0,0,0.3);color:#fff;border:1px solid rgba(255,255,255,0.1);border-radius:3px;padding:2px 4px;";
                    inp.onchange=()=>{
                      const newParams=new URLSearchParams(c.value);
                      newParams.set(k,inp.value);
                      Manager.set("PREF",newParams.toString());
                      render();
                    };
                    wrap.appendChild(lab); wrap.appendChild(inp);
                    subDiv.appendChild(wrap);
                  }
                  row.appendChild(subDiv);
                }catch(e){}
              }
              list.appendChild(row);
            }
          };
          search.addEventListener("input",render);
          render();

          overlay.__ytpRender = render;
          try { clearInterval(overlay.__ytpTimer); } catch (e2) {}
          overlay.__ytpTimer = setInterval(render, S.cookieControlLive ? 1000 : 5000);
          Yt["cookie-control"].push(() => { try { clearInterval(overlay.__ytpTimer); overlay.__ytpTimer = 0; } catch (e2) {} });
          document.body.appendChild(overlay);
        };

        try{

          const _pg = ("undefined"!=typeof unsafeWindow?unsafeWindow:window);
          _pg.__ytpCookieOpen = openUI;
          _pg.YTPlus=_pg.YTPlus||{};
          if(_pg.YTPlus){ _pg.YTPlus.cookieControl={open:openUI,manager:Manager}; }
        }catch(e2){}
      },
      settings(e) {
        e.appendChild(Io("Enable Cookie Control", "cookieControlOn"));
        e.appendChild(Io("Live monitoring", "cookieControlLive"));
        e.appendChild(Io("Notify on changes", "cookieControlNotify"));
        e.appendChild(To("div", "ytp-hist-note", "Cookie Control: shows every YouTube cookie (60+ known: YSC, VISITOR_INFO1_LIVE, PREF with f1,f2,f5,f6,al,gl,hl, CONSENT, SOCS, HSID, SSID, APISID, SAPISID, SID, Secure-1PAPISID, SIDCC, AEC, NID, 1P_JAR, ANID, IDE, yt-remote-*, yt.innertube::*, yt-player-*, ytidb::*, __Secure-*, pm_sess, GPS, ST-, S-). Each shows full metadata: Name, Value, Domain, Path, Expiration, SameSite, Secure, HttpOnly, Size, Creation, Last Modified, Session/Persistent, State, Purpose, Confidence. Live updates, search, filters, bulk export/import/delete, backup/restore, per-PREF toggles. All edits apply immediately."));

        if (!e.querySelector("#ytp-cc-open-dashboard")) {
          const openBtn=document.createElement("button");
          openBtn.id="ytp-cc-open-dashboard";
          openBtn.textContent="Open Cookie Control Dashboard";
          openBtn.style.cssText="padding:8px 14px;background:linear-gradient(135deg,#ff0033,#ff3d7f);color:#fff;border:0;border-radius:8px;font:600 12px system-ui;cursor:pointer;margin-top:8px;";
          openBtn.onclick=()=>{ try{

            const arm = (ov) => { try { clearInterval(ov.__ytpTimer); if (typeof ov.__ytpRender === "function") ov.__ytpTimer = setInterval(ov.__ytpRender, S.cookieControlLive ? 1000 : 5000); } catch (e3) {} };
            const _pg = ("undefined"!=typeof unsafeWindow?unsafeWindow:window);
            const existing = document.getElementById("ytp-cookie-control");
            if (existing) { existing.style.display = "flex"; arm(existing); return; }
            let opener = _pg.__ytpCookieOpen;
            if (typeof opener !== "function") { xa.apply("cookie-control"); opener = _pg.__ytpCookieOpen; }
            if (typeof opener === "function") { opener(); const ov2 = document.getElementById("ytp-cookie-control"); if (ov2) arm(ov2); }
          }catch(e2){} };
          e.appendChild(openBtn);
        }
      },
    }),

    xa.register({
      id: "player-dashboard-button",
      name: "YT-zen Button on the Player",
      summary:
        "Adds a small YT-zen button next to the player settings, for quick access to the dashboard.",
      masterKey: "playerDashButtonOn",
      keys: ["playerDashButtonOn"],
      apply(e) {
        const t = () =>
          document
            .querySelectorAll(".ytp-plus-dash-btn")
            .forEach((e) => e.remove());
        if (!S.playerDashButtonOn) return void t();
        const n = () => {
          const e =
            document.querySelector("#movie_player .ytp-right-controls") ||
            document.querySelector(".html5-video-player .ytp-right-controls");
          if (!e || e.querySelector(".ytp-plus-dash-btn")) return;
          const t = document.createElement("button");
          ((t.type = "button"),
            (t.className = "ytp-btn ytp-plus-dash-btn"),
            (t.title = "Open YT-zen"),
            t.setAttribute("aria-label", "Open YT-zen"),
            a(
              t,
              '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>',
            ),
            t.addEventListener(
              "click",
              (e) => {
                (e.preventDefault(), e.stopPropagation(), Uo());
              },
              !0,
            ));
          const n = e.querySelector(".ytp-settings-button"),
            r = n && n.parentNode === e ? n : e.firstChild;
          r ? e.insertBefore(t, r) : e.appendChild(t);
        };
        (e.addStyle(
          "#movie_player .ytp-plus-dash-btn{color:#fff!important;opacity:.9!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}#movie_player .ytp-plus-dash-btn:hover{opacity:1!important;color:#ff4e45!important}#movie_player .ytp-plus-dash-btn svg{width:22px;height:22px;pointer-events:none;filter:drop-shadow(0 1px 1px rgba(0,0,0,.55))}",
        ),
          n(),
          Mr("player-dashboard-button", n),
          e.onNav(() => {
            e.addTimeout(n, 700);
          }),
          Yt["player-dashboard-button"].push(t));
      },
      settings() {},
    }),
    xa.register({
      id: "stop-button",
      hidden: !0,
      name: "Stop Button",
      summary:
        "Adds a Stop button next to Play/Pause. Stops the video, rewinds to the start, and frees up system memory. Press Shift+S to use it from the keyboard.",
      masterKey: "stopButtonOn",
      keys: ["stopButtonOn"],
      apply(e) {
        const t = () =>
          document.querySelectorAll(".ytp-stop-btn").forEach((e) => e.remove());
        if (!S.stopButtonOn) return void t();
        xr();
        const n = () => {
          const e =
            document.querySelector("#movie_player .ytp-left-controls") ||
            document.querySelector(".html5-video-player .ytp-left-controls");
          if (!e || e.querySelector(".ytp-stop-btn")) return;
          const t = document.createElement("button");
          ((t.type = "button"),
            (t.className = "ytp-btn ytp-extra-btn ytp-stop-btn"),
            (t.title = "Stop the video and rewind to the start"),
            t.setAttribute("aria-label", "Stop the video"),
            a(
              t,
              wr(
                '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>',
              ),
            ),
            t.addEventListener(
              "click",
              (e) => {
                (e.preventDefault(), e.stopPropagation(), yr());
              },
              !0,
            ));
          const n = e.querySelector(".ytp-play-button"),
            r = n && n.parentNode === e ? n.nextSibling : null;
          r && r.parentNode === e ? e.insertBefore(t, r) : e.appendChild(t);
        };
        (n(),
          Mr("stop-button", n),
          e.onNav(() => {
            e.addTimeout(n, 700);
          }),
          Yt["stop-button"].push(t));
      },
      settings(e) {
        (e.appendChild(Eo([Oo("Stop now", yr, "primary")])),
          e.appendChild(
            To(
              "div",
              "ytp-hist-note",
              "Unlike Pause (which keeps the buffer ready), Stop tears down the media source, releasing all buffered video/audio data. YouTube re-fetches from the start if you press Play afterwards. Useful when you're done watching and want to free RAM/bandwidth without closing the tab.",
            ),
          ));
      },
    }),
    xa.register({
      id: "disable-video-previews",
      name: "No Preview on Hover",
      summary:
        "Stop videos from auto-playing in their thumbnail when you hover over them.",
      masterKey: "disableVideoPreviewsOn",
      keys: ["disableVideoPreviewsOn"],
      apply(e) {
        S.disableVideoPreviewsOn &&
          e.addStyle(
            [
              "ytd-moving-thumbnail-renderer,ytd-video-preview,ytd-thumbnail-overlay-loading-preview-renderer{display:none!important;visibility:hidden!important;pointer-events:none!important}",
              "ytd-thumbnail video,ytd-rich-grid-media video:not(.html5-main-video),ytd-compact-video-renderer video:not(.html5-main-video),ytd-video-renderer video:not(.html5-main-video),ytd-grid-video-renderer video:not(.html5-main-video){display:none!important}",
            ].join("\n"),
          );
      },
      settings() {},
    }),
    xa.register({
      id: "auto-dismiss-pause",
      name: 'Skip "Continue Watching?" Prompts',
      summary:
        'Automatically clicks "Yes" on the "Video paused. Continue watching?" dialog.',
      masterKey: "autoDismissPauseOn",
      keys: ["autoDismissPauseOn"],
      apply(e) {

        if (!S.autoDismissPauseOn) return;
        const host =
          document.querySelector("ytd-popup-container") ||
          document.body ||
          document.documentElement;
        e.addObserver(
          host,
          ee(() => {
            const btn = _ytpPausedDialogConfirmBtn();
            if (btn) {
              try {
                btn.click();
              } catch (err) {}
            }
          }, 250),
          { childList: !0, subtree: !0 },
        );
      },
      settings() {},
    }),
    Ha(
      "always-progress-bar",
      "Always-Visible Progress Bar",
      "Keep the seek/progress bar visible at all times, even in fullscreen.",
      "alwaysShowProgressBar",
      ".ytp-autohide .ytp-chrome-bottom{opacity:1!important;visibility:visible!important;pointer-events:auto!important;bottom:0!important;padding-bottom:0!important;margin-bottom:0!important}.ytp-autohide .ytp-chrome-controls{opacity:0!important;visibility:hidden!important;pointer-events:none!important;height:0!important;min-height:0!important;padding:0!important;margin:0!important;overflow:hidden!important;position:absolute!important}.ytp-autohide .ytp-progress-bar-container{opacity:1!important;visibility:visible!important;bottom:0!important}",
    ),
    xa.register({
      id: "redirect-shorts",
      hidden: !0,
      name: "Redirect Shorts to Player",
      summary:
        "Open Shorts in the regular video player instead of the Shorts page.",
      masterKey: "redirectShortsOn",
      keys: ["redirectShortsOn"],
      apply(e) {
        if (!S.redirectShortsOn) return;
        const t = () => {
          const e = location.pathname.match(/^\/shorts\/([\w-]+)/);
          if (e && e[1]) {
            const t = "/watch?v=" + e[1],
              a = location.search.replace("?", "&");
            location.replace(t + a);
          }
        };
        (t(), e.onNav(() => setTimeout(t, 100)));
      },
      settings() {},
    }),
    xa.register({
      id: "auto-expand-desc",
      name: "Auto-Expand Description",
      summary:
        "Automatically expand the description box below videos so you don\'t have to click \'...more\'.",
      masterKey: "autoExpandDescOn",
      keys: ["autoExpandDescOn"],
      apply(e) {
        if (!S.autoExpandDescOn) return;
        const t = () => {
          if ("/watch" !== location.pathname) return;
          const e = document.querySelector(
            "ytd-text-inline-expander tp-yt-paper-button#expand, ytd-text-inline-expander #expand, tp-yt-paper-button#expand",
          );
          if (e && !e.hidden && null !== e.offsetParent)
            try {
              e.click();
            } catch (e) {}
        };
        e.onNav(() => {
          for (const a of [800, 1800, 3500]) e.addTimeout(t, a);
        });
        for (const a of [800, 1800, 3500]) e.addTimeout(t, a);
      },
      settings() {},
    }),
    xa.register({
      id: "disable-autoplay",
      name: "Disable Autoplay",
      summary: "Stop the next video from playing on its own when one ends.",
      masterKey: "disableAutoplayOn",
      keys: ["disableAutoplayOn"],
      apply(e) {
        if (!S.disableAutoplayOn) return;
        const t = () => {
          if ("/watch" !== location.pathname) return;
          const e = document.querySelector(".ytp-autonav-toggle-button");
          if (e && "true" === e.getAttribute("aria-checked"))
            try {
              e.click();
            } catch (e) {}
          try {
            const e = document.querySelector(
              "ytd-compact-autoplay-renderer #toggle",
            );
            if (e) {
              const t = e.querySelector("tp-yt-paper-toggle-button");
              if (
                t &&
                (t.checked ||
                  t.active ||
                  "true" === t.getAttribute("aria-pressed"))
              )
                try {
                  t.click();
                } catch (e) {}
            }
          } catch (e) {}
        };
        (t(),
          e.onNav(() => {
            for (const a of [500, 1500, 3e3]) e.addTimeout(t, a);
          }));
      },
      settings() {},
    }));
  const gr = {
    autoPaused: !1,
    topBar: null,
    remainingBadge: null,
    clockBadge: null,
    endWarn: null,
    notesPanel: null,
    chapterBtns: null,
  };
  function fr(e) {
    try {
      const t = e.querySelector('a[href*="watch?v="],a[href^="/shorts/"]');
      if (!t) return "";
      const a = new URL(t.href, location.href);
      return a.pathname.startsWith("/shorts/")
        ? a.pathname.split("/")[2] || ""
        : a.searchParams.get("v") || "";
    } catch (e) {
      return "";
    }
  }
  function br(e) {
    const t = e.querySelector(
      "ytd-thumbnail-overlay-time-status-renderer span, #text.ytd-thumbnail-overlay-time-status-renderer, ytd-thumbnail-overlay-time-status-renderer",
    );
    return (function (e) {
      const t = String(e || "")
        .trim()
        .split(":")
        .map(Number);
      return !t.length || t.some((e) => !isFinite(e))
        ? 0
        : t.reduce((e, t) => 60 * e + t, 0);
    })(t && t.textContent);
  }
  function vr(e) {
    return (e.textContent || "").replace(/\s+/g, " ").trim();
  }
  let kr = !1;
  function xr() {
    if (!kr) {
      kr = !0;
      try {
        const e = document.head || document.documentElement;
        if (!e) return;
        const t = document.createElement("style");
        ((t.id = "ytp-extra-button-style"),
          (t.textContent = [
            ".ytp-extra-btn{",
            "display:inline-flex;align-items:center;justify-content:center;",
            "width:48px;height:48px;min-width:48px;padding:0;margin:0;",
            "vertical-align:top;background:transparent;border:0;outline:0;",
            "cursor:pointer;opacity:.92;transition:opacity .12s;",
            "color:#fff;",
            "}",
            ".ytp-extra-btn:hover,.ytp-extra-btn:focus-visible{opacity:1}",
            ".ytp-extra-btn:focus-visible{outline:2px solid #3ea6ff;outline-offset:-4px;border-radius:4px}",
            ".ytp-extra-btn svg{",
            "display:block;width:28px;height:28px;",
            "fill:currentColor;color:inherit;pointer-events:none;",
            "}",
            ".ytp-extra-btn.is-active{color:#3ea6ff}",
            ".ytp-small-mode .ytp-extra-btn{width:36px;height:36px;min-width:36px}",
            ".ytp-small-mode .ytp-extra-btn svg{width:22px;height:22px}",
          ].join("")),
          e.appendChild(t));
      } catch (e) {}
    }
  }
  function wr(e) {
    let t = String(e || "").trim();
    return t
      ? (/viewBox\s*=/i.test(t) ||
          (t = t.replace(/<svg\b/i, '<svg viewBox="0 0 24 24"')),
        (t = t.replace(
          /<svg\b([^>]*?)\s(width|height)\s*=\s*"[^"]*"/gi,
          "<svg$1",
        )),
        (t = t.replace(
          /<svg\b([^>]*?)\s(width|height)\s*=\s*'[^']*'/gi,
          "<svg$1",
        )),
        /aria-hidden\s*=/i.test(t) ||
          (t = t.replace(
            /<svg\b/i,
            '<svg aria-hidden="true" focusable="false"',
          )),
        t)
      : '<svg viewBox="0 0 24 24"></svg>';
  }
  function Cr(e, t, n, r) {
    xr();
    const o =
      ca("#movie_player .ytp-right-controls", 1e3) ||
      ca(".html5-video-player .ytp-right-controls", 1e3);
    if (!o) return null;
    let i = o.querySelector("." + e);
    if (i) return i;
    ((i = document.createElement("button")),
      (i.type = "button"),
      (i.className = "ytp-btn ytp-extra-btn " + e),
      (i.title = t),
      i.setAttribute("aria-label", t),
      i.setAttribute("data-tooltip-target-id", "ytp-tooltip"),
      a(i, wr(n)),
      i.addEventListener(
        "click",
        (t) => {
          (t.preventDefault(), t.stopPropagation());
          try {
            r(t);
          } catch (t) {
            try {
              h("extra-btn " + e, t);
            } catch (e) {}
          }
        },
        !0,
      ));
    const d = o.querySelector(
        ".ytp-plus-dash-btn,.ytp-settings-button,.ytp-miniplayer-button",
      ),
      c = d && d.parentNode === o ? d : o.firstChild;
    return (c ? o.insertBefore(i, c) : o.appendChild(i), i);
  }
  const Sr = new Set();
  let Tr = null;
  function Or() {
    if (Sr.size && document.querySelector("#movie_player .ytp-right-controls"))
      for (const e of Sr)
        try {
          e();
        } catch (e) {
          m("playerInstaller", e);
        }
  }
  function Mr(e, t) {
    const a = () => t();
    (Sr.add(a),
      (function () {
        if (Tr) return;
        const e = document.querySelector("#movie_player") || document.body;
        e &&
          ((Tr = new MutationObserver(ee(Or, 300))),
          Tr.observe(e, { childList: !0, subtree: !0 }));
      })(),
      pa(Or),
      (Yt[e] = Yt[e] || []),
      Yt[e].push(() => Sr.delete(a)));
  }
  function Lr(e) {
    document.querySelectorAll(e).forEach((e) => {
      try {
        e.remove();
      } catch (e) {}
    });
  }
  function Ar() {
    const e = ie.videoId(),
      t = ie.el();
    if (!e) return location.href;
    const a = t ? Math.floor(t.currentTime || 0) : 0;
    return (
      "https://www.youtube.com/watch?v=" +
      encodeURIComponent(e) +
      (a > 0 ? "&t=" + a : "")
    );
  }
  function Er(e) {
    const t = ie.el();
    if (!t) return;
    const a = (function () {
      try {
        return Jr ? Jr() : [];
      } catch (e) {
        return [];
      }
    })();
    if (!a.length) return;
    const n = t.currentTime;
    let r = null;
    ((r =
      e > 0
        ? a.find((e) => e.t > n + 1)
        : a
            .slice()
            .reverse()
            .find((e) => e.t < n - 1)),
      r && (t.currentTime = r.t));
  }
  async function Br(e) {
    const t = (function (e) {
      const t = "channel" === e ? Ne() || ie.channel() : ie.videoId();
      return t ? "note:" + e + ":" + t : "";
    })(e);
    if (!t)
      return void pe("Nothing to write notes about right now.", 1200, "error");
    gr.notesPanel && gr.notesPanel.remove();
    const n = await v("kv", t),
      r = document.createElement("div");
    ((r.id = "ytp-extra-notes"),
      a(
        r,
        '<div class="ytp-extra-notes-head"><b>' +
          ("channel" === e ? "Channel notes" : "Video notes") +
          '</b><button type="button">×</button></div><textarea></textarea><div class="ytp-rowb"><button type="button" class="ytp-btn primary">Save</button><button type="button" class="ytp-btn">Delete</button></div>',
      ));
    const o = r.querySelector("textarea");
    ((o.value = n && n.v ? n.v : ""),
      (r.querySelector(".ytp-extra-notes-head button").onclick = () =>
        r.remove()),
      (r.querySelector(".ytp-btn.primary").onclick = async () => {
        (await k("kv", { k: t, v: o.value, updatedAt: Date.now() }),
          pe("Note saved", 1200, "success"));
      }),
      (r.querySelectorAll(".ytp-btn")[1].onclick = async () => {
        (await x("kv", t), (o.value = ""), pe("Note deleted.", 1200, "info"));
      }),
      document.body.appendChild(r),
      (gr.notesPanel = r));
  }
  let Pr = !1;
  async function Ir() {
    if (Pr || !Xt.visible) return;
    const e = !!S.numberSearchResultsOn,
      t = !!S.highlightLongVideosOn,
      a = !!S.highlightShortVideosOn,
      n = !!S.hideLiveContentOn,
      r = !!S.hidePremieresOn,
      o = S.feedDimWatchedOn || S.feedHideWatchedOn;
    if (e || t || a || n || r || o)
      if (performance.now() - Zt < 250) ae(Ir, 400);
      else {
        Pr = !0;
        try {
          const i = Array.from(
              document.querySelectorAll(
                "ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer,ytd-grid-video-renderer",
              ),
            ),
            d = new Map(),
            c = Number(S.longVideoMinSec) || 1200,
            s = Number(S.shortVideoMaxSec) || 60;
          for (let l = 0; l < i.length; l++) {
            const p = i[l],
              u = fr(p);
            if (e && !p.querySelector(".ytp-extra-num")) {
              const e = document.createElement("span");
              ((e.className = "ytp-extra-num"),
                (e.textContent = String(l + 1)),
                (p.querySelector("#thumbnail") || p).prepend(e));
            }
            const h = t || a ? br(p) : 0;
            if (
              (t && p.classList.toggle("ytp-extra-long", h >= c),
              a && p.classList.toggle("ytp-extra-short", h > 0 && h <= s),
              n || r)
            ) {
              const e = vr(p);
              (n &&
                p.classList.toggle(
                  "ytp-extra-live",
                  /\bLIVE\b|watching now|live now/i.test(e),
                ),
                r &&
                  p.classList.toggle(
                    "ytp-extra-premiere",
                    /premiere|premieres/i.test(e),
                  ));
            }
            (u &&
              o &&
              (d.has(u) ||
                d.set(
                  u,
                  Ee(u).then(
                    (e) => !(!e || !(e.completed || (e.progress || 0) > 90)),
                  ),
                ),
              d.get(u).then((e) => {
                p.isConnected &&
                  (p.classList.toggle(
                    "ytp-extra-watched-dim",
                    e && !!S.feedDimWatchedOn,
                  ),
                  p.classList.toggle(
                    "ytp-extra-watched-hide",
                    e && !!S.feedHideWatchedOn,
                  ));
              })),
              (l + 1) % 40 == 0 && (await ne()));
          }
        } finally {
          Pr = !1;
        }
      }
  }
  const Rr = () => ae(Ir, 1200);
  (xa.register({
    id: "auto-pause",
    name: "Auto Pause",
    summary:
      "Pause the video when you switch tabs, click out of the window, or both.",
    masterKey: "autoPauseMode",
    keys: ["autoPauseMode", "autoPauseHiddenOn", "autoPauseBlurOn"],
    isOn: () => S.autoPauseMode && "off" !== S.autoPauseMode,
    apply(e) {
      const t = S.autoPauseMode || "off";
      "off" !== t &&
        (("hidden" !== t && "both" !== t) ||
          e.addListener(document, "visibilitychange", () => {
            const e = ie.el();
            document.hidden &&
              e &&
              !e.paused &&
              ((gr.autoPaused = !0), ie.pause());
          }),
        ("blur" !== t && "both" !== t) ||
          e.addListener(window, "blur", () => {
            const e = ie.el();
            e && !e.paused && ((gr.autoPaused = !0), ie.pause());
          }));
    },
    settings(e) {
      e.appendChild(
        Ro("Mode", "autoPauseMode", {
          off: "Off",
          hidden: "When tab is hidden",
          blur: "When window loses focus",
          both: "Both (hidden or unfocused)",
        }),
      );
    },
  }),
    xa.register({
      id: "auto-resume-autopaused",
      hidden: !0,
      name: "Auto Resume Auto-Paused",
      summary: "Resume only videos paused by YT-zen auto-pause features.",
      masterKey: "autoResumeAutoPausedOn",
      keys: ["autoResumeAutoPausedOn"],
      apply(e) {
        if (!S.autoResumeAutoPausedOn) return;
        const t = () => {
          const e = ie.el();
          !document.hidden &&
            gr.autoPaused &&
            e &&
            e.paused &&
            ((gr.autoPaused = !1), e.play().catch(() => {}));
        };
        (e.addListener(document, "visibilitychange", t),
          e.addListener(window, "focus", t));
      },
      settings() {},
    }),
    xa.register({
      id: "confirm-leave-playing",
      name: "Confirm Leave While Playing",
      summary:
        "Ask for confirmation before closing or leaving the page while a video is playing.",
      masterKey: "confirmLeavePlayingOn",
      keys: ["confirmLeavePlayingOn"],
      apply(e) {
        S.confirmLeavePlayingOn &&
          e.addListener(window, "beforeunload", (e) => {
            const t = ie.el();
            if (t && !t.paused && !t.ended)
              return (e.preventDefault(), (e.returnValue = ""), "");
          });
      },
      settings() {},
    }),
    xa.register({
      id: "top-progress-bar",
      name: "Top Playback Progress Bar",
      summary: "Show a thin progress bar pinned to the very top of the page.",
      masterKey: "topProgressBarOn",
      keys: ["topProgressBarOn"],
      apply(e) {
        if (!S.topProgressBarOn) return void Lr("#ytp-extra-topbar");
        const t = document.createElement("div");
        ((t.id = "ytp-extra-topbar"), document.body.appendChild(t));
        let a = -1;
        const n = () => {
            const e = ie.el(),
              n =
                e && e.duration
                  ? Math.min(100, (e.currentTime / e.duration) * 100)
                  : 0,
              r = Math.round(10 * n) / 10;
            return (
              r !== a &&
              ((a = r),
              pa(() => {
                t.style.width = r + "%";
              }),
              !0)
            );
          },
          r = ie.el();
        (r &&
          (e.addListener(r, "timeupdate", n),
          e.addListener(r, "seeked", n),
          e.addListener(r, "loadedmetadata", n)),
          e.onNav(() =>
            e.addTimeout(() => {
              const t = ie.el();
              t && e.addListener(t, "timeupdate", n);
            }, 1200),
          ),
          Yt["top-progress-bar"].push(() => t.remove()));
      },
      settings() {},
    }),
    xa.register({
      id: "remaining-time-badge",
      name: "Remaining Time Badge",
      summary: "Show how much time is left in the video on top of the player.",
      masterKey: "remainingTimeBadgeOn",
      keys: ["remainingTimeBadgeOn"],
      apply(e) {
        if (!S.remainingTimeBadgeOn) return void Lr("#ytp-extra-remain");
        const t = document.createElement("div");
        ((t.id = "ytp-extra-remain"), document.body.appendChild(t));
        let a = -1;
        const n = () => {
            const e = ie.el();
            if (!e || !e.duration) return;
            const n = Math.floor(e.duration - e.currentTime);
            n !== a &&
              ((a = n),
              pa(() => {
                t.textContent = "−" + ce(n);
              }));
          },
          r = ie.el();
        (r &&
          (e.addListener(r, "timeupdate", n),
          e.addListener(r, "loadedmetadata", n)),
          e.onNav(() =>
            e.addTimeout(() => {
              const t = ie.el();
              t && e.addListener(t, "timeupdate", n);
            }, 1200),
          ),
          Yt["remaining-time-badge"].push(() => t.remove()));
      },
      settings() {},
    }),
    xa.register({
      id: "local-clock-badge",
      name: "Local Clock Badge",
      summary: "Show the current time next to the player.",
      masterKey: "localClockBadgeOn",
      keys: ["localClockBadgeOn"],
      apply(e) {
        if (!S.localClockBadgeOn) return void Lr("#ytp-extra-clock");
        const t = document.createElement("div");
        ((t.id = "ytp-extra-clock"), document.body.appendChild(t));
        let a = -1;
        const n = () => {
          const e = new Date().getMinutes();
          return (
            e !== a &&
            ((a = e),
            pa(() => {
              t.textContent = new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
            }),
            !0)
          );
        };
        (n(),
          e.addInterval(n, 15e3),
          Yt["local-clock-badge"].push(() => t.remove()));
      },
      settings() {},
    }),
    xa.register({
      id: "copy-timestamp-button",
      hidden: !0,
      name: "Copy Timestamp Button",
      summary: "Add a player button that copies the current timestamp URL.",
      masterKey: "copyTimestampButtonOn",
      keys: ["copyTimestampButtonOn"],
      apply(e) {
        if (!S.copyTimestampButtonOn) return void Lr(".ytp-extra-copy-time");
        const t = () =>
          Cr(
            "ytp-extra-copy-time",
            "Copy link to this moment",
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/></svg>',
            async () => {
              try {
                (await navigator.clipboard.writeText(Ar()),
                  pe("Timestamp copied to clipboard.", 1200, "success"));
              } catch (e) {
                pe("Couldn’t copy.", 1200, "error");
              }
            },
          );
        (t(), Mr("copy-timestamp-button", t));
      },
      settings() {},
    }),
    xa.register({
      id: "copy-video-info-button",
      hidden: !0,
      name: "Copy Video Info Button",
      summary: "Copy title, channel, and URL from a player button.",
      masterKey: "copyVideoInfoButtonOn",
      keys: ["copyVideoInfoButtonOn"],
      apply(e) {
        if (!S.copyVideoInfoButtonOn) return void Lr(".ytp-extra-copy-info");
        const t = () =>
          Cr(
            "ytp-extra-copy-info",
            "Copy video title, channel, and link",
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
            async () => {
              const e = ie.title() + "\n" + ie.channel() + "\n" + Ar();
              try {
                (await navigator.clipboard.writeText(e),
                  pe("Video details copied to clipboard.", 1200, "success"));
              } catch (e) {
                pe("Copy failed", 1200, "error");
              }
            },
          );
        (t(), Mr("copy-video-info-button", t));
      },
      settings() {},
    }),
    xa.register({
      id: "open-transcript-button",
      hidden: !0,
      name: "Open Transcript Button",
      summary:
        "Add a player button that opens YouTube's transcript panel when available.",
      masterKey: "openTranscriptButtonOn",
      keys: ["openTranscriptButtonOn"],
      apply(e) {
        if (!S.openTranscriptButtonOn) return void Lr(".ytp-extra-transcript");
        const t = () => {
            const e = Array.from(
              document.querySelectorAll(
                "button,yt-button-shape button,tp-yt-paper-item,ytd-menu-service-item-renderer",
              ),
            ).find((e) =>
              /transcript/i.test(
                e.textContent || e.getAttribute("aria-label") || "",
              ),
            );
            e
              ? e.click()
              : pe("No transcript available for this video.", 1500, "info");
          },
          a = () =>
            Cr(
              "ytp-extra-transcript",
              "Show the transcript",
              '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h5v7h7v9H6zm2-7h8v1.5H8V13zm0 3h5v1.5H8V16z"/></svg>',
              t,
            );
        (a(), Mr("open-transcript-button", a));
      },
      settings() {},
    }),
    xa.register({
      id: "video-notes",
      hidden: !0,
      name: "Video Notes",
      summary: "Store private local notes for the current video.",
      masterKey: "videoNotesOn",
      keys: ["videoNotesOn"],
      apply(e) {
        if (!S.videoNotesOn)
          return void Lr(".ytp-extra-vnote,#ytp-extra-notes");
        const t = () =>
          Cr(
            "ytp-extra-vnote",
            "Notes for this video",
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83a1 1 0 0 0 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg>',
            () => Br("video"),
          );
        (t(), Mr("video-notes", t));
      },
      settings() {},
    }),
    xa.register({
      id: "channel-notes",
      hidden: !0,
      name: "Channel Notes",
      summary: "Store private local notes for the current channel.",
      masterKey: "channelNotesOn",
      keys: ["channelNotesOn"],
      apply(e) {
        if (!S.channelNotesOn)
          return void Lr(".ytp-extra-cnote,#ytp-extra-notes");
        const t = () =>
          Cr(
            "ytp-extra-cnote",
            "Notes for this channel",
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>',
            () => Br("channel"),
          );
        (t(), Mr("channel-notes", t));
      },
      settings() {},
    }),
    xa.register({
      id: "chapter-hotkeys",
      hidden: !0,
      name: "Chapter Hotkeys",
      summary:
        "Use N and P to jump to next/previous chapter (rebindable in Hotkey Customization).",
      masterKey: "chapterHotkeysOn",
      keys: ["chapterHotkeysOn"],
      apply() {},
      settings() {},
    }),
    xa.register({
      id: "chapter-buttons",
      hidden: !0,
      name: "Chapter Buttons",
      summary: "Add previous/next chapter buttons to the player controls.",
      masterKey: "chapterButtonsOn",
      keys: ["chapterButtonsOn"],
      apply(e) {
        if (!S.chapterButtonsOn)
          return void Lr(".ytp-extra-prev-ch,.ytp-extra-next-ch");
        const t = () => {
          (Cr(
            "ytp-extra-prev-ch",
            "Previous chapter",
            '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 6h2v12H7V6Zm3 6 8-6v12l-8-6Z"/></svg>',
            () => Er(-1),
          ),
            Cr(
              "ytp-extra-next-ch",
              "Next chapter",
              '<svg viewBox="0 0 24 24"><path fill="currentColor" d="m6 18 8-6-8-6v12Zm9-12h2v12h-2V6Z"/></svg>',
              () => Er(1),
            ));
        };
        (t(), Mr("chapter-buttons", t));
      },
      settings() {},
    }),
    xa.register({
      id: "feed-watched",
      name: "Watched Feed Videos",
      summary:
        "Dim or hide videos in your feed once you’ve finished watching them.",
      masterKey: "feedWatchedMode",
      keys: ["feedWatchedMode", "feedDimWatchedOn", "feedHideWatchedOn"],
      isOn: () => S.feedWatchedMode && "off" !== S.feedWatchedMode,
      apply(e) {
        S.feedWatchedMode &&
          "off" !== S.feedWatchedMode &&
          (Rr(), e.addInterval(Rr, 3e3));
      },
      settings(e) {
        e.appendChild(
          Ro("Mode", "feedWatchedMode", {
            off: "Off",
            dim: "Dim watched videos",
            hide: "Hide watched videos",
          }),
        );
      },
    }),
    xa.register({
      id: "number-search-results",
      hidden: !0,
      name: "Number Feed Results",
      summary: "Add ordinal numbers to visible video cards.",
      masterKey: "numberSearchResultsOn",
      keys: ["numberSearchResultsOn"],
      apply(e) {
        S.numberSearchResultsOn
          ? (Rr(), e.addInterval(Rr, 2500))
          : Lr(".ytp-extra-num");
      },
      settings() {},
    }),
    xa.register({
      id: "dense-video-grid",
      name: "Dense Video Grid",
      summary:
        "Fit more videos on your screen at once on the home and search pages.",
      masterKey: "denseVideoGridOn",
      keys: ["denseVideoGridOn"],
      apply(e) {
        S.denseVideoGridOn &&
          e.addStyle(
            "ytd-rich-grid-renderer{--ytd-rich-grid-items-per-row:5!important;--ytd-rich-grid-posts-per-row:5!important}ytd-rich-item-renderer{margin-bottom:14px!important}ytd-video-renderer{margin:6px 0!important}",
          );
      },
      settings() {},
    }),
    xa.register({
      id: "highlight-video-length",
      name: "Highlight Videos by Length",
      summary:
        "Mark videos in your feed that are unusually long, unusually short, or both - so you can spot them at a glance.",
      masterKey: "highlightVideoLengthMode",
      keys: [
        "highlightVideoLengthMode",
        "longVideoMinSec",
        "shortVideoMaxSec",
        "highlightLongVideosOn",
        "highlightShortVideosOn",
      ],
      isOn: () =>
        S.highlightVideoLengthMode && "off" !== S.highlightVideoLengthMode,
      apply(e) {
        S.highlightVideoLengthMode &&
          "off" !== S.highlightVideoLengthMode &&
          (Rr(), e.addInterval(Rr, 2500));
      },
      settings(e) {
        (e.appendChild(
          Ro("Mode", "highlightVideoLengthMode", {
            off: "Off",
            long: "Long only",
            short: "Short only",
            both: "Long + Short",
          }),
        ),
          e.appendChild(
            No(
              "Long video threshold (seconds)",
              "longVideoMinSec",
              300,
              14400,
              60,
              (e) => ce(e),
            ),
          ),
          e.appendChild(
            No(
              "Short video threshold (seconds)",
              "shortVideoMaxSec",
              5,
              300,
              5,
              (e) => ce(e),
            ),
          ));
      },
    }),
    xa.register({
      id: "hide-live-content",
      hidden: !0,
      name: "Hide Live Content",
      summary: "Hide video cards that appear to be live streams.",
      masterKey: "hideLiveContentOn",
      keys: ["hideLiveContentOn"],
      apply(e) {
        S.hideLiveContentOn && (Rr(), e.addInterval(Rr, 2500));
      },
      settings() {},
    }),
    xa.register({
      id: "hide-premieres",
      hidden: !0,
      name: "Hide Premieres",
      summary: "Hide premiere cards from feeds and sidebars.",
      masterKey: "hidePremieresOn",
      keys: ["hidePremieresOn"],
      apply(e) {
        S.hidePremieresOn && (Rr(), e.addInterval(Rr, 2500));
      },
      settings() {},
    }),
    xa.register({
      id: "playlist-autoscroll",
      hidden: !0,
      name: "Playlist Autoscroll Current",
      summary: "Keep the current playlist entry in view.",
      masterKey: "playlistAutoscrollOn",
      keys: ["playlistAutoscrollOn"],
      apply(e) {
        if (!S.playlistAutoscrollOn) return;
        const t = () => {
          const e = document.querySelector(
            "ytd-playlist-panel-video-renderer[selected],ytd-playlist-panel-video-renderer[watch-color-update]",
          );
          e && e.scrollIntoView({ block: "center" });
        };
        (e.addInterval(t, 3e3), e.onNav(() => e.addTimeout(t, 1500)));
      },
      settings() {},
    }),
    xa.register({
      id: "compact-playlist",
      hidden: !0,
      name: "Compact Playlist",
      summary: "Reduce playlist panel row spacing.",
      masterKey: "compactPlaylistOn",
      keys: ["compactPlaylistOn"],
      apply(e) {
        S.compactPlaylistOn &&
          e.addStyle(
            "ytd-playlist-panel-video-renderer{min-height:48px!important}ytd-playlist-panel-video-renderer #thumbnail{transform:scale(.82);transform-origin:left center}ytd-playlist-panel-video-renderer #video-title{font-size:12px!important;line-height:1.25!important}",
          );
      },
      settings() {},
    }),
    xa.register({
      id: "shorts-auto-mute",
      hidden: !0,
      name: "Shorts Auto Mute",
      summary: "Mute videos while on Shorts pages.",
      masterKey: "shortsAutoMuteOn",
      keys: ["shortsAutoMuteOn"],
      apply(e) {
        if (!S.shortsAutoMuteOn) return;
        const t = () => {
          location.pathname.startsWith("/shorts/") &&
            document.querySelectorAll("video").forEach((e) => {
              e.muted = !0;
            });
        };
        (t(),
          e.onNav(() => {
            (e.addTimeout(t, 300), e.addTimeout(t, 1e3));
          }),
          document.body &&
            e.addObserver(document.body, ee(t, 250), {
              childList: !0,
              subtree: !0,
            }));
      },
      settings() {},
    }),
    xa.register({
      id: "shorts-hide-comments",
      hidden: !0,
      name: "Shorts Hide Comments Panel",
      summary: "Hide Shorts comment engagement panels.",
      masterKey: "shortsHideCommentsOn",
      keys: ["shortsHideCommentsOn"],
      apply(e) {
        S.shortsHideCommentsOn &&
          e.addStyle(
            "ytd-engagement-panel-section-list-renderer[target-id='shorts-engagement-panel-comments-section']{display:none!important}",
          );
      },
      settings() {},
    }),
    xa.register({
      id: "collapse-long-comments",
      hidden: !0,
      name: "Collapse Long Comments",
      summary: "Clamp very long comments with a local expand button.",
      masterKey: "collapseLongCommentsOn",
      keys: ["collapseLongCommentsOn", "collapseLongCommentChars"],
      apply(e) {
        if (!S.collapseLongCommentsOn)
          return void Lr(".ytp-extra-expand-comment");
        const t = () =>
          document
            .querySelectorAll("ytd-comment-renderer #content-text")
            .forEach((e) => {
              if (
                e.dataset.ytpClamped ||
                e.textContent.length <
                  (Number(S.collapseLongCommentChars) || 1200)
              )
                return;
              ((e.dataset.ytpClamped = "1"),
                e.classList.add("ytp-extra-comment-clamp"));
              const t = document.createElement("button");
              ((t.type = "button"),
                (t.className = "ytp-extra-expand-comment"),
                (t.textContent = "Expand comment"),
                (t.onclick = () => {
                  (e.classList.toggle("ytp-extra-comment-clamp"),
                    (t.textContent = e.classList.contains(
                      "ytp-extra-comment-clamp",
                    )
                      ? "Expand comment"
                      : "Collapse comment"));
                }),
                e.insertAdjacentElement("afterend", t));
            });
        (t(), e.addInterval(t, 2500));
      },
      settings(e) {
        e.appendChild(
          No(
            "Clamp after",
            "collapseLongCommentChars",
            400,
            5e3,
            100,
            (e) => e + " chars",
          ),
        );
      },
    }),
    xa.register({
      id: "highlight-creator-comments",
      hidden: !0,
      name: "Highlight Creator Comments",
      summary: "Highlight comments marked as creator/uploader comments.",
      masterKey: "highlightCreatorCommentsOn",
      keys: ["highlightCreatorCommentsOn"],
      apply(e) {
        S.highlightCreatorCommentsOn &&
          e.addStyle(
            "ytd-comment-renderer:has(ytd-author-comment-badge-renderer),ytd-comment-renderer:has(#author-comment-badge){box-shadow:inset 3px 0 0 #3ea6ff!important;background:rgba(62,166,255,.08)!important}",
          );
      },
      settings() {},
    }),
    xa.register({
      id: "highlight-timestamp-links",
      hidden: !0,
      name: "Highlight Timestamp Links",
      summary:
        "Make timestamp links in descriptions and comments easier to spot.",
      masterKey: "highlightTimestampLinksOn",
      keys: ["highlightTimestampLinksOn"],
      apply(e) {
        S.highlightTimestampLinksOn &&
          e.addStyle(
            "a[href*='t='],a[href*='start=']{background:rgba(62,166,255,.14)!important;border-radius:4px!important;padding:0 3px!important;font-weight:700!important}",
          );
      },
      settings() {},
    }),
    xa.register({
      id: "end-soon-warning",
      name: "End Soon Warning",
      summary: "Show a gentle warning when the video is about to end.",
      masterKey: "endSoonWarningOn",
      keys: ["endSoonWarningOn", "endSoonSec"],
      apply(e) {
        if (!S.endSoonWarningOn) return void Lr("#ytp-extra-endwarn");
        const t = document.createElement("div");
        ((t.id = "ytp-extra-endwarn"), document.body.appendChild(t));
        let a = !1,
          n = -1;
        const r = () => {
            const e = ie.el();
            if (!e || !e.duration)
              return void (a && (t.classList.remove("show"), (a = !1)));
            const r = Math.floor(e.duration - e.currentTime),
              o = Number(S.endSoonSec) || 20,
              i = r > 0 && r <= o;
            (i &&
              r !== n &&
              ((n = r),
              pa(() => {
                t.textContent = "Ending in " + ce(r);
              })),
              i !== a &&
                ((a = i),
                pa(() => {
                  t.classList.toggle("show", i);
                })));
          },
          o = ie.el();
        (o &&
          (e.addListener(o, "timeupdate", r),
          e.addListener(o, "loadedmetadata", r)),
          e.onNav(() =>
            e.addTimeout(() => {
              const t = ie.el();
              t && e.addListener(t, "timeupdate", r);
            }, 1200),
          ),
          Yt["end-soon-warning"].push(() => t.remove()));
      },
      settings(e) {
        e.appendChild(
          No("Warn with", "endSoonSec", 5, 120, 5, (e) => e + "s left"),
        );
      },
    }));
  const Nr = [
    { id: "none", name: "Default (YouTube)", mode: "auto", vars: null },
    {
      id: "d-charcoal",
      name: "Charcoal",
      mode: "dark",
      vars: {
        "base-background": "#1a1a1a",
        "raised-background": "#242424",
        "menu-background": "#2a2a2a",
        "general-background-a": "#1a1a1a",
        "general-background-b": "#1a1a1a",
        "general-background-c": "#242424",
        "text-primary": "#e8e8e8",
        "text-secondary": "#aaa",
        "text-disabled": "#666",
        "badge-chip-background": "#333",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#c00",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#e8e8e8",
        "icon-inactive": "#aaa",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-midnight",
      name: "Midnight Blue",
      mode: "dark",
      vars: {
        "base-background": "#0d1117",
        "raised-background": "#161b22",
        "menu-background": "#1c2128",
        "general-background-a": "#0d1117",
        "general-background-b": "#0d1117",
        "general-background-c": "#161b22",
        "text-primary": "#e6edf3",
        "text-secondary": "#8b949e",
        "text-disabled": "#555d67",
        "badge-chip-background": "#21262d",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#58a6ff",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#e6edf3",
        "icon-inactive": "#8b949e",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-amoled",
      name: "AMOLED Black",
      mode: "dark",
      vars: {
        "base-background": "#000000",
        "raised-background": "#0a0a0a",
        "menu-background": "#111111",
        "general-background-a": "#000000",
        "general-background-b": "#000000",
        "general-background-c": "#0a0a0a",
        "text-primary": "#e0e0e0",
        "text-secondary": "#999",
        "text-disabled": "#555",
        "badge-chip-background": "#1a1a1a",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#c00",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#e0e0e0",
        "icon-inactive": "#999",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-nord",
      name: "Nord",
      mode: "dark",
      vars: {
        "base-background": "#2e3440",
        "raised-background": "#3b4252",
        "menu-background": "#434c5e",
        "general-background-a": "#2e3440",
        "general-background-b": "#2e3440",
        "general-background-c": "#3b4252",
        "text-primary": "#eceff4",
        "text-secondary": "#d8dee9",
        "text-disabled": "#7a8394",
        "badge-chip-background": "#4c566a",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#88c0d0",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#eceff4",
        "icon-inactive": "#d8dee9",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-dracula",
      name: "Dracula",
      mode: "dark",
      vars: {
        "base-background": "#282a36",
        "raised-background": "#2d2f3d",
        "menu-background": "#343746",
        "general-background-a": "#282a36",
        "general-background-b": "#282a36",
        "general-background-c": "#2d2f3d",
        "text-primary": "#f8f8f2",
        "text-secondary": "#bfbfbf",
        "text-disabled": "#6272a4",
        "badge-chip-background": "#44475a",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#bd93f9",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#f8f8f2",
        "icon-inactive": "#bfbfbf",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-solarized",
      name: "Solarized Dark",
      mode: "dark",
      vars: {
        "base-background": "#002b36",
        "raised-background": "#073642",
        "menu-background": "#0a3f4e",
        "general-background-a": "#002b36",
        "general-background-b": "#002b36",
        "general-background-c": "#073642",
        "text-primary": "#fdf6e3",
        "text-secondary": "#93a1a1",
        "text-disabled": "#586e75",
        "badge-chip-background": "#094150",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#268bd2",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#fdf6e3",
        "icon-inactive": "#93a1a1",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-monokai",
      name: "Monokai",
      mode: "dark",
      vars: {
        "base-background": "#272822",
        "raised-background": "#2e2f28",
        "menu-background": "#3e3d32",
        "general-background-a": "#272822",
        "general-background-b": "#272822",
        "general-background-c": "#2e2f28",
        "text-primary": "#f8f8f2",
        "text-secondary": "#c0c0b0",
        "text-disabled": "#75715e",
        "badge-chip-background": "#49483e",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#a6e22e",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#f8f8f2",
        "icon-inactive": "#c0c0b0",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-catppuccin",
      name: "Catppuccin Mocha",
      mode: "dark",
      vars: {
        "base-background": "#1e1e2e",
        "raised-background": "#24243b",
        "menu-background": "#2a2a45",
        "general-background-a": "#1e1e2e",
        "general-background-b": "#1e1e2e",
        "general-background-c": "#24243b",
        "text-primary": "#cdd6f4",
        "text-secondary": "#a6adc8",
        "text-disabled": "#6c7086",
        "badge-chip-background": "#313244",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#cba6f7",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#cdd6f4",
        "icon-inactive": "#a6adc8",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-deep-ocean",
      name: "Deep Ocean",
      mode: "dark",
      vars: {
        "base-background": "#0b1622",
        "raised-background": "#111d2e",
        "menu-background": "#152238",
        "general-background-a": "#0b1622",
        "general-background-b": "#0b1622",
        "general-background-c": "#111d2e",
        "text-primary": "#dde4ee",
        "text-secondary": "#8899aa",
        "text-disabled": "#506070",
        "badge-chip-background": "#1a2c42",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#4fc3f7",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#dde4ee",
        "icon-inactive": "#8899aa",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-forest",
      name: "Forest Night",
      mode: "dark",
      vars: {
        "base-background": "#1a2316",
        "raised-background": "#222e1c",
        "menu-background": "#2a3822",
        "general-background-a": "#1a2316",
        "general-background-b": "#1a2316",
        "general-background-c": "#222e1c",
        "text-primary": "#dce5d5",
        "text-secondary": "#a0b090",
        "text-disabled": "#607050",
        "badge-chip-background": "#334428",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#66bb6a",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#dce5d5",
        "icon-inactive": "#a0b090",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-ember",
      name: "Ember",
      mode: "dark",
      vars: {
        "base-background": "#1c1210",
        "raised-background": "#271916",
        "menu-background": "#30201c",
        "general-background-a": "#1c1210",
        "general-background-b": "#1c1210",
        "general-background-c": "#271916",
        "text-primary": "#eeddd6",
        "text-secondary": "#bba090",
        "text-disabled": "#776058",
        "badge-chip-background": "#3a2824",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#ef5350",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#eeddd6",
        "icon-inactive": "#bba090",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-amethyst",
      name: "Amethyst",
      mode: "dark",
      vars: {
        "base-background": "#1a1424",
        "raised-background": "#221a30",
        "menu-background": "#2a203a",
        "general-background-a": "#1a1424",
        "general-background-b": "#1a1424",
        "general-background-c": "#221a30",
        "text-primary": "#e0d8ee",
        "text-secondary": "#a898c0",
        "text-disabled": "#6a5888",
        "badge-chip-background": "#352a48",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#b388ff",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#e0d8ee",
        "icon-inactive": "#a898c0",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-slate",
      name: "Warm Slate",
      mode: "dark",
      vars: {
        "base-background": "#1e1e1e",
        "raised-background": "#282828",
        "menu-background": "#303030",
        "general-background-a": "#1e1e1e",
        "general-background-b": "#1e1e1e",
        "general-background-c": "#282828",
        "text-primary": "#d4d4d4",
        "text-secondary": "#a0a0a0",
        "text-disabled": "#606060",
        "badge-chip-background": "#3a3a3a",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#ff7043",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#d4d4d4",
        "icon-inactive": "#a0a0a0",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-tokyo",
      name: "Tokyo Night",
      mode: "dark",
      vars: {
        "base-background": "#1a1b26",
        "raised-background": "#1f2030",
        "menu-background": "#24253a",
        "general-background-a": "#1a1b26",
        "general-background-b": "#1a1b26",
        "general-background-c": "#1f2030",
        "text-primary": "#c0caf5",
        "text-secondary": "#9aa5ce",
        "text-disabled": "#565f89",
        "badge-chip-background": "#292a3e",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#7aa2f7",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#c0caf5",
        "icon-inactive": "#9aa5ce",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-rosepine",
      name: "Rose Pine",
      mode: "dark",
      vars: {
        "base-background": "#191724",
        "raised-background": "#1f1d2e",
        "menu-background": "#26233a",
        "general-background-a": "#191724",
        "general-background-b": "#191724",
        "general-background-c": "#1f1d2e",
        "text-primary": "#e0def4",
        "text-secondary": "#908caa",
        "text-disabled": "#6e6a86",
        "badge-chip-background": "#2a2740",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#eb6f92",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#e0def4",
        "icon-inactive": "#908caa",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-onedark",
      name: "One Dark",
      mode: "dark",
      vars: {
        "base-background": "#282c34",
        "raised-background": "#21252b",
        "menu-background": "#3a3f4b",
        "general-background-a": "#282c34",
        "general-background-b": "#282c34",
        "general-background-c": "#21252b",
        "text-primary": "#abb2bf",
        "text-secondary": "#9099a8",
        "text-disabled": "#5c6370",
        "badge-chip-background": "#3e4451",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#61afef",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#abb2bf",
        "icon-inactive": "#9099a8",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-ayu-mirage",
      name: "Ayu Mirage",
      mode: "dark",
      vars: {
        "base-background": "#1f2430",
        "raised-background": "#171b24",
        "menu-background": "#272d38",
        "general-background-a": "#1f2430",
        "general-background-b": "#1f2430",
        "general-background-c": "#171b24",
        "text-primary": "#cbccc6",
        "text-secondary": "#8a9199",
        "text-disabled": "#5c6773",
        "badge-chip-background": "#33415e",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#ffcc66",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#cbccc6",
        "icon-inactive": "#8a9199",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-ayu-dark",
      name: "Ayu Dark",
      mode: "dark",
      vars: {
        "base-background": "#0a0e14",
        "raised-background": "#0d1015",
        "menu-background": "#11151c",
        "general-background-a": "#0a0e14",
        "general-background-b": "#0a0e14",
        "general-background-c": "#0d1015",
        "text-primary": "#b3b1ad",
        "text-secondary": "#828891",
        "text-disabled": "#3e4b59",
        "badge-chip-background": "#1f242e",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#39bae6",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#b3b1ad",
        "icon-inactive": "#828891",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-gruvbox",
      name: "Gruvbox Dark",
      mode: "dark",
      vars: {
        "base-background": "#282828",
        "raised-background": "#32302f",
        "menu-background": "#3c3836",
        "general-background-a": "#282828",
        "general-background-b": "#282828",
        "general-background-c": "#32302f",
        "text-primary": "#ebdbb2",
        "text-secondary": "#a89984",
        "text-disabled": "#7c6f64",
        "badge-chip-background": "#504945",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#fe8019",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#ebdbb2",
        "icon-inactive": "#a89984",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-gruvbox-soft",
      name: "Gruvbox Soft",
      mode: "dark",
      vars: {
        "base-background": "#32302f",
        "raised-background": "#3c3836",
        "menu-background": "#504945",
        "general-background-a": "#32302f",
        "general-background-b": "#32302f",
        "general-background-c": "#3c3836",
        "text-primary": "#ddc7a1",
        "text-secondary": "#a89984",
        "text-disabled": "#665c54",
        "badge-chip-background": "#665c54",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#d8a657",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#ddc7a1",
        "icon-inactive": "#a89984",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-zenburn",
      name: "Zenburn",
      mode: "dark",
      vars: {
        "base-background": "#3f3f3f",
        "raised-background": "#4a4a4a",
        "menu-background": "#525252",
        "general-background-a": "#3f3f3f",
        "general-background-b": "#3f3f3f",
        "general-background-c": "#4a4a4a",
        "text-primary": "#dcdccc",
        "text-secondary": "#a0a0a0",
        "text-disabled": "#777767",
        "badge-chip-background": "#5b5b5b",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#dca3a3",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#dcdccc",
        "icon-inactive": "#a0a0a0",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-night-owl",
      name: "Night Owl",
      mode: "dark",
      vars: {
        "base-background": "#011627",
        "raised-background": "#01111d",
        "menu-background": "#0b2942",
        "general-background-a": "#011627",
        "general-background-b": "#011627",
        "general-background-c": "#01111d",
        "text-primary": "#d6deeb",
        "text-secondary": "#8badc1",
        "text-disabled": "#637777",
        "badge-chip-background": "#1d3b53",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#82aaff",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#d6deeb",
        "icon-inactive": "#8badc1",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-palenight",
      name: "Palenight",
      mode: "dark",
      vars: {
        "base-background": "#292d3e",
        "raised-background": "#252836",
        "menu-background": "#34384a",
        "general-background-a": "#292d3e",
        "general-background-b": "#292d3e",
        "general-background-c": "#252836",
        "text-primary": "#a6accd",
        "text-secondary": "#8796b0",
        "text-disabled": "#676e95",
        "badge-chip-background": "#3a3f58",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#c792ea",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#a6accd",
        "icon-inactive": "#8796b0",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-shades-of-purple",
      name: "Shades of Purple",
      mode: "dark",
      vars: {
        "base-background": "#2d2b55",
        "raised-background": "#1e1e3f",
        "menu-background": "#3c3676",
        "general-background-a": "#2d2b55",
        "general-background-b": "#2d2b55",
        "general-background-c": "#1e1e3f",
        "text-primary": "#fad000",
        "text-secondary": "#a599e9",
        "text-disabled": "#7068a2",
        "badge-chip-background": "#3e3a82",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#fa48d8",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#fad000",
        "icon-inactive": "#a599e9",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-cobalt2",
      name: "Cobalt2",
      mode: "dark",
      vars: {
        "base-background": "#193549",
        "raised-background": "#0d2438",
        "menu-background": "#1f5479",
        "general-background-a": "#193549",
        "general-background-b": "#193549",
        "general-background-c": "#0d2438",
        "text-primary": "#ffffff",
        "text-secondary": "#7eb4e3",
        "text-disabled": "#0088ff",
        "badge-chip-background": "#234e6b",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#ff9d00",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#ffffff",
        "icon-inactive": "#7eb4e3",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-material-darker",
      name: "Material Darker",
      mode: "dark",
      vars: {
        "base-background": "#212121",
        "raised-background": "#1a1a1a",
        "menu-background": "#2a2a2a",
        "general-background-a": "#212121",
        "general-background-b": "#212121",
        "general-background-c": "#1a1a1a",
        "text-primary": "#eeffff",
        "text-secondary": "#9aa1ab",
        "text-disabled": "#545454",
        "badge-chip-background": "#404040",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#80cbc4",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#eeffff",
        "icon-inactive": "#9aa1ab",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-material-deep-ocean",
      name: "Material Deep Ocean",
      mode: "dark",
      vars: {
        "base-background": "#0f111a",
        "raised-background": "#090b10",
        "menu-background": "#1a1c25",
        "general-background-a": "#0f111a",
        "general-background-b": "#0f111a",
        "general-background-c": "#090b10",
        "text-primary": "#a6accd",
        "text-secondary": "#717cb4",
        "text-disabled": "#464b5d",
        "badge-chip-background": "#252738",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#84ffff",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#a6accd",
        "icon-inactive": "#717cb4",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-material-oceanic",
      name: "Material Oceanic",
      mode: "dark",
      vars: {
        "base-background": "#263238",
        "raised-background": "#1e272c",
        "menu-background": "#314549",
        "general-background-a": "#263238",
        "general-background-b": "#263238",
        "general-background-c": "#1e272c",
        "text-primary": "#b0bec5",
        "text-secondary": "#7f9eaf",
        "text-disabled": "#546e7a",
        "badge-chip-background": "#37474f",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#80cbc4",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#b0bec5",
        "icon-inactive": "#7f9eaf",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-material-palenight",
      name: "Material Palenight",
      mode: "dark",
      vars: {
        "base-background": "#292d3e",
        "raised-background": "#202331",
        "menu-background": "#34394e",
        "general-background-a": "#292d3e",
        "general-background-b": "#292d3e",
        "general-background-c": "#202331",
        "text-primary": "#a6accd",
        "text-secondary": "#717cb4",
        "text-disabled": "#676e95",
        "badge-chip-background": "#3a3f58",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#c792ea",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#a6accd",
        "icon-inactive": "#717cb4",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-spacegray",
      name: "Spacegray",
      mode: "dark",
      vars: {
        "base-background": "#2b303b",
        "raised-background": "#272b35",
        "menu-background": "#343d46",
        "general-background-a": "#2b303b",
        "general-background-b": "#2b303b",
        "general-background-c": "#272b35",
        "text-primary": "#c0c5ce",
        "text-secondary": "#a7adba",
        "text-disabled": "#65737e",
        "badge-chip-background": "#3e4554",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#bf616a",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#c0c5ce",
        "icon-inactive": "#a7adba",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-base16-default",
      name: "Base16 Default",
      mode: "dark",
      vars: {
        "base-background": "#181818",
        "raised-background": "#282828",
        "menu-background": "#383838",
        "general-background-a": "#181818",
        "general-background-b": "#181818",
        "general-background-c": "#282828",
        "text-primary": "#d8d8d8",
        "text-secondary": "#b8b8b8",
        "text-disabled": "#585858",
        "badge-chip-background": "#383838",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#7cafc2",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#d8d8d8",
        "icon-inactive": "#b8b8b8",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-iceberg",
      name: "Iceberg",
      mode: "dark",
      vars: {
        "base-background": "#161821",
        "raised-background": "#0f1117",
        "menu-background": "#1e2132",
        "general-background-a": "#161821",
        "general-background-b": "#161821",
        "general-background-c": "#0f1117",
        "text-primary": "#c6c8d1",
        "text-secondary": "#84a0c6",
        "text-disabled": "#6b7089",
        "badge-chip-background": "#272c42",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#84a0c6",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#c6c8d1",
        "icon-inactive": "#84a0c6",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-hyper",
      name: "Hyper",
      mode: "dark",
      vars: {
        "base-background": "#000000",
        "raised-background": "#1a1a1a",
        "menu-background": "#242424",
        "general-background-a": "#000000",
        "general-background-b": "#000000",
        "general-background-c": "#1a1a1a",
        "text-primary": "#ffffff",
        "text-secondary": "#a0a0a0",
        "text-disabled": "#606060",
        "badge-chip-background": "#2a2a2a",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#fe0095",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#ffffff",
        "icon-inactive": "#a0a0a0",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-firefly",
      name: "Firefly",
      mode: "dark",
      vars: {
        "base-background": "#161A1F",
        "raised-background": "#1c2027",
        "menu-background": "#252a31",
        "general-background-a": "#161A1F",
        "general-background-b": "#161A1F",
        "general-background-c": "#1c2027",
        "text-primary": "#d7d7d7",
        "text-secondary": "#888c93",
        "text-disabled": "#5c6066",
        "badge-chip-background": "#2c3038",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#ffaa00",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#d7d7d7",
        "icon-inactive": "#888c93",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-bluloco",
      name: "Bluloco Dark",
      mode: "dark",
      vars: {
        "base-background": "#282c34",
        "raised-background": "#21252b",
        "menu-background": "#3a3f4b",
        "general-background-a": "#282c34",
        "general-background-b": "#282c34",
        "general-background-c": "#21252b",
        "text-primary": "#abb2bf",
        "text-secondary": "#7a829b",
        "text-disabled": "#5c6370",
        "badge-chip-background": "#3e4451",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#10b1fe",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#abb2bf",
        "icon-inactive": "#7a829b",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-blueberry",
      name: "Blueberry",
      mode: "dark",
      vars: {
        "base-background": "#100d23",
        "raised-background": "#0a0820",
        "menu-background": "#170f3d",
        "general-background-a": "#100d23",
        "general-background-b": "#100d23",
        "general-background-c": "#0a0820",
        "text-primary": "#caf0f8",
        "text-secondary": "#8ccff8",
        "text-disabled": "#5c6f9c",
        "badge-chip-background": "#28265a",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#ff66c4",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#caf0f8",
        "icon-inactive": "#8ccff8",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-blackmore",
      name: "Blackmore",
      mode: "dark",
      vars: {
        "base-background": "#181818",
        "raised-background": "#0d0d0d",
        "menu-background": "#222222",
        "general-background-a": "#181818",
        "general-background-b": "#181818",
        "general-background-c": "#0d0d0d",
        "text-primary": "#d0d0d0",
        "text-secondary": "#909090",
        "text-disabled": "#606060",
        "badge-chip-background": "#2a2a2a",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#7e57c2",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#d0d0d0",
        "icon-inactive": "#909090",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-vscode",
      name: "VS Code Dark+",
      mode: "dark",
      vars: {
        "base-background": "#1e1e1e",
        "raised-background": "#252526",
        "menu-background": "#2d2d30",
        "general-background-a": "#1e1e1e",
        "general-background-b": "#1e1e1e",
        "general-background-c": "#252526",
        "text-primary": "#cccccc",
        "text-secondary": "#a0a0a0",
        "text-disabled": "#6a6a6a",
        "badge-chip-background": "#3c3c3c",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#0098ff",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#cccccc",
        "icon-inactive": "#a0a0a0",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-github-dark",
      name: "GitHub Dark",
      mode: "dark",
      vars: {
        "base-background": "#0d1117",
        "raised-background": "#161b22",
        "menu-background": "#21262d",
        "general-background-a": "#0d1117",
        "general-background-b": "#0d1117",
        "general-background-c": "#161b22",
        "text-primary": "#c9d1d9",
        "text-secondary": "#8b949e",
        "text-disabled": "#6e7681",
        "badge-chip-background": "#30363d",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#58a6ff",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#c9d1d9",
        "icon-inactive": "#8b949e",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-github-dimmed",
      name: "GitHub Dimmed",
      mode: "dark",
      vars: {
        "base-background": "#22272e",
        "raised-background": "#2d333b",
        "menu-background": "#373e47",
        "general-background-a": "#22272e",
        "general-background-b": "#22272e",
        "general-background-c": "#2d333b",
        "text-primary": "#adbac7",
        "text-secondary": "#768390",
        "text-disabled": "#545d68",
        "badge-chip-background": "#444c56",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#539bf5",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#adbac7",
        "icon-inactive": "#768390",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-discord",
      name: "Discord",
      mode: "dark",
      vars: {
        "base-background": "#36393f",
        "raised-background": "#2f3136",
        "menu-background": "#202225",
        "general-background-a": "#36393f",
        "general-background-b": "#36393f",
        "general-background-c": "#2f3136",
        "text-primary": "#dcddde",
        "text-secondary": "#b9bbbe",
        "text-disabled": "#72767d",
        "badge-chip-background": "#40444b",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#5865f2",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#dcddde",
        "icon-inactive": "#b9bbbe",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-twitter-dim",
      name: "Twitter Dim",
      mode: "dark",
      vars: {
        "base-background": "#15202b",
        "raised-background": "#192734",
        "menu-background": "#22303c",
        "general-background-a": "#15202b",
        "general-background-b": "#15202b",
        "general-background-c": "#192734",
        "text-primary": "#ffffff",
        "text-secondary": "#8899a6",
        "text-disabled": "#5b7083",
        "badge-chip-background": "#283340",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#1da1f2",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#ffffff",
        "icon-inactive": "#8899a6",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-twitter-lights-out",
      name: "Twitter Lights Out",
      mode: "dark",
      vars: {
        "base-background": "#000000",
        "raised-background": "#16181c",
        "menu-background": "#1d1f23",
        "general-background-a": "#000000",
        "general-background-b": "#000000",
        "general-background-c": "#16181c",
        "text-primary": "#e7e9ea",
        "text-secondary": "#71767b",
        "text-disabled": "#5b7083",
        "badge-chip-background": "#2f3336",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#1d9bf0",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#e7e9ea",
        "icon-inactive": "#71767b",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-spotify",
      name: "Spotify",
      mode: "dark",
      vars: {
        "base-background": "#121212",
        "raised-background": "#181818",
        "menu-background": "#282828",
        "general-background-a": "#121212",
        "general-background-b": "#121212",
        "general-background-c": "#181818",
        "text-primary": "#ffffff",
        "text-secondary": "#b3b3b3",
        "text-disabled": "#727272",
        "badge-chip-background": "#404040",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#1db954",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#ffffff",
        "icon-inactive": "#b3b3b3",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-twitch",
      name: "Twitch",
      mode: "dark",
      vars: {
        "base-background": "#0e0e10",
        "raised-background": "#18181b",
        "menu-background": "#1f1f23",
        "general-background-a": "#0e0e10",
        "general-background-b": "#0e0e10",
        "general-background-c": "#18181b",
        "text-primary": "#efeff1",
        "text-secondary": "#adadb8",
        "text-disabled": "#53535f",
        "badge-chip-background": "#26262c",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#9147ff",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#efeff1",
        "icon-inactive": "#adadb8",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-reddit",
      name: "Reddit Dark",
      mode: "dark",
      vars: {
        "base-background": "#1a1a1b",
        "raised-background": "#272729",
        "menu-background": "#343536",
        "general-background-a": "#1a1a1b",
        "general-background-b": "#1a1a1b",
        "general-background-c": "#272729",
        "text-primary": "#d7dadc",
        "text-secondary": "#a8aaab",
        "text-disabled": "#818384",
        "badge-chip-background": "#3a3a3c",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#ff4500",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#d7dadc",
        "icon-inactive": "#a8aaab",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-stackoverflow",
      name: "Stack Overflow Dark",
      mode: "dark",
      vars: {
        "base-background": "#0c0d0e",
        "raised-background": "#1c2024",
        "menu-background": "#272a32",
        "general-background-a": "#0c0d0e",
        "general-background-b": "#0c0d0e",
        "general-background-c": "#1c2024",
        "text-primary": "#bcbbbb",
        "text-secondary": "#9199a1",
        "text-disabled": "#6a737c",
        "badge-chip-background": "#393939",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#f48024",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#bcbbbb",
        "icon-inactive": "#9199a1",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-vampire",
      name: "Vampire",
      mode: "dark",
      vars: {
        "base-background": "#1c0a1f",
        "raised-background": "#280f2c",
        "menu-background": "#3a163f",
        "general-background-a": "#1c0a1f",
        "general-background-b": "#1c0a1f",
        "general-background-c": "#280f2c",
        "text-primary": "#f0c4f4",
        "text-secondary": "#c08ec6",
        "text-disabled": "#7d5483",
        "badge-chip-background": "#4a234f",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#ff5555",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#f0c4f4",
        "icon-inactive": "#c08ec6",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-blood",
      name: "Blood Red",
      mode: "dark",
      vars: {
        "base-background": "#1a0a0a",
        "raised-background": "#221010",
        "menu-background": "#2b1414",
        "general-background-a": "#1a0a0a",
        "general-background-b": "#1a0a0a",
        "general-background-c": "#221010",
        "text-primary": "#ffe5e5",
        "text-secondary": "#cc9999",
        "text-disabled": "#805050",
        "badge-chip-background": "#3a1c1c",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#dc143c",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#ffe5e5",
        "icon-inactive": "#cc9999",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-toxic",
      name: "Toxic Green",
      mode: "dark",
      vars: {
        "base-background": "#0a1f0a",
        "raised-background": "#102810",
        "menu-background": "#143514",
        "general-background-a": "#0a1f0a",
        "general-background-b": "#0a1f0a",
        "general-background-c": "#102810",
        "text-primary": "#c5f7c5",
        "text-secondary": "#80cc80",
        "text-disabled": "#508050",
        "badge-chip-background": "#1c4a1c",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#39ff14",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#c5f7c5",
        "icon-inactive": "#80cc80",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-cyber",
      name: "Cyberpunk",
      mode: "dark",
      vars: {
        "base-background": "#0a0e27",
        "raised-background": "#10153d",
        "menu-background": "#171c52",
        "general-background-a": "#0a0e27",
        "general-background-b": "#0a0e27",
        "general-background-c": "#10153d",
        "text-primary": "#fcee0a",
        "text-secondary": "#ff00ff",
        "text-disabled": "#aaaaff",
        "badge-chip-background": "#1f2570",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#00ffff",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#fcee0a",
        "icon-inactive": "#ff00ff",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-synthwave",
      name: "Synthwave '84",
      mode: "dark",
      vars: {
        "base-background": "#241b30",
        "raised-background": "#2a2139",
        "menu-background": "#312844",
        "general-background-a": "#241b30",
        "general-background-b": "#241b30",
        "general-background-c": "#2a2139",
        "text-primary": "#ffffff",
        "text-secondary": "#a47acb",
        "text-disabled": "#5d5a73",
        "badge-chip-background": "#3b2d51",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#fe4cdf",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#ffffff",
        "icon-inactive": "#a47acb",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-outrun",
      name: "Outrun",
      mode: "dark",
      vars: {
        "base-background": "#221b40",
        "raised-background": "#1a1438",
        "menu-background": "#2c2253",
        "general-background-a": "#221b40",
        "general-background-b": "#221b40",
        "general-background-c": "#1a1438",
        "text-primary": "#fff7ec",
        "text-secondary": "#ffa724",
        "text-disabled": "#9989b8",
        "badge-chip-background": "#352a66",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#ff0080",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#fff7ec",
        "icon-inactive": "#ffa724",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-vaporwave",
      name: "Vaporwave",
      mode: "dark",
      vars: {
        "base-background": "#1d152e",
        "raised-background": "#251a37",
        "menu-background": "#2f2244",
        "general-background-a": "#1d152e",
        "general-background-b": "#1d152e",
        "general-background-c": "#251a37",
        "text-primary": "#ffdbef",
        "text-secondary": "#ff71ce",
        "text-disabled": "#a583c7",
        "badge-chip-background": "#3a2856",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#01cdfe",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#ffdbef",
        "icon-inactive": "#ff71ce",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-matrix",
      name: "Matrix",
      mode: "dark",
      vars: {
        "base-background": "#000000",
        "raised-background": "#001a00",
        "menu-background": "#002800",
        "general-background-a": "#000000",
        "general-background-b": "#000000",
        "general-background-c": "#001a00",
        "text-primary": "#00ff00",
        "text-secondary": "#00cc00",
        "text-disabled": "#008800",
        "badge-chip-background": "#003300",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#00ff41",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#00ff00",
        "icon-inactive": "#00cc00",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-hacker",
      name: "Hacker Terminal",
      mode: "dark",
      vars: {
        "base-background": "#0a0e0a",
        "raised-background": "#0d150d",
        "menu-background": "#101e10",
        "general-background-a": "#0a0e0a",
        "general-background-b": "#0a0e0a",
        "general-background-c": "#0d150d",
        "text-primary": "#76e57b",
        "text-secondary": "#509b54",
        "text-disabled": "#356639",
        "badge-chip-background": "#173a1a",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#34e848",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#76e57b",
        "icon-inactive": "#509b54",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-noir",
      name: "Noir",
      mode: "dark",
      vars: {
        "base-background": "#0d0d0d",
        "raised-background": "#141414",
        "menu-background": "#1c1c1c",
        "general-background-a": "#0d0d0d",
        "general-background-b": "#0d0d0d",
        "general-background-c": "#141414",
        "text-primary": "#e0e0e0",
        "text-secondary": "#a0a0a0",
        "text-disabled": "#606060",
        "badge-chip-background": "#2c2c2c",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#ffd700",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#e0e0e0",
        "icon-inactive": "#a0a0a0",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-coffee",
      name: "Coffee",
      mode: "dark",
      vars: {
        "base-background": "#2c1f17",
        "raised-background": "#3a2a1f",
        "menu-background": "#4a382b",
        "general-background-a": "#2c1f17",
        "general-background-b": "#2c1f17",
        "general-background-c": "#3a2a1f",
        "text-primary": "#e8d8c4",
        "text-secondary": "#b09980",
        "text-disabled": "#7a6650",
        "badge-chip-background": "#5a4538",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#d2691e",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#e8d8c4",
        "icon-inactive": "#b09980",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-burgundy",
      name: "Burgundy",
      mode: "dark",
      vars: {
        "base-background": "#1a0f12",
        "raised-background": "#22151a",
        "menu-background": "#2c1c22",
        "general-background-a": "#1a0f12",
        "general-background-b": "#1a0f12",
        "general-background-c": "#22151a",
        "text-primary": "#f0c8c8",
        "text-secondary": "#c08080",
        "text-disabled": "#805050",
        "badge-chip-background": "#3a2229",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#800020",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#f0c8c8",
        "icon-inactive": "#c08080",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-arctic",
      name: "Arctic",
      mode: "dark",
      vars: {
        "base-background": "#1c2e3f",
        "raised-background": "#243a4f",
        "menu-background": "#2c4660",
        "general-background-a": "#1c2e3f",
        "general-background-b": "#1c2e3f",
        "general-background-c": "#243a4f",
        "text-primary": "#e0eaf4",
        "text-secondary": "#a0b8d0",
        "text-disabled": "#6080a0",
        "badge-chip-background": "#385470",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#80d0ff",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#e0eaf4",
        "icon-inactive": "#a0b8d0",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-jungle",
      name: "Jungle",
      mode: "dark",
      vars: {
        "base-background": "#0f1a0f",
        "raised-background": "#172417",
        "menu-background": "#1f301f",
        "general-background-a": "#0f1a0f",
        "general-background-b": "#0f1a0f",
        "general-background-c": "#172417",
        "text-primary": "#d0e8d0",
        "text-secondary": "#80b080",
        "text-disabled": "#506850",
        "badge-chip-background": "#284028",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#8bc34a",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#d0e8d0",
        "icon-inactive": "#80b080",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-mocha",
      name: "Mocha",
      mode: "dark",
      vars: {
        "base-background": "#2b1f1c",
        "raised-background": "#372a26",
        "menu-background": "#453530",
        "general-background-a": "#2b1f1c",
        "general-background-b": "#2b1f1c",
        "general-background-c": "#372a26",
        "text-primary": "#e8d4c4",
        "text-secondary": "#b89888",
        "text-disabled": "#7a5e50",
        "badge-chip-background": "#553f36",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#a0522d",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#e8d4c4",
        "icon-inactive": "#b89888",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-blackcurrant",
      name: "Blackcurrant",
      mode: "dark",
      vars: {
        "base-background": "#1a0a1f",
        "raised-background": "#23102a",
        "menu-background": "#2d1638",
        "general-background-a": "#1a0a1f",
        "general-background-b": "#1a0a1f",
        "general-background-c": "#23102a",
        "text-primary": "#e8c8f0",
        "text-secondary": "#a880b8",
        "text-disabled": "#705080",
        "badge-chip-background": "#3a1d48",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#9c27b0",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#e8c8f0",
        "icon-inactive": "#a880b8",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "d-deepforest",
      name: "Deep Forest",
      mode: "dark",
      vars: {
        "base-background": "#0a1410",
        "raised-background": "#101a14",
        "menu-background": "#16241c",
        "general-background-a": "#0a1410",
        "general-background-b": "#0a1410",
        "general-background-c": "#101a14",
        "text-primary": "#c8e0d0",
        "text-secondary": "#80a890",
        "text-disabled": "#506858",
        "badge-chip-background": "#1f342a",
        outline: "rgba(255,255,255,.1)",
        "call-to-action": "#388e3c",
        "call-to-action-inverse": "#fff",
        "icon-active-other": "#c8e0d0",
        "icon-inactive": "#80a890",
        "10-percent-layer": "rgba(255,255,255,.07)",
        shadow: "rgba(0,0,0,.5)",
      },
    },
    {
      id: "l-clean",
      name: "Clean White",
      mode: "light",
      vars: {
        "base-background": "#ffffff",
        "raised-background": "#f8f8f8",
        "menu-background": "#ffffff",
        "general-background-a": "#ffffff",
        "general-background-b": "#ffffff",
        "general-background-c": "#f8f8f8",
        "text-primary": "#111111",
        "text-secondary": "#606060",
        "text-disabled": "#aaaaaa",
        "badge-chip-background": "#eeeeee",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#c00",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#111111",
        "icon-inactive": "#aaaaaa",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-warm",
      name: "Warm Cream",
      mode: "light",
      vars: {
        "base-background": "#fdf6ec",
        "raised-background": "#f8f0e0",
        "menu-background": "#fdf6ec",
        "general-background-a": "#fdf6ec",
        "general-background-b": "#fdf6ec",
        "general-background-c": "#f8f0e0",
        "text-primary": "#2c2416",
        "text-secondary": "#6e5e48",
        "text-disabled": "#b0a088",
        "badge-chip-background": "#ede4d0",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#c06030",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#2c2416",
        "icon-inactive": "#b0a088",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-nord",
      name: "Nord Light",
      mode: "light",
      vars: {
        "base-background": "#eceff4",
        "raised-background": "#e5e9f0",
        "menu-background": "#eceff4",
        "general-background-a": "#eceff4",
        "general-background-b": "#eceff4",
        "general-background-c": "#e5e9f0",
        "text-primary": "#2e3440",
        "text-secondary": "#4c566a",
        "text-disabled": "#9aa0ac",
        "badge-chip-background": "#d8dee9",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#5e81ac",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#2e3440",
        "icon-inactive": "#9aa0ac",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-solarized",
      name: "Solarized Light",
      mode: "light",
      vars: {
        "base-background": "#fdf6e3",
        "raised-background": "#eee8d5",
        "menu-background": "#fdf6e3",
        "general-background-a": "#fdf6e3",
        "general-background-b": "#fdf6e3",
        "general-background-c": "#eee8d5",
        "text-primary": "#073642",
        "text-secondary": "#586e75",
        "text-disabled": "#93a1a1",
        "badge-chip-background": "#e6dfcc",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#268bd2",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#073642",
        "icon-inactive": "#93a1a1",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-catppuccin",
      name: "Catppuccin Latte",
      mode: "light",
      vars: {
        "base-background": "#eff1f5",
        "raised-background": "#e6e9ef",
        "menu-background": "#eff1f5",
        "general-background-a": "#eff1f5",
        "general-background-b": "#eff1f5",
        "general-background-c": "#e6e9ef",
        "text-primary": "#4c4f69",
        "text-secondary": "#6c6f85",
        "text-disabled": "#9ca0b0",
        "badge-chip-background": "#dce0e8",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#8839ef",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#4c4f69",
        "icon-inactive": "#9ca0b0",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-sky",
      name: "Sky Blue",
      mode: "light",
      vars: {
        "base-background": "#f0f6ff",
        "raised-background": "#e6eef8",
        "menu-background": "#f0f6ff",
        "general-background-a": "#f0f6ff",
        "general-background-b": "#f0f6ff",
        "general-background-c": "#e6eef8",
        "text-primary": "#1a2a40",
        "text-secondary": "#4a6080",
        "text-disabled": "#90a0b8",
        "badge-chip-background": "#d4e2f4",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#1976d2",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#1a2a40",
        "icon-inactive": "#90a0b8",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-mint",
      name: "Mint Green",
      mode: "light",
      vars: {
        "base-background": "#f0faf4",
        "raised-background": "#e4f4ea",
        "menu-background": "#f0faf4",
        "general-background-a": "#f0faf4",
        "general-background-b": "#f0faf4",
        "general-background-c": "#e4f4ea",
        "text-primary": "#1a3024",
        "text-secondary": "#3a6848",
        "text-disabled": "#88b098",
        "badge-chip-background": "#d0ead8",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#2e7d32",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#1a3024",
        "icon-inactive": "#88b098",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-lavender",
      name: "Lavender",
      mode: "light",
      vars: {
        "base-background": "#f5f0fa",
        "raised-background": "#ece4f4",
        "menu-background": "#f5f0fa",
        "general-background-a": "#f5f0fa",
        "general-background-b": "#f5f0fa",
        "general-background-c": "#ece4f4",
        "text-primary": "#261a3a",
        "text-secondary": "#5a4070",
        "text-disabled": "#a090b8",
        "badge-chip-background": "#ddd0ee",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#7b1fa2",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#261a3a",
        "icon-inactive": "#a090b8",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-peach",
      name: "Peach",
      mode: "light",
      vars: {
        "base-background": "#fff5f0",
        "raised-background": "#fceee6",
        "menu-background": "#fff5f0",
        "general-background-a": "#fff5f0",
        "general-background-b": "#fff5f0",
        "general-background-c": "#fceee6",
        "text-primary": "#3a2018",
        "text-secondary": "#7a5040",
        "text-disabled": "#c0a090",
        "badge-chip-background": "#f0dcd0",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#e64a19",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a2018",
        "icon-inactive": "#c0a090",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-rose",
      name: "Rose",
      mode: "light",
      vars: {
        "base-background": "#fdf0f4",
        "raised-background": "#f8e4ec",
        "menu-background": "#fdf0f4",
        "general-background-a": "#fdf0f4",
        "general-background-b": "#fdf0f4",
        "general-background-c": "#f8e4ec",
        "text-primary": "#3a1828",
        "text-secondary": "#804060",
        "text-disabled": "#c890a8",
        "badge-chip-background": "#eed0dc",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#c2185b",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a1828",
        "icon-inactive": "#c890a8",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-paper",
      name: "Paper",
      mode: "light",
      vars: {
        "base-background": "#f5f5f0",
        "raised-background": "#eeeee8",
        "menu-background": "#f5f5f0",
        "general-background-a": "#f5f5f0",
        "general-background-b": "#f5f5f0",
        "general-background-c": "#eeeee8",
        "text-primary": "#222222",
        "text-secondary": "#555555",
        "text-disabled": "#aaaaaa",
        "badge-chip-background": "#e0e0d8",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#555555",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#222222",
        "icon-inactive": "#aaaaaa",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-sand",
      name: "Sand",
      mode: "light",
      vars: {
        "base-background": "#f8f4ee",
        "raised-background": "#f0ebe2",
        "menu-background": "#f8f4ee",
        "general-background-a": "#f8f4ee",
        "general-background-b": "#f8f4ee",
        "general-background-c": "#f0ebe2",
        "text-primary": "#2e2a22",
        "text-secondary": "#6e6455",
        "text-disabled": "#b0a898",
        "badge-chip-background": "#e4ddd0",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#8d6e00",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#2e2a22",
        "icon-inactive": "#b0a898",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-graphite",
      name: "Graphite",
      mode: "light",
      vars: {
        "base-background": "#eef0f2",
        "raised-background": "#e2e6ea",
        "menu-background": "#eef0f2",
        "general-background-a": "#eef0f2",
        "general-background-b": "#eef0f2",
        "general-background-c": "#e2e6ea",
        "text-primary": "#1a1e24",
        "text-secondary": "#4a5060",
        "text-disabled": "#8a90a0",
        "badge-chip-background": "#d4d8de",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#455a64",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#1a1e24",
        "icon-inactive": "#8a90a0",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-ocean",
      name: "Ocean Foam",
      mode: "light",
      vars: {
        "base-background": "#eef6f6",
        "raised-background": "#e2f0f0",
        "menu-background": "#eef6f6",
        "general-background-a": "#eef6f6",
        "general-background-b": "#eef6f6",
        "general-background-c": "#e2f0f0",
        "text-primary": "#1a3030",
        "text-secondary": "#406060",
        "text-disabled": "#88b0b0",
        "badge-chip-background": "#d0e6e6",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#00897b",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#1a3030",
        "icon-inactive": "#88b0b0",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-sunset",
      name: "Sunset Glow",
      mode: "light",
      vars: {
        "base-background": "#fff8f0",
        "raised-background": "#fdf0e4",
        "menu-background": "#fff8f0",
        "general-background-a": "#fff8f0",
        "general-background-b": "#fff8f0",
        "general-background-c": "#fdf0e4",
        "text-primary": "#3a2810",
        "text-secondary": "#7a5830",
        "text-disabled": "#c0a078",
        "badge-chip-background": "#f0dcc4",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#e65100",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a2810",
        "icon-inactive": "#c0a078",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-github",
      name: "GitHub Light",
      mode: "light",
      vars: {
        "base-background": "#ffffff",
        "raised-background": "#f6f8fa",
        "menu-background": "#ffffff",
        "general-background-a": "#ffffff",
        "general-background-b": "#ffffff",
        "general-background-c": "#f6f8fa",
        "text-primary": "#24292e",
        "text-secondary": "#586069",
        "text-disabled": "#959da5",
        "badge-chip-background": "#eaecef",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#0366d6",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#24292e",
        "icon-inactive": "#959da5",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-vscode",
      name: "VS Code Light",
      mode: "light",
      vars: {
        "base-background": "#ffffff",
        "raised-background": "#f3f3f3",
        "menu-background": "#ffffff",
        "general-background-a": "#ffffff",
        "general-background-b": "#ffffff",
        "general-background-c": "#f3f3f3",
        "text-primary": "#1e1e1e",
        "text-secondary": "#383838",
        "text-disabled": "#9d9d9d",
        "badge-chip-background": "#e7e7e7",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#005fb8",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#1e1e1e",
        "icon-inactive": "#9d9d9d",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-atom",
      name: "Atom Light",
      mode: "light",
      vars: {
        "base-background": "#ffffff",
        "raised-background": "#fafafa",
        "menu-background": "#ffffff",
        "general-background-a": "#ffffff",
        "general-background-b": "#ffffff",
        "general-background-c": "#fafafa",
        "text-primary": "#383a42",
        "text-secondary": "#a0a1a7",
        "text-disabled": "#a0a1a7",
        "badge-chip-background": "#e5e5e6",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#4078f2",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#383a42",
        "icon-inactive": "#a0a1a7",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-one-light",
      name: "One Light",
      mode: "light",
      vars: {
        "base-background": "#fafafa",
        "raised-background": "#f0f0f0",
        "menu-background": "#fafafa",
        "general-background-a": "#fafafa",
        "general-background-b": "#fafafa",
        "general-background-c": "#f0f0f0",
        "text-primary": "#383a42",
        "text-secondary": "#a0a1a7",
        "text-disabled": "#a0a1a7",
        "badge-chip-background": "#e5e5e6",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#4078f2",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#383a42",
        "icon-inactive": "#a0a1a7",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-tomorrow",
      name: "Tomorrow",
      mode: "light",
      vars: {
        "base-background": "#ffffff",
        "raised-background": "#efefef",
        "menu-background": "#ffffff",
        "general-background-a": "#ffffff",
        "general-background-b": "#ffffff",
        "general-background-c": "#efefef",
        "text-primary": "#4d4d4c",
        "text-secondary": "#8e908c",
        "text-disabled": "#8e908c",
        "badge-chip-background": "#d6d6d6",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#4271ae",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#4d4d4c",
        "icon-inactive": "#8e908c",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-pencil",
      name: "Base16 Pencil",
      mode: "light",
      vars: {
        "base-background": "#f1f1f1",
        "raised-background": "#e0e0e0",
        "menu-background": "#f1f1f1",
        "general-background-a": "#f1f1f1",
        "general-background-b": "#f1f1f1",
        "general-background-c": "#e0e0e0",
        "text-primary": "#202020",
        "text-secondary": "#505050",
        "text-disabled": "#808080",
        "badge-chip-background": "#b0b0b0",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#5fb3b3",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#202020",
        "icon-inactive": "#808080",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-ayu-light",
      name: "Ayu Light",
      mode: "light",
      vars: {
        "base-background": "#fafafa",
        "raised-background": "#f3f4f5",
        "menu-background": "#fafafa",
        "general-background-a": "#fafafa",
        "general-background-b": "#fafafa",
        "general-background-c": "#f3f4f5",
        "text-primary": "#5c6773",
        "text-secondary": "#8a9199",
        "text-disabled": "#abb0b6",
        "badge-chip-background": "#e7eaed",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#ff6a00",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#5c6773",
        "icon-inactive": "#abb0b6",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-iceberg",
      name: "Iceberg Light",
      mode: "light",
      vars: {
        "base-background": "#e8e9ec",
        "raised-background": "#dcdfe4",
        "menu-background": "#e8e9ec",
        "general-background-a": "#e8e9ec",
        "general-background-b": "#e8e9ec",
        "general-background-c": "#dcdfe4",
        "text-primary": "#33374c",
        "text-secondary": "#6b7089",
        "text-disabled": "#9fa6b8",
        "badge-chip-background": "#cad0de",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#2d539e",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#33374c",
        "icon-inactive": "#9fa6b8",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-papercolor",
      name: "PaperColor Light",
      mode: "light",
      vars: {
        "base-background": "#eeeeee",
        "raised-background": "#e4e4e4",
        "menu-background": "#eeeeee",
        "general-background-a": "#eeeeee",
        "general-background-b": "#eeeeee",
        "general-background-c": "#e4e4e4",
        "text-primary": "#444444",
        "text-secondary": "#5f8787",
        "text-disabled": "#878787",
        "badge-chip-background": "#dadada",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#005f87",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#444444",
        "icon-inactive": "#878787",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-vanilla",
      name: "Vanilla",
      mode: "light",
      vars: {
        "base-background": "#fefee9",
        "raised-background": "#f8f8e0",
        "menu-background": "#fefee9",
        "general-background-a": "#fefee9",
        "general-background-b": "#fefee9",
        "general-background-c": "#f8f8e0",
        "text-primary": "#3a3320",
        "text-secondary": "#6c6648",
        "text-disabled": "#a09880",
        "badge-chip-background": "#ebe4cc",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#ff8c00",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a3320",
        "icon-inactive": "#a09880",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-honey",
      name: "Honey",
      mode: "light",
      vars: {
        "base-background": "#fff8e1",
        "raised-background": "#fff3c4",
        "menu-background": "#fff8e1",
        "general-background-a": "#fff8e1",
        "general-background-b": "#fff8e1",
        "general-background-c": "#fff3c4",
        "text-primary": "#3a2c08",
        "text-secondary": "#7a5e1c",
        "text-disabled": "#bda564",
        "badge-chip-background": "#f5e8a8",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#ffa000",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a2c08",
        "icon-inactive": "#bda564",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-mint-fresh",
      name: "Mint Fresh",
      mode: "light",
      vars: {
        "base-background": "#e8f5e9",
        "raised-background": "#dcefdc",
        "menu-background": "#e8f5e9",
        "general-background-a": "#e8f5e9",
        "general-background-b": "#e8f5e9",
        "general-background-c": "#dcefdc",
        "text-primary": "#1b3320",
        "text-secondary": "#3e7048",
        "text-disabled": "#82af88",
        "badge-chip-background": "#c8e6c9",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#43a047",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#1b3320",
        "icon-inactive": "#82af88",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-pink-petal",
      name: "Pink Petal",
      mode: "light",
      vars: {
        "base-background": "#fce4ec",
        "raised-background": "#f8d7e2",
        "menu-background": "#fce4ec",
        "general-background-a": "#fce4ec",
        "general-background-b": "#fce4ec",
        "general-background-c": "#f8d7e2",
        "text-primary": "#3a1a28",
        "text-secondary": "#74304a",
        "text-disabled": "#c08aa0",
        "badge-chip-background": "#f1c5d4",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#d81b60",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a1a28",
        "icon-inactive": "#c08aa0",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-blueprint",
      name: "Blueprint",
      mode: "light",
      vars: {
        "base-background": "#e3f2fd",
        "raised-background": "#cce7fb",
        "menu-background": "#e3f2fd",
        "general-background-a": "#e3f2fd",
        "general-background-b": "#e3f2fd",
        "general-background-c": "#cce7fb",
        "text-primary": "#0d2940",
        "text-secondary": "#1e5485",
        "text-disabled": "#76a9d8",
        "badge-chip-background": "#a0d0f5",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#1565c0",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#0d2940",
        "icon-inactive": "#76a9d8",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-grape",
      name: "Grape",
      mode: "light",
      vars: {
        "base-background": "#f3e5f5",
        "raised-background": "#ead0ee",
        "menu-background": "#f3e5f5",
        "general-background-a": "#f3e5f5",
        "general-background-b": "#f3e5f5",
        "general-background-c": "#ead0ee",
        "text-primary": "#291a3a",
        "text-secondary": "#5d3c75",
        "text-disabled": "#9f80b4",
        "badge-chip-background": "#dec0e3",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#6a1b9a",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#291a3a",
        "icon-inactive": "#9f80b4",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-marigold",
      name: "Marigold",
      mode: "light",
      vars: {
        "base-background": "#fff3c4",
        "raised-background": "#ffeb9c",
        "menu-background": "#fff3c4",
        "general-background-a": "#fff3c4",
        "general-background-b": "#fff3c4",
        "general-background-c": "#ffeb9c",
        "text-primary": "#3d2c00",
        "text-secondary": "#7c5e16",
        "text-disabled": "#bda06d",
        "badge-chip-background": "#ffe082",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#f57f17",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3d2c00",
        "icon-inactive": "#bda06d",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-spearmint",
      name: "Spearmint",
      mode: "light",
      vars: {
        "base-background": "#e0f7fa",
        "raised-background": "#c7eef2",
        "menu-background": "#e0f7fa",
        "general-background-a": "#e0f7fa",
        "general-background-b": "#e0f7fa",
        "general-background-c": "#c7eef2",
        "text-primary": "#0e2e34",
        "text-secondary": "#206d75",
        "text-disabled": "#73b1b8",
        "badge-chip-background": "#a4dfe5",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#00838f",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#0e2e34",
        "icon-inactive": "#73b1b8",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-silver",
      name: "Silver",
      mode: "light",
      vars: {
        "base-background": "#f5f5f5",
        "raised-background": "#ededed",
        "menu-background": "#f5f5f5",
        "general-background-a": "#f5f5f5",
        "general-background-b": "#f5f5f5",
        "general-background-c": "#ededed",
        "text-primary": "#2c2c2c",
        "text-secondary": "#5e5e5e",
        "text-disabled": "#9b9b9b",
        "badge-chip-background": "#d6d6d6",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#616161",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#2c2c2c",
        "icon-inactive": "#9b9b9b",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-pearl",
      name: "Pearl",
      mode: "light",
      vars: {
        "base-background": "#fafafa",
        "raised-background": "#f0f0f0",
        "menu-background": "#fafafa",
        "general-background-a": "#fafafa",
        "general-background-b": "#fafafa",
        "general-background-c": "#f0f0f0",
        "text-primary": "#212121",
        "text-secondary": "#616161",
        "text-disabled": "#9e9e9e",
        "badge-chip-background": "#e0e0e0",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#37474f",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#212121",
        "icon-inactive": "#9e9e9e",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-pastel",
      name: "Pastel",
      mode: "light",
      vars: {
        "base-background": "#fff5f7",
        "raised-background": "#fde8ed",
        "menu-background": "#fff5f7",
        "general-background-a": "#fff5f7",
        "general-background-b": "#fff5f7",
        "general-background-c": "#fde8ed",
        "text-primary": "#3a2030",
        "text-secondary": "#704258",
        "text-disabled": "#b48aa3",
        "badge-chip-background": "#f5d0db",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#e91e63",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a2030",
        "icon-inactive": "#b48aa3",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-lemon",
      name: "Lemon",
      mode: "light",
      vars: {
        "base-background": "#fffde7",
        "raised-background": "#fff9c4",
        "menu-background": "#fffde7",
        "general-background-a": "#fffde7",
        "general-background-b": "#fffde7",
        "general-background-c": "#fff9c4",
        "text-primary": "#3a3000",
        "text-secondary": "#705e00",
        "text-disabled": "#aa8f00",
        "badge-chip-background": "#f0e68c",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#f9a825",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a3000",
        "icon-inactive": "#aa8f00",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-coral",
      name: "Coral",
      mode: "light",
      vars: {
        "base-background": "#ffeae0",
        "raised-background": "#ffd9c5",
        "menu-background": "#ffeae0",
        "general-background-a": "#ffeae0",
        "general-background-b": "#ffeae0",
        "general-background-c": "#ffd9c5",
        "text-primary": "#3a1a08",
        "text-secondary": "#7a3a16",
        "text-disabled": "#c0805a",
        "badge-chip-background": "#ffba9a",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#f06292",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a1a08",
        "icon-inactive": "#c0805a",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-ice",
      name: "Arctic Ice",
      mode: "light",
      vars: {
        "base-background": "#f0f8ff",
        "raised-background": "#e0f0ff",
        "menu-background": "#f0f8ff",
        "general-background-a": "#f0f8ff",
        "general-background-b": "#f0f8ff",
        "general-background-c": "#e0f0ff",
        "text-primary": "#0a2a4a",
        "text-secondary": "#2860a0",
        "text-disabled": "#80a8d0",
        "badge-chip-background": "#c0d8f0",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#039be5",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#0a2a4a",
        "icon-inactive": "#80a8d0",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-cherry",
      name: "Cherry Blossom",
      mode: "light",
      vars: {
        "base-background": "#fff0f5",
        "raised-background": "#ffe0eb",
        "menu-background": "#fff0f5",
        "general-background-a": "#fff0f5",
        "general-background-b": "#fff0f5",
        "general-background-c": "#ffe0eb",
        "text-primary": "#3a1828",
        "text-secondary": "#80405e",
        "text-disabled": "#cc8aa8",
        "badge-chip-background": "#ffc8de",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#ec407a",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a1828",
        "icon-inactive": "#cc8aa8",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-newspaper",
      name: "Newspaper",
      mode: "light",
      vars: {
        "base-background": "#f8f5f0",
        "raised-background": "#efece6",
        "menu-background": "#f8f5f0",
        "general-background-a": "#f8f5f0",
        "general-background-b": "#f8f5f0",
        "general-background-c": "#efece6",
        "text-primary": "#1a1a1a",
        "text-secondary": "#4a4a4a",
        "text-disabled": "#888888",
        "badge-chip-background": "#e0ddd6",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#2a2a2a",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#1a1a1a",
        "icon-inactive": "#888888",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-cotton",
      name: "Cotton Candy",
      mode: "light",
      vars: {
        "base-background": "#fef0fc",
        "raised-background": "#fde0fa",
        "menu-background": "#fef0fc",
        "general-background-a": "#fef0fc",
        "general-background-b": "#fef0fc",
        "general-background-c": "#fde0fa",
        "text-primary": "#3a1638",
        "text-secondary": "#7a3878",
        "text-disabled": "#b888b6",
        "badge-chip-background": "#f4c4f0",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#d500f9",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a1638",
        "icon-inactive": "#b888b6",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-aqua-light",
      name: "Aqua Light",
      mode: "light",
      vars: {
        "base-background": "#e0f7f7",
        "raised-background": "#ccefef",
        "menu-background": "#e0f7f7",
        "general-background-a": "#e0f7f7",
        "general-background-b": "#e0f7f7",
        "general-background-c": "#ccefef",
        "text-primary": "#0a3030",
        "text-secondary": "#206868",
        "text-disabled": "#70b0b0",
        "badge-chip-background": "#a0dede",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#00acc1",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#0a3030",
        "icon-inactive": "#70b0b0",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-melon",
      name: "Melon",
      mode: "light",
      vars: {
        "base-background": "#fff5e1",
        "raised-background": "#ffe9c4",
        "menu-background": "#fff5e1",
        "general-background-a": "#fff5e1",
        "general-background-b": "#fff5e1",
        "general-background-c": "#ffe9c4",
        "text-primary": "#3a2814",
        "text-secondary": "#7a522a",
        "text-disabled": "#b58a55",
        "badge-chip-background": "#fce0a8",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#fb8c00",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a2814",
        "icon-inactive": "#b58a55",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-eggshell",
      name: "Eggshell",
      mode: "light",
      vars: {
        "base-background": "#fcfcf0",
        "raised-background": "#f5f5e0",
        "menu-background": "#fcfcf0",
        "general-background-a": "#fcfcf0",
        "general-background-b": "#fcfcf0",
        "general-background-c": "#f5f5e0",
        "text-primary": "#262616",
        "text-secondary": "#56564a",
        "text-disabled": "#9c9c8a",
        "badge-chip-background": "#e6e6cc",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#827717",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#262616",
        "icon-inactive": "#9c9c8a",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-mist",
      name: "Morning Mist",
      mode: "light",
      vars: {
        "base-background": "#f5f7f9",
        "raised-background": "#e9ecef",
        "menu-background": "#f5f7f9",
        "general-background-a": "#f5f7f9",
        "general-background-b": "#f5f7f9",
        "general-background-c": "#e9ecef",
        "text-primary": "#1a2330",
        "text-secondary": "#4a5666",
        "text-disabled": "#8896a8",
        "badge-chip-background": "#d1d8e0",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#5c7080",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#1a2330",
        "icon-inactive": "#8896a8",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-violet-light",
      name: "Soft Violet",
      mode: "light",
      vars: {
        "base-background": "#f3e8ff",
        "raised-background": "#e6d6ff",
        "menu-background": "#f3e8ff",
        "general-background-a": "#f3e8ff",
        "general-background-b": "#f3e8ff",
        "general-background-c": "#e6d6ff",
        "text-primary": "#28133a",
        "text-secondary": "#5a3072",
        "text-disabled": "#a080c4",
        "badge-chip-background": "#dac0f0",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#7c4dff",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#28133a",
        "icon-inactive": "#a080c4",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-blush",
      name: "Blush",
      mode: "light",
      vars: {
        "base-background": "#fde7e9",
        "raised-background": "#fcd0d4",
        "menu-background": "#fde7e9",
        "general-background-a": "#fde7e9",
        "general-background-b": "#fde7e9",
        "general-background-c": "#fcd0d4",
        "text-primary": "#3a1620",
        "text-secondary": "#7a3848",
        "text-disabled": "#bb858f",
        "badge-chip-background": "#f5b5be",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#e91e63",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a1620",
        "icon-inactive": "#bb858f",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-celeste",
      name: "Celeste",
      mode: "light",
      vars: {
        "base-background": "#e8f4f8",
        "raised-background": "#d4eaf0",
        "menu-background": "#e8f4f8",
        "general-background-a": "#e8f4f8",
        "general-background-b": "#e8f4f8",
        "general-background-c": "#d4eaf0",
        "text-primary": "#1a2e3a",
        "text-secondary": "#3a607a",
        "text-disabled": "#80a0b0",
        "badge-chip-background": "#b8d6e0",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#0288d1",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#1a2e3a",
        "icon-inactive": "#80a0b0",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-cream",
      name: "Vanilla Cream",
      mode: "light",
      vars: {
        "base-background": "#fdf9f0",
        "raised-background": "#f8f2e2",
        "menu-background": "#fdf9f0",
        "general-background-a": "#fdf9f0",
        "general-background-b": "#fdf9f0",
        "general-background-c": "#f8f2e2",
        "text-primary": "#3a3014",
        "text-secondary": "#75612b",
        "text-disabled": "#b3a06b",
        "badge-chip-background": "#e8ddc1",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#bf8d30",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a3014",
        "icon-inactive": "#b3a06b",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-fawn",
      name: "Fawn",
      mode: "light",
      vars: {
        "base-background": "#f4ebde",
        "raised-background": "#ebdfca",
        "menu-background": "#f4ebde",
        "general-background-a": "#f4ebde",
        "general-background-b": "#f4ebde",
        "general-background-c": "#ebdfca",
        "text-primary": "#3a2814",
        "text-secondary": "#75522a",
        "text-disabled": "#b08a58",
        "badge-chip-background": "#dec5a3",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#8d6e63",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a2814",
        "icon-inactive": "#b08a58",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-quartz",
      name: "Quartz",
      mode: "light",
      vars: {
        "base-background": "#f7f4f8",
        "raised-background": "#eee8f0",
        "menu-background": "#f7f4f8",
        "general-background-a": "#f7f4f8",
        "general-background-b": "#f7f4f8",
        "general-background-c": "#eee8f0",
        "text-primary": "#2a1f30",
        "text-secondary": "#5a4068",
        "text-disabled": "#9a80a8",
        "badge-chip-background": "#d8c8e0",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#9c27b0",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#2a1f30",
        "icon-inactive": "#9a80a8",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-frost",
      name: "Frost",
      mode: "light",
      vars: {
        "base-background": "#f5f9fc",
        "raised-background": "#e8f0f7",
        "menu-background": "#f5f9fc",
        "general-background-a": "#f5f9fc",
        "general-background-b": "#f5f9fc",
        "general-background-c": "#e8f0f7",
        "text-primary": "#1c2530",
        "text-secondary": "#445566",
        "text-disabled": "#88a0b0",
        "badge-chip-background": "#c8d8e8",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#1976d2",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#1c2530",
        "icon-inactive": "#88a0b0",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-rose-gold",
      name: "Rose Gold",
      mode: "light",
      vars: {
        "base-background": "#fce8e0",
        "raised-background": "#fad4c8",
        "menu-background": "#fce8e0",
        "general-background-a": "#fce8e0",
        "general-background-b": "#fce8e0",
        "general-background-c": "#fad4c8",
        "text-primary": "#3a1c14",
        "text-secondary": "#7a4032",
        "text-disabled": "#c08070",
        "badge-chip-background": "#f5b8a4",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#b76e79",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a1c14",
        "icon-inactive": "#c08070",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-champagne",
      name: "Champagne",
      mode: "light",
      vars: {
        "base-background": "#fdf5e6",
        "raised-background": "#fae9c8",
        "menu-background": "#fdf5e6",
        "general-background-a": "#fdf5e6",
        "general-background-b": "#fdf5e6",
        "general-background-c": "#fae9c8",
        "text-primary": "#3a2c14",
        "text-secondary": "#75582d",
        "text-disabled": "#b39568",
        "badge-chip-background": "#e8d3a0",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#bf9b30",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a2c14",
        "icon-inactive": "#b39568",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-jade",
      name: "Jade",
      mode: "light",
      vars: {
        "base-background": "#e0f2e9",
        "raised-background": "#cce8d8",
        "menu-background": "#e0f2e9",
        "general-background-a": "#e0f2e9",
        "general-background-b": "#e0f2e9",
        "general-background-c": "#cce8d8",
        "text-primary": "#0a2818",
        "text-secondary": "#1c5436",
        "text-disabled": "#5e9078",
        "badge-chip-background": "#a0d0b8",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#00897b",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#0a2818",
        "icon-inactive": "#5e9078",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-cornsilk",
      name: "Cornsilk",
      mode: "light",
      vars: {
        "base-background": "#fff8dc",
        "raised-background": "#fdedb8",
        "menu-background": "#fff8dc",
        "general-background-a": "#fff8dc",
        "general-background-b": "#fff8dc",
        "general-background-c": "#fdedb8",
        "text-primary": "#3a3414",
        "text-secondary": "#75692b",
        "text-disabled": "#b09e6c",
        "badge-chip-background": "#e8d894",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#cba135",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#3a3414",
        "icon-inactive": "#b09e6c",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-blueberry-light",
      name: "Blueberry Light",
      mode: "light",
      vars: {
        "base-background": "#e8eaf6",
        "raised-background": "#d4d7ed",
        "menu-background": "#e8eaf6",
        "general-background-a": "#e8eaf6",
        "general-background-b": "#e8eaf6",
        "general-background-c": "#d4d7ed",
        "text-primary": "#0d1545",
        "text-secondary": "#1f3080",
        "text-disabled": "#7080c0",
        "badge-chip-background": "#b8c0e0",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#3949ab",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#0d1545",
        "icon-inactive": "#7080c0",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-mauve",
      name: "Mauve",
      mode: "light",
      vars: {
        "base-background": "#ede6ec",
        "raised-background": "#e0d4de",
        "menu-background": "#ede6ec",
        "general-background-a": "#ede6ec",
        "general-background-b": "#ede6ec",
        "general-background-c": "#e0d4de",
        "text-primary": "#2a1828",
        "text-secondary": "#583a55",
        "text-disabled": "#a080a0",
        "badge-chip-background": "#d4bcd0",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#8e24aa",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#2a1828",
        "icon-inactive": "#a080a0",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-sage",
      name: "Sage",
      mode: "light",
      vars: {
        "base-background": "#eef4e8",
        "raised-background": "#dfe8d3",
        "menu-background": "#eef4e8",
        "general-background-a": "#eef4e8",
        "general-background-b": "#eef4e8",
        "general-background-c": "#dfe8d3",
        "text-primary": "#1c3014",
        "text-secondary": "#46662a",
        "text-disabled": "#88a880",
        "badge-chip-background": "#c4d8b4",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#558b2f",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#1c3014",
        "icon-inactive": "#88a880",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-zen",
      name: "Zen",
      mode: "light",
      vars: {
        "base-background": "#f7f4ec",
        "raised-background": "#ebe5d4",
        "menu-background": "#f7f4ec",
        "general-background-a": "#f7f4ec",
        "general-background-b": "#f7f4ec",
        "general-background-c": "#ebe5d4",
        "text-primary": "#2c2820",
        "text-secondary": "#5c5040",
        "text-disabled": "#a09480",
        "badge-chip-background": "#d8d0bc",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#6d4c41",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#2c2820",
        "icon-inactive": "#a09480",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-arctic-snow",
      name: "Arctic Snow",
      mode: "light",
      vars: {
        "base-background": "#ffffff",
        "raised-background": "#f0f4f8",
        "menu-background": "#ffffff",
        "general-background-a": "#ffffff",
        "general-background-b": "#ffffff",
        "general-background-c": "#f0f4f8",
        "text-primary": "#0d1a30",
        "text-secondary": "#3a5670",
        "text-disabled": "#7090b0",
        "badge-chip-background": "#dde6ee",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#1565c0",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#0d1a30",
        "icon-inactive": "#7090b0",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
    {
      id: "l-meadow",
      name: "Meadow",
      mode: "light",
      vars: {
        "base-background": "#f0f5e8",
        "raised-background": "#e0ecd4",
        "menu-background": "#f0f5e8",
        "general-background-a": "#f0f5e8",
        "general-background-b": "#f0f5e8",
        "general-background-c": "#e0ecd4",
        "text-primary": "#1f2c14",
        "text-secondary": "#506830",
        "text-disabled": "#90a878",
        "badge-chip-background": "#c8d8b4",
        outline: "rgba(0,0,0,.1)",
        "call-to-action": "#689f38",
        "call-to-action-inverse": "#ffffff",
        "icon-active-other": "#1f2c14",
        "icon-inactive": "#90a878",
        "10-percent-layer": "rgba(0,0,0,.05)",
        shadow: "rgba(0,0,0,.1)",
      },
    },
  ];
  function _r(e) {
    const t = [];
    for (let a = 0; a < e.length; a++) {
      const n = e[a];
      if (!n) continue;
      const r = n.indexOf(":");
      if (r < 0) continue;
      const o = n.slice(0, r).trim(),
        i = n.slice(r + 1).trim();
      if (!o || !i) continue;
      const d = /!important/i.test(i) ? i : i + " !important";
      t.push(o + ":" + d);
    }
    return t.join(";");
  }
  Object.freeze(Nr);
  let Hr = null,
    Dr = null;
  const qr = "ytp-theme-engine-style";
  function Vr(e) {
    try {
      const t = document.head || document.documentElement;
      if (!t) return;
      const a = document.getElementById(qr);
      if (a)
        try {
          a.remove();
        } catch (e) {}
      const n = document.createElement("style");
      ((n.id = qr),
        n.setAttribute("data-ytp-theme", "1"),
        (n.textContent = e),
        t.appendChild(n),
        (Hr = n));
    } catch (e) {
      try {
        h("theme mount", e && e.message);
      } catch (e) {}
    }
  }
  function Fr() {
    try {
      const e = document.head;
      if (!e || !Hr) return;
      e.lastElementChild !== Hr && e.appendChild(Hr);
    } catch (e) {}
  }
  function jr() {
    try {
      Dr && Dr.disconnect();
    } catch (e) {}
    Dr = null;
  }
  function zr() {
    jr();
    try {
      const e = document.getElementById(qr);
      e && e.remove();
    } catch (e) {}
    Hr = null;
  }
  const Wr = "ytp-theme-overhaul-style";
  let Ur = null,
    Kr = [],
    Yr = !1;
    function _overhaulBuildCSS() {
    if (!S.themeGlassOverhaulOn) return "";
    const _ease = S.themeFxReducedMotion ? "none" : "all .18s ease-out";
    return [

      "ytd-masthead{background:rgba(18,20,26,.55)!important;border-bottom:1px solid rgba(255,255,255,.08)!important;backdrop-filter:blur(24px) saturate(170%);-webkit-backdrop-filter:blur(24px) saturate(170%);box-shadow:0 4px 18px rgba(0,0,0,.4)}",
      "ytd-mini-guide-renderer{background:rgba(18,20,26,.55)!important;border-right:1px solid rgba(255,255,255,.08)!important;backdrop-filter:blur(24px) saturate(170%);-webkit-backdrop-filter:blur(24px) saturate(170%)}",
      "#guide-content{background:rgba(18,20,26,.55)!important;backdrop-filter:blur(24px) saturate(170%);-webkit-backdrop-filter:blur(24px) saturate(170%)}",
      "#app-drawer{background:rgba(18,20,26,.7)!important;backdrop-filter:blur(24px) saturate(170%);-webkit-backdrop-filter:blur(24px) saturate(170%)}",

      "#progress{background:rgba(255,61,127,.85)!important;height:3px!important}",

      "#search-input.ytd-searchbox-spt input{background:rgba(255,255,255,.06)!important;border:1px solid rgba(255,255,255,.1)!important;border-radius:8px!important}",

      "tp-yt-iron-dropdown, ytd-popup-container, paper-menu-button, ytd-multi-page-menu-renderer, ytd-menu-popup-renderer, ytd-simple-menu-header-renderer{background:rgba(20,22,28,.92)!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:12px!important;backdrop-filter:blur(20px) saturate(170%);-webkit-backdrop-filter:blur(20px) saturate(170%);box-shadow:0 24px 60px rgba(0,0,0,.6),0 6px 18px rgba(0,0,0,.4);overflow:hidden}",

      "ytd-notification-topbar-renderer, .yt-spec-icon-badge{background:rgba(255,61,127,.85)!important;box-shadow:0 0 10px rgba(255,61,127,.4)}",

      "yt-chip-cloud-chip-renderer{background:rgba(20,22,28,.5)!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:99px!important;transition:" + _ease + "}",
      "yt-chip-cloud-chip-renderer:hover{background:rgba(20,22,28,.7)!important;border-color:rgba(255,255,255,.18)!important}",
      "yt-chip-cloud-chip-renderer[selected]{background:linear-gradient(135deg,#ff0033 0%,#ff3d7f 100%)!important;border-color:rgba(255,255,255,.25)!important;color:#fff!important;box-shadow:0 2px 8px rgba(255,61,127,.4)}",

      "ytd-engagement-panel-section-list-renderer{background:rgba(20,22,28,.5)!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:14px!important;backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%)}",

      "ytd-comments-header-renderer{background:transparent!important}",

    ].join("\n");
  }
  function Gr() {
    try {
      const e = document.head || document.documentElement;
      if (!e) return;
      const t = document.getElementById(Wr);
      if (t)
        try {
          t.remove();
        } catch (e) {}
      const a = _overhaulBuildCSS();
      if (!a) return void (Ur = null);
      const n = document.createElement("style");
      ((n.id = Wr),
        n.setAttribute("data-ytp-overhaul", "1"),
        (n.textContent = a),
        e.appendChild(n),
        (Ur = n));
    } catch (e) {
      try {
        h("overhaul mount", e && e.message);
      } catch (e) {}
    }
  }
  function Xr() {
    Yr || ((Yr = !0), Gr());
  }
  function Zr() {
    Yr = !1;
    for (const e of Kr)
      try {
        e();
      } catch (e) {}
    Kr = [];
    try {
      const e = document.getElementById(Wr);
      e && e.remove();
    } catch (e) {}
    Ur = null;
  }
  function Qr(e) {
    const t = To("div", "ytp-theme-card");
    S.themeSelected === e.id && t.classList.add("active");
    const a = To("div", "ytp-theme-swatch"),
      n = (e && e.vars) || null;
    if (n) {
      ((a.style.background = n["base-background"] || ""),
        (a.style.borderColor = n.outline || "transparent"));
      const e = To("div", "ytp-theme-accent");
      ((e.style.background = n["call-to-action"] || ""), a.appendChild(e));
    } else
      ((a.style.background = "linear-gradient(135deg,#0f0f0f 50%,#ffffff 50%)"),
        (a.style.borderColor = "rgba(255,255,255,.15)"));
    return (
      t.appendChild(a),
      t.appendChild(To("div", "ytp-theme-name", e.name)),
      t.addEventListener("click", () =>
        Ta("themeSelected", S.themeSelected === e.id ? "none" : e.id),
      ),
      t
    );
  }
  function Jr() {
    const t = [];
    try {
      const a = e.ytInitialPlayerResponse;
      if (!a) return t;
      const n =
          a.playerOverlays &&
          a.playerOverlays.playerOverlayRenderer &&
          a.playerOverlays.playerOverlayRenderer.decoratedPlayerBarRenderer,
        r = n && n.decoratedPlayerBarRenderer,
        o = r && r.playerBar && r.playerBar.multiMarkersPlayerBarRenderer,
        i = o && o.markersMap;
      if (!i) return t;
      for (const e of i) {
        const a = e.value && e.value.chapters;
        if (a)
          for (const e of a) {
            const a = e.chapterRenderer;
            if (!a) continue;
            const n = (a.timeRangeStartMillis || 0) / 1e3,
              r =
                (a.title &&
                  (a.title.simpleText ||
                    (a.title.runs &&
                      a.title.runs.map((e) => e.text).join("")))) ||
                "";
            t.push({ t: n, title: r });
          }
      }
    } catch (e) {
      h("extract chapters", e);
    }
    return t;
  }
  (xa.register({
    id: "theme-engine",
    name: "Theme Engine",
    summary:
      "Pick from over 120 dark and light themes for YouTube, with optional accent color, focus ring, and active sidebar highlight. Designed to be light on resources.",
    masterKey: "themeEngineOn",
    keys: [
      "themeEngineOn",
      "themeSelected",
      "themeOverhaulOn",
      "themeGlassOverhaulOn",
      "themeFxHoverLift",
      "themeFxRipple",
      "themeFxGlassMasthead",
      "themeFxThemeTransition",
      "themeFxScrollDriven",
      "themeFxScrollbar",
      "themeFxFocusRing",
      "themeFxButtonShine",
      "themeFxSidebarStagger",
      "themeFxCardLoadAnim",
      "themeFxAccentGradient",
      "themeFxReducedMotion",
      "themeAccentHue",
    ],
    apply(t) {
      if ((zr(), Zr(), S.themeGlassOverhaulOn)) {
        (Xr(), Yt["theme-engine"].push(Zr));
      } else {
        Zr();
      }
      if (!S.themeEngineOn || "none" === S.themeSelected)
        return void (
          S.themeEngineOn &&
          S.themeOverhaulOn &&
          (Xr(), Yt["theme-engine"].push(Zr))
        );
      const a = Nr.find((e) => e.id === S.themeSelected);
      if (!a || !a.vars) return;
      const n = () => {
        try {
          !(function (t) {
            if ("dark" !== t && "light" !== t) return;
            let a = !1;
            try {
              a = document.documentElement.hasAttribute("dark");
            } catch (e) {}
            const n = "dark" === t,
              r = a !== n;
            try {
              const e = document.documentElement;
              n ? e.setAttribute("dark", "") : e.removeAttribute("dark");
            } catch (e) {}
            try {
              const e = document.documentElement;
              n
                ? (e.removeAttribute("light"),
                  e.setAttribute(
                    "data-cast-api-enabled",
                    e.getAttribute("data-cast-api-enabled") || "true",
                  ))
                : e.removeAttribute("dark");
            } catch (e) {}
            try {
              document.documentElement.style.colorScheme = n ? "dark" : "light";
            } catch (e) {}
            try {
              e.ytcfg &&
                e.ytcfg.set &&
                e.ytcfg.set(
                  n
                    ? { BACKGROUND_COLOR: "#0f0f0f", THEME: "DARK" }
                    : { BACKGROUND_COLOR: "#ffffff", THEME: "LIGHT" },
                );
            } catch (e) {}
            try {
              const e = document.querySelector('meta[name="theme-color"]');
              e && e.setAttribute("content", n ? "#0f0f0f" : "#ffffff");
            } catch (e) {}
            try {
              if (r) {
                const e = document.cookie.match(/(?:^|;\s*)PREF=([^;]*)/),
                  t = new Date(Date.now() + 3456e7).toUTCString(),
                  a = e ? decodeURIComponent(e[1]) : "",
                  r = {};
                (a &&
                  a.split("&").forEach((e) => {
                    const t = e.indexOf("=");
                    t > 0 && (r[e.substring(0, t)] = e.substring(t + 1));
                  }),
                  (r.f6 = n ? "4400" : "4404"));
                const o = Object.keys(r)
                    .map((e) => e + "=" + r[e])
                    .join("&"),
                  i =
                    "; expires=" +
                    t +
                    "; path=/; domain=.youtube.com; SameSite=Lax";
                if (typeof ti !== 'undefined' && ti.cookieControl && ti.cookieControl.manager) {
                  ti.cookieControl.manager.set("PREF", o, { domain: ".youtube.com", path: "/", sameSite: "Lax", expires: t });
                } else {
                  document.cookie = "PREF=" + o + i;
                }
              }
            } catch (e) {}
            if (r)
              try {
                document.dispatchEvent(
                  new CustomEvent("yt-action", {
                    detail: {
                      actionName: n
                        ? "yt-signal-action-toggle-dark-theme-on"
                        : "yt-signal-action-toggle-dark-theme-off",
                      args: [],
                    },
                  }),
                );
              } catch (e) {}
          })(a.mode);
        } catch (e) {}
      };
      if ("dark" === a.mode || "light" === a.mode) {
        n();
        for (const e of [60, 200, 600, 1500, 3500]) t.addTimeout(n, e);
      }
      let r = "";
      try {
        r = (function (e) {
          if (!e || !e.vars) return "";
          const t = e.vars,
            a = t["base-background"],
            n = t["raised-background"],
            r = t["menu-background"],
            o = t["general-background-a"],
            i = t["general-background-b"],
            d = t["general-background-c"],
            c = t["text-primary"],
            s = t["text-secondary"],
            l = t["text-disabled"],
            p = t["badge-chip-background"],
            u = t.outline,
            h = t["call-to-action"],
            m = t["call-to-action-inverse"],
            y = (t["icon-active-other"], t["icon-inactive"]),
            g = t["10-percent-layer"],
            f = t.shadow,
            b = g,
            v = p,
            k = [],
            x = [
              "html",
              "html[dark]",
              "html:not([dark])",
              "ytd-app",
              "ytd-masthead",
              "tp-yt-app-drawer",
              "ytd-guide-renderer",
              "ytd-mini-guide-renderer",
              "ytd-popup-container",
              "ytd-multi-page-menu-renderer",
              "ytd-browse",
              "ytd-watch-flexy",
              "ytd-two-column-browse-results-renderer",
              "ytd-search",
              "#content.ytd-app",
              "#page-manager.ytd-app",
            ].join(","),
            w = [
              "--yt-spec-base-background:" + a,
              "--yt-spec-raised-background:" + n,
              "--yt-spec-menu-background:" + r,
              "--yt-spec-general-background-a:" + o,
              "--yt-spec-general-background-b:" + i,
              "--yt-spec-general-background-c:" + d,
              "--yt-spec-additive-background:" + n,
              "--yt-spec-brand-background-solid:" + a,
              "--yt-spec-brand-background-primary:" + a,
              "--yt-spec-brand-background-secondary:" + n,
              "--yt-spec-text-primary:" + c,
              "--yt-spec-text-primary-inverse:" + a,
              "--yt-spec-text-secondary:" + s,
              "--yt-spec-text-disabled:" + l,
              "--yt-spec-badge-chip-background:" + p,
              "--yt-spec-outline:" + u,
              "--yt-spec-themed-overlay-background:" + n,
              "--yt-spec-themed-overlay-background-medium:" + r,
              "--yt-spec-call-to-action:" + h,
              "--yt-spec-call-to-action-inverse:" + m,
              "--yt-spec-icon-active-other:" + c,
              "--yt-spec-icon-inactive:" + y,
              "--yt-spec-icon-disabled:" + l,
              "--yt-spec-filled-button-focus-outline:" + h,
              "--yt-spec-10-percent-layer:" + g,
              "--yt-spec-20-percent-layer:" + g,
              "--yt-spec-shadow:" + f,
              "--yt-spec-static-overlay-text-primary:#fff",
              "--yt-spec-static-overlay-text-secondary:rgba(255,255,255,.7)",
              "--yt-spec-suggested-action:" + p,
              "--yt-spec-suggested-action-inverse:" + c,
              "--yt-spec-static-brand-red:#c00",
              "--yt-spec-brand-link-text:" + h,
              "--yt-spec-wordmark-text:" + c,
              "--yt-spec-mono-tonal-hover:" + b,
              "--yt-spec-mono-filled-hover:" + v,
              "--yt-spec-touch-response-inverse:" + c,
              "--yt-spec-touch-response:" + g,
              "--yt-spec-themed-blue:" + h,
              "--yt-main-app-background:" + a,
              "--yt-main-app-background-override:" + a,
              "--yt-lightsource-section1-color:" + a,
              "--yt-lightsource-section2-color:" + n,
              "--yt-lightsource-section3-color:" + d,
              "--yt-lightsource-section4-color:" + n,
              "--yt-lightsource-primary-inverse:" + a,
              "--ytd-searchbox-background:" + n,
              "--ytd-searchbox-legacy-border-color:" + u,
              "--ytd-searchbox-legacy-button-color:" + d,
              "--ytd-searchbox-legacy-button-border-color:" + u,
              "--ytd-searchbox-text-color:" + c,
              "--ytd-searchbox-placeholder-color:" + s,
              "--yt-endpoint-color:" + h,
              "--yt-endpoint-hover-color:" + h,
              "--yt-endpoint-visited-color:" + h,
              "--yt-live-chat-background-color:" + n,
              "--yt-live-chat-secondary-background-color:" + d,
              "--yt-live-chat-primary-text-color:" + c,
              "--yt-live-chat-secondary-text-color:" + s,
              "--yt-live-chat-action-panel-background-color:" + n,
              "--yt-live-chat-header-background-color:" + n,
              "--paper-dialog-background-color:" + r,
              "--paper-listbox-background-color:" + r,
              "--paper-item-focused-before-color:" + b,
              "--paper-item-selected-weight:600",
              "--paper-tabs-selection-bar-color:" + h,
              "--ytd-guide-entry-background-color-hovered:" + b,
              "--ytd-guide-entry-background-color-selected:" + v,
              "--ytd-guide-entry-icon-color:" + y,
              "--ytd-guide-entry-icon-color-selected:" + c,
              "--ytd-guide-entry-title-color:" + c,
              "--ytd-guide-section-title-color:" + s,
              "--ytd-guide-background-color:" + a,
            ];
          (k.push(x + "{" + _r(w) + "}"),
            k.push(
              [
                "html body",
                "ytd-app",
                "#content",
                "ytd-browse",
                "ytd-two-column-browse-results-renderer",
                "ytd-rich-grid-renderer",
                "ytd-watch-flexy",
                "#page-manager",
                "ytd-search",
              ].join(",") +
                "{background-color:" +
                a +
                "!important;color:" +
                c +
                "!important}",
            ),
            k.push(
              "ytd-masthead,#masthead-container,#masthead.ytd-app{background:" +
                a +
                "!important;background-color:" +
                a +
                "!important;border-bottom-color:" +
                u +
                "!important}",
            ),
            k.push(
              [
                "ytd-guide-renderer",
                "ytd-mini-guide-renderer",
                "tp-yt-app-drawer",
                "tp-yt-app-drawer .ytd-app",
                "tp-yt-app-drawer ytd-app",
                "#guide-content.ytd-app",
                "ytd-guide-renderer.ytd-app",
              ].join(",") +
                "{background:" +
                a +
                "!important;background-color:" +
                a +
                "!important;color:" +
                c +
                "!important}",
            ),
            k.push(
              [
                "#guide-section-title.ytd-guide-section-renderer",
                "ytd-guide-section-renderer #guide-section-title",
                "ytd-guide-section-renderer h3",
              ].join(",") +
                "{color:" +
                s +
                "!important}",
            ),
            k.push(
              [
                "ytd-guide-section-renderer",
                "ytd-guide-collapsible-section-entry-renderer",
                "ytd-guide-collapsible-entry-renderer",
              ].join(",") +
                "{border-color:" +
                u +
                "!important;background-color:transparent!important;color:" +
                c +
                "!important}",
            ),
            k.push(
              [
                "ytd-guide-entry-renderer",
                "ytd-guide-entry-renderer a",
                "ytd-guide-entry-renderer #endpoint",
                "ytd-guide-entry-renderer #endpoint.yt-simple-endpoint",
                "ytd-guide-entry-renderer tp-yt-paper-item",
                "ytd-mini-guide-entry-renderer",
                "ytd-mini-guide-entry-renderer a",
                "ytd-mini-guide-entry-renderer #endpoint",
              ].join(",") +
                "{background-color:transparent!important;color:" +
                c +
                "!important}",
            ),
            k.push(
              [
                ".title.ytd-guide-entry-renderer",
                "ytd-guide-entry-renderer .title",
                "ytd-guide-entry-renderer yt-formatted-string",
                "ytd-mini-guide-entry-renderer .title",
                "ytd-mini-guide-entry-renderer yt-formatted-string",
              ].join(",") +
                "{color:" +
                c +
                "!important}",
            ),
            k.push(
              [
                "ytd-guide-entry-renderer yt-icon",
                "ytd-guide-entry-renderer .guide-icon",
                "ytd-mini-guide-entry-renderer yt-icon",
              ].join(",") +
                "{color:" +
                y +
                "!important;fill:" +
                y +
                "!important}",
            ),
            k.push(
              [
                "ytd-guide-entry-renderer:not([active]) #endpoint:hover",
                "ytd-guide-entry-renderer:not([active]) tp-yt-paper-item:hover",
                "ytd-guide-entry-renderer:not([active]) a:hover",
                "ytd-mini-guide-entry-renderer:not([active]) #endpoint:hover",
                "ytd-mini-guide-entry-renderer:not([active]) a:hover",
              ].join(",") +
                "{background-color:" +
                b +
                "!important;color:" +
                c +
                "!important}",
            ),
            k.push(
              [
                "ytd-guide-entry-renderer[active]",
                "ytd-guide-entry-renderer[active] #endpoint",
                "ytd-guide-entry-renderer[active] tp-yt-paper-item",
                "ytd-guide-entry-renderer[active] a",
                "ytd-mini-guide-entry-renderer[active]",
                "ytd-mini-guide-entry-renderer[active] #endpoint",
                "ytd-mini-guide-entry-renderer[active] a",
              ].join(",") +
                "{background-color:" +
                v +
                "!important;color:" +
                c +
                "!important}",
            ),
            k.push(
              [
                "ytd-guide-entry-renderer[active] .title",
                "ytd-guide-entry-renderer[active] yt-formatted-string",
                "ytd-guide-entry-renderer[active] yt-icon",
                "ytd-guide-entry-renderer[active] .guide-icon",
                "ytd-mini-guide-entry-renderer[active] .title",
                "ytd-mini-guide-entry-renderer[active] yt-formatted-string",
                "ytd-mini-guide-entry-renderer[active] yt-icon",
              ].join(",") +
                "{color:" +
                c +
                "!important;fill:" +
                c +
                "!important}",
            ),
            k.push(
              [
                "ytd-guide-entry-renderer tp-yt-paper-item::before",
                "ytd-guide-entry-renderer tp-yt-paper-item::after",
                "ytd-mini-guide-entry-renderer tp-yt-paper-item::before",
                "ytd-mini-guide-entry-renderer tp-yt-paper-item::after",
              ].join(",") +
                "{background-color:transparent!important;color:transparent!important}",
            ),
            k.push(
              [
                "#footer.ytd-guide-renderer",
                "#footer.ytd-guide-renderer a",
                "#footer.ytd-guide-renderer #guide-links-primary a",
                "#footer.ytd-guide-renderer #guide-links-secondary a",
                "#copyright.ytd-guide-renderer",
              ].join(",") +
                "{color:" +
                l +
                "!important}",
            ),
            k.push(
              "#secondary,#related,#secondary-inner{background-color:" +
                a +
                "!important}",
            ),
            k.push(
              [
                "ytd-compact-video-renderer",
                "ytd-comment-thread-renderer",
                "ytd-comment-renderer",
                "ytd-rich-item-renderer",
                "ytd-rich-section-renderer",
                "ytd-rich-shelf-renderer",
                "ytd-shelf-renderer",
                "ytd-video-renderer",
              ].join(",") +
                "{background-color:transparent!important;color:" +
                c +
                "!important}",
            ),
            k.push(
              [
                "ytd-rich-item-renderer #dismissible",
                "ytd-rich-item-renderer #dismissed",
                "ytd-compact-video-renderer #dismissible",
                "ytd-compact-video-renderer #dismissed",
                "ytd-video-renderer #dismissible",
                "ytd-video-renderer #dismissed",
              ].join(",") + "{border-radius:12px!important}",
            ),
            k.push(
              [
                "tp-yt-iron-dropdown",
                "ytd-menu-popup-renderer",
                "tp-yt-paper-dialog",
                "ytd-multi-page-menu-renderer",
                "ytd-popup-container > tp-yt-iron-dropdown",
                "yt-dropdown-menu",
                "ytd-menu-renderer tp-yt-paper-listbox",
              ].join(",") +
                "{background-color:" +
                r +
                "!important;color:" +
                c +
                "!important;border-radius:12px!important;overflow:hidden!important;border:1px solid " +
                u +
                "!important;box-shadow:0 8px 24px " +
                f +
                "!important}",
            ),
            k.push(
              [
                "ytd-menu-service-item-renderer",
                "ytd-menu-navigation-item-renderer",
                "ytd-menu-service-item-renderer yt-formatted-string",
                "ytd-menu-navigation-item-renderer yt-formatted-string",
                "ytd-account-section-list-renderer",
                "ytd-multi-page-menu-section-renderer",
                "ytd-compact-link-renderer",
                "ytd-compact-link-renderer yt-formatted-string",
              ].join(",") +
                "{background-color:transparent!important;color:" +
                c +
                "!important}",
            ),
            k.push(
              [
                "ytd-menu-service-item-renderer:hover",
                "ytd-menu-navigation-item-renderer:hover",
                "ytd-compact-link-renderer:hover",
                "tp-yt-paper-item:hover",
              ].join(",") +
                "{background-color:" +
                b +
                "!important}",
            ),
            k.push(
              "tp-yt-paper-listbox{background-color:" +
                r +
                "!important;color:" +
                c +
                "!important}",
            ),
            k.push(
              "tp-yt-paper-item,tp-yt-paper-item yt-formatted-string{color:" +
                c +
                "!important}",
            ),
            k.push(
              [
                "yt-chip-cloud-chip-renderer",
                "ytd-feed-filter-chip-bar-renderer yt-chip-cloud-chip-renderer",
              ].join(",") +
                "{background-color:" +
                p +
                "!important;color:" +
                c +
                "!important;border-color:" +
                u +
                "!important}",
            ),
            k.push(
              [
                "yt-chip-cloud-chip-renderer[selected]",
                "yt-chip-cloud-chip-renderer[aria-selected=true]",
                "yt-chip-cloud-chip-renderer[chip-style=STYLE_HOME_FILTER_SELECTED]",
              ].join(",") +
                "{background-color:" +
                c +
                "!important;color:" +
                a +
                "!important}",
            ),
            k.push(
              [
                "#search-input",
                "input#search",
                "ytd-searchbox #search-input",
                "ytd-searchbox input",
                ".ytSearchboxComponentInput",
              ].join(",") +
                "{color:" +
                c +
                "!important;background-color:transparent!important}",
            ),
            k.push(
              [
                "ytd-searchbox",
                "#container.ytd-searchbox",
                ".ytSearchboxComponentInputBox",
              ].join(",") +
                "{background-color:" +
                n +
                "!important;border-color:" +
                u +
                "!important}",
            ),
            k.push(
              [
                "a.yt-simple-endpoint",
                "a.ytd-thumbnail",
                "#video-title",
                "h3.ytd-rich-grid-media",
                "#title",
                "yt-formatted-string#video-title",
              ].join(",") +
                "{color:" +
                c +
                "!important}",
            ),
            k.push(
              [
                "#metadata-line span",
                "#metadata",
                "ytd-video-meta-block .ytd-video-meta-block",
                "#byline-container",
                "#subscriber-count",
                ".ytd-channel-name",
                ".inline-metadata-item",
              ].join(",") +
                "{color:" +
                s +
                "!important}",
            ),
            k.push(
              "ytd-watch-metadata,#above-the-fold{background-color:" +
                a +
                "!important}",
            ),
            k.push(
              [
                "ytd-engagement-panel-section-list-renderer",
                "ytd-structured-description-content-renderer",
                "ytd-engagement-panel-title-header-renderer",
              ].join(",") +
                "{background-color:" +
                n +
                "!important;color:" +
                c +
                "!important}",
            ),
            k.push(
              "#description.ytd-watch-metadata,ytd-text-inline-expander{color:" +
                c +
                "!important}",
            ),
            k.push(
              "#comments,ytd-comments-header-renderer{background-color:" +
                a +
                "!important}",
            ),
            k.push(
              "ytd-comment-simplebox-renderer #placeholder-area,ytd-comment-simplebox-renderer #input-container{background-color:" +
                n +
                "!important;color:" +
                c +
                "!important}",
            ),
            k.push(
              "ytd-notification-renderer{background-color:transparent!important;color:" +
                c +
                "!important;border-radius:8px!important}",
            ),
            k.push(
              "ytd-notification-renderer:hover{background-color:" +
                b +
                "!important;border-radius:8px!important}",
            ),
            k.push(
              "::-webkit-scrollbar-thumb{background-color:" +
                y +
                "!important;border-radius:8px}",
            ),
            k.push(
              "::-webkit-scrollbar-track{background-color:" + a + "!important}",
            ),
            k.push("::-webkit-scrollbar{width:10px;height:10px}"),
            k.push(
              "yt-spec-touch-feedback-shape__fill{background-color:" +
                b +
                "!important}",
            ),
            k.push(
              "ytd-page-introduction-renderer,ytd-clarification-renderer{background-color:" +
                n +
                "!important;color:" +
                c +
                "!important}",
            ),
            k.push(
              [
                "ytd-tabbed-page-header",
                "ytd-tabbed-page-header #page-header",
                "yt-page-header-renderer",
                "yt-page-header-view-model",
                ".ytPageHeaderViewModelHost",
                ".ytPageHeaderViewModelContent",
                ".ytPageHeaderViewModelHeadline",
                ".ytPageHeaderViewModelHeadlineInfo",
                ".pageHeaderRendererHost",
              ].join(",") +
                "{background-color:transparent!important;color:" +
                c +
                "!important}",
            ),
            k.push(
              [
                ".ytPageHeaderViewModelTitle",
                ".ytPageHeaderViewModelTitleLarge",
                ".dynamicTextViewModelHost",
                ".dynamicTextViewModelH1",
                ".dynamicTextViewModelH1 .ytAttributedStringHost",
                ".dynamicTextViewModelH1 span",
                "yt-dynamic-text-view-model",
                "yt-dynamic-text-view-model h1",
                "yt-dynamic-text-view-model span",
              ].join(",") +
                "{color:" +
                c +
                "!important}",
            ),
            k.push(
              [
                ".ytPageHeaderViewModelDescription",
                ".ytPageHeaderViewModelDescription .ytAttributedStringHost",
                ".ytPageHeaderViewModelMetadata",
                ".ytPageHeaderViewModelMetadata .ytAttributedStringHost",
                "yt-description-preview-view-model",
                "yt-description-preview-view-model .ytAttributedStringHost",
                "yt-content-metadata-view-model",
                "yt-content-metadata-view-model .ytAttributedStringHost",
              ].join(",") +
                "{color:" +
                s +
                "!important}",
            ),
            k.push(
              [
                ".ytAttributedStringHost",
                ".yt-core-attributed-string",
                ".yt-core-attributed-string--white-space-pre-wrap",
              ].join(",") +
                "{color:" +
                c +
                "!important}",
            ),
            k.push(
              [
                ".yt-core-attributed-string a",
                ".yt-core-attributed-string__link",
                ".yt-core-attributed-string--link-inherit-color",
              ].join(",") +
                "{color:" +
                h +
                "!important}",
            ),
            k.push(
              [
                ".ytTabsViewModelHost",
                ".ytTabShapeHost",
                "yt-tab-shape",
                "yt-tabs-view-model",
                ".tab-content.style-scope.yt-tab-shape",
              ].join(",") +
                "{background-color:transparent!important;color:" +
                s +
                "!important}",
            ),
            k.push(
              [
                ".ytTabShapeHost--selected",
                "yt-tab-shape[aria-selected=true]",
                "yt-tab-shape.ytd-feed-filter-chip-bar-renderer[aria-selected=true]",
              ].join(",") +
                "{color:" +
                c +
                "!important;border-color:" +
                c +
                "!important}",
            ),
            k.push(
              [
                "yt-chip-shape",
                ".ytChipShapeHost",
                ".ytChipShapeChipText",
                ".ytChipShapeChipText .ytAttributedStringHost",
              ].join(",") +
                "{background-color:" +
                p +
                "!important;color:" +
                c +
                "!important;border-color:" +
                u +
                "!important}",
            ),
            k.push(
              [
                ".ytChipShapeActive",
                ".ytChipShapeActive .ytChipShapeChipText",
                ".ytChipShapeActive .ytAttributedStringHost",
              ].join(",") +
                "{background-color:" +
                c +
                "!important;color:" +
                a +
                "!important}",
            ),
            k.push(
              [
                ".yt-spec-button-shape-next--mono",
                ".yt-spec-button-shape-next--tonal",
                ".yt-flexible-actions-view-model",
                ".page-header-view-model-wiz__page-header-flex-end-content",
              ].join(",") +
                "{color:" +
                c +
                "!important}",
            ),
            k.push(
              [
                "#page-header-banner",
                "yt-image-banner-view-model",
                ".page-header-view-model-wiz__page-header-headline-image",
              ].join(",") +
                "{background-color:" +
                n +
                "!important;border-radius:12px!important;overflow:hidden!important}",
            ),
            k.push(
              [
                "ytd-thumbnail",
                "ytd-thumbnail a",
                "ytd-thumbnail.ytd-rich-grid-media",
                "ytd-thumbnail.ytd-video-renderer",
                "ytd-thumbnail.ytd-compact-video-renderer",
                "ytd-thumbnail.ytd-playlist-thumbnail",
                "ytd-playlist-thumbnail",
                "yt-thumbnail-view-model",
                ".yt-thumbnail-view-model",
                ".ytThumbnailViewModelImage",
                ".collections-stack-wiz__collection-stack1",
                ".collections-stack-wiz__collection-stack2",
                "yt-collection-thumbnail-view-model",
                "ytd-moving-thumbnail-renderer",
                "#thumbnail.ytd-rich-grid-media",
                "ytd-rich-grid-media a#thumbnail",
              ].join(",") +
                "{border-radius:12px!important;overflow:hidden!important}",
            ),
            k.push(
              [
                "ytd-thumbnail img",
                "ytd-thumbnail yt-img-shadow",
                "ytd-playlist-thumbnail img",
                ".ytThumbnailViewModelImage img",
                "yt-img-shadow.ytd-thumbnail img",
              ].join(",") + "{border-radius:12px!important}",
            ),
            k.push(
              [
                "yt-img-shadow.ytd-channel-thumbnail",
                "ytd-channel-thumbnail img",
                "ytd-channel-thumbnail",
                "yt-avatar-shape",
                ".yt-avatar-shape",
                ".yt-spec-avatar-shape",
                ".yt-spec-avatar-shape img",
                "img.ytd-channel-avatar-editor",
                "#avatar img",
                "#owner #avatar",
              ].join(",") +
                "{border-radius:50%!important;overflow:hidden!important}",
            ),
            k.push(
              [
                ".yt-spec-button-shape-next",
                ".yt-spec-button-shape-next--size-m",
                ".yt-spec-button-shape-next--size-s",
                ".yt-spec-button-shape-next--size-l",
                "tp-yt-paper-button",
                "yt-button-shape",
                "yt-button-shape button",
                "ytd-button-renderer button",
              ].join(",") + "{border-radius:18px!important}",
            ),
            k.push(
              [
                ".yt-spec-button-shape-next--icon-only-default",
                ".yt-spec-button-shape-next--icon-only-default button",
                ".yt-spec-button-shape-next--icon-only",
              ].join(",") + "{border-radius:50%!important}",
            ));
          const C = ".ytSpecButtonShapeNextHost";
          k.push(
            [
              C,
              C + " .ytSpecButtonShapeNextButtonTextContent",
              C + " .ytAttributedStringHost",
              C + " yt-icon",
              C + " .ytSpecButtonShapeNextIcon",
            ].join(",") +
              "{color:" +
              c +
              "!important;fill:" +
              c +
              "!important}",
          );
          const S =
            ":not(.ytSpecButtonShapeNextSegmentedStart):not(.ytSpecButtonShapeNextSegmentedEnd):not(.ytSpecButtonShapeNextIconOnlyDefault):not(.ytSpecButtonShapeNextIconOnly)";
          return (
            k.push(
              ".ytSpecButtonShapeNextMono:not(.ytSpecButtonShapeNextFilled):not(.ytSpecButtonShapeNextTonal)" +
                S +
                "{background-color:transparent!important;color:" +
                c +
                "!important;border:0!important;border-radius:18px!important}",
            ),
            k.push(
              ".ytSpecButtonShapeNextFilled.ytSpecButtonShapeNextMono" +
                S +
                "{background-color:" +
                c +
                "!important;color:" +
                a +
                "!important;border:0!important;border-radius:18px!important}",
            ),
            k.push(
              ".ytSpecButtonShapeNextFilled.ytSpecButtonShapeNextMono .ytAttributedStringHost,.ytSpecButtonShapeNextFilled.ytSpecButtonShapeNextMono .ytSpecButtonShapeNextButtonTextContent,.ytSpecButtonShapeNextFilled.ytSpecButtonShapeNextMono yt-icon{color:" +
                a +
                "!important;fill:" +
                a +
                "!important}",
            ),
            k.push(
              ".ytSpecButtonShapeNextTonal.ytSpecButtonShapeNextMono" +
                S +
                "{background-color:" +
                p +
                "!important;color:" +
                c +
                "!important;border:0!important;border-radius:18px!important}",
            ),
            k.push(
              ".ytSpecButtonShapeNextHost.ytSpecButtonShapeNextCallToAction" +
                S +
                ",.ytSpecButtonShapeNextCallToAction" +
                S +
                "{background-color:" +
                h +
                "!important;color:#fff!important;border:0!important;border-radius:18px!important}",
            ),
            k.push(
              ".ytSpecButtonShapeNextSegmentedStart{background-color:" +
                p +
                "!important;color:" +
                c +
                "!important;border:0!important;border-right:1px solid " +
                u +
                "!important;border-radius:18px 0 0 18px!important}",
            ),
            k.push(
              ".ytSpecButtonShapeNextSegmentedEnd{background-color:" +
                p +
                "!important;color:" +
                c +
                "!important;border:0!important;border-radius:0 18px 18px 0!important}",
            ),
            k.push(
              ".ytSpecButtonShapeNextIconOnlyDefault,.ytSpecButtonShapeNextIconOnly{border-radius:50%!important}",
            ),
            k.push(
              ".ytSpecButtonShapeNextSizeM" +
                S +
                "{height:36px!important;min-width:36px!important;padding:0 16px!important}",
            ),
            k.push(
              ".ytSpecButtonShapeNextSizeS" +
                S +
                "{height:32px!important;min-width:32px!important;padding:0 12px!important}",
            ),
            k.push(
              ".ytSpecButtonShapeNextSizeL" +
                S +
                "{height:48px!important;min-width:48px!important;padding:0 24px!important}",
            ),
            k.push(
              ".ytSpecButtonShapeNextSegmentedStart.ytSpecButtonShapeNextSizeM,.ytSpecButtonShapeNextSegmentedEnd.ytSpecButtonShapeNextSizeM{height:36px!important}",
            ),
            k.push(".ytSpecButtonShapeNextHost:hover{filter:brightness(1.08)}"),
            k.push(
              ".ytSpecTouchFeedbackShapeHost,.ytSpecTouchFeedbackShapeFill,.ytSpecTouchFeedbackShapeStroke{background-color:transparent!important;border-color:transparent!important}",
            ),
            k.push(
              "timed-animation-button-renderer,.ytwTimedAnimationButtonRendererHost,.ytSmartImationsHost,.ytSmartImationsContent{color:" +
                c +
                "!important}",
            ),
            k.push(
              ".ytSearchboxComponentSuggestionsContainer{border-radius:0 0 12px 12px!important}",
            ),
            k.push(
              [
                "#container.ytd-searchbox",
                ".ytSearchboxComponentInputBox",
                ".ytSearchboxComponentInputBoxHasFocus",
              ].join(",") + "{border-radius:20px 0 0 20px!important}",
            ),
            k.push(
              [
                "#search-icon-legacy.ytd-searchbox",
                ".ytSearchboxComponentSearchButton",
              ].join(",") + "{border-radius:0 20px 20px 0!important}",
            ),
            k.push(
              "ytd-searchbox{border-radius:0!important;overflow:visible!important}",
            ),
            k.push(
              [
                "yt-chip-cloud-chip-renderer",
                "ytd-feed-filter-chip-bar-renderer yt-chip-cloud-chip-renderer",
                "yt-chip-shape",
                ".ytChipShapeHost",
              ].join(",") + "{border-radius:8px!important}",
            ),
            k.push(
              [
                "ytd-comment-thread-renderer #header.ytd-comments-header-renderer",
                "ytd-comment-renderer #body",
                "ytd-comment-replies-renderer",
                "ytd-comment-simplebox-renderer #placeholder-area",
                "ytd-comment-simplebox-renderer #input-container",
              ].join(",") + "{border-radius:12px!important}",
            ),
            k.push(
              [
                "ytd-watch-metadata",
                "#above-the-fold.ytd-watch-metadata",
                "ytd-engagement-panel-section-list-renderer",
                "ytd-structured-description-content-renderer",
                "ytd-engagement-panel-title-header-renderer",
                "ytd-clarification-renderer",
                "ytd-page-introduction-renderer",
                "ytd-merch-shelf-renderer",
                "ytd-product-list-item-renderer",
                "ytd-rich-metadata-renderer",
              ].join(",") + "{border-radius:12px!important}",
            ),
            k.push(
              [
                "ytd-subscribe-button-renderer tp-yt-paper-button",
                "ytd-subscribe-button-renderer yt-button-shape button",
                "ytd-toggle-button-renderer button",
                "ytd-segmented-like-dislike-button-renderer .yt-spec-button-shape-next:not(.yt-spec-button-shape-next--segmented-start):not(.yt-spec-button-shape-next--segmented-end)",
              ].join(",") + "{border-radius:18px!important}",
            ),
            k.push(
              ".yt-spec-button-shape-next--segmented-start{border-radius:18px 0 0 18px!important;border-right:1px solid " +
                u +
                "!important}",
            ),
            k.push(
              ".yt-spec-button-shape-next--segmented-end{border-radius:0 18px 18px 0!important}",
            ),
            k.push(
              [
                "segmented-like-dislike-button-view-model",
                "ytd-segmented-like-dislike-button-renderer",
                "like-button-view-model",
                "dislike-button-view-model",
              ].join(",") +
                "{display:inline-flex!important;align-items:center!important;overflow:visible!important;background:transparent!important}",
            ),
            k.push(
              [
                ".yt-spec-button-shape-next.yt-spec-button-shape-next--size-m",
              ].join(",") + "{padding:0 16px!important;height:36px!important}",
            ),
            k.push(
              [
                ".yt-spec-button-shape-next.yt-spec-button-shape-next--icon-leading-trailing",
                ".yt-spec-button-shape-next .yt-spec-button-shape-next__icon",
              ].join(",") + "{gap:6px!important}",
            ),
            k.push(
              [
                "tp-yt-paper-tooltip",
                "#tooltip.tp-yt-paper-tooltip",
                "yt-tooltip",
                ".ytTooltip",
                "yt-pdg-tooltip-renderer",
              ].join(",") + "{border-radius:6px!important}",
            ),
            k.push(
              [
                "ytd-guide-entry-renderer",
                "ytd-guide-entry-renderer #endpoint",
                "ytd-guide-entry-renderer tp-yt-paper-item",
                "ytd-mini-guide-entry-renderer",
                "ytd-mini-guide-entry-renderer #endpoint",
              ].join(",") +
                "{border-radius:10px!important;overflow:hidden!important}",
            ),
            k.push(
              [
                "yt-live-chat-text-message-renderer",
                "yt-live-chat-paid-message-renderer",
                "yt-live-chat-membership-item-renderer",
              ].join(",") + "{border-radius:8px!important}",
            ),
            k.push(
              [
                "yt-interaction",
                "yt-interaction .fill",
                "yt-interaction .stroke",
                "yt-interaction .yt-interaction-fill",
                "yt-interaction .yt-interaction-stroke",
              ].join(",") +
                "{background-color:transparent!important;border-radius:inherit!important}",
            ),
            k.push(
              [
                "yt-touch-feedback-shape",
                "yt-spec-touch-feedback-shape",
                ".yt-spec-touch-feedback-shape__fill",
                ".yt-spec-touch-feedback-shape__stroke",
              ].join(",") + "{border-radius:inherit!important}",
            ),
            k.push(
              "html,html[dark],html:not([dark]){" +
                _r([
                  "--yt-spec-border-radius-small:4px",
                  "--yt-spec-border-radius-medium:8px",
                  "--yt-spec-border-radius-large:12px",
                  "--yt-spec-border-radius-xlarge:18px",
                  "--ytd-rich-grid-item-border-radius:12px",
                  "--yt-search-suggestion-border-radius:8px",
                  "--ytd-thumbnail-border-radius:12px",
                  "--yt-button-shape-border-radius:18px",
                  "--paper-card-border-radius:12px",
                  "--paper-dialog-border-radius:12px",
                  "--paper-menu-button-content-border-radius:12px",
                ]) +
                "}",
            ),
            k.join("\n")
          );
        })(a);
      } catch (e) {
        (h("themeBuildCSS", e), (r = ""));
      }
      r &&
        (Vr(r),
        Fr(),
        (function () {
          jr();
          try {
            if (!document.head || !Hr) return;
            let e = !1,
              t = !1;
            ((Dr = new MutationObserver(() => {
              t
                ? (t = !1)
                : e ||
                  ((e = !0),
                  requestAnimationFrame(() => {
                    e = !1;
                    try {
                      document.getElementById(qr)
                        ? document.head.lastElementChild !== Hr &&
                          ((t = !0), Fr())
                        : Hr &&
                          Hr.textContent &&
                          ((t = !0), Vr(Hr.textContent));
                    } catch (e) {}
                  }));
            })),
              Dr.observe(document.head, { childList: !0 }));
          } catch (e) {}
        })(),
        S.themeOverhaulOn && Xr(),
        t.onNav(() => {
          if ("dark" === a.mode || "light" === a.mode)
            for (const e of [60, 250, 800, 2e3]) t.addTimeout(n, e);
          for (const e of [80, 350, 1200])
            t.addTimeout(() => {
              (document.getElementById(qr) || Vr(r),
                S.themeOverhaulOn && !document.getElementById(Wr) && Gr(),
            S.themeGlassOverhaulOn && Xr(),
                Fr());
            }, e);
        }),
        Yt["theme-engine"].push(zr),
        Yt["theme-engine"].push(Zr));
    },
    settings(t) {
      const a = (function () {
        try {
          if (
            document.documentElement &&
            document.documentElement.hasAttribute("dark")
          )
            return "dark";
        } catch (e) {}
        try {
          if (e.ytcfg && e.ytcfg.get) {
            const t = e.ytcfg.get("THEME");
            if ("DARK" === t) return "dark";
            if ("LIGHT" === t) return "light";
            const a = e.ytcfg.get("BACKGROUND_COLOR");
            if ("#0f0f0f" === a || "#000000" === a) return "dark";
            if ("#ffffff" === a) return "light";
          }
        } catch (e) {}
        try {
          const e = document.cookie.match(/(?:^|;\s*)PREF=([^;]*)/);
          if (e) {
            const t = decodeURIComponent(e[1]).match(/f6=(\d+)/);
            if (t) {
              const e = parseInt(t[1], 10);
              if (32 & e) return "dark";
              if (16 & e) return "light";
            }
          }
        } catch (e) {}
        try {
          if (
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme:dark)").matches
          )
            return "dark";
        } catch (e) {}
        return "light";
      })();
      (t.appendChild(To("div", "ytp-lbl", "Detected mode: " + a)),
        t.appendChild(To("div", "ytp-elem-sec-title", "Extras")),
        t.appendChild(Io("Turn on advanced theme styling", "themeOverhaulOn")),
        t.appendChild(
          Io(
            "Apply full glassmorphism layout to the entire site",
            "themeGlassOverhaulOn",
          ),
        ),
        t.appendChild(
          No("Accent color", "themeAccentHue", 0, 359, 1, (e) => e + "°"),
        ));
      const n = To("div", "ytp-fx-grid");
      n.style.cssText =
        "display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin:8px 0";
      const r = (e, t) => {
        const a = To("div", "ytp-corecell");
        return (
          a.appendChild(To("span", "ytp-corelbl", e)),
          a.appendChild(Bo(t)),
          a
        );
      };
      (n.appendChild(
        r("Glow ring when tabbing with the keyboard", "themeFxFocusRing"),
      ),
        n.appendChild(
          r(
            "Highlight the page you're on in the sidebar",
            "themeFxAccentGradient",
          ),
        ),
        t.appendChild(n));
      const o = To(
        "div",
        "ytp-hist-note",
        "Just two little touches - nothing that runs while you scroll, hover, or click. Built to stay completely out of your way.",
      );
      (t.appendChild(o),
        t.appendChild(To("div", "ytp-elem-sec-title", "Dark Themes")));
      const i = To("div", "ytp-theme-grid");
      (Nr.filter((e) => "dark" === e.mode).forEach((e) => i.appendChild(Qr(e))),
        t.appendChild(i),
        t.appendChild(To("div", "ytp-elem-sec-title", "Light Themes")));
      const d = To("div", "ytp-theme-grid");
      (Nr.filter((e) => "light" === e.mode).forEach((e) =>
        d.appendChild(Qr(e)),
      ),
        t.appendChild(d));
      const c = To("div", "ytp-theme-card reset");
      ("none" === S.themeSelected && c.classList.add("active"),
        c.appendChild(To("div", "ytp-theme-name", "Default (YouTube)")),
        c.addEventListener("click", () => Ta("themeSelected", "none")),
        t.appendChild(c),
        So("cfg.changed", (e) => {
          "themeSelected" === e.key &&
            t.querySelectorAll(".ytp-theme-card").forEach((e) => {
              const t = e.querySelector(".ytp-theme-name");
              if (!t) return;
              const a = Nr.find((e) => e.name === t.textContent);
              e.classList.toggle(
                "active",
                a
                  ? S.themeSelected === a.id
                  : "none" === S.themeSelected &&
                      "Default (YouTube)" === t.textContent,
              );
            });
        }));
    },
  }),
    xa.register({
      id: "session-summary",
      name: "Session Summary Card",
      summary:
        "After you’ve watched a few videos, a small card pops up to recap your session.",
      masterKey: "sessionSummaryOn",
      keys: ["sessionSummaryOn", "sessionSummaryThreshold"],
      apply() {},
      settings(e) {
        e.appendChild(
          No(
            "Show after N videos",
            "sessionSummaryThreshold",
            1,
            50,
            1,
            (e) => e + " videos",
          ),
        );
      },
    }),
    xa.register({
      id: "chapter-list",
      name: "Chapter List Panel",
      summary: "Show all the video’s chapters as a clickable list.",
      masterKey: "chapterListOn",
      keys: ["chapterListOn"],
      apply(e) {
        if (!S.chapterListOn) {
          const e = document.getElementById("ytp-chapter-panel");
          return void (e && e.remove());
        }
        const t = () =>
          (function () {
            const e = document.getElementById("ytp-chapter-panel");
            if (
              (e && e.remove(),
              !S.chapterListOn || "/watch" !== location.pathname)
            )
              return;
            const t = Jr();
            if (!t.length) return;
            const a =
              document.querySelector("#below #title") ||
              document.querySelector("ytd-watch-metadata") ||
              document.querySelector("#primary-inner");
            if (!a) return;
            const n = document.createElement("div");
            n.id = "ytp-chapter-panel";
            const r = document.createElement("div");
            r.className = "ytp-ch-hdr";
            const o = document.createElement("span");
            o.textContent = t.length + " chapter" + (1 === t.length ? "" : "s");
            const i = document.createElement("button");
            ((i.type = "button"),
              (i.className = "ytp-ch-toggle"),
              (i.textContent = "v"));
            let d = !1;
            (i.addEventListener("click", () => {
              ((d = !d),
                (c.style.display = d ? "none" : ""),
                (i.textContent = d ? ">" : "v"));
            }),
              r.appendChild(o),
              r.appendChild(i),
              n.appendChild(r));
            const c = document.createElement("div");
            ((c.className = "ytp-ch-list"),
              t.forEach((e) => {
                const t = document.createElement("div");
                t.className = "ytp-ch-row";
                const a = document.createElement("span");
                ((a.className = "ytp-ch-t"), (a.textContent = ce(e.t)));
                const n = document.createElement("span");
                ((n.className = "ytp-ch-title"),
                  (n.textContent = e.title),
                  t.appendChild(a),
                  t.appendChild(n),
                  t.addEventListener("click", () => {
                    try {
                      const t = ie.el();
                      t && (t.currentTime = e.t);
                      const a = ie.api();
                      a && a.playVideo && a.playVideo();
                    } catch (e) {}
                  }),
                  c.appendChild(t));
              }),
              n.appendChild(c),
              a.parentNode.insertBefore(n, a));
          })();
        (t(),
          e.onNav(() => {
            for (const a of [800, 1800, 3500]) e.addTimeout(t, a);
          }));
        for (const a of [800, 1800]) e.addTimeout(t, a);
      },
      settings() {},
    }));
  let $r = null;
  function eo() {
    if ($r) {
      try {
        $r.remove();
      } catch (e) {}
      $r = null;
    }
    document
      .querySelectorAll("ytd-comment-thread-renderer")
      .forEach((e) => (e.style.display = ""));
  }
  function to() {
    const t = document.querySelector("#ytp-heatmap-svg");
    if ((t && t.remove(), !S.heatmapForceOn)) return;
    let a = null;
    try {
      const t = e.ytInitialPlayerResponse,
        n =
          t &&
          t.playerOverlays &&
          t.playerOverlays.playerOverlayRenderer &&
          t.playerOverlays.playerOverlayRenderer.decoratedPlayerBarRenderer,
        r = n && n.decoratedPlayerBarRenderer,
        o = r && r.playerBar && r.playerBar.multiMarkersPlayerBarRenderer,
        i = o && o.markersMap;
      if (i)
        for (const e of i) {
          const t = e.value && e.value.heatmap;
          if (t && t.heatmapRenderer) {
            a = { markers: t.heatmapRenderer.heatMarkers || [] };
            break;
          }
        }
    } catch (e) {}
    if (!a || !a.markers.length) return;
    const n =
      document.querySelector(".ytp-progress-list") ||
      document.querySelector(".ytp-progress-bar");
    if (!n) return;
    const r = ie.el();
    if (!r || !isFinite(r.duration) || r.duration < 1) return;
    let o = 0;
    for (const e of a.markers) {
      const t = e.heatMarkerRenderer;
      t && (o += t.markerDurationMillis || 0);
    }
    o || (o = 1e3 * r.duration);
    const i = [];
    let d = 0;
    for (const e of a.markers) {
      const t = e.heatMarkerRenderer;
      if (!t) continue;
      const a = (d / o) * 100,
        n =
          40 -
          36 *
            Math.max(0, Math.min(1, t.heatMarkerIntensityScoreNormalized || 0));
      (i.push([a, n]),
        (d += t.markerDurationMillis || 0),
        i.push([(d / o) * 100, n]));
    }
    (i.unshift([0, 40]), i.push([100, 40]));
    const c = "M " + i.map(([e, t]) => e + "," + t).join(" L ") + " Z",
      s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    ((s.id = "ytp-heatmap-svg"),
      s.setAttribute("viewBox", "0 0 100 40"),
      s.setAttribute("preserveAspectRatio", "none"),
      (s.style.cssText =
        "position:absolute;left:0;right:0;bottom:0;width:100%;height:40px;pointer-events:none;z-index:32;opacity:.55"));
    const l = document.createElementNS("http://www.w3.org/2000/svg", "path");
    (l.setAttribute("d", c),
      l.setAttribute("fill", "rgba(255,255,255,0.7)"),
      l.setAttribute("stroke", "rgba(255,255,255,0.9)"),
      l.setAttribute("stroke-width", "0.3"),
      s.appendChild(l));
    try {
      "static" === getComputedStyle(n).position &&
        (n.style.position = "relative");
    } catch (e) {}
    n.appendChild(s);
  }
  (xa.register({
    id: "comment-search",
    name: "Comment Search",
    summary: "Add a search bar above the comments so you can filter them.",
    masterKey: "commentSearchOn",
    keys: ["commentSearchOn"],
    apply(e) {
      if (!S.commentSearchOn) return void eo();
      const t = () =>
        (function () {
          if ($r && document.body.contains($r)) return;
          const e =
            document.querySelector("ytd-comments") ||
            document.querySelector("#comments");
          if (!e) return;
          const t = document.createElement("div");
          t.id = "ytp-comment-search";
          const a = document.createElement("input");
          ((a.type = "search"),
            (a.placeholder = "Filter comments…"),
            (a.className = "ytp-cs-input"));
          const n = document.createElement("span");
          n.className = "ytp-cs-count";
          const r = document.createElement("button");
          function o() {
            const e = a.value.trim().toLowerCase(),
              t = document.querySelectorAll("ytd-comment-thread-renderer");
            if (!e)
              return (
                t.forEach((e) => (e.style.display = "")),
                void (n.textContent = t.length + " shown")
              );
            let r = 0;
            (t.forEach((t) => {
              const a = (t.textContent || "").toLowerCase().includes(e);
              ((t.style.display = a ? "" : "none"), a && r++);
            }),
              (n.textContent = r + " / " + t.length));
          }
          ((r.type = "button"),
            (r.textContent = "×"),
            (r.className = "ytp-cs-clear"),
            t.appendChild(a),
            t.appendChild(n),
            t.appendChild(r),
            e.insertBefore(t, e.firstChild),
            ($r = t),
            a.addEventListener("input", ee(o, 100)),
            r.addEventListener("click", () => {
              ((a.value = ""), o(), a.focus());
            }),
            setTimeout(o, 300));
        })();
      (t(),
        e.onNav(() => {
          eo();
          for (const a of [1e3, 2500, 5e3]) e.addTimeout(t, a);
        }));
      for (const a of [1e3, 2500, 5e3]) e.addTimeout(t, a);
    },
    settings() {},
  }),
    xa.register({
      id: "heatmap-force",
      name: "Most-Replayed Heatmap",
      summary:
        "Always show the most-replayed parts of the video on the seekbar, even for videos that wouldn’t normally have it.",
      masterKey: "heatmapForceOn",
      keys: ["heatmapForceOn"],
      apply(e) {
        if (!S.heatmapForceOn) {
          const e = document.querySelector("#ytp-heatmap-svg");
          return void (e && e.remove());
        }
        const t = () => setTimeout(to, 400);
        (t(),
          e.onNav(() => {
            for (const a of [800, 1800, 3500]) e.addTimeout(t, a);
          }));
        for (const a of [800, 2e3, 4e3]) e.addTimeout(t, a);
      },
      settings() {},
    }));
  let ao = 0;
  function no() {
    (ao && clearTimeout(ao), (ao = setTimeout(oo, 350)));
  }
  function ro() {
    document
      .querySelectorAll("#ytp-uhm-svg,.ytp-uhm-mark,.ytp-uhm-chapter")
      .forEach((e) => {
        try {
          e.remove();
        } catch (e) {}
      });
  }
  function oo() {
    if (((ao = 0), ro(), !S.unifiedHeatmapOn)) return;
    const t =
      document.querySelector("#movie_player .ytp-progress-bar-container") ||
      document.querySelector(
        ".html5-video-player .ytp-progress-bar-container",
      ) ||
      document.querySelector(".ytp-progress-bar-container") ||
      document.querySelector(".ytp-progress-bar");
    if (!t) return;
    const n = ie.el();
    if (!n || !isFinite(n.duration) || n.duration < 1) return;
    const r = n.duration;
    if (S.unifiedHeatmapShowReplays) {
      const n = (function () {
        try {
          const t = e.ytInitialPlayerResponse,
            a =
              t &&
              t.playerOverlays &&
              t.playerOverlays.playerOverlayRenderer &&
              t.playerOverlays.playerOverlayRenderer.decoratedPlayerBarRenderer,
            n = a && a.decoratedPlayerBarRenderer,
            r = n && n.playerBar && n.playerBar.multiMarkersPlayerBarRenderer,
            o = r && r.markersMap;
          if (!o) return null;
          for (const e of o) {
            const t = e.value && e.value.heatmap;
            if (t && t.heatmapRenderer)
              return t.heatmapRenderer.heatMarkers || [];
          }
        } catch (e) {}
        return null;
      })();
      if (n && n.length) {
        let e = 0;
        for (const t of n) {
          const a = t && t.heatMarkerRenderer;
          a && (e += a.markerDurationMillis || 0);
        }
        e || (e = 1e3 * r);
        const o = [];
        let i = 0;
        for (const t of n) {
          const a = t && t.heatMarkerRenderer;
          if (!a) continue;
          const n = (i / e) * 100,
            r =
              40 -
              36 *
                Math.max(
                  0,
                  Math.min(1, a.heatMarkerIntensityScoreNormalized || 0),
                );
          (o.push([n, r]),
            (i += a.markerDurationMillis || 0),
            o.push([(i / e) * 100, r]));
        }
        if (o.length >= 2) {
          (o.unshift([0, 40]), o.push([100, 40]));
          const e =
              "M " +
              o.map(([e, t]) => e.toFixed(2) + "," + t.toFixed(2)).join(" L ") +
              " Z",
            n = "http://www.w3.org/2000/svg",
            r = document.createElementNS(n, "svg");
          ((r.id = "ytp-uhm-svg"),
            r.setAttribute("viewBox", "0 0 100 40"),
            r.setAttribute("preserveAspectRatio", "none"),
            (r.style.cssText =
              "position:absolute;left:0;right:0;bottom:0;width:100%;height:100%;min-height:12px;pointer-events:none;z-index:30;opacity:.55;overflow:visible"));
          const i = document.createElementNS(n, "defs"),
            d = "ytpUhmGrad-" + Date.now().toString(36);
          (a(
            i,
            '<linearGradient id="' +
              d +
              '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff6f00" stop-opacity=".9"/><stop offset="100%" stop-color="#ffeb3b" stop-opacity=".5"/></linearGradient>',
          ),
            r.appendChild(i));
          const c = document.createElementNS(n, "path");
          (c.setAttribute("d", e),
            c.setAttribute("fill", "url(#" + d + ")"),
            c.setAttribute("stroke", "rgba(255,255,255,0.85)"),
            c.setAttribute("stroke-width", "0.3"),
            r.appendChild(c),
            t.appendChild(r));
        }
      }
    }
    if (S.unifiedHeatmapShowSB && void 0 !== tt && tt && tt.length)
      for (const e of tt) {
        if (!e || !e.segment) continue;
        const a = e.category;
        if (a && !1 === S["sb_" + a + "_en"]) continue;
        const n = i && i.find((e) => e.id === a),
          o = e.segment[0],
          d = e.segment[1];
        if (!isFinite(o) || !isFinite(d) || d <= o) continue;
        const c = Math.max(0, (o / r) * 100),
          s = Math.max(0.15, ((d - o) / r) * 100),
          l = document.createElement("div");
        ((l.className = "ytp-uhm-mark"),
          (l.title =
            (n ? n.label : a || "Segment") + " - " + ce(o) + " - " + ce(d)),
          (l.style.cssText =
            "position:absolute;top:0;bottom:0;left:" +
            c.toFixed(3) +
            "%;width:" +
            s.toFixed(3) +
            "%;background:" +
            (n ? n.color : "#fff") +
            ";opacity:.78;pointer-events:none;z-index:31;border-radius:1px;box-shadow:0 0 0 1px rgba(0,0,0,.35)"),
          t.appendChild(l));
      }
    if (S.unifiedHeatmapShowChapters)
      try {
        const e = Jr();
        for (const a of e) {
          if (!a || !isFinite(a.t)) continue;
          const e = (a.t / r) * 100;
          if (e <= 0.05 || e >= 99.95) continue;
          const n = document.createElement("div");
          ((n.className = "ytp-uhm-chapter"),
            (n.title = "Chapter - " + ce(a.t) + " - " + (a.title || "")),
            (n.style.cssText =
              "position:absolute;top:-3px;bottom:-3px;left:" +
              e.toFixed(3) +
              "%;width:2px;margin-left:-1px;background:#fff;opacity:.85;pointer-events:none;z-index:32;box-shadow:0 0 3px rgba(0,0,0,.7)"),
            t.appendChild(n));
        }
      } catch (e) {}
  }
  xa.register({
    id: "unified-heatmap",
    name: "Seekbar Overlay",
    summary:
      "Combine the most-replayed heatmap, SponsorBlock segments, and chapter markers into one helpful overlay on the seekbar.",
    masterKey: "unifiedHeatmapOn",
    keys: [
      "unifiedHeatmapOn",
      "unifiedHeatmapShowSB",
      "unifiedHeatmapShowChapters",
      "unifiedHeatmapShowReplays",
    ],
    apply(e) {
      if (!S.unifiedHeatmapOn) return void ro();
      no();
      for (const t of [400, 1200, 2800]) e.addTimeout(no, t);
      e.onNav(() => {
        for (const t of [600, 1500, 3500]) e.addTimeout(no, t);
      });
      const t = ie.el();
      t &&
        (e.addListener(t, "loadedmetadata", no),
        e.addListener(t, "durationchange", no));
      const a = g.on("sb.segments", no);
      Yt["unified-heatmap"].push(a);
      const n = document.querySelector("#movie_player") || document.body;
      (n &&
        e.addObserver(
          n,
          ee(() => {
            !document.querySelector("#ytp-uhm-svg") &&
              (S.unifiedHeatmapShowReplays ||
                S.unifiedHeatmapShowSB ||
                S.unifiedHeatmapShowChapters) &&
              no();
          }, 400),
          { childList: !0, subtree: !0 },
        ),
        Yt["unified-heatmap"].push(ro));
    },
    settings(e) {
      (e.appendChild(
        Io(
          "Show most-replayed section graph (orange)",
          "unifiedHeatmapShowReplays",
        ),
      ),
        e.appendChild(
          Io(
            "Show SponsorBlock segments (color-coded)",
            "unifiedHeatmapShowSB",
          ),
        ),
        e.appendChild(
          Io("Show chapter dividers (white)", "unifiedHeatmapShowChapters"),
        ),
        e.appendChild(Eo([Oo("Re-render now", no, "primary")])));
    },
  });
  let io = -1,
    co = -1;

  let St_submitABOverlay = null;
  function Bt_renderSubmitAB() {
    if (!S.sbSubmitOn) {
      if (St_submitABOverlay) {
        St_submitABOverlay.remove();
        St_submitABOverlay = null;
      }
      return;
    }
    if (io < 0 && co < 0) {
      if (St_submitABOverlay) {
        St_submitABOverlay.remove();
        St_submitABOverlay = null;
      }
      return;
    }
    const list = document.querySelector(".ytp-progress-list") || document.querySelector(".ytp-progress-bar");
    if (!list) return;
    const v = ie.el();
    if (!v || !v.duration || !isFinite(v.duration)) return;
    if (!St_submitABOverlay) {
      St_submitABOverlay = document.createElement("div");
      St_submitABOverlay.className = "ytp-sb-submit-marker";
      St_submitABOverlay.style.cssText =
        "position:absolute;top:0;bottom:0;pointer-events:none;z-index:33";
    }
    if (St_submitABOverlay.parentNode !== list) list.appendChild(St_submitABOverlay);
    const a = io >= 0 ? (io / v.duration) * 100 : 0;
    const b = co >= 0 ? (co / v.duration) * 100 : 0;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const widthPct = Math.max(0, hi - lo);
    St_submitABOverlay.style.left = lo + "%";
    St_submitABOverlay.style.width = widthPct + "%";
    St_submitABOverlay.style.background = "rgba(255,61,127,0.18)";
  }
  xa.register({
    id: "sb-submit",
    name: "Submit Sponsorship Segments",
    summary:
      "Help the community by marking sponsorship sections and sharing them. Choose categories like Sponsor, Self-promo, Intro, or Outro.",
    masterKey: "sbSubmitOn",
    keys: ["sbSubmitOn", "sbSubmitUserId"],
    apply(e) {
      if (!S.sbSubmitOn) return;

      const v = ie.el();
      if (v) {
        e.addListener(v, "timeupdate", Bt_renderSubmitAB);
        e.addListener(v, "durationchange", Bt_renderSubmitAB);
      }
      e.onNav(() => {
        St_submitABOverlay &&
          (St_submitABOverlay.remove(), (St_submitABOverlay = null));
      });
    },
    settings(e) {
      const t = To("div", "ytp-sbsub-panel");
      (e.appendChild(t),
        (function (e) {
          e.replaceChildren();
          const t = Oo("Set A (start)", () => {
              const e = ie.el();
              e &&
                ((io = e.currentTime), p(), pe("A = " + ce(io), 1200, "info"));
            }),
            a = Oo("Set B (end)", () => {
              const e = ie.el();
              e &&
                ((co = e.currentTime), p(), pe("B = " + ce(co), 1200, "info"));
            }),
            o = Oo("Clear A/B", () => {
              ((io = -1), (co = -1), p());
            });
          e.appendChild(Eo([t, a, o]));
          const d = To("div", "ytp-sbsub-status");
          e.appendChild(d);
          const c = document.createElement("select");
          ((c.className = "ytp-sel"),
            i.forEach((e) => {
              const t = document.createElement("option");
              ((t.value = e.id), (t.textContent = e.label), c.appendChild(t));
            }),
            (c.value = "sponsor"),
            e.appendChild(Lo("Category", c)));
          const s = document.createElement("select");
          ((s.className = "ytp-sel"),
            [
              ["skip", "Skip"],
              ["mute", "Mute"],
              ["poi", "Point-of-interest"],
              ["full", "Full video (sponsor entirely)"],
            ].forEach(([e, t]) => {
              const a = document.createElement("option");
              ((a.value = e), (a.textContent = t), s.appendChild(a));
            }),
            (s.value = "skip"),
            e.appendChild(Lo("Action", s)));
          const l = Oo(
            "Submit segment to SponsorBlock",
            async () => {
              if (io < 0 || co < 0)
                pe("Pick a start point and an end point first.", 1500, "error");
              else {
                ((l.disabled = !0), (l.textContent = "Submitting…"));
                try {
                  await (async function (e, t, a, o) {
                    if (!S.sponsorblockOn)
                      return void pe(
                        "Turn on SponsorBlock first.",
                        1800,
                        "error",
                      );
                    const i = ie.videoId();
                    if (!i)
                      return void pe("Open a video first.", 1500, "error");
                    if (!(t > e))
                      return void pe(
                        "The end point needs to come after the start point.",
                        1800,
                        "error",
                      );
                    let d = S.sbSubmitUserId;
                    if (!d || d.length < 30) {
                      const e = new Uint8Array(32);
                      (crypto.getRandomValues(e),
                        (d = Array.from(e)
                          .map((e) => e.toString(16).padStart(2, "0"))
                          .join("")),
                        Ta("sbSubmitUserId", d));
                    }
                    const c = (S.sbServer || r).replace(/\/$/, ""),
                      s = {
                        videoID: i,
                        userID: d,
                        userAgent: "YT-zen Userscript/" + n,
                        segments: [
                          {
                            segment: [e, t],
                            category: a,
                            actionType: o || "skip",
                          },
                        ],
                        service: "YouTube",
                        videoDuration:
                          ie.el() && isFinite(ie.el().duration)
                            ? ie.el().duration
                            : 0,
                      };
                    try {
                      const n = c + "/api/skipSegments";
                      let r;
                      if ("function" == typeof GM_xmlhttpRequest)
                        r = await new Promise((e, t) => {
                          GM_xmlhttpRequest({
                            method: "POST",
                            url: n,
                            headers: { "Content-Type": "application/json" },
                            data: JSON.stringify(s),
                            timeout: 15e3,
                            onload: (t) =>
                              e({
                                ok: t.status >= 200 && t.status < 300,
                                status: t.status,
                                text: t.responseText,
                              }),
                            onerror: t,
                            ontimeout: () => t(new Error("timeout")),
                          });
                        });
                      else {
                        const e = await fetch(n, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(s),
                        });
                        r = {
                          ok: e.ok,
                          status: e.status,
                          text: await e.text(),
                        };
                      }
                      if (r.ok) {
                        (pe(
                          "[ok] Submitted " + a + " " + ce(e) + "->" + ce(t),
                          2500,
                          "success",
                        ),
                          yt.clear());
                        const n = ie.videoId();
                        return (n && setTimeout(() => St(n), 1500), !0);
                      }
                      return (
                        pe(
                          "Couldn’t send it: " +
                            (409 === r.status
                              ? "Duplicate (already submitted)"
                              : 403 === r.status
                                ? "Forbidden (rate-limited or banned)"
                                : 400 === r.status
                                  ? "Invalid (check times)"
                                  : "HTTP " + r.status),
                          3e3,
                          "error",
                        ),
                        h("sb submit", r.status, r.text),
                        !1
                      );
                    } catch (e) {
                      return (
                        pe("Something went wrong: " + e.message, 2500, "error"),
                        m("sb submit", e),
                        !1
                      );
                    }
                  })(io, co, c.value, s.value);
                } finally {
                  ((l.disabled = !1),
                    (l.textContent = "Submit segment to SponsorBlock"));
                }
              }
            },
            "primary",
          );
          function p() {
            const e = io >= 0 ? ce(io) : "-",
              t = co >= 0 ? ce(co) : "-",
              a = io >= 0 && co > io;
            ((d.textContent =
              "A: " +
              e +
              "   B: " +
              t +
              (a ? "   (duration " + ce(co - io) + ")" : "")),
              (d.style.color = a ? "#5fc" : "#888"));
          }
          (e.appendChild(Eo([l])),
            e.appendChild(
              To(
                "div",
                "ytp-hist-note",
                "Submitted segments are sent to the community database. A unique contributor ID is created automatically and saved in your settings. If a section has already been submitted by someone else, or if your submissions are limited, a message will let you know.",
              ),
            ),
            p());
        })(t));
    },
  });
  xa.register({
      id: "block-yt-ai",
      name: "Hide YouTube AI Features",
      summary:
        "Remove YouTube\'s artificial intelligence summaries, AI search buttons, and chatbot panels.",
      masterKey: "blockYTAIOn",
      keys: ["blockYTAIOn"],
      apply(e) {
        S.blockYTAIOn &&
          e.addStyle(
            [
              "ytd-ai-summary-renderer",
              "ytd-conversation-ai-renderer",
              "yt-ai-summary",
              "yt-ai-button",
              'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-video-summary"]',
              'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-conversation"]',
              "ytd-rich-section-renderer:has(ytd-ai-summary-renderer)",
            ].join(",") +
              "{display:none!important;visibility:hidden!important;pointer-events:none!important}",
          );
      },
      settings() {},
    });
  const fo = [
    {
      group: "Masthead (top bar)",
      items: [
        {
          id: "masthead",
          name: "Entire top bar",
          selector: "ytd-masthead, #masthead, #masthead-container",
        },
        {
          id: "masthead-logo",
          name: "YouTube logo",
          selector:
            "ytd-masthead #logo, ytd-masthead a#logo, ytd-topbar-logo-renderer",
        },
        {
          id: "masthead-country",
          name: "Country code on logo",
          selector:
            "ytd-masthead #country-code, ytd-topbar-logo-renderer #country-code",
        },
        {
          id: "masthead-guide-btn",
          name: "Hamburger / guide button",
          selector: "ytd-masthead #guide-button, #guide-button",
        },
        {
          id: "masthead-search-wrap",
          name: "Search box wrapper",
          selector: "ytd-masthead #center, ytd-masthead ytd-searchbox",
        },
        {
          id: "masthead-search-input",
          name: "Search input only",
          selector: "ytd-searchbox input#search",
        },
        {
          id: "masthead-search-btn",
          name: "Search submit button",
          selector:
            "ytd-masthead #search-icon-legacy, ytd-searchbox #search-icon-legacy",
        },
        {
          id: "masthead-voice",
          name: "Voice search button",
          selector: "ytd-masthead #voice-search-button, #voice-search-button",
        },
        {
          id: "masthead-suggest",
          name: "Search suggestion dropdown",
          selector:
            "ytd-searchbox-suggestions-renderer, .ytd-searchbox-suggestions-renderer",
        },
        {
          id: "masthead-create",
          name: "Create (+) button",
          selector:
            "ytd-masthead ytd-topbar-menu-button-renderer:has(button[aria-label='Create']), ytd-masthead yt-button-view-model:has(button[aria-label='Create']), ytd-masthead button[aria-label='Create']",
        },
        {
          id: "masthead-apps",
          name: "Apps grid button",
          selector:
            "ytd-masthead ytd-topbar-menu-button-renderer:has(button[aria-label*='Apps']), ytd-masthead button[aria-label*='Apps']",
        },
        {
          id: "masthead-notif",
          name: "Notifications bell",
          selector: "ytd-masthead ytd-notification-topbar-button-renderer",
        },
        {
          id: "masthead-notif-badge",
          name: "Notification count badge",
          selector:
            "ytd-notification-topbar-button-renderer .yt-spec-icon-badge-shape__badge, #notification-count",
        },
        {
          id: "masthead-avatar",
          name: "Account avatar / sign-in",
          selector:
            "ytd-masthead ytd-topbar-menu-button-renderer:has(#avatar-btn), ytd-masthead button#avatar-btn, ytd-masthead yt-img-shadow#avatar-img",
        },
        {
          id: "masthead-signin",
          name: "Sign-in button",
          selector:
            "ytd-masthead ytd-button-renderer.style-suggestive, ytd-masthead a[href*='accounts.google.com'], ytd-masthead yt-button-view-model:has(a[href*='accounts.google.com'])",
        },
        {
          id: "masthead-premium-promo",
          name: "Premium promo button",
          selector: "ytd-masthead ytd-button-renderer[is-paid-promo]",
        },
        {
          id: "masthead-buttons",
          name: "All right-side buttons area",
          selector: "ytd-masthead #end #buttons",
        },
        {
          id: "masthead-shadow",
          name: "Top bar bottom shadow",
          selector: "ytd-masthead[has-tab-header-renderer]",
        },
      ],
    },
    {
      group: "Sidebar / Guide",
      items: [
        {
          id: "sidebar",
          name: "Entire sidebar drawer",
          selector: "tp-yt-app-drawer#guide",
        },
        {
          id: "sidebar-mini",
          name: "Mini sidebar (collapsed)",
          selector: "ytd-mini-guide-renderer, #mini-guide",
        },
        {
          id: "sidebar-section1",
          name: "Main section (Home/Shorts/Subs)",
          selector:
            "ytd-guide-renderer #sections > ytd-guide-section-renderer:nth-of-type(1)",
        },
        {
          id: "sidebar-home",
          name: "Home link",
          selector:
            "ytd-guide-entry-renderer:has(a[title='Home']), ytd-mini-guide-entry-renderer[aria-label='Home']",
        },
        {
          id: "sidebar-shorts-entry",
          name: "Shorts link",
          selector:
            "ytd-guide-entry-renderer:has(a[title='Shorts']), ytd-mini-guide-entry-renderer[aria-label='Shorts']",
        },
        {
          id: "sidebar-subs",
          name: "Subscriptions link",
          selector:
            "ytd-guide-entry-renderer:has(a[title='Subscriptions']), ytd-mini-guide-entry-renderer[aria-label='Subscriptions']",
        },
        {
          id: "sidebar-you",
          name: "You / Library collapsible",
          selector:
            "ytd-guide-renderer ytd-guide-collapsible-section-entry-renderer",
        },
        {
          id: "sidebar-history",
          name: "History link",
          selector:
            "ytd-guide-entry-renderer:has(a[title='History']), a[href='/feed/history']",
        },
        {
          id: "sidebar-playlists",
          name: "Playlists link",
          selector:
            "ytd-guide-entry-renderer:has(a[title='Playlists']), a[href='/feed/playlists']",
        },
        {
          id: "sidebar-your-videos",
          name: "Your videos link",
          selector: "ytd-guide-entry-renderer:has(a[title*='Your videos'])",
        },
        {
          id: "sidebar-watch-later",
          name: "Watch later link",
          selector: "ytd-guide-entry-renderer:has(a[href*='WL'])",
        },
        {
          id: "sidebar-liked",
          name: "Liked videos link",
          selector: "ytd-guide-entry-renderer:has(a[href*='LL'])",
        },
        {
          id: "sidebar-subs-section",
          name: "Subscriptions list section",
          selector:
            "ytd-guide-section-renderer:has(#guide-section-title:contains('Subscriptions'))",
        },
        {
          id: "sidebar-explore",
          name: "Explore section",
          selector:
            "ytd-guide-renderer ytd-guide-section-renderer:nth-of-type(3)",
        },
        {
          id: "sidebar-trending",
          name: "Trending link",
          selector: "ytd-guide-entry-renderer:has(a[title='Trending'])",
        },
        {
          id: "sidebar-music",
          name: "Music link",
          selector: "ytd-guide-entry-renderer:has(a[title='Music'])",
        },
        {
          id: "sidebar-movies",
          name: "Movies link",
          selector: "ytd-guide-entry-renderer:has(a[title*='Movies'])",
        },
        {
          id: "sidebar-live",
          name: "Live link",
          selector: "ytd-guide-entry-renderer:has(a[title='Live'])",
        },
        {
          id: "sidebar-gaming",
          name: "Gaming link",
          selector: "ytd-guide-entry-renderer:has(a[title='Gaming'])",
        },
        {
          id: "sidebar-news",
          name: "News link",
          selector: "ytd-guide-entry-renderer:has(a[title='News'])",
        },
        {
          id: "sidebar-sports",
          name: "Sports link",
          selector: "ytd-guide-entry-renderer:has(a[title='Sports'])",
        },
        {
          id: "sidebar-learning",
          name: "Learning link",
          selector: "ytd-guide-entry-renderer:has(a[title='Learning'])",
        },
        {
          id: "sidebar-fashion",
          name: "Fashion & Beauty link",
          selector: "ytd-guide-entry-renderer:has(a[title*='Fashion'])",
        },
        {
          id: "sidebar-podcasts",
          name: "Podcasts link",
          selector: "ytd-guide-entry-renderer:has(a[title='Podcasts'])",
        },
        {
          id: "sidebar-more-yt",
          name: "More from YouTube section",
          selector:
            "ytd-guide-renderer ytd-guide-section-renderer:nth-of-type(4)",
        },
        {
          id: "sidebar-yt-premium",
          name: "YouTube Premium link",
          selector: "ytd-guide-entry-renderer:has(a[title*='Premium'])",
        },
        {
          id: "sidebar-yt-studio",
          name: "YouTube Studio link",
          selector: "ytd-guide-entry-renderer:has(a[title*='Studio'])",
        },
        {
          id: "sidebar-yt-music",
          name: "YouTube Music link",
          selector: "ytd-guide-entry-renderer:has(a[title*='YouTube Music'])",
        },
        {
          id: "sidebar-yt-kids",
          name: "YouTube Kids link",
          selector: "ytd-guide-entry-renderer:has(a[title*='Kids'])",
        },
        {
          id: "sidebar-settings",
          name: "Settings link",
          selector:
            "ytd-guide-entry-renderer:has(a[title='Settings']), a[href*='/account']",
        },
        {
          id: "sidebar-report",
          name: "Report history link",
          selector: "ytd-guide-entry-renderer:has(a[title*='Report'])",
        },
        {
          id: "sidebar-help",
          name: "Help link",
          selector: "ytd-guide-entry-renderer:has(a[title='Help'])",
        },
        {
          id: "sidebar-feedback",
          name: "Send feedback link",
          selector: "ytd-guide-entry-renderer:has(a[title*='feedback'])",
        },
        {
          id: "sidebar-footer",
          name: "Footer (links/copyright)",
          selector: "ytd-guide-renderer #footer",
        },
        {
          id: "sidebar-signin-promo",
          name: "Sign-in promo in guide",
          selector: "ytd-guide-signin-promo-renderer",
        },
      ],
    },
    {
      group: "Home feed",
      items: [
        {
          id: "home-chips-bar",
          name: "Filter chips bar",
          selector: "ytd-feed-filter-chip-bar-renderer, iron-selector#chips",
        },
        {
          id: "home-chip-all",
          name: "'All' chip",
          selector:
            "yt-chip-cloud-chip-renderer[chip-style='STYLE_HOME_FILTER'] yt-formatted-string:contains('All')",
        },
        {
          id: "home-rich-grid",
          name: "Entire grid",
          selector: "ytd-rich-grid-renderer",
        },
        {
          id: "home-shorts-shelf",
          name: "Shorts shelves",
          selector:
            "ytd-rich-shelf-renderer[is-shorts], ytd-reel-shelf-renderer",
        },
        {
          id: "home-shorts-pill",
          name: "Shorts dismiss pill",
          selector:
            "ytd-rich-shelf-renderer[is-shorts] ytd-shelf-header-layout button",
        },
        {
          id: "home-mix-shelf",
          name: "Mix / playlist shelves",
          selector: "ytd-rich-shelf-renderer:not([is-shorts])",
        },
        {
          id: "home-news-shelf",
          name: "Breaking news shelf",
          selector: "ytd-rich-shelf-renderer[is-default-no-title]",
        },
        {
          id: "home-ads",
          name: "Ad slots in feed",
          selector:
            "ytd-rich-item-renderer ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-banner-promo-renderer, ytd-promoted-sparkles-web-renderer",
        },
        {
          id: "home-card-thumb",
          name: "Card thumbnails",
          selector: "ytd-rich-grid-media ytd-thumbnail",
        },
        {
          id: "home-card-hover-preview",
          name: "Hover preview video",
          selector: "ytd-moving-thumbnail-renderer, ytd-video-preview",
        },
        {
          id: "home-card-loading-preview",
          name: "Loading preview overlay",
          selector: "ytd-thumbnail-overlay-loading-preview-renderer",
        },
        {
          id: "home-card-duration",
          name: "Duration badge",
          selector:
            "ytd-rich-grid-media ytd-thumbnail-overlay-time-status-renderer",
        },
        {
          id: "home-card-new-badge",
          name: "'New' badge",
          selector: "ytd-thumbnail-overlay-now-playing-renderer",
        },
        {
          id: "home-card-resume-bar",
          name: "Resume progress bar",
          selector: "ytd-thumbnail-overlay-resume-playback-renderer",
        },
        {
          id: "home-card-title",
          name: "Card titles",
          selector:
            "ytd-rich-grid-media #video-title-link, ytd-rich-grid-media #video-title",
        },
        {
          id: "home-card-channel-avatar",
          name: "Channel avatars on cards",
          selector:
            "ytd-rich-grid-media #avatar-link, ytd-rich-grid-media #avatar-container",
        },
        {
          id: "home-card-channel-name",
          name: "Channel names on cards",
          selector:
            "ytd-rich-grid-media #channel-name, ytd-rich-grid-media ytd-channel-name",
        },
        {
          id: "home-card-meta",
          name: "Views / date metadata",
          selector:
            "ytd-rich-grid-media #metadata-line, ytd-rich-grid-media ytd-video-meta-block",
        },
        {
          id: "home-card-menu",
          name: "3-dot menu on cards",
          selector:
            "ytd-rich-grid-media #menu, ytd-rich-grid-media ytd-menu-renderer",
        },
        {
          id: "home-watched-badge",
          name: "Watched overlay",
          selector: "ytd-thumbnail-overlay-toggle-button-renderer",
        },
        {
          id: "home-sponsored-label",
          name: "Sponsored label",
          selector:
            "ytd-rich-item-renderer ytd-ad-slot-renderer .badge-style-type-ad",
        },
      ],
    },
    {
      group: "Subscriptions feed",
      items: [
        {
          id: "subs-header",
          name: "Subscriptions header",
          selector:
            "ytd-browse[page-subtype='subscriptions'] ytd-page-header-renderer",
        },
        {
          id: "subs-chips",
          name: "Subs filter chips",
          selector:
            "ytd-browse[page-subtype='subscriptions'] ytd-feed-filter-chip-bar-renderer",
        },
        {
          id: "subs-shelf-headers",
          name: "Date shelves (Today/Yesterday/etc)",
          selector:
            "ytd-browse[page-subtype='subscriptions'] ytd-item-section-renderer #title",
        },
        {
          id: "subs-toggle-grid",
          name: "Grid/List toggle",
          selector:
            "ytd-browse[page-subtype='subscriptions'] ytd-shelf-renderer #toggle",
        },
      ],
    },
    {
      group: "Watch page - left/info",
      items: [
        {
          id: "watch-flexy",
          name: "Entire watch container",
          selector: "ytd-watch-flexy",
        },
        {
          id: "watch-title",
          name: "Video title",
          selector:
            "ytd-watch-metadata h1, #title h1, ytd-watch-metadata yt-formatted-string.ytd-watch-metadata",
        },
        {
          id: "watch-views",
          name: "View count",
          selector: "ytd-watch-info-text #info span:first-child, .view-count",
        },
        {
          id: "watch-date",
          name: "Publish date",
          selector: "ytd-watch-info-text #info span:last-child",
        },
        {
          id: "watch-info-strings",
          name: "View+date string",
          selector: "ytd-watch-info-text, #info-strings, #info-container",
        },
        {
          id: "watch-hashtags",
          name: "Hashtags above title",
          selector:
            "ytd-watch-metadata .super-title, yt-formatted-string.super-title",
        },
        {
          id: "watch-channel-row",
          name: "Channel row",
          selector: "ytd-watch-metadata #owner, ytd-video-owner-renderer",
        },
        {
          id: "watch-channel-avatar",
          name: "Channel avatar",
          selector:
            "ytd-video-owner-renderer #avatar, ytd-video-owner-renderer yt-img-shadow",
        },
        {
          id: "watch-channel-name",
          name: "Channel name link",
          selector:
            "ytd-video-owner-renderer ytd-channel-name, #channel-name a",
        },
        {
          id: "watch-channel-verified",
          name: "Verified checkmark",
          selector: "ytd-video-owner-renderer ytd-badge-supported-renderer",
        },
        {
          id: "watch-channel-subs",
          name: "Subscriber count",
          selector:
            "ytd-video-owner-renderer #owner-sub-count, #owner-sub-count",
        },
        {
          id: "watch-subscribe",
          name: "Subscribe button",
          selector:
            "ytd-watch-metadata ytd-subscribe-button-renderer, #subscribe-button",
        },
        {
          id: "watch-bell",
          name: "Notification bell",
          selector:
            "ytd-watch-metadata ytd-notification-preference-button-renderer",
        },
        {
          id: "watch-join",
          name: "Join (membership) button",
          selector:
            "#sponsor-button, ytd-button-renderer.ytd-sponsor-button-renderer",
        },
        {
          id: "watch-actions-row",
          name: "Like/share/save row container",
          selector: "ytd-watch-metadata #top-row, #actions",
        },
        {
          id: "watch-like",
          name: "Like button",
          selector:
            "ytd-watch-metadata like-button-view-model, segmented-like-dislike-button-view-model like-button-view-model",
        },
        {
          id: "watch-like-count",
          name: "Like count number",
          selector:
            "like-button-view-model .yt-spec-button-shape-next__button-text-content",
        },
        {
          id: "watch-dislike",
          name: "Dislike button",
          selector:
            "ytd-watch-metadata dislike-button-view-model, segmented-like-dislike-button-view-model dislike-button-view-model",
        },
        {
          id: "watch-share",
          name: "Share button",
          selector:
            "ytd-watch-metadata yt-button-view-model:has(button[aria-label*='hare']), #top-level-buttons-computed ytd-button-renderer:nth-child(1)",
        },
        {
          id: "watch-download",
          name: "Download button",
          selector:
            "ytd-watch-metadata ytd-download-button-renderer, ytd-download-button-renderer",
        },
        {
          id: "watch-clip",
          name: "Clip button",
          selector:
            "ytd-watch-metadata yt-button-view-model:has(button[aria-label*='lip'])",
        },
        {
          id: "watch-save",
          name: "Save to playlist button",
          selector:
            "ytd-watch-metadata yt-button-view-model:has(button[aria-label*='ave'])",
        },
        {
          id: "watch-thanks",
          name: "Thanks (Super Thanks) button",
          selector:
            "ytd-watch-metadata yt-button-view-model:has(button[aria-label*='hanks'])",
        },
        {
          id: "watch-remix",
          name: "Remix button",
          selector:
            "ytd-watch-metadata yt-button-view-model:has(button[aria-label*='emix'])",
        },
        {
          id: "watch-report",
          name: "Report button (in menu)",
          selector:
            "ytd-menu-service-item-renderer:has(yt-formatted-string:contains('Report'))",
        },
        {
          id: "watch-more-actions",
          name: "More actions (...) menu",
          selector:
            "ytd-watch-metadata ytd-menu-renderer, ytd-menu-renderer.ytd-watch-metadata",
        },
        {
          id: "watch-description",
          name: "Description box",
          selector:
            "ytd-watch-metadata #description, #description-inner, ytd-text-inline-expander",
        },
        {
          id: "watch-description-text",
          name: "Description text only",
          selector: "ytd-watch-metadata #description yt-attributed-string",
        },
        {
          id: "watch-show-more",
          name: "...more / Show less link",
          selector: "ytd-text-inline-expander tp-yt-paper-button",
        },
        {
          id: "watch-engagement-panels",
          name: "Engagement panel container",
          selector: "ytd-engagement-panel-section-list-renderer",
        },
        {
          id: "watch-info-cards",
          name: "Info panels (donations etc)",
          selector: "ytd-info-panel-content-renderer, #donation-shelf",
        },
        {
          id: "watch-chapters-list",
          name: "Chapters list",
          selector:
            "ytd-macro-markers-list-renderer, ytd-horizontal-card-list-renderer",
        },
        {
          id: "watch-transcript",
          name: "Transcript panel",
          selector:
            "ytd-engagement-panel-section-list-renderer[target-id*='transcript']",
        },
        {
          id: "watch-comments-panel",
          name: "Comments engagement panel",
          selector:
            "ytd-engagement-panel-section-list-renderer[target-id*='comments']",
        },
        {
          id: "watch-related-panel",
          name: "Related (mobile-style) panel",
          selector:
            "ytd-engagement-panel-section-list-renderer[target-id*='related']",
        },
        {
          id: "watch-product-shelf",
          name: "Products / shopping shelf",
          selector:
            "ytd-engagement-panel-section-list-renderer[target-id*='product']",
        },
        {
          id: "watch-clarification",
          name: "Clarification / context panel",
          selector: "ytd-info-panel-content-renderer, #clarify-box",
        },
      ],
    },
    {
      group: "Watch page - right column",
      items: [
        {
          id: "secondary",
          name: "Entire right column",
          selector: "#secondary, ytd-watch-next-secondary-results-renderer",
        },
        {
          id: "secondary-inner",
          name: "Right column inner",
          selector: "#secondary-inner",
        },
        {
          id: "secondary-chips",
          name: "Right column filter chips",
          selector:
            "#related ytd-feed-filter-chip-bar-renderer, ytd-watch-next-secondary-results-renderer ytd-feed-filter-chip-bar-renderer",
        },
        {
          id: "secondary-autoplay",
          name: "Autoplay toggle row",
          selector: "ytd-compact-autoplay-renderer",
        },
        {
          id: "secondary-autoplay-toggle",
          name: "Autoplay switch only",
          selector: "ytd-compact-autoplay-renderer ytd-toggle-button-renderer",
        },
        {
          id: "secondary-related",
          name: "Related video cards",
          selector: "ytd-compact-video-renderer",
        },
        {
          id: "secondary-related-thumb",
          name: "Related thumbnails",
          selector: "ytd-compact-video-renderer ytd-thumbnail",
        },
        {
          id: "secondary-related-title",
          name: "Related titles",
          selector: "ytd-compact-video-renderer #video-title",
        },
        {
          id: "secondary-related-channel",
          name: "Related channel names",
          selector:
            "ytd-compact-video-renderer #channel-name, ytd-compact-video-renderer ytd-channel-name",
        },
        {
          id: "secondary-related-meta",
          name: "Related metadata",
          selector: "ytd-compact-video-renderer #metadata-line",
        },
        {
          id: "secondary-related-menu",
          name: "Related 3-dot menus",
          selector: "ytd-compact-video-renderer ytd-menu-renderer",
        },
        {
          id: "secondary-playlist-card",
          name: "Playlist cards",
          selector: "ytd-compact-playlist-renderer",
        },
        {
          id: "secondary-playlist-panel",
          name: "Active playlist panel",
          selector: "ytd-playlist-panel-renderer",
        },
        {
          id: "secondary-radio-card",
          name: "Mix / radio cards",
          selector: "ytd-compact-radio-renderer",
        },
        {
          id: "secondary-movie-card",
          name: "Movie cards",
          selector: "ytd-compact-movie-renderer",
        },
        {
          id: "secondary-merch",
          name: "Merch shelf",
          selector: "ytd-merch-shelf-renderer",
        },
        {
          id: "secondary-ads",
          name: "Right column ads",
          selector:
            "ytd-watch-next-secondary-results-renderer ytd-ad-slot-renderer, #player-ads",
        },
        {
          id: "secondary-promoted",
          name: "Promoted cards",
          selector: "ytd-promoted-sparkles-web-renderer",
        },
        {
          id: "secondary-chat",
          name: "Live chat frame",
          selector: "ytd-live-chat-frame, #chat",
        },
      ],
    },
    {
      group: "Player chrome",
      items: [
        {
          id: "player",
          name: "Entire player",
          selector: "#movie_player, ytd-player, .html5-video-player",
        },
        {
          id: "player-video",
          name: "Video element only",
          selector: "video.html5-main-video",
        },
        {
          id: "player-chrome-top",
          name: "Top overlay bar",
          selector: ".ytp-chrome-top",
        },
        {
          id: "player-title-overlay",
          name: "Title overlay (top)",
          selector: ".ytp-chrome-top .ytp-title",
        },
        {
          id: "player-channel-link",
          name: "Channel link overlay",
          selector: ".ytp-title-channel",
        },
        {
          id: "player-share-button",
          name: "Share button overlay",
          selector: ".ytp-share-button",
        },
        {
          id: "player-more-options",
          name: "More options menu (top)",
          selector: ".ytp-overflow-button",
        },
        {
          id: "player-endscreen",
          name: "End-screen suggestions",
          selector: ".ytp-ce-element, .ytp-endscreen-content",
        },
        {
          id: "player-endscreen-pause",
          name: "Pause-screen suggestions",
          selector: ".ytp-pause-overlay",
        },
        {
          id: "player-cards",
          name: "Info cards (i) teaser",
          selector: ".ytp-cards-button, .ytp-cards-teaser-text",
        },
        {
          id: "player-cards-icon",
          name: "Info card icon only",
          selector: ".ytp-cards-button-icon",
        },
        {
          id: "player-watermark",
          name: "Channel watermark",
          selector: ".ytp-watermark, .annotation",
        },
        {
          id: "player-prevbtn",
          name: "Previous video button",
          selector: ".ytp-prev-button",
        },
        {
          id: "player-playbtn",
          name: "Play/Pause button",
          selector: ".ytp-play-button",
        },
        {
          id: "player-nextbtn",
          name: "Next video button",
          selector: ".ytp-next-button",
        },
        {
          id: "player-autoplay",
          name: "Autoplay toggle button",
          selector: ".ytp-autonav-toggle-button-container",
        },
        {
          id: "player-miniplayer",
          name: "Miniplayer button",
          selector: ".ytp-miniplayer-button",
        },
        {
          id: "player-size",
          name: "Theater/default size button",
          selector: ".ytp-size-button",
        },
        {
          id: "player-fullscreen",
          name: "Fullscreen button",
          selector: ".ytp-fullscreen-button",
        },
        {
          id: "player-remote",
          name: "Cast / remote button",
          selector: ".ytp-remote-button",
        },
        {
          id: "player-subtitles",
          name: "Subtitles / CC button",
          selector: ".ytp-subtitles-button",
        },
        {
          id: "player-settings",
          name: "Settings cog button",
          selector: ".ytp-settings-button",
        },
        {
          id: "player-pip-native",
          name: "Picture-in-picture button",
          selector: ".ytp-pip-button",
        },
        {
          id: "player-volume-area",
          name: "Volume slider area",
          selector: ".ytp-volume-area",
        },
        {
          id: "player-mute-button",
          name: "Mute button only",
          selector: ".ytp-mute-button",
        },
        {
          id: "player-volume-slider",
          name: "Volume slider only",
          selector: ".ytp-volume-slider, .ytp-volume-panel",
        },
        {
          id: "player-time",
          name: "Time display",
          selector: ".ytp-time-display",
        },
        {
          id: "player-time-current",
          name: "Current time only",
          selector: ".ytp-time-current",
        },
        {
          id: "player-time-duration",
          name: "Duration only",
          selector: ".ytp-time-duration",
        },
        {
          id: "player-time-separator",
          name: "Time separator (/)",
          selector: ".ytp-time-separator",
        },
        {
          id: "player-live-badge",
          name: "Live badge",
          selector: ".ytp-live, .ytp-live-badge",
        },
        {
          id: "player-progress",
          name: "Progress / seek bar",
          selector: ".ytp-progress-bar-container",
        },
        {
          id: "player-progress-list",
          name: "Progress list area",
          selector: ".ytp-progress-list",
        },
        {
          id: "player-chapter-ticks",
          name: "Chapter ticks on bar",
          selector: ".ytp-chapter-hover-container",
        },
        {
          id: "player-chapter-title",
          name: "Chapter title on bar",
          selector: ".ytp-chapter-title",
        },
        {
          id: "player-tooltip",
          name: "Seek bar preview tooltip",
          selector: ".ytp-tooltip",
        },
        {
          id: "player-preview-image",
          name: "Seek bar preview thumbnail",
          selector: ".ytp-preview, .ytp-tooltip-image",
        },
        {
          id: "player-bezel",
          name: "Bezel feedback (10s skip etc)",
          selector: ".ytp-bezel",
        },
        {
          id: "player-gradient-bottom",
          name: "Bottom gradient overlay",
          selector: ".ytp-gradient-bottom",
        },
        {
          id: "player-gradient-top",
          name: "Top gradient overlay",
          selector: ".ytp-gradient-top",
        },
        {
          id: "player-spinner",
          name: "Loading spinner",
          selector: ".ytp-spinner",
        },
        {
          id: "player-error",
          name: "Player error message",
          selector: ".ytp-error",
        },
        {
          id: "player-context-menu",
          name: "Right-click menu",
          selector: ".ytp-popup.ytp-contextmenu",
        },
        {
          id: "player-settings-menu",
          name: "Settings panel popup",
          selector: ".ytp-settings-menu, .ytp-popup.ytp-settings-menu",
        },
        {
          id: "player-quality-menu",
          name: "Quality submenu",
          selector: ".ytp-quality-menu",
        },
        {
          id: "player-ad-overlay",
          name: "Overlay ads on video",
          selector: ".ytp-ad-overlay-container, .ytp-ad-text-overlay",
        },
        {
          id: "player-ad-image",
          name: "Image ad overlay",
          selector: ".ytp-ad-image-overlay",
        },
        {
          id: "player-ad-skip",
          name: "Skip ad button",
          selector:
            ".ytp-ad-skip-button-modern, .ytp-ad-skip-button, .ytp-skip-ad-button",
        },
        {
          id: "player-ad-skip-container",
          name: "Skip ad container",
          selector: ".ytp-ad-skip-button-container, .ytp-ad-skip-button-slot",
        },
        {
          id: "player-ad-preview",
          name: "Ad preview countdown",
          selector: ".ytp-ad-preview-container, .ytp-ad-preview-text",
        },
        {
          id: "player-ad-duration",
          name: "Ad duration remaining",
          selector: ".ytp-ad-duration-remaining",
        },
        {
          id: "player-ad-info",
          name: "Ad info / Why this ad",
          selector: ".ytp-ad-info-dialog-container, .ytp-ad-button",
        },
        {
          id: "player-ad-visit-advertiser",
          name: "Visit advertiser button",
          selector: ".ytp-ad-visit-advertiser-button",
        },
        {
          id: "player-ad-channel-card",
          name: "Ad channel card",
          selector:
            ".ytp-ad-player-overlay-instream-info, .ytp-ad-player-overlay-flyout-cta",
        },
        {
          id: "player-ad-survey",
          name: "Ad survey question",
          selector: ".ytp-ad-survey",
        },
        {
          id: "player-ambient-yt",
          name: "Native ambient mode glow",
          selector: "#cinematics, #cinematics-container, .ytp-cinematic-effect",
        },
        {
          id: "player-stats-debug",
          name: "Stats for nerds overlay",
          selector: ".html5-video-info-panel",
        },
      ],
    },
    {
      group: "Comments",
      items: [
        {
          id: "comments",
          name: "Entire comments section",
          selector: "#comments, ytd-comments",
        },
        {
          id: "comments-header",
          name: "Header (count + sort)",
          selector: "ytd-comments-header-renderer",
        },
        {
          id: "comments-count",
          name: "Comment count only",
          selector: "ytd-comments-header-renderer #count",
        },
        {
          id: "comments-sort",
          name: "Sort menu",
          selector:
            "ytd-comments-header-renderer #sort-menu, ytd-sort-filter-sub-menu-renderer",
        },
        {
          id: "comments-input",
          name: "Add a comment box",
          selector: "ytd-comments #simple-box, ytd-comment-simplebox-renderer",
        },
        {
          id: "comments-input-avatar",
          name: "Your avatar in input",
          selector: "ytd-comment-simplebox-renderer #author-thumbnail",
        },
        {
          id: "comments-input-placeholder",
          name: "'Add a comment' placeholder",
          selector: "ytd-comment-simplebox-renderer #placeholder-area",
        },
        {
          id: "comments-thread",
          name: "All comment threads",
          selector: "ytd-comment-thread-renderer",
        },
        {
          id: "comments-pinned",
          name: "Pinned comment",
          selector: "ytd-comment-thread-renderer:has(#pinned-comment-badge)",
        },
        {
          id: "comments-author",
          name: "Comment author names",
          selector: "ytd-comment-renderer #author-text",
        },
        {
          id: "comments-author-avatar",
          name: "Comment avatars",
          selector: "ytd-comment-renderer #author-thumbnail",
        },
        {
          id: "comments-text",
          name: "Comment text body",
          selector: "ytd-comment-renderer #content-text",
        },
        {
          id: "comments-timestamp",
          name: "Comment timestamps",
          selector: "ytd-comment-renderer #published-time-text",
        },
        {
          id: "comments-action-buttons",
          name: "Comment action row",
          selector: "ytd-comment-action-buttons-renderer",
        },
        {
          id: "comments-like",
          name: "Comment like button",
          selector: "ytd-comment-action-buttons-renderer #like-button",
        },
        {
          id: "comments-dislike",
          name: "Comment dislike button",
          selector: "ytd-comment-action-buttons-renderer #dislike-button",
        },
        {
          id: "comments-reply-btn",
          name: "Reply button",
          selector: "ytd-comment-action-buttons-renderer #reply-button",
        },
        {
          id: "comments-replies-section",
          name: "Replies sub-thread",
          selector: "ytd-comment-replies-renderer",
        },
        {
          id: "comments-show-replies",
          name: "Show/hide replies link",
          selector:
            "ytd-comment-replies-renderer #more-replies, ytd-comment-replies-renderer #less-replies",
        },
        {
          id: "comments-creator-heart",
          name: "Creator heart badge",
          selector: "ytd-creator-heart-renderer",
        },
        {
          id: "comments-creator-reply-badge",
          name: "Creator badge on replies",
          selector: "ytd-author-comment-badge-renderer",
        },
        {
          id: "comments-pinned-badge",
          name: "Pinned badge",
          selector: "#pinned-comment-badge",
        },
        {
          id: "comments-emoji-picker",
          name: "Emoji picker button",
          selector: "ytd-comment-simplebox-renderer #emoji-button",
        },
        {
          id: "comments-disabled-msg",
          name: "Comments disabled message",
          selector:
            "ytd-message-renderer:has(yt-formatted-string:contains('Comments are turned off'))",
        },
      ],
    },
    {
      group: "Live chat",
      items: [
        {
          id: "livechat",
          name: "Entire live chat panel",
          selector: "ytd-live-chat-frame, yt-live-chat-app",
        },
        {
          id: "livechat-header",
          name: "Chat header bar",
          selector: "yt-live-chat-header-renderer",
        },
        {
          id: "livechat-collapse-btn",
          name: "Collapse / popout button",
          selector: "ytd-live-chat-frame #show-hide-button",
        },
        {
          id: "livechat-mode-switch",
          name: "Top chat / Live chat switch",
          selector:
            "yt-live-chat-header-renderer yt-sort-filter-sub-menu-renderer",
        },
        {
          id: "livechat-input",
          name: "Chat input box",
          selector: "yt-live-chat-message-input-renderer, #input-panel",
        },
        {
          id: "livechat-input-avatar",
          name: "Your avatar in chat input",
          selector: "yt-live-chat-message-input-renderer #author-photo",
        },
        {
          id: "livechat-send-btn",
          name: "Send button",
          selector: "yt-live-chat-message-input-renderer #send-button",
        },
        {
          id: "livechat-emoji-btn",
          name: "Emoji picker button",
          selector: "yt-live-chat-message-input-renderer #emoji-button",
        },
        {
          id: "livechat-superchat-btn",
          name: "Super Chat button",
          selector: "yt-live-chat-message-input-renderer #product-picker",
        },
        {
          id: "livechat-messages",
          name: "Chat message list",
          selector: "yt-live-chat-item-list-renderer",
        },
        {
          id: "livechat-text-msg",
          name: "Individual text messages",
          selector: "yt-live-chat-text-message-renderer",
        },
        {
          id: "livechat-membership",
          name: "Membership join messages",
          selector: "yt-live-chat-membership-item-renderer",
        },
        {
          id: "livechat-superchat-msg",
          name: "Super Chat messages",
          selector: "yt-live-chat-paid-message-renderer",
        },
        {
          id: "livechat-sticker",
          name: "Super Stickers",
          selector: "yt-live-chat-paid-sticker-renderer",
        },
        {
          id: "livechat-ticker",
          name: "Super Chat ticker (top)",
          selector: "yt-live-chat-ticker-renderer",
        },
        {
          id: "livechat-engagement",
          name: "Engagement message (welcome etc)",
          selector: "yt-live-chat-viewer-engagement-message-renderer",
        },
        {
          id: "livechat-system-msg",
          name: "System messages",
          selector: "yt-live-chat-banner-manager",
        },
        {
          id: "livechat-popout-btn",
          name: "Popout button",
          selector: "yt-live-chat-header-renderer yt-icon-button",
        },
        {
          id: "livechat-policy",
          name: "Chat policy notice",
          selector: "yt-live-chat-policy-link",
        },
      ],
    },
    {
      group: "Channel page",
      items: [
        {
          id: "channel-page",
          name: "Entire channel page",
          selector: "ytd-browse[page-subtype='channels']",
        },
        {
          id: "channel-banner",
          name: "Banner image",
          selector:
            "ytd-c4-tabbed-header-renderer #banner, yt-page-header-renderer #page-header-banner, yt-image-banner-view-model",
        },
        {
          id: "channel-header",
          name: "Header section",
          selector: "ytd-c4-tabbed-header-renderer, yt-page-header-renderer",
        },
        {
          id: "channel-avatar",
          name: "Channel avatar",
          selector:
            "ytd-c4-tabbed-header-renderer #avatar, yt-page-header-renderer yt-avatar-shape",
        },
        {
          id: "channel-name",
          name: "Channel name + handle",
          selector:
            "ytd-c4-tabbed-header-renderer #channel-name, yt-page-header-renderer yt-dynamic-text-view-model",
        },
        {
          id: "channel-handle",
          name: "@handle only",
          selector:
            "yt-page-header-renderer yt-content-metadata-view-model span:first-child",
        },
        {
          id: "channel-subs-count",
          name: "Subscriber count",
          selector:
            "ytd-c4-tabbed-header-renderer #subscriber-count, yt-page-header-renderer yt-content-metadata-view-model",
        },
        {
          id: "channel-video-count",
          name: "Video count",
          selector:
            "yt-page-header-renderer yt-content-metadata-view-model span:contains('video')",
        },
        {
          id: "channel-description-short",
          name: "Short description below name",
          selector: "yt-page-header-renderer yt-description-preview-view-model",
        },
        {
          id: "channel-subscribe",
          name: "Subscribe button",
          selector:
            "ytd-c4-tabbed-header-renderer ytd-subscribe-button-renderer, yt-page-header-renderer yt-subscribe-button-view-model",
        },
        {
          id: "channel-join",
          name: "Join button",
          selector: "ytd-c4-tabbed-header-renderer #sponsor-button",
        },
        {
          id: "channel-share-btn",
          name: "Share button",
          selector:
            "ytd-c4-tabbed-header-renderer yt-button-view-model:has(button[aria-label*='hare'])",
        },
        {
          id: "channel-tabs",
          name: "Tab bar (Home/Videos/Shorts/...)",
          selector:
            "ytd-c4-tabbed-header-renderer #tabs-container, yt-tab-group-shape, tp-yt-paper-tabs",
        },
        {
          id: "channel-tab-home",
          name: "Home tab",
          selector: "tp-yt-paper-tab:nth-of-type(1)",
        },
        {
          id: "channel-tab-videos",
          name: "Videos tab",
          selector:
            "tp-yt-paper-tab[tab-title='Videos'], yt-tab-shape[tab-title='Videos']",
        },
        {
          id: "channel-tab-shorts",
          name: "Shorts tab",
          selector:
            "tp-yt-paper-tab[tab-title='Shorts'], yt-tab-shape[tab-title='Shorts']",
        },
        {
          id: "channel-tab-live",
          name: "Live tab",
          selector:
            "tp-yt-paper-tab[tab-title='Live'], yt-tab-shape[tab-title='Live']",
        },
        {
          id: "channel-tab-playlists",
          name: "Playlists tab",
          selector:
            "tp-yt-paper-tab[tab-title='Playlists'], yt-tab-shape[tab-title='Playlists']",
        },
        {
          id: "channel-tab-community",
          name: "Community tab",
          selector:
            "tp-yt-paper-tab[tab-title='Community'], yt-tab-shape[tab-title='Community']",
        },
        {
          id: "channel-tab-about",
          name: "About tab",
          selector:
            "tp-yt-paper-tab[tab-title='About'], yt-tab-shape[tab-title='About']",
        },
        {
          id: "channel-tab-store",
          name: "Store tab",
          selector:
            "tp-yt-paper-tab[tab-title='Store'], yt-tab-shape[tab-title='Store']",
        },
        {
          id: "channel-description-full",
          name: "About / description section",
          selector: "ytd-channel-about-metadata-renderer",
        },
        {
          id: "channel-links",
          name: "Channel links (social/website)",
          selector:
            "ytd-channel-external-link-view-model, ytd-channel-external-link-renderer",
        },
        {
          id: "channel-stats",
          name: "Channel stats (joined, views)",
          selector: "ytd-channel-about-metadata-renderer yt-formatted-string",
        },
        {
          id: "channel-trailer",
          name: "Featured video / trailer",
          selector: "ytd-channel-video-player-renderer",
        },
        {
          id: "channel-featured-channels",
          name: "Featured channels shelf",
          selector:
            "ytd-channel-featured-content-renderer ytd-channel-renderer",
        },
        {
          id: "channel-shelves",
          name: "Video section shelves",
          selector:
            "ytd-channel-featured-content-renderer, ytd-item-section-renderer",
        },
        {
          id: "channel-shelf-titles",
          name: "Shelf titles",
          selector: "ytd-shelf-renderer #title-container",
        },
        {
          id: "channel-community-post",
          name: "Community posts",
          selector: "ytd-backstage-post-thread-renderer, ytd-post-renderer",
        },
      ],
    },
    {
      group: "Search results",
      items: [
        {
          id: "search-page",
          name: "Entire search results page",
          selector: "ytd-search",
        },
        {
          id: "search-chips",
          name: "Filter chips bar",
          selector: "ytd-search ytd-feed-filter-chip-bar-renderer",
        },
        {
          id: "search-filter-btn",
          name: "Filters button",
          selector:
            "ytd-search-header-renderer button, ytd-search-filter-renderer",
        },
        {
          id: "search-sub-menu",
          name: "Filter sub-menus",
          selector: "ytd-search-sub-menu-renderer",
        },
        {
          id: "search-result-count",
          name: "Result count",
          selector: "ytd-search ytd-results-count-renderer",
        },
        {
          id: "search-video-card",
          name: "Video result cards",
          selector: "ytd-search ytd-video-renderer",
        },
        {
          id: "search-video-thumb",
          name: "Video result thumbnails",
          selector: "ytd-search ytd-video-renderer ytd-thumbnail",
        },
        {
          id: "search-video-title",
          name: "Video result titles",
          selector: "ytd-search ytd-video-renderer #video-title",
        },
        {
          id: "search-video-desc",
          name: "Video result descriptions",
          selector: "ytd-search ytd-video-renderer #description-text",
        },
        {
          id: "search-channel-card",
          name: "Channel result cards",
          selector: "ytd-search ytd-channel-renderer",
        },
        {
          id: "search-channel-subscribe",
          name: "Channel result subscribe btn",
          selector:
            "ytd-search ytd-channel-renderer ytd-subscribe-button-renderer",
        },
        {
          id: "search-playlist-card",
          name: "Playlist result cards",
          selector: "ytd-search ytd-playlist-renderer",
        },
        {
          id: "search-radio-card",
          name: "Radio / mix result cards",
          selector: "ytd-search ytd-radio-renderer",
        },
        {
          id: "search-shorts-shelf",
          name: "Shorts shelf",
          selector: "ytd-search ytd-reel-shelf-renderer",
        },
        {
          id: "search-people-also",
          name: "'People also watched' shelf",
          selector: "ytd-search ytd-shelf-renderer",
        },
        {
          id: "search-related-search",
          name: "Related searches",
          selector:
            "ytd-horizontal-card-list-renderer:has(yt-formatted-string:contains('searched'))",
        },
        {
          id: "search-ads",
          name: "Ads in search results",
          selector:
            "ytd-search ytd-ad-slot-renderer, ytd-search ytd-promoted-sparkles-web-renderer",
        },
        {
          id: "search-pyv",
          name: "Promoted Yahoo / Google ad cards",
          selector: "ytd-search ytd-promoted-video-renderer",
        },
        {
          id: "search-show-more",
          name: "Show more results button",
          selector: "ytd-search ytd-continuation-item-renderer",
        },
      ],
    },
    {
      group: "Shorts page",
      items: [
        {
          id: "shorts-page",
          name: "Entire Shorts player",
          selector: "ytd-shorts",
        },
        {
          id: "shorts-player",
          name: "Active Shorts video element",
          selector: "ytd-reel-video-renderer[is-active] video",
        },
        {
          id: "shorts-overlay-container",
          name: "Right action column",
          selector: "ytd-reel-player-overlay-renderer #actions",
        },
        {
          id: "shorts-like-btn",
          name: "Like button",
          selector: "ytd-reel-player-overlay-renderer #like-button",
        },
        {
          id: "shorts-dislike-btn",
          name: "Dislike button",
          selector: "ytd-reel-player-overlay-renderer #dislike-button",
        },
        {
          id: "shorts-comment-btn",
          name: "Comment button",
          selector: "ytd-reel-player-overlay-renderer #comments-button",
        },
        {
          id: "shorts-share-btn",
          name: "Share button",
          selector: "ytd-reel-player-overlay-renderer #share-button",
        },
        {
          id: "shorts-remix-btn",
          name: "Remix button",
          selector: "ytd-reel-player-overlay-renderer #remix-button",
        },
        {
          id: "shorts-more-btn",
          name: "More options button",
          selector: "ytd-reel-player-overlay-renderer #menu-button",
        },
        {
          id: "shorts-channel-bar",
          name: "Channel + subscribe bar",
          selector:
            "ytd-reel-player-overlay-renderer .reel-player-header-renderer",
        },
        {
          id: "shorts-channel-avatar",
          name: "Channel avatar (Shorts)",
          selector: "ytd-reel-player-overlay-renderer #channel-avatar",
        },
        {
          id: "shorts-channel-name",
          name: "Channel name (Shorts)",
          selector: "ytd-reel-player-overlay-renderer #channel-name",
        },
        {
          id: "shorts-subscribe-btn",
          name: "Subscribe button (Shorts)",
          selector:
            "ytd-reel-player-overlay-renderer ytd-subscribe-button-renderer",
        },
        {
          id: "shorts-title",
          name: "Title / caption overlay",
          selector: "ytd-reel-player-overlay-renderer #overlay #title",
        },
        {
          id: "shorts-description",
          name: "Description overlay",
          selector: "ytd-reel-player-overlay-renderer #overlay",
        },
        {
          id: "shorts-comments-panel",
          name: "Comments side panel",
          selector:
            "ytd-engagement-panel-section-list-renderer[target-id='shorts-engagement-panel-comments-section']",
        },
        {
          id: "shorts-audio-pivot",
          name: "Sound / music pivot button",
          selector: "ytd-reel-audio-pivot-button-renderer",
        },
        {
          id: "shorts-nav-prev",
          name: "Previous Short button",
          selector: "ytd-shorts #navigation-button-up",
        },
        {
          id: "shorts-nav-next",
          name: "Next Short button",
          selector: "ytd-shorts #navigation-button-down",
        },
        {
          id: "shorts-progress-bar",
          name: "Mini progress bar",
          selector: "ytd-shorts .reel-progress-bar",
        },
      ],
    },
    {
      group: "Playlist page",
      items: [
        {
          id: "playlist-header",
          name: "Playlist header (title/desc/buttons)",
          selector: "ytd-playlist-header-renderer",
        },
        {
          id: "playlist-title",
          name: "Playlist title",
          selector: "ytd-playlist-header-renderer #title",
        },
        {
          id: "playlist-meta",
          name: "Playlist metadata (views, date)",
          selector: "ytd-playlist-header-renderer #stats",
        },
        {
          id: "playlist-description",
          name: "Playlist description",
          selector: "ytd-playlist-header-renderer #description",
        },
        {
          id: "playlist-creator",
          name: "Playlist creator info",
          selector: "ytd-playlist-header-renderer #owner-text",
        },
        {
          id: "playlist-sidebar",
          name: "Playlist panel sidebar",
          selector: "ytd-playlist-sidebar-renderer",
        },
        {
          id: "playlist-thumb",
          name: "Playlist big thumbnail",
          selector: "ytd-playlist-sidebar-primary-info-renderer #thumbnail",
        },
        {
          id: "playlist-save-btn",
          name: "Save playlist button",
          selector:
            "ytd-playlist-header-renderer ytd-button-renderer:has(yt-icon-shape)",
        },
        {
          id: "playlist-share-btn",
          name: "Share playlist button",
          selector:
            "ytd-playlist-header-renderer yt-button-view-model:has(button[aria-label*='hare'])",
        },
        {
          id: "playlist-play-all",
          name: "Play all button",
          selector: "ytd-playlist-header-renderer .play-all-button",
        },
        {
          id: "playlist-shuffle",
          name: "Shuffle button",
          selector: "ytd-playlist-header-renderer .shuffle-button",
        },
        {
          id: "playlist-videos-list",
          name: "Video entries list",
          selector: "ytd-playlist-video-list-renderer",
        },
        {
          id: "playlist-video-row",
          name: "Individual video rows",
          selector: "ytd-playlist-video-renderer",
        },
        {
          id: "playlist-video-index",
          name: "Row index numbers",
          selector: "ytd-playlist-video-renderer #index",
        },
        {
          id: "playlist-video-thumb",
          name: "Row thumbnails",
          selector: "ytd-playlist-video-renderer ytd-thumbnail",
        },
        {
          id: "playlist-video-title",
          name: "Row titles",
          selector: "ytd-playlist-video-renderer #video-title",
        },
        {
          id: "playlist-video-channel",
          name: "Row channel names",
          selector: "ytd-playlist-video-renderer ytd-channel-name",
        },
        {
          id: "playlist-video-menu",
          name: "Row 3-dot menus",
          selector: "ytd-playlist-video-renderer ytd-menu-renderer",
        },
        {
          id: "playlist-currently-playing",
          name: "Currently playing marker",
          selector: "ytd-playlist-panel-video-renderer[selected]",
        },
      ],
    },
    {
      group: "Popups & modals",
      items: [
        {
          id: "popup-container",
          name: "All popup containers",
          selector: "ytd-popup-container",
        },
        {
          id: "popup-menu",
          name: "Context menus (right-click)",
          selector: "tp-yt-iron-dropdown, ytd-menu-popup-renderer",
        },
        {
          id: "popup-share",
          name: "Share dialog",
          selector: "ytd-unified-share-panel-renderer",
        },
        {
          id: "popup-share-targets",
          name: "Share targets grid",
          selector: "ytd-unified-share-panel-renderer #social-actions",
        },
        {
          id: "popup-share-url",
          name: "Share copy-URL field",
          selector: "ytd-unified-share-panel-renderer #share-url",
        },
        {
          id: "popup-notify",
          name: "Notification popup panel",
          selector:
            "ytd-multi-page-menu-renderer:has(ytd-notification-renderer)",
        },
        {
          id: "popup-notify-item",
          name: "Individual notifications",
          selector: "ytd-notification-renderer",
        },
        {
          id: "popup-account-menu",
          name: "Account dropdown menu",
          selector:
            "ytd-multi-page-menu-renderer:not(:has(ytd-notification-renderer))",
        },
        {
          id: "popup-miniplayer",
          name: "Miniplayer bar (bottom)",
          selector: "ytd-miniplayer",
        },
        {
          id: "popup-miniplayer-close",
          name: "Miniplayer close button",
          selector: "ytd-miniplayer .ytp-miniplayer-close-button",
        },
        {
          id: "popup-toast",
          name: "YouTube native toasts",
          selector: "yt-notification-action-renderer, tp-yt-paper-toast",
        },
        {
          id: "popup-confirm-dialog",
          name: "Confirm dialogs",
          selector:
            "tp-yt-paper-dialog.yt-confirm-dialog-renderer, yt-confirm-dialog-renderer",
        },
        {
          id: "popup-save-to-playlist",
          name: "Save-to-playlist popup",
          selector: "ytd-add-to-playlist-renderer",
        },
        {
          id: "popup-report-form",
          name: "Report video form",
          selector: "ytd-report-form-renderer",
        },
        {
          id: "popup-clip-creation",
          name: "Clip creation panel",
          selector: "ytd-engagement-panel-clip-create-renderer",
        },
        {
          id: "popup-download-quality",
          name: "Download quality selector",
          selector: "ytd-download-quality-selector-renderer",
        },
      ],
    },
    {
      group: "Global / sitewide",
      items: [
        {
          id: "global-consent-banner",
          name: "Cookie consent banner",
          selector:
            "ytd-consent-bump-v2-lightbox, tp-yt-paper-dialog.ytd-consent-bump-v2-lightbox",
        },
        {
          id: "global-consent-bump",
          name: "Privacy reminder bump",
          selector: "ytd-privacy-message-renderer",
        },
        {
          id: "global-survey",
          name: "Survey / feedback prompts",
          selector:
            "ytd-popup-container ytd-single-option-survey-renderer, ytd-enforcement-message-view-model",
        },
        {
          id: "global-promo-banner",
          name: "Premium / promo banners",
          selector:
            "ytd-banner-promo-renderer, ytd-background-promo-renderer, ytd-mealbar-promo-renderer",
        },
        {
          id: "global-premium-prompt",
          name: "Premium upgrade prompt",
          selector:
            "ytd-popup-container ytd-popup-renderer[id='subscribe-button']",
        },
        {
          id: "global-guide-signin",
          name: "Sign-in prompts in sidebar",
          selector: "ytd-guide-signin-promo-renderer",
        },
        {
          id: "global-ticker",
          name: "Ticker / shelf above feed",
          selector: "ytd-rich-shelf-renderer:first-of-type",
        },
        {
          id: "global-adblock-msg",
          name: "Adblock detection message",
          selector: "ytd-enforcement-message-view-model",
        },
        {
          id: "global-age-restriction",
          name: "Age restriction overlay",
          selector: "ytd-age-restriction-bypass-renderer",
        },
        {
          id: "global-error-state",
          name: "Empty/error states",
          selector: "yt-page-error-view-model",
        },
        {
          id: "global-loading-spinner",
          name: "Page loading spinner",
          selector: "tp-yt-paper-spinner-lite",
        },
        {
          id: "global-progress-bar",
          name: "Top page progress bar",
          selector: "yt-page-navigation-progress",
        },
      ],
    },
    {
      group: "History / Library",
      items: [
        {
          id: "lib-page",
          name: "Library page",
          selector: "ytd-browse[page-subtype='library']",
        },
        {
          id: "lib-history-page",
          name: "History page",
          selector: "ytd-browse[page-subtype='history']",
        },
        {
          id: "lib-history-search",
          name: "History search box",
          selector: "ytd-search-header-renderer",
        },
        {
          id: "lib-history-clear",
          name: "Clear all history button",
          selector:
            "ytd-button-renderer:has(yt-formatted-string:contains('Clear all watch history'))",
        },
        {
          id: "lib-history-pause",
          name: "Pause history toggle",
          selector: "ytd-toggle-button-renderer",
        },
        {
          id: "lib-history-controls",
          name: "History controls sidebar",
          selector: "ytd-browse[page-subtype='history'] #secondary",
        },
        {
          id: "lib-watch-later",
          name: "Watch later section",
          selector:
            "ytd-browse[page-subtype='playlist'] ytd-playlist-header-renderer",
        },
      ],
    },
    {
      group: "Trending / Explore",
      items: [
        {
          id: "trending-page",
          name: "Trending page",
          selector: "ytd-browse[page-subtype='trending']",
        },
        {
          id: "trending-tabs",
          name: "Trending tabs (Now/Music/Gaming...)",
          selector: "ytd-browse[page-subtype='trending'] tp-yt-paper-tabs",
        },
        {
          id: "trending-shelf-header",
          name: "Trending shelf headers",
          selector: "ytd-browse[page-subtype='trending'] ytd-shelf-renderer",
        },
      ],
    },
  ];
  (Object.freeze(fo),
    fo.forEach(function (e) {
      (Object.freeze(e),
        Object.freeze(e.items),
        e.items.forEach(Object.freeze));
    }));
  const bo = [
    {
      id: "minimal-clean",
      name: "Minimal Clean",
      desc: "Strip clutter: no chips, no endscreen, no watermark, no cards, no ads.",
      hidden: {
        "home-chips": !0,
        "home-ads": !0,
        "home-thumbnails-hover": !0,
        "player-endscreen": !0,
        "player-cards": !0,
        "player-watermark": !0,
        "player-autoplay": !0,
        "player-miniplayer": !0,
        "player-ad-overlay": !0,
        "player-ad-info": !0,
        "secondary-ads": !0,
        "secondary-autoplay": !0,
        "secondary-promoted": !0,
        "comments-input": !0,
        "global-promo-banner": !0,
        "global-survey": !0,
        "global-consent-banner": !0,
        "search-ads": !0,
      },
    },
    {
      id: "distraction-free",
      name: "Distraction Free",
      desc: "Watch-focused: hide right column, comments, endscreen, chat, all ads.",
      hidden: {
        "home-chips": !0,
        "home-shorts": !0,
        "home-ads": !0,
        "home-thumbnails-hover": !0,
        secondary: !0,
        comments: !0,
        "player-endscreen": !0,
        "player-cards": !0,
        "player-watermark": !0,
        "player-autoplay": !0,
        "player-nextbtn": !0,
        "player-miniplayer": !0,
        "player-ad-overlay": !0,
        "player-ad-info": !0,
        livechat: !0,
        "search-shorts-shelf": !0,
        "search-ads": !0,
        "global-promo-banner": !0,
        "global-survey": !0,
        "global-consent-banner": !0,
        "secondary-promoted": !0,
        "secondary-merch": !0,
      },
    },
    {
      id: "ultra-minimal",
      name: "Ultra Minimal",
      desc: "Bare minimum UI: no masthead, no sidebar, no comments, no right column.",
      hidden: {
        masthead: !0,
        sidebar: !0,
        "home-chips": !0,
        "home-shorts": !0,
        "home-ads": !0,
        "home-thumbnails-hover": !0,
        secondary: !0,
        comments: !0,
        "player-endscreen": !0,
        "player-cards": !0,
        "player-watermark": !0,
        "player-autoplay": !0,
        "player-nextbtn": !0,
        "player-miniplayer": !0,
        "player-topbar": !0,
        "player-ad-overlay": !0,
        "player-ad-info": !0,
        livechat: !0,
        "search-chips": !0,
        "search-shorts-shelf": !0,
        "search-ads": !0,
        "global-promo-banner": !0,
        "global-survey": !0,
        "global-consent-banner": !0,
        "global-guide-signin": !0,
      },
    },
    {
      id: "no-shorts",
      name: "No Shorts Anywhere",
      desc: "Remove every Shorts shelf, entry, and page across the site.",
      hidden: {
        "home-shorts": !0,
        "sidebar-shorts-entry": !0,
        "search-shorts-shelf": !0,
        "shorts-page": !0,
      },
    },
    {
      id: "no-ads-anywhere",
      name: "Ad-Free Layout",
      desc: "Hide every ad slot, promo banner, and sponsored placement.",
      hidden: {
        "home-ads": !0,
        "secondary-ads": !0,
        "secondary-promoted": !0,
        "secondary-merch": !0,
        "player-ad-overlay": !0,
        "player-ad-info": !0,
        "search-ads": !0,
        "global-promo-banner": !0,
        "global-consent-banner": !0,
        "global-survey": !0,
      },
    },
    {
      id: "cinema-focus",
      name: "Cinema Focus",
      desc: "Full immersion: hide masthead, sidebar, right column, comments, overlays.",
      hidden: {
        masthead: !0,
        sidebar: !0,
        secondary: !0,
        comments: !0,
        "player-endscreen": !0,
        "player-cards": !0,
        "player-watermark": !0,
        "player-autoplay": !0,
        "player-miniplayer": !0,
        "player-topbar": !0,
        "player-ad-overlay": !0,
        "player-ad-info": !0,
        livechat: !0,
        "global-promo-banner": !0,
      },
    },
    {
      id: "streamer-view",
      name: "Streamer / Recording View",
      desc: "Clean player for recording: no overlays, no watermark, no button clutter.",
      hidden: {
        "player-endscreen": !0,
        "player-cards": !0,
        "player-watermark": !0,
        "player-nextbtn": !0,
        "player-prevbtn": !0,
        "player-autoplay": !0,
        "player-miniplayer": !0,
        "player-settings": !0,
        "player-subtitles": !0,
        "player-pip-native": !0,
        "player-topbar": !0,
        "player-tooltip": !0,
        "player-ad-overlay": !0,
        "player-ad-info": !0,
        "masthead-notif": !0,
        "masthead-avatar": !0,
      },
    },
    {
      id: "reset-all",
      name: "Reset (Show Everything)",
      desc: "Un-hide all elements, restoring YouTube default layout.",
      hidden: {},
    },
  ];
  (Object.freeze(bo),
    bo.forEach(function (e) {
      (Object.freeze(e), Object.freeze(e.hidden));
    }));
  let vo = null;
  function ko(e) {
    if ((xo(), !e || !document.body)) return;
    let t;
    try {
      t = Array.from(document.querySelectorAll(e));
    } catch (e) {
      return;
    }
    if (!t.length) return;
    const a = document.createElement("div");
    ((a.id = "ytp-elem-hover"),
      (a.style.cssText =
        "position:fixed;inset:0;z-index:2147483640;pointer-events:none"));
    for (const e of t) {
      let t;
      try {
        t = e.getBoundingClientRect();
      } catch (e) {
        continue;
      }
      if (!t || (0 === t.width && 0 === t.height)) continue;
      const n = document.createElement("div");
      ((n.style.cssText =
        "position:fixed;border:2px solid #3ea6ff;background:rgba(62,166,255,.15);border-radius:3px;pointer-events:none;left:" +
        t.left +
        "px;top:" +
        t.top +
        "px;width:" +
        t.width +
        "px;height:" +
        t.height +
        "px"),
        a.appendChild(n));
    }
    a.children.length && (document.body.appendChild(a), (vo = a));
  }
  function xo() {
    if (vo) {
      try {
        vo.remove();
      } catch (e) {}
      vo = null;
    }
  }
  (xa.register({
    id: "elements-control",
    name: "Hide Page Elements",
    summary:
      "Hide unwanted buttons, banners, or sections across YouTube. Choose from quick presets or pick individual items to hide with a live preview.",
    masterKey: "elementsControlOn",
    keys: ["elementsControlOn", "elementsControlHidden"],
    apply(e) {
      if (!S.elementsControlOn) return;
      const t = S.elementsControlHidden || {},
        a = [];
      for (const e of fo)
        for (const n of e.items) t[n.id] && a.push(n.selector);
      a.length &&
        e.addStyle(
          a.join(",") + "{display:none!important;visibility:hidden!important}",
        );
    },
    settings(e) {
      const t = () => S.elementsControlHidden || {},
        a = To("div", "ytp-elem-status"),
        n = () => {
          const e = (() => {
            const e = t(),
              a = fo.reduce((e, t) => e + t.items.length, 0);
            return { on: Object.keys(e).filter((t) => e[t]).length, total: a };
          })();
          a.textContent = e.on + " of " + e.total + " elements hidden";
        };
      (n(),
        e.appendChild(a),
        e.appendChild(To("div", "ytp-elem-sec-title", "Quick Presets")));
      const r = To("div", "ytp-preset-grid");
      function o(e) {
        const a = t(),
          n = Object.keys(e.hidden).filter((t) => e.hidden[t]),
          r = Object.keys(a).filter((e) => a[e]);
        return n.length === r.length && n.every((e) => a[e]);
      }
      function i() {
        r.querySelectorAll(".ytp-preset-card").forEach((e, t) => {
          e.classList.toggle("active", o(bo[t]));
        });
      }
      for (const e of bo) {
        const t = To("div", "ytp-preset-card");
        (t.addEventListener("click", () => {
          const t = c.scrollTop;
          (Ta("elementsControlHidden", Object.assign({}, e.hidden)),
            n(),
            p(),
            i(),
            (c.scrollTop = t),
            pe("Loaded preset: " + e.name, 1600, "success"));
        }),
          t.appendChild(To("div", "ytp-preset-name", e.name)),
          t.appendChild(To("div", "ytp-preset-desc", e.desc)),
          o(e) && t.classList.add("active"),
          r.appendChild(t));
      }
      (e.appendChild(r),
        e.appendChild(To("div", "ytp-elem-sec-title", "Individual Elements")));
      const d = document.createElement("input");
      ((d.type = "search"),
        (d.placeholder = "Filter by name…"),
        (d.className = "ytp-inp"),
        (d.style.marginBottom = "6px"),
        e.appendChild(d));
      const c = To("div", "ytp-elem-list");
      e.appendChild(c);
      let s = new Map();
      function l(e, t) {
        const a = Object.assign({}, S.elementsControlHidden || {});
        (t ? (a[e] = !0) : delete a[e],
          Ta("elementsControlHidden", a),
          n(),
          i());
      }
      function p() {
        const e = t();
        for (const [t, a] of s) {
          const n = !!e[t];
          ((a.cb.checked = n), a.row.classList.toggle("on", n));
        }
      }
      (!(function () {
        (c.replaceChildren(), (s = new Map()));
        const e = t();
        for (const t of fo) {
          const a = To("div", "ytp-elem-group-hdr", t.group);
          ((a.dataset.group = t.group), c.appendChild(a));
          for (const a of t.items) {
            const n = To("div", "ytp-elem-row");
            ((n.dataset.id = a.id),
              (n.dataset.name = a.name.toLowerCase()),
              (n.dataset.groupName = t.group.toLowerCase()));
            const r = !!e[a.id];
            r && n.classList.add("on");
            const o = document.createElement("input");
            ((o.type = "checkbox"),
              (o.className = "ytp-elem-cb"),
              (o.checked = r),
              o.addEventListener("change", () => {
                const e = c.scrollTop;
                (l(a.id, o.checked),
                  n.classList.toggle("on", o.checked),
                  requestAnimationFrame(() => {
                    c.scrollTop = e;
                  }));
              }));
            const i = To("span", "ytp-elem-name", a.name),
              d = To("span", "ytp-elem-match", "");
            try {
              const e = document.querySelectorAll(a.selector).length;
              ((d.textContent = e + " on page"),
                0 === e && n.classList.add("nomatch"));
            } catch (e) {
              d.textContent = "?";
            }
            (n.addEventListener("mouseenter", () => ko(a.selector)),
              n.addEventListener("mouseleave", () => xo()),
              n.appendChild(o),
              n.appendChild(i),
              n.appendChild(d),
              c.appendChild(n),
              s.set(a.id, { row: n, cb: o }));
          }
        }
      })(),
        d.addEventListener(
          "input",
          ee(function () {
            const e = (d.value || "").trim().toLowerCase(),
              t = new Set();
            for (const [, a] of s) {
              const n =
                !e ||
                a.row.dataset.name.includes(e) ||
                a.row.dataset.groupName.includes(e);
              ((a.row.style.display = n ? "" : "none"),
                n && t.add(a.row.dataset.groupName));
            }
            c.querySelectorAll(".ytp-elem-group-hdr").forEach((a) => {
              a.style.display =
                !e || t.has(a.dataset.group.toLowerCase()) ? "" : "none";
            });
          }, 80),
        ),
        So("cfg.changed", ({ key: e }) => {
          if ("elementsControlHidden" === e) {
            const e = c.scrollTop;
            (n(),
              p(),
              i(),
              requestAnimationFrame(() => {
                c.scrollTop = e;
              }));
          }
        }));
      const u = To("div", "ytp-rowb");
      (u.appendChild(
        Oo("Show all (un-hide)", () => {
          const e = c.scrollTop;
          (Ta("elementsControlHidden", {}),
            n(),
            p(),
            i(),
            requestAnimationFrame(() => {
              c.scrollTop = e;
            }));
        }),
      ),
        e.appendChild(u));
    },
  }),
    xa.register({
      id: "remote-selectors",
      name: "Remote Rule Manager",
      summary:
        "Load custom element hiding rules from a trusted online source, verified for security.",
      masterKey: "remoteSelectorsOn",
      keys: ["remoteSelectorsOn", "remoteSelectorsURL", "remoteSelectorsSHA"],
      async apply(e) {
        if (S.remoteSelectorsOn && S.remoteSelectorsURL && S.remoteSelectorsSHA)
          try {
            const t = await he(S.remoteSelectorsURL),
              a = await t.text(),
              n = await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(a),
              );
            if (
              Array.from(new Uint8Array(n))
                .map((e) => e.toString(16).padStart(2, "0"))
                .join("") !== S.remoteSelectorsSHA
            )
              throw new Error("hash mismatch");
            const r = JSON.parse(a);
            if (!Array.isArray(r)) throw new Error("bad pack");
            const o = r
              .filter(
                (e) => "string" == typeof e.selector && "hide" === e.action,
              )
              .filter((e) => {
                try {
                  return (document.querySelector(e.selector), !0);
                } catch (e) {
                  return !1;
                }
              })
              .map((e) => e.selector + "{display:none!important}")
              .join("");
            (o && e.addStyle(o),
              pe("Loaded " + r.length + " hide rules.", 1800, "success"));
          } catch (e) {
            m("remote selectors", e);
          }
      },
      settings(e) {
        (e.appendChild(_o("Rule list online link", "remoteSelectorsURL")),
          e.appendChild(
            _o("Security verification code", "remoteSelectorsSHA"),
          ));
      },
    }),
    Object.freeze(dn),
    Object.freeze(cn),
    Object.freeze(sn),
    Object.freeze(i),
    Object.freeze(s));
  let wo = null;
  const Co = [];
  function So(e, t) {
    Co.push(g.on(e, t));
  }
  function To(e, t, a) {
    const n = document.createElement(e);
    return (t && (n.className = t), null != a && (n.textContent = a), n);
  }
  function Oo(e, t, a) {
    const n = document.createElement("button");
    return (
      (n.type = "button"),
      (n.className = "ytp-btn" + (a ? " " + a : "")),
      (n.textContent = e),
      n.addEventListener("click", t),
      n
    );
  }
  function Mo(e, t, a) {
    const n = Oo(e, t, a);
    return (n.classList.add("ytp-sb"), n);
  }
  function Lo(e, t) {
    const a = To("div", "ytp-row");
    return (a.appendChild(To("span", "ytp-lbl", e)), a.appendChild(t), a);
  }
  function Ao(e) {
    const t = To("div", "ytp-rowb");
    return (e.forEach(([e, a]) => t.appendChild(Oo(e, a))), t);
  }
  function Eo(e) {
    const t = To("div", "ytp-rowb");
    return (e.forEach((e) => t.appendChild(e)), t);
  }
  function Bo(e) {
    const t = To("label", "ytp-sw"),
      a = document.createElement("input");
    return (
      (a.type = "checkbox"),
      (a.dataset.key = e),
      (a.checked = !!S[e]),
      a.addEventListener("change", () => Ta(e, a.checked)),
      t.appendChild(a),
      t.appendChild(To("span", "ytp-track")),
      t.appendChild(To("span", "ytp-knob")),
      So("cfg.changed", ({ key: t }) => {
        t === e && (a.checked = !!S[e]);
      }),
      t
    );
  }
  function Po(e, t) {
    const a = document.createElement("select");
    return (
      (a.className = "ytp-sel"),
      (a.dataset.key = e),
      Object.entries(t).forEach(([e, t]) => {
        const n = document.createElement("option");
        ((n.value = String(e)), (n.textContent = t), a.appendChild(n));
      }),
      (a.value = String(S[e])),
      a.addEventListener("change", () =>
        Ta(e, "number" == typeof s[e] ? Number(a.value) : a.value),
      ),
      So("cfg.changed", ({ key: t }) => {
        t === e && (a.value = String(S[e]));
      }),
      a
    );
  }
  function Io(e, t) {
    return Lo(e, Bo(t));
  }
  function Ro(e, t, a) {
    return Lo(e, Po(t, a));
  }
  function No(e, t, a, n, r, o) {
    return Lo(
      e,
      (function (e, t, a, n, r) {
        const o = To("div", "ytp-rng"),
          i = document.createElement("input");
        ((i.type = "range"),
          (i.min = t),
          (i.max = a),
          (i.step = n),
          (i.dataset.key = e),
          (i.value = String(S[e])));
        const d = To("span", "ytp-rngv", r(Number(S[e])));
        return (
          i.addEventListener("input", () => {
            const t = Number(i.value);
            ((d.textContent = r(t)), Ta(e, t));
          }),
          So("cfg.changed", ({ key: t }) => {
            t === e &&
              ((i.value = String(S[e])), (d.textContent = r(Number(S[e]))));
          }),
          o.appendChild(i),
          o.appendChild(d),
          o
        );
      })(t, a, n, r, o),
    );
  }
  function _o(e, t) {
    const a = To("div", "ytp-col");
    return (
      a.appendChild(To("span", "ytp-lbl", e)),
      a.appendChild(
        (function (e) {
          const t = document.createElement("input");
          return (
            (t.type = "text"),
            (t.className = "ytp-inp"),
            (t.dataset.key = e),
            (t.value = S[e] || ""),
            t.addEventListener("change", () => Ta(e, t.value)),
            So("cfg.changed", ({ key: a }) => {
              a === e && (t.value = S[e] || "");
            }),
            t
          );
        })(t),
      ),
      a
    );
  }

  function Xp(e, t) {
    const a = To("div", "ytp-col");
    a.appendChild(To("span", "ytp-lbl", e));
    const n = To("div", "ytp-cp");
    n.style.cssText = "display:flex;align-items:center;gap:8px;width:100%";
    const r = document.createElement("input");
    r.type = "text";
    r.className = "ytp-inp ytp-cp-text";
    r.style.cssText = "flex:1;min-width:0";
    r.dataset.key = t;
    r.value = S[t] || "";
    const o = document.createElement("input");
    o.type = "color";
    o.className = "ytp-cp-native";
    o.dataset.key = t;
    const _toHex6 = (v) => {
      const m = String(v || "").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (!m) return "000000";
      let h = m[1];
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      return h.toLowerCase();
    };
    o.value = /^#[0-9a-fA-F]{6}$/.test(S[t] || "") ? S[t] : ("#" + _toHex6(S[t]));
    o.style.cssText = "width:36px;height:32px;border:1px solid rgba(255,255,255,.15);border-radius:7px;background:transparent;cursor:pointer;padding:2px;flex-shrink:0";
    const i = document.createElement("div");
    i.className = "ytp-cp-swatch";
    i.dataset.key = t;
    i.style.cssText = "width:28px;height:28px;border-radius:6px;border:1px solid rgba(255,255,255,.18);flex-shrink:0;background:" + o.value;
    const _updateSwatch = (val) => {
      if (/^#?[0-9a-fA-F]{3,6}$/.test((val || "").trim())) {
        i.style.background = val;
        o.value = "#" + _toHex6(val);
      } else {
        i.style.background = "transparent";
      }
    };
    r.addEventListener("change", () => {
      Ta(t, r.value);
      _updateSwatch(r.value);
    });
    o.addEventListener("input", () => {
      r.value = o.value;
      Ta(t, o.value);
      i.style.background = o.value;
    });
    So("cfg.changed", ({ key: e }) => {
      if (e === t) {
        r.value = S[t] || "";
        o.value = /^#[0-9a-fA-F]{6}$/.test(S[t] || "") ? S[t] : ("#" + _toHex6(S[t]));
        _updateSwatch(S[t] || "");
      }
    });
    return a.appendChild(n), n.appendChild(r), n.appendChild(o), n.appendChild(i), a;
  }
  function Yp_fontRow(e, t) {
    const a = To("div", "ytp-col");
    (a.appendChild(To("span", "ytp-lbl", e)),
      a.appendChild(
        (function (e) {
          const t = To("div", "ytp-fp");
          ((t.style.position = "relative"),
            (t.style.width = "100%"));
          const a = document.createElement("button");
          ((a.type = "button"),
            (a.className = "ytp-fp-btn"),
            (a.dataset.key = e));
          const n = document.createElement("span");
          n.className = "ytp-fp-name";
          const r = document.createElement("span");
          r.className = "ytp-fp-arrow";
          (r.textContent = "\u25BE",
            a.appendChild(n),
            a.appendChild(r));
          const o = To("div", "ytp-fp-dd");
          o.style.display = "none";
          const i = To("input", "ytp-fp-search");
          ((i.type = "text"),
            (i.placeholder = "Search fonts..."),
            (i.className = "ytp-inp"));
          const d = To("div", "ytp-fp-list");
          (o.appendChild(i), o.appendChild(d));
          const l = () => {
            const t = (S[e] || "").trim() || "Roboto, Arial, sans-serif";
            n.textContent = t.split(",")[0].trim().replace(/['"]/g, "");
            n.style.fontFamily = t;
          };
          const c = (e, t) => {
            const a = To("div", "ytp-fp-item");
            ((a.style.fontFamily = e),
              (a.dataset.value = e),
              (a.textContent = t),
              a.addEventListener("click", () => {
                (Ta(e, a.dataset.value), l(), (o.style.display = "none"));
              }),
              d.appendChild(a));
          };
          Yt_fontFamilies().forEach((e) => {
            c(
              e,
              e
                .split(",")[0]
                .trim()
                .replace(/['"]/g, ""),
            );
          }),
            (i.addEventListener("input", () => {
              const t = i.value.trim().toLowerCase();
              d.querySelectorAll(".ytp-fp-item").forEach((e) => {
                e.style.display = e.textContent.toLowerCase().includes(t)
                  ? ""
                  : "none";
              });
            }),
            a.addEventListener("click", () => {
              (o.style.display =
                "none" === o.style.display ? "block" : "none",
                "block" === o.style.display && i.focus());
            }),
            document.addEventListener("click", (t) => {
              t.target !== a &&
                !a.contains(t.target) &&
                !o.contains(t.target) &&
                (o.style.display = "none");
            }),
            So("cfg.changed", ({ key: t }) => {
              t === e && l();
            }),
            l());
          return (t.appendChild(a), t.appendChild(o), t);
        })(t),
      ));
    return a;
  }
  function Yt_fontFamilies() {
    return [
      "Arial, sans-serif",
      "Arial Black, sans-serif",
      "Arial Narrow, sans-serif",
      "Helvetica, sans-serif",
      "Helvetica Neue, sans-serif",
      "Verdana, sans-serif",
      "Tahoma, sans-serif",
      "Trebuchet MS, sans-serif",
      "Geneva, sans-serif",
      "Calibri, sans-serif",
      "Cambria, sans-serif",
      "Candara, sans-serif",
      "Constantia, sans-serif",
      "Corbel, sans-serif",
      "Segoe UI, sans-serif",
      "Roboto, sans-serif",
      "Roboto Condensed, sans-serif",
      "Roboto Mono, monospace",
      "Roboto Slab, serif",
      "Open Sans, sans-serif",
      "Open Sans Condensed, sans-serif",
      "Lato, sans-serif",
      "Montserrat, sans-serif",
      "Poppins, sans-serif",
      "Inter, sans-serif",
      "Nunito, sans-serif",
      "Nunito Sans, sans-serif",
      "Raleway, sans-serif",
      "Source Sans Pro, sans-serif",
      "Source Sans 3, sans-serif",
      "Source Code Pro, monospace",
      "Ubuntu, sans-serif",
      "Noto Sans, sans-serif",
      "Noto Sans JP, sans-serif",
      "Noto Sans KR, sans-serif",
      "Noto Sans SC, sans-serif",
      "Noto Sans Arabic, sans-serif",
      "Noto Sans Hebrew, sans-serif",
      "Noto Sans Thai, sans-serif",
      "Noto Sans Devanagari, sans-serif",
      "PT Sans, sans-serif",
      "PT Sans Narrow, sans-serif",
      "PT Serif, serif",
      "Cabin, sans-serif",
      "Karla, sans-serif",
      "Mulish, sans-serif",
      "DM Sans, sans-serif",
      "Work Sans, sans-serif",
      "Quicksand, sans-serif",
      "Comfortaa, sans-serif",
      "Rubik, sans-serif",
      "Heebo, sans-serif",
      "Assistant, sans-serif",
      "Barlow, sans-serif",
      "Barlow Condensed, sans-serif",
      "Bebas Neue, sans-serif",
      "Oswald, sans-serif",
      "Anton, sans-serif",
      "Archivo, sans-serif",
      "Archivo Black, sans-serif",
      "Manrope, sans-serif",
      "Sora, sans-serif",
      "Space Grotesk, sans-serif",
      "Plus Jakarta Sans, sans-serif",
      "Outfit, sans-serif",
      "Spectral, serif",
      "IBM Plex Sans, sans-serif",
      "IBM Plex Sans Condensed, sans-serif",
      "IBM Plex Serif, serif",
      "IBM Plex Mono, monospace",
      "Fira Sans, sans-serif",
      "Fira Sans Condensed, sans-serif",
      "Fira Code, monospace",
      "JetBrains Mono, monospace",
      "Cascadia Code, monospace",
      "Cascadia Mono, monospace",
      "Inconsolata, monospace",
      "Consolas, monospace",
      "Menlo, monospace",
      "Monaco, monospace",
      "Courier New, monospace",
      "Lucida Console, monospace",
      "Lucida Sans Unicode, sans-serif",
      "Lucida Grande, sans-serif",
      "Gill Sans, sans-serif",
      "Optima, sans-serif",
      "Futura, sans-serif",
      "Avenir, sans-serif",
      "Avenir Next, sans-serif",
      "Didot, serif",
      "Bodoni 72, serif",
      "Hoefler Text, serif",
      "American Typewriter, serif",
      "Brush Script MT, cursive",
      "Snell Roundhand, cursive",
      "Bradley Hand, cursive",
      "Chalkboard, sans-serif",
      "Chalkduster, sans-serif",
      "Marker Felt, sans-serif",
      "Palatino, serif",
      "Palatino Linotype, serif",
      "Book Antiqua, serif",
      "Garamond, serif",
      "Big Caslon, serif",
      "Times New Roman, serif",
      "Times, serif",
      "Georgia, serif",
      "Baskerville, serif",
      "Cochin, serif",
      "Apple Chancery, cursive",
      "Impact, sans-serif",
      "Copperplate, serif",
      "Papyrus, cursive",
      "Hiragino Sans, sans-serif",
      "Yu Gothic, sans-serif",
      "Meiryo, sans-serif",
      "MS Gothic, monospace",
      "MS PGothic, monospace",
      "Malgun Gothic, sans-serif",
      "SimSun, sans-serif",
      "SimHei, sans-serif",
      "MingLiU, sans-serif",
      "PMingLiU, sans-serif",
      "Microsoft YaHei, sans-serif",
      "Microsoft JhengHei, sans-serif",
      "Hiragino Kaku Gothic Pro, sans-serif",
      "Apple SD Gothic Neo, sans-serif",
      "Apple Color Emoji, sans-serif",
      "Noto Color Emoji, sans-serif",
      "system-ui, sans-serif",
      "-apple-system, BlinkMacSystemFont, sans-serif",
    ];
  }
  function Ho(e, t, a) {
    const n = To("div", "ytp-col");
    return (
      n.appendChild(To("span", "ytp-lbl", e)),
      n.appendChild(
        (function (e, t) {
          const a = document.createElement("textarea");
          return (
            (a.className = "ytp-ta"),
            (a.placeholder = t || ""),
            (a.dataset.key = e),
            (a.value = S[e] || ""),
            a.addEventListener(
              "input",
              ee(() => Ta(e, a.value), 250),
            ),
            So("cfg.changed", ({ key: t }) => {
              t === e && a !== document.activeElement && (a.value = S[e] || "");
            }),
            a
          );
        })(t, a),
      ),
      n
    );
  }
  function Do(e) {
    const t = To("div", "ytp-card");
    t.dataset.feat = e.id;
    const a = To("div", "ytp-head");
    a.appendChild(To("div", "ytp-name", e.name));
    const n = s[e.masterKey],
      r = "string" == typeof e.masterKey && e.masterKey.startsWith("_bundle"),
      o = !r && "string" == typeof n,
      i =
        "function" == typeof e.isOn
          ? () => !!e.isOn()
          : o
            ? () => !!S[e.masterKey] && "off" !== S[e.masterKey]
            : () => !!S[e.masterKey];
    if (r) {
      const t = document.createElement("span");
      ((t.className = "ytp-toggle-pill"),
        (t.style.cssText =
          "font:700 10px system-ui;padding:3px 8px;border-radius:999px;letter-spacing:.02em;text-transform:uppercase"));
      const n = () => {
        const a = i(),
          n = (e.keys || [])
            .filter((e) => "boolean" == typeof s[e])
            .reduce((e, t) => e + (S[t] ? 1 : 0), 0);
        ((t.textContent = a ? n + " on" : "off"),
          (t.style.background = a
            ? "rgba(0,160,80,.22)"
            : "rgba(255,255,255,.06)"),
          (t.style.color = a ? "#7be1a3" : "#999"));
      };
      (n(),
        a.appendChild(t),
        So("cfg.changed", ({ key: t }) => {
          -1 !== (e.keys || []).indexOf(t) && n();
        }));
    } else if (o) {
      const t = document.createElement("span");
      ((t.className = "ytp-toggle-pill"),
        (t.style.cssText =
          "font:700 10px system-ui;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.08);color:#bbb;letter-spacing:.02em;text-transform:uppercase"));
      const n = () => {
        const a = String(S[e.masterKey] || "off");
        t.textContent = a;
        const n = i();
        ((t.style.background = n
          ? "rgba(0,160,80,.22)"
          : "rgba(255,255,255,.06)"),
          (t.style.color = n ? "#7be1a3" : "#999"));
      };
      (n(),
        a.appendChild(t),
        So("cfg.changed", ({ key: t }) => {
          t === e.masterKey && n();
        }));
    } else a.appendChild(Bo(e.masterKey));
    (t.appendChild(a),
      e.summary && t.appendChild(To("div", "ytp-sum", e.summary)));
    const d = To("div", "ytp-settings");
    let c = !1;
    const l = () => {
      const t = o || r,
        a = !!t || i();
      (a &&
        !c &&
        (() => {
          if (!c) {
            c = !0;
            try {
              e.settings(d);
            } catch (t) {
              m("settings " + e.id, t);
            }
          }
        })(),
        (d.style.display = t || a ? "block" : "none"));
    };
    return (
      l(),
      t.appendChild(d),
      So("cfg.changed", ({ key: t }) => {
        t === e.masterKey && l();
      }),
      t
    );
  }
  const qo = { query: "", limit: 30 };
  function Vo(t, a) {
    const n = t.progress || 0,
      r = !!t.completed,
      o = !r && (t.lastPosition || 0) > 5,
      i = To("div", "ytp-hcard" + (r ? " done" : "")),
      d = To("div", "ytp-hthumb"),
      c = t.thumbnail || ie.thumb(t.videoId, "mqdefault");

    const _veCached = Ve.get(t.videoId);
    if (_veCached) {
      d.style.backgroundImage = "url('" + _veCached + "')";
    } else {
      const safeC = sanitizeUrlForCSS(c);
      d.style.backgroundImage = safeC ? "url('" + encodeURI(safeC).replace(/'/g, "%27") + "')" : "none";
      je(t.videoId)
        .then((e) => {
          if (e && d.style.backgroundImage.indexOf(_veCached || "blob:") === -1) {
            d.style.backgroundImage = "url('" + e + "')";
          } else if (!e) {
            We(t.videoId, c).catch(() => {});
          }
        })
        .catch(() => {});
    }
    (r
      ? d.appendChild(To("div", "ytp-hbadge done", "Done"))
      : o && d.appendChild(To("div", "ytp-hbadge res", ce(t.lastPosition))));
    const s = To("div", "ytp-hinfo");
    (s.appendChild(To("div", "ytp-htitle", t.title || t.videoId)),
      s.appendChild(To("div", "ytp-hchan", t.channel || "Unknown")));
    const l = [];
    (t.duration && l.push(ce(t.duration)),
      !r && t.remaining > 0 && l.push(ce(t.remaining) + " left"),
      t.lastWatched &&
        l.push(
          (function (e) {
            if (!e) return "Never";
            const t = Date.now() - e;
            return t < 6e4
              ? "Just now"
              : t < 36e5
                ? Math.floor(t / 6e4) + "m ago"
                : t < 864e5
                  ? Math.floor(t / 36e5) + "h ago"
                  : t < 6048e5
                    ? Math.floor(t / 864e5) + "d ago"
                    : new Date(e).toLocaleDateString();
          })(t.lastWatched),
        ),
      s.appendChild(To("div", "ytp-hmeta", l.join(" - "))));
    const p = To("div", "ytp-hpt"),
      u = To("div", "ytp-hpf" + (r ? " done" : ""));
    ((u.style.width = Math.min(100, n) + "%"),
      p.appendChild(u),
      s.appendChild(p));
    const h = To("div", "ytp-hacts");
    return (
      o &&
        h.appendChild(
          Mo(
            "Resume " + ce(t.lastPosition),
            () => {
              e.location.href =
                "https://www.youtube.com/watch?v=" +
                t.videoId +
                "&t=" +
                Math.floor(t.lastPosition);
            },
            "primary",
          ),
        ),
      h.appendChild(
        Mo(r ? "Rewatch" : "Open", () => {
          e.location.href = "https://www.youtube.com/watch?v=" + t.videoId;
        }),
      ),
      h.appendChild(Mo("Remove", () => Pe(t.videoId).then(a), "danger")),
      s.appendChild(h),
      i.appendChild(d),
      i.appendChild(s),
      i
    );
  }
  function Yp_clampRect(e, t, a, n) {
    const r = window.innerWidth,
      o = window.innerHeight;
    return (
      (a = Math.max(320, Math.min(a, r))),
      (n = Math.max(280, Math.min(n, o))),
      {
        x: (e = Math.max(8 - a + 80, Math.min(e, r - 80))),
        y: (t = Math.max(0, Math.min(t, o - 40))),
        w: a,
        h: n,
      }
    );
  }
  function jo(e, t, a, n) {
    Oa({
      dashX: Math.round(e),
      dashY: Math.round(t),
      dashW: Math.round(a),
      dashH: Math.round(n),
    });
  }
  function zo(e) {
    wo &&
      ((wo.style.left = e.x + "px"),
      (wo.style.top = e.y + "px"),
      (wo.style.width = e.w + "px"),
      (wo.style.height = e.h + "px"),
      (wo.style.right = "auto"),
      (wo.style.bottom = "auto"));
  }
  function Wo() {
    if (!wo) return;
    const e = wo.getBoundingClientRect();
    zo(Yp_clampRect(e.left, e.top, e.width, e.height));
  }
  function Uo() {
    wo ||
      (function () {
        (!(function () {
          if (document.getElementById("ytp-dash-style")) return;
          const e =
            '\n.ytp-fp{position:relative;width:100%}\n.ytp-fp-btn{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:7px 10px;background:rgba(255,255,255,.05);color:#eef;border:1px solid rgba(255,255,255,.12);border-radius:7px;font:inherit;font-size:12px;cursor:pointer;transition:background .15s,border-color .15s;text-align:left}\n.ytp-fp-btn:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.2)}\n.ytp-fp-btn:focus{outline:none;border-color:rgba(255,61,127,.55);box-shadow:0 0 0 3px rgba(255,61,127,.15)}\n.ytp-fp-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.ytp-fp-arrow{color:#8b93a3;font-size:10px;flex-shrink:0}\n.ytp-fp-dd{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:50;max-height:260px;display:flex;flex-direction:column;background:rgba(18,20,26,.92);border:1px solid rgba(255,255,255,.14);border-radius:10px;box-shadow:0 18px 40px rgba(0,0,0,.6),0 4px 12px rgba(0,0,0,.4);backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);overflow:hidden;animation:ytpFpFade .12s ease-out}\n.ytp-fp-search{margin:8px 8px 6px;padding:6px 10px;background:rgba(255,255,255,.06);color:#eef;border:1px solid rgba(255,255,255,.1);border-radius:6px;font:inherit;font-size:11.5px;outline:none;flex-shrink:0}\n.ytp-fp-search::placeholder{color:#7a8290}\n.ytp-fp-search:focus{border-color:rgba(255,61,127,.55)}\n.ytp-fp-list{overflow-y:auto;flex:1;padding:2px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent}\n.ytp-fp-list::-webkit-scrollbar{width:6px}\n.ytp-fp-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:6px}\n.ytp-fp-item{padding:6px 10px;border-radius:5px;cursor:pointer;color:#eef;font-size:12px;line-height:1.3;transition:background .1s}\n.ytp-fp-item:hover{background:rgba(255,61,127,.22);color:#fff}\n.ytp-fp-item.selected{background:rgba(255,61,127,.32);font-weight:600}@keyframes ytpFpFade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}\n#ytp-ivs{font-family:\"Inter\",\"Roboto\",system-ui,-apple-system,sans-serif}\n#ytp-ivs .ytp-ivs-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,0))}\n#ytp-ivs .ytp-ivs-title{font-size:13px;font-weight:700;letter-spacing:.02em}\n#ytp-ivs .ytp-ivs-close{appearance:none;border:0;background:rgba(255,255,255,.06);color:#dde;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:12px;line-height:1;font-weight:700;transition:background .12s}\n#ytp-ivs .ytp-ivs-close:hover{background:rgba(255,80,80,.25);color:#fff}\n#ytp-ivs .ytp-ivs-input{margin:10px 14px 4px;padding:8px 12px;background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:8px;font:inherit;font-size:13px;outline:none;flex-shrink:0}\n#ytp-ivs .ytp-ivs-input::placeholder{color:#7a8290}\n#ytp-ivs .ytp-ivs-input:focus{border-color:rgba(255,61,127,.55);box-shadow:0 0 0 3px rgba(255,61,127,.15)}\n#ytp-ivs .ytp-ivs-status{padding:0 14px 6px;font:11px ui-monospace,monospace;color:#8b93a3}\n#ytp-ivs .ytp-ivs-timeline{position:relative;height:8px;margin:0 14px 10px;background:rgba(255,255,255,.05);border-radius:4px;overflow:hidden;flex-shrink:0}\n#ytp-ivs .ytp-ivs-results{flex:1;min-height:0;overflow-y:auto;padding:4px 8px 10px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.15) transparent}\n#ytp-ivs .ytp-ivs-results::-webkit-scrollbar{width:6px}\n#ytp-ivs .ytp-ivs-results::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:6px}\n#ytp-ivs .ytp-ivs-row{display:flex;align-items:flex-start;gap:10px;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background .1s}\n#ytp-ivs .ytp-ivs-row:hover{background:rgba(255,61,127,.18)}\n#ytp-ivs .ytp-ivs-time{flex-shrink:0;font:11px ui-monospace,monospace;color:#ff8a96;background:rgba(255,61,127,.18);padding:2px 6px;border-radius:4px;cursor:pointer}\n#ytp-ivs .ytp-ivs-time:hover{background:rgba(255,61,127,.3);color:#fff}\n#ytp-ivs .ytp-ivs-text{flex:1;min-width:0;font-size:12px;color:#dde;line-height:1.45;word-wrap:break-word;overflow-wrap:break-word}\n#ytp-ivs .ytp-ivs-hl{background:rgba(255,61,127,.45);color:#fff;font-weight:600;padding:0 2px;border-radius:2px}\n#ytp-ivs .ytp-ivs-hint{padding:10px 12px;color:#7a8290;font-size:11.5px;font-style:italic}@keyframes ytpIvsIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}\n#ytp-resume-overlay > div,.ytp-resume-card-inner,.ytp-resume-card{max-width:520px;width:min(86%,520px);background:rgba(20,22,28,.6);border:1px solid rgba(255,255,255,.14);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.65),0 8px 24px rgba(0,0,0,.4);backdrop-filter:blur(28px) saturate(180%);-webkit-backdrop-filter:blur(28px) saturate(180%);padding:24px 26px 22px;display:flex;flex-direction:column;gap:14px;transform:translateY(8px);transition:transform .25s ease-out}\n#ytp-resume-overlay .ytp-resume-head{display:flex;gap:14px;align-items:center}\n#ytp-resume-overlay .ytp-resume-thumb{width:120px;height:68px;border-radius:10px;flex-shrink:0;background:#000 center/cover no-repeat;box-shadow:0 4px 12px rgba(0,0,0,.5);position:relative;overflow:hidden}\n#ytp-resume-overlay .ytp-resume-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}\n#ytp-resume-overlay .ytp-resume-eyebrow{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#ff8a96;font-weight:600}\n#ytp-resume-overlay .ytp-resume-title{font-size:15px;font-weight:600;color:#fff;line-height:1.3}\n#ytp-resume-overlay .ytp-resume-meta{font-size:12px;color:#aaa}\n#ytp-resume-overlay .ytp-resume-body{font-size:13.5px;color:#cdd;line-height:1.5}\n#ytp-resume-overlay .ytp-resume-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:2px}\n#ytp-resume-overlay .ytp-resume-btn-primary{background:#fff!important;color:#0f0f0f!important;box-shadow:0 4px 16px rgba(255,255,255,.15)}\n#ytp-resume-overlay .ytp-resume-btn-primary:hover{box-shadow:0 6px 22px rgba(255,255,255,.3)}\n#ytp-resume-overlay .ytp-resume-btn-secondary{background:rgba(255,255,255,.1)!important;color:#fff!important;border:1px solid rgba(255,255,255,.14)!important}\n#ytp-resume-overlay .ytp-resume-btn-secondary:hover{background:rgba(255,255,255,.18)!important}\n#ytp-resume-overlay .ytp-resume-footer{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#777;margin-top:4px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08)}\n#ytp-resume-overlay .ytp-resume-dismiss{background:none!important;border:0!important;color:#888!important;cursor:pointer;font:inherit;text-decoration:underline;padding:2px 4px}\n#ytp-resume-overlay .ytp-resume-dismiss:hover{color:#fff!important}\n#ytp-resume-overlay.ytp-resume-compact > div{max-width:380px;padding:18px 20px 16px;gap:12px;border-radius:18px}\n#ytp-resume-overlay.ytp-resume-detailed > div{max-width:560px;padding:32px 32px 24px;gap:20px}\n#ytp-resume-overlay.ytp-resume-cinema > div{background:rgba(10,10,14,.78);border:1px solid rgba(255,255,255,.16);box-shadow:0 40px 100px rgba(0,0,0,.8),0 8px 24px rgba(0,0,0,.5);backdrop-filter:blur(30px) saturate(200%);-webkit-backdrop-filter:blur(30px) saturate(200%);max-width:560px;padding:32px}\n#ytp-resume-card{background:rgba(20,22,28,.7)!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:12px!important;box-shadow:0 18px 40px rgba(0,0,0,.55),0 4px 12px rgba(0,0,0,.4)!important;backdrop-filter:blur(20px) saturate(160%)!important;-webkit-backdrop-filter:blur(20px) saturate(160%)!important;color:#fff!important;}\n#ytp-resume-card .ytp-resume-card-row{align-items:center}\n#ytp-resume-card .ytp-resume-thumb{background-size:cover!important}\n#ytp-resume-card .ytp-resume-info{min-width:0}\n#ytp-resume-card .ytp-resume-cta{font-weight:600;font-size:12px;color:#fff}\n#ytp-resume-card .ytp-resume-title{font-size:11px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n#ytp-resume-card .ytp-resume-actions{display:flex;gap:6px;align-items:center;flex-shrink:0}\n#ytp-resume-card .ytp-resume-btn-primary:hover{background:#ff1a4a!important}\n#ytp-resume-card .ytp-resume-btn-secondary:hover{background:rgba(255,255,255,.18)!important}\n#ytp-resume-card .ytp-resume-close{padding:7px 10px!important;min-width:30px;line-height:1}\n.ytp-cp{display:flex;align-items:center;gap:8px;width:100%}\n.ytp-cp-text{flex:1;min-width:0}\n.ytp-cp-native{width:36px;height:32px;border:1px solid rgba(255,255,255,.15);border-radius:7px;background:transparent;cursor:pointer;padding:2px;flex-shrink:0}\n.ytp-cp-swatch{width:28px;height:28px;border-radius:6px;border:1px solid rgba(255,255,255,.18);flex-shrink:0;background:#000}\n.ytp-cp-native::-webkit-color-swatch-wrapper{padding:0}\n.ytp-cp-native::-webkit-color-swatch{border:none;border-radius:5px}\n.ytp-cp-native::-moz-color-swatch{border:none;border-radius:5px}\n#ytp-resume-overlay.ytp-resume-compact .ytp-resume-card{max-width:380px;padding:18px 20px 16px;gap:10px;border-radius:18px;background:rgba(20,22,28,.78)}\n#ytp-resume-overlay.ytp-resume-compact .ytp-resume-head{gap:10px}\n#ytp-resume-overlay.ytp-resume-compact .ytp-resume-thumb{width:80px;height:45px;border-radius:8px}\n#ytp-resume-overlay.ytp-resume-detailed .ytp-resume-card{max-width:560px;padding:32px 32px 24px;gap:20px;background:rgba(20,22,28,.78)}\n#ytp-resume-overlay.ytp-resume-detailed .ytp-resume-thumb{width:160px;height:90px}\n#ytp-resume-overlay.ytp-resume-detailed .ytp-resume-title{font-size:18px;line-height:1.4;-webkit-line-clamp:3}\n#ytp-resume-overlay.ytp-resume-detailed .ytp-resume-meta{font-size:13px;line-height:1.5}\n#ytp-resume-overlay.ytp-resume-detailed .ytp-resume-body{font-size:15px;line-height:1.55}\n#ytp-resume-overlay.ytp-resume-cinema .ytp-resume-card{background:rgba(10,10,14,.72);border:1px solid rgba(255,255,255,.14);box-shadow:0 40px 100px rgba(0,0,0,.8),0 8px 24px rgba(0,0,0,.5);backdrop-filter:blur(30px) saturate(200%);-webkit-backdrop-filter:blur(30px) saturate(200%);max-width:560px;padding:32px}\n#ytp-resume-overlay.ytp-resume-cinema .ytp-resume-thumb{width:140px;height:80px;border-radius:12px}\n#ytp-resume-overlay.ytp-resume-cinema .ytp-resume-title{font-size:18px;line-height:1.4}\n.ytp-dash{position:fixed;top:24px;right:24px;width:480px;height:auto;max-width:calc(100vw - 32px);max-height:calc(100vh - 48px);z-index:2147483641;color:#f5f7fb;background:rgba(14,16,22,.95);border:1px solid rgba(255,255,255,.14);border-radius:18px;box-shadow:0 28px 80px rgba(0,0,0,.7),0 6px 20px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.1),inset 0 -1px 0 rgba(0,0,0,.4);font:13.5px/1.5 \"Inter\",\"Roboto\",system-ui,-apple-system,sans-serif;font-style:normal;font-variant:normal;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;display:flex;flex-direction:column;opacity:0;transform:translate3d(0,0,0);will-change:transform,opacity;contain:layout style paint;backface-visibility:hidden;text-shadow:0 1px 1px rgba(0,0,0,.4);transition:opacity .12s linear;overflow:hidden;resize:none}\n.ytp-dash.open{opacity:1;transform:translate3d(0,0,0) scale(1);animation:ytpDashIn .25s cubic-bezier(.16,1,.3,1) backwards}.ytp-dash:not(.open){transform:translate3d(0,8px,0) scale(.98)}\n.ytp-dash::before{content:"";position:absolute;inset:0;border-radius:18px;pointer-events:none;background:linear-gradient(135deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,0) 40%,rgba(255,61,127,.04) 100%);opacity:.6}\n@keyframes ytpDashIn{from{opacity:0;transform:translate3d(0,-8px,0) scale(.96)}to{opacity:1;transform:translate3d(0,0,0) scale(1)}}\n.ytp-dash.dragging{transition:none!important;cursor:grabbing!important;user-select:none;-webkit-user-select:none;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.ytp-dash.dragging::before{display:none!important}.ytp-dash.dragging *{pointer-events:none!important}\n.ytp-dash.dragging *{cursor:grabbing!important}\n.ytp-dash.resizing{transition:none;user-select:none}\n.ytp-dhandle{cursor:grab;user-select:none;-webkit-user-select:none}\n.ytp-dhandle:active{cursor:grabbing}\n.ytp-dgrip{display:inline-block;background:linear-gradient(135deg,#ff0033 0%,#ff3d7f 100%);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:800;margin-right:8px;font-size:15px;filter:drop-shadow(0 1px 2px rgba(255,0,51,.5))}\n.ytp-dhbtns{display:flex;gap:6px;flex-shrink:0}\n.ytp-dresize{position:absolute;right:0;bottom:0;width:18px;height:18px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 0,transparent 45%,rgba(255,255,255,.18) 45%,rgba(255,255,255,.18) 55%,transparent 55%,transparent 70%,rgba(255,255,255,.18) 70%,rgba(255,255,255,.18) 80%,transparent 80%);z-index:2;border-bottom-right-radius:18px}\n.ytp-dresize:hover{background:linear-gradient(135deg,transparent 0,transparent 45%,rgba(255,61,127,.45) 45%,rgba(255,61,127,.45) 55%,transparent 55%,transparent 70%,rgba(255,61,127,.45) 70%,rgba(255,61,127,.45) 80%,transparent 80%)}\n.ytp-dash,.ytp-dash *{font-style:normal;font-variant:normal;box-sizing:border-box}\n#ytp-extra-notes,#ytp-extra-notes *{font-style:normal;font-variant:normal;box-sizing:border-box}\n#ytp-toast,#ytp-toast *{font-style:normal;font-variant:normal;box-sizing:border-box}\n#ytp-resume-card,#ytp-resume-card *{font-style:normal;font-variant:normal;box-sizing:border-box}\n#ytp-resume-overlay,#ytp-resume-overlay *{font-style:normal;font-variant:normal;box-sizing:border-box}\n#ytp-sb-hud,#ytp-sb-hud *{font-style:normal;font-variant:normal;box-sizing:border-box}\n#ytp-sb-ov,#ytp-sb-ov *{font-style:normal;font-variant:normal;box-sizing:border-box}\n#ytp-stats,#ytp-stats *{font-style:normal;font-variant:normal;box-sizing:border-box}\n#ytp-diag,#ytp-diag *{font-style:normal;font-variant:normal;box-sizing:border-box}\n#ytp-chapter-panel,#ytp-chapter-panel *{font-style:normal;font-variant:normal;box-sizing:border-box}\n.ytp-dhdr{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.1);background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,0));text-shadow:0 1px 2px rgba(0,0,0,.5)}\n.ytp-dtitle{font-size:15.5px;font-weight:700;letter-spacing:.2px;display:flex;align-items:center;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6)}\n.ytp-dver{font-size:10.5px;color:#dde;font-weight:600;margin-left:8px;padding:2px 7px;border-radius:99px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);text-shadow:0 1px 1px rgba(0,0,0,.4)}\n.ytp-btn{appearance:none;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:7px 13px;background:rgba(255,255,255,.08);color:#f5f7fb;cursor:pointer;font:inherit;font-size:12.5px;font-weight:600;transition:background .15s,color .15s,border-color .15s,transform .1s,box-shadow .15s;text-shadow:0 1px 1px rgba(0,0,0,.3)}\n.ytp-btn:hover{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.24);box-shadow:0 2px 8px rgba(0,0,0,.3)}\n.ytp-btn:active{transform:translateY(1px)}\n.ytp-btn.primary{background:linear-gradient(135deg,#ff0033 0%,#ff3d7f 100%);color:#fff;border-color:rgba(255,255,255,.18);box-shadow:0 2px 8px rgba(255,0,51,.4)}\n.ytp-btn.primary:hover{filter:brightness(1.1);box-shadow:0 4px 14px rgba(255,0,51,.55)}\n.ytp-btn.danger,.ytp-btn.ytp-danger{background:rgba(255,80,80,.1);color:#ff8a96;border-color:rgba(255,80,80,.25)}\n.ytp-btn.danger:hover,.ytp-btn.ytp-danger:hover{background:rgba(255,80,80,.2);color:#fff}\n.ytp-btn.ytp-close{width:30px;height:30px;padding:0;border-radius:50%;font-size:12px;display:inline-flex;align-items:center;justify-content:center}\n.ytp-btn.ytp-sb{font-size:10px;padding:4px 8px}\n.ytp-search{margin:10px 14px 6px;padding:9px 13px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:10px;font:inherit;font-size:13px;outline:none;backdrop-filter:blur(8px);text-shadow:0 1px 1px rgba(0,0,0,.3)}\n.ytp-search::placeholder{color:#7a8290}\n.ytp-search:focus{border-color:rgba(255,61,127,.55);box-shadow:0 0 0 3px rgba(255,61,127,.15)}\n.ytp-body{flex:1 1 0;min-height:0;overflow-y:auto;padding:6px 0 12px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.15) transparent}\n.ytp-body::-webkit-scrollbar{width:6px}\n.ytp-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:6px}\n.ytp-core{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.1);margin-bottom:6px}\n.ytp-corecell{display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:9px 13px;transition:background .15s,border-color .15s,box-shadow .15s}\n.ytp-corecell:hover{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.12)}\n.ytp-corelbl{font-size:12px;font-weight:600;color:#f0f2f7;text-shadow:0 1px 1px rgba(0,0,0,.35)}\n.ytp-card{margin:6px 10px;padding:13px 15px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;transition:background .15s,border-color .15s,box-shadow .2s,transform .15s;position:relative;overflow:hidden}\n.ytp-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#ff0033,#ff3d7f);opacity:0;transition:opacity .15s}\n.ytp-card:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.18);box-shadow:0 8px 24px rgba(0,0,0,.4);transform:translateY(-1px)}\n.ytp-card:hover::before{opacity:1}\n.ytp-head{display:flex;align-items:center;justify-content:space-between;gap:10px}\n.ytp-name{font-size:14px;font-weight:600;color:#fff;flex:1;min-width:0;text-shadow:0 1px 2px rgba(0,0,0,.4)}\n.ytp-sum{font-size:12px;color:#b8c0d0;margin-top:5px;line-height:1.5;text-shadow:0 1px 1px rgba(0,0,0,.3)}\n.ytp-settings{margin-top:10px;padding-top:10px;border-top:1px dashed rgba(255,255,255,.08);display:flex;flex-direction:column;gap:8px}\n.ytp-sub{display:flex;flex-direction:column;gap:5px;margin-top:5px}\n.ytp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:30px}\n.ytp-col{display:flex;flex-direction:column;gap:6px}\n.ytp-rowb{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}\n.ytp-rowb .ytp-btn{flex:1;min-width:80px}\n.ytp-lbl{font-size:12px;color:#e5e7ed;flex:1;min-width:0;text-shadow:0 1px 1px rgba(0,0,0,.3)}\n.ytp-sw{position:relative;width:40px;height:22px;flex-shrink:0;cursor:pointer}\n.ytp-sw input{position:absolute;opacity:0;width:0;height:0}\n.ytp-track{position:absolute;inset:0;border-radius:999px;background:rgba(255,255,255,.1);transition:background .2s;border:1px solid rgba(255,255,255,.08)}\n.ytp-knob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:linear-gradient(180deg,#f0f0f5,#c4c8d2);transition:transform .2s cubic-bezier(.4,0,.2,1),background .2s;box-shadow:0 2px 5px rgba(0,0,0,.5)}\n.ytp-sw input:checked~.ytp-track{background:linear-gradient(135deg,#ff0033 0%,#ff3d7f 100%);border-color:rgba(255,255,255,.2);box-shadow:0 0 10px rgba(255,61,127,.4)}\n.ytp-sw input:checked~.ytp-knob{transform:translateX(18px);background:#fff}\n.ytp-sel{background:rgba(255,255,255,.06);color:#eef;border:1px solid rgba(255,255,255,.1);border-radius:7px;font:inherit;font-size:11.5px;padding:4px 8px;outline:none;max-width:160px;transition:border-color .15s}\n.ytp-sel:focus{border-color:rgba(255,61,127,.55)}\n.ytp-sel option{background:#181a20;color:#eef}\n.ytp-fp{position:relative;width:100%}\n.ytp-fp-btn{display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;background:rgba(255,255,255,.05);color:#eef;border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:7px 10px;font:12px system-ui;cursor:pointer;text-align:left;transition:background .12s,border-color .12s}\n.ytp-fp-btn:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18)}\n.ytp-fp-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.ytp-fp-arrow{color:#9aa;font-size:10px}\n.ytp-fp-dd{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:2147483646;max-height:320px;display:flex;flex-direction:column;background:rgba(20,22,28,.97);color:#eef;border:1px solid rgba(255,255,255,.12);border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.5),0 4px 16px rgba(0,0,0,.35);backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%);overflow:hidden}\n.ytp-fp-search{margin:6px 8px 0;padding:6px 10px;background:rgba(255,255,255,.06);color:#eef;border:1px solid rgba(255,255,255,.1);border-radius:6px;font:11.5px system-ui;outline:none;width:calc(100% - 16px)}\n.ytp-fp-search:focus{border-color:rgba(255,61,127,.55)}\n.ytp-fp-list{flex:1;overflow-y:auto;max-height:260px;padding:4px 4px 6px;scrollbar-width:thin}\n.ytp-fp-item{padding:6px 10px;font-size:13px;color:#eef;cursor:pointer;border-radius:5px;transition:background .1s;line-height:1.3}\n.ytp-fp-item:hover{background:rgba(255,61,127,.18)}\n.ytp-rng{display:flex;align-items:center;gap:8px;flex:1;max-width:60%}\n.ytp-rng input[type=range]{flex:1;min-width:80px;accent-color:#ff3d7f;height:3px;cursor:pointer}\n.ytp-rngv{min-width:54px;text-align:right;color:#9aa;font-size:11px;font-variant-numeric:tabular-nums}\n.ytp-inp{background:rgba(255,255,255,.05);color:#eef;border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:7px 10px;font:inherit;font-size:12px;outline:none;width:100%;transition:border-color .15s,box-shadow .15s}\n.ytp-inp:focus{border-color:rgba(255,61,127,.55);box-shadow:0 0 0 3px rgba(255,61,127,.15)}\n.ytp-ta{background:rgba(255,255,255,.05);color:#eef;border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:7px 10px;font:11.5px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;outline:none;width:100%;min-height:70px;resize:vertical;transition:border-color .15s}\n.ytp-ta:focus{border-color:rgba(255,61,127,.55)}\n.ytp-cat-dot{display:inline-block;width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-right:6px;box-shadow:0 0 6px currentColor}\n.ytp-foot{display:flex;gap:8px;padding:13px 14px;border-top:1px solid rgba(255,255,255,.1);flex-wrap:wrap;background:linear-gradient(0deg,rgba(0,0,0,.25),rgba(0,0,0,0))}\n.ytp-foot .ytp-btn{flex:1;min-width:90px}\n.ytp-hcard{display:flex;gap:10px;padding:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.05);border-radius:10px;margin-top:6px;transition:background .15s}\n.ytp-hcard:hover{background:rgba(255,255,255,.07)}\n.ytp-hcard.done{opacity:.6}\n.ytp-hthumb{width:88px;height:50px;min-width:88px;border-radius:7px;background:#1a1c22 center/cover no-repeat;position:relative;flex-shrink:0;overflow:hidden;border:1px solid rgba(255,255,255,.06)}\n.ytp-hbadge{position:absolute;bottom:3px;right:3px;background:rgba(0,0,0,.85);color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px}\n.ytp-hbadge.done{background:rgba(0,160,50,.85)}\n.ytp-hbadge.res{background:rgba(255,61,127,.85)}\n.ytp-hinfo{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}\n.ytp-htitle{font-size:11.5px;font-weight:600;color:#e5e7ed;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.ytp-hchan{font-size:10px;color:#7a8290;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.ytp-hmeta{font-size:10px;color:#5b6270;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.ytp-hpt{height:3px;background:rgba(255,255,255,.08);border-radius:3px;margin:3px 0;overflow:hidden}\n.ytp-hpf{height:100%;background:linear-gradient(90deg,#ff0033,#ff3d7f);border-radius:3px}\n.ytp-hpf.done{background:linear-gradient(90deg,#0a6,#4caf50)}\n.ytp-hacts{display:flex;gap:4px;margin-top:4px;flex-wrap:wrap}\n.ytp-hist-loading,.ytp-hist-empty{padding:20px;text-align:center;color:#5b6270;font-size:11.5px}\n.ytp-hist-panel{display:flex;flex-direction:column;gap:8px;margin-top:6px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px}\n.ytp-hist-toolbar{display:flex;gap:6px;flex-wrap:wrap}\n.ytp-hist-search{flex:1;min-width:120px;background:rgba(255,255,255,.05);color:#eef;border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:6px 10px;font:inherit;font-size:12px;outline:none}\n.ytp-hist-search:focus{border-color:rgba(255,61,127,.55)}\n.ytp-hist-list{display:flex;flex-direction:column;gap:6px;max-height:420px;overflow-y:auto;scrollbar-width:thin;padding-right:2px}\n.ytp-hist-loadmore{margin-top:0!important;background:rgba(255,255,255,.04)!important}\n#ytp-extra-topbar{position:fixed;left:0;top:0;height:3px;width:0;background:linear-gradient(90deg,#ff0033,#ff3d7f);z-index:2147483642;box-shadow:0 1px 10px rgba(255,61,127,.6);pointer-events:none}\n#ytp-extra-remain,#ytp-extra-clock,#ytp-extra-endwarn{position:fixed;right:12px;bottom:58px;z-index:2147483636;background:rgba(20,22,28,.5);color:#eef;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:5px 10px;font:11px/1.2 ui-monospace,monospace;backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);box-shadow:0 6px 20px rgba(0,0,0,.4);pointer-events:none;}\n#ytp-extra-clock{bottom:84px;color:#8ee}\n#ytp-extra-endwarn{left:50%;right:auto;bottom:120px;transform:translateX(-50%);opacity:0;transition:opacity .2s;color:#ffd166}\n#ytp-extra-endwarn.show{opacity:1}\n.ytp-extra-num{position:absolute;left:5px;top:5px;z-index:5;background:linear-gradient(135deg,#ff0033,#ff3d7f);color:#fff;border-radius:99px;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;font:700 11px system-ui;box-shadow:0 2px 6px rgba(255,0,51,.4)}\n.ytp-extra-long{box-shadow:inset 3px 0 0 #8b5cf6!important}\n.ytp-extra-short{box-shadow:inset 3px 0 0 #22c55e!important}\n.ytp-extra-watched-dim{opacity:.45!important;filter:saturate(.6)!important}\n.ytp-extra-watched-hide,.ytp-extra-live,.ytp-extra-premiere{display:none!important}\n#ytp-extra-notes{position:fixed;right:18px;bottom:18px;z-index:2147483646;width:min(360px,calc(100vw - 36px));background:rgba(20,22,28,.55);color:#eef;border:1px solid rgba(255,255,255,.12);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.55),0 4px 16px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%);padding:12px;font:12px system-ui;}\n.ytp-extra-notes-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}\n.ytp-extra-notes-head button{background:none;border:0;color:#aaa;font-size:18px;cursor:pointer}\n#ytp-extra-notes textarea{width:100%;min-height:140px;background:rgba(255,255,255,.06);color:#eee;border:1px solid rgba(255,255,255,.1);border-radius:5px;padding:6px;font:inherit;resize:vertical}\n.ytp-extra-notes-foot{display:flex;justify-content:space-between;align-items:center;margin-top:6px;font:10.5px ui-monospace,monospace;color:#777}\n.ytp-extra-notes-foot button{background:linear-gradient(135deg,#ff0033,#ff3d7f);color:#fff;border:0;border-radius:5px;padding:4px 10px;cursor:pointer;font:600 11px system-ui}\n.ytp-toast,.ytp-t-info,.ytp-t-success,.ytp-t-error{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(10px);z-index:2147483647;background:rgba(20,22,28,.55);color:#eef;border:1px solid rgba(255,255,255,.12);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.55),0 4px 16px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%);padding:10px 18px;font:12px/1.4 system-ui;font-style:normal;opacity:0;transition:opacity .2s,transform .2s;max-width:min(420px,calc(100vw - 32px));}\n.ytp-toast.show,.ytp-t-info.show,.ytp-t-success.show,.ytp-t-error.show{opacity:1;transform:translateX(-50%) translateY(0)}\n.ytp-toast.success,.ytp-t-success{border-color:rgba(76,175,80,.55);background:linear-gradient(135deg,rgba(20,22,28,.6),rgba(76,175,80,.22))}\n#ytp-resume-overlay.ytp-resume-compact .ytp-resume-card{max-width:380px;padding:18px 20px 16px;gap:10px;border-radius:18px;background:rgba(20,22,28,.78)}\n#ytp-resume-overlay.ytp-resume-compact .ytp-fcw-bar{height:3px;margin-top:8px}\n#ytp-resume-overlay.ytp-resume-compact .ytp-resume-head{gap:10px}\n#ytp-resume-overlay.ytp-resume-compact .ytp-resume-thumb{width:80px;height:45px}\n#ytp-resume-overlay.ytp-resume-detailed .ytp-resume-card{max-width:560px;padding:32px 32px 24px;gap:20px}\n#ytp-resume-overlay.ytp-resume-detailed .ytp-resume-thumb{width:160px;height:90px}\n#ytp-resume-overlay.ytp-resume-detailed .ytp-resume-title{font-size:18px;line-height:1.4;margin-top:6px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}\n#ytp-resume-overlay.ytp-resume-detailed .ytp-resume-meta{font-size:13px;margin-top:8px;line-height:1.5}\n#ytp-resume-overlay.ytp-resume-detailed .ytp-resume-body{font-size:15px;line-height:1.5;margin-top:2px}\n#ytp-resume-overlay.ytp-resume-detailed .ytp-resume-btn-primary,#ytp-resume-overlay.ytp-resume-detailed .ytp-resume-btn-secondary{padding:14px 22px;border-radius:99px;font-size:14px;gap:4px}\n#ytp-resume-overlay.ytp-resume-detailed .ytp-fcw-bar{height:5px;margin-top:10px;border-radius:99px}\n#ytp-resume-overlay.ytp-resume-detailed .ytp-resume-actions{gap:12px;margin-top:6px}\n#ytp-resume-overlay.ytp-resume-cinema .ytp-resume-card{background:rgba(10,10,12,.7);border:1px solid rgba(255,255,255,.15);box-shadow:0 40px 100px rgba(0,0,0,.8),0 8px 24px rgba(0,0,0,.5);backdrop-filter:blur(30px) saturate(200%);-webkit-backdrop-filter:blur(30px) saturate(200%)}\n.ytp-toast.error,.ytp-t-error{border-color:rgba(255,80,80,.55);background:linear-gradient(135deg,rgba(20,22,28,.6),rgba(255,80,80,.22))}\n.ytp-toast.info,.ytp-t-info{border-color:rgba(255,61,127,.55);background:linear-gradient(135deg,rgba(20,22,28,.6),rgba(255,61,127,.22))}\n.ytp-tabs{display:flex;gap:2px;padding:0 12px;border-bottom:1px solid rgba(255,255,255,.07);background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,0))}\n.ytp-tab{flex:1;padding:10px 6px;background:transparent;border:0;color:#a8b0c0;font:600 11.5px/1 system-ui;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;border-bottom:2px solid transparent;transition:color .15s,border-color .15s;text-shadow:0 1px 1px rgba(0,0,0,.3)}\n.ytp-tab:hover{color:#e8eaf0}\n.ytp-tab.active{color:#ff3d7f;border-bottom-color:#ff3d7f;text-shadow:0 0 8px rgba(255,61,127,.5)}\n.ytp-tabpanel{display:none;flex-direction:column;gap:6px;padding:4px 0 8px}\n.ytp-tabpanel.active{display:flex}\n.ytp-section-hdr{font:700 10.5px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;color:#9aa4b6;padding:14px 16px 6px;display:flex;align-items:center;gap:8px;text-shadow:0 1px 1px rgba(0,0,0,.3)}\n.ytp-section-hdr::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(255,255,255,.08),rgba(255,255,255,0))}\n.ytp-meter{height:8px;background:rgba(255,255,255,.06);border-radius:99px;overflow:hidden;position:relative}\n.ytp-meter-fill{height:100%;background:linear-gradient(90deg,#ff0033,#ff3d7f);border-radius:99px;transition:width .3s}\n.ytp-meter-fill.ok{background:linear-gradient(90deg,#4caf50,#8bc34a)}\n.ytp-meter-fill.warn{background:linear-gradient(90deg,#ffc107,#ff9800)}\n.ytp-meter-fill.crit{background:linear-gradient(90deg,#ff5722,#e91e63)}\n.ytp-kbd{font:10px ui-monospace,monospace;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-bottom-width:2px;border-radius:4px;padding:2px 6px;color:#dde;display:inline-block}\n.ytp-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:99px;background:rgba(255,61,127,.12);color:#ff8aa5;font:600 10.5px/1 system-ui;border:1px solid rgba(255,61,127,.25)}\n.ytp-chip.neutral{background:rgba(255,255,255,.05);color:#9aa;border-color:rgba(255,255,255,.1)}\n.ytp-divider{height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);margin:8px 0}\n#ytp-resume-overlay{position:absolute;inset:0;z-index:2147483640;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,rgba(20,22,28,.6) 0%,rgba(20,22,28,.85) 50%,rgba(20,22,28,.6) 100%);backdrop-filter:blur(14px) saturate(160%);-webkit-backdrop-filter:blur(14px) saturate(160%);font:14px/1.45 \"Inter\",\"Roboto\",system-ui,-apple-system,sans-serif;color:#fff;opacity:0;transition:opacity .22s ease-out;}\n#ytp-fcw-overlay{position:fixed;right:18px;top:80px;z-index:2147483638;width:min(320px,calc(100vw - 36px));background:rgba(20,22,28,.55);color:#eef;border:1px solid rgba(255,255,255,.12);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.5);backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px) saturate(160%);padding:12px 16px;font:12px/1.4 system-ui;}\n#ytp-comment-search{display:flex;gap:6px;align-items:center;background:rgba(20,22,28,.55);color:#eef;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:6px 10px;margin:8px 0;backdrop-filter:blur(14px) saturate(160%);-webkit-backdrop-filter:blur(14px) saturate(160%);box-shadow:0 4px 14px rgba(0,0,0,.35);}\n#ytp-comment-search .ytp-cs-input{flex:1;min-width:0;background:rgba(0,0,0,.25);color:#eef;border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:5px 8px;font:11.5px system-ui;outline:none;}\n#ytp-comment-search .ytp-cs-count{font-size:11px;color:#9aa;font-variant-numeric:tabular-nums;white-space:nowrap;}\n#ytp-comment-search .ytp-cs-clear{background:rgba(255,255,255,.07);border:0;color:#aaa;width:24px;height:24px;border-radius:5px;cursor:pointer;font-size:14px;line-height:1;}\n#ytp-comment-search .ytp-cs-clear:hover{background:rgba(255,255,255,.13);color:#fff}\n#ytp-chapter-panel .ytp-ch-hdr{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(255,255,255,.04);font-size:11.5px;font-weight:600;color:#cdd;}\n#ytp-chapter-panel .ytp-ch-toggle{background:none;border:0;color:#888;cursor:pointer;font-size:11px;padding:0 4px}\n#ytp-chapter-panel .ytp-ch-toggle:hover{color:#fff}\n#ytp-chapter-panel .ytp-ch-list{max-height:340px;overflow-y:auto;scrollbar-width:thin}\n#ytp-chapter-panel .ytp-ch-row{display:flex;gap:10px;padding:6px 12px;cursor:pointer;border-top:1px solid rgba(255,255,255,.03);transition:background .1s}\n#ytp-chapter-panel .ytp-ch-row:hover{background:rgba(255,255,255,.05)}\n#ytp-chapter-panel .ytp-ch-t{flex:0 0 auto;color:#5fc;font-variant-numeric:tabular-nums;font-size:11.5px;min-width:54px}\n#ytp-chapter-panel .ytp-ch-title{flex:1;min-width:0;font-size:12px;color:#ddd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n#ytp-extra-notes .ytp-extra-notes-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}\n#ytp-extra-notes .ytp-extra-notes-head button{background:none;border:0;color:#aaa;font-size:18px;cursor:pointer}\n#ytp-extra-notes textarea{width:100%;min-height:140px;background:rgba(0,0,0,.25);color:#eef;border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:8px;font:12px ui-monospace,SFMono-Regular,Consolas,monospace;resize:vertical}\n#ytp-extra-notes .ytp-extra-notes-foot{display:flex;justify-content:space-between;align-items:center;margin-top:6px;font:10.5px ui-monospace,monospace;color:#9aa}\n#ytp-extra-notes .ytp-extra-notes-foot button{background:linear-gradient(135deg,#ff0033 0%,#ff3d7f 100%);color:#fff;border:0;border-radius:5px;padding:4px 10px;cursor:pointer;font:600 11px system-ui}\n#ytp-fcw-overlay .ytp-fcw-title{flex:1;font-weight:600;color:#fff;font-size:13px}\n#ytp-fcw-overlay .ytp-fcw-sub{font-size:11px;color:#9aa;margin-top:4px}\n#ytp-fcw-overlay .ytp-fcw-bar{height:4px;background:rgba(255,255,255,.08);border-radius:3px;margin-top:6px;overflow:hidden}\n#ytp-fcw-overlay .ytp-fcw-stats{font-size:11px;color:#aaa;margin-top:4px}\n#ytp-fcw-overlay .ytp-fcw-btn{background:rgba(255,255,255,.07);border:0;border-radius:5px;color:#ddd;padding:6px 12px;cursor:pointer;font:600 11px system-ui}\n@media (max-width:540px){.ytp-dash{width:calc(100vw - 16px)!important;left:8px!important;right:8px!important;top:8px!important;max-height:calc(100vh - 16px)}.ytp-rng input{min-width:60px}.ytp-core{grid-template-columns:1fr}}\n@media (prefers-reduced-motion:reduce){.ytp-dash,.ytp-card,.ytp-btn,.ytp-knob{transition:none!important}}\n\n\n#ytp-extra-endwarn{left:50%;right:auto;bottom:120px;transform:translateX(-50%);opacity:0;transition:opacity .15s;color:#ffd166}\n\n\n.ytp-extra-comment-clamp{max-height:150px;overflow:hidden;display:block}\n.ytp-extra-expand-comment{margin-top:4px;border:0;border-radius:999px;background:rgba(62,166,255,.14);color:#3ea6ff;padding:3px 8px;font:700 11px system-ui;cursor:pointer}\n#ytp-sb-hud{position:fixed;left:10px;bottom:36px;z-index:2147483635;background:rgba(20,22,28,.5);color:#eef;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:5px 12px;font:11px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);box-shadow:0 6px 20px rgba(0,0,0,.4);}\n#ytp-sb-ov{position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:2147483639;background:rgba(20,22,28,.55);color:#eef;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:8px 18px;font:12px system-ui;backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px) saturate(160%);box-shadow:0 10px 30px rgba(0,0,0,.5);}\n#ytp-stats{position:fixed;top:60px;right:8px;z-index:2147483637;background:rgba(20,22,28,.5);color:#eef;border:1px solid rgba(255,255,255,.12);border-radius:10px;font:11px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;padding:6px 10px;line-height:1.5;max-width:380px;backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);box-shadow:0 6px 20px rgba(0,0,0,.4);}\n#ytp-diag{position:fixed;bottom:0;left:0;width:380px;max-height:200px;overflow:auto;z-index:2147483647;background:rgba(20,22,28,.55);color:#cdd;border:1px solid rgba(255,255,255,.12);border-radius:14px 14px 0 0;border-bottom:none;border-left:none;border-right:none;font:11px ui-monospace,SFMono-Regular,Consolas,monospace;padding:8px;backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px) saturate(160%);box-shadow:0 -8px 24px rgba(0,0,0,.4);}\n.ytp-sb-mark{pointer-events:none}\nbody.ytp-silent #ytp-toast,body.ytp-silent #ytp-sb-hud,body.ytp-silent #ytp-sb-ov,body.ytp-silent #ytp-stats,body.ytp-silent #ytp-diag,body.ytp-silent #ytp-cinema,body.ytp-silent #ytp-ambient,body.ytp-silent .ytp-sb-mark{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}\n#ytp-resume-card{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:2147483647;background:rgba(20,22,28,.55);color:#eef;border:1px solid rgba(255,255,255,.12);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.55),0 4px 16px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%);padding:14px 18px;font:13px/1.45 \"Inter\",\"Roboto\",system-ui,-apple-system,sans-serif;min-width:300px;max-width:min(92%,520px);opacity:0;transform:translateX(-50%) translateY(8px);transition:opacity .2s ease-out,transform .2s ease-out;}\n@keyframes ytpResIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}\nbody.ytp-silent #ytp-resume-card{display:none!important}\n#ytp-chapter-panel{margin:8px 0 12px;background:rgba(20,22,28,.45);color:#e8e8e8;border:1px solid rgba(255,255,255,.1);border-radius:12px;overflow:hidden;font:13px/1.45 system-ui;backdrop-filter:blur(14px) saturate(160%);-webkit-backdrop-filter:blur(14px) saturate(160%);box-shadow:0 4px 16px rgba(0,0,0,.3);}\n.ytp-ch-hdr{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(255,255,255,.03);font-size:11.5px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:.05em}\n.ytp-ch-toggle{background:none;border:0;color:#888;cursor:pointer;font-size:11px;padding:0 4px}\n.ytp-ch-toggle:hover{color:#fff}\n.ytp-ch-list{max-height:340px;overflow-y:auto;scrollbar-width:thin}\n.ytp-ch-row{display:flex;gap:10px;padding:6px 12px;cursor:pointer;border-top:1px solid rgba(255,255,255,.03);transition:background .1s}\n.ytp-ch-row:hover{background:rgba(255,255,255,.05)}\n.ytp-ch-t{flex:0 0 auto;color:#5fc;font-variant-numeric:tabular-nums;font-size:11.5px;min-width:54px}\n.ytp-ch-title{flex:1;min-width:0;font-size:12px;color:#ddd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n#ytp-comment-search{display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;margin:0 0 12px;font:13px system-ui}\n.ytp-cs-input{flex:1;min-width:0;background:rgba(0,0,0,.4);color:#e8e8e8;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:6px 10px;font:inherit;font-size:13px;outline:none}\n.ytp-cs-input:focus{border-color:#3ea6ff}\n.ytp-cs-count{font-size:11px;color:#888;font-variant-numeric:tabular-nums;white-space:nowrap}\n.ytp-cs-clear{background:rgba(255,255,255,.07);border:0;color:#aaa;width:24px;height:24px;border-radius:5px;cursor:pointer;font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center}\n.ytp-cs-clear:hover{background:rgba(255,255,255,.13);color:#fff}\n.ytp-elem-sec-title{font-size:10.5px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.07em;margin:10px 0 4px;padding-top:6px;border-top:1px solid rgba(255,255,255,.06)}\n.ytp-net-panel{display:flex;flex-direction:column;gap:8px;margin-top:6px}\n.ytp-net-cards{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}\n.ytp-net-card{background:rgba(159,255,255,.05);border:1px solid rgba(159,255,255,.12);border-radius:7px;padding:8px 10px;display:flex;flex-direction:column;gap:2px}\n.ytp-net-card-label{font-size:10px;color:#9ff;text-transform:uppercase;letter-spacing:.08em;font-weight:700}\n.ytp-net-card-value{font-size:15px;color:#eee;font-weight:700;font-variant-numeric:tabular-nums}\n.ytp-net-card-sub{font-size:10px;color:#888}\n.ytp-net-session{font:11px ui-monospace,monospace;color:#9ff;background:rgba(255,255,255,.03);border-radius:5px;padding:5px 8px}\n.ytp-net-legend{display:flex;gap:14px;justify-content:flex-end;padding:0 4px;margin-top:2px}\n.ytp-net-legend-item{display:inline-flex;align-items:center;gap:5px;font:11px/1.2 system-ui;color:#cfcfcf}\n.ytp-net-swatch{display:inline-block;width:12px;height:12px;border-radius:3px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}\n.ytp-net-swatch-dn{background:linear-gradient(180deg,#4dd0e1 0%,#0288d1 100%)}\n.ytp-net-swatch-up{background:linear-gradient(180deg,#ff8a65 0%,#c62828 100%)}\n.ytp-net-chart{display:flex;align-items:flex-end;gap:2px;height:120px;padding:6px 4px;background:rgba(0,0,0,.35);border-radius:6px;border:1px solid rgba(255,255,255,.06);position:relative;overflow:hidden}\n.ytp-net-chart::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(255,255,255,.06);pointer-events:none}\n.ytp-net-bar{flex:1;min-width:2px;display:flex;flex-direction:column;justify-content:flex-end;height:100%;position:relative;cursor:default;transition:opacity .12s}\n.ytp-net-bar:hover{opacity:.85}\n.ytp-net-bar-dn{background:linear-gradient(180deg,#4dd0e1 0%,#0288d1 100%);border-bottom-left-radius:2px;border-bottom-right-radius:2px;box-shadow:inset 0 1px 0 rgba(255,255,255,.18);transition:filter .12s}\n.ytp-net-bar-up{background:linear-gradient(180deg,#ff8a65 0%,#c62828 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.22);border-top-left-radius:2px;border-top-right-radius:2px;transition:filter .12s}\n.ytp-net-bar:hover .ytp-net-bar-dn,.ytp-net-bar:hover .ytp-net-bar-up{filter:brightness(1.25) saturate(1.2)}\n.ytp-net-card:nth-child(1){background:rgba(159,255,255,.06);border-color:rgba(159,255,255,.18)}\n.ytp-net-card:nth-child(1) .ytp-net-card-label{color:#9ff}\n.ytp-net-card:nth-child(2){background:rgba(2,136,209,.10);border-color:rgba(77,208,225,.28)}\n.ytp-net-card:nth-child(2) .ytp-net-card-label,.ytp-net-card:nth-child(2) .ytp-net-card-value{color:#4dd0e1}\n.ytp-net-card:nth-child(3){background:rgba(198,40,40,.10);border-color:rgba(255,138,101,.28)}\n.ytp-net-card:nth-child(3) .ytp-net-card-label,.ytp-net-card:nth-child(3) .ytp-net-card-value{color:#ff8a65}\n.ytp-net-axis{display:flex;justify-content:space-between;font:10px ui-monospace,monospace;color:#666;padding:0 4px}\n.ytp-net-hosts{display:flex;flex-direction:column;gap:2px;background:rgba(255,255,255,.025);border-radius:6px;padding:6px 8px}\n.ytp-net-host-row{display:flex;justify-content:space-between;align-items:center;font-size:11px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04)}\n.ytp-net-host-row:last-child{border-bottom:0}\n.ytp-net-host-name{color:#ddd;font-family:ui-monospace,monospace;font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}\n.ytp-net-host-bytes{color:#9ff;font-variant-numeric:tabular-nums;flex-shrink:0;margin-left:8px}\n.ytp-net-budget{background:rgba(255,255,255,.025);border-radius:6px;padding:8px 10px;display:flex;flex-direction:column;gap:5px}\n.ytp-net-budget-bar{height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden}\n.ytp-net-budget-fill{height:100%;background:linear-gradient(90deg,#4caf50,#8bc34a);border-radius:4px;transition:width .3s}\n.ytp-net-budget-fill.warn{background:linear-gradient(90deg,#ffc107,#ff9800)}\n.ytp-net-budget-fill.crit{background:linear-gradient(90deg,#ff5722,#e91e63)}\n.ytp-net-budget-fill.over{background:linear-gradient(90deg,#e53935,#b71c1c);animation:ytpBudgetPulse 1.4s ease-in-out infinite}\n@keyframes ytpBudgetPulse{0%,100%{opacity:1}50%{opacity:.55}}\n.ytp-net-budget-detail{font:11px ui-monospace,monospace;color:#ddd;font-variant-numeric:tabular-nums}\n.ytp-net-qualities{background:rgba(255,255,255,.025);border-radius:6px;padding:6px 8px;display:flex;flex-direction:column;gap:4px}\n.ytp-net-q-row{display:grid;grid-template-columns:64px 1fr 110px;gap:8px;align-items:center}\n.ytp-net-q-lbl{color:#fff;font:700 10px/1 system-ui;text-align:center;padding:3px 4px;border-radius:3px;letter-spacing:.04em}\n.ytp-net-q-track{height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden}\n.ytp-net-q-fill{height:100%;border-radius:4px;transition:width .25s}\n.ytp-net-q-bytes{font:10.5px ui-monospace,monospace;color:#ccc;text-align:right;font-variant-numeric:tabular-nums}\n.ytp-perf-panel{display:flex;flex-direction:column;gap:6px;margin-top:6px}\n.ytp-perf-mem{font:11px ui-monospace,monospace;color:#9ff;background:rgba(255,255,255,.03);border-radius:5px;padding:5px 8px}\n.ytp-perf-membar{height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden}\n.ytp-perf-memfill{height:100%;background:#4caf50;border-radius:3px;transition:width .3s,background .3s}\n.ytp-perf-state{font:10.5px ui-monospace,monospace;color:#aaa;padding:3px 0}\n.ytp-perf-table{display:flex;flex-direction:column;background:rgba(255,255,255,.02);border-radius:5px;overflow:hidden;font:10.5px ui-monospace,monospace}\n.ytp-perf-row{display:grid;grid-template-columns:1.4fr .5fr .7fr .7fr .7fr;padding:3px 8px;gap:6px;border-bottom:1px solid rgba(255,255,255,.04);align-items:center}\n.ytp-perf-hdr{font-weight:700;color:#9ff;background:rgba(255,255,255,.05);border-bottom:1px solid rgba(255,255,255,.1)}\n.ytp-perf-row .ytp-perf-c1{color:#ddd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.ytp-perf-row .ytp-perf-c2,.ytp-perf-row .ytp-perf-c3,.ytp-perf-row .ytp-perf-c4,.ytp-perf-row .ytp-perf-c5{text-align:right;font-variant-numeric:tabular-nums;color:#ccc}\n.ytp-sbsub-panel{display:flex;flex-direction:column;gap:6px}\n.ytp-sbsub-status{font:11px ui-monospace,monospace;background:rgba(255,255,255,.03);border-radius:5px;padding:6px 8px;color:#888}\n.ytp-hk-row{display:grid;grid-template-columns:1fr 160px 30px;gap:6px;align-items:center;padding:3px 0}\n.ytp-hk-lbl{font-size:12px;color:#ddd}\n.ytp-hk-key{font:11px ui-monospace,monospace;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:5px 8px;color:#9ff;cursor:pointer;text-align:center}\n.ytp-hk-key.listening{background:rgba(200,0,0,.2);border-color:#c00;color:#fff;animation:ytpHkBlink 1s linear infinite}\n.ytp-hk-key.empty{color:#666;font-style:italic}\n@keyframes ytpHkBlink{50%{opacity:.5}}\n.ytp-hk-clr{background:rgba(255,255,255,.05);border:0;border-radius:4px;color:#888;cursor:pointer;font-size:14px;line-height:1;padding:0}\n.ytp-hk-clr:hover{background:rgba(200,0,0,.2);color:#fff}\n.ytp-stop-btn{color:#fff!important;opacity:.9!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}\n.ytp-stop-btn:hover{opacity:1!important;color:#ff5252!important}.ytp-drop-box{position:fixed;z-index:2147483635;padding:4px 8px;background:rgba(20,22,28,.78);color:#ff8a96;border:1px solid rgba(255,138,150,.28);border-radius:6px;font:11px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:none;min-width:80px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.35);transition:color .2s}\n.ytp-drop-box:hover{opacity:.85}\n.ytp-vstats-box{position:fixed;z-index:2147483635;padding:6px 10px;background:rgba(20,22,28,.82);color:#ddd;border:1px solid rgba(255,255,255,.14);border-radius:8px;font:10.5px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:none;min-width:200px;box-shadow:0 6px 20px rgba(0,0,0,.45)}\n.ytp-vstats-box canvas{display:block;margin-top:4px;width:100%;height:24px;background:rgba(0,0,0,.35);border-radius:3px}\n.ytp-stop-btn svg{width:22px;height:22px;pointer-events:none;filter:drop-shadow(0 1px 1px rgba(0,0,0,.55))}.ytp-fps-box{position:fixed;z-index:2147483635;padding:3px 7px;background:rgba(20,22,28,.78);color:#9ff;border:1px solid rgba(159,255,255,.28);border-radius:6px;font:11px/1 ui-monospace,SFMono-Regular,Consolas,monospace;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:none;min-width:54px;text-align:center;transition:opacity .2s;box-shadow:0 4px 12px rgba(0,0,0,.35)}\n.ytp-fps-box:hover{opacity:.85}\n.ytp-buf-box{position:fixed;z-index:2147483635;left:8px;bottom:48px;padding:6px 10px;background:rgba(20,22,28,.78);color:#ddd;border:1px solid rgba(255,255,255,.14);border-radius:8px;font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);min-width:160px;pointer-events:none;box-shadow:0 6px 20px rgba(0,0,0,.4)}\n.ytp-buf-bar{height:4px;background:rgba(255,255,255,.12);border-radius:3px;margin-top:4px;overflow:hidden}\n.ytp-buf-fill{height:100%;width:0;background:#4caf50;border-radius:3px;transition:width .3s,background .3s}\n@media (max-width:500px){.ytp-net-cards{grid-template-columns:1fr 1fr}}\n.ytp-elem-status{font-size:11px;color:#888;padding:2px 0 6px;font-variant-numeric:tabular-nums}\n.ytp-preset-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}\n.ytp-preset-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:7px;padding:8px 10px;cursor:pointer;transition:background .12s,border-color .12s}\n.ytp-preset-card:hover{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14)}\n.ytp-preset-card.active{background:rgba(200,0,0,.12);border-color:rgba(200,0,0,.35)}\n.ytp-preset-name{font-size:12px;font-weight:600;color:#e0e0e0;margin-bottom:2px}\n.ytp-preset-desc{font-size:10px;color:#888;line-height:1.35}\n.ytp-elem-list{display:flex;flex-direction:column;gap:1px;max-height:380px;overflow-y:auto;background:rgba(255,255,255,.015);border-radius:6px;padding:3px;scrollbar-width:thin}\n.ytp-elem-group-hdr{font:600 10px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:#888;padding:8px 8px 3px;margin-top:3px;border-top:1px solid rgba(255,255,255,.04)}\n.ytp-elem-group-hdr:first-child{border-top:0;margin-top:0}\n.ytp-elem-row{display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:4px;cursor:default;transition:background .1s}\n.ytp-elem-row:hover{background:rgba(62,166,255,.1)}\n.ytp-elem-row.on{background:rgba(255,80,80,.07)}\n.ytp-elem-row.nomatch{opacity:.4}\n.ytp-elem-cb{margin:0;cursor:pointer;width:14px;height:14px;accent-color:#c00;flex-shrink:0}\n.ytp-elem-name{flex:1;min-width:0;font-size:11.5px;color:#ddd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.ytp-elem-match{font:10px ui-monospace,monospace;color:#555;flex-shrink:0;font-variant-numeric:tabular-nums}\n#ytp-elem-hover{animation:ytpElemFade .1s ease-out}\n@keyframes ytpElemFade{from{opacity:0}to{opacity:1}}\n.ytp-hist-note{font-size:10px;color:#666;line-height:1.5;margin-top:6px;padding:6px 8px;background:rgba(255,255,255,.02);border-radius:4px}\n.ytp-geo-sel{position:relative;width:100%}\n.ytp-geo-input{width:100%}\n.ytp-geo-dd{position:absolute;top:100%;left:0;right:0;z-index:2147483646;max-height:260px;overflow-y:auto;background:rgba(18,20,26,.92);border:1px solid rgba(255,255,255,.14);border-radius:10px;margin-top:4px;box-shadow:0 18px 40px rgba(0,0,0,.6),0 4px 12px rgba(0,0,0,.4);backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);scrollbar-width:thin}\n.ytp-geo-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;font-size:11.5px;color:#ddd;cursor:pointer;user-select:none}\n.ytp-geo-row:hover,.ytp-geo-row.hot{background:rgba(200,0,0,.18);color:#fff}\n.ytp-geo-row.selected{background:rgba(200,0,0,.32);color:#fff;font-weight:600}\n.ytp-geo-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.ytp-geo-code{flex-shrink:0;font-size:10px;color:#888;font-variant:tabular-nums;text-transform:uppercase}\n.ytp-geo-empty{padding:10px;text-align:center;color:#666;font-size:11px}\n.ytp-geo-status{background:rgba(255,255,255,.04);border-radius:5px;padding:6px 9px;font:11px ui-monospace,monospace;color:#5fc;margin:6px 0}\n.ytp-theme-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:6px;margin:4px 0}\n.ytp-theme-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:7px;padding:6px;cursor:pointer;text-align:center;transition:border-color .12s,background .12s}\n.ytp-theme-card:hover{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14)}\n.ytp-theme-card.active{border-color:#c00;background:rgba(200,0,0,.1)}\n.ytp-theme-card.reset{padding:10px;margin-top:6px}\n.ytp-theme-swatch{width:100%;height:32px;border-radius:4px;border:1px solid rgba(255,255,255,.1);margin-bottom:4px;display:flex;align-items:flex-end;justify-content:flex-end;padding:3px}\n.ytp-theme-accent{width:10px;height:10px;border-radius:50%}\n.ytp-theme-name{font-size:10px;color:#ccc;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.ytp-toggle-pill{font:700 10px system-ui;padding:3px 8px;border-radius:999px;letter-spacing:.02em;text-transform:uppercase;display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:18px;transition:background .15s,color .15s}\n.ytp-ivs-mark:hover{background:rgba(255,61,127,1)!important;z-index:2}\n@media (max-width:500px){.ytp-dash{width:calc(100vw - 16px)!important;left:8px!important;right:8px!important;max-height:calc(100vh - 16px)}.ytp-rng input{min-width:60px}.ytp-core{grid-template-columns:1fr}}\n#ytp-palette{display:none;flex-direction:column}\n#ytp-palette .ytp-palette-input{appearance:none;background:transparent;color:#fff;border:0;border-bottom:1px solid rgba(255,255,255,.12);padding:14px 18px;font:600 15px/1.2 \"Inter\",\"Roboto\",system-ui,-apple-system,sans-serif;outline:none;letter-spacing:.01em}\n#ytp-palette .ytp-palette-input::placeholder{color:#7a8290;font-weight:400}\n#ytp-palette .ytp-palette-results{flex:1;min-height:0;overflow-y:auto;padding:4px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent}\n#ytp-palette .ytp-palette-results::-webkit-scrollbar{width:6px}\n#ytp-palette .ytp-palette-results::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:6px}\n#ytp-palette .ytp-palette-row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;cursor:pointer;transition:background .1s}\n#ytp-palette .ytp-palette-row.active,#ytp-palette .ytp-palette-row:hover{background:rgba(255,61,127,.18)}\n#ytp-palette .ytp-palette-lbl{font-size:13.5px;color:#f0f2f7;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n#ytp-palette .ytp-palette-hint{font-size:11px;color:#9aa;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;white-space:nowrap}\n#ytp-palette .ytp-palette-empty{padding:24px 18px;color:#7a8290;font-size:12.5px;text-align:center;font-style:italic}\n#ytp-palette .ytp-palette-foot{padding:8px 14px;border-top:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.2);color:#9aa;font-size:11px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}\n#ytp-cheat{display:none;flex-direction:column}\n#ytp-cheat .ytp-cheat-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.1);background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,0))}\n#ytp-cheat .ytp-cheat-title{font:700 15px/1 \"Inter\",\"Roboto\",system-ui,-apple-system,sans-serif;color:#fff;letter-spacing:.02em}\n#ytp-cheat .ytp-cheat-filter{appearance:none;background:rgba(255,255,255,.05);color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:8px 12px;margin:10px 14px 4px;font:inherit;font-size:13px;outline:none;flex-shrink:0}\n#ytp-cheat .ytp-cheat-filter::placeholder{color:#7a8290}\n#ytp-cheat .ytp-cheat-filter:focus{border-color:rgba(255,61,127,.55);box-shadow:0 0 0 3px rgba(255,61,127,.15)}\n#ytp-cheat .ytp-cheat-body{flex:1;min-height:0;overflow-y:auto;padding:6px 14px 10px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent}\n#ytp-cheat .ytp-cheat-body::-webkit-scrollbar{width:6px}\n#ytp-cheat .ytp-cheat-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:6px}\n#ytp-cheat .ytp-cheat-cat{font:700 10.5px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;color:#9aa4b6;padding:10px 0 4px;display:flex;align-items:center;gap:8px}\n#ytp-cheat .ytp-cheat-cat::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(255,255,255,.08),rgba(255,255,255,0))}\n#ytp-cheat .ytp-cheat-row{display:grid;grid-template-columns:1fr 110px 1fr;align-items:center;gap:10px;padding:5px 0;font-size:12.5px}\n#ytp-cheat .ytp-cheat-lbl{color:#e5e7ed;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n#ytp-cheat .ytp-cheat-key{text-align:right}\n#ytp-cheat .ytp-cheat-hint{color:#7a8290;font-size:11px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n#ytp-cheat .ytp-cheat-foot{padding:8px 14px;border-top:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.2);color:#9aa;font-size:11px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}\n@media (max-width:500px){#ytp-palette,#ytp-cheat{width:calc(100vw - 16px)!important;left:8px!important;right:8px!important;top:8px!important;transform:translateX(0)!important;max-height:80vh!important}#ytp-cheat .ytp-cheat-row{grid-template-columns:1fr 90px}}\n';
          try {
            GM_addStyle(e);
            const t = document.createElement("meta");
            ((t.id = "ytp-dash-style"),
              t.setAttribute("name", "ytp-dash-style"),
              document.head.appendChild(t));
          } catch (t) {
            const a = document.createElement("style");
            ((a.id = "ytp-dash-style"),
              (a.textContent = e),
              (document.head || document.documentElement).appendChild(a));
          }
        })(),
          (wo = To("aside", "ytp-dash")),
          wo.setAttribute("role", "dialog"),
          wo.setAttribute("aria-label", "YT-zen dashboard"));
        const t = To("div", "ytp-dhdr");
        t.classList.add("ytp-dhandle");
        const r = To("div", "ytp-dtitle");

        const _grip = document.createElement("span");
        _grip.className = "ytp-dgrip";
        _grip.setAttribute("aria-hidden", "true");
        _grip.textContent = "[=]";
        const _name = document.createTextNode(" YT-zen ");
        const _ver = document.createElement("span");
        _ver.className = "ytp-dver";
        _ver.textContent = "v" + n;
        r.appendChild(_grip);
        r.appendChild(_name);
        r.appendChild(_ver);
        const o = To("div", "ytp-dhbtns"),
          i = Oo(
            "⧉",
            () => {
              const e = window.innerWidth,
                t = window.innerHeight,
                a = Math.min(460, e - 16),
                n = Math.min(t - 24, 760);
              (zo({ x: e - a - 16, y: 56, w: a, h: n }),
                jo(e - a - 16, 56, a, n));
            },
            "ytp-close",
          );
        ((i.title = "Dock to top-right"), i.classList.add("ytp-no-drag"));
        const d = Oo("[x]", Ko, "ytp-close");
        ((d.title = "Close (Esc)"),
          d.classList.add("ytp-no-drag"),
          o.appendChild(i),
          o.appendChild(d),
          t.appendChild(r),
          t.appendChild(o));
        const c = document.createElement("input");
        ((c.type = "search"),
          (c.className = "ytp-search ytp-no-drag"),
          (c.placeholder = "Find a setting…"));
        const l = To("div", "ytp-body"),
          p = To("div", "ytp-core");
        ([
          ["Private mode", "privacyShieldOn"],
          ["Safe mode", "safeMode"],
          ["Quiet on-screen messages", "silentToasts"],
        ].forEach(([e, t]) => {
          const a = To("div", "ytp-corecell");
          (a.appendChild(To("span", "ytp-corelbl", e)),
            a.appendChild(Bo(t)),
            p.appendChild(a));
        }),
          l.appendChild(p));
        const u = Array.from(va.values())
            .filter((e) => !e.hidden)
            .sort((e, t) =>
              String(e.name || e.id).localeCompare(
                String(t.name || t.id),
                void 0,
                { sensitivity: "base" },
              ),
            ),
          h = Math.min(20, u.length),
          m = document.createDocumentFragment();
        for (let e = 0; e < h; e++) m.appendChild(Do(u[e]));
        (l.appendChild(m),
          u.length > h &&
            (async () => {
              for (let e = h; e < u.length; e += 12) {
                if ((await ne(), !wo)) return;
                const t = document.createDocumentFragment(),
                  a = Math.min(e + 12, u.length);
                for (let n = e; n < a; n++) t.appendChild(Do(u[n]));
                l.appendChild(t);
              }
            })());
        const y = To("div", "ytp-foot");
        (y.appendChild(Oo("Save my settings", () => Go())),
          y.appendChild(Oo("Mark this video as watched", Ut, "primary")),
          y.appendChild(Oo("Load settings from file", () => Xo())),
          y.appendChild(
            Oo(
              "Start over",
              () =>
                (function () {
                  if (
                    "function" == typeof e.confirm &&
                    !e.confirm(
                      "Start over with the default settings? Your saved notes, bookmarks, and history will stay.",
                    )
                  )
                    return;
                  const t = Object.assign({}, S);
                  ((S = Object.assign({}, s)), Y(), ue(), xa.applyAll());
                  for (const e of Object.keys(S))
                    t[e] !== S[e] &&
                      g.emit("cfg.changed", { key: e, val: S[e] });
                  pe(
                    "Everything’s been reset to its starting state.",
                    2e3,
                    "success",
                  );
                })(),
              "ytp-danger",
            ),
          ),
          c.addEventListener(
            "input",
            ee(() => {
              const e = c.value.trim().toLowerCase();
              l.querySelectorAll(".ytp-card").forEach((t) => {

                const a = va.get(t.dataset.feat);
                if (!a) {
                  t.style.display = "none";
                  return;
                }
                const n =
                  !e ||
                  a.name.toLowerCase().includes(e) ||
                  (a.summary || "").toLowerCase().includes(e) ||
                  a.id.includes(e);
                t.style.display = n ? "" : "none";
              });
            }, 80),
          ),
          wo.appendChild(t),
          wo.appendChild(c),
          wo.appendChild(l),
          wo.appendChild(y),
          document.body.appendChild(wo),
          zo(
            (function () {
              const e = window.innerWidth,
                t = window.innerHeight,
                a = S.dashW > 0 ? S.dashW : 460,
                n = S.dashH > 0 ? S.dashH : Math.min(t - 40, 720);
              return Yp_clampRect(
                S.dashX >= 0 ? S.dashX : Math.max(8, e - a - 16),
                S.dashY >= 0 ? S.dashY : 56,
                a,
                n,
              );
            })(),
          ),
          (function (e) {
            let t = !1,
              a = 0,
              n = 0,
              r = 0,
              o = 0;
            const i = (e) => {
                if (!t) return;
                const i = e.clientX - a,
                  d = e.clientY - n,
                  c = Yp_clampRect(r + i, o + d, wo.offsetWidth, wo.offsetHeight);
                ((wo.style.left = c.x + "px"),
                  (wo.style.top = c.y + "px"),
                  (wo.style.right = "auto"),
                  (wo.style.bottom = "auto"));
              },
              d = () => {
                if (!t) return;
                ((t = !1),
                  wo.classList.remove("dragging"),
                  window.removeEventListener("pointermove", i, !0),
                  window.removeEventListener("pointerup", d, !0));
                const e = wo.getBoundingClientRect();
                jo(e.left, e.top, e.width, e.height);
              };
            e.addEventListener("pointerdown", (c) => {
              if (0 !== c.button) return;
              if (
                c.target.closest(
                  "button,input,select,textarea,a,.ytp-sw,.ytp-search,.ytp-no-drag",
                )
              )
                return;
              const s = wo.getBoundingClientRect();
              ((r = s.left),
                (o = s.top),
                (a = c.clientX),
                (n = c.clientY),
                (t = !0),
                wo.classList.add("dragging"),
                c.preventDefault(),
                window.addEventListener("pointermove", i, !0),
                window.addEventListener("pointerup", d, !0));
              try {
                e.setPointerCapture(c.pointerId);
              } catch (e) {}
            });
          })(t),
          (function () {
            const e = document.createElement("div");
            ((e.className = "ytp-dresize"),
              (e.title = "Drag to resize"),
              wo.appendChild(e));
            let t = !1,
              a = 0,
              n = 0,
              r = 0,
              o = 0;
            (e.addEventListener("pointerdown", (i) => {
              if (0 === i.button) {
                ((t = !0),
                  (a = i.clientX),
                  (n = i.clientY),
                  (r = wo.offsetWidth),
                  (o = wo.offsetHeight),
                  wo.classList.add("resizing"),
                  i.preventDefault(),
                  i.stopPropagation());
                try {
                  e.setPointerCapture(i.pointerId);
                } catch (e) {}
              }
            }),
              window.addEventListener(
                "pointermove",
                (e) => {
                  if (!t) return;
                  const i = wo.getBoundingClientRect(),
                    d = Yp_clampRect(
                      i.left,
                      i.top,
                      r + (e.clientX - a),
                      o + (e.clientY - n),
                    );
                  ((wo.style.width = d.w + "px"),
                    (wo.style.height = d.h + "px"));
                },
                !0,
              ),
              window.addEventListener(
                "pointerup",
                () => {
                  if (!t) return;
                  ((t = !1), wo.classList.remove("resizing"));
                  const e = wo.getBoundingClientRect();
                  jo(e.left, e.top, e.width, e.height);
                },
                !0,
              ));
          })(),
          window.addEventListener("resize", Wo, { passive: !0 }),
          requestAnimationFrame(() => {
            wo && wo.classList.add("open");
          }));
      })();
  }
  function Ko() {
    if (wo) {
      wo.classList.remove("open");
      try {
        window.removeEventListener("resize", Wo);
      } catch (e) {}
      for (let e = Co.length - 1; e >= 0; e--)
        try {
          Co[e]();
        } catch (e) {}
      ((Co.length = 0),
        setTimeout(() => {
          wo && (wo.remove(), (wo = null));
        }, 250));
    }
  }
  function Yo() {
    wo ? Ko() : Uo();
  }
  async function Go() {
    const e = {
        version: n,
        ts: Date.now(),
        cfg: S,
        history: await Ie(),
        bookmarks: await w("bookmarks", "ts", "prev"),
      },
      t = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }),
      a = URL.createObjectURL(t),
      r = document.createElement("a");
    ((r.href = a),
      (r.download =
        "ytplus-settings-" + new Date().toISOString().slice(0, 10) + ".json"),
      document.body.appendChild(r),
      r.click(),
      r.remove(),
      setTimeout(() => URL.revokeObjectURL(a), 6e3),
      pe("Settings saved.", 1800, "success"));
  }
  function Xo() {
    const e = document.createElement("input");
    ((e.type = "file"),
      (e.accept = ".json,application/json"),
      e.addEventListener(
        "change",
        () => {
          const t = e.files && e.files[0];
          if (!t) return;
          const a = new FileReader();
          ((a.onload = async (e) => {
            try {
              const t = JSON.parse(e.target.result),
                a = Object.assign({}, S);
              (t.cfg && (S = Object.assign({}, s, D(t.cfg))),

                Array.isArray(t.history) &&
                  (await Promise.all(
                    t.history
                      .filter(
                        (e) =>
                          e &&
                          "object" == typeof e &&
                          "string" == typeof e.videoId &&
                          e.videoId,
                      )
                      .map((e) => Be(e)),
                  )),
                Array.isArray(t.bookmarks) &&
                  (await Promise.all(
                    t.bookmarks
                      .filter(
                        (e) =>
                          e &&
                          "object" == typeof e &&
                          "string" == typeof e.id &&
                          e.id,
                      )
                      .map((e) => k("bookmarks", e)),
                  )),
                Y(),
                ue(),
                xa.applyAll());
              for (const e of Object.keys(S))
                a[e] !== S[e] && g.emit("cfg.changed", { key: e, val: S[e] });
              pe("Settings loaded.", 1800, "success");
            } catch (e) {
              pe("Couldn’t read that file.", 1800, "error");
            }
          }),
            a.readAsText(t));
        },
        { once: !0 },
      ),
      e.click());
  }
  const Zo = [
    {
      id: "toggleDash",
      label: "Open/close dashboard",
      def: "Alt+KeyY",
      gated: !1,
      run: () => Yo(),
    },
    {
      id: "forceWatched",
      label: "Force watched",
      def: "Shift+KeyW",
      gated: "forceWatchedOn",
      run: () => {
        Promise.resolve().then(Ut);
      },
    },
    {
      id: "stopPlayback",
      label: "Stop playback (reset + pause)",
      def: "Shift+KeyS",
      gated: "stopButtonOn",
      run: () => yr(),
    },
    {
      id: "abSetA",
      label: "A-B: set A point",
      def: "BracketLeft",
      gated: "abLoopOn",
      needHotkeyOptIn: !0,
      run: () => {
        const e = ie.el();
        e &&
          (Ta("abA", e.currentTime),
          pe("A=" + ce(e.currentTime), 1300, "info"));
      },
    },
    {
      id: "abSetB",
      label: "A-B: set B point",
      def: "BracketRight",
      gated: "abLoopOn",
      needHotkeyOptIn: !0,
      run: () => {
        const e = ie.el();
        e &&
          (Ta("abB", e.currentTime),
          pe("B=" + ce(e.currentTime), 1300, "info"));
      },
    },
    {
      id: "abClear",
      label: "A-B: clear",
      def: "Backslash",
      gated: "abLoopOn",
      needHotkeyOptIn: !0,
      run: () => {
        (Oa({ abA: -1, abB: -1 }), pe("AB cleared", 1300, "info"));
      },
    },
    {
      id: "bookmarkNow",
      label: "Bookmark current time",
      def: "KeyB",
      gated: "bookmarksOn",
      needHotkeyOptIn: !0,
      run: () => et(),
    },
    {
      id: "togglePiP",
      label: "Toggle Picture-in-Picture",
      def: "KeyP",
      gated: "pipOn",
      needHotkeyOptIn: !0,
      run: () => Pa(),
    },
    {
      id: "screenshot",
      label: "Screenshot frame",
      def: "KeyX",
      gated: "screenshotOn",
      needHotkeyOptIn: !0,
      run: () => Ia(),
    },
    {
      id: "watchLater",
      label: "Toggle Watch Later",
      def: "Alt+KeyW",
      gated: "watchLaterQuick",
      needHotkeyOptIn: !0,
      run: () => {
        const e = document.querySelector('button[aria-label*="Watch later"]');
        e && (e.click(), pe("Watch Later toggled", 1500, "success"));
      },
    },
    {
      id: "subscribe",
      label: "Toggle Subscribe",
      def: "Alt+KeyU",
      gated: "subscribeShortcut",
      needHotkeyOptIn: !0,
      run: () => {
        const e = document.querySelector(
          "ytd-subscribe-button-renderer button",
        );
        e && (e.click(), pe("Subscribe toggled", 1500, "success"));
      },
    },
    {
      id: "frameBack",
      label: "Frame step back",
      def: "Comma",
      gated: "frameStep",
      needHotkeyOptIn: !0,
      run: () => {
        const e = ie.el();
        e && e.paused && (e.currentTime -= 1 / 30);
      },
    },
    {
      id: "frameFwd",
      label: "Frame step forward",
      def: "Period",
      gated: "frameStep",
      needHotkeyOptIn: !0,
      run: () => {
        const e = ie.el();
        e && e.paused && (e.currentTime += 1 / 30);
      },
    },
    {
      id: "chapterPrev",
      label: "Previous chapter",
      def: "KeyP",
      gated: "chapterHotkeysOn",
      needHotkeyOptIn: !0,
      run: () => Er(-1),
    },
    {
      id: "chapterNext",
      label: "Next chapter",
      def: "KeyN",
      gated: "chapterHotkeysOn",
      needHotkeyOptIn: !0,
      run: () => Er(1),
    },
    {
      id: "sbSubmitA",
      label: "SB Submit: mark A",
      def: "Shift+Alt+KeyA",
      gated: "sbSubmitOn",
      run: () => {
        const e = ie.el();
        e &&
          ((io = e.currentTime), pe("SB submit A = " + ce(io), 1200, "info"));
      },
    },
    {
      id: "sbSubmitB",
      label: "SB Submit: mark B",
      def: "Shift+Alt+KeyB",
      gated: "sbSubmitOn",
      run: () => {
        const e = ie.el();
        e &&
          ((co = e.currentTime), pe("SB submit B = " + ce(co), 1200, "info"));
      },
    },
  ];
  function Qo(e) {
    const t = S.hotkeyMap || {};
    return e.id in t ? t[e.id] || null : e.def;
  }
  function Jo(e) {
    if (!e.code) return "";
    if (
      [
        "ShiftLeft",
        "ShiftRight",
        "ControlLeft",
        "ControlRight",
        "AltLeft",
        "AltRight",
        "MetaLeft",
        "MetaRight",
      ].includes(e.code)
    )
      return "";
    const t = [];
    return (
      e.ctrlKey && t.push("Ctrl"),
      e.shiftKey && t.push("Shift"),
      e.altKey && t.push("Alt"),
      e.metaKey && t.push("Meta"),
      t.push(e.code),
      t.join("+")
    );
  }
  function $o(e) {
    return e
      ? e
          .replace(/^Key([A-Z])$/, "$1")
          .replace(/\+Key([A-Z])/g, "+$1")
          .replace(/^Digit(\d)$/, "$1")
          .replace(/\+Digit(\d)/g, "+$1")
          .replace(/BracketLeft/g, "[")
          .replace(/BracketRight/g, "]")
          .replace(/Backslash/g, "\\")
          .replace(/Comma/g, ",")
          .replace(/Period/g, ".")
          .replace(/Slash/g, "/")
          .replace(/Semicolon/g, ";")
          .replace(/Quote/g, "'")
          .replace(/Minus/g, "-")
          .replace(/Equal/g, "=")
          .replace(/Backquote/g, "`")
          .replace(/Space/g, "Space")
      : "-";
  }
  function ei(e, t) {
    return !!t && Jo(e) === t;
  }
  const ti = {
    version: n,
    cfg: new Proxy(
      {},
      { get: (e, t) => S[t], set: (e, t, a) => (Ta(t, a), !0) },
    ),
    setCfg: Ta,
    setCfgMany: Oa,
    features: xa,
    bus: g,
    openDashboard: Uo,
    closeDashboard: Ko,
    toggleDashboard: Yo,

    actions: (typeof _kp !== "undefined" && _kp) ? _kp.actions : null,
    palette: (typeof _kp !== "undefined" && _kp) ? _kp.palette : null,
    cheat:   (typeof _kp !== "undefined" && _kp) ? _kp.cheat : null,
    flushCfg: G,
    history: $e,
    forceWatched: Ut,
    silent: { apply: ue },
    storage: {
      get: (e) => v("kv", e).then((e) => (e ? e.v : void 0)),
      set: (e, t) => k("kv", { k: e, v: t, updatedAt: Date.now() }),
      export: Go,
      import: Xo,
    },
    sb: {
      reload: () => {
        const e = ie.videoId();
        if (e) return St(e);
      },
      stats: () => ({ saved: rt, skips: ot, segments: tt.length }),
      health: Bt_health,

      vote: (uuid, type) => Bt_voteSponsorTime(uuid, type || 1),
      ignore: (uuid) => Bt_ignoreSegment(uuid),
      unIgnore: (uuid) => Bt_unIgnoreSegment(uuid),
      hideVideo: () => Bt_hideVideo(),
      unHideVideo: () => Bt_unHideVideo(),
      lockCategories: (cats) => Bt_lockCategories(cats),
      setUsername: (name) => Bt_setUsername(name),
      getUsername: () => Bt_getUsername(),
      getUserInfo: () => Bt_getUserInfo(),

      setSegOverride: (uuid, action) => {
        let cur = {};
        try {
          cur = S.sbSegOverrides ? JSON.parse(S.sbSegOverrides) : {};
        } catch (e) {
          cur = {};
        }
        if (!action) delete cur[uuid];
        else cur[uuid] = action;
        Ta(
          "sbSegOverrides",
          Object.keys(cur).length ? JSON.stringify(cur) : "",
        );
        Bt_invalidateMarks();
      },
      setChanOverride: (channelId, action) => {
        let cur = {};
        try {
          cur = S.sbChanOverrides ? JSON.parse(S.sbChanOverrides) : {};
        } catch (e) {
          cur = {};
        }
        if (!action) delete cur[channelId];
        else cur[channelId] = action;
        Ta(
          "sbChanOverrides",
          Object.keys(cur).length ? JSON.stringify(cur) : "",
        );
        Bt_invalidateMarks();
      },

      setChapterRule: (channelId, pattern) => {
        let cur = {};
        try {
          cur = S.sbChapterRules ? JSON.parse(S.sbChapterRules) : {};
        } catch (e) {
          cur = {};
        }
        if (!pattern) delete cur[channelId];
        else cur[channelId] = pattern;
        Ta(
          "sbChapterRules",
          Object.keys(cur).length ? JSON.stringify(cur) : "",
        );
      },

      markA: () => {
        const e = ie.el();
        if (e) ((io = e.currentTime), Bt_renderSubmitAB());
      },
      markB: () => {
        const e = ie.el();
        if (e) ((co = e.currentTime), Bt_renderSubmitAB());
      },
      clearMarks: () => {
        io = -1;
        co = -1;
        Bt_renderSubmitAB();
      },
      getAB: () => ({ a: io, b: co }),
      server: Bt_serverUrl,
      serverUrl: Bt_serverUrl,
      categories: () => i.map((c) => c.id),
    },
    net: {
      summary: (e) => dr(e || "all"),
      series: (e, t) => pr(e || "day", t || 60),
      session: () => Object.assign({}, Gn),
      raw: () => nr(),
      flush: () => er(),
      clear: () => rr(),
      fmt: or,
    },
    dataMin: {
      on: () => !!S.dataMinimizationOn,
      enable: () => Ta("dataMinimizationOn", !0),
      disable: () => Ta("dataMinimizationOn", !1),
      toggle: () => Ta("dataMinimizationOn", !S.dataMinimizationOn),
      stats: () =>
        _dm
          ? _dm.stats()
          : { dropped: 0, lastUrl: "", byHost: {} },
      shouldDrop: (u) => (_dm ? _dm.shouldDrop(u) : false),
      endpoints: () =>
        _dm
          ? _dm.endpoints()
          : {
              stats: [],
              logEvent: [],
              pagead: [],
              heartbeat: [],
            },
      config: () => ({
        on: !!S.dataMinimizationOn,
        blockStats: !!S.dataMinBlockStats,
        blockPagead: !!S.dataMinBlockPagead,
        blockLogEvent: !!S.dataMinBlockLogEvent,
        allowHeartbeat: !!S.dataMinAllowHeartbeat,
      }),
      setBlock: (key, val) => {
        const allowed = [
          "dataMinBlockStats",
          "dataMinBlockPagead",
          "dataMinBlockLogEvent",
          "dataMinAllowHeartbeat",
        ];
        if (allowed.indexOf(key) >= 0) Ta(key, !!val);
      },
    },
    perf: {
      enableFps: (e) => Ta("fpsCounterOn", !!e),
      enableBuffer: (e) => Ta("bufferHealthOn", !!e),
      enableLongTask: (e) => Ta("longTaskWarnerOn", !!e),
      setLongTaskThreshold: (e) =>
        Ta(
          "longTaskWarnerThreshold",
          Math.max(20, Math.min(1000, Number(e) || 50)),
        ),
      enableDroppedFrames: (e) => Ta("droppedFrameOn", !!e),
      enableVideoStats: (e) => Ta("videoStatsOn", !!e),
      getDroppedFrames: () => {
        const v = ie && ie.el && ie.el();
        if (!v || typeof v.getVideoPlaybackQuality !== "function") return 0;
        try {
          return v.getVideoPlaybackQuality().droppedVideoFrames || 0;
        } catch (e) {
          return 0;
        }
      },
    },
    diagnostics: {
      snapshot: async () => ({
        version: n,
        url: location.href,
        ts: Date.now(),
        cfg: Object.assign({}, S),
        features: xa.list().map((e) => ({
          id: e.id,
          on:
            "function" == typeof e.isOn
              ? !!e.isOn()
              : "string" == typeof S[e.masterKey]
                ? S[e.masterKey] && "off" !== S[e.masterKey]
                : !!S[e.masterKey],
        })),
        sbStats: { saved: rt, skips: ot, segments: tt.length },
        logs: y().slice(-100),
      }),
    },

    memory: {
      snapshot: () => _mp.snapshot(),
      audit: () => _mp.audit(),
      gc: () => _mp.runMaintenance(),
      runMaintenance: () => _mp.runMaintenance(),

      softCleanup: () => _mp._internal.softCleanup(),
      registerCache: (name, map, cap, onEvict) =>
        _mp.registerCache(name, map, cap, onEvict),

      setTimeout: (fn, ms, owner) => _mp.safeSetTimeout(fn, ms, owner),
      setInterval: (fn, ms, owner) => _mp.safeSetInterval(fn, ms, owner),
      observer: (kind, factory, owner) =>
        _mp.safeObserver(kind, factory, owner),
      listener: (target, event, fn, opts, owner) =>
        _mp.safeListener(target, event, fn, opts, owner),
      blobURL: (blob, owner) => _mp.safeBlobURL(blob, owner),
      element: (el, owner) => _mp.safeElement(el, owner),
      wrap: (fn, owner) => _mp.safeWrap(fn, owner),

      releaseKind: (kind) => {
        const before = _mp.snapshot().live;
        _mp.releaseKind(kind);
        return before - _mp.snapshot().live;
      },

      disposeAll: () => _mp.disposeAll(),
    },
  };

  try {
    Object.defineProperty(e, "YTPlus", {
      value: ti,
      configurable: !1,
      writable: !1,
    });
  } catch (e) {
    try {
      h("YTPlus property already exists, skipping", e && e.message);
    } catch (e) {}
  }
  try {
    window.addEventListener(
      "unhandledrejection",
      (e) => {
        const t = e && e.reason,
          a = (t && (t.message || String(t))) || "",
          n = (t && t.stack) || "";
        if (
          "string" == typeof a &&
          (/YT\+|ytplus|ytp-|ytdef/i.test(a) || /ytplus|ytp-|ytdef/i.test(n))
        ) {
          try {
            h("[YT-zen] rejection caught:", a.slice(0, 300));
          } catch (e) {}
          try {
            e.preventDefault();
          } catch (e) {}
        }
      },
      { passive: !1 },
    );
  } catch (e) {}
  try {
    window.addEventListener(
      "error",
      (e) => {
        const t = (e && e.error && e.error.stack) || "";
        if (t && /ytplus|ytp-|ytdef|YT\+/i.test(t)) {
          try {
            h("[YT-zen] error caught:", (e.message || "").slice(0, 300));
          } catch (e) {}
          try {
            e.preventDefault();
          } catch (e) {}
        }
      },
      { passive: !1 },
    );
  } catch (e) {}

  function _ytpPausedDialogConfirmBtn() {
    try {
      const vid =
        document.querySelector("video.html5-main-video") ||
        document.querySelector("video");
      let paused = true;
      try {
        paused = !vid || vid.paused;
      } catch (err) {
        paused = true;
      }
      if (!paused) return null; 
      const dialogs = document.querySelectorAll(
        "yt-confirm-dialog-renderer, tp-yt-paper-dialog.yt-confirm-dialog-renderer, ytd-popup-container tp-yt-paper-dialog",
      );
      for (let i = 0; i < dialogs.length; i++) {
        const d = dialogs[i];
        let txt = "";
        try {
          txt = (d.textContent || "").toLowerCase();
        } catch (err) {}
        if (!txt) continue;
        const looksPaused =
          /(continue watching|keep watching|still watching|video (is )?paused|\bpaused\b|resume|seguir viendo|continuer (la )?lecture|weiter ansehen)/.test(
            txt,
          );
        const looksDestructive =
          /(clear|delete|remove|erase|sign ?out|log ?out|turn off|discard|unsubscribe|\bage\b|restrict|confirm (that|to)|are you sure|irreversible|permanent|deactivate)/.test(
            txt,
          );
        if (!looksPaused || looksDestructive) continue;
        const btn =
          d.querySelector("#confirm-button button") ||
          d.querySelector("yt-button-shape#confirm-button button") ||
          d.querySelector("#confirm-button") ||
          d.querySelector(".yt-spec-button-shape-next--call-to-action");
        if (btn) return btn;
      }
    } catch (err) {}
    return null;
  }

  ;(() => {
    "use strict";

    const shortsOn = () => !!S.hideShorts;
    const dubOn = () => !!S.hideAutoDubbedOn;

    function pathOf(url) {
      try {
        if (!url) return "";
        const s = String(url);
        if (s[0] === "/") return s;
        const u = new URL(s, location.href);
        const h = u.hostname;
        if (
          h !== "www.youtube.com" &&
          h !== "youtube.com" &&
          h !== "m.youtube.com" &&
          h !== "music.youtube.com" &&
          !h.endsWith(".youtube.com")
        )
          return "";
        return u.pathname + u.search;
      } catch (err) {
        return "";
      }
    }
    const CONTENT_RE =
      /\/youtubei\/v1\/(browse|next|search|get_watch|reel\/reel_watch_sequence|reel\/reel_item_watch|feed\/[a-z_]+|notification\/[a-z_]+)(\?|$)/;
    const PLAYER_RE = /\/youtubei\/v1\/player(\?|$)/;

    const SHORTS_KEYS = [
      "reelItemRenderer",
      "reelShelfRenderer",
      "reelVideoRenderer",
      "reelItemRendererViewModel",
      "shortsLockupViewModel",
      "reelPlayerOverlayRenderer",
      "reelPlayerHeaderSupportedRenderers",
      "reelChannelRenderer",
    ];

    const SHELF_KEYS = [
      "richShelfRenderer",
      "shelfRenderer",
      "richSectionRenderer",
      "itemSectionRenderer",
      "horizontalCardListRenderer",
      "gridRenderer",
      "verticalListRenderer",
    ];
    function endpointUrl(nav) {
      try {
        const w = nav && nav.commandMetadata && nav.commandMetadata.webCommandMetadata;
        if (w && w.url) return String(w.url);
      } catch (err) {}
      return "";
    }

    const SHORTS_URL_RE = /(^|\/)shorts(\/|\?|$)/i;

    function nodeIsShorts(n) {
      try {
        for (let i = 0; i < SHORTS_KEYS.length; i++)
          if (n[SHORTS_KEYS[i]] !== undefined) return true;
        const navs = [n.navigationEndpoint, n.onTap, n.onLongPress];
        for (let i = 0; i < navs.length; i++) {
          const nv = navs[i];
          if (nv) {
            if (nv.reelWatchEndpoint) return true;
            const u = endpointUrl(nv);
            if (u && SHORTS_URL_RE.test(u)) return true;
          }
        }
        const ov = n.thumbnailOverlays;
        if (ov && ov.length) {
          for (let i = 0; i < ov.length; i++) {
            const o = ov[i] && ov[i].thumbnailOverlayTimeStatusRenderer;
            if (
              o &&
              (o.style === "SHORTS" ||
                (o.text && /shorts/i.test(o.text.simpleText || o.text || "")))
            )
              return true;
          }
        }
      } catch (err) {}
      return false;
    }

    const SHORTS_WRAPPERS = [
      "videoRenderer",
      "compactVideoRenderer",
      "gridVideoRenderer",
      "reelItemRenderer",
      "lockupViewModel",
      "videoWithContextRenderer",
      "richGridMediaViewModel",

      "notificationRenderer",
      "playlistVideoRenderer",
      "playlistPanelVideoRenderer",
      "playlistPanelVideoWrapperRenderer",

      "chipCloudChipRenderer",
    ];

    function isShortsCard(item) {
      try {
        if (!item || typeof item !== "object") return false;
        if (nodeIsShorts(item)) return true;

        if (item.richItemRenderer)
          return isShortsCard(item.richItemRenderer.content || {});
        for (let i = 0; i < SHORTS_WRAPPERS.length; i++) {
          const inner = item[SHORTS_WRAPPERS[i]];
          if (inner && typeof inner === "object" && nodeIsShorts(inner)) return true;
        }

        const lvm = item.lockupViewModel || (item.richGridMediaViewModel && item.richGridMediaViewModel.content) || null;
        if (lvm && typeof lvm === "object") {
          if (lvm.onTap && lvm.onTap.reelWatchEndpoint) return true;
          const u2 = lvm.onTap ? endpointUrl(lvm.onTap) : "";
          if (u2 && SHORTS_URL_RE.test(u2)) return true;
        }
        if (item.content && item.content !== item) return isShortsCard(item.content);
      } catch (err) {}
      return false;
    }

    const DUB_TEXT_RE =
      /auto[- ]?dub|\bdubbed\b|audio track|multi[- ]?audio|multiple audio tracks|doblado|doublé|doppiato|синхрон|डब्ड|डब की गई|吹き替え|더빙|dubbat|dublado/i;
    function collectDubSignals(v) {

      let s = "";

      const grab = (x, depth) => {
        if (x == null || s.length > 300 || depth > 6) return;
        if (typeof x === "string") {
          s += " " + x;
          return;
        }
        if (Array.isArray(x)) {
          for (let i = 0; i < x.length && s.length < 300; i++) grab(x[i], depth + 1);
          return;
        }
        if (typeof x === "object") {
          for (const k in x) {
            if (Object.prototype.hasOwnProperty.call(x, k)) grab(x[k], depth + 1);
          }
        }
      };
      try {
        grab(v.badges, 0);
        grab(v.metadataBadge, 0);
        grab(v.accessibility, 0);
        grab(v.accessibilityData, 0);
        if (v.title && v.title.accessibility) grab(v.title.accessibility, 0);
        grab(v.detailedMetadataSnippets, 0);
        grab(v.metadata, 0);
        grab(v.thumbnailOverlays, 0);
      } catch (err) {}
      return s;
    }
    function isDubbedCard(item) {
      try {
        if (!item || typeof item !== "object") return false;
        const v =
          item.videoRenderer ||
          item.compactVideoRenderer ||
          item.gridVideoRenderer ||
          item.lockupViewModel ||
          item.playlistVideoRenderer ||
          (item.richItemRenderer &&
            item.richItemRenderer.content &&
            (item.richItemRenderer.content.videoRenderer ||
              item.richItemRenderer.content.lockupViewModel)) ||
          item;

        if (v.audioTrack && v.audioTrack.isAutoDubbed === true) return true;
        if (v.isAutoDubbed === true || v.isDubbed === true || v.dubbedAudio === true)
          return true;
        if (Array.isArray(v.audioTracks)) {
          for (let i = 0; i < v.audioTracks.length; i++) {
            const at = v.audioTracks[i];
            if (at && (at.isAutoDubbed === true || /dub/i.test(at.displayName || "")))
              return true;
          }
        }

        const sig = collectDubSignals(v);
        if (sig && DUB_TEXT_RE.test(sig)) return true;
      } catch (err) {}
      return false;
    }

    function shouldDrop(item, ctx) {
      if (!item || typeof item !== "object") return false;
      if (ctx.shorts && isShortsCard(item)) return true;
      if (ctx.dub && isDubbedCard(item)) return true;
      return false;
    }
    function scrubTree(node, ctx) {
      if (!node || typeof node !== "object") return false;
      if (Array.isArray(node)) {
        for (let i = node.length - 1; i >= 0; i--) {
          const item = node[i];
          if (shouldDrop(item, ctx)) {
            node.splice(i, 1);
            ctx.removed++;
            continue;
          }
          if (scrubTree(item, ctx)) {
            node.splice(i, 1);
            ctx.removed++;
          }
        }
        return false;
      }
      for (const k in node) {
        if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
        const v = node[k];
        if (v && typeof v === "object") scrubTree(v, ctx);
      }

      for (let s = 0; s < SHELF_KEYS.length; s++) {
        const shelf = node[SHELF_KEYS[s]];
        if (shelf && typeof shelf === "object") {
          let contents = shelf.contents;
          if (
            !contents &&
            shelf.content &&
            shelf.content.verticalListRenderer
          )
            contents = shelf.content.verticalListRenderer.contents;
          if (Array.isArray(contents) && contents.length === 0) return true;
        }
      }
      return false;
    }

    function renumberPlaylists(node) {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        let pv = 0;
        for (let i = 0; i < node.length; i++)
          if (node[i] && node[i].playlistVideoRenderer) pv++;
        if (pv >= 2 && pv >= node.length - 1) {
          let n = 1;
          for (let i = 0; i < node.length; i++) {
            const r = node[i] && node[i].playlistVideoRenderer;
            if (!r) continue;
            if (r.index && typeof r.index.simpleText !== "undefined")
              r.index.simpleText = String(n);
            n++;
          }
        }
        for (let i = 0; i < node.length; i++) renumberPlaylists(node[i]);
        return;
      }
      for (const k in node)
        if (Object.prototype.hasOwnProperty.call(node, k)) renumberPlaylists(node[k]);
    }

    let dubNotifiedFor = "";
    function trySetAudioTrack(id) {
      try {
        const mp = document.getElementById("movie_player");
        if (mp && typeof mp.setAudioTrack === "function") {
          mp.setAudioTrack(id);
          return;
        }
        if (mp && typeof mp.setAudioTrackById === "function") {
          mp.setAudioTrackById(id);
          return;
        }
        const v = document.querySelector("video.html5-main-video");
        if (v && typeof v.setAudioTrack === "function") {
          v.setAudioTrack(id);
          return;
        }
      } catch (err) {}
    }
    function handlePlayerResponse(json) {
      try {
        const formats = json && json.streamingData && json.streamingData.adaptiveFormats;
        if (!formats || !formats.length) return;
        let hasAutoDub = false,
          originalId = null,
          videoId = "";
        try {
          videoId = (json.videoDetails && json.videoDetails.videoId) || "";
        } catch (err) {}
        for (let i = 0; i < formats.length; i++) {
          const at = formats[i] && formats[i].audioTrack;
          if (!at) continue;
          if (at.isAutoDubbed === true) hasAutoDub = true;
          else if (
            !originalId &&
            (at.audioIsOriginal === true || at.isDefault === true)
          )
            originalId = at.id;
        }
        if (hasAutoDub && !originalId) {
          for (let i = 0; i < formats.length; i++) {
            const at = formats[i] && formats[i].audioTrack;
            if (at && at.isAutoDubbed !== true) {
              originalId = at.id;
              break;
            }
          }
        }
        if (!hasAutoDub) return;
        if (videoId && videoId === dubNotifiedFor) return;
        if (videoId) dubNotifiedFor = videoId;
        if (S.hideAutoDubbedPreferOriginal && originalId) {
          trySetAudioTrack(originalId);
          try {
            pe("Auto-dubbed video — restored original audio track.", 3200, "info");
          } catch (err) {}
        } else {
          try {
            pe("This video is auto-dubbed.", 2600, "info");
          } catch (err) {}
        }
      } catch (err) {}
    }

    function emptyResponse() {
      try {
        if (typeof Response === "function")
          return new Response(null, { status: 204, statusText: "No Content" });
      } catch (err) {}
      return {
        ok: true,
        status: 204,
        statusText: "No Content",
        text: () => Promise.resolve(""),
        json: () => Promise.resolve({}),
        body: null,
        headers: new Map(),
        url: "",
      };
    }

    let apiInstalled = false;
    function ensureApi() {
      if (apiInstalled) return;
      apiInstalled = true;
      try {
        const prevFetch = e.fetch;
        if (typeof prevFetch !== "function") return;
        e.fetch = function (input, init) {
          let url = "";
          try {
            url =
              input && typeof input === "object" && "url" in input
                ? input.url
                : String(input || "");
          } catch (err) {}
          const p = pathOf(url);

          if (shortsOn() && /\/youtubei\/v1\/(reel|shorts)(\/|\?|$)/.test(p)) {
            try {
              g.emit("net.blocked", { url: url, by: "remove-shorts" });
            } catch (e2) {}
            return Promise.resolve(emptyResponse());
          }
          const doShorts = shortsOn() && !!S.hideShortsApiFilter && CONTENT_RE.test(p);
          const doDub = dubOn() && CONTENT_RE.test(p);
          const doPlayer = dubOn() && PLAYER_RE.test(p);
          if (!doShorts && !doDub && !doPlayer) return prevFetch.apply(this, arguments);
          try {
            return prevFetch.apply(this, arguments).then(function (res) {
              try {
                if (!res || !res.ok) return res;
                const ct =
                  (res.headers && res.headers.get && res.headers.get("content-type")) ||
                  "";
                if (ct && ct.indexOf("json") === -1 && ct.indexOf("text") === -1)
                  return res;
                const clone = res.clone();
                return clone
                  .text()
                  .then(function (txt) {
                    try {
                      if (!txt || txt[0] !== "{") return res;

                      if (txt.length > 6 * 1024 * 1024) return res;
                      const json = JSON.parse(txt);
                      let removed = 0;
                      if (doPlayer) handlePlayerResponse(json);
                      if (doShorts || doDub) {
                        const ctxF = { shorts: doShorts, dub: doDub, removed: 0 };
                        scrubTree(json, ctxF);
                        removed = ctxF.removed;
                        if (doShorts && removed > 0) {
                          try {
                            renumberPlaylists(json);
                          } catch (e2) {}
                        }
                      }
                      if (removed > 0 || doPlayer) {
                        const body = JSON.stringify(json);
                        let headers = res.headers;
                        try {
                          headers = new Headers(res.headers);
                          headers.delete("content-encoding");
                          headers.delete("content-length");
                        } catch (e2) {
                          headers = res.headers;
                        }
                        return new Response(body, {
                          status: res.status,
                          statusText: res.statusText,
                          headers: headers,
                        });
                      }
                      return res;
                    } catch (e2) {
                      return res;
                    }
                  })
                  .catch(function () {
                    return res;
                  });
              } catch (e2) {
                return res;
              }
            });
          } catch (err) {
            return prevFetch.apply(this, arguments);
          }
        };
        try {
          e.fetch.__ytpWrapped = true;
        } catch (err) {}
      } catch (err) {
        try {
          m("ytplus api-filter install", err);
        } catch (e) {}
      }
    }

    function installInitialDataTrap() {
      try {
        const existing = Object.getOwnPropertyDescriptor(e, "ytInitialData");
        if (existing && !existing.configurable) return; 
        let current = e.ytInitialData;
        Object.defineProperty(e, "ytInitialData", {
          configurable: true,
          enumerable: true,
          get() {
            return current;
          },
          set(v) {
            try {
              if (v && typeof v === "object" && (shortsOn() || dubOn())) {
                const ctxF = {
                  shorts: shortsOn() && !!S.hideShortsApiFilter,
                  dub: dubOn(),
                  removed: 0,
                };
                if (ctxF.shorts || ctxF.dub) scrubTree(v, ctxF);
                if (ctxF.shorts && ctxF.removed > 0) {
                  try {
                    renumberPlaylists(v);
                  } catch (err) {}
                }
              }
            } catch (err) {}
            current = v;
          },
        });
      } catch (err) {}
    }
    installInitialDataTrap();

    const SHORTS_SEL_SAFE = [
      "ytd-shorts",
      "ytd-reel-shelf-renderer",
      "ytd-reel-video-renderer",
      "ytd-reel-item-renderer",
      "ytd-shorts-video-renderer",
      "ytd-shorts-lockup-view-model",
      "ytm-shorts-lockup-view-model",
      "ytm-shorts-lockup-view-model-v2",
      "ytd-rich-shelf-renderer[is-shorts]",
      "ytd-reel-player-overlay-renderer",
      "ytd-mini-guide-entry-renderer[aria-label='Shorts']",
      "ytd-tab-renderer[title='Shorts']",
      "tp-yt-paper-tab[title='Shorts']",
      "ytd-browse[page-subtype='shorts']",
      "grid-shelf-view-model.ytGridShelfViewModelHost",
      ".shortsLockupViewModelHost",
      "a.reel-item-endpoint",
      "a.ytp-shorts-button",
      ".ytp-shorts-button",
    ];
    const SHORTS_SEL_HAS = [
      "ytd-rich-item-renderer:has(a[href*='/shorts/'])",
      "ytd-video-renderer:has(a[href*='/shorts/'])",
      "ytd-compact-video-renderer:has(a[href*='/shorts/'])",
      "ytd-grid-video-renderer:has(a[href*='/shorts/'])",
      "yt-lockup-view-model:has(a[href*='/shorts/'])",
      "ytd-shelf-renderer:has(a[href*='/shorts/'])",
      "ytd-rich-section-renderer:has(a[href*='/shorts/'])",
      "ytd-rich-shelf-renderer:has(ytd-reel-item-renderer)",
      "ytd-rich-section-renderer:has(ytd-reel-shelf-renderer)",
      "ytd-rich-section-renderer:has(ytd-reel-item-renderer)",
      "ytd-rich-section-renderer:has(grid-shelf-view-model.ytGridShelfViewModelHost)",
      "ytd-rich-item-renderer:has([overlay-style='SHORTS'])",
      "ytd-video-renderer:has([overlay-style='SHORTS'])",
      "ytd-compact-video-renderer:has([overlay-style='SHORTS'])",
      "ytd-grid-video-renderer:has([overlay-style='SHORTS'])",
      "ytd-guide-entry-renderer:has(a[href*='/shorts/'])",
      "ytd-guide-entry-renderer:has(a[title='Shorts'])",
      "ytd-mini-guide-entry-renderer:has(a[href*='/shorts/'])",
      "ytd-mini-guide-entry-renderer:has(a[title='Shorts'])",
      "ytm-pivot-bar-item-renderer:has(a[href*='/shorts/'])",
      "yt-chip-cloud-chip-renderer:has(a[href*='/shorts/'])",
      "ytd-item-section-renderer[page-subtype='subscriptions']:has([overlay-style='SHORTS'])",
      ".ytGridShelfViewModelGridShelfRow:has(.shortsLockupViewModelHost)",
      ".ytGridShelfViewModelGridShelfItem:has(.shortsLockupViewModelHost)",
    ];
    const SHORTS_DOM_SAFE = SHORTS_SEL_SAFE.join(",");
    const SHORTS_DOM_HAS = SHORTS_SEL_HAS.join(",");

    let _hasSupport = null;
    function hasSupport() {
      if (_hasSupport !== null) return _hasSupport;
      try {
        _hasSupport =
          typeof CSS !== "undefined" &&
          typeof CSS.supports === "function" &&
          CSS.supports("selector(:has(*))");
      } catch (err) {
        _hasSupport = false;
      }
      return _hasSupport;
    }
    function queryShorts(scope) {
      const out = [];
      try {
        const a = scope.querySelectorAll(SHORTS_DOM_SAFE);
        for (let i = 0; i < a.length; i++) out.push(a[i]);
      } catch (err) {}
      if (hasSupport()) {
        try {
          const b = scope.querySelectorAll(SHORTS_DOM_HAS);
          for (let i = 0; i < b.length; i++) out.push(b[i]);
        } catch (err) {}
      }
      return out;
    }
    function matchesShorts(el) {
      try {
        if (el.matches(SHORTS_DOM_SAFE)) return true;
      } catch (err) {}
      if (hasSupport()) {
        try {
          if (el.matches(SHORTS_DOM_HAS)) return true;
        } catch (err) {}
      }
      return false;
    }

    function sanitizeShortsHrefs(scope) {
      if (!S.hideShortsRedirect) return;
      try {
        const s = scope && scope.querySelectorAll ? scope : document;
        const links = s.querySelectorAll("a[href*='/shorts/']");
        for (let i = 0; i < links.length; i++) {
          const a = links[i];
          const href = a.getAttribute("href") || "";
          const m = href.match(/\/shorts\/([A-Za-z0-9_-]{4,})/);
          if (m) a.setAttribute("href", "/watch?v=" + m[1]);
        }
      } catch (err) {}
    }
    const domActive = new Set();
    let domObs = null,
      domQueue = null,
      domRaf = false;
    function domFlush() {
      domRaf = false;
      const q = domQueue;
      domQueue = null;
      if (!q || !q.length || !domActive.has("shorts")) return;
      const doRemove = !!S.hideShortsDomClean;
      const doSanitize = !!S.hideShortsRedirect;
      for (let i = 0; i < q.length; i++) {
        const root = q[i];
        try {
          if (!root || !root.isConnected) continue;
          if (doRemove) {
            if (matchesShorts(root)) {
              root.remove();
              continue;
            }
            const hits = queryShorts(root);
            for (let k = 0; k < hits.length; k++) {
              try {
                hits[k].remove();
              } catch (err) {}
            }
          }
          if (doSanitize) sanitizeShortsHrefs(root);
        } catch (err) {}
      }
    }
    function startDom(kind) {
      domActive.add(kind);
      if (domObs || !document.body) return;
      try {
        domObs = new MutationObserver(function (records) {
          if (!domActive.size) return;
          if (!domQueue) domQueue = [];
          for (let i = 0; i < records.length; i++) {
            const added = records[i].addedNodes;
            for (let j = 0; j < added.length; j++) {
              const n = added[j];
              if (n && n.nodeType === 1) domQueue.push(n);
            }
          }
          if (!domRaf) {
            domRaf = true;
            requestAnimationFrame(domFlush);
          }
        });
        domObs.observe(document.body, { childList: true, subtree: true });
      } catch (err) {
        domObs = null;
      }
    }
    function stopDom(kind) {
      domActive.delete(kind);
      if (domActive.size || !domObs) return;
      try {
        domObs.disconnect();
      } catch (err) {}
      domObs = null;
    }
    function scrubRoot() {
      if (!shortsOn()) return;

      if (S.hideShortsDomClean) {
        try {
          const hits = queryShorts(document);
          for (let i = 0; i < hits.length; i++) {
            try {
              hits[i].remove();
            } catch (err) {}
          }
        } catch (err) {}
      }

      sanitizeShortsHrefs(document);
    }

    function shortsRedirect() {
      try {
        if (!shortsOn() || !S.hideShortsRedirect) return;
        const m = location.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{4,})/);
        if (!m) return;
        const id = m[1];
        let seen = [];
        try {
          seen = JSON.parse(sessionStorage.getItem("__ytp_sr") || "[]");
        } catch (err) {
          seen = [];
        }
        if (seen.indexOf(id) !== -1) return; 
        seen.push(id);
        if (seen.length > 50) seen = seen.slice(-50);
        try {
          sessionStorage.setItem("__ytp_sr", JSON.stringify(seen));
        } catch (err) {}
        const q = location.search || "";
        location.replace("/watch?v=" + id + (q ? q.replace(/^\?/, "&") : ""));
      } catch (err) {}
    }

    const SHORTS_HIDE =
      "{display:none!important;visibility:hidden!important;pointer-events:none!important}";
    const SHORTS_CSS =
      SHORTS_SEL_SAFE.join(",") +
      SHORTS_HIDE +
      "\n@supports selector(:has(*)){" +
      SHORTS_SEL_HAS.join(",") +
      SHORTS_HIDE +
      "}";

    xa.register({
      id: "hide-shorts",
      name: "Remove Shorts Everywhere",
      summary:
        "Aggressively removes every Shorts surface across YouTube — shelves, carousels, sidebar and mobile entries, search results, channel tabs, subscriptions, history, recommendations and the Shorts player. Shorts links are redirected to the normal player so a Short can never open. Uses layered API + DOM filtering for resilience against UI changes.",
      masterKey: "hideShorts",
      keys: ["hideShorts", "hideShortsRedirect", "hideShortsDomClean", "hideShortsApiFilter"],
      apply(ctx) {
        if (!S.hideShorts) {
          stopDom("shorts");
          return;
        }

        ctx.addStyle(SHORTS_CSS);

        shortsRedirect();
        ctx.onNav(() => setTimeout(shortsRedirect, 80));

        if (S.hideShortsDomClean || S.hideShortsRedirect) {
          startDom("shorts");
          ctx.onNav(() => setTimeout(scrubRoot, 60));
        } else {
          stopDom("shorts");
        }

        ensureApi();

        scrubRoot();
      },
      settings(en) {
        en.appendChild(Io("Remove Shorts everywhere", "hideShorts"));
        en.appendChild(Io("Redirect Shorts links to the normal player", "hideShortsRedirect"));
        en.appendChild(Io("Also strip Shorts from live / injected content", "hideShortsDomClean"));
        en.appendChild(Io("Filter Shorts before they render (recommended)", "hideShortsApiFilter"));
      },
    });

    xa.register({
      id: "hide-auto-dubbed",
      name: "Hide Auto-Dubbed Videos",
      summary:
        "Keeps automatically machine-dubbed videos out of your feeds, search and recommendations using multi-signal detection, and restores the original audio track when you open one. Independent from Shorts filtering.",
      masterKey: "hideAutoDubbedOn",
      keys: ["hideAutoDubbedOn", "hideAutoDubbedPreferOriginal"],
      apply(ctx) {
        if (!S.hideAutoDubbedOn) return;
        ensureApi();

        try {
          if (e.ytInitialPlayerResponse) handlePlayerResponse(e.ytInitialPlayerResponse);
        } catch (err) {}
        ctx.onNav(() => {
          try {
            if (e.ytInitialPlayerResponse) handlePlayerResponse(e.ytInitialPlayerResponse);
          } catch (err) {}
        });
      },
      settings(en) {
        en.appendChild(Io("Hide auto-dubbed videos", "hideAutoDubbedOn"));
        en.appendChild(Io("On the watch page, restore the original audio track", "hideAutoDubbedPreferOriginal"));
        en.appendChild(
          To(
            "div",
            "ytp-hist-note",
            "Feed and recommendation filtering relies on the metadata YouTube exposes (audio-track flags, badges and accessibility labels), so it is best-effort there. On the watch page detection is exact, and the original audio track is restored automatically when available.",
          ),
        );
      },
    });

    try {
      e.__YTPLUS_ENGINE__ = {
        isShortsCard,
        isDubbedCard,
        scrubTree,
        handlePlayerResponse,
        endpointUrl,
        pausedDialogConfirmBtn: _ytpPausedDialogConfirmBtn,

        apply: (id) => xa.apply(id),
        cfg: S,
        features: () => xa.list(),
        fetchWrapped: () => !!(e.fetch && e.fetch.__ytpWrapped),
      };
    } catch (err) {}
  })();
  (async function () {
    try {
      z();
    } catch (e) {}
    try {
      !(function () {
        if ("function" == typeof GM_registerMenuCommand) {
          try {
            GM_registerMenuCommand("Open YT-zen dashboard (Alt+Y)", Uo);
          } catch (e) {}
          try {
            GM_registerMenuCommand("Open command palette (Ctrl+Shift+K)", () => {
              if (typeof _kp !== "undefined" && _kp) _kp.palette.open("");
            });
          } catch (e) {}
          try {
            GM_registerMenuCommand("Export settings to file", Go);
          } catch (e) {}
          try {
            GM_registerMenuCommand("Import settings from file", () => {
              try {
                typeof Xo === "function" ? Xo() : pe("Import unavailable.", 2200, "info");
              } catch (e) {}
            });
          } catch (e) {}
        }
      })();
    } catch (e) {
      m("registerMenuCommands", e);
    }
    try {
      J || ((J = !0), document.addEventListener("yt-navigate-finish", Q, !0));
    } catch (e) {
      m("attachNav", e);
    }

    try {
      const _isTextTarget = (e) => {
        try {
          const t = e.target;
          if (!t) return false;
          const tag = (t.tagName || "").toUpperCase();
          if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
            if (tag === "INPUT") {
              const type = (t.type || "text").toLowerCase();
              return !type || type === "text" || type === "search" || type === "email" || type === "url" || type === "tel" || type === "password" || type === "number";
            }
            return true;
          }
          if (t.isContentEditable) return true;
        } catch (e) {}
        return false;
      };
      document.addEventListener("keydown", (e) => {
        if (e.repeat) return;
        if (_isTextTarget(e)) return;

        if (e.shiftKey && (e.code === "KeyW" || e.key === "W" || e.key === "w")) {
          e.preventDefault();
          try {
            Ut();
          } catch (err) {
            m("hotkey force watched", err);
          }
        }
      }, false);
    } catch (e) {
      m("bindGlobalHotkeys", e);
    }
    try {
      !(function () {
        try {
          ((R = new BroadcastChannel("ytplus_cfg_sync")),
            (R.onmessage = (e) => {
              !H &&
                e.data &&
                "cfg_update" === e.data.type &&
                (e.data.ver || 0) > A &&
                X();
            }));
        } catch (e) {
          u("BroadcastChannel not available, using storage events only");
        }
        try {
          window.addEventListener("storage", (e) => {
            e.key !== B || N || X();
          });
        } catch (e) {}
        try {
          window.addEventListener("YTZEN_SET_VALUE_SYNC", (e) => {
            if (e.detail && e.detail.key) {
              S[e.detail.key] = e.detail.val;
              xa.apply(e.detail.key);
            }
          });
        } catch (e) {}
      })();
    } catch (e) {
      m("initCrossTabSync", e);
    }
    try {
      !(function () {
        const e = () => {
          try {
            G();
          } catch (e) {}
        };
        try {
          window.addEventListener("beforeunload", (ev) => {
            try { Ze(); } catch (e2) {}
            e(ev);
          }, { capture: !0 });
        } catch (e) {}
        try {
          window.addEventListener("pagehide", e, { capture: !0 });
        } catch (e) {}
        try {
          window.addEventListener(
            "pagehide",
            () => {
              for (const e of Ve.values())
                try {
                  URL.revokeObjectURL(e);
                } catch (e) {}
              Ve.clear();
            },
            { capture: !0 },
          );
        } catch (e) {}
        try {
          document.addEventListener(
            "visibilitychange",
            () => {
              "hidden" === document.visibilityState && e();
            },
            { capture: !0 },
          );
        } catch (e) {}
      })();
    } catch (e) {
      m("attachCfgFlushHooks", e);
    }
    try {
      await (async function () {
        const e = [];
        try {
          const t = await v("kv", I);
          t &&
            t.v &&
            "object" == typeof t.v &&
            e.push({
              src: "idb",
              ts: t.updatedAt || 0,
              ver: t.ver || 0,
              data: t.v,
            });
        } catch (e) {
          h("loadCfg IDB read failed", e);
        }
        const t = q();
        t && e.push({ src: "gm", ts: t.__ts || 0, ver: t.__ver || 0, data: t });
        const a = V();
        a && e.push({ src: "ls", ts: a.__ts || 0, ver: a.__ver || 0, data: a });
        const n = F(e);
        if (n) {
          A = Math.max(A, n.ver || 0);
          const t = Object.assign({}, n.data);
          (delete t.__ts,
            delete t.__ver,
            j(t),
            e.length > 1 &&
              e.some(
                (e) =>
                  e !== n &&
                  ((e.ver || 0) < (n.ver || 0) ||
                    (e.ts || 0) < (n.ts || 0) - 2e3),
              ) &&
              W(S, A));
        }
        ((T = !0), g.emit("cfg.loaded"));
      })();
    } catch (e) {
      m("loadCfg failed", e);
    }
    try {
      const e = await v("kv", "__sb_saved__");
      e && "number" == typeof e.v && (rt = e.v);
    } catch (e) {}
    try {
      const e = await v("kv", "__sb_skips__");
      e && "number" == typeof e.v && (ot = e.v);
    } catch (e) {}
    try {
      S.geoOverrideOn && Mn();
    } catch (e) {}
    try {
      await (document.body
        ? Promise.resolve()
        : new Promise((e) => {
            const t = setInterval(() => {
              document.body && (clearInterval(t), e());
            }, 20);
            document.addEventListener(
              "DOMContentLoaded",
              () => {
                (clearInterval(t), e());
              },
              { once: !0 },
            );
          }));
    } catch (e) {}
    try {
      ue();
    } catch (e) {
      m("applySilentClass", e);
    }
    const t = () => {
      try {
        xa.applyAll();
      } catch (e) {
        m("applyAll", e);
      }
      try {
        ft();
      } catch (e) {}
    };
    if ("function" == typeof e.requestIdleCallback)
      try {
        e.requestIdleCallback(t, { timeout: 1500 });
      } catch (e) {
        setTimeout(t, 50);
      }
    else setTimeout(t, 50);
    ae(() => {
      try {
        S.sessionRestoreOn && Ge();
      } catch (e) {}
    }, 5e3);

    try {
      const _ypLastUpd = "ytp_idle_upd_ts";
      const _ypDoUpd = () => {
        try { typeof Fu === "function" && Fu(false); } catch (e) {}
      };
      const _ypShouldCheck = () => {
        try {
          const last = Number(GM_getValue && GM_getValue(_ypLastUpd, 0)) || 0;
          return Date.now() - last > 6 * 60 * 60 * 1e3;
        } catch (e) { return true; }
      };
      const _ypMarkChecked = () => {
        try { GM_setValue && GM_setValue(_ypLastUpd, Date.now()); } catch (e) {}
      };

      setTimeout(() => {
        if (_ypShouldCheck()) {
          _ypDoUpd();
          _ypMarkChecked();
        }
      }, 60e3);
      setInterval(() => {
        if (!Xt.visible) return;
        if (_ypShouldCheck()) {
          _ypDoUpd();
          _ypMarkChecked();
        }
      }, 6 * 60 * 60 * 1e3);
    } catch (e) {}
    try {
      setInterval(() => {
        try {
          if (!Xt.visible) return;
          if (ga.size > 0 && ga.size === va.size) return;
          !document.querySelector('style[id^="ytp-style-"]') &&
            va.size > 0 &&
            (h("watchdog: re-applying features (no style markers found)"),
            xa.applyAll());
        } catch (e) {}
      }, 3e4);
    } catch (e) {}
  })().catch((e) => {

    try {
      m("boot", e);
    } catch (e2) {
      try { console.error("[YT-zen] boot error:", e && (e.message || String(e))); } catch (e3) {}
    }
  });
})();