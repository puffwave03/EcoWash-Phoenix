# Project Status

Status: Active

Version: 0.1

Last Updated: 2026-07-30

Current Mission: COMM-001

Next Action: finalize commercial roadmap priorities, then continue UX-002 app refinement

---

## Purpose

Track the current development state of EcoWash Phoenix and provide the handover context required to resume work safely.

---

## Contents

## Current Status

| Item | Status |
| --- | --- |
| Project | EcoWash Phoenix |
| Current phase | SaaS Platform Foundation — Implementation |
| Current milestone | Milestone 7 — SaaS Platform Foundation |
| Current mission | COMM-001 — Commercial roadmap extraction and prioritization |
| Last completed mission | UX-002.1 — Public login entry and mobile navigation clarity |
| Latest approved and pushed commit | d20a5d8 |
| Remote status | main synchronized with origin/main |
| DEV-010.4 status | Completed, committed and pushed |
| APP-001 status | Approved architecture and MVP definition |
| APP-002 status | Completed and pushed |
| APP-003 status | Completed and pushed |
| APP-004 status | Completed and pushed |
| APP-005 status | Completed and pushed |
| APP-006 status | Completed and pushed |
| APP-007 status | Completed and pushed |
| APP-008 status | Completed and pushed |
| APP-008.1 status | Completed and pushed |
| INFRA-001 status | Completed for EcoWash Staging bootstrap |
| AUTH-001 status | Completed and pushed |
| AUTH-001.1 status | Completed and pushed |
| AUTH-001-E2E status | Completed; owner password recovery/login verified |
| UX-001 status | Completed and pushed |
| INFRA-001-SMOKE status | Completed and pushed; passed with non-blocking issues |
| INFRA-001.1 status | Completed |
| UX-002 status | Next commercial UX task after roadmap documentation |
| UX-002.1 status | Completed and pushed |
| COMM-001 status | Documentation update in progress |
| Public website release state | Release-ready, deployment deferred |
| Production domain | Not selected or purchased yet |
| Backend/SaaS implementation | Supabase Staging connected, migrations applied, owner bootstrap created; owner login verified; first real operational smoke test passed with non-blocking issues |
| Commercial readiness | MVP validated on staging; production readiness, business administration, search, reporting and customer-facing growth remain planned |

## Development Status

| Mission | Description | Status |
| --- | --- | --- |
| DEV-001 | Bootstrap Next.js public website | Completed |
| DEV-002 | Executive Luxury design foundation | Completed |
| DEV-002.5 | Internationalization foundation | Completed |
| DEV-003 | Multilingual homepage Hero | Completed |
| DEV-004 | Solutions, Services and Industries sections | Completed |
| DEV-005 | Complete multilingual public homepage | Completed |
| DEV-006 | Integrate official EcoWash logo | Completed |
| DEV-007 | Multilingual Contact and Demo Request page | Completed |
| DEV-008 | Public website navigation refinement | Completed |
| DEV-009 | Multilingual SEO and production readiness | Completed |
| DEV-009.5 | Visual Enrichment and Homepage Layout Upgrade | Completed |
| DEV-010.1 | Verified public release issue fixes | Completed |
| DEV-010.2 | SaaS preview and contact-form clarity fixes | Completed |
| DEV-010.3 | Homepage image optimization | Completed |
| DEV-010.4 | Favicon, app icons and social preview water mark | Completed |
| DEV-010 | Public Website Final Audit and Release Preparation | Release-ready, deployment deferred |
| APP-001 | EcoWash Application Architecture and MVP Definition | Approved |
| APP-002 | Order Domain and Database Design | Completed |
| APP-003 | Supabase Tenant Foundation and Security Baseline | Completed |
| APP-004 | Authentication and Roles | Completed |
| APP-005 | Customers and Properties | Completed |
| APP-006 | Orders and Workflow | Completed |
| APP-007 | Photos, Pickup, Delivery and Payments | Completed |
| APP-008 | Dashboard and Operational Overview | Completed |
| APP-008.1 | Organization Timezone Foundation | Completed |
| INFRA-001 | Supabase project connection and migration bootstrap | Completed for staging |
| AUTH-001 | Password recovery and update flow | Completed |
| AUTH-001.1 | Password reset error handling correction | Completed |
| AUTH-001-E2E | Complete real password recovery and first owner login | Completed |
| UX-001 | Protected app shell refinement and session handover | Completed |
| INFRA-001-SMOKE | First real operational smoke test | Completed and pushed; passed with non-blocking issues |
| INFRA-001.1 | Reconcile Supabase migration history and finalize smoke baseline | Completed |
| UX-002 | App landing/dashboard and operational layout refinement | Next |
| UX-002.1 | Public login entry and mobile navigation clarity | Completed |
| COMM-001 | Commercial roadmap extraction and prioritization | In progress |

