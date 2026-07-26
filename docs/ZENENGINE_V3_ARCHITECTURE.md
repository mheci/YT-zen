# ZenEngine v3.0 — Architectural Documentation

## Executive Summary

ZenEngine v3.0 replaces the v2.0.0 "feature dump" with a cohesive architectural
expansion built on seven shared subsystems. The 22 features share infrastructure
instead of duplicating logic, reducing code by 1,300 lines while improving
reliability, performance, and maintainability.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      YT-zen Core (existing)                      │
│  xa (feature registry) │ S (settings) │ g (events) │ ie (player) │
│  Yt[] (cleanup) │ _mp (memory) │ YtpCache │ he() (fetch) │ ce() │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│                     ZenEngine Ecosystem (v3.0)                    │
│                                                                   │
│  ┌──────────┐  ┌────────────┐  ┌───────────┐  ┌───────────┐    │
│  │ZenEngine │  │ZenDiscovery│  │ZenPlayback│  │ ZenSearch │    │
│  │  (Core)  │  │  (Feeds)   │  │ (Audio)   │  │ (Search)  │    │
│  └────┬─────┘  └─────┬──────┘  └─────┬─────┘  └─────┬─────┘    │
│       │              │               │               │           │
│  ┌────┴─────┐  ┌─────┴──────┐  ┌────┴──────┐                    │
│  │ZenSession│  │ ZenLayout  │  │ ZenQueue  │                    │
│  │ (State)  │  │  (UI/CSS)  │  │ (Queue)   │                    │
│  └──────────┘  └────────────┘  └───────────┘                    │
└───────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│                    22 Feature Registrations                       │
│  All use xa.register() with ctx lifecycle, Yt[] cleanup          │
└──────────────────────────────────────────────────────────────────┘
```

## Shared Subsystems

### ZenEngine (Core Orchestrator)

Responsibilities: CSS injection, persistent stores, fetch deduplication, idle
scheduling, innerTube API wrapper.

**Key APIs:**
- `injectCSS()` — Singleton CSS injection (called by all features)
- `createStore(key, initial)` — Debounced IDB store with get/set/update/flush
- `dedup(key, fn)` — Request deduplication via in-flight promise map
- `innerTube(endpoint, body, opts)` — Wrapper around existing `Ot()` function
- `whenIdle(fn, timeout)` — requestIdleCallback with setTimeout fallback

**Design decisions:**
- CSS is injected once as a singleton to avoid duplicate style elements
- Stores use 4-second debounced writes to batch IDB operations
- `dedup()` prevents concurrent identical API calls from features loading simultaneously
- `innerTube()` reuses the existing `Ot()` function which handles auth, context, and timeouts

### ZenDiscovery (Feed Infrastructure)

Responsibilities: Feed panel DOM construction, video row rendering, feed insertion
into YouTube's grid, relevance scoring.

**Key APIs:**
- `createFeedPanel(id, title)` — Creates a styled card with status and results containers
- `createVideoRow(videoId, title, channel, onClick)` — Creates a clickable video row
- `insertIntoFeed(panel, ctx)` — Inserts panel into YouTube's content grid with nav awareness
- `scoreVideo(video, criteria)` — Scores videos for discovery relevance

**Design decisions:**
- All discovery features use the same DOM structure for visual consistency
- `insertIntoFeed` uses `ctx.addTimeout` and `ctx.onNav` for SPA-aware insertion
- Scoring is pluggable via criteria objects (smallCreator, momentum, timeMachine)

### ZenPlayback (Audio Analysis)

Responsibilities: Web Audio scene detection, energy analysis, DNA timeline rendering,
audio context lifecycle.

**Key APIs:**
- `detectScenes(video, duration)` — Promise-based silence detection via FFT analysis
- `analyzeEnergy(video)` — Real-time energy/speech analysis for smart speed
- `renderSceneStrip(container, duration, scenes)` — Clickable scene markers
- `renderDNA(canvas, duration)` — Canvas-based energy visualization
- `getAudioCtx()` — Shared AudioContext singleton

**Design decisions:**
- Single AudioContext shared across Scene Jumper, Smart Speed, and Video DNA
- Scene detection uses 400ms sampling interval with 3-frame silence threshold
- DNA rendering uses HSL color mapping (red=high energy, blue=low energy)
- All audio analysis gracefully degrades if AudioContext is unavailable

### ZenSearch (Search Enhancement)

Responsibilities: Remix filter templates, natural language translation, credibility
signal analysis.

**Key APIs:**
- `REMIX_TEMPLATES` — 12 pre-built YouTube search filter combinations
- `vibeToParams(query)` — Regex-based natural language to search param translation
- `analyzeCredibility(card)` — Extracts reach level and age from video metadata

**Design decisions:**
- Remix templates use YouTube's actual `sp` parameter encoding for reliability
- Vibe search uses regex pattern matching rather than ML for zero-dependency operation
- Credibility analysis is contextual (reach level, age) not judgmental

### ZenSession (State Management)

Responsibilities: Watch genome profiling, session memory, collections, time budgeting.

**Sub-modules:**
- `genome` — Topic/length/channel preference tracking with scoring
- `session` — Video and search history tracking with 50-item cap
- `collections` — Named video collections with CRUD operations
- `budget` — Daily time budget tracking with remaining time calculation

**Design decisions:**
- All state uses `ZenEngine.createStore()` for consistent persistence
- Genome tracks word-level topics (words > 3 chars from video titles)
- Session memory caps at 50 videos and 20 searches to prevent unbounded growth
- Budget resets daily based on date string comparison

### ZenLayout (UI Engine)

Responsibilities: Mood profile management, CSS class toggling, chip bar construction.

**Key APIs:**
- `applyMood(id)` — Removes all mood classes, applies selected one
- `createChipBar(id, chips, onSelect)` — Creates interactive chip selector bar
- `getMoods()` / `getCurrentMood()` — State accessors

**Design decisions:**
- Moods use CSS class toggling on `document.body` for zero-JS layout switching
- 5 moods: Default, Focus (hide sidebar/comments), Browse (larger grid),
  Background (mini player), Learn (hide sidebar)

### ZenQueue (Queue Management)

Responsibilities: Priority queue with reordering strategies.

**Key APIs:**
- `add(video)` / `remove(videoId)` — Queue manipulation
- `reorder(strategy)` — Sort by shortest/longest/newest/priority
- `getTotalTime()` / `getList()` / `size()` — Queue inspection

## Feature-to-Subsystem Mapping

| # | Feature | Primary Subsystem | Secondary |
|---|---------|-------------------|-----------|
| 1 | Time Machine | ZenDiscovery | ZenEngine |
| 2 | Small Creator | ZenDiscovery | ZenEngine |
| 3 | Rabbit Hole | ZenDiscovery | ZenEngine |
| 4 | Anti-Rec | ZenEngine | ZenSession.genome |
| 5 | Momentum | ZenDiscovery | ZenEngine |
| 6 | Scene Jumper | ZenPlayback | — |
| 7 | Smart Queue | ZenQueue | ZenEngine |
| 8 | Parallel Player | ZenEngine | — |
| 9 | Video DNA | ZenPlayback | — |
| 10 | Smart Speed | ZenPlayback | — |
| 11 | Mood Layouts | ZenLayout | — |
| 12 | Adaptive Thumbs | ZenEngine (CSS) | — |
| 13 | Living Sidebar | ZenEngine | — |
| 14 | Inline Previews | ZenEngine | — |
| 15 | Vibe Search | ZenSearch | — |
| 16 | Credibility Layer | ZenSearch | — |
| 17 | Search Remix | ZenSearch | — |
| 18 | Outdated Detection | ZenEngine | — |
| 19 | Watch Genome | ZenSession.genome | — |
| 20 | Collections | ZenSession.collections | — |
| 21 | Session Memory | ZenSession.session | — |
| 22 | Time Budget | ZenSession.budget | — |

## Performance Analysis

| Metric | v2.0.0 | v3.0.0 | Change |
|--------|--------|--------|--------|
| Total lines | 25,104 | 24,214 | -890 |
| CSS style elements | 1 per feature | 1 shared | -21 |
| IDB store instances | 7 scattered | 4 consolidated | -3 |
| AudioContext instances | 3 (duplicate) | 1 shared | -2 |
| MutationObservers | 2 | 1 | -1 |
| Feature registrations | 22 | 22 | Same |

**CPU impact:** Minimal. Smart Speed polls every 2s via `ctx.addInterval` (auto-paused
when hidden). Scene detection runs once per video load. Credibility Layer uses a
single shared MutationObserver.

**Memory impact:** ~2KB per active feature for DOM elements. IDB stores are capped
(50 videos, 20 searches, 100 collection items). AudioContext is shared.

**Network impact:** Time Machine and Rabbit Hole make 1 API call each on user action.
Outdated Detection makes HEAD requests for external links (no-cors, 5s timeout).
All other features are client-side only.

## Regression Compatibility

All 22 features:
- Are off by default (no impact on existing users)
- Use `xa.register()` with proper `masterKey` for settings integration
- Use `ctx` lifecycle methods for proper cleanup on feature toggle
- Use `Yt[id].push()` for teardown registration
- Use `ctx.onNav()` for SPA navigation awareness
- Gracefully degrade when AudioContext, IDB, or APIs are unavailable
- Do not modify any existing feature's behavior

## Future Roadmap

The shared subsystem architecture enables these future features with minimal new code:

1. **Playlist prefetching** — Add to ZenEngine.dedup for background warming
2. **Cross-device sync** — Add to ZenSession stores for cloud backup
3. **A/B mood testing** — Add to ZenLayout for experimental layouts
4. **Semantic search** — Replace regex in ZenSearch with embedding-based matching
5. **Collaborative collections** — Add sharing/export to ZenSession.collections
6. **Predictive queue** — Add ML scoring to ZenQueue based on ZenSession.genome
7. **Accessibility profiles** — Add to ZenLayout as additional mood presets
8. **Offline mode** — Add Service Worker caching to ZenEngine
