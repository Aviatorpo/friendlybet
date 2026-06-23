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

## Durable Wiring

- `.github/workflows/test-scoring.yml`
  - now watches the certifier and its test,
  - runs `node scripts/test-pundit-live-window-certifier.js`.

- `scripts\pundit-live-window-certifier.js --record <repo-local-path>`
  - appends JSONL evidence for each certification run,
  - blocks paths outside the repository,
  - should use `tmp\...` during automated calibration because Node cannot write into `.codex` in this sandbox.
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
