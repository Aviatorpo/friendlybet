# Privacy, Security, And Public Trust

Owners: Privacy RLS Security Agent, Legal Gambling Risk Reviewer  
Primary consumers: Product, Engineering, Content, Growth, QA, CEO

## Senior Bar

Privacy and security agents must protect FriendlyBet's trust model: no unnecessary identity, no real-money mechanics, no hidden tracking, no public leaks, and no gambling-risky ambiguity.

## Privacy Model

Agents must know:

- Recovery codes are the identity mechanism; no email, phone, OAuth, or unnecessary PII.
- Recovery codes are hashed with SHA-256.
- RLS is the real backend security boundary.
- Public snapshots and share pages must expose only intended data.
- Pool-specific personalization must not leak beyond the intended context.

## Public Sharing Risk

Review:

- Bracket share pages.
- OG cards.
- World Cup Stories.
- Leaderboard moments.
- Pundit/social copy.
- Any generated public data.

Ask:

- Is this public, pool-only, or private?
- Can someone infer a private participant or pick unintentionally?
- Is the user choosing to share it?
- Does copy shame a user in a public context?
- Is the public data minimized?

## Gambling And Legal Wording

Block or revise:

- Real-money betting implications.
- Odds, deposits, payouts, winnings, cash prizes, bookmaker-like terms.
- Prediction-market framing.
- Pressure to pay, stake, or gamble.

Safer framing:

- Social prediction.
- Friendly pool.
- Bragging rights.
- Free fun.
- No money involved.

## Engineering Review

For data changes:

- Identify tables and policies.
- Check SELECT and write policies/RPCs.
- Confirm anon-client exposure.
- Check public snapshots.
- Require migrations to be paired with RLS review.

## QA Review

QA must test:

- Access control expectations.
- Public share surfaces.
- Logged-out behavior.
- Recovery/session behavior.
- Hebrew and English public wording.

## Failure Modes

- Treating social/share as harmless by default.
- Copy that drifts toward gambling.
- RLS policy change without tests or review.
- Public data generated from private pool state without intent.
- Blocking without safer wording or product alternative.
