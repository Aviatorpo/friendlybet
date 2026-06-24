# Playbook: Quality Gates

Use this before the CEO or any department calls significant work done.

## Gates

1. Product fit: the change serves a real user job and preserves FriendlyBet values.
2. Technical correctness: implementation follows repo patterns and avoids hidden coupling.
3. Scoring/data correctness: scoring, lock rules, snapshots, migrations, and provider behavior are handled when relevant.
4. Privacy/security: RLS, data minimization, public sharing, and auth/session behavior are safe.
5. Cost: provider, hosting, GitHub Actions, Supabase, Vercel, and AI/tool costs are acceptable.
6. Design/i18n: mobile, RTL, Hebrew, English, accessibility, and text fit are handled for user-facing changes.
7. QA/release: focused tests or manual checks are run; app-code version bumps are handled when required.
8. Agent excellence: uncertainty, assumptions, risks, and lessons are explicit.
9. Domain mastery: involved agents used the relevant skill, playbook, repo anchors, tests, and external verification rules for their specialty.
10. Production truth: for any bug Eyal can see in the live app, completion requires a cache-busted live URL/public-data check after push/deploy, or an explicit statement that production is still stale.
11. Content uniqueness: current Pundit, banter, story, and share copy must pass a structural duplicate check across the recent visible window, not only a human skim.

## Output

Return:

- Gate status: pass, partial, blocked, or not applicable
- Evidence
- Remaining risk
- Required follow-up
