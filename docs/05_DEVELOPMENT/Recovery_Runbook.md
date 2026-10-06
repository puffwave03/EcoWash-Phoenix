# Staging Recovery Inventory and Runbook

Status: AUTH-DR-001B3 CLOSED / PASS; AUTH-DR-001B4 COMPLETE / PASS; AUTH-DR-001C deferred as a hard pre-production / release gate

Last verified: 2026-10-06

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
| Supabase Auth | Site URL and redirect allowlist | No | Supabase Auth settings | Yes | Recreate the verified staging values from the B4 manifest only in staging; use recovery-only URLs for a future isolated clone. | Configuration captured; recovery not rehearsed | `VERIFIED` current staging | Site URL is `https://ecowash-phoenix-staging.vercel.app`; four redirect patterns are recorded in the protected B4 evidence set. |
| Supabase Auth | Email provider, signup, confirmation, sessions, rate limits, MFA, hooks and templates | Mixed | Supabase Auth settings | Yes | Use the versioned B4 non-secret configuration manifest; contain email and test Auth flows only in an approved isolated recovery project. | Configuration captured; recovery not rehearsed | `VERIFIED` current staging | Public signup disabled, confirmation enabled, email only, Resend Custom SMTP, TOTP enabled, no Auth Hooks. Template body customization and unexposed password-policy details remain non-blocking unknowns. |
| Supabase Auth | Managed users, identities, password hashes, sessions and MFA factors | Yes | Supabase managed Auth schema/platform | Yes | Primary: provider-supported physical backup / Restore to a New Project after an eligible completed backup exists. Original-UUID Admin API reconstruction is unsupported/not verified. | Inventory verified; physical restore not rehearsed | `KNOWN PRE-PRODUCTION GAP` | B4 inventory reconciles 13 Auth users/profiles and 12 identities plus one documented legacy test exception. The earlier 001A logical backup excludes managed Auth. |
| Supabase Storage | `brand-media` bucket definition | No | Supabase Storage configuration; definition also exists in migrations | Yes | Apply the canonical migrations to recreate it as public, with a 2 MiB maximum and JPEG/PNG/WebP allowlist, before importing bytes. | Yes | `VERIFIED` | BACKUP-DR-001D recreated the definition and restored all 221 backed-up objects through the supported Storage API. |
| Supabase Storage | `order-media` bucket definition | No | Supabase Storage configuration; definition also exists in migrations | Yes | Apply the canonical migrations to recreate it as private, with a 1 MiB maximum and JPEG/PNG/WebP allowlist, before importing bytes. | Yes | `VERIFIED` | BACKUP-DR-001D recreated the definition and restored both backed-up objects through the supported Storage API. Keep private. |
| Supabase Storage | Object restore/import procedure | Uses a secret credential | BACKUP-DR-001B manifest/checksums plus the supported Supabase Storage API; no repository restore script | Yes | Verify the backup, require an empty approved target, upload without upsert, then re-download and hash-check every object. | Yes | `VERIFIED` | BACKUP-DR-001D Phase 3A exercised all 223 objects and 22,451,620 bytes end to end with zero failures, missing objects or extras. |
| Database backup | Latest 001A roles/public schema/public data backup | Backup contains sensitive application data | Local Mac directory | Yes | Verify `SHA256SUMS`, apply the canonical migrations, load `data.sql`, and apply only safe role/settings operations to an explicitly approved isolated target. | Yes | `VERIFIED` | BACKUP-DR-001D verified schema, application-data and relevant role/settings recovery on PostgreSQL 17. Managed Auth remains excluded. |
| Storage backup | B4 `brand-media`, `order-media` and `accounting-exports` object bytes and manifest | Yes: tenant/customer content | Protected local evidence set | Yes | Verify B4 `COMPLETE` status and SHA-256, then use the approved Storage API restore procedure against an isolated empty target. | Local capture verified; B4 restore not rehearsed | `VERIFIED` local snapshot | `AUTH-DR-001B4-20261006T162233Z`: 229 objects / 25,060,061 bytes; stable source listings, zero failures, 229/229 local SHA-256 passes. The earlier 001B set of 223 objects was separately restored and verified in BACKUP-DR-001D. `accounting-exports` remains private, generated, ephemeral and non-fiscal. |
| Backup custody | Encrypted off-device copy, retention schedule and recovery owner | Yes | Approved off-device custody, outside Git | Yes before production | Encrypt and place the current B4 recovery set in approved custody, assign owner/retention and rehearse retrieval. | No for B4 off-device copy | `PRE-PRODUCTION FINDING` | `ENCRYPTED OFF-DEVICE COPY PENDING`: the historical encryption credential was intentionally not retrieved during B4. The verified local Storage snapshot remains valid. The older archive checksum does not establish B4 off-device custody. |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_SENDER_EMAIL`, `SMTP_SENDER_NAME` | Mixed; password/username may be secret | Supabase Custom SMTP plus Resend account | Yes | Recover the Resend account, reset/regenerate SMTP credentials if retrieval is unavailable, and configure recovery-only email containment before a test. | Current configuration verified; credential recovery not tested | `DOCUMENTED_NOT_VERIFIED` recovery | B4 Dashboard evidence verified Resend Custom SMTP is enabled; the password remained masked and was not retrieved. |
| Email domain | `ecowashlatejita.com` sending-domain verification | No for domain name; verification records may be sensitive operational data | Resend plus authoritative DNS host | Yes | Recover both accounts, obtain the current required records from Resend, recreate them at the DNS host, wait for verification, and retest delivery. | No | `DOCUMENTED_NOT_VERIFIED` | Authoritative nameservers currently identify `hostingnovapyme34.com`; the exact account owner/registrar and account recovery path are not recorded. |
| DNS | Delegation/nameservers, Resend DKIM, SPF, DMARC and mail-routing categories | No, but do not paste record tokens into Git | Registrar/DNS provider | Yes for Auth mail | Recover the registrar and DNS-host accounts. Reconstruct provider-required records from Resend rather than from memory. | No | `MISSING` | Public nameserver/MX resolution was checked. Registrar identity, DNS account custody, record export and recovery rehearsal are missing. |
| Staging hostname | Vercel-assigned `ecowash-phoenix-staging.vercel.app` | No | Vercel | Yes while the existing project survives | Recover the project or accept a new assigned hostname and update dependent Site URL/Auth redirects. | No | `DOCUMENTED_NOT_VERIFIED` | No custom staging domain is required. |
| Production domain/DNS | Not selected or purchased | Not applicable | Not established | No | Do not create or configure during staging recovery. | Not applicable | `NOT_APPLICABLE` | The unrelated Vercel-team domain inventory is not a Phoenix production-domain decision. |
| Tenant/application configuration | Public-schema organization, location, profile, membership, capability/entitlement, branding metadata, catalog, segment, pricing, printer, Billing and numbering configuration | Contains sensitive tenant/business data | Supabase `public` database | Yes | Restore from 001A with the verified canonical-migration and `data.sql` sequence; validate tenant consistency and keep Auth-linked UUIDs unchanged until managed Auth recovery is solved. | Yes | `VERIFIED` | BACKUP-DR-001D restored and validated the public application data; the separate 001B branding object bytes were also restored and verified. |
| Online payment provider | Real provider credentials/configuration | Would be secret | Not configured | No for current staging recovery | Do not invent or provision during this task. | Not applicable | `NOT_APPLICABLE` | Only test-provider boundaries exist; real online-provider configuration remains deferred. |

## Recovery Ownership Matrix

| Area | Account/system of record | Accountable recovery owner | Required recovery source | Status |
| --- | --- | --- | --- | --- |
| GitHub | Repository namespace `puffwave03` | GitHub account/repository administrator | GitHub account recovery, 2FA/recovery material, canonical remote repository | Account custody `DOCUMENTED_NOT_VERIFIED`; repository reachable |
| Vercel | Team `puffwaves-projects` | Vercel team owner | Team account recovery, GitHub connection, project identity and this environment-name matrix | `DOCUMENTED_NOT_VERIFIED` |
| Supabase | Organization containing `EcoWash Phoenix` | Supabase organization owner | Organization account recovery, project ref, eligible physical backup, Storage backup and platform settings | Current B4 inventory/config verified; physical Auth recovery deferred to 001C |
| SMTP | Resend account for `ecowashlatejita.com` | Resend account/domain administrator | Account recovery and regenerated SMTP credential | `DOCUMENTED_NOT_VERIFIED` |
| DNS/domain | Registrar plus host identified by `hostingnovapyme34.com` nameservers | Domain registrant/DNS account administrator | Registrar recovery, DNS-host recovery and provider-generated mail records | Exact owner/registrar/recovery evidence `MISSING` |
| Tenant/application config | Supabase `public` database | Phoenix Product Owner for business acceptance; approved technical recovery operator for restore | Earlier 001A logical backup plus current B4 Auth/Storage evidence and the future eligible physical backup | Earlier public database and Storage-byte restore `VERIFIED`; physical managed Auth restore pending |

Account recovery material must live in an approved password manager or provider-controlled recovery mechanism, never in this repository.

## What BACKUP-DR-001A Covers

The verified 001A set was captured from staging on 2026-09-10 and its checksums pass. It contains logical role output, the `public` schema and grants, `public` application data, metadata and checksums. This includes tenant-critical database configuration such as organizations, locations, profiles, memberships, entitlements, branding metadata, catalog/segment/pricing configuration, printer profiles, Billing settings and numbering counters.

001A does **not** cover managed Auth users/identities/passwords/sessions/MFA, Storage schema or object bytes, Auth/Site URL/SMTP settings, Vercel variables, secrets, DNS, logs, Supabase provider backups/PITR, scheduling or retention. BACKUP-DR-001D verified restoration of its public database content and the relevant safe role/settings state; it did not solve any excluded area.

## What BACKUP-DR-001B Covers

The verified 001B set was captured from staging on 2026-09-10. It contains actual object bytes for `brand-media` and `order-media`, a metadata manifest, checksums and a `COMPLETE` status. The set contains 221 `brand-media` objects and 2 `order-media` objects; every downloaded object and metadata artifact passed checksum verification.

001B does **not** recreate bucket definitions, policies, Auth identities, database metadata, provider settings or secrets, and it does not include a repository upload/restore script. BACKUP-DR-001D verified that canonical migrations recreate the two bucket definitions and policies, then successfully exercised all 001B object bytes end to end through the supported Storage API.

## BACKUP-DR-001D Recovery Rehearsal

The following evidence is `VERIFIED`. It applies only to the isolated disposable project `EcoWash Phoenix Recovery Rehearsal 001D` (`xsjmhjmhaftieokuwssf`) in `eu-west-1`, using PostgreSQL 17. The protected staging project remained `exthnplfokcucaqydney`; staging and production were not mutated, and the repository remained unchanged throughout the rehearsal. After the approved rehearsal, the disposable recovery project was permanently deleted.

FitIQtracker's Supabase project was temporarily paused only to free a Supabase Free project slot for this rehearsal and was successfully resumed after recovery-project decommissioning.

Final rehearsal decommissioning is `COMPLETE`: the recovery project was deleted, FitIQtracker was resumed, the local `postgres:17` rehearsal image was removed, and no temporary rehearsal files remained in `/tmp` or Downloads. The verified Phoenix backup artifacts in `~/EcoWash-Backups` were deliberately retained. Final observed local free disk was approximately 8.9 GiB.

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

- `KNOWN LIMITATION`: BACKUP-DR-001A did not capture or restore managed Supabase Auth. AUTH-DR-001B3 closed the Auth record integrity gate and 001B4 captured the protected inventory/configuration; provider physical coverage and the isolated authenticated recovery rehearsal remain pending.
- `NOT YET VERIFIED`: authenticated application flows, authenticated RLS behavior, final end-to-end application recovery, final RTO and production recovery.
- The rehearsal verifies the canonical database schema/migrations, public application data, relevant database role/settings state and BACKUP-DR-001B Storage object-byte recovery. It does **not** establish complete Phoenix disaster recovery.

### PHX-AUTH-DR-001 — approved Auth recovery strategy

Original Auth user UUIDs are mandatory recovery identities. Direct dependencies are `profiles.id -> auth.users.id`, `customer_portal_access.user_id -> auth.users.id` and `online_payment_attempts.initiated_by_user_id -> auth.users.id`; profiles then anchor memberships, roles, tenant authorization, portal access and historical application attribution. BACKUP-DR-001A contains the public application links but not managed `auth.users`, identities, password hashes, sessions or MFA state, so it cannot preserve password continuity by itself.

- **Primary — Option A:** near pre-production, after explicit approval for Supabase Pro, wait for a completed eligible physical backup and use provider-supported Restore to a New Project. Supabase documents transfer of Auth records and hashed passwords; AUTH-DR-001C must prove actual UUID, identity and login continuity, application links and tenant isolation.
- **Unverified fallback — Option B:** documented Supabase Admin `createUser` does not expose an original-user-ID parameter. Original-UUID Admin API reconstruction is **UNSUPPORTED / NOT VERIFIED** and is not an approved complete Auth DR fallback. Do not remap UUIDs or manufacture managed Auth records. Any alternative requires new official provider evidence and CTO approval.
- **Emergency only — Option C:** controlled re-onboarding without historical Auth continuity is degraded continuity, not the normal Phoenix DR strategy and not evidence of complete recovery.

Hosted staging signup is **VERIFIED DISABLED** by the Auth public settings and Product Owner read-only Dashboard evidence. Email confirmation is enabled. No hosted setting was changed during B4.

### AUTH-DR-001B3 / 001B4 — completed preparatory evidence

- **001B3 CLOSED / PASS:** the Product Owner repaired staging Auth UUID `10000000-0000-4000-8000-000000001302` in place by normalizing exactly `confirmation_token`, `recovery_token`, `email_change` and `email_change_token_new` from NULL to empty string. Direct Admin lookup returned 200, complete pagination returned 13 unique users, Dashboard loaded, and no new Auth 5xx appeared after retest. Thirteen readable Auth users match 13 profiles; 12 have normal email identities, with zero unreadable users, confirmed orphans or duplicate normal login identities. The one readable **LEGACY HISTORICAL TEST AUTH RECORD** (`OPS-001.3 Test Staff`) has zero identities, no active membership/Portal/Platform Admin access, and retains two `orders.assigned_to` and one `pickups.assigned_to` historical references. Preserve its UUID and do not make it login-capable.
- **001B4 COMPLETE / PASS:** protected evidence set `AUTH-DR-001B4-20261006T162233Z` holds a current Auth inventory (SHA-256 `89f6632bf3adfbc7cc34d27fe65fed3d22565edcaf2860c5977c8229bf376345`), non-secret Auth configuration manifest (SHA-256 `a1479fd3cf69dedff5e3a6835603c83d74c389daa4b6d9121652162b51c178b6`) and clone containment plan (SHA-256 `7affffec7d494fa9fa9ec23264afb886f845f8d70d1149bb6e97e503f71d8eb1`). No Auth emails or secrets are recorded in Git.
- **Fresh Storage snapshot COMPLETE:** `brand-media` 221 objects / 21,528,210 bytes; `order-media` 6 / 3,526,753; `accounting-exports` 2 / 5,098; total 229 / 25,060,061. Initial/final source listings matched, all objects downloaded with zero failures and 229/229 local disk SHA-256 checks passed. Storage manifest SHA-256: `a4a0c299085f3e7ba8f3ad12d9bbe60d79f45b4c7607244fc59d9d30ad75d337`. The private Accountant Pack ZIPs remain generated, ephemeral and non-fiscal.
- **Current Auth configuration:** staging Site URL `https://ecowash-phoenix-staging.vercel.app`, four redirects, public signup/manual linking/anonymous sign-in disabled, email confirmation enabled, email-only provider, Resend Custom SMTP enabled, required template categories present, TOTP enabled/SMS MFA disabled, no Auth Hooks. Single-session enforcement disabled; session time-box and inactivity timeout 0 hours; access token 3600 seconds; compromised refresh-token detection enabled with 10-second reuse interval. CAPTCHA and leaked-password protection disabled. Rate limits are captured in the non-secret manifest. Only template body customization and unexposed password-policy details remain non-blocking unknowns.
- **Clone containment:** read-only live evidence found `pg_cron` and `pg_net` not installed, zero HTTP/database-webhook triggers, zero Auth Hooks and zero Supabase Edge Functions; repository inspection found no contradiction. Accountant Pack Cron `/api/internal/accountant-pack/worker` runs in the existing staging Vercel project and is outside a Supabase DB clone. Before any future clone, recheck external effects; begin with recovery-only URLs, contained test/sink email, no real invite/reset/OTP and no connected Vercel worker.
- **Custody finding:** `ENCRYPTED OFF-DEVICE COPY PENDING` for B4. The historical encryption credential was intentionally not retrieved; no unknown external upload occurred. This does not invalidate the verified local snapshot, but must be resolved before production readiness.
- **Paid capability and sequencing:** current staging is Supabase Free with no available physical backup and PITR disabled. Pro daily physical backups (seven-day retention) suffice for the planned isolated rehearsal; PITR is optional. No guaranteed first-backup timing or manual physical snapshot command is documented. The Product Owner/CTO **deferred the Pro upgrade until pre-production** because pilot/test data and tenant/product configuration are still evolving. The eventual recovery project has separate provider costs.

