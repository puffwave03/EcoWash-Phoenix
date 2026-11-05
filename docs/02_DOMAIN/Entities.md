# Entities

Status: Verified core entity index

Reconciled: 2026-11-05, baseline `e511fcbf920ef8c6a05a8e8420fac853604e3880`.

The table lists important implemented records and selected relationships, not all columns, grants or indexes. Sources are versioned migrations, read statically; remote schema/deployment state was not inspected. Later migrations override foundation definitions. [Database Design](../03_DATABASE/Database_Design.md) owns the authorization supplement; [Business Rules](Business_Rules.md) and [Domain Model](Domain_Model.md) explain responsibilities without changing them.

## Verified records and evidence

| Entity / SQL name | Canonical responsibility / selected verified relationship | Source |
|---|---|---|
| `organizations`, `locations` | Tenant and sites; `locations.organization_id` FK to organization. | [Tenant foundation](../../supabase/migrations/20260727000100_app_003_tenant_foundation.sql) |
| `profiles`, `organization_memberships` | `profiles.id` references `auth.users.id` (not a separate `auth_user_id` column in the foundation). Membership links organization/profile with role; capabilities extend it. | [Foundation](../../supabase/migrations/20260727000100_app_003_tenant_foundation.sql), [capabilities](../../supabase/migrations/20260820000100_ux_ops_001_8_access_capabilities.sql) |
| `customer_portal_access` | `user_id` FK to Auth; `(organization_id, customer_id)` FK to customer. Portal association, not staff membership. | [Portal](../../supabase/migrations/20260803000100_portal_001_customer_portal.sql), [canonical context](../../supabase/migrations/20261005000200_portal_context_isolation_001.sql) |
| `organization_entitlements`, `platform_feature_catalog` | Tenant feature entitlement and catalog; role/capability alone is not every feature gate. | [Entitlements](../../supabase/migrations/20260827000200_entitlements_001_tenant_feature_access.sql) |
| `platform_admins`, `platform_audit_log` | Separate platform actor and platform audit records; not a generic tenant audit subsystem. | [Platform foundation](../../supabase/migrations/20260827000300_platform_admin_001_saas_control_center.sql) |
| `customers`, `properties` | Customer master and property; composite property/customer FK protects tenant. Contact/tax/address/access notes are sensitive. | [Customer/property foundation](../../supabase/migrations/20260728000100_app_005_customers_properties.sql) |
| `services`, `service_prices` | Service catalog and date/location-effective base `amount`, currency, active state. SQL service units `weight` / `piece`. | [Foundation](../../supabase/migrations/20260728000200_app_006_orders_workflow.sql), [versioned catalog prices](../../supabase/migrations/20261013000100_phoenix_unified_catalog_002j.sql) |
| `catalog_segments`, `catalog_segment_services`, `catalog_segment_categories` | Tenant customer catalog selection; customer segment association. | [Segment foundation](../../supabase/migrations/20260824000600_catalog_segments_001_customer_quick_catalogs.sql) |
| `catalog_segment_prices` | Effective segment/service/location override `amount`; tenant composite FKs to segment/service/location. | [Segment prices and resolver](../../supabase/migrations/20260827000100_pricing_segments_001_segment_price_overrides.sql) |
| `service_catalog_translations`, `category_catalog_translations` | Tenant catalog translations linked to service/category keys. | [Translations](../../supabase/migrations/20260901000100_catalog_productization_001_multilingual_catalog.sql) |
| `orders` | UUID/`order_number`, customer, nullable property/location, production status, `customer_notes`, `internal_notes`, `subtotal`, `discount_amount`, `total`, currency. | [Orders](../../supabase/migrations/20260728000200_app_006_orders_workflow.sql), [application mapping](../../src/features/orders/types.ts) |
| Order-local occasional identity | `walk_in_name` / `walk_in_phone` on order linked to technical customer; not a separate visitor table. | [Shared walk-in](../../supabase/migrations/20260902000200_terminal_customer_ux_001b_shared_walk_in.sql) |
| `order_items`, `order_status_history` | Tenant/order FKs; lines store `description`, `unit_type`, quantity, `unit_price`, `line_total`, notes. `service_id` nullable. Timeline stores from/to status, actor/time/reason. | [Order foundation](../../supabase/migrations/20260728000200_app_006_orders_workflow.sql) |
| `pickups`, `deliveries` | Separate tenant/order logistics records with assignment/address snapshots. Intake exception is in a later transition function. | [Logistics foundation](../../supabase/migrations/20260728000300_app_007_logistics_photos_payments.sql), [inbound sync](../../supabase/migrations/20260927000300_inbound_custody_sync_001.sql) |
| `order_customer_handoffs` | Tenant/order-linked final customer-handoff fact. | [Handoff foundation](../../supabase/migrations/20260913000200_order_final_handoff_001.sql), [storage exit](../../supabase/migrations/20260926000100_final_fulfillment_storage_exit.sql) |
| `warehouse_positions`, `order_storage`, `warehouse_movements` | Positions belong to location; storage links order/location/position with composite FKs; movement history references order/location. | [Storage foundation](../../supabase/migrations/20260920000300_warehouse_001a_data_foundation.sql), [movement history](../../supabase/migrations/20260927000400_warehouse_001e_a_movement_history.sql) |
| `payments` | Tenant/order ledger. Refunds are rows here, with self-FK `refunded_from_payment_id`; no separate refund table. Method/status/channel are separate fields. | [Payment foundation](../../supabase/migrations/20260728000300_app_007_logistics_photos_payments.sql), [current application type](../../src/features/payments/types.ts) |
| `pos_sessions` | Open/closed till and cash controls; nullable location FK. `payments` gains nullable tenant/session FK. | [POS foundation](../../supabase/migrations/20260827000400_pos_001_cash_register_foundation.sql), [payment boundary](../../supabase/migrations/20260930000200_pos_session_payment_boundary_001.sql), [refund boundary](../../supabase/migrations/20260930000300_pos_refund_channel_session_boundary_001.sql) |
| Manual external operations | Existing payment rows, not new tables. Sessionless Owner/Manager RPCs; reimbursement creates linked refund row. | [Payment RPC](../../supabase/migrations/20260930000400_manual_external_payment_001.sql), [refund RPC](../../supabase/migrations/20260930000500_manual_external_refund_001.sql) |
| `organization_online_payment_configs`, `online_payment_attempts`, `online_payment_provider_events` | Provider-neutral configuration/attempt/event state; attempt references order/customer/Auth user and nullable canonical payment. Production adapter remains unconfigured. | [Online foundation](../../supabase/migrations/20260828000200_payments_online_001_customer_checkout.sql), [provider factory](../../src/features/online-payments/providers/index.ts) |
| `daily_closes` | Immutable persisted business-day snapshot, scope/timezone/hash/version/idempotency; optional location FK. Not fiscal closure. | [Daily Close foundation](../../supabase/migrations/20260919000200_pos_daily_close_001_p2a.sql), [post-close gate](../../supabase/migrations/20260920000100_daily_close_post_close_gate_001.sql) |
| `suppliers`, `expense_categories`, `expenses` | Tenant expense-reporting records; expenses reference tenant supplier/category and optional location. Not proof of statutory accounting. | [Expenses foundation](../../supabase/migrations/20260830000200_accounting_001b_expenses_suppliers.sql) |
| `invoices`, `invoice_items`, `invoice_orders` | Billing document root, lines and order join; later recipient modes allow nullable `customer_id` for simplified snapshots, while ordinary requires a registered recipient. Items can reference source order item via composite FK; invoice-order join has FKs to both roots. | [Billing foundation](../../supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql), [tax-inclusive snapshots](../../supabase/migrations/20261007000200_billing_tax_inclusive_pricing_001.sql), [recipient modes](../../supabase/migrations/20261017000200_billing_simplified_invoice_001e_recipient_snapshot_foundation.sql) |
| `organization_billing_settings`, `billing_invoice_number_counters` | Tenant fiscal settings / canonical Billing number allocation. These counters are not the REC counters. | [Billing foundation](../../supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql), [document type](../../supabase/migrations/20261016000100_billing_simplified_invoice_001b_fiscal_type_foundation.sql), [series configuration](../../supabase/migrations/20261017000100_billing_simplified_invoice_001d_series_configuration.sql) |
| `billing_invoice_payment_links` | Composite FK to invoice/order/role association and to tenant/order/payment; explicit amount attribution. PK `(organization_id, payment_id)` limits attribution; not a generic many-to-many settlement engine. | [Link foundation](../../supabase/migrations/20261018000200_billing_simplified_invoice_001g_b_advance_link_foundation.sql) |
| `billing_advance_event_declarations` | Historical pre-service declaration referencing tenant/order/payment, amount/time snapshot and actor. Not itself a document or payment. | [Declaration foundation](../../supabase/migrations/20261018000300_billing_simplified_invoice_001g_c1_advance_event_foundation.sql) |
| `operational_receipts`, `operational_receipt_number_counters`, `sales_document_events` | Non-fiscal REC snapshots/counters and separate view/print-request history. Receipt FKs to order/customer; events target either receipt or Billing invoice. Counters are allocated by controlled emission, not a per-document FK shown in this index. | [Sales documents](../../supabase/migrations/20260908000100_accounting_sales_documents_001.sql), [current receipt route](../../src/app/[locale]/app/(dashboard)/orders/[orderId]/print/receipt/page.tsx) |
| EW print projection / `printer_profiles` | EW renders existing order context; no new EW-document table asserted. Profiles configure print presentation, not hardware-driver proof. | [Print context](../../src/features/printing/types.ts), [profiles](../../supabase/migrations/20260829000400_counter_ui_003_printer_profiles.sql) |
| `order_photos` | Tenant/order metadata; category, private bucket/path, active state and customer-visible flag. Storage bytes are separate from metadata FK graph. | [Photo foundation](../../supabase/migrations/20260728000300_app_007_logistics_photos_payments.sql), [Portal visibility](../../supabase/migrations/20260803000100_portal_001_customer_portal.sql), [Security](../04_ARCHITECTURE/Security.md) |

