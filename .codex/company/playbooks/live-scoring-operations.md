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
- Snapshot export may freeze during live play to avoid excessive deploys. During active matches, public snapshot `TIMED`/live-status staleness is warning evidence only when a separate live DB/provider freshness check is green; verified final/manual-result paths must still set `FORCE_MATCH_SNAPSHOT=1` before generating Pundit, stories, or leaderboard context.
- After verified result/story refreshes, run the live-state watchdog. Finished matches with stale live/provider residue, matches still marked scheduled after kickoff, stale Pundit, missing stories, or unsafe leaderboard snapshots are release incidents.
- A stale scheduled row after trusted-source final consensus is an owned recovery incident, not just a QA note. The responsible agent must inspect provider/verifier/workflow state, use the safe Supabase-backed recovery path when available, monitor the run, and re-fetch production snapshots before closing. Do not modify DB rows directly from web reports unless using an approved manual-result workflow with source consensus and audit trail.

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
- Repeated story or Pundit copy with only teams/scores swapped is a live-content incident. It must fail review even when match data and story images are correct.
- During the group stage, the standalone Pundit workflow must run every 10 minutes on match days and build from a forced fresh match snapshot. To stay free-tier friendly, it should push `matches.json` only when `pundit.json` changed; match-only live clock/score churn without a Pundit change should be discarded.
- A finished match without a prepared publishable story asset is an incident during match windows. The workflow should report it loudly instead of leaving Eyal to discover a missing story manually.
- Unresolved result-recovery candidates are story-blocking context even before rows become `FINISHED`; audit reports must make that visible.

## Release Gates

- Run `node scripts/live-ops-audit.js` for a one-command local snapshot audit of result recovery candidates, completed groups, story coverage, Pundit freshness, and watchdog errors. The main scoring/sync CI workflow must run this real snapshot audit, not only its unit tests, and must trigger on `public-data/matches.json`, `public-data/pundit.json`, and `public-data/world-cup-stories.json` changes. In static public-snapshot CI, set `LIVE_OPS_IGNORE_SNAPSHOT_LIVE_STATUS=1` so active-match snapshot freeze is warning evidence instead of a false blocker; do not use that setting for live DB audits.
- Run `node scripts/live-completion-readiness.js` before release or during live incidents to verify result recovery, stories, Pundit freshness, scoring guards, workflow schedules, snapshot ordering, CI coverage, version alignment, and visual-fallback proof in one place. Add `LIVE_COMPLETION_PUBLIC_BASE_URL=https://friendlybet.live` when production public snapshots should be checked without Supabase secrets. Add `LIVE_COMPLETION_DB_SOURCE=supabase` and workflow liveness proof during match windows so public snapshot live-status warnings are backed by fresh live DB/provider truth. Treat `warnings` as explicit missing evidence, especially screenshot, production public snapshot, and live DB/provider proof.
- For content fixes that are already visible to users, run a direct cache-busted production public-data fetch after deploy and inspect the exact latest items that the dashboard will render. Local snapshot validation alone is not release evidence.
- For story/Pundit wording incidents, verify the exact banned phrase or required nuance against cache-busted production JSON after deploy. Substring counts can be misleading in Hebrew; use the same boundary-aware or structural check that the regression test uses.
- The scheduled `Live Completion Readiness Monitor` workflow must run during group-stage match days against production public snapshots and live Supabase match state. It is read-only except stale active-match DB recovery, may warn when a fresh visual proof is not attached to that run, and must fail if result recovery, stories, Pundit, watchdog, version, workflow, scoring guard, production snapshot, or live DB checks are red.
- Exception to read-only monitor behavior: if the live incident is stale active-match DB state, the monitor may run one direct `live-poller` recovery pass and then re-run readiness. This covers delayed or dropped GitHub cron ticks without waiting for Eyal to notice stale live scores.
- Run the deterministic result/scoring tests: `test-scoring`, `test-espn-live-sync`, `test-final-result-verifier-needed`, `test-final-result-verifier`, `test-live-poller`, and `test-banter`. `test-scoring` must cover partial group completion, pending-provider finals, single-phase group positions, two-phase advancers, third-place wait-until-all-12, penalties, multipliers, and late-knockout pools.
- Run `test-live-state-watchdog` when changing live-state, Pundit/story, snapshot, or workflow behavior.
- Run `test-live-ux-state` when changing dashboard, leaderboard, podium, projection, group-completion, or live-status behavior.
- Run `test-match-display-state` when changing match-card status labels, stale scheduled handling, CDN snapshot fallback, or provider-pending final display.
- For app-code releases, bump `config.js`, `service-worker.js`, and the `index.html` footer version together.
- Visually check dashboard and leaderboard for: live-no-official, first official group, several groups, and groups-complete states. Preferred command: `LIVE_UX_VISUAL_STRICT=1 node scripts/live-ux-visual-proof.js`. The run must produce mobile and desktop screenshots plus a `summary.json` with no hard overflow, no podium overlap, projection visible only before official scoring, and real podium visible only after scored official standings exist. If browser screenshots are unavailable, `test-live-ux-state` must execute the dashboard/leaderboard phase matrix and the release note must state the screenshot gap explicitly.
- The final-result verifier schedule must not leave multi-hour gaps during any group-stage match day; the preflight/backoff guard is the cost control.
- The live-poller schedule must not leave multi-hour gaps during group-stage match days; the DB preflight guard is the cost control.
- Offset scheduled workflow crons away from :00/:05 high-load edges where possible, and use the readiness monitor to fail if the live poller or final-result verifier has not actually run recently during the group-stage window.
- Any workflow that exports or regenerates match, leaderboard, Pundit, banter, or story snapshots must have `permissions: contents: write`; a run that updates Supabase but cannot push public snapshots leaves the dashboard/Pundit/story surface stale.
- During active match windows, the live DB must stop showing `TIMED`/`SCHEDULED` shortly after kickoff and live provider rows must have recent `source_updated_at`; otherwise treat it as an incident even if public snapshots and Pundit are fresh.
- Scheduled scoring/export and Pundit push failures must fail loudly during tournament windows, not exit green after a skipped refresh.
- Generated-snapshot push conflicts during match windows are production incidents. Abort/retry is not enough if the same generated files keep diverging; the owner must either rerun the full export on top of current `main`, dispatch the proper recovery workflow, or patch the workflow so it regenerates after rebase before pushing.
- Production workflows that commit generated snapshots should use `scripts/commit-generated-snapshots.sh` with explicit `REGENERATE_COMMANDS`. If a rebase or push conflict happens, the runner must reset to current `origin/main`, regenerate from Supabase/snapshots, recommit, and retry. Never keep retrying while the runner is still in an unresolved rebase state.
