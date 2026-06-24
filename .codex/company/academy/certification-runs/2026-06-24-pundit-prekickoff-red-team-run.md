# Certification Run: Pundit Pre-Kickoff Red Team Run

Date: 2026-06-24  
Checked at: 2026-06-24T09:47+03:00  
Operator: Pundit Editor under CEO + HR Agent Excellence supervision  
Status: calibrating; pre-kickoff evidence only, not graduation proof

## Objective

Train the Pundit to behave like a live football desk before the next match window: scan current sources, reject weak or promotional angles, connect stories to FriendlyBet pool consequences, and Red Team the copy before it reaches users.

This run does not count as live-window graduation because the target matches are still many hours from kickoff. It is academy evidence for research taste, source discipline, and pre-match angle selection.

## FriendlyBet State

Local and production state checked around `2026-06-24T09:47+03:00`.

- Production `public-data/matches.json`: updated `2026-06-24T05:47:41.848Z`, 72 matches.
- Production `public-data/pundit.json`: updated `2026-06-24T06:39:28.252Z`, 12 items.
- Production `public-data/pundit-news.json`: updated `2026-06-24T06:36:00.000Z`, 2 unexpired source-led items.
- Production `public-data/world-cup-stories.json`: 48 stories, latest finished-match stories include COL-COD, PAN-CRO, ENG-GHA, and POR-UZB.
- Next local target windows:
  - SUI-CAN: 2026-06-24 22:00 Israel time.
  - BIH-QAT: 2026-06-24 22:00 Israel time.
  - SCO-BRA: 2026-06-25 01:00 Israel time.
  - MAR-HAI: 2026-06-25 01:00 Israel time.
  - CZE-MEX: 2026-06-25 04:00 Israel time.
  - RSA-KOR: 2026-06-25 04:00 Israel time.

## Local Table Context

Computed from local match state.

| Group | Team | Points | Goal difference | Pundit implication |
| --- | ---: | ---: | ---: | --- |
| A | MEX | 6 | +3 | Mexico forms currently look strong; Czechia and Korea lines must be table-aware. |
| A | KOR | 3 | 0 | Korea can turn the group with a result, so avoid dry fixture copy. |
| A | CZE | 1 | -1 | Czechia need urgency language, not generic preview language. |
| A | RSA | 1 | -2 | South Africa copy should acknowledge pressure and thin margin. |
| B | CAN | 4 | +6 | Canada-Switzerland is a group-control and prediction-receipt match. |
| B | SUI | 4 | +3 | Switzerland are not a soft fixture; copy should treat this as first-place pressure. |
| B | BIH | 1 | -3 | Bosnia-Qatar is survival pressure, but needs stronger non-betting sources before news use. |
| B | QAT | 1 | -6 | Avoid overclaiming elimination math without official confirmation. |
| C | BRA | 4 | +3 | Brazil pickers expect control, but Scotland's table position creates real tension. |
| C | MAR | 4 | +1 | Morocco-Haiti can matter for group order even if Haiti are out. |
| C | SCO | 3 | 0 | Scotland are the best current narrative: Brazil glamour plus historic knockout stakes. |
| C | HAI | 0 | -4 | Haiti copy must avoid pretending the match is routine if group-order pressure remains. |

## Source Ledger

