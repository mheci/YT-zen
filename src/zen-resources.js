  const ZenResources = (() => {
    "use strict";

    const now = () => Date.now();
    const isFiniteNumber = (value) => typeof value === "number" && isFinite(value);
    const asPositiveInt = (value, fallback) => {
      const n = Number(value);
      return isFinite(n) && n > 0 ? Math.max(1, Math.floor(n)) : fallback;
    };

    // ─── BoundedCache ────────────────────────────────────────────────────────
    class BoundedCache {
      constructor(maxSize = 128, name = "cache", options = {}) {
        if (typeof name === "object" && name) {
          options = name;
          name = options.name || "cache";
        }
        this._map = new Map();
        this._max = asPositiveInt(maxSize, 128);
        this._name = String(name || "cache");
        this._ttl = Math.max(0, Number(options.ttlMs || 0) || 0);
        this._onEvict = typeof options.onEvict === "function" ? options.onEvict : null;
        this._hits = 0;
        this._misses = 0;
        this._evictions = 0;
        this._expired = 0;
      }
      _makeEntry(value, ttlMs) {
        const ts = now();
        const ttl = isFiniteNumber(ttlMs) ? Math.max(0, ttlMs) : this._ttl;
        return {
          value,
          createdAt: ts,
          updatedAt: ts,
          expiresAt: ttl > 0 ? ts + ttl : 0,
          hits: 0,
        };
      }
      _isExpired(entry) {
        return !!(entry && entry.expiresAt && entry.expiresAt <= now());
      }
      _notifyEviction(key, entry, reason) {
        this._evictions++;
        if (reason === "expired") this._expired++;
        if (this._onEvict) {
          try { this._onEvict(key, entry ? entry.value : undefined, reason); } catch (_) {}
        }
      }
      _deleteInternal(key, reason) {
        if (!this._map.has(key)) return false;
        const entry = this._map.get(key);
        this._map.delete(key);
        this._notifyEviction(key, entry, reason || "delete");
        return true;
      }
      _promote(key, entry) {
        this._map.delete(key);
        entry.updatedAt = now();
        this._map.set(key, entry);
      }
      _evictOverflow() {
        while (this._map.size > this._max) {
          const oldest = this._map.keys().next().value;
          if (oldest === undefined) break;
          this._deleteInternal(oldest, "capacity");
        }
      }
      cleanupExpired(limit = Infinity) {
        let removed = 0;
        for (const [key, entry] of Array.from(this._map.entries())) {
          if (removed >= limit) break;
          if (this._isExpired(entry)) {
            this._deleteInternal(key, "expired");
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
        if (this._isExpired(entry)) {
          this._deleteInternal(key, "expired");
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
        if (this._isExpired(entry)) {
          this._deleteInternal(key, "expired");
          return fallback;
        }
        return entry.value;
      }
      set(key, value, ttlMs) {
        if (this._map.has(key)) this._map.delete(key);
        this._map.set(key, this._makeEntry(value, ttlMs));
        this._evictOverflow();
        return value;
      }
      getOrSet(key, factory, ttlMs) {
        const existing = this.get(key);
        if (existing !== undefined) return existing;
        const value = typeof factory === "function" ? factory(key) : factory;
        if (value && typeof value.then === "function") {
          return value.then((resolved) => {
            this.set(key, resolved, ttlMs);
            return resolved;
          });
        }
        this.set(key, value, ttlMs);
        return value;
      }
      touch(key, ttlMs) {
        const entry = this._map.get(key);
        if (!entry || this._isExpired(entry)) {
          if (entry) this._deleteInternal(key, "expired");
          return false;
        }
        const ttl = isFiniteNumber(ttlMs) ? Math.max(0, ttlMs) : this._ttl;
        entry.expiresAt = ttl > 0 ? now() + ttl : entry.expiresAt;
        this._promote(key, entry);
        return true;
      }
      has(key) {
        return this.peek(key) !== undefined;
      }
      delete(key) {
        return this._deleteInternal(key, "delete");
      }
      clear() {
        for (const key of Array.from(this._map.keys())) this._deleteInternal(key, "clear");
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
          max: this._max,
          ttlMs: this._ttl,
          hits: this._hits,
          misses: this._misses,
          hitRate: total > 0 ? Math.round((this._hits / total) * 100) : 0,
          evictions: this._evictions,
          expired: this._expired,
          usagePercent: Math.round((this._map.size / this._max) * 100),
        };
      }
    }

    // ─── WeakElementCache ────────────────────────────────────────────────────
    class WeakElementCache {
      constructor(name = "weak-cache") {
        this._map = new Map();
        this._name = String(name || "weak-cache");
        this._cleaned = 0;
        this._created = 0;
        this._registry = typeof FinalizationRegistry === "function"
          ? new FinalizationRegistry((key) => {
              const entry = this._map.get(key);
              if (!entry) return;
              this._map.delete(key);
              this._cleaned++;
            })
          : null;
      }
      _normalizeEntry(key, element) {
        const token = { key, ts: now() };
        const ref = typeof WeakRef === "function"
          ? new WeakRef(element)
          : { deref: () => element };
        return { ref, token };
      }
      set(key, element) {
        if (!element || typeof element !== "object") return null;
        this.delete(key);
        const entry = this._normalizeEntry(key, element);
        this._map.set(key, entry);
        this._created++;
        if (this._registry) {
          try { this._registry.register(element, key, entry.token); } catch (_) {}
        }
        return element;
      }
      get(key) {
        const entry = this._map.get(key);
        if (!entry) return null;
        const el = entry.ref && typeof entry.ref.deref === "function" ? entry.ref.deref() : null;
        if (!el) {
          this._map.delete(key);
          this._cleaned++;
          return null;
        }
        return el;
      }
      getOrSet(key, factory) {
        const existing = this.get(key);
        if (existing) return existing;
        if (typeof factory !== "function") return null;
        const created = factory(key);
        if (created) this.set(key, created);
        return created || null;
      }
      cleanupDisconnected() {
        let removed = 0;
        for (const [key] of Array.from(this._map.entries())) {
          const el = this.get(key);
          if (!el) { removed++; continue; }
          if (typeof el.isConnected === "boolean" && !el.isConnected) {
            this.delete(key);
            removed++;
          }
        }
        return removed;
      }
      has(key) {
        return this.get(key) !== null;
      }
      delete(key) {
        const entry = this._map.get(key);
        if (!entry) return false;
        if (this._registry) {
          try { this._registry.unregister(entry.token); } catch (_) {}
        }
        this._map.delete(key);
        return true;
      }
      clear() {
        for (const key of Array.from(this._map.keys())) this.delete(key);
      }
      get size() { return this._map.size; }
      stats() {
        return {
          name: this._name,
          size: this._map.size,
          cleaned: this._cleaned,
          created: this._created,
        };
      }
    }

    // ─── SharedObserver ──────────────────────────────────────────────────────
    const SharedObserver = (() => {
      let observer = null;
      let observedRoot = null;
      let pendingFlush = false;
      let mutationBatch = [];
      let nextId = 1;
      const subscribers = new Map();
      let rearmTimer = 0;

      const scheduleFlush = () => {
        if (pendingFlush) return;
        pendingFlush = true;
        const runner = () => flush();
        if (typeof requestAnimationFrame === "function" && !document.hidden) requestAnimationFrame(runner);
        else setTimeout(runner, 16);
      };

      const isRelevantMutation = (mutation, sub) => {
        if (!mutation || !sub) return false;
        if (!sub.target && !sub.selector && !sub.predicate) return true;
        const target = sub.target;
        if (target) {
          if (mutation.target === target) return true;
          if (typeof target.contains === "function") {
            if (target.contains(mutation.target)) return true;
            for (const node of mutation.addedNodes || []) {
              if (node === target || (node && typeof node.contains === "function" && node.contains(target)) || (target.contains && target.contains(node))) return true;
            }
          }
        }
        if (sub.selector) {
          const selector = sub.selector;
          const matchesNode = (node) => !!(node && node.nodeType === 1 && typeof node.matches === "function" && node.matches(selector));
          if (matchesNode(mutation.target)) return true;
          for (const node of mutation.addedNodes || []) {
            if (matchesNode(node)) return true;
            if (node && node.nodeType === 1 && typeof node.querySelector === "function" && node.querySelector(selector)) return true;
          }
        }
        if (typeof sub.predicate === "function") {
          try { return !!sub.predicate(mutation); } catch (_) { return false; }
        }
        return false;
      };

      const flush = () => {
        pendingFlush = false;
        const batch = mutationBatch;
        mutationBatch = [];
        for (const [id, sub] of subscribers) {
          if (!sub) continue;
          let relevant = batch;
          if (sub.target || sub.selector || sub.predicate) {
            relevant = batch.filter((mutation) => isRelevantMutation(mutation, sub));
          }
          if (!relevant.length && !sub.fireOnEmpty) continue;
          try { sub.callback(relevant, { id, root: observedRoot, total: batch.length }); } catch (_) {}
        }
      };

      const getRoot = () => document.body || document.documentElement || null;

      const ensureObserver = () => {
        if (!subscribers.size) return;
        const root = getRoot();
        if (!root) {
          if (!rearmTimer) {
            rearmTimer = setTimeout(() => {
              rearmTimer = 0;
              ensureObserver();
            }, 50);
          }
          return;
        }
        if (observer && observedRoot === root) return;
        if (observer) {
          try { observer.disconnect(); } catch (_) {}
          observer = null;
        }
        observedRoot = root;
        observer = new MutationObserver((mutations) => {
          mutationBatch.push(...mutations);
          scheduleFlush();
        });
        observer.observe(root, { childList: true, subtree: true });
      };

      const subscribe = (callback, options = {}) => {
        const id = nextId++;
        subscribers.set(id, {
          callback,
          target: options.target || null,
          selector: typeof options.selector === "string" && options.selector ? options.selector : "",
          predicate: typeof options.predicate === "function" ? options.predicate : null,
          fireOnEmpty: !!options.fireOnEmpty,
        });
        ensureObserver();
        if (options.immediate) {
          try { callback([], { id, root: observedRoot, total: 0, immediate: true }); } catch (_) {}
        }
        return id;
      };

      const unsubscribe = (id) => {
        subscribers.delete(id);
        if (subscribers.size === 0 && observer) {
          try { observer.disconnect(); } catch (_) {}
          observer = null;
          observedRoot = null;
          mutationBatch = [];
          pendingFlush = false;
        }
      };

      const refresh = () => ensureObserver();

      const stats = () => ({
        subscribers: subscribers.size,
        active: observer !== null,
        root: observedRoot ? (observedRoot.tagName || "document") : null,
        pendingMutations: mutationBatch.length,
      });

      return { subscribe, unsubscribe, refresh, stats };
    })();

    // ─── SharedTicker ────────────────────────────────────────────────────────
    const SharedTicker = (() => {
      const tasks = new Map();
      let timerId = 0;
      let nextId = 1;
      let lastTickAt = 0;
      const MIN_DELAY_MS = 16;
      const MAX_DELAY_MS = 1000;

      const stopTimer = () => {
        if (!timerId) return;
        clearTimeout(timerId);
        timerId = 0;
      };

      const computeNextDelay = () => {
        const ts = now();
        let delay = MAX_DELAY_MS;
        for (const [, task] of tasks) {
          if (!task) continue;
          if (task.pauseHidden && document.hidden) continue;
          const remaining = Math.max(0, task.intervalMs - (ts - task.lastRun));
          delay = Math.min(delay, remaining || MIN_DELAY_MS);
        }
        return Math.max(MIN_DELAY_MS, Math.min(delay, MAX_DELAY_MS));
      };

      const schedule = () => {
        if (timerId || tasks.size === 0) return;
        timerId = setTimeout(run, computeNextDelay());
      };

      const run = () => {
        timerId = 0;
        const ts = now();
        lastTickAt = ts;
        for (const [id, task] of Array.from(tasks.entries())) {
          if (!task) continue;
          if (task.pauseHidden && document.hidden) continue;
          if (ts - task.lastRun < task.intervalMs) continue;
          task.lastRun = ts;
          try { task.callback({ id, now: ts, label: task.label, intervalMs: task.intervalMs }); } catch (_) {}
          if (task.once) tasks.delete(id);
        }
        if (tasks.size) schedule();
      };

      const add = (callback, intervalMs, opts = {}) => {
        const id = nextId++;
        tasks.set(id, {
          callback,
          intervalMs: Math.max(MIN_DELAY_MS, Number(intervalMs) || 0),
          lastRun: opts.immediate ? 0 : now(),
          pauseHidden: opts.pauseHidden !== false,
          once: !!opts.once,
          label: String(opts.label || "ticker-task"),
        });
        schedule();
        if (opts.immediate) {
          stopTimer();
          schedule();
        }
        return id;
      };

      const remove = (id) => {
        const existed = tasks.delete(id);
        if (!tasks.size) stopTimer();
        return existed;
      };

      const poke = () => {
        stopTimer();
        if (tasks.size) schedule();
      };

      const clear = () => {
        tasks.clear();
        stopTimer();
      };

      if (typeof document !== "undefined" && document && document.addEventListener) {
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) poke();
        }, true);
      }

      const stats = () => ({
        tasks: tasks.size,
        timerActive: timerId !== 0,
        lastTickAt,
        labels: Array.from(tasks.values(), (task) => task.label),
      });

      return { add, remove, poke, clear, stats };
    })();

    // ─── TrackedBlobURL ──────────────────────────────────────────────────────
    const TrackedBlobURL = (() => {
      const active = new Map();

      const create = (blob, label = "blob", options = {}) => {
        const url = URL.createObjectURL(blob);
        const info = {
          createdAt: now(),
          lastTouchedAt: now(),
          label: String(label || "blob"),
          size: blob && typeof blob.size === "number" ? blob.size : 0,
          autoRevokeMs: Math.max(0, Number(options.autoRevokeMs || 0) || 0),
          timerId: 0,
        };
        if (info.autoRevokeMs > 0) {
          info.timerId = setTimeout(() => revoke(url), info.autoRevokeMs);
        }
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
        try { URL.revokeObjectURL(url); } catch (_) {}
        active.delete(url);
        return true;
      };

      const revokeByLabel = (label) => {
        let removed = 0;
        for (const [url, info] of Array.from(active.entries())) {
          if (info.label === label) {
            revoke(url);
            removed++;
          }
        }
        return removed;
      };

      const revokeAll = () => {
        for (const url of Array.from(active.keys())) revoke(url);
      };

      const revokeOlderThan = (maxAgeMs) => {
        const cutoff = now() - Math.max(0, Number(maxAgeMs || 0) || 0);
        for (const [url, info] of Array.from(active.entries())) {
          const ts = info.lastTouchedAt || info.createdAt;
          if (ts < cutoff) revoke(url);
        }
      };

      const stats = () => ({
        active: active.size,
        totalBytes: Array.from(active.values()).reduce((sum, info) => sum + (info.size || 0), 0),
        urls: Array.from(active.values()).map((info) => info.label),
      });

      return { create, touch, revoke, revokeByLabel, revokeAll, revokeOlderThan, stats };
    })();

    // ─── DeferredTask ────────────────────────────────────────────────────────
    const DeferredTask = (() => {
      let nextId = 1;
      const pending = new Map();
      const debounced = new Map();

      const schedule = (fn, timeoutMs = 2000, options = {}) => {
        const id = nextId++;
        let cancelled = false;

        const execute = () => {
          if (cancelled) return;
          pending.delete(id);
          try { fn(); } catch (_) {}
        };

        if (typeof requestIdleCallback === "function" && options.mode !== "timeout") {
          const idleId = requestIdleCallback(execute, { timeout: Math.max(1, timeoutMs || 1) });
          pending.set(id, {
            label: String(options.label || "idle-task"),
            cancel: () => {
              cancelled = true;
              try { cancelIdleCallback(idleId); } catch (_) {}
            },
          });
        } else {
          const delay = Math.max(0, Number(options.delayMs != null ? options.delayMs : Math.min(timeoutMs, 100)) || 0);
          const timerId = setTimeout(execute, delay);
          pending.set(id, {
            label: String(options.label || "timeout-task"),
            cancel: () => {
              cancelled = true;
              clearTimeout(timerId);
            },
          });
        }

        return id;
      };

      const debounce = (key, fn, delayMs = 120) => {
        const prev = debounced.get(key);
        if (prev) cancel(prev);
        const taskId = schedule(fn, delayMs, { mode: "timeout", delayMs, label: "debounce:" + key });
        debounced.set(key, taskId);
        return taskId;
      };

      const cancel = (id) => {
        const task = pending.get(id);
        if (!task) return false;
        try { task.cancel(); } catch (_) {}
        pending.delete(id);
        for (const [key, taskId] of Array.from(debounced.entries())) {
          if (taskId === id) debounced.delete(key);
        }
        return true;
      };

      const cancelAll = () => {
        for (const id of Array.from(pending.keys())) cancel(id);
        debounced.clear();
      };

      const stats = () => ({
        pending: pending.size,
        labels: Array.from(pending.values(), (task) => task.label),
      });

      return { schedule, debounce, cancel, cancelAll, stats };
    })();

    // ─── AbortGroup ──────────────────────────────────────────────────────────
    const AbortGroup = (() => {
      const groups = new Map();

      const ensureGroup = (featureId) => {
        if (!groups.has(featureId)) groups.set(featureId, new Set());
        return groups.get(featureId);
      };

      const track = (featureId, controller) => {
        if (!featureId || !controller || typeof controller.abort !== "function") return controller;
        const set = ensureGroup(featureId);
        set.add(controller);
        if (controller.signal && typeof controller.signal.addEventListener === "function") {
          controller.signal.addEventListener("abort", () => {
            const group = groups.get(featureId);
            if (!group) return;
            group.delete(controller);
            if (group.size === 0) groups.delete(featureId);
          }, { once: true });
        }
        return controller;
      };

      const create = (featureId) => track(featureId, new AbortController());

      const withTimeout = (featureId, timeoutMs) => {
        const ctrl = create(featureId);
        const timer = setTimeout(() => {
          try { ctrl.abort(new DOMException("Timed out", "AbortError")); } catch (_) {
            try { ctrl.abort(); } catch (_) {}
          }
        }, Math.max(1, Number(timeoutMs || 1) || 1));
        if (ctrl.signal) ctrl.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
        return ctrl;
      };

      const abort = (featureId) => {
        const set = groups.get(featureId);
        if (!set) return 0;
        let count = 0;
        for (const ctrl of Array.from(set)) {
          count++;
          try { ctrl.abort(); } catch (_) {}
        }
        set.clear();
        groups.delete(featureId);
        return count;
      };

      const abortAll = () => {
        let total = 0;
        for (const featureId of Array.from(groups.keys())) total += abort(featureId);
        return total;
      };

      const stats = () => {
        let total = 0;
        for (const [, set] of groups) total += set.size;
        return { groups: groups.size, controllers: total };
      };

      return { create, track, withTimeout, abort, abortAll, stats };
    })();

    // ─── ResourceScope ───────────────────────────────────────────────────────
    class ResourceScope {
      constructor(name = "scope") {
        this._name = String(name || "scope");
        this._disposed = false;
        this._cleanups = [];
      }
      addCleanup(fn) {
        if (this._disposed || typeof fn !== "function") return fn;
        this._cleanups.push(fn);
        return fn;
      }
      timeout(fn, delayMs) {
        const id = setTimeout(() => {
          try { fn(); } catch (_) {}
        }, Math.max(0, Number(delayMs || 0) || 0));
        this.addCleanup(() => clearTimeout(id));
        return id;
      }
      interval(fn, delayMs) {
        const id = setInterval(() => {
          try { fn(); } catch (_) {}
        }, Math.max(1, Number(delayMs || 1) || 1));
        this.addCleanup(() => clearInterval(id));
        return id;
      }
      ticker(fn, intervalMs, opts = {}) {
        const id = SharedTicker.add(fn, intervalMs, opts);
        this.addCleanup(() => SharedTicker.remove(id));
        return id;
      }
      observer(fn, opts = {}) {
        const id = SharedObserver.subscribe(fn, opts);
        this.addCleanup(() => SharedObserver.unsubscribe(id));
        return id;
      }
      deferred(fn, timeoutMs, opts = {}) {
        const id = DeferredTask.schedule(fn, timeoutMs, opts);
        this.addCleanup(() => DeferredTask.cancel(id));
        return id;
      }
      abortController(groupId) {
        const ctrl = AbortGroup.create(groupId || this._name);
        this.addCleanup(() => {
          try { ctrl.abort(); } catch (_) {}
        });
        return ctrl;
      }
      blobUrl(blob, label, opts = {}) {
        const url = TrackedBlobURL.create(blob, label, opts);
        this.addCleanup(() => TrackedBlobURL.revoke(url));
        return url;
      }
      dispose() {
        if (this._disposed) return;
        this._disposed = true;
        while (this._cleanups.length) {
          const fn = this._cleanups.pop();
          try { fn(); } catch (_) {}
        }
      }
      stats() {
        return { name: this._name, disposed: this._disposed, cleanups: this._cleanups.length };
      }
    }

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
      ResourceScope,
      stats,
      cleanup,
    };
  })();
