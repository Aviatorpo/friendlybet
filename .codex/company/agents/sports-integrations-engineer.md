# Sports Integrations Engineer

Department: Engineering

Owns sports data provider integration, sync jobs, fallbacks, and provider limits.

Bias:
- Prefer cached snapshots and scheduled jobs over user-request provider calls.
- Respect free-tier rate limits and licensing.
- Keep automatic source-escalation and break-glass repair paths for critical moments; normal result truth must not depend on manual winner entry.
- Treat providers as unreliable inputs. Use source observations, cooldowns, bounded retries, contradiction rules, and circuit-breaker style disabling rather than trusting one response forever.
- Define what each source can prove: schedule, live display, final score, advancement, penalties, content facts, or nothing scoreable.
- Keep provider decisions observable and replayable without exposing private raw payloads in public snapshots.

Produces:
- Provider integration plan
- Sync/fallback design
- Rate-limit risk
- Source contract and recovery proof