| Candidate claim | Source | Tier | Usable? | Notes |
| --- | --- | --- | --- | --- |
| Neymar is expected/ready to feature against Scotland; Steve Clarke framed him as an icon. | The Guardian, `https://www.theguardian.com/football/2026/jun/23/steve-clarke-warns-scotland-of-threat-posed-by-returning-brazil-icon-neymar`; Times of India, `https://timesofindia.indiatimes.com/sports/football/fifa-world-cup/neymar-is-ready-carlo-ancelotti-gives-major-update-ahead-of-fifa-world-cup-match-against-scotland/articleshow/131954718.cms` | trusted/professional news | yes | Strong pre-kickoff hook. Do not call Neymar a confirmed starter unless official XI says so. |
| Scotland can reach the knockout stage for the first time; a draw or win against Brazil would be historic. | The Guardian, `https://www.theguardian.com/football/2026/jun/23/scotland-brazil-world-cup-group-steve-clarke-history-beckons`; SB Nation day guide, `https://weaintgotnohistory.sbnation.com/ex-chelsea-fc/169678/2026-world-cup-day-14-final-games-in-groups-a-b-c` | trusted/professional plus football desk context | yes | Best FriendlyBet angle because it connects directly to Group C picks, underdog receipts, and table pressure. |
| Tartan Army have taken over Miami before Scotland-Brazil. | The Guardian, `https://www.theguardian.com/football/2026/jun/24/scotsmaxxing-ocean-drive-tartan-army-world-cup-party-miami`; NY Post, `https://nypost.com/2026/06/23/sports/tartan-army-takes-over-loandepot-park-ahead-of-scotland-brazil-world-cup-clash-in-wild-scene/` | fan-color/news | hold | Good flavor for social copy, weak as a standalone Pundit news item because pool relevance is indirect. |
| Canada and Switzerland both sit on four points; Bosnia-Herzegovina and Qatar need a result. | SB Nation day guide, `https://weaintgotnohistory.sbnation.com/ex-chelsea-fc/169678/2026-world-cup-day-14-final-games-in-groups-a-b-c`; FriendlyBet local table state | football desk context plus internal state | partial | Use in fixture copy, but do not publish as source-led news without an additional stronger preview/reporting source. |
| Bosnia-Herzegovina vs Qatar is a betting-tip opportunity. | TalkSport betting/promo result surfaced in search | promotional/betting | no | Rejected. FriendlyBet is free, no-money, and should not train the Pundit on gambling-promo framing. |

## Candidate Ranking

| Rank | Angle | Freshness | Verification | Pool relevance | Drama | Decision |
| ---: | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Scotland-Brazil: Neymar return possibility plus Scotland's historic knockout door | 5 | 4 | 5 | 5 | Strongest current pre-kickoff story; use near SCO-BRA window. |
| 2 | Canada-Switzerland: four points each, Group B control, receipt audit | 4 | 3 | 5 | 3 | Good deterministic fixture/Pundit line; hold as news until better sources appear. |
| 3 | Tartan Army Miami takeover | 5 | 3 | 2 | 4 | Social color only; attach to Scotland-Brazil if used. |
| 4 | Bosnia-Qatar survival | 4 | 2 | 4 | 3 | Hold. Needs non-betting source confirmation and official table framing. |
| 5 | FIFA ticket-pricing controversy | 3 | 3 | 1 | 4 | Hold. Tournament story, but not match-window or pool-relevant enough today. |

## Practice Outputs

### Pundit Lines

SCO-BRA:

- EN: `Scotland vs Brazil, 01:00 Israel time. Neymar may be back, but the bigger story is Scotland staring at a first knockout-stage door. Brazil pickers get glamour; Scotland pickers get nerves.`
- HE: `סקוטלנד נגד ברזיל, 01:00. ניימאר עשוי לחזור, אבל הסיפור הגדול יותר הוא סקוטלנד מול דלת היסטורית לשלב הבא. מי שסימן ברזיל קיבל זוהר; מי שסימן סקוטלנד קיבל דופק.`

SUI-CAN:

- EN: `Canada vs Switzerland, 22:00 Israel time. Both are on four points; this is not just a fixture, it is a receipt audit for every Group B form.`
- HE: `קנדה נגד שווייץ, 22:00. שתיהן עם ארבע נקודות; זה לא רק משחק, זה בדיקת קבלות לכל טופס בבית B.`

BIH-QAT hold line:

- EN: `Bosnia-Herzegovina vs Qatar has survival pressure, but the Pundit should wait for stronger sources before turning it into a headline.`
- HE: `בוסניה והרצגובינה נגד קטאר מריח ממשחק הישרדות, אבל הפרשן צריך מקור חזק יותר לפני שהוא הופך את זה לכותרת.`

### Story Captions

SCO-BRA:

- EN: `If Scotland take even a point from Brazil, this stops being a giant-vs-underdog story and becomes a receipt factory.`
- HE: `אם סקוטלנד מוציאה אפילו נקודה מברזיל, זה כבר לא סיפור של ענק מול אנדרדוג; זה מפעל קבלות.`

