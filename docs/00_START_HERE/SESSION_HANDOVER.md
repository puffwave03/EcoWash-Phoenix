# Session Handover

Status: Active

Date: 2026-07-29

Repository: `/Users/cristianomegale/EcoWash-Phoenix`

Branch: `main`

Last completed commit: `210e1ad APP-008.1 feat: add organization timezone foundation`

Working tree status: clean at handover start; documentation update pending for `DOCS-006`

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

## APP-008 Summary

APP-008 implemented the real protected operational dashboard:

- open, overdue, express, on-hold and ready orders
- production queue
- pickup and delivery lists
- logistics attention
- payment overview
- balances requiring attention
- recent activity
- tenant isolation on every server query
- global financial aggregates only for owner/manager
- per-order operational financial data available to staff
- currency-separated amounts with no cross-currency aggregation
- no demo data
- no Realtime

## APP-008.1 Summary

APP-008.1 added the organization timezone foundation:

- migration for `organizations.timezone`
- SQL type `text not null`
- default `Atlantic/Canary`
- nonblank database constraint
- timezone included in server-side membership loading
- `CurrentMembership` updated with `organization.timezone`
- runtime validation through `Intl.DateTimeFormat`
- safe fallback to `Atlantic/Canary`
- local organization day boundaries converted to UTC
- pickup, delivery and payments-today windows based on organization timezone
- `paymentsToday` queried directly by time interval
- daily financial aggregate query reserved to owner/manager

No migration has been applied to a real Supabase project yet.

## Security Decisions

- Tenant scope remains enforced server-side through membership organization.
- Browser input must not be used as authority for `organization_id` or organization timezone.
- Staff must not receive global financial aggregates.
- Service-role keys must never be exposed to browser code or public environment variables.
- Approved migrations must not be modified before real project verification.
- Keep one task per commit.

## Supabase Remote State

Not yet done:

- real Supabase project created or selected
- remote environment configured
- migrations applied
- real EcoWash organization created
- primary location created
- owner user and membership created
- first real login completed
- full end-to-end test completed
- staging deployment completed

Docker is not required and must not be used unless a new explicit decision changes this.

## Next Approved Phase

`INFRA-001 — Supabase project connection and migration bootstrap`

This is not a new application module and must not be treated as feature work.

Operational sequence:

1. Create or select the definitive Supabase project.
2. Retrieve the correct URL and public anon key.
3. Configure `.env.local` without exposing secrets.
4. Link Supabase CLI to the verified project.
5. Verify migration order.
6. Apply all approved migrations.
7. Check tables, enums, RLS, RPC, grants and Storage bucket state.
8. Create the EcoWash organization.
9. Create the primary location.
10. Create the owner user and membership.
11. Perform the first real login.
12. Test the full end-to-end flow.

## Risks To Avoid

- Do not modify approved migrations unless a verified blocker requires a new corrective migration.
- Do not apply migrations before verifying the target Supabase project and environment.
- Do not put service-role keys in browser code or `NEXT_PUBLIC_*` variables.
- Do not use Docker unless newly approved.
- Do not start APP-009 or any new application feature before real Supabase validation.
- Do not mix infrastructure bootstrap, bug fixes and feature work in one commit.

## Resume Commands

```bash
cd /Users/cristianomegale/EcoWash-Phoenix
git status --short
git branch --show-current
git log -5 --oneline --decorate
git ls-remote origin refs/heads/main
```
