# Frontend

Status: Active

Version: 0.1

Last Updated: 2026-07-28

Current Mission: APP-006

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

Payments, logistics and photos are not shown yet.

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

## Localization

Login, logout, dashboard foundation, access-denied, customer and property text live in the existing locale files under `src/i18n/*/common.json`.
