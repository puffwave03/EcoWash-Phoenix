# EcoWash Phoenix

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
| INFRA-001-SMOKE | Passed with non-blocking issues — First real operational smoke test |

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
- Smoke test corrective work is pending review and commit
- No contact-form email sending
- Contact form does not transmit data
- No Docker
- No analytics
- No billing
- No Realtime dashboard
- No production deployment yet
- Production domain not selected or purchased yet
- No completed SaaS platform
- No pricing, legal or social pages
- No unsupported metrics, customer logos, certifications or marketing claims

Repository information:

- GitHub remote: `https://github.com/puffwave03/EcoWash-Phoenix.git`
- Branch: `main`
- Latest approved and pushed development commit: `a607218`
- Current mission: `INFRA-001-SMOKE — First real operational smoke test closure`
- Current release state: Release-ready, deployment deferred
- Next macro-task: review and commit INFRA-001-SMOKE corrective changes, then keep staging cleanup/test follow-up separate

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

Last Updated: 2026-07-30

Current Mission: INFRA-001-SMOKE

Next Action: review and commit smoke-test fixes and documentation
