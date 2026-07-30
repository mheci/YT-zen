# YT-zen

YT-zen is a userscript-first YouTube overhaul focused on fast client-side customization, aggressive playback cleanup, and a hardened SponsorBlock integration.

This repository now ships and maintains only the userscript build:
- `yt-zen.user.js`
- `yt-zen.meta.js`

## Current direction

- userscript-only distribution
- full SponsorBlock-first playback cleanup
- no browser-extension packaging in-repo
- leaner maintenance surface

## SponsorBlock highlights

- lookup is performed on watch-page load and navigation retries
- all supported SponsorBlock segment categories are enabled by default
- all segment categories default to `skip`
- resilient multi-plan fetch paths for segment retrieval
- built-in vote, undo-vote, category-change, viewed-report, submission, and user-info API helpers
- timeline marks, skip HUD, local hide/unhide, and per-video refresh controls

## Installation

1. Install a userscript manager such as Violentmonkey, Tampermonkey, or Greasemonkey.
2. Open the latest release.
3. Install `yt-zen.user.js`.
4. Keep `yt-zen.meta.js` available for update checks if your manager uses it.

## Repository layout

- `yt-zen.user.js` — canonical shipped userscript
- `yt-zen.meta.js` — update metadata
- `src/` — source-side modular mirrors for major subsystems
- `docs/` — architecture and test notes

## Development notes

The shipped userscript is generated from the high-risk source mirrors. Run the complete local gate before committing:

```bash
npm test
node scripts/test-sponsorblock.js JQb9eGeclQw
```

`npm test` rebuilds `yt-zen.user.js`, checks every JavaScript file, and runs deterministic unit tests for cache eviction, disposal, segment normalization, direct API lookups, and privacy-prefix fallback. The integration harness exercises both supported direct encodings and both privacy-path encodings against SponsorBlock.

- SponsorBlock logic lives in `src/sponsorblock-engine-v2.js`
- shared resource primitives live in `src/zen-resources.js`
- `scripts/build-userscript.js` keeps those mirrors synchronized with the installable bundle

### SponsorBlock lookup contract

Every valid watch-page video is looked up when SponsorBlock is enabled, including videos with a fresh cache entry and videos hidden locally. Fresh/stale data is rendered immediately when possible, then revalidated in the background. Concurrent lookups are deduplicated, navigation aborts obsolete requests, and a hidden video suppresses playback/UI actions without suppressing the API lookup.

The request profile asks for every supported SponsorBlock category and action type. User preferences are applied client-side, so changing a category action never requires a new server profile and never hides segments from the cache.

## License

Released under the Unlicense.