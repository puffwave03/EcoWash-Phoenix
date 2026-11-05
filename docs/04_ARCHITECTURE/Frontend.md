# Frontend

Status: Current implemented UI overview

Reconciled: 2026-11-05; repository checkpoint `d91dc9faba0f040055176a853afad3527f3a0813`.

## Current application surfaces

Next.js locale-prefixed public pages, authenticated staff surfaces and the separate customer Portal are implemented. The APP-era “not shown yet” statements below are historical. Use actual routes/components and [Project Status](../06_ROADMAP/Project_Status.md), not the old proposed route list, when extending navigation.

| Surface | Implemented behavior and boundary |
|---|---|
| Staff shell and access | Staff navigation/workspaces reflect existing role, capability and entitlement rules. Owner/Manager controls differ from operational Staff access. Portal has its own customer context/shell; hiding navigation is not a security boundary. |
| Terminal | Five independent Venta workspaces, recoverable drafts, registered/occasional customer handling and server-priced service selection. Existing counter acceptance/payment paths and EW print actions are implemented; broad offline resilience is not implied. |
| Orders | Customer/property links, commercial line snapshots, production/status history, logistics, payments/refunds and private photos. Customer notes/treatment warnings remain visible on the customer copy; confidential internal/item notes remain excluded through its explicit allowlist. Staff ticket preserves operational notes. |
| Production / quality / logistics | Capability-aware workspaces and assignment, production/quality/packing, inbound pickup and outbound delivery/handoff flows. Production completion means ready, not automatically fulfilled or paid. |
| Warehouse | Order-level inbound, placement/custody and movement views are implemented. This is not per-garment tracking; actual final handoff/storage exit remains distinct from production readiness. |
| Billing / financial control | Ordinary/simplified invoice UI, bounded advance/final paths and invoice printing; POS, Accounting, Customer Account and Daily Close are existing surfaces. FATTURATO and PAGATO remain independent. Fiscal scenario limitations are preserved, not resolved by screen availability. |
| Portal | Authenticated customer order list/detail, scoped financial presentation, property/service selection and order requests exist. Canonical customer context is separate from internal membership; no cross-context aggregation is implied. Online checkout has foundations, but the real provider adapter is unconfigured. |
| Printing | EW customer copy, staff ticket and labels are ordinary outputs. Ordinary REC issue buttons are absent; protected legacy receipt GET redirects without issue, preserving the Billing fiscal branch. Historical REC consultation/reprint remains. Future A4/thermal selection and copy counts are not completed by these views. |

Sources: [Terminal component](../../src/components/shop-terminal/ShopTerminalWorkspace.tsx), [Order types](../../src/features/orders/types.ts), [Warehouse route](../../src/app/[locale]/app/(dashboard)/warehouse/page.tsx), [Billing route](../../src/app/[locale]/app/(dashboard)/billing/page.tsx), [Portal readers](../../src/features/portal/server/queries.ts), [print renderer](../../src/components/printing/OrderPrintDocument.tsx). [Features](../01_PRODUCT/Features.md) and [Workflow](../01_PRODUCT/Workflow.md) retain the product/operational boundaries.

## Localization and acceptance limits

The established locales remain IT/ES/EN/FR/DE under `src/i18n/*/common.json`, using the existing locale routing. Reuse current translation namespaces and navigation patterns; a historical proposed URL is not evidence that its route exists.

Notes visibility and REC workflow have scoped PO visual/functional browser acceptance, indexed in [Testing](../05_DEVELOPMENT/Testing.md). They do not establish physical-printer or QR-scan acceptance, unauthorized-role negative browser UAT, general offline resilience or full security certification. Billing acceptance remains limited to recorded scenarios; the [Billing Event Contract](Billing_Event_Contract_001.md) and [Security](Security.md) retain open gates. Frontend existence does not establish production fiscal conformity or Production Readiness. This correction adds no new tests/UAT or implementation requirements.

