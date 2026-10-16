-- BILLING-SIMPLIFIED-INVOICE-001B: technical classification only.
-- Existing and new invoices retain the ordinary path; no fiscal compliance is implied.
-- The constant default classifies historical rows without updating their snapshots.
-- Simplified documents remain blocked at every status, including drafts.
-- A later, separately reviewed migration must provide the complete typed workflow
-- before relaxing invoices_fiscal_document_type_ordinary_only.

begin;

create type public.billing_fiscal_document_type as enum ('ordinary', 'simplified');

alter table public.invoices
  add column fiscal_document_type public.billing_fiscal_document_type
    not null default 'ordinary'::public.billing_fiscal_document_type,
  add constraint invoices_fiscal_document_type_ordinary_only check (
    fiscal_document_type = 'ordinary'::public.billing_fiscal_document_type
  );

-- Keep type immutability independent of the temporary ordinary-only constraint.
-- Do not replace the existing Billing mutation, entitlement or walk-in guards.
create function public.protect_billing_fiscal_document_type()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.document_status <> 'draft'
    and new.fiscal_document_type is distinct from old.fiscal_document_type
  then
    raise exception 'billing_issued_fiscal_type_immutable' using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger invoices_protect_fiscal_document_type
before update of fiscal_document_type on public.invoices
for each row execute function public.protect_billing_fiscal_document_type();

revoke all on function public.protect_billing_fiscal_document_type()
  from public, anon, authenticated;

commit;
