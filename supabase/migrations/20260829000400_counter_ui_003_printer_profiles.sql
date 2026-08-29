-- COUNTER-UI-003: tenant/location-scoped, provider-neutral printer profiles.
-- Additive only: PRINT-001 renderers and historical order/payment data are unchanged.

create table public.printer_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid not null,
  display_name text not null,
  purpose text not null,
  enabled boolean not null default true,
  connection_mode text not null default 'browser',
  paper_format text not null,
  device_identifier text,
  is_default boolean not null default false,
  label_width_mm numeric(6, 2),
  label_height_mm numeric(6, 2),
  label_orientation text,
  label_copies smallint,
  label_margin_mm numeric(5, 2),
  label_gap_mm numeric(5, 2),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint printer_profiles_location_same_organization foreign key (organization_id, location_id)
    references public.locations (organization_id, id) on delete cascade,
  constraint printer_profiles_display_name check (length(btrim(display_name)) between 1 and 120),
  constraint printer_profiles_purpose check (purpose in ('receipt', 'label', 'ticket')),
  constraint printer_profiles_connection_mode check (connection_mode in ('browser', 'network', 'local_bridge', 'vendor_adapter')),
  constraint printer_profiles_paper_format check (paper_format in ('receipt_58mm', 'receipt_80mm', 'browser_pdf', 'label_custom', 'ticket_a4')),
  constraint printer_profiles_receipt_format check (purpose <> 'receipt' or paper_format in ('receipt_58mm', 'receipt_80mm', 'browser_pdf')),
  constraint printer_profiles_label_format check (purpose <> 'label' or paper_format in ('label_custom', 'browser_pdf')),
  constraint printer_profiles_ticket_format check (purpose <> 'ticket' or paper_format in ('ticket_a4', 'browser_pdf')),
  constraint printer_profiles_device_identifier_length check (device_identifier is null or length(device_identifier) <= 240),
  constraint printer_profiles_default_enabled check (not is_default or enabled),
  constraint printer_profiles_label_width check (label_width_mm is null or label_width_mm between 10 and 200),
  constraint printer_profiles_label_height check (label_height_mm is null or label_height_mm between 10 and 300),
  constraint printer_profiles_label_orientation check (label_orientation is null or label_orientation in ('portrait', 'landscape')),
  constraint printer_profiles_label_copies check (label_copies is null or label_copies between 1 and 20),
  constraint printer_profiles_label_margin check (label_margin_mm is null or label_margin_mm between 0 and 20),
  constraint printer_profiles_label_gap check (label_gap_mm is null or label_gap_mm between 0 and 20),
  constraint printer_profiles_label_dimensions check (
    purpose <> 'label'
    or paper_format = 'browser_pdf'
    or (label_width_mm is not null and label_height_mm is not null and label_orientation is not null and label_copies is not null)
  )
);

create index printer_profiles_organization_location_idx
on public.printer_profiles (organization_id, location_id, purpose, enabled);

create unique index printer_profiles_one_default_per_scope_idx
on public.printer_profiles (organization_id, location_id, purpose)
where is_default;

create trigger printer_profiles_set_updated_at
before update on public.printer_profiles
for each row execute function public.set_updated_at();

alter table public.printer_profiles enable row level security;

create policy printer_profiles_select_scoped
on public.printer_profiles
for select to authenticated
using (
  public.is_organization_member(organization_id)
  and public.has_organization_entitlement(organization_id, 'printing')
);

create function public.save_printer_profile(
  target_profile_id uuid,
  target_location_id uuid,
  target_display_name text,
  target_purpose text,
  target_enabled boolean,
  target_connection_mode text,
  target_paper_format text,
  target_device_identifier text,
  target_is_default boolean,
  target_label_width_mm numeric,
  target_label_height_mm numeric,
  target_label_orientation text,
  target_label_copies integer,
  target_label_margin_mm numeric,
  target_label_gap_mm numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  saved_id uuid;
begin
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id, 'printing', now()) then
    raise exception 'printer_profile_access_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.locations location
    where location.organization_id = org_id
      and location.id = target_location_id
      and location.is_active
      and location.deleted_at is null
  ) then
    raise exception 'printer_profile_location_invalid' using errcode = '22023';
  end if;

  if target_is_default and not target_enabled then
    raise exception 'printer_profile_default_disabled' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    org_id::text || ':' || target_location_id::text || ':' || coalesce(target_purpose, ''),
    0
  ));

  if target_is_default then
    update public.printer_profiles profile
    set is_default = false,
        updated_by = auth.uid()
    where profile.organization_id = org_id
      and profile.location_id = target_location_id
      and profile.purpose = target_purpose
      and profile.is_default
      and (target_profile_id is null or profile.id <> target_profile_id);
  end if;

  if target_profile_id is null then
    insert into public.printer_profiles (
      organization_id, location_id, display_name, purpose, enabled,
      connection_mode, paper_format, device_identifier, is_default,
      label_width_mm, label_height_mm, label_orientation, label_copies,
      label_margin_mm, label_gap_mm, created_by, updated_by
    ) values (
      org_id, target_location_id, btrim(target_display_name), target_purpose, target_enabled,
      target_connection_mode, target_paper_format, nullif(btrim(target_device_identifier), ''), target_is_default,
      target_label_width_mm, target_label_height_mm, target_label_orientation, target_label_copies,
      target_label_margin_mm, target_label_gap_mm, auth.uid(), auth.uid()
    ) returning id into saved_id;
  else
    update public.printer_profiles profile
    set location_id = target_location_id,
        display_name = btrim(target_display_name),
        purpose = target_purpose,
        enabled = target_enabled,
        connection_mode = target_connection_mode,
        paper_format = target_paper_format,
        device_identifier = nullif(btrim(target_device_identifier), ''),
        is_default = target_is_default,
        label_width_mm = target_label_width_mm,
        label_height_mm = target_label_height_mm,
        label_orientation = target_label_orientation,
        label_copies = target_label_copies,
        label_margin_mm = target_label_margin_mm,
        label_gap_mm = target_label_gap_mm,
        updated_by = auth.uid()
    where profile.organization_id = org_id
      and profile.id = target_profile_id
    returning profile.id into saved_id;

    if saved_id is null then
      raise exception 'printer_profile_not_found' using errcode = 'P0002';
    end if;
  end if;

  return saved_id;
end;
$$;

revoke all on public.printer_profiles from public, anon, authenticated;
grant select on public.printer_profiles to authenticated;

revoke all on function public.save_printer_profile(uuid, uuid, text, text, boolean, text, text, text, boolean, numeric, numeric, text, integer, numeric, numeric)
from public, anon, authenticated;
grant execute on function public.save_printer_profile(uuid, uuid, text, text, boolean, text, text, text, boolean, numeric, numeric, text, integer, numeric, numeric)
to authenticated;
