# ZenResources

ZenResources is the shared runtime platform for timers, observers, caches, abort controllers, deferred tasks, object URLs, feature scopes, events, diagnostics, and persisted state. It is available during `document-start` and does not depend on a framework. `src/zen-resources.js` is the canonical source; `npm run build` synchronizes it into the userscript bundle.

## Runtime modules

### `Bus`

A tiny typed event emitter with `on`/`once`/`off`/`emit`, a `"*"` wildcard for observing every event, and delivery statistics. Event listeners are expected to be removed by the code that added them; the bus itself holds no cleanup contract.

### `Logger`

Namespaced, leveled logging (`debug`/`info`/`warn`/`error`). Each namespace keeps a bounded ring buffer of recent entries for post-mortem inspection (`snapshot()`), supports `setLevel()` per namespace, and can be silenced globally (`setRingEnabled(false)`/`clear()`). Ring buffering is off by default.

### `StateStore`

Persisted state with an async storage adapter, an optional debounced flush (default 4000 ms), and change notification via `onChange`. `load()` hydrates from storage without overwriting newer in-memory changes; `flush()`/`dispose()` force persistence. Feature state built on `StateStore` survives reloads without manual `GM_setValue` bookkeeping.

### `Dom`

Small DOM helpers: `esc` (HTML-attribute escaping for interpolated values), `css` (idempotent stylesheet injection keyed by id), `el` (element factory), `when` (selector wait with cancel + timeout), and `onReady` (document-ready scheduling).

### `Retry`

Resilient async work with exponential backoff, configurable attempts, base/max delays, growth factor, and `shouldRetry`/`onRetry` hooks. Failures surface as rethrown errors after the final attempt.

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

Owns timers, intervals, event listeners, shared tickers, observers, deferred tasks, abort controllers, and blob URLs. Additional helpers keep feature work tied to the scope: `when()` (selector wait), `idle()` (requestIdleCallback), `debounce()` (keyed debounce), `fetch()` (abortable, settles after dispose), and `node()` (DOM node creation). Disposal is idempotent, reverse ordered, and safe to call repeatedly.

`ZenResources.cleanup()` is reserved for page teardown. Feature-level code should use `ResourceScope` so it cannot destroy resources owned by another feature.

## Lifecycle

- `stats()` reports live counts per resource family; `cleanup()` releases everything.
- Tracked object URLs are revoked automatically on age and at page teardown.
- Shared observers and tickers stop when their last subscriber leaves; ticker tasks pause while the document is hidden.
