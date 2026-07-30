# Testing

Status: Active

Version: 0.1

Last Updated: 2026-07-30

Current Mission: INFRA-001-SMOKE

---

## Purpose

Track required validation commands for the current EcoWash Phoenix implementation.

---

## Contents

## Current Quality Gates

Run before APP implementation review:

- `npm run lint`
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run build`
- `git diff --check`
- translation key parity check across `src/i18n/en`, `src/i18n/it`, `src/i18n/es`, `src/i18n/fr` and `src/i18n/de`

APP-007 does not run remote Supabase migrations, Docker or production deployment checks. Database behavior for RLS/RPC and Storage policies requires a real Supabase/PostgreSQL environment for execution testing.

APP-008.1 adds the `organizations.timezone` migration. Dashboard query behavior still requires a real Supabase/PostgreSQL environment with tenant data for full execution testing.

Validate dashboard “today” windows against the active organization timezone. The EcoWash default is `Atlantic/Canary`.

AUTH-001 also requires manual staging validation with Supabase Auth redirect URLs configured:

- forgot-password form sends a recovery email
- Supabase `over_email_send_rate_limit` / email rate-limit responses show a safe retry-later message
- recovery link opens `/{locale}/update-password`
- invalid or expired recovery links show a safe error
- mismatched or weak passwords are rejected
- successful update signs out the recovery session and redirects to login
- login succeeds with the new password
- no service-role key is used in browser or Server Actions

Current real-test status:

- AUTH-001 quality gates passed.
- Password recovery E2E completed.
- Owner login and `/it/app` access completed.
- INFRA-001-SMOKE completed with `PASS WITH NON-BLOCKING ISSUES`.

INFRA-001-SMOKE validated with real staging data:

- first customer
- first property
- first service/price
- first order
- pickup/delivery
- production transition
- payment
- photo
- populated dashboard
- logout/login persistence

Smoke checkpoints:

| Checkpoint | Area | Result |
| --- | --- | --- |
| 1 | Login and app shell | PASS |
| 2 | Customer | PASS |
| 3 | Property | PASS |
| 4 | Service and price | PASS |
| 5 | Order | PASS after corrective migration |
| 6 | Item and total | PASS after item UI correction and manual duplicate removal |
| 7 | Production | PASS |
| 8 | Pickup | PASS |
| 9 | Delivery | PASS |
| 10 | Payment | PASS |
| 11 | Photo | PASS |
| 12 | Dashboard | PASS |
| 13 | Logout/login | PASS |

Smoke bugs resolved in the corrective diff:

- BUG-001: `create_order` failed on staging due to `min(uuid)` and an ambiguous `id` reference.
- BUG-002: order list embed used an ambiguous `profiles` relationship.
- BUG-003/BUG-004: pickup and delivery embeds used ambiguous `profiles` relationships.
- BUG-005: item creation needed immediate repeated-submit protection.
- BUG-006: order item editing needed a single active edit form.

Known non-blocking gaps from the smoke run:

- Storage bucket privacy was not directly re-verified during the photo checkpoint, though the private bucket had been confirmed during INFRA-001.
- Negative MIME/size upload tests were not executed during this smoke run.
- Staging smoke records remain present and should only be cleaned up in a separate approved task.

## APP-007 Static Security Simulation

Expected outcomes before review:

- tenant A reads tenant B photos: DENIED
- tenant A uses tenant B order for logistics/payment/photo RPC: DENIED
- staff voids payment: DENIED
- owner voids payment with reason: ALLOWED
- refund greater than refundable amount: DENIED
- payment greater than balance due: DENIED
- duplicate payment submit that exceeds remaining balance: SAFE FAILURE
- delivery assigned to user from another tenant: DENIED
- direct payment update: DENIED
- direct manipulated photo metadata insert: DENIED
- Storage path cross-tenant upload/read: DENIED
- anonymous signed URL creation: DENIED
- expired signed URL access: SAFE FAILURE
- cancelled delivery to completed: DENIED
- completed delivery changes production: DENIED
- paid order changes production: DENIED
- photo deactivate preserves metadata: ALLOWED
- hard delete: DENIED
- inactive membership RPC: DENIED
- invalid MIME or size: DENIED
- logistics fee changes order total: DENIED, fee is informational in APP-007
- direct Storage object update/delete: DENIED
