-- SAAS-TENANT-BOOTSTRAP-001B: Platform Admin database bootstrap only.
-- Auth creation and invitation remain outside this PostgreSQL transaction.

create table public.platform_tenant_bootstrap_receipts (
  idempotency_key uuid primary key,
  request_fingerprint text not null,
  organization_id uuid not null unique references public.organizations (id) on delete restrict,
  owner_profile_id uuid not null references public.profiles (id) on delete restrict,
  owner_membership_id uuid not null references public.organization_memberships (id) on delete restrict,
  first_location_id uuid not null references public.locations (id) on delete restrict,
  platform_actor_id uuid not null references public.platform_admins (user_id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint platform_tenant_bootstrap_fingerprint_format
    check (request_fingerprint ~ '^[0-9a-f]{64}$')
);

alter table public.platform_tenant_bootstrap_receipts enable row level security;
revoke all on public.platform_tenant_bootstrap_receipts from public, anon, authenticated;

create function public.platform_bootstrap_tenant(
  target_idempotency_key uuid,
  target_name text,
  target_slug text,
  target_default_currency text,
  target_timezone text,
  target_default_locale text,
  target_default_country_code text,
  target_owner_profile_id uuid,
  target_first_location_name text
)
returns table (
  organization_id uuid,
  organization_slug text,
  owner_membership_id uuid,
  owner_profile_id uuid,
  first_location_id uuid,
  idempotency_key uuid,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_platform_admin_identity();
  normalized_name text := pg_catalog.btrim(target_name);
  normalized_slug text := pg_catalog.lower(pg_catalog.btrim(target_slug));
  normalized_location_name text := pg_catalog.btrim(target_first_location_name);
  fingerprint text;
  prior_receipt public.platform_tenant_bootstrap_receipts%rowtype;
  new_organization_id uuid;
  new_membership_id uuid;
  new_location_id uuid;
  inserted_entitlement_count integer;
begin
  if target_idempotency_key is null or target_owner_profile_id is null
    or normalized_name is null or pg_catalog.char_length(normalized_name) not between 1 and 160
    or normalized_location_name is null or pg_catalog.char_length(normalized_location_name) not between 1 and 160
    or target_slug is null or target_slug <> normalized_slug
    or pg_catalog.char_length(target_slug) not between 1 and 80
    or target_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or target_default_currency is null or target_default_currency !~ '^[A-Z]{3}$'
    or target_timezone is null or not exists (
      select 1 from pg_catalog.pg_timezone_names tz where tz.name = target_timezone
    )
    or target_default_locale is null or target_default_locale not in ('en', 'it', 'es', 'fr', 'de')
    or target_default_country_code is null or target_default_country_code !~ '^[A-Z]{2}$'
  then
    raise exception 'platform_tenant_bootstrap_input_invalid' using errcode = '22023';
  end if;

  -- jsonb canonicalizes the ordered, normalized input tuple before hashing.
  fingerprint := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array(
      normalized_name, normalized_slug, target_default_currency, target_timezone,
      target_default_locale, target_default_country_code,
      target_owner_profile_id, normalized_location_name
    )::text,
    'UTF8'
  ), 'sha256'), 'hex');

  -- Different lock namespaces serialize retry-by-key and bootstrap-by-owner.
  -- This is deliberately scoped to this primitive, not a global membership rule.
  perform pg_catalog.pg_advisory_xact_lock(1707004, pg_catalog.hashtext(target_idempotency_key::text));
  select receipt.* into prior_receipt
  from public.platform_tenant_bootstrap_receipts receipt
  where receipt.idempotency_key = target_idempotency_key;

  if found then
    if prior_receipt.request_fingerprint <> fingerprint then
      raise exception 'platform_tenant_bootstrap_idempotency_conflict' using errcode = '23505';
    end if;
    return query select prior_receipt.organization_id, organization.slug,
      prior_receipt.owner_membership_id, prior_receipt.owner_profile_id,
      prior_receipt.first_location_id, prior_receipt.idempotency_key, true
    from public.organizations organization
    where organization.id = prior_receipt.organization_id;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(1707005, pg_catalog.hashtext(target_owner_profile_id::text));

  if not exists (
    select 1 from public.profiles profile
    join auth.users auth_user on auth_user.id = profile.id
    where profile.id = target_owner_profile_id
      and auth_user.email is not null
      and pg_catalog.btrim(auth_user.email) <> ''
      and auth_user.is_anonymous = false
      and auth_user.deleted_at is null
      and (auth_user.banned_until is null or auth_user.banned_until <= now())
      and exists (
        select 1 from auth.identities identity
        where identity.user_id = auth_user.id
      )
  ) then
    raise exception 'platform_tenant_bootstrap_owner_identity_invalid' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.customer_portal_access portal
    where portal.user_id = target_owner_profile_id and portal.is_active
  ) then
    raise exception 'platform_tenant_bootstrap_owner_portal_conflict' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.organization_memberships membership
    where membership.profile_id = target_owner_profile_id and membership.is_active
  ) then
    raise exception 'platform_tenant_bootstrap_owner_membership_conflict' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.organizations organization
    where organization.slug = normalized_slug
  ) then
    raise exception 'platform_tenant_bootstrap_slug_conflict' using errcode = '23505';
  end if;

  if (
    select pg_catalog.count(*) from public.platform_feature_catalog feature
    where feature.feature_key in (
      'core.orders', 'core.customers', 'core.operations', 'catalog.management'
    )
  ) <> 4 then
    raise exception 'platform_tenant_bootstrap_feature_catalog_incomplete' using errcode = '22023';
  end if;

  begin
    insert into public.organizations (
      name, slug, status, default_currency, timezone, default_locale,
      default_country_code, platform_service_status, created_by
    ) values (
      normalized_name, normalized_slug, 'active', target_default_currency,
      target_timezone, target_default_locale, target_default_country_code,
      'active', actor_id
    ) returning id into new_organization_id;
  exception when unique_violation then
    raise exception 'platform_tenant_bootstrap_slug_conflict' using errcode = '23505';
  end;

  insert into public.organization_memberships (
    organization_id, profile_id, role, is_active, invited_by
  ) values (
    new_organization_id, target_owner_profile_id, 'owner', true, actor_id
  ) returning id into new_membership_id;

  insert into public.organization_entitlements (
    organization_id, feature_key, enabled, source
  )
  select new_organization_id, feature.feature_key, true, 'tenant_bootstrap'
  from public.platform_feature_catalog feature
  where feature.feature_key in (
    'core.orders', 'core.customers', 'core.operations', 'catalog.management'
  );
  get diagnostics inserted_entitlement_count = row_count;
  if inserted_entitlement_count <> 4 then
    raise exception 'platform_tenant_bootstrap_entitlements_incomplete' using errcode = '22023';
  end if;

  insert into public.locations (
    organization_id, name, country_code, is_active
  ) values (
    new_organization_id, normalized_location_name, target_default_country_code, true
  ) returning id into new_location_id;

  insert into public.platform_tenant_bootstrap_receipts (
    idempotency_key, request_fingerprint, organization_id, owner_profile_id,
    owner_membership_id, first_location_id, platform_actor_id
  ) values (
    target_idempotency_key, fingerprint, new_organization_id, target_owner_profile_id,
    new_membership_id, new_location_id, actor_id
  );

  insert into public.platform_audit_log (
    platform_user_id, organization_id, action, target, before_state, after_state
  ) values (
    actor_id, new_organization_id, 'tenant_bootstrap', normalized_slug, '{}'::jsonb,
    pg_catalog.jsonb_build_object(
      'organization_id', new_organization_id,
      'owner_profile_id', target_owner_profile_id,
      'owner_membership_id', new_membership_id,
      'first_location_id', new_location_id,
      'entitlements', pg_catalog.jsonb_build_array(
        'core.orders', 'core.customers', 'core.operations', 'catalog.management'
      ),
      'idempotency_key', target_idempotency_key
    )
  );

  return query select new_organization_id, normalized_slug,
    new_membership_id, target_owner_profile_id, new_location_id,
    target_idempotency_key, false;
end;
$$;

revoke all on function public.platform_bootstrap_tenant(
  uuid, text, text, text, text, text, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.platform_bootstrap_tenant(
  uuid, text, text, text, text, text, text, uuid, text
) to authenticated;
