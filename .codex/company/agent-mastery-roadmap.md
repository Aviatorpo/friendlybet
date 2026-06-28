# FriendlyBet Agent Mastery Roadmap

Owner: FriendlyBet CEO  
Quality owner: HR And Agent Excellence  
Documentation owner: FinOps And Enablement  
Created: 2026-06-23

## Objective

Raise every FriendlyBet agent from role-aware to domain-sharp: each agent should know its source material, practice on realistic FriendlyBet cases, validate its work, and leave behind a small reusable artifact when that learning will matter again.

Core academy path: `academy/README.md`.

## Success Criteria

- Each department has a training track tied to real FriendlyBet surfaces.
- Each high-risk department produces at least one validated artifact: checklist, test map, risk rubric, source map, or examples.
- Agents know when to verify external facts instead of relying on memory.
- Training improves future execution without adding paid tools, noisy docs, or process drag.
- No agent asks Eyal for implementation details the company can resolve.

## Batch Plan

### Batch 1: Product Safety And Correctness

Departments: Engineering, QA And Release, Sports Data And Rules, Privacy Security, HR And Agent Excellence.

Why first: these teams protect scoring, locks, RLS, release safety, provider truth, and hallucination resistance.

Artifacts:

- Engineering source map for prediction state, DB writes, scoring, cache/versioning, and rollback points.
- QA regression map for scoring, locking, persistence, provider failure, bilingual copy, and PWA cache.
- Sports rules edge-case sheet for World Cup 2026 groups, third-place mapping, knockout winners, and provider data.
- Privacy/RLS risk rubric for auth, public snapshots, share pages, and gambling wording.
- HR verification rubric for facts, assumptions, risks, and memory updates.

Practice cases:

- A scoring change that touches group picks, knockout picks, and top scorer picks.
- A user-facing copy change in Hebrew and English.
- A provider-data failure during a live match day.
- A public share surface that could leak too much data.

### Batch 2: User Experience And Social Value

Departments: Product, Design And UX, Content And Community, Growth And Open Source.

Why second: once correctness is protected, these teams improve fun, clarity, shareability, public trust, and contributor value.

Artifacts:

- Product MVP and out-of-scope rubric for new sports/features.
- Design mobile/RTL/text-fit checklist for compact controls and dashboards.
- Content/Pundit specificity rubric with Hebrew and English examples.
- Growth trust checklist for SEO, README, self-hosting, and no-tracker discovery.

Practice cases:

- A new prediction flow for a second sport.
- A dashboard improvement for a WhatsApp group pool.
- A Pundit or share-card moment after a surprising match result.
- A public repo/docs update that should attract contributors without spam.

### Batch 3: Company Operating System

Departments: CEO, Executive Office, FinOps And Enablement, all department heads.

Why third: this turns the training into a repeatable operating habit rather than a one-off push.

Artifacts:

- CEO routing checklist for broad requests.
- Chief of Staff synthesis format for conflicting department input.
- FinOps burden/cost rubric for providers, jobs, tooling, and AI usage.
- Agent performance review schedule using `agent-performance-review.md`.

Practice cases:

- A broad chairman request with unclear scope.
- A department disagreement over scope, cost, or risk.
- A repeated agent mistake requiring a memory update.
- A proposed paid/provider/tooling addition.

## Department Minimum Bar

Every trained department must be able to answer:

- What source files, docs, skills, and playbooks define this domain?
- What user or company value does this domain protect?
- What are the top five failure modes?
- What must be verified externally, and from which kind of source?
- What tests, checks, screenshots, or manual review prove acceptable quality?
- What should be escalated to Eyal, and what should be resolved by the company?

## Review Cadence

- Run Batch 1 before high-risk app/scoring/release work.
- Run Batch 2 before major UX, content, social, growth, or multi-sport work.
- Run Batch 3 after several broad company tasks or whenever routing/agent behavior feels weak.
- After each batch, update only durable lessons in `.codex/company`; avoid duplicating role descriptions.

## CEO Reporting Format

- Decision:
- Departments trained:
- Artifacts created:
- Validation performed:
- Gaps remaining:
- Next batch:
- Needs Eyal:
