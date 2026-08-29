-- BARCODE-001 uses canonical order and order-item UUIDs with the existing barcode feature.
-- The reference bootstrap is additive and creates no parallel barcode identity or lifecycle data.
insert into public.organization_entitlements (organization_id, feature_key, enabled, source)
select organization.id, 'barcode', true, 'barcode_001_reference_bootstrap'
from public.organizations organization
where organization.slug = 'ecowash-la-tejita'
  and organization.deleted_at is null
on conflict (organization_id, feature_key) do nothing;
