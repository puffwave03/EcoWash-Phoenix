# Deployment

Status: Active

Version: 0.1

Last Updated: 2026-08-03

Current Mission: OPS-001.6

---

## Purpose

Track the current staging deployment contract and preserve the production-deferred release guardrails for EcoWash Phoenix.

---

## Contents

Current release result: staging is online and validated; real production is deferred until the pilot product is functionally complete.

This document is a plan. It does not declare EcoWash Phoenix production-ready and does not authorize deployment, DNS changes, environment changes, Supabase project creation, Auth redirect changes or migration application.

## Current Release Position

- `main` is the only release branch.
- Latest confirmed operational baseline: `48cd1a1 OPS-001.5 feat: add daily close dashboard`.
- SEC-001 is completed.
- PILOT-001 is approved and canonicalized.
- RELEASE-001.2 staging deployment rehearsal and Auth validation are completed.
- RELEASE-001.3 production environment design is completed.
- Vercel staging project `ecowash-phoenix-staging` is online at `https://ecowash-phoenix-staging.vercel.app`.
- Automatic deploy from `main` to the staging project is working.
- OPS-001.5 deployed successfully to staging; unauthenticated `/it/app/daily-close` returns a safe redirect to login and no HTTP 500 was observed.
- No production environment is confirmed.
- No production Supabase project is inventoried.

## Staging Requirements

- Git local and remote `main` are synchronized at an approved commit.
- Working tree is clean.
- `npm run lint` passes.
- `npm run build` passes.
- `git diff --check` passes.
- Translation key parity passes across supported locales.
- Supabase CLI is authenticated for read-only staging checks.
- `supabase migration list` confirms local/remote migration history alignment.
- EcoWash Staging remains linked intentionally.
- SEC-001.1 migration `20260801000100_sec_001_1_security_remediation.sql` remains applied.
- Smoke order baseline remains available unless a separate cleanup task is approved.
- `order-media` remains private with 1 MB image limit and JPEG/PNG/WebP allowlist.
- Auth recovery redirect works for the staging canonical URL.
- `NEXT_PUBLIC_SITE_INDEXING=false` is used for staging/preview deployments.
- `SUPABASE_SERVICE_ROLE_KEY` is server-side only for staff invitations and customer access management and must never use a `NEXT_PUBLIC_` prefix.
- `ENABLE_STAGING_CUSTOMER_PREVIEW=true` is server-side only for the staging customer portal review helper; it must not use a `NEXT_PUBLIC_` prefix and must not be enabled in a future real production environment.
- Staging can use the assigned Vercel domain; a custom domain is not required for the first staging deployment.
- Staging uses EcoWash Staging Supabase, not a production Supabase project.
- No production deployment, DNS cutover or production Supabase work is part of staging rehearsal.

## Production Requirements

- Hosting provider selected and documented.
- Production domain selected, controlled and documented.
- DNS ownership and rollback responsibility documented.
- Production Supabase project created and inventoried in a separate approved task.
- Production environment variables defined by name and owner without exposing values.
- Production Auth Site URL and redirect URLs configured and verified.
- Public signup disabled unless a future approved task changes the auth model.
- Production Storage bucket `order-media` configured as private with the approved limits.
- Production migration workflow approved before applying migrations.
- Production backup/snapshot/PITR strategy documented.
- First owner bootstrap runbook approved.
- Error logging/redaction rules documented.
- Observability owner and minimum monitoring surfaces defined.
- Production smoke checklist approved.

## Staging Blockers

- Supabase CLI authentication must be available in the active release shell before read-only remote checks.
- Staging hosting and environment contract are not yet approved.
- Staging migration history must be rechecked immediately before release candidate review.
- Staging Auth redirect URLs must be verified against the chosen staging/preview URL.
- Staging/preview indexing policy must be explicit through `NEXT_PUBLIC_SITE_INDEXING=false`.
- Remaining smoke gaps need a QA decision: negative upload tests, overpayment behavior and payment actor visibility.

## Production Blockers

- No production domain is selected or verified.
- No hosting project is configured.
- No production Supabase project is confirmed.
- No production Auth redirect model is applied or verified.
- No production environment design is approved.
- No production backup/rollback plan is approved.
- No production observability/logging policy is approved.
- No production smoke checklist is approved.
- No deploy target has been tested with production-like environment separation.

Custom domain selection does not block the first staging deployment. Staging may initially use the hosting provider's assigned Vercel domain.

## Hosting Recommendation

Recommended host for the M1 release path: Vercel.

Rationale:

- Native support for Next.js App Router, dynamic routes, middleware/proxy and server rendering.
- Built-in environment separation for Production, Preview and Development.
- Fast rollback to previous deployment.
- No Docker requirement for the current app.

