# Pundit Live-Window Certifier Run 6 - 2026-06-23

## Status

Calibrating, not graduated.

This run converted the next graduation requirement into an executable gate. The Pundit can no longer claim a live window passed only because the feed "looked fine"; a target match now needs a score from `scripts/pundit-live-window-certifier.js`.

## Why This Matters

Eyal's standard is not static copy quality. The Pundit has to know what phase a match is in:

- before kickoff: preview copy must expire at kickoff,
- during kickoff/live ambiguity: no stale preview should survive,
- stale scheduled state: use verification/recovery wording,
- after final: publish result commentary and story coverage from a consistent match snapshot.

Those are exactly the mistakes that make an agent feel like it is not living the World Cup.

## New Gate

Added:

- `scripts/pundit-live-window-certifier.js`
- `scripts/test-pundit-live-window-certifier.js`

The certifier checks:

- `pundit.json` freshness and expired items,
- target match phase from `public-data/matches.json`,
- no fixture item after kickoff,
- live item for live state,
- verification item for stale scheduled state,
- result item for final state,
- World Cup story coverage for final state,
- English/Hebrew copy includes table/prediction consequence,
- no banned generic stock phrasing,
- source-backed news/editorial support for pre-kickoff targets when available.

Passing bar:

- score 90+,
- no errors.

## Current Target Checks

At `2026-06-23T11:15Z` / `14:15 Israel`:

- `node scripts\pundit-live-window-certifier.js --match POR-UZB`
  - score: `100`
  - phase: `pre`
  - item: `fixture`
  - passed: `true`
- `node scripts\pundit-live-window-certifier.js --match ENG-GHA`
  - score: `100`
  - phase: `pre`
  - item: `fixture`
  - passed: `true`

At `2026-06-23T11:24Z` / `14:24 Israel`, the same two checks were rerun with evidence recording:

- `node scripts\pundit-live-window-certifier.js --match POR-UZB --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
  - score: `100`
  - phase: `pre`
  - passed: `true`
- `node scripts\pundit-live-window-certifier.js --match ENG-GHA --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
  - score: `100`
  - phase: `pre`
  - passed: `true`

This is pre-kickoff evidence only. It does not prove post-kickoff or post-final performance.

At `2026-06-23T12:29Z` / `15:29 Israel`, the thread heartbeat reran the live desk gates while both target matches were still pre-kickoff:

- `node scripts\live-ops-audit.js`
  - ok: `true`
  - Pundit: `11` items, `updatedAt=2026-06-23T11:10:00.240Z`, `freshUntil=2026-06-23T17:10:00.240Z`
  - Stories: `44` stories for `44` finished matches, missing: `0`
- `node scripts\pundit-news-validate.js --require-unexpired`
  - passed
- `node scripts\test-pundit-feed.js`
  - passed, `11` item(s)
- `node scripts\test-world-cup-stories.js`
  - passed, `44` stories
- `node scripts\test-pundit-news-validate.js`
  - passed
- `node scripts\test-pundit-live-window-certifier.js`
  - passed
- `node scripts\pundit-live-window-certifier.js --match POR-UZB --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
  - score: `100`
  - phase: `pre`
  - item: `fixture`
  - passed: `true`
- `node scripts\pundit-live-window-certifier.js --match ENG-GHA --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
  - score: `100`
  - phase: `pre`
  - item: `fixture`
  - passed: `true`

Upcoming-window check at the same time:

- `POR-UZB`: kickoff in about `4.5` hours; active pre-kickoff window.
- `ENG-GHA`: kickoff in about `7.5` hours; active pre-kickoff window.
- `PAN-CRO`: kickoff in about `10.5` hours; not yet in the active 8-hour certifier window.
- `COL-COD`: kickoff in about `13.5` hours; not yet in the active 8-hour certifier window.

This remains pre-kickoff proof only. It confirms freshness, source gating, Stories coverage for already finished matches, and target preview expiry discipline, but it is not graduation evidence.

