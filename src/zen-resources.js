  // ═══════════════════════════════════════════════════════════════════════════
  //  ZenResources — Memory Safety & Resource Efficiency Layer
  // ---------------------------------------------------------------------------
  //  Consolidated infrastructure for preventing memory leaks, reducing CPU
  //  overhead, and bounding resource usage across all features.
  //
  //  Components:
  //    BoundedCache     — Map with LRU eviction and configurable max size
  //    WeakElementCache — WeakRef-based cache for DOM elements (auto-GC)
  //    SharedObserver   — Single MutationObserver dispatching to subscribers
  //    SharedTicker     — Consolidated interval replacing multiple setIntervals
  //    TrackedBlobURL   — Auto-revoking blob URL wrapper
  //    DeferredTask     — requestIdleCallback wrapper with timeout fallback
  //    AbortGroup       — Grouped AbortController for feature-scoped cancellation
  // ═══════════════════════════════════════════════════════════════════════════

  const ZenResources = (() => {
    "use strict";

    // ─── BoundedCache ────────────────────────────────────────────────────────
    // LRU Map with configurable max size. Oldest entries evicted on overflow.
    // Tracks hit/miss stats for diagnostics.
    class BoundedCache {
      constructor(maxSize = 128, name = "cache") {
        this._map = new Map();
        this._max = Math.max(1, maxSize);
        this._name = name;
        this._hits = 0;
        this._misses = 0;
      }
      get(key) {
        if (!this._map.has(key)) { this._misses++; return undefined; }
        this._hits++;
        const val = this._map.get(key);
        // LRU: move to end
        this._map.delete(key);
        this._map.set(key, val);
        return val;
      }
      set(key, val) {
        if (this._map.has(key)) this._map.delete(key);
        this._map.set(key, val);
        // Evict oldest if over capacity
        while (this._map.size > this._max) {
          const oldest = this._map.keys().next().value;
          this._map.delete(oldest);
        }
      }
      has(key) { return this._map.has(key); }
      delete(key) { return this._map.delete(key); }
      clear() { this._map.clear(); }
      get size() { return this._map.size; }
      stats() {
        const total = this._hits + this._misses;
        return { name: this._name, size: this._map.size, max: this._max, hits: this._hits, misses: this._misses, hitRate: total > 0 ? Math.round((this._hits / total) * 100) : 0 };
      }
    }

    // ─── WeakElementCache ────────────────────────────────────────────────────
    // WeakRef-based cache for DOM elements. Entries are automatically garbage
    // collected when the DOM element is removed from the document.
    // Uses FinalizationRegistry to clean up stale keys.
    class WeakElementCache {
      constructor(name = "weak-cache") {
        this._map = new Map();
        this._name = name;
        this._cleaned = 0;
        if (typeof FinalizationRegistry === "function") {
          this._registry = new FinalizationRegistry((key) => {
            this._map.delete(key);
            this._cleaned++;
          });
        } else {
          this._registry = null;
        }
      }
      set(key, element) {
        if (!element || typeof element !== "object") return;
        // Clean up old entry for this key
        const old = this._map.get(key);
        if (old && this._registry) {
          try { this._registry.unregister(old); } catch (_) {}
        }
        if (typeof WeakRef === "function") {
          const ref = new WeakRef(element);
          this._map.set(key, ref);
          if (this._registry) {
            try { this._registry.register(element, key, ref); } catch (_) {}
          }
        } else {
          // Fallback: strong reference (less ideal but functional)
          this._map.set(key, { deref: () => element });
        }
      }
      get(key) {
        const ref = this._map.get(key);
        if (!ref) return null;
        const el = ref.deref ? ref.deref() : null;
        if (!el) {
          this._map.delete(key);
          this._cleaned++;
          return null;
        }
        return el;
      }
      has(key) {
        const el = this.get(key);
        return el !== null;
      }
      delete(key) { this._map.delete(key); }
      clear() { this._map.clear(); }
      get size() { return this._map.size; }
      stats() { return { name: this._name, size: this._map.size, cleaned: this._cleaned }; }
    }

    // ─── SharedObserver ──────────────────────────────────────────────────────
    // Single MutationObserver on document.body that dispatches mutations to
    // registered subscribers. Replaces per-feature observers (saves 10+ observers).
    // Subscribers receive batched mutations at most once per animation frame.
    const SharedObserver = (() => {
      let observer = null;
      const subscribers = new Map(); // id → { callback, options }
      let pendingFlush = false;
      let mutationBatch = [];
      let nextId = 1;

      const flush = () => {
        pendingFlush = false;
        const batch = mutationBatch;
        mutationBatch = [];
        for (const [, sub] of subscribers) {
          try { sub.callback(batch); } catch (_) {}
        }
      };

      const ensureObserver = () => {
        if (observer) return;
        if (!document.body) return;
        observer = new MutationObserver((mutations) => {
          mutationBatch.push(...mutations);
          if (!pendingFlush) {
            pendingFlush = true;
            requestAnimationFrame(flush);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      };

      const subscribe = (callback) => {
        const id = nextId++;
        subscribers.set(id, { callback });
        ensureObserver();
        return id;
      };

      const unsubscribe = (id) => {
        subscribers.delete(id);
        // Disconnect observer if no subscribers
        if (subscribers.size === 0 && observer) {
          observer.disconnect();
          observer = null;
        }
      };

      const stats = () => ({
        subscribers: subscribers.size,
        active: observer !== null,
        pendingMutations: mutationBatch.length,
      });

      return { subscribe, unsubscribe, stats };
    })();

    // ─── SharedTicker ────────────────────────────────────────────────────────
    // Consolidated interval that runs all registered callbacks at their
    // specified cadence. Replaces multiple setInterval calls with one timer.
    // Pauses when the tab is hidden (saves CPU).
    const SharedTicker = (() => {
      const tasks = new Map(); // id → { callback, intervalMs, lastRun, pauseHidden }
      let timerId = 0;
      let nextId = 1;
      const TICK_MS = 1000; // Base tick every 1 second

      const tick = () => {
        if (document.hidden) return; // Skip when tab is hidden
        const now = Date.now();
        for (const [, task] of tasks) {
          if (task.pauseHidden && document.hidden) continue;
          if (now - task.lastRun >= task.intervalMs) {
            task.lastRun = now;
            try { task.callback(); } catch (_) {}
          }
        }
      };

      const ensureTimer = () => {
        if (timerId) return;
        timerId = setInterval(tick, TICK_MS);
      };

      const add = (callback, intervalMs, opts = {}) => {
        const id = nextId++;
        tasks.set(id, {
          callback,
          intervalMs: Math.max(TICK_MS, intervalMs),
          lastRun: 0,
          pauseHidden: opts.pauseHidden !== false,
        });
        ensureTimer();
        return id;
      };

      const remove = (id) => {
        tasks.delete(id);
        if (tasks.size === 0 && timerId) {
          clearInterval(timerId);
          timerId = 0;
        }
      };

      const clear = () => {
        tasks.clear();
        if (timerId) { clearInterval(timerId); timerId = 0; }
      };

      const stats = () => ({ tasks: tasks.size, timerActive: timerId !== 0 });

      return { add, remove, clear, stats };
    })();

    // ─── TrackedBlobURL ──────────────────────────────────────────────────────
    // Creates blob URLs that are automatically revoked when no longer needed.
    // Tracks all active URLs and provides bulk revocation.
    const TrackedBlobURL = (() => {
      const active = new Map(); // url → { createdAt, label }

      const create = (blob, label = "blob") => {
        const url = URL.createObjectURL(blob);
        active.set(url, { createdAt: Date.now(), label });
        return url;
      };

      const revoke = (url) => {
        if (active.has(url)) {
          URL.revokeObjectURL(url);
          active.delete(url);
        }
      };

      const revokeAll = () => {
        for (const [url] of active) {
          try { URL.revokeObjectURL(url); } catch (_) {}
        }
        active.clear();
      };

      const revokeOlderThan = (maxAgeMs) => {
        const cutoff = Date.now() - maxAgeMs;
        for (const [url, info] of active) {
          if (info.createdAt < cutoff) {
            try { URL.revokeObjectURL(url); } catch (_) {}
            active.delete(url);
          }
        }
      };

      const stats = () => ({ active: active.size, urls: Array.from(active.values()).map(v => v.label) });

      return { create, revoke, revokeAll, revokeOlderThan, stats };
    })();

    // ─── DeferredTask ────────────────────────────────────────────────────────
    // Runs a task during idle time. Falls back to setTimeout if
    // requestIdleCallback is unavailable. Supports cancellation.
    const DeferredTask = (() => {
      let nextId = 1;
      const pending = new Map(); // id → { cancel }

      const schedule = (fn, timeoutMs = 2000) => {
        const id = nextId++;
        let cancelled = false;

        const execute = () => {
          if (cancelled) return;
          pending.delete(id);
          try { fn(); } catch (_) {}
        };

        let timerId;
        if (typeof requestIdleCallback === "function") {
          const idleId = requestIdleCallback(execute, { timeout: timeoutMs });
          timerId = null;
          pending.set(id, { cancel: () => { cancelled = true; cancelIdleCallback(idleId); } });
        } else {
          timerId = setTimeout(execute, Math.min(timeoutMs, 100));
          pending.set(id, { cancel: () => { cancelled = true; clearTimeout(timerId); } });
        }

        return id;
      };

      const cancel = (id) => {
        const task = pending.get(id);
        if (task) { task.cancel(); pending.delete(id); }
      };

      const cancelAll = () => {
        for (const [, task] of pending) { task.cancel(); }
        pending.clear();
      };

      const stats = () => ({ pending: pending.size });

      return { schedule, cancel, cancelAll, stats };
    })();

    // ─── AbortGroup ──────────────────────────────────────────────────────────
    // Groups multiple AbortControllers under a single feature ID.
    // Calling abort(id) cancels all controllers for that feature.
    const AbortGroup = (() => {
      const groups = new Map(); // featureId → Set<AbortController>

      const create = (featureId) => {
        const ctrl = new AbortController();
        if (!groups.has(featureId)) groups.set(featureId, new Set());
        groups.get(featureId).add(ctrl);
        return ctrl;
      };

      const abort = (featureId) => {
        const set = groups.get(featureId);
        if (!set) return;
        for (const ctrl of set) {
          try { ctrl.abort(); } catch (_) {}
        }
        set.clear();
        groups.delete(featureId);
      };

      const abortAll = () => {
        for (const [id] of groups) abort(id);
      };

      const stats = () => {
        let total = 0;
        for (const [, set] of groups) total += set.size;
        return { groups: groups.size, controllers: total };
      };

      return { create, abort, abortAll, stats };
    })();

    // ─── Global Stats ────────────────────────────────────────────────────────
    const stats = () => ({
      sharedObserver: SharedObserver.stats(),
      sharedTicker: SharedTicker.stats(),
      blobURLs: TrackedBlobURL.stats(),
      deferred: DeferredTask.stats(),
      abortGroups: AbortGroup.stats(),
    });

    // ─── Global Cleanup ──────────────────────────────────────────────────────
    const cleanup = () => {
      SharedTicker.clear();
      TrackedBlobURL.revokeAll();
      DeferredTask.cancelAll();
      AbortGroup.abortAll();
    };

    return {
      BoundedCache,
      WeakElementCache,
      SharedObserver,
      SharedTicker,
      TrackedBlobURL,
      DeferredTask,
      AbortGroup,
      stats,
      cleanup,
    };
  })();
