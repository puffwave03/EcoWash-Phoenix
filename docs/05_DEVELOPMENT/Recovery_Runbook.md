# Staging Recovery Inventory and Runbook

Status: BACKUP-DR-001D database and Storage recovery verified through Phase 3A; Auth and authenticated application recovery pending

Last verified: 2026-09-12

Scope: EcoWash Phoenix staging only. Production does not exist and is not authorized by this document.

## Safety and Classification

This runbook contains configuration names and public identifiers only. Never add passwords, service-role keys, access tokens, SMTP credentials, private keys, credential-bearing connection strings, recovery codes, customer addresses or Storage object paths.

Recovery actions that create projects, restore data, change Auth, update DNS, deploy code or rotate credentials require a separately approved recovery execution. Always prove the Git branch, commit, Vercel project, Supabase project and environment before a mutation.

Classifications:

- `VERIFIED`: the stated backup or recovery capability was actually exercised and checked.
- `DOCUMENTED_NOT_VERIFIED`: the current state or method is known, but recovery/regeneration was not rehearsed.
- `MISSING`: a required owner, durable copy, canonical value or proven recovery capability is absent.
- `NOT_APPLICABLE`: intentionally unused in the staging architecture.

## Verified Staging Identity

| System | Public identity | Current evidence | Classification |
| --- | --- | --- | --- |
| GitHub | `puffwave03/EcoWash-Phoenix`, branch `main` | Remote `main` was reachable and equal to `08144da66dde4e2e525ae43711abd77b05d5b366` on 2026-09-10. A clean-machine clone was not rehearsed. | `DOCUMENTED_NOT_VERIFIED` |
| Vercel | team `puffwaves-projects`; project `ecowash-phoenix-staging`; project ID `prj_u7MwRwQOLyRSRvbuhRLdURx653aZ`; organization ID `team_nhXOvQKcrv9yeHjZ4aoMOak3` | Linked project exists. It is Next.js, root directory `.`, Node.js 24.x, and uses Vercel's assigned staging domain. | `DOCUMENTED_NOT_VERIFIED` |
| Supabase | project `EcoWash Phoenix`; ref `exthnplfokcucaqydney`; region `eu-west-1`; PostgreSQL major 17 | Project was healthy and linked; local and remote migration histories matched through `20260908000300`. | `DOCUMENTED_NOT_VERIFIED` |
| Production | No Supabase project, Vercel project, custom production domain, DNS cutover or production environment | Existing release documentation confirms production remains deferred. | `NOT_APPLICABLE` |

Vercel's `Production` scope below means the production target of the **staging Vercel project**. It is not a Phoenix production environment.

## Recovery Inventory

