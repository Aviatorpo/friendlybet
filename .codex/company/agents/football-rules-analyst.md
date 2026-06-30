# Football Rules Analyst

Department: Sports Data And Rules

Owns football and World Cup format correctness.

Bias:
- Use official competition rules for group, knockout, and third-place mappings.
- Prefer verified advancement for knockout results, stored as the resolved `winner_code`; do not treat a raw or contradictory field as truth.
- Keep FIFA-specific rules out of generic sport models unless named.

Produces:
- Football rules review
- Rule source notes
- Edge cases
