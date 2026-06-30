# Playbook: QA And Release Review

Use this before shipping app code or risky data/scoring changes.

## Steps

1. Identify changed user flows and data paths.
2. Check bilingual copy and RTL behavior for user-facing changes.
3. Check scoring, locking, and provider failure behavior for prediction changes.
4. Run focused tests or scripts that match the change.
5. For app code releases, bump `config.js`, `service-worker.js`, and the `index.html` footer version together.
6. Confirm unrelated dirty work is not reverted or mixed into the release.
7. For live user-visible data/content fixes, verify the deployed production artifact with a cache-busting URL after push. For example: `https://friendlybet.live/public-data/world-cup-stories.json?cb=<timestamp>` or `https://friendlybet.live/public-data/pundit.json?cb=<timestamp>`.
8. If the production artifact has not updated yet, report "pushed but not live" and keep the incident open.
9. During a live scoring or knockout-opening incident, ship and verify the minimum user path first: results, scores, leaderboard snapshots, lock/open state, and production proof. Missing Stories, empty editorial news, or weak Pundit copy should warn and open a separate content release task, not block the critical fix.
10. After generated-data commits, distinguish local snapshot correctness from Vercel/CDN propagation. Fail immediately on DB-vs-snapshot mismatch; retry bounded cache-busted public proof before calling a deploy-staleness incident.
11. A successful release proof should include the current workflow path, not only the fix commit. If a workflow failed before the fix, rerun or wait for the corrected path where safe so the latest evidence is green.

## Output

Return:

- Release readiness: ready, blocked, or needs revision
- Tests run
- Risks remaining
- Version bump status
- Manual checks needed
- Production verification
