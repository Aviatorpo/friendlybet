# Playbook: Live Scoring Operations

Use this for World Cup match-result sync, group completion, scoring, dashboard, leaderboard, podium, Pundit, banter, stories, or any live tournament state.

## Source Of Truth

- Live display may use a fresh provider score, but official points require verified final results.
- Visible result is not scoreable proof. A match is scoreable only when the same event exists in Supabase `matches` as a terminal, non-pending row with correct `external_id`, `stage`, teams, score, and `winner_code`.
- `winner_code` is not an independent source of truth. It is the canonical output of result resolution: source observations, competition rules, score/penalty/advancement validation, and audit state. Scoring must trust the resolved result object, not a lone field.
- Result resolution should behave like a careful human match desk. Check FIFA first. If FIFA is late, incomplete, or missing penalty/advancement detail, check several reliable match centers. For knockouts, the minimum scoreable fact is the advancing team; penalty shootout numbers are valuable for display and content but must not block scoring when advancement is verified.
- Consensus policy for automatic scoring: official FIFA final/advancement can verify alone; otherwise require strong corroboration from approved independent reliable source families, normally all available sources agreeing or at least three independent families agreeing on score/status/advancing team. If fewer sources are available, require at least two approved independent source families plus no contradiction. Any material disagreement or insufficient evidence leaves the match in automatic review, keeps polling/escalating approved sources, and blocks scoring.
- FIFA `world-cup-schedule.json`, provider responses, Pundit, Stories, and match-card display are not scoring inputs unless their rows have been bridged into Supabase `matches`.
- Before every knockout match window, the scoring database must already contain every known fixture from the official FIFA schedule. Future-round placeholders should be carried as soon as FIFA exposes their match ids/times/stages, and updated when teams are known.
- When a finished match determines a next-round participant, the next-round fixture bridge is part of the same critical path: update/verify current result, score/publish, then verify the newly known next fixture exists in Supabase `matches`.
- ESPN-only final rows must stay audit-pending with `live_source='espn-final'` or pending `status_detail`; group and knockout scoring must ignore them.
- The final-result verifier clears pending residue only after the required sources agree.
- Do not publish stories or official scoring from an unverified provider-final row.
- Do not block knockout scoring merely because penalty shootout numbers are unavailable if the final status and advancing team are verified by the consensus policy. Store missing penalty details as incomplete display/content data and backfill later.

## Single-Point Failure Doctrine

- A live result/scoring plan must not depend on one runner, one source, one DB write attempt, one scorer path, one snapshot path, one cache layer, one alert channel, or one human action.
- The reliable shape is one durable Supabase-backed state machine, one replayable controller, multiple replaceable wake-up mechanisms, bounded source escalation, and one public-safe publication contract.
- GitHub Actions may wake the controller, publish static artifacts, and provide audit logs. GitHub is not the reliability layer, the only scheduler, or the only path from verified result to user-visible points.
- Backups must be disciplined. Do not create many runners that all poll every source every minute. Use DB preflight, source-observation caching, per-source cooldowns, and escalation only when the match window or result uncertainty requires it.
- Every critical layer needs both a recovery path and a user-safe display path. If the system cannot finish scoring or publication yet, the app must show last verified data with calm language such as "result being confirmed" or "points updating"; it must not show stale points as final.
- Plan A is automatic and fast. Plan B is automatic fallback through another wake-up path. Plan C is automatic source-family escalation plus replay from checkpoints. Plan D is automatic safe-wait mode: freeze unverified scoring, keep polling approved sources, show last verified data, and resume/replay when evidence or durable state returns.
- Supabase is the canonical product database. If Supabase writes are unavailable, do not invent a parallel truth. Preserve last verified public state, avoid "points updated" claims, and replay from checkpoints and canonical evidence when Supabase returns. True database failover is a separate cost/complexity decision.
- External runners should wake the controller with limited trigger authority where possible. Service-role authority and private resolver evidence must stay server-side and out of browser/public artifacts.
- If final-result candidates remain unresolved after verifier work, the workflow must raise an operational failure after any successful refresh steps finish. A green run with skipped final candidates is not acceptable.
- When the live poller sees an ESPN full-time row, it must immediately hand off to the verifier in the same workflow run. Do not wait only for the separate 15-minute verifier cron when a final whistle has already been detected.
- During all group-stage match days, the live poller should run every 5 minutes across the whole coverage window, not only narrow precomputed kickoff windows. Its smart preflight is the cost control: skip provider calls unless a match is active or just finished.
- The scheduled verifier should cover normal missed finals and older tournament residue with bounded backoff. A match that is days old but still non-terminal or carrying finished-match live residue remains a recovery candidate.
- Snapshot export may freeze during live play to avoid excessive deploys. During active matches, public snapshot `TIMED`/live-status staleness is warning evidence only when a separate live DB/provider freshness check is green; verified final/result-recovery paths must still set `FORCE_MATCH_SNAPSHOT=1` before generating Pundit, stories, or leaderboard context.
- After verified result/story refreshes, run the live-state watchdog. Finished matches with stale live/provider residue, matches still marked scheduled after kickoff, stale Pundit, missing stories, or unsafe leaderboard snapshots are release incidents.
- A stale scheduled row after trusted-source final consensus is an owned recovery incident, not just a QA note. The responsible agent must inspect provider/verifier/workflow state, use the safe Supabase-backed recovery path when available, monitor the run, and re-fetch production snapshots before closing. Do not modify DB rows directly from web reports, and do not ask Eyal to supply match truth.
- QA/staging result rehearsals must use a separate Supabase project, synthetic data only, staging-scoped secrets, explicit non-production project-ref guards, isolated generated artifacts or deploys, and must fail closed if any environment resolves to production.

