# Session Handover

Status: Active

Date: 2026-07-30

Session checkpoint: INFRA-001-SMOKE closure

Repository: `/Users/cristianomegale/EcoWash-Phoenix`

Branch: `main`

Last completed commit: `a607218 UX-001 feat: refine protected app shell and session handover`

Working tree status: contains INFRA-001-SMOKE corrective changes until reviewed and committed

---

## Completed Milestones

- APP-002 — Order Domain and Database Design
- APP-003 — Supabase Tenant Foundation and Security Baseline
- APP-004 — Authentication and Roles
- APP-005 — Customers and Properties
- APP-006 — Orders and Workflow
- APP-007 — Photos, Pickup, Delivery and Payments
- APP-008 — Dashboard and Operational Overview
- APP-008.1 — Organization Timezone Foundation
- INFRA-001 — Supabase staging connection and migration bootstrap
- AUTH-001 — Password recovery and update flow
- AUTH-001.1 — Password reset error fall-through correction
- AUTH-001-E2E — Real password recovery and first owner login
- UX-001 — Protected app shell refinement and session handover
- INFRA-001-SMOKE — First real operational smoke test: PASS WITH NON-BLOCKING ISSUES

## Supabase Staging State

Completed on EcoWash Staging:

- Supabase project created and connected.
- `.env.local` configured locally and ignored by Git.
- Build with real environment variables passed.
- Supabase CLI login completed.
- Repository linked to the staging project.
- Migration dry-run passed.
- Five approved migrations applied successfully.
- Local and remote migration history aligned.
- 15 tables verified in the Dashboard.
- `order-media` bucket created and verified as private.
- First owner Auth user created.
- `auth.users -> profiles` trigger verified.
- Organization `EcoWash La Tejita` created.
- Primary location created.
- Active owner membership created.
- Bootstrap verification queries passed.
- Password recovery end-to-end completed.
- Owner login completed.
- Real dashboard visible at `/it/app`.
- First real operational smoke test completed against staging.

Applied migrations:

- `20260727000100_app_003_tenant_foundation.sql`
- `20260728000100_app_005_customers_properties.sql`
- `20260728000200_app_006_orders_workflow.sql`
- `20260728000300_app_007_logistics_photos_payments.sql`
- `20260728000400_app_008_1_organization_timezone.sql`

Smoke-test corrective migration pending local commit:

- `20260730000100_infra_001_smoke_fix_order_helper_and_embeds.sql`

This corrective migration was prepared after staging exposed `app_current_organization_id()` and `create_order()` defects, then validated by the successful order-creation retest. It must remain a forward-only migration. Do not edit already-approved migrations.

Do not reapply approved migrations. Do not run `supabase db reset --linked`.

## APP-008 Dashboard State

APP-008 implements the real protected operational dashboard:

- open, overdue, express, on-hold and ready orders
- production queue
- pickup and delivery work
- logistics attention
- payment overview
- balances requiring attention
- recent activity
- tenant isolation
- global financial aggregates only for owner/manager
- per-order operational financial data available to staff
- amounts separated by currency
- no demo data
- no Realtime

APP-008.1 adds `organizations.timezone` with default `Atlantic/Canary` and uses organization-local day boundaries converted to UTC for today's pickup, delivery and payment metrics.

## AUTH State

AUTH-001 and AUTH-001.1 are complete:

- localized forgot-password flow
- Supabase recovery email request
- update-password route
- recovery code exchange
- temporary recovery cookie/session guard
- new password and confirmation form
- `supabase.auth.updateUser`
- sign-out after successful update
- redirect to login after success
- explicit non-fall-through handling for rate limit and temporary reset errors
- translations for `en`, `es`, `it`, `fr`, `de`
- no password, token or recovery URL logging

Real owner password recovery and login have been completed. Do not request unnecessary recovery emails.

## UX-001 State

UX-001 is completed and pushed. It refined the protected application shell and handover documentation only:

- protected `/[locale]/app` receives a dedicated full-height app layout
- protected app navigation is visually separated from the public website
- dashboard KPI summary no longer nests cards inside a parent card
- provisional dashboard foundation copy is replaced in five locales
- application data logic remains unchanged
- no database, migration, Supabase remote or dependency changes

## INFRA-001-SMOKE State

INFRA-001-SMOKE completed with result:

`PASS WITH NON-BLOCKING ISSUES`

Validated staging flow:

- owner logout/login and protected app shell
- customer creation/access
- property creation/access linked to the customer
- service and price visibility
- order creation and detail redirect
- item creation, duplicate row removal and total recalculation
- production workflow through ready state
- pickup completion
- delivery completion
- partial and final cash payments
- photo upload and signed preview
- dashboard coherence after real operational activity
- logout protection and persistence after new login

Smoke record used:

- order `EW-000001`
- final item total `25,00 EUR`
- final payment state paid with zero balance
- production state ready
- pickup and delivery completed

Corrective issues handled during smoke:

- BUG-001: `create_order` failed because `app_current_organization_id()` used `min(uuid)` and `create_order()` had an ambiguous `id` reference.
- BUG-002: order list PostgREST embed to `profiles` was ambiguous.
- BUG-003/BUG-004: pickup and delivery embeds to `profiles` were ambiguous.
- BUG-005: item creation was not idempotent server-side and needed immediate client submit locking.
- BUG-006: order item editing showed too many simultaneous edit forms.

Current corrective diff:

- forward-only SQL migration replacing the affected helper/RPC definitions
- explicit PostgREST foreign-key embeds for orders, pickups and deliveries
- production-safe order-create error logging reduced to error code only
- item form submit lock and one-edit-form-at-a-time order item UI
- localized item edit/cancel labels

No remote operation, commit or push should be performed without explicit approval.

## Safety Notes

- Do not delete the owner Auth user.
- Do not recreate organization, location or membership.
- Do not reapply already-applied migrations.
- Do not run `supabase db reset --linked`.
- Do not use `migration repair` without a clear diagnosis.
- Do not place service-role keys in browser code or `NEXT_PUBLIC_*` variables.
- Keep `order-media` private.
- Do not commit `.env.local`.
- Keep `supabase/.temp/` ignored.
- Keep one task per commit.
- Do not use Docker unless a new decision explicitly approves it.
- Do not start new features before reviewing and committing INFRA-001-SMOKE closure.
- Do not change smoke-test staging data as part of the corrective commit.

## Next Task

Review and commit the INFRA-001-SMOKE corrective changes:

`INFRA-001-SMOKE fix: resolve staging smoke test blockers`

After that, keep any staging data cleanup or additional negative testing as a separate approved task.

Do not create demo data. Existing smoke records are intentional staging test records.

## Resume Commands

```bash
cd /Users/cristianomegale/EcoWash-Phoenix
git status --short
git branch --show-current
git log -8 --oneline --decorate
git ls-remote origin refs/heads/main
npm run lint
npm run build
git diff --check
```

URLs to verify:

```text
http://localhost:3000/it/login
http://localhost:3000/it/app
http://localhost:3000/it/app/customers
http://localhost:3000/it/app/services
http://localhost:3000/it/app/orders
```
