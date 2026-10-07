-- Tenant configuration is distinct from commercial branding and invoice issuer identity.
alter table public.organizations
  add column default_locale text not null default 'en',
  add column default_country_code text;

alter table public.organizations
  add constraint organizations_default_locale_supported
    check (default_locale in ('en', 'it', 'es', 'fr', 'de')),
  add constraint organizations_default_country_code_format
    check (default_country_code is null or default_country_code ~ '^[A-Z]{2}$');

-- Preserve the pilot's effective defaults without imposing them on future tenants.
update public.organizations
set default_locale = 'es', default_country_code = 'ES'
where slug = 'ecowash-la-tejita';

-- A future trusted bootstrap must supply both values explicitly.
alter table public.organizations
  alter column default_currency drop default,
  alter column timezone drop default;

-- New customer/property writes must supply tenant context or leave country unset.
-- Historical rows, including the shared walk-in customer, are not rewritten.
alter table public.customers
  alter column billing_country_code drop default,
  alter column preferred_locale drop default;
alter table public.properties
  alter column country_code drop default;

-- Existing Order creation RPCs omit currency; resolve only future inserts from
-- their validated tenant row instead of silently assigning the pilot currency.
alter table public.orders alter column currency drop default;
alter table public.service_prices alter column currency drop default;

create function public.default_new_order_currency()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.currency is null then
    select organization.default_currency::text into new.currency
    from public.organizations organization
    where organization.id = new.organization_id
      and organization.status = 'active'
      and organization.deleted_at is null;
  end if;
  if new.currency is null then
    raise exception 'order_currency_unavailable' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger orders_default_currency
before insert on public.orders
for each row execute function public.default_new_order_currency();

create function public.validate_organization_timezone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names tz where tz.name = new.timezone
  ) then
    raise exception 'organization_timezone_invalid' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger organizations_validate_timezone
before insert or update of timezone on public.organizations
for each row execute function public.validate_organization_timezone();

create function public.update_current_organization_settings(
  target_name text,
  target_default_currency text,
  target_timezone text,
  target_default_locale text,
  target_default_country_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  normalized_name text := btrim(target_name);
  normalized_country text := nullif(btrim(target_default_country_code), '');
  current_currency text;
  current_timezone text;
begin
  if not public.has_organization_role(org_id, array['owner']::public.app_role[]) then
    raise exception 'organization_settings_denied' using errcode = '42501';
  end if;

  if normalized_name is null or char_length(normalized_name) not between 1 and 160
    or target_default_currency is null or target_default_currency !~ '^[A-Z]{3}$'
    or target_timezone is null or not exists (
      select 1 from pg_catalog.pg_timezone_names tz where tz.name = target_timezone
    )
    or target_default_locale is null
    or target_default_locale not in ('en', 'it', 'es', 'fr', 'de')
    or (normalized_country is not null and normalized_country !~ '^[A-Z]{2}$') then
    raise exception 'organization_settings_invalid' using errcode = '22023';
  end if;

  -- Serialize settings changes with inserts referencing this tenant. Existing
  -- prices and historical facts are never converted or removed by Settings.
  select organization.default_currency::text, organization.timezone
    into current_currency, current_timezone
  from public.organizations organization
  where organization.id = org_id and organization.deleted_at is null
    and organization.status = 'active'
  for update;

  if not found then
    raise exception 'organization_settings_unavailable' using errcode = '42501';
  end if;

  if target_default_currency is distinct from current_currency and (
    exists (select 1 from public.service_prices where organization_id = org_id)
    or exists (select 1 from public.catalog_segment_prices where organization_id = org_id)
    or exists (select 1 from public.orders where organization_id = org_id)
    or exists (select 1 from public.invoices where organization_id = org_id)
    or exists (select 1 from public.expenses where organization_id = org_id)
  ) then
    raise exception 'organization_currency_locked' using errcode = '22023';
  end if;

  if target_timezone is distinct from current_timezone and (
    exists (select 1 from public.orders where organization_id = org_id)
    or exists (select 1 from public.pos_sessions where organization_id = org_id)
    or exists (select 1 from public.daily_closes where organization_id = org_id)
    or exists (select 1 from public.invoices where organization_id = org_id)
    or exists (select 1 from public.expenses where organization_id = org_id)
  ) then
    raise exception 'organization_timezone_locked' using errcode = '22023';
  end if;

  update public.organizations
  set name = normalized_name,
      default_currency = target_default_currency,
      timezone = target_timezone,
      default_locale = target_default_locale,
      default_country_code = normalized_country
  where id = org_id and deleted_at is null and status = 'active';

  if not found then
    raise exception 'organization_settings_unavailable' using errcode = '42501';
  end if;
end;
$$;

-- Existing catalog/Platform Admin updates use their own checked SECURITY DEFINER RPCs.
revoke update on public.organizations from authenticated;
revoke all on function public.validate_organization_timezone() from public, anon, authenticated;
revoke all on function public.default_new_order_currency() from public, anon, authenticated;
revoke all on function public.update_current_organization_settings(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.update_current_organization_settings(text, text, text, text, text) to authenticated;
