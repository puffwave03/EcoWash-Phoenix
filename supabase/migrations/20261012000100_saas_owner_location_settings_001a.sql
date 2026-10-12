-- SAAS-OWNER-LOCATION-SETTINGS-001A: Owner-only edits without direct table UPDATE grants.
-- The live staging authenticated role has SELECT but no UPDATE on locations.
-- Keep direct table grants and the existing Manager RLS policy unchanged.
begin;

create function public.update_owner_location_settings(
  target_location_id uuid,
  target_name text,
  target_address_line1 text,
  target_address_line2 text,
  target_city text,
  target_region text,
  target_postal_code text,
  target_country_code text,
  target_phone text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  owner_organization_id uuid;
  normalized_name text := pg_catalog.btrim(target_name);
  normalized_address_line1 text := nullif(pg_catalog.btrim(target_address_line1), '');
  normalized_address_line2 text := nullif(pg_catalog.btrim(target_address_line2), '');
  normalized_city text := nullif(pg_catalog.btrim(target_city), '');
  normalized_region text := nullif(pg_catalog.btrim(target_region), '');
  normalized_postal_code text := nullif(pg_catalog.btrim(target_postal_code), '');
  normalized_country_code text := pg_catalog.upper(nullif(pg_catalog.btrim(target_country_code), ''));
  normalized_phone text := nullif(pg_catalog.btrim(target_phone), '');
  changed_rows integer;
begin
  if caller_id is null then
    return false;
  end if;

  if normalized_name is null or pg_catalog.char_length(normalized_name) not between 1 and 160
    or pg_catalog.char_length(normalized_address_line1) > 320
    or pg_catalog.char_length(normalized_address_line2) > 320
    or pg_catalog.char_length(normalized_city) > 160
    or pg_catalog.char_length(normalized_region) > 160
    or pg_catalog.char_length(normalized_postal_code) > 32
    or pg_catalog.char_length(normalized_phone) > 40
    or (normalized_country_code is not null and normalized_country_code <> all (
      pg_catalog.string_to_array(
        'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW',
        ' '
      )
    )) then
    raise exception 'location_settings_invalid' using errcode = '22023';
  end if;

  -- One query binds the caller, active Owner membership, organization and
  -- location. A foreign or unavailable ID returns the same false result.
  -- Shared locks keep organization and membership eligibility stable until
  -- the subsequent update completes.
  select location.organization_id into owner_organization_id
  from public.locations as location
  join public.organizations as organization on organization.id = location.organization_id
  join public.organization_memberships as membership
    on membership.organization_id = organization.id
   and membership.profile_id = caller_id
  where location.id = target_location_id
    and location.is_active
    and location.deleted_at is null
    and organization.status = 'active'
    and organization.platform_service_status = 'active'
    and organization.deleted_at is null
    and membership.is_active
    and membership.role = 'owner'
  for share of organization, membership;

  if owner_organization_id is null then
    return false;
  end if;

  update public.locations as location
  set name = normalized_name,
      address_line1 = normalized_address_line1,
      address_line2 = normalized_address_line2,
      city = normalized_city,
      region = normalized_region,
      postal_code = normalized_postal_code,
      country_code = normalized_country_code,
      phone = normalized_phone
  where location.id = target_location_id
    and location.organization_id = owner_organization_id
    and location.is_active
    and location.deleted_at is null;

  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;

alter function public.update_owner_location_settings(uuid, text, text, text, text, text, text, text, text) owner to postgres;
revoke all on function public.update_owner_location_settings(uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.update_owner_location_settings(uuid, text, text, text, text, text, text, text, text) to authenticated;

commit;
