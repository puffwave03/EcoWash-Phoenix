# Session Handover

Status: Active

Date: 2026-10-04

Session checkpoint: QUICK-DROP-UNPRICED-TICKET-STATUS-001 PRODUCT OWNER UAT PASS / 001E NEXT TO SCOPE / AUTH DR PRE-PRODUCTION BLOCKER

Repository: `/Users/cristianomegale/EcoWash-Phoenix`

Branch: `main`

Current repository baseline: `7ab6a51d513406adf933d13bb5966fc7608cbd41` (Quick Drop ticket fix; documentation closeout follows).

Origin/main status at the start of this documentation closeout: local `main` and `origin/main` were aligned at `7ab6a51d513406adf933d13bb5966fc7608cbd41`.

Working tree status at the start of this documentation task: clean.

Previous functional task: `DATA-RETENTION-AND-SCALE-001D` (`a0cccbfe792feb53471bf9b7f266afc6ca111efd`) — **COMPLETE / Product Owner UAT PASS**. Quick Drop pending-detail is an operational queue, not historical pagination. `public.list_pending_quick_drops()` has no organization argument: it derives tenant context server-side, enforces `require_shop_terminal_access`, and uses organization/order-scoped history and item predicates. It includes active received Orders with `received_at`, Quick Drop source evidence and zero active `order_items`, ordered `received_at DESC, id DESC`; no recent-history cap or SQL `LIMIT` determines discoverability. The complete queue supplies the count; Terminal initially shows at most five entries and offers Show all / Show fewer for the rest. No index, table, RLS, historical-data or Quick Drop workflow change. Staging operator reports migration `20261003000200_data_retention_scale_001d_quick_drop_pending_completeness.sql` applied to `exthnplfokcucaqydney`; production untouched. Product Owner created EW-000134, saw it immediately in the queue with the complete count and canonical Order link, then saw it leave the queue after adding items. Normal Quick Drop flow passed. The >5 control was covered by focused tests; staging was not artificially populated for manual UAT.

UAT hotfix: `ORDER-CANCELLED-PAID-WARNING-I18N-001` (`0da06331e1f94f8454cb032e582348f5477b2cb7`) — **COMPLETE / Product Owner UAT PASS**. Order detail retrieves `payments.cancelledPaidWarning` with `t.raw`, leaving `{amount}` for `PaymentsPanel` to replace with formatted `netCollected`. The Product Owner confirmed Order detail renders. Payment/refund semantics and database state are unchanged.

Latest functional task: `QUICK-DROP-UNPRICED-TICKET-STATUS-001` (`7ab6a51d513406adf933d13bb5966fc7608cbd41`) — **COMPLETE / Product Owner UAT PASS**. The internal live Ticket reads canonical Quick Drop `financialState` through `getQuickDropOrderOrNull` in `getPrintOrderContext`. An `unpriced` Quick Drop displays the existing localized `common.quickDrop.unpriced` label instead of generic “Paid”; priced Quick Drops and ordinary zero-value Orders keep the payment status from `getOrderPaymentSummary`. Receipt and labels are unchanged. No payment/refund math, `public.get_order_payment_summary`, database, schema, migration, RPC, Accounting or fiscal change; existing translations were reused.

Previous functional closeout: `DATA-RETENTION-AND-SCALE-001C` (`f4e0924809d544fadcb6d94102c0a245661e5157`) — **COMPLETE / Product Owner UAT PASS**. Orders History uses bidirectional keyset pagination: 25 visible Orders per page, at most 26 fetched with a sentinel, ordered by `created_at DESC, id DESC`. Older/Newer navigation preserves `q`, status, priority and active filters; filter changes reset pagination. There is no offset or total-count dependency. The cursor binds `createdAt`, `id`, direction and filters without organization identity; the tenant comes server-side from membership. Enrichment covers only the 25 visible Orders, never the sentinel; no generic pagination framework was added. Product Owner UAT passed on the reviewed local working tree against staging Supabase: traversal, newest-first ordering, no visible boundary duplicates or missing jumps, filter reset and pagination UX. Production was untouched.

Staging migration closeout (2026-10-03): release-rehearsal operator verification found `20261001000100_order_property_client_filter_001.sql` still pending remotely, contrary to the earlier documentation checkpoint. The staging operator then applied that migration and `20261003000100_data_retention_scale_001c_orders_history_index.sql` to `exthnplfokcucaqydney`; final Local = Remote history through `20261003000100`. The new `orders_org_created_id_idx` covers `(organization_id, created_at DESC, id DESC)`; existing `orders_list_idx` was preserved. Production was untouched.

Previous functional closeout: `RECEIPT-EMPTY-ORDER-UX-001` (`acd04ce4a0b6d891b04996e0645e9c3a41b6b4a7`) — **COMPLETE / Product Owner UAT PASS**. On staging, printing a receipt for an Order with no active items creates no operational receipt, returns to the usable Order detail and displays the existing localized `orderItemsRequired` warning instead of the generic Next.js server-error page. `public.issue_operational_receipt(uuid)` remains authoritative: only PostgreSQL `22023` with message `operational_receipt_items_required` becomes the controlled warning; unexpected receipt failures still fail visibly. Receipt numbering, immutable snapshots, idempotency/reuse, ticket and label printing, entitlement/capability checks, tenant isolation, Accounting, Billing, payments/refunds and fiscal behavior are unchanged. No migration, schema, RLS or RPC change; no Supabase commands and no production change.

Previous functional closeout: `ORDER-PHOTO-INLINE-VALIDATION-UX-001` (`a4d1c6b4b1f31ac7f1a7c9765dc8c740f43df781`) and `ORDER-PHOTO-UPLOAD-BOUNDARY-UX-001` (`b7fb9d686e8d7ec136cfe6369a341982ce3cf611`) — **COMPLETE / Product Owner UAT PASS**. On staging, a photo over 1 MB stays on Order detail and shows the localized inline message “L'immagine non può superare 1 MB.”; the generic Next.js server-error page no longer appears. A valid supported photo under 1 MB uploads normally, the existing helper remains visible and the Order photo workflow remains usable. `MAX_ORDER_PHOTO_BYTES = 1024 * 1024` remains the authoritative application limit; Next.js Server Action `bodySizeLimit = "2mb"` is transport headroom only, not a larger permitted photo size. Server MIME, size and binary-signature validation remain authoritative. The private `order-media` Storage boundary, tenant/order path, `register_order_photo` RPC, registration-failure cleanup, categories, caption, visibility, deactivation and database/bucket 1 MB boundary are unchanged. No migration, schema, RLS or Storage-policy change; no Supabase commands were run and production was untouched.

Previous functional closeout: `ORDER-PROPERTY-CLIENT-FILTER-001` (`8f00346e2e1108f3c56be287d5fce009b874047e`) and `PROPERTY-LIFECYCLE-REACTIVATE-UX-001` (`7857d217cce0556b16c84a882fd0c937f321faa7`) — **COMPLETE / Product Owner UAT PASS**. UAT-ready documentation checkpoint: `6980de4dac53a8892a074d197e795f537e0d607e`. The Product Owner verified zero historical order/property customer or tenant mismatches. The earlier checkpoint incorrectly described migration `20261001000100` as already applied; operator verification on 2026-10-03 found it pending and applied it to staging during the 001C release rehearsal. Production was untouched.

Previous functional closeout: `MANUAL-EXTERNAL-REFUND-001` — **COMPLETE / Product Owner UAT PASS**. Core implementation `c7676d21bde29bc28002f727427317b1d0439b5a`; UAT-ready checkpoint `fd279d18ebd422fe8e526008aaada835427e6f48`; UX follow-up `90a02c3c6cb03bb3eb5a0bb4af30f0c6c6569005` is complete. Migration `20260930000500_manual_external_refund_001.sql` is applied to staging `exthnplfokcucaqydney`; local/remote migration history is aligned through `20260930000500`, and the post-apply dry-run reported “Remote database is up to date.” Production was untouched. Earlier manual external payment, POS payment/refund, Warehouse custody and outbound delivery UAT passes remain complete.

Current Mission: No active implementation mission.

Next Action: Scope `DATA-RETENTION-AND-SCALE-001E` — Terminal Server-side Customer Search. Replace bounded/preloaded customer discovery so discoverability does not depend on an arbitrary initial cap; 001E is not implemented. Auth DR remains a public-production blocker.

---

## Current Handover — 2026-10-04

