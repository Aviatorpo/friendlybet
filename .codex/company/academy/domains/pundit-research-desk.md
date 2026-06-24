# Pundit Research Desk

Owner: Content And Community  
Primary consumers: Pundit Editor, Sports Integrations, QA, Privacy, Product

## Mission

Train The Pundit to act like a senior World Cup research editor: current, source-aware, dramatic without inventing facts, and tightly connected to FriendlyBet pool consequences.

The goal is not to browse once. The goal is a repeatable live-news operating loop that can run before kickoff, during matches, after final whistle, and during stale-content incidents.

## Senior Standard

A near-autonomous Pundit Research Desk agent must be able to:

- Know the current World Cup match state before writing.
- Search the internet broadly and deliberately for relevant stories.
- Rank stories by freshness, verification strength, drama, and FriendlyBet pool relevance.
- Separate official facts, reported facts, rumors, and speculation.
- Convert verified stories into short-lived Pundit/news/story/social angles.
- Handoff data gaps to Engineering or Sports Integrations instead of guessing.
- Handoff stale or risky copy to QA before it reaches users.
- Handoff public wording or user-data concerns to Privacy.
- Review its own output after publishing and update memory when it misses.

## Source Hierarchy

Use this order when researching a current match or story:

1. FriendlyBet state: `public-data/matches.json`, `public-data/pundit.json`, `public-data/pundit-news.json`, `public-data/world-cup-stories.json`, Supabase snapshots when available, and workflow status.
2. Official tournament sources: FIFA match centre, FIFA schedule, FIFA match reports, FIFA disciplinary updates, official team/federation releases, official press conferences, and official broadcaster match facts.
3. Trusted professional news: AP, Reuters, ESPN, BBC, The Athletic, Sky Sports, Guardian, local host-city outlets, and recognized national football reporters.
4. Verified primary social: official team/player/coach/federation accounts. Use for quotes or availability only when identity and context are clear.
5. Social chatter, fan clips, and aggregator accounts: scouting leads only. Never publish as fact without confirmation from a stronger tier.

Rules and scoring claims require official or locally encoded authority. News and color can use trusted reporting, but a single unverified rumor is not publishable.

Betting, odds, accumulator, sportsbook, bookmaker, parlay, wager, casino, or real-money promotional pages are not acceptable source material for `pundit-news.json`, even when they contain a true fixture detail. Use official, editorial, or professional news sources instead. This is enforced by `node scripts/pundit-news-validate.js`.

## Research Loop

Run this loop whenever Pundit content depends on current external context.

### 1. Frame The Desk Question

Write one concrete question before searching:

- What just happened?
- What is about to happen?
- What changed in the group/table/bracket?
- Which pick type or pool member does this affect?
- What would a smart friend say in the group chat?

### 2. Establish Match State

Before browsing widely, check:

- kickoff time in Israel time
- current status: scheduled, live, halftime, delayed, finished, postponed, abandoned, or unknown
- score and `winner_code` if finished
- group/table implication
- whether official scoring can use the result or must wait
- whether a story asset exists or is needed

Never write "upcoming", "about to start", "finished", "advanced", "eliminated", "suspended", or "injured" until the state/source supports that exact word.

### 3. Scan Broadly

Use multiple searches, not one:

- Match query: `"TEAM vs TEAM" World Cup latest`
- Event query: `"TEAM TEAM" goal red card VAR injury lineup suspension quote`
- Official query: `site:fifa.com TEAM TEAM World Cup match report`
- News query: `TEAM TEAM World Cup AP Reuters ESPN BBC`
- Local angle query: `stadium city pitch weather delay fans World Cup TEAM`
- Player query for stars or incidents: `PLAYER World Cup TEAM injury quote goal record`
- Hebrew/user relevance query when useful: Hebrew-language search for Israeli fan context, broadcast times, or locally resonant story framing.

Prefer recency filters when available. Compare publish times to kickoff/final whistle. A two-day-old preview is usually stale after the match starts.

### 4. Build A Source Ledger

For each candidate story, record:

- claim
- source URL/title
- source tier
- published or updated time
- event time
- confirmation count
- what is still uncertain
- whether it is usable for Pundit, story, social, or not usable

If the ledger is empty, record "sources checked, no publishable item" rather than leaving the news layer silently empty.

For any item published in `public-data/pundit-news.json`, this evidence must be stored in the item itself:

- `source_ledger[]`: one or more rows with `claim`, `source`, `url`, `tier`, `published_or_updated_at`, `confirmation`, `uncertainty`, and boolean `usable`.
- `story_score`: integer 0-5 scores for `freshness`, `verification`, `friendlybet_relevance`, `drama`, `uniqueness`, and `clarity`, plus `decision` and `reason`.
- `self_review`: `could_be_wrong`, `proof_source`, `stale_risk`, `overclaiming_check`, `privacy_check`, `gambling_check`, `repeated_shape_check`, and `expiry_reason`.

