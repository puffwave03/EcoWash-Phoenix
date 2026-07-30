# Testing

Status: Active

Version: 0.1

Last Updated: 2026-07-30

Current Mission: UX-002

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
- INFRA-001-SMOKE corrective work is committed at `f94df88`.
- INFRA-001.1 completed remote migration history reconciliation.
- Supabase migration history reconciled successfully on 2026-07-30.

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
| 1 | Login e app shell | PASS |
| 2 | Cliente | PASS |
| 3 | Proprietà | PASS |
| 4 | Servizio e prezzo | PASS |
| 5 | Ordine | PASS |
| 6 | Item e totale | PASS |
| 7 | Produzione | PASS |
| 8 | Pickup | PASS |
| 9 | Delivery | PASS |
| 10 | Payment | PASS |
| 11 | Photo | PASS |
| 12 | Dashboard | PASS |
| 13 | Logout/login | PASS |

Smoke final state:

- order `EW-000001`
- order total `25,00 EUR`
- production status `Pronto`
- pickup completed
- delivery completed
- balance zero after two payments
- one intake photo uploaded and previewed
- data persisted after logout/login

INFRA-001.1 read-only verification:

- `order-media` bucket exists
- `order-media` is private
- file size limit is 1 MB
- MIME allowlist contains JPEG, PNG and WebP
- `Cliente Smoke Test` present
- `Appartamento Smoke Test` present
- `Lavaggio e asciugatura test` present
- order `EW-000001` present
- one active order item
- order total `25,00 EUR`
- production status `Pronto`
- pickup completed
- delivery completed
- payments total `25,00 EUR`
- balance due `0,00 EUR`
- one active intake photo

Smoke bugs resolved in the corrective diff:

- BUG-001: `create_order` failed on staging due to `min(uuid)` and an ambiguous `id` reference.
- BUG-002: order list embed used an ambiguous `profiles` relationship.
- BUG-003/BUG-004: pickup and delivery embeds used ambiguous `profiles` relationships.
- BUG-005: item creation needed immediate repeated-submit protection.
- BUG-006: order item editing needed a single active edit form.

Known non-blocking gaps from the smoke run:

- Storage bucket privacy was not directly re-verified during the photo checkpoint, though the private bucket had been confirmed during INFRA-001.
- Negative MIME/size upload tests were not executed during this smoke run.
- Overpayment behavior was not documented with a definitive result.
- Payment actor visibility was not documented with a definitive result.
- Final read-only database verification via CLI completed during INFRA-001.1.
- Remote migration history is reconciled for the manually applied smoke corrective SQL.
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
