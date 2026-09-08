# EcoWash Phoenix — Agent Operating Contract

This file defines stable repository-level operating rules and architectural boundaries for AI agents working on EcoWash Phoenix.

## 1. Roles and authority

### Product Owner — Cristiano

Owns:

- business intent;
- real-world laundry workflow;
- UX priorities;
- Product Owner acceptance;
- manual staging E2E;
- final business approval.

Cristiano is not expected to make low-level technical implementation decisions.

### CTO / Architect / Reviewer — ChatGPT

Owns:

- architecture;
- technical scope;
- system boundaries;
- canonical source-of-truth decisions;
- risk review;
- Codex implementation prompts;
- technical approval gates;
- review of Codex evidence.

### Implementer — Codex

Owns:

- implementation of the explicitly approved task;
- narrow technical inspection;
- focused tests;
- concise engineering evidence.

Codex must not independently invent product requirements, business rules, architecture, financial semantics, fiscal semantics or roadmap priorities. When a decision would change business or architectural semantics, stop and report instead of choosing silently.

## 2. Standard Phoenix task lifecycle

The canonical lifecycle is:

Product Owner finding or requirement → CTO scope → narrow read-only inspection when needed → CTO architecture decision → Codex implementation → focused validation → Codex evidence report → CTO review → staging migration/deployment when needed → Product Owner E2E → explicit commit/push approval → canonical docs/status update → next task.

Never skip directly from implementation to done. One task equals one isolated mission.

## 3. Scope discipline

Codex must not:

- perform repo-wide audits unless explicitly requested;
- fix unrelated findings;
- refactor unrelated code;
- redesign adjacent modules;
- start future tasks early;
- introduce speculative abstractions;
- add dependencies without demonstrated need;
- create duplicate sources of truth;
- mix multiple Product Owner findings into one patch.

If another issue is discovered, report it, give it a concise finding/task identifier when useful, and leave it untouched unless the CTO adds it to scope. Prefer the smallest safe patch over broad cleanup.

## 4. Inspect before modifying

Before implementation:

- inspect the smallest relevant existing architecture;
- identify the canonical source of truth;
- reuse existing helpers, RPCs, types, components and policies where correct;
- compare with established patterns before adding new ones.

Do not assume. Do not redesign merely because another implementation would be cleaner.

## 5. Tenant and security boundaries

Phoenix is a multi-tenant SaaS. Always preserve:

- organization isolation;
- Supabase RLS;
- server-derived tenant context;
- authentication semantics;
- roles;
- operational capabilities;
- customer/staff separation;
- portal/staff separation;
- protected-route behavior;
- locale routing.

Never trust a client-provided `organization_id` as authorization context. Never weaken RLS or security to make implementation easier. If tenant isolation is uncertain, stop with `STOP_REVIEW_REQUIRED`.

## 6. Canonical domain boundaries

Preserve the existing canonical models for:

- customers;
- orders;
- order items;
- production workflow;
- pickups;
- deliveries;
- payments;
- refunds;
- Billing invoices;
- Accounting;
- operational receipts;
- customer portal;
- catalog, pricing and segments.

Do not create competing models or shadow state unless explicitly approved.

## 7. Order, production and fulfillment semantics

Production and fulfillment are distinct concepts. Production and logistics lifecycles must not be conflated.

Canonical principles:

- production completion means work is ready;
- production completion does not automatically mean customer fulfillment is complete;
- pickup and delivery have their own lifecycles;
- an order can be production-complete while still physically in EcoWash custody;
- real customer handoff is separate from production completion.

The next approved task is `ORDER-FULFILLMENT-LIFECYCLE-001`. Its approved business direction is:

- draft logistics may be configured but must not become operational staff work;
- logistics becomes operational from `received` onward;
- production `completed` means ready, not closed or fulfilled;
- open pickup/delivery remains visible after production completion;
- the order remains in operational custody/stock until actual pickup or delivery completion.

Do not implement this direction from `AGENTS.md`; implementation requires an explicit task prompt.

## 8. Financial canonical rules

Preserve these established rules:

- cancelled orders are excluded from sales;
- confirmed payments remain financial facts even when an order is cancelled;
- refunds are separate financial facts;
- `collectedNet = confirmed payments - refunds`;
- the canonical POS refund boundary is `record_pos_refund`;
- legacy `refund_payment` and `void_payment` must not be re-enabled;
- Billing invoices do not replace payments;
- operational receipts do not drive Accounting totals;
- printing, reprinting or cancelling an operational receipt does not mutate payments, refunds or Accounting.

Financial facts must not be silently rewritten. If a proposed change alters financial or historical semantics, stop for CTO review.

## 9. Sales document and receipt boundary

Operational receipts are persistent historical documents. Canonical current behavior:

- a definitive number is assigned only on issue;
- a number is never reused;
- a cancelled receipt remains historical;
- only one currently issued operational receipt is permitted per order;
- a cancelled receipt may be followed by a new, later-numbered receipt;
- repeated issue while an issued receipt exists is idempotent;
- reprint uses the persisted snapshot;
- reprint does not create a new document number;
- receipt view/print history is separate from Accounting;
- Billing invoices remain canonical Billing documents.