## Critical Path Priority

- Doctrine: critical path first, content never blocks. The critical path is verified results, scoring, leaderboard/public snapshots, lock/open state, and match display. Optional content is Pundit, Stories, banter, share copy, social/video, and visual polish. Content may enrich the product only after the critical path is healthy.
- During group-stage completion, knockout opening, or any deadline where users need points or picks, the critical path is: verified results, scoring calculation, leaderboard/public snapshot publication, lock/open state, live production proof. Pundit, Stories, banter, social, and visual polish come after that path is restored.
- Missing story assets, empty editorial news, weak Pundit copy, or social/video gaps are incidents, but they must not block result verification, scoring publication, app hotfix CI, or knockout-entry access. Demote accepted content backlog to warnings in result/scoring workflows and open a separate content incident.
- Match, scoring, lock, and leaderboard code must render or complete from core match/pick/result data first. Optional content should load after core state, with timeout/fallback behavior, and should disappear quietly or create a separate content incident if unavailable.
- If users cannot see points or enter knockout picks more than 15 minutes after the required verified final state is available, stop long content loops and run the shortest safe recovery path: automated verifier/result-recovery workflow, score calculation, snapshot export, production re-fetch, and a status note with remaining non-critical issues.
- For knockout rounds, the shortest safe recovery path must begin with the schedule-to-scoring bridge: official FIFA schedule row -> Supabase `matches` row -> live poller/verifier candidate -> score calculation -> leaderboard snapshot -> production proof.
- Before opening knockout entry after group completion, verify the actual user-visible product mode, not just the official rule constants: single-phase bracket, two-phase reopened bracket, R32 seed display, R16 propagation, QF/SF/final propagation, saved-pick persistence, and live/cache-busted production version. The minimum local gate is `node scripts/test-fifa-bracket.js`, `node scripts/test-third-place-allocation.js`, and `node scripts/test-two-phase-knockout-wiring.js`.
- More than two repeated failure emails from the same workflow family in 30 minutes during a live transition is a control-plane incident. Assign one owner, summarize the current proven layer, and suppress or demote non-critical alert causes until the user path is restored.
- A live-transition recovery report must include workflow run ids, finished-match count, pool/user scoring count when available, snapshot verification result, production URL/public-data proof, and the exact remaining blocker.
- Public proof must be deployment-aware: after a workflow pushes generated scoring snapshots to `main`, give Vercel/CDN a bounded cache-busted propagation window before failing the run. A two-minute proof window is too brittle for generated data commits; use a roughly 10-minute window for live leaderboard proof, while local snapshot-vs-DB verification remains fail-fast before commit.
- Do not let stale live metadata create permanent final-result work. A terminal `FINISHED`/`AWARDED` row with numeric score is scoreable; stale `live_clock`, `live_period`, `status_detail`, or `live_source` should be cleaned or sanitized from public snapshots, not sent through official-result consensus forever. Missing score, non-terminal stale-live state, or tied knockout without `winner_code` remain verifier candidates.

