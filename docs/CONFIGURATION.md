# Configuration

Settings are stored locally by the userscript manager and migrated forward by the YT-zen settings loader. Existing values are preserved unless a setting is explicitly changed or a deprecated key is migrated.

## SponsorBlock settings

- `sponsorblockOn` — master enable switch;
- `sbPrivacy` — use the privacy-preserving hash-prefix path;
- `sbToast` — show a notification when an automatic skip occurs;
- `sbSeekbar` — show colored timeline marks;
- `sb_<category>_en` — enable a category;
- `sb_<category>_act` — choose the category playback action.

All supported categories are enabled with the default automatic profile. The server lookup profile is intentionally not reduced when a category is disabled: this allows a user to change a category action without making cached data incomplete.

## Storage

SponsorBlock segment data is stored in a bounded runtime cache and an expiring persistent cache. User IDs, hidden-video IDs, metrics, and settings stay local. The SponsorBlock server receives the local user ID only for explicit votes, viewed reports, user information, and manual submissions.

## Safe reset

Use the dashboard's settings export before clearing a userscript manager's storage. Clearing settings resets feature preferences and the local SponsorBlock user ID; it does not affect the SponsorBlock service account or YouTube account.
