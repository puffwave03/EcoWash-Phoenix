# PHOENIX-RECOVERY-CUTOVER-20261117 — Staging Recovery Cutover Evidence

Status: **STAGING TECHNICAL CUTOVER VERIFIED / PLATFORM ADMIN BROWSER UAT PASS / TENANT BOOTSTRAP NOT STARTED / COMMERCIAL AND FISCAL READINESS NOT APPROVED**

Date: 2026-11-17. Scope: the existing *staging* Vercel project, the existing Supabase Free project, and the recovered application baseline. This is a dated technical evidence checkpoint, not a new product implementation, an invoice/fiscal certification, a production release, or authorization for further mutations.

## 1. Authority, source of truth, and non-goals

- Canonical execution policy remains [`AGENTS.md`](../../AGENTS.md) and [`Git_Workflow.md`](../05_DEVELOPMENT/Git_Workflow.md): Product Owner decisions, CTO scope/review, Codex implementation, independent tests, explicit approval before commit/push. One mission at a time.
- [`SESSION_HANDOVER.md`](SESSION_HANDOVER.md) and [`Project_Status.md`](../06_ROADMAP/Project_Status.md) are the canonical *current* resume and status entries. This document provides immutable cutover evidence linked from them.
- All pre-cutover orders, invoice numbers, tenants, screenshots, financial outcomes, feature/UAT conclusions and references in the historical documents are **historical**. The old hosted data and old identities do **not** exist in the new staging dataset. Prior application-level UAT must not be represented as a successful UAT on the clean hosted database.
- The reference environment is still **staging**. Vercel `target: production` names the target of the staging Vercel project; it is **not** a commercial Phoenix production environment.

## 2. Verified identities and code promotion (16 November 2026)

| Component | Evidence / boundary |
| --- | --- |
| GitHub repository | `puffwave03/EcoWash-Phoenix`; canonical branch `main` |
| Archived preceding baseline | `archive/pre-recovery-2026-11-16`; preserves pre-recovery history (old `main` at `34a83559005a449c4c09224b82dcd88834f1f981` when archived) |
| Source Recovery | Application tree from Recovery commit `6cad22715fe45c06b5613cdf95f7cfbe1ea63a84` (2026-10-16) |
| Promoted current baseline | GitHub `main` commit `a2b82ddccba1d8f2842a43a4dcf2c32ba4e65dbf`, carrying the verified Recovery tree; pre-cutover history remains archived |
| Vercel project | `ecowash-phoenix-staging`, ID `prj_u7MwRwQOLyRSRvbuhRLdURx653aZ`, public alias `https://ecowash-phoenix-staging.vercel.app` |
| Vercel evidence | Deployment `dpl_FW9wMW37pUYD5rL3Q8YHLouqumq3` reported `READY` and sourced GitHub commit `a2b82dd...`; this is deploy evidence, **not** blanket application UAT |
| Existing Supabase project retained | `exthnplfokcucaqydney` (`eu-west-1`), same project/API host and infrastructure credentials; the project was **not deleted or replaced** |

No code, dependency or database-migration file was authored during the cutover. Do not infer that any application feature created after the Recovery source date is present in the promoted tree.

## 3. Local Recovery acceptance and old hosted baseline

The selected isolated local Recovery database (`phoenix-recovery-20261016`, Docker PostgreSQL port `55422`) was healthy. It had **95** recorded migrations through `20261015000100`. A sorted version-by-version comparison with all **95** `supabase/migrations/*.sql` files returned `diff` exit code **0**. Reference local `public` inventory: **53 tables, 223 functions, 92 non-internal triggers**. `private`: 0 tables, 1 function, 0 triggers. This proves migration-version alignment and a counted reference inventory; it is not a full independent byte-for-byte schema comparison.

Before remote cutover, the existing hosted database contained **127 migrations** through `20261115180534`, with `public` inventory **60 tables, 274 functions, 116 non-internal triggers**, **19 Auth users** and **420 Storage objects** (414 `brand-media`, 6 `order-media`, 0 `accounting-exports`). Applying the 95 migrations with `db push` onto those 127 would not delete obsolete objects; a controlled remote rebuild was required and approved by the Product Owner.

