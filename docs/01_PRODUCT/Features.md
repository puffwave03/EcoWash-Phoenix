# Features

Status: Active

Version: 0.1

Last Updated: 2026-07-27

Current Mission: APP-002

---

## Purpose

Define the approved MVP feature boundary for the future EcoWash operations platform.

---

## Contents

APP-002 is documentation only. No backend, database, Supabase project, migrations, authentication or SaaS dashboard has been implemented yet.

## MVP Must Have

- Organization boundary for all operational data
- Owner, manager and staff profiles with role-based access
- Customer records
- Property/apartment records linked to customers
- Order creation and editing
- Order items for weight-based services and piece-based services
- Service catalog and effective pricing
- Production workflow with auditable state history
- Optional pickup and delivery per order
- Order photos for intake, processing, quality, issues, delivery and payment proof
- Manual payments
- Internal notes and future customer-visible notes
- Order issues/discrepancies separated from production status
- Search across orders, customers, properties and service status
- Base dashboard metrics from real operational records

## Post-Core Should Have

- QR order lookup without personally identifiable information
- More granular staff assignment views
- Location-specific operating views after a second location exists

## Later

- Customer self-service portal
- Native mobile app
- OCR
- Push notifications
- Online payment providers
- Fiscal invoices and advanced PDFs
- Advanced analytics
- Offline mode
- Generic workflow builder
- Realtime features
- Edge Functions unless a verified backend need appears

## Product Boundaries

- Payment status is economic and must remain separate from production status.
- Pickup and delivery are logistics concerns and must remain separate from production status.
- Issues do not replace the active production status. An order can be `washing` and still have an open issue.
- Current service prices may change, but each order item must keep a price snapshot for historical accuracy.
