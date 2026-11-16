# Codex Execution Context

Status: Active
Scope: Stable operating protocol for EcoWash Phoenix Codex tasks

Read [AGENTS.md](../AGENTS.md), [Session Handover](00_START_HERE/SESSION_HANDOVER.md) and [Project Status](06_ROADMAP/Project_Status.md) before implementation. This supplementary protocol does not own product status or the next task. [CODEX_CURRENT_BASELINE.md](CODEX_CURRENT_BASELINE.md) is a compatibility pointer with historical evidence. The explicit task prompt remains authoritative.

## A. Responsibilities

- The Product Owner defines the desired outcome and acceptance criteria.
- The CTO/Architect prompt defines scope, constraints and approved architecture decisions.
- Codex implements, validates and reports the scoped task; commit/push require explicit phase authorization.
- Codex must not invent product requirements or expand into unapproved work.

## B. Repository and Git

- `main` is the authoritative completed baseline.
- Keep one logical task in one logical application commit where practical; use a separate docs commit when useful.
- Preserve the branch and worktree required by the task. Do not create a WIP branch, preservation commit or other branch automatically.
- Preserve interrupted work safely; never reset, clean or discard unknown work.
- A local-only task normally ends with its authorized uncommitted diff. After an explicitly authorized push, verify `main == origin/main` and a clean worktree. Preserve known WIP from other missions.

## C. Multi-Tenancy — P0

- Validate tenant ownership server-side for organization, customer, order, catalog, pricing, payment, POS/till, invoice, print document and terminal data.
- Tenant IDs from the client are never sufficient authorization.
- Preserve tenant-scoped RLS, composite relationships and explicit organization checks.
- No cross-tenant reads, writes, joins, identifiers or document output.

## D. Authorization

- Established contexts are Platform Admin, tenant Owner, Manager, Staff and Customer.
- Platform Admin is separate from tenant roles. Customer access remains portal-scoped.
- Respect the existing role, operational-capability and entitlement layers.
- Owner and Manager inherit established operational capabilities; Staff needs the required explicit capability where defined.
- Do not widen permissions, grants, roles, capabilities or entitlements without an explicit task requirement.

## E. Canonical Domain Rules

Reuse these existing sources of truth:

- Catalog: stable tenant service/category identities, tenant-authored locale presentation, service prices, visibility, orderability and lifecycle rules.
- Effective pricing: the centralized resolver, including catalog segments, segment overrides and safe base-price fallback.
- Customers: canonical tenant customer records and established lifecycle state.
- Orders: canonical orders/items/history and immutable monetary snapshots.
- POS: canonical till sessions, movements, reconciliation and active-session rules.
- Payments: the canonical confirmed/refunded ledger.
- Customer Account: read-time financial view over canonical orders and payments.
- Billing: canonical invoice records derived from established order/payment truth.
- Online payments: provider attempts are separate from confirmed canonical payments.
- Shop Terminal: counter UX over customers, catalog, pricing, orders, till and payments.
- Printing: persistent historical operational receipts with immutable snapshots and issue-time numbering; tickets/labels reuse canonical order/item data. Opening a receipt issue route may write a document; reprint/history are distinct from payments and Accounting. Operational receipts remain non-fiscal.
- Entitlements: centralized feature catalog and organization entitlement state.
- Platform Admin: separate SaaS control context with audited cross-tenant administration.

Never create a parallel domain, pricing, order, payment, POS, invoice, terminal, entitlement or identity engine unless explicitly approved.

## F. Financial Safety

- Prices, discounts, totals, balances and payment eligibility are server-authoritative.
- Write confirmed money only through the canonical payments ledger.
- No fake payments, duplicate settlement, silent overpayment or client-trusted totals.
- Preserve historical orders, price snapshots, invoices and financial rows.
- Enforce idempotency and concurrency safety for retryable financial mutations.
- Established order discount semantics are absolute monetary amounts, not percentages.
- Online payment attempts are not confirmed money.
- Browser redirects are never authoritative payment confirmation; verified provider settlement is required.

## G. POS and Shop Terminal

- Reuse a valid existing open till; never create a duplicate till session.
- Cash and manual card payments use canonical payment/POS functions.
- PAY LATER creates an order/receivable with outstanding value and no fake payment row.
- Shop Terminal is UX over the existing domain, not a separate POS engine.
- New occasional visits use the tenant-scoped `WALKIN-SHARED` technical customer with order-local visitor name/phone; legacy `WALKIN-<UUID>` customers remain historical. Separate Venta/draft identities must be preserved. Do not recreate the superseded per-visit-customer model.

## H. Security

- Service Role credentials are server-side only. Never expose secrets in browser code, logs, docs or commits.
- Never store or process raw PAN, CVV or PIN.
- Do not trust client financial values or tenant ownership claims.
- Preserve RLS and explicit tenant validation at server/database boundaries.
- `SECURITY DEFINER` functions require a safe fixed `search_path`, least-privilege grants and validated caller/tenant context.

## I. Migration Policy

- Use migrations only when explicitly needed and authorized. Preserve applied migration history; an unapplied local migration can be corrected within its approved phase rather than automatically adding a follow-up.
- Never edit a migration already applied to any shared environment.
- Use the next free migration number; resolve filename collisions before application.
- Preserve historical tenant, operational and financial data.
- Verify local/remote migration alignment before finalization when migrations are in scope.

## J. Internationalization, Time and Money

