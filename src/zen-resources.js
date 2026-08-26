  // ═══════════════════════════════════════════════════════════════════════════
  //  ZenResources — bounded, disposable, visibility-aware resource primitives
  // ═══════════════════════════════════════════════════════════════════════════
  //  v2 runtime platform:
  //    BoundedCache / WeakElementCache  — memory-safe caches (LRU + weak refs)
  //    SharedObserver / SharedTicker    — coalesced DOM + timer primitives
  //    TrackedBlobURL / DeferredTask    — lifecycle-managed object URLs & work
  //    AbortGroup / ResourceScope       — cancellation + scoped disposal
  //    Bus / Logger / StateStore        — events, diagnostics, persisted state
  //    Dom / Retry                      — DOM helpers and resilient async work
  const ZenResources = (() => {
    "use strict";

    const now = () => Date.now();
    const finite = (value, fallback = 0) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    };
    const positiveInt = (value, fallback) => Math.max(1, Math.floor(finite(value, fallback)) || fallback);
    const getDocument = () => (typeof document !== "undefined" ? document : null);
    const isHidden = () => {
      const doc = getDocument();
      return !!(doc && doc.hidden);
    };
    const reportAsyncError = (value) => {
      if (!value || typeof value.then !== "function") return;
      value.catch(() => {});
    };

    // ─── Bus ────────────────────────────────────────────────────────────────
    // Minimal event bus with once() and "*" wildcard listeners.
    class Bus {
      constructor(name = "bus") {
        this._name = String(name || "bus");
        this._listeners = new Map();
        this._emits = 0;
        this._dropped = 0;
        this._nextId = 1;
      }

      on(event, callback) {
        if (typeof callback !== "function") return 0;
        const id = this._nextId++;
        if (!this._listeners.has(event)) this._listeners.set(event, new Map());
        this._listeners.get(event).set(id, callback);
        return id;
      }

      once(event, callback) {
        const id = this.on(event, (payload, meta) => {
          this.off(event, id);
          return callback(payload, meta);
        });
        return id;
      }

      off(event, id) {
        const map = this._listeners.get(event);
        if (!map) return false;
        const removed = map.delete(id);
        if (!map.size) this._listeners.delete(event);
        return removed;
      }

      emit(event, payload) {
        this._emits++;
        const direct = this._listeners.get(event);
        const wildcard = this._listeners.get("*");
        if (!direct && !wildcard) return 0;
        const meta = { event, at: now() };
        let count = 0;
        if (direct) {
          for (const callback of Array.from(direct.values())) {
            try { count += reportAsyncError(callback(payload, meta)) ? 0 : 1; } catch (_) {}
          }
        }
        if (wildcard) {
          for (const callback of Array.from(wildcard.values())) {
            try { count += reportAsyncError(callback(payload, Object.assign({}, meta))) ? 0 : 1; } catch (_) {}
          }
        }
        return count;
      }

      clear() {
        this._dropped += this._listeners.size;
        this._listeners.clear();
      }

      stats() {
        return { name: this._name, emits: this._emits, listeners: this._listeners.size, dropped: this._dropped };
      }
    }

    // ─── Logger ─────────────────────────────────────────────────────────────
    // Namespaced, leveled logging with a bounded ring buffer for diagnostics.
    const Logger = (() => {
      const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
      let threshold = LEVELS.info;
      let ringEnabled = true;
      const ring = [];
      const RING_LIMIT = 200;

      const push = (entry) => {
        if (!ringEnabled) return;
        ring.push(entry);
        if (ring.length > RING_LIMIT) ring.splice(0, ring.length - RING_LIMIT);
      };

      const log = (level, namespace, args) => {
        if (LEVELS[level] > threshold) return;
        const message = args
          .map((arg) => {
            if (typeof arg === "string") return arg;
            try { return JSON.stringify(arg); } catch (_) { return String(arg); }
          })
          .join(" ");
        const entry = { level, ns: namespace, message, at: now() };
        push(entry);
        const label = "[YT-zen:" + namespace + "] " + message;
        if (typeof console !== "undefined") {
          const target = console[level] || console.log;
          try { target.call(console, label); } catch (_) {}
        }
      };

      const make = (namespace) => ({
        error: (...args) => log("error", namespace, args),
        warn: (...args) => log("warn", namespace, args),
        info: (...args) => log("info", namespace, args),
        debug: (...args) => log("debug", namespace, args),
      });

      return {
        LEVELS,
        namespace: make,
        setLevel(level) {
          if (level in LEVELS) threshold = LEVELS[level];
          return threshold;
        },
        setRingEnabled(value) { ringEnabled = !!value; },
        snapshot(limit = 100) { return ring.slice(-Math.max(1, Math.min(limit, RING_LIMIT))); },
        clear() { ring.length = 0; },
        stats() { return { threshold, entries: ring.length, limit: RING_LIMIT }; },
      };
    })();

    // ─── StateStore ─────────────────────────────────────────────────────────
    // Reactive-ish persistent store. Reads once from an async adapter and
    // flushes changes on a debounced timer. Adapter shape:
    //   { get: async (key) => value|undefined, set: async (key, value) => void }
    class StateStore {
      constructor(key, initial, options = {}) {
        this._key = String(key || "store");
        this._data = initial;
        this._dirty = false;
        this._timer = 0;
        this._flushMs = Math.max(50, finite(options.flushMs, 4000));
        this._storage = options.storage || null;
        this._bus = options.bus || null;
        this._loaded = false;
        this._mutated = false;
        this._loadPromise = null;
        this._listeners = null;
        this._flushes = 0;
      }

      onChange(callback) {
        if (typeof callback !== "function") return 0;
        if (!this._listeners) this._listeners = new Set();
        this._listeners.add(callback);
        return callback;
      }

      offChange(callback) {
        if (!this._listeners) return false;
        return this._listeners.delete(callback);
      }

      _emitChange(key, value) {
        if (this._bus) { try { this._bus.emit("store:" + this._key, { key, value }); } catch (_) {} }
        if (!this._listeners) return;
        for (const callback of Array.from(this._listeners)) {
          try { reportAsyncError(callback(this._data, { key, value })); } catch (_) {}
        }
      }

      async load() {
        if (this._loadPromise) return this._loadPromise;
        this._loadPromise = (async () => {
          if (!this._storage) { this._loaded = true; return this._data; }
          try {
            const value = await this._storage.get(this._key);
            if (!this._mutated && value !== undefined && value !== null) this._data = value;
          } catch (_) {}
          this._loaded = true;
          return this._data;
        })();
        return this._loadPromise;
      }

      get() { return this._data; }

      set(value) {
        this._mutated = true;
        this._data = value;
        this._scheduleFlush();
        this._emitChange(null, value);
      }

      update(updater) {
        if (typeof updater !== "function") return;
        const key = null;
        try {
          updater(this._data);
        } catch (error) {
          try { console.error("[StateStore:" + this._key + "] update failed:", error); } catch (_) {}
          throw new Error("[StateStore:" + this._key + "] update failed: " + (error instanceof Error ? error.message : String(error)));
        }
        this._mutated = true;
        this._scheduleFlush();
        this._emitChange(key, this._data);
      }

      _scheduleFlush() {
        this._dirty = true;
        if (this._timer) return;
        this._timer = setTimeout(() => {
          this._timer = 0;
          this.flush();
        }, this._flushMs);
        if (this._timer && typeof this._timer.unref === "function") {
          try { this._timer.unref(); } catch (_) {}
        }
      }

      async flush() {
        if (this._timer) { clearTimeout(this._timer); this._timer = 0; }
        if (!this._dirty) return false;
        this._dirty = false;
        this._flushes++;
        if (!this._storage) return true;
        try { await this._storage.set(this._key, this._data); return true; } catch (_) { return false; }
      }

      dispose() {
        if (this._timer) { clearTimeout(this._timer); this._timer = 0; }
        reportAsyncError(this.flush());
        if (this._listeners) this._listeners.clear();
      }

      stats() {
        return { key: this._key, loaded: this._loaded, dirty: this._dirty, flushes: this._flushes, pendingFlush: this._timer !== 0 };
      }
    }

    // ─── Dom ────────────────────────────────────────────────────────────────
    // Small DOM toolkit: escaping, idempotent style injection, element
    // factories and a cancellable "when" waiter for SPA mounting races.
    const Dom = (() => {
      const ESC_MAP = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
      };
      const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ESC_MAP[char] || char);

      const css = (text, id) => {
        const doc = getDocument();
        const styleId = id ? "ytp-zen-" + String(id) : "";
        const content = String(text || "");
        if (styleId && doc) {
          const existing = doc.getElementById(styleId);
          if (existing) {
            // Re-invocation with changed rules must update the sheet, not
            // silently keep stale styles.
            if (existing.textContent !== content) existing.textContent = content;
            return () => { try { existing.remove(); } catch (_) {} };
          }
        }
        const style = doc ? doc.createElement("style") : null;
        if (!style) return () => {};
        if (styleId) style.id = styleId;
        style.textContent = content;
        (doc.head || doc.documentElement).appendChild(style);
        return () => { try { style.remove(); } catch (_) {} };
      };

      const el = (tag, props, children) => {
        const doc = getDocument();
        if (!doc || typeof doc.createElement !== "function") return null;
        const node = doc.createElement(String(tag || "div"));
        if (props && typeof props === "object") {
          for (const key of Object.keys(props)) {
            const value = props[key];
            if (key === "class") node.className = String(value);
            else if (key === "text") node.textContent = String(value);
            else if (key === "html") node.innerHTML = String(value);
            else if (key === "style" && typeof value === "object") {
              for (const prop of Object.keys(value)) {
                try { node.style[prop] = value[prop]; } catch (_) {}
              }
            } else if (value !== null && value !== undefined) {
              try { node.setAttribute(key, String(value)); } catch (_) {}
            }
          }
        }
        if (children != null) {
          const list = Array.isArray(children) ? children : [children];
          for (const child of list) {
            if (child == null) continue;
            try { node.appendChild(typeof child === "string" ? doc.createTextNode(child) : child); } catch (_) {}
          }
        }
        return node;
      };

      const when = (selector, options = {}) => {
        const doc = getDocument();
        const timeoutMs = Math.max(0, finite(options.timeoutMs, 8000));
        const intervalMs = Math.max(20, finite(options.intervalMs, 200));
        const root = options.root || doc;
        let cancelled = false;
        let timer = 0;
        let poll = 0;
        let done = false;
        const cancel = () => {
          if (done || cancelled) return;
          cancelled = true;
          if (timer) clearTimeout(timer);
          if (poll) clearInterval(poll);
        };
        const promise = new Promise((resolve, reject) => {
          const find = () => {
            try {
              const found = root
                ? root.querySelector(selector)
                : doc.querySelector(selector);
              if (found) {
                // Stop timers BEFORE flipping done: cancel() guards on done,
                // so setting it first skipped clearInterval and left every
                // resolved when() polling forever.
                if (poll) { clearInterval(poll); poll = 0; }
                if (timer) { clearTimeout(timer); timer = 0; }
                done = true;
                resolve(found);
                return true;
              }
            } catch (_) {}
            return false;
          };
          if (!root || !doc) {
            reject(new Error("Dom.when: no document available"));
            done = true;
            return;
          }
          if (find()) return;
          if (timeoutMs > 0) {
            timer = setTimeout(() => {
              // Mirror the success-path cleanup: cancel() would no-op after
              // done flips, stranding the poll interval forever.
              if (poll) { clearInterval(poll); poll = 0; }
              if (timer) { clearTimeout(timer); timer = 0; }
              done = true;
              reject(new Error("Dom.when: timed out waiting for " + selector));
            }, timeoutMs);
            if (typeof timer.unref === "function") { try { timer.unref(); } catch (_) {} }
          }
          poll = setInterval(() => { if (!done) find(); }, intervalMs);
          if (typeof poll.unref === "function") { try { poll.unref(); } catch (_) {} }
        });
        return { promise, cancel };
      };

      const onReady = (callback) => {
        const doc = getDocument();
        if (!doc || typeof callback !== "function") return;
        if (doc.body || doc.readyState === "complete" || doc.readyState === "interactive") {
          reportAsyncError(callback());
          return;
        }
        try { doc.addEventListener("DOMContentLoaded", callback, { once: true }); } catch (_) {}
      };

      return { esc, css, el, when, onReady };
    })();

    // ─── Retry ──────────────────────────────────────────────────────────────
    // Resilient async work with exponential backoff.
    const Retry = (() => {
      const backoff = async (fn, options = {}) => {
        if (typeof fn !== "function") throw new TypeError("Retry.backoff requires a function");
        const attempts = Math.max(1, positiveInt(options.attempts, 3));
        const baseMs = Math.max(1, finite(options.baseMs, 250));
        const maxMs = Math.max(baseMs, finite(options.maxMs, 4000));
        const factor = Math.max(1.1, finite(options.factor, 2));
        let lastError;
        for (let attempt = 1; attempt <= attempts; attempt++) {
          try {
            return await fn(attempt);
          } catch (error) {
            lastError = error;
            if (options.shouldRetry && !options.shouldRetry(error, attempt)) break;
            if (attempt >= attempts) break;
            if (typeof options.onRetry === "function") {
              try { options.onRetry(error, attempt); } catch (_) {}
            }
            const delay = Math.min(maxMs, baseMs * Math.pow(factor, attempt - 1));
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
        throw lastError;
      };
      return { backoff };
    })();

    // ─── BoundedCache ────────────────────────────────────────────────────────
    // A real LRU cache. Values are kept in a Map whose insertion order is the
    // recency order; every successful get promotes the key to the newest slot.
    class BoundedCache {
      constructor(maxSize = 128, name = "cache", options = {}) {
        if (typeof maxSize === "object" && maxSize) {
          options = maxSize;
          maxSize = options.maxSize || 128;
          name = options.name || "cache";
        } else if (typeof name === "object" && name) {
          options = name;
          name = options.name || "cache";
        }
        this._map = new Map();
        this._max = positiveInt(maxSize, 128);
        this._name = String(name || "cache");
        this._ttl = Math.max(0, finite(options.ttlMs, 0));
        this._onEvict = typeof options.onEvict === "function" ? options.onEvict : null;
        this._pending = new Map();
        this._hits = 0;
        this._misses = 0;
        this._evictions = 0;
        this._expired = 0;
      }

      _entry(value, ttlMs) {
        const createdAt = now();
        const ttl = Math.max(0, finite(ttlMs, this._ttl));
        return {
          value,
          createdAt,
          updatedAt: createdAt,
          expiresAt: ttl > 0 ? createdAt + ttl : 0,
          hits: 0,
        };
      }

      _expiredEntry(entry) {
        return !!(entry && entry.expiresAt > 0 && entry.expiresAt <= now());
      }

      _notify(key, entry, reason) {
        this._evictions++;
        if (reason === "expired") this._expired++;
        if (this._onEvict) {
          try { this._onEvict(key, entry ? entry.value : undefined, reason); } catch (_) {}
        }
      }

      _remove(key, reason = "delete") {
        if (!this._map.has(key)) return false;
        const entry = this._map.get(key);
        this._map.delete(key);
        this._notify(key, entry, reason);
        return true;
      }

      _promote(key, entry) {
        this._map.delete(key);
        entry.updatedAt = now();
        this._map.set(key, entry);
      }

      _trim() {
        while (this._map.size > this._max) {
          const oldest = this._map.keys().next().value;
          if (oldest === undefined) break;
          this._remove(oldest, "capacity");
        }
      }

      cleanupExpired(limit = Infinity) {
        const max = Math.max(0, finite(limit, Infinity));
        let removed = 0;
        for (const [key, entry] of Array.from(this._map.entries())) {
          if (removed >= max) break;
          if (this._expiredEntry(entry)) {
            this._remove(key, "expired");
            removed++;
          }
        }
        return removed;
      }

      get(key, fallback) {
        const entry = this._map.get(key);
        if (!entry) {
          this._misses++;
          return fallback;
        }
        if (this._expiredEntry(entry)) {
          this._remove(key, "expired");
          this._misses++;
          return fallback;
        }
        this._hits++;
        entry.hits++;
        this._promote(key, entry);
        return entry.value;
      }

      peek(key, fallback) {
        const entry = this._map.get(key);
        if (!entry) return fallback;
        if (this._expiredEntry(entry)) {
          this._remove(key, "expired");
          return fallback;
        }
        return entry.value;
      }

      set(key, value, ttlMs) {
        this._pending.delete(key);
        if (this._map.has(key)) this._map.delete(key);
        this._map.set(key, this._entry(value, ttlMs));
        this._trim();
        return value;
      }

      getOrSet(key, factory, ttlMs) {
        const existing = this.peek(key);
        if (existing !== undefined || this._map.has(key)) return this.get(key);
        const pending = this._pending.get(key);
        if (pending) return pending;
        const value = typeof factory === "function" ? factory(key) : factory;
        if (value && typeof value.then === "function") {
          let pendingPromise;
          pendingPromise = Promise.resolve(value).then((resolved) => {
            if (this._pending.get(key) === pendingPromise) {
              this._pending.delete(key);
              this.set(key, resolved, ttlMs);
            }
            return resolved;
          }, (error) => {
            if (this._pending.get(key) === pendingPromise) this._pending.delete(key);
            throw error;
          });
          this._pending.set(key, pendingPromise);
          return pendingPromise;
        }
        return this.set(key, value, ttlMs);
      }

      touch(key, ttlMs) {
        const entry = this._map.get(key);
        if (!entry || this._expiredEntry(entry)) {
          if (entry) this._remove(key, "expired");
          return false;
        }
        const ttl = Math.max(0, finite(ttlMs, this._ttl));
        if (ttl > 0) entry.expiresAt = now() + ttl;
        this._promote(key, entry);
        return true;
      }

      has(key) { return this.peek(key) !== undefined; }
      delete(key) { return this._remove(key); }
      clear() {
        this._pending.clear();
        for (const key of Array.from(this._map.keys())) this._remove(key, "clear");
      }
      keys() { this.cleanupExpired(); return Array.from(this._map.keys()); }
      values() { this.cleanupExpired(); return Array.from(this._map.values(), (entry) => entry.value); }
      entries() { this.cleanupExpired(); return Array.from(this._map.entries(), ([key, entry]) => [key, entry.value]); }
      get size() { this.cleanupExpired(); return this._map.size; }

      stats() {
        this.cleanupExpired();
        const total = this._hits + this._misses;
        return {
          name: this._name,
          size: this._map.size,
          pending: this._pending.size,
          max: this._max,
          ttlMs: this._ttl,
          hits: this._hits,
          misses: this._misses,
          hitRate: total ? Math.round((this._hits / total) * 100) : 0,
          evictions: this._evictions,
          expired: this._expired,
          usagePercent: Math.round((this._map.size / this._max) * 100),
        };
      }
    }

    // ─── WeakElementCache ────────────────────────────────────────────────────
    // Finalization callbacks are tagged with the entry token. Without that
    // check, an old element finalized after a key was replaced could delete
    // the newer element stored under the same key.
    class WeakElementCache {
      constructor(name = "weak-cache") {
        this._map = new Map();
        this._name = String(name || "weak-cache");
        this._created = 0;
        this._cleaned = 0;
        this._registry = typeof FinalizationRegistry === "function"
          ? new FinalizationRegistry((held) => {
              const entry = this._map.get(held.key);
              if (!entry || entry.token !== held.token) return;
              this._map.delete(held.key);
              this._cleaned++;
            })
          : null;
      }

      set(key, element) {
        if (!element || (typeof element !== "object" && typeof element !== "function")) return null;
        this.delete(key);
        const token = {};
        const ref = typeof WeakRef === "function" ? new WeakRef(element) : { deref: () => element };
        this._map.set(key, { ref, token });
        this._created++;
        if (this._registry) {
          try { this._registry.register(element, { key, token }, token); } catch (_) {}
        }
        return element;
      }

      get(key) {
        const entry = this._map.get(key);
        if (!entry) return null;
        const element = entry.ref && typeof entry.ref.deref === "function" ? entry.ref.deref() : null;
        if (!element) {
          this._map.delete(key);
          this._cleaned++;
          return null;
        }
        return element;
      }

      getOrSet(key, factory) {
        const existing = this.get(key);
        if (existing) return existing;
        if (typeof factory !== "function") return null;
        const created = factory(key);
        return created ? this.set(key, created) : null;
      }

      cleanupDisconnected() {
        let removed = 0;
        for (const key of Array.from(this._map.keys())) {
          const element = this.get(key);
          if (!element) {
            removed++;
          } else if (typeof element.isConnected === "boolean" && !element.isConnected) {
            this.delete(key);
            removed++;
          }
        }
        return removed;
      }

      has(key) { return this.get(key) !== null; }

      delete(key) {
        const entry = this._map.get(key);
        if (!entry) return false;
        if (this._registry) {
          try { this._registry.unregister(entry.token); } catch (_) {}
        }
        this._map.delete(key);
        return true;
      }

      clear() { for (const key of Array.from(this._map.keys())) this.delete(key); }
      get size() { return this._map.size; }
      stats() { return { name: this._name, size: this._map.size, cleaned: this._cleaned, created: this._created }; }
    }

    // ─── SharedObserver ──────────────────────────────────────────────────────
    const SharedObserver = (() => {
      let observer = null;
      let observedRoot = null;
      let flushTimer = 0;
      let rearmTimer = 0;
      let pendingBatch = [];
      let nextId = 1;
      let observerKey = "";
      const subscribers = new Map();

      const scheduleFlush = () => {
        if (flushTimer || !pendingBatch.length) return;
        const doc = getDocument();
        const flush = () => {
          flushTimer = 0;
          const batch = pendingBatch;
          pendingBatch = [];
          for (const [id, sub] of subscribers) {
            const relevant = (sub.target || sub.selector || sub.predicate)
              ? batch.filter((mutation) => isRelevantMutation(mutation, sub))
              : batch;
            if (!relevant.length && !sub.fireOnEmpty) continue;
            try { reportAsyncError(sub.callback(relevant, { id, root: observedRoot, total: batch.length })); } catch (_) {}
          }
        };
        if (typeof requestAnimationFrame === "function" && doc && !doc.hidden) {
          flushTimer = requestAnimationFrame(flush);
        } else {
          flushTimer = setTimeout(flush, 16);
        }
      };

      const isRelevantMutation = (mutation, sub) => {
        if (!mutation || !sub) return false;
        if (!sub.target && !sub.selector && !sub.predicate) return true;
        if (sub.target) {
          const target = sub.target;
          if (mutation.target === target) return true;
          if (typeof target.contains === "function" && target.contains(mutation.target)) return true;
          for (const node of mutation.addedNodes || []) {
            if (node === target) return true;
            if (target && typeof target.contains === "function" && target.contains(node)) return true;
            if (node && typeof node.contains === "function" && node.contains(target)) return true;
          }
        }
        if (sub.selector) {
          const matches = (node) => !!(node && node.nodeType === 1 && typeof node.matches === "function" && node.matches(sub.selector));
          if (matches(mutation.target)) return true;
          for (const node of mutation.addedNodes || []) {
            if (matches(node)) return true;
            if (node && node.nodeType === 1 && typeof node.querySelector === "function" && node.querySelector(sub.selector)) return true;
          }
        }
        if (sub.predicate) {
          try { return !!sub.predicate(mutation); } catch (_) { return false; }
        }
        return false;
      };

      const getRoot = () => {
        const doc = getDocument();
        return doc && (doc.body || doc.documentElement);
      };

      const getObserverConfig = () => {
        let attributes = false;
        let characterData = false;
        let attributeFilter = null;
        for (const sub of subscribers.values()) {
          attributes = attributes || sub.attributes;
          characterData = characterData || sub.characterData;
          if (sub.attributeFilter && sub.attributeFilter.length) {
            attributeFilter = attributeFilter || new Set();
            sub.attributeFilter.forEach((name) => attributeFilter.add(name));
          }
        }
        const filter = attributeFilter ? Array.from(attributeFilter).sort() : [];
        return {
          childList: true,
          subtree: true,
          attributes,
          characterData,
          attributeFilter: attributes && filter.length ? filter : undefined,
        };
      };

      const configKey = (config) => JSON.stringify([
        config.childList,
        config.subtree,
        config.attributes,
        config.characterData,
        config.attributeFilter || [],
      ]);

      const ensureObserver = () => {
        if (!subscribers.size) return;
        const root = getRoot();
        if (!root || typeof MutationObserver !== "function") {
          if (!rearmTimer) {
            rearmTimer = setTimeout(() => {
              rearmTimer = 0;
              ensureObserver();
            }, 100);
          }
          return;
        }
        const config = getObserverConfig();
        const key = configKey(config);
        if (observer && observedRoot === root && observerKey === key) return;
        if (observer) {
          try { observer.disconnect(); } catch (_) {}
        }
        observerKey = key;
        observedRoot = root;
        observer = new MutationObserver((mutations) => {
          if (!mutations || !mutations.length) return;
          // Push record-by-record: spread on an array this large can exceed
          // the engine's argument limit and throw mid-callback.
          for (let i = 0; i < mutations.length; i++) pendingBatch.push(mutations[i]);
          scheduleFlush();
        });
        try { observer.observe(root, config); } catch (_) {
          try { observer.disconnect(); } catch (_) {}
          observer = null;
          observedRoot = null;
          observerKey = "";
        }
      };

      const subscribe = (callback, options = {}) => {
        if (typeof callback !== "function") return 0;
        const id = nextId++;
        subscribers.set(id, {
          callback,
          target: options.target || null,
          selector: typeof options.selector === "string" ? options.selector : "",
          predicate: typeof options.predicate === "function" ? options.predicate : null,
          fireOnEmpty: !!options.fireOnEmpty,
          attributes: !!options.attributes,
          characterData: !!options.characterData,
          attributeFilter: Array.isArray(options.attributeFilter) ? options.attributeFilter.slice() : [],
        });
        ensureObserver();
        if (options.immediate) {
          try { reportAsyncError(callback([], { id, root: observedRoot, total: 0, immediate: true })); } catch (_) {}
        }
        return id;
      };

      const unsubscribe = (id) => {
        const removed = subscribers.delete(id);
        if (!subscribers.size) clear();
        else if (removed) ensureObserver();
        return removed;
      };

      const clear = () => {
        subscribers.clear();
        if (rearmTimer) clearTimeout(rearmTimer);
        rearmTimer = 0;
        if (flushTimer) {
          if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(flushTimer);
          clearTimeout(flushTimer);
        }
        flushTimer = 0;
        pendingBatch = [];
        if (observer) {
          try { observer.disconnect(); } catch (_) {}
        }
        observer = null;
        observedRoot = null;
        observerKey = "";
      };

      return {
        subscribe,
        unsubscribe,
        refresh: ensureObserver,
        clear,
        stats: () => ({
          subscribers: subscribers.size,
          active: observer !== null,
          root: observedRoot ? (observedRoot.tagName || "document") : null,
          pendingMutations: pendingBatch.length,
        }),
      };
    })();

    // ─── SharedTicker ────────────────────────────────────────────────────────
    const SharedTicker = (() => {
      const tasks = new Map();
      let timerId = 0;
      let nextId = 1;
      let lastTickAt = 0;
      const MIN_DELAY_MS = 16;
      const MAX_DELAY_MS = 1000;

      const stop = () => {
        if (!timerId) return;
        clearTimeout(timerId);
        timerId = 0;
      };

      const hasRunnableTask = () => {
        for (const task of tasks.values()) if (!task.pauseHidden || !isHidden()) return true;
        return false;
      };

      const nextDelay = () => {
        const timestamp = now();
        let delay = MAX_DELAY_MS;
        for (const task of tasks.values()) {
          if (task.pauseHidden && isHidden()) continue;
          delay = Math.min(delay, Math.max(0, task.intervalMs - (timestamp - task.lastRun)));
        }
        return Math.max(MIN_DELAY_MS, Math.min(delay, MAX_DELAY_MS));
      };

      const schedule = () => {
        if (timerId || !tasks.size || !hasRunnableTask()) return;
        timerId = setTimeout(run, nextDelay());
      };

      const run = () => {
        timerId = 0;
        const timestamp = now();
        lastTickAt = timestamp;
        for (const [id, task] of Array.from(tasks.entries())) {
          if (task.pauseHidden && isHidden()) continue;
          if (timestamp - task.lastRun < task.intervalMs) continue;
          task.lastRun = timestamp;
          try { reportAsyncError(task.callback({ id, now: timestamp, label: task.label, intervalMs: task.intervalMs })); } catch (_) {}
          if (task.once) tasks.delete(id);
        }
        schedule();
      };

      const add = (callback, intervalMs, options = {}) => {
        if (typeof callback !== "function") return 0;
        const id = nextId++;
        const interval = Math.max(MIN_DELAY_MS, finite(intervalMs, MIN_DELAY_MS));
        tasks.set(id, {
          callback,
          intervalMs: interval,
          lastRun: options.immediate ? 0 : now(),
          pauseHidden: options.pauseHidden !== false,
          once: !!options.once,
          label: String(options.label || "ticker-task"),
        });
        schedule();
        return id;
      };

      const remove = (id) => {
        const removed = tasks.delete(id);
        if (!tasks.size || !hasRunnableTask()) stop();
        return removed;
      };

      const poke = () => {
        stop();
        schedule();
      };

      const clear = () => {
        tasks.clear();
        stop();
      };

      if (getDocument() && typeof document.addEventListener === "function") {
        document.addEventListener("visibilitychange", () => {
          if (isHidden()) stop();
          else poke();
        }, true);
      }

      return {
        add,
        remove,
        poke,
        clear,
        stats: () => ({
          tasks: tasks.size,
          timerActive: timerId !== 0,
          lastTickAt,
          labels: Array.from(tasks.values(), (task) => task.label),
        }),
      };
    })();

    // ─── TrackedBlobURL ──────────────────────────────────────────────────────
    const TrackedBlobURL = (() => {
      const active = new Map();
      const urlApi = () => (typeof URL !== "undefined" ? URL : null);

      const create = (blob, label = "blob", options = {}) => {
        const api = urlApi();
        if (!api || typeof api.createObjectURL !== "function" || !blob) return "";
        let url = "";
        try { url = api.createObjectURL(blob); } catch (_) { return ""; }
        const info = {
          createdAt: now(),
          lastTouchedAt: now(),
          label: String(label || "blob"),
          size: typeof blob.size === "number" ? blob.size : 0,
          timerId: 0,
        };
        const autoRevokeMs = Math.max(0, finite(options.autoRevokeMs, 0));
        if (autoRevokeMs > 0) info.timerId = setTimeout(() => revoke(url), autoRevokeMs);
        active.set(url, info);
        return url;
      };

      const touch = (url) => {
        const info = active.get(url);
        if (!info) return false;
        info.lastTouchedAt = now();
        return true;
      };

      const revoke = (url) => {
        const info = active.get(url);
        if (!info) return false;
        if (info.timerId) clearTimeout(info.timerId);
        const api = urlApi();
        try { api && typeof api.revokeObjectURL === "function" && api.revokeObjectURL(url); } catch (_) {}
        active.delete(url);
        return true;
      };

      const revokeByLabel = (label) => {
        let count = 0;
        for (const [url, info] of Array.from(active.entries())) {
          if (info.label === label && revoke(url)) count++;
        }
        return count;
      };

      const revokeAll = () => {
        let count = 0;
        for (const url of Array.from(active.keys())) if (revoke(url)) count++;
        return count;
      };

      const revokeOlderThan = (maxAgeMs) => {
        const cutoff = now() - Math.max(0, finite(maxAgeMs, 0));
        let count = 0;
        for (const [url, info] of Array.from(active.entries())) {
          if ((info.lastTouchedAt || info.createdAt) < cutoff && revoke(url)) count++;
        }
        return count;
      };

      return {
        create,
        touch,
        revoke,
        revokeByLabel,
        revokeAll,
        revokeOlderThan,
        stats: () => ({
          active: active.size,
          totalBytes: Array.from(active.values()).reduce((sum, info) => sum + (info.size || 0), 0),
          urls: Array.from(active.values(), (info) => info.label),
        }),
      };
    })();

    // ─── DeferredTask ────────────────────────────────────────────────────────
    const DeferredTask = (() => {
      let nextId = 1;
      const pending = new Map();
      const debounced = new Map();
      const root = () => (typeof globalThis !== "undefined" ? globalThis : {});

      const schedule = (callback, timeoutMs = 2000, options = {}) => {
        if (typeof callback !== "function") return 0;
        const id = nextId++;
        let cancelled = false;
        const execute = () => {
          if (cancelled) return;
          pending.delete(id);
          for (const [key, taskId] of Array.from(debounced.entries())) if (taskId === id) debounced.delete(key);
          try { reportAsyncError(callback()); } catch (_) {}
        };
        const timeout = Math.max(1, finite(timeoutMs, 2000));
        const useIdle = typeof root().requestIdleCallback === "function" && options.mode !== "timeout";
        let nativeId = 0;
        if (useIdle) {
          nativeId = root().requestIdleCallback(execute, { timeout });
        } else {
          const delay = Math.max(0, finite(options.delayMs, Math.min(timeout, 100)));
          nativeId = setTimeout(execute, delay);
        }
        pending.set(id, {
          label: String(options.label || (useIdle ? "idle-task" : "timeout-task")),
          cancel: () => {
            cancelled = true;
            if (useIdle && typeof root().cancelIdleCallback === "function") root().cancelIdleCallback(nativeId);
            else clearTimeout(nativeId);
          },
        });
        return id;
      };

      const cancel = (id) => {
        const task = pending.get(id);
        if (!task) return false;
        try { task.cancel(); } catch (_) {}
        pending.delete(id);
        for (const [key, taskId] of Array.from(debounced.entries())) if (taskId === id) debounced.delete(key);
        return true;
      };

      const debounce = (key, callback, delayMs = 120) => {
        const previous = debounced.get(key);
        if (previous) cancel(previous);
        const id = schedule(callback, delayMs, { mode: "timeout", delayMs, label: "debounce:" + key });
        if (id) debounced.set(key, id);
        return id;
      };

      const cancelAll = () => {
        for (const id of Array.from(pending.keys())) cancel(id);
        debounced.clear();
      };

      return {
        schedule,
        debounce,
        cancel,
        cancelAll,
        stats: () => ({ pending: pending.size, labels: Array.from(pending.values(), (task) => task.label) }),
      };
    })();

    // ─── ScanScheduler ───────────────────────────────────────────────────────
    // Adaptive rescan scheduler for feature-level DOM sweeps (badges, adoption,
    // reconciliation). One SharedTicker task per scanner (paused in hidden
    // tabs), plus request() nudges from mutation observers. A scan that
    // reports work (> 0) restores the fast cadence; quiet scans back off
    // exponentially toward maxBackoffMs. Nudges are coalesced and gap-checked
    // so mutation storms can never stack concurrent runs.
    const ScanScheduler = (() => {
      const create = (scanFn, options = {}) => {
        if (typeof scanFn !== "function") return null;
        const baseIntervalMs = Math.max(200, finite(options.intervalMs, 2000));
        const minGapMs = Math.max(50, finite(options.minGapMs, 250));
        const maxBackoffMs = Math.max(baseIntervalMs, finite(options.maxBackoffMs, 8000));
        const runWhenHidden = !!options.runWhenHidden;
        const label = String(options.label || "scan");
        let disposed = false;
        let running = false;
        let rerunAfter = false;
        let lastRunAt = 0;
        let currentDelay = baseIntervalMs;
        let tickerId = 0;

        const run = () => {
          if (disposed) return;
          const doc = getDocument();
          if (!runWhenHidden && doc && doc.hidden) return;
          if (running) { rerunAfter = true; return; }
          running = true;
          lastRunAt = now();
          let didWork = 0;
          try { didWork = finite(scanFn(), 0) | 0; } catch (_) { didWork = 0; }
          running = false;
          currentDelay = didWork > 0
            ? baseIntervalMs
            : Math.min(maxBackoffMs, Math.max(baseIntervalMs, currentDelay * 2));
          if (rerunAfter && !disposed) {
            rerunAfter = false;
            request();
          }
        };

        const request = (opts = {}) => {
          if (disposed) return;
          if (running) { rerunAfter = true; return; }
          const elapsed = now() - lastRunAt;
          // Mutation-driven nudges pass priority:true so fresh content is
          // scanned at the minimum cadence even while the idle tick is
          // backed off; the periodic tick always respects currentDelay.
          if (elapsed >= minGapMs && (!!opts.priority || elapsed >= currentDelay)) run();
        };

        const start = () => {
          if (disposed || tickerId) return;
          tickerId = SharedTicker.add(() => request(), baseIntervalMs, { pauseHidden: true, label: "scan:" + label });
        };

        const stop = () => {
          if (tickerId) { SharedTicker.remove(tickerId); tickerId = 0; }
        };

        const dispose = () => {
          disposed = true;
          stop();
        };

        return {
          request,
          start,
          stop,
          dispose,
          stats: () => ({ label, disposed, active: tickerId !== 0, delayMs: currentDelay }),
        };
      };

      return { create };
    })();

    // ─── AbortGroup ──────────────────────────────────────────────────────────
    const AbortGroup = (() => {
      const groups = new Map();
      const keyOf = (value) => String(value || "default");

      const track = (featureId, controller) => {
        if (!controller || typeof controller.abort !== "function") return controller;
        const key = keyOf(featureId);
        if (controller.signal && controller.signal.aborted) return controller;
        if (!groups.has(key)) groups.set(key, new Set());
        const set = groups.get(key);
        set.add(controller);
        if (controller.signal && typeof controller.signal.addEventListener === "function") {
          controller.signal.addEventListener("abort", () => {
            const current = groups.get(key);
            if (!current) return;
            current.delete(controller);
            if (!current.size) groups.delete(key);
          }, { once: true });
        }
        return controller;
      };

      const create = (featureId) => track(featureId, new AbortController());

      const withTimeout = (featureId, timeoutMs) => {
        const controller = create(featureId);
        const timer = setTimeout(() => {
          try { controller.abort(new DOMException("Timed out", "AbortError")); } catch (_) {
            try { controller.abort(); } catch (_) {}
          }
        }, Math.max(1, finite(timeoutMs, 1)));
        if (controller.signal && typeof controller.signal.addEventListener === "function") {
          controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
        }
        return controller;
      };

      const abort = (featureId) => {
        const key = keyOf(featureId);
        const set = groups.get(key);
        if (!set) return 0;
        let count = 0;
        for (const controller of Array.from(set)) {
          count++;
          try { controller.abort(); } catch (_) {}
        }
        groups.delete(key);
        return count;
      };

      const abortAll = () => {
        let count = 0;
        for (const key of Array.from(groups.keys())) count += abort(key);
        return count;
      };

      return {
        create,
        track,
        withTimeout,
        abort,
        abortAll,
        stats: () => {
          let controllers = 0;
          for (const set of groups.values()) controllers += set.size;
          return { groups: groups.size, controllers };
        },
      };
    })();

    // ─── ResourceScope ───────────────────────────────────────────────────────
    // Scoped ownership of timers, listeners, observers, fetches and DOM
    // nodes. dispose() tears everything down in one shot, and every primitive
    // is a no-op (or rejects) after disposal.
    class ResourceScope {
      constructor(name = "scope") {
        this._name = String(name || "scope");
        this._disposed = false;
        this._cleanups = [];
        this._whenPending = new Set();
      }

      addCleanup(cleanup) {
        if (typeof cleanup !== "function") return cleanup;
        if (this._disposed) {
          try { cleanup(); } catch (_) {}
          return cleanup;
        }
        this._cleanups.push(cleanup);
        return cleanup;
      }

      timeout(callback, delayMs) {
        if (this._disposed) return 0;
        const id = setTimeout(() => { try { reportAsyncError(callback()); } catch (_) {} }, Math.max(0, finite(delayMs, 0)));
        this.addCleanup(() => clearTimeout(id));
        return id;
      }

      interval(callback, intervalMs) {
        if (this._disposed) return 0;
        const id = setInterval(() => { try { reportAsyncError(callback()); } catch (_) {} }, Math.max(1, finite(intervalMs, 1)));
        this.addCleanup(() => clearInterval(id));
        return id;
      }

      listen(target, event, callback, options) {
        if (this._disposed || !target || typeof target.addEventListener !== "function" || typeof callback !== "function") return false;
        target.addEventListener(event, callback, options);
        this.addCleanup(() => {
          try { target.removeEventListener(event, callback, options); } catch (_) {}
        });
        return true;
      }

      ticker(callback, intervalMs, options = {}) {
        if (this._disposed) return 0;
        const id = SharedTicker.add(callback, intervalMs, options);
        this.addCleanup(() => SharedTicker.remove(id));
        return id;
      }

      observer(callback, options = {}) {
        if (this._disposed) return 0;
        const id = SharedObserver.subscribe(callback, options);
        this.addCleanup(() => SharedObserver.unsubscribe(id));
        return id;
      }

      deferred(callback, timeoutMs, options = {}) {
        if (this._disposed) return 0;
        const id = DeferredTask.schedule(callback, timeoutMs, options);
        this.addCleanup(() => DeferredTask.cancel(id));
        return id;
      }

      idle(callback, timeoutMs) {
        if (this._disposed) return 0;
        const id = DeferredTask.schedule(callback, timeoutMs || 2000, { label: "scope-idle:" + this._name });
        this.addCleanup(() => DeferredTask.cancel(id));
        return id;
      }

      debounce(key, callback, delayMs) {
        if (this._disposed) return 0;
        const id = DeferredTask.debounce(String(key || this._name), callback, delayMs || 120);
        this.addCleanup(() => DeferredTask.cancel(id));
        return id;
      }

      abortController(groupId) {
        if (this._disposed) return null;
        const controller = AbortGroup.create(groupId || this._name);
        this.addCleanup(() => { try { controller.abort(); } catch (_) {} });
        return controller;
      }

      fetch(url, options = {}) {
        if (this._disposed) return Promise.reject(new Error("ResourceScope disposed"));
        const controller = AbortGroup.create(this._name);
        // The wire ALWAYS binds to the scope controller so dispose()/abortAll()
        // can cancel in-flight work; a caller-supplied signal is forwarded
        // into the controller instead of replacing it.
        if (options.signal) {
          const ext = options.signal;
          if (ext.aborted) { try { controller.abort(); } catch (_) {} }
          else {
            try { ext.addEventListener("abort", () => { try { controller.abort(); } catch (_) {} }, { once: true }); } catch (_) {}
          }
        }
        const merged = Object.assign({}, options, { signal: controller.signal });
        const promise = fetch(url, merged).finally(() => {
          try { controller.abort(); } catch (_) {}
        });
        this.addCleanup(() => { try { controller.abort(); } catch (_) {} });
        return promise;
      }

      blobUrl(blob, label, options = {}) {
        if (this._disposed) return "";
        const url = TrackedBlobURL.create(blob, label, options);
        if (url) this.addCleanup(() => TrackedBlobURL.revoke(url));
        return url;
      }

      node(element) {
        if (!element) return element;
        this.addCleanup(() => {
          try { element.remove(); } catch (_) {}
        });
        return element;
      }

      when(selector, options = {}) {
        if (this._disposed) {
          const cancelled = Promise.reject(new Error("ResourceScope disposed"));
          cancelled.catch(() => {});
          return cancelled;
        }
        const waiter = Dom.when(selector, options);
        this._whenPending.add(waiter);
        waiter.promise.then(() => this._whenPending.delete(waiter), () => this._whenPending.delete(waiter));
        this.addCleanup(waiter.cancel);
        return waiter.promise;
      }

      dispose() {
        if (this._disposed) return;
        this._disposed = true;
        for (const waiter of Array.from(this._whenPending)) {
          try { waiter.cancel(); } catch (_) {}
        }
        this._whenPending.clear();
        while (this._cleanups.length) {
          const cleanup = this._cleanups.pop();
          try { cleanup(); } catch (_) {}
        }
      }

      get disposed() { return this._disposed; }
      stats() { return { name: this._name, disposed: this._disposed, cleanups: this._cleanups.length }; }
    }

    const stats = () => ({
      sharedObserver: SharedObserver.stats(),
      sharedTicker: SharedTicker.stats(),
      blobURLs: TrackedBlobURL.stats(),
      deferred: DeferredTask.stats(),
      abortGroups: AbortGroup.stats(),
      bus: Bus ? { available: true } : { available: false },
      logger: Logger.stats(),
    });

    const cleanup = () => {
      SharedObserver.clear();
      SharedTicker.clear();
      TrackedBlobURL.revokeAll();
      DeferredTask.cancelAll();
      AbortGroup.abortAll();
      Logger.clear();
    };

    // ─── TimeWindow ──────────────────────────────────────────────────────────
    // Pure wall-clock window math for scheduled policies ("HH:MM" pairs).
    // A start after its end wraps past midnight; equal start and end describe
    // an empty window that is never active. No timers, no state.
    const TimeWindow = (() => {
      const parseHHMM = (text) => {
        const match = /^(\d{1,2}):(\d{2})$/.exec(String(text == null ? "" : text).trim());
        if (!match) return null;
        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        if (hours > 23 || minutes > 59) return null;
        return hours * 60 + minutes;
      };
      const contains = (startMin, endMin, nowMin) => {
        if (
          startMin === null || endMin === null || nowMin === null ||
          !Number.isFinite(startMin) || !Number.isFinite(endMin) || !Number.isFinite(nowMin)
        ) return false;
        if (startMin === endMin) return false;
        const now = ((Math.floor(nowMin) % 1440) + 1440) % 1440;
        if (startMin < endMin) return now >= startMin && now < endMin;
        return now >= startMin || now < endMin;
      };
      const containsHHMM = (startText, endText, date) => {
        const at = date instanceof Date ? date : new Date();
        return contains(parseHHMM(startText), parseHHMM(endText), at.getHours() * 60 + at.getMinutes());
      };
      return { parseHHMM, contains, containsHHMM };
    })();

    return {
      BoundedCache,
      WeakElementCache,
      SharedObserver,
      SharedTicker,
      TrackedBlobURL,
      DeferredTask,
      ScanScheduler,
      AbortGroup,
      ResourceScope,
      Bus,
      Logger,
      StateStore,
      Dom,
      Retry,
      TimeWindow,
      stats,
      cleanup,
    };
  })();
