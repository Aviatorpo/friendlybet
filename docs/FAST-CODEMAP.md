# FriendlyBet Fast Code Map

Use this map before scanning large files. It is intentionally small and points to stable anchors.

## Main App Anchors

- Dashboard entry: `goToDashboard()` in `app.js`.
- Pundit feed: `loadPundit()` and `renderPundit()` in `app.js`.
- World Cup Stories carousel: `loadWorldCupStories()`, `renderWorldCupStories()`, `shareWorldCupStory()` in `app.js`.
- Matches/results screen: `loadMatches()` and `loadResultsData()` in `app.js`.
- Leaderboard banter/share card: `renderLeaderboardBanter()` and `shareLeaderboardMoment()` in `app.js`.
- Invite/share app chips: `shareToWhatsApp()` through `shareBySMS()` in `app.js`.
- Bracket share image: `_renderBracketCard()` and `shareBracketCard()` in `app.js`.

## Single-Phase Prediction Flow

- WC2026 constants: `WC2026_GROUPS` and `FIFA_RANKINGS` in `app.js`.
- Existing picks load: `spLoadExistingPicks()`.
- Group screen: `spRenderGroups()`, `spSaveGroupsToDb()`.
- Third-place step: `spRenderThirdPlaceStep()`.
- Bracket screen: `spRenderBracket()`, `spRenderBracketMatch()`, `spSaveBracketToDb()`, `spSaveBracketVerified()`.
- Winner/top scorer/summary: `spRenderWinnerScreen()`, `spTopScorerNext()`, `spShowSummary()`, `spRenderSummary()`, `spSubmitPredictions()`.
- Locked/reopen flow: `spShowLockedView()`, `spAutoLockPoolIfNeeded()`, `spReopenKnockout()`, `spReopenFinish()`.

## Share / OG Path

- Client card renderer: `_renderBracketCard()` in `app.js`.
- Public share page: `share-page.html`.
- OG shell: `share-og.html`.
- OG endpoint: `api/og.mjs`.
- OG layout: `lib/og-card.mjs`.
- Server bracket resolver: `lib/bracket-core.mjs`.
- Shared browser/server bracket helpers: `share-assets/share-core.js`.
- FIFA Annex C third-place table: `share-assets/fifa-third-place-table.js`.

## Data / Automation

- Score calculation: `scripts/calculate-scores-v2.js`.
- Retired API match sync scripts: `scripts/sync-matches.js`, `scripts/smart-sync.js`.
- World Cup Stories generator: `scripts/generate-world-cup-stories.js`.
- Story feed: `public-data/world-cup-stories.json`.
- Story assets and mapping: `story-assets/`.
- Scoring workflow: `.github/workflows/calculate-scores-v2.yml`.

## Fast Search Recipes

```powershell
rg -n "functionName|anchor" app.js
rg -n "translation.key" i18n.js index.html app.js
rg -n "APP_VERSION|CACHE_VERSION|menu-version" config.js service-worker.js index.html
rg -n "story|WorldCupStories|shareWorldCupStory" app.js styles.css public-data scripts
rg -n "FIFA_RANKINGS|FIFA_RANK" app.js scripts/calculate-scores-v2.js
```

## Speed Defaults

- Start with this file plus `AGENTS.md`.
- Use `git status --short --untracked-files=no` for quick checks.
- Every FriendlyBet request gets automatic company preflight: classify as direct/simple, owner-led, or meaningful company work before answering or editing.
- For meaningful company work, run `.codex/company/playbooks/full-company-planning-review.md` before the plan exists; for tiny tasks, avoid fake department theater and use only the useful owner path.
- For live result, scoring, leaderboard, fixture, or Action-noise incidents, read `.codex/company/playbooks/live-scoring-operations.md` and `.codex/company/playbooks/quality-gates.md` before planning or patching.
- Do not load full `CHANGELOG.md` unless release history is directly relevant.
- Avoid full reads of `app.js`, `styles.css`, `index.html`, or `i18n.js`; jump by anchor/search.

## Release Rule

When shipping app code, bump all three version strings together:

- `config.js` `APP_VERSION`
- `service-worker.js` `CACHE_VERSION`
- `index.html` footer `<span class="menu-version">`

The service-worker cache key gates PWA updates.

## User / Product Rules

- Reply to Eyal in English in FriendlyBet threads.
- Code, comments, commits, and identifiers stay in English.
- Product copy supports Hebrew and English; update both languages for user-facing text.
- Preferred Hebrew product terminology: betting terms around "lehamer/himur", not guessing terms.
- Visual style: minimal, elegant, premium sports feel, close to Golazo.us.
- Eyal prefers autonomy, but active tool/sandbox safety rules still apply.
- Eyal expects trusted-senior-partner behavior: direct truth, human common sense, independent ownership, early challenge of weak assumptions, and concise reporting after real thinking.

## Critical Gotchas

1. Supabase returns 1000 rows by default. Use `.range(0, 9999)` or DB-side search when needed.
2. `teams` primary key is `code`, not `id`.
3. football-data.org rate limit is 10 requests/min; use 7s+ spacing.
4. `top_scorer_picks` INSERT needs both `player_name` and `team_code`.
5. RLS needs both SELECT and write policies/RPCs.
6. Top scorer search should be DB-side with `.ilike`.
7. Do not wipe in-memory prediction state before DB reads/writes finish. Load into temp objects and commit only successful slices.
8. New screens must go inside `<div id="app">`; outside it they bypass the mobile width shell.
9. Static fallback text in `index.html` should match `i18n.js` because it shows before `applyLanguage()`.
10. Knockout advancement is verified from result sources/rules and stored in `matches.winner_code`; do not trust a raw or contradictory `winner_code` by itself.
10a. Penalties are a normal knockout state. A tied final score can still be scoreable when the advancing team is verified; missing penalty shootout numbers should not block points.
10b. Eyal-provided match truth is not a product fallback. If Eyal has to tell the system who advanced, classify it as a live-result automation incident and repair the automatic source path.
10c. Precompute per-match scoring deltas or scenario snapshots tied to a current baseline. Do not precompute future total user scores across unresolved earlier matches.
10d. Public scoring proof must allow bounded Vercel/CDN propagation after generated-data commits. Local snapshot-vs-DB mismatches fail immediately; just-pushed public staleness gets cache-busted retries before alerting.
11. `knockout_picks` has no `team_code`; single-phase bracket picks are stored in `predicted_winner`.
12. `group_position_picks` has no `multiplier_applied`; single-phase scoring uses live multipliers.
13. Keep frontend `FIFA_RANKINGS` and backend `FIFA_RANK` in sync.
14. Use the official FIFA Annex C third-place mapping from `share-assets/fifa-third-place-table.js`.

## WC 2026 Groups

- A: MEX, RSA, KOR, CZE
- B: CAN, BIH, QAT, SUI
- C: BRA, MAR, HAI, SCO
- D: USA, PAR, AUS, TUR
- E: GER, CUR, CIV, ECU
- F: NED, JPN, SWE, TUN
- G: BEL, EGY, IRN, NZL
- H: ESP, CPV, SAU, URU
- I: FRA, SEN, IRQ, NOR
- J: ARG, ALG, AUT, JOR
- K: POR, COD, UZB, COL
- L: ENG, CRO, GHA, PAN