Production check at about `2026-06-23T12:31Z`:

- `https://friendlybet.live/public-data/pundit.json`
  - `8` items, `updatedAt=2026-06-23T12:13:03.204Z`, `freshUntil=2026-06-23T18:13:03.204Z`
  - production is fresh and preview items expire at kickoff,
  - production does not yet include the three local source-led match-day news items.
- `https://friendlybet.live/public-data/world-cup-stories.json`
  - `44` story items, latest result stories present.
- `https://friendlybet.live/public-data/pundit-news.json`
  - `0` items.

This is not a stale-state failure, but it is a live editorial gap: the repo/local calibration has source-led `POR-UZB`, `ENG-GHA`, and `PAN-CRO` news, while production currently shows only deterministic result/fixture copy. The next operational action is to ensure the source-led `public-data/pundit-news.json` and regenerated `public-data/pundit.json` reach production before the active match windows.

Deploy-prep resolution at about `2026-06-23T13:20Z`:

- The source-led `public-data/pundit-news.json` was carried onto current `origin/main` in a clean deploy worktree.
- `public-data/pundit.json` was regenerated from the current remote match snapshot, producing `12` items with `updatedAt=2026-06-23T13:19:14.862Z` and `freshUntil=2026-06-23T19:19:14.862Z`.
- The generated feed includes the three source-led items:
  - `2026-06-23-portugal-uzbekistan-pressure`, `teams=["POR","UZB"]`, `3` sources, expires at kickoff.
  - `2026-06-23-england-ghana-defensive-warning`, `teams=["ENG","GHA"]`, `2` sources, expires at kickoff.
  - `2026-06-23-croatia-panama-survival`, `teams=["CRO","PAN"]`, `2` sources, expires at kickoff.
- The deploy-prep run also caught and fixed a quieter fixture-copy weakness for neutral matches: English fixture variants must explicitly name table, prediction, pool, or pick stakes, not only "move places".
- Deploy-prep validation passed:
  - `node scripts\pundit-news-validate.js --require-unexpired`
  - `node scripts\test-pundit-feed.js`
  - `node scripts\test-pundit-news-validate.js`
  - `node scripts\test-pundit-live-window-certifier.js`
  - `node scripts\test-world-cup-stories.js`
  - `node scripts\pundit-live-window-certifier.js --match POR-UZB --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
  - `node scripts\pundit-live-window-certifier.js --match ENG-GHA --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`

This still does not count as graduation proof because both target checks remain pre-kickoff.

Continuation check at `2026-06-23T13:27Z` / `16:27 Israel`:

- Current target windows:
  - `POR-UZB`: kickoff in about `3.5` hours, still pre-kickoff.
  - `ENG-GHA`: kickoff in about `6.5` hours, still pre-kickoff.
  - `PAN-CRO`: kickoff in about `9.5` hours, not yet in the active 8-hour certifier window.
  - `COL-COD`: kickoff in about `12.5` hours, not yet in the active 8-hour certifier window.
- Clean deploy-worktree validation passed:
  - `node scripts\pundit-live-window-certifier.js --match POR-UZB --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
    - score: `100`
    - phase: `pre`
    - passed: `true`
  - `node scripts\pundit-live-window-certifier.js --match ENG-GHA --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
    - score: `100`
    - phase: `pre`
    - passed: `true`
  - `node scripts\pundit-news-validate.js --require-unexpired`
  - `node scripts\test-pundit-feed.js`
  - `node scripts\test-pundit-news-validate.js`
  - `node scripts\test-pundit-live-window-certifier.js`
  - `node scripts\test-world-cup-stories.js`
- Main-worktree live ops audit passed:
  - `node scripts\live-ops-audit.js`
  - `ok=true`
  - Pundit: `12` items, fresh.
  - Stories: `44` stories for `44` finished matches, missing: `0`.
- Production verification passed:
  - `https://friendlybet.live/public-data/pundit.json` has `12` items and `3` source-led news items.
  - `https://friendlybet.live/public-data/pundit-news.json` has the `POR-UZB`, `ENG-GHA`, and `PAN-CRO` source-led items.
  - `https://friendlybet.live/public-data/world-cup-stories.json` has `44` story items.