## Fast Scoring Planning Checklist

Use this checklist before proposing or changing any post-final scoring plan:

- User promise: define the maximum time from verified final result to visible leaderboard.
- Verification boundary: distinguish live/provisional, FIFA-verified, approved multi-source consensus verified, verification pending, disputed, postponed/suspended, and abandoned/awarded official decision.
- Human-match-desk rule: name the sources checked, their observed status/score/advancing team, and why the resolver accepted or rejected the result. For knockouts, advancement is the scoring-critical fact; penalty score is display-critical but not scoring-critical.
- Source bridge: prove which source the user display reads and which source the scorer reads. If they differ, prove the bridge row exists before discussing scoring correctness.
- Fixture coverage: compare official schedule fixture ids against Supabase `matches` for the next match window and all known knockout fixtures. Missing known fixtures are blockers, not warnings.
- Source policy: name which sources can auto-score, how many agreeing sources are required, and what blocks auto-scoring.
- Scenario policy: precompute per-match scoring deltas when teams, picks, and rules are stable. Do not trust full future leaderboard totals across unresolved earlier matches; full totals are valid only when tied to the current baseline fingerprint or regenerated at selection time.
- Scoring scope: explain whether the path applies a prepared delta, recomputes affected pools/users, or runs the full scorer, and why.
- Write path: identify one-by-one writes, batch writes, RPCs, and unchanged heartbeat writes.
- Snapshot path: prove how DB scores and public leaderboard snapshots become visible without waiting on optional content.
- Fallback ladder: define Plan A/B/C/D for source verification, runner wake-up, leases/checkpoints, scoring, public publication, PWA cache, autonomous safe-wait/retry, and rollback. Each level must say what the user sees and what operator alert is raised. Normal recovery must not require Eyal or an operator to provide the match result.
- Publication guard: the app may say "points updated" only when canonical result, scoring run, public snapshot, and production-visible proof all match the same `result_version`.
- Safe staleness contract: every public match/leaderboard snapshot needs `result_version`, `published_at`, `source_state`, and `points_state`, so stale data cannot masquerade as fresh final points.
- Propagation guard: distinguish "local exported snapshot mismatches DB" from "production CDN has not deployed the just-pushed snapshot yet." The first blocks immediately; the second retries with bounded patience and only becomes an incident after the deployment window expires.
- Kill switches: operators must be able to disable one provider, one runner, live snapshot overlay, content jobs, or fast-delta scoring independently without taking down the whole matchday path.
- Cost guard: name preflight/backoff/rate-limit controls for provider calls and workflows.
- QA proof: require timing metrics, source-disagreement tests, score correctness tests, and cache-busted production proof.
- Rollback/recovery: define how the full scorer/audit path detects and repairs fast-path mistakes.
- Content isolation: prove Pundit, Stories, banter, share copy, and social work cannot block results, scoring, locks, leaderboards, or match display.

## Knockout Result Resolution

