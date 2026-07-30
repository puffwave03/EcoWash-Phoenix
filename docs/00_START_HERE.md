# Start Here

Status: Active

Version: 0.1

Last Updated: 2026-07-30

Current Mission: INFRA-001.1

Next Action: Reconcile Supabase migration history and finalize smoke baseline

---

## Purpose

Start here when resuming EcoWash Phoenix work. This file identifies the current committed baseline and the exact next action.

---

## Current State

- Active branch: `main`
- Remote repository: `https://github.com/puffwave03/EcoWash-Phoenix.git`
- Latest approved and pushed development commit: `f94df88 INFRA-001-SMOKE fix: resolve staging smoke test blockers`
- Current mission: `INFRA-001.1 — Reconcile Supabase migration history and finalize smoke baseline`
- INFRA-001-SMOKE passed with non-blocking issues and is committed.
- Supabase Staging is connected and bootstrapped.
- Owner login, dashboard, customer, property, service, order, item, production, pickup, delivery, payment, photo and logout/login persistence were validated in staging.
- Smoke data remains on staging and must not be deleted before reconciliation.
- Remote SQL was applied manually during smoke; migration history verification is pending.
- UX-002 is only a following candidate task and is not started.
- Working tree is expected to be clean before starting INFRA-001.1.
- `main` and `origin/main` are expected to be synchronized at `f94df88`; verify with network.

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

“Buongiorno, riprendiamo EcoWash Phoenix da INFRA-001.1 e riconciliamo la migration history Supabase.”

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

Do not run migration commands until the target project and current migration history are verified. Do not use Docker. Do not start UX-002 until INFRA-001.1 is closed or explicitly paused.
