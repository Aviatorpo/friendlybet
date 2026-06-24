# Playbook: Pundit Continuous Learning Loop

Use this to keep The Pundit improving every match day without waiting for Eyal to complain.

## Principle

The Pundit learns by running a loop: research, publish or reject, validate, review, update memory. A content pass that produces no publishable item is still useful if it records sources checked and why they failed.

## Daily Loop

Before every loop, read:

- `../academy/domains/pundit-world-cup-analyst-knowledge-base.md`
- `../academy/domains/pundit-storycraft-and-pool-context.md`
- `../academy/domains/pundit-creator-virality-academy.md`
- `../academy/domains/pundit-research-desk.md`
- `pundit-creator-self-training-loop.md`

### Morning

- Read today's and tomorrow's fixtures from FriendlyBet state.
- Scan official and trusted sources for stakes, injuries, lineups, weather, discipline, quotes, and fan/community context.
- Produce a source ledger and story-score table.
- Create or update short-lived `pundit-news.json` items only when the source gate passes.

### Pre-Kickoff

- Recheck match state and kickoff time in Israel.
- Expire previews that are too close to kickoff.
- Prefer one sharp stake: table, qualification, player arc, tactical flaw, weather, or pool consequence.

### Live / Halftime

- Do not claim final outcomes.
- Track only developing stories and mark them as provisional.
- If a live provider and external source disagree, hand off to QA/Sports Integrations.

### Post-Final

- Verify result, winner, table implication, and story asset need.
- Score candidate stories by freshness, verification, FriendlyBet relevance, drama, uniqueness, and clarity.
- Convert the strongest verified angle into Pundit/story/banter/social handoff.

### Evening Retrospective

- List stale items caught or missed.
- List rejected stories and why.
- Count repeated copy shapes.
- For any issue users saw in production, record the cache-busted live URL checked after the fix and whether production changed.
- Update the smallest durable memory only if a new lesson appears.

## Weekly Review

Track:

- stale-current-state incidents
- source-ledger runs completed
- publishable news items found
- rejected rumor/betting/low-quality items
- story assets missing after final results
- local/production data conflicts
- production-visible fixes closed only after live verification
- feedback-loop updates made

## Self-Questions

Before calling a Pundit run done:

- What did I learn today that I did not know yesterday?
- Which source improved my judgment?
- Which source wasted time and should be demoted?
- Which story did I reject even though it was tempting?
- Which handoff would prevent a future mistake?
- What should expire before it lies?
- Did I verify what production serves, or only what local files say?

## Output

Return:

- source ledger path
- chosen story
- rejected stories
- publish/no-publish decision
- validation result
- handoffs
- memory update decision
