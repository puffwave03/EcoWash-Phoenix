begin;

create function public.billing_can_read_advance_event_declaration(target_organization_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_organization_id uuid;
begin
  current_organization_id := public.app_current_organization_id();

  return coalesce(
    current_organization_id = target_organization_id
    and public.has_organization_role(
      target_organization_id,
      array['owner', 'manager']::public.app_role[]
    )
    and public.has_organization_entitlement(target_organization_id, 'billing.invoicing'),
    false
  );
end;
$$;

revoke all on function public.billing_can_read_advance_event_declaration(uuid)
  from public, anon, authenticated;
grant execute on function public.billing_can_read_advance_event_declaration(uuid)
  to authenticated;

drop policy billing_advance_event_declarations_select_management
  on public.billing_advance_event_declarations;
create policy billing_advance_event_declarations_select_management
  on public.billing_advance_event_declarations for select to authenticated
  using (public.billing_can_read_advance_event_declaration(organization_id));

commit;
