# Testing

Status: Active

Version: 0.1

Last Updated: 2026-07-28

Current Mission: APP-006

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

APP-006 does not run remote Supabase migrations, Docker or production deployment checks. Database behavior for RLS/RPC requires a real Supabase/PostgreSQL environment for execution testing.