- **COMPLETE / Product Owner UAT PASS:** `ORDER-PHOTO-INLINE-VALIDATION-UX-001` (`a4d1c6b4b1f31ac7f1a7c9765dc8c740f43df781`) and `ORDER-PHOTO-UPLOAD-BOUNDARY-UX-001` (`b7fb9d686e8d7ec136cfe6369a341982ce3cf611`). A selected file over the canonical 1 MB limit shows the localized inline size error immediately and is not submitted; the Product Owner confirmed that the Order page remains usable instead of showing the generic Next.js server-error page. Valid supported photos under 1 MB upload and the file helper remains visible. `MAX_ORDER_PHOTO_BYTES = 1024 * 1024` remains server-authoritative; Server Action `bodySizeLimit = "2mb"` provides multipart transport headroom only. MIME/signature validation, `order-media` Storage, tenant/order paths, photo registration/cleanup, categories/caption/visibility/deactivation and the database/bucket 1 MB boundary remain unchanged. No DB, migration, RLS or Storage-policy change; no Supabase commands and no production change.
- **COMPLETE / Product Owner UAT PASS:** `RECEIPT-EMPTY-ORDER-UX-001` (`acd04ce4a0b6d891b04996e0645e9c3a41b6b4a7`). For an Order with no active items, “Print receipt” no longer opens the generic Next.js server-error page: no receipt is created, the user returns to the normal Order detail, sees the existing localized `orderItemsRequired` alert and can continue using the Order. The authoritative `public.issue_operational_receipt(uuid)` RPC rejects the empty active-item snapshot before numbering or insertion. Only `22023` plus `operational_receipt_items_required` maps to this warning; all other errors retain visible technical failure. Receipt numbering, immutable snapshots, reuse/idempotency, ticket/labels, access checks, tenant isolation and financial/fiscal boundaries remain unchanged. No DB, migration, schema, RLS or RPC change; no Supabase commands and no production change.
- **COMPLETE / Product Owner UAT PASS:** `ORDER-PROPERTY-CLIENT-FILTER-001` and `PROPERTY-LIFECYCLE-REACTIVATE-UX-001`. A Phoenix Property permanently belongs to the Customer under which it was created; `properties.customer_id` is immutable. If a real-world property moves to another Customer, preserve the old record and historical Order references, deactivate it when appropriate, and create a new Property for the new Customer. New Orders require an active Customer; Property remains optional and, when selected, must be active and belong to the selected Customer and tenant. Changing Customer clears Property; `create_order` and `validate_order_relationships` remain authoritative. Order edit shows canonical `order.customerName` and `order.propertyName` read-only, including an inactive historical Property, with no reassignment workflow. Active Properties can be deactivated; inactive Properties remain reachable and can be explicitly reactivated. Ordinary editing of an inactive Property does not reactivate it. Tenant isolation and RLS are preserved; no historical Order rewrite, backfill or new composite FK was introduced. Shop Terminal, Quick Drop, Portal, pricing/segments, logistics, payments, Accounting, Daily Close and fiscal behavior are unchanged.
- **COMPLETE / UAT PASS:** `ORDER-ITEMS-LIFECYCLE-GATE-001` and `PRODUCTION-DEFAULT-ASSIGNEE-001`. The latter uses staging migration `20260928000200_production_default_assignee_001.sql`. Normal manual draft→received requires an active order item; only Quick Drop and completed inbound pickup may receive without one. All zero-item orders are blocked from actual production and final fulfillment until an active item is added; cancellation is allowed. No placeholders or backfill.
- **COMPLETE / UAT PASS:** inbound pickup is customer→EcoWash; outbound delivery is EcoWash→customer. Confirming final Warehouse position, package count and storage mode atomically completes production without a second manual status step. Production completion is not final fulfillment. Without delivery, `ready_for_customer_pickup` awaits explicit customer handoff. Scheduled delivery shows **Ready for delivery**, in-progress delivery **In delivery**, and completed delivery **Completed**. Payment/receipt is not physical handoff.
- **COMPLETE:** Daily Close has live preview, immutable saved snapshot, tenant-local business date, organization/location scope, history/exports, internal post-close operational/financial gate and Portal after-close intake protection. POS sessions remain independent. It is operational, not statutory/fiscal close.
- **COMPLETE / UAT PASS:** Warehouse current stock represents physical storage only. Configured positions/default inbound, receipt-driven current `order_storage`, owner/manager placement/move/update and final ready placement preserve real storage; overview/search and mobile navigation remain available. A scheduled outbound delivery may wait at a real position, with configured delivery staging suggested where available. Starting delivery requires an active order, completed production and current storage; scheduled→in_progress atomically sets the exact delivery to in_progress and `started_at`, removes storage and records an append-only `delivery_started` exit linked to that `delivery_id`. The order disappears from current Warehouse stock while EcoWash retains transit custody. Failed delivery requires a reason and valid active return position, restores package count/storage mode from that delivery's departure snapshot, and records `delivery_returned`. Actual delivery completion ends EcoWash custody without a second Warehouse exit; historical movement history may correctly end with **Warehouse exit / Delivery started**. Customer handoff and cancelled-order return retain their separate paths. Draft Terminal/order creation is not receipt; Quick Drop and completed inbound pickup can establish `received` plus storage atomically. No fake transit shelf or per-garment Warehouse lifecycle.
- **COMPLETE / UAT PASS:** Shop Terminal preselects the valid configured per-location default (Quality Test in UAT), otherwise Unassigned; a manual override applies to that order and the next new order returns to the location default. There is no first-staff fallback. Separately, an order still unassigned at received→washing may receive the valid default atomically; the resulting assignment now appears in Order detail immediately without a browser refresh (EW-000118/119). Unassigned warning applies only during active production, not draft/received/ready/completed/cancelled.
- **COMPLETE / UAT PASS:** With an inbound pickup scheduled or in progress, manual draft→received is blocked and Order detail explains that pickup must be completed first. Pickup completion canonically sets received/received_at and establishes inbound Warehouse custody; no open or a cancelled pickup permits normal manual receipt under existing gates. Quick Drop retains its separate receipt path. Product Owner staging UAT passed for EW-000118/119; migration `20260929000100_inbound_pickup_receipt_gate_001.sql` was reported applied to staging `exthnplfokcucaqydney`, with local/remote history aligned through `20260929000100` at that checkpoint.
- **Staging Auth signup:** Product Owner reports the Supabase staging Dashboard now has “Allow new users to sign up” OFF and “Confirm email” ON; `AUTH-CONFIG-DRIFT-001` was resolved operationally by this manual correction, not programmatically verified. Auth disaster recovery and authenticated application recovery remain separate pre-production blockers.
- **PHOENIX OPERATIONAL PILOT CLOSEOUT — PASS:** Product Owner tested Terminal, normal/direct intake, Quick Drop, Portal intake, inbound pickup and physical receipt, production/assignment/item gates, Warehouse inbound/final placement and exit, customer handoff, outbound delivery, payments, Daily Close and post-close behavior. Fresh-order outbound delivery staging UAT also passed: scheduled→in_progress→completed, exact linked departure movement, no storage after departure, no current Warehouse row, final Completed display and Order detail custody callouts. This is staging acceptance, not public-production readiness.
- **COMPLETE:** `DELIVERY-STATUS-REFRESH-001` (`016888dc259b78af1f6a972187120b0c55590490`) revalidates the Orders list after successful delivery transitions. `DELIVERY-ORDER-DETAIL-REFRESH-001` (`c131fef0552ee89ed6d587020cffb4d886026083`) revalidates and redirects successful Order-detail delivery transitions to `/${locale}/app/orders/${orderId}#logistics`, clearing stale query parameters without changing workspace behavior. `WAREHOUSE-ORDER-DETAIL-CUSTODY-UX-001` (`9feba00f9a9944c508ecd97911a327a09d33b23b`) keeps real current storage visible when present; without storage it shows out-of-Warehouse/in-delivery or delivered custody, with movement history below. These follow-ups required no DB or migration change.
- **V1 decision:** catalog/services → commercial `order_items` snapshot → ticket/labels → order-level production → order-level Warehouse → fulfillment. Discrete labels may identify each unit (`PHX1:L:<order UUID>:<order-item UUID>:<unit index>`); two trousers can print `1/2` and `2/2`. This QR identifies an order/item/unit, not a persistent garment or scan event. Operators verify complete orders. Commercial 18 kg laundry and three physical bags remain 18 kg order quantity and `package_count = 3`. Garment/package tracking and partial ready/fulfillment are deferred, not approved.
- **COMPLETE / Product Owner UAT PASS:** `POS-SESSION-PAYMENT-BOUNDARY-001` (`ff4258d768501396d01a5c26e689187976d36b02`). Every new payment recorded with `channel='pos'` requires a valid open POS session, regardless of method (`cash`, `card`, `bank_transfer`, `other`). Payment method and channel remain separate. `record_pos_payment` requires a non-null target session belonging to the same organization with status `open`; existing actor/location checks remain. This is an RPC boundary, not a global table constraint; historical payments were not backfilled or changed. With the till closed, the POS payment form is hidden and explains that the till must be opened; opening the till and payment history remain available. With it open, recording works normally. Shop Terminal paid-now still requires an active session; Pay Later remains available without recording payment. Online/provider payments remain `channel='online'` and independent of till state under existing provider/post-close rules. Refund behavior at that checkpoint was unchanged; the later `POS-REFUND-CHANNEL-SESSION-BOUNDARY-001` closeout below is now authoritative. No supported new `channel='order'` manual external write path was added. Daily Close remains separate from POS sessions, with existing blockers/warnings and `non_session_non_cash_activity` semantics unchanged. Staging migration `20260930000200_pos_session_payment_boundary_001.sql` was applied to `exthnplfokcucaqydney`; local/remote history aligns through `20260930000200`, the post-apply dry-run reported “Remote database is up to date,” and production was untouched. Product Owner UAT passed closed-till form/message, open-till recording, Terminal Pay Later without payment, and online payment independence.
- **COMPLETE / Product Owner UAT PASS:** `POS-REFUND-CHANNEL-SESSION-BOUNDARY-001` (`205ceb62bd809665477689cc21f15dc8ec848fe1`). `record_pos_refund` is POS-only: it requires a confirmed `channel='pos'` source payment in the current organization and a non-null, same-organization POS session with status `open` for every refund method. Existing actor/location authorization, refundable-amount limit, locking and idempotency remain authoritative. The confirmed source is never changed; each refund is a separate `status='refunded'`, `channel='pos'` payment row linked by `refunded_from_payment_id`. Historical rows were not backfilled or changed. Order detail offers the POS refund only for refundable POS-source payments; without an open till it disables submission and explains the requirement. Online and historical `order`-channel payments have no POS refund action. The POS workspace retains refunds for eligible current-session POS payments and supplies that active session. Online/provider settlement remains `channel='online'` and unchanged; this task added no real provider refund API or manual external/order refund path. Cash POS refunds still reduce expected till cash; new non-cash POS refunds are session-linked. Daily Close, confirmed-minus-refunded Accounting and Customer Account semantics, Billing separation and the disabled `refund_payment`/`void_payment` paths remain unchanged. Staging migration `20260930000300_pos_refund_channel_session_boundary_001.sql` was applied to `exthnplfokcucaqydney`; local/remote history aligns through `20260930000300`, post-apply dry-run reported “Remote database is up to date,” and production was untouched. Product Owner UAT passed open-till POS refund, closed-till block/message, and absence of the POS refund action for online and historical `order` payments.
- **COMPLETE / Product Owner UAT PASS:** `MANUAL-EXTERNAL-PAYMENT-001` (`7dae0ba632756d147af8e7589c2212a657878ace`) adds `channel='manual_external'` for verified payments received outside physical POS and online/provider settlement. `order` is legacy/historical with no supported new write path; `pos` requires an open till; `online` remains provider-settled and till-independent. Owner/Manager may record `bank_transfer` or `other` on an active same-organization order with outstanding balance; `cash` and `card` are excluded. The server requires a positive amount within the balance, reference, notes for `other`, idempotency, server-generated `paid_at=now()` and authenticated `recorded_by`/`confirmed_by`; it stores no POS session or provider metadata and does not permit a retroactive effective date. Order detail shows “Registra pagamento esterno” only to Owner/Manager while balance remains; Shop Terminal has no new write path. This internal financial write obeys the existing business-day close gate with no online exemption, remains sessionless, does not affect expected cash and may contribute to `non_session_non_cash_activity`; Daily Close was not redesigned. Existing confirmed-minus-refunded semantics include it in order balance, collectedNet, Accounting, Customer Account/history and derived payment status without new math. `get_pos_receipt_data` now requires `channel='pos'`, so manual external payment cannot be represented as a POS receipt; operational printing remains non-fiscal. Online attempts, webhooks and settlement are unchanged, with no fake provider metadata. `record_pos_refund` remains POS-only; no manual external refund was implemented at that payment checkpoint. Historical `order` rows were neither backfilled nor rewritten. Migration `20260930000400_manual_external_payment_001.sql` is applied to staging `exthnplfokcucaqydney`, local/remote history aligns through `20260930000400`, the post-apply dry-run reported “Remote database is up to date,” and production was untouched. Product Owner staging UAT passed Owner/Manager entry, bank transfer with reference, `other` requiring notes and succeeding with notes, exclusion of cash/card, closed-till independence, correct balance/Accounting updates and unchanged Terminal behavior.
- **COMPLETE / Product Owner UAT PASS:** `MANUAL-EXTERNAL-REFUND-001` (`c7676d21bde29bc28002f727427317b1d0439b5a`) adds dedicated `record_manual_external_refund`. Owner/Manager may record a separately linked `status='refunded'`, `channel='manual_external'` fact only for a confirmed same-organization `manual_external` source with method `bank_transfer` or `other`; the source remains immutable, and the source Order is checked for the same organization without requiring it to remain active. The refund method comes from the source. Reason and reimbursement-event reference are mandatory, the refund reference must differ from the original payment reference, and notes are mandatory for `other`. The server supplies `paid_at`/`refunded_at` and actor IDs, requires idempotency, locks the source and allows multiple partial refunds only up to the remaining refundable amount. No POS session or provider fields are recorded. Order detail offers a distinct Owner/Manager external-refund form for eligible sources even after Order cancellation; it records an already completed external reimbursement and does not move money. The existing non-online Daily Close gate applies; this sessionless non-cash fact does not alter expected cash and may contribute to `non_session_non_cash_activity`. Existing confirmed-minus-refunded math drives collectedNet, Order balance, Accounting, Customer Account and the cancelled-paid warning without formula changes. `record_pos_refund` remains POS-only, and `get_pos_receipt_data` remains POS-only; online/provider refunds, historical `order`-channel refunds and fiscal behavior were not implemented. Migration `20260930000500_manual_external_refund_001.sql` is applied to staging `exthnplfokcucaqydney`; local/remote history aligns through `20260930000500`, post-apply dry-run reported “Remote database is up to date,” and production was untouched. Product Owner staging UAT passed: the eligible action worked with the POS till closed, mandatory evidence was enforced, a €5 partial refund left €7 refundable, a second €7 refund fully reimbursed the €12 source, payment state became Refunded, net paid became €0, balance due returned to €12, and the action disappeared when no refundable amount remained. Cancelled-order eligibility, POS/online action separation and financial refresh also passed. `MANUAL-EXTERNAL-REFUND-UX-001` (`90a02c3c6cb03bb3eb5a0bb4af30f0c6c6569005`) maps `manual_external_refund_reference_not_distinct` to a dedicated localized message; generic failures retain their generic message.
- **Separate open decisions:** Historical `order`-channel refunds and online/provider refunds remain separate future questions. Other findings require their own scope. Later SaaS Productization Baseline, clean Demo Tenant onboarding and `PHX-FISCAL-001` architecture/compliance remain separate decisions; operational receipts remain non-fiscal.
- **BLOCKED for public production:** database and Storage recovery are proven; managed Auth and authenticated application recovery are not. Keep tenant/RLS/auth boundaries and EcoWash La Tejita as first tenant/reference, never product identity. Open work includes scoping `DATA-RETENTION-AND-SCALE-001E` — Terminal Server-side Customer Search, Portal validation summary/focus improvement, `NETWORK-FAILURE-UX-001`, the PDF technical-key cosmetic issue only if reproducible, SaaS Productization Baseline, Demo Tenant, historical `order`-channel refunds, online/provider refunds and Auth DR. `PHX-FISCAL-001` remains separate; `PHX-FISCAL-RECTIFICATION-001` remains a future requirement for invoice corrections, credit notes and adjustments. Operational receipts remain non-fiscal. Phoenix is not public-production ready.

