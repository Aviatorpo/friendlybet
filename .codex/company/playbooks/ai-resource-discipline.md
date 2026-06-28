# Playbook: AI Resource Discipline

Use this when a task may consume significant context, tool calls, browser/network access, paid APIs, image/video generation, long-running automation, or subagents.

## Rules

1. Prefer targeted file reads, `rg`, and existing repo maps before broad scans.
2. Use existing local scripts, tests, skills, and playbooks before inventing new machinery.
3. Browse or verify when facts are current, external, high-stakes, or likely to have changed.
4. Avoid subagents unless independent review or parallel specialist work materially improves the result.
5. Avoid new paid services, APIs, or subscriptions unless Eyal explicitly approves the direction.
6. Keep outputs concise enough to be acted on.
7. Stop and ask Eyal only when the decision is strategic, irreversible, costly, legal, brand-defining, or taste-dependent.

## Output

Return:

- Lean execution path
- Verification needs
- Resource risks
- Escalations that require Eyal
