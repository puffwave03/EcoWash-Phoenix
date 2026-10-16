-- BILLING-SIMPLIFIED-INVOICE-001C: reserve a canonical series declaration only.
-- RD 1619/2012 art. 7.1(a) requires separate ordinary/simplified series.
-- No value or counter is assigned, copied from default_series or inferred.
-- Future configuration must verify approval, separation from every ordinary
-- series (including historical/custom series) and existing counter/history use.
-- This nullable declaration is not that verification or an emission permission.
-- No application read depends on this unapplied column yet.
--
-- Both invoices_fiscal_document_type_ordinary_only (001B) and
-- organization_billing_settings_simplified_disabled remain unchanged.
-- A later coordinated, reviewed workflow migration must install complete
-- server controls before any relaxation. This migration relaxes neither guard.
-- Existing Owner-only settings RPC and all RLS/grants remain untouched;
-- no client writer for this field is exposed.

begin;

alter table public.organization_billing_settings
  add column simplified_series text,
  add constraint organization_billing_settings_simplified_series_valid check (
    simplified_series is null
    or simplified_series ~ '^[A-Z0-9-]{1,12}$'
  );

commit;