## Historical original — 2026-08-01

The complete original below is preserved verbatim. Its APP-era exclusions, bootstrap state and next-task instructions are dated evidence, superseded only within the scopes clarified above. They do not authorize current execution.

<details>
<summary>Original 2026-08-01 guide — historical reference</summary>

# Frontend

Status: Active

Version: 0.1

Last Updated: 2026-08-01

Current Mission: RELEASE-001

---

## Purpose

Define the current frontend application boundary for the public website and protected dashboard foundation.

---

## Contents

## Public Website

The public website remains under locale-prefixed routes such as `/en`, `/it`, `/es`, `/fr`, `/de` and their contact pages. APP-004 does not modify homepage marketing components or public content.

## Authentication Routes

APP-004 added:

- `/[locale]/login`
- `/[locale]/app`
- `/[locale]/app/access-denied`

The login route uses a minimal branded form.

APP-005 adds the first protected operational module:

- `/[locale]/app/customers`
- `/[locale]/app/customers/new`
- `/[locale]/app/customers/[customerId]`
- `/[locale]/app/customers/[customerId]/edit`
- `/[locale]/app/customers/[customerId]/properties/new`
- `/[locale]/app/properties/[propertyId]`
- `/[locale]/app/properties/[propertyId]/edit`

Orders, payments, photos, services and operational metrics are not shown yet.

APP-006 adds protected routes for:

- `/[locale]/app/services`
- `/[locale]/app/services/new`
- `/[locale]/app/services/[serviceId]/edit`
- `/[locale]/app/orders`
- `/[locale]/app/orders/new`
- `/[locale]/app/orders/[orderId]`
- `/[locale]/app/orders/[orderId]/edit`

APP-007 adds sections to the existing order detail route:

- pickup and delivery scheduling/status controls
- manual payment summary and payment record list
- private order photo upload, preview by signed URL and logical removal

The APP-007 photo form accepts JPEG, PNG and WebP images up to 1 MB. The UI does not claim full image decoding or antivirus scanning; server validation checks MIME, derived extension and basic binary signatures before upload.

No additional analytics dashboard, customer portal, mobile UI or public website changes are included in APP-007.

APP-008 replaces the protected `/[locale]/app` placeholder with a real operational overview. The page uses existing dashboard shell navigation and shows summary cards, short work queues, logistics tasks, payment balances and recent activity. It links to existing order detail routes and does not alter homepage or marketing routes.

## Dashboard Shell

The dashboard shell displays:

- current user display name or email fallback
- active organization name
- active role
- logout button
- Overview navigation
- Customers navigation
- Orders navigation
- Services navigation

No module navigation is shown for unavailable features.

## PILOT-001 Route Architecture

PILOT-001 is architecture-approved and does not create routes. M1 route architecture is:

- `/[locale]/app`
- `/[locale]/app/orders`
- `/[locale]/app/customers`
- `/[locale]/app/services`
- `/[locale]/app/payments`
- `/[locale]/app/production`
- `/[locale]/app/production/orders/[orderId]`
- `/[locale]/app/delivery`
- `/[locale]/app/delivery/pickups`
- `/[locale]/app/delivery/deliveries`
- `/[locale]/app/delivery/tasks/[taskId]`
- `/[locale]/portal`
- `/[locale]/portal/orders`
- `/[locale]/portal/orders/[orderRef]`
- `/[locale]/portal/requests/new`
- `/[locale]/portal/access`

Do not introduce `/[locale]/app/admin` for M1. The existing `/[locale]/app` remains the administrative dashboard surface.

Production and delivery portals use internal membership auth. The customer portal uses a separate customer shell and must not reuse the internal app shell or organization membership.

## Localization

Login, logout, dashboard foundation, access-denied, customer, property, order, logistics, payment and photo text live in the existing locale files under `src/i18n/*/common.json`.

</details>
