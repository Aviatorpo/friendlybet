# Production-Visible Content Verification

Date: 2026-06-24

## Decision

For any FriendlyBet issue that Eyal reports from the live app, agents must treat the live production artifact as the source of truth before claiming resolution.

## Reason

The World Cup story feed repeated the same generic result copy across multiple visible stories. The local generator and JSON were corrected, but the first completion report was wrong because production still served the old `public-data/world-cup-stories.json`.

## Standard

- Separate local fix, committed fix, pushed fix, deployed fix, and live-verified fix.
- For public-data/content bugs, fetch the cache-busted production URL after deploy and inspect the exact latest visible items.
- Repeated generated copy is a quality incident when the sentence structure is the same after normalizing teams, scores, dates, and group letters.
- Do not reassure Eyal from local evidence alone. State the proven layer and the remaining unproven layer.

## Applies To

World Cup stories, Pundit, leaderboard banter, share-card copy, public snapshots, and any other user-visible generated content.