## Commit History

| Mission | Commit |
| --- | --- |
| DEV-001 | 9b6a030 |
| DEV-002 | 2a68b72 |
| DEV-002.5 | d6e7692 |
| DEV-003 | 4dd528d |
| DEV-004 | 5d692f0 |
| DEV-005 | 68dd15e |
| DEV-006 | f13938f |
| DEV-007 | 076d473 |
| DEV-008 | 22a6075 |
| DEV-009 | 2026943 |
| DEV-009.5 | 2834289 |
| DEV-010.1 | 4b89250 |
| DEV-010.2 | d89b443 |
| DEV-010.3 | aeb9268 |
| DEV-010.4 | 6ef5344 |
| APP-002 | 24e392d |
| APP-003 | d3e1f44 |
| APP-004 | d7e903b |
| APP-005 | 5639183 |
| APP-006 | b5a1c7c |
| APP-007 | 22f6cf0 |
| APP-008 | c62e7a0 |
| APP-008.1 | 210e1ad |
| INFRA-001 temp ignore | f881903 |
| AUTH-001 | f2e970a |
| DOCS-007 | 491091b |
| AUTH-001.1 | 6769365 |
| UX-001 | a607218 |
| INFRA-001-SMOKE | f94df88 |
| DOCS-008 | 6317c65 |
| DOCS-009 | 4ec74d3 |
| UX-002.1 | d20a5d8 |

## Documentation Commit History

| Mission | Commit |
| --- | --- |
| DOCS-001 | 5d509b8 |
| DOCS-002 | aa0f210 |
| DOCS-003 | eed5bcf |
| DOCS-004 | 038c9ff |
| DOCS-005 | 56e5125 |

## Known Validated State

- `npm run build` passes
- `npm run lint` passes
- `git diff --check` passes
- Homepage routes work in all five locales
- Contact routes work in all five locales
- Each localized Contact page has one `h1` and one form
- Development-stage notice is visible
- Homepage Contact and Demo links point to localized contact routes
- Multilingual SEO metadata is configured
- Canonical and alternate-language metadata is configured
- Sitemap and robots configuration exist
- Localized not-found experience exists
- Environment-based public site URL configuration exists
- Executive Luxury visual system is integrated
- Optimized WebP photographic imagery is integrated in Hero, Services, Industries and Final CTA
- Operational benefit band is integrated
- Final homepage image assets are real non-empty WebP files
- Favicon, site icon, Apple icon and Open Graph/Twitter preview image exist
- EcoWash product mark master SVG exists at `public/brand/ecowash-product-mark.svg`
- DEV-010.4 water mark is the current approved committed branding asset baseline pending any future visual revision request
- Decorative homepage imagery uses empty alt text where appropriate
- Content-bearing images use translated alt text
- Next.js Image is used for the final homepage photographic imagery
- Object-position decisions are set for responsive crops
- No visible photographic placeholders remain on the approved homepage
- No missing translation keys
- No horizontal overflow
- No new dependencies added during DEV-009.5, DEV-010.3 or DEV-010.4
- No Docker files or configuration added
- Local `main` and local `origin/main` point to `d20a5d8` at the current roadmap audit baseline.

## DEV-009.5 Completed State

- Technical implementation completed
- Visual completion approved
- Final photographic assets integrated
- Ten homepage image assets are present in approved paths
- Technical validation passed before commit:
  - `npm run lint`
  - `npm run build`
  - `git diff --check`
- Five homepage and contact locales render
- One `h1` per localized homepage
- No broken image requests were found during review
- No hydration or console errors were found during review
- Commit `2834289` is pushed to `origin/main`

