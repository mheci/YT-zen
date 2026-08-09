# YT-zen

YT-zen is a userscript-first YouTube customization project. It adds optional playback, layout, discovery, history, filtering, and diagnostics features without requiring an extension build or a backend service.

The installable artifacts are:

- `yt-zen.user.js` — the complete userscript;
- `yt-zen.meta.js` — update metadata for script managers.

## Install

### 1. Add a userscript manager

YT-zen needs a userscript manager. Install one from your browser's official store:

| Manager | Chrome / Edge (Chromium) | Firefox |
| --- | --- | --- |
| **Tampermonkey** (recommended) | [Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) · [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) |
| **Violentmonkey** | [Chrome Web Store](https://chromewebstore.google.com/detail/violent-monkey/jinjaccalgkegednnccohejagnlnfdag) · [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/violentmonkey/eeagobfjdenkkddmbclomhiblgggliao) | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/) |
| **Greasemonkey** | — | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) |

Chromium-based browsers (Edge, Opera, Brave, Vivaldi) can also install from the Chrome Web Store.

1. Open the store page for the manager you picked and click **Add to Chrome** / **Install for Firefox**.
2. Approve the permission prompt — the manager's icon appears in your browser toolbar.

### 2. Install YT-zen

1. Open the [latest YT-zen release](https://github.com/mheci/YT-zen/releases/latest) and click **`yt-zen.user.js`** under Assets — or open the direct link: <https://github.com/mheci/YT-zen/releases/latest/download/yt-zen.user.js>.
2. Your manager intercepts the download and opens its install page. Review the script (name, version, and the `@match` sites it runs on: `youtube.com`, `m.youtube.com`, `music.youtube.com`).
3. Click **Install** (Tampermonkey) or **Confirm** (Violentmonkey).
4. Done — open or refresh `youtube.com`. YT-zen is now active.

### 3. Set up (about a minute)

1. Open any YouTube page.
2. Open the **YT-zen dashboard**:
   - click the **YT-zen logo button** next to the player's settings gear (enabled by default), or
   - right-click your manager's toolbar icon → **Open YT-zen dashboard**, or
   - use a dashboard hotkey if you mapped one.
3. Browse the sections (**Theming**, **Playback**, **Feed**, **Hiding**, …) and flip the switches you want — changes apply instantly, no reload needed.
4. Use the **search box** at the top of the dashboard to filter features by name.
5. Under **Theming**, pick one of the 200 built-in themes, or keep "Default (YouTube)".
6. Under **Hide Page Elements**, try a quick preset such as *Minimal Clean*, or hide individual page pieces with a live preview.

### Updates

YT-zen checks for updates through the release metadata (`yt-zen.meta.js`). When a new version ships, your manager will offer to install it — keep automatic updates enabled and allow the update when prompted.

### What YT-zen covers

YT-zen runs on YouTube, YouTube Music, and the mobile YouTube site, per the matches in the userscript header. Features are disabled by default unless their individual setting says otherwise. SponsorBlock is the exception: it is enabled with every supported category enabled and automatic skip actions selected.

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

The userscript is the canonical distribution. Every subsystem under `src/` is the canonical source and is synchronized into the bundle by `scripts/build-userscript.js` using marker replacement; edits belong in `src/`, never in `yt-zen.user.js` directly.

- `src/zen-resources.js` — the shared runtime platform: bounded caches, shared observers/tickers, deferred work, abort groups, tracked blob URLs, disposable scopes, a bus, a logger, persisted state stores, DOM helpers, and retry logic;
- `src/zen-engine-v3.js` — the Zen feature ecosystem: ZenEngine core, discovery host and tabs, playback (shared audio graph for adaptive-speed analysis), search, session/genome, queue, the AlgoEngine, and all feature registrations;
- `src/sponsorblock-engine-v2.js` — SponsorBlock state, API, cache, playback, UI, and lifecycle orchestration;
- `src/ublock-filter-engine.js` — the uBlock Origin cosmetic-filter interpreter used by channel blocking;
- `scripts/` — build, release checks, deterministic tests, and the live SponsorBlock harness;
- `docs/` — current architecture, API, performance, testing, and contributor documentation.

`npm run build` regenerates `yt-zen.user.js` from the sources; the build is idempotent and byte-stable, so a rebuild of an unchanged tree produces no diff.

## Development

Node.js 18 or newer is required. The project intentionally has no runtime npm dependencies.

```bash
npm test
node scripts/test-sponsorblock.js JQb9eGeclQw
```

`npm test` rebuilds the userscript, checks every JavaScript file for syntax, verifies release invariants, and runs deterministic tests for resource ownership, cache behavior, bus/logger/state-store behavior, segment normalization, direct API lookups, privacy lookup matching, and hidden-video lookup behavior.

The live harness checks the official direct repeated-query, direct JSON, privacy path repeated-query, and privacy path JSON forms. Network availability is required only for the live harness; the normal test gate is deterministic.

## Releases

Releases use semantic version tags such as `v3.9.0`. Before creating a tag:

```bash
npm test
git status --short
git tag -a vX.Y.Z -m "YT-zen X.Y.Z stable release"
git push origin main --follow-tags
```

Attach `yt-zen.user.js` and `yt-zen.meta.js` to the GitHub release. Do not publish a release from a dirty working tree.

## License

Released under the Unlicense.
