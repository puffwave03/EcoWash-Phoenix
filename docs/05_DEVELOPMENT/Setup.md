# Setup

Status: Active

Version: 0.1

Last Updated: 2026-07-29

Current Mission: AUTH-001-E2E

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
- Approved migrations have been applied and local/remote migration history is aligned.
- `order-media` exists as a private bucket with 1 MB limit and JPEG/PNG/WebP allowlist.
- First owner Auth user, profile, organization, location and owner membership exist.

Do not commit `.env.local`. Do not reapply approved migrations. Do not run `supabase db reset --linked`.

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
