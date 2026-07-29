# ZenEngine Architectural and System Design Specification

This document details the core framework, subsystems, and modular feature registries of the ZenEngine platform.

## Architecture Overview

ZenEngine provides a highly optimized, decoupled environment designed to coordinate client-side modifications on YouTube. To minimize performance overhead and eliminate code duplication, the platform consolidates shared operations into seven logical subsystems.

```
┌─────────────────────────────────────────────────────────────────┐
│                      YT-zen Core Platform                       │
│  - Modular registry (xa)      - Dynamic Settings Context (S)    │
|  - Event dispatch bus (g)     - Media player state utility (ie) │
|  - Storage abstractions (v/k) - Bounded memory cache (de)       |
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│                    ZenEngine Shared Subsystems                  │
│                                                                 │
│  - ZenEngine (Core Orchestration and Database Operations)        │
|  - ZenDiscovery (Dynamic grid insertion and feed panels)        |
|  - ZenPlayback (FFT Audio analysis and Energy visualizations)   |
|  - ZenSearch (Natural query translation & credibility analysis) │
|  - ZenSession (Watch genome state and session indexing)          |
|  - ZenLayout (Dynamic CSS-class mood profiles)                  |
|  - ZenQueue (Priority queue scheduling & sorting)               |
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│                 Modular Feature Implementations                 │
│  - 22 functional features registered via xa.register()          |
|  - Fully integrated with context timers, listeners, and Yt[]     |
+-----------------------------------------------------------------+
```

## Subsystem Specifications

### 1. ZenEngine (Core Orchestrator)
- **Singleton Stylesheet Injection:** Consolidates CSS overrides into a single dynamically updated stylesheet, preventing DOM clutter and layout thrashing from duplicated `<style>` tags.
- **Batched Persistence Store:** Manages persistent state using an IndexedDB abstraction. Writes are batched and debounced with a 4-second delay to optimize database transaction performance.
- **Request Coordination:** Uses an in-flight promise map to deduplicate identical concurrent API requests triggered by adjacent features.
- **Execution Scheduling:** Implements a wrapper over `requestIdleCallback` (with fallback to `setTimeout` on older browsers) to schedule non-critical DOM additions during main thread idle times.

### 2. ZenDiscovery (Feeds & Recommendations)
- **Unified Feed Construction:** Standardizes discoverability panels using consistent styled layouts with built-in status updates and results containers.
- **Dynamic Feed Grid Insertion:** Monitors and hooks into YouTube's SPA navigation, inserting custom panels into YouTube's feed grids when target DOM wrappers become active.

### 3. ZenPlayback (Audio Analysis Engine)
- **Singleton Audio Context:** Operates a single, shared `AudioContext` instance across Scene Jumper, Smart Speed, and Video DNA modules, minimizing CPU and memory footprints.
- **Scene Transition Analysis:** Executes real-time Fast Fourier Transform (FFT) frequency analysis to identify video scene transitions based on quiet-to-sound thresholds.
- **Adaptive Playback Rate Scaling:** Analyzes real-time audio amplitude to scale playback rates dynamically depending on speech density.

### 4. ZenSearch (Credibility and Mapping)
- **Remix Filters:** Simplifies search queries using one-click chips mapped to YouTube's query parameters (upload date, duration, resolution).
- **Vibe Parameter Compiler:** Translates natural language queries into compatible parameter arrays using direct pattern-matching regex compilers.
- **Credibility Analyzer:** Extracts creator reach level and content age indicators from search cards.

### 5. ZenSession (Personalization and Genome Tracking)
- **Watch Genome Profiling:** Tracks topic preferences by extracting word-level metadata from watched video titles, mapping values into channel and category weight scores.
- **Session Memory Indexing:** Caches recent search inputs and video play positions, enforcing strict limits (max 50 entries) to prevent unbounded memory growth.
- **Budget Tracking:** Monitors cumulative watch duration, triggering alerts and suspending playback when the daily session limit is exceeded.

### 6. ZenLayout (Layout profiles)
- **Zero-JS Mood Swapping:** Manages layout modifications (Default, Focus, Browse, Background, Learn) by applying CSS classes directly to `document.body`, utilizing GPU-accelerated layout recalculations.

### 7. ZenQueue (Queue Scheduler)
- **Priority Scheduling:** Manages client-side watch queues, offering sorting sorting options based on video duration, publication date, and watch compatibility weightings.
