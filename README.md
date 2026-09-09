# YT-zen

YT-zen is a userscript-first YouTube customization project. It adds optional playback, layout, discovery, history, filtering, and diagnostics features without requiring an extension build or a backend service.

The installable artifacts are:

- `yt-zen.user.js` — the complete userscript;
- `yt-zen.meta.js` — update metadata for script managers.

> Personal project, experimental. Anything can change or break without notice.

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

Manual submissions remain explicitly user initiated; YT-zen never submits segments automatically.

## Boot & launch reliability

YT-zen runs at `document-start` on every matched YouTube surface and applies after YouTube's app shell mounts (with an 8s hard cap, then a 20s repair watchdog). The launch path is protected by:

- `@sandbox JavaScript` — Tampermonkey runs the script in its JS sandbox instead of injecting an inline page-context script, which YouTube's CSP would block on cold navigations (the historical "only works after a hard refresh" cause). Violentmonkey/Greasemonkey ignore the key.
- IndexedDB can never wedge boot: opens are raced with a 3s stall guard, a blocked upgrade resolves retryable-null, and the boot config load is capped at 1.5s — the synchronous GM/localStorage config applies immediately and a late IDB merge re-applies only changed feature groups.
- bfcache restores (`pageshow`, persisted) re-arm ZenResources and re-apply features, so back/forward navigation never leaves dead features.
- `window.__zen_last_apply` + a `ytzen:applied` event mark the completed first apply; `scripts/harness-boot.js` asserts both a plain boot and a boot with a permanently-hung `indexedDB.open` still apply.

## Changelog

### 3.16.3

Boot & launch reliability (the "only works after a hard refresh" class):

- `@sandbox JavaScript` header — Tampermonkey now runs the script in its JS sandbox instead of injecting a page-context inline `<script>` that YouTube's CSP blocks on cold navigations.
- IndexedDB can no longer wedge the boot: opens raced with a 3s stall guard, `onblocked`/`onerror` resolve to null, config load capped at 1.5s with a late-merge re-apply of touched feature groups.
- bfcache restores re-arm shared resources and re-apply features (`pageshow`/persisted), with a `__zenBfcacheReapplied` diagnostics marker.
- The watchdog's shell-detection selector set now matches the boot's (adds `#page-manager`, `#contents`) so repair fires on mobile/late mounts.

Safety & stability:

- `end-winddown` teardown restores `HTMLMediaElement.prototype.play` only while it still owns the slot (was ripping out a later gate's wrapper).
- Style teardown ownership: `addStyle` tracks created ids; partial style wipes trigger repair instead of orphaned styles.
- AB-repeat loops guard against null/live-stream videos; seek+resume only on wrap.
- Cookie Control rejects `;`/CR/LF/>4096-char values.
- Settings import caps history writes at the newest 5000 entries; theme generator pins its base color to a strict `#rrggbb` literal.
- Custom-theme generator base color validated against config-import tampering.

Performance:

- The shared player-button MutationObserver now disconnects when no player buttons are registered (was a session-long body-subtree observer).
- The privileged fetch allowlist no longer expands to a dead vestigial defaults host on every request.
- redirect-shorts nav retries use context-tracked timeouts.

Testing & tooling:

- jsdom boot harness (plain + hung-IDB scenarios), CDP browser harness (cold load, SPA nav, bfcache, synthetic persisted restore) with feature-style and signature assertions.
- Build gates: structural validation of the 201-theme color table; release check that the `@sandbox` header survives the build.

## Architecture

The userscript is the canonical distribution. Every subsystem under `src/` is the canonical source and is synchronized into the bundle by `scripts/build-userscript.js` using marker replacement; edits belong in `src/`, never in `yt-zen.user.js` directly.

- `src/zen-resources.js` — the shared runtime platform: bounded caches, shared observers/tickers, deferred work, abort groups, tracked blob URLs, disposable scopes, a bus, a logger, persisted state stores, DOM helpers, and retry logic;
- `src/zen-engine-v3.js` — the Zen feature ecosystem: ZenEngine core, discovery host and tabs, playback (shared audio graph for adaptive-speed analysis), search, session/genome, queue, the AlgoEngine, and all feature registrations;
- `src/sponsorblock-engine-v2.js` — SponsorBlock state, API, cache, playback, UI, and lifecycle orchestration;
- `src/ublock-filter-engine.js` — the uBlock Origin cosmetic-filter interpreter used by channel blocking;
- `scripts/` — build, release checks, deterministic tests, and the live SponsorBlock harness.

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