**AUTH-DR-001C is DEFERRED UNTIL PRE-PRODUCTION and remains a HARD PRE-PRODUCTION / RELEASE GATE.** After an explicitly authorized Pro upgrade, verify an eligible completed physical backup timestamped after the desired near-final Auth/application state, then separately authorize the isolated rehearsal. Prove Auth UUIDs/identities and supported password continuity, staff and Portal login, public links, RLS/tenant/role behavior, restored Storage privacy and application recovery. Storage bytes/settings, Auth/SMTP/provider configuration, secrets, Edge Functions and Vercel configuration require separate recovery. No upgrade, clone or Auth recovery was performed in B4.

### Local PostgreSQL tooling guardrail

Client-side PostgreSQL tooling was verified with the existing `postgres:17` image on `linux/amd64` using `psql` 17.11. No additional Docker image was pulled during Phase 2D. Where applicable, use `--platform=linux/amd64` and `--pull=never`. Avoid commands that start or pull a Supabase local Postgres image because those images consume significant local disk space.

## What Still Depends on Platform or Account Recovery

- GitHub write/admin access and recovery factors.
- Vercel team access, project recreation, Git connection and environment re-entry.
- Supabase organization access, project creation, public API identifiers and secret regeneration.
- Explicit pre-production Pro approval, a completed eligible physical backup and the AUTH-DR-001C rehearsal; original-UUID Admin API reconstruction remains unsupported/not verified.
- Recreating the verified B4 Auth URL/signup/confirmation/session/rate-limit/template and SMTP settings safely in an isolated project; template body customization remains unknown.
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
3. Verify the current protected recovery sets and repository migration history. The BACKUP-DR-001D sequence of 49 migrations and its checked `data.sql`/`roles.sql` is historical evidence, not a current-state backup. For an approved loss recovery, choose a restore procedure matching the eligible physical backup and current migrations; do not blindly replay the historical logical set or restore `schema.sql` after migrations.
4. Preserve identity-linked public UUIDs. Use the approved physical-backup route when eligible; 001A does not contain Auth users or password material. Original-UUID Admin API reconstruction is unsupported/not verified. Never improvise UUID remapping or fabricate managed Auth records.
5. Recreate the Storage bucket definitions and approved policies, including private `accounting-exports`, then restore the verified B4 bytes through the supported Storage API: require an empty target, do not upsert, and re-download/hash-check every object.
6. Recreate the verified B4 Auth URL, signup/confirmation, session, rate-limit, template and SMTP configuration with recovery-only URL/email containment. Public signup remains disabled; do not assume copied SMTP credentials are safe.
7. Obtain/regenerate the replacement public identifiers and service-role credential, then update only the staging Vercel project and secured local environment.
8. Validate schema/data counts, RLS and tenant isolation, Auth flows, Storage privacy, representative tenant configuration, numbering/financial history and application health before cutover.

