# Session Handover

Status: Active

Date: 2026-07-30

Approximate closeout time: around 18:00 Europe/Madrid

Session checkpoint: INFRA-001-SMOKE completed; INFRA-001.1 next

Repository: `/Users/cristianomegale/EcoWash-Phoenix`

Branch: `main`

HEAD: `f94df88 INFRA-001-SMOKE fix: resolve staging smoke test blockers`

Origin/main status: local `main` and local `origin/main` point to `f94df88`; verify with network tomorrow.

Working tree status at closeout start: clean

Commit status: INFRA-001-SMOKE already committed and pushed.

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

Applied baseline migrations:

- `20260727000100_app_003_tenant_foundation.sql`
- `20260728000100_app_005_customers_properties.sql`
- `20260728000200_app_006_orders_workflow.sql`
- `20260728000300_app_007_logistics_photos_payments.sql`
- `20260728000400_app_008_1_organization_timezone.sql`

Smoke corrective migration now committed locally:

- `20260730000100_infra_001_smoke_fix_order_helper_and_embeds.sql`

## Migration Warning

REMOTE SQL APPLIED MANUALLY — MIGRATION HISTORY VERIFICATION PENDING

During INFRA-001-SMOKE, the corrective SQL for `app_current_organization_id()` and `create_order()` was applied manually in EcoWash Staging through SQL Editor so the smoke test could continue. The matching local migration is now present in Git, but the remote migration history still needs a controlled CLI verification.

Do not rerun the corrective migration blindly. Do not use `supabase migration repair` without diagnosis and explicit approval. Do not run `supabase db reset --linked`, `supabase migration up`, or `supabase db push` during closeout. The next task must compare local and remote migration state before choosing a reconciliation method.

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

Do not delete or alter smoke records before migration reconciliation is complete.

## Bugs Resolved During Smoke

- BUG-001 — `create_order` failed because `app_current_organization_id()` used `min(uuid)` and `create_order()` had an ambiguous `id` reference.
- BUG-002 — order list query failed with `PGRST201` because the `profiles` embed was ambiguous.
- BUG-003 — pickup query failed with `PGRST201` because the `profiles` embed was ambiguous.
- BUG-004 — delivery query failed with `PGRST201` because the `profiles` embed was ambiguous.
- BUG-005 — order item creation needed immediate submit locking to reduce repeated-submit risk.
- BUG-006 — order item editing showed too many simultaneous edit forms and save points.

## Unverified or Non-Final Items

- `order-media` bucket privacy was not reverified directly during the final photo checkpoint, though it had been confirmed during INFRA-001.
- Negative MIME/size upload tests were not executed during smoke.
- Overpayment behavior was not documented with a definitive result.
- Payment actor visibility was not documented with a definitive result.
- Final read-only database verification via CLI was not executed.
- Remote migration history is not reconciled for the manually applied smoke corrective SQL.

## Security Notes

- Do not delete the owner Auth user.
- Do not recreate organization, location or membership.
- Do not expose service-role keys in browser code or `NEXT_PUBLIC_*` variables.
- Do not commit `.env.local`.
- Keep `order-media` private.
- Keep `supabase/.temp/` ignored.
- Do not use Docker unless a new decision explicitly approves it.
- Keep one task per commit.
- Do not start UX-002 before INFRA-001.1 is closed or explicitly paused.

## Next Approved Task

`INFRA-001.1 — Reconcile Supabase migration history and finalize smoke baseline`

Scope for tomorrow:

1. Verify Git local/remote state.
2. Authenticate Supabase CLI in a controlled way if required.
3. Run `supabase migration list`.
4. Compare local and remote migration histories.
5. Verify presence or absence of `20260730000100_infra_001_smoke_fix_order_helper_and_embeds.sql` in remote history.
6. Do not rerun SQL blindly.
7. Define the safe reconciliation method.
8. Verify the `order-media` bucket.
9. Execute final read-only verification.
10. Update docs and close INFRA-001.1.

## Following Candidate Task

`UX-002 — App landing/dashboard and operational layout refinement`

UX-002 is not started. Likely scope after INFRA-001.1:

- initial dashboard hierarchy
- visual density and scanning
- desktop/mobile app layout
- clearer public-site access to login
- simpler panels and actions
- no changes to stable domain logic without a separate approved task

## Resume Commands

```bash
cd /Users/cristianomegale/EcoWash-Phoenix
git status --short
git branch --show-current
git log -10 --oneline --decorate
git ls-remote origin refs/heads/main
npm run dev
```

Useful URLs:

```text
http://localhost:3000/it/login
http://localhost:3000/it/app
http://localhost:3000/it/app/customers
http://localhost:3000/it/app/services
http://localhost:3000/it/app/orders
```
