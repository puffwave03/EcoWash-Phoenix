-- 001G-B: structural advance/payment links only. No advance or paid-final issuer.
-- Existing 001F payment-history and fiscal-history blocks remain unchanged.
begin;
set local lock_timeout = '5s';
lock table public.invoices, public.invoice_orders, public.payments in share row exclusive mode;

-- These keys permit tenant-and-order-bound references without changing POS rows.
alter table public.payments
  add constraint payments_organization_order_id_unique unique (organization_id, order_id, id);

alter table public.invoice_orders
  add column billing_link_role text not null default 'final',
  add column final_invoice_id uuid,
  add constraint invoice_orders_billing_link_role_valid check (
    billing_link_role in ('advance', 'final')
    and (billing_link_role = 'advance' or final_invoice_id is null)
    and (final_invoice_id is null or final_invoice_id <> invoice_id)
  ),
  add constraint invoice_orders_organization_invoice_order_unique
    unique (organization_id, invoice_id, order_id),
  add constraint invoice_orders_organization_invoice_order_role_unique
    unique (organization_id, invoice_id, order_id, billing_link_role),
  add constraint invoice_orders_final_same_order foreign key
    (organization_id, final_invoice_id, order_id)
    references public.invoice_orders (organization_id, invoice_id, order_id)
    on delete restrict;

-- All old links have the default role 'final', so the old uniqueness rule is
-- identical for historical and ordinary invoices. Only future advances may
-- coexist with the one active final document for the same order.
drop index public.invoice_orders_one_active_invoice_per_order;
create unique index invoice_orders_one_active_final_invoice_per_order
  on public.invoice_orders (order_id)
  where is_active and billing_link_role = 'final';

create function public.protect_billing_invoice_order_role()
returns trigger language plpgsql set search_path = public as $$
declare
  advance_status public.billing_invoice_document_status;
  final_status public.billing_invoice_document_status;
begin
  if tg_op = 'INSERT' then
    if new.final_invoice_id is not null then
      raise exception 'billing_final_link_immutable' using errcode = '55000';
    end if;
    return new;
  end if;
  if new.billing_link_role is distinct from old.billing_link_role then
    raise exception 'billing_invoice_order_role_immutable' using errcode = '55000';
  end if;
  if new.final_invoice_id is distinct from old.final_invoice_id then
    if old.final_invoice_id is not null or new.final_invoice_id is null
      or old.billing_link_role <> 'advance' then
      raise exception 'billing_final_link_immutable' using errcode = '55000';
    end if;
    select i.document_status into advance_status from public.invoices i
      where i.organization_id = old.organization_id and i.id = old.invoice_id;
    select i.document_status into final_status
    from public.invoice_orders l join public.invoices i
      on i.organization_id = l.organization_id and i.id = l.invoice_id
    where l.organization_id = new.organization_id and l.order_id = new.order_id
      and l.invoice_id = new.final_invoice_id and l.billing_link_role = 'final';
    if advance_status is distinct from 'issued'::public.billing_invoice_document_status
      or final_status is distinct from 'issued'::public.billing_invoice_document_status then
      raise exception 'billing_final_link_invalid' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;
create trigger invoice_orders_billing_role_guard
  before insert or update on public.invoice_orders for each row
  execute function public.protect_billing_invoice_order_role();
revoke all on function public.protect_billing_invoice_order_role()
  from public, anon, authenticated;

-- The currently callable ordinary and simplified issuers create only final
-- links. An advance-role draft, even if inserted by privileged SQL, cannot
-- be issued through either existing RPC.
create function public.block_billing_advance_issuance()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.document_status = 'issued' and old.document_status = 'draft'
    and exists (select 1 from public.invoice_orders l
      where l.organization_id = new.organization_id and l.invoice_id = new.id
        and l.billing_link_role = 'advance') then
    raise exception 'billing_advance_issuance_not_enabled' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger invoices_block_advance_issuance
  before update of document_status on public.invoices for each row
  execute function public.block_billing_advance_issuance();
revoke all on function public.block_billing_advance_issuance()
  from public, anon, authenticated;

-- One confirmed payment belongs to at most one fiscal document. Partial
-- attribution of a single payment is explicitly unsupported in this phase.
-- A later corrective workflow may link a separate refund movement; it must
-- never erase this original attribution.
create table public.billing_invoice_payment_links (
  organization_id uuid not null,
  order_id uuid not null,
  invoice_id uuid not null,
  billing_link_role text not null,
  payment_id uuid not null,
  attributed_amount numeric(12,2) not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, payment_id),
  constraint billing_payment_link_amount_positive check (attributed_amount > 0),
  constraint billing_payment_link_invoice_order_role foreign key
    (organization_id, invoice_id, order_id, billing_link_role)
    references public.invoice_orders
      (organization_id, invoice_id, order_id, billing_link_role) on delete restrict,
  constraint billing_payment_link_payment_order foreign key
    (organization_id, order_id, payment_id)
    references public.payments (organization_id, order_id, id) on delete restrict
);
create index billing_invoice_payment_links_invoice_idx
  on public.billing_invoice_payment_links (organization_id, invoice_id, order_id);
create unique index billing_invoice_payment_links_one_advance_payment_idx
  on public.billing_invoice_payment_links (organization_id, invoice_id)
  where billing_link_role = 'advance';

create function public.protect_billing_invoice_payment_link()
returns trigger language plpgsql set search_path = public as $$
declare
  source_payment public.payments%rowtype;
  target_invoice public.invoices%rowtype;
  target_active boolean;
  already_attributed numeric(12,2);
begin
  if tg_op <> 'INSERT' then
    raise exception 'billing_payment_link_immutable' using errcode = '55000';
  end if;
  if current_setting('app.billing_advance_link_mutation', true) is distinct from 'on'
    or new.organization_id is distinct from public.app_current_organization_id()
    or not public.has_organization_role(new.organization_id,
      array['owner','manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(
      new.organization_id, 'billing.invoicing', now()) then
    raise exception 'billing_payment_link_not_authorized' using errcode = '42501';
  end if;
  select * into source_payment from public.payments p
    where p.organization_id = new.organization_id and p.order_id = new.order_id
      and p.id = new.payment_id for share;
  if source_payment.id is null or source_payment.status <> 'confirmed'
    or source_payment.channel <> 'pos' or source_payment.pos_session_id is null
    or new.attributed_amount is distinct from source_payment.amount then
    raise exception 'billing_payment_link_invalid_payment' using errcode = '22023';
  end if;
  select i.* into target_invoice from public.invoices i
    where i.organization_id = new.organization_id and i.id = new.invoice_id
    for update;
  select l.is_active into target_active from public.invoice_orders l
    where l.organization_id = new.organization_id and l.invoice_id = new.invoice_id
      and l.order_id = new.order_id and l.billing_link_role = new.billing_link_role;
  if target_invoice.id is null or target_invoice.document_status = 'cancelled'
    or target_active is distinct from true then
    raise exception 'billing_payment_link_invalid_invoice' using errcode = '22023';
  end if;
  select coalesce(sum(l.attributed_amount),0) into already_attributed
    from public.billing_invoice_payment_links l
    where l.organization_id = new.organization_id and l.invoice_id = new.invoice_id;
  if already_attributed + new.attributed_amount > target_invoice.total then
    raise exception 'billing_payment_link_exceeds_invoice' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger billing_invoice_payment_links_guard
  before insert or update or delete on public.billing_invoice_payment_links
  for each row execute function public.protect_billing_invoice_payment_link();
revoke all on function public.protect_billing_invoice_payment_link()
  from public, anon, authenticated;

alter table public.billing_invoice_payment_links enable row level security;
create policy billing_invoice_payment_links_select_management
  on public.billing_invoice_payment_links for select to authenticated
  using (public.has_organization_role(organization_id,
    array['owner','manager']::public.app_role[])
    and public.has_organization_entitlement(organization_id, 'billing.invoicing'));
revoke all on table public.billing_invoice_payment_links
  from public, anon, authenticated;
grant select on table public.billing_invoice_payment_links to authenticated;

commit;
