# App Deep Dive

This is the minimum app context every senior agent must know.

## Product Surfaces

- Dashboard and Pundit feed: `goToDashboard()`, `loadPundit()`, `renderPundit()` in `app.js`.
- Matches/results: `loadMatches()`, `loadResultsData()` in `app.js`.
- World Cup Stories: `loadWorldCupStories()`, `renderWorldCupStories()`, `shareWorldCupStory()` in `app.js`.
- Leaderboard banter/share cards: `renderLeaderboardBanter()`, `shareLeaderboardMoment()` in `app.js`.
- Invite/share chips: `shareToWhatsApp()` through `shareBySMS()` in `app.js`.
- Bracket share: `_renderBracketCard()` and `shareBracketCard()` in `app.js`.

## Prediction Flow

- WC2026 constants: `WC2026_GROUPS` and `FIFA_RANKINGS` in `app.js`.
- Existing picks: `spLoadExistingPicks()`.
- Groups: `spRenderGroups()`, `spSaveGroupsToDb()`.
- Third-place selector: `spRenderThirdPlaceStep()`.
- Bracket: `spRenderBracket()`, `spRenderBracketMatch()`, `spSaveBracketToDb()`.
- Winner/top scorer/summary: `spRenderWinnerScreen()`, `spTopScorerNext()`, `spShowSummary()`, `spSubmitPredictions()`.
- Locked/reopen flow: `spShowLockedView()`, `spAutoLockPoolIfNeeded()`, `spReopenKnockout()`, `spReopenFinish()`.

## Data And Automation

- Score calculation: `scripts/calculate-scores-v2.js`.
- Story generator: `scripts/generate-world-cup-stories.js`.
- Story feed: `public-data/world-cup-stories.json`.
- FIFA Annex C table: `share-assets/fifa-third-place-table.js`.
- Generated third-place allocation: `third-place-allocation.js`, `lib/third-place-allocation.mjs`.
- Scoring workflow: `.github/workflows/calculate-scores-v2.yml`.

## Critical App Rules

- Supabase defaults to 1000 rows. Use `.range(0, 9999)` or DB-side search when needed.
- `teams` primary key is `code`.
- RLS needs both SELECT and write policies/RPCs.
- Top scorer search should be DB-side with `.ilike`.
- Do not wipe in-memory prediction state before DB reads/writes finish.
- New screens must live inside `<div id="app">`.
- Static fallback text in `index.html` should match `i18n.js`.
- Knockout results use `matches.winner_code`, not score comparison.
- `knockout_picks` stores picks in `predicted_winner`, not `team_code`.
- `group_position_picks` has no `multiplier_applied`; single-phase scoring uses live multipliers.
- Keep frontend `FIFA_RANKINGS` and backend `FIFA_RANK` in sync.
- Use the official FIFA Annex C mapping from `share-assets/fifa-third-place-table.js`.

## Release Rule

When shipping app code, bump together:

- `config.js` `APP_VERSION`
- `service-worker.js` `CACHE_VERSION`
- `index.html` footer `.menu-version`

If app code changes are user-facing, also update `../../../CHANGELOG.md` unless the release manager decides otherwise.

## Required Senior Questions

Before a cross-functional change, ask:

- Does this affect scoring, locks, or saved picks?
- Does this affect public sharing or snapshots?
- Does this affect Hebrew/English copy?
- Does this affect PWA cache?
- Does this require a migration or RLS change?
- Does this rely on live provider data?
- Which existing test command or manual check proves it?
