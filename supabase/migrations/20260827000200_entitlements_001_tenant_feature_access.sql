create table public.platform_feature_catalog (
  feature_key text primary key,
  category text not null,
  description text not null,
  created_at timestamptz not null default now(),
  constraint platform_feature_catalog_key_format check (
    feature_key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'
  ),
  constraint platform_feature_catalog_category_format check (
    category ~ '^[a-z][a-z0-9_]*$'
  ),
  constraint platform_feature_catalog_description_length check (
    length(btrim(description)) between 1 and 240
  )
);

insert into public.platform_feature_catalog (feature_key, category, description)
values
  ('core.orders', 'core', 'Order management and order line workflows'),
  ('core.customers', 'core', 'Customer and property management'),
  ('core.operations', 'core', 'Production and logistics operations'),
  ('core.portal', 'core', 'Authenticated Customer Portal'),
  ('catalog.management', 'catalog', 'Tenant catalogue administration'),
  ('catalog.segments', 'catalog', 'Customer segment administration'),
  ('pricing.segment_overrides', 'pricing', 'Dated customer segment price overrides'),
  ('billing.invoicing', 'billing', 'Invoice drafting, issue and history'),
  ('branding.basic', 'branding', 'Basic commercial identity'),
  ('branding.custom_colors', 'branding', 'Custom tenant colour palette'),
  ('branding.full_white_label', 'branding', 'Advanced customer-facing white-label configuration'),
  ('reports.advanced', 'reports', 'Advanced operational and commercial reports'),
  ('pos', 'commerce', 'Point of sale'),
  ('printing', 'operations', 'Operational and commercial printing'),
  ('barcode', 'operations', 'Barcode workflows'),
  ('accounting', 'finance', 'Accounting foundation'),
  ('e_invoice', 'finance', 'Electronic invoicing'),
  ('multi_location', 'platform', 'Multiple operational locations');

create table public.organization_entitlements (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  feature_key text not null references public.platform_feature_catalog (feature_key) on delete restrict,
  enabled boolean not null default false,
  limit_value bigint,
  source text not null default 'platform',
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, feature_key),
  constraint organization_entitlements_limit_non_negative check (
    limit_value is null or limit_value >= 0
  ),
  constraint organization_entitlements_source_format check (
    source ~ '^[a-z0-9_:-]{1,64}$'
  ),
  constraint organization_entitlements_valid_range check (
    valid_until is null or valid_from is null or valid_until >= valid_from
  )
);

create index organization_entitlements_effective_idx
on public.organization_entitlements (organization_id, feature_key, enabled, valid_from, valid_until);

create trigger organization_entitlements_set_updated_at
before update on public.organization_entitlements
for each row execute function public.set_updated_at();

alter table public.platform_feature_catalog enable row level security;
alter table public.organization_entitlements enable row level security;

create policy organization_entitlements_select_management
on public.organization_entitlements
for select to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'manager']::public.app_role[]
  )
);

revoke all on public.platform_feature_catalog from public, anon, authenticated;
revoke all on public.organization_entitlements from public, anon, authenticated;
grant select on public.organization_entitlements to authenticated;

create function public.organization_entitlement_is_enabled(
  target_organization_id uuid,
  target_feature_key text,
  target_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_entitlements entitlement
    join public.platform_feature_catalog feature
      on feature.feature_key = entitlement.feature_key
    where entitlement.organization_id = target_organization_id
      and entitlement.feature_key = target_feature_key
      and entitlement.enabled
      and (entitlement.valid_from is null or entitlement.valid_from <= target_at)
      and (entitlement.valid_until is null or entitlement.valid_until >= target_at)
  );
$$;

