# Content Live Desk And Storytelling

Owner: Content And Community  
Primary consumers: Product, Design, Engineering, QA, Privacy, Growth

## Mission

FriendlyBet content should feel like a sharp World Cup studio desk joined a WhatsApp group: specific, fast, emotionally intelligent, and grounded in verified facts.

## Senior Content Knowledge

Content agents must know:

- World Cup 2026 groups, qualification format, Round of 32 paths, and third-place complexity.
- Current match status and final result before writing match-driven content.
- How to run the Pundit Research Desk loop in `pundit-research-desk.md`: broad web scanning, source ledgers, story scoring, self-review, and cross-team handoffs.
- Group table and knockout-path implications.
- Pick types in FriendlyBet: tournament winner, group positions, third-place advancers, bracket picks, top scorer where relevant.
- Which pool members made the relevant picks.
- Hebrew and English tone expectations.
- Public gambling-wording risks.
- Social content quality gates from `.codex/skills/friendlybet-social-content-excellence/` when producing video, thumbnail, Shorts/Reels/TikTok/Facebook-style content, or approval-ready briefs.

## Live Desk Checklist

Before approving match-current content:

- Pundit research run completed or explicitly not needed.
- Match status checked: scheduled, live, finished, postponed, abandoned, or unknown.
- Score and winner checked.
- `winner_code` understood for knockout matches.
- Group/table effect checked.
- Third-place or bracket-path effect checked when relevant.
- Pool-specific pickers queried when available.
- Player facts verified: scorers, cards, injuries, substitutions, shirt numbers, quotes.
- Pundit/news/story freshness checked.
- Source ledger checked for external news, quotes, injuries, suspensions, lineups, weather, player records, and viral moments.
- Hebrew and English reviewed together.
- Privacy/legal wording risk checked for public surfaces.

## Story Types

- Vindication: someone in the pool made a smart pick.
- Collapse: a favorite or popular pick is damaged.
- Chaos: third-place or bracket path becomes unstable.
- Trap: a score looks simple but the table implication is weird.
- Villain/drama: red card, late goal, VAR, penalty, controversial decision.
- History: team achievement, upset, rivalry, milestone.
- Next-match stakes: what the result sets up.

## Broadcast-Analyst Standard

For every major match, content should be able to answer:

- What was the decisive event?
- What did casual viewers miss?
- What changed in the group or bracket?
- Who in the pool now looks smart or exposed?
- What is the next pressure point?
- What must not be overclaimed yet?

## Engineering Needs From Content

Content must tell Engineering when it needs:

- Pool-specific pickers for a story angle.
- Table position and qualification status.
- Card/scorer/substitution data.
- Player availability or match participation.
- Story freshness and deduping.
- Share-card templates that include specific pick types.

## QA Needs From Content

Content must tell QA:

- Which data source supports the story.
- Which fallback copy appears when pool data is missing.
- Which Hebrew/English strings changed.
- Which stale-data condition would make the content misleading.
- Which public copy could imply real-money betting.

## Privacy Needs From Content

Content must not expose:

- Private recovery codes.
- Unnecessary personal identifiers.
- Non-public pool data outside intended share flows.
- User-specific shame/bragging copy on public surfaces without product intent.

## Bad Content

- Generic: "What a game!" with no table or pool meaning.
- Fake insight: a dramatic line that does not match the actual match.
- Rule-blind: missing a third-place or knockout path implication.
- Data-invented: scorer, card, injury, quote, or suspension not verified.
- Copy-only: Hebrew and English are translated but not culturally native.
- Social asset judged "good enough" without current-player verification, thumbnail/opening-frame quality, visual chaptering, and Red Team review.
