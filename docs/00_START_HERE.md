# Start Here

Status: Active

Version: 0.1

Last Updated: 2026-08-21

Current Mission: Operational workspace access testing

Next Action: Wait for the Supabase Auth email rate limit to clear, then send one access link to Production Test

---

## Purpose

Start here when resuming EcoWash Phoenix work. This file identifies the current committed baseline and the exact next action.

---

## Current State

- Active branch: `main`
- Remote repository: `https://github.com/puffwave03/EcoWash-Phoenix.git`
- Latest approved and pushed commit: `ecf0c8a BUG-AUTH-005 fix: harden staff auth callback and rate-limit handling`
- Current mission: complete real staging validation of the Production, Quality and Delivery workspaces.
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
- Capability-aware logistics assignment is persistent and validated for Pickup with Speed.
- Staff invite, access-link and membership-removal UX is owner-only, organization-scoped and passwordless.
- Staff access to the legacy `/[locale]/app` dashboard redirects server-side to `/[locale]/app/work` before owner dashboard queries run.
- The Auth callback rejects invalid or stale links without silently preserving a different staff session and handles email rate-limit errors safely.
- Local development uses Next.js dev with Webpack for stable route behavior.
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
- Pickup was validated end to end with Speed. Production, Quality and Delivery functional checks are pending only because Supabase Auth email sending is currently rate-limited with `429 over_email_send_rate_limit`.
- Production Test has a valid Auth record. Do not classify it as malformed without new evidence.
- Clean staging fixtures are available: `TEST-PICKUP-01` for Speed, `TEST-PRODUCTION-01` for Production Test, and `TEST-QUALITY-01` plus `TEST-DELIVERY-01` for EcoWash staff test.
- Older staging test orders remain intentionally untouched because hard cleanup would require an unnecessarily invasive administrative procedure.
- Smoke data remains on staging.
- Supabase migration history reconciled successfully on 2026-07-30.
- `order-media` was verified as private with 1 MB image limit and JPEG/PNG/WebP allowlist.
- Working tree is expected to be clean before the next functional test.
- `main` and `origin/main` are synchronized at `ecf0c8a` before this documentation-only update.

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

“Buongiorno, riprendiamo EcoWash Phoenix dal test operativo staging. Verifichiamo prima se il rate limit email Supabase è terminato.”

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

When the email rate limit clears:

1. Send exactly one access link to Production Test.
2. Open only the newest email in a fresh incognito session.
3. Test `TEST-PRODUCTION-01`.
4. Test `TEST-QUALITY-01` with EcoWash staff test.
5. Test `TEST-DELIVERY-01` with EcoWash staff test.
6. Record only defects observed in the real functional or visual flow.
7. Do not create additional fixtures unless a verified gap requires one.
