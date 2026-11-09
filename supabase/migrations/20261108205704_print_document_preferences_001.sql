-- PRINT-DOCUMENT-PREFERENCES-001 / Phase A. LOCAL REVIEW ONLY; not applied.
-- No profile rows are migrated or changed; existing profile purposes/RPC remain intact.
begin;

-- Allows a tenant-qualified FK without weakening the existing profile primary key.
create unique index printer_profiles_organization_id_id_idx
  on public.printer_profiles (organization_id, id);

create table public.document_print_preferences (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid not null,
  document_type text not null check (document_type in ('customer-copy')),
  paper_format text not null check (paper_format in ('a4', '58mm', '80mm')),
  printer_profile_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_print_preferences_scope unique (organization_id, location_id, document_type),
  constraint document_print_preferences_location_same_organization foreign key (organization_id, location_id)
    references public.locations (organization_id, id) on delete cascade,
  constraint document_print_preferences_profile_same_organization foreign key (organization_id, printer_profile_id)
    references public.printer_profiles (organization_id, id) on delete set null (printer_profile_id)
);

create index document_print_preferences_profile_idx
  on public.document_print_preferences (organization_id, printer_profile_id)
  where printer_profile_id is not null;

create trigger document_print_preferences_set_updated_at
before update on public.document_print_preferences
for each row execute function public.set_updated_at();

alter table public.document_print_preferences enable row level security;
create policy document_print_preferences_select_scoped
on public.document_print_preferences for select to authenticated
using (
  public.is_organization_member(organization_id)
  and public.has_organization_entitlement(organization_id, 'printing')
);
revoke all on public.document_print_preferences from public, anon, authenticated;
grant select on public.document_print_preferences to authenticated;

-- Internal pure helper: the same compatibility matrix as the browser settings UI.
create function public.customer_copy_profile_is_compatible(document_format text, profile_purpose text, profile_format text)
returns boolean language sql immutable set search_path = ''
as $$
  select coalesce(
    (document_format = 'a4' and profile_purpose in ('receipt', 'ticket') and profile_format in ('browser_pdf', 'ticket_a4'))
    or (document_format = '58mm' and profile_purpose = 'receipt' and profile_format = 'receipt_58mm')
    or (document_format = '80mm' and profile_purpose = 'receipt' and profile_format = 'receipt_80mm'), false);
$$;
revoke all on function public.customer_copy_profile_is_compatible(text, text, text) from public, anon, authenticated;

-- Definer matches the existing printer-settings write boundary: authenticated
-- Owner/Manager, server-derived organization, printing entitlement, active site.
-- No direct client DML; neither organization nor actor is accepted from the client.
create function public.save_document_print_preference(
  target_location_id uuid,
  target_document_type text,
  target_paper_format text,
  target_printer_profile_id uuid default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  org_id uuid := public.app_current_organization_id();
  selected_profile public.printer_profiles%rowtype;
  saved_id uuid;
begin
  if auth.uid() is null or org_id is null
    or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id, 'printing', now()) then
    raise exception 'document_print_preference_access_denied' using errcode = '42501';
  end if;

  if target_document_type is distinct from 'customer-copy'
    or target_paper_format is null or target_paper_format not in ('a4', '58mm', '80mm')
    or not exists (
      select 1 from public.locations location
      where location.organization_id = org_id and location.id = target_location_id
        and location.is_active and location.deleted_at is null
    ) then
    raise exception 'document_print_preference_invalid' using errcode = '22023';
  end if;

  if target_printer_profile_id is not null then
    -- Lock the profile BEFORE the preference. Profile edits take the same order.
    -- A concurrent disable/move/format change cannot leave an invalid association.
    select * into selected_profile from public.printer_profiles profile
      where profile.organization_id = org_id and profile.id = target_printer_profile_id
      for share;
    if not found or not selected_profile.enabled
      or selected_profile.location_id <> target_location_id
      or not public.customer_copy_profile_is_compatible(target_paper_format, selected_profile.purpose, selected_profile.paper_format) then
      raise exception 'document_print_preference_profile_invalid' using errcode = '22023';
    end if;
  end if;

  insert into public.document_print_preferences (
    organization_id, location_id, document_type, paper_format, printer_profile_id, created_by, updated_by
  ) values (
    org_id, target_location_id, target_document_type, target_paper_format, target_printer_profile_id, auth.uid(), auth.uid()
  ) on conflict (organization_id, location_id, document_type) do update
    set paper_format = excluded.paper_format, printer_profile_id = excluded.printer_profile_id,
        updated_by = auth.uid()
  returning id into saved_id;
  return saved_id;
end;
$$;
revoke all on function public.save_document_print_preference(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.save_document_print_preference(uuid, text, text, uuid) to authenticated;

-- Existing profile editing stays possible: detach only the new optional link.
-- Keep the saved paper format, so browser printing remains available.
create function public.detach_incompatible_document_print_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.document_print_preferences preference
    set printer_profile_id = null, updated_by = auth.uid()
    where preference.organization_id = old.organization_id and preference.printer_profile_id = old.id
      and (not new.enabled or preference.organization_id <> new.organization_id
        or preference.location_id <> new.location_id
        or not public.customer_copy_profile_is_compatible(preference.paper_format, new.purpose, new.paper_format));
  return new;
end;
$$;
revoke all on function public.detach_incompatible_document_print_profile() from public, anon, authenticated;
create trigger printer_profiles_detach_incompatible_document_preference
after update of organization_id, location_id, enabled, purpose, paper_format on public.printer_profiles
for each row
when (old.organization_id is distinct from new.organization_id
  or old.location_id is distinct from new.location_id or old.enabled is distinct from new.enabled
  or old.purpose is distinct from new.purpose or old.paper_format is distinct from new.paper_format)
execute function public.detach_incompatible_document_print_profile();

commit;
