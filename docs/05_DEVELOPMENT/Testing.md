# Testing

Status: Active

Version: 0.1

Last Updated: 2026-07-29

Current Mission: AUTH-001

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
