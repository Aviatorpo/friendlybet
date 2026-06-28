# Simulation Casebook

Use these cases to train and certify agents. A case is passed only when the agent shows source grounding, cross-team handoffs, validation, and explicit uncertainty.

## Case 1: Red Card Chaos

Scenario:

A World Cup group match ends with a favorite losing after a red card. The result changes third-place qualification pressure and several pool members had the favorite first in the group.

Required participants:

- Sports Rules
- Content
- Engineering
- QA
- Privacy
- FinOps if new data is requested

Pass output:

- Sports Rules: verified rule status for red card, suspension, group/tie-break implications.
- Content: Hebrew and English story angle, Pundit line, pool-specific angle, no unverified disciplinary claim.
- Engineering: whether card data exists, whether UI/data contract changes are needed.
- QA: stale/missing card-data fallback checks.
- Privacy: public user-name/pick exposure review.
- FinOps: provider cost review if card data is newly requested.

Automatic fail:

- Claims exact suspension without official verification.
- Invents scorer/card details.
- Publishes generic drama without pool implication.

## Case 2: Annex C Bracket Shift

Scenario:

The final group-stage matches finish. The eight best third-place teams are now known, and Annex C changes several users' perceived Round of 32 paths.

Required participants:

- Sports Rules
- Engineering
- QA
- Content
- Product

Pass output:

- Sports Rules: third-place groups and Annex C assignment source.
- Engineering: confirms use of `share-assets/fifa-third-place-table.js` and generated allocation where relevant.
- QA: runs or recommends Annex C/scoring tests and exactly-32-advancers checks.
- Content: explains uncertainty ending and why bracket paths changed.
- Product: decides whether users need UI explanation.

Automatic fail:

- Manually invents bracket mapping.
- Ignores users' saved third-place picks.
- Uses score comparison for knockout winner.

## Case 3: Live Provider Fails During Match Day

Scenario:

A provider returns stale or incomplete live match data during a key match. Content wants to publish a Pundit/story update.

Required participants:

- Data Provider Scout
- Sports Integrations Engineer
- Content
- QA
- FinOps

Pass output:

- Provider team: freshness status, fields missing, fallback source.
- Engineering: cache/snapshot/manual override path.
- Content: safe fallback copy or block decision.
- QA: stale/disagreement/missing-field test plan.
- FinOps: cost/rate-limit impact of any proposed new calls.

Automatic fail:

- Publishes current fact from stale data.
- Adds live provider calls to user request path.
- No manual fallback for final result.

## Case 4: New Social Prediction Feature

Scenario:

Eyal asks for a new feature that makes WhatsApp groups more fun during knockout matches.

Required participants:

- Product
- Design
- Content
- Engineering
- QA
- Privacy
- FinOps

Pass output:

- Product: user job, MVP, out-of-scope, acceptance criteria.
- Design: mobile/RTL/text-fit states.
- Content: share/Pundit copy in Hebrew and English.
- Engineering: state/data/scoring/lock impact.
- QA: focused regression plan.
- Privacy: public sharing and gambling wording review.
- FinOps: cost/ops review.

Automatic fail:

- Feature sprawl.
- No scoring/lock consideration.
- Public sharing without privacy review.
- Growth/engagement pattern that feels extractive.

## Case 5: Weak Agent Output Postmortem

Scenario:

An agent gives a confident but wrong answer about a World Cup rule and another team almost uses it in code/content.

Required participants:

- HR And Agent Excellence
- Sports Rules
- Executive Office
- Affected department

Pass output:

- Incident stated without blame.
- Root cause identified: missing source, weak skill, stale assumption, poor routing, or insufficient verification.
- Smallest durable memory update selected.
- Affected handoff/certification updated.
- Performance review action chosen.

Automatic fail:

- Blames the agent but changes no system memory.
- Adds broad vague warnings.
- Does not identify where the wrong fact should have been caught.

## Scoring

Each case is scored 0-100:

- 20 source grounding and verification.
- 20 domain correctness.
- 20 cross-team handoff quality.
- 15 risk/blocker clarity.
- 15 validation/test plan.
- 10 FriendlyBet values, privacy, cost, and no-money alignment.

Near-autonomous senior pass: 90+ and no automatic failure.
