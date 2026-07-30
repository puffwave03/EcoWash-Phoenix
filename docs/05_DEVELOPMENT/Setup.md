# Setup

Status: Active

Version: 0.1

Last Updated: 2026-07-30

Current Mission: INFRA-001.1

---

## Purpose

Document local setup notes for the current EcoWash Phoenix application foundation.

---

## Contents

## Environment

Required public website variable:

```text
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Required Supabase public variables for APP-004 auth routes:

```text
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
```

Do not put service-role keys in variables with the `NEXT_PUBLIC_` prefix.

## Supabase Password Recovery URLs

AUTH-001 uses Supabase Auth password recovery with a locale-aware redirect to:

```text
${NEXT_PUBLIC_SITE_URL}/{locale}/update-password
```

Authorize the following redirect URL patterns in the Supabase Dashboard before manual staging validation:

```text
http://localhost:3000/**
http://localhost:3000/*/update-password
```

For staging or production, add the equivalent canonical HTTPS site URL. Do not add service-role keys to browser-visible variables.

## Supabase Staging Bootstrap

Supabase EcoWash Staging has been connected and bootstrapped:

- `.env.local` is configured locally and ignored by Git.
- Approved baseline migrations through APP-008.1 have been applied.
- `order-media` exists as a private bucket with 1 MB limit and JPEG/PNG/WebP allowlist.
- First owner Auth user, profile, organization, location and owner membership exist.
- Password recovery E2E and owner login are complete.
- INFRA-001-SMOKE passed end to end on staging.

Manual smoke correction warning:

- The SQL correction matching `20260730000100_infra_001_smoke_fix_order_helper_and_embeds.sql` was applied manually through Supabase SQL Editor during smoke.
- The local migration is committed, but remote migration history reconciliation is pending.
- Do not rerun SQL blindly.
- Do not run `supabase db reset --linked`, `supabase migration up`, `supabase db push` or `supabase migration repair` without diagnosis and approval.

Do not commit `.env.local`. Do not reapply approved migrations.

## First Owner Bootstrap

The first owner is created manually through an administrative Supabase process. Do not expose public signup or browser-side owner assignment.

Bootstrap procedure already completed for staging:

1. Configure the Supabase project.
2. Apply approved migrations.
3. Create the first user through Supabase Dashboard/Auth admin.
4. Verify that the profile row exists.
5. Create the EcoWash organization server-side or through a trusted admin SQL console.
6. Create the initial location.
7. Create the owner membership for the user.
8. Log in through `/[locale]/login` after AUTH-001 recovery succeeds.
9. Verify access to `/[locale]/app`.

No real credentials or seed data are stored in the repository.

## Next Infrastructure Task

INFRA-001.1 must verify local and remote migration history before any further migration action:

1. Verify Git local/remote state.
2. Authenticate Supabase CLI only when explicitly starting INFRA-001.1.
3. Run `supabase migration list`.
4. Compare local migration files and remote migration history.
5. Verify whether `20260730000100_infra_001_smoke_fix_order_helper_and_embeds.sql` is present in remote history.
6. Decide the safe reconciliation method before running any migration or repair command.
7. Verify `order-media` and run read-only database checks.