## DEV-010 Completed Work To Date

DEV-010 is the public website final audit and release-preparation phase. The following scoped follow-up missions are completed, committed and pushed:

- `DEV-010.1` fixed verified public release issues in metadata, contact-form clarity and localized content.
- `DEV-010.2` clarified SaaS preview claims and contact/demo behavior so the public site does not imply that backend, billing, payments, live data or a real submission endpoint already exist.
- `DEV-010.3` optimized homepage photographic assets to WebP and kept runtime image references aligned.
- `DEV-010.4` finalized favicon, app icons, Apple icon and Open Graph/Twitter preview assets using the EcoWash water mark.

Latest completed DEV-010 commit:

- `6ef5344 DEV-010.4 feat: replace site icons with EcoWash water mark`

Current DEV-010 state:

- Release-ready, deployment deferred.
- Lint and build have passed in the validated DEV-010 state.
- Production deployment is deferred until domain selection and purchase.
- SaaS foundation through APP-008.1 is implemented locally in the repository.
- Supabase EcoWash Staging is connected.
- The five approved migrations have been applied successfully to staging.
- Local and remote migration histories were aligned through APP-008.1 before smoke.
- Supabase migration history reconciled successfully on 2026-07-30.
- `order-media` Storage bucket exists and is private with 1 MB image limit.
- First owner Auth user, profile, organization, location and owner membership exist in staging.
- APP-001 is approved.
- APP-002 is completed and pushed.
- APP-003 is completed and pushed.
- APP-004 is completed and pushed.
- APP-005 is completed and pushed.
- APP-006 is completed and pushed.
- APP-007 is completed and pushed.
- APP-008 is completed and pushed.
- APP-008.1 is completed and pushed.
- INFRA-001 staging bootstrap is completed.
- AUTH-001 is completed and pushed.
- AUTH-001.1 is completed and pushed.
- AUTH-001-E2E is completed; owner password recovery, login and `/it/app` access were verified.
- UX-001 is completed and pushed.
- INFRA-001-SMOKE passed on EcoWash Staging and is committed at `f94df88`.
- INFRA-001.1 reconciled migration history after the manual SQL correction used during smoke.
- UX-002 is the next approved task.
- UX-002.1 is completed and pushed; the public homepage has localized protected-app entry from desktop and mobile navigation.

## Commercial Roadmap State

The staging MVP is operationally validated, but not yet commercial-ready. The next product work should prioritize features that make the current app reliable, administrable and demonstrable before adding broad future modules.

Priority 1 — Sellable operations baseline:

- UX-002 app landing, dashboard hierarchy and operational layout refinement
- production deployment readiness
- repeatable smoke test checklist
- full Supabase RLS, Storage and browser-secret audit

Priority 2 — business administration:

- owner-managed staff invitations and membership lifecycle
- organization and location settings
- service catalog and price management hardening
- user-facing audit trail for sensitive changes

Priority 3 — operational speed:

- global search across orders, customers, properties and services
- production queue filters, assignment views and staff worklists
- notes and structured issues
- QR order lookup without personally identifiable information

Priority 4 — management reporting:

- daily payment close by currency and method
- open balance and overdue collection reports
- service volume and order throughput summaries
- CSV export for accounting or operational handoff

Priority 5 — customer-facing and advanced growth:

- customer self-service portal
- online payment providers
- fiscal invoices and advanced PDFs
- customer notifications
- native mobile app
- OCR, advanced analytics, offline mode, Realtime and Edge Functions only after a verified need

Commercial scope guard:

- do not add customer-facing features before internal operations are stable
- do not combine currencies in financial reporting
- do not expose service-role credentials or privileged membership controls to browser code
- keep production, fulfillment, payment and issues as independent dimensions

## APP-007 Implementation State

APP-007 implements photos, pickup, delivery and manual payment foundations in implementation review:

- versioned migration for `pickups`, `deliveries`, `payments` and `order_photos`
- private Supabase Storage bucket `order-media`
- tenant-scoped Storage policies using `organization_id/order_id/random_uuid.ext`
- short-lived signed URLs generated on demand
- 1 MB JPEG/PNG/WebP upload path through Server Actions
- narrow PostgreSQL RPCs for logistics save/transition, payment record/void/refund and photo metadata registration/deactivation
- derived read-only payment summary from order total and valid payment records
- order detail sections for pickup/delivery, payments and order photos
- translation keys for English, Spanish, Italian, French and German