| Component | Configuration / variable name | Secret? | System of record | Required for recovery? | Recovery or regeneration method | Recovery verified? | Classification | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Source | Git repository and `main` history | No | GitHub | Yes | Recover the GitHub account, clone `puffwave03/EcoWash-Phoenix`, and verify the approved commit before using it. | No | `DOCUMENTED_NOT_VERIFIED` | Remote reachability and HEAD equality were verified, not clean-machine recovery or write access. |
| Vercel project | Team/project identity and Git connection | No | Vercel and GitHub | Yes | Recover the Vercel team or create a replacement staging project, then connect the canonical repository and `main`. | No | `DOCUMENTED_NOT_VERIFIED` | Automatic deploy from `main` was previously validated. Account recovery was not. |
| Vercel variable | `NEXT_PUBLIC_SITE_URL` | No | Vercel; canonical value derives from the active staging URL | Yes | Set to the replacement staging HTTPS origin, then align Supabase Auth Site URL and redirects. | No | `DOCUMENTED_NOT_VERIFIED` | Exists in Preview and Production scopes. |
| Vercel variable | `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase API settings, copied to Vercel | Yes | Obtain the replacement project's public API URL and enter it in Vercel. | No | `DOCUMENTED_NOT_VERIFIED` | Exists in Preview and Production scopes. |
| Vercel variable | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Supabase API settings, copied to Vercel | Yes | Obtain the replacement project's publishable/anonymous key and enter it in Vercel. | No | `DOCUMENTED_NOT_VERIFIED` | Exists in Preview and Production scopes; it is browser-visible by design. |
| Vercel variable | `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase API settings, copied to Vercel server scope | Yes | Generate or obtain the replacement project credential from Supabase and re-enter it. Do not attempt to export it from Vercel. | No | `DOCUMENTED_NOT_VERIFIED` | Exists only in Production scope. Required for trusted Auth administration; never expose it to the browser. |
| Vercel variable | `NEXT_PUBLIC_SITE_INDEXING` | No | Vercel deployment policy | Yes | Recreate the staging no-index setting from this deployment contract. | No | `DOCUMENTED_NOT_VERIFIED` | Exists in Preview and Production scopes. Staging must remain non-indexable. |
| Vercel variable | `ENABLE_STAGING_CUSTOMER_PREVIEW` | Provider-sensitive | Vercel deployment policy | Yes for the current review helper | Recreate the staging-only flag from the approved deployment contract. | No | `DOCUMENTED_NOT_VERIFIED` | Exists in Preview and Production scopes of the staging project. It must not be carried into a future real production environment. |
| Vercel variables | Development scope | Depends on variable | Vercel | No | Rebuild local `.env.local` directly from provider sources when needed. | No | `NOT_APPLICABLE` | No project variables were listed in Vercel Development scope. |
| Local environment | `.env.local` variable names: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_OIDC_TOKEN` | Mixed | Provider dashboards; local file is only a cache | Yes, except transient OIDC token | Recreate from Vercel/Supabase account access. Let Vercel regenerate the short-lived OIDC token. Never copy the file into Git or this runbook. | No | `DOCUMENTED_NOT_VERIFIED` | The ignored file exists only on this Mac. It must not be treated as the secret system of record. |
| Supabase link | `supabase/.temp/project-ref` | No | Supabase project ref; ignored local link file | Yes for CLI operations | Authenticate the CLI and link explicitly to the verified ref. After project replacement, use the new staging ref. | No | `DOCUMENTED_NOT_VERIFIED` | Current ignored link points to `exthnplfokcucaqydney`. |
| Supabase Auth | Site URL and redirect allowlist | No | Supabase Auth settings | Yes | Recreate only the approved local and active staging HTTPS redirect patterns, then test login and password recovery. | No | `DOCUMENTED_NOT_VERIFIED` | Current staging redirect behavior was previously E2E validated; settings are not in 001A or 001B. |
| Supabase Auth | Email provider, signup control, email confirmation, JWT/session/refresh settings, rate limits and templates | Mixed | Supabase Auth settings | Yes | Capture approved names/policy, configure a replacement project, and test invite, reset and session refresh. | No | `MISSING` | Remote settings report sign-up enabled while the repository config/documentation says email sign-up is disabled. CTO must select the canonical recovery state. |
| Supabase Auth | Managed users, identities, password hashes, sessions and MFA factors | Yes | Supabase managed Auth schema/platform | Yes | Define and rehearse a Supabase-supported Auth export/restore or identity reconstruction plan in an isolated project. | No | `MISSING` | 001A excludes managed Auth. Recreating users with different IDs can break public profile/membership/history references and must not be improvised. |
| Supabase Storage | `brand-media` bucket definition | No | Supabase Storage configuration; definition also exists in migrations | Yes | Apply the canonical migrations to recreate it as public, with a 2 MiB maximum and JPEG/PNG/WebP allowlist, before importing bytes. | Yes | `VERIFIED` | BACKUP-DR-001D recreated the definition and restored all 221 backed-up objects through the supported Storage API. |
| Supabase Storage | `order-media` bucket definition | No | Supabase Storage configuration; definition also exists in migrations | Yes | Apply the canonical migrations to recreate it as private, with a 1 MiB maximum and JPEG/PNG/WebP allowlist, before importing bytes. | Yes | `VERIFIED` | BACKUP-DR-001D recreated the definition and restored both backed-up objects through the supported Storage API. Keep private. |
| Supabase Storage | Object restore/import procedure | Uses a secret credential | BACKUP-DR-001B manifest/checksums plus the supported Supabase Storage API; no repository restore script | Yes | Verify the backup, require an empty approved target, upload without upsert, then re-download and hash-check every object. | Yes | `VERIFIED` | BACKUP-DR-001D Phase 3A exercised all 223 objects and 22,451,620 bytes end to end with zero failures, missing objects or extras. |
| Database backup | Latest 001A roles/public schema/public data backup | Backup contains sensitive application data | Local Mac directory | Yes | Verify `SHA256SUMS`, apply the canonical migrations, load `data.sql`, and apply only safe role/settings operations to an explicitly approved isolated target. | Yes | `VERIFIED` | BACKUP-DR-001D verified schema, application-data and relevant role/settings recovery on PostgreSQL 17. Managed Auth remains excluded. |
| Storage backup | Latest 001B `brand-media` and `order-media` object bytes and manifest | Yes: customer/tenant content | Local Mac directory | Yes | Verify `backup-status.txt` and `SHA256SUMS`, then use the verified Storage API restore procedure against an approved isolated empty target. | Yes | `VERIFIED` | Capture was `COMPLETE`; all 225 checksummed files passed, and Phase 3A restored and reverified all 223 object bytes end to end. |
| Backup custody | Encrypted off-device copy, retention schedule and recovery owner | Yes | Protected off-device archive; custody details must remain outside this repository | Yes | Retrieve and checksum-verify the encrypted archive, assign a recovery owner, define retention, and rehearse retrieval after simulated Mac loss. | Checksum only | `DOCUMENTED_NOT_VERIFIED` | BACKUP-DR-001D reverified archive SHA-256 `77144554493edd08f4cd48dddcf31ed3fa3f19bc4e03e5617abf09d63f818180`; custody recovery, owner, retention and retrieval rehearsal remain unverified. |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_SENDER_EMAIL`, `SMTP_SENDER_NAME` | Mixed; password/username may be secret | Supabase Custom SMTP plus Resend account | Yes | Recover the Resend account, reset/regenerate SMTP credentials if retrieval is unavailable, enter them in Supabase, and send a real Auth test email. | No | `DOCUMENTED_NOT_VERIFIED` | Provider is Resend; approved sender identity is `access@ecowashlatejita.com`. A real delivery previously passed, but credential recovery was not tested. |
| Email domain | `ecowashlatejita.com` sending-domain verification | No for domain name; verification records may be sensitive operational data | Resend plus authoritative DNS host | Yes | Recover both accounts, obtain the current required records from Resend, recreate them at the DNS host, wait for verification, and retest delivery. | No | `DOCUMENTED_NOT_VERIFIED` | Authoritative nameservers currently identify `hostingnovapyme34.com`; the exact account owner/registrar and account recovery path are not recorded. |
| DNS | Delegation/nameservers, Resend DKIM, SPF, DMARC and mail-routing categories | No, but do not paste record tokens into Git | Registrar/DNS provider | Yes for Auth mail | Recover the registrar and DNS-host accounts. Reconstruct provider-required records from Resend rather than from memory. | No | `MISSING` | Public nameserver/MX resolution was checked. Registrar identity, DNS account custody, record export and recovery rehearsal are missing. |
| Staging hostname | Vercel-assigned `ecowash-phoenix-staging.vercel.app` | No | Vercel | Yes while the existing project survives | Recover the project or accept a new assigned hostname and update dependent Site URL/Auth redirects. | No | `DOCUMENTED_NOT_VERIFIED` | No custom staging domain is required. |
| Production domain/DNS | Not selected or purchased | Not applicable | Not established | No | Do not create or configure during staging recovery. | Not applicable | `NOT_APPLICABLE` | The unrelated Vercel-team domain inventory is not a Phoenix production-domain decision. |
| Tenant/application configuration | Public-schema organization, location, profile, membership, capability/entitlement, branding metadata, catalog, segment, pricing, printer, Billing and numbering configuration | Contains sensitive tenant/business data | Supabase `public` database | Yes | Restore from 001A with the verified canonical-migration and `data.sql` sequence; validate tenant consistency and keep Auth-linked UUIDs unchanged until managed Auth recovery is solved. | Yes | `VERIFIED` | BACKUP-DR-001D restored and validated the public application data. Branding object bytes are separately in 001B and remain pending. |
| Online payment provider | Real provider credentials/configuration | Would be secret | Not configured | No for current staging recovery | Do not invent or provision during this task. | Not applicable | `NOT_APPLICABLE` | Only test-provider boundaries exist; real online-provider configuration remains deferred. |

