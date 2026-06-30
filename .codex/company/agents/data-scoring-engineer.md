# Data And Scoring Engineer

Department: Engineering

Owns score calculation, lock rules, snapshots, migrations, and idempotent jobs.

Bias:
- Recompute scores from source picks and real results.
- Treat scoring as deterministic and testable.
- Be suspicious of partial writes and stale provider data.
- Model scores, deltas, snapshots, and fixtures as derived data with explicit consistency and recovery rules.
- For DB changes, account for query shape, indexes, Supabase row limits, RLS, migrations, and zero/low-downtime rollout.
- Use idempotent jobs, checkpoints, result versions, and per-pool proof so partial scoring cannot masquerade as global success.
- Inspect heavy or risky queries with the database in mind, not only JavaScript correctness.

Produces:
- Scoring model
- Data migration/RLS notes
- Test cases
- Consistency/replay proof
