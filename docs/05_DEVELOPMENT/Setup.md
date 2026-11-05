# Setup

Status: Current setup orientation with historical bootstrap preserved

Reconciled: 2026-11-05; repository checkpoint `d91dc9faba0f040055176a853afad3527f3a0813`.

## Current session and local development

Start with [Start Here](../00_START_HERE.md), [AGENTS](../../AGENTS.md), the relevant [Handover](../00_START_HERE/SESSION_HANDOVER.md) and [Project Status](../06_ROADMAP/Project_Status.md), then verify Git against the explicit task. Setup is not an instruction to recreate the tenant, apply SQL or resume a historical “next task”.

[package.json](../../package.json) and the committed lockfile define the repository dependencies and scripts. The current `dev` script is `next dev --webpack`; use the existing script for authorized development. This documentation correction does not install dependencies, start a server or certify a new runtime/CLI version. For environment or recovery work, reuse the last verified procedure in [Recovery Runbook](Recovery_Runbook.md); do not substitute a different database environment silently.

## Configuration and credential boundaries

- The existing public configuration names are `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the localhost/example values in the original below are examples, not staging credentials. The [Supabase configuration loader](../../src/lib/supabase/env.ts) requires URL/anon key for user clients. Match the authorized environment; do not copy a staging URL into production or treat an old project ref as a current target default.
- `.env.local` stays local and Git-ignored; never commit or print credentials. `SUPABASE_SERVICE_ROLE_KEY` is used by the existing privileged configuration loader for specifically authorized server functions, not ordinary browser/user clients. Never prefix privileged keys with `NEXT_PUBLIC_`, give production administrative credentials to development agents or use them to bypass tenant/RLS checks. [Security](../04_ARCHITECTURE/Security.md) and AGENTS remain authoritative.
- Preserve the locale-aware password-recovery redirect and environment-specific allowlist checks described below. Historical localhost patterns are not permission to broaden hosted redirect allowlists; verify the canonical HTTPS target when such configuration work is authorized.
- Supabase Auth/PostgreSQL/private Storage are already implemented. First-owner/staging bootstrap below is completed historical evidence, not a fresh installation checklist or authorization for public signup/browser-side owner assignment.

## Migration history: historical pending notice superseded

INFRA-001.1 **completed** the remote history reconciliation for `20260730000100`; the later Handover explicitly records that local and remote both include that migration. The old “reconciliation pending” and “Next Infrastructure Task” statements below are superseded historical instructions. Later staging checkpoints also record subsequent migrations and aligned history; those counts describe their own dates and do not prove the live target's present state.

Evidence: [Session Handover — Migration History State](../00_START_HERE/SESSION_HANDOVER.md#migration-history-state); [Project Status](../06_ROADMAP/Project_Status.md), INFRA-001.1 completion and smoke reconciliation evidence. No migration is presumed pending merely because an old bootstrap paragraph says so. This P3 correction performs no live history, database or credential check.

Do not reapply approved SQL or rerun bootstrap. Preserve the original warning: no `supabase db reset --linked`, `supabase migration up`, `supabase db push` or `supabase migration repair` without diagnosis and explicit approval. Before any separately authorized remote mutation, prove the exact staging/production target, compatible environment and relevant migration history. Commit/push authorization alone never authorizes database mutation. Use the existing [Git Workflow](Git_Workflow.md) and Recovery Runbook; no new migration/recovery procedure is introduced here.

## Historical original — 2026-07-30

The complete original below is preserved verbatim. Its APP-era exclusions, bootstrap state and next-task instructions are dated evidence, superseded only within the scopes clarified above. They do not authorize current execution.

<details>
<summary>Original 2026-07-30 guide — historical reference</summary>

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

</details>
