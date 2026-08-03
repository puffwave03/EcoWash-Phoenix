# Start Here

Status: Active

Version: 0.1

Last Updated: 2026-08-03

Current Mission: OPS-001.5

Next Action: Implement the Daily Close MVP

---

## Purpose

Start here when resuming EcoWash Phoenix work. This file identifies the current committed baseline and the exact next action.

---

## Current State

- Active branch: `main`
- Remote repository: `https://github.com/puffwave03/EcoWash-Phoenix.git`
- Latest approved and pushed commit: `530cfe7 PORTAL-001 feat: add secure customer portal MVP`
- Current mission: `OPS-001.5 — Daily Close MVP`
- INFRA-001-SMOKE passed with non-blocking issues and is committed.
- INFRA-001.1 is completed.
- PRODUCT-001 is completed and pushed.
- SEC-001 is completed.
- SEC-001.1 is completed, applied to staging and pushed.
- SEC-001.2 authenticated mutation regression passed.
- PILOT-001 architecture is approved and canonicalized.
- RELEASE-001.2 staging deployment rehearsal completed with staging Auth validated.
- RELEASE-001.3 production design completed; production is deferred until the pilot product is functionally complete.
- OPS-001.1 through OPS-001.4 are completed: Production Queue, completed logistics corrections, Delivery Queue, Work Assignment and Staff Management.
- PORTAL-001 / PORTAL-001.1 is completed: secure customer portal, customer access management and staging-only customer preview.
- UX-002 is completed and pushed through UX-002.5.
- UX-002.1 is completed and pushed.
- UX-002.2 is completed and pushed.
- UX-002.3 is completed and pushed.
- UX-002.4 is completed and pushed.
- UX-002.5 is completed and pushed.
- COMM-001 commercial roadmap priorities are completed and pushed.
- Supabase Staging is connected, bootstrapped and aligned.
- Vercel staging is online at `https://ecowash-phoenix-staging.vercel.app`.
- Vercel staging indexing is disabled; `/robots.txt` returns `Disallow: /`.
- Supabase Auth staging is configured and validated.
- `SUPABASE_SERVICE_ROLE_KEY` is present only server-side for staff invitations and is not tracked.
- `ENABLE_STAGING_CUSTOMER_PREVIEW=true` is configured server-side on the staging Vercel project only.
- Owner login, dashboard, customer, property, service, order, item, production, pickup, delivery, payment, photo and logout/login persistence were validated in staging.
- Smoke data remains on staging.
- Supabase migration history reconciled successfully on 2026-07-30.
- `order-media` was verified as private with 1 MB image limit and JPEG/PNG/WebP allowlist.
- Working tree is expected to be clean before OPS-001.5 work.
- `main` and `origin/main` are expected to be synchronized at `530cfe7`.

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
- `/it/app/production`
- `/it/app/delivery`
- `/it/app/staff`
- `/it/portal`
- `/it/portal/orders`

---

## Next Session

Restart phrase:

“Buongiorno, riprendiamo EcoWash Phoenix da OPS-001.5 e implementiamo il Daily Close MVP.”

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

Do not run destructive Supabase commands. Do not use Docker. Do not modify Supabase remote state unless a separate approved implementation task explicitly authorizes it. Avoid repeating release audits already completed; follow the normal workflow: Cristiano describes the operational result, ChatGPT defines solution and prompt, Codex implements, lint/build, visual review, commit and push, staging deploy, next task.
