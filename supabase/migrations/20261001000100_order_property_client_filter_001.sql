-- Preserve the customer ownership of existing and future property references.
create or replace function public.protect_property_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id <> old.organization_id then
    raise exception 'properties.organization_id cannot be changed';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'properties.created_by cannot be changed';
  end if;

  if new.customer_id is distinct from old.customer_id then
    raise exception 'properties.customer_id cannot be changed';
  end if;

  return new;
end;
$$;
