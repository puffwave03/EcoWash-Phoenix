# Product Blueprint

Status: Active

Version: 0.1

Last Updated: 2026-07-27

Current Mission: APP-002

---

## Purpose

Capture the initial product blueprint for the EcoWash MVP before database or backend implementation.

---

## Contents

## Approved Direction

EcoWash Phoenix will remain a single Next.js App Router repository. The existing public website stays intact. The future protected operations dashboard should live under a locale-prefixed route such as `/[locale]/app`.

The first MVP is web responsive. There is no native Expo/mobile app in the MVP.

Supabase is the candidate backend for Auth, PostgreSQL, Storage and RLS, but APP-002 does not configure Supabase or write SQL.

## MVP Operating Model

The first operational system supports one EcoWash business in the UI while using a multi-tenant-ready schema. All operational records must belong to an organization directly or through an unambiguous parent relation.

Core users:

- `owner`
- `manager`
- `staff`

Deferred users:

- `driver`
- `customer`

In the first MVP, staff users may handle pickup and delivery tasks.

## Core Objects

- Organization
- Location
- Profile and membership
- Customer
- Property
- Service and price
- Order
- Order item
- Production status history
- Pickup
- Delivery
- Payment
- Photo
- Note
- Issue
- Audit log

## Non-Goals For APP-002

APP-002 does not import Lavanderia 2.0 schema, SQL, RLS, auth, storage policy, DataContext or backend assumptions. Lavanderia 2.0 remains a UX reference only.