- System UI supports IT, EN, ES, FR and DE with matching translation-key structures.
- Do not auto-translate tenant-entered catalog or service data.
- Catalog translations remain optional tenant-owned presentation over one canonical service/category identity; fallback must never create duplicate services.
- Bulk catalog exchange must reconcile by tenant-scoped stable ID/code, require preview before atomic confirmation, preserve blank/missing values non-destructively and exclude unsafe pricing mutation.
- Use the active organization timezone for business-day and user-facing time behavior.
- Use canonical locale/currency formatting; do not show raw UTC timestamps in user-facing UI.

## K. Task Size Policy

- **S — Surgical:** small bug or UI change; minimal files and focused tests.
- **M — Feature:** bounded module; focused tests plus directly connected regressions.
- **L — Architecture / Financial / Security:** expanded design, migration, security and financial QA.
- Do not treat every task as L.

## L. Inspection Policy

- Inspect only the modules and files required by the task.
- Reuse documented architecture; do not rediscover or re-audit known systems.
- Do not reread unrelated modules or run a repository-wide audit unless explicitly required.

## M. Test Policy

During implementation:

- Run focused tests only.
- After a failure, rerun only the failing or directly affected tests.

Final task verification:

- Module-focused tests.
- Directly connected regressions.
- Scoped ESLint and TypeScript when relevant to the task.
- Production build when appropriate or explicitly required, after the patch is stable; documentation-only work needs no application tests/build.
- `git diff --check`.

Run full-product QA only for a release, milestone, architecture-critical task or explicit Product Owner request.

## N. Build Policy

- Do not run a production build during early iteration.
- When a build is required, run it after implementation and focused tests are stable.
- Avoid repeating a successful build. If code changes afterward, rerun only what the change requires.

## O. E2E and Fixture Policy

- Reuse existing QA/E2E helpers where available.
- Use deterministic controlled data and exact assertions.
- Prefer transaction rollback; otherwise perform explicit cleanup.
- Finish with zero persistent temporary fixtures and no staging/production financial contamination.
- Do not create another fixture system unnecessarily.
- Current contract tests live in `tests/*.test.mjs`; task-local database E2E scripts must remain temporary and be removed after proof.

Future recommendation: **QA-HARNESS-001** — consolidate reusable authenticated tenant setup, rollback cleanup and canonical ledger assertions to reduce repeated E2E setup without changing module test ownership.

## P. Documentation Policy

- Update only documents materially affected by a normal task.
- Keep current continuation and product status in `SESSION_HANDOVER.md` and `Project_Status.md`; update only when the task phase authorizes documentation changes.
- Keep `CODEX_CURRENT_BASELINE.md` as a compatibility pointer and historical evidence, not a duplicate mutable status inventory.
- Update Roadmap only when roadmap decisions change; update Milestones only when milestone state changes.
- Use periodic `DOCS-SYNC` work to consolidate broader documentation after several tasks.
- Do not rewrite all docs after every small task.
- The current sections of the two canonical documents supersede archived next-task prose. No document grants implementation, commit or remote-mutation authorization by itself.

## Q. Credit and WIP Recovery Policy

If available usage is insufficient to complete safely:

1. Stop before another implementation phase.
2. Do not leave a destructive operation incomplete.
3. Preserve the current worktree and identify task-owned versus pre-existing changes.
4. Do not stage, commit, create a branch or push merely because usage is low.
5. Report branch/HEAD, exact changed files, completed work, remaining work, passed tests and the next authorized action.

Do not consume remaining usage by repeating audits, successful tests or builds.

## R. Resume Policy

- Do not restart, reset or re-audit preserved work.
- Initially inspect only status, branch, recent log and focused diff/stat.
- If the task baseline differs, report it and follow the task's stop condition; do not realign history or preserved WIP automatically.
- Finish only remaining work, run only unfinished tests and execute the final quality gate once.

## S. Visual Task Policy

- Implement the approved UX direction; do not use Codex for broad visual exploration.
- Use browser visual inspection when available.
- If unavailable, perform structural responsive checks once and leave final visual acceptance to the Product Owner when needed.
- Do not repeatedly retry unavailable visual tooling.

## T. Finalization

Before reporting READY, as applicable:

- Focused tests and directly related regressions pass.
- Lint passes.
- Production build passes when required by the task or a concrete release risk.
- `git diff --check` passes.
- Temporary fixtures are removed.
- Migration alignment is verified when applicable.
- Commit/push are performed only in an explicitly authorized phase, with an exact reviewed staging list.
- After push, `main == origin/main` and worktree is clean; local-only tasks report the authorized uncommitted diff and preserved unrelated WIP.

## U. Final Report

Keep it concise and report:

1. Implemented outcome.
2. Important architecture or root-cause decision.
3. Migration yes/no and filename.
4. E2E proof when applicable.
5. Tests.
6. Lint/build/diff results.
7. Fixture cleanup.
8. Application commit SHA.
9. Docs commit SHA when applicable.
10. Latest migration.
11. `main`/`origin` status.
12. READY or BLOCKED.

## Future Prompt Template

```text
TASK: <ID + title>

Read and follow:
AGENTS.md
docs/00_START_HERE/SESSION_HANDOVER.md
docs/06_ROADMAP/Project_Status.md
docs/CODEX_EXECUTION_CONTEXT.md

GOAL
...

CHANGE ONLY
...

REUSE
...

DO NOT
...

ACCEPTANCE
1. ...
2. ...
3. ...

TEST
- focused tests
- directly related regressions
- scoped lint and TypeScript where applicable
- production build once when appropriate/required
- git diff --check

COMMIT/PUSH
...

REPORT
concise READY / BLOCKED
```
