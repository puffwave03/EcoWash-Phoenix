-- CATALOG-STRUCTURE-001: additive category lifecycle and safe archival.
-- Category keys remain stable identities. Renames update portal_title only;
-- service/order/invoice identifiers and historical snapshots are untouched.

alter table public.organization_portal_categories
  add column is_active boolean not null default true,
  add constraint organization_portal_categories_inactive_hidden
    check (is_active or not portal_visible);

create index organization_portal_categories_active_order_idx
on public.organization_portal_categories (
  organization_id,
  portal_sort_order,
  category_key
)
where is_active;

create function public.prevent_catalog_category_unsafe_archive()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.is_active and not new.is_active and exists (
    select 1
    from public.services service
    where service.organization_id = old.organization_id
      and service.is_active
      and coalesce(service.portal_category_key, service.category) = old.category_key
  ) then
    raise exception 'catalog_category_has_active_services' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger organization_portal_categories_safe_archive
before update of is_active on public.organization_portal_categories
for each row execute function public.prevent_catalog_category_unsafe_archive();

create function public.archive_catalog_category(target_category_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
begin
  if org_id is null
    or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'catalog_category_archive_denied' using errcode = '42501';
  end if;

  perform 1
  from public.organization_portal_categories category
  where category.organization_id = org_id
    and category.category_key = target_category_key
    and category.is_active
  for update;

  if not found then
    raise exception 'catalog_category_not_found' using errcode = 'P0002';
  end if;

  update public.organization_portal_categories category
  set is_active = false,
      portal_visible = false,
      portal_featured = false
  where category.organization_id = org_id
    and category.category_key = target_category_key;
end;
$$;

revoke all on function public.prevent_catalog_category_unsafe_archive() from public, anon, authenticated;
revoke all on function public.archive_catalog_category(text) from public, anon, authenticated;
grant execute on function public.archive_catalog_category(text) to authenticated;
