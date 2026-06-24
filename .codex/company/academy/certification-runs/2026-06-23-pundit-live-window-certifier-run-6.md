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

## 2026-06-24 14:17Z Production Pre-Kickoff Readiness Follow-Up

Checkpoint ran at `2026-06-24T17:17+03:00` and recorded local plus production evidence in `tmp\pundit-live-window-certifications-2026-06-24.jsonl`.

Current state:

- `public-data/pundit.json` has `12` items, `updatedAt=2026-06-24T14:08:46.560Z`, `freshUntil=2026-06-24T20:08:46.560Z`.
- `public-data/pundit-news.json` is no longer empty. It contains three active source-led desk items:
  - Group B final window, expiring before the 22:00 Israel kickoff window.
  - Scotland-Brazil Neymar/history angle, expiring before the 01:00 Israel kickoff window.
  - Morocco-Haiti Group C receipts angle, expiring at kickoff.
- The Morocco-Haiti item was added after source review using SB Nation for Group C qualification scenarios and The Guardian for Ayyoub Bouaddi tournament context. It closed the previous `MAR-HAI` warning for missing source-backed pre-kickoff editorial context.
- `public-data/world-cup-stories.json` remains at `48` stories for `48` finished matches.

Local supporting checks:

- `node scripts\live-ops-audit.js`: `ok=true`; Pundit fresh, 48 stories for 48 finished matches, 0 missing stories, 0 result-recovery candidates.
- `node scripts\pundit-news-validate.js --require-unexpired`: passed.
- `node scripts\test-pundit-feed.js`: passed for 12 items.
- `node scripts\test-world-cup-stories.js`: passed for 48 stories.

Local certifier evidence:

- `SUI-CAN`: `score=100`, `passed=true`, phase `pre`.
- `BIH-QAT`: `score=100`, `passed=true`, phase `pre`.
- `SCO-BRA`: `score=100`, `passed=true`, phase `pre`.
- `MAR-HAI`: `score=100`, `passed=true`, phase `pre`.

Production certifier evidence against `https://friendlybet.live/`:

- `SUI-CAN`: `score=100`, `passed=true`, phase `pre`.
- `BIH-QAT`: `score=100`, `passed=true`, phase `pre`.
- `SCO-BRA`: `score=100`, `passed=true`, phase `pre`.
- `MAR-HAI`: `score=100`, `passed=true`, phase `pre`.

Production snapshot evidence:

- Cache-busted `https://friendlybet.live/public-data/pundit.json` shows the new 12-item feed and all active Pundit lines end with emojis.
- Cache-busted `https://friendlybet.live/public-data/world-cup-stories.json` shows recent Stories with emoji-ending headlines, captions, and pool-focus templates.

Graduation status: still not fully graduated. This checkpoint proves source-led pre-kickoff readiness and production propagation for the 22:00 and 01:00 Israel windows, but it does not count as live/post-final graduation proof because all four current target matches are still pre-kickoff. The next proof must happen after kickoff and after final whistle, verifying that stale fixture copy disappears, live/final state is correct, source-led news expires, and new Stories exist for finished matches.

### 2026-06-24 14:31Z Automation Liveness Check

Because the latest visible scheduled `Generate Pundit Feed` run was older than the surrounding live desk monitors, the workflow was manually dispatched once as an operational safeguard:

- `gh workflow run generate-pundit.yml --ref main`
- Run: `28106016928`
- Result: success.
- Evidence from workflow logs:
  - exported current match snapshot with `FORCE_MATCH_SNAPSHOT=1`; `matches.json` unchanged at 72 rows.
  - ran `node scripts/live-ops-audit.js` before build; `ok=true`, 48 stories for 48 finished matches, 0 result-recovery candidates.
  - ran `node scripts/pundit-news-validate.js`; passed.
  - ran `node scripts/generate-pundit.js`; `pundit: no change, keeping existing feed`.
  - ran `node scripts/test-pundit-feed.js`; passed for 12 items.

Production remained on the existing fresh 12-item feed: `updatedAt=2026-06-24T14:08:46.560Z`, `freshUntil=2026-06-24T20:08:46.560Z`.

Interpretation: the autonomous Pundit refresh path is executable and correctly avoided unnecessary deploy churn. This is operational readiness evidence only, not graduation proof, because it still occurred before the 22:00 Israel kickoff boundary.

### 2026-06-24 14:35Z Final-State And Pre-Kickoff Certification Slice

Checkpoint ran at `2026-06-24T17:35+03:00` and recorded local plus production evidence in `tmp\pundit-live-window-certifications-2026-06-24.jsonl`.

Supporting checks:

- `node scripts\live-ops-audit.js`: `ok=true`; 72 matches, 48 stories for 48 finished matches, 0 missing stories, 0 result-recovery candidates, Pundit fresh.
- `node scripts\pundit-news-validate.js --require-unexpired`: passed.
- `node scripts\test-pundit-feed.js`: passed for 12 items.
- `node scripts\test-world-cup-stories.js`: passed for 48 stories.

Final-state certifier evidence, local and production:

- `POR-UZB`: `score=100`, `passed=true`, phase `final`, item type `result`.
- `ENG-GHA`: `score=100`, `passed=true`, phase `final`, item type `result`.
- `PAN-CRO`: `score=100`, `passed=true`, phase `final`, item type `result`.
- `COL-COD`: `score=100`, `passed=true`, phase `final`, item type `result`.

Pre-kickoff readiness evidence, local and production:

- `SUI-CAN`: `score=100`, `passed=true`, phase `pre`, item type `fixture`.
- `BIH-QAT`: `score=100`, `passed=true`, phase `pre`, item type `fixture`.
- `SCO-BRA`: `score=100`, `passed=true`, phase `pre`, item type `fixture`.
- `MAR-HAI`: `score=100`, `passed=true`, phase `pre`, item type `fixture`.

Current feed state:

- `public-data/pundit.json`: 12 items, `updatedAt=2026-06-24T14:08:46.560Z`, `freshUntil=2026-06-24T20:08:46.560Z`.
- `public-data/world-cup-stories.json`: 48 stories for 48 finished matches.

Interpretation: the completed-match checks are real anti-staleness proof: production shows final/result Pundit items for all four requested completed matches, with no stale fixture wording. The 22:00 and 01:00 Israel windows remain readiness evidence only because those matches are still pre-kickoff. Graduation remains open until the next live/post-final transition proves stale fixture copy disappears, source-led news expires correctly, live/final state stays accurate, and Stories coverage catches the newly finished matches.

### 2026-06-24 14:41Z Academy Audit Gate

Added a one-command Pundit/Stories academy audit:

- `scripts\pundit-academy-audit.js`
- `scripts\test-pundit-academy-audit.js`

Purpose: prevent future agents from claiming TV-level or production-ready status by stitching together partial evidence. The audit combines:

- fresh `public-data/pundit.json` state and item-level expiry
- required Pundit emoji finish in Hebrew and English
- strict `public-data/pundit-news.json` validation with unexpired source-led items
- `public-data/world-cup-stories.json` coverage for finished matches and recent emoji-ending visible copy
- production live-window JSONL proof from `tmp\pundit-live-window-certifications-YYYY-MM-DD.jsonl`
- social/content academy certification status from `.codex\skills\friendlybet-social-content-excellence\scripts\certification_audit.py`

Validation:

- `node --check scripts\pundit-academy-audit.js`: passed.
- `node --check scripts\test-pundit-academy-audit.js`: passed.
- `node scripts\test-pundit-academy-audit.js`: passed.
- `node scripts\test-pundit-live-window-certifier.js`: passed.
- `node scripts\test-pundit-feed.js`: passed for 12 items.
- `node scripts\test-world-cup-stories.js`: passed for 48 stories.
- `node scripts\pundit-academy-audit.js`: passed with status `calibrating-with-live-proof`, `production_ready=false`.
- `node scripts\pundit-academy-audit.js --require-tv-ready`: failed as designed because the social/content academy is not production-ready.
- `python .codex\skills\friendlybet-social-content-excellence\scripts\certification_audit.py --require-production-ready`: failed as designed because production-ready still requires Eyal approval or live publish-cycle proof.

Current audit evidence:

- Pundit feed: 12 items, `freshUntil=2026-06-24T20:08:46.560Z`.
- Stories: 48 stories for 48 finished matches.
- News desk: 3 items, all unexpired at the audit time.
- Production live-window proof windows: 4.
- Social/content academy: `ready for Eyal review`, not production-ready.

Interpretation: the academy now has an enforceable graduation audit. The current honest status is `calibrating-with-live-proof`, not TV-level production-ready. This moves the Pundit/Stories agents closer to autonomous operation by making overclaiming mechanically harder.

### 2026-06-24 14:48Z Source-Led News Desk Schema

Added a stricter Pundit news evidence requirement so source-led items prove editorial judgment, not only URL attachment.

Changed:

- `scripts\pundit-news-validate.js` now requires every `public-data/pundit-news.json` item to include:
  - `source_ledger[]` with claim, source, URL, source tier, timestamp, confirmation, uncertainty, and usability.
  - `story_score` with freshness, verification, FriendlyBet relevance, drama, uniqueness, clarity, decision, and reason.
  - `self_review` with stale-risk, overclaiming, privacy, gambling, repeated-shape, proof-source, and expiry checks.
- `scripts\test-pundit-news-validate.js` now covers the richer schema and fails missing ledger/score/self-review cases.
- `public-data/pundit-news.json` now carries the richer source-led desk evidence for the three current active news items.
- `.codex\company\academy\domains\pundit-research-desk.md` now documents those fields as mandatory for published Pundit news.

Validation:

- `node --check scripts\pundit-news-validate.js`: passed.
- `node --check scripts\test-pundit-news-validate.js`: passed.
- `node scripts\test-pundit-news-validate.js`: passed.
- `node scripts\pundit-news-validate.js --require-unexpired`: passed.
- `node scripts\test-pundit-feed.js`: passed for 12 items.
- `node scripts\pundit-academy-audit.js`: passed with status `calibrating-with-live-proof`, `production_ready=false`.
- `node scripts\live-ops-audit.js`: `ok=true`.
- `node scripts\generate-pundit.js`: no visible feed change; existing `public-data/pundit.json` stayed current.
- Local live-window certifiers for `SUI-CAN`, `BIH-QAT`, `SCO-BRA`, and `MAR-HAI`: all `score=100`, phase `pre`.

Interpretation: this does not graduate the Pundit, but it closes a real training gap. The news desk now has machine-checkable evidence of source ledger, story scoring, and self-review for every source-led item, making it harder for future agents to publish shallow or unexplained "current" commentary.

Production propagation:

- Cache-busted `https://friendlybet.live/public-data/pundit-news.json?cb=e8d7f2f35-2` showed the new `source_ledger`, `story_score`, and `self_review` fields for all 3 active news items.
- Fetched production file saved to `tmp\prod-pundit-news-e8d7f2f35.json`.
- `node -e "... validatePayload(raw,{nowMs:Date.now(),requireUnexpired:true}) ..."` passed: `production pundit-news evidence schema validated: 3 item(s)`.
- Production live-window certifiers for `SUI-CAN`, `BIH-QAT`, `SCO-BRA`, and `MAR-HAI` remained `score=100`, phase `pre`.

### 2026-06-24 14:56Z Red Team Review Gate For Pundit News

Added a mandatory Red Team review layer for source-led Pundit news:

- `scripts\pundit-news-validate.js` now requires `red_team_review` on every `public-data/pundit-news.json` item.
- Required Red Team fields: `score`, `blockers`, `decision`, `stale_state_check`, `source_check`, `pool_relevance_check`, `tone_check`, `repetition_check`, and `rewrite_note`.
- Publishable items must have `score >= 90`, `decision=approve`, and an empty `blockers[]` list.
- `scripts\test-pundit-news-validate.js` now covers missing Red Team review, score below 90, and non-empty blockers.
- `public-data/pundit-news.json` now carries approved Red Team review for all 3 active source-led items.
- `.codex\company\playbooks\pundit-live-desk.md` now documents that Red Team review is enforced for published Pundit news.

Validation:

- `node --check scripts\pundit-news-validate.js`: passed.
- `node --check scripts\test-pundit-news-validate.js`: passed.
- `node scripts\test-pundit-news-validate.js`: passed.
- `node scripts\pundit-news-validate.js --require-unexpired`: passed.
- `node scripts\test-pundit-academy-audit.js`: passed.
- `node scripts\pundit-academy-audit.js`: passed with status `calibrating-with-live-proof`, `production_ready=false`.
- `node scripts\test-pundit-feed.js`: passed for 12 items.
- `node scripts\test-world-cup-stories.js`: passed for 48 stories.
- `node scripts\generate-pundit.js`: no visible feed change; current `public-data/pundit.json` stayed fresh.
- `node scripts\live-ops-audit.js`: `ok=true`.
- Local live-window certifiers for `SUI-CAN`, `BIH-QAT`, `SCO-BRA`, and `MAR-HAI`: all `score=100`, phase `pre`.

Interpretation: this is still not graduation. It does make the Pundit harder to operate lazily: source-led news now needs source evidence, story scoring, self-review, and an explicit Red Team approval with no blockers before publication.

Production propagation:

- Initial cache-busted production fetch still served the previous source-led schema, and the new validator correctly failed with missing `red_team_review` for all 3 items.
- After a short deploy/CDN propagation wait, cache-busted `https://friendlybet.live/public-data/pundit-news.json?cb=2ec14faea-2` contained the new Red Team fields.
- Fetched production file saved to `tmp\prod-pundit-news-2ec14faea.json`.
- `node -e "... validatePayload(raw,{nowMs:Date.now(),requireUnexpired:true}) ..."` passed: `production pundit-news red team schema validated: 3 item(s)`.
- Production live-window certifiers for `SUI-CAN`, `BIH-QAT`, `SCO-BRA`, and `MAR-HAI` remained `score=100`, phase `pre`.

2026-06-24 22:40 Israel live-window incident:

- `node scripts\live-ops-audit.js` failed because `SUI-CAN` and `BIH-QAT` were still `TIMED` 41-42 minutes after kickoff; this is a live-data incident, not graduation evidence.
- `node scripts\pundit-news-validate.js --require-unexpired` initially failed because `2026-06-24-group-b-final-window` had expired at `2026-06-24T18:45:00Z`; the expired pre-kickoff item was removed instead of extended.
- `node scripts\generate-pundit.js` refreshed `public-data\pundit.json` at `2026-06-24T19:42:07.279Z` with explicit `verification` items for `SUI-CAN` and `BIH-QAT`, both ending with the Pundit emoji treatment.
- Local certifiers recorded to `tmp\pundit-live-window-certifications-2026-06-24.jsonl`: `POR-UZB`, `ENG-GHA`, `PAN-CRO`, and `COL-COD` all `score=100`, phase `final`; `SUI-CAN` and `BIH-QAT` both `score=100`, phase `stale_scheduled`, item type `verify`; `SCO-BRA` and `MAR-HAI` both `score=100`, phase `pre`.
- Follow-up gates: strict news validation passed, `test-pundit-feed` passed, and `test-world-cup-stories` passed. `live-ops-audit` still fails by design until the underlying match snapshot leaves stale `TIMED` state.

Interpretation: useful live-window recovery evidence, but not TV-level graduation. The Pundit showed the correct cautionary copy locally; the live match-data layer still needs provider/DB recovery and production verification.

Rebased follow-up:

- After rebasing onto latest `main`, upstream live-fixture gating/snapshot work moved the Group B rows out of stale scheduled state: `node scripts\live-ops-audit.js` passed with `ok=true` and no watchdog errors.
- Rebased local certifiers recorded to `tmp\pundit-live-window-certifications-2026-06-24.jsonl`: `SUI-CAN` and `BIH-QAT` both `score=100`, phase `live`, status `PAUSED`, item type `live`; `POR-UZB`, `ENG-GHA`, `PAN-CRO`, and `COL-COD` stayed `score=100`, phase `final`; `SCO-BRA` and `MAR-HAI` stayed `score=100`, phase `pre`.
- Strict news validation, `test-pundit-feed`, `test-world-cup-stories`, and `test-generate-pundit-live-state` all passed after the rebase.

Interpretation: the final local state is stronger than the first recovery state because both layers now agree: live match rows are live/paused, and the Pundit says live instead of previewing or hiding the match. Still not graduation until production is checked and two real 90+ live windows complete cleanly.

Production propagation after `bf89b6e30`:

- Cache-busted `https://friendlybet.live/public-data/pundit.json?cb=bf89b6e30` served `updatedAt=2026-06-24T19:44:47.628Z`, `count=12`; first two items were `live` copy for `SUI-CAN` and `BIH-QAT`, both with emoji treatment.
- Cache-busted `https://friendlybet.live/public-data/pundit-news.json?cb=bf89b6e30` contained 2 items; the expired `2026-06-24-group-b-final-window` item was gone. Strict production validation passed: `production pundit-news strict validation OK: 2 item(s)`.
- Production `node scripts\live-ops-audit.js --production` passed with `ok=true`, zero watchdog errors, 48/48 finished-match Stories covered, and fresh Pundit data.
- Production certifiers recorded to `tmp\pundit-live-window-certifications-2026-06-24.jsonl`: `POR-UZB`, `ENG-GHA`, `PAN-CRO`, and `COL-COD` all `score=100`, phase `final`; `SUI-CAN` and `BIH-QAT` both `score=100`, phase `live`, status `PAUSED`; `SCO-BRA` and `MAR-HAI` both `score=100`, phase `pre`.

Interpretation: production is now current for this heartbeat window. This is meaningful live-window proof, but it still does not close the overall TV-level goal because the academy audit remains `calibrating-with-live-proof` and requires clean completion through additional real live/final windows.
