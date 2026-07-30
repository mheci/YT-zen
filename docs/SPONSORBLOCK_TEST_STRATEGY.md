# SponsorBlock Subsystem Validation and Regression Test Strategy

This document defines the functional test scenarios, automated verification procedures, and regression guard points for verifying the SponsorBlock subsystem.

## Test Validation Scenarios

### 1. Installation, Migration & Cache Integrity
- **Test Scenario 1.1 (Fresh Deployment):** Verify that clean installations initialize with the current userscript defaults (SponsorBlock enabled, timeline marks enabled, and all segment categories defaulting to skip).
- **Test Scenario 1.2 (Cache Schema Migration):** Verify that deploying v2 over v1 detects the obsolete schema version, purges the deprecated persistent IndexedDB tables, and generates the new v2 cache structure without crashing.
- **Test Scenario 1.3 (Deduplication validation):** Trigger 5 simultaneous calls to `SponsorBlockEngine.init(videoId)` for the same video ID. Verify that the network tab shows exactly 1 outbound HTTP query to the SponsorBlock API.

### 2. Playback Sync and Playhead Controls
- **Test Scenario 2.1 (Standard Skip Action):** Play a video containing a sponsored segment. Verify that when the playhead reaches `segment[0]`, the video skips immediately to `segment[1]`, a toast notification is rendered (if enabled), and the cumulative "time saved" metric increases.
- **Test Scenario 2.2 (Manual Seeking):** Seek manually into the middle of an active segment. Verify that the skip action executes immediately, jumping to `segment[1]`.
- **Test Scenario 2.3 (Oscillation Prevention):** Seek backward to `segment[1] - 0.2s` immediately after a skip. Verify that the skip guard state machine blocks repeated seek requests within the 500ms cooldown window to prevent video playback freeze.
- **Test Scenario 2.4 (Mute/Unmute Lifecycle):** Play a video segment mapped to a "mute" action. Verify that the volume is suppressed at `segment[0]` and restored to its original value and state at `segment[1]`.

### 3. SPA Navigation and Timing Reliability
- **Test Scenario 3.1 (Dynamic Video Swap):** Navigate between videos in a rapid cycle. Verify that the in-flight network requests and active timers of previous video IDs are aborted immediately, preventing out-of-order segment rendering.
- **Test Scenario 3.2 (Ad Interruption):** Play a video with an active pre-roll or mid-roll ad. Verify that the skip actions are suspended, preventing media playback issues.

### 4. Progress-bar UI Marks
- **Test Scenario 4.1 (Responsive Layouts):** Toggle between standard, theater, and fullscreen modes. Verify that the SVG progress-bar markers resize and align perfectly matching the timeline duration.
- **Test Scenario 4.2 (Zero-segment fallback):** Navigate to a video with zero SponsorBlock segments. Verify that no timeline marks are drawn and the console is free of errors.

## Automated Verification Pipeline

The repository gate is deterministic and can be run without installing dependencies:

```bash
npm test
node scripts/test-sponsorblock.js JQb9eGeclQw
```

The gate rebuilds the canonical userscript from the source mirrors, runs syntax checks over the bundle and every source module, and executes `scripts/test-unit.js`. The unit suite covers:

- LRU eviction and TTL-aware cache reads;
- weak element cleanup and disposable timer scopes;
- malformed, out-of-order, duplicate, and out-of-range segment rejection;
- complete direct requests containing every category and action type;
- privacy-prefix lookups that retry a candidate-list miss without ever sending the full video ID.

The integration harness exercises the official direct repeated-query, direct JSON, privacy path repeated-query, and privacy path JSON forms. It intentionally does not treat the deprecated `prefix=` query form as a fallback because current SponsorBlock servers reject that form without a `videoID`.

The shipped engine also exposes `SponsorBlockEngine.api.normalizeSegments` for deterministic diagnostics without issuing a network request.

## Regression Guards

Every release pass must verify that:

- `yt-zen.user.js` and `yt-zen.meta.js` versions match;
- SponsorBlock network calls use the safe wrapper `he`, including write operations and abort cleanup;
- the global event bus `g` receives `sb.segments` after cached, stale, fresh, and empty lookups;
- hidden videos still perform the API lookup but never attach playback/UI actions;
- navigation aborts obsolete primary and background requests;
- all supported categories and action types remain in the request profile.
