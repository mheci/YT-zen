# YT-zen Technical Specification and User Guide

YT-zen is an advanced, high-performance client-side interface modification for YouTube. Operating completely within the local browser sandbox, it requires no external network connections, utilizes zero remote dependencies, and enforces strict data privacy with no telemetry or tracking mechanisms. Every architectural component is decoupled and individually configurable via a modular settings framework.

## Key Subsystems

### 1. SponsorBlock Integration
- **Database Synchronization:** Interacts with community-maintained SponsorBlock APIs using secure hash-prefix queries to protect video viewer identity.
- **Segment Actions:** Automatically intercepts playback to execute actions including skip, mute, chapter marking, and point-of-interest indicators.
- **Timeline Visualization:** Renders SVG markers directly onto the HTML5 progress bar container, matching timeline positions to API segment boundaries.

### 2. Algorithmic Filtering & Content Discovery
- **Temporal Discovery:** Features a Time Machine subsystem to load and display content matching the current calendar date from previous years.
- **Spotlight Feed:** Promotes visibility for independent creators by filtering subscription and search feeds according to custom channel subscriber thresholds.
- **De-recommendation Engine:** Implements adjacent-space category expansion to help viewers step outside filter bubbles.
- **Velocity Metrics:** Identifies rapid upload momentum by correlating initial view counts with historical channel performance.

### 3. Playback Controls & Analysis
- **Scene Detection:** Analyzes the Web Audio API stream in real-time to identify scene boundaries and silent transitions.
- **Adaptive Speed Controller:** Dynamically scales playback rates between configured thresholds depending on the ratio of active speech to background audio.
- **DNA Visualization:** Overlays a visual composite representing physical audio energy directly onto the playback seekbar.
- **Multi-Player Sync:** Enables side-by-side video rendering with synchronized play and pause cycles.

### 4. Layout Optimization
- **Structural Moods:** Switches YouTube layouts between Focus, Browse, Background, and Educational layouts through target CSS style injection.
- **Dynamic Previews:** Intercepts thumbnail hover states to display rich popups detailing channel statistics and upload age metadata.
- **Shorts Remoral:** Filters Short-format video cards from search grids, subscriptions, and home feeds, redirecting direct Shorts URLs to the standard YouTube player.

### 5. Advanced Search & Filtering
- **uBlock-Compatible Selector Engine:** Parses cosmetic filters matching uBlock Origin syntax (supporting `:has()`, `:has-text()`, `:matches-path()`).
- **Remix Filters:** Simplifies query customization with one-click chips representing upload age, resolution, and clip duration.
- **Credibility Signals:** Adds indicators to search results indicating content age, video quality badges, and creator reach metadata.

## Architectural Resource Optimization

- **BoundedCache:** Employs Least Recently Used (LRU) cache policies with fixed memory thresholds (128 elements for SponsorBlock segments, 512 elements for formatted strings).
- **WeakRef DOM Caching:** Utilizes JavaScript WeakRef and FinalizationRegistry APIs to cache DOM elements without preventing garbage collection.
- **Shared Observer:** Registers a single global MutationObserver on `document.body` to dispatch batch changes to sub-modules, replacing redundant individual observers.
- **Shared Ticker:** Consolidates background polling tasks into a single interval loop, suspending operations when the page or tab is hidden.
- **Object URL Tracking:** Manages and automatically revokes generated blob URLs on page transitions to prevent memory allocation leaks.
- **AbortGroup Lifecycle:** Groups AbortControllers by component scope, executing bulk abort commands when components are toggled off.

## Installation

### Prerequisite: Userscript Manager
Ensure a modern userscript manager is active in the target browser environment (Violentmonkey, Tampermonkey, or Greasemonkey).

### Production Build
1. Navigate to the latest release assets within the repository.
2. Select and click the link for `yt-zen.user.js`.
3. Approve the script installation prompt from the active userscript manager.

### Packaged Extension Build
1. Download the `extension` subdirectory containing the compiled build assets.
2. Navigate to your browser's extension management page (e.g., `chrome://extensions` or `about:debugging`).
3. Toggle "Developer Mode" or "Temporary Add-on Loading".
4. Select "Load Unpacked" and direct the browser to the downloaded folder.

## Keyboard Configuration

The following key combinations are registered globally upon initialization:

| Hotkey Combination | Associated Action |
| --- | --- |
| `Alt + Y` | Toggle configuration dashboard visibility |
| `Ctrl + Shift + K` | Active navigation command palette |
| `Shift + W` | Flag current video state as watched |
| `Shift + S` | Suspend playback and reset timeline position |

## Developer Guidelines & Contributing

Contributions must align with the clean, modular features framework. Ensure changes adhere to the following checklist:
- All functional modules must register using the global orchestrator API (`xa.register`).
- Elements added to the DOM must register cleanup callbacks within the feature lifecycle array `Yt`.
- Media interactions must use the memory-safe `ZenResources` utilities.

## License

This software is released into the public domain under the terms of the Unlicense. See the accompanying `LICENSE` file for details.
