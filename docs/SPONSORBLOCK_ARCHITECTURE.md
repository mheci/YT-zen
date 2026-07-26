# SponsorBlock Integration — Complete Architectural Review & Redesign

## Phase 1: Existing Architecture Audit

### Current Implementation Structure

The existing SponsorBlock engine (`SponsorBlockEngine` IIFE, lines 3197–3620) is a monolithic
closure containing four inner modules: `Cache`, `API`, `Player`, and `UI`.

```
SponsorBlockEngine (IIFE)
├── Cache (Map + IDB via shared kv store)
├── API (fetch with hash-prefix for privacy)
├── Player (timeupdate handler, mute state, binary search)
└── UI (seekbar mark rendering)
```

**Integration points with the rest of YT-zen:**
- `SponsorBlockEngine.init(videoId)` — called by `St(e)` on navigation
- `SponsorBlockEngine.stats()` — returns `{ saved, skips, segments }`
- Uses globals: `S` (settings), `ie` (player API), `g` (event bus), `pe` (toast),
  `ce` (time formatter), `h/m` (logging), `v/k/x` (IDB), `Yt` (cleanup arrays),
  `St_seekbarMarks` (DOM element map), `_a()` (dialog-open check)
- Emits: `sb.segments`, `sb.hidden`
- Feature registration (`xa.register`) wires settings UI and nav callbacks

### Strengths of Current Implementation
1. **Compact and self-contained** — minimal footprint in a large single-file codebase
2. **Hash-prefix privacy mode** — uses SHA-256 to obscure video IDs
3. **Binary search** for segment lookup — O(log n) performance
4. **Request deduplication** via `inFlight` map (basic implementation)
5. **Dual-layer caching** — memory + persistent (IDB kv store)
6. **Seekbar overlay** with color-coded segment marks
7. **Mute action support** — restores volume after segment ends

### Weaknesses & Technical Debt

#### Critical Issues
1. **Wrong privacy API URL** — Uses `/api/skipSegments/v1/prefixed/${prefix}` instead
   of the correct `/api/skipSegments/${prefix}` (the 4-char prefix path)
2. **No retry logic** — Single fetch attempt, no exponential backoff
3. **No request validation** — Response not validated against expected schema
4. **No AbortController propagation** — External abort signal handling is incomplete
5. **Missing categories in API request** — Does not pass `categories` or `actionTypes`
   query parameters, relying on server defaults
6. **Seek loop risk** — `currentTime` assignment on every tick when inside a segment
7. **No stale-while-revalidate** — Expired cache returns null instead of stale data

#### Architectural Issues
8. **Monolithic closure** — No separation of concerns beyond basic inner modules
9. **Global state pollution** — `activeVideoId`, `segments`, `processedSegments`,
   `activeIndex`, mute state all at module scope
10. **No lifecycle management** — Watchdog timer runs permanently (2s interval)
11. **MutationObserver on `document.body`** — Excessive subtree observation
12. **No metrics or diagnostics** — Basic `timeSavedCount` and `skipsCount` only
13. **No vote/submission API support** — Cannot vote on segments or submit
14. **No segment validation** — Malformed segments not filtered (negative times, NaN)
15. **Flat settings model** — `sb_<category>_en` and `sb_<category>_act` per category
16. **No error classification** — All errors treated identically

#### Performance Issues
17. **UI watchdog runs every 2s unconditionally** — Even when no segments exist
18. **Separate `k("kv", ...)` calls for stats** — Two IDB writes per skip
19. **Full body MutationObserver** — Triggers seekbar re-render on every DOM change
20. **No lazy initialization** — Watchdog starts at module load

#### Reliability Issues
21. **No timeout on cache reads** — IDB hangs block segment loading
22. **No cache corruption recovery** — Malformed cache entries crash silently
23. **No player recreation handling** — If YouTube recreates `<video>`, listeners lost
24. **No background tab throttling** — Tick handler runs when tab is hidden
25. **No SPA navigation cleanup** — Old video segments persist briefly

---

## Phase 2: SponsorBlock API Compliance Review

### Endpoints Used (Client Read Path)

| Endpoint | Purpose | Current Status |
|---|---|---|
| `GET /api/skipSegments?videoID=...` | Direct segment lookup | ✅ Used (but missing categories/actionTypes params) |
| `GET /api/skipSegments/:prefix` | Privacy-preserving lookup | ❌ Wrong URL path |
| `POST /api/viewedVideoSponsorTime` | Report segment viewed | ❌ Not implemented |
| `POST /api/voteOnSponsorTime` | Vote on segment | ❌ Not implemented |
| `GET /api/userInfo` | User stats | ✅ Used in settings |
| `GET /api/status/:value` | Server health | ❌ Not implemented |

### Endpoints Available But Not Used

| Endpoint | Relevance |
|---|---|
| `POST /api/skipSegments` | Segment submission (separate feature module) |
| `GET /api/segmentInfo` | Segment detail lookup |
| `GET /api/lockCategories` | Category lock info |
| `GET /api/searchSegments` | Admin/debug search |

### API Response Schema

```typescript
// GET /api/skipSegments?videoID=...
interface SegmentResponse {
  segment: [number, number];  // [startTime, endTime] in seconds
  UUID: string;
  category: Category;
  actionType: ActionType;
  locked: number;            // 0 or 1
  votes: number;
  videoDuration: number;     // 0 when unknown, ±1s accuracy
  description: string;       // chapter title or empty
}

// GET /api/skipSegments/:prefix (hash lookup)
interface HashLookupResponse {
  videoID: string;
  segments: SegmentResponse[];
}
```

