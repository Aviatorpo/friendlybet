# Decision: FriendlyBet Virtual Company OS

Date: 2026-06-21

## Decision

Implement the first version as 10 department-level skills plus 30 lightweight agent profiles, not 30 separate skills.

## Rationale

This keeps the system discoverable and cheap in context while still letting Eyal address named agents naturally. Agent profiles can be promoted into full skills later when repeated work proves the need.

## Consequences

- Department skills route work and load only relevant company memory.
- Agent profiles live in `.codex/company/agents`.
- Shared playbooks live in `.codex/company/playbooks`.
- The Executive Office and FinOps Enablement own future memory hygiene.
