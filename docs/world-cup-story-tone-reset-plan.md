# World Cup Story Tone Reset Plan

## Objective

Raise World Cup Stories from repetitive score summaries to sharp, social, pool-aware mini moments. English is the primary quality bar. Hebrew should remain correct and friendly, but English tone is the release blocker.

## Company Ownership

- CEO: owns the final taste bar and production readiness.
- Content and Community: owns voice, English story texture, Hebrew fallback quality, and emoji discipline.
- Product: keeps every Story tied to a real pool reason: who picked what, what changed, who can talk now.
- Design: checks that visible Story copy stays short enough for the 9:16 card and does not fight the image.
- Engineering: implements generator changes, publishing gates, rollback-safe automation, and deterministic tests.
- Sports Rules: verifies that knockout Stories name advancement/elimination correctly and do not imply group-stage logic after groups are done.
- QA and Release: owns the validation matrix before push and production publish.
- Privacy and Security: checks that copy stays social but never exposes private user data beyond the intended `{names}` templates.
- FinOps and Enablement: keeps the workflow free-tier friendly and documents the reusable rule in repo docs.
- HR and Agent Excellence: prevents process theater, weak copy acceptance, and unverified production claims.

## Tone Standard

Every new Story should feel like it belongs in a group chat after the match, not like a database row with adjectives.

Required English qualities:

- Specific result truth: winner, loser, score, and stage/context must be correct.
- Pool consequence: the Story must explain why old picks feel different now.
- Social texture: use language such as receipts, witnesses, chat arguments, quiet picks getting loud, tickets, roads closing, forms aging in public, or similar.
- Variety: avoid repeating the same sentence shape across adjacent/latest Stories.
- Lightness: witty is good; cruel, smug, or confusing is not.
- No sterile phrasing: avoid "points column", "pool table changes", "good call", "bad call", "big boost", "pool feels it", and similar filler.

## Emoji Rule

Every newly generated Story must end each visible and templated line with one fitting emoji:

- English headline
- English caption
- Hebrew headline
- Hebrew caption
- `pool_focuses[].en_name`
- `pool_focuses[].en_names`
- `pool_focuses[].en_count`
- `pool_focuses[].he_name`
- `pool_focuses[].he_names`
- `pool_focuses[].he_count`

The emoji should fit the moment rather than decorate randomly: fire/football for wins, eyes/nerves for draws or uncertainty, trophy/crown for title implications, receipt-style energy for pick vindication.

## Implementation

1. Replace weak knockout and latest-story English templates in `scripts/generate-world-cup-stories.js`.
2. Keep `applyStoryEmojiDiscipline` as the final safety net for headline, caption, and pool-focus template endings.
3. Add `scripts/test-world-cup-story-tone.js` to validate the latest ten Stories.
4. Wire the tone test into `scripts/publish-world-cup-stories-auto.js` after generation and structural story validation.
5. If generation, image audit, story validation, or tone validation fails, restore the previous story feed and exit without publishing broken optional content.

## Acceptance Gates

Before production:

- `node --check scripts/generate-world-cup-stories.js`
- `node --check scripts/test-world-cup-story-tone.js`
- `node --check scripts/publish-world-cup-stories-auto.js`
- `node scripts/generate-world-cup-stories.js`
- `node scripts/test-world-cup-stories.js`
- `node scripts/test-world-cup-story-tone.js`

Production publish should only proceed when the latest generated Stories pass both structural correctness and tone gates.

## Release Principle

Story charm is important, but it must never block verified results, scoring, leaderboard snapshots, locking, or match display. The Story publisher is optional content automation with rollback-safe behavior.
