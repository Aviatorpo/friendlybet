# World Cup Story Dispatch Function

Receives a Supabase Database Webhook for `matches` row updates and triggers the
GitHub `world-cup-story-publish` repository dispatch only when a match changes
from a non-final status to `FINISHED`.

Required Edge Function secrets:

- `STORY_DISPATCH_SECRET`: shared secret expected in `x-friendlybet-secret`.
- `GITHUB_REPO`: `Aviatorpo/friendlybet`.
- `GITHUB_DISPATCH_TOKEN`: GitHub token allowed to call repository dispatch.

Database webhook:

- Table: `matches`
- Events: `UPDATE`
- HTTP method: `POST`
- URL: deployed function URL
- Header: `x-friendlybet-secret: <STORY_DISPATCH_SECRET>`

The function ignores all updates except `old_record.status != FINISHED` and
`record.status == FINISHED`, so live-score churn does not start GitHub work.
