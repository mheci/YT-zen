# SponsorBlock Technical Guide

## Data flow

1. The YouTube identity adapter extracts an 11-character video ID.
2. The lifecycle coordinator invalidates the previous active generation and records the new ID.
3. Hidden-video state is read without suppressing the API lookup.
4. Memory and persistent cache are checked.
5. Cached data is applied when available and the server is revalidated.
6. The API response is shape-checked, normalized, sorted, and de-duplicated.
7. Only the current generation can update playback state and marks.
8. Playback events apply the selected category action.

## Segment record

The normalized record is:

```ts
{
  category: string,
  actionType: "skip" | "mute" | "poi" | "chapter" | "full",
  segment: [number, number],
  UUID: string,
  locked: number,
  votes: number,
  views: number,
  videoDuration: number,
  description: string,
  userID: string,
  hidden: number,
  shadowHidden: number
}
```

Start and end times must be finite, non-negative, within the safety bound, and ordered. Point segments `[0, 0]` are retained for the API's point/full semantics and receive a small playback epsilon only when a skip action requires a target time.

## Error policy

- `AbortError`: stop without logging a user-facing API failure.
- `404`: valid empty response.
- `400`: do not retry the same invalid request form; try only a documented alternate encoding when available.
- malformed successful JSON: retry with backoff and retain stale data if present.
- network timeout: abort the request and allow a later navigation or wake event to retry.
- write failure: return a failed result to the UI; never interrupt playback.

## Privacy

Privacy mode sends only a SHA-256 prefix in the URL path. The response can contain many candidate videos. The client must compare `videoID` exactly before accepting any segment. There is no privacy fallback that sends the full video ID.

## Manual segment creation

The editor validates times locally and sends a documented `POST /api/skipSegments` request only after the user presses Submit. The current video duration is included when available. A successful submission invalidates the current cache and requests a fresh server result so server-assigned UUIDs and moderation state replace the local preview.
