# Start Here

Status: Active

Version: 0.1

Last Updated: 2026-07-31

Current Mission: PRODUCT-001

Next Action: Close commercial readiness and feature-gap audit

---

## Purpose

Start here when resuming EcoWash Phoenix work. This file identifies the current committed baseline and the exact next action.

---

## Current State

- Active branch: `main`
- Remote repository: `https://github.com/puffwave03/EcoWash-Phoenix.git`
- Latest approved and pushed commit: `b0f6b81 agg documentazione`
- Current mission: `PRODUCT-001 — Commercial readiness and feature-gap audit`
- INFRA-001-SMOKE passed with non-blocking issues and is committed.
- INFRA-001.1 is completed.
- UX-002.1 is completed and pushed.
- COMM-001 commercial roadmap priorities are completed and pushed.
- Supabase Staging is connected and bootstrapped.
- Owner login, dashboard, customer, property, service, order, item, production, pickup, delivery, payment, photo and logout/login persistence were validated in staging.
- Smoke data remains on staging.
- Supabase migration history reconciled successfully on 2026-07-30.
- `order-media` was verified as private with 1 MB image limit and JPEG/PNG/WebP allowlist.
- Working tree is expected to be clean before PRODUCT-001 documentation changes.
- `main` and `origin/main` are expected to be synchronized at `b0f6b81`.

---

## Public Website

The public website currently includes a multilingual homepage, multilingual contact/demo-request page, official EcoWash logo, responsive Header and Footer, localized navigation, Executive Luxury design foundation, optimized WebP imagery in Hero, Services, Industries and Final CTA sections, operational benefit band, static dashboard preview, client-side form validation, multilingual SEO metadata, sitemap, robots configuration, environment-based public site URL configuration, localized not-found experience, favicon/app icons, and Open Graph/Twitter social preview assets.

Supported public routes:

- `/en`
- `/it`
- `/es`
- `/fr`
- `/de`
- `/en/contact`
- `/it/contact`
- `/es/contact`
- `/fr/contact`
- `/de/contact`

Protected staging routes to verify when needed:

- `/it/login`
- `/it/app`
- `/it/app/customers`
- `/it/app/services`
- `/it/app/orders`

---

## Next Session

Restart phrase:

“Buongiorno, riprendiamo EcoWash Phoenix da PRODUCT-001 e chiudiamo la roadmap commerciale canonica.”

Start by confirming:

1. `git status --short`
2. `git branch --show-current`
3. `git log -10 --oneline --decorate`
4. `git ls-remote origin refs/heads/main`

Then read:

- `README.md`
- `docs/00_START_HERE.md`
- `docs/00_START_HERE/SESSION_HANDOVER.md`
- `docs/05_DEVELOPMENT/Setup.md`
- `docs/05_DEVELOPMENT/Testing.md`
- `docs/06_ROADMAP/Project_Status.md`
- `docs/06_ROADMAP/Milestones.md`

Do not run migration commands for PRODUCT-001. Do not use Docker. Do not modify code, stable domain logic, migrations or Supabase remote state during PRODUCT-001.
