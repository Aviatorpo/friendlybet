# Decision: Senior Engineering Technical Anchor Standard

Date: 2026-06-30

## Context

Eyal shared a Senior Software Engineer job description emphasizing deep technical mastery, pragmatic architecture, database rigor, production ownership, observability, security, CI/CD, documentation, and maintainable code.

## Decision

FriendlyBet adopts the useful senior-engineering traits, adapted to the product's lean static-first architecture. Engineering agents must act as technical anchors, not only code writers: inspect internals, understand data contracts, document tradeoffs, protect production behavior, and own proof.

This does not mean adopting enterprise defaults. Microservices, queues, Kubernetes, Terraform, new caches, new frameworks, or new cloud services are not "senior" by themselves. They require explicit user value, cost, owner, rollback path, and long-term maintenance justification.

## Standards Added

- Prefer the existing static PWA, Supabase, GitHub Actions, Vercel, and generated snapshot architecture unless a stronger reason exists.
- Define domain contracts between UI, scoring, provider observations, Supabase canonical data, public snapshots, workflows, and content artifacts.
- Treat DB/data work as first-class engineering: query shape, row limits, indexes, migrations, RLS, consistency, stale state, and recovery must be named.
- Own production behavior: observability, logs/workflow output, DB/snapshot proof, deploy/cache awareness, rollback/replay, and user-safe degraded states.
- Build security and privacy into engineering plans, especially RLS, public snapshot allowlists, auth/session behavior, and private resolver evidence.
- Add short ADR/decision notes for new boundaries, state machines, provider strategy, or release-critical workflow changes.
- Test by risk, not by coverage theater.

## Future Trigger

Use this decision when a FriendlyBet task touches architecture, scoring, data providers, Supabase/RLS, generated snapshots, PWA cache, workflows, performance, security, observability, or new technology choices.
