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

## Output

Return:

- Release readiness: ready, blocked, or needs revision
- Tests run
- Risks remaining
- Version bump status
- Manual checks needed
- Production verification
