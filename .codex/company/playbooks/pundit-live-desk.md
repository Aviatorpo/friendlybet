# Playbook: Pundit Live Desk

Use this whenever FriendlyBet Pundit, World Cup stories, social moments, or news-like content feels stale, generic, wrong for the current match state, or disconnected from a specific pool.

## Standard

The Pundit must behave like a small live sports desk, not a template writer. During the World Cup, a content agent must know what is live, what just ended, what is next, what changed in the tables, and why a pool member should care.

## Source Of Truth

Check these before writing or approving current content:

- Match state: `public-data/matches.json`, Supabase-backed snapshots, and verifier/export workflow status when needed.
- Pundit feed: `public-data/pundit.json` `updatedAt`, `freshUntil`, item types, and item expiry.
- News desk: `public-data/pundit-news.json`, source URLs, `source_checked_at`, `topic_date`, `expires_at`, and validator output.
- Stories: `public-data/world-cup-stories.json`, latest match ids/results, `pool_focuses`, and story image availability.
- Production stories: when Eyal reports what the app shows, fetch `https://friendlybet.live/public-data/world-cup-stories.json?cb=<timestamp>` and inspect the latest visible stories before claiming the issue is fixed.
- Pool context: visible leaderboard, aggregate picks, pool lock state, late-entry state, and member names already visible in the pool.
- External research: use `../academy/domains/pundit-research-desk.md` and `../academy/practice-artifacts/pundit-research-run-template.md` for live web scanning, source ledgers, story scoring, and self-review.
- Continuous learning: use `pundit-continuous-learning-loop.md` so the Pundit records accepted stories, rejected stories, stale misses, handoffs, and reusable lessons.

## Cadence

Use this minimum cadence during match days:

- Morning desk: list today and tomorrow's matches in Israel time; identify likely pool/story angles before kickoff.
- Kickoff watch: after kickoff, remove preview language for that match; live text must say the match is live or stay silent.
- Scheduled-after-kickoff rows are not live facts. The deterministic Pundit must not infer "live now" from `TIMED`/`SCHEDULED`; inside the grace window it should stay silent, and after the grace window it should use verification/recovery wording until a trusted live or verified final state exists.
- Trusted-source consensus conflict: if multiple independent trusted sources agree on a final score while FriendlyBet still shows `TIMED`, live, blank score, or no `winner_code`, classify FriendlyBet state as stale/failed, not "unclear". Suppress local live/upcoming copy for that match, block result-driven publication from the stale row, and hand off the exact stale match id/teams/status plus verifier output to QA/Sports Integrations.
- Recovery ownership: the desk must not stop after naming the blocker. After a trusted-source/FriendlyBet mismatch, inspect workflow status, run or dispatch the existing verifier/manual-result/live-poller recovery path when it is the safe Supabase-backed route, monitor the run, re-fetch production public data, and only then report either recovery evidence or the exact external permission/credential blocker. A handoff is incomplete unless it includes the action already attempted and the next executable step.
- Post-match desk: within 30 minutes of final score, verify score/winner, table impact, pool-specific pick impact, and whether a story asset is publishable.
- Group-complete desk: when a group reaches 6 verified terminal fixtures, verify official scoring ran, identify pool members with group-position hits, refresh leaderboard banter, and hide or demote theoretical group tables.
- Story readiness failure: if a finished match has no prepared publishable story asset, treat it as a content incident and escalate through the story workflow instead of letting the feed quietly skip it. During scoring, group-completion, or knockout-opening incidents, this must not block verified results, points, leaderboard snapshots, or pick access.
- Content automation independence: Pundit freshness and Story publishing must each have an automatic scheduled path during live/post-final tournament windows. A broad asset audit backlog, stale optional news file, or one bad prepared story must not block Pundit refreshes or verified-result workflows. Block only the specific invalid publishable output, warn on broader content backlog, and keep retrying automatically.
- Story base cost discipline: production story-base preparation must be deterministic and local by default, not OpenAI/API-backed. When new known knockout fixtures appear, prepare both advancement outcomes ahead of time from local templates/assets so final-whistle publishing only selects and finalizes the correct outcome. Paid/manual AI image generation is editorial override work, not the automatic path.
- Evening desk: refresh `pundit-news.json` with 1-3 verified short-lived items or explicitly record that no publishable news passed the source gate.
- Staleness watch: if `pundit.json` is past `freshUntil`, treat it as an incident, not a quiet state.
- Client freshness: dashboard caching must honor `pundit.json` `freshUntil` and item-level `expires_at` as hard display boundaries. A browser may keep the card alive with pool-local or clearly non-live fallback copy, but it must not continue showing expired match/news claims just because the normal refetch interval has not elapsed.
- Watchdog: after result/story refreshes, `scripts/live-state-watchdog.js` must be able to prove the feed is fresh, stories exist for finished matches, finished rows are free of live residue, and leaderboard snapshots are safe.
- Live-window certification: for each target match window, run `node scripts\pundit-live-window-certifier.js --match HOME-AWAY` before calling the Pundit desk-ready. Passing means score 90+ with no stale fixture after kickoff, no missing live/final/result/story state, no expired item in `pundit.json`, and copy that names the table/prediction consequence. During calibration, also run with `--record tmp\pundit-live-window-certifications-YYYY-MM-DD.jsonl` so the pass/fail evidence is machine-readable. For production-facing claims, run the same gate against the live site with `node scripts\pundit-live-window-certifier.js --production --match HOME-AWAY --record tmp\pundit-live-window-certifications-YYYY-MM-DD.jsonl`; a local-only pass does not prove what users saw. Pre-kickoff passes are readiness evidence only. Any graduation or TV-level-readiness claim must run `--graduation-proof`, which intentionally fails when every target is still pre-kickoff. Summarize only real post-kickoff or post-final passing records back into the academy certification run.
- Academy audit: before claiming the Pundit/Stories agents are TV-level or production-ready, run `node scripts\pundit-academy-audit.js --require-tv-ready`. The audit combines fresh Pundit feed checks, emoji requirements, strict news validation, Story coverage, production live-window JSONL proof, and the social/content academy certification audit. A plain `node scripts\pundit-academy-audit.js` may report `calibrating-with-live-proof`; that is progress evidence, not permission to claim graduation.
- Before a standalone Pundit rebuild, run `LIVE_OPS_SKIP_PUNDIT=1 node scripts/live-ops-audit.js`; this allows stale Pundit to be refreshed but blocks generating fresh commentary from stale match/story data.

## Editorial Bar

Every current item must answer at least one of:

- What happened or is about to happen?
- Why does this matter for this group/table/pool?
- Which prediction type is affected?
- Which visible pool members get receipts or embarrassment?
- What is the one human story a friend would repeat in a group chat?

Reject copy that only swaps team names into a generic sentence, repeats the previous story shape, says a match is upcoming after kickoff, or shows old results as if they are fresh.

Voice rule: the Pundit may be sharp, but it should sound like a real TV analyst or group-chat sports friend, not a standup routine. Avoid invented metaphors, forced analogies, "clever" object jokes, and unnatural lines such as forms needing speeches, paper scoring points, neon-light drama, or points being stolen quietly. Prefer direct consequence: who won, what changed in the group/table, and whose prediction was helped or hurt.

Story finish rule: direct does not mean sterile. For Story of the World Cup headlines/captions, after the match/table/pool consequence is clear, add one fitting emoji at the end when it makes the card feel more shareable. Use the emoji as punctuation, not as the idea.

For stories and Pundit cards, repeated structure is measured after normalizing team names, scores, dates, and group letters. Five different matches with the same sentence skeleton is a failed desk, even if each fact is technically true.

## Research Desk Requirement

When the item depends on current external information, run a Pundit Research Desk pass before publishing:

