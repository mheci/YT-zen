# Releases

## Stable release procedure

1. Create a focused release branch or confirm the release commit on `main`.
2. Run the deterministic gate:

   ```bash
   npm test
   ```

3. Run the live SponsorBlock harness:

   ```bash
   node scripts/test-sponsorblock.js JQb9eGeclQw
   ```

4. Confirm the working tree is clean and versions match:

   ```bash
   git status --short
   node scripts/check-release.js
   ```

5. Create an annotated semantic-version tag:

   ```bash
   git tag -a vX.Y.Z -m "YT-zen X.Y.Z stable release"
   git push origin main --follow-tags
   ```

6. Create the GitHub release from the tag and attach `yt-zen.user.js` and `yt-zen.meta.js`.
7. Record behavior changes, migration notes, test commands, and known limitations in the release description.

A stable release must not be cut from a dirty tree or from a bundle that was not rebuilt from the source mirrors. A failed live API test is a release blocker for SponsorBlock transport changes; an unavailable external service should be recorded separately when the deterministic gate passes.

## Versioning

Use semantic versions. Increment the patch version for compatible fixes, the minor version for new compatible functionality, and the major version for breaking settings or distribution changes. Keep the package version, userscript header, metadata file, and release tag aligned.
