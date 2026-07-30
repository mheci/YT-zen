# YT-zen

YT-zen is a userscript-first YouTube customization project. It adds optional playback, layout, discovery, history, filtering, and diagnostics features without requiring an extension build or a backend service.

The installable artifacts are:

- `yt-zen.user.js` — the complete userscript;
- `yt-zen.meta.js` — update metadata for script managers.

## Install

1. Install Violentmonkey, Tampermonkey, or another userscript manager.
2. Open the current GitHub release.
3. Install `yt-zen.user.js`.
4. Allow updates from the release metadata when prompted.

YT-zen runs on YouTube, YouTube Music, and mobile YouTube matches declared in the userscript header. Features are disabled by default unless their individual setting says otherwise. SponsorBlock is the exception: it is enabled with every supported category enabled and automatic skip actions selected.

## SponsorBlock

SponsorBlock is initialized automatically for every valid YouTube video identifier detected during watch-page initialization, SPA navigation, playlist changes, autoplay transitions, player replacement, browser-history navigation, and tab wake-up.

The integration:

- queries the official SponsorBlock server using the complete category and action-type profile;
- supports both direct and privacy-preserving hash-prefix lookups;
- filters privacy responses by exact video ID;
- validates and de-duplicates every segment before playback sees it;
- serves bounded cached data while revalidating on every video load;
- aborts obsolete requests during navigation;
- keeps errors, telemetry, votes, and manual submissions isolated from playback;
- lets each category be disabled or assigned a playback action;
- retains timeline marks, skip notifications, local hide/unhide, voting, user information, and manual segment submission.

The API contract is documented in [`docs/SPONSORBLOCK_API_CONTRACT.md`](docs/SPONSORBLOCK_API_CONTRACT.md). Manual submissions remain explicitly user initiated; YT-zen never submits segments automatically.

## Architecture

The userscript is the canonical distribution. High-risk subsystems have reviewable source mirrors and are synchronized into the bundle by `scripts/build-userscript.js`.

- `src/sponsorblock-engine-v2.js` — SponsorBlock state, API, cache, playback, UI, and lifecycle orchestration;
- `src/zen-resources.js` — bounded caches, shared observers/tickers, deferred work, abort groups, blob URLs, and disposable scopes;
- `src/zen-engine-v3.js` — source mirror for the Zen feature ecosystem;
- `src/advanced-features.js`, `src/algo-engine.js`, `src/ublock-filter-engine.js` — source mirrors for the remaining feature families;
- `scripts/` — build, release checks, deterministic tests, and the live SponsorBlock harness;
- `docs/` — current architecture, API, performance, testing, and contributor documentation.

## Development

Node.js 18 or newer is required. The project intentionally has no runtime npm dependencies.

```bash
npm test
node scripts/test-sponsorblock.js JQb9eGeclQw
```

`npm test` rebuilds the userscript, checks every JavaScript file, verifies release invariants, and runs deterministic tests for resource ownership, cache behavior, segment normalization, direct API lookups, privacy lookup matching, and hidden-video lookup behavior.

The live harness checks the official direct repeated-query, direct JSON, privacy path repeated-query, and privacy path JSON forms. Network availability is required only for the live harness; the normal test gate is deterministic.

## Releases

Releases use semantic version tags such as `v3.8.0`. Before creating a tag:

```bash
npm test
git status --short
git tag -a vX.Y.Z -m "YT-zen X.Y.Z stable release"
git push origin main --follow-tags
```

Attach `yt-zen.user.js` and `yt-zen.meta.js` to the GitHub release. Do not publish a release from a dirty working tree.

## License

Released under the Unlicense.
