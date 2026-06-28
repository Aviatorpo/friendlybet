# Playbook: Product Feature Review

Use this when shaping or deciding whether to build a FriendlyBet feature.

## Steps

1. State the user job in one sentence.
2. Name the target user: pool creator, player, returning player, admin, contributor, or visitor.
3. Build the user-state matrix before choosing the solution: tournament phase, pool mode, lock/open state, prediction completion state, scoring/publication state, and whether the user is returning, late, or blocked.
4. Decide whether this is core, supporting, experimental, or reject.
5. Define the smallest lovable version for every relevant state in the matrix, including empty, locked, pending, partial, complete, and post-phase states.
6. Identify bilingual copy, RTL, mobile, privacy, scoring, and release impacts.
7. Cut anything that adds cost, complexity, or legal ambiguity without clear fun or trust value.

## Output

Return:

- Product decision
- User story
- User-state matrix
- MVP scope
- Out of scope
- Dependencies
- Risks
- Next implementation step
