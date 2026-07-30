# SponsorBlock Performance

The integration is optimized around correctness first, then bounded work.

## Network

A lookup is performed for every valid video transition. Cached data can render before the network completes, and one in-flight promise is shared by concurrent callers for the same video/profile. Direct and privacy paths are attempted only when the preceding documented form cannot complete. Exponential retry is limited to transient failures and always observes the active abort signal.

The cache does not make a fresh lookup optional. It provides a fast first render while the background request verifies current server data.

## CPU and DOM

Playback actions are event driven. No interval is used to inspect playback when the player is paused, ended, hidden, or has no active segment. Timeline repair uses one observer scoped to the player and a shared ticker rather than a feature-specific timer per component.

Every observer, listener, timer, ticker, and request has an owner. Feature reapplication and page teardown release the owner before another instance is created.

## Memory

- in-memory SponsorBlock entries are bounded;
- persistent cache entries have explicit expiry and schema validation;
- segment lists are normalized once per response;
- duplicate UUID/range records are dropped;
- stale in-flight cleanup is identity checked;
- `ZenResources` tracks blob URLs and deferred tasks;
- weak DOM caches do not retain elements when weak references are supported.

## Measurement

The runtime diagnostics exposed by `SponsorBlockEngine.stats()` record API requests, fallbacks, cache hits/misses, stale data, deduplicated lookups, errors, votes, submissions, and viewed reports. `ZenResources.stats()` reports observer, ticker, deferred, abort, and blob ownership.

No performance number is treated as a release guarantee without a repeatable benchmark. Use the deterministic unit suite for regression detection and the live SponsorBlock harness for transport validation.
