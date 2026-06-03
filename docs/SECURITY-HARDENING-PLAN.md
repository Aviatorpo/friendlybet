# FriendlyBet — Full Security Hardening Plan (server-side identity)

> Status: **PLAN ONLY — not implemented.** Written 2026-06-03.
> This document describes how to fully close the residual security risks. It is
> the "when you're ready" follow-up to the partial hardening that is already
> live (`migrations/2026-06-03-lock-sensitive-columns.sql`).

---

## 1. The problem in one sentence

The browser talks to the database with a **public key** and there is **no
server-side identity**, so the database cannot tell one visitor from another and
therefore cannot enforce "only *this* user / only *this admin* may do *this*."

## 2. What this plan closes

| Residual risk (today) | Closed by this plan? |
|---|---|
| Anyone can read every user's `recovery_code_hash` | ✅ Yes (login moves server-side; hash never leaves the DB) |
| Anyone can delete any pool / user | ✅ Yes (delete gated to the owning admin) |
| Anyone can create a new `is_admin = true` user | ✅ Yes (admin flag set server-side only) |
| (already fixed) faking scores / self-promote via update | ✅ already closed by the live migration |

## 3. Recommended architecture: **identity token (JWT) + Row-Level Security**

This is the most "Supabase-native" path and requires the **least rewrite of
`app.js`**, because the existing `.insert()/.update()/.delete()` calls keep
working — they simply start carrying a signed token, and the database decides
what each token is allowed to do.

```
  Browser                         Supabase
  ┌──────────────┐   recovery     ┌────────────────────────────┐
  │ enter code   │ ─ code ──────▶ │ Edge Function: login()     │
  │              │                │  - hash the code (server)  │
  │              │                │  - find the user           │
  │              │ ◀─ signed JWT ─│  - sign JWT {sub:user_id,  │
  │ store token  │   (short-lived)│       pool_id, is_admin}   │
  └──────┬───────┘                └────────────────────────────┘
         │ all DB calls now send the JWT
         ▼
  ┌────────────────────────────────────────────────────────────┐
  │ Postgres RLS uses auth.jwt() -> sub / is_admin to allow or  │
  │ deny each row + column. Direct writes without a valid token │
  │ are rejected.                                               │
  └────────────────────────────────────────────────────────────┘
```

Two new server pieces:
1. **`login` Edge Function** (and a matching `signup` function): validates the
   recovery code, returns a JWT signed with the project's JWT secret. This is
   the *only* place the hash is touched — so we can then forbid the browser from
   reading the hash column at all.
2. **RLS policies** on every table that read `auth.jwt()` claims to enforce
   ownership and admin rights.

### Why not "an RPC per action" (the alternative)
We could instead move every write into `SECURITY DEFINER` Postgres functions and
have the client call `supabase.rpc(...)`. It's equally secure, but it means
rewriting **every** write in `app.js`, so it's more churn. Keep it as a fallback
for a handful of especially sensitive atomic actions (e.g. "approve member") if
expressing them purely in RLS gets awkward.

---

## 4. Phased rollout (each phase is shippable and never breaks the live app)

The golden rule: **deploy the new capability first, migrate the client to use
it, and only then lock the old door.** At no point is the app left broken.

### Phase 0 — Safety net (½ day)
- Turn on Supabase **point-in-time backups** (so accidental data loss during the
  work is recoverable). Worth doing regardless of this plan.
- Create a **staging** Supabase project (or a test pool) to develop against, so
  nothing is tried first on live data.

### Phase 1 — Server-side login, close the hash leak (1–2 days)
- Build the **`login` / `signup` Edge Functions** that validate the recovery
  code server-side and return a signed JWT.
- Change `app.js` login/signup to call these functions and attach the returned
  token to the Supabase client (`setSession`/global header).
- Once the client never queries `users` by hash anymore:
  **`REVOKE SELECT (recovery_code_hash) ON users FROM anon, authenticated;`**
- **Closes risk #1** (hash readability). App keeps working because login is now
  the function's job.
- Rollback: re-grant the column; point the client back at the old login path.

### Phase 2 — RLS ownership rules for writes (2–4 days)
- Author RLS policies so that, using the JWT identity:
  - a user may write **only their own** picks / profile rows;
  - **only an admin of a pool** may approve/remove members, lock the pool, edit
    its settings, or delete it;
  - the `is_admin` flag and pool admin status can only be set by the server
    (signup function), never by a client write.
- Ship policies in "permissive + log" mode first if possible, watch for denied
  legitimate actions, then enforce.
- **Closes risks #2 and #3.**

### Phase 3 — Lock the doors (½ day)
- After the client fully uses tokens and policies are verified:
  `REVOKE INSERT/UPDATE/DELETE ON pools, users FROM anon, authenticated;`
  and rely on the JWT-gated policies (or RPCs) for all writes.
- Re-run the **verification probe** (same technique used for the partial fix):
  confirm that without a valid token you can no longer insert/update/delete, and
  that a logged-in user *can* do exactly their allowed actions.

### Phase 4 — Optional read scoping (1–2 days)
- Tighten **read** policies so a user only sees data for pools they belong to
  (today any pool's data is readable by code). Lower priority; do only if wanted.

---

## 5. The write operations that must be covered

(From the audit of `app.js` — every one of these must keep working under the new
rules, gated to the right identity.)

- **Signup**: create user (regular + first admin) → server-issued, sets `is_admin`.
- **Create pool** → server-issued; creator becomes that pool's admin.
- **Save predictions**: insert/update/delete on `group_position_picks`,
  `knockout_picks`, `tournament_winner_picks`, `sp_third_place_picks`,
  `top_scorer_picks` → only the **owning user**.
- **Regenerate recovery code** → only the **owning user**.
- **Admin actions**: approve / reject / remove member, lock / unlock pool, edit
  pool settings, delete pool → only an **admin of that pool**.
- **Scores / points** → server only (already enforced today via the service key;
  keep it that way).

---

## 6. Effort, risk, and sequencing

| Phase | Effort | Risk to live app | Value |
|---|---|---|---|
| 0 Safety net | ½ day | none | enables safe work |
| 1 Server login + hash lockdown | 1–2 days | low (login path swap) | closes hash leak |
| 2 RLS write ownership | 2–4 days | medium (policy mistakes deny real actions) | closes delete + admin |
| 3 Lock the doors | ½ day | low if 1–2 done well | makes it real |
| 4 Read scoping (optional) | 1–2 days | medium | privacy nicety |

**Total: roughly 1–1.5 focused weeks** for Phases 0–3 (the full close of all
three residual risks). Phase 4 is optional polish.

**Biggest risk in the project itself** is Phase 2 — an over-tight policy that
blocks a legitimate action. Mitigations: develop on staging, ship policies in
log-only mode first, and keep each phase reversible (every lockdown step has a
one-line `GRANT` rollback).

---

## 7. When to do this

The app is a free, no-money game, so today's threat model is low (a technical
person cheating a leaderboard — already blocked — or vandalizing a pool). This
plan is the right move **when any of these become true**:
- real prize / money / sponsorship is attached to results,
- the user base grows enough that vandalism would hurt,
- you want to advertise it as "secure," or
- you simply want peace of mind.

Until then, the partial hardening that's already live covers the most likely
abuse. When you decide to proceed, this document is the build sheet — hand it
back and it can be implemented phase by phase.
