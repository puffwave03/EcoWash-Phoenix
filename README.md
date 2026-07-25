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

EcoWash Phoenix is a planned platform for organizing and documenting the EcoWash product, domain, architecture, and development approach before implementation begins.

## Mission

The purpose of EcoWash Phoenix is to establish a clear, approved foundation for the project so that product decisions, architecture, and development work can proceed in a structured and traceable way.

## Current Status

| Area | Status |
| --- | --- |
| DEV-001 | Completed — Next.js public website foundation |
| DEV-002 | Completed — Executive Luxury design foundation |
| DEV-002.5 | Completed — Internationalization foundation |
| DEV-003 | Completed — Multilingual homepage Hero and dashboard preview |

Current technical foundation:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- next-intl
- ESLint
- Five locales: English, Italian, Spanish, French, German

Current visual direction:

- Executive Luxury
- Premium SaaS
- Hospitality-oriented
- Dark green, gold, and neutral palette
- Existing EcoWash logo retained as the brand reference
- Current website implementation still uses the approved placeholder where applicable

Internationalization rules:

- Locale-prefixed URLs: `/en`, `/it`, `/es`, `/fr`, `/de`
- English is the default locale
- Browser-language detection is enabled
- No user-visible text should be hardcoded in React components
- Translation files must maintain identical key structures

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

Last Updated: 2026-07-25

Next Development Mission: DEV-004
