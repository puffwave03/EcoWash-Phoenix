-- CATALOG-001: expand the existing service unit vocabulary without changing
-- historical rows. New enum values are committed separately so the following
-- migration can safely use them in constraints and seed data.

alter type public.service_unit_type add value if not exists 'area' after 'weight';
alter type public.service_unit_type add value if not exists 'cycle' after 'area';
alter type public.service_unit_type add value if not exists 'service' after 'cycle';
alter type public.service_unit_type add value if not exists 'day' after 'service';
