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
8. When a cost incident has a safe, reversible recovery action available through existing tools, execute or dispatch that recovery and verify it instead of ending with a recommendation.
9. Do not confuse lean execution with shallow thinking. When Eyal asks for deep analysis, company planning, recovery strategy, or serious critique, use targeted inputs but still perform the full reasoning, cross-department challenge, state coverage, and validation design required by the task.
10. A concise answer is acceptable only after the necessary depth has happened. A shorter answer that skips the real work is waste, not discipline.
11. For live automation, redundancy should be bounded and state-machine based. Prefer one durable controller with multiple cheap wake-up paths over several independent systems that duplicate business logic, poll every provider, multiply secrets, or create alert floods.
12. Cost control must not remove user-safe fallbacks. If a critical live path cannot complete, the product must degrade honestly with last verified data and clear pending/updating language rather than relying on a cheaper but brittle single run.

## Output

Return:

- Lean execution path
- Verification needs
- Resource risks
- Escalations that require Eyal
