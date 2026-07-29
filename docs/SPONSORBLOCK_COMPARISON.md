# SponsorBlock Subsystem Structural and Operational Comparison

This document provides a comparative analysis of the redesigned SponsorBlock subsystem (v2) against the previous version (v1), outlining improvements in API conformity, performance, and stability.

## Architectural Metrics Comparison

| Attribute | Version 1 (Obsolete) | Version 2 (Production) | Impact |
| --- | --- | --- | --- |
| Component Granularity | Monolithic closure (4 blocks) | Modular subsystems (7 blocks) | Structural separation of concerns |
| API Specification Coverage | Partial (missing parameters) | Complete (fully compliant) | Complete feature compatibility |
| Memory Management | Primitive listener references | Weak-reference / event-driven | Eradication of listener leaks |
| Cache Retrieval Strategy | Binary fresh/null query | Stale-while-revalidate (SWR) | Reduced latency & API demand |
| CPU Footprint (Background) | Periodic polling | Event-driven (suspended on hide) | Zero background CPU demand |
| DOM Mutation Overhead | Full document observation | Scoped container observation | Reduced layout thrashing |

## Functional Module Improvements

### 1. API Integration & Payload Validation
- **Previous Implementation:** Made requests to an incorrect URL structure (`/v1/prefixed/${prefix}`) and omitted critical parameters (`categories` and `actionTypes`), relying on default server profiles. Responses were parsed raw with no type or constraint checking.
- **Current Redesign:** Queries the standard endpoint with complete query parameters. Implements strict structural validation via a typing parser: segment boundaries are checked, and malformed entries (non-numeric, negative, or overlapping values) are discarded immediately.

### 2. Cache Strategy
- **Previous Implementation:** Checked first-layer memory and second-layer IndexedDB for fresh segments only. If expired, entries were discarded, initiating immediate remote fetch blocks.
- **Current Redesign:** Integrates an LRU eviction strategy (maximum 128 elements) in memory and a 24-hour persistent store. Uses a Stale-While-Revalidate (SWR) pattern: if expired cache data is within a 12-hour grace period, it is returned instantly to display timeline marks while a background task refreshes the data store.

### 3. Playback Synchronization
- **Previous Implementation:** Monitored playback via tight listeners on specific video elements. Lacked a seek guard, meaning that the playhead would seek repeatedly on every single `timeupdate` event within a segment.
- **Current Redesign:** Listens to media events via capturing phase listeners on the global `document`. Utilizes a state machine with a skip guard: once a segment is skipped, its unique identifier is cached, and subsequent skips within a 500ms cooldown window are blocked.

### 4. Error Mitigation & Robustness
- **Previous Implementation:** Made single network requests. Any network failure or timeout could lock playback or result in silent failures.
- **Current Redesign:** Implements exponential backoff retry logic (starting at 500ms, doubling on each failure, up to 2 retries). Integrates full AbortController coordination: navigating to a new video or pausing immediately cancels all active, in-flight network promises and associated timers.

### 5. UI Render Management
- **Previous Implementation:** Re-rendered seekbar markers every 2 seconds unconditionally, utilizing a global `MutationObserver` watching changes across the entire document body, which caused layout thrashing.
- **Current Redesign:** Scopes its `MutationObserver` strictly to the `#movie_player` container. Implements a rendering cache to prevent DOM updates unless the video duration, segment coordinates, or active categories have changed.