## 4. Preserved old-state backups (16–17 November 2026)

Local custody folder (private Mac, **not Git**): `~/Desktop/PHOENIX-BACKUP-OLD-20261116/`.

- SQL snapshots: `old-schema-20261116.sql`, `old-data-20261116.sql`, `old-roles-20261116.sql`, `old-auth-20261116.sql`. Auth export inspection found **19 rows in `auth.users`**.
- Actual Storage object bytes: **414/414** from `brand-media`; **6/6** from `order-media`; `accounting-exports` was empty.
- An inventory of **433 nonempty source files** (4 SQL, 420 images, 9 other files) was hashed into `backup-manifest.sha256`. A subsequent manifest verification reported **433/433 checked, 0 mismatches, PASS**.
- CLI `pg_dump` data backup warned about circular FK relationships (`payments`, `invoice_orders`); full restore can require special ordering/trigger handling. **No complete reinstallation/restore of this exact old backup set has been rehearsed.** Integrity hashes prove unchanged bytes, not recoverability or application functionality.
- No encrypted, independently verified **off-device** copy is evidenced for this latest set. Maintain restricted permissions, privacy controls, retention arrangements and an external encrypted copy before treating this as durable disaster recovery.
- SQL/Auth backups may contain personal information and password-related material. **Never commit or paste their contents or secrets into issues, logs, AI chats or GitHub.** Do not use old data as a seed for the clean tenant.

## 5. Remote rebuild — actual execution (17 November 2026)

The Recovery workdir was explicitly linked to project ref `exthnplfokcucaqydney`. Preflight checked ref and **95 files**: `PRE-RESET: PASS`.

Authorized command executed by the Product Owner:

```bash
supabase db reset --linked --no-seed --workdir "$HOME/Desktop/PHOENIX-RECUPERO-20261016/code"
```

**First attempt:** the CLI removed prior user-created objects, truncated managed Auth data and began migrations, then stopped at `20260728000200_app_006_orders_workflow.sql` with PostgreSQL `42P07`: an existing `public.order_number_sequence`. Live read-only inspection found the single residual `public` sequence, owned by `postgres` and **not attached to a column**. The CTO removed **only that verified residual sequence**. No migration source was edited.

**Second attempt:** the same reset command completed all **95** migrations through `20261015000100`, without seed data. The hosted project was then checked directly:

| Post-reset object / data | Verified hosted state |
| --- | ---: |
| Migration history | **95**, maximum `20261015000100` |
| `public` tables | **53** |
| `public` functions | **223** |
| `public` non-internal triggers | **92** |
| Old Auth accounts immediately after reset | **0** |
| Organizations | **0** |
| Orders | **0** |

The hosted reference inventory matches the local Recovery **counts**; detailed schema definitions, RLS semantics, privileges and all operational end-to-end flows have **not** been exhaustively compared or re-tested. Further remote `db reset`, `db push`, `migration repair`, schema writes and seed imports require a **new explicit CTO/PO execution gate**.

## 6. Storage cleanup and bucket definitions

After database reset, the **420** preexisting object records/files remained. The Product Owner ran a supported Supabase Storage CLI recursive removal against `brand-media` and `order-media`. The CLI also **removed the two bucket definitions**; direct read-only inspection found only empty `accounting-exports`. The CTO re-created exactly those two **empty** bucket definitions using the settings from the Recovery migrations, then verified all three bucket counts and privacy/limits:

| Bucket | Public? | Per-file limit | Allowed MIME types | Objects |
| --- | --- | ---: | --- | ---: |
| `brand-media` | Yes | 2,097,152 bytes (2 MiB) | JPEG / PNG / WebP | **0** |
| `order-media` | No | 1,048,576 bytes (1 MiB) | JPEG / PNG / WebP | **0** |
| `accounting-exports` | No | no bucket limit set | ZIP | **0** |

Recovery Storage policies were checked as present. The managed Storage API/CLI was used for object deletion; no SQL-only deletion of `storage.objects` was performed. **Do not restore 420 old images:** those belong to the discarded old tenants and exist only in protected backup custody.

