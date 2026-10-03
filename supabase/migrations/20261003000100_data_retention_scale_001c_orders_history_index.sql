create index orders_org_created_id_idx
on public.orders (
  organization_id,
  created_at desc,
  id desc
);
