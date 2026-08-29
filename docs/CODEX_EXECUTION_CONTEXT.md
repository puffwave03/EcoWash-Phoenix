# Codex Execution Context

Status: Active
Scope: Stable operating protocol for EcoWash Phoenix Codex tasks

Read this file with `docs/CODEX_CURRENT_BASELINE.md` before implementation. The Product Owner's explicit task instructions remain authoritative.

## A. Responsibilities

- The Product Owner defines the desired outcome and acceptance criteria.
- The CTO/Architect prompt defines scope, constraints and approved architecture decisions.
- Codex implements, validates, commits and reports the scoped task.
- Codex must not invent product requirements or expand into unapproved work.

## B. Repository and Git

- `main` is the authoritative completed baseline.
- Keep one logical task in one logical application commit where practical; use a separate docs commit when useful.
- Do not start unrelated development directly on `main`. Use a scoped WIP branch while implementation is unfinished.
- Preserve interrupted work safely; never reset, clean or discard unknown work.
- Normal final state: `main == origin/main` and working tree clean.

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

- Catalog: tenant services, service prices, visibility and orderability rules.
- Effective pricing: the centralized resolver, including catalog segments, segment overrides and safe base-price fallback.
- Customers: canonical tenant customer records and established lifecycle state.
- Orders: canonical orders/items/history and immutable monetary snapshots.
- POS: canonical till sessions, movements, reconciliation and active-session rules.
- Payments: the canonical confirmed/refunded ledger.
- Customer Account: read-time financial view over canonical orders and payments.
- Billing: canonical invoice records derived from established order/payment truth.
- Online payments: provider attempts are separate from confirmed canonical payments.
- Shop Terminal: counter UX over customers, catalog, pricing, orders, till and payments.
- Printing: read-only receipt, ticket and label projections over canonical order/payment data.
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
- Walk-ins are distinct, traceable, canonical tenant-scoped customers; do not use a shared anonymous customer.

## H. Security

- Service Role credentials are server-side only. Never expose secrets in browser code, logs, docs or commits.
- Never store or process raw PAN, CVV or PIN.
- Do not trust client financial values or tenant ownership claims.
- Preserve RLS and explicit tenant validation at server/database boundaries.
- `SECURITY DEFINER` functions require a safe fixed `search_path`, least-privilege grants and validated caller/tenant context.

## I. Migration Policy

- Use the smallest required additive follow-up migration.
- Never edit a migration already applied to any shared environment.
- Use the next free migration number; resolve filename collisions before application.
- Preserve historical tenant, operational and financial data.
- Verify local/remote migration alignment before finalization when migrations are in scope.

## J. Internationalization, Time and Money

- System UI supports IT, EN, ES, FR and DE with matching translation-key structures.
- Do not auto-translate tenant-entered catalog or service data.
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
- `npm run lint`.
- One production build when product code changed.
- `git diff --check`.

Run full-product QA only for a release, milestone, architecture-critical task or explicit Product Owner request.

## N. Build Policy

- Do not run a production build during early iteration.
- Run it after implementation and focused tests are stable.
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
- Update `CODEX_CURRENT_BASELINE.md` after each completed product task.
- Update `SESSION_HANDOVER.md` only when continuity requires it.
- Update Roadmap only when roadmap decisions change; update Milestones only when milestone state changes.
- Use periodic `DOCS-SYNC` work to consolidate broader documentation after several tasks.
- Do not rewrite all docs after every small task.
- For the immediate next-task pointer, `CODEX_CURRENT_BASELINE.md` supersedes older status prose until the next relevant docs sync.

## Q. Credit and WIP Recovery Policy

If available usage is insufficient to complete safely:

1. Stop before another implementation phase.
2. Do not leave a destructive operation incomplete.
3. Create or use `wip/<task-id>`.
4. Run `git add -A` only after reviewing the exact worktree scope.
5. Create one WIP preservation commit.
6. Report the WIP branch/SHA, completed work, remaining work, passed tests and exact next action.

Do not consume remaining usage by repeating audits, successful tests or builds.

## R. Resume Policy

- Do not restart, reset or re-audit preserved work.
- Initially inspect only status, branch, recent log and focused diff/stat.
- Integrate latest `main` safely when required and preserve both current baseline and WIP.
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
- Production build passes when product code changed.
- `git diff --check` passes.
- Temporary fixtures are removed.
- Migration alignment is verified when applicable.
- Required commits are pushed.
- `main == origin/main` and working tree is clean.

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
docs/CODEX_EXECUTION_CONTEXT.md
docs/CODEX_CURRENT_BASELINE.md

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
- lint
- production build once if product code changed
- git diff --check

COMMIT/PUSH
...

REPORT
concise READY / BLOCKED
```
