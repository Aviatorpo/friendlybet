# Decision: Live Scoring Transition Command Brief

Date: 2026-06-24
Owner: FriendlyBet CEO
Chairman goal: Carry FriendlyBet through the first real World Cup group-completion and official-scoring transition with accurate results, accurate scoring, phase-correct UX, and no production/local/GitHub drift.

## Operating Prompt

Operate FriendlyBet today as a live production event, not a routine coding task. The mission is to make the user's experience smooth and truthful as the app moves from pre-scoring prediction mode into real leaderboard scoring.

Required outcomes:

- Final results arrive on time and are accurate.
- Score calculations run on time and are accurate for real users.
- Theoretical leaderboards disappear once official group scoring exists.
- Third-place advancement points are not presented as known until all 12 groups can determine the best third-place teams.
- Dashboard, leaderboard, Pundit, stories, banter, share surfaces, and social/video output use wording that matches the exact tournament state.
- Production, GitHub, local files, generated data, story assets, and workflow outputs stay synchronized.
- GitHub Actions and Vercel must not create avoidable failure/comment email storms. Repeated failed runs, stale conflicted PRs, and preview-comment loops are live-ops incidents.
- Every agent documents what was checked, what changed, what is still risky, and what lesson should become reusable company memory.

## Live Window

- First critical checkpoint: Group B final matches, 2026-06-24 22:00 Israel time.
- Next checkpoints: Group C final matches, 2026-06-25 01:00 Israel time; Group A final matches, 2026-06-25 04:00 Israel time.
- A group is complete only after exactly six unique scoreable terminal fixtures.
- Official group-position scoring can start for completed groups before the full group stage is complete.
- Best-third-place scoring waits until all 12 groups are complete.

## Department Responsibilities

CEO:
- Own end-to-end truth, priorities, and updates to Eyal.
- Ask Eyal only for values, legal, reputation, cost, irreversible, or taste decisions.
- Separate local proof, pushed proof, deployed proof, and live production proof.

Product:
- Define the exact user state before kickoff, live, pending verification, group complete, partial official scoring, and full group-stage complete.
- Ensure the dashboard explains what is known, what is newly scored, and what is still pending.
- Remove or hide theoretical leaderboard surfaces once official scoring exists.

Engineering:
- Verify result ingestion, verifier/export workflows, score calculation, leaderboard snapshots, public-data exports, PWA cache behavior, and fallback paths.
- Confirm group completion logic requires terminal verified fixtures, not live scores or provider-pending rows.
- Confirm knockout and future scoring rules rely on `matches.winner_code` where needed.

Sports Rules:
- Validate standings, group completion, top-two advancement, third-place waiting logic, and FIFA Annex C allocation rules.
- Provide exact language for partial group scoring versus pending best-third-place scoring.

QA And Release:
- Run scoring, live-ops, readiness, UX-state, Pundit, story, and snapshot tests before claiming readiness.
- Treat stale workflows, missing stories, stale Pundit, or production mismatch as incidents.
- Verify production-facing artifacts with cache-busted public URLs when network/tool budget allows.
- Treat more than one repeated failure email from the same workflow family as a structural failure to diagnose, not as noise to ignore.

Design And UX:
- Check that the dashboard, leaderboard, score labels, empty states, and explanatory copy are calm and clear on mobile.
- Ensure users do not see contradictory states such as a theoretical leaderboard beside official scored points.
- Preserve Hebrew RTL quality and English clarity.

Content And Community:
- Keep Pundit and story copy specific to the real match/table/pool state.
- Do not publish generic, repeated, stale, or post-kickoff preview copy.
- Use source-backed short-lived `pundit-news.json` items when available; if none pass the source gate, record what was checked and why nothing passed.

Social Video:
- Do not publish or recommend a video unless thumbnail, hook, pacing, and match relevance pass the current social-content standard.
- Verify the actual production/social repo and generated files, not just local scratch assets.

Privacy, Security, Legal:
- Preserve the no-money, no-odds, no-gambling-promotion stance in every message.
- Do not expose private user data in stories, public snapshots, diagnostics, or updates.

Growth And Open Source:
- Keep public-facing trust aligned with the real product state.
- Do not create hype that implies monetary betting, official affiliation, or unsupported live guarantees.

FinOps And Enablement:
- Conserve Codex credits and network calls.
- Prefer existing scripts, targeted checks, and high-signal verification over broad scanning.
- Update playbooks or skills only for reusable lessons.
- Keep notification volume humane: scheduled automations should self-heal, skip cleanly, or fail once with a precise cause instead of repeatedly emailing Eyal.

HR And Agent Excellence:
- Hold every agent to senior-professional standards: verify, document, communicate uncertainty, and learn from misses.
- If an agent repeats a known mistake, update the training loop and relevant skill.

## Required Proof Gates

Before calling the system ready, collect current evidence from:

- `node scripts/test-scoring.js`
- `node scripts/test-live-ops-audit.js`
- `node scripts/test-live-completion-readiness.js`
- `node scripts/test-live-ux-state.js`
- `node scripts/live-ops-audit.js`
- Latest live poller, final result verifier, scoring/export, and readiness monitor workflows.
- Public `matches.json`, `pundit.json`, `world-cup-stories.json`, story assets, and generated leaderboard snapshots.

## User Messaging Rules

Use phase-accurate wording:

- Before verified finals: "No official points from this group yet."
- After one group completes and scoring runs: "Official points have started for completed groups."
- For third-place advancement: "Best third-place points are pending until all groups finish."
- For stale or pending verification: "We are waiting for verified final results before updating points."
- Never say points were awarded, stories are live, or production is fixed unless the relevant live artifact proves it.

## Open Risks To Watch Today

- Workflow push conflicts can block generated snapshot updates if hardening is missing or regresses. PR #9 merged on 2026-06-24 to regenerate generated snapshots on top of current `main` before retrying pushes.
- Empty `pundit-news.json` is a content-quality warning during match days unless the source desk records its checks.
- Visual/browser proof may be unavailable if Playwright is not installed; state that limitation instead of implying visual QA passed.
- Local story/content files can drift from production or from a separate marketing/social repo.
- Open conflicted PRs with Vercel preview comments can create misleading noise even when preview deployment is green. Close stale duplicate PRs after proving the content already landed on `main`.

## Closeout Requirement

Do not close this mission until the first completed group has verified finals, real user scoring has run, theoretical leaderboard surfaces are gone for scored users, Pundit/stories/dashboard copy matches the partial-scoring state, and production evidence is documented.
