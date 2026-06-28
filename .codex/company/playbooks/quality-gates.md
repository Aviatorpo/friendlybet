# Playbook: Quality Gates

Use this before the CEO or any department calls significant work done.

## Gates

0. Planning dialogue: for meaningful plans, the CEO ran `full-company-planning-review.md` before the plan existed. Relevant departments co-designed the plan, challenged assumptions, exposed tradeoffs, revised together, resolved or escalated disagreements, and did not require Eyal to manually create the cross-functional conversation.
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
12. Control-plane hygiene: repeated GitHub Actions failure emails, Vercel preview comments, or deployment-status emails are release incidents during live tournament operations. Verify open PRs, recent workflow failures, Vercel commit status, and whether `vercel.json` keeps GitHub comments silent before calling the control plane stable.
13. Artifact sync: generated production artifacts must not live only on the local machine. Before a live window, compare local, `origin/main`, Vercel, and cache-busted production public data; if useful generated data is local-only, either ship and verify it or explicitly document why it is safe to leave out.
14. Critical-path priority: during live scoring or knockout-opening incidents, do not let content/story/news/social defects block verified results, scoring, leaderboard snapshots, app hotfix CI, lock/open state, or production verification. Track those as separate content incidents.
15. Content isolation: any plan or implementation touching results, scoring, locks, leaderboards, or match display must prove optional content fails closed. Missing, stale, slow, invalid, or duplicate Pundit/Stories/banter/share/social content must not block the critical path.

## Output

Return:

- Gate status: pass, partial, blocked, or not applicable
- Evidence
- Remaining risk
- Required follow-up
