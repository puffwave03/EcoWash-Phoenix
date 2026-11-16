# EcoWash Phoenix

EcoWash Phoenix is a multi-tenant laundry operations platform with a multilingual public website. EcoWash La Tejita is the first tenant/reference; tenant identity, catalog, pricing, currency, timezone and branding are configurable.

## Documentation and resume

- [Session Handover](docs/00_START_HERE/SESSION_HANDOVER.md): start here for current Git, protected work in progress and continuation.
- [Project Status](docs/06_ROADMAP/Project_Status.md): current implementation, UAT and outstanding release gates.
- [AGENTS.md](AGENTS.md): stable roles, safety, architecture and execution boundaries.
- [Features](docs/01_PRODUCT/Features.md): product/domain boundaries.
- [Workflow](docs/01_PRODUCT/Workflow.md): production, quality, custody, fulfillment and payment semantics.
- [Roadmap](docs/01_PRODUCT/Roadmap.md) and [Milestones](docs/06_ROADMAP/Milestones.md): approved targets/sequencing and historical evidence.
- [Git Workflow](docs/05_DEVELOPMENT/Git_Workflow.md): Git procedure; commit/push require explicit authorization.

The older README and Codex baseline are not a separate source for the next task. Always inspect actual Git state and reconcile dated findings with later implementation/UAT evidence before proposing work.

## Product overview

The existing application covers customer/order management, tenant catalogs/pricing, five Terminal Venta workspaces with drafts, production and quality, order-level Warehouse custody, pickup/handoff/delivery, POS payments/refunds, operational Accounting/Daily Close, Billing, browser printing and customer Portal workflows. The authoritative acceptance inventory and limitations are in Project Status; code existence is not production readiness.

Operational receipts are non-fiscal. Billing and tax-inclusive pricing are implemented foundations; simplified fiscal invoices and the external fiscal provider remain future separately approved work. Full fiscal compliance and commercial-production readiness are not claimed.

## Technical foundation

Next.js App Router, React, TypeScript, Tailwind CSS and next-intl; localized routes and IT / ES / EN / FR / DE system UI. Financial snapshots, server-derived tenant context and canonical locale/currency/time handling remain established boundaries.

The public contact/demo form is presentation-only; this does not describe the operational application's server/database functionality. Staging is separate from commercial production. Use Session Handover for the established targets and current release gates.

## Repository structure

- `src/`: application and public website.
- `tests/`: focused contracts and regression tests.
- `supabase/migrations/`: canonical migration history; reading a migration is not authorization to apply it.
- `docs/`: product decisions, architecture, operational references and historical evidence.

## Working method

Product Owner requirement → CTO scope/design → focused implementation → validation/evidence → CTO review → separately authorized staging/release → Product Owner acceptance. Preserve known WIP; do not commit, push or deploy automatically.

## License

Placeholder (TBD).

## Historical README — 2026-08-22

The complete original introduction/status below is retained as project history. Its “planned platform”, “No billing”, old SHA, QA-001 next-task proposal and early deployment/module limitations predate later implementations. They are not current execution instructions or an acceptance inventory.

<details>
<summary>Original README checkpoint — historical presentation and milestones</summary>

## Table of Contents