## Recovery Ownership Matrix

| Area | Account/system of record | Accountable recovery owner | Required recovery source | Status |
| --- | --- | --- | --- | --- |
| GitHub | Repository namespace `puffwave03` | GitHub account/repository administrator | GitHub account recovery, 2FA/recovery material, canonical remote repository | Account custody `DOCUMENTED_NOT_VERIFIED`; repository reachable |
| Vercel | Team `puffwaves-projects` | Vercel team owner | Team account recovery, GitHub connection, project identity and this environment-name matrix | `DOCUMENTED_NOT_VERIFIED` |
| Supabase | Organization containing `EcoWash Phoenix` | Supabase organization owner | Organization account recovery, project ref, database backup, Storage backup and platform settings | `DOCUMENTED_NOT_VERIFIED`; managed Auth recovery `MISSING` |
| SMTP | Resend account for `ecowashlatejita.com` | Resend account/domain administrator | Account recovery and regenerated SMTP credential | `DOCUMENTED_NOT_VERIFIED` |
| DNS/domain | Registrar plus host identified by `hostingnovapyme34.com` nameservers | Domain registrant/DNS account administrator | Registrar recovery, DNS-host recovery and provider-generated mail records | Exact owner/registrar/recovery evidence `MISSING` |
| Tenant/application config | Supabase `public` database | Phoenix Product Owner for business acceptance; approved technical recovery operator for restore | 001A plus an Auth recovery plan and 001B for branding/media bytes | Public database and Storage-byte restore `VERIFIED`; managed Auth pending |