## Historical names that must not be treated as current schema

- `customer_service_prices`, generic `notes`, `order_issues`, `audit_logs`: **NOT VERIFIED** as implemented tables. The July proposal is not migration evidence. Verify the versioned migration history and corresponding module before using such names; use confirmed segment prices, note fields, status/document history and Platform audit where applicable. No new table is requested here.
- `subtotal_amount`, `total_amount`, `description_snapshot`, `unit_price_snapshot` and the old profile `auth_user_id` are historical design names, not substitutes for the verified SQL names above. TypeScript DTO names are not column names.
- Complete live constraints/index/grant inventory and live schema parity: **NOT VERIFIED in P2**; verify applicable migrations and a separately authorized schema inspection if needed. No production-readiness, fiscal or universal authorization claim follows from this index.

## Historical original — 2026-07-28

The complete original is preserved verbatim below. Proposed entities, old mission labels and obsolete payment/Portal descriptions are dated design evidence, not current instructions. The reconciliation above takes precedence only for its verified scope.

<details>
<summary>Original 2026-07-28 document — historical snapshot</summary>

# Entities

Status: Active

Version: 0.1

Last Updated: 2026-07-28

Current Mission: APP-007

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
| `pickups` | `id`, `organization_id`, `order_id`, `status`, address snapshot, `scheduled_at`, `created_by`, `updated_by` | `completed_at`, `started_at`, `assigned_to`, notes, fee, cancellation reason | route optimization | Cancel instead of delete; one active pickup per order in MVP | Address/logistics |
| `deliveries` | `id`, `organization_id`, `order_id`, `status`, address snapshot, `scheduled_at`, `created_by`, `updated_by` | `completed_at`, `started_at`, `assigned_to`, notes, fee, cancellation reason | route optimization | Cancel instead of delete; one active delivery per order in MVP | Address/logistics |
| `payments` | `id`, `organization_id`, `order_id`, `amount`, `method`, `status`, `paid_at`, `recorded_by`, `created_at` | reference, notes, proof photo, void/refund actor and reason fields | online provider ids, invoices | Void/refund records instead of deletion; no overpayment in MVP | Financial data |
| `order_photos` | `id`, `organization_id`, `order_id`, `category`, `storage_bucket`, `storage_path`, `mime_type`, `size_bytes`, `uploaded_by`, `created_at`, `is_active` | original filename, caption | retention policy | Logical deactivation; no public URL persisted | Images may contain PII |
| `notes` | `id`, `organization_id`, `entity_type`, `entity_id`, `body`, `visibility`, `created_by`, `created_at` | edited_at | customer portal visibility | Soft delete or version edits | Free text may contain PII |
| `order_issues` | `id`, `order_id`, `category`, `status`, `description`, `created_by`, `created_at` | resolution, resolved_by, resolved_at, photo reference | SLA/escalation | Resolve instead of delete | Disputes/damage details |
| `audit_logs` | `id`, `organization_id`, `actor_profile_id`, `action`, `entity_type`, `entity_id`, `created_at` | before/after summary, request metadata | sensitive access events | Append-only; no client update/delete | Security-sensitive |

## Unit Types

- `kg` supports decimal quantity.
- `piece` supports integer quantity.

Each order item keeps its own description, unit type, quantity, unit price and line total snapshot.

</details>