- [Project Overview](#project-overview)
- [Mission](#mission)
- [Current Status](#current-status)
- [Project Goals](#project-goals)
- [Repository Structure](#repository-structure)
- [Documentation](#documentation)
- [Development Methodology](#development-methodology)
- [License](#license)

## Project Overview

EcoWash Phoenix is the public website and planned SaaS platform foundation for EcoWash professional laundry operations.

## Mission

The purpose of EcoWash Phoenix is to establish a multilingual, premium public presence first, then continue into the SaaS platform with product decisions, architecture, and development work proceeding in a structured and traceable way.

## Current Status

| Area | Status |
| --- | --- |
| DEV-001 | Completed — Next.js public website foundation |
| DEV-002 | Completed — Executive Luxury design foundation |
| DEV-002.5 | Completed — Internationalization foundation |
| DEV-003 | Completed — Multilingual homepage Hero and dashboard preview |
| DEV-004 | Completed — Multilingual Solutions, Services and Industries sections |
| DEV-005 | Completed — Multilingual public homepage completion |
| DEV-006 | Completed — Official EcoWash logo integration |
| DEV-007 | Completed — Multilingual Contact and Demo Request page |
| DEV-008 | Completed — Public website navigation refinement |
| DEV-009 | Completed — Multilingual SEO and production readiness |
| DEV-009.5 | Completed — Homepage visual enrichment and photographic asset integration |
| DEV-010.1 | Completed — Verified public release issue fixes |
| DEV-010.2 | Completed — SaaS preview and contact-form clarity fixes |
| DEV-010.3 | Completed — Homepage image optimization |
| DEV-010.4 | Completed — Site icons and EcoWash water mark social preview |
| DEV-010 | Release-ready, deployment deferred — Public Website Final Audit and Release Preparation |
| APP-001 | Approved — EcoWash Application Architecture and MVP Definition |
| APP-002 | Completed — Order Domain and Database Design |
| APP-003 | Completed — Supabase Tenant Foundation and Security Baseline |
| APP-004 | Completed — Authentication and Roles |
| APP-005 | Completed — Customers and Properties |
| APP-006 | Completed — Orders and Workflow |
| APP-007 | Completed — Photos, Pickup, Delivery and Payments |
| APP-008 | Completed — Dashboard and Operational Overview |
| APP-008.1 | Completed — Organization Timezone Foundation |
| INFRA-001 | Completed — Supabase staging connection and migration bootstrap |
| AUTH-001 | Completed — Password recovery and update flow |
| AUTH-001.1 | Completed — Password reset error handling correction |
| UX-001 | Completed — Protected app shell refinement and session handover |
| INFRA-001-SMOKE | Completed and pushed — First real operational smoke test passed with non-blocking issues |
| INFRA-001.1 | Completed — Supabase migration history reconciled and smoke baseline finalized |
| UX-002 | Completed — App landing/dashboard and operational layout refinement |
| UX-002.1 | Completed — Public login access and mobile navigation clarity |
| UX-002.2 | Completed — Protected app shell and mobile navigation |
| UX-002.2.1 | Completed — Mobile CTA contrast correction |
| UX-002.3 | Completed — Dashboard hierarchy and quick actions |
| UX-002.4 | Completed — Order detail information architecture and mobile contrast |
| UX-002.5 | Completed — Final responsive and accessibility pass |
| COMM-001 | Completed — Commercial roadmap priorities |
| PRODUCT-001 | Completed — Commercial readiness and feature-gap audit |
| SEC-001 | Completed — Supabase security audit, remediation and authenticated mutation regression |
| RELEASE-001 | Deferred after staging validation — Production postponed until pilot product completion |
| OPS-001.1 | Completed — Production Queue MVP |
| OPS-001.2A | Completed — Completed logistics corrections |
| OPS-001.2B | Completed — Delivery Queue MVP |
| OPS-001.3 | Completed — Work Assignment MVP |
| OPS-001.4 | Completed — Staff Management MVP |
| PORTAL-001 / PORTAL-001.1 | Completed — Secure Customer Portal MVP |
| OPS-001.5 | Completed — Daily Close MVP |
| OPS-001.6 | Completed — Operational Alerts MVP |
| UX-OPS-001.3–001.8 | Validated — Operational workspaces, Control Center and Access & Capabilities |
| BUG-PROD-006 | Completed — Terminal operational transitions redirect to the correct workspace |
| UI-MOBILE-001 / UI-BUG-004 | Completed — Mobile logistics and desktop staff navigation refinement |
| UI-FORMAT-005 | Completed — Shared quantity, currency and numeric-input formatting |
| AUTH-INFRA-001 | Completed — Resend custom SMTP enabled and operational for Supabase Auth |

Current public website includes:

- Localized homepage
- Localized contact/demo-request page
- Official EcoWash logo
- Responsive Header and Footer
- Multilingual navigation and homepage anchors
- Executive Luxury design system
- Optimized WebP photographic imagery in Hero, Services, Industries and Final CTA sections
- Operational benefit band
- Static dashboard product preview
- Presentation-only demo request form
- Client-side validation
- Multilingual SEO metadata
- Canonical and alternate-language metadata
- Sitemap and robots configuration
- Localized not-found experience
- Environment-based public site URL configuration
- Site favicon, app icons and Open Graph/Twitter social preview image
- No backend submission yet

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

Current technical foundation:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- next-intl
- ESLint
- Localized server rendering
- Locale-prefixed routes
- Centralized design tokens and site configuration
- Next.js Image for optimized public imagery
- No external UI framework
- No animation library
- No Docker

Important limitations:

- Supabase Staging is connected and migrations are applied
- Owner Auth/profile/organization/location/membership bootstrap exists in staging
- Password recovery code flow is implemented and verified end-to-end
- Owner login succeeds and the real dashboard is visible at `/it/app`
- Protected app shell refinement is completed
- First real operational smoke test passed on EcoWash Staging with non-blocking issues
- Smoke test corrective work is committed and pushed
- Supabase migration history reconciled successfully on 2026-07-30
- PRODUCT-001 commercial readiness and feature-gap audit is completed
- UX-002 app landing/dashboard and operational layout refinement is completed
- SEC-001 Supabase security audit is completed, including SEC-001.1 remediation and SEC-001.2 authenticated mutation regression
- Staging Vercel is online at `https://ecowash-phoenix-staging.vercel.app`
- Supabase Auth staging is configured and validated
- Production is intentionally deferred until the pilot product is functionally complete
- Internal production, delivery, assignment and staff-management MVPs are implemented
- Secure customer portal MVP is implemented with customer-scoped access, order visibility, logistics, customer-visible photos and owner/manager access management
- Daily Close MVP is implemented for owner/manager operational review with organization-scoped KPI sections and order links
- Operational Alerts MVP is implemented for owner/manager issue triage with severity counts, navigation badge, direct order links and organization-scoped data
- Pickup, Production, Quality & Packing and Delivery have been validated end to end with capability-aware staff assignment, My Day visibility, dedicated detail flows, terminal transitions and final redirects without 404s
- Owner, manager and staff access boundaries have been validated; staff work requires both capability and assignment
- Supabase Custom SMTP is enabled through Resend for Auth email delivery; endpoint-specific Auth throttling still applies independently
- No contact-form email sending
- Contact form does not transmit data
- No Docker
- No analytics
- No billing
- No Realtime dashboard
- No real production environment or production deployment yet
- Production domain not selected or purchased yet
- No production-commercial SaaS release yet
- No pricing, legal or social pages
- No unsupported metrics, customer logos, certifications or marketing claims

Repository information:

- GitHub remote: `https://github.com/puffwave03/EcoWash-Phoenix.git`
- Branch: `main`
- Latest approved and pushed commit: `edebb79`
- Current mission: operational role/workspace validation is complete; select the next approved roadmap mission
- Current release state: staging online and validated; production deferred
- Next action: plan `QA-001`, the next existing M1/P0 gate, then let the Product Owner choose between full-app visual refinement and the next approved business module
- Handover: `docs/00_START_HERE/SESSION_HANDOVER.md`

Current visual direction:

- Executive Luxury
- Premium SaaS
- Hospitality-oriented
- Dark green, gold, and warm neutral palette
- Official EcoWash logo retained
- Centralized design tokens
- Responsive and accessible interface

Internationalization rules:

- Five supported locales: `en`, `it`, `es`, `fr`, `de`
- English is the default locale
- Browser-language detection is enabled
- Locale-prefixed URLs are mandatory
- No user-visible text should be hardcoded in React components
- Translation files must maintain identical key structures
- Data-domain values must remain language-independent

## Project Goals

- Define the product scope and platform objectives.
- Document the domain model, entities, and business rules.
- Establish the database and architecture design before implementation.
- Capture decisions and project status in a consistent documentation structure.
- Prepare the repository for future development, testing, and deployment work.

## Repository Structure

- `docs/` - Project documentation, planning materials, architecture notes, and development references.
- `diagrams/` - Visual diagrams for architecture, workflows, data models, and related planning artifacts.
- `assets/` - Supporting assets and reference materials used during planning and documentation.
- `examples/` - Example inputs, outputs, or reference materials used to clarify expected behavior.

The docs directory is the single source of truth for all architectural and business decisions.

## Documentation

All architectural decisions are documented before implementation. Documentation is used to define scope, capture approvals, and maintain a reliable project record as the platform evolves.

## Development Methodology

Planning → Architecture → Approval → Implementation → Testing → Deployment

## License

Placeholder (TBD)

---

Document Status: Active

Last Updated: 2026-08-22

Current Mission: Operational role/workspace phase validated

Next Action: prepare QA-001 and select the next approved product phase

</details>
