# Final Truth Break-Glass

This is the emergency path for the World Cup 2026 final only. It is not the
normal source-of-truth path. Normal result truth still comes from FIFA first,
then the approved final-result verifier consensus, and Golden Boot truth still
comes from the automatic resolver when it is decisive.

Use this only if the final is over, the automated chain is not publishing the
right experience, and Eyal gives a final operator decision.

## What Eyal Can Send Codex

```text
FINAL_TRUTH_OVERRIDE
winner_code=ARG
score=ESP 1-1 ARG
result_method=penalties
penalties=ESP 3-4 ARG
golden_boot=messi
source_note=Eyal confirmed final truth from official broadcast/FIFA page
```

For a non-penalty final:

```text
FINAL_TRUTH_OVERRIDE
winner_code=ESP
score=ESP 2-0 ARG
result_method=regular
golden_boot=mbappe
source_note=Eyal confirmed final truth from official broadcast/FIFA page
```

Penalty scores are optional because FriendlyBet currently scores knockout truth
from the verified advancing/winning team. Include them when known. The score
line is still required because match display, dashboard context, and result
version publication depend on it.

## What Codex Runs

After parsing Eyal's message, run the production workflow on `main`. The
workflow refuses non-main refs so it cannot write production truth and then
commit snapshots somewhere users will not receive them.

```powershell
gh workflow run chairman-final-truth-override.yml --ref main `
  -f break_glass_ack=I_UNDERSTAND_THIS_IS_FINAL_TRUTH_OVERRIDE `
  -f dry_run=false `
  -f winner_code=ARG `
  -f home_score=1 `
  -f away_score=1 `
  -f result_method=penalties `
  -f home_penalties=3 `
  -f away_penalties=4 `
  -f golden_boot=messi `
  -f operator_note="Eyal confirmed final truth from official broadcast/FIFA page"
```

Run with `dry_run=true` first only when there is still time to validate. During
a live incident after the final, use `dry_run=false` once Eyal has stated the
truth is final.

## Production Path

The workflow:

1. Validates the exact final fixture `400021543`, `ESP` vs `ARG`, stage `FINAL`.
2. Refuses impossible score/winner combinations.
3. Refuses Golden Boot values other than Messi or Mbappe.
4. Writes `matches` as `FINISHED` with `winner_code`, score, and clean live state.
5. Writes `app_settings.top_scorer` to the selected Messi/Mbappe player id.
6. Records a private result-verification ledger observation when applying.
7. Runs `scripts/calculate-scores-v2.js --critical`.
8. Exports `public-data/matches.json` and all leaderboard snapshots.
9. Verifies local snapshot consistency and then cache-busted production snapshots.
10. Allows optional Pundit/banter refresh only after critical proof.

## Source-To-Screen Contract

- Canonical final result: Supabase `matches.external_id = 400021543`.
- Canonical Golden Boot: Supabase `app_settings.key = top_scorer`.
- Scoring: `scripts/calculate-scores-v2.js --critical`.
- Public publication: `public-data/matches.json` and `public-data/leaderboard/*.json`.
- Freshness proof: matching `result_version`, `source_state`, and
  `points_state=current_for_result_version` in production snapshots.
- Frontend display: dashboard final celebration/share preview, final scoreline,
  dashboard top scorer, and leaderboard all read the normal public/app data path.

## Safety Rules

- Do not use this path before the final result is actually final.
- Do not use it for non-final World Cup matches.
- Do not put secrets, recovery codes, user data, or private information in
  `operator_note`.
- If the automatic path later disagrees with the override, treat that as a live
  scoring incident and run the correction/replay path with a new result version.
