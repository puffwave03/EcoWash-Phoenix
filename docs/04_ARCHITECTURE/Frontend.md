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