This remains pre-kickoff certification only. It proves freshness, source routing, expiry discipline, production propagation, and Stories coverage for already finished matches; it does not prove live/post-final readiness.

## Durable Wiring

- `.github/workflows/test-scoring.yml`
  - now watches the certifier and its test,
  - runs `node scripts/test-pundit-live-window-certifier.js`.

- `scripts\pundit-live-window-certifier.js --record <repo-local-path>`
  - appends JSONL evidence for each certification run,
  - blocks paths outside the repository,
  - should use `tmp\...` during automated calibration because Node cannot write into `.codex` in this sandbox.
  - now supports `--base-url <url>` and `--production` so certification can fetch `public-data/matches.json`, `public-data/pundit.json`, `public-data/world-cup-stories.json`, and `public-data/pundit-news.json` from the live site with cache busting.
  - now requires pre-kickoff source-backed news/editorial items for the target match to expire no later than kickoff.
  - now matches news items to team codes with exact/team-list/word-boundary logic, so `POR` is not falsely detected inside words such as `SPORTS`.
  - now treats explicit `team` / `teams[]` fields as authoritative; arbitrary source URL/title text is only a legacy fallback when no routing field exists.

- `scripts\pundit-news-validate.js`
  - now blocks betting, odds, accumulator, sportsbook, bookmaker, parlay, wager, casino, and similar real-money promotional sources,
  - now supports `--require-unexpired` for live-desk calibration and stale-content incidents,
  - now validates `team` and `teams[]` against the actual WC2026 team-code set instead of accepting any three letters,
  - exports `validatePayload()` for focused tests.

- `scripts\test-pundit-news-validate.js`
  - proves trusted editorial/professional sources pass,
  - proves betting/odds/promotional source pages fail,
  - proves official FIFA/source-of-record items can still pass with one source.

- `.github\workflows\test-scoring.yml`
  - now watches `public-data/pundit-news.json`,
  - runs the current-file validator with `node scripts/pundit-news-validate.js`,
  - blocks both bad validator logic and bad live news data.

- `.codex/company/playbooks/pundit-live-desk.md`
  - now defines live-window certification as a required desk-ready gate for target match windows.

- `pundit-research-desk-loop` automation
  - updated from every 3 hours to hourly during calibration,
  - now explicitly runs live-window certifier checks for nearest target matches and known windows such as `POR-UZB`, `ENG-GHA`, `PAN-CRO`, and `COL-COD`.

- `pundit-live-window-certification-follow-up` thread heartbeat
  - created as an hourly continuation on the current thread,
  - keeps the live-window proof loop visible in the chairman-facing workstream,
  - must rerun the certifier around kickoff/final windows and append evidence only when the window actually proves something.

## Validation

Passed:

- `node --check scripts\pundit-live-window-certifier.js`
- `node --check scripts\test-pundit-live-window-certifier.js`
- `node scripts\test-pundit-live-window-certifier.js`
- `node scripts\pundit-live-window-certifier.js --match POR-UZB`
- `node scripts\pundit-live-window-certifier.js --match ENG-GHA`
- `node scripts\pundit-live-window-certifier.js --match POR-UZB --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
- `node scripts\pundit-live-window-certifier.js --match ENG-GHA --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
- `node scripts\pundit-live-window-certifier.js --production --match POR-UZB --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
- `node scripts\pundit-live-window-certifier.js --production --match ENG-GHA --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
- `node --check scripts\pundit-news-validate.js`
- `node --check scripts\test-pundit-news-validate.js`
- `node scripts\test-pundit-news-validate.js`
- `node scripts\pundit-news-validate.js`
- `node scripts\pundit-news-validate.js --require-unexpired`
- `node scripts\test-pundit-feed.js`
- `node scripts\test-world-cup-stories.js`
- `node scripts\live-ops-audit.js`

