# Start Here

Status: Active

Version: 0.1

Last Updated: 2026-08-22

Current Mission: Operational role/workspace phase validated

Next Action: Prepare QA-001, then select the next approved product phase

---

## Purpose

Start here when resuming EcoWash Phoenix work. This file identifies the current committed baseline and the exact next action.

---

## Current State

- Active branch: `main`
- Remote repository: `https://github.com/puffwave03/EcoWash-Phoenix.git`
- Latest approved and pushed commit: `edebb79 UI-FORMAT-005 feat: normalize quantity and currency formatting`
- Current mission: preserve the validated operational baseline and select the next approved roadmap mission.
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
- OPS-001.5 is completed: Daily Close dashboard for owner/manager operational review.
- OPS-001.6 is completed: Operational Alerts dashboard for owner/manager issue triage.
- UI-001 and UI-003 are completed, including consistent high-contrast operational primary actions.
- UX-OPS-001.3 through UX-OPS-001.8 are completed: Pickup, Production, Quality & Packing, Delivery, Owner Operations Control Center, and Access & Capabilities Management.
- Pickup, Production, Quality & Packing and Delivery are validated end to end: staff assignment, capability, My Day, workspace, activity detail, intermediate and terminal transitions, and final redirect without 404.
- BUG-PROD-006 redirects terminal Production, Quality, Pickup and Delivery transitions to their valid workspace routes.
- Capability-aware assignment is persistent, uses explicit profile relations and separate Pickup/Delivery lists, and is validated across order detail, My Day and workspaces.
- Staff invite, access-link and membership-removal UX is owner-only, organization-scoped and passwordless.
- Staff access to the legacy `/[locale]/app` dashboard redirects server-side to `/[locale]/app/work` before owner dashboard queries run.
- The Auth callback rejects invalid or stale links without silently preserving a different staff session and handles email rate-limit errors safely.
- Local development uses `next dev --webpack` to avoid the stale Turbopack route-manifest/runtime 404 behavior observed on localized Orders routes; the production build remains unchanged.
- UI-MOBILE-001, UI-BUG-004 and UI-FORMAT-005 are completed: mobile logistics parity, readable desktop staff navigation and shared quantity/currency/input formatting.
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
- Operational test accounts are Speed for Pickup, Production Test for Production, Quality Test for Quality & Packing, Delivery Test for Delivery and Manager Test for manager boundaries. No credentials belong in documentation.
- Clean staging fixtures are available and validated: `TEST-PICKUP-01`, `TEST-PRODUCTION-01`, `TEST-QUALITY-01` and `TEST-DELIVERY-01`.
- Resend Custom SMTP is enabled and operational for Supabase Auth using the verified `ecowashlatejita.com` domain and `access@ecowashlatejita.com` sender. The configured Auth email limit is 30 emails/hour; endpoint-specific throttling can still apply.
- Older staging test orders remain intentionally untouched because hard cleanup would require an unnecessarily invasive administrative procedure.
- Smoke data remains on staging.
- Supabase migration history reconciled successfully on 2026-07-30.
- `order-media` was verified as private with 1 MB image limit and JPEG/PNG/WebP allowlist.
- Working tree is expected to be clean before the next functional test.
- `main` and `origin/main` are synchronized at `edebb79` before this documentation-only update.

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
- `/it/app/control`
- `/it/app/work`
- `/it/app/work/pickups`
- `/it/app/work/production`
- `/it/app/work/quality`
- `/it/app/work/deliveries`
- `/it/app/staff`
- `/it/app/daily-close`
- `/it/app/alerts`
- `/it/portal`
- `/it/portal/orders`

---

## Next Session

Restart phrase:

“Buongiorno, riprendiamo EcoWash Phoenix dalla fase operativa validata e scegliamo la prossima missione approvata della roadmap.”

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

Next planning sequence:

1. Preserve the four validated operational fixtures; do not create more unless a verified regression gap requires one.
2. Prepare `QA-001`, the repeatable smoke/regression checklist already approved as the next M1/P0 gate.
3. Let the Product Owner choose the following macro-phase: full-app visual/product refinement or the next approved business module in the roadmap.
4. Keep one task per logical commit and record only defects observed in real functional or visual review.
