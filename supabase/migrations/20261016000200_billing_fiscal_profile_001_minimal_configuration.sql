-- BILLING-FISCAL-PROFILE-001: declarations only, not fiscal approval.
-- Reuse issuer_country_code and the existing Billing identity/series/rates.
-- Territory and regime are opaque technical identifiers, not a legal allowlist.
-- NULL means undeclared; existing organizations receive no inferred profile.
-- No approved configuration identifier/version is assigned: no approval contract
-- or approved fiscal rules exist yet. Do not infer approval from these codes.
--
-- No configuration RPC or client mutation privilege is added. The existing
-- Owner-only settings RPC keeps its explicit column lists and does not write
-- these fields. Existing management SELECT/RLS and entitlement checks remain.
-- A separately reviewed configuration workflow is required to edit these fields
-- through the application. No client-supplied tenant context is introduced.
--
-- Simplified invoicing stays disabled even if a privileged writer sets the flag.
-- Relaxing this CHECK requires a separately approved workflow/migration; the
-- independent invoices_fiscal_document_type_ordinary_only guard is untouched.

begin;

alter table public.organization_billing_settings
  add column fiscal_territory_code text,
  add column declared_tax_regime_code text,
  add column simplified_invoicing_enabled boolean not null default false,
  add constraint organization_billing_settings_fiscal_territory_code_valid check (
    fiscal_territory_code is null
    or fiscal_territory_code ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'
  ),
  add constraint organization_billing_settings_declared_tax_regime_code_valid check (
    declared_tax_regime_code is null
    or declared_tax_regime_code ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'
  ),
  add constraint organization_billing_settings_simplified_disabled check (
    simplified_invoicing_enabled = false
  );

commit;
