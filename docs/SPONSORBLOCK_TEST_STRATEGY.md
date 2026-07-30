# SponsorBlock Test Strategy

## Automated gate

```bash
npm test
```

The gate rebuilds the userscript, checks the bundle and all source modules, verifies version and bundle invariants, and runs deterministic tests.

The unit suite covers:

- segment shape validation, sorting, range limits, and duplicate removal;
- direct lookup requests containing all categories and action types;
- privacy candidate matching and retry after a candidate miss;
- hidden videos being looked up while playback actions remain disabled;
- LRU behavior, disposal, debounce cancellation, and weak element cleanup.

## Live transport test

```bash
node scripts/test-sponsorblock.js JQb9eGeclQw
```

The harness checks the official direct repeated-query, direct JSON, privacy path repeated-query, and privacy path JSON forms. It prints response status, exact-match status, and a sample of normalized records. It exits nonzero when a plan fails.

## Manual browser matrix

Before a release, test a video with known segments and a video without segments in:

- a fresh tab and an existing installation;
- normal watch pages and playlist/autoplay transitions;
- browser back/forward navigation;
- Shorts, live pages, theater mode, and fullscreen;
- a dynamically replaced player;
- a hidden tab that is later focused;
- slow network, offline transition, malformed-cache migration, and server recovery;
- each category action: skip, mute, label-only, point, chapter, and disabled.

Verify that old segments never act on a new video, muted audio is restored, timeline marks disappear on transition, and re-enabling SponsorBlock does not duplicate listeners or requests.

## Release guards

- `yt-zen.user.js` and `yt-zen.meta.js` versions match `package.json`;
- the bundle contains one ZenResources mirror;
- deprecated privacy query plans are absent;
- every valid lookup uses the complete category/action profile;
- manual submission remains user initiated;
- the working tree is clean before tagging.