- Before kickoff: ensure the fixture exists in Supabase `matches`, prepare both possible advancement deltas, and record the baseline fingerprint if any full scenario snapshot is created.
- During the match: poll only inside the relevant live window with bounded backoff. If normal time ends level, keep monitoring through extra time and penalties.
- At apparent final: collect observations from FIFA first, then independent reliable match centers when FIFA is missing, stale, or incomplete. Normalize score, status, result method, penalty score when present, and advancing team.
- Automatic acceptance: accept FIFA final/advancement, or independent multi-source consensus on the advancing team and final status. Prefer exact score agreement, but do not block scoring if every trusted source agrees on who advanced and only penalty-shootout details are missing.
- Automatic rejection: reject or hold review when sources disagree on the advancing team, the teams do not match the fixture, winner is not one of the teams, a postponed/suspended/cancelled state appears, a decisive score contradicts the claimed winner, or the provider row is stale.
- Canonical write: write the resolved result object to Supabase, including `winner_code` as the derived advancing team, result method when known, penalty details when known, verification state/source, and audit evidence.
- Scoring trigger: after canonical write, apply the matching prepared delta against the current baseline or run the affected-pool scorer. Then export public snapshots and verify production public data.
- Backfill: after users have correct points, content jobs may backfill penalty score, story copy, Pundit nuance, and richer match-card details without blocking the points path.

## Failure Fallback Ladder

- Sources: FIFA complete result verifies first. If FIFA is late or incomplete, use approved independent source-family consensus. If automation cannot resolve the result, keep polling/escalating approved sources with bounded backoff. If uncertainty remains, hold scoring and show the result-confirmation state.
- Fixtures: official schedule fixtures should exist in Supabase before the match window. If missing, rerun the schedule bridge, then import automatically from the official schedule. If fixture identity is still ambiguous, show fixture-confirmation state and never score an orphan fixture.
- Runners: at least two automatic wake-up paths should call the same controller. If one runner misses or fails, another resumes from Supabase lease/checkpoint state. On-demand controller dispatch may repair the automation layer, but it must not be a separate result-truth input path.
- Leases/checkpoints: expired heartbeats allow another runner to resume. Old runners must be fenced from writing after lease expiry. Admin force-release is allowed only when heartbeat evidence is stale.
- Scoring: apply prepared deltas only when the baseline fingerprint still matches. Otherwise recompute affected pools; if uncertain, run full recompute. Per-pool scoring state prevents global success claims when one pool is still stale.
- Public publication: primary live publication is a sanitized Supabase public snapshot/RPC. Static JSON is cache/backup/history. If both are stale or unavailable, show last verified leaderboard with points-updating language.
- Cache: live/final windows should use network-first or cache-busted reads for public live data. Static fallback must carry freshness/points state and must not be labeled current when stale.
- No Eyal-in-loop result input: ordinary match truth must come from FIFA or approved automated source-family consensus. Break-glass operator work may repair runners, source configuration, secrets, leases, or deployments, but must not become a normal path for entering winners or editing DB rows directly.
- Rollback: a correction creates a new `result_version`, supersedes the old version, recomputes affected/full scores, republishes snapshots, updates next fixtures, and shows "official correction applied" where appropriate.
- Total canonical DB outage: keep last verified public state, hide fresh/final claims, mark updates as temporarily delayed, and replay/reconcile when writes return. Delayed points are acceptable in this state; wrong points are not.

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

## Tournament State Matrix

For any feature or incident touching predictions, scoring, leaderboards, brackets, matches, dashboard, or navigation, define the state matrix before implementation:

- Tournament phase: pre-tournament, group live with no completed groups, partial group completion, all groups complete/knockout opening, R32 active/complete, R16 active/complete, QF active/complete, SF active/complete, final complete.
- Pool mode: single-phase, two-phase, late-knockout, admin/test, and any pool with locked or reopened entry.
- User state: new user, returning user, submitted all required picks, partial picks, no picks, blocked by lock, eligible to pick next phase, scored but not yet published, public snapshot stale.
- Screen obligation: dashboard, predictions, bracket, leaderboard, matches, share/OG, Pundit, and admin surfaces must each show the correct state or intentionally hide/degrade.
- QA obligation: every state that can materially change what a user may see, pick, edit, score, or share needs either an automated fixture or named live verification proof. QA may inspect behavior, but production result truth must not depend on QA or Eyal supplying match outcomes.

State-blind work is not release-ready. If a feature only proves one phase, the release note must say which adjacent phases are unverified and why that is safe.

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

- Run the schedule bridge audit before and during knockout windows. The gate must compare production `world-cup-schedule.json` against live Supabase `matches`, fail on any known fixture missing inside the next 36 hours, and report unresolved placeholders separately.
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
