# Playbook: Live Scoring Operations

Use this for World Cup match-result sync, group completion, scoring, dashboard, leaderboard, podium, Pundit, banter, stories, or any live tournament state.

## Source Of Truth

- Live display may use a fresh provider score, but official points require verified final results.
- ESPN-only final rows must stay audit-pending with `live_source='espn-final'` or pending `status_detail`; group and knockout scoring must ignore them.
- The final-result verifier clears pending residue only after the required sources agree.
- Do not publish stories or official scoring from an unverified provider-final row.
- If final-result candidates remain unresolved after verifier work, the workflow must raise an operational failure after any successful refresh steps finish. A green run with skipped final candidates is not acceptable.
- When the live poller sees an ESPN full-time row, it must immediately hand off to the verifier in the same workflow run. Do not wait only for the separate 15-minute verifier cron when a final whistle has already been detected.
- During all group-stage match days, the live poller should run every 5 minutes across the whole coverage window, not only narrow precomputed kickoff windows. Its smart preflight is the cost control: skip provider calls unless a match is active or just finished.
- The scheduled verifier should cover normal missed finals and older tournament residue with bounded backoff. A match that is days old but still non-terminal or carrying finished-match live residue remains a recovery candidate.
- Snapshot export may freeze during live play to avoid excessive deploys, but verified final/manual-result paths must set `FORCE_MATCH_SNAPSHOT=1` before generating Pundit, stories, or leaderboard context.
- After verified result/story refreshes, run the live-state watchdog. Finished matches with stale live/provider residue, matches still marked scheduled after kickoff, stale Pundit, missing stories, or unsafe leaderboard snapshots are release incidents.

## Group Completion

- A four-team group is complete only when it has exactly 6 unique scoreable terminal fixtures.
- Scoreable terminal means `FINISHED` or `AWARDED` and not provider-pending.
- Live scores, halftime, stale `TIMED`, duplicate logical fixtures with different row IDs, duplicate rows, and 7 unique rows must not settle a group.
- Single-phase exact-position group points can score per completed group.
- Third-place advancement bonuses wait until all 12 groups are complete.
- Two-phase top-two advancement can score per completed group; third-place advancement joins only after all 12 groups complete.

## User Experience States

- Pre-tournament: no live status, no projection, no match-result stories.
- Live, no completed group: say the tournament is live and official points are waiting for completed groups.
- Stale scheduled rows: if kickoff passed and a row is still `TIMED`/`SCHEDULED` past the grace window, the UI must show a verification/recovery state, not a normal upcoming or confident live state.
- First completed group: show official rank/points plus group-progress context, even if every user still has 0 points.
- Several completed groups: keep official podium primary and keep group-progress context visible.
- All groups complete: hide the theoretical group table; move focus to official standings and knockout readiness. Do not show pre-tournament empty copy when complete groups exist but visible points are still 0.

## Pundit And Banter

- Pool Pundit must be specific to real pool consequences: leader change, group-position hits, completed group receipts, fresh leaderboard movement, or verified match/story impact.
- Reject generic copy that does not name a group, match, member, score effect, or pool consequence.
- After kickoff, hide join/share/recent-join/recent-submit pool buzz unless late entry is explicitly open; recovery or lock-grace windows are not an invitation state.
- Stale `pundit.json`, empty match-day news, and old stories are quality warnings.
- A finished match without a prepared publishable story asset is an incident during match windows. The workflow should report it loudly instead of leaving Eyal to discover a missing story manually.
- Unresolved result-recovery candidates are story-blocking context even before rows become `FINISHED`; audit reports must make that visible.

## Release Gates

- Run `node scripts/live-ops-audit.js` for a one-command local snapshot audit of result recovery candidates, completed groups, story coverage, Pundit freshness, and watchdog errors. The main scoring/sync CI workflow must run this real snapshot audit, not only its unit tests, and must trigger on `public-data/matches.json`, `public-data/pundit.json`, and `public-data/world-cup-stories.json` changes.
- Run `node scripts/live-completion-readiness.js` before release or during live incidents to verify result recovery, stories, Pundit freshness, scoring guards, workflow schedules, snapshot ordering, CI coverage, version alignment, and visual-fallback proof in one place. Add `LIVE_COMPLETION_PUBLIC_BASE_URL=https://friendlybet.live` when production public snapshots should be checked without Supabase secrets. Treat its `warnings` as explicit missing evidence, especially screenshot, production public snapshot, and live DB/provider proof.
- Run the deterministic result/scoring tests: `test-scoring`, `test-espn-live-sync`, `test-final-result-verifier-needed`, `test-final-result-verifier`, `test-live-poller`, and `test-banter`. `test-scoring` must cover partial group completion, pending-provider finals, single-phase group positions, two-phase advancers, third-place wait-until-all-12, penalties, multipliers, and late-knockout pools.
- Run `test-live-state-watchdog` when changing live-state, Pundit/story, snapshot, or workflow behavior.
- Run `test-live-ux-state` when changing dashboard, leaderboard, podium, projection, group-completion, or live-status behavior.
- Run `test-match-display-state` when changing match-card status labels, stale scheduled handling, CDN snapshot fallback, or provider-pending final display.
- For app-code releases, bump `config.js`, `service-worker.js`, and the `index.html` footer version together.
- Visually check dashboard and leaderboard for: live-no-official, first official group, several groups, and groups-complete states. If browser screenshots are unavailable, `test-live-ux-state` must execute the dashboard/leaderboard phase matrix and the release note must state the screenshot gap explicitly.
- The final-result verifier schedule must not leave multi-hour gaps during any group-stage match day; the preflight/backoff guard is the cost control.
- The live-poller schedule must not leave multi-hour gaps during group-stage match days; the DB preflight guard is the cost control.
- Scheduled scoring/export and Pundit push failures must fail loudly during tournament windows, not exit green after a skipped refresh.