Do not create the hosting project during RELEASE-001.0. Staging hosting selection and environment contract belong to RELEASE-001.1.

## Environment Matrix

| Variable | Local | Staging/preview | Production | Notes |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | required | required | required | Canonical absolute HTTP/HTTPS URL. |
| `NEXT_PUBLIC_SUPABASE_URL` | required | required | required | Must point to the intended Supabase environment. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | required | required | required | Public anon key only; RLS must enforce access. |
| `NEXT_PUBLIC_SITE_INDEXING` | optional | required as `false` | explicit decision | Prevent accidental indexing outside production. |

Rules:

- Do not expose service-role keys through `NEXT_PUBLIC_*`.
- Do not commit `.env.local`.
- Do not log environment variable values.
- Production must not point to the staging Supabase project unless a release decision explicitly says the first pilot uses staging.

## Auth URL And Redirect Model

Application routes:

- Login: `/{locale}/login`
- Forgot password: `/{locale}/forgot-password`
- Recovery callback: `/{locale}/update-password`
- Protected app: `/{locale}/app`

Required Supabase Auth configuration for each deployed environment:

```text
Site URL:
https://<canonical-environment-domain>

Redirect URLs:
https://<canonical-environment-domain>/**
https://<canonical-environment-domain>/*/update-password
```

Rules:

- Redirect URLs must be configured before password recovery validation.
- Browser-provided redirect URLs must not be accepted.
- Password recovery tokens and URLs must not be logged.
- Public signup remains disabled.

## Supabase Environment Strategy

Staging:

- Existing EcoWash Staging remains the validation project.
- Smoke data remains available.
- Migration history must stay aligned with local migration files.
- RELEASE-001.1 and RELEASE-001.2 use Supabase staging only.

Production:

- Use a separate Supabase project unless a future commercial decision explicitly approves a staging-only pilot.
- Apply only approved local migrations in order.
- Create the first owner through a trusted admin process.
- Verify RLS, RPC grants and Storage policies after migration application.
- Do not copy staging data blindly.

## Migration Workflow

For staging release checks:

1. Confirm Git baseline.
2. Confirm Supabase CLI auth.
3. Run read-only migration history checks.
4. Do not apply migrations unless a separate task explicitly authorizes it.

For production migration application:

1. Confirm release commit and clean working tree.
2. Confirm production Supabase target.
3. Capture backup/snapshot/PITR status.
4. Run migration history check.
5. Apply migrations only in an approved release-application task.
6. Run post-apply read-only checks.
7. Run approved smoke checks.
8. Prefer forward-fix migrations for defects.

Forbidden without explicit approval:

- `supabase db reset --linked`
- `supabase migration repair`
- blind SQL replay
- destructive DDL
- direct data mutation

## Deployment Checklist

Use this checklist first for staging rehearsal. Production deployment is not authorized until RELEASE-001.7 reaches a go decision.

Pre-deploy:

- Release commit approved.
- Working tree clean.
- `npm run lint` passes.
- `npm run build` passes.
- Environment matrix approved.
- Hosting target confirmed.
- Supabase target confirmed.
- Auth redirects configured.
- Backup/rollback owner confirmed.
- Smoke checklist assigned.

Deploy:

- Deploy from approved commit only.
- Use the selected hosting provider's staging or production deployment path according to the approved task.
- Do not change DNS until the deployment passes health checks and a production cutover task explicitly authorizes DNS work.
- Keep previous deployment available for rollback.

Post-deploy:

- Verify public localized pages.
- Verify login redirect.
- Verify password recovery flow.
- Verify protected dashboard access.
- Verify no service-role key is browser reachable.
- Verify robots/indexing policy.
- Run approved smoke checks.
- Record release result.

## Rollback Checklist

App rollback:

- Roll back hosting deployment to the previous known-good deployment.
- Keep the failed deployment logs.
- Record the failed release commit and reason.

Database rollback:

- Prefer forward-fix migration.
- Use backup/PITR only with explicit owner approval.
- Do not run `db reset` on linked environments.

Auth/DNS rollback:

- Restore previous Auth Site URL/redirects if changed.
- Restore previous DNS target if cutover occurred.
- Keep TTL and propagation notes in the release record.

Storage rollback:

- Do not directly delete Storage objects.
- Use metadata deactivation or a reviewed cleanup process.

## RELEASE-001.x Execution Order

1. `RELEASE-001.0 — Canonicalize release readiness plan and blockers`
2. `RELEASE-001.1 — Staging hosting and environment contract`
3. `RELEASE-001.2 — Staging deployment rehearsal`
4. `RELEASE-001.3 — Production Supabase and environment design`
5. `RELEASE-001.4 — Auth URL and redirect validation`
6. `RELEASE-001.5 — Backup, rollback and incident runbook`
7. `RELEASE-001.6 — Logging, monitoring and release metadata`
8. `RELEASE-001.7 — Production release checklist and go/no-go review`