Thread follow-up:

- `pundit-live-window-certification-follow-up`
  - status: `ACTIVE`
  - cadence: hourly during calibration

## 2026-06-23 13:41Z Production Follow-Up

The heartbeat reran production-facing certification while both target matches were still pre-kickoff:

- `node scripts\pundit-live-window-certifier.js --production --match POR-UZB --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
  - source: `https://friendlybet.live/`
  - checked_at: `2026-06-23T13:41:39.008Z`
  - score: `100`
  - phase: `pre`
  - status: `TIMED`

- `node scripts\pundit-live-window-certifier.js --production --match ENG-GHA --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
  - source: `https://friendlybet.live/`
  - checked_at: `2026-06-23T13:41:40.048Z`
  - score: `100`
  - phase: `pre`
  - status: `TIMED`

Supporting checks:

- `node scripts\pundit-news-validate.js --require-unexpired`
- `node scripts\test-pundit-feed.js`
- `node scripts\test-world-cup-stories.js`
- `node scripts\live-ops-audit.js`

This remains readiness evidence only. It proves production freshness, source expiry discipline, and Stories coverage for already finished matches, but it is not graduation proof because no target had reached kickoff.

## Graduation-Proof Gate

The certifier now supports `--graduation-proof`. Normal pre-kickoff checks can still pass for readiness, but `--graduation-proof` fails if every target is still in phase `pre`. Graduation evidence must include at least one post-kickoff/live/final target, and the full goal still requires two real live match windows at 90+ with no stale/current-state misses.

Validation added:

- `node scripts\test-pundit-live-window-certifier.js`
  - proves ordinary pre-kickoff readiness still passes,
  - proves `--graduation-proof` rejects pre-kickoff-only evidence,
  - proves a final-state target with result copy and story coverage can satisfy the proof window.
- `node scripts\pundit-live-window-certifier.js --production --match POR-UZB --graduation-proof`
  - expected result before kickoff: `passed=false`, `proof_window=false`, and `graduation proof requires at least one post-kickoff/live/final target`.

## 2026-06-23 14:08Z Production Follow-Up

The goal continuation reran production-facing checks at `2026-06-23T17:05+03:00`, while both target matches were still pre-kickoff:

- `node scripts\pundit-live-window-certifier.js --production --match POR-UZB --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
  - source: `https://friendlybet.live/`
  - checked_at: `2026-06-23T14:08:23.733Z`
  - score: `100`
  - passed: `true`
  - proof_window: `false`
  - phase: `pre`
  - status: `TIMED`

- `node scripts\pundit-live-window-certifier.js --production --match ENG-GHA --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
  - source: `https://friendlybet.live/`
  - checked_at: `2026-06-23T14:08:31.718Z`
  - score: `100`
  - passed: `true`
  - proof_window: `false`
  - phase: `pre`
  - status: `TIMED`

Supporting checks:

- `node scripts\pundit-news-validate.js --require-unexpired`
- `node scripts\test-pundit-feed.js`
- `node scripts\test-world-cup-stories.js`
- `node scripts\test-pundit-live-window-certifier.js`
- `node scripts\live-ops-audit.js`

The explicit graduation proof command still failed as designed before kickoff:

- `node scripts\pundit-live-window-certifier.js --production --match POR-UZB --graduation-proof`
  - expected result: `passed=false`
  - proof_window: `false`
  - error: `graduation proof requires at least one post-kickoff/live/final target; all targets are pre-kickoff`

This is readiness evidence only. It should not be counted as one of the two required live/post-final graduation windows.

## 2026-06-23 14:22Z Production Follow-Up

The goal continuation reran production-facing checks at `2026-06-23T17:21+03:00`. Both target matches were still pre-kickoff, so this remains readiness evidence only:

- `node scripts\pundit-live-window-certifier.js --production --match POR-UZB --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
  - source: `https://friendlybet.live/`
  - checked_at: `2026-06-23T14:22:12.904Z`
  - score: `100`
  - passed: `true`
  - proof_window: `false`
  - phase: `pre`
  - status: `TIMED`

- `node scripts\pundit-live-window-certifier.js --production --match ENG-GHA --record tmp\pundit-live-window-certifications-2026-06-23.jsonl`
  - source: `https://friendlybet.live/`
  - checked_at: `2026-06-23T14:22:12.583Z`
  - score: `100`
  - passed: `true`
  - proof_window: `false`
  - phase: `pre`
  - status: `TIMED`

Supporting checks:

- `node scripts\pundit-news-validate.js --require-unexpired`
- `node scripts\test-pundit-feed.js`
- `node scripts\test-world-cup-stories.js`
- `node scripts\live-ops-audit.js`
- `python .codex\skills\friendlybet-social-content-excellence\scripts\certification_audit.py`
- `python .codex\skills\friendlybet-social-content-excellence\scripts\training_regression_suite.py`
- `python .codex\skills\friendlybet-social-content-excellence\scripts\certification_audit.py --require-production-ready`

The social-content academy remained `ready for Eyal review`, with `production_ready=false`, because Eyal approval/live-cycle proof is still missing.

The explicit graduation proof command still failed as designed before kickoff:

- `node scripts\pundit-live-window-certifier.js --production --match POR-UZB --graduation-proof`
  - checked_at: `2026-06-23T14:22:48.185Z`
  - expected result: `passed=false`
  - proof_window: `false`
  - error: `graduation proof requires at least one post-kickoff/live/final target; all targets are pre-kickoff`

This should not be counted toward the two required real live/post-final graduation windows.

## Remaining Graduation Gaps

The Pundit still needs two actual live-window passes after kickoff/final whistle. The pre-kickoff checks are strong, but they do not prove:

- preview copy was removed after kickoff,
- live/final state was detected on time,
- result stories were created after final,
- source-led post-match copy passed Red Team.

Next required windows:

- Portugal-Uzbekistan after 20:00 Israel.
- England-Ghana after 23:00 Israel.

## Verdict

Decision: encoded and calibrating.

The Pundit now has a measurable live-window certification gate. It is closer to autonomous TV-level behavior, but not graduated until two real match windows pass the gate at 90+ with no stale/current-state misses.

## 2026-06-24 05:35Z Local Live-Window Follow-Up

Checkpoint ran at `2026-06-24T08:33-08:35+03:00` against local snapshot data and recorded evidence in `tmp\pundit-live-window-certifications-2026-06-24.jsonl`.

Initial state before refresh:

- `public-data/pundit.json` was stale: `updatedAt=2026-06-23T22:49:23.666Z`, `freshUntil=2026-06-24T04:49:23.666Z`.
- `public-data/pundit-news.json` still contained three expired preview items for POR-UZB, ENG-GHA, and PAN-CRO.
- POR-UZB and ENG-GHA were locally `FINISHED`; PAN-CRO and COL-COD were still stale `TIMED` rows hours after kickoff.

Pre-refresh certifier evidence:

- POR-UZB: `score=60`, `passed=false`; final result existed, but feed was stale and expired items remained.
- ENG-GHA: `score=30`, `passed=false`; final result existed, feed was stale, and the finished match lacked a World Cup Story.
- PAN-CRO: `score=20`, `passed=false`; stale scheduled row lacked verification/recovery copy.
- COL-COD: `score=0`, `passed=false`; stale scheduled row still had fixture copy after kickoff and lacked verification/recovery copy.

Actions taken:

- Regenerated `public-data/pundit.json`.
- Removed the three expired items from `public-data/pundit-news.json` and regenerated the Pundit feed again.

Post-refresh certifier evidence:

- POR-UZB: `score=100`, `passed=true`; final result item present, fresh feed, no stale fixture copy.
- ENG-GHA: `score=70`, `passed=false`; result item present, but the finished match still lacks a World Cup Story.
- PAN-CRO: `score=100`, `passed=true`; stale scheduled row is represented only by verification/recovery copy.
- COL-COD: `score=100`, `passed=true`; stale scheduled row is represented only by verification/recovery copy.

Supporting checks after cleanup:

- `node scripts\pundit-news-validate.js --require-unexpired`: passed.
- `node scripts\test-pundit-feed.js`: passed, with warning that `pundit-news.json` is empty during the tournament window.
- `node scripts\test-world-cup-stories.js`: passed for 45 stories.
- `node scripts\live-ops-audit.js`: failed as designed because PAN-CRO and COL-COD remain stale scheduled rows after kickoff, ENG-GHA is missing a Story, and `pundit-news.json` is empty during the tournament window.

Graduation status: not graduated. This checkpoint proves the deterministic stale-data recovery works after refresh, but it also confirms that the live desk still needs source result recovery, an ENG-GHA story, and a non-empty or explicitly source-checked news desk before TV-level readiness can be claimed.

## 2026-06-24 06:32Z Final-State Follow-Up

Checkpoint ran at `2026-06-24T09:32+03:00` and recorded local evidence in `tmp\pundit-live-window-certifications-2026-06-24.jsonl`.

Current local snapshot changed materially from the previous checkpoint:

- POR-UZB: `FINISHED`, Portugal 5-0 Uzbekistan.
- ENG-GHA: `FINISHED`, England 0-0 Ghana.
- PAN-CRO: `FINISHED`, Panama 0-1 Croatia.
- COL-COD: `FINISHED`, Colombia 1-0 Congo DR.
- `public-data/world-cup-stories.json` now has 48 stories for 48 finished matches; missing-story count is 0.
- `public-data/pundit.json` is fresh: `updatedAt=2026-06-24T05:52:55.632Z`, `freshUntil=2026-06-24T11:52:55.632Z`.

Certifier evidence:

- POR-UZB: `score=100`, `passed=true`, phase `final`.
- ENG-GHA: `score=100`, `passed=true`, phase `final`.
- PAN-CRO: `score=100`, `passed=true`, phase `final`.
- COL-COD: `score=100`, `passed=true`, phase `final`.

Supporting checks:

- `node scripts\live-ops-audit.js`: `ok=true`, 0 errors, 48 finished matches, 48 stories, 0 result-recovery candidates.
- `node scripts\pundit-news-validate.js --require-unexpired`: passed.
- `node scripts\test-pundit-feed.js`: passed, with the expected warning that `pundit-news.json` is empty during the tournament window.
- `node scripts\test-world-cup-stories.js`: passed for 48 stories.

Graduation status: still not fully graduated. The final-state structural gate now passes for the target matches, including two real post-final windows, but the TV-level editorial standard still needs a source-led news desk record or fresh verified news. An empty news file is acceptable for strict correctness only when accompanied by a source ledger explaining why no item passed.

## 2026-06-24 06:40Z Source-Led News Desk Follow-Up

Checkpoint ran at `2026-06-24T09:34-09:40+03:00` after the final-state structural gate had passed but the news desk remained empty.

Source-led desk artifact:

- Added `.codex/company/academy/certification-runs/2026-06-24-pundit-news-desk-source-ledger.md`.
- The run scanned current post-final reporting, built a source ledger, scored candidates, published two items, and held weaker/single-source candidates.

Published local news items:

- `2026-06-24-colombia-knockout-munoz`: Colombia 1-0 Congo DR, Daniel Munoz winner, Colombia through, Colombia-Portugal Group K consequence.
- `2026-06-24-croatia-modric-budimir-survival`: Croatia 1-0 Panama, Ante Budimir winner, Luka Modric 200th cap, Croatia survival and Panama elimination.

Source policy:

- Both items are marked `reported`.
- Both have at least two independent source hosts.
- Both expire at `2026-06-24T12:36:00.000Z`.
- Rejected/held items included England-Ghana penalty-dispute copy, because only one source was captured in this run, and FIFA ticket-pricing controversy, because pool relevance was too weak for the Pundit feed.

Local validation after publishing:

- `node scripts\pundit-news-validate.js --require-unexpired`: passed.
- `node scripts\generate-pundit.js`: local feed now has 12 items, including both news items; `updatedAt=2026-06-24T06:39:28.252Z`, `freshUntil=2026-06-24T12:39:28.252Z`.
- `node scripts\test-pundit-feed.js`: passed.
- `node scripts\test-world-cup-stories.js`: passed for 48 stories.
- `node scripts\live-ops-audit.js`: `ok=true`, 0 errors, 0 warnings.
- Local certifiers for POR-UZB, ENG-GHA, PAN-CRO, and COL-COD all passed at `score=100`, phase `final`, with evidence appended to `tmp\pundit-live-window-certifications-2026-06-24.jsonl`.

Production verification:

- Cache-busted production public data was fetched after the local source-led update.
- Production `matches.json` had all four targets `FINISHED` with correct scores.
- Production `world-cup-stories.json` had 48 stories and included COL-COD, PAN-CRO, and ENG-GHA.
- Production certifiers for POR-UZB, ENG-GHA, PAN-CRO, and COL-COD all passed at `score=100`, phase `final`.
- Production `pundit-news.json` was still empty and production `pundit.json` still had 10 items from `2026-06-24T05:52:55.632Z`, so the source-led news desk is encoded locally but not yet production-visible.

Graduation status: not complete. The local TV-level evidence is now stronger because final-state certification, story coverage, strict news validation, and source-led news all pass together. Production still needs the source-led `pundit-news.json` and regenerated 12-item `pundit.json` to deploy before this can be counted as production-visible editorial readiness.

## 2026-06-24 06:45Z Production-Visible Source-Led Follow-Up

Checkpoint ran at `2026-06-24T09:44-09:45+03:00` after `origin/main` advanced to `7cd585e76` (`Refresh Pundit live news desk (#11)`).

Cache-busted production public data now shows:

- `public-data/matches.json`: all four target matches are `FINISHED` with expected scores.
- `public-data/world-cup-stories.json`: 48 stories, including COL-COD, PAN-CRO, ENG-GHA, and POR-UZB.
- `public-data/pundit-news.json`: 2 source-led items:
  - `2026-06-24-colombia-knockout-munoz`
  - `2026-06-24-croatia-modric-budimir-survival`
- `public-data/pundit.json`: 12 items, `updatedAt=2026-06-24T06:39:28.252Z`, `freshUntil=2026-06-24T12:39:28.252Z`.

Production certifier evidence appended to `tmp\pundit-live-window-certifications-2026-06-24.jsonl`:

- POR-UZB: `score=100`, `passed=true`, phase `final`, source `https://friendlybet.live/`.
- ENG-GHA: `score=100`, `passed=true`, phase `final`, source `https://friendlybet.live/`.
- PAN-CRO: `score=100`, `passed=true`, phase `final`, source `https://friendlybet.live/`.
- COL-COD: `score=100`, `passed=true`, phase `final`, source `https://friendlybet.live/`.

Local supporting checks:

- `node scripts\pundit-news-validate.js --require-unexpired`: passed.
- `node scripts\test-pundit-feed.js`: passed for 12 items.
- `node scripts\test-world-cup-stories.js`: passed for 48 stories.
- `node scripts\live-ops-audit.js`: `ok=true`, 0 errors, 0 warnings.

Graduation status: stronger but still active. This is now real production-visible evidence for two-plus final windows, complete Stories coverage, fresh Pundit feed, and source-led news. The larger TV-level academy goal still needs continued creator/virality practice, Red Team scoring on current stories, and another upcoming pre-kickoff/live/post-final cycle before declaring the Pundit fully autonomous.
