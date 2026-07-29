# SponsorBlock Subsystem Architecture Specification

This document details the architecture, design, and integration of the SponsorBlock subsystem within the YT-zen platform.

## Subsystem Design Overview

The SponsorBlock implementation uses a decoupled, modular design structured around clean interfaces and highly scoped responsibilities. It is divided into six logical modules enclosed within a single parent orchestrator context.

```
+---------------------------------------------------------------------------------+
| SponsorBlockEngine (Orchestrator Context)                                       |
|                                                                                 |
|  +--------------------+   +---------------------+   +------------------------+  |
|  | SponsorBlockAPI    |   | SponsorBlockCache   |   | SponsorBlockPlayer     |  |
|  | - Network requests |   | - Runtime LRU map   |   | - Playback state track |  |
|  | - Prefix hash query|   | - IndexedDB storage |   | - Event-driven sync    |  |
|  +--------------------+   +---------------------+   +------------------------+  |
|                                                                                 |
|  +--------------------+   +---------------------+   +------------------------+  |
|  | SponsorBlockUI     |   | Settings            |   | Metrics                |  |
|  | - SVG seekbar marks|   | - Feature toggles   |   | - Performance metrics  |  |
|  | - Skip alerts      |   | - Action mapping    |   | - Time-saved tracking  |  |
|  +--------------------+   +---------------------+   +------------------------+  |
+---------------------------------------------------------------------------------+
```

## Architectural Components

### 1. SponsorBlockAPI (Network Layer)
- **CORS-Bypassing Communication:** Uses the `he` wrapper which relies on `GM_xmlhttpRequest` when available to perform out-of-context requests, bypassing YouTube's strict Content Security Policy (CSP).
- **Privacy Preservation:** Features an optional SHA-256 hash prefixing mechanism. When active, only the first 4 characters of the SHA-256 hash of the video ID are transmitted. This queries a pool of candidate segments, with final client-side matching.
- **Payload Validation:** Enforces strict response verification. Malformed segments (such as non-numeric timestamps, negative intervals, or empty categories) are rejected before reaching cache layers.

### 2. SponsorBlockCache (State and Storage Layer)
- **Tier 1: Runtime Memory:** Holds active video segments in a standard Javascript Map, using a Least Recently Used (LRU) eviction strategy with a maximum capacity of 128 keys.
- **Tier 2: Persistent Cache:** Writes verified segments to IndexedDB via the global storage helper. Persistent entries have an eviction TTL of 24 hours.
- **Request Deduplication:** Minimizes redundant API requests. In-flight requests are indexed in an active Map by their compound configuration keys. Identical concurrent requests resolve to the same underlying promise.
- **Stale-While-Revalidate (SWR):** Implements SWR on cache reads. If a cache entry is expired but falls within a 12-hour grace period, it is returned immediately for instant seekbar rendering while a background fetch refreshes the data store.

### 3. SponsorBlockPlayer (Media Integration Layer)
- **Capturing Event Listeners:** Leverages capturing phase event listeners registered directly on `document` (targeting events such as `timeupdate`, `seeked`, `durationchange`, `play`, and `pause`). This eliminates fragile timing dependencies and handles dynamically replaced video elements automatically.
- **State Guarding:** Implements an internal cooldown mechanism (500ms) and seeking tolerance threshold (0.3s) to prevent seek loops, repeated skips, or player oscillation.
- **Context Monitoring:** Temporarily suspends segment processing if an ad is actively playing (`ie.isAd()`) or if structural menus are open on screen.

### 4. SponsorBlockUI (Interface Layer)
- **Progress Overlay:** Translates segment times relative to video duration into percentage-based markers, creating and positioning SVG-styled indicator blocks inside YouTube's progress-bar containers.
- **Inter-tab Sync:** Emits and listens to custom configuration events across page contexts to align seekbar indicators when global settings change.

### 5. Settings & Metrics
- **Simplified Controls:** Prioritizes category selection and action mapping while discarding complex infrastructure options (such as custom server endpoints or latency limits).
- **Diagnostics:** Persists cumulative metrics (total seconds saved, count of skips executed) securely in the browser's persistent state store.
