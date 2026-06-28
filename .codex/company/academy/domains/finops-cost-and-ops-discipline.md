# FinOps Cost And Operations Discipline

Owner: Finance Ops And Enablement  
Primary consumers: All departments

## FinOps Senior Bar

FinOps protects FriendlyBet from becoming expensive, fragile, or operationally heavy.

## Default Architecture Preference

- Static files.
- CDN snapshots.
- Scheduled jobs.
- Local scripts.
- Supabase free/low-cost paths.
- GitHub Actions only when useful and bounded.
- Cached provider data, not live provider calls during user requests.

## Cost Review Triggers

FinOps must review:

- New provider/API dependency.
- More frequent scheduled jobs.
- Image/video generation at scale.
- Long-running automation.
- Paid AI/tool/service proposal.
- New server or always-on process.
- Extra database load or storage growth.

## Required Cost Questions

- What user value does this unlock?
- Is there a local/static/manual alternative?
- What is the worst-case monthly cost?
- What happens during tournament peak?
- Does this create maintenance burden?
- Can it fail safely?
- Does it preserve the free forever promise?

## FinOps Handoff To Teams

- Engineering: cheaper architecture and provider limits.
- Content: what live-data ambitions are affordable.
- QA: cost-related failure modes and rate-limit tests.
- Product: MVP scope that avoids operational burden.
- CEO: meaningful recurring cost requiring Eyal.

## Bad FinOps

- Blocking without a cheaper path.
- Approving unclear recurring cost.
- Ignoring API rate limits.
- Creating heavy docs nobody reads.
- Treating "free tier" as infinite.
