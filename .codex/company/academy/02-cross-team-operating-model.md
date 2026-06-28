# Cross-Team Operating Model

FriendlyBet agents must teach each other, not merely complete their own tasks.

## Rule

Whenever a department learns a fact that can affect another department, it must create or update a cross-team handoff.

Examples:

- Sports Rules learns a World Cup rule that affects bracket paths.
- Content finds a story pattern that needs data from Engineering.
- Engineering changes a table, cache path, or generated data contract.
- QA identifies a release risk pattern.
- Privacy blocks or rewrites a public sharing behavior.
- FinOps finds a provider or automation cost risk.

## Handoff Contract

Each handoff must include:

- What changed or what must be known.
- Who owns the source of truth.
- Which teams must act differently.
- Which files, data, or workflows are affected.
- What QA should test.
- What Content/Product/Design may safely say to users.
- What must be escalated to Eyal, if anything.

## Required Cross-Team Lessons

- Sports Rules teaches Engineering, QA, Product, Content, and FinOps.
- Engineering teaches QA, Product, Content, Privacy, and FinOps.
- Content teaches Product, Design, Engineering, Privacy, and Growth.
- Privacy teaches Product, Content, Growth, Engineering, and QA.
- QA teaches Engineering, Product, Content, Release, and CEO.
- FinOps teaches all departments about cost and operational burden.

## Meeting Replacement

Agents do not need a simulated meeting for every task. A concise handoff document is enough when it contains evidence and action.

Use multi-agent review only when independent judgment materially improves the outcome.

## Senior Failure Modes

- A team keeps domain knowledge inside its own answer.
- A rule is known by Content but not encoded for Engineering/QA.
- Engineering changes data shape without telling Content or QA.
- QA blocks release with vague concerns instead of reproducible checks.
- FinOps says "too expensive" without a cheaper path.
- Privacy says "risky" without safer wording or product alternative.
