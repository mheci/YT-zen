# SponsorBlock Subsystem Validation and Regression Test Strategy

This document defines the functional test scenarios, automated verification procedures, and regression guard points for verifying the SponsorBlock subsystem.

## Test Validation Scenarios

### 1. Installation, Migration & Cache Integrity
- **Test Scenario 1.1 (Fresh Deployment):** Verify that clean installations initialize with the correct default configuration (SponsorBlock disabled by default, privacy mode active).
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

The build pipeline (`.github/workflows/build.yml`) runs the following automated verification checks:

```bash
# Verify syntax of all modified source files
node -c yt-zen.user.js
node -c extension/yt-zen.user.js
node -c src/sponsorblock-engine-v2.js

# Assert that critical public methods exist in SponsorBlockEngine export
node -e "
  const content = require('fs').readFileSync('yt-zen.user.js', 'utf8');
  const assertions = ['init', 'destroy', 'invalidate', 'stats', 'metrics', 'getSegments'];
  assertions.forEach(m => {
    if (!content.includes(m)) {
      console.error('CRITICAL ERROR: Missing SponsorBlockEngine method export: ' + m);
      process.exit(1);
    }
  });
  console.log('Success: All SponsorBlock exports verified!');
"
```

## Regression Guard Checklist

Before completing a release pass, ensure the following parameters are satisfied:
- [ ] Userscript and manifest metadata versions match.
- [ ] Direct calls to `fetch()` targeting external SponsorBlock domains are fully replaced by the safe fetch wrapper `he` to preserve CSP compatibility.
- [ ] The global event bus `g` receives the `sb.segments` event on successful initialization to preserve compatibility with other modules like the Heatmap.
