-- Restore ordinary Billing + non-fiscal operational documents. Forward only.
-- No historical invoice, payment, attribution, number or tenant config is deleted.
begin;
set local lock_timeout = '5s';

-- Do not silently destroy operational statements if another deployment has used
-- S06 since the read-only inventory. Review/archival is required in that case.
lock table public.billing_postservice_payment_evidence in access exclusive mode;
do $$
begin
  if exists(select 1 from public.billing_postservice_payment_evidence) then
    raise exception 'operational_recovery_s06_evidence_not_empty' using errcode = '55000';
  end if;
end;
$$;

-- RESTRICT is deliberate: unknown dependencies abort the whole transaction.
drop function public.issue_billing_invoice(uuid,date,text,text,boolean) restrict;
drop function public.record_pos_postservice_payment(uuid,numeric,public.payment_method,uuid,text,text,uuid,boolean,text,text,text) restrict;
drop table public.billing_postservice_payment_evidence restrict;
drop function public.protect_billing_postservice_evidence() restrict;
drop function public.declare_billing_advance_event(uuid,uuid,boolean) restrict;
drop function public.issue_billing_advance_invoice(uuid,uuid,text,text,boolean) restrict;
drop function public.issue_billing_final_after_advances(uuid,uuid,date,text,text,boolean) restrict;
drop function public.reserve_billing_simplified_series(text) restrict;
drop function public.create_billing_draft(uuid[],text,numeric,text,public.billing_fiscal_document_type,jsonb) restrict;
drop function public.update_billing_draft(uuid,date,date,text,numeric,text,jsonb) restrict;

-- The internal draft builder is also the ordinary RPC's dependency. Retain it,
-- but close every retired writer (including direct privileged calls), not just
-- the UI. Legacy simplified drafts/documents become read-only. Ordinary issue,
-- cancel, draft edit/delete and existing economic guards remain unchanged.
create function public.protect_retired_billing_workflow()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.fiscal_document_type <> 'ordinary' or new.billing_event_kind <> 'service' then
      raise exception 'billing_document_workflow_retired' using errcode = '55000';
    end if;
    return new;
  end if;
  if old.fiscal_document_type <> 'ordinary' or old.billing_event_kind <> 'service' then
    raise exception 'billing_document_workflow_retired' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and (new.fiscal_document_type <> 'ordinary' or new.billing_event_kind <> 'service') then
    raise exception 'billing_document_workflow_retired' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function public.protect_retired_billing_workflow() from public,anon,authenticated,service_role;
create trigger invoices_retired_workflow_guard
before insert or update or delete on public.invoices
for each row execute function public.protect_retired_billing_workflow();

-- Retain historical enum values, snapshots, series ownership, advance
-- declarations and invoice/payment links. Existing issued documents use them;
-- their RLS, immutability and payment/refund guards must NOT be removed.
commit;