The dated closeouts below record earlier checkpoints. Their “next proposed task,” staging-pending and implementation-boundary statements are historical, not the current resume instruction.

### ORDER-PROPERTY-CLIENT-FILTER-001 / PROPERTY-LIFECYCLE-REACTIVATE-UX-001 — Product Owner staging UAT PASS

1. New Order Property is optional; Customer A shows only Customer A's active Properties, changing to Customer B clears the selection, and a Customer without Properties can still create an Order. Cross-customer manipulation remains server/database protected.
2. Existing Order edit shows Customer and Property read-only using the canonical Order names; the correct historical Property remains visible after deactivation, with no reassignment workflow.
3. Property deactivation succeeds; the inactive Property stays reachable, shows Reactivate, and returns to Active and the Deactivate action after explicit reactivation. Ordinary editing while inactive does not reactivate it; normal detail edits still work and Customer ownership cannot change.
4. Shop Terminal, Quick Drop and Portal regressions passed; pricing/segments, logistics, payments, Accounting, Daily Close and fiscal behavior remain unchanged.

### MANUAL-EXTERNAL-REFUND-001 — Product Owner staging UAT PASS

1. An eligible `manual_external` payment displayed the refund action, and a refund worked with the POS till closed.
2. Reason and refund reference were required; reusing the original payment reference displayed the dedicated localized explanation.
3. The `other` method required notes.
4. A €5 partial refund left €7 refundable; a second €7 refund completed reimbursement and removed the action.
5. Payment state became Refunded, net paid became €0, and balance due returned to €12; Order and Accounting refreshed correctly.
6. Eligible cancelled-order sources remained refundable; POS and online sources did not display the manual external refund action.

---

## PHOENIX-UAT-CLOSEOUT-001 Checkpoint

- `TERMINAL-ORDER-STATE-AND-TIME-001` is complete and stable in repository commit `5346a0eee08ebf32bf0bf9801a58fded99a68cfe`: receipt/operator timestamps use the tenant organization timezone, and derived operational status separates production completion from final fulfillment.
- `CONTROL-CENTER-ALERTS-COVERAGE-001` is complete and stable in repository commit `43966be8ac6adea7521a803e895e50aff6ced5a7`: unpaid/partial orders remain alertable after production completion, with canonical Alerts page/navigation badge parity and no database migration.
- `ORDER-CANCEL-LOGISTICS-CONSISTENCY-001` is complete and stable in repository commit `0a90a401abddf9f947fa9722e165afc1503b7ea6`: cancelled/inactive parents reject actionable logistics, Daily Close excludes correctly scheduled future work, and migration `20260912000100_order_cancel_logistics_consistency_001.sql` narrowly reconciles open legacy logistics under cancelled parents. The reconciliation derives the cancellation actor from the latest applicable `order_status_history.changed_by`, falling back only to an existing FK-valid logistics actor.
- The three changes are committed and pushed on `main`. Staging application of migration `20260912000100` and Product Owner staging UAT are not recorded as complete and remain the next validation gate.
- No financial canon, fiscal/VERI*FACTU behavior or completed/cancelled logistics history was changed.

---

## BACKUP-DR-001D / PHX-AUTH-DR-001 Checkpoint