Account recovery material must live in an approved password manager or provider-controlled recovery mechanism, never in this repository.

## What BACKUP-DR-001A Covers

The verified 001A set was captured from staging on 2026-09-10 and its checksums pass. It contains logical role output, the `public` schema and grants, `public` application data, metadata and checksums. This includes tenant-critical database configuration such as organizations, locations, profiles, memberships, entitlements, branding metadata, catalog/segment/pricing configuration, printer profiles, Billing settings and numbering counters.

001A does **not** cover managed Auth users/identities/passwords/sessions/MFA, Storage schema or object bytes, Auth/Site URL/SMTP settings, Vercel variables, secrets, DNS, logs, Supabase provider backups/PITR, scheduling or retention. BACKUP-DR-001D verified restoration of its public database content and the relevant safe role/settings state; it did not solve any excluded area.

## What BACKUP-DR-001B Covers

The verified 001B set was captured from staging on 2026-09-10. It contains actual object bytes for `brand-media` and `order-media`, a metadata manifest, checksums and a `COMPLETE` status. The set contains 221 `brand-media` objects and 2 `order-media` objects; every downloaded object and metadata artifact passed checksum verification.

001B does **not** recreate bucket definitions, policies, Auth identities, database metadata, provider settings or secrets, and it does not include a repository upload/restore script. BACKUP-DR-001D verified that canonical migrations recreate the two bucket definitions and policies, then successfully exercised all 001B object bytes end to end through the supported Storage API.

## BACKUP-DR-001D Recovery Rehearsal

The following evidence is `VERIFIED`. It applies only to the isolated disposable project `EcoWash Phoenix Recovery Rehearsal 001D` (`xsjmhjmhaftieokuwssf`) in `eu-west-1`, using PostgreSQL 17. The protected staging project remained `exthnplfokcucaqydney`; staging and production were not mutated, and the repository remained unchanged throughout the rehearsal. The disposable target is retained under `RETAIN_UNTIL_CTO_APPROVAL`.

FitIQtracker's Supabase project was temporarily paused only to free a Supabase Free project slot for this rehearsal. It was not deleted and has not yet been resumed.

### Phase 2A — isolated target (`VERIFIED`)

- The new disposable project was created with the required name, region and PostgreSQL major version, and its ref was confirmed different from staging.
- The Phoenix repository link and staging inventory remained unchanged. No restore work started during this phase.
- The encrypted off-device archive checksum remained valid; retrieval after simulated local-machine loss was not rehearsed.

### Phase 2B — canonical schema (`VERIFIED`)

- All 49 canonical migrations through `20260908000300` applied successfully with zero migration failures. `schema.sql` was comparison material only and was not restored after the migrations.
- Schema validation matched the expected baseline: 45 tables, 22 enum/types, 1 sequence, 148 functions, 95 indexes, 66 public triggers, 74 public policies, 45 RLS-enabled tables, 212 constraints, 147 foreign keys and the 370-statement grant/revoke baseline.
- Migrations created the expected 20 `platform_feature_catalog` seed rows and two empty Storage bucket definitions. `storage.objects` remained 0.

### Phase 2C — application data (`VERIFIED`)

