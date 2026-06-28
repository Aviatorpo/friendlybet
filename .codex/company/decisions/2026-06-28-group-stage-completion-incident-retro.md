# Decision: Group-Stage Completion Incident Retro

Date: 2026-06-28
Owner: FriendlyBet CEO
Incident type: live tournament transition, scoring publication, knockout-opening access, control-plane noise

## What Happened

At the end of the World Cup group stage, users expected completed-group and full-group-stage points to appear quickly and two-phase/late-knockout users expected immediate access to knockout picks. Instead, Eyal woke up to many GitHub failure emails, points were delayed or not visibly published for users, and Eyal had to manually supply match results and repeatedly force a shorter recovery path.

Observed evidence from GitHub Actions:

- `Calculate User Scores (v2)` run `28292758804` on 2026-06-27 scored 2110 pools and 66 finished matches, then failed snapshot verification with 41 pool/user mismatches.
- `Live Match Poller` run `28308057197` on 2026-06-28 scored 2123 pools and 70 finished matches and verified snapshots, but failed later on content watchdog errors: empty Pundit news and missing World Cup stories.
- `Live Completion Readiness Monitor` run `28308151440` failed while results were mostly healthy because the public/live audits still had story/Pundit errors and `completeGroups=11/12`.
- The `fix: open two-phase knockout entry` CI run `28311996735` failed on `live-ops-audit` because all 12 groups were complete but six story assets were missing. That blocked or delayed the app fix users needed.
- Recovery evidence: `Calculate User Scores (v2)` run `28314099342` on 2026-06-28 scored 2138 pools and 72 finished matches, exported 359 leaderboard files, verified 2134 pools with `errorCount=0`, and pushed to `main`.

## Root Cause

This was not one bug. It was a priority and ownership failure:

- Critical path was not separated from content path. Missing story assets and empty editorial news were allowed to fail workflows that users experienced as scoring or knockout-access failure.
- Verification gates were correct in spirit but too blunt for a live transition. They alerted loudly, but they did not preserve the minimum user promise: verified results, points, leaderboard snapshots, and knockout entry first.
- The company did not switch fast enough from "make every surrounding surface perfect" to "restore the blocked user journey now, then repair content."
- Control-plane hygiene failed. Repeated scheduled failures became an email storm instead of one owned incident with a clear current status and next recovery action.
- Eyal was pulled into operational data entry and process control that the virtual company should have owned.

## Department Accountability

CEO:
- Owns the miss. The CEO should have enforced critical-path priority, stopped content loops earlier, and reported only proven layers: DB scored, snapshots exported, production live, or still blocked.

Product:
- Should have defined the transition promise from the user view: when groups complete, two-phase/late-knockout pools must be able to act quickly, even if content is degraded.

Engineering:
- Should have isolated result/scoring/snapshot/knockout workflows from non-critical content gates and kept a fast manual/recovery path ready for group-stage completion.

Sports Rules:
- Should have kept the decision boundary simple: scoring and bracket readiness depend on verified terminal fixtures and official advancement, not on Story/Pundit readiness.

QA And Release:
- Should have blocked unverified scoring, but not blocked app hotfixes or scoring publication because story assets were missing. QA should have required live evidence and a separate content incident.

Content And Community:
- Should have treated missing Stories/Pundit news as a content incident, not a reason to hold the scoring or knockout path. The desk still owes fast repair after the user path is restored.

Design And UX:
- Should have pushed for clear degraded states: "points are updating", "knockout picks are open", and content gaps handled quietly without confusing users.

FinOps And Enablement:
- Should have classified repeated failure emails as operational cost/noise and forced a single owner plus alert deduplication or demotion for non-critical gates.

HR And Agent Excellence:
- Classifies this as an ownership and prioritization incident. The durable lesson is not "try harder"; it is to change skill/playbook instructions so agents cannot spend long loops on non-critical work while users are blocked.

## New Operating Rule

During live tournament phase transitions, the critical path is:

1. Verified final results.
2. Correct scoring calculation.
3. Leaderboard/public snapshot publication.
4. Pool lock/open state and knockout-entry availability.
5. Live production verification.
6. Pundit, Stories, banter, social, visual polish.

Items 1-5 must not be blocked by item 6. Content gaps must warn loudly and create a separate content incident, but they must not prevent points or picks from reaching users.

## Durable Changes

- Workflow hardening: app/scoring CI and result/scoring workflows now demote accepted Story/news backlog instead of letting it block critical publication.
- Playbooks and department skills now name critical-path priority explicitly.
- Future live-transition reports must include run ids, pool/user counts, finished-match count, snapshot verification result, production proof, and remaining non-critical incidents.

## Future Trigger

Use this decision whenever all group-stage matches, a knockout round, a final-result verification, or a pool lock/open deadline can affect whether users can see points or make picks.
