# QA-PRODUCT-001 — Full Product Acceptance Test

Status: PASS WITH NON-BLOCKING ISSUES

Date: 2026-08-28

Baseline:

- application: `28b5e26 POS-001 feat: add vendor-neutral cash register and payments`
- documentation: `56a1a07 DOCS-POS-001 docs: record POS foundation and product QA gate`
- branch: `main`, synchronized with `origin/main` at QA start
- migrations: local and linked staging aligned through `20260828000100`
- initial and final fixture state: clean

## Acceptance scope

Validated modules:

- Platform Admin and tenant administration
- Owner, Manager and capability-scoped Staff access
- Customer Portal
- catalog, customer segments and segment pricing
- customer lifecycle
- orders, pickup, production, quality and delivery
- canonical payments and POS
- Customer Account and Billing
- entitlements, tenant suspension/reactivation and Tenant A/B isolation

Future modules were not tested or implemented: printing, barcode, real payment terminals, accounting, e-invoicing, onboarding and subscription collection.

## Automated and contract tests

All existing focused suites passed once:

| Suite | Result |
| --- | ---: |
| Authenticated shell | 2/2 PASS |
| Catalog | 8/8 PASS |
| Catalog segments | 9/9 PASS |
| Segment pricing | 20/20 PASS |
| Customer Account | 13/13 PASS |
| Customer lifecycle | 10/10 PASS |
| Billing | 12/12 PASS |
| Entitlements | 18/18 PASS |
| Platform Admin | 20/20 PASS |
| POS | 31/31 PASS |
| Total | 143/143 PASS |

## Controlled staging master scenario

The master scenario ran inside one database transaction and finished with `ROLLBACK`. It exercised nine controlled existing Auth identities/roles plus a temporary Tenant B. No permanent Platform Admin or business fixture remained.

Flow:

Platform Admin → tenant/entitlement/audit setup → customer → property → segment → base and segment price → order → pickup → production → quality → delivery → POS payments/refund/reconciliation → Customer Account → Billing → Customer Portal → price deactivation/history → lifecycle → suspension/reactivation.

Roles:

- Platform Admin listed and managed both tenants, changed entitlements/commercial metadata, read audit, suspended/reactivated the tenant and retained access while suspended.
- Tenant Owner managed the complete tenant flow but was denied Platform RPCs and entitlement self-upgrade.
- Manager used catalog pricing, Customer Account, Billing and POS, while Owner-only Staff capability management remained denied.
- Staff without the required capability was denied; Pickup, Production, Quality, Delivery and POS-capable Staff completed only their assigned operations.
- Customer used only the dedicated Portal, saw the assigned customer/catalog/order/financial data and could not access another customer or tenant.

## Exact financial proof

| Value | Verified |
| --- | ---: |
| Base price | EUR 10.00 |
| Segment price | EUR 7.50 |
| Order | 2 × EUR 7.50 = EUR 15.00 |
| Cash payment | EUR 5.00 |
| Manual-card payment | EUR 10.00 |
| Initial net paid / outstanding | EUR 15.00 / EUR 0.00 |
| Controlled cash refund | EUR 5.00 |
| After refund net paid / outstanding | EUR 10.00 / EUR 5.00 |
| Final repayment | EUR 5.00 |
| Final net paid / outstanding | EUR 15.00 / EUR 0.00 |
| Till expected / counted / difference | EUR 105.00 / EUR 104.00 / EUR -1.00 |
| Issued invoice total | EUR 15.00 |

The order, canonical payments ledger, POS, Customer Account, Portal financial RPCs and Billing snapshots agreed. Disabling the segment override changed future resolution to the EUR 10.00 base price without changing the EUR 15.00 historical order or invoice.

## Security and lifecycle proof

- Tenant A could not read Tenant B customers, properties, catalog, segments, prices, orders, payments, POS sessions, invoices, entitlements or branding.
- Platform Admin was the only intentional cross-tenant exception.
- `billing.invoicing`, `pricing.segment_overrides`, `branding.full_white_label` and `pos` were each disabled and re-enabled through audited Platform RPCs. Disabled mutations were rejected and data remained present.
- Tenant Owner could not write entitlements directly.
- Suspension blocked tenant and Portal pre-request checks while Platform Admin retained management access; reactivation restored normal checks.
- Customer deactivation preserved properties, orders, payments, invoice and histories, blocked internal/Portal creation and disabled Portal access. Reactivation did not recreate Portal credentials implicitly.
- POS idempotency, overpayment rejection, closed-till rejection and Staff capability boundaries passed.

## Route, render and performance sanity

- Production build compiled, passed TypeScript and generated 197 static pages.
- The build manifest contains all primary Platform, App, Control, Staff work, POS, Billing and Portal routes.
- Staging `/it` returned HTTP 200 in 0.46 seconds.
- Unauthenticated App, Platform, Portal, POS, Billing, Control, Staff work and directory routes returned HTTP 307 to `/it/login`, with no unexpected 404, redirect loop or 5xx response.
- Authenticated shell contracts confirmed that marketing chrome is absent from App/Portal surfaces.
- Critical recent modules use bounded database lists and parallel independent queries; no obvious unbounded-list, severe N+1 or duplicate-action regression was found.

## Observations and limitations

- Interactive authenticated screenshot tooling was unavailable in this Codex session. Desktop/mobile visual acceptance was not executed and is not reported as PASS. The Product Owner should perform the separate visual check.
- A Product Owner report that staging pages had loading problems from another PC was not reproduced. Current public and protected-route checks were fast and healthy. A local browser/session/network or transient deployment condition remains possible; collect the affected URL, timestamp, browser and visible error if it recurs.

## Defects and cleanup

- P0: none
- P1: none
- P2: none
- P3: none
- application fixes: none required
- migration changes: none required
- temporary customer, tenant, segment, price, order, payment, POS, invoice, entitlement, status and Platform Admin fixtures: rollback verified
- temporary QA SQL file: removed

## Quality gate

- `npm run lint`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS
- linked migration alignment through `20260828000100`: PASS

Overall result: **PASS WITH NON-BLOCKING ISSUES**.

Next task: `PRINT-001`.

## Post-acceptance follow-up — POST-QA-PRODUCT-001

Completed on 2026-08-28 after the acceptance baseline:

- corrected the Customer Account history filter so its active link forces white text over the primary background, exposes `aria-current="page"` and has an explicit keyboard focus ring;
- added a focused contrast/accessibility contract regression;
- configured four real EcoWash staging segments through the existing Owner/Manager RPC, with active and Portal-visible state and no copied services or price overrides;
- verified mappings: Case Vacanze / Property Manager (35 explicit services, 4 categories), Hotel (9, 3), Ristorazione (3, 1), Privati (18, 5);
- verified base-price fallback and full-catalog continuity: 65 personalized Portal matches, 138 remaining services, 203 priced rows and zero missing prices;
- bootstrapped the sole verified EcoWash Owner (`f1237796-aa9d-4069-aca2-7a926e0b241e`) as an active Platform Admin without changing the Owner membership;
- passed rollback-only Owner/Manager assignment and removal, Staff/Customer denial, Platform access, tenant-isolation and Portal personalization checks;
- passed 61 focused Customer Account, catalog-segment, entitlement and Platform Admin tests, lint, production build and `git diff --check`.

Interactive browser control was not exposed in the session, so the specific contrast fix is verified by source contract and production compilation rather than an authenticated screenshot. No temporary customer or SQL fixture remains. `PRINT-001` is still next and was not started.