Full Supabase recovery remains blocked because AUTH-DR-001C and authenticated end-to-end validation have not been rehearsed. The earlier logical public-database and Storage-byte restore sequences are verified; the fresh B4 Storage capture has not itself been restored.

## SMTP/DNS-Credential-Loss Scenario

1. Recover the Resend account and the registrar/DNS-host accounts using provider recovery mechanisms. If account ownership cannot be proven, stop; do not change delegation or create a replacement sending identity silently.
2. In Resend, retain/re-verify `ecowashlatejita.com` and obtain the required DNS record set. Do not copy record tokens into Git.
3. Recreate only the required delegation, DKIM, SPF, DMARC and mail-routing categories at the authoritative DNS host. Preserve unrelated records and record rollback evidence outside Git.
4. Reset/regenerate the SMTP credential if it cannot be retrieved. Enter the named SMTP fields in Supabase Custom SMTP without logging values.
5. Verify provider domain status, then send and receive a real Supabase Auth email and recheck endpoint-specific rate limiting.

The current provider/domain/sender are known, but DNS account custody, registrar identity, credential recovery and a recovery rehearsal remain unresolved.

## Mandatory Pre-Production Auth and DR Gate

Earlier logical database and Storage restores are `VERIFIED`; B4 has a fresh locally verified Storage capture and protected Auth inventory/configuration. Physical Auth recovery and full authenticated application recovery are `NOT YET VERIFIED`. **AUTH-DR-001C is a HARD PRE-PRODUCTION / RELEASE GATE**, deliberately deferred until the near-final tenant/application state. Phoenix must not be considered fully production-ready or DR-complete until the following remaining gates pass:

1. Obtain explicit approval near pre-production to upgrade to the minimum supported Supabase plan. Pro daily physical backups suffice for this rehearsal; PITR is not required.
2. Confirm Pro and physical backup capability are active; wait for an eligible **completed** backup and capture its timestamp. Require it to postdate the Auth repair, final inventory and desired near-final application state; verify Restore to a New Project is available for that backup.
3. Reverify the B4 Storage `COMPLETE` set, protected Auth inventory/configuration, live external effects and isolated clone/email/Vercel containment. Refresh evidence if staging materially changed.
4. Resolve encrypted off-device custody, owner/retention and recoverability, plus separate secure custody for provider, Auth, SMTP and signing secrets. Never record secret values here.
5. Separately authorize AUTH-DR-001C and rehearse physical Restore to a New Project without connecting the existing Vercel worker or sending real Auth email.
6. Prove original Auth UUID/identity and supported password continuity, profile/membership/Portal linkage, staff and customer Portal login, authenticated RLS, tenant isolation, roles/capabilities, restored Storage access/privacy and application recovery smoke.
7. Record recovery time, operator, rollback and remaining risks. Only after AUTH-DR-001C passes, custody is resolved and other mandatory release gates pass may Phoenix be marked production-ready or DR-complete.

The wider recovery gate still includes clean-machine repository/provider-account recovery, off-device backup retrieval after simulated Mac loss, the already verified 001A database and 001B Storage restores, recreation of Vercel/Auth/SMTP/DNS configuration, authenticated Storage validation, financial-history/application smoke validation and final RTO evidence.
