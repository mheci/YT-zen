# SponsorBlock Design Decisions

This document replaces the historical implementation comparison with the decisions that define the maintained system.

| Concern | Maintained behavior | Reason |
| --- | --- | --- |
| Lookup transport | Direct query or canonical hash-prefix path | Matches the documented API and preserves the privacy option |
| Categories | Complete supported category list on every lookup | Settings changes remain client-side and do not lose data |
| Action types | `skip`, `mute`, `poi`, `chapter`, and `full` | Ensures non-sponsor segment types are retrievable |
| Empty results | Cacheable empty result after a valid 404/empty response | Avoids retry storms for videos without submissions |
| Privacy response | Exact video-ID match inside candidate array | A hash prefix returns more than one possible video |
| Cache | Bounded LRU plus persistent stale fallback | Limits memory while preserving useful offline behavior |
| Navigation | Generation-checked state plus abort controllers | Prevents old videos from mutating the current player |
| Playback listeners | Capture-phase document listeners | Survives dynamic player replacement |
| UI repair | Player-scoped observer and shared ticker | Avoids a permanent whole-document polling loop |
| Manual writes | Explicit user actions only | SponsorBlock prohibits automated submissions |
| Configuration | Per-category action and a small number of playback controls | Keeps the settings surface understandable |

The source of truth for endpoint behavior is `docs/SPONSORBLOCK_API_CONTRACT.md`. This file describes current design intent rather than historical performance claims.