- `VERIFIED`: a new isolated PostgreSQL 17 Supabase recovery project was created in `eu-west-1`; the protected staging ref remained unchanged and staging/production were untouched.
- `VERIFIED`: 49/49 canonical migrations, the complete 1,528-row `data.sql` payload and the relevant safe `roles.sql` state were restored and validated. Schema, row-count, public-FK, uniqueness, sequence and tenant consistency checks passed.
- `VERIFIED WITH MANAGED-ROLE EXCEPTION`: the reserved `supabase_admin` timeout override was rejected and not forced; required application-facing role/grant state passed.
- `VERIFIED`: BACKUP-DR-001B was exercised end to end through the supported Storage API. All 223 objects and 22,451,620 bytes were restored and re-downloaded; 223/223 SHA-256 checks matched with no failures, missing objects or extras.
- `NOT YET VERIFIED`: authenticated application flows/RLS, final end-to-end recovery and final RTO.
- `APPROVED STRATEGY`: Option A is primary—use Supabase-supported physical backup / Restore to a New Project on the confirmed production plan. Option B is the original-UUID Supabase Admin API fallback with reset/reinvitation and MFA reenrollment when continuity is unavailable. Option C is emergency degraded continuity only.
- `KNOWN GAP / PRE-PRODUCTION BLOCKER`: managed Supabase Auth was not backed up or restored. The current backup cannot preserve password continuity; Auth recovery, staff/portal login and authenticated RLS/tenant validation remain unverified.
- The repository expects signup disabled, while previously observed hosted staging configuration appeared to allow signup. The drift remains unresolved and must be reviewed separately.
- Phoenix must not be considered fully production-ready or DR-complete until provider eligibility/coverage, protected identity inventory, versioned non-secret Auth configuration, secret custody, the Option B procedure and an isolated Auth recovery rehearsal all pass the mandatory gate in `docs/05_DEVELOPMENT/Recovery_Runbook.md`.
- `DECOMMISSION COMPLETE`: recovery project `xsjmhjmhaftieokuwssf` was permanently deleted, protected staging `exthnplfokcucaqydney` remained intact, FitIQtracker was resumed, the local `postgres:17` rehearsal image was removed and no rehearsal temporary files remained in `/tmp` or Downloads. Verified backup artifacts in `~/EcoWash-Backups` were deliberately retained.
- No Auth implementation or further recovery phase is authorized. Detailed evidence and the canonical pre-production gate are in `docs/05_DEVELOPMENT/Recovery_Runbook.md`.

---

## DASHBOARD-LOGISTICS-LIFECYCLE-001 Closeout

- `DASHBOARD-LOGISTICS-LIFECYCLE-001` is COMPLETE / STABLE. Dashboard today, overdue and workload signals plus operational alerts now reuse the canonical logistics parent lifecycle.
- Draft, cancelled and inactive parents are excluded. Accepted states from `received` onward remain eligible, including production `completed` while pickup/delivery is still open.
- Tenant filtering, organization timezone behavior, completed history and manager planning remain unchanged. No schema change or migration was required.
- Focused validation, staging deployment and Product Owner E2E passed.
- Next proposed task: `BACKUP-DR-001`.

---

## LOGISTICS-COMPLETED-HISTORY-001 Closeout

- `LOGISTICS-COMPLETED-HISTORY-001` is COMPLETE / STABLE. Pickup and delivery completed-today history reads existing canonical rows with `status = completed` and uses `completed_at` as the authoritative completion timestamp.
- Staff see only their own assigned completed-today tasks; owner/manager roles see organization team completions and assigned staff identity where available. Existing tenant, capability and RLS boundaries remain unchanged.
- The current-day boundary and displayed completion time use `organizations.timezone`. Mi día and active pickup/delivery queues remain open/current work only.
- No history table, schema change or migration was required. Focused validation, staging deployment and Product Owner E2E passed.
- No next product task is approved; `RECEIPT-COMPACT-LINES-UX` remains recorded as non-blocking UX polish.

---

## LOGISTICS-TIMEZONE-001 Closeout

- `LOGISTICS-TIMEZONE-001` is COMPLETE / STABLE. Tenant wall-clock `datetime-local` values are interpreted with server-derived `organizations.timezone`, stored as absolute `timestamptz` instants, and rendered for managers and staff in that same tenant timezone.
- The shared conversion is DST-aware; language continues to follow user locale and never determines timezone. Shop Terminal delivery scheduling and dashboard logistics rendering use the same canonical boundary.
- No migration or automatic rewrite of previously shifted rows was made; affected historical rows may be corrected manually through normal rescheduling.
- Focused validation, staging deployment and Product Owner E2E passed with manager, My Day and delivery workspace all showing `21:00`.
- Next proposed task: `LOGISTICS-COMPLETED-HISTORY-001`.

---

## ACCOUNTING-DOCUMENTS-NAV-001 Closeout

- `ACCOUNTING-DOCUMENTS-NAV-001` is COMPLETE / STABLE. Accounting now exposes visible locale-aware access to the sales-document registry.
- Operational receipt print/PDF actions and compact localized headers were corrected; browser and print/PDF Product Owner validation passed, including safe wrapping for long descriptions.
- No document or financial semantics changed, and no database migration was required.
- Next proposed task: `LOGISTICS-TIMEZONE-001`.

## Open Findings

- Historical `order`-channel refund path — separate future question; no replacement flow or provider refund API was implemented by the POS refund or manual external payment tasks.
- `PHX-AUTH-DR-001` — BACKUP-DR-001D rehearsal/decommission is complete and database/Storage recovery are verified; Auth recovery and authenticated application recovery remain a mandatory pre-production blocker before go-live.
- `AUTH-CONFIG-DRIFT-001` — staging signup was manually disabled in the Supabase Dashboard (Product Owner report; no programmatic verification). This configuration finding is resolved; Auth DR remains open separately.
- `PORTAL-ORDER-VALIDATION-SUMMARY-001` — provide a visible order-level validation notice/summary when required Portal order fields are incomplete, while preserving field-level validation and guiding the customer to the missing data.
- `POS-DAILY-CLOSE-001` — remaining POS/Daily Close refinements remain open pending focused Product Owner/CTO scope; financial canon must remain unchanged.
- `NETWORK-FAILURE-UX-001` — define clear user feedback and safe recovery behavior for operational network failures.
- `RECEIPT-COMPACT-LINES-UX` — consider future vertical-space optimization for long item descriptions while preserving readability and print safety; this is non-blocking UX polish.
- The duplicate “Próxima actividad / Mis actividades” presentation is non-blocking UX polish unless the Product Owner prioritizes it later.

---

## ORDER-FULFILLMENT-LIFECYCLE-001 Closeout

- `ORDER-FULFILLMENT-LIFECYCLE-001` is COMPLETE / STABLE. Draft pickup/delivery remains configurable for manager planning but is excluded from operational staff work until the parent order reaches an accepted state; `received`, active production, `ready`, `completed` and accepted-order `on_hold` remain logistics-eligible.
- Production `completed` no longer suppresses open pickup/delivery. The logistics record's own `scheduled`, `in_progress`, `completed` or `cancelled` lifecycle governs operational visibility and provides the existing customer-handoff evidence through `status` and `completed_at`.
- No fulfilled, handed-off, custody, inventory or stock field/table was added. The shared typed application predicate and authoritative pickup/delivery transition RPC checks preserve tenant, capability and assignment boundaries while rejecting draft operational advancement.
- Staging migration `20260908000300_order_fulfillment_lifecycle_001` is applied and aligned. Focused validation, preview deployment and Product Owner E2E passed: draft assignment stayed hidden from staff, `received` activated the work, production completion preserved the open delivery, and delivery completion removed it from open work.
- Next proposed task: `ACCOUNTING-DOCUMENTS-NAV-001`.

## ACCOUNTING-SALES-DOCUMENTS-001 Closeout

- `ACCOUNTING-SALES-DOCUMENTS-001` is COMPLETE / STABLE. Phoenix now has persistent operational receipts with annual progressive numbering, at most one issued receipt per order, preserved cancelled history and cancel-then-reissue support without reusing numbers.
- Reprints use the immutable persisted receipt snapshot. The Accounting sales-document registry unifies operational receipts with canonical Billing invoices and records authenticated `viewed` and explicit `print_requested` document events.
- Accounting calculations and the existing payment/refund ledger boundaries remain unchanged.
- Staging migrations `20260908000100_accounting_sales_documents_001` and `20260908000200_accounting_sales_documents_001_receipt_select_policy` are applied and aligned. Focused validation, preview deployment and Product Owner E2E passed; receipt reopen/reprint, historical cancellation/reissue, registry state, ticket/label regressions and unchanged financial values were confirmed.
- Next approved finding only: `ORDER-FULFILLMENT-LIFECYCLE-001`. Draft logistics remain configurable but not operational for staff; logistics becomes operational from `received`; production completion means ready rather than fulfilled/closed; open pickup/delivery remains visible after production completion; and the order remains in operational custody/stock until real pickup or delivery completion.

---

## COUNTER-UX-002 Closeout

- Redesigned `/[locale]/app/shop` as a compact touch-first laundry counter: customer strip, real category navigation, service search and large service tiles on the left/centre, with a persistent readable cart and large monetary summary/payment controls on tablet and desktop plus responsive mobile stacking.
- Fast regular-customer creation remains canonical. Every `Cliente occasionale` creates its own tenant-scoped canonical customer with a distinct `WALKIN-<UUID>` code, optional phone/email and traceable order history; `orders.customer_id` remains required and no shared anonymous customer or parallel schema was added.
- Reuses authoritative tenant services, effective segment/base pricing, integer versus continuous quantities, monetary discounts, existing active till and canonical cash/manual-card payment ledger. PAY LATER creates no payment row and no fake online-payment action exists.
- The compact success state keeps PRINT-001 receipt, ticket and label actions. Owner/Manager inherit POS access; Staff still needs explicit POS capability; existing entitlement, capability and tenant gates remain authoritative.
- No COUNTER migration was needed. Local and staging history remain aligned through PRINT-owned `20260829000300_print_001_output_entitlement.sql`.
- Rollback-only staging proof passed `2 × EUR 7.50 + 1 × EUR 5.00 = EUR 20.00`, discount `EUR 2.00`, cash/card `EUR 8.00 / EUR 10.00`, paid/outstanding `EUR 18.00 / EUR 0.00`, expected cash `+EUR 8.00`; distinct walk-in `Cliente Banco Test` passed PAY LATER `EUR 10.00 / EUR 0.00 / EUR 10.00`, tenant isolation and zero fixtures.
- Final gates: COUNTER 30/30, Shop Terminal 28/28, POS 31/31, pricing 20/20, Customer Account 14/14, PRINT 25/25, lint, production build and `git diff --check` PASS. In-app browser control was unavailable, so responsive rendering remains structurally covered and subject to Product Owner visual acceptance.
- Next: `BARCODE-001`, not started. `COUNTER-BILLING-001`, Accounting, fiscal invoicing and real online-provider work were not started.

