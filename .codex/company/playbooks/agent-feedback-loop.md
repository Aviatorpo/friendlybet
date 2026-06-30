# Playbook: Agent Feedback Loop

Use this after an agent mistake, hallucination, missed requirement, wasteful process, risky action, or repeated misunderstanding.

## Steps

1. State what happened without blame.
2. Identify the root cause: missing memory, weak skill instruction, stale assumption, poor routing, insufficient verification, or resource misuse.
3. Decide whether the fix belongs in a skill, agent profile, playbook, charter, org map, or decision log.
4. Make the smallest durable update.
5. Validate the changed skill or instructions when applicable.
6. Record a decision log only for lessons likely to matter later.

## Chairman Frustration Trigger

If Eyal expresses anger, frustration, disappointment, loss of trust, or explicitly says he is angry or upset, presume he wants a correction loop.

The agent must:

1. Stop normal forward motion unless there is an urgent live-user incident that would worsen by pausing.
2. Acknowledge the signal and apologize plainly without defending tone or minimizing the issue.
3. Inspect the agent's own recent actions, claims, skipped checks, routing, validation, and memory usage.
4. Classify the failure using this playbook, or create the smallest precise incident class if none fits.
5. Correct the immediate issue or execute the next safe recovery action.
6. Update the smallest durable instruction, skill, playbook, test, release gate, or decision log when the lesson is reusable.
7. Validate the fix or state exactly what remains unproven and who owns it.

Do not answer only the surface question when the emotional signal is about agent reliability. Do not offer generic reassurance. The output should include: apology, incident, root cause, immediate correction, process correction, validation, and remaining risk.

## Planning Co-Design Incidents

If an agent claims a plan was built with the company, but the work only read department briefs, simulated perspectives, or added department labels after drafting, classify it as a planning-process and truthfulness incident.

The durable fix must require evidence that departments changed the plan before it was presented: initial problem frame, department challenges, revisions, second-round rechecks for affected departments, and Executive synthesis. The agent must redo the plan using `full-company-planning-review.md` before presenting a final recommendation.

If a plan includes a user-facing decision that a real Product or Design review should have rejected, such as leaking internal operational states (`failed`, `error`, `timeout`, workflow names, provider names, or debugging language) into the user experience, classify it as both a planning-process incident and a product/design judgment incident. The correction must explicitly separate internal ops states from user-facing states, rerun Product and Design as active challengers, and update the plan before continuing.

If the "company dialogue" is just one short statement per department without departments challenging each other, classify it as a label-only planning incident. The agent must redo the dialogue with cross-department objections, revisions forced by those objections, and second-round rechecks.

If the root cause is that the agent optimized for a fast, compact, or convenient answer while the user asked for deep planning or serious analysis, classify it as a short-term optimization incident. The correction must update the relevant charter, playbook, quality gate, or skill so resource discipline cannot be misread as permission to skip depth.

## Collaborator Character Incident Rule

If Eyal has to repeatedly explain obvious reasoning, ask for basic owner behavior, or push the agent away from brittle machine logic toward human common sense, classify it as a collaborator-character failure.

This includes:

- Passive task-taking: the agent waits for exact instructions instead of owning the outcome.
- Obvious-miss repetition: Eyal catches a basic failure mode after the agent claimed to have thought deeply.
- Brittle-machine reasoning: the agent over-trusts internal labels, fields, workflow names, or status strings instead of checking the real user/product truth.
- Process theater: the agent performs department labels or apologetic wording without changing the plan or behavior.
- Operator transfer: the agent quietly makes Eyal the source validator, QA lead, incident commander, or routine manual fallback.

The durable fix must add or tighten a character, routing, quality-gate, skill, or playbook instruction that would make a future agent act like a trusted senior partner before Eyal has to correct it.

## Production-Visible Incident Rule

If Eyal reports that the live app still shows a bug after an agent claimed it was fixed:

- Classify the incident as a verification failure before looking for a new technical explanation.
- Compare local files, committed Git state, deployed production artifacts, and browser/service-worker/CDN cache behavior as separate layers.
- Do not reassure. State which layer is proven, which layer is not, and what exact live check will close the loop.
- The durable fix must include either a release gate, a live verification command, or a skill/playbook update that blocks local-only completion claims.
- Do not stop at "blocked" while an executable recovery path remains. The agent owns the next safe action: trigger the workflow, monitor it, patch the workflow, or state the exact missing credential/permission after trying the available route.

## State-Blind Product Incident Rule

If Eyal reports that the app behaves correctly in one tournament/user state but breaks, misleads, or blocks users in an adjacent state, classify it as state blindness.

Examples include: before knockout vs after knockout opens, after R32 completes vs before R16 picks, submitted vs partial picks, single-phase vs two-phase pools, stale public snapshot vs fresh DB state, or locked vs reopened entry.

The durable fix must include a user-state matrix in the relevant product/playbook/skill guidance and either an automated fixture or named manual/live verification for each state that changes what users can see, pick, edit, score, or share.

## Small-Head Ownership Incident Rule

If an agent completes the narrow literal task while ignoring predictable adjacent impact, classify it as a small-head ownership incident.

This includes failing to check obvious user states, downstream data/snapshot/deploy layers, bilingual copy, release/version requirements, privacy/cost/legal implications, or the department owner who should have been involved.

The durable fix must add an ownership-perimeter check to the relevant skill, playbook, test, or release gate. The agent must state what it owned directly, what it delegated or routed, what remains unproven, and why any skipped adjacent area was truly not applicable.

## False End-To-End Verification Incident Rule

If an agent verifies one narrow layer and presents the result as end-to-end ownership, classify it as false end-to-end verification.

For live scoring and fixture work, this includes verifying any one of these without the others: official schedule/provider result, Supabase `matches`, live poller/verifier candidacy, scoring run, leaderboard/public snapshots, app display, deployment/cache state, or production proof.

The durable fix must add a source-bridge proof and a layer checklist. The agent must state exactly which layers are proven, which are unproven, and which owner is responsible for every unproven layer. Generic "more QA" language is not an acceptable corrective action.

## Live Result Reliability Incident Rule

If Eyal has to supply a match result, advancing team, or penalty outcome manually, classify it as a live-result autonomy failure. The correction must repair the automatic source-verification path, not normalize manual winner entry.

Also classify and correct:

- Single-control-plane failure: one GitHub Action, runner, deploy, cache, or public snapshot is required for users to get points.
- Fragile-field failure: raw `winner_code`, provider `winner`, status string, or score comparison is trusted without rule/source validation.
- Scenario-baseline failure: future total scores are precomputed across unresolved earlier matches instead of deltas or baseline-fingerprinted snapshots.
- False-alert failure: a workflow fails because of expected deploy/CDN propagation, warning-only content debt, or cleanup metadata misclassified as result truth.

The durable fix must update the relevant skill/playbook/test/workflow, rerun the current production path when possible, and report live proof or the exact remaining blocker.

## Pundit / Live Content Incidents

For stale, dry, wrong, or weak live sports content, also classify:

- Source failure: the right official/trusted source was not checked.
- Cadence failure: the agent missed morning, kickoff, post-final, or evening timing.
- Data failure: FriendlyBet local state, production state, workflow state, or provider state was misunderstood.
- Story judgment failure: the agent chose a low-drama or low-relevance angle.
- Copy failure: the fact was correct but generic, repetitive, or not native in Hebrew/English.
- Emotional finish failure: the copy became accurate and natural but lost the lightweight emoji/visual spark expected from shareable Stories.
- Handoff failure: Engineering, QA, Privacy, Product, or Sports Integrations should have been involved.
- Verification failure: the agent validated local/generated artifacts but did not verify what production was serving.

The durable fix must be one of: source ledger requirement, story-scoring rule, validation command, playbook update, skill update, workflow/code fix, or certification drill. For Story copy incidents, encode both sides of the lesson: avoid forced clever metaphors, but preserve a simple emotional finish such as one fitting emoji when the format expects it.

## Output

Return:

- Incident
- Root cause
- Lesson
- Updated file or proposed update
- Validation performed
