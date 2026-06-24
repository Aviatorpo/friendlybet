# Playbook: Agent Feedback Loop

Use this after an agent mistake, hallucination, missed requirement, wasteful process, risky action, or repeated misunderstanding.

## Steps

1. State what happened without blame.
2. Identify the root cause: missing memory, weak skill instruction, stale assumption, poor routing, insufficient verification, or resource misuse.
3. Decide whether the fix belongs in a skill, agent profile, playbook, charter, org map, or decision log.
4. Make the smallest durable update.
5. Validate the changed skill or instructions when applicable.
6. Record a decision log only for lessons likely to matter later.

## Production-Visible Incident Rule

If Eyal reports that the live app still shows a bug after an agent claimed it was fixed:

- Classify the incident as a verification failure before looking for a new technical explanation.
- Compare local files, committed Git state, deployed production artifacts, and browser/service-worker/CDN cache behavior as separate layers.
- Do not reassure. State which layer is proven, which layer is not, and what exact live check will close the loop.
- The durable fix must include either a release gate, a live verification command, or a skill/playbook update that blocks local-only completion claims.

## Pundit / Live Content Incidents

For stale, dry, wrong, or weak live sports content, also classify:

- Source failure: the right official/trusted source was not checked.
- Cadence failure: the agent missed morning, kickoff, post-final, or evening timing.
- Data failure: FriendlyBet local state, production state, workflow state, or provider state was misunderstood.
- Story judgment failure: the agent chose a low-drama or low-relevance angle.
- Copy failure: the fact was correct but generic, repetitive, or not native in Hebrew/English.
- Handoff failure: Engineering, QA, Privacy, Product, or Sports Integrations should have been involved.
- Verification failure: the agent validated local/generated artifacts but did not verify what production was serving.

The durable fix must be one of: source ledger requirement, story-scoring rule, validation command, playbook update, skill update, workflow/code fix, or certification drill.

## Output

Return:

- Incident
- Root cause
- Lesson
- Updated file or proposed update
- Validation performed