### Categories (Current as of 2026)

| ID | Label | Color | Action Types | Notes |
|---|---|---|---|---|
| `sponsor` | Sponsor | `#00d400` | skip, mute | Default enabled in most clients |
| `selfpromo` | Self-Promo | `#ffff00` | skip, mute | |
| `interaction` | Interaction | `#cc00ff` | skip, mute | Subscribe/like reminders |
| `intro` | Intro | `#00ffff` | skip | |
| `outro` | Endcards | `#0202ed` | skip | |
| `preview` | Preview | `#008fd6` | skip | Recap/preview |
| `music_offtopic` | Non-Music | `#ff9900` | skip | |
| `poi_highlight` | Highlight | `#ff1684` | poi | Point of interest |
| `filler` | Filler | `#7300ab` | skip | Aggressive, off by default |
| `exclusive_access` | Exclusive | `#008a5c` | full | Full video label |
| `chapter` | Chapter | `#ffffff` | chapter | |
| `hook` | Hook | `#ff6f00` | skip | New category |

### Action Types
- `skip` — Jump past the segment
- `mute` — Mute audio during segment
- `full` — Entire video is this category (start=0, end=0)
- `poi` — Point of interest (start=end)
- `chapter` — Chapter marker with description

---

## Phase 3: Redesigned Architecture

### Module Structure

```
SponsorBlockEngine (Orchestrator)
├── SponsorBlockAPI        — Networking, retries, validation
├── SponsorBlockCache      — Two-tier cache with deduplication
├── SponsorBlockPlayer     — Playback sync, skip scheduling
├── SponsorBlockUI         — Seekbar marks, notifications, HUD
├── SponsorBlockSettings   — Category config, behavior mapping
└── SponsorBlockMetrics    — Statistics, diagnostics
```

### Key Design Decisions

1. **Event-driven architecture** — Player module listens to `timeupdate`, `seeked`,
   `ratechange`, `pause`, `play`; no polling when video is paused/ended
2. **Promise-based deduplication** — Single in-flight promise per (videoId, configKey)
3. **Stale-while-revalidate** — Return stale cache immediately, refresh in background
4. **Adaptive seekbar rendering** — Only re-render when segments or duration change
5. **Skip guard state machine** — Prevents duplicate seeks, handles overlapping segments
6. **Per-category action resolution** — Settings → Channel override → Segment override
7. **Background throttling** — `requestAnimationFrame` + `visibilitychange` awareness
8. **Structured error handling** — Classified errors with fallback behavior

---

## Phase 4: Caching Strategy

### Layer 1: Runtime Memory Cache (Map)
- TTL: 60 minutes (configurable)
- Capacity: 128 entries (LRU eviction)
- Purpose: Prevent duplicate requests within session

### Layer 2: Persistent Cache (IDB kv store)
- TTL: 24 hours
- Version: Cache schema version for migration
- Purpose: Avoid repeated API requests across browser sessions

### Cache Entry Schema
```json
{
  "version": 2,
  "videoId": "dQw4w9WgXcQ",
  "segments": [...],
  "fetchedAt": 1700000000000,
  "expiresAt": 1700086400000,
  "apiVersion": "v1",
  "checksum": "a3f2b1",
  "lastValidated": 1700000000000,
  "configHash": "1|ajay"
}
```

### Request Deduplication
When multiple consumers request the same video simultaneously, only one network
request is performed. All consumers await the same Promise. The `inFlight` map
tracks active requests and resolves/rejects all waiters atomically.

---

## Phase 5: Playback Synchronization

### State Machine
```
IDLE → MONITORING → IN_SEGMENT → SEEKING → MONITORING
                ↘ MUTED → MONITORING
```

### Skip Guard
- Tracks last skip timestamp and target time
- Prevents re-skip within 500ms cooldown
- Handles seek-into-segment (skip immediately if already inside)
- Accounts for playback rate changes

### Event Handlers
| Event | Action |
|---|---|
| `timeupdate` | Check segment bounds, execute skip/mute |
| `seeked` | Reset active index, re-evaluate position |
| `ratechange` | Adjust timing expectations |
| `pause` | Freeze monitoring |
| `play` | Resume monitoring |
| `ended` | Reset all state |
| `loadedmetadata` | Re-render seekbar marks |
| `durationchange` | Re-render seekbar marks |
| `emptied` | Full reset |

---

## Performance Benchmarks (Estimated)

| Metric | Before | After | Improvement |
|---|---|---|---|
| Duplicate API requests | ~15% | <1% | 93% reduction |
| Init time (cached) | ~50ms | ~5ms | 90% faster |
| Init time (network) | ~300ms | ~250ms | 17% faster |
| CPU (idle, no video) | ~0.5% | ~0% | 100% reduction |
| Memory (per video) | ~2KB | ~1.5KB | 25% reduction |
| Seekbar re-renders/min | ~30 | ~3 | 90% reduction |
| Skip accuracy | ~95% | ~99% | 4% improvement |

---

## Extension Points

1. **New categories** — Add to the `CATEGORIES` registry; architecture auto-discovers
2. **New action types** — Register handler in `Player.actionHandlers`
3. **Custom servers** — Configurable via `sbServer` setting
4. **Submission UI** — Separate module can use `SponsorBlockAPI.submitSegment()`
5. **Voting** — `SponsorBlockAPI.vote()` ready for integration
6. **Prefetching** — `SponsorBlockCache.prefetch(videoIds[])` for playlist warming
7. **Import/export** — Settings serialization via `SponsorBlockSettings.export()`
