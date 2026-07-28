# Entities

Status: Active

Version: 0.1

Last Updated: 2026-07-28

Current Mission: APP-006

---

## Purpose

List MVP domain entities with fields, relations, constraints and sensitivity.

---

## Contents

## Entity Detail

| Entity | Required fields | Optional fields | Deferred fields | Constraints and deletion | Sensitive data |
| --- | --- | --- | --- | --- | --- |
| `organizations` | `id`, `name`, `created_at` | `status`, `default_currency` | SaaS billing fields | Soft delete only after operational retention review | Business identity |
| `locations` | `id`, `organization_id`, `name`, `created_at` | address, phone, active flag | multi-location scheduling | Soft delete/deactivate if referenced | Address/contact |
| `profiles` | `id`, `auth_user_id`, `display_name`, `created_at` | phone, locale | avatar | Soft delete/deactivate; auth deletion handled separately | Personal identity |
| `organization_memberships` | `id`, `organization_id`, `profile_id`, `role`, `created_at` | active flag, invited_by | invitation workflow | Unique organization/profile; owner/manager changes audited | Role and access |
| `customers` | `id`, `organization_id`, `customer_type`, `display_name`, `is_active`, `created_by`, `created_at` | customer code, first/last name, company name, tax id, email, phones, billing address, preferred locale, notes | customer portal login, tags | Deactivate instead of hard delete; immutable organization and creator | Contact and billing data |
| `properties` | `id`, `organization_id`, `customer_id`, `name`, `is_active`, `created_by`, `created_at` | property code, property type, address, access instructions, contact name/phone, notes | property groups | Deactivate instead of hard delete; customer link must remain within same organization | Address/access notes |
| `services` | `id`, `organization_id`, `name`, `unit_type`, `active` | description, category, sort order | tax profile | Deactivate instead of delete when priced/ordered | Low |
| `service_prices` | `id`, `organization_id`, `service_id`, `unit_price`, `currency`, `effective_from` | `location_id`, `effective_to` | tax fields | Keep historical records; no destructive overwrite | Commercial pricing |
| `customer_service_prices` | `id`, `organization_id`, `service_id`, `unit_price`, `currency`, `effective_from` | `customer_id`, `property_id`, `effective_to` | contract approval flow | Use only for approved overrides; keep history | Commercial pricing |
| `orders` | `id`, `organization_id`, `location_id`, `order_number`, `customer_id`, `production_status`, `fulfillment_type`, totals, `currency`, `created_by`, timestamps | `property_id`, `due_at`, notes, `assigned_to` | invoice references | Soft delete/archive; cancellation preferred | Customer/order details |
| `order_items` | `id`, `order_id`, `service_id`, `description_snapshot`, `unit_type`, quantity, `unit_price_snapshot`, `line_total` | article/category, weight_initial, weight_final | tax snapshot | Delete only while order draft or with audit correction | Service details |
| `order_status_history` | `id`, `order_id`, `from_status`, `to_status`, `changed_by`, `changed_at` | reason, correction flag | workflow version | Append-only | Operational history |
| `pickups` | `id`, `order_id`, `status`, address snapshot, `scheduled_at` | `completed_at`, `assigned_to`, note, fee, proof photo | route optimization | Soft delete/cancel with audit | Address/logistics |
| `deliveries` | `id`, `order_id`, `status`, address snapshot, `scheduled_at` | `completed_at`, `assigned_to`, note, fee, proof photo | route optimization | Soft delete/cancel with audit | Address/logistics |
| `payments` | `id`, `order_id`, `amount`, `method`, `status`, `recorded_by`, `created_at` | `paid_at`, reference, note, proof photo | online provider ids | Void/refund records instead of deletion | Financial data |
| `order_photos` | `id`, `order_id`, `category`, `storage_path`, `uploaded_by`, `created_at` | issue/payment/delivery references, caption | retention policy | Soft delete metadata; storage cleanup audited | Images may contain PII |
| `notes` | `id`, `organization_id`, `entity_type`, `entity_id`, `body`, `visibility`, `created_by`, `created_at` | edited_at | customer portal visibility | Soft delete or version edits | Free text may contain PII |
| `order_issues` | `id`, `order_id`, `category`, `status`, `description`, `created_by`, `created_at` | resolution, resolved_by, resolved_at, photo reference | SLA/escalation | Resolve instead of delete | Disputes/damage details |
| `audit_logs` | `id`, `organization_id`, `actor_profile_id`, `action`, `entity_type`, `entity_id`, `created_at` | before/after summary, request metadata | sensitive access events | Append-only; no client update/delete | Security-sensitive |

## Unit Types

- `kg` supports decimal quantity.
- `piece` supports integer quantity.

Each order item keeps its own description, unit type, quantity, unit price and line total snapshot.
