# Usage

Open YT-zen settings from the userscript manager menu or the YT-zen dashboard shortcut.

## SponsorBlock

SponsorBlock is enabled by default. Each category has an enable switch and an action. The default profile requests and processes every supported category. Disable only the categories you do not want to act on.

Available general actions are:

- Skip — seek to the segment end;
- Mute — mute during the segment and restore the user's prior audio state;
- Label only — show the segment without automatic playback action;
- Off — ignore the category for playback and marks.

Point, chapter, and full-video categories expose only actions that have meaning for their API semantics in addition to the retained default profile.

Privacy mode uses a hash prefix instead of sending the full video ID during lookups. It may return a candidate list and is filtered locally.

The timeline toggle controls colored marks. Notifications are independent of automatic skipping. The local hide action suppresses SponsorBlock playback/UI actions for one video but does not prevent a lookup; unhide triggers a new lookup.

## Manual submissions and votes

Segment creation is always user initiated. Set the start and end times, choose a category, optionally add a chapter description, preview if needed, and press Submit. The server remains authoritative.

Votes and undo actions are available in the skip notification when enabled. They are best-effort network operations and do not alter playback if they fail.

## Other features

The dashboard groups optional features by playback, layout, discovery, session, filtering, and diagnostics. Each feature can be enabled independently. Features that operate on a page are reapplied on SPA navigation and release their previous DOM resources first.