1. Frame the desk question.
2. Check FriendlyBet match/feed/story/pool state.
3. Search multiple source types: official, trusted news, local/beat reporting, primary social, and rumor leads only for scouting.
4. Build a source ledger with claim, URL, source tier, time, confirmation, uncertainty, and usability.
5. Score candidates for freshness, verification, FriendlyBet relevance, drama, uniqueness, and clarity.
6. Publish only source-backed, short-lived items with an expiry.
7. Self-review for stale timing, overclaiming, privacy, gambling wording, and repeated copy shape.

Any published `public-data/pundit-news.json` item must carry that evidence in-machine: `source_ledger[]`, `story_score`, `self_review`, and `red_team_review`. `node scripts\pundit-news-validate.js` enforces the fields, including publishable minimums for verification, FriendlyBet relevance, Red Team score 90+, and zero Red Team blockers.

The deterministic Pundit generator is the fallback layer, not the full editorial product. A match-day Pundit that never checks external stories is undertrained.

## News Policy

The news file is optional only before tournament action starts. During match days, an empty `public-data/pundit-news.json` is a quality warning unless the agent can say what sources were checked and why no item passed.

News items must be short-lived, source-backed, and relevant to FriendlyBet. Prefer injuries, suspensions, lineup surprises, official disciplinary decisions, coach/player quotes, table consequences, and viral match moments that change how people feel about their picks.

Reject betting, odds, accumulator, sportsbook, bookmaker, parlay, wager, casino, or real-money promotional source pages for Pundit news, even if the factual detail appears plausible. FriendlyBet is social prediction, not real-money betting, and `node scripts/pundit-news-validate.js` must block those sources before `generate-pundit.js` runs.

News item routing must use real WC2026 team codes only. `team` and optional `teams[]` are not free text; a typo or invented code can attach a story to the wrong match and must fail validation. If `team` or `teams[]` is present, downstream certifiers must treat those fields as authoritative and must not rescue the item by scanning arbitrary URL/title text for another team code.

During live-desk calibration or a stale-content incident, use the stricter gate `node scripts\pundit-news-validate.js --require-unexpired` so already-expired editorial items are treated as a failure in the source file itself, not only filtered out later by `generate-pundit.js`.

## Incident Response

When content is stale:

1. Print `updatedAt`, `freshUntil`, current time, item count, and the latest 5 Pundit/story items.
2. Run local validation/generation where safe: `node scripts\pundit-news-validate.js`, `node scripts\generate-pundit.js`, `node scripts\test-world-cup-stories.js`.
3. Determine which layer failed: source data, generator, workflow commit/push, deploy/cache, empty editorial news, or weak copy templates.
4. If the failed layer is stale match state, check trusted sources and workflow health, then use the existing Supabase-backed recovery path (`final-result-verifier`, `live-poller`, or `manual-match-results`) instead of only documenting the mismatch.
5. If production can show stale user content, ship the smallest data or workflow fix first, then improve copy depth.
6. After push/deploy/recovery, re-fetch the live production URL with a cache-busting query string and print the latest visible items. Do not call the incident closed until the live artifact changed, or state the remaining deploy/cache blocker.
7. Record a reusable lesson in the relevant skill or playbook.

For editorial misses, also run the feedback loop:

- What source should have been checked?
- Which cadence checkpoint missed it?
- Was the failure data freshness, source verification, story judgment, copy quality, or handoff?
- What test, checklist, or training drill would catch it next time?
- Does the fix belong in code, `pundit-news.json`, a workflow, a playbook, or certification?

## Training Cases

A trained Pundit/content agent must practice these cases:

- A pre-match fixture crosses kickoff while the feed still says "today/tomorrow".
- A final score arrives with no prepared story asset.
- A group completes and official points start for only part of the group stage.
- A pool has visible members whose exact group-position or tournament-winner picks match the result.
- News exists but has only one non-official source.
- The latest 3 stories have the same caption structure.
- The local story feed is fixed but production still serves the old repeated story text.

## Output

Return:

- Current-state diagnosis
- Source files checked
- Source ledger and story score, when external/current claims are involved
- Freshness status
- Editorial/news status
- Pool-specific angle
- Files changed or exact next action
- Validation performed
