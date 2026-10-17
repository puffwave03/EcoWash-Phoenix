-- BILLING-SIMPLIFIED-INVOICE-001D: LOCAL / NOT APPLIED.
-- Series ownership only: no fiscal eligibility, numbering allocation or activation.
-- Both earlier simplified-issuance guards remain in force. An association is
-- permanent, including after a preference changes or a draft is deleted.

begin;
set local lock_timeout = '5s';

-- Freeze all sources during validation/backfill and installation of the guards.
-- A busy database may abort on timeout/deadlock: do not bypass or auto-retry it.
lock table public.organization_billing_settings, public.invoices,
  public.billing_invoice_number_counters in share row exclusive mode;

do $$
begin
  -- The legacy counter has no type. Its only approved writer is ordinary.
  -- Prove that baseline before applying the ordinary default; never infer the
  -- type of an already enabled simplified installation or rewrite its history.
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.invoices'::regclass
      and conname = 'invoices_fiscal_document_type_ordinary_only' and convalidated
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.organization_billing_settings'::regclass
      and conname = 'organization_billing_settings_simplified_disabled' and convalidated
  ) or exists (
    select 1 from public.invoices where fiscal_document_type <> 'ordinary'
  ) or exists (
    select 1 from public.organization_billing_settings where simplified_invoicing_enabled
  ) then
    raise exception 'billing_series_unsupported_baseline' using errcode = '55000';
  end if;

  -- Every invoice status counts. Orphan counters also retain ordinary ownership.
  if exists (with historical_series as (
    select organization_id, default_series as series,
      'ordinary'::public.billing_fiscal_document_type as fiscal_document_type
    from public.organization_billing_settings
    union all
    select organization_id, simplified_series, 'simplified'::public.billing_fiscal_document_type
    from public.organization_billing_settings where simplified_series is not null
    union all
    select organization_id, series, fiscal_document_type from public.invoices
    union all
    select organization_id, series, 'ordinary'::public.billing_fiscal_document_type
    from public.billing_invoice_number_counters
  )
  select 1 from historical_series
  group by organization_id, series
  having count(distinct fiscal_document_type) > 1) then
    raise exception 'billing_simplified_series_used' using errcode = '22023';
  end if;
end;
$$;

create table public.billing_series_ownership (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  series text not null check (series ~ '^[A-Z0-9-]{1,12}$'),
  fiscal_document_type public.billing_fiscal_document_type not null,
  primary key (organization_id, series),
  unique (organization_id, series, fiscal_document_type)
);
alter table public.billing_series_ownership enable row level security;
revoke all on table public.billing_series_ownership from public, anon, authenticated;

with historical_series as (
  select organization_id, default_series as series,
    'ordinary'::public.billing_fiscal_document_type as fiscal_document_type
  from public.organization_billing_settings
  union all
  select organization_id, simplified_series, 'simplified'::public.billing_fiscal_document_type
  from public.organization_billing_settings where simplified_series is not null
  union all
  select organization_id, series, fiscal_document_type from public.invoices
  union all
  select organization_id, series, 'ordinary'::public.billing_fiscal_document_type
  from public.billing_invoice_number_counters
)
insert into public.billing_series_ownership (organization_id, series, fiscal_document_type)
select distinct organization_id, series, fiscal_document_type from historical_series;

-- No counter is created/advanced and no timestamp or invoice snapshot is updated.
alter table public.billing_invoice_number_counters
  add column fiscal_document_type public.billing_fiscal_document_type
    not null default 'ordinary'::public.billing_fiscal_document_type,
  add constraint billing_counter_series_ownership foreign key
    (organization_id, series, fiscal_document_type)
    references public.billing_series_ownership (organization_id, series, fiscal_document_type);
alter table public.invoices
  add constraint invoices_series_ownership foreign key
    (organization_id, series, fiscal_document_type)
    references public.billing_series_ownership (organization_id, series, fiscal_document_type);

create function public.protect_billing_series_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'billing_series_ownership_immutable' using errcode = '55000';
end;
$$;
create trigger billing_series_ownership_immutable
before update or delete on public.billing_series_ownership
for each row execute function public.protect_billing_series_ownership();
revoke all on function public.protect_billing_series_ownership() from public, anon, authenticated;