APP-007 keeps production, fulfillment and payment separate. `production_status = completed` still means only that production work is finished; delivery and payment can remain pending. Manual payment status is derived from confirmed and refunded payment records, void payments do not count, and overpayment is rejected for the MVP.

APP-007 does not implement analytics, push notifications, QR, OCR, fiscal invoices, PDF generation, online payment providers, customer portal, mobile app, Realtime, Edge Functions or APP-008 dashboard analytics.

APP-008 is completed and pushed.

## APP-008 Implementation State

APP-008 implements a protected operational dashboard overview:

- tenant-scoped summary metrics for open, late, express, on-hold and ready orders
- derived balance due total from valid manual payment records
- production, ready and on-hold queues with links to real orders
- pickup and delivery tasks scheduled for the organization timezone day window after APP-008.1
- logistics attention for overdue scheduled/in-progress pickup and delivery tasks
- payment overview and balances requiring attention
- recent activity from status history, payments, completed logistics tasks and photo uploads
- localized dashboard copy in English, Spanish, Italian, French and German

APP-008 does not add migrations, analytics forecasts, BI charts, exports, fiscal reporting, Realtime, notifications, customer portal or mobile app.

APP-008.1 added `organizations.timezone` with default `Atlantic/Canary` and uses it for dashboard “today” windows. The timezone is read server-side from membership context, validated at runtime with `Intl.DateTimeFormat`, falls back to `Atlantic/Canary`, converts local day boundaries to UTC and keeps the daily payment aggregate reserved to owner/manager.

APP-008 financial aggregates are role-limited in the server payload: owner/manager receive global balance and payment counts, while staff receives only per-order collection balances and statuses. Cross-currency totals remain separated by currency.

## INFRA-001 Staging Bootstrap State

INFRA-001 connected EcoWash Phoenix to Supabase EcoWash Staging and completed the initial database/bootstrap work:

- `.env.local` configured locally and ignored by Git.
- Supabase CLI login completed.
- Repository linked to staging.
- Migration dry-run passed.
- Five approved migrations applied successfully.
- Local and remote migration history aligned through APP-008.1 before the smoke corrective SQL.
- 15 tables verified in the Dashboard.
- `order-media` bucket created, private and limited to 1 MB.
- Bucket MIME allowlist: `image/jpeg`, `image/png`, `image/webp`.
- First owner Auth user created.
- `auth.users -> profiles` trigger verified.
- Organization `EcoWash La Tejita` created.
- Primary location created.
- Active owner membership created.
- Bootstrap verification queries passed.

Applied migrations:

- `20260727000100_app_003_tenant_foundation.sql`
- `20260728000100_app_005_customers_properties.sql`
- `20260728000200_app_006_orders_workflow.sql`
- `20260728000300_app_007_logistics_photos_payments.sql`
- `20260728000400_app_008_1_organization_timezone.sql`

Do not reapply these migrations. Do not run `supabase db reset --linked`.

## AUTH-001 Implementation State

AUTH-001 implemented password recovery and password update:

- localized forgot-password link from login
- `/{locale}/forgot-password`
- Supabase recovery email request
- `/{locale}/update-password`
- recovery code exchange through SSR
- temporary recovery cookie/session guard
- new password and confirmation form
- `supabase.auth.updateUser`
- sign-out after successful update
- login redirect after success
- translations for `en`, `es`, `it`, `fr`, `de`
- explicit handling for Supabase email rate-limit responses
- anti-enumeration recovery copy

AUTH-001 quality gates passed:

- `npm run lint`
- `npm run build`
- `git diff --check`
- translation parity

AUTH-001.1 corrected the residual forgot-password fall-through so non-rate-limit Supabase errors redirect to `temporaryError` instead of `sent`.

Real recovery E2E is complete: the owner password was updated, login succeeded and the real dashboard opened at `/it/app`.

## UX-001 Implementation State

UX-001 completed and pushed the protected application shell and handover state:

- dedicated full-height protected app shell under `/[locale]/app`
- protected navigation visually separated from the public website
- dashboard KPI summary rendered as top-level metric tiles instead of nested cards
- provisional dashboard foundation copy removed from `en`, `es`, `it`, `fr` and `de`
- application data logic unchanged
- no database, migration, Supabase remote or dependency changes

## INFRA-001-SMOKE State

INFRA-001-SMOKE validated the first real operational MVP path on EcoWash Staging:

- owner logout/login and protected app shell
- customer and property flow
- service price flow
- order creation and detail access
- order item creation, edit and removal
- production transitions through ready
- pickup and delivery completion
- partial and final cash payments
- photo upload and preview
- dashboard coherence after real activity

Result:

- `PASS WITH NON-BLOCKING ISSUES`

Corrective work committed in `f94df88`:

- `20260730000100_infra_001_smoke_fix_order_helper_and_embeds.sql` fixes `app_current_organization_id()` and `create_order()` without editing prior migrations; the retest validated order creation on staging.
- Order, pickup and delivery Supabase selects now use explicit foreign-key embeds where PostgREST saw multiple relationships to `profiles`.
- Order item UI blocks repeated submits immediately and shows only one edit form at a time.
- Diagnostic order-create logging was reduced to a production-safe error code only.

Smoke staging data remains present for UX and follow-up validation.

Migration history state:

- Supabase migration history reconciled successfully on 2026-07-30.
- The corrective SQL was applied manually in Supabase SQL Editor during smoke, and INFRA-001.1 reconciled the matching migration history entry.
- Do not rerun the corrective migration.

INFRA-001.1 read-only verification:

- `order-media` bucket exists, is private, has a 1 MB limit and allows JPEG, PNG and WebP.
- Smoke customer, property, service, order `EW-000001`, one active item, total `25,00 EUR`, production ready, completed pickup, completed delivery, payments totaling `25,00 EUR`, zero balance and one intake photo were verified.

Next approved task:

- `UX-002 — App landing/dashboard and operational layout refinement`

UX-002 will likely cover dashboard hierarchy, visual density, desktop/mobile operational layout, clearer login access from the public site, and simpler panels/actions. It must not change stable domain logic without a separate approved task.

## APP-002 Documentation State

APP-002 defined the initial order domain and database design for the future EcoWash MVP. It documents:

- organization-scoped, multi-tenant-ready data ownership
- owner, manager and staff roles for the MVP
- customers, properties, services, prices, orders and order items
- separated production, fulfillment, payment and issue models
- optional pickup and delivery per order
- manual payments and derived payment state
- order photos and private storage ownership principles
- RLS strategy and APP-003 security invariants
- audit log boundaries

APP-002 did not implement code, migrations, Supabase configuration, authentication, database tables or a SaaS dashboard.

## APP-003 Implementation State

APP-003 implements the Supabase tenant foundation only:

- versioned Supabase local configuration
- environment variables for Supabase URL and anon key
- browser and server Supabase client factories
- PostgreSQL tenant root table `organizations`
- operating site table `locations`
- application profile table `profiles`
- organization membership table `organization_memberships`
- MVP role enum for `owner`, `manager` and `staff`
- PostgreSQL helper functions for membership and role checks
- initial RLS policies for foundation tables

APP-003 does not implement login UI, signup UI, reset password, protected dashboard, customers, properties, services, orders, order items, payments, order photos, operational Storage buckets, pickup/delivery, notifications, OCR, PDF, Realtime, Edge Functions, customer portal or mobile app.

## APP-004 Implementation State

APP-004 implements authentication and role guards only:

- localized login route
- email/password login through Supabase SSR
- server-side logout
- session refresh in the existing Next.js proxy middleware
- protected dashboard route under `/[locale]/app`
- server-side current user, profile and membership loading
- server-side role helpers for `owner`, `manager` and `staff`
- access-denied route for authenticated users without operational access
- manual first-owner bootstrap documentation

APP-004 does not implement public signup, reset password, magic link, OAuth, MFA, customers, properties, services, orders, payments, order photos, pickup/delivery, Realtime, Edge Functions, customer portal or mobile app.

## APP-005 Implementation State

APP-005 implements the customers and properties module only:

- versioned migration for `customers` and `properties`
- customer type enum for `individual` and `business`
- property type enum for `apartment`, `holiday_home`, `hotel`, `business` and `other`
- tenant-scoped customer and property tables with RLS
- composite property/customer tenant foreign key
- logical deactivation through `is_active`
- protected customer list, create, detail and edit routes
- protected property create, detail and edit routes
- customer search and active/inactive filtering
- localized UI text in all five existing locales

APP-005 does not implement services, pricing, orders, order items, payments, order photos, operational Storage buckets, pickup/delivery, notifications, OCR, PDF, Realtime, Edge Functions, customer portal or mobile app.

## APP-006 Implementation State

APP-006 implements orders and production workflow only:

- versioned migration for `services`, `service_prices`, `orders`, `order_items` and `order_status_history`
- service unit types for weight and piece services
- standard service pricing with order item snapshots
- server-side order number generation
- atomic RPCs for order creation, item mutation, discount update and production status transitions
- append-only production status history
- protected services and orders dashboard routes
- localized UI text in all five existing locales

APP-006 does not implement pickup, delivery, payments, order photos, proof photos, QR, OCR, notifications, invoices, PDFs, Realtime, Edge Functions, customer portal, mobile app or advanced analytics.

## Current Route Architecture

- `src/app/[locale]/`
- `src/app/[locale]/contact/`
- `src/app/[locale]/not-found.tsx`
- `src/app/[locale]/[...not-found]/page.tsx`
- `src/app/robots.ts`
- `src/app/sitemap.ts`

## Current Component Areas

- `src/components/`
- `src/components/home/`
- `src/components/contact/`

## Current i18n Areas

- `src/i18n/en/`
- `src/i18n/it/`
- `src/i18n/es/`
- `src/i18n/fr/`
- `src/i18n/de/`

## Current Public Website Status

- Homepage: complete first version
- Homepage visual enrichment: complete first version
- Contact page: complete presentation layer
- Official EcoWash logo: integrated
- Header and Footer: responsive and localized
- Navigation: localized homepage anchors and contact route
- Homepage anchors: `solutions`, `services`, `industries`, `value`, `principles`, `contact`
- Hero, Services, Industries and Final CTA: optimized WebP photographic imagery integrated
- Operational benefit band: integrated
- SEO metadata: multilingual metadata, canonical and alternate links configured
- Brand/social assets: favicon, site icon, Apple icon and Open Graph/Twitter preview configured
- Sitemap: configured
- Robots: configured
- Not-found: localized experience configured
- Demo form backend: not implemented
- Public secondary pages: not implemented
- Deployment: deferred until production domain selection and purchase

Current routes:

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

Supported locales:

- `en`
- `it`
- `es`
- `fr`
- `de`

## Final Homepage Image Assets

The approved homepage image set is present, integrated and committed at these final paths:

Hero:

- `public/images/home/hero/industrial-laundry-background.webp`
- `public/images/home/hero/folded-white-linen.webp`
- `public/images/home/hero/folded-green-textiles.webp`

Services:

- `public/images/home/services/industrial-laundry.webp`
- `public/images/home/services/dry-cleaning.webp`
- `public/images/home/services/ironing-finishing.webp`

Industries:

- `public/images/home/industries/hotel-resort.webp`
- `public/images/home/industries/vacation-rental.webp`
- `public/images/home/industries/professional-laundry.webp`

Final CTA:

- `public/images/home/cta/green-linen-texture.webp`

These assets are real non-empty WebP files. They are integrated through Next.js Image with preserved aspect ratios. Decorative Hero imagery uses empty alt text. Services and Industries imagery uses translated alt text. Crop and object-position choices are deliberate for desktop, tablet and mobile layouts. Placeholder SVGs are not used as visible replacements where final photographic assets exist.

## Current Brand and Social Assets

The current site icon and social-preview set is committed at:

- `public/brand/ecowash-logo.png` — official full EcoWash logo used in Header, Footer and DashboardPreview
- `public/brand/ecowash-product-mark.svg` — master vector water mark for favicon/app/social assets
- `src/app/favicon.ico` — multi-size favicon
- `src/app/icon.png` — 512x512 site icon
- `src/app/apple-icon.png` — 180x180 Apple touch icon
- `public/social/ecowash-og.png` — 1200x630 Open Graph and Twitter preview image

