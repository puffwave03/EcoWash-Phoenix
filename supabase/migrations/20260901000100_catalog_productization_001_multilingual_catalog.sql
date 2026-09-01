-- CATALOG-PRODUCTIZATION-001: tenant-owned translations, presentation ordering,
-- and atomic stable-identity catalog reconciliation. Existing tenants retain
-- manual ordering; future tenants default to locale-aware alphabetical order.

alter table public.organizations
  add column catalog_order_mode text;

update public.organizations
set catalog_order_mode = 'manual'
where catalog_order_mode is null;

alter table public.organizations
  alter column catalog_order_mode set default 'alphabetical_asc',
  alter column catalog_order_mode set not null,
  add constraint organizations_catalog_order_mode_check
    check (catalog_order_mode in ('alphabetical_asc', 'alphabetical_desc', 'manual'));

create table public.service_catalog_translations (
  organization_id uuid not null,
  service_id uuid not null,
  locale text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, service_id, locale),
  foreign key (organization_id, service_id)
    references public.services (organization_id, id) on delete cascade,
  constraint service_catalog_translations_locale_check
    check (locale in ('en', 'it', 'es', 'fr', 'de')),
  constraint service_catalog_translations_name_check
    check (length(btrim(name)) between 1 and 160),
  constraint service_catalog_translations_description_check
    check (description is null or length(description) <= 1000)
);

create table public.category_catalog_translations (
  organization_id uuid not null,
  category_key text not null,
  locale text not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, category_key, locale),
  foreign key (organization_id, category_key)
    references public.organization_portal_categories (organization_id, category_key) on delete cascade,
  constraint category_catalog_translations_locale_check
    check (locale in ('en', 'it', 'es', 'fr', 'de')),
  constraint category_catalog_translations_title_check
    check (length(btrim(title)) between 1 and 120)
);

create index service_catalog_translations_locale_idx
  on public.service_catalog_translations (organization_id, locale, service_id);
create index category_catalog_translations_locale_idx
  on public.category_catalog_translations (organization_id, locale, category_key);

alter table public.service_catalog_translations enable row level security;
alter table public.category_catalog_translations enable row level security;

create policy "service_catalog_translations_select_member"
on public.service_catalog_translations for select to authenticated
using (public.is_organization_member(organization_id));
create policy "service_catalog_translations_manage_catalog_manager"
on public.service_catalog_translations for all to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "category_catalog_translations_select_member"
on public.category_catalog_translations for select to authenticated
using (public.is_organization_member(organization_id));
create policy "category_catalog_translations_manage_catalog_manager"
on public.category_catalog_translations for all to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

revoke all on public.service_catalog_translations from public, anon, authenticated;
revoke all on public.category_catalog_translations from public, anon, authenticated;
grant select, insert, update, delete on public.service_catalog_translations to authenticated;
grant select, insert, update, delete on public.category_catalog_translations to authenticated;

