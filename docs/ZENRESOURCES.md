# ZenResources

`ZenResources` is the shared lifecycle layer used by the userscript's higher-cost features. It is intentionally dependency-free so it can run at `document-start` and survive YouTube's SPA DOM replacement.

## Guarantees

- **BoundedCache** is an LRU cache with optional TTLs, eviction hooks, statistics, and expired-entry cleanup.
- **WeakElementCache** does not retain DOM elements when `WeakRef` is available. Finalization callbacks are token-checked so an old element cannot delete a replacement under the same key; disconnected elements can also be swept explicitly.
- **SharedObserver** uses one batched `MutationObserver`, scopes subscriber dispatch by target/selector/predicate, and reconfigures attributes only when a subscriber requests them.
- **SharedTicker** coalesces periodic work into one visibility-aware timer. Tasks that pause while hidden do not wake the page once the tab is backgrounded.
- **TrackedBlobURL** records active object URLs, byte totals, touch times, labels, and auto-revocation. All bulk revocation methods return the number of URLs released.
- **DeferredTask** supports idle work, cancellable timeout work, and debouncing. Completed debounce entries are removed so the key map cannot grow forever.
- **AbortGroup** tracks related `AbortController` instances and removes them when aborted or timed out.
- **ResourceScope** owns timers, event listeners, tickers, observers, deferred work, abort controllers, and blob URLs. Disposal is idempotent and runs cleanups in reverse order.

`ZenResources.cleanup()` is reserved for page shutdown or a full script teardown. Feature-level teardown should use `ResourceScope` so unrelated features are not disturbed.
