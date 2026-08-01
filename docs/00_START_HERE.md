# Start Here

Status: Active

Version: 0.1

Last Updated: 2026-08-01

Current Mission: RELEASE-001

Next Action: Define RELEASE-001.1 staging hosting and environment contract

---

## Purpose

Start here when resuming EcoWash Phoenix work. This file identifies the current committed baseline and the exact next action.

---

## Current State

- Active branch: `main`
- Remote repository: `https://github.com/puffwave03/EcoWash-Phoenix.git`
- Latest approved and pushed commit: `2cca68f PILOT-001 docs: define portal roles routes and authorization boundaries`
- Current mission: `RELEASE-001 — Production deployment readiness`
- INFRA-001-SMOKE passed with non-blocking issues and is committed.
- INFRA-001.1 is completed.
- PRODUCT-001 is completed and pushed.
- SEC-001 is completed.
- SEC-001.1 is completed, applied to staging and pushed.
- SEC-001.2 authenticated mutation regression passed.
- PILOT-001 architecture is approved and canonicalized.
- RELEASE-001 audit result is `READY WITH BLOCKERS`; production is not ready yet.
- UX-002 is completed and pushed through UX-002.5.
- UX-002.1 is completed and pushed.
- UX-002.2 is completed and pushed.
- UX-002.3 is completed and pushed.
- UX-002.4 is completed and pushed.
- UX-002.5 is completed and pushed.
- COMM-001 commercial roadmap priorities are completed and pushed.
- Supabase Staging is connected and bootstrapped.
- Owner login, dashboard, customer, property, service, order, item, production, pickup, delivery, payment, photo and logout/login persistence were validated in staging.
- Smoke data remains on staging.
- Supabase migration history reconciled successfully on 2026-07-30.
- `order-media` was verified as private with 1 MB image limit and JPEG/PNG/WebP allowlist.
- Working tree is expected to be clean before RELEASE-001 work.
- `main` and `origin/main` are expected to be synchronized at `2cca68f`.

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

“Buongiorno, riprendiamo EcoWash Phoenix da RELEASE-001.1 e definiamo hosting staging ed environment contract.”

Start by confirming:

1. `git status --short`
2. `git branch --show-current`
3. `git log -10 --oneline --decorate`
4. `git ls-remote origin refs/heads/main`

Then read:

- `README.md`
- `docs/00_START_HERE.md`
- `docs/00_START_HERE/SESSION_HANDOVER.md`
- `docs/05_DEVELOPMENT/Testing.md`
- `docs/05_DEVELOPMENT/Deployment.md`
- `docs/04_ARCHITECTURE/Security.md`
- `docs/03_DATABASE/Database_Design.md`
- `docs/06_ROADMAP/Project_Status.md`
- `docs/06_ROADMAP/Milestones.md`

Do not run destructive Supabase commands for RELEASE-001. Do not use Docker. Do not modify code, stable domain logic, routes, migrations or Supabase remote state unless a separate approved implementation task explicitly authorizes it.
