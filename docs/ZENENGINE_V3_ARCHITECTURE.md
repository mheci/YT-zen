# ZenEngine Architecture

ZenEngine is the shared coordination layer for the optional discovery, playback, layout, search, session, and queue features.

## Boundaries

- `ZenEngine` owns CSS injection, small persistent stores, idle scheduling, and request deduplication.
- `ZenDiscovery` creates feed panels and video rows.
- `ZenPlayback` owns analysis that reads media state and produces markers or speed decisions.
- `ZenSearch` owns search templates and result metadata.
- `ZenSession` owns history-like feature state, collections, genomes, and budgets.
- `ZenLayout` owns mood and layout state.
- `ZenQueue` owns the in-memory queue.
- the feature registry owns enable/disable lifecycle and invokes each feature's cleanup stack before reapplying it.

Features must not create permanent global observers or timers. A feature registers teardown functions in `Yt[featureId]` and uses the registry context for navigation, timeouts, intervals, listeners, and styles.

## YouTube boundary

Selectors and media access are centralized in the shared `ie` adapter. Feature code should ask the adapter for the current video, title, channel, duration, or player rather than retaining a DOM node across navigation. A feature that must retain a node must release it when its feature cleanup runs.

## Failure isolation

Feature failures are caught by the registry. Repeated crashes quarantine the feature for the current page instead of disabling unrelated features. Network and media-analysis failures are treated as optional data failures and never block YouTube playback.

## Adding a feature

1. Define a stable ID, setting key, and short user-facing summary.
2. Use the registry context for every scheduled task or event listener.
3. Avoid whole-document mutation observers; scope observation to the smallest stable container.
4. Use text nodes or DOM properties for untrusted values rather than concatenating HTML.
5. Add teardown for every created node, observer, listener, timer, and object URL.
6. Add a setting only when it changes a meaningful user-visible behavior.
7. Run `npm test` and inspect the feature after SPA navigation and reapplication.
