# SponsorBlock Architecture

The SponsorBlock subsystem is an isolated orchestrator. It owns one active video state, one request lifecycle, one playback listener set, and one UI watchdog for the current page.

```text
YouTube signal
    |
    v
video identity -> lifecycle coordinator -> cache/API lookup
                                      |          |
                                      |          +--> direct or privacy path
                                      v
                              validated segments
                                      |
                      +---------------+----------------+
                      |                                |
                 playback state                    timeline UI
                      |                                |
                 skip/mute action               marks and HUD
```

## Responsibilities

### Lifecycle coordinator

`init(videoId)` is idempotent while a lookup is pending. Each initialization receives a generation number. A result may update active state only when both its generation and video ID still match. Navigation and teardown abort the primary request and background refreshes.

The coordinator listens for:

- the repository's navigation event;
- browser history changes;
- `yt-navigate-finish`;
- media readiness and replacement signals;
- visibility and focus recovery.

A fresh video always performs an API validation. Cached data may render first, but it does not suppress revalidation.

### API layer

The API layer builds only documented SponsorBlock requests. Direct requests include the full video ID. Privacy requests use the canonical hash-prefix path and never fall back to a full-ID request. Response shapes are checked before normalization. HTTP 404 is treated as an empty result; malformed successful JSON is retryable.

Write operations are separate from lookup operations. Voting, viewed reports, user information, and manual submissions cannot block playback.

### Cache layer

The cache has two tiers:

- bounded in-memory LRU data with a one-hour runtime freshness window;
- persistent data with a 24-hour lifetime and a 12-hour stale fallback window.

Persistent entries are converted to runtime entries before entering memory so the persistent TTL cannot accidentally become the in-memory TTL. Cache keys include the API profile version and privacy mode. In-flight requests are keyed by video ID and profile, and clearing a request cannot remove a newer request with the same key.

### Playback layer

Playback listeners are attached in the capture phase on `document`, so YouTube can replace the `<video>` element without requiring a new listener registration. The player checks ads, modal states, paused/ended state, mute restoration, active segment boundaries, and a seek cooldown before acting.

### UI layer

Timeline marks are keyed by UUID and are removed before a new video is rendered. The watchdog is a shared visibility-aware ticker. A player-scoped mutation observer repairs marks after YouTube rebuilds the progress bar.

## Teardown

Feature reapplication is a lifecycle boundary. The SponsorBlock registration destroys the old engine before starting the new lookup. `destroy()` aborts requests, removes lifecycle listeners, stops the watchdog, detaches playback listeners, restores audio state, clears active marks, and resets state without deleting persistent cache data.
