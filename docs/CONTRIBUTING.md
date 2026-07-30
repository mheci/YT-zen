# Contributing

## Requirements

- Node.js 18 or newer;
- a userscript manager for browser validation;
- a test video with known SponsorBlock segments for integration checks.

## Workflow

Create a focused branch from `main`. Keep commits atomic and reversible. Separate behavior changes, resource changes, documentation, and release work when they can be reviewed independently.

Before opening a pull request:

```bash
npm test
node scripts/test-sponsorblock.js JQb9eGeclQw
```

Do not commit credentials, browser profiles, generated dependency directories, or local release archives.

## Browser code rules

- treat YouTube DOM nodes as replaceable;
- use the shared lifecycle context for cleanup;
- validate all external response data;
- keep network work abortable;
- do not put API calls in high-frequency playback events;
- do not use an unscoped whole-document observer for a local feature;
- escape or property-assign user and server strings;
- preserve existing settings during migrations;
- make errors recoverable without a page reload.

## SponsorBlock changes

Read `docs/SPONSORBLOCK_API_CONTRACT.md` before changing the integration. Do not invent endpoint forms. Run the live harness after transport changes and add deterministic tests for normalization, retry, cancellation, cache behavior, and lifecycle transitions.

## Pull requests

Describe the user-visible change, the lifecycle impact, the compatibility risks, and the commands run. Include a manual browser matrix when changing playback, navigation, or DOM behavior.
