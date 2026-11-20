-- Customer print presentation only; no POS, issue RPC or numbering changes.
begin;
alter table public.organizations add column ticket_special_message text
  check (ticket_special_message is null or char_length(ticket_special_message) <= 4000);
alter table public.invoices
  add column ticket_special_message text,
  add column ticket_presentation_version smallint check (ticket_presentation_version is null or ticket_presentation_version = 2),
  add column ticket_timezone text;

create function public.update_current_ticket_special_message(target_message text)
returns void language plpgsql security definer set search_path = public as $$
declare org_id uuid := public.app_current_organization_id();
begin
  if auth.uid() is null or not public.has_organization_role(org_id, array['owner']::public.app_role[]) then
    raise exception 'ticket_settings_not_authorized' using errcode = '42501';
  end if;
  if char_length(target_message) > 4000 then raise exception 'ticket_settings_invalid' using errcode = '22023'; end if;
  -- No Billing entitlement or hidden-series access needed for presentation.
  update public.organizations set ticket_special_message = nullif(btrim(target_message), '') where id = org_id;
end $$;
revoke all on function public.update_current_ticket_special_message(text) from public, anon, authenticated;
grant execute on function public.update_current_ticket_special_message(text) to authenticated;

create or replace function public.snapshot_ticket_presentation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'invoices' then
    if new.fiscal_document_type = 'simplificada' then
      select ticket_footer, ticket_special_message, timezone
      into new.ticket_footer, new.ticket_special_message, new.ticket_timezone
      from public.organizations where id = new.organization_id;
      new.ticket_presentation_version := 2;
    else
      new.ticket_footer := null; new.ticket_special_message := null;
      new.ticket_timezone := null; new.ticket_presentation_version := null;
    end if;
  else
    new.ticket_schedule := null;
    if exists(select 1 from public.invoices where id = new.invoice_id and organization_id = new.organization_id
      and fiscal_document_type = 'simplificada' and document_status = 'draft') then
      select jsonb_build_object('readyAt', o.due_at,
        'pickupAt', (select p.scheduled_at from public.pickups p where p.organization_id = new.organization_id
          and p.order_id = o.id and p.status in ('scheduled','in_progress','completed') order by p.created_at desc limit 1),
        'deliveryAt', (select d.scheduled_at from public.deliveries d where d.organization_id = new.organization_id
          and d.order_id = o.id and d.status in ('scheduled','in_progress','completed') order by d.created_at desc limit 1))
      into new.ticket_schedule from public.orders o where o.organization_id = new.organization_id and o.id = new.order_id;
    end if;
  end if;
  return new;
end $$;

create function public.protect_ticket_presentation() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'invoice_orders' then
    if new.ticket_schedule is distinct from old.ticket_schedule and exists (
      select 1 from public.invoices where id = old.invoice_id and organization_id = old.organization_id and document_status <> 'draft'
    ) then raise exception 'billing_issued_snapshot_immutable' using errcode = '55000'; end if;
    return new;
  end if;
  if old.document_status <> 'draft' and (
    new.ticket_footer is distinct from old.ticket_footer
    or new.ticket_special_message is distinct from old.ticket_special_message
    or new.ticket_presentation_version is distinct from old.ticket_presentation_version
    or new.ticket_timezone is distinct from old.ticket_timezone
    or new.issuer_logo_path is distinct from old.issuer_logo_path
  ) then raise exception 'billing_issued_snapshot_immutable' using errcode = '55000'; end if;
  return new;
end $$;
create trigger invoices_ticket_presentation_immutable before update on public.invoices
for each row execute function public.protect_ticket_presentation();
create trigger invoice_orders_ticket_presentation_immutable before update of ticket_schedule on public.invoice_orders
for each row execute function public.protect_ticket_presentation();
revoke all on function public.protect_ticket_presentation() from public, anon, authenticated;

-- Uploads already use unique paths and upsert:false. Retain original logo
-- objects (no duplicate assets), including across concurrent snapshot creation.
-- Restrictive policies add no permissions and leave other media unchanged.
create policy brand_logo_history_delete_guard on storage.objects as restrictive
for delete to authenticated using (bucket_id <> 'brand-media' or split_part(name, '/', 2) <> 'logo');
create policy brand_logo_history_update_guard on storage.objects as restrictive
for update to authenticated
using (bucket_id <> 'brand-media' or split_part(name, '/', 2) <> 'logo')
with check (bucket_id <> 'brand-media' or split_part(name, '/', 2) <> 'logo');
commit;
