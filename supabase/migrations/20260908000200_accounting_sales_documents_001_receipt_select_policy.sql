-- ACCOUNTING-SALES-DOCUMENTS-001: keep receipt reads behind the public entitlement boundary.

drop policy if exists operational_receipts_select_print_access on public.operational_receipts;

create policy operational_receipts_select_print_access on public.operational_receipts
for select to authenticated using (
  public.is_organization_member(organization_id)
  and public.has_operational_capability(organization_id, 'pos'::public.operational_capability)
  and public.has_organization_entitlement(organization_id, 'printing')
);
