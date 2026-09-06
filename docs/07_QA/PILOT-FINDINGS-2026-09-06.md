# EcoWash Phoenix — Pilot Findings

Date: 2026-09-06
Status: Active pilot backlog
Owner: Product Owner
Scope: staging / real counter usage

## Purpose

Capture only confirmed Product Owner findings from real staging use, keep implementation order explicit, and avoid mixing unrelated changes into one task.

## Execution rule

For each item: CTO triage -> smallest safe implementation -> focused regression checks -> build when relevant -> staging deployment -> Product Owner validation -> closeout/docs. One task at a time. Do not combine fiscal, accounting, pricing, authentication or tenant-isolation changes unless the task explicitly requires them.

## P1 — TERMINAL-MULTI-DRAFT-001

### Finding

In the fixed laundry counter Terminal, starting an order for Customer A, switching to Customer B, and then returning to Customer A currently loses the unsubmitted cart/work already entered for Customer A.

### Approved product behaviour

- Preserve an unsubmitted working draft per customer while the operator remains in the Terminal workflow.
- Switching customers must not discard the previous customer's cart.
- Returning to a customer restores that customer's current draft exactly.
- Draft state must remain operational only: it must not create an order, payment, invoice or accounting entry before final confirmation.
- Preserve current segment/catalog eligibility semantics for each selected customer.
- A completed/submitted order clears only the completed customer's draft.
- The UI should make an existing draft discoverable, preferably with a concise indicator such as customer + open draft + item count.
- Survive an accidental page refresh where practical without weakening tenant/session boundaries.

### Guardrails

No pricing precedence changes. No payment logic changes. No Billing/fiscal changes. No RLS/auth changes. No database migration unless a concrete requirement proves client/session persistence insufficient.

## P2 — TERMINAL-CLOSE-PRINT-001

### Finding

After final order confirmation at the laundry counter, printing customer output and garment/item labels should be offered immediately instead of requiring the operator to find each print action manually.

### Approved product behaviour

- After successful order creation, show one clear final print confirmation step.
- Offer customer receipt and item/garment labels as selectable outputs.
- Ask before printing; do not trigger unsolicited printing.
- Provide a clear "Print and finish" path and a "Finish without printing" path.
- Reuse the canonical PRINT/BARCODE renderers and existing order/item identifiers.
- Label count/semantics must follow the established discrete/continuous service rules.
- For now call the customer output "receipt" / operational receipt, not "fiscal receipt". Fiscal issuance remains a separate future adapter/provider decision.

### Guardrails

No new fiscal-compliance claim. No silent printing. No raw printer-driver integration. No duplicate order/payment creation from print actions.

## P3 — PRINTER-CONFIG-002

### Finding

A commercial laundry may need several physical printer types at one location and different output purposes.

### Approved direction

Evolve Settings > Printers into multi-printer output routing while preserving the existing provider-neutral architecture.

Expected logical purposes:

- customer receipt: 58 mm / 80 mm / browser-PDF where appropriate
- garment/item labels: custom thermal label size, orientation, copies, margins/gap
- internal ticket: optional production/counter ticket
- documents: standard A4/PDF where required later

Each configured printer/profile should support, as applicable:

- custom name
- location
- output purpose(s)
- default assignment per location/purpose
- connection mode
- active/inactive state
- test-print affordance when a real transport exists
- safe browser/system fallback

Connection architecture stays separated from logical routing:

- browser/system print: current functional transport
- network printer: configuration boundary until real adapter exists
- local bridge/print agent: configuration boundary until real adapter exists
- future provider/adapter: explicit integration, never simulated connectivity

## Other pilot items already noted

- Public Phoenix branding: approved Phoenix by EcoWash full lockup is the public-site master; Phoenix product mark is the technical favicon/icon mark. Completed baseline.
- Portal/Terminal mobile work: continue Product Owner visual regression testing.
- Locale/menu consistency: navigation and user-facing menus should follow the active/login locale; treat any confirmed mismatch as a focused i18n bug task.

## Deferred / separate workstreams

- TERMINAL-DISCOUNTS-001: line/global, amount/percentage discount model.
- BACKUP-DR-001: database/storage backup, retention, restore procedure and restore test.
- OFFLINE-RESILIENCE-001: explicit offline state, safe cache/queue boundaries and finance restrictions.
- Fiscal / VERI*FACTU: paused. Future direction remains Phoenix core -> provider-neutral Fiscal Adapter -> selected specialist provider -> AEAT. Do not implement until Product Owner decision.

## Current recommended order

1. TERMINAL-MULTI-DRAFT-001
2. Product Owner staging validation
3. TERMINAL-CLOSE-PRINT-001
4. Product Owner staging validation
5. PRINTER-CONFIG-002
6. Continue pilot findings one at a time
