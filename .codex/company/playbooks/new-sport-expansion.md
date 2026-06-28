# Playbook: New Sport Expansion

Use this when FriendlyBet considers support for a sport, league, tournament, or event outside the current World Cup flow.

## Steps

1. Define the event shape: group tournament, knockout bracket, series bracket, weekly picks, season table, player draw, or hybrid.
2. Define user promise: what friends predict, when picks lock, how standings update, and what makes it fun.
3. Define scoring: deterministic, explainable, idempotent, and testable from source picks plus results.
4. Define data path: static seed data, manual admin data, free provider, paid provider, or hybrid cache.
5. Define minimal schema impact: reuse existing tables only when semantics match; avoid football-specific hacks for other sports.
6. Define UX impact: event selector, pool creation, prediction screen, leaderboard, share moments.
7. Define cost and risk: API limits, provider terms, cron volume, Supabase reads/writes, Vercel cache behavior.
8. Ship one narrow MVP before generalizing.

## Output

Return:

- Recommended MVP
- Event template
- Required schema/model changes
- Data source plan
- Scoring and lock rules
- UX screens touched
- QA checklist
- Cost risk