create function public.get_catalog_presentation(
  target_locale text,
  target_service_ids uuid[]
)
returns table (
  service_id uuid,
  display_name text,
  display_description text,
  category_title text,
  order_mode text,
  manual_sort_order integer,
  category_sort_order integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  if target_locale not in ('en', 'it', 'es', 'fr', 'de')
    or coalesce(cardinality(target_service_ids), 0) > 500 then
    raise exception 'catalog_presentation_invalid' using errcode = '22023';
  end if;

  select membership.organization_id into org_id
  from public.organization_memberships membership
  join public.organizations organization on organization.id = membership.organization_id
  where membership.profile_id = auth.uid() and membership.is_active
    and organization.status = 'active' and organization.deleted_at is null
  limit 1;

  if org_id is null then
    select access.organization_id into org_id
    from public.customer_portal_access access
    join public.customers customer
      on customer.organization_id = access.organization_id and customer.id = access.customer_id
    where access.user_id = auth.uid() and access.is_active and customer.is_active
    order by access.created_at
    limit 1;
  end if;

  if org_id is null then
    raise exception 'catalog_presentation_denied' using errcode = '42501';
  end if;

  return query
  select
    service.id,
    coalesce(local_service.name, default_service.name, service.name),
    coalesce(local_service.description, default_service.description, service.portal_description, service.description),
    coalesce(local_category.title, default_category.title, category.portal_title,
      initcap(replace(category.category_key, '_', ' '))),
    organization.catalog_order_mode,
    service.portal_sort_order,
    category.portal_sort_order
  from public.services service
  join public.organizations organization on organization.id = service.organization_id
  left join public.organization_portal_categories category
    on category.organization_id = service.organization_id
   and category.category_key = service.portal_category_key
  left join public.service_catalog_translations local_service
    on local_service.organization_id = service.organization_id
   and local_service.service_id = service.id and local_service.locale = target_locale
  left join public.service_catalog_translations default_service
    on default_service.organization_id = service.organization_id
   and default_service.service_id = service.id and default_service.locale = 'en'
  left join public.category_catalog_translations local_category
    on local_category.organization_id = category.organization_id
   and local_category.category_key = category.category_key and local_category.locale = target_locale
  left join public.category_catalog_translations default_category
    on default_category.organization_id = category.organization_id
   and default_category.category_key = category.category_key and default_category.locale = 'en'
  where service.organization_id = org_id and service.id = any(target_service_ids);
end;
$$;

create function public.apply_catalog_import(target_rows jsonb)
returns table (created_count integer, updated_count integer, archived_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  item jsonb;
  resolved_id uuid;
  requested_id uuid;
  requested_code text;
  requested_category text;
  requested_status text;
  requested_mode text;
  locale_key text;
  translation jsonb;
  created_total integer := 0;
  updated_total integer := 0;
  archived_total integer := 0;
begin
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'catalog_import_denied' using errcode = '42501';
  end if;
  if jsonb_typeof(target_rows) <> 'array' or jsonb_array_length(target_rows) > 500 then
    raise exception 'catalog_import_invalid' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(target_rows)
  loop
    requested_id := nullif(item->>'serviceId', '')::uuid;
    requested_code := nullif(btrim(item->>'serviceCode'), '');
    requested_category := nullif(btrim(item->>'categoryKey'), '');
    requested_status := item->>'status';
    requested_mode := item->>'orderMode';
    resolved_id := null;

    if requested_mode not in ('alphabetical_asc', 'alphabetical_desc', 'manual')
      or requested_status not in ('active', 'archived')
      or requested_category is null
      or not exists (select 1 from public.organization_portal_categories category
        where category.organization_id = org_id and category.category_key = requested_category
          and (requested_status = 'archived' or category.is_active))
      or item->>'unitType' not in ('piece', 'weight', 'area', 'cycle', 'service', 'day')
      or coalesce(item->>'manualSortOrder', '') !~ '^\d{1,6}$'
      or (item->>'manualSortOrder')::integer > 100000
      or jsonb_typeof(item->'customerVisible') <> 'boolean'
      or jsonb_typeof(item->'customerOrderable') <> 'boolean'
      or jsonb_typeof(item->'featured') <> 'boolean'
      or length(coalesce(item->>'canonicalName', '')) > 160
      or length(coalesce(item->>'canonicalDescription', '')) > 1000
      or length(coalesce(requested_code, '')) > 80 then
      raise exception 'catalog_import_invalid' using errcode = '22023';
    end if;

    if requested_id is not null then
      select service.id into resolved_id from public.services service
      where service.id = requested_id and service.organization_id = org_id;
      if resolved_id is null then raise exception 'catalog_import_foreign_service' using errcode = '42501'; end if;
    elsif requested_code is not null then
      select service.id into resolved_id from public.services service
      where service.organization_id = org_id and service.code = requested_code;
    end if;

    if resolved_id is null then
      if nullif(btrim(item->>'canonicalName'), '') is null then
        raise exception 'catalog_import_name_required' using errcode = '22023';
      end if;
      insert into public.services (
        organization_id, code, name, description, unit_type, category,
        is_active, portal_category_key, portal_sort_order, portal_visible,
        customer_orderable, portal_featured, created_by, updated_by
      ) values (
        org_id, requested_code, item->>'canonicalName', nullif(item->>'canonicalDescription', ''),
        (item->>'unitType')::public.service_unit_type, requested_category,
        requested_status = 'active', requested_category, (item->>'manualSortOrder')::integer,
        requested_status = 'active' and (item->>'customerVisible')::boolean,
        requested_status = 'active' and (item->>'customerOrderable')::boolean,
        (item->>'featured')::boolean, auth.uid(), auth.uid()
      ) returning id into resolved_id;
      created_total := created_total + 1;
    else
      update public.services service set
        code = coalesce(requested_code, service.code),
        name = coalesce(nullif(item->>'canonicalName', ''), service.name),
        description = coalesce(nullif(item->>'canonicalDescription', ''), service.description),
        unit_type = (item->>'unitType')::public.service_unit_type,
        category = requested_category,
        portal_category_key = requested_category,
        portal_sort_order = (item->>'manualSortOrder')::integer,
        is_active = requested_status = 'active',
        portal_visible = requested_status = 'active' and (item->>'customerVisible')::boolean,
        customer_orderable = requested_status = 'active' and (item->>'customerOrderable')::boolean,
        portal_featured = (item->>'featured')::boolean,
        updated_by = auth.uid()
      where service.organization_id = org_id and service.id = resolved_id;
      updated_total := updated_total + 1;
      if requested_status = 'archived' then archived_total := archived_total + 1; end if;
    end if;

    for locale_key in select unnest(array['en', 'it', 'es', 'fr', 'de'])
    loop
      translation := item->'translations'->locale_key;
      if nullif(btrim(translation->>'name'), '') is not null then
        insert into public.service_catalog_translations (
          organization_id, service_id, locale, name, description
        ) values (
          org_id, resolved_id, locale_key, btrim(translation->>'name'),
          nullif(btrim(translation->>'description'), '')
        ) on conflict (organization_id, service_id, locale) do update set
          name = excluded.name,
          description = coalesce(excluded.description, public.service_catalog_translations.description),
          updated_at = now();
      end if;
      if nullif(btrim(item->'categoryTranslations'->>locale_key), '') is not null then
        insert into public.category_catalog_translations (
          organization_id, category_key, locale, title
        ) values (
          org_id, requested_category, locale_key,
          btrim(item->'categoryTranslations'->>locale_key)
        ) on conflict (organization_id, category_key, locale) do update set
          title = excluded.title, updated_at = now();
      end if;
    end loop;
  end loop;

  if jsonb_array_length(target_rows) > 0 then
    update public.organizations organization set
      catalog_order_mode = (target_rows->0->>'orderMode'), updated_at = now()
    where organization.id = org_id;
  end if;

  return query select created_total, updated_total, archived_total;
end;
$$;

create function public.set_catalog_order_mode(target_mode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
begin
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[])
    or target_mode not in ('alphabetical_asc', 'alphabetical_desc', 'manual') then
    raise exception 'catalog_order_mode_denied' using errcode = '42501';
  end if;
  update public.organizations set catalog_order_mode = target_mode, updated_at = now()
  where id = org_id;
end;
$$;

revoke all on function public.get_catalog_presentation(text, uuid[]) from public, anon, authenticated;
revoke all on function public.apply_catalog_import(jsonb) from public, anon, authenticated;
revoke all on function public.set_catalog_order_mode(text) from public, anon, authenticated;
grant execute on function public.get_catalog_presentation(text, uuid[]) to authenticated;
grant execute on function public.apply_catalog_import(jsonb) to authenticated;
grant execute on function public.set_catalog_order_mode(text) to authenticated;