---

## PRINT-001 Closeout

- Added entitlement- and POS-capability-gated receipt, internal ticket and label previews at `/[locale]/app/orders/[orderId]/print/{receipt|ticket|labels}`, with explicit browser print/Save PDF actions and no automatic printing.
- Reuses canonical order snapshots, confirmed-minus-refunded payment summary, tenant branding and organization timezone. The customer receipt excludes internal/provider data and is explicitly non-fiscal; the internal ticket is operational; labels are one per discrete unit or one per continuous line with a reserved future-code area and no barcode/QR.
- Shop Terminal success and order detail expose all three actions without mixing printing into another order/payment system. Owner/Manager inherit POS capability; Staff requires explicit POS capability; the existing server guards remain authoritative.
- Migration `20260829000300_print_001_output_entitlement.sql` is applied and aligned. It only bootstraps the existing `printing` entitlement for EcoWash with `ON CONFLICT DO NOTHING`; no schema, financial history, privileged function or grant changed.
- Rollback-only staging proof passed exact subtotal/discount/total `EUR 20.00 / EUR 2.00 / EUR 18.00`, cash/card `EUR 8.00 / EUR 10.00`, paid/outstanding `EUR 18.00 / EUR 0.00`, three discrete labels, PAY LATER `EUR 10.00 / EUR 0.00 / EUR 10.00`, tenant isolation and zero fixtures.
- Final gates: PRINT 25/25, Shop Terminal 28/28, POS 31/31, lint, production build and `git diff --check` PASS. Interactive browser control was unavailable; HTML/CSS and route rendering were verified structurally and remain subject to Product Owner visual acceptance.
- Next: `BARCODE-001`, not started. Real provider configuration, `ACCOUNTING-001` and `E-INVOICE-001` remain separate future work.

---

## Completed Milestones

- APP-002 — Order Domain and Database Design
- APP-003 — Supabase Tenant Foundation and Security Baseline
- APP-004 — Authentication and Roles
- APP-005 — Customers and Properties
- APP-006 — Orders and Workflow
- APP-007 — Photos, Pickup, Delivery and Payments
- APP-008 — Dashboard and Operational Overview
- APP-008.1 — Organization Timezone Foundation
- INFRA-001 — Supabase staging connection and migration bootstrap
- AUTH-001 — Password recovery and update flow
- AUTH-001.1 — Password reset error fall-through correction
- AUTH-001-E2E — Real password recovery and first owner login
- UX-001 — Protected app shell refinement and session handover
- INFRA-001-SMOKE — First real operational smoke test: PASS WITH NON-BLOCKING ISSUES
- INFRA-001.1 — Supabase migration history reconciliation and smoke baseline finalization
- COMM-001 — Commercialization roadmap and production sequencing
- PRODUCT-001 — Commercial readiness and feature-gap audit
- UX-002 — App landing/dashboard and operational layout refinement
- UX-002.1 — Public login entry and mobile navigation clarity
- UX-002.2 — Protected app shell and mobile navigation
- UX-002.2.1 — Mobile CTA contrast correction
- UX-002.3 — Dashboard hierarchy and quick actions
- UX-002.4 — Order detail information architecture and mobile contrast
- UX-002.5 — Final responsive and accessibility pass
- SEC-001 — Supabase security audit
- SEC-001.1 — Database privilege, RPC and Storage policy remediation
- SEC-001.2 — Authenticated mutation regression after hardening
- PILOT-001 — Commercial pilot portal scope and route architecture
- PILOT-001.1 — Pilot portal roles, routes and authorization boundaries
- RELEASE-001.0 — Release readiness plan and blockers
- RELEASE-001.1 — Staging hosting and environment contract
- RELEASE-001.2 — Staging deployment rehearsal and Auth validation
- RELEASE-001.3 — Production Supabase and environment design
- OPS-001.1 — Production Queue MVP
- OPS-001.2A — Completed logistics corrections
- OPS-001.2B — Delivery Queue MVP
- OPS-001.3 — Work Assignment MVP
- OPS-001.4 — Staff Management MVP
- PORTAL-001 / PORTAL-001.1 — Secure Customer Portal MVP
- PORTAL-002.1 — Customer Order Request + Pickup
- CATALOG-SEGMENTS-001 — Customer Segment Quick Catalogs
- CUSTOMER-ACCOUNT-001 — Customer Financial Account Experience
- CUSTOMER-LIFECYCLE-001 — Safe Customer Lifecycle Management
- BILLING-001 — Invoicing Foundation and Customer Billing
- UI-FIX-001 — Authenticated Shell Cleanup and Customer Segment Selector Verification
- PRICING-SEGMENTS-001 — Customer Segment Price Overrides with Safe Fallback
- ENTITLEMENTS-001 — SaaS Plans, Modules and Tenant Feature Access
- PLATFORM-ADMIN-001 — Phoenix SaaS Control Center
- POS-001 — Vendor-neutral Point of Sale, Cash Register and Payment Operations
- QA-PRODUCT-001 — Full Product Acceptance Test: PASS WITH NON-BLOCKING ISSUES
- POST-QA-PRODUCT-001 — Customer Account contrast, real EcoWash segment setup and verified Product Owner Platform Admin bootstrap
- AUTH-CONTEXT-001 — Platform Admin / Tenant Owner login chooser and shell-isolated context switching
- MANUAL-QA-FIX-001 — Authenticated Portal support, unique POS navigation and active till recovery
- PAYMENTS-ONLINE-001 — Provider-neutral customer online payment foundation; provider configuration required
- SHOP-TERMINAL-001 — Dry Cleaning / Laundry Counter Terminal
- PRINT-001 — Customer receipt, internal ticket and label-ready browser printing
- COUNTER-UX-002 — Professional Dry Cleaning / Laundry Counter Register redesign
- ACCOUNTING-SALES-DOCUMENTS-001 — Persistent operational receipts and unified sales-document registry
- ORDER-FULFILLMENT-LIFECYCLE-001 — Separate production completion from customer fulfillment
- OPS-001.5 — Daily Close MVP
- OPS-001.6 — Operational Alerts MVP
- UI-001 — Operational Dashboard Visual Refinement
- UX-OPS-001.3 — Pickup Workspace
- UX-OPS-001.4 — Production Workspace
- UX-OPS-001.5 — Quality & Packing Workspace
- UX-OPS-001.6 — Delivery Workspace
- UX-OPS-001.7 — Owner Operations Control Center
- UX-OPS-001.8 — Access & Capabilities Management
- UI-003 — Operational primary CTA consistency
- BUG-ASSIGN — Persistent capability-aware logistics assignment
- BUG-PROD-006 — Terminal operational transition redirects
- UI-MOBILE-001 — Mobile order/logistics refinement and desktop/mobile data parity
- UI-BUG-004 — Readable desktop staff sidebar active state
- UI-FORMAT-005 — Shared quantity, currency and numeric-input formatting
- ACCESS-OPS-001 — Refined owner-only staff access and membership removal
- BUG-AUTH-005 — Hardened staff Auth callback and rate-limit handling
- AUTH-INFRA-001 — Resend Custom SMTP for Supabase Auth
- DEV-ENV — Local `next dev --webpack` avoids stale Turbopack localized Orders route manifests; the production build remains unchanged

## Supabase Staging State

Completed on EcoWash Staging:

- Supabase Staging is connected.
- `.env.local` is configured locally and ignored by Git.
- Approved migrations through APP-008.1 were applied before smoke testing.
- First owner Auth user, profile, organization, location and owner membership exist.
- Password recovery E2E completed.
- Owner login completed.
- Real dashboard visible at `/it/app`.
- UX-001 protected app shell completed.
- INFRA-001-SMOKE completed end to end.
- INFRA-001.1 completed.
- Supabase migration history reconciled successfully on 2026-07-30.
- `order-media` bucket verified as private with 1 MB image limit and JPEG/PNG/WebP allowlist.
- SEC-001.1 remediation migration `20260801000100_sec_001_1_security_remediation.sql` is applied and local/remote migration history is aligned.
- SEC-001.2 authenticated mutation regression passed with rollback-only test coverage and no smoke baseline drift.
- Vercel staging project `ecowash-phoenix-staging` is online at `https://ecowash-phoenix-staging.vercel.app`.
- The staging project's main target is configured for this staging deployment path; no real production environment has been created.
- Staging indexing is disabled and `/robots.txt` returns `Disallow: /`.
- Supabase Auth staging Site URL and Redirect URLs are configured and validated.
- Supabase Custom SMTP is enabled and operational through Resend. The verified sending domain is `ecowashlatejita.com`, the sender is `access@ecowashlatejita.com`, and a real Auth email was sent and received successfully.
- The configured Supabase Auth email rate limit is 30 emails/hour. Auth endpoint-specific throttling can still apply independently from SMTP delivery.
- `SUPABASE_SERVICE_ROLE_KEY` is configured only server-side for staff invitations, is not prefixed with `NEXT_PUBLIC_` and is not tracked in Git.
- `ENABLE_STAGING_CUSTOMER_PREVIEW=true` is configured only as a server-side Vercel staging variable for the customer portal review helper.
- Customer portal staging validation passed with no HTTP 500: protected portal routes, customer `/app` denial and customer-scoped order access were verified.
- PORTAL-002.1 passed Product Owner E2E: customer-created `EW-000005` is visible in both the customer Portal and hosted staff application and enters the existing Pickup engine.
- Portal Auth/access hardening is complete: direct linked-user validation replaces the fragile global Auth user list and email/Auth failures remain controlled application errors.
- Automatic deploy from `main` to the Vercel staging project is working.
- CATALOG-SEGMENTS-001 migration `20260824000600` is applied and aligned; authenticated Owner/Manager/Staff/Portal and tenant-isolation checks passed with temporary fixtures fully removed.
- CUSTOMER-ACCOUNT-001 migration `20260826000100` is applied and aligned; authenticated Owner/Manager access, Staff denial, tenant isolation and exact order/payment/balance reconciliation passed with temporary fixtures fully removed.
- CUSTOMER-LIFECYCLE-001 migration `20260826000200` is applied and aligned; authenticated Owner/Manager transitions, Staff denial, Portal revocation, inactive-order blocking and tenant isolation passed with temporary fixtures fully removed.
- BILLING-001 migration `20260826000300` is applied and aligned; authenticated Owner/Manager Billing, Staff denial, tenant isolation, definitive numbering and exact invoice/payment/outstanding reconciliation passed with temporary fixtures fully removed.
- PRICING-SEGMENTS-001 migration `20260827000100` is applied and aligned; segment override → organization/location base precedence, internal/Portal consistency, Owner/Manager access, Staff denial, tenant isolation and historical order/invoice preservation passed in rollback-only E2E.
- ENTITLEMENTS-001 migration `20260827000200` is applied and aligned; Billing, segment-pricing management and full white-label gates, Owner/Manager read-only access, Staff restriction, self-upgrade prevention, expiry, tenant isolation, EcoWash bootstrap and rollback-only fixture cleanup passed.
- PLATFORM-ADMIN-001 migration `20260827000300` is applied and aligned; isolated Platform Admin identity, cross-tenant summaries, entitlement administration, commercial labels, suspension/reactivation, audit, tenant/Portal denial and rollback-only cleanup passed.
- POS-001 migrations `20260827000400` and corrective `20260828000100` are applied and aligned; six-identity rollback-only E2E passed for till lifecycle, cash/manual-card partial and mixed payments, refunds, reconciliation, idempotency, role/capability enforcement, entitlement disable/reenable and cross-tenant denial.
- PAYMENTS-ONLINE-001 migrations `20260828000200` and corrective `20260829000100` are applied and aligned. The Portal CTA, checkout RPC and webhook settlement are gated by `payments.online` plus non-secret tenant configuration; no provider is configured and EcoWash remains OFF. Rollback-only contract E2E proved EUR 15.00 total/paid/outstanding as 15.00/15.00/0.00 with one canonical row after replay, failure with zero canonical rows, cross-customer denial and concurrent EUR 20.00 POS settlement with the external row pending `reconciliation_required`. All fixtures rolled back.
- QA-PRODUCT-001 master staging acceptance passed across nine identities/roles with temporary Tenant B, exact EUR 15.00 financial reconciliation, entitlement and suspension cycles, Tenant A/B isolation and complete rollback cleanup. Interactive authenticated visual QA was unavailable and remains a non-blocking Product Owner check.
- POST-QA-PRODUCT-001 configured four active, Portal-visible EcoWash segments using only existing categories/services and base-price fallback: Case Vacanze / Property Manager (35 explicit services, 4 categories), Hotel (9, 3), Ristorazione (3, 1) and Privati (18, 5). No segment price override was created.
- The sole verified active EcoWash Owner (`f1237796-aa9d-4069-aca2-7a926e0b241e`) was bootstrapped as an active permanent Platform Admin through `platform_admins`; the tenant Owner membership remains active and no other tenant identity gained Platform access.
- Rollback-only staging checks passed for Owner/Manager selector visibility, Manager assignment/removal, Staff and Customer restriction, tenant isolation, Platform cross-tenant reads and Portal personalization. The Portal returned 65 personalized shortcuts plus 138 remaining services, with 203 priced services total and no missing price.
- AUTH-CONTEXT-001 preserves direct context routes: `/[locale]/platform` is always guarded Platform context and `/[locale]/app` is always guarded tenant context. Dual-access login opens `/[locale]/auth/context`; each shell exposes only a compact link to the other authorized context.
- Authenticated HTTP E2E passed for Platform-only, Owner-only, dual Platform Admin + Owner, Manager, Staff and Customer identities, including both direct routes, chooser, two-way switch, Italian locale preservation and redirect-loop prevention. Temporary Platform/Owner fixtures were removed and the real Product Owner retained both permanent access records.
- MANUAL-QA-FIX-001 traced the false Closed POS state to an ambiguous PostgREST `pos_sessions → locations` embed (`PGRST201`). The query now names the composite tenant-safe FK and throws on read failure instead of degrading to Closed. A rollback-only EUR 10.00 cash payment reconciled order, Customer Account, Billing and expected cash; close/reopen, Owner/Manager, Staff capability/anti-hijack, entitlement OFF/ON and tenant isolation passed. POS was restored ON with its original source, the real till remains open and no QA session/payment/capability fixture remains.

Applied baseline migrations:

- `20260727000100_app_003_tenant_foundation.sql`
- `20260728000100_app_005_customers_properties.sql`
- `20260728000200_app_006_orders_workflow.sql`
- `20260728000300_app_007_logistics_photos_payments.sql`
- `20260728000400_app_008_1_organization_timezone.sql`

Smoke corrective migration:

- `20260730000100_infra_001_smoke_fix_order_helper_and_embeds.sql`

Security remediation migration:

- `20260801000100_sec_001_1_security_remediation.sql`

Recent operations migrations applied on staging:

- `20260802000100_ops_001_2a_fix_completed_logistics_updates.sql`
- `20260802000200_ops_001_3_work_assignment.sql`
- `20260802000300_ops_001_4_staff_management.sql`
- `20260802000400_ops_001_4_fix_staff_membership_role_variable.sql`

Customer portal migrations applied on staging:

- `20260803000100_portal_001_customer_portal.sql`
- `20260803000200_portal_001_safe_customer_rpc.sql`
- `20260803000300_portal_001_fix_customer_storage_policy.sql`
- `20260823000100_portal_002_1_customer_order_request.sql`
- `20260823000200_portal_002_1_fix_order_request_rpc.sql`

## Migration History State

Per verified staging state, migration history is aligned through `20260930000500`, including `20260930000100_delivery_staging_and_transit_001b.sql`, `20260930000200_pos_session_payment_boundary_001.sql`, `20260930000300_pos_refund_channel_session_boundary_001.sql`, `20260930000400_manual_external_payment_001.sql` and `20260930000500_manual_external_refund_001.sql`; the post-apply dry-run reported “Remote database is up to date.” Production was untouched. `MANUAL-EXTERNAL-REFUND-001` Product Owner staging UAT passed on 2026-10-01. Earlier ACCOUNTING-SALES-DOCUMENTS-001 registry and corrective receipt SELECT migrations remain applied.

During INFRA-001-SMOKE, the corrective SQL for `app_current_organization_id()` and `create_order()` was applied manually in EcoWash Staging through SQL Editor so the smoke test could continue. INFRA-001.1 reconciled the remote migration history so local and remote now both include `20260730000100`.

Do not rerun the corrective migration. Do not use `supabase db reset --linked`, `supabase migration up`, or `supabase db push` unless a future task explicitly approves it.

SEC-001.1 added database privilege hardening, explicit authenticated RPC allowlisting, `recalculate_order_totals(uuid)` client execution revocation, table privilege reduction and active-metadata enforcement for `order-media` SELECT. SEC-001.2 verified rollback-only authenticated mutation regression with no persistent data changes.

OPS-001.2A added the minimum migration needed to allow owner/manager corrections to completed pickup and delivery logistics without reopening logistics architecture. OPS-001.3 added assignment support for production and logistics using existing role boundaries. OPS-001.4 added staff-management and invite flows using server-only Supabase Auth Admin access.

## Historical Functional State — Earlier Checkpoint

Available now:

- public multilingual website
- Auth login, logout and password recovery
- protected dashboard
- customers, properties, services and prices
- orders, order lines and workflow statuses
- manual payments
- private order photos
- pickup and delivery logistics
- Production Queue at `/[locale]/app/production`
- Delivery Queue at `/[locale]/app/delivery`
- production and logistics assignment
- queue filters: All, Assigned to me, Unassigned
- staff management at `/[locale]/app/staff`
- owner-only invitation and access-management flow for staff and managers
- staff activation and deactivation
- centralized operational capability and assignment authorization rules
- staff legacy `/[locale]/app` server-side redirect to `/[locale]/app/work`
- hardened Auth callback for invalid links, stale sessions and email rate-limit errors
- operational Auth email delivery through Resend Custom SMTP
- secure customer portal routes under `/[locale]/portal`
- customer overview, order list and order detail
- mobile-first customer order request with server-side service pricing, customer-property isolation, pickup scheduling and idempotent creation
- customer-visible pickup, delivery and essential status history
- customer-visible order photos only
- customer-scoped isolation through separate Auth user to customer access
- customer users are excluded from `/[locale]/app`
- owner/manager customer portal access management
- customer access link resend, password reset and rate-limit handling
- localized Auth callback with SSR cookie persistence
- staging-only customer preview behind `ENABLE_STAGING_CUSTOMER_PREVIEW=true`
- Daily Close dashboard at `/[locale]/app/daily-close`
- owner/manager daily control sections for completed orders, open orders, paused orders, late orders, open logistics, payment issues and operational anomalies
- Daily Close links directly to affected orders and uses organization timezone for daily windows
- Operational Alerts dashboard at `/[locale]/app/alerts`
- owner/manager alert triage for late orders, paused orders, unassigned open orders, imminent or overdue pickups/deliveries, missing or partial payments and logistics assignment anomalies
- alert severity counts, navigation badge, deduplication, direct order links and organization-scoped data filtering
- tenant-defined customer segments such as Case Vacanze, Hotel, Ristorazione or Privati, with one optional primary segment per customer
- Owner/Manager segment management and customer assignment; Staff is denied
- personalized Portal and New Order quick catalogs that reference existing services/categories while the complete organization catalog remains available
- dated segment-specific price overrides with centralized precedence `segment override → organization/location base`; hidden/non-orderable services remain unavailable and missing overrides fall back safely
- internal order selection, Customer Portal estimates and final server-side order snapshots use the same resolver; client price tampering is overwritten by server truth
- existing order lines and Billing invoice items remain historical snapshots when segment pricing changes
- premium Owner/Manager Customer Account at `/[locale]/app/customers/[customerId]`
- server-side, per-currency lifetime order value, confirmed payments, refunds, net paid and outstanding balances using existing order/payment semantics
- bounded recent/current-year/all order and payment histories, properties, primary segment, Portal access and billing-readiness context
- Staff is denied the broad financial Customer Account; its existing operational customer context is unchanged
- Owner/Manager can safely deactivate and reactivate customers; deactivation preserves linked history, removes customers from active order selectors and atomically disables Portal access
- inactive customers cannot create internal or Portal orders; reactivation never silently re-enables Portal access
- lifecycle eligibility reports tenant-scoped dependencies server-side; anonymization and hard delete remain unavailable until a separately approved, legally and technically safe policy exists
- Owner/Manager Billing at `/[locale]/app/billing` with draft creation from one or more eligible orders, concurrency-safe definitive numbering on issue and preserved issuer/customer/line snapshots
- percentage-point tax configuration, Customer Account invoice integration, printable V1 invoice and payment/outstanding values derived from existing order-linked payment truth
- Staff Billing denial and tenant-scoped invoice/order/customer links; no formal e-invoicing compliance or full accounting is claimed
- the Billing foundation is entitlement-gated without introducing subscription logic or payment collection
- centralized stable feature keys and tenant-scoped entitlements now separate platform access from tenant roles; application logic checks features, never plan names
- Billing, segment-pricing management and advanced branding are gated in navigation, server code and database enforcement; disabling access preserves invoices, overrides and stored identity
- existing EcoWash tenants were explicitly bootstrapped for already-live modules, while tenants created after the migration receive no implicit premium access
- dedicated localized `/[locale]/platform` console with overview, bounded organization directory and organization commercial/detail controls
- Platform Admin identity is stored outside tenant memberships; Owner, Manager, Staff and Customer cannot access platform routes, RPCs or audit data
- suspension blocks tenant app, Server Actions, database API and Customer Portal while preserving data; reactivation restores normal role/entitlement access
- platform entitlement, status and commercial-label mutations are audited; impersonation, tenant deletion, subscription collection and automated plan templates are not implemented
- localized POS workspace at `/[locale]/app/pos`, entitlement-gated for Owner/Manager and Staff with explicit `pos` capability, with one open till per tenant, optional location scope and immutable close reconciliation
- cash and provider-neutral manual-card payments reuse the canonical payment ledger; partial and mixed tender are represented by separate real payment rows, refunds link to their source payment, and tenant-scoped idempotency plus database row locks protect retries and concurrent close/payment operations
- Customer Account and Billing continue to derive exact confirmed-minus-refunded values from the same canonical order-linked payment truth; staging E2E reconciled a EUR 50.00 order, EUR 20.00 cash plus EUR 30.00 card, a EUR 5.00 cash refund, expected cash EUR 115.00, counted cash EUR 114.00 and difference EUR -1.00
- receipt-ready data and a provider adapter boundary exist, but real payment-terminal integrations, Stripe Terminal, Redsys, SumUp, hardware printing, barcode workflows, full accounting and formal e-invoicing are not implemented
- authenticated `/app` and `/portal` routes now bypass public marketing chrome while preserving compact page context, organization, identity, role, account/logout controls and mobile application navigation
- the Customer Account selector correctly lists active tenant segments regardless of Portal visibility; EcoWash La Tejita currently has no real segments, so “Nessun segmento” is truthful until an Owner/Manager creates one

Next roadmap task: `BARCODE-001`, not started. PAYMENTS-ONLINE-001 core is complete but remains `PROVIDER CONFIGURATION REQUIRED`; no real sandbox or live provider is claimed.

Platform Admin bootstrap is intentionally not automatic. After verifying the intended Supabase Auth user UUID out of band, a trusted database operator inserts exactly that `user_id` into `public.platform_admins`; no tenant-facing route or RPC can perform this step. The same Auth user may also have normal tenant memberships, but the two access models remain additive and independently guarded.

```sql
insert into public.platform_admins (user_id, created_by)
values ('<verified-auth-user-uuid>'::uuid, null);
```

Commercial direction may use Base, Premium, Pro and add-ons, but packaging is intentionally not hardcoded: plan templates must resolve to stable entitlements. Tenant Owner access alone is not Platform Admin access and cannot grant paid features.

Lifecycle policy delivered by CUSTOMER-LIFECYCLE-001: `ACTIVE ↔ INACTIVE` is implemented with historical retention, Portal/order enforcement and Owner/Manager authorization. `ANONYMIZED where appropriate → HARD DELETE only when legally and technically safe` remains policy/readiness only; no anonymization or permanent deletion action exists.

Billing foundation delivered by BILLING-001: organization → customer → one or more orders → invoice/document is explicit, while existing order-linked payments remain the financial source of truth. Formal e-invoicing, credit notes and full accounting remain future approved work.

Final completed sequence for this session:

1. `CATALOG-SEGMENTS-001`
2. `CUSTOMER-ACCOUNT-001`
3. `CUSTOMER-LIFECYCLE-001`
4. `BILLING-001`
5. `UI-FIX-001`
6. `PRICING-SEGMENTS-001`
7. `ENTITLEMENTS-001`
8. `PLATFORM-ADMIN-001`
9. `POS-001`
10. `QA-PRODUCT-001`
11. `AUTH-CONTEXT-001`
12. `MANUAL-QA-FIX-001`
13. `PAYMENTS-ONLINE-001` — provider-neutral core; provider configuration required

Approved next product roadmap:

1. `BARCODE-001`
2. `ACCOUNTING-001`
3. `E-INVOICE-001`
4. `ACCOUNTING-PRO-001` — optional
5. `ONBOARDING-001`
6. future subscription/commercial billing
8. `PLATFORM-SUPPORT-001` — optional, without impersonation until separately designed

Permanent product requirements:

- premium UI is mandatory, not optional polish; Calm Operations and mobile-first usability remain the product language
- Customer Portal must continue toward consumer-grade premium UX, including stronger hero/media, richer category/service visuals, a premium order timeline and refined financial/Billing presentation
- white-label architecture remains required; EcoWash is the first tenant/reference, not hardcoded product identity
- Owner, Manager, Staff and Customer remain tenant roles; Platform Admin is separate from tenant Owner even when one Auth user holds both access records
- future accounting, POS and other optional modules may be gated by the same entitlement foundation
- no full accounting or e-invoice compliance is claimed yet
- known future visual stream: `PREMIUM-DESIGN` / `CUSTOMER-PORTAL POLISH`, including continued authenticated-app refinement

Role summary:

- `owner`: full Control Center, Orders, operational workspaces, Staff & Access, Alerts, Daily Close and capability management; all operational capabilities are available.
- `manager`: Control Center, Orders, My Day, Alerts, operational supervision and full Customer Account access; no Branding or Staff Access Management, and direct privileged access is denied or redirected.
- `staff`: capability-based navigation and assignment-scoped work; `/[locale]/app` redirects server-side to `/[locale]/app/work` before owner data loads; no Control Center, Staff Access Management or broad financial Customer Account.
- `customer`: separate portal user linked to `customers`, never an `organization_memberships` role.

Test data notes:

- Capability values are `pickup`, `production`, `quality`, `delivery` and `supervision`.
- Operational accounts are Speed for Pickup, Production Test for Production, Quality Test for Quality & Packing, Delivery Test for Delivery and Manager Test for manager validation.
- `TEST-PICKUP-01`, `TEST-PRODUCTION-01`, `TEST-QUALITY-01` and `TEST-DELIVERY-01` are the clean operational fixtures used for validation.
- Pickup, Production, Quality & Packing and Delivery all passed end to end: assignment, capability, My Day, dedicated workspace, activity detail, transitions, terminal transition and final redirect without 404.
- Older test orders were intentionally not deleted; safe hard cleanup would require an unnecessarily invasive administrative procedure.
- The PORTAL-001 customer test fixture remains active for review.
- Do not document test-account/customer email addresses, credentials, UUIDs or customer personal data; the approved SMTP sender identity above is the only intentional email address in this handover.

## Final Operational Validation

Validated consistency for all four operational workspaces:

- assignment uses the persisted profile ID and explicit profile relation
- staff capability and matching assignment are both required
- My Day and the dedicated workspace read the same operational identity
- activity detail supports the approved transitions
- terminal transitions leave detail routes that are no longer operationally valid

BUG-PROD-006 final redirects:

- Production `completed` → Production workspace
- Quality `packing → ready` → Quality workspace
- Pickup `completed` → Pickup workspace
- Delivery `completed` → Delivery workspace

BUG-ASSIGN is validated with capability-aware, organization-scoped, active-membership assignment; Pickup and Delivery use separate compatible-staff lists, the controlled select preserves the saved value, and order summary/workspace/My Day remain consistent while the activity is operational and within date rules.