The DEV-010.4 mark follows the Product Owner reference direction: green side form, blue central drop, blue lower wave and three bubbles. It does not use the old "EcoWash La Tejita" lockup, the old URL, or embedded raster artwork. Metadata paths are configured and verified for `/favicon.ico`, `/icon.png`, `/apple-icon.png` and `/social/ecowash-og.png`.

## Current Limitations

- Supabase tenant foundation exists
- Login UI exists
- Protected dashboard shell exists
- Customers/properties/services/orders/workflow/logistics/photos/payments/dashboard foundations exist
- Supabase Staging is connected and bootstrapped
- First real owner login after password recovery is complete
- First real operational smoke test passed on staging and corrective code is committed
- Supabase migration history reconciled successfully on 2026-07-30
- No staging deployment completed yet
- No public signup
- No real contact-form transmission
- No public contact-form email sending
- No analytics
- No billing
- No Realtime dashboard
- No production deployment
- No production domain selected or purchased
- No completed SaaS platform
- No Docker
- No pricing, legal or social pages
- No unsupported metrics, customer logos, certifications or marketing claims

## Important Project Rules

- One mission per commit
- Codex implements
- ChatGPT performs architectural review
- Product Owner approves
- No commit before approval
- No unnecessary Markdown files
- No Docker unless explicitly approved
- No new dependencies without justification
- No unsupported marketing claims
- No fake backend behavior
- No accidental reset of uncommitted approved work
- No hardcoded visible strings
- Identical translation-key structures
- Centralized design tokens must be reused
- Documentation-only commits must not include application changes
- Docs remain the single source of truth for architecture and business decisions
- No redesign of approved areas without a verified defect
- Check worktree before each mission
- Confirm local and remote `main` synchronization before new implementation

## Next Session

Restart phrase:

“Buongiorno, riprendiamo EcoWash Phoenix da UX-002 e rifiniamo la dashboard iniziale dell’area protetta.”

Exact starting state:

- Branch `main`
- Working tree expected to contain only INFRA-001.1 documentation closeout until committed
- Local `main` and local `origin/main` at `6317c65` before this documentation closeout
- Current release state is Release-ready, deployment deferred
- Production domain selection and purchase are still pending
- APP-001 is approved
- APP-002 is completed and pushed
- APP-003 is completed and pushed
- APP-004 is completed and pushed
- APP-005 is completed and pushed
- APP-006 is completed and pushed
- APP-007 is completed and pushed
- APP-008 is completed and pushed
- APP-008.1 is completed and pushed
- INFRA-001 staging bootstrap is completed
- AUTH-001 is completed and pushed
- AUTH-001.1 is completed and pushed
- AUTH-001-E2E is completed; owner login and `/it/app` access succeeded
- UX-001 is completed and pushed
- INFRA-001-SMOKE passed with non-blocking issues and is committed
- INFRA-001.1 is completed
- UX-002 is next
- Do not modify approved migrations before real project verification
- Do not use Docker unless a new decision explicitly approves it
- Do not put service-role keys in browser-exposed code or env vars
- Do not apply migrations before verifying the target Supabase project and environment
- Do not reapply already-applied migrations
- Do not run `supabase db reset --linked`
- Keep one task per commit
- Do not change stable domain logic, migrations or Supabase remote state during UX-002 without a separate approved task
- Do not redesign the approved homepage unless a verified defect requires it

First checks:

1. Run:
   - `git status --short`
   - `git branch --show-current`
   - `git log -5 --oneline --decorate`
   - `git ls-remote origin refs/heads/main`
2. Read:
   - `README.md`
   - `docs/00_START_HERE/SESSION_HANDOVER.md`
   - `docs/06_ROADMAP/Project_Status.md`
   - `docs/06_ROADMAP/Milestones.md`
3. Review UX-002 scope and screenshots before changing UI.
4. Keep database, migrations and Supabase remote state unchanged.
5. Audit `/[locale]/app` landing/dashboard hierarchy, density and navigation.
6. Check public-site access to login.
7. Plan focused UI changes before implementation.