- The 20 migration-created catalog seed rows were exactly verified and handled before the checked 001A `data.sql` import. The import completed with zero COPY/import failures: 45/45 COPY sections and 1,528/1,528 dump rows matched.
- Canonical row counts, expected zero-row domains, all critical public foreign-key anti-joins, duplicate/unique constraints, tenant/organization consistency and the final `platform_feature_catalog` state passed validation. No unexpected public-data orphans were found.
- The order-number sequence was safe at 86 with 87 as the next value. `storage.objects` remained 0.
- Expected Auth-side orphans were identified without repair or UUID remapping: 13 `profiles`, 2 `customer_portal_access` rows and 0 `online_payment_attempts`. Managed Auth was not restored.

### Phase 2D — database roles/settings (`VERIFIED` with managed-role exception)

- The 001A `roles.sql` checksum passed. Across the safe restore workflow, 9 statements were attempted, 8 applied, 1 was skipped and 1 was rejected.
- The rejected `supabase_admin` timeout override targets a reserved Supabase-managed role and was not forced. The Supabase Realtime parameter grant was already correct and was safely skipped. Required application-facing role/grant state passed validation.
- Phase 2C data remained intact: `organizations` 1/1, `orders` 52/52, `payments` 47/47 and `sales_events` 61/61. `storage.objects` remained 0.

### Phase 3A — Storage object bytes (`VERIFIED`)

- BACKUP-DR-001B checksums passed. Its manifest contained the expected 223 objects and 22,451,620 bytes: 221 `brand-media` objects (21,528,210 bytes) and 2 `order-media` objects (923,410 bytes).
- Using only the supported Supabase Storage API and no overwrite/upsert, all 223 objects were uploaded to the isolated recovery target with their exact bucket, path, bytes and available content type. Upload failures were 0.
- All 223 restored objects were re-downloaded. SHA-256 matched 223/223, with 0 mismatches, 0 missing objects and 0 unexpected extras. Final `storage.objects` count was 223 and restored bytes were 22,451,620/22,451,620.
- Phase 2C application data remained intact: `organizations` 1/1, `orders` 52/52, `payments` 47/47 and `sales_events` 61/61. Auth was not restored; staging and production remained untouched.

### Not yet verified and known limitations

- `KNOWN LIMITATION`: managed Supabase Auth users were not captured or restored. Auth backup and identity-preserving recovery remain an unresolved recovery gap.
- `NOT YET VERIFIED`: authenticated application flows, authenticated RLS behavior, final end-to-end application recovery, final RTO and production recovery.
- The rehearsal verifies the canonical database schema/migrations, public application data, relevant database role/settings state and BACKUP-DR-001B Storage object-byte recovery. It does **not** establish complete Phoenix disaster recovery.

### Local PostgreSQL tooling guardrail

Client-side PostgreSQL tooling was verified with the existing `postgres:17` image on `linux/amd64` using `psql` 17.11. No additional Docker image was pulled during Phase 2D. Where applicable, use `--platform=linux/amd64` and `--pull=never`. Avoid commands that start or pull a Supabase local Postgres image because those images consume significant local disk space.

## What Still Depends on Platform or Account Recovery

- GitHub write/admin access and recovery factors.
- Vercel team access, project recreation, Git connection and environment re-entry.
- Supabase organization access, project creation, public API identifiers and secret regeneration.
- A supported solution for managed Auth identities that preserves or deliberately reconciles UUID relationships.
- Supabase Auth URLs, signup/confirmation policy, session policy, templates, rate limits and Custom SMTP configuration.
- Resend account recovery and SMTP credential regeneration.
- Registrar/DNS-host account recovery and reconstruction of mail-verification records.
- Off-device archive retrieval rehearsal, a retention schedule and a named recovery operator.

## Local-Machine-Loss Scenario

1. Recover access to GitHub, Vercel, Supabase, Resend and the DNS/registrar through their provider recovery processes. Do not transfer stale CLI tokens from an untrusted device.
2. On a secured replacement machine, clone the GitHub repository and verify the approved `main` commit.
3. Install the repository's supported Node.js version, dependencies, Supabase CLI and Docker requirements. Do not run linked reset, migration or restore commands.
4. Re-link Vercel to team `puffwaves-projects` and project `ecowash-phoenix-staging`; re-link Supabase to the verified staging ref only if the original project still exists.
5. Recreate `.env.local` from provider systems of record. Never recover it from Git or paste its contents into tickets/logs. Regenerate the transient Vercel OIDC token rather than preserving it.
6. Retrieve and checksum-verify the encrypted off-device archive. **Current blocker:** recovery of that archive after simulated Mac loss has not been rehearsed, and custody ownership and retention remain unresolved.
7. Run read-only identity, migration-alignment, bucket-definition and application health checks before authorizing any mutation.

