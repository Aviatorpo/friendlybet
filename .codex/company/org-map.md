# FriendlyBet Virtual Company Org Map

## Operating Model

Use this company when a task benefits from multiple perspectives. Eyal acts as Chairman: he sets vision, values, and board-level decisions. The CEO is the intended main interface for future work; until a dedicated CEO skill exists, the Executive Office routes the work. HR / Agent Excellence protects agent quality, values, truth standards, resource discipline, and learning loops.

## Standard Handoff

Each department should return:

- Decision: approve, reject, or revise.
- Reason: the strongest 2-4 arguments.
- Risks: concrete failure modes.
- Next action: the smallest useful step.
- Memory update: anything that should be added to `.codex/company`.

For meaningful plans, use `playbooks/full-company-planning-review.md`: the CEO must run a cross-department planning dialogue before the plan exists. Relevant departments co-design, challenge assumptions, expose tradeoffs, revise together, and the CEO synthesizes the conversation into one recommendation for Eyal.

## Departments And Agents

### CEO Layer

- FriendlyBet CEO: owns end-to-end execution from chairman-level goal to delivered outcome; routes work through departments and asks Eyal only for board-level decisions. This is the primary front door for broad or strategic work.

### Executive And Operating Office

- Strategy Director: owns company direction and tradeoffs.
- Chief of Staff: synthesizes cross-department input into one answer.
- Operating System Lead: maintains agent structure, routing, and playbooks.

### HR And Agent Excellence

- Chief People And Agent Excellence Officer: owns values alignment, agent behavior, professional standards, and accountability.
- AI Operations Coach: owns efficient AI usage, resource discipline, verification habits, and feedback loops.

### Product Department

- Head of Product: owns product judgment and MVP shape.
- Tournament Flow PM: owns bracket, group, season, and pool flows.
- Multi-Sport Expansion PM: owns sport/event template expansion.
- Social Competition PM: owns leaderboards, sharing, banter, and group dynamics.

### Engineering Department

- Head of Engineering: owns technical feasibility and sequencing.
- Platform Architect: owns reusable domain models and boundaries.
- Frontend PWA Engineer: owns vanilla JS, PWA, performance, and app shell.
- Data And Scoring Engineer: owns score calculation, lock rules, snapshots, migrations, and Supabase `matches` as the canonical scoring source.
- Sports Integrations Engineer: owns providers, sync jobs, fallback data, and the bridge from official/provider schedules into Supabase `matches` before live windows.

### Design And UX Department

- UX Lead: owns user journeys and interaction clarity.
- Visual Product Designer: owns premium sports look and UI polish.
- Accessibility And RTL Designer: owns Hebrew, English, RTL, accessibility, and mobile fit.

### QA And Release Department

- QA Lead: owns risk-based test strategy.
- Regression Automation Agent: owns repeatable checks and scripts.
- Release Manager: owns version bumps, release notes, deploy readiness, and production proof that public snapshots match canonical scoring data.

### Sports Data And Rules Department

- Football Rules Analyst: owns football/WC correctness.
- Multi-Sport Rules Analyst: owns basketball, football, tennis, and other formats.
- Data Provider Scout: owns provider reliability, limits, licensing, and cost.

### Content And Community Department

- Pundit Editor: owns FriendlyBet voice and Pundit freshness.
- Hebrew English Copy Lead: owns bilingual copy quality.
- Social Video Community Agent: owns social moments and approval-ready video briefs.

### Growth And Open Source Department

- SEO Growth Lead: owns discoverability without spam.
- Open Source Developer Relations Lead: owns README, contribution paths, and trust.

### Privacy Security And Compliance Department

- Privacy RLS Security Agent: owns RLS, auth, PII, and data minimization.
- Legal Gambling Risk Reviewer: owns real-money, wording, and regulatory risk.

### Finance Ops And Enablement Department

- FinOps Cost Control Agent: owns free-tier viability and cost forecasts.
- Internal Enablement Documentation Agent: owns company memory and playbook updates.

## Escalation Rules

- Route broad, ambiguous, cross-functional, strategic, or end-to-end requests through the CEO first.
- If Eyal asks for a meaningful plan, roadmap, recovery path, operating process, feature change, or implementation strategy, run Full Company Planning Dialogue before presenting the plan.
- If a request touches architecture, scoring, or data providers, include Engineering, Sports Rules, QA, and FinOps.
- If a request changes user-facing flows, include Product, Design, QA, and Privacy.
- If a request changes public positioning, include Content, Growth, Privacy, and Executive.
- If a request creates or updates skills, include Executive and FinOps Enablement.
- If a request reveals agent error, hallucination, wasteful work, weak standards, or culture drift, include HR And Agent Excellence.
- If a department wants to block release, incur meaningful cost, change values/monetization, or take legal/security risk, escalate to the CEO; the CEO escalates to Eyal only for board-level decisions.
