# SponsorBlock Engine v2 — Test Validation Strategy

## Test Matrix

### Category 1: Installation & Migration

| Test ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| T-1.1 | First install (no cache) | Fresh fetch, cache populated | P0 |
| T-1.2 | Existing user with v1 cache | v1 entries invalidated, v2 entries created | P0 |
| T-1.3 | Existing user with v2 cache | Cache hit, instant load | P0 |
| T-1.4 | Upgrade from older version | No crashes, settings preserved | P1 |

### Category 2: Core Functionality

| Test ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| T-2.1 | Video with sponsor segments | Segments loaded, skips execute | P0 |
| T-2.2 | Video with no segments | 404 handled gracefully, no errors | P0 |
| T-2.3 | All categories enabled | All categories fetched from API | P1 |
| T-2.4 | Single category enabled | Only that category fetched | P1 |
| T-2.5 | No categories enabled | No API request made | P1 |
| T-2.6 | Skip action | Video seeks to segment end | P0 |
| T-2.7 | Mute action | Video muted during segment, restored after | P0 |
| T-2.8 | Disabled action | Segment ignored | P0 |
| T-2.9 | POI segment | No skip (display only) | P1 |
| T-2.10 | Chapter segment | No skip (display only) | P1 |

### Category 3: Caching

| Test ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| T-3.1 | Fresh cache miss | API request, result cached | P0 |
| T-3.2 | Memory cache hit | No API request, instant return | P0 |
| T-3.3 | Persistent cache hit | Promoted to memory | P0 |
| T-3.4 | Stale cache (within grace) | Served immediately + background refresh | P1 |
| T-3.5 | Expired cache (beyond grace) | Deleted, fresh fetch | P1 |
| T-3.6 | Cache version mismatch | Entry deleted, fresh fetch | P1 |
| T-3.7 | LRU eviction at capacity | Oldest entries removed first | P2 |
| T-3.8 | Request deduplication | Single request for concurrent callers | P0 |
| T-3.9 | IDB corruption | Graceful fallback to network | P1 |
| T-3.10 | Browser restart | Persistent cache survives | P1 |

### Category 4: Playback Synchronization

| Test ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| T-4.1 | Normal playback with segments | Skip at segment start | P0 |
| T-4.2 | Manual seek into segment | Immediate skip | P0 |
| T-4.3 | Manual seek past segment | No skip | P0 |
| T-4.4 | Seek to segment boundary | Skip at exact start | P1 |
| T-4.5 | Rapid seeking | No duplicate skips | P0 |
| T-4.6 | Playback speed 2x | Skip still accurate | P1 |
| T-4.7 | Playback speed 0.5x | Skip still accurate | P1 |
| T-4.8 | Paused playback | No skip while paused | P0 |
| T-4.9 | Resume from pause | Monitoring resumes | P0 |
| T-4.10 | Video ended | State reset | P1 |
| T-4.11 | Buffering/stalled | No skip during buffer | P1 |
| T-4.12 | Skip cooldown | No double-skip within 500ms | P0 |
| T-4.13 | Overlapping segments | First segment processed, second handled | P1 |

### Category 5: Navigation & SPA

| Test ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| T-5.1 | Navigate to new video | Old request cancelled, new init | P0 |
| T-5.2 | Navigate back to cached video | Cache hit | P1 |
| T-5.3 | Rapid navigation (5 videos in 10s) | Only last video's request completes | P0 |
| T-5.4 | Playlist autoplay | Segments loaded for each video | P0 |
| T-5.5 | YouTube Shorts | Engine handles gracefully | P1 |
| T-5.6 | Live stream | No segments, no errors | P1 |
| T-5.7 | Premiere | Segments loaded when available | P2 |
| T-5.8 | Embedded player | Works in embed context | P2 |

### Category 6: Network Resilience

| Test ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| T-6.1 | API returns 200 | Segments parsed | P0 |
| T-6.2 | API returns 404 | Empty segments, no error | P0 |
| T-6.3 | API returns 400 | Error logged, fallback to cache | P1 |
| T-6.4 | API returns 500 | Retry, fallback to cache | P0 |
| T-6.5 | API returns 503 | Retry, fallback to cache | P1 |
| T-6.6 | Network timeout | Retry with backoff | P0 |
| T-6.7 | Network offline | Fallback to stale cache | P0 |
| T-6.8 | Malformed JSON | Error handled, empty segments | P1 |
| T-6.9 | Partial response | Valid segments kept, invalid filtered | P1 |
| T-6.10 | Slow network (3G) | Timeout handled, retry | P2 |

### Category 7: UI & Seekbar

| Test ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| T-7.1 | Seekbar enabled | Marks rendered | P0 |
| T-7.2 | Seekbar disabled | No marks | P0 |
| T-7.3 | Toggle seekbar on/off | Marks appear/disappear | P1 |
| T-7.4 | Color overrides | Custom colors applied | P1 |
| T-7.5 | Category disabled | No marks for that category | P1 |
| T-7.6 | Progress bar not visible | No errors, graceful skip | P1 |
| T-7.7 | Theater mode | Marks render correctly | P2 |
| T-7.8 | Fullscreen | Marks render correctly | P2 |

### Category 8: Performance

| Test ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| T-8.1 | Tab hidden | No CPU usage from engine | P0 |
| T-8.2 | Tab visible, no video | No CPU usage | P0 |
| T-8.3 | Tab visible, video paused | Minimal CPU (no polling) | P0 |
| T-8.4 | Tab visible, video playing | <1% CPU | P1 |
| T-8.5 | Long session (4 hours) | No memory leak | P0 |
| T-8.6 | 50+ video navigations | No listener leak | P0 |
| T-8.7 | Multiple tabs open | Each tab independent | P1 |
| T-8.8 | Browser sleep/resume | Engine recovers gracefully | P1 |

### Category 9: Integration

| Test ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| T-9.1 | Ad showing | No skip during ad | P0 |
| T-9.2 | Dialog popup | No skip during dialog | P1 |
| T-9.3 | Settings change (category toggle) | Immediate effect on next video | P0 |
| T-9.4 | Settings change (action type) | Immediate effect on next video | P0 |
| T-9.5 | Settings change (server URL) | New server used | P1 |
| T-9.6 | Settings change (privacy mode) | Hash prefix used | P1 |
| T-9.7 | HUD enabled | Stats displayed | P2 |
| T-9.8 | Toast enabled | Notifications shown on skip | P1 |
| T-9.9 | Unified heatmap + SB | Both render correctly | P2 |
| T-9.10 | Dashboard SB section | All controls functional | P1 |

## Validation Checklist

### Automated (Node.js)
```bash
# Syntax validation
node -c yt-zen.user.js

# Check for undefined references
grep -n "Bt_invalidateMarks\|Bt_hideVideo\|Bt_unHideVideo\|Bt_getUserInfo" yt-zen.user.js

# Check engine exports
grep -n "SponsorBlockEngine\." yt-zen.user.js

# Verify no duplicate function definitions
grep -c "function Ct()" yt-zen.user.js  # Should be 1
```

### Manual (Browser)
1. Install userscript/extension
2. Open YouTube
3. Navigate to video with known segments
4. Verify segments load (check network tab)
5. Verify seekbar marks appear
6. Verify skip executes at correct time
7. Verify toast notification shows
8. Navigate to another video
9. Verify new segments load
10. Navigate back — verify cache hit (no network request)
11. Disable a category — verify no marks/skips for it
12. Enable mute action — verify mute behavior
13. Open dashboard — verify SB stats display
14. Check console for errors
15. Run for 1+ hour — check memory usage stability

## Regression Guard Points

These specific behaviors MUST NOT regress:
- ✅ Existing users' settings are preserved on upgrade
- ✅ Existing users' cached segments remain usable (or gracefully invalidated)
- ✅ The `sb.segments` event is still emitted for the unified heatmap
- ✅ The `SponsorBlockEngine.stats()` API still returns `{ saved, skips, segments }`
- ✅ The feature registration's `apply()` and `settings()` callbacks work
- ✅ Color picker overrides in settings still function
- ✅ Per-category enable/action toggles still function
- ✅ The `Ct()` interval callback works for seekbar refresh
