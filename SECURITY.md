# Security Policy

## Reporting

Do not publish credentials, private user IDs, browser data, or unpatched security reports in an issue. Report security problems privately to the repository maintainer through the contact method listed on the GitHub profile.

Include the affected version, browser/userscript manager, reproduction steps, expected behavior, and whether the issue affects data disclosure, script execution, or account actions.

## Scope

Security-sensitive areas include:

- userscript injection and DOM rendering;
- external URL and CSS sanitization;
- SponsorBlock local user ID handling;
- cross-origin request allowlists;
- settings import/export;
- cache and IndexedDB data handling;
- lifecycle cleanup and stale asynchronous results.

YT-zen does not automatically submit SponsorBlock content. Manual submission and voting are explicit user actions.
