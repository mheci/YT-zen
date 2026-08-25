# ZenEngine Architecture

ZenEngine is the shared coordination layer for the optional discovery, playback, layout, search, session, and queue features. The whole ecosystem is source-first: `src/zen-engine-v3.js` is canonical and is synchronized into the bundle by `scripts/build-userscript.js` (it spans the section banner through the last feature registration, up to the boot IIFE).

## Boundaries

- `ZenEngine` owns CSS injection (a single minified stylesheet), small persistent stores (`StateStore` over the shared kv adapter), idle scheduling, request deduplication, and a namespaced logger.
- `ZenDiscovery` creates feed panels and video rows.
- `ZenPlayback` owns the shared audio graph (exactly one `MediaElementSource` per video element); its audio-energy analyzer is available to playback features, though no shipped feature currently consumes it.
- `ZenSearch` owns search templates and result credibility signals.
- `ZenSession` owns the watch genome, session memory, collections, and time budget.
- `ZenLayout` owns mood and layout state.
- `ZenQueue` owns the in-memory queue.
- `AlgoEngine` implements the opt-in algorithm-intelligence subsystem: rate-limited feedback injection, topic classification, a persisted signal store, profile analysis, and negative-signal management.
- the feature registry owns enable/disable lifecycle and invokes each feature's cleanup stack before reapplying it.

Features must not create permanent global observers or timers. A feature registers teardown functions in `Yt[featureId]` and uses the registry context (`addTimeout`, `addInterval`, `addListener`, `addObserver`, `addRAF`, `onNav`, `addStyle`) for everything it schedules. Periodic DOM rescans should go through `ZenResources.ScanScheduler`, which coalesces nudges, pauses in hidden tabs, and backs off when scans report no work.

## Hot-path rules

- Topic classification compiles its taxonomy regexes once per session; `ContentClassifier.classify` never builds patterns per call, and results are cached per video id (or title-derived key for cards without one).
- Homepage token extraction is lazy: recommendation scans record menu element references, and feedback tokens are serialized only for the few items actually being acted on. Polymer data is read through the public `.data` accessor with `__data` as a legacy fallback.
- Watch-signal recording is milestone-based (percentage moved or a minimum interval elapsed) so playback monitors do not rewrite the whole signal blob to storage on every tick.
- The watch optimizer runs on the shared ticker and is paused entirely in hidden tabs.

## Playback

`ZenPlayback` owns one `AudioContext`-backed graph for audio-energy analysis. A `MediaElementSource` is created once per video element (creating a second source on the same element throws, which previously broke smart speed on player replacement; Smart Speed itself was pruned in 3.13.0). The graph is torn down when the video element is released.

## Data integrity

- Untrusted values (video titles, channel names, search queries, genome input) are rendered via `textContent`, `zenEscapeHtml`, or `ZenResources.Dom.esc`; thumbnail URLs are sanitized before use in CSS.
- The watch genome records only real signals — topics, channels, length preference, and session counts — and never fabricates compatibility scores.
- AlgoEngine's feedback, likes, watches, and searches run inside the opt-in feature with per-action rate limits; nothing runs automatically without the feature enabled. Auto-dislike of unwanted-topic watches is a separate opt-in (`algoAutoDislikeOn`) and is never implied by enabling auto-like.

## YouTube boundary

Selectors and media access are centralized in the shared `ie` adapter. Feature code should ask the adapter for the current video, title, channel, duration, or player rather than retaining a DOM node across navigation. A feature that must retain a node must release it when its feature cleanup runs.

## Failure isolation

Feature failures are caught by the registry. Repeated crashes quarantine the feature for the current page instead of disabling unrelated features. Network and media-analysis failures are treated as optional data failures and never block YouTube playback.

## Adding a feature

1. Define a stable ID, setting key, and short user-facing summary.
2. Add the registration in `src/zen-engine-v3.js` and rebuild with `npm run build`; never edit the bundle body.
3. Use the registry context for every scheduled task or event listener.
4. Avoid whole-document mutation observers; scope observation to the smallest stable container.
5. Use text nodes, DOM properties, or escaped interpolation for untrusted values rather than raw HTML concatenation.
6. Add teardown for every created node, observer, listener, timer, and object URL.
7. Add a setting only when it changes a meaningful user-visible behavior.
8. Run `npm test` and inspect the feature after SPA navigation and reapplication.
