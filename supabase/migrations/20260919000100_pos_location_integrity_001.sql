-- POS-LOCATION-INTEGRITY-001 requires every new POS session to reference one
-- active location owned by the authenticated organization. Existing sessions
-- remain unchanged.
create or replace function public.open_pos_session(
  target_location_id uuid,
  target_opening_cash numeric,
  target_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  result_id uuid;
begin
  perform public.require_pos_access(org_id);
  if target_opening_cash is null or target_opening_cash < 0 then
    raise exception 'pos_opening_cash_invalid' using errcode = '22023';
  end if;
  if target_location_id is null or not exists (
    select 1 from public.locations location
    where location.id = target_location_id
      and location.organization_id = org_id
      and location.is_active
      and location.deleted_at is null
  ) then
    raise exception 'pos_location_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(org_id::text || ':pos-current-till', 0));
  if exists (
    select 1 from public.pos_sessions session
    where session.organization_id = org_id and session.status = 'open'
  ) then
    raise exception 'pos_session_already_open' using errcode = '23505';
  end if;

  perform set_config('app.pos_001_mutation', 'on', true);
  insert into public.pos_sessions (organization_id, location_id, opened_by, opening_cash, notes)
  values (org_id, target_location_id, auth.uid(), round(target_opening_cash, 2), nullif(btrim(target_notes), ''))
  returning id into result_id;
  return result_id;
end;
$$;

revoke all on function public.open_pos_session(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.open_pos_session(uuid, numeric, text) to authenticated;