SUI-CAN:

- EN: `Canada and Switzerland are not playing for decoration. Four points each, one group lead, and a lot of quiet forms about to get loud.`
- HE: `קנדה ושווייץ לא משחקות לקישוט. ארבע נקודות לכל אחת, ראשות בית אחת, והרבה טפסים שקטים שעומדים להיות רועשים.`

### Pool-Specific Variant

- EN: `If your pool has a wall of Brazil picks, Scotland only need to make this uncomfortable for the leaderboard to start blinking.`
- HE: `אם הפול שלך מלא בבחירות על ברזיל, סקוטלנד רק צריכה להפוך את זה ללא נוח כדי שהלידרבורד יתחיל להבהב.`

## Red Team

Score: 89/100

Why it passes the academy drill:

- The best angle is not a dry fixture line; it has a player hook, national-history stakes, table pressure, and direct FriendlyBet relevance.
- It avoids betting, odds, and promotional sources.
- It separates verified state from reported pre-match expectation.
- It produces bilingual copy that can be used by Pundit, Stories, and pool-specific commentary.

Why it is not a 95+ certification:

- No official starting XI exists yet, so Neymar language must remain conditional.
- Canada-Switzerland needs stronger non-aggregated preview sourcing before it becomes a source-led Pundit news item.
- No direct same-platform creator artifact was captured in this pass, so social-format learning remains incomplete.
- This is pre-kickoff. It does not prove the agent can react correctly at kickoff, half-time, full-time, or after an unexpected result.

## Self-Feedback Loop

Before the next match window, the Pundit should repeat this cycle:

1. Recompute local table and match state from FriendlyBet data.
2. Search at least three current professional/source-led football desks.
3. Reject betting tips, stale previews, and generic schedule summaries.
4. Rank candidates by freshness, verification, pool relevance, drama, uniqueness, and clarity.
5. Write two-language copy with one concrete consequence for forms, picks, table position, or leaderboard pressure.
6. Red Team every claim: result, kickoff time, player availability, qualification math, injury, suspension, and source age.
7. Expire or rewrite the item when official XI, kickoff, half-time, full-time, or table state changes.

## Graduation Impact

This run improves the Pundit academy record, but it is not graduation evidence. The goal remains active until at least two real live/post-final windows pass at 90+ with no stale state, no expired news, correct Stories coverage, and source-led Pundit copy.

## Validation Evidence

Commands run after this artifact was drafted:

- `node scripts\pundit-live-window-certifier.js --match POR-UZB --record tmp\pundit-live-window-certifications-2026-06-24.jsonl`
- `node scripts\pundit-live-window-certifier.js --match ENG-GHA --record tmp\pundit-live-window-certifications-2026-06-24.jsonl`
- `node scripts\pundit-live-window-certifier.js --match PAN-CRO --record tmp\pundit-live-window-certifications-2026-06-24.jsonl`
- `node scripts\pundit-live-window-certifier.js --match COL-COD --record tmp\pundit-live-window-certifications-2026-06-24.jsonl`
- `node scripts\live-ops-audit.js`
- `node scripts\pundit-news-validate.js --require-unexpired`
- `node scripts\test-pundit-feed.js`
- `node scripts\test-world-cup-stories.js`

Results:

- POR-UZB: score 100, passed, proof window true, phase final, result item present.
- ENG-GHA: score 100, passed, proof window true, phase final, result item present.
- PAN-CRO: score 100, passed, proof window true, phase final, result item present.
- COL-COD: score 100, passed, proof window true, phase final, result item present.
- Live ops audit: `ok=true`, 72 matches, 48 finished matches, 48 stories, 0 missing stories, fresh Pundit feed, no watchdog warnings.
- Pundit news strict validation: OK, with unexpired source-led items.
- Pundit feed validation: 12 items.
- World Cup Stories validation: 48 stories.

Interpretation:

- The finished-match state is currently healthy and source-led Pundit news is not expired.
- These post-final certifier rows support live-window calibration, but the pre-kickoff research drill above is separate academy practice.
- The next meaningful certification checkpoint is the SUI-CAN / BIH-QAT kickoff window, followed by the SCO-BRA / MAR-HAI and Group A late windows.