UI validation completed:

- UI-003 shared high-contrast operational CTA styling across My Day and all four workspaces
- UI-MOBILE-001 responsive order/logistics layout with the same data and business logic as desktop; staff dropdown verified on iPhone staging
- UI-BUG-004 readable desktop staff sidebar active item
- UI-FORMAT-005 shared formatting: integer quantities have no unnecessary decimals, real fractional quantities keep only needed decimals, and EUR values always show two decimals

Auth hardening preserved:

- staff invitation no longer depends on Admin `listUsers` enumeration
- invalid or expired callback links clear stale browser sessions before showing an error
- a failed link for one user cannot silently appear authenticated as another cached session
- Auth throttling failures are returned as clear application messages rather than browser 500s
- passwords are never readable or stored by the application
- owner can send passwordless access links and password-reset emails without exposing generated links or tokens
- normal account removal is conservative and membership-oriented; Auth deletion remains separate technical maintenance

## INFRA-001-SMOKE Result

Final result:

`PASS WITH NON-BLOCKING ISSUES`

Validated checkpoints:

| Checkpoint | Area | Result |
| --- | --- | --- |
| 1 | Login e app shell | PASS |
| 2 | Cliente | PASS |
| 3 | Proprietà | PASS |
| 4 | Servizio e prezzo | PASS |
| 5 | Ordine | PASS |
| 6 | Item e totale | PASS |
| 7 | Produzione | PASS |
| 8 | Pickup | PASS |
| 9 | Delivery | PASS |
| 10 | Pagamento | PASS |
| 11 | Foto | PASS |
| 12 | Dashboard | PASS |
| 13 | Logout/login | PASS |

Smoke staging records retained:

- `Cliente Smoke Test`
- `Appartamento Smoke Test`
- `Lavaggio e asciugatura test`
- order `EW-000001`
- one valid order item
- total `25,00 EUR`
- production status `Pronto`
- pickup completed
- delivery completed
- two payments totaling `25,00 EUR`
- balance `0,00 EUR`
- one intake photo

Smoke records remain available on staging for UX and follow-up validation.

## Bugs Resolved During Smoke

- BUG-001 — `create_order` failed because `app_current_organization_id()` used `min(uuid)` and `create_order()` had an ambiguous `id` reference.
- BUG-002 — order list query failed with `PGRST201` because the `profiles` embed was ambiguous.
- BUG-003 — pickup query failed with `PGRST201` because the `profiles` embed was ambiguous.
- BUG-004 — delivery query failed with `PGRST201` because the `profiles` embed was ambiguous.
- BUG-005 — order item creation needed immediate submit locking to reduce repeated-submit risk.
- BUG-006 — order item editing showed too many simultaneous edit forms and save points.

## Unverified or Non-Final Items

- Negative MIME/size upload tests were not executed during smoke.
- Overpayment behavior was not documented with a definitive result.
- Payment actor visibility was not documented with a definitive result.
- `order-media` bucket privacy, file size limit and MIME allowlist were verified read-only during INFRA-001.1.
- Final smoke baseline read-only verification passed during INFRA-001.1.

## Security Notes

- Do not delete the owner Auth user.
- Do not recreate organization, location or membership.
- Do not expose service-role keys, Auth tokens, magic links or passwords in browser code, logs, docs or `NEXT_PUBLIC_*` variables.
- Do not commit `.env.local`.
- Keep `order-media` private.
- Keep `supabase/.temp/` ignored.
- Do not use Docker unless a new decision explicitly approves it.
- Keep one task per commit.
- Do not modify Supabase remote state unless a separate approved implementation task explicitly authorizes it.
- `ENABLE_STAGING_CUSTOMER_PREVIEW=true` is server-only and staging-only. It must not be enabled in a future real production environment.

## UX-002 Completed State

UX-002 is completed and pushed through `730bcae`.

Completed UX scope:

- localized public access to the protected login from desktop and mobile navigation
- iPhone Safari dev-origin hydration fix through Next.js dev configuration
- protected app shell, sidebar, internal header and mobile bottom navigation refinement
- active navigation states and mobile CTA contrast corrections
- operational dashboard hierarchy and quick actions
- order detail information architecture with clearer section order and sticky internal navigation
- final responsive/accessibility pass for contrast and touch targets

UX-002 did not change database schema, migrations, Supabase remote state, RPCs, Server Actions, workflow logic, pricing, payment logic, logistics logic, photo handling or authentication boundaries.

## OPS-001.5 Daily Close Result

Status: Completed and pushed.

Route:

- `/[locale]/app/daily-close`

Access and data boundaries:

- membership is required
- owner and manager are allowed
- staff is redirected to access-denied
- queries are filtered by `organization.id`
- no new migration, RPC, table or role was added

Daily Close shows:

- orders completed today
- orders still open
- orders on hold
- late orders
- pickups not completed
- deliveries not completed
- missing or partial payments
- operational anomalies
- direct order links

Validation:

- owner real access: PASS
- mobile layout: PASS
- counts and sections: PASS
- owner/manager/staff guard: PASS static review
- cross-tenant filtering: PASS static review
- order links: PASS static review
- lint/build/diff-check: PASS
- Vercel staging deployment: Ready
- unauthenticated route access: safe 307 redirect to login
- robots remains `Disallow: /`

Still to verify when dedicated accounts are available:

- real manager access
- real staff denial
- real order-link click with a dedicated session

These are not FAIL results and are not blocking.

Out of scope confirmed:

- advanced accounting
- invoices
- export
- automatic cash close
- mass updates
- new migrations
- new RPCs

## OPS-001.6 Operational Alerts Result

Status: Completed and pushed.

Route:

- `/[locale]/app/alerts`

Access and data boundaries:

- membership is required
- owner and manager are allowed
- staff is denied
- queries are filtered by `organization_id`
- no cross-tenant data is exposed
- no new migration, RPC, table, dependency or role was added

Operational Alerts includes:

- late orders
- on-hold orders
- open orders without an assignee
- pickups due within 2 hours
- overdue pickups
- deliveries due within 2 hours
- overdue deliveries
- missing or partial payments
- operational anomalies from logistics without an assignee

Rules:

- severity is `critical`, `warning` or `info`
- organization timezone is used
- due-soon means within the next 2 hours
- overdue logistics means the scheduled time is in the past and the activity is not completed
- completed or cancelled orders are excluded from lateness alerts
- orders without `due_at` are not marked late
- completed logistics are excluded
- payment residuals are clamped so they never become negative
- alerts are deduplicated

Validation:

- real owner access: PASS
- local UI review: PASS
- badge and page total: PASS
- severity counts and urgency ordering: PASS
- duplicate review: PASS
- mobile layout: PASS
- order links: PASS
- lint/build/diff-check: PASS
- Vercel staging deployment: Ready
- unauthenticated route access: safe 307 redirect to login
- robots remains `Disallow: /`
- no HTTP 500 observed
- real manager access with Manager Test: PASS
- real staff denial: PASS

These are not FAIL results and are not blocking.

Out of scope confirmed:

- email, push, WhatsApp, SMS, webhook, cron or external automation
- persistent notification records
- new tables, migrations or RPCs
- new dependencies

## Historical Resume Point — Superseded 2026-09-12 Checkpoint

There is no current SMTP delivery block. AUTH-INFRA-001 enabled Resend Custom SMTP and a real Supabase Auth email was sent and received successfully. The configured limit is 30 Auth emails/hour; endpoint-specific throttling can still apply, so access/reset actions should remain deliberate and application errors must stay user-friendly.

LOGISTICS-COMPLETED-HISTORY-001 is COMPLETE / STABLE. Completed pickup/delivery history stays separate from open queues and Mi día; do not reopen accepted history, tenant-timezone, fulfillment, receipt, Accounting or payment/refund foundations unless a reproducible defect is found.

1. Draft logistics may be configured but are not yet operational work for staff.
2. Logistics becomes operational from `received` onward.
3. Production `completed` means ready, not fulfilled or closed.
4. Open pickup/delivery remains visible after production completion.
5. The order remains in operational custody/stock until real customer pickup or delivery completion.

Open finding only, not yet implemented:

1. `RECEIPT-COMPACT-LINES-UX` — non-blocking future vertical-space optimization for long descriptions, preserving readability and print safety.

Production remains deferred until the pilot product is functionally complete. The real operational pilot must not use the `PILOT-001` identifier; track that later as `PILOT-002` or as the M1 First Laundry Operational Pilot.

Official working loop:

1. The Product Owner defines the desired behavior and performs simple visual or functional checks.
2. ChatGPT acts as CTO, architect and reviewer, then prepares the Codex task.
3. Codex implements and validates the scoped change.
4. Keep the Product Owner's technical workload minimal.
5. Keep one task per logical commit; commit, push and deploy only after Product Owner approval.

## Resume Commands

```bash
cd /Users/cristianomegale/EcoWash-Phoenix
git status --short
git branch --show-current
git log -10 --oneline --decorate
git ls-remote origin refs/heads/main
```

Useful URLs:

```text
http://localhost:3000/it/login
http://localhost:3000/it/app
http://localhost:3000/it/app/customers
http://localhost:3000/it/app/services
http://localhost:3000/it/app/orders
http://localhost:3000/it/app/pos
http://localhost:3000/it/app/control
http://localhost:3000/it/app/work
http://localhost:3000/it/app/work/pickups
http://localhost:3000/it/app/work/production
http://localhost:3000/it/app/work/quality
http://localhost:3000/it/app/work/deliveries
http://localhost:3000/it/app/staff
http://localhost:3000/it/app/alerts
http://localhost:3000/it/portal
http://localhost:3000/it/portal/orders
http://localhost:3000/it/portal/support
```
