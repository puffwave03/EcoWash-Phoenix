-- PRINT-001 uses the existing centralized `printing` feature definition.
-- This reference bootstrap is additive and never changes order/payment history.
insert into public.organization_entitlements (organization_id, feature_key, enabled, source)
select organization.id, 'printing', true, 'print_001_reference_bootstrap'
from public.organizations organization
where organization.slug = 'ecowash-la-tejita'
  and organization.deleted_at is null
on conflict (organization_id, feature_key) do nothing;
