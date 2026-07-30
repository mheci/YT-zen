# SponsorBlock API Contract

This document records the API contract used by YT-zen. It is based on the SponsorBlock API documentation and the public SponsorBlockServer route implementation. The client must not infer alternate endpoint semantics from a successful HTTP response alone.

## Read operations

### `GET /api/skipSegments`

Required query parameter:

- `videoID`: the YouTube video identifier.

Supported filters:

- `categories=[...]` or repeated `category` parameters;
- `actionTypes=[...]` or repeated `actionType` parameters;
- `requiredSegments=[...]` or repeated `requiredSegment` parameters;
- `service=YouTube`;
- `trimUUIDs` only when the client can resolve shortened UUIDs before write operations.

The API returns a direct array of segment records. A successful lookup can still be an empty result, although the official server normally uses `404` when no segments are available. `400` means the request shape is invalid and `500` means the server failed.

### `GET /api/skipSegments/:sha256HashPrefix`

The path is a 4-to-32 character lowercase SHA-256 prefix of the video ID. Four characters are the recommended privacy profile. The response is a candidate array:

```json
[
  {
    "videoID": "abcdefghijk",
    "segments": [
      {
        "segment": [112.955, 133.505],
        "UUID": "full-or-trimmed-uuid",
        "category": "sponsor",
        "actionType": "skip",
        "locked": 0,
        "votes": 14,
        "videoDuration": 698.861,
        "description": ""
      }
    ]
  }
]
```

The client must filter the candidate array by exact `videoID`. A `200` response without the requested video is a valid privacy miss, not evidence that the requested video has no segments until all compatible privacy encodings have been attempted. `404` means the prefix produced no returned videos.

The deprecated-looking query form `GET /api/skipSegments?prefix=...` is not used by YT-zen. Current public servers reject it when no `videoID` is supplied, while the path form is canonical.

## Write operations

### `POST /api/skipSegments`

This is a user-submission endpoint and must never be called automatically. YT-zen calls it only after an explicit action in the segment editor. The JSON body contains:

- `videoID`;
- local, randomly generated 30-character `userID`;
- `userAgent`;
- `service`;
- optional `videoDuration`;
- `segments`, each containing `segment`, `category`, `actionType`, and a description only for chapter submissions.

The server validates category/action compatibility, time ranges, duplicate submissions, duration mismatches, reputation, and rate limits. The client validates basic input before sending but treats the server as authoritative. A successful response contains the submitted segment records and assigned UUIDs.

### `POST /api/voteOnSponsorTime`

Query parameters:

- `UUID`;
- `videoID` when the UUID may be shortened;
- local `userID`;
- either `type=0` (upvote), `type=1` (downvote), `type=20` (undo), or `category` for a category vote.

The local user ID is private and must not be replaced by the public hashed user ID. Vote requests are user-triggered and failures must not affect playback.

### `POST /api/viewedVideoSponsorTime`

Query parameters:

- `UUID`;
- `videoID` when available.

The server increments the view count. A shortened UUID is resolved safely when the video ID is included. This is best-effort telemetry and must never block or delay a skip.

### `GET /api/userInfo`

The default query is `userID=<local-id>`. Supported `value`/`values` properties include `userID`, `userName`, `minutesSaved`, `segmentCount`, `ignoredSegmentCount`, `viewCount`, `ignoredViewCount`, `warnings`, `warningReason`, `reputation`, `vip`, and `lastSegmentID`. YT-zen caches this response briefly and never uses it as a playback dependency.

## Categories and action types

The current YouTube service exposes these categories:

`sponsor`, `selfpromo`, `exclusive_access`, `interaction`, `intro`, `outro`, `preview`, `hook`, `music_offtopic`, `filler`, `poi_highlight`, `chapter`.

The action types are:

`skip`, `mute`, `full`, `poi`, `chapter`.

YT-zen requests the complete category and action-type profile on every lookup. User preferences are applied after validation, so a category can be disabled without losing data needed by a later preference change.

## Client invariants

1. Every valid 11-character YouTube ID is looked up after navigation, player readiness, autoplay transitions, and tab wake-up.
2. A new lookup never allows an older request to mutate the active video state.
3. `404` is an empty result, not a malformed response.
4. A `200` response with an invalid JSON shape is a retryable API error.
5. Privacy responses are candidate lists and require exact ID matching.
6. Manual writes include the video ID whenever the endpoint supports it.
7. API errors are isolated from playback and recover through later revalidation.
