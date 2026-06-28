# Playbook: Agent Domain Mastery Training

Use this when Eyal asks to raise agent quality, deepen department expertise, create training loops, or review whether agents know their domain well enough.

## Goal

Each agent should become sharper in its own domain while staying aligned with FriendlyBet's values: free forever, open source, ad-free, tracker-free, privacy-first, no real-money gambling, lean operations, bilingual polish, and honest execution.

Training must improve future work, not create ceremonial documents.

## Mastery Loop

1. Start with the academy: `../academy/README.md`, company induction, app deep dive, relevant domain file, relevant handoff, and relevant certification rubric.
2. Map the agent's job: owned decisions, common failure modes, required repo anchors, external facts that must be verified, and outputs it should produce.
3. Study the current source of truth: relevant skill, agent profile, playbooks, repo docs, tests, scripts, public product behavior, and official external references when needed.
4. Practice on realistic FriendlyBet cases: one narrow product case, one risk case, one failure/debug case, and one release/QA case where relevant.
5. Produce an artifact: checklist, examples, test command list, source map, copy rubric, provider rubric, scoring edge cases, or release gate.
6. Validate the artifact: apply it to a real repo area or recent task; record what it caught, missed, or clarified.
7. Update memory only when reusable: improve academy docs, a playbook, skill, agent profile, decision log, or code comments sparingly.
8. Review performance: reinforce, correct, promote, merge, or retire guidance using `agent-performance-review.md`.

## Department Training Tracks

### CEO And Executive

- Chairman protocol, decision rights, routing, conflict resolution, board reporting, and when not to bother Eyal.
- Practice: turn broad goals into scoped execution with departments, risks, validation, and no unnecessary escalation.

### HR And Agent Excellence

- Truthfulness, anti-hallucination behavior, uncertainty reporting, resource discipline, and feedback loops.
- Practice: convert a weak answer or agent mistake into the smallest durable memory update.

### Product

- Pool creation, prediction flows, social competition, event templates, MVP boundaries, and group-chat user jobs.
- Practice: define a feature's user value, out-of-scope list, lock/scoring implications, and acceptance criteria.

### Engineering

- Static PWA architecture, vanilla JS patterns, Supabase/RLS, scoring scripts, service worker cache, migrations, and data snapshots.
- Practice: trace a change from UI state through DB writes, scoring, cache/versioning, and tests.

### Design And UX

- Mobile-first Hebrew/English UX, RTL behavior, accessibility, text fit, visual hierarchy, and premium sports restraint.
- Practice: review a screen for task clarity, compact controls, language fit, and layout failure on mobile.

### QA And Release

- Risk-based testing, regression scripts, scoring/locking correctness, dirty-worktree safety, version bump discipline, and deploy readiness.
- Practice: turn a proposed change into focused automated checks plus a manual release checklist.

### Sports Data And Rules

- Official competition formats, FIFA/football rules, sport-specific prediction types, provider limits, licensing, freshness, and fallback paths.
- Practice: model one event format with participants, locks, scoring, provider data, and edge cases.

### Content And Community

- FriendlyBet voice, Pundit specificity, bilingual copy, public wording risk, share-card moments, and approval-ready social briefs.
- Practice: write Hebrew and English variants that are specific, fun, non-misleading, and non-gambling-risky.
- For Pundit/story agents, use `pundit-live-desk.md`, `pundit-continuous-learning-loop.md`, and `../academy/domains/pundit-research-desk.md`: practice broad web scanning, source ledgers, story scoring, stale-feed incidents, kickoff transitions, post-match story choices, source-gated news, pool-specific angles, and self-feedback after misses.

### Growth And Open Source

- Ethical SEO, README trust, contributor onboarding, self-hosting story, no trackers, no spam, and public proof of value.
- Practice: propose discovery work that helps real users or contributors without dark patterns.

### Privacy Security And Compliance

- Recovery-code auth, RLS, public snapshots, data minimization, legal/gambling wording, and no money-handling boundaries.
- Practice: classify a feature by privacy/legal risk and define safer product or copy alternatives.

### FinOps And Enablement

- Free-tier viability, GitHub Actions/Supabase/Vercel usage, provider/API costs, documentation hygiene, and skill validation.
- Practice: estimate operational burden and replace an expensive process with a lean local/static workflow.

## Evidence Standard

A trained agent should be able to show:

- Sources used: repo files, skills, playbooks, tests, or official external references.
- Case practice: at least one realistic FriendlyBet scenario.
- Validation: command run, file inspected, UI reviewed, or reasoning checked against source material.
- Memory update: either a concrete change or a decision that no durable update is needed.
- Open risks: what remains uncertain and when verification is required.

## Resource Discipline

- Prefer local repo docs, `rg`, existing tests, and current skills before broad browsing or subagents.
- Browse only for current, external, legal, pricing, provider, SEO, sports, or official-rule claims.
- Do not propose paid tools, long-running services, or broad automation unless the CEO approves and Eyal approves meaningful recurring cost.
- Keep artifacts short enough that future agents will actually read them.

## CEO Review Output

Return:

- Training objective
- Departments covered
- Artifacts created or updated
- Validation performed
- Quality gaps remaining
- Next training batch
- Needs Eyal, if any
