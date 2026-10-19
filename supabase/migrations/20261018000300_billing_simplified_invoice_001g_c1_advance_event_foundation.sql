-- 001G-C1: an explicit pre-service fiscal declaration for a confirmed POS payment.
-- The POS ledger remains authoritative. This is a historical declaration, not
-- an invoice, payment, tax allocation or permission to issue an advance invoice.
begin;

create table public.billing_advance_event_declarations (
  organization_id uuid not null,
  order_id uuid not null,
  payment_id uuid not null,
  payment_amount numeric(12,2) not null,
  payment_paid_at timestamptz not null,
  service_not_performed_confirmed boolean not null,
  declared_by uuid not null references public.profiles (id) on delete restrict,
  declared_at timestamptz not null,
  primary key (organization_id, payment_id),
  constraint billing_advance_event_pre_service_confirmed check (service_not_performed_confirmed),
  constraint billing_advance_event_amount_positive check (payment_amount > 0),
  constraint billing_advance_event_payment_same_order foreign key
    (organization_id, order_id, payment_id)
    references public.payments (organization_id, order_id, id) on delete restrict
);

-- A future issuer can reach its canonical Billing document through the 001G-B
-- payment link. No second invoice identity or fiscal number is stored here.
create function public.protect_billing_advance_event_declaration()
returns trigger language plpgsql set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  source_payment public.payments%rowtype;
begin
  if tg_op <> 'INSERT' then
    raise exception 'billing_advance_event_immutable' using errcode = '55000';
  end if;
  -- A fresh post-lock snapshot is required when a POS refund races declaration.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'billing_advance_event_read_committed_required' using errcode = '25000';
  end if;
  if current_setting('app.billing_advance_event_mutation', true) is distinct from 'on'
    or actor_id is null
    or new.organization_id is distinct from public.app_current_organization_id()
    or not public.has_organization_role(new.organization_id,
      array['owner','manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(
      new.organization_id, 'billing.invoicing', now()) then
    raise exception 'billing_advance_event_not_authorized' using errcode = '42501';
  end if;
  if new.service_not_performed_confirmed is distinct from true then
    raise exception 'billing_advance_event_confirmation_required' using errcode = '22023';
  end if;
  -- Match the refund writer's payment-first order. Taking the order first
  -- deadlocks when a refund holds this payment and its FK needs the order.
  select * into source_payment from public.payments p
    where p.organization_id = new.organization_id and p.order_id = new.order_id
      and p.id = new.payment_id for share;
  -- The POS payment writer locks this parent order until commit. Under READ
  -- COMMITTED the later refund lookup sees a refund committed while we waited.
  perform 1 from public.orders o
    where o.organization_id = new.organization_id and o.id = new.order_id
      and o.is_active and o.production_status <> 'cancelled'
    for update;
  if not found then
    raise exception 'billing_advance_event_invalid_order' using errcode = '22023';
  end if;
  if source_payment.id is null or source_payment.status <> 'confirmed'
    or source_payment.channel <> 'pos' or source_payment.pos_session_id is null
    or source_payment.refunded_from_payment_id is not null
    or source_payment.paid_at > clock_timestamp()
    or exists (select 1 from public.payments r
      where r.organization_id = new.organization_id
        and r.refunded_from_payment_id = new.payment_id and r.status = 'refunded') then
    raise exception 'billing_advance_event_invalid_payment' using errcode = '22023';
  end if;
  if exists (select 1 from public.invoice_orders l
    join public.invoices i on i.organization_id = l.organization_id and i.id = l.invoice_id
    where l.organization_id = new.organization_id and l.order_id = new.order_id
      and i.document_status in ('issued', 'cancelled')) then
    raise exception 'billing_advance_event_fiscal_history_review_required' using errcode = '55000';
  end if;
  new.payment_amount := source_payment.amount;
  new.payment_paid_at := source_payment.paid_at;
  new.declared_by := actor_id;
  new.declared_at := clock_timestamp();
  return new;
end;
$$;
create trigger billing_advance_event_declarations_guard
  before insert or update or delete on public.billing_advance_event_declarations
  for each row execute function public.protect_billing_advance_event_declaration();
revoke all on function public.protect_billing_advance_event_declaration()
  from public, anon, authenticated;

alter table public.billing_advance_event_declarations enable row level security;
create policy billing_advance_event_declarations_select_management
  on public.billing_advance_event_declarations for select to authenticated
  using (organization_id = public.app_current_organization_id()
    and public.has_organization_role(organization_id,
      array['owner','manager']::public.app_role[])
    and public.has_organization_entitlement(organization_id, 'billing.invoicing'));
revoke all on table public.billing_advance_event_declarations
  from public, anon, authenticated;
grant select on table public.billing_advance_event_declarations to authenticated;

commit;