Operational receipt snapshots are historical and must not be mutated in place.

Post-payment receipt synchronization behavior is an open decision and intentionally deferred. Do not invent automatic receipt replacement or synchronization until fiscal architecture is explicitly designed.

## 10. Fiscal and VERI*FACTU boundary

Fiscal implementation is a separate architecture domain. Do not implement VERI*FACTU or fiscal receipt behavior unless explicitly opened as a fiscal task.

Future fiscal design must distinguish:

- the Global Fiscal Domain;
- the Country Fiscal Profile;
- the Spain Fiscal Module;
- Phoenix responsibilities;
- external provider responsibilities;
- invoice, receipt and corrective fiscal document semantics;
- numbering;
- tax handling;
- offline behavior;
- idempotency;
- audit and history.

Operational receipts currently are not fiscal receipts. Do not silently evolve them into fiscal documents.

## 11. Billing boundary

Preserve existing Billing semantics:

- canonical invoices remain in Billing;
- issued/cancelled invoice history is immutable;
- Billing numbering remains canonical to Billing;
- do not duplicate invoice truth into another table;
- the sales-document registry may read Billing invoices but must not replace them.

## 12. Database discipline

Database changes require explicit task need.

- Schema changes use migrations.
- Remote database mutations require explicit phase authorization.
- Prove the target environment before applying remote migrations.
- Staging and production must never be confused.
- Preserve historical rows and avoid destructive rewrites.
- Prefer server-derived organization context.
- Protect concurrency and idempotency for definitive numbering or financial operations.

Do not manually edit the production database or apply remote migrations merely because they exist. Do not create a follow-up migration when an unapplied local migration can safely be corrected during implementation, unless the phase or migration history requires a corrective migration.

## 13. Environment discipline

Staging and production are separate. Before any remote mutation:

- verify the exact Supabase target;
- verify the exact Vercel project and environment;
- report a blocker if credentials are missing.

Do not touch production during staging validation. Direct local-worktree preview deployment is acceptable only when explicitly approved and targeting the established staging project.

## 14. Git discipline

Normal implementation state is no commit and no push unless the task phase explicitly authorizes them.

- `main` is the stable project baseline.
- One approved task should map to one coherent commit whenever practical.
- Do not force push.
- Do not amend stable historical commits.
- Do not create unrelated branches.
- Do not commit partial work merely to save progress.
- Do not push without explicit approval.

Before commit, confirm that implementation is complete, required automated validation has passed, CTO review has passed, Product Owner E2E has passed when applicable, and explicit commit/push approval has been received.

After push, verify that local `main` equals `origin/main` and the working tree is clean.

## 15. Testing discipline

Use focused testing first. Typical validation order:

1. task-specific contract tests;
2. impacted regression tests;
3. scoped ESLint;
4. `tsc --noEmit`;
5. `git diff --check`;
6. production build when appropriate.

Do not repeatedly spend time or credits on expensive full checks while code is still changing. Run expensive final validation when the patch is stable.

## 16. Product Owner E2E

User-facing operational features are not considered complete solely because automated tests pass. Prepare short, concrete Product Owner E2E covering:

- expected behavior;
- correct role visibility;
- the relevant negative case;
- adjacent regression;
- real workflow semantics.

Do not overwhelm the Product Owner with unnecessary technical detail.

## 17. Codex reporting standard

At the end of a phase, report concisely:

- branch and HEAD;
- exact files changed and exact implementation;
- architecture/data impact;
- tenant/security impact;
- database/migration state;
- tests run and exact results;
- git status;
- commit and push state;
- blockers and risks.

Avoid speculative narration. When ready for CTO review, use `READY_FOR_CTO_APPROVAL` unless the task prompt defines a more specific gate token. When blocked, use `STOP_REVIEW_REQUIRED: <precise reason>`.

## 18. Stop conditions

Stop instead of guessing when:

- a business rule is ambiguous;
- architecture must widen beyond task scope;
- tenant isolation is unclear;
- financial semantics would change;
- historical semantics would change;
- fiscal behavior would change;
- the canonical source of truth is unclear;
- the migration target cannot be proven;
- required credentials are unavailable;
- a material regression appears;
- source scope unexpectedly widens.

## 19. Documentation discipline

`AGENTS.md` contains stable operating rules and architectural boundaries. Do not duplicate constantly changing project status here.

For current state, milestones, handover and the next task, consult the canonical project documents:

- `docs/00_START_HERE/SESSION_HANDOVER.md`;
- `docs/06_ROADMAP/Project_Status.md`.

When finishing an approved task, update only the canonical documents needed for continuation. Avoid broad documentation cleanup.

## 20. Instruction priority

Task-specific Product Owner or CTO instructions override `AGENTS.md` for that explicit task. A more specific nested `AGENTS.md` may add local rules but must not contradict root-level project boundaries unless explicitly approved by the CTO.
