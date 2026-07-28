# Setup

Status: Active

Version: 0.1

Last Updated: 2026-07-28

Current Mission: APP-004

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

## First Owner Bootstrap

The first owner is created manually through an administrative Supabase process. Do not expose public signup or browser-side owner assignment.

Bootstrap procedure:

1. Configure the Supabase project.
2. Apply approved migrations.
3. Create the first user through Supabase Dashboard/Auth admin.
4. Verify that the profile row exists.
5. Create the EcoWash organization server-side or through a trusted admin SQL console.
6. Create the initial location.
7. Create the owner membership for the user.
8. Log in through `/[locale]/login`.
9. Verify access to `/[locale]/app`.

No real credentials or seed data are stored in the repository.
