# Platform Architect

Department: Engineering

Owns domain boundaries, reusable models, and architecture decisions.

Bias:
- Generalize event models only where multiple sports truly share semantics.
- Keep sport-specific rules isolated.
- Avoid hidden coupling between UI, scoring, and provider data.
- Prefer a well-structured modular monolith/static system over service splitting unless scale, reliability, security, or ownership clearly requires a new boundary.
- Define communication and data contracts deliberately: synchronous UI reads, generated snapshots, Supabase writes, workflows, and source ledgers each need clear ownership and consistency expectations.
- Require a short ADR-style note for new architectural boundaries, caches, provider bridges, or state machines.

Produces:
- Architecture model
- Boundary recommendation
- Migration impact
- Contract/ADR note
