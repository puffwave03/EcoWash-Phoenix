-- B1: tenant presentation/configuration only. No issue/payment RPC changes.
begin;

alter table public.organizations add column ticket_footer text
  check (ticket_footer is null or char_length(ticket_footer) <= 4000);
alter table public.organization_billing_settings add column simplified_series text
  check (simplified_series is null or simplified_series ~ '^[A-Z0-9-]{1,12}$'),
  add constraint billing_simplified_series_distinct check (simplified_series is distinct from default_series);

-- Nullable additions deliberately leave historical documents unchanged.
alter table public.invoices add column ticket_footer text;
alter table public.invoice_orders add column ticket_schedule jsonb;

create function public.guard_ticket_series_reservation() returns trigger
language plpgsql security definer set search_path = public as $$
declare reserved text;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text || ':billing-series-type', 0));
  if tg_table_name = 'organization_billing_settings' then
    if new.simplified_series is not null and exists (
      select 1 from public.invoices i where i.organization_id = new.organization_id
        and i.series = new.simplified_series and i.fiscal_document_type <> 'simplificada'
    ) then raise exception 'billing_series_document_type_conflict' using errcode = '22023'; end if;
  else
    select simplified_series into reserved from public.organization_billing_settings where organization_id = new.organization_id;
    if new.series = reserved and new.fiscal_document_type <> 'simplificada' then
      raise exception 'billing_series_document_type_conflict' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
create trigger billing_settings_ticket_series_guard before insert or update of simplified_series, default_series
on public.organization_billing_settings for each row execute function public.guard_ticket_series_reservation();
create trigger invoices_ticket_series_guard before insert or update of series, fiscal_document_type
on public.invoices for each row execute function public.guard_ticket_series_reservation();

create function public.update_current_ticket_settings(target_footer text, target_simplified_series text default null, target_update_series boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare org_id uuid := public.app_current_organization_id();
  selected_series text := nullif(upper(btrim(target_simplified_series)), '');
begin
  if auth.uid() is null or not public.has_organization_role(org_id, array['owner']::public.app_role[]) then
    raise exception 'ticket_settings_not_authorized' using errcode = '42501';
  end if;
  if target_update_series then
    if not public.organization_entitlement_is_enabled(org_id, 'billing.invoicing', now()) then
      raise exception 'billing_entitlement_required' using errcode = '42501';
    end if;
    if selected_series is not null and selected_series !~ '^[A-Z0-9-]{1,12}$' then
      raise exception 'ticket_settings_invalid' using errcode = '22023';
    end if;
    insert into public.organization_billing_settings(organization_id, simplified_series, created_by, updated_by)
    values(org_id, selected_series, auth.uid(), auth.uid())
    on conflict(organization_id) do update set simplified_series = excluded.simplified_series, updated_by = auth.uid();
  else
    -- Footer-only writes neither read nor mutate the Billing row, even when
    -- its configured series is hidden by an expired entitlement/RLS policy.
    if char_length(target_footer) > 4000 then
      raise exception 'ticket_settings_invalid' using errcode = '22023';
    end if;
    update public.organizations set ticket_footer = nullif(btrim(target_footer), '') where id = org_id;
  end if;
end $$;

create function public.snapshot_ticket_presentation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'invoices' then
    if new.fiscal_document_type = 'simplificada' then
      select ticket_footer into new.ticket_footer from public.organizations where id = new.organization_id;
    else new.ticket_footer := null; end if;
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
create trigger invoices_snapshot_ticket before insert on public.invoices
for each row execute function public.snapshot_ticket_presentation();
create trigger invoice_orders_snapshot_ticket before insert on public.invoice_orders
for each row execute function public.snapshot_ticket_presentation();

revoke all on function public.guard_ticket_series_reservation() from public, anon, authenticated;
revoke all on function public.snapshot_ticket_presentation() from public, anon, authenticated;
revoke all on function public.update_current_ticket_settings(text, text, boolean) from public, anon, authenticated;
grant execute on function public.update_current_ticket_settings(text, text, boolean) to authenticated;
commit;
