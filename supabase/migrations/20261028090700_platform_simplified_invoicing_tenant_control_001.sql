-- Per-tenant Platform Admin gate for simplified Billing issuance.
-- Functional authorization is not fiscal certification or legal approval.
begin;

create function public.platform_get_simplified_invoicing_status(
  target_organization_id uuid
)
returns table (
  simplified_invoicing_enabled boolean,
  billing_entitlement_enabled boolean,
  simplified_series_ready boolean,
  fiscal_profile_ready boolean,
  issuer_configuration_ready boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  settings_row public.organization_billing_settings%rowtype;
begin
  perform public.require_platform_admin_identity();

  if not exists (
    select 1 from public.organizations organization
    where organization.id = target_organization_id
      and organization.deleted_at is null
  ) then
    raise exception 'platform_simplified_invoicing_target_invalid'
      using errcode = '22023';
  end if;

  select settings.* into settings_row
  from public.organization_billing_settings settings
  where settings.organization_id = target_organization_id;

  return query select
    coalesce(settings_row.simplified_invoicing_enabled, false),
    public.organization_entitlement_is_enabled(
      target_organization_id, 'billing.invoicing', pg_catalog.now()
    ),
    coalesce(
      settings_row.simplified_series is not null
      and settings_row.simplified_series is distinct from settings_row.default_series
      and exists (
        select 1 from public.billing_series_ownership ownership
        where ownership.organization_id = target_organization_id
          and ownership.series = settings_row.simplified_series
          and ownership.fiscal_document_type = 'simplified'
      ), false
    ),
    coalesce(
      settings_row.fiscal_territory_code = 'ES-CN'
      and settings_row.declared_tax_regime_code = 'IGIC-GENERAL'
      and settings_row.issuer_country_code = 'ES', false
    ),
    coalesce(
      nullif(pg_catalog.btrim(settings_row.issuer_legal_name), '') is not null
      and nullif(pg_catalog.btrim(settings_row.issuer_tax_id), '') is not null
      and nullif(pg_catalog.btrim(settings_row.issuer_address_line1), '') is not null
      and nullif(pg_catalog.btrim(settings_row.issuer_city), '') is not null
      and nullif(pg_catalog.btrim(settings_row.issuer_postal_code), '') is not null
      and settings_row.issuer_country_code = 'ES', false
    );
end;
$$;

create function public.platform_set_simplified_invoicing_enabled(
  target_organization_id uuid,
  target_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_platform_admin_identity();
  settings_row public.organization_billing_settings%rowtype;
  previous_enabled boolean := false;
begin
  if target_enabled is null then
    raise exception 'platform_simplified_invoicing_values_invalid'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.organizations organization
    where organization.id = target_organization_id
      and organization.deleted_at is null
  ) then
    raise exception 'platform_simplified_invoicing_target_invalid'
      using errcode = '22023';
  end if;

  select settings.* into settings_row
  from public.organization_billing_settings settings
  where settings.organization_id = target_organization_id
  for update;

  previous_enabled := coalesce(settings_row.simplified_invoicing_enabled, false);

  if target_enabled then
    if settings_row.organization_id is null
      or not public.organization_entitlement_is_enabled(
        target_organization_id, 'billing.invoicing', pg_catalog.now()
      )
      or settings_row.simplified_series is null
      or settings_row.simplified_series is not distinct from settings_row.default_series
      or not exists (
        select 1 from public.billing_series_ownership ownership
        where ownership.organization_id = target_organization_id
          and ownership.series = settings_row.simplified_series
          and ownership.fiscal_document_type = 'simplified'
      )
      or settings_row.fiscal_territory_code is distinct from 'ES-CN'
      or settings_row.declared_tax_regime_code is distinct from 'IGIC-GENERAL'
      or settings_row.issuer_country_code is distinct from 'ES'
      or nullif(pg_catalog.btrim(settings_row.issuer_legal_name), '') is null
      or nullif(pg_catalog.btrim(settings_row.issuer_tax_id), '') is null
      or nullif(pg_catalog.btrim(settings_row.issuer_address_line1), '') is null
      or nullif(pg_catalog.btrim(settings_row.issuer_city), '') is null
      or nullif(pg_catalog.btrim(settings_row.issuer_postal_code), '') is null then
      raise exception 'platform_simplified_invoicing_requirements_missing'
        using errcode = '22023';
    end if;
  end if;

  if previous_enabled is not distinct from target_enabled then
    return false;
  end if;

  update public.organization_billing_settings
  set simplified_invoicing_enabled = target_enabled,
      updated_by = actor_id
  where organization_id = target_organization_id;

  insert into public.platform_audit_log (
    platform_user_id, organization_id, action, target, before_state, after_state
  ) values (
    actor_id,
    target_organization_id,
    case when target_enabled
      then 'simplified_invoicing_enabled'
      else 'simplified_invoicing_disabled'
    end,
    'billing.simplified_invoicing',
    pg_catalog.jsonb_build_object('enabled', previous_enabled),
    pg_catalog.jsonb_build_object('enabled', target_enabled)
  );

  return true;
end;
$$;

-- Billing's existing trigger also runs when the entitlement is off. Permit
-- only a Platform Admin's isolated true -> false gate transition in that case.
create or replace function public.require_billing_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_organization_id uuid := coalesce(new.organization_id, old.organization_id);
begin
  if not public.organization_entitlement_is_enabled(
    target_organization_id,
    'billing.invoicing',
    now()
  ) then
    if tg_op = 'UPDATE'
      and tg_relid = 'public.organization_billing_settings'::regclass then
      if old.simplified_invoicing_enabled
        and not new.simplified_invoicing_enabled
        and public.is_platform_admin()
        and new.updated_by = auth.uid()
        and (to_jsonb(new) - array['simplified_invoicing_enabled', 'updated_by', 'updated_at']::text[])
          = (to_jsonb(old) - array['simplified_invoicing_enabled', 'updated_by', 'updated_at']::text[]) then
        return new;
      end if;
    end if;
    raise exception 'billing_entitlement_required' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.platform_get_simplified_invoicing_status(uuid)
  from public, anon, authenticated;
grant execute on function public.platform_get_simplified_invoicing_status(uuid)
  to authenticated;

revoke all on function public.platform_set_simplified_invoicing_enabled(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.platform_set_simplified_invoicing_enabled(uuid, boolean)
  to authenticated;

comment on function public.platform_set_simplified_invoicing_enabled(uuid, boolean) is
  'Per-tenant Platform Admin functional gate; not fiscal certification or legal approval.';

commit;
