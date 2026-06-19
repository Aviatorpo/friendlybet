# World Cup Story Dispatch Function

Receives a Supabase Database Webhook for `matches` row updates and triggers the
GitHub `world-cup-story-publish` repository dispatch only when a match changes
from a non-final status to `FINISHED`.

Required Edge Function secrets:

- `STORY_DISPATCH_SECRET`: shared secret expected in `x-friendlybet-secret`.
- `GITHUB_REPO`: `Aviatorpo/friendlybet`.
- `GITHUB_DISPATCH_TOKEN`: GitHub token allowed to call repository dispatch.

Automated setup:

```powershell
$env:GITHUB_DISPATCH_TOKEN = '<github token allowed to repository_dispatch>'
node scripts\setup-world-cup-story-supabase.js
```

Optional environment variables:

- `STORY_DISPATCH_SECRET`: reuse a specific shared secret instead of generating one.
- `GITHUB_REPO`: defaults to `Aviatorpo/friendlybet`.
- `SUPABASE_PROJECT_REF`: defaults to `supabase/.temp/project-ref`.

The setup script:

1. Deploys the Edge Function with JWT verification disabled; the function uses
   `STORY_DISPATCH_SECRET` for auth instead.
2. Sets the Edge Function secrets.
3. Installs the `matches_world_cup_story_dispatch` database trigger.
4. Verifies the trigger exists.

Manual database webhook equivalent:

- Table: `matches`
- Events: `UPDATE`
- HTTP method: `POST`
- URL: deployed function URL
- Header: `x-friendlybet-secret: <STORY_DISPATCH_SECRET>`

The function ignores all updates except `old_record.status != FINISHED` and
`record.status == FINISHED`, so live-score churn does not start GitHub work.
