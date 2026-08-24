-- CATALOG-001: minimal catalogue metadata, Portal-safe catalogue RPC and the
-- approved unambiguous EcoWash La Tejita price-list rows.
--
-- This migration intentionally does not delete services, prices or order data.
-- Historical order_items remain immutable snapshots of their original names,
-- units and prices. Ambiguous source rows are documented and excluded below.

alter table public.services
  add column portal_visible boolean not null default true,
  add column portal_featured boolean not null default false,
  add column portal_image_path text;

alter table public.service_prices
  add column is_from boolean not null default false;

alter table public.order_items
  drop constraint order_items_piece_quantity_integer;

alter table public.order_items
  add constraint order_items_discrete_quantity_integer check (
    unit_type not in ('piece', 'cycle', 'service', 'day')
    or quantity = trunc(quantity)
  );

create index services_portal_catalog_idx
on public.services (organization_id, portal_visible, portal_featured, category, sort_order)
where is_active;

drop function public.list_customer_portal_services();

create function public.list_customer_portal_services()
returns table (
  id uuid,
  name text,
  description text,
  unit_type public.service_unit_type,
  category text,
  amount numeric,
  currency text,
  price_is_from boolean,
  portal_featured boolean,
  portal_image_path text
)
language sql
stable
security definer
set search_path = public
as $$
  with portal_context as (
    select
      access.organization_id,
      organization.default_currency::text as currency,
      organization.timezone,
      (
        select location.id
        from public.locations location
        where location.organization_id = access.organization_id
          and location.is_active
          and location.deleted_at is null
        order by location.created_at, location.id
        limit 1
      ) as location_id
    from public.customer_portal_access access
    join public.customers customer
      on customer.organization_id = access.organization_id
     and customer.id = access.customer_id
    join public.organizations organization
      on organization.id = access.organization_id
    where access.user_id = auth.uid()
      and access.is_active
      and customer.is_active
      and organization.status = 'active'
      and organization.deleted_at is null
    order by access.created_at
    limit 1
  )
  select
    service.id,
    service.name,
    service.description,
    service.unit_type,
    service.category,
    current_price.amount,
    current_price.currency,
    current_price.is_from,
    service.portal_featured,
    service.portal_image_path
  from portal_context context
  join public.services service
    on service.organization_id = context.organization_id
   and service.is_active
   and service.portal_visible
   and (service.location_id is null or service.location_id = context.location_id)
  join lateral (
    select
      price.amount,
      price.currency,
      price.is_from
    from public.service_prices price
    where price.organization_id = context.organization_id
      and price.service_id = service.id
      and price.is_active
      and price.currency = context.currency
      and price.valid_from <= (now() at time zone context.timezone)::date
      and (price.valid_to is null or price.valid_to >= (now() at time zone context.timezone)::date)
      and (price.location_id is null or price.location_id = context.location_id)
    order by (price.location_id is not null) desc, price.valid_from desc, price.created_at desc
    limit 1
  ) current_price on true
  order by service.sort_order, service.name, service.id;
$$;

revoke all on function public.list_customer_portal_services() from public, anon, authenticated;
grant execute on function public.list_customer_portal_services() to authenticated;

-- Protected staging fixtures and the legacy provisional weight service remain
-- available internally and keep all history, but are no longer customer-facing.
update public.services service
set
  portal_visible = false,
  portal_featured = false,
  updated_at = now()
from public.organizations organization
where organization.id = service.organization_id
  and organization.slug = 'ecowash-la-tejita'
  and (
    service.code in ('001', 'SMOKE-WASH-DRY')
    or service.name = 'Solo stiro'
  );

-- The following source rows are deliberately NOT seeded pending Product Owner
-- clarification: 013, 015, 016, 048, 070, 077, 078, 081, 137, 212-223,
-- 237, 238, 241 and 242.

do $$
declare
  target_organization_id uuid;