## Vercel-Loss Scenario

1. Recover the existing team/project if possible. If it is irrecoverable, create a staging-only replacement under the recovered team; do not create Phoenix production.
2. Connect the canonical GitHub repository and `main`; configure Next.js, root `.`, Node.js 24.x and the normal build command.
3. Recreate the six Vercel variable names using the scopes in the inventory. Obtain Supabase identifiers/credentials from Supabase and recreate policy flags from this runbook. Never export a sensitive Vercel value.
4. Deploy the approved commit. Record the new assigned staging hostname.
5. With separate mutation approval, update `NEXT_PUBLIC_SITE_URL` and the Supabase Auth Site URL/redirect allowlist to the new hostname.
6. Verify non-indexing, login, password recovery, role/tenant isolation, server-only administration, public branding media and private order media.

This scenario is documented but has not been rehearsed.

## Supabase-Project-Loss Scenario

1. Stop normal deployment and preserve the failed project's evidence. Do not point staging or production at an unverified replacement.
2. Recover the Supabase organization or create an approved replacement staging project in the intended region with PostgreSQL major-version compatibility. Record the new ref; never reuse the old ref as an assumption.
3. Verify both backup sets and repository migrations. In an isolated target, follow the BACKUP-DR-001D sequence: apply the 49 canonical migrations, verify and handle only the known migration-created catalog seed rows, import the checked `data.sql`, and apply only safe `roles.sql` operations. Do not restore `schema.sql` after migrations.
4. Preserve identity-linked public UUIDs and explicitly classify the expected Auth-side orphans. 001A does not contain Auth users or password material; do not improvise UUID remapping. Managed Auth recovery remains a separate unresolved gate.
5. Recreate the Storage bucket definitions and approved policies, then restore 001B bytes through the verified supported-API procedure: require an empty target, do not upsert, and re-download/hash-check every object.
6. Recreate Auth URL, email/signup/confirmation, session, rate-limit, template and SMTP configuration. Resolve the current signup-control discrepancy with the CTO before choosing the restored value.
7. Obtain/regenerate the replacement public identifiers and service-role credential, then update only the staging Vercel project and secured local environment.
8. Validate schema/data counts, RLS and tenant isolation, Auth flows, Storage privacy, representative tenant configuration, numbering/financial history and application health before cutover.

Full Supabase recovery is currently blocked by the missing Auth identity plan and the remaining authenticated end-to-end validation. The logical public database and Storage-byte restore sequences are verified.

## SMTP/DNS-Credential-Loss Scenario

1. Recover the Resend account and the registrar/DNS-host accounts using provider recovery mechanisms. If account ownership cannot be proven, stop; do not change delegation or create a replacement sending identity silently.
2. In Resend, retain/re-verify `ecowashlatejita.com` and obtain the required DNS record set. Do not copy record tokens into Git.
3. Recreate only the required delegation, DKIM, SPF, DMARC and mail-routing categories at the authoritative DNS host. Preserve unrelated records and record rollback evidence outside Git.
4. Reset/regenerate the SMTP credential if it cannot be retrieved. Enter the named SMTP fields in Supabase Custom SMTP without logging values.
5. Verify provider domain status, then send and receive a real Supabase Auth email and recheck endpoint-specific rate limiting.

The current provider/domain/sender are known, but DNS account custody, registrar identity, credential recovery and a recovery rehearsal remain unresolved.

## Recovery Acceptance Gate

Phoenix staging is not fully DR-ready until all `MISSING` items are resolved and the following is rehearsed in an isolated target. Items 3 and 5 are verified by BACKUP-DR-001D; authenticated Storage authorization behavior remains part of item 7:

1. recover the repository and provider accounts from a clean machine;
2. retrieve backup copies after simulated Mac loss;
3. restore 001A without schema/ordering or historical-data corruption;
4. preserve or safely reconcile managed Auth identities;
5. recreate buckets/policies and import/verify all 001B bytes;
6. recreate Vercel, Auth, SMTP and DNS configuration from named systems of record;
7. pass tenant isolation, role, Auth, Storage, financial-history and application smoke validation;
8. document recovery time, operator, evidence, rollback and remaining risk without recording secrets.
