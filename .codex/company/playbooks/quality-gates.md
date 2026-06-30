# Playbook: Quality Gates

Use this before the CEO or any department calls significant work done.

## Gates

0pre. Company preflight: every FriendlyBet request was classified before action as direct/simple, owner-led, or meaningful company work. If the request was meaningful, the full planning dialogue ran before the plan existed. If the request was small, the agent avoided fake department theater while still using the relevant owner and verification path.
0char. Collaborator character: the work shows trusted-senior-partner behavior. The agent used human common sense, challenged weak assumptions, owned the outcome perimeter, avoided process theater, and did not make Eyal serve as operator, QA lead, source of truth, or incident commander for routine work.
0. Planning dialogue: for meaningful plans, the CEO ran `full-company-planning-review.md` before the plan existed. Relevant departments co-designed the plan, challenged assumptions, exposed tradeoffs, revised together, resolved or escalated disagreements, and did not require Eyal to manually create the cross-functional conversation. This gate passes only with visible co-design evidence: initial problem frame, department challenges, cross-department debate, revisions forced by departments, second-round recheck where material changes occurred, and Executive synthesis. Reading briefs, assigning one sentence per department, or labeling a completed plan with departments is not enough.
0b. Depth-over-shortcut: for deep analysis, strategy, recovery, or meaningful planning, the agent did not optimize for a smaller short-term answer at the expense of senior reasoning. If speed, context economy, or neatness removed needed debate, state coverage, or validation design, the gate fails.
0c. Failure-survivability: before significant live or user-facing work is accepted, the plan was tested against obvious real failures: source delay/disagreement, penalties, stale DB state, failed runner, slow deploy/CDN, stale public snapshot, partial pool update, optional content failure, and no Eyal-provided rescue.
0a. Ownership perimeter: before work is called done, the owner expanded from the literal request to adjacent user states, downstream systems, release/proof path, department handoffs, and predictable failure modes. Skipped areas must be named as not applicable with a reason.
1. Product fit: the change serves a real user job and preserves FriendlyBet values.
1b. Product-language boundary: user-facing plans must not expose internal engineering or ops states. Internal states such as failed, error, timeout, workflow failure, provider disagreement, or cache mismatch must be translated into user-safe product states and separate ops alerts.
1a. User-state coverage: user-facing product work defines and validates the relevant tournament phase, pool mode, lock/open state, prediction completion state, scoring/publication state, and returning/late/blocked user states. A feature is not done if it only works for one happy-path phase while adjacent phases show stale, misleading, or blocked UI.
2. Technical correctness: implementation follows repo patterns and avoids hidden coupling.
3. Scoring/data correctness: scoring, lock rules, snapshots, migrations, and provider behavior are handled when relevant.
3a. Canonical scoring-source bridge: for any result, match, scoring, or live-data claim, prove the exact bridge from user-visible source to canonical scoring source. For FriendlyBet WC2026 this means official/provider/schedule display data must exist in Supabase `matches` with matching `external_id`, `stage`, teams, status, score, and `winner_code` before scoring is considered covered.
3b. Future fixture coverage: before live match windows, compare official schedule fixtures against Supabase `matches`. Missing known fixtures inside the next 36 hours are blockers. Missing unresolved placeholders for later rounds must be reported with owner and recovery path.
3c. Live-scoring single-point failure review: any result/scoring/leaderboard/match-display plan must identify Plan A/B/C/D for sources, runners, leases/checkpoints, scoring, public publication, cache, autonomous safe-wait/retry, rollback, and canonical DB outage. A plan fails this gate if one workflow, one runner, one source, one scorer path, one public snapshot path, one cache layer, one alert, one human action, or Eyal-provided match truth is required for users to receive correct points.
3c1. Manual-result boundary: normal recovery may repair workflows, providers, leases, secrets, bridges, snapshots, or deploys, but must not require Eyal or an operator to choose a winner or edit DB rows from web reports. Break-glass result repair is an incident path, not product design.
3d. Publication guard: do not mark points updated unless canonical result, scoring run, public snapshot, and production-visible proof all match the same `result_version`. Per-pool incompleteness blocks "updated" only for the affected pools; global success requires every affected pool to be complete.
3e. Deployment-aware proof: public leaderboard proof after generated snapshot commits must allow a bounded Vercel/CDN propagation window before failing. Local snapshot-vs-DB mismatch is a hard blocker; temporary production staleness immediately after a push is retried with cache-busted fetches and only then escalated.
3f. Result-candidate hygiene: final-result recovery candidates must represent missing or unsafe result truth, not stale display metadata on already scoreable terminal rows. Finished scored rows with stale live residue are cleanup/snapshot-sanitization work; tied knockout rows without a verified advancer are still result recovery blockers.
4. Privacy/security: RLS, data minimization, public sharing, and auth/session behavior are safe.
4a. Public/private result boundary: public snapshots must be allowlisted. Private resolver evidence, raw source observations, runner logs, incident notes, break-glass operator evidence, provider errors, secrets, and recovery data must not be exported through `select=*` or public tables.
5. Cost: provider, hosting, GitHub Actions, Supabase, Vercel, and AI/tool costs are acceptable.
5a. Redundancy discipline: backup paths should be cheap wake-up mechanisms for the same controller, not parallel systems that all poll every source. Use DB preflight, source cooldowns, cached observations, and typed warning/critical outcomes to avoid provider spend and alert floods.
6. Design/i18n: mobile, RTL, Hebrew, English, accessibility, and text fit are handled for user-facing changes.
7. QA/release: focused tests or manual checks are run; app-code version bumps are handled when required.
8. Agent excellence: uncertainty, assumptions, risks, and lessons are explicit.
9. Domain mastery: involved agents used the relevant skill, playbook, repo anchors, tests, and external verification rules for their specialty.
10. Production truth: for any bug Eyal can see in the live app, completion requires a cache-busted live URL/public-data check after push/deploy, or an explicit statement that production is still stale.
11. Content uniqueness: current Pundit, banter, story, and share copy must pass a structural duplicate check across the recent visible window, not only a human skim.
12. Control-plane hygiene: repeated GitHub Actions failure emails, Vercel preview comments, or deployment-status emails are release incidents during live tournament operations. Verify open PRs, recent workflow failures, Vercel commit status, and whether `vercel.json` keeps GitHub comments silent before calling the control plane stable.
12a. Alert policy: live-match automation must emit typed outcomes (`green`, `warning`, `critical`) and consolidate repeated warnings into one incident per match window. Content-only or warning-only fallback use must not create critical user-risk alerts.
12b. False-failure policy: too-early production proof, stale cleanup classified as result truth, or known benign propagation delay must be fixed in the workflow/test design. Re-running manually without reducing future false failures is not enough.
13. Artifact sync: generated production artifacts must not live only on the local machine. Before a live window, compare local, `origin/main`, Vercel, and cache-busted production public data; if useful generated data is local-only, either ship and verify it or explicitly document why it is safe to leave out.
14. Critical-path priority: during live scoring or knockout-opening incidents, do not let content/story/news/social defects block verified results, scoring, leaderboard snapshots, app hotfix CI, lock/open state, or production verification. Track those as separate content incidents.
15. Content isolation: any plan or implementation touching results, scoring, locks, leaderboards, or match display must prove optional content fails closed. Missing, stale, slow, invalid, or duplicate Pundit/Stories/banter/share/social content must not block the critical path.
16. End-to-end ownership: do not call a live tournament plan, fix, or recovery "end to end" unless every relevant layer was checked: official schedule/provider, Supabase canonical tables, workflows, scoring scripts, public snapshots, app display, cache/deploy state, and user-facing proof. A narrow local or DB check must be labeled narrow.
17. Chaos rehearsal: before shipping a new live-scoring architecture, run or explicitly schedule a rehearsal covering a penalty-decided knockout, late/incomplete official source, runner failure, lease resume, mid-scoring crash, one stale pool, static snapshot staleness, correction rollback, public/private export leak test, and user-safe degraded state.

## Output

Return:

- Gate status: pass, partial, blocked, or not applicable
- Evidence
- Remaining risk
- Required follow-up
