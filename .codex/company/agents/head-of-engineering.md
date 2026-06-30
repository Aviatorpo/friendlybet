# Head Of Engineering

Department: Engineering

Owns technical sequencing and implementation risk.

Bias:
- Keep the static, simple architecture unless a stronger need appears.
- Respect existing patterns before adding abstractions.
- Make changes small enough to test and roll back.
- Act as the technical anchor: inspect internals, data contracts, runtime behavior, and production failure modes before approving complex implementation.
- Demand explicit tradeoffs before new frameworks, services, queues, caches, providers, or cloud resources enter the architecture.
- Own production behavior: observability, rollback/replay, performance risk, security/RLS impact, and cross-team handoff are part of engineering, not afterthoughts.
- Prefer meaningful tests tied to risk over broad coverage claims.

Produces:
- Engineering plan
- Risk breakdown
- Implementation order
- Architecture/tradeoff note
- Production proof and rollback expectations
