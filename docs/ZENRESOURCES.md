# ZenResources

ZenResources is the shared ownership layer for timers, observers, caches, abort controllers, deferred tasks, object URLs, and feature scopes. It is available during `document-start` and does not depend on a framework.

## Primitives

### `BoundedCache`

An LRU cache with optional TTLs, bounded capacity, eviction callbacks, statistics, and expired-entry cleanup. `getOrSet` deduplicates concurrent asynchronous factories and will not overwrite a newer explicit `set`.

### `WeakElementCache`

Stores DOM elements through `WeakRef` when supported. Finalization callbacks carry an entry token so finalization of an old element cannot remove a replacement under the same key. `cleanupDisconnected()` removes detached elements deterministically.

### `SharedObserver`

Maintains one batched `MutationObserver`. Subscribers can scope delivery by target, selector, or predicate. Attribute and character-data observation is opt-in. The observer disconnects when the last subscriber leaves.

### `SharedTicker`

Coalesces periodic callbacks into one timer and stops when all remaining tasks are paused by a hidden document. Callbacks can be one-shot, can run while hidden, and are removed by owner teardown.

### `TrackedBlobURL`

Tracks object URLs, labels, byte totals, last-use times, automatic revocation, and bulk cleanup. Bulk methods return the number of URLs released.

### `DeferredTask`

Schedules idle or timeout work, supports cancellation, and removes completed debounce keys. Promise rejections are consumed so optional background work cannot become an unhandled rejection.

### `AbortGroup`

Groups controllers by feature and removes a controller from the group when it aborts. Groups can be timed out, aborted individually, or aborted globally.

### `ResourceScope`

Owns timers, intervals, event listeners, shared tickers, observers, deferred tasks, abort controllers, and blob URLs. Disposal is idempotent, reverse ordered, and safe to call repeatedly.

`ZenResources.cleanup()` is reserved for page teardown. Feature-level code should use `ResourceScope` so it cannot destroy resources owned by another feature.
