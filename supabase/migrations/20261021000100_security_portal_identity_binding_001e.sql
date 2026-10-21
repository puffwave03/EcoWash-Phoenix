-- SECURITY-PORTAL-IDENTITY-BINDING-001E
-- Replace only the two management RPCs; preserve owners and signatures.
-- No existing associations are repaired or reactivated by this migration.
begin;

CREATE OR REPLACE FUNCTION "public"."upsert_customer_portal_access"("target_customer_id" "uuid", "target_user_id" "uuid", "target_email" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  actor_profile_id uuid := auth.uid();
  org_id uuid;
  access_id uuid;
begin
  if actor_profile_id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select customer.organization_id
  into org_id
  from public.customers customer
  where customer.id = target_customer_id
    and customer.is_active;

  if org_id is null then
    raise exception 'invalid customer';
  end if;

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  if not public.organization_entitlement_is_enabled(org_id, 'core.portal', now()) then
    raise exception 'portal_entitlement_required' using errcode = '42501';
  end if;

  -- Lock an existing association before the Auth row, in the same order as
  -- reactivation. Keep the verified email stable until this transaction ends.
  perform 1 from public.customer_portal_access access
  where access.organization_id = org_id and access.customer_id = target_customer_id
  for update;

  if target_email is null or btrim(target_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'portal_identity_invalid' using errcode = '22023';
  end if;

  perform 1 from auth.users auth_user
  where auth_user.id = target_user_id
    and lower(btrim(auth_user.email)) = lower(btrim(target_email))
  for share;
  if not found then
    raise exception 'portal_identity_invalid' using errcode = '22023';
  end if;

  insert into public.customer_portal_access (
    organization_id,
    customer_id,
    user_id,
    email,
    is_active,
    invited_by,
    disabled_by,
    disabled_at
  )
  values (
    org_id,
    target_customer_id,
    target_user_id,
    lower(btrim(target_email)),
    true,
    actor_profile_id,
    null,
    null
  )
  on conflict (organization_id, customer_id)
  do update
  set user_id = excluded.user_id,
      email = excluded.email,
      is_active = true,
      invited_by = excluded.invited_by,
      disabled_by = null,
      disabled_at = null
  returning id into access_id;

  return access_id;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."update_customer_portal_access"("target_access_id" "uuid", "target_is_active" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  actor_profile_id uuid := auth.uid();
  org_id uuid;
  customer_active boolean;
  access_user_id uuid;
  access_email text;
begin
  if actor_profile_id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select access.organization_id, customer.is_active, access.user_id, access.email
  into org_id, customer_active, access_user_id, access_email
  from public.customer_portal_access access
  join public.customers customer
    on customer.organization_id = access.organization_id
   and customer.id = access.customer_id
  where access.id = target_access_id
  for update of access;

  if org_id is null then
    raise exception 'invalid customer access';
  end if;

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  if target_is_active
    and not public.organization_entitlement_is_enabled(org_id, 'core.portal', now()) then
    raise exception 'portal_entitlement_required' using errcode = '42501';
  end if;

  if target_is_active and not customer_active then
    raise exception 'customer_lifecycle_inactive_customer' using errcode = '55000';
  end if;

  if target_is_active then
    if access_email is null or btrim(access_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
      raise exception 'portal_identity_invalid' using errcode = '22023';
    end if;

    perform 1 from auth.users auth_user
    where auth_user.id = access_user_id
      and lower(btrim(auth_user.email)) = lower(btrim(access_email))
    for share;
    if not found then
      raise exception 'portal_identity_invalid' using errcode = '22023';
    end if;
  end if;

  update public.customer_portal_access
  set is_active = target_is_active,
      disabled_by = case when target_is_active then null else actor_profile_id end,
      disabled_at = case when target_is_active then null else now() end
  where id = target_access_id
    and organization_id = org_id;
end;
$$;

revoke all on function public.upsert_customer_portal_access(uuid, uuid, text) from public, anon;
revoke all on function public.update_customer_portal_access(uuid, boolean) from public, anon;
grant execute on function public.upsert_customer_portal_access(uuid, uuid, text) to authenticated;
grant execute on function public.update_customer_portal_access(uuid, boolean) to authenticated;

commit;
