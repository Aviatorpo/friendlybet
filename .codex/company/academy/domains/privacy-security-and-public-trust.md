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
- Live result/scoring evidence has two privacy classes. Public result facts may include fixture, teams, kickoff, display status, score, result method, advancing team, penalty score if known, points state, result version, and publish timestamp. Private evidence includes raw source observations, resolver reasoning, provider errors, runner/checkpoint logs, break-glass operator notes, incident records, secrets, recovery data, private pool/user dumps, and full payloads.
- Public result and leaderboard snapshots must be allowlisted. Do not generate public snapshots with `select=*` once operational, resolver, or evidence fields exist anywhere near the queried table.

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
- For live result/scoring pipelines, separate public-safe publication tables/views/RPCs from private operational/evidence tables. Browser code may read only public-safe data; service-role writes must stay server-side.
- External runners should receive the smallest useful authority, preferably a signed trigger/wake-up secret rather than broad database write privileges. Service-role keys must never be exposed to browser code, public logs, or generated public files.

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
- Resolver/private evidence leaking through broad public exports.
- Logs or workflow artifacts printing raw provider payloads, secrets, recovery codes, private pool/user rows, or break-glass operator notes.
- Treating a degraded live-scoring state as permission to expose internal diagnostics to ordinary users.