## 7. First Platform Admin and login UAT

- Exactly **one** new email-confirmed Supabase Auth user was created by the Product Owner; its `public.profiles` record was generated correctly.
- A trusted administrative database operation assigned the **sole** verified user to `public.platform_admins` as **active `platform_admin`**, with server-side checks. A subsequent read-only check confirmed 1 Auth user, 1 profile, 1 active Platform Admin; **0 organizations and 0 tenant memberships**.
- The initial password login returned `invalid_credentials`; a previous pre-reset browser JWT gave `user_not_found`. These are distinct from database migration failure.
- The operator used Supabase's supported **Admin Auth API** to reset the password without transmitting it through chat or editing database credential columns.
- Product Owner then confirmed **`Platform OK`** through the deployed staging UI. This is **Platform Admin login/browser UAT PASS**, not tenant onboarding or full-app UAT.
- **Do not publish this user's email, Auth UUID, password, service-role key, private connection strings or recovery secrets in documentation.** Retrieve its ID through authenticated administrative tools only when an authorized tenant bootstrap requires it.

## 8. Known defect and open gates

**Auth email: FAIL / needs repair.** At the time of cutover, Supabase Auth email recovery and magic-link operations failed. Auth logs identified Resend SMTP error `550`: sender domain `ecowashlatejita.com` **not verified**. Historical documentation stating that Resend/recovery E2E works describes the **former staging configuration**, not the recovered staging state. Do not use invitation-based first-tenant onboarding until SMTP has been repaired and a real email delivery test passes; the platform supports an existing verified Owner identity flow instead.

**Unstarted:** EcoWash La Tejita tenant pilot creation, first location, tenant Owner membership, catalogue/branding/prices configuration and pilot acceptance. These require a separate Product Owner checkpoint. The Platform Admin can also hold a tenant Owner membership, but the roles are separate; membership must be created via the approved onboarding flow, not assumed from Platform Admin status.

**Still open before commercial production:** hosted feature/UAT smoke across protected routes, tenant/RLS isolation and operational workflows, cash/POS/billing/fiscal concerns, actual PDF/printer behavior as appropriate, independent schema/policy inspection, backup restore rehearsal plus off-device custody, Auth SMTP and redirect validation, privacy/security, fiscalization partner/VERI*FACTU and Spanish/Canarian tax compliance. No readiness gate is implicitly closed by this infrastructure cutover.

## 9. Safe next actions (requires normal mission gating)

1. **Documentation-only closeout:** update the canonical entrypoints to point to this dated checkpoint while preserving all historical evidence; review the diff and get PO approval **before commit/push**. No database, Auth, Storage, Git history, deployment, dependency or business data mutation in this documentation task.
2. **Repair SMTP** in a separately scoped task; validate sender domain, Supabase custom SMTP config, Auth redirects, successful email delivery, expired-link handling. Never commit credentials.
3. **First tenant onboarding** only after separate PO approval/verified field values; use the supported Platform form with a deliberately verified existing Owner identity while invitations are unavailable. Test first-tenant creation and entitlement/RLS boundaries; do not insert pilot order/payment/invoice seed data without authorization.
4. **Staging acceptance** for the specific recovered application version. Keep commercial readiness, tax compliance and production rollout gates open until verified separately.

## 10. Resume guardrails

- Confirm local Git worktree and `HEAD`, then verify remote GitHub `main` against `a2b82dd...` **or a later explicitly approved commit**. Do not assume the old local `EcoWash-Phoenix` folder was updated automatically when GitHub was promoted. Never reset/clean/discard WIP automatically.
- Confirm the precise CLI `--workdir` and `supabase/.temp/project-ref` before any future Supabase command. The linked Recovery folder now targets the **hosted** project; `db reset` defaults to local but `--linked` is destructive remotely. Never issue a reset merely to inspect status.
- The old archive branch and the old backups are for historical/recovery purposes, not current app setup. The canonical next step is a Product Owner-approved task, not an old October `next mission` label.
- Treat verification terms precisely: `PASS` only for tests actually executed, `NOT TESTED` for unexecuted steps, and `NOT APPROVED` for fiscal/commercial release.