begin
  select organization.id
  into target_organization_id
  from public.organizations organization
  where organization.slug = 'ecowash-la-tejita'
    and organization.status = 'active'
    and organization.deleted_at is null;

  if target_organization_id is null then
    raise notice 'CATALOG-001 seed skipped: EcoWash La Tejita tenant not present';
    return;
  end if;

  create temporary table catalog_001_seed (
    source_order integer primary key,
    code text not null,
    name text not null,
    category text not null,
    unit_type public.service_unit_type not null,
    amount numeric(12,2) not null,
    price_is_from boolean not null,
    portal_featured boolean not null,
    portal_image_path text
  ) on commit drop;

  insert into catalog_001_seed values
    (1, 'ECW-PL-001', 'Alfombra persia m2/', 'rugs_bulky', 'area', 17, false, true, null),
    (2, 'ECW-PL-002', 'Alfombras m2/Carpets/tappet', 'rugs_bulky', 'area', 12, false, true, null),
    (3, 'ECW-PL-003', 'Almohada pluma/Pillow/piuma', 'home_textiles', 'piece', 13, false, true, '/images/home/industries/vacation-rental.webp'),
    (4, 'ECW-PL-004', 'Almohada/pillow/cuscino', 'home_textiles', 'piece', 5, false, true, '/images/home/industries/vacation-rental.webp'),
    (5, 'ECW-PL-005', 'BAJERA CUÑA BEBE', 'home_textiles', 'piece', 3, false, true, '/images/home/industries/vacation-rental.webp'),
    (6, 'ECW-PL-006', 'COJIN DE AMACA', 'home_textiles', 'piece', 18, false, true, '/images/home/industries/vacation-rental.webp'),
    (7, 'ECW-PL-007', 'COJIN DE PLUMA NORMAL', 'home_textiles', 'piece', 14.5, false, true, '/images/home/industries/vacation-rental.webp'),
    (8, 'ECW-PL-008', 'COJIN GRANDE SILLON', 'home_textiles', 'piece', 23, false, true, '/images/home/industries/vacation-rental.webp'),
    (9, 'ECW-PL-009', 'COJIN PLUMAS QUADRADO', 'home_textiles', 'piece', 9, false, true, '/images/home/industries/vacation-rental.webp'),
    (10, 'ECW-PL-010', 'COJIN PLUMAS XXL', 'home_textiles', 'piece', 29, false, true, '/images/home/industries/vacation-rental.webp'),
    (11, 'ECW-PL-011', 'COLCHA PEQ./COPRILET.INDIV.', 'home_textiles', 'piece', 13.5, false, true, '/images/home/industries/vacation-rental.webp'),
    (12, 'ECW-PL-012', 'COLCHA/COPRILET. MATRIMONIO', 'home_textiles', 'piece', 15, false, true, '/images/home/industries/vacation-rental.webp'),
    (14, 'ECW-PL-014', 'Cortina m2/Tende grossa m2', 'home_textiles', 'area', 5.5, false, true, '/images/home/industries/vacation-rental.webp'),
    (17, 'ECW-PL-017', 'Edredon cuña/Trapunta culla', 'home_textiles', 'piece', 10.5, false, true, '/images/home/industries/vacation-rental.webp'),
    (18, 'ECW-PL-018', 'Edredon Matrim/Duvet large', 'home_textiles', 'piece', 16, false, true, '/images/home/industries/vacation-rental.webp'),
    (19, 'ECW-PL-019', 'Edredon peq/Duvet indiv/', 'home_textiles', 'piece', 14, false, true, '/images/home/industries/vacation-rental.webp'),
    (20, 'ECW-PL-020', 'Edredon pluma Ind/Trap.pium', 'home_textiles', 'piece', 22.5, false, true, '/images/home/industries/vacation-rental.webp'),
    (21, 'ECW-PL-021', 'Edredon Pluma matr/ Feather', 'home_textiles', 'piece', 28.5, false, true, '/images/home/industries/vacation-rental.webp'),
    (22, 'ECW-PL-022', 'Funda Edredon 1p', 'home_textiles', 'piece', 9, false, true, '/images/home/industries/vacation-rental.webp'),
    (23, 'ECW-PL-023', 'Funda Edredon 1p.solo plan.', 'home_textiles', 'piece', 5.5, false, true, '/images/home/industries/vacation-rental.webp'),
    (24, 'ECW-PL-024', 'Funda Edredon 2p', 'home_textiles', 'piece', 11, false, true, '/images/home/industries/vacation-rental.webp'),
    (25, 'ECW-PL-025', 'Funda Edredon 2p solo plaan', 'home_textiles', 'piece', 7.5, false, true, '/images/home/industries/vacation-rental.webp'),
    (26, 'ECW-PL-026', 'Funda sofa´1p./sofa cover 1', 'home_textiles', 'piece', 14, false, true, '/images/home/industries/vacation-rental.webp'),
    (27, 'ECW-PL-027', 'Funda sofa2p/sofa cover 2p', 'home_textiles', 'piece', 21.5, false, true, '/images/home/industries/vacation-rental.webp'),
    (28, 'ECW-PL-028', 'Funda sofa3p/sofa cover 3p', 'home_textiles', 'piece', 30, false, true, '/images/home/industries/vacation-rental.webp'),
    (29, 'ECW-PL-029', 'Manta indiv/FINE', 'home_textiles', 'piece', 12, false, true, '/images/home/industries/vacation-rental.webp'),
    (30, 'ECW-PL-030', 'Manta indiv/normale', 'home_textiles', 'piece', 13.5, false, true, '/images/home/industries/vacation-rental.webp'),
    (31, 'ECW-PL-031', 'Manta matrimonio/FINE', 'home_textiles', 'piece', 14, false, true, '/images/home/industries/vacation-rental.webp'),
    (32, 'ECW-PL-032', 'Manta matrimonio/normale', 'home_textiles', 'piece', 15.5, false, true, '/images/home/industries/vacation-rental.webp'),
    (33, 'ECW-PL-033', 'Manteles cocina peque.', 'home_textiles', 'piece', 5, false, true, '/images/home/industries/vacation-rental.webp'),
    (34, 'ECW-PL-034', 'Manteles extragrande', 'home_textiles', 'piece', 17, false, true, '/images/home/industries/vacation-rental.webp'),
    (35, 'ECW-PL-035', 'Manteles grande', 'home_textiles', 'piece', 13, false, true, '/images/home/industries/vacation-rental.webp'),
    (36, 'ECW-PL-036', 'Manteles mediano', 'home_textiles', 'piece', 7, false, true, '/images/home/industries/vacation-rental.webp'),
    (37, 'ECW-PL-037', 'MOPA/STRACCIO PAVIM. PICC.', 'home_textiles', 'piece', 2.5, false, true, '/images/home/industries/vacation-rental.webp'),
    (38, 'ECW-PL-038', 'MOPA/STRACCIO PAVIM.GRAN.', 'home_textiles', 'piece', 3.5, false, true, '/images/home/industries/vacation-rental.webp'),
    (39, 'ECW-PL-039', 'Toalla lavabo', 'home_textiles', 'piece', 3, false, true, '/images/home/industries/vacation-rental.webp'),
    (40, 'ECW-PL-040', 'TOALLAS BIDE', 'home_textiles', 'piece', 2, false, true, '/images/home/industries/vacation-rental.webp'),
    (41, 'ECW-PL-041', 'TOALLAS DUCHA/PLAYA', 'home_textiles', 'piece', 4, false, true, '/images/home/industries/vacation-rental.webp'),
    (42, 'ECW-PL-042', 'TOALLAS MEDIANA /MANI', 'home_textiles', 'piece', 3, false, true, '/images/home/industries/vacation-rental.webp'),
    (43, 'ECW-PL-043', 'Lavadora 10kg.', 'self_service', 'cycle', 5, false, true, '/images/home/services/industrial-laundry.webp'),
    (44, 'ECW-PL-044', 'Lavadora 13 kg', 'self_service', 'cycle', 6, false, true, '/images/home/services/industrial-laundry.webp'),
    (45, 'ECW-PL-045', 'Lavadora 21 kg', 'self_service', 'cycle', 8, false, true, '/images/home/services/industrial-laundry.webp'),
    (46, 'ECW-PL-046', 'Secadora 13 kg', 'self_service', 'cycle', 2, false, true, '/images/home/services/industrial-laundry.webp'),
    (47, 'ECW-PL-047', 'Secadora 17 kg', 'self_service', 'cycle', 2, false, true, '/images/home/services/industrial-laundry.webp'),
    (49, 'ECW-PL-049', 'Bolso + de 15 kg', 'laundry_by_weight', 'weight', 3.5, false, true, '/images/home/hero/folded-green-textiles.webp'),
    (50, 'ECW-PL-050', 'Bolso hasta  5kg di ropa', 'laundry_by_weight', 'service', 17.5, false, true, '/images/home/hero/folded-green-textiles.webp'),
    (51, 'ECW-PL-051', 'Bolso hasta 10Kg ropa', 'laundry_by_weight', 'service', 35, false, true, '/images/home/hero/folded-green-textiles.webp'),
    (52, 'ECW-PL-052', 'Bolso hasta 15Kg ropa', 'laundry_by_weight', 'service', 45, false, true, '/images/home/hero/folded-green-textiles.webp'),
    (53, 'ECW-PL-053', 'Kg. extra', 'laundry_by_weight', 'weight', 3.5, false, true, '/images/home/hero/folded-green-textiles.webp'),
    (54, 'ECW-PL-054', 'Alba', 'special_services', 'piece', 6, false, false, null),
    (55, 'ECW-PL-055', 'Casulla', 'special_services', 'piece', 10.5, false, false, null),
    (56, 'ECW-PL-056', 'Estola', 'special_services', 'piece', 4, false, false, null),
    (57, 'ECW-PL-057', 'Mantel extragrande', 'special_services', 'piece', 17, false, false, null),
    (58, 'ECW-PL-058', 'Mantel Grande', 'special_services', 'piece', 13, false, false, null),
    (59, 'ECW-PL-059', 'Mantel Mediano', 'special_services', 'piece', 7, false, false, null),
    (60, 'ECW-PL-060', 'Mantel Pequeño', 'special_services', 'piece', 4, false, false, null),
    (61, 'ECW-PL-061', 'Servilleta/TOVAGLIOLO', 'special_services', 'piece', 2, false, false, null),
    (62, 'ECW-PL-062', 'Abrigo/Coat/', 'leather', 'piece', 60, false, false, '/images/home/services/dry-cleaning.webp'),
    (63, 'ECW-PL-063', 'bolso piel/silk bag/borsa p', 'leather', 'piece', 30, false, false, '/images/home/services/dry-cleaning.webp'),
    (64, 'ECW-PL-064', 'camisa piel/silk skirt/', 'leather', 'piece', 25, false, false, '/images/home/services/dry-cleaning.webp'),
    (65, 'ECW-PL-065', 'chaleco/gile/weste', 'leather', 'piece', 30, false, false, '/images/home/services/dry-cleaning.webp'),
    (66, 'ECW-PL-066', 'chaqueta/jacket/giubotto', 'leather', 'piece', 40, false, false, '/images/home/services/dry-cleaning.webp'),
    (67, 'ECW-PL-067', 'chaqueton piel/shotting j.', 'leather', 'piece', 50, false, false, '/images/home/services/dry-cleaning.webp'),
    (68, 'ECW-PL-068', 'Falda piel/silk skirt/gonna', 'leather', 'piece', 30, false, false, '/images/home/services/dry-cleaning.webp'),
    (69, 'ECW-PL-069', 'pantalon piel/silk pants', 'leather', 'piece', 30, false, false, '/images/home/services/dry-cleaning.webp'),
    (71, 'ECW-PL-071', 'Bata de trabajo/GIACHETTA', 'professional_services', 'piece', 6, false, false, '/images/home/industries/professional-laundry.webp'),
    (72, 'ECW-PL-072', 'Chaleco reflejante', 'professional_services', 'piece', 3, false, false, '/images/home/industries/professional-laundry.webp'),
    (73, 'ECW-PL-073', 'CHAQUETON FRIO NEVERA', 'professional_services', 'piece', 12, false, false, '/images/home/industries/professional-laundry.webp'),
    (74, 'ECW-PL-074', 'Cojin Sillas Restaurante', 'professional_services', 'piece', 1.5, false, false, '/images/home/industries/professional-laundry.webp'),
    (75, 'ECW-PL-075', 'Delantal Cocinero/GHEMBRIUL', 'professional_services', 'piece', 3.5, false, false, '/images/home/industries/professional-laundry.webp'),
    (76, 'ECW-PL-076', 'Dia extra de Almacenamiento', 'professional_services', 'day', 1, false, false, '/images/home/industries/professional-laundry.webp'),
    (79, 'ECW-PL-079', 'Manteleria de blanquear', 'professional_services', 'piece', 4, false, false, '/images/home/industries/professional-laundry.webp'),
    (80, 'ECW-PL-080', 'Pantalon Cocinero', 'professional_services', 'piece', 4.5, false, false, '/images/home/industries/professional-laundry.webp'),
    (82, 'ECW-PL-082', 'Serv. Recogida y entrega', 'professional_services', 'service', 5, false, false, '/images/home/industries/professional-laundry.webp'),
    (83, 'ECW-PL-083', 'Servilleta y Paño cocina', 'professional_services', 'piece', 1, false, false, '/images/home/industries/professional-laundry.webp'),
    (84, 'ECW-PL-084', 'Abrigo largo solo planchar', 'ironing', 'piece', 9.5, false, true, '/images/home/services/ironing-finishing.webp'),
    (85, 'ECW-PL-085', 'Abrigo solo planchar', 'ironing', 'piece', 7, false, true, '/images/home/services/ironing-finishing.webp'),
    (86, 'ECW-PL-086', 'ACCAPPATOIO/ALBRNOZ', 'ironing', 'piece', 5.5, false, true, '/images/home/services/ironing-finishing.webp'),
    (87, 'ECW-PL-087', 'BUFANDA', 'ironing', 'piece', 3, false, true, '/images/home/services/ironing-finishing.webp'),
    (88, 'ECW-PL-088', 'CAMISA PARTICULAR', 'ironing', 'piece', 4.5, false, true, '/images/home/services/ironing-finishing.webp'),
    (89, 'ECW-PL-089', 'Camisa solo plancha', 'ironing', 'piece', 3, false, true, '/images/home/services/ironing-finishing.webp'),
    (90, 'ECW-PL-090', 'CAN CAN NOVIA/SOTOV.PARTI.', 'ironing', 'piece', 20, false, true, '/images/home/services/ironing-finishing.webp'),
    (91, 'ECW-PL-091', 'CHALECO/GILE', 'ironing', 'piece', 4.5, false, true, '/images/home/services/ironing-finishing.webp'),
    (92, 'ECW-PL-092', 'CHANDAL/TUTA SPORT SOLO P.', 'ironing', 'piece', 6.5, false, true, '/images/home/services/ironing-finishing.webp'),
    (93, 'ECW-PL-093', 'CHAQUETA AMERICANA', 'ironing', 'piece', 4.5, false, true, '/images/home/services/ironing-finishing.webp'),
    (94, 'ECW-PL-094', 'CHAQUETA LINO/SEDA', 'ironing', 'piece', 6, false, true, '/images/home/services/ironing-finishing.webp'),
    (95, 'ECW-PL-095', 'CHAQUETA PAÑO/GIUB.PANNO', 'ironing', 'piece', 6, false, true, '/images/home/services/ironing-finishing.webp'),
    (96, 'ECW-PL-096', 'CHAQUTA NIÑO', 'ironing', 'piece', 4.5, false, true, '/images/home/services/ironing-finishing.webp'),
    (97, 'ECW-PL-097', 'CORBATA SEDA', 'ironing', 'piece', 2.5, false, true, '/images/home/services/ironing-finishing.webp'),
    (98, 'ECW-PL-098', 'CORBATTA', 'ironing', 'piece', 2, false, true, '/images/home/services/ironing-finishing.webp'),
    (99, 'ECW-PL-099', 'DELANTAR/GREMBIULE', 'ironing', 'piece', 3, false, true, '/images/home/services/ironing-finishing.webp'),
    (100, 'ECW-PL-100', 'FALDA CORTA LINO SEDA', 'ironing', 'piece', 6.5, false, true, '/images/home/services/ironing-finishing.webp'),
    (101, 'ECW-PL-101', 'FALDA CORTA planchar', 'ironing', 'piece', 4, false, true, '/images/home/services/ironing-finishing.webp'),
    (102, 'ECW-PL-102', 'FALDA LARGA LINO/SEDA', 'ironing', 'piece', 8.5, false, true, '/images/home/services/ironing-finishing.webp'),
    (103, 'ECW-PL-103', 'FALDA LARGA/LUNGA', 'ironing', 'piece', 6, false, true, '/images/home/services/ironing-finishing.webp'),
    (104, 'ECW-PL-104', 'FALDA PIEGHE/PARTICULAR', 'ironing', 'piece', 9.5, false, true, '/images/home/services/ironing-finishing.webp'),
    (105, 'ECW-PL-105', 'MAGLIA SOLO P.', 'ironing', 'piece', 2.5, false, true, '/images/home/services/ironing-finishing.webp'),
    (106, 'ECW-PL-106', 'Pantalon solo planchar', 'ironing', 'piece', 4, false, true, '/images/home/services/ironing-finishing.webp'),
    (107, 'ECW-PL-107', 'Polo solo planchar', 'ironing', 'piece', 3, false, true, '/images/home/services/ironing-finishing.webp'),
    (108, 'ECW-PL-108', 'Vestido corto solo p.', 'ironing', 'piece', 4.5, false, true, '/images/home/services/ironing-finishing.webp'),
    (109, 'ECW-PL-109', 'Vestido Largo solo p.', 'ironing', 'piece', 5.5, false, true, '/images/home/services/ironing-finishing.webp'),
    (110, 'ECW-PL-110', 'Conjunto Indiv. solo Planch', 'bed_linen', 'piece', 7.5, false, true, '/images/home/hero/folded-white-linen.webp'),
    (111, 'ECW-PL-111', 'Conjunto Individ. Lav+Pla', 'bed_linen', 'piece', 9, false, true, '/images/home/hero/folded-white-linen.webp'),
    (112, 'ECW-PL-112', 'Conjunto Matrim. solo Planc', 'bed_linen', 'piece', 9.5, false, true, '/images/home/hero/folded-white-linen.webp'),
    (113, 'ECW-PL-113', 'Conjunto Matrimonio Lav+Pla', 'bed_linen', 'piece', 11.5, false, true, '/images/home/hero/folded-white-linen.webp'),
    (114, 'ECW-PL-114', 'cubre almohada L+P', 'bed_linen', 'piece', 2.5, false, true, '/images/home/hero/folded-white-linen.webp'),
    (115, 'ECW-PL-115', 'Cubre almohada solo plan.', 'bed_linen', 'piece', 1.5, false, true, '/images/home/hero/folded-white-linen.webp'),
    (116, 'ECW-PL-116', 'Cubre colch./Copri mat.1PZ', 'bed_linen', 'piece', 7.5, false, true, '/images/home/hero/folded-white-linen.webp'),
    (117, 'ECW-PL-117', 'cubre colch.2p/Copri mater.', 'bed_linen', 'piece', 9.5, false, true, '/images/home/hero/folded-white-linen.webp'),
    (118, 'ECW-PL-118', 'Cubre Colchon Acolchado Ind', 'bed_linen', 'piece', 20.5, false, true, '/images/home/hero/folded-white-linen.webp'),
    (119, 'ECW-PL-119', 'Cubre Colchon acolchado Mat', 'bed_linen', 'piece', 25.5, false, true, '/images/home/hero/folded-white-linen.webp'),
    (120, 'ECW-PL-120', 'Cubre colchon acolchado xxl', 'bed_linen', 'piece', 30, false, true, '/images/home/hero/folded-white-linen.webp'),
    (121, 'ECW-PL-121', 'FORRO/FEDERA', 'bed_linen', 'piece', 2, false, true, '/images/home/hero/folded-white-linen.webp'),
    (122, 'ECW-PL-122', 'FORRO/FEDERA SOLO PLA.', 'bed_linen', 'piece', 1, false, true, '/images/home/hero/folded-white-linen.webp'),
    (123, 'ECW-PL-123', 'Juego cuña', 'bed_linen', 'piece', 8, false, true, '/images/home/hero/folded-white-linen.webp'),
    (124, 'ECW-PL-124', 'Juego cuña solo plan.', 'bed_linen', 'piece', 4.5, false, true, '/images/home/hero/folded-white-linen.webp'),
    (125, 'ECW-PL-125', 'Juego Toalla GR+MED+PEC', 'bed_linen', 'piece', 9, false, true, '/images/home/hero/folded-white-linen.webp'),
    (126, 'ECW-PL-126', 'Lavado y secado ropa al kg', 'bed_linen', 'weight', 1.5, false, true, '/images/home/hero/folded-white-linen.webp'),
    (127, 'ECW-PL-127', 'Sabana Indiv.solo Planchar', 'bed_linen', 'piece', 2.5, false, true, '/images/home/hero/folded-white-linen.webp'),
    (128, 'ECW-PL-128', 'Sabana Individual Lav+plan', 'bed_linen', 'piece', 4, false, true, '/images/home/hero/folded-white-linen.webp'),
    (129, 'ECW-PL-129', 'Sabana Matr. solo planchar', 'bed_linen', 'piece', 3, false, true, '/images/home/hero/folded-white-linen.webp'),
    (130, 'ECW-PL-130', 'Sabana Matrimonio Lav+Plan', 'bed_linen', 'piece', 6, false, true, '/images/home/hero/folded-white-linen.webp'),
    (131, 'ECW-PL-131', 'Desteñir prenda', 'special_services', 'piece', 15, false, false, null),
    (132, 'ECW-PL-132', 'TEÑIR CAMISA A PARTIR', 'special_services', 'piece', 14.5, true, false, null),
    (133, 'ECW-PL-133', 'TEÑIR PANTALON A PARTIR.', 'special_services', 'piece', 18, true, false, null),
    (134, 'ECW-PL-134', 'ABRIGO /CORTO', 'dry_cleaning', 'piece', 15, false, true, '/images/home/services/dry-cleaning.webp'),
    (135, 'ECW-PL-135', 'ABRIGO LARGO', 'dry_cleaning', 'piece', 19.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (136, 'ECW-PL-136', 'ACCAPPATOIO/ALBORNOZ', 'dry_cleaning', 'piece', 8.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (138, 'ECW-PL-138', 'BABERO/BIB/BAVAGLINO', 'dry_cleaning', 'piece', 1.7, false, true, '/images/home/services/dry-cleaning.webp'),
    (139, 'ECW-PL-139', 'BERMUDA', 'dry_cleaning', 'piece', 5, false, true, '/images/home/services/dry-cleaning.webp'),
    (140, 'ECW-PL-140', 'BLUSA/CAMICETTA', 'dry_cleaning', 'piece', 6.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (141, 'ECW-PL-141', 'BLUSA/CAMICETTA SETA/PIZZO', 'dry_cleaning', 'piece', 9.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (142, 'ECW-PL-142', 'BOLSO DE NYLON', 'dry_cleaning', 'piece', 9, false, true, '/images/home/services/dry-cleaning.webp'),
    (143, 'ECW-PL-143', 'BRAGA/MUTANDE', 'dry_cleaning', 'piece', 4, false, true, '/images/home/services/dry-cleaning.webp'),
    (144, 'ECW-PL-144', 'BUFANDA/FULAR', 'dry_cleaning', 'piece', 5.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (145, 'ECW-PL-145', 'CAMISA HOMBRE/SHIRT', 'dry_cleaning', 'piece', 3.9, false, true, '/images/home/services/dry-cleaning.webp'),
    (146, 'ECW-PL-146', 'CAMISA LINO/LINEN SHIRT', 'dry_cleaning', 'piece', 5.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (147, 'ECW-PL-147', 'CAMISA SEDA/SILK SHIRT/', 'dry_cleaning', 'piece', 5.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (148, 'ECW-PL-148', 'CAMISA SPORT/MAGLIETTA', 'dry_cleaning', 'piece', 3.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (149, 'ECW-PL-149', 'CAMISETA NIÑO/ BAMBINO', 'dry_cleaning', 'piece', 3.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (150, 'ECW-PL-150', 'CAN CAN NOVIA O SOTT.PARTIC', 'dry_cleaning', 'piece', 30, false, true, '/images/home/services/dry-cleaning.webp'),
    (151, 'ECW-PL-151', 'CAZADORA FINA / GILET', 'dry_cleaning', 'piece', 8.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (152, 'ECW-PL-152', 'CHALECO LINO/LINO GILET', 'dry_cleaning', 'piece', 8, false, true, '/images/home/services/dry-cleaning.webp'),
    (153, 'ECW-PL-153', 'CHANDAL/TUTA SPORT', 'dry_cleaning', 'piece', 9.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (154, 'ECW-PL-154', 'CHANDAL/TUTA SPORT PARTIC.', 'dry_cleaning', 'piece', 11.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (155, 'ECW-PL-155', 'CHAQUETA FINTA PIEL/PELLE', 'dry_cleaning', 'piece', 12, false, true, '/images/home/services/dry-cleaning.webp'),
    (156, 'ECW-PL-156', 'CHAQUETA LINO/LINE JACKET', 'dry_cleaning', 'piece', 9.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (157, 'ECW-PL-157', 'CHAQUETA NIÑO/CHILD JACKET', 'dry_cleaning', 'piece', 6.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (158, 'ECW-PL-158', 'CHAQUETA SEDA/SILK JACKET/', 'dry_cleaning', 'piece', 9.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (159, 'ECW-PL-159', 'CHAQUETA VAQUERA/JEANS JACK', 'dry_cleaning', 'piece', 7.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (160, 'ECW-PL-160', 'CHAQUETA/AMERICANA/JACKET/', 'dry_cleaning', 'piece', 7, false, true, '/images/home/services/dry-cleaning.webp'),
    (161, 'ECW-PL-161', 'CHAQUETON FINTA PIEL NIÑO', 'dry_cleaning', 'piece', 12, false, true, '/images/home/services/dry-cleaning.webp'),
    (162, 'ECW-PL-162', 'CHAQUETON PLUMA 3/4/GIUBBOT', 'dry_cleaning', 'piece', 14, false, true, '/images/home/services/dry-cleaning.webp'),
    (163, 'ECW-PL-163', 'CHAQUETON PLUMA CAPPOTTO', 'dry_cleaning', 'piece', 21.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (164, 'ECW-PL-164', 'CHAQUETON/GIACCONE 3/4', 'dry_cleaning', 'piece', 11.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (165, 'ECW-PL-165', 'CHAQUETON/GIUBB.FINTA PIEL', 'dry_cleaning', 'piece', 18, false, true, '/images/home/services/dry-cleaning.webp'),
    (166, 'ECW-PL-166', 'CHAQUTA PAÑO/GIUBB. PANNO', 'dry_cleaning', 'piece', 9.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (167, 'ECW-PL-167', 'CORBATA SEDA/SILK NEKTIE', 'dry_cleaning', 'piece', 5.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (168, 'ECW-PL-168', 'CORBATTA/NECKTIE', 'dry_cleaning', 'piece', 4, false, true, '/images/home/services/dry-cleaning.webp'),
    (169, 'ECW-PL-169', 'CORPIÑO FIESTA', 'dry_cleaning', 'piece', 8, false, true, '/images/home/services/dry-cleaning.webp'),
    (170, 'ECW-PL-170', 'DELANTAR/GREMBIULE CUCINA', 'dry_cleaning', 'piece', 5, false, true, '/images/home/services/dry-cleaning.webp'),
    (171, 'ECW-PL-171', 'FALDA CORTA/Gonna', 'dry_cleaning', 'piece', 6, false, true, '/images/home/services/dry-cleaning.webp'),
    (172, 'ECW-PL-172', 'FALDA CORTA/PIEGHE/PARTICO.', 'dry_cleaning', 'piece', 7.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (173, 'ECW-PL-173', 'FALDA LARGA LINO/SETA', 'dry_cleaning', 'piece', 12.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (174, 'ECW-PL-174', 'FALDA LARGA PLISADA/', 'dry_cleaning', 'piece', 18.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (175, 'ECW-PL-175', 'FALDA LARGA/GONNA LUNGA', 'dry_cleaning', 'piece', 9.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (176, 'ECW-PL-176', 'GORRO', 'dry_cleaning', 'piece', 10, false, true, '/images/home/services/dry-cleaning.webp'),
    (177, 'ECW-PL-177', 'JERSEY FINO/MAGLIONCINO', 'dry_cleaning', 'piece', 6.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (178, 'ECW-PL-178', 'JERSEY GRUESO/MAGLIONE', 'dry_cleaning', 'piece', 9.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (179, 'ECW-PL-179', 'JERSEY LARGO/MAGLIONE LUNGO', 'dry_cleaning', 'piece', 10.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (180, 'ECW-PL-180', 'KIMONO KARATE 2pz', 'dry_cleaning', 'piece', 18, false, true, '/images/home/services/dry-cleaning.webp'),
    (181, 'ECW-PL-181', 'MONO', 'dry_cleaning', 'piece', 12.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (182, 'ECW-PL-182', 'MONO SEDA ECC./SALOPETTE', 'dry_cleaning', 'piece', 16.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (183, 'ECW-PL-183', 'PAJARITA/PAPILLON', 'dry_cleaning', 'piece', 3, false, true, '/images/home/services/dry-cleaning.webp'),
    (184, 'ECW-PL-184', 'PANTALONE CORTO/SHORT PANTS', 'dry_cleaning', 'piece', 4.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (185, 'ECW-PL-185', 'PANTALONES SEDA/SETA', 'dry_cleaning', 'piece', 8, false, true, '/images/home/services/dry-cleaning.webp'),
    (186, 'ECW-PL-186', 'PANTALONES VAQUERO/JEANS', 'dry_cleaning', 'piece', 5, false, true, '/images/home/services/dry-cleaning.webp'),
    (187, 'ECW-PL-187', 'PANTALONS NIÑO/CHILD PANTS', 'dry_cleaning', 'piece', 4.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (188, 'ECW-PL-188', 'PANTALONS/PANTS', 'dry_cleaning', 'piece', 5, false, true, '/images/home/services/dry-cleaning.webp'),
    (189, 'ECW-PL-189', 'POLO MANGA LARGA/POLO SHIRT', 'dry_cleaning', 'piece', 3.9, false, true, '/images/home/services/dry-cleaning.webp'),
    (190, 'ECW-PL-190', 'POLO/POLO SHIRT', 'dry_cleaning', 'piece', 3.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (191, 'ECW-PL-191', 'REBECA/CARDIGAN', 'dry_cleaning', 'piece', 5.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (192, 'ECW-PL-192', 'SUJECTADOR/REGGISENO', 'dry_cleaning', 'piece', 2, false, true, '/images/home/services/dry-cleaning.webp'),
    (193, 'ECW-PL-193', 'Suplemento Blanquear prenda', 'dry_cleaning', 'piece', 5, false, true, '/images/home/services/dry-cleaning.webp'),
    (194, 'ECW-PL-194', 'Toga larga/AVVOCAT./LAUREA', 'dry_cleaning', 'piece', 20.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (195, 'ECW-PL-195', 'TOP', 'dry_cleaning', 'piece', 4.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (196, 'ECW-PL-196', 'TRAJE COMUNION', 'dry_cleaning', 'piece', 18, false, true, '/images/home/services/dry-cleaning.webp'),
    (197, 'ECW-PL-197', 'TRAJE SEDA/COMPLETO', 'dry_cleaning', 'piece', 16, false, true, '/images/home/services/dry-cleaning.webp'),
    (198, 'ECW-PL-198', 'TRAJE/COMPLETO', 'dry_cleaning', 'piece', 12, false, true, '/images/home/services/dry-cleaning.webp'),
    (199, 'ECW-PL-199', 'VELO NOVIA LARGO', 'dry_cleaning', 'piece', 25, false, true, '/images/home/services/dry-cleaning.webp'),
    (200, 'ECW-PL-200', 'VELO NOVIA PEQUEÑO', 'dry_cleaning', 'piece', 15, false, true, '/images/home/services/dry-cleaning.webp'),
    (201, 'ECW-PL-201', 'VEST.FIESTA LARGO/LONG PART', 'dry_cleaning', 'piece', 17, false, true, '/images/home/services/dry-cleaning.webp'),
    (202, 'ECW-PL-202', 'VESTIDO COMUNIONE NIÑA', 'dry_cleaning', 'piece', 18.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (203, 'ECW-PL-203', 'VESTIDO CORTO/SHORT DRESS', 'dry_cleaning', 'piece', 9, false, true, '/images/home/services/dry-cleaning.webp'),
    (204, 'ECW-PL-204', 'VESTIDO FIESTA CORTO', 'dry_cleaning', 'piece', 13, false, true, '/images/home/services/dry-cleaning.webp'),
    (205, 'ECW-PL-205', 'VESTIDO FIESTA Niña/o', 'dry_cleaning', 'piece', 8.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (206, 'ECW-PL-206', 'VESTIDO LARGO/LONG DRESS', 'dry_cleaning', 'piece', 12.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (207, 'ECW-PL-207', 'VESTIDO NIÑA', 'dry_cleaning', 'piece', 6.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (208, 'ECW-PL-208', 'VESTIDO SEDA', 'dry_cleaning', 'piece', 15.5, false, true, '/images/home/services/dry-cleaning.webp'),
    (209, 'ECW-PL-209', 'VESTITO NOVIA COLA LARGA', 'dry_cleaning', 'piece', 80, false, true, '/images/home/services/dry-cleaning.webp'),
    (210, 'ECW-PL-210', 'VESTITO NOVIA COLA MEDIA', 'dry_cleaning', 'piece', 70, false, true, '/images/home/services/dry-cleaning.webp'),
    (211, 'ECW-PL-211', 'VESTODO NOVIA CORTO', 'dry_cleaning', 'piece', 50, false, true, '/images/home/services/dry-cleaning.webp'),
    (224, 'ECW-PL-224', 'Calcetin mago', 'traditional_ceremonial', 'piece', 2.5, false, false, null),
    (225, 'ECW-PL-225', 'Camisa de maga/camicia', 'traditional_ceremonial', 'piece', 9, false, false, null),
    (226, 'ECW-PL-226', 'CAMISA MAGA SOLO PLAN.', 'traditional_ceremonial', 'piece', 6, false, false, null),
    (227, 'ECW-PL-227', 'CAMISA NIÑO DE MAGO', 'traditional_ceremonial', 'piece', 5, false, false, null),
    (228, 'ECW-PL-228', 'Capa/MANTELLA', 'traditional_ceremonial', 'piece', 18.5, false, false, null),
    (229, 'ECW-PL-229', 'CAPA/MANTELLA SOLO P.', 'traditional_ceremonial', 'piece', 10.5, false, false, null),
    (230, 'ECW-PL-230', 'Chaleco de maga/Gilet', 'traditional_ceremonial', 'piece', 7, false, false, null),
    (231, 'ECW-PL-231', 'CHALECO DE NIÑO MAGO', 'traditional_ceremonial', 'piece', 5, false, false, null),
    (232, 'ECW-PL-232', 'CHALECO DE NIÑO MAGO SOLO P', 'traditional_ceremonial', 'piece', 3.5, false, false, null),
    (233, 'ECW-PL-233', 'CHALECO MAGA SOLO P.', 'traditional_ceremonial', 'piece', 4, false, false, null),
    (234, 'ECW-PL-234', 'Chaleco piel mago', 'traditional_ceremonial', 'piece', 25, false, false, null),
    (235, 'ECW-PL-235', 'CINTURON MAGO', 'traditional_ceremonial', 'piece', 4, false, false, null),
    (236, 'ECW-PL-236', 'Delantal de mago', 'traditional_ceremonial', 'piece', 5, false, false, null),
    (239, 'ECW-PL-239', 'Falda maga niña', 'traditional_ceremonial', 'piece', 9, false, false, null),
    (240, 'ECW-PL-240', 'Falda Maga/gonna da maga', 'traditional_ceremonial', 'piece', 15.5, false, false, null),
    (243, 'ECW-PL-243', 'Pañuelo de mago/fulard', 'traditional_ceremonial', 'piece', 4, false, false, null),
    (244, 'ECW-PL-244', 'Polainas-fajin/ghette', 'traditional_ceremonial', 'piece', 4, false, false, null);

  insert into public.services (
    organization_id, code, name, unit_type, category, is_active, sort_order,
    portal_visible, portal_featured, portal_image_path
  )
  select
    target_organization_id, seed.code, seed.name, seed.unit_type, seed.category, true,
    seed.source_order, true, seed.portal_featured, seed.portal_image_path
  from catalog_001_seed seed
  on conflict do nothing;

  update public.services service
  set
    name = seed.name,
    unit_type = seed.unit_type,
    category = seed.category,
    sort_order = seed.source_order,
    portal_visible = true,
    portal_featured = seed.portal_featured,
    portal_image_path = seed.portal_image_path,
    updated_at = now()
  from catalog_001_seed seed
  where service.organization_id = target_organization_id
    and service.code = seed.code;

  update public.service_prices price
  set
    amount = seed.amount,
    currency = 'EUR',
    is_from = seed.price_is_from,
    updated_at = now()
  from public.services service
  join catalog_001_seed seed on seed.code = service.code
  where price.organization_id = target_organization_id
    and service.organization_id = target_organization_id
    and price.service_id = service.id
    and price.location_id is null
    and price.valid_from = date '2026-08-24'
    and price.is_active;

  insert into public.service_prices (
    organization_id, service_id, location_id, amount, currency, valid_from,
    valid_to, is_active, is_from
  )
  select
    target_organization_id, service.id, null, seed.amount, 'EUR',
    date '2026-08-24', null, true, seed.price_is_from
  from catalog_001_seed seed
  join public.services service
    on service.organization_id = target_organization_id
   and service.code = seed.code
  where not exists (
    select 1
    from public.service_prices price
    where price.organization_id = target_organization_id
      and price.service_id = service.id
      and price.location_id is null
      and price.valid_from = date '2026-08-24'
      and price.is_active
  );
end;
$$;

-- Keep the write path aligned with the customer-visible catalogue. The
-- existing Portal authorization, tenant/property isolation, pricing and
-- idempotency logic remains unchanged.

create or replace function public.create_customer_portal_order_request(
  target_request_id uuid,
  target_property_id uuid,
  target_items jsonb,
  target_requested_pickup_at timestamp without time zone,
  target_customer_notes text
)
returns table (
  id uuid,
  order_number text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  portal_org_id uuid;
  portal_customer_id uuid;
  org_timezone text;
  org_currency text;
  portal_location_id uuid;
  property_address_line1 text;
  property_address_line2 text;
  property_city text;
  property_postal_code text;
  property_country_code text;
  property_contact_name text;
  property_contact_phone text;
  property_access_instructions text;
  portal_pickup_at timestamptz;
  new_order_id uuid;
  new_order_number text;
  existing_order_id uuid;
  existing_order_number text;
  item jsonb;
  item_service_id uuid;
  item_quantity numeric;
  item_service_name text;
  item_unit_type public.service_unit_type;
  item_price numeric(12,2);
  normalized_items jsonb := '[]'::jsonb;
  selected_service_ids uuid[] := array[]::uuid[];
  item_index integer := 0;
begin
  if actor_id is null or target_request_id is null then
    raise exception 'portal_request_unauthorized';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_request_id::text, 0));

  select
    access.organization_id,
    access.customer_id,
    organization.timezone,
    organization.default_currency::text,
    (
      select location.id
      from public.locations location
      where location.organization_id = access.organization_id
        and location.is_active
        and location.deleted_at is null
      order by location.created_at, location.id
      limit 1
    )
  into portal_org_id, portal_customer_id, org_timezone, org_currency, portal_location_id
  from public.customer_portal_access access
  join public.customers customer
    on customer.organization_id = access.organization_id
   and customer.id = access.customer_id
  join public.organizations organization
    on organization.id = access.organization_id
  where access.user_id = actor_id
    and access.is_active
    and customer.is_active
    and organization.status = 'active'
    and organization.deleted_at is null
  order by access.created_at
  limit 1;

  if portal_org_id is null or portal_customer_id is null then
    raise exception 'portal_request_unauthorized';
  end if;

  select target_order.id, target_order.order_number
  into existing_order_id, existing_order_number
  from public.orders target_order
  join public.order_status_history history
    on history.organization_id = target_order.organization_id
   and history.order_id = target_order.id
  where target_order.organization_id = portal_org_id
    and target_order.customer_id = portal_customer_id
    and history.metadata ->> 'source' = 'customer_portal'
    and history.metadata ->> 'request_id' = target_request_id::text
  order by history.changed_at
  limit 1;

  if existing_order_id is not null then
    return query select existing_order_id, existing_order_number;
    return;
  end if;

  select
    property.address_line1,
    property.address_line2,
    property.city,
    property.postal_code,
    property.country_code::text,
    coalesce(property.contact_name, customer.display_name),
    coalesce(property.contact_phone, customer.phone),
    property.access_instructions
  into
    property_address_line1,
    property_address_line2,
    property_city,
    property_postal_code,
    property_country_code,
    property_contact_name,
    property_contact_phone,
    property_access_instructions
  from public.properties property
  join public.customers customer
    on customer.organization_id = property.organization_id
   and customer.id = property.customer_id
  where property.id = target_property_id
    and property.organization_id = portal_org_id
    and property.customer_id = portal_customer_id
    and property.is_active;

  if property_address_line1 is null
    or btrim(property_address_line1) = ''
    or property_city is null
    or btrim(property_city) = ''
    or property_country_code is null
    or btrim(property_country_code) = '' then
    raise exception 'portal_request_invalid_property';
  end if;

  if target_requested_pickup_at is null then
    raise exception 'portal_request_invalid_pickup_time';
  end if;

  portal_pickup_at := target_requested_pickup_at at time zone org_timezone;

  if portal_pickup_at <= now() then
    raise exception 'portal_request_pickup_in_past';
  end if;

  if target_items is null
    or jsonb_typeof(target_items) <> 'array'
    or jsonb_array_length(target_items) < 1
    or jsonb_array_length(target_items) > 20 then
    raise exception 'portal_request_invalid_items';
  end if;

  for item in select value from jsonb_array_elements(target_items)
  loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'portal_request_invalid_items';
    end if;

    begin
      item_service_id := nullif(item ->> 'service_id', '')::uuid;
      item_quantity := nullif(item ->> 'quantity', '')::numeric;
    exception when others then
      raise exception 'portal_request_invalid_items';
    end;

    if item_service_id is null
      or item_quantity is null
      or item_quantity <= 0
      or item_quantity > 10000
      or item_quantity <> round(item_quantity, 3)
      or item_service_id = any(selected_service_ids) then
      raise exception 'portal_request_invalid_items';
    end if;

    select
      service.name,
      service.unit_type,
      current_price.amount
    into item_service_name, item_unit_type, item_price
    from public.services service
    join lateral (
      select price.amount
      from public.service_prices price
      where price.organization_id = portal_org_id
        and price.service_id = service.id
        and price.is_active
        and price.currency = org_currency
        and price.valid_from <= (now() at time zone org_timezone)::date
        and (price.valid_to is null or price.valid_to >= (now() at time zone org_timezone)::date)
        and (price.location_id is null or price.location_id = portal_location_id)
      order by (price.location_id is not null) desc, price.valid_from desc, price.created_at desc
      limit 1
    ) current_price on true
    where service.id = item_service_id
      and service.organization_id = portal_org_id
      and service.is_active
      and service.portal_visible
      and (service.location_id is null or service.location_id = portal_location_id);

    if item_service_name is null or item_unit_type is null or item_price is null then
      raise exception 'portal_request_service_unavailable';
    end if;

    if item_unit_type in ('piece', 'cycle', 'service', 'day') and item_quantity <> trunc(item_quantity) then
      raise exception 'portal_request_invalid_items';
    end if;

    selected_service_ids := array_append(selected_service_ids, item_service_id);
    normalized_items := normalized_items || jsonb_build_array(jsonb_build_object(
      'service_id', item_service_id,
      'description', item_service_name,
      'unit_type', item_unit_type,
      'quantity', item_quantity,
      'unit_price', item_price
    ));
  end loop;

  new_order_number := 'EW-' || lpad(nextval('public.order_number_sequence')::text, 6, '0');

  perform set_config('app.order_create', 'on', true);

  insert into public.orders (
    organization_id,
    location_id,
    order_number,
    customer_id,
    property_id,
    production_status,
    priority,
    customer_notes,
    internal_notes,
    currency,
    assigned_to,
    created_by,
    updated_by
  )
  values (
    portal_org_id,
    portal_location_id,
    new_order_number,
    portal_customer_id,
    target_property_id,
    'draft',
    'normal',
    left(nullif(btrim(target_customer_notes), ''), 1000),
    null,
    org_currency,
    null,
    actor_id,
    actor_id
  )
  returning orders.id into new_order_id;

  perform set_config('app.order_item_mutation', 'on', true);

  for item in select value from jsonb_array_elements(normalized_items)
  loop
    item_index := item_index + 1;

    insert into public.order_items (
      organization_id,
      order_id,
      service_id,
      description,
      unit_type,
      quantity,
      unit_price,
      line_total,
      sort_order,
      created_by,
      updated_by
    )
    values (
      portal_org_id,
      new_order_id,
      (item ->> 'service_id')::uuid,
      item ->> 'description',
      (item ->> 'unit_type')::public.service_unit_type,
      (item ->> 'quantity')::numeric,
      (item ->> 'unit_price')::numeric,
      round((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric, 2),
      item_index,
      actor_id,
      actor_id
    );
  end loop;

  perform public.recalculate_order_totals(new_order_id);

  perform set_config('app.workflow_transition', 'on', true);

  insert into public.order_status_history (
    organization_id,
    order_id,
    from_status,
    to_status,
    reason,
    changed_by,
    metadata
  )
  values (
    portal_org_id,
    new_order_id,
    null,
    'draft',
    null,
    actor_id,
    jsonb_build_object(
      'source', 'customer_portal',
      'request_id', target_request_id::text
    )
  );

  perform set_config('app.app_007_mutation', 'on', true);

  insert into public.pickups (
    organization_id,
    order_id,
    status,
    scheduled_at,
    assigned_to,
    address_line1,
    address_line2,
    city,
    postal_code,
    country_code,
    contact_name,
    contact_phone,
    notes,
    fee,
    created_by,
    updated_by
  )
  values (
    portal_org_id,
    new_order_id,
    'scheduled',
    portal_pickup_at,
    null,
    nullif(btrim(property_address_line1), ''),
    nullif(btrim(property_address_line2), ''),
    nullif(btrim(property_city), ''),
    nullif(btrim(property_postal_code), ''),
    nullif(upper(btrim(property_country_code)), ''),
    nullif(btrim(property_contact_name), ''),
    nullif(btrim(property_contact_phone), ''),
    left(nullif(btrim(property_access_instructions), ''), 600),
    0,
    actor_id,
    actor_id
  );

  return query select new_order_id, new_order_number;
end;
$$;
