create function public.list_daily_close_history_scopes()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare org_id uuid;
begin
  org_id := public.app_current_organization_id();
  if org_id is null
    or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'daily_close_history_not_authorized' using errcode = '42501';
  end if;

  return (
    with persisted_locations as (
      select distinct d.location_id
      from public.daily_closes d
      where d.organization_id = org_id and d.location_id is not null
    )
    select jsonb_build_object(
      'hasOrganizationScope', exists (
        select 1 from public.daily_closes d
        where d.organization_id = org_id and d.location_id is null
      ),
      'scopes', coalesce((
        select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) order by l.name, l.id)
        from persisted_locations p
        join public.locations l on l.organization_id = org_id and l.id = p.location_id
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.list_daily_close_history_scopes() from public, anon, authenticated;
grant execute on function public.list_daily_close_history_scopes() to authenticated;

create index daily_closes_org_history_keyset_idx
  on public.daily_closes (organization_id, business_date desc, closed_at desc, id desc);

create index daily_closes_org_location_history_keyset_idx
  on public.daily_closes (organization_id, location_id, business_date desc, closed_at desc, id desc);
