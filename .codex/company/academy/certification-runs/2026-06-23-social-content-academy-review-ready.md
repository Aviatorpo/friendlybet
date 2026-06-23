# Social Content Academy Review-Ready Certification 2026-06-23

Purpose: record evidence for the FriendlyBet social/content academy without overstating production readiness.

## Decision

Status: `ready for Eyal review`

Production-ready: `false`

Reason: the local social-content academy now has passing benchmark, structural, proof-frame, marketing-validator, regression, and certification gates for two calibration artifacts. It still lacks Eyal approval or real live publish-cycle proof, so it must not be called autonomous or production-ready.

## Current Calibration Evidence

Local evidence workspace: `C:\Eyal\friendlybet`

Calibration artifacts:

- `marketing-scout/social/video-queue/calibration/2026-06-23-portugal-uzbekistan-ronaldo-decision-v2.json`
  - quality score: `90`
  - proof decision: `approve_for_eyal_review`
  - social gate: `PASS`
  - proof gate: `PASS`
  - marketing validator: `OK`

- `marketing-scout/social/video-queue/calibration/2026-06-23-england-ghana-trap-pick.json`
  - quality score: `91`
  - proof decision: `approve_for_eyal_review`
  - social gate: `PASS`
  - proof gate: `PASS`
  - marketing validator: `OK`

Weak regression:

- `marketing-scout/social/video-queue/review/2026-06-22-egypt-new-zealand-3-1-world-cup-history.json`
  - blocked by `social_gate.py`
  - missing benchmark research, current research session, visual verification, title/thumbnail variants, claim map, editorial timing, and quality review.

## Gate Evidence

Passed:

- `python .codex\skills\friendlybet-social-content-excellence\scripts\benchmark_ledger_gate.py .codex\skills\friendlybet-social-content-excellence\references\benchmark-ledger.json`
- `python .codex\skills\friendlybet-social-content-excellence\scripts\social_gate.py marketing-scout\social\video-queue\calibration\2026-06-23-portugal-uzbekistan-ronaldo-decision-v2.json`
- `python .codex\skills\friendlybet-social-content-excellence\scripts\social_gate.py marketing-scout\social\video-queue\calibration\2026-06-23-england-ghana-trap-pick.json`
- `python .codex\skills\friendlybet-social-content-excellence\scripts\training_regression_suite.py`
- `python .codex\skills\friendlybet-social-content-excellence\scripts\certification_audit.py`

Expected failure:

- `python .codex\skills\friendlybet-social-content-excellence\scripts\certification_audit.py --require-production-ready`
  - status: `ready for Eyal review`
  - production_ready: `false`
  - blocker: missing `references/production-readiness-approval.md` and missing `references/live-publish-cycle-proof.md`.

## What Was Corrected

- The local `social_gate.py` ISO datetime parser was corrected so valid timezone datetimes are recognized.
- The two calibration jobs carry current research sessions, title/thumbnail variant packages, claim maps, visual fallback declarations, source checks, and proof-review references.
- England-Ghana calibration now has three independent source hosts for `pre_match_context`.

## Source Discipline Notes

The calibration source set used current external sources and treated them as evidence, not decoration:

- Guardian match coverage for England-Ghana defensive context and Ghana's opening result.
- Times of India and El Pais for Portugal-Uzbekistan/Ronaldo-role uncertainty.
- SB Nation Group L scenarios for England-Ghana group consequence.

External claims remain tied to `source_checks` and `claim_map`; no injury, lineup, quote, or final-state claim should be published without passing the same map.

## Remaining Production-Ready Gap

The academy is not done. The next promotion path is:

1. Produce a real review job during a correct live/pre-match/post-match window.
2. Pass `social_gate.py`, marketing validation, render, proof-frame review, and `proof_gate.py`.
3. Create `references/live-publish-cycle-proof.md` only after that real cycle, not from calibration artifacts.
4. Pass `scripts/live_cycle_proof_gate.py`.
5. Pass `scripts/certification_audit.py --require-production-ready`.

Until then, the honest status is `ready for Eyal review`, not `production-ready`.
