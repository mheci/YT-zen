# YT-zen

Clean, lightweight, and customizable client-side interface for YouTube.

## Overview

YT-zen is a browser userscript and extension that transforms YouTube into a personalized viewing platform. It runs entirely locally in your browser with no external network requests, no remote dependencies, and no data collection. Every feature is independently toggleable and designed to coexist without conflicts.

## Features

### Content Discovery

- **SponsorBlock Integration** — Skip sponsored segments, intros, outros, and interaction reminders using community-sourced timing data. Supports all 5 SponsorBlock action types (skip, mute, highlight, chapter, full-video label) with per-category configuration.
- **Time Machine Feed** — Surface videos from your subscriptions uploaded on this date in previous years.
- **Small Creator Spotlight** — Discovery feed for channels below a configurable subscriber threshold.
- **Anti-Recommendation Engine** — Break filter bubbles by surfacing content from adjacent interest spaces.
- **Before It Blew Up** — Find videos gaining momentum based on view velocity relative to channel size.

### Playback & Navigation

- **Scene Jumper** — Auto-detect scene transitions using Web Audio silence analysis. Click markers to jump.
- **Smart Speed** — Automatically adjust playback speed based on audio content density (speech vs silence vs music).
- **Video DNA Timeline** — Composite energy visualization overlaid on the progress bar.
- **Parallel Player** — Watch two videos side by side with synchronized playback.
- **Smart Watch Queue** — Intelligent queue with priority ordering, time estimates, and session planning.
- **Automatic Video Resume** — Remember exact watch positions and offer to continue playback.
- **AB Loop** — Set start and end points for repeated playback of a video segment.

### Layout & Interface

- **Mood-Based Layouts** — Switch between Focus, Browse, Background, and Learn layouts with one click.
- **Adaptive Thumbnail Density** — Thumbnails resize based on content type.
- **Living Sidebar** — Context-aware sidebar that adapts to the current page.
- **Inline Video Previews** — Rich hover cards with channel stats and metadata.
- **Remove Shorts** — Hide Shorts from feeds, sidebars, and search results. Redirect Shorts links to the standard player.

### Search & Filtering

- **Channel Blocker** — Full uBlock Origin cosmetic filter interpreter. Supports `:has()`, `:has-text()`, `:matches-path()`, `:is()`, and all standard CSS selectors. Paste community filter lists directly.
- **Search Remix** — One-click search filter presets (duration, date, quality, format).
- **Credibility Layer** — Context signals on search results (reach level, age badges).
- **Vibe Search** — Natural language search that translates to YouTube filter parameters.
- **Outdated Content Detector** — Flags broken description links and age badges on old videos.

### Personalization

- **Watch Genome** — Transparent preference model tracking topics, length, channels, and style. Shows compatibility scores on thumbnails.
- **Curated Collections** — Themed video collections with descriptions and progress tracking.
- **Session Memory** — Remembers browsing context (recent searches, watched videos) across sessions.
- **Time Budget Manager** — Set a session time budget with visual progress tracking.

### Performance & Privacy

- **Performance Mode** — Three-tier optimization engine: CSS containment, lazy thumbnails with IntersectionObserver, comment virtualization, GPU layer management, memory trimming, network prefetching, font optimization, and background tab throttling.
- **Resource Efficiency** — Bounded LRU caches with automatic eviction, WeakRef-based DOM element caching, shared MutationObserver, consolidated interval timers, tracked blob URLs with automatic revocation, and grouped AbortControllers.

## Installation

### Userscript (Recommended)

1. Install a userscript manager: [Tampermonkey](https://www.tampermonkey.net/), [Violentmonkey](https://violentmonkey.github.io/), or [Greasemonkey](https://www.greasespot.net/).
2. Click the [installation link](https://github.com/mheci/YT-zen/releases/latest/download/yt-zen.user.js).
3. Confirm the installation, then open YouTube.

### Browser Extension

Download the `extension/` folder from the repository and load it as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked) or Firefox (`about:debugging` → Load Temporary Add-on).

## Keyboard Shortcuts

| Keybind | Action |
|---|---|
| **Alt+Y** | Open/close settings dashboard |
| **Ctrl+Shift+K** | Open command palette |
| **Shift+W** | Force-mark video as watched |
| **Shift+S** | Stop playback and reset position |

## Architecture

YT-zen is built on a modular feature registration system where each feature:

- Registers via `xa.register()` with a unique ID, settings keys, and lifecycle hooks
- Uses the `ctx` object for managed timers, intervals, observers, and event listeners
- Cleans up automatically when disabled via the `Yt[]` teardown array
- Degrades gracefully when APIs or browser capabilities are unavailable

Shared subsystems include:

- **SponsorBlockEngine** — 7-module architecture (API, Cache, Player, UI, Metrics, Settings, Orchestrator)
- **ZenEngine** — Core orchestrator with CSS injection, IDB stores, fetch deduplication
- **ZenDiscovery** — Feed infrastructure, video scoring, relevance ranking
- **ZenPlayback** — Web Audio analysis, scene detection, adaptive speed
- **ZenSearch** — Filter templates, natural language translation, credibility analysis
- **ZenSession** — Genome profiling, session memory, collections, time budgeting
- **ZenLayout** — Mood profiles, adaptive density, sidebar management
- **ZenQueue** — Priority queue with reordering strategies
- **UBlockEngine** — uBlock Origin cosmetic filter interpreter
- **ZenResources** — Memory safety layer (bounded caches, weak refs, shared observers, tracked blob URLs, abort groups)

## Resource Efficiency

Memory safety and CPU efficiency are first-class concerns:

- **BoundedCache** — All Map-based caches use LRU eviction with configurable max sizes (time format: 512, thumbnails: 64, SB segments: 128)
- **WeakElementCache** — DOM element caches use WeakRef with FinalizationRegistry for automatic garbage collection
- **SharedObserver** — Single MutationObserver on `document.body` dispatches to subscribers, replacing 10+ per-feature observers
- **SharedTicker** — Consolidated interval timer replaces multiple `setInterval` calls, pauses when tab is hidden
- **TrackedBlobURL** — All `createObjectURL` calls are tracked and automatically revoked after 30 minutes or on page unload
- **AbortGroup** — Feature-scoped AbortControllers enable bulk cancellation on feature disable
- **DeferredTask** — Non-critical DOM operations use `requestIdleCallback` with `setTimeout` fallback
- **Periodic cleanup** — Memory pool maintenance, blob URL revocation, and cache eviction run every 30 seconds

## Contributing

This project is developed and maintained by mheci.

## License

This is free and unencumbered software released into the public domain under the [Unlicense](https://unlicense.org/).