## RELEASE-001.x Definitions

`RELEASE-001.1 — Staging hosting and environment contract`

- Choose and configure staging hosting.
- Define staging/preview environment variables.
- Require `NEXT_PUBLIC_SITE_INDEXING=false`.
- Use Supabase staging.
- Verify staging Auth redirect requirements.
- Do not require a custom domain; the assigned Vercel domain is acceptable for first staging.
- Do not perform production work.

`RELEASE-001.2 — Staging deployment rehearsal`

- Run a controlled staging deployment.
- Smoke login, dashboard, orders, payments and Storage.
- Verify runtime logs.
- Rehearse app rollback.
- Do not perform production work.

`RELEASE-001.3 — Production Supabase and environment design`

- Design the separate production Supabase project.
- Define production environment variables.
- Define first-owner bootstrap.
- Define production Storage requirements.
- Define migration strategy.
- Do not create remote production resources in this documentation task.

`RELEASE-001.4 — Auth URL and redirect validation`

- Validate Site URL requirements.
- Validate redirect allowlist.
- Validate password recovery.
- Validate login/logout.
- Keep staging and production redirect models separate.

`RELEASE-001.5 — Backup, rollback and incident runbook`

- Define backup expectations.
- Define PITR/snapshot requirements.
- Define app, database and Storage rollback paths.
- Define incident runbook ownership and escalation.

`RELEASE-001.6 — Logging, monitoring and release metadata`

- Define logging policy.
- Define redaction rules.
- Choose error tracking approach.
- Define release identifier format.
- Define uptime monitoring expectations.

`RELEASE-001.7 — Production release checklist and go/no-go review`

- Finalize production checklist.
- Make go/no-go decision.
- Require migration dry-run or equivalent migration review.
- Require verified backup.
- Define release tag.
- Define smoke checks and rollback window.

## Release Decision State

Current state: `STAGING READY — PRODUCTION DEFERRED`.

## Staging Contract Result

RELEASE-001.1 result: `READY FOR VERCEL STAGING SETUP`.

RELEASE-001.2 result: `COMPLETED — STAGING AUTH VALIDATED`.

Staging hosting contract:

- Hosting target: Vercel project `ecowash-phoenix-staging`.
- Staging domain: `https://ecowash-phoenix-staging.vercel.app`.
- Custom domain: not required and not a staging blocker.
- Production deployment: explicitly out of scope.
- Production DNS: explicitly out of scope.
- Production Supabase: explicitly out of scope.

Staging environment contract:

| Variable | Staging value class | Required value rule |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Vercel-assigned HTTPS staging URL | Must exactly match the deployed staging origin and have no trailing slash. |
| `NEXT_PUBLIC_SUPABASE_URL` | EcoWash Staging Supabase URL | Must point to staging Supabase, not production. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | EcoWash Staging anon key | Must be anon key only; no service-role key. |
| `NEXT_PUBLIC_SITE_INDEXING` | literal flag | Must be `false`. |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side secret | Required for staff invitations and customer access management; never expose to browser code and never commit. |
| `ENABLE_STAGING_CUSTOMER_PREVIEW` | server-side staging flag | May be `true` only on the Vercel staging project for review; never expose to browser code and do not enable in future real production. |

Staging indexing contract:

- `NEXT_PUBLIC_SITE_INDEXING=false` is mandatory.
- `/robots.txt` must disallow indexing on staging.
- Current staging robots result: `Disallow: /`.
- Staging must not be submitted to search consoles or public directories.

Staging Auth redirect contract:

Configure EcoWash Staging Supabase Auth with the staging origin after the Vercel URL exists:

```text
Site URL:
https://ecowash-phoenix-staging.vercel.app

Redirect URLs:
https://ecowash-phoenix-staging.vercel.app/**
https://ecowash-phoenix-staging.vercel.app/*/update-password
```

Validation scope:

- Forgot password request sends recovery email.
- Recovery link opens `/{locale}/update-password` on staging.
- Login redirects authenticated users to `/{locale}/app`.
- Logout returns to login.
- Invalid or expired recovery links fail safely.

Current staging status:

- Vercel staging is ready.
- Supabase Auth staging is configured and validated.
- Indexing is disabled.
- `/robots.txt` returns `Disallow: /`.
- Customer portal routes are deployed and protected.
- Staging customer preview is feature-flagged server-side only.
- Automatic deploy from `main` is working.
- No real production resource has been created.