create function public.claim_billing_series_ownership(
  target_organization_id uuid, target_series text,
  target_type public.billing_fiscal_document_type
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  owned_type public.billing_fiscal_document_type;
begin
  if target_organization_id is null or target_series is null
    or target_series !~ '^[A-Z0-9-]{1,12}$' or target_type is null then
    raise exception 'billing_simplified_series_invalid' using errcode = '22023';
  end if;

  -- The UNIQUE key arbitrates even an invisible conflicting insertion. Never
  -- upsert the type or UPDATE an existing owner merely to acquire a lock.
  -- RC: after waiting, the following VOLATILE query sees the committed owner.
  -- RR/Serializable: an invisible conflict can abort with 40001; it cannot be
  -- treated as a free series. Roll back the entire transaction before retrying.
  insert into public.billing_series_ownership (organization_id, series, fiscal_document_type)
  values (target_organization_id, target_series, target_type)
  on conflict (organization_id, series) do nothing;

  select fiscal_document_type into owned_type from public.billing_series_ownership
  where organization_id = target_organization_id and series = target_series;
  if not found then
    raise exception 'billing_series_owner_not_visible' using errcode = '40001';
  end if;
  if owned_type <> target_type then
    if owned_type = 'simplified'::public.billing_fiscal_document_type then
      raise exception 'billing_series_reserved_for_simplified' using errcode = '22023';
    end if;
    raise exception 'billing_simplified_series_used' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.claim_billing_series_ownership(uuid, text, public.billing_fiscal_document_type)
  from public, anon, authenticated;

create function public.guard_billing_series_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claim record;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'billing_series_organization_immutable' using errcode = '42501';
  end if;

  if tg_table_name = 'organization_billing_settings' then
    if new.simplified_series = new.default_series then
      raise exception 'billing_simplified_series_used' using errcode = '22023';
    end if;
    -- Two newly claimed preferences use lexical order. Immutable existing owners
    -- are read without row updates. Other multi-series transactions can still
    -- deadlock: propagate 40P01, never swallow it or retry a partial operation.
    for claim in
      select new.default_series as series, 'ordinary'::public.billing_fiscal_document_type as fiscal_type
      union all
      select new.simplified_series, 'simplified'::public.billing_fiscal_document_type
        where new.simplified_series is not null
      order by series
    loop
      perform public.claim_billing_series_ownership(new.organization_id, claim.series, claim.fiscal_type);
    end loop;
  else
    if tg_table_name = 'invoices' and tg_op = 'UPDATE' then
      if old.fiscal_document_type = 'simplified'::public.billing_fiscal_document_type
        and old.document_status = 'issued'::public.billing_invoice_document_status
        and new.document_status is distinct from old.document_status then
        raise exception 'billing_simplified_correction_workflow_required' using errcode = '55000';
      end if;
    end if;
    if tg_table_name = 'billing_invoice_number_counters' and tg_op = 'UPDATE' then
      if new.series is distinct from old.series
        or new.fiscal_document_type is distinct from old.fiscal_document_type then
        raise exception 'billing_counter_identity_immutable' using errcode = '55000';
      end if;
    end if;
    perform public.claim_billing_series_ownership(new.organization_id, new.series, new.fiscal_document_type);
  end if;
  return new;
end;
$$;
revoke all on function public.guard_billing_series_reservation() from public, anon, authenticated;

create trigger organization_billing_settings_guard_series
before insert or update of organization_id, default_series, simplified_series on public.organization_billing_settings
for each row execute function public.guard_billing_series_reservation();
create trigger invoices_guard_reserved_series
before insert or update of organization_id, series, fiscal_document_type, document_status on public.invoices
for each row execute function public.guard_billing_series_reservation();
create trigger billing_invoice_counters_guard_reserved_series
before insert or update on public.billing_invoice_number_counters
for each row execute function public.guard_billing_series_reservation();

create function public.reserve_billing_simplified_series(target_series text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  normalized_series text := upper(btrim(coalesce(target_series, '')));
begin
  if not public.has_organization_role(org_id, array['owner']::public.app_role[])
    or not public.has_organization_entitlement(org_id, 'billing.invoicing') then
    raise exception 'billing_settings_not_authorized' using errcode = '42501';
  end if;
  if btrim(coalesce(target_series, '')) !~ '^[A-Za-z0-9-]{1,12}$' then
    raise exception 'billing_simplified_series_invalid' using errcode = '22023';
  end if;
  update public.organization_billing_settings
  set simplified_series = normalized_series, updated_by = auth.uid()
  where organization_id = org_id;
  if not found then
    raise exception 'billing_settings_required' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.reserve_billing_simplified_series(text) from public, anon, authenticated;
grant execute on function public.reserve_billing_simplified_series(text) to authenticated;

commit;