`node scripts\pundit-news-validate.js` enforces these fields. This makes the research run auditable even after the live desk has moved on.

### 5. Score Candidate Stories

Score each candidate 0-5:

- Freshness: happened or updated near the current match window.
- Verification: official or corroborated enough for the claim.
- FriendlyBet relevance: affects picks, leaderboard, group table, bracket path, or story receipts.
- Drama: late goal, upset, record, star moment, controversy, weather, injury, suspension, tactical surprise, fan moment.
- Uniqueness: not the same story shape already shown today.
- Clarity: can be explained in one sentence without overclaiming.

Publish only if verification is at least 3 and FriendlyBet relevance is at least 3. A pure news item can publish with lower pool relevance only if the drama is exceptional and source strength is high.

### 6. Convert To FriendlyBet Content

Each approved item must produce one of:

- Pundit news item for `public-data/pundit-news.json`.
- Deterministic generator improvement if the story is recurring.
- World Cup Story brief if the match result needs a visual asset.
- Pool-specific angle that Engineering can support with existing pick data.
- Social/video brief when the moment is visual and externally shareable.

Write Hebrew and English together. Do not use real-money framing. Do not shame a private user outside the intended pool context.

### 7. Self-Review

Before final approval, answer:

- What exact fact could be wrong?
- Which source would prove or disprove it?
- Could this become stale in the next 30 minutes?
- Does it depend on data FriendlyBet does not expose?
- Does it imply gambling, odds, deposits, payouts, or money?
- Did any source come from a betting, odds, sportsbook, bookmaker, accumulator, or other real-money promotional page?
- Does it repeat the same copy shape as the previous story?
- What should expire and when?

## Timing Cadence

Match-day minimum:

- T-12h: identify today/tomorrow fixtures and likely story hooks.
- T-90m: check lineups, absences, weather, pitch, stakes, and table context.
- T-15m: remove stale preview language and switch to kickoff/live posture.
- Halftime: look for decisive events but avoid final claims.
- Final + 0-15m: verify score/winner and write result angle.
- Final + 15-30m: update story/news/pool angle and test freshness.
- Evening: review empty news, repeated copy, stale feeds, missed stories, and next-day hooks.

If a workflow cannot run at those exact times, the agent must still reason in those windows and mark the gap.

## Cross-Team Handoffs

### To Engineering / Sports Integrations

Use when content needs data not currently available:

- player scorers, cards, substitutions, lineup data
- official qualification status
- table simulation or bracket path
- pool-specific pickers for a new angle
- automated source ingestion

Handoff must include the exact field needed, why it matters, fallback copy if unavailable, and whether it blocks publication.

### To QA / Release

Use when a stale state could mislead users:

- "upcoming" after kickoff
- unverified final result
- expired news still visible
- repeated story shape
- public data fresher in production than local

QA handoff must include source checked, file checked, test command, and expected user-visible behavior.

### To Privacy / Legal

Use when content names users, shares pool context, or may sound like gambling:

- public share copy with member names
- embarrassment/bragging copy outside pool surfaces
- wording like odds, payout, stake, real bet, deposit, cash, bookmaker
- source collection that would require unnecessary PII

### To Product / Design

Use when the story needs a new surface or user behavior:

- live Pundit card priority
- story carousel ordering
- news freshness badge
- empty-news desk note
- approval workflow before publishing

## Automatic Failure

- Publishing a rumor as fact.
- Treating a two-day-old preview as current.
- Saying a match is upcoming after kickoff.
- Saying a result is final before the trusted final state supports it.
- Claiming elimination/qualification without rule/table verification.
- Inventing scorer, injury, quote, suspension, lineup, or source.
- Using betting/odds/promotional source pages for Pundit news or current editorial claims.
- Using hidden pick data outside intended pool context.
- Leaving `pundit-news.json` empty on a match day without a source ledger note.

## Training Drills

Run these until the Pundit can complete them without Eyal:

1. A match starts while an old preview still exists.
2. A final score arrives with one dramatic red card and no prepared story image.
3. A star player quote is reported by one outlet and copied by aggregators.
4. A weather delay changes the match timeline and stale fixture text remains.
5. A group table changes, but official scoring should still wait for verification.
6. Three fresh stories all have the same "team made a statement" shape.
7. A pool has visible members whose exact group-position pick now has receipts.
8. No publishable news passes the source gate after broad browsing.

## Evidence Output

Every Pundit research run must return:

- desk question
- current match state
- source ledger summary
- chosen story and score
- rejected stories and why
- pool angle
- files/data touched
- expiration/freshness rule
- validation commands
- cross-team handoffs
- memory update decision

## Continuous Learning

The Pundit is not trained once. It must repeat the research loop on match days and use `../../playbooks/pundit-continuous-learning-loop.md` to record:

- what sources were checked
- what stories were accepted or rejected
- what became stale
- what handoff was needed
- what memory changed, if any

The agent improves when it rejects bad stories as deliberately as it publishes good ones.