create function public.has_organization_entitlement(
  target_organization_id uuid,
  target_feature_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_organization_member(target_organization_id)
    and public.organization_entitlement_is_enabled(
      target_organization_id,
      target_feature_key,
      now()
    );
$$;

create function public.list_current_organization_entitlements(target_feature_keys text[])
returns table (
  feature_key text,
  enabled boolean,
  limit_value bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
begin
  if target_feature_keys is null or cardinality(target_feature_keys) > 100 then
    raise exception 'entitlement_feature_keys_invalid' using errcode = '22023';
  end if;

  return query
  select
    requested.feature_key,
    public.organization_entitlement_is_enabled(org_id, requested.feature_key, now()),
    case
      when public.organization_entitlement_is_enabled(org_id, requested.feature_key, now())
        then entitlement.limit_value
      else null
    end
  from unnest(target_feature_keys) requested(feature_key)
  left join public.organization_entitlements entitlement
    on entitlement.organization_id = org_id
   and entitlement.feature_key = requested.feature_key
  where exists (
    select 1 from public.platform_feature_catalog feature
    where feature.feature_key = requested.feature_key
  );
end;
$$;

-- Preserve the behavior of every tenant that already exists at migration time.
-- Future tenants receive no implicit premium rows and must be provisioned by a
-- future trusted platform-control path.
insert into public.organization_entitlements (
  organization_id,
  feature_key,
  enabled,
  source
)
select
  organization.id,
  feature.feature_key,
  true,
  'bootstrap_existing_20260827'
from public.organizations organization
cross join public.platform_feature_catalog feature
where organization.deleted_at is null
  and feature.feature_key = any(array[
    'core.orders',
    'core.customers',
    'core.operations',
    'core.portal',
    'catalog.management',
    'catalog.segments',
    'pricing.segment_overrides',
    'billing.invoicing',
    'branding.basic',
    'branding.custom_colors',
    'branding.full_white_label'
  ]::text[]);

create function public.require_billing_entitlement()
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
    raise exception 'billing_entitlement_required' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger organization_billing_settings_require_entitlement
before insert or update or delete on public.organization_billing_settings
for each row execute function public.require_billing_entitlement();

create trigger invoices_require_entitlement
before insert or update or delete on public.invoices
for each row execute function public.require_billing_entitlement();

drop policy if exists organization_billing_settings_select_management
on public.organization_billing_settings;
create policy organization_billing_settings_select_management
on public.organization_billing_settings
for select to authenticated
using (
  public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[])
  and public.has_organization_entitlement(organization_id, 'billing.invoicing')
);

drop policy if exists invoices_select_management on public.invoices;
create policy invoices_select_management
on public.invoices
for select to authenticated
using (
  public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[])
  and public.has_organization_entitlement(organization_id, 'billing.invoicing')
);

drop policy if exists invoice_items_select_management on public.invoice_items;
create policy invoice_items_select_management
on public.invoice_items
for select to authenticated
using (
  public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[])
  and public.has_organization_entitlement(organization_id, 'billing.invoicing')
);

drop policy if exists invoice_orders_select_management on public.invoice_orders;
create policy invoice_orders_select_management
on public.invoice_orders
for select to authenticated
using (
  public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[])
  and public.has_organization_entitlement(organization_id, 'billing.invoicing')
);

create function public.require_segment_pricing_management_entitlement()
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
    'pricing.segment_overrides',
    now()
  ) then
    raise exception 'segment_pricing_entitlement_required' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger catalog_segment_prices_require_entitlement
before insert or update or delete on public.catalog_segment_prices
for each row execute function public.require_segment_pricing_management_entitlement();

drop policy if exists catalog_segment_prices_select_manager
on public.catalog_segment_prices;
create policy catalog_segment_prices_select_manager
on public.catalog_segment_prices
for select to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'manager']::public.app_role[]
  )
  and public.has_organization_entitlement(
    organization_id,
    'pricing.segment_overrides'
  )
);

drop policy if exists organization_branding_insert_owner
on public.organization_branding;
create policy organization_branding_insert_owner
on public.organization_branding
for insert to authenticated
with check (
  public.has_organization_role(organization_id, array['owner']::public.app_role[])
  and public.has_organization_entitlement(organization_id, 'branding.full_white_label')
);

drop policy if exists organization_branding_update_owner
on public.organization_branding;
create policy organization_branding_update_owner
on public.organization_branding
for update to authenticated
using (
  public.has_organization_role(organization_id, array['owner']::public.app_role[])
  and public.has_organization_entitlement(organization_id, 'branding.full_white_label')
)
with check (
  public.has_organization_role(organization_id, array['owner']::public.app_role[])
  and public.has_organization_entitlement(organization_id, 'branding.full_white_label')
);

drop policy if exists brand_media_insert_owner on storage.objects;
create policy brand_media_insert_owner
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'brand-media'
  and owner = auth.uid()
  and public.app_brand_media_path_is_valid(name)
  and public.has_organization_role(
    public.app_brand_media_path_organization_id(name),
    array['owner']::public.app_role[]
  )
  and public.has_organization_entitlement(
    public.app_brand_media_path_organization_id(name),
    'branding.full_white_label'
  )
);

drop policy if exists brand_media_delete_owner on storage.objects;
create policy brand_media_delete_owner
on storage.objects
for delete to authenticated
using (
  bucket_id = 'brand-media'
  and public.app_brand_media_path_is_valid(name)
  and public.has_organization_role(
    public.app_brand_media_path_organization_id(name),
    array['owner']::public.app_role[]
  )
  and public.has_organization_entitlement(
    public.app_brand_media_path_organization_id(name),
    'branding.full_white_label'
  )
);

revoke all on function public.organization_entitlement_is_enabled(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.has_organization_entitlement(uuid, text) from public, anon, authenticated;
grant execute on function public.has_organization_entitlement(uuid, text) to authenticated;

revoke all on function public.list_current_organization_entitlements(text[]) from public, anon, authenticated;
grant execute on function public.list_current_organization_entitlements(text[]) to authenticated;

revoke all on function public.require_billing_entitlement() from public, anon, authenticated;
revoke all on function public.require_segment_pricing_management_entitlement() from public, anon, authenticated;
