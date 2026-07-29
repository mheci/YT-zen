# SponsorBlock Subsystem Integration & Technical Reference Guide

This reference manual documents the architectural internals, control flows, data structures, and integration boundaries of the SponsorBlock subsystem.

## Architectural Internals and Classifications

The subsystem is organized as a closed IIFE containing highly scoped helper modules. Shared state is preserved in an internal `State` registry to prevent lexical namespace conflicts.

```
+---------------------------------------------------------------------------------+
| SponsorBlockEngine (Orchestrator Scope)                                         |
|                                                                                 |
|  - State Context (Mutable runtime references)                                   |
|  - Metrics Module (Performance metrics tracking & debounced storage persist)     |
|  - Settings Module (Configurations & action category maps)                      |
|  - Cache Layer (Two-tier LRU / SWR Cache, In-flight Request Deduplication Map)  |
|  - API Layer (CORS-Bypassing `he` wrapper, schema validator)                    |
|  - Player Module (Capturing event handler registry, skip state machine)         |
|  - UI Module (SVG seekbar overlay rendering, rendering cache checks)            |
+---------------------------------------------------------------------------------+
```

### 1. State Schema

```typescript
interface SponsorBlockState {
  videoId: string | null;           // Currently active video ID
  segments: SegmentRecord[];        // Verified segment records
  processedUUIDs: Set<string>;      // Executed action UUID identifiers
  activeSegmentIndex: number;       // Playhead index tracking
  abortController: AbortController | null; // In-flight network cancellation
  initialized: boolean;             // Subsystem load state
  mutedActive: boolean;             // Volume suppression active
  originalVolume: number | null;    // Post-mute volume recovery value
  originalMuted: boolean;           // Post-mute mute recovery value
  lastSkipTime: number;             // Cooldown time indicator
  lastSkipTarget: number;           // Cooldown seek position check
  listenersAttached: boolean;       // Capturing listener registration
}
```

### 2. Verified Segment Schema

```typescript
interface SegmentRecord {
  category: string;                 // e.g., "sponsor", "selfpromo", "intro"
  segment: [number, number];        // [startTime, endTime] in seconds
  UUID: string;                     // Segment unique identifier
  actionType: string;               // "skip" | "mute" | "poi" | "chapter" | "full"
  votes: number;                    // Metric weighting
  locked: number;                   // Status override lock indicator
  videoDuration: number;            // Media duration context (seconds)
  description: string;              // Text metadata (e.g., chapter names)
}
```

### 3. API Control Pipeline

The initial video initialization command triggers the following sequential pipeline:

```
[Initialization Trigger]
        ↓
[State Reset] (Discard active timers, abort in-flight queries)
        ↓
[Cache Lookup (Tier 1 Memory)] -> (If Fresh) -> [Render seekbar] -> [Attach listeners]
        ↓ (If Expired or Missing)
[Cache Lookup (Tier 2 IndexedDB)] -> (If Stale SWR) -> [Render instantly] -> [Background Refresh API]
        ↓ (If Cold Cache Miss)
[API Query Initiated] -> [Check Deduplication Map] -> (If Duplicate) -> [Await active promise]
        ↓ (If New Query)
[GM_xmlhttpRequest CORS bypass] -> [JSON Schema Validation] -> [Save to Cache layers] -> [Initialize playback listeners]
```

## Module Functional Details

### 1. SponsorBlockCache
- **In-flight Deduplication:** Uses a shared Map instance (`inFlight`). Key strings are structured as `videoId:configKey`. If a lookup finds an active promise associated with the key, the caller awaits that identical promise instead of generating another HTTP connection.
- **SWR Lifecycle:** When serving expired persistent records (within a 12-hour grace window), the cache serves stale records instantly. The system initiates an background refresh to update the local database asynchronously.

### 2. SponsorBlockAPI
- **CORS Bypass:** Interfaces directly with the global safe fetch wrapper (`he`), ensuring that queries to `sponsor.ajay.app` bypass Content Security Policy directives on `youtube.com`.
- **Response Validation:** Checks that the JSON response payload matches the expected coordinate array format. Compares `segment[0]` and `segment[1]`, discarding segments with NaN values, negative numbers, or logical errors (start time greater than end time).

### 3. SponsorBlockPlayer
- **Capturing Listener Architecture:** Attaches capturing listeners for media events (`timeupdate`, `seeked`, `durationchange`, `play`, `pause`) on `document`. This ensures event handling is completely independent of DOM reconstruction.
- **Ad Avoidance:** Evaluates `ie.isAd()` before checking segments. If YouTube displays an active ad or interruption, the segment actions are suspended.
- **Skip Guard State Machine:** To prevent infinite seek loops or browser freeze conditions, any successfully executed skip action caches the target coordinate and blocks further seeks within a 500ms cooldown window.

### 4. SponsorBlockUI
- **Marker Insertion:** Appends colored indicator markers directly to YouTube's `.ytp-progress-list` container.
- **Rendering Optimization:** Minimizes layout reflows by caching progress-bar parameters. Re-rendering is skipped if duration, category selections, and segment counts match the previous render cycle.

## Error-Handling Matrix

| Failure Mode | Root Cause | Subsystem Safe Fallback |
| --- | --- | --- |
| Network Outage / Timeout | Remote API unreachable | Fallback to Tier 2 persistent stale cache. |
| YouTube DOM Refresh | Video element replaced on navigation | Capturing listeners on `document` catch events from the new target seamlessly. |
| Cache Corruption | Schema mismatch | Deletes entry and queries network. |
| Active Ad Interrupt | Ad player active | `ie.isAd()` stops skip/mute execution. |
| Tab Suspended / Hidden | Tab backgrounded | Visibility observers suspend polling, reducing CPU overhead. |
