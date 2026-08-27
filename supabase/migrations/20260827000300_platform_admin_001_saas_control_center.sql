-- PLATFORM-ADMIN-001: isolated SaaS operator identity and control plane.
-- No tenant membership receives platform privileges and no admin is seeded.

create type public.platform_access_role as enum ('platform_admin');
create type public.platform_service_status as enum ('active', 'suspended');

create table public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete restrict,
  role public.platform_access_role not null default 'platform_admin',
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations
  add column platform_service_status public.platform_service_status not null default 'active',
  add column commercial_plan_label text,
  add constraint organizations_commercial_plan_label_length check (
    commercial_plan_label is null or length(btrim(commercial_plan_label)) between 1 and 80
  );

create table public.platform_audit_log (
  id uuid primary key default extensions.gen_random_uuid(),
  platform_user_id uuid not null references public.platform_admins (user_id) on delete restrict,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  action text not null,
  target text not null,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint platform_audit_log_action_format check (
    action ~ '^[a-z][a-z0-9_]{2,63}$'
  ),
  constraint platform_audit_log_target_length check (
    length(btrim(target)) between 1 and 160
  ),
  constraint platform_audit_log_state_objects check (
    jsonb_typeof(before_state) = 'object' and jsonb_typeof(after_state) = 'object'
  )
);

create index platform_audit_log_organization_created_idx
on public.platform_audit_log (organization_id, created_at desc);

create trigger platform_admins_set_updated_at
before update on public.platform_admins
for each row execute function public.set_updated_at();

alter table public.platform_admins enable row level security;
alter table public.platform_audit_log enable row level security;

revoke all on public.platform_admins from public, anon, authenticated;
revoke all on public.platform_audit_log from public, anon, authenticated;

create function public.platform_admin_is_active(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins administrator
    where administrator.user_id = target_user_id
      and administrator.role = 'platform_admin'
      and administrator.is_active
  );
$$;

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.platform_admin_is_active(auth.uid());
$$;

create function public.require_platform_admin_identity()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.platform_admin_is_active(actor_id) then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;

  return actor_id;
end;
$$;

-- PostgREST invokes this before every database API request. Active platform
-- administrators remain cross-tenant; suspended tenant and Portal identities
-- are blocked before any table, RPC or Storage-backed database operation.
create function public.platform_assert_request_allowed()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or public.platform_admin_is_active(actor_id) then
    return;
  end if;

  if exists (
    select 1
    from public.organization_memberships membership
    join public.organizations organization
      on organization.id = membership.organization_id
    where membership.profile_id = actor_id
      and membership.is_active
      and organization.platform_service_status = 'suspended'
      and organization.deleted_at is null
  ) or exists (
    select 1
    from public.customer_portal_access access
    join public.organizations organization
      on organization.id = access.organization_id
    where access.user_id = actor_id
      and access.is_active
      and organization.platform_service_status = 'suspended'
      and organization.deleted_at is null
  ) then
    raise exception 'organization_suspended' using errcode = '42501';
  end if;
end;
$$;

-- Central tenant helpers now also enforce the platform service boundary.
create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    join public.organizations organization
      on organization.id = membership.organization_id
    where membership.organization_id = target_organization_id
      and membership.profile_id = auth.uid()
      and membership.is_active
      and organization.platform_service_status = 'active'
      and organization.deleted_at is null
  );
$$;

create or replace function public.has_organization_role(
  target_organization_id uuid,
  allowed_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    join public.organizations organization
      on organization.id = membership.organization_id
    where membership.organization_id = target_organization_id
      and membership.profile_id = auth.uid()
      and membership.role = any(allowed_roles)
      and membership.is_active
      and organization.platform_service_status = 'active'
      and organization.deleted_at is null
  );
$$;

create or replace function public.shares_organization_with_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships viewer_membership
    join public.organization_memberships target_membership
      on target_membership.organization_id = viewer_membership.organization_id
    join public.organizations organization
      on organization.id = viewer_membership.organization_id
    where viewer_membership.profile_id = auth.uid()
      and target_membership.profile_id = target_profile_id
      and viewer_membership.is_active
      and target_membership.is_active
      and organization.platform_service_status = 'active'
      and organization.deleted_at is null
  );
$$;

create or replace function public.app_current_organization_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result uuid;
  membership_count integer;
begin
  if exists (
    select 1
    from public.organization_memberships membership
    join public.organizations organization on organization.id = membership.organization_id
    where membership.profile_id = auth.uid()
      and membership.is_active
      and organization.platform_service_status = 'suspended'
      and organization.deleted_at is null
  ) then
    raise exception 'organization_suspended' using errcode = '42501';
  end if;

  select count(*), min(membership.organization_id)
  into membership_count, result
  from public.organization_memberships membership
  join public.organizations organization on organization.id = membership.organization_id
  where membership.profile_id = auth.uid()
    and membership.is_active
    and organization.platform_service_status = 'active'
    and organization.status = 'active'
    and organization.deleted_at is null;

  if membership_count <> 1 then
    raise exception 'single active organization membership required';
  end if;

  return result;
end;
$$;

create or replace function public.is_customer_portal_user_for_organization(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customer_portal_access access
    join public.organizations organization on organization.id = access.organization_id
    where access.organization_id = target_organization_id
      and access.user_id = auth.uid()
      and access.is_active
      and organization.platform_service_status = 'active'
      and organization.deleted_at is null
  );
$$;

create function public.platform_get_overview()
returns table (
  total_organizations bigint,
  active_organizations bigint,
  suspended_organizations bigint,
  billing_organizations bigint,
  segment_pricing_organizations bigint,
  advanced_branding_organizations bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_platform_admin_identity();

  return query
  select
    count(*) filter (where organization.deleted_at is null),
    count(*) filter (
      where organization.deleted_at is null
        and organization.platform_service_status = 'active'
    ),
    count(*) filter (
      where organization.deleted_at is null
        and organization.platform_service_status = 'suspended'
    ),
    count(*) filter (
      where organization.deleted_at is null
        and public.organization_entitlement_is_enabled(
          organization.id, 'billing.invoicing', now()
        )
    ),
    count(*) filter (
      where organization.deleted_at is null
        and public.organization_entitlement_is_enabled(
          organization.id, 'pricing.segment_overrides', now()
        )
    ),
    count(*) filter (
      where organization.deleted_at is null
        and public.organization_entitlement_is_enabled(
          organization.id, 'branding.full_white_label', now()
        )
    )
  from public.organizations organization;
end;
$$;

create function public.platform_list_organizations(
  target_search text default null,
  target_status public.platform_service_status default null,
  target_limit integer default 50,
  target_offset integer default 0
)
returns table (
  id uuid,
  name text,
  service_status public.platform_service_status,
  commercial_plan_label text,
  enabled_feature_count bigint,
  member_count bigint,
  location_count bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_platform_admin_identity();

  if target_limit < 1 or target_limit > 100 or target_offset < 0 then
    raise exception 'platform_organization_list_bounds_invalid' using errcode = '22023';
  end if;

  return query
  select
    organization.id,
    organization.name,
    organization.platform_service_status,
    organization.commercial_plan_label,
    (
      select count(*)
      from public.organization_entitlements entitlement
      where entitlement.organization_id = organization.id
        and public.organization_entitlement_is_enabled(
          organization.id, entitlement.feature_key, now()
        )
    ),
    (
      select count(*)
      from public.organization_memberships membership
      where membership.organization_id = organization.id
        and membership.is_active
    ),
    (
      select count(*)
      from public.locations location
      where location.organization_id = organization.id
        and location.deleted_at is null
    ),
    organization.created_at
  from public.organizations organization
  where organization.deleted_at is null
    and (
      nullif(btrim(target_search), '') is null
      or organization.name ilike '%' || btrim(target_search) || '%'
    )
    and (target_status is null or organization.platform_service_status = target_status)
  order by organization.created_at desc, organization.id
  limit target_limit
  offset target_offset;
end;
$$;

create function public.platform_get_organization_summary(target_organization_id uuid)
returns table (
  id uuid,
  name text,
  service_status public.platform_service_status,
  tenant_status public.organization_status,
  commercial_plan_label text,
  created_at timestamptz,
  member_count bigint,
  customer_count bigint,
  order_count bigint,
  location_count bigint,
  branding_commercial_name text,
  branding_has_logo boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_platform_admin_identity();

  return query
  select
    organization.id,
    organization.name,
    organization.platform_service_status,
    organization.status,
    organization.commercial_plan_label,
    organization.created_at,
    (
      select count(*) from public.organization_memberships membership
      where membership.organization_id = organization.id and membership.is_active
    ),
    (
      select count(*) from public.customers customer
      where customer.organization_id = organization.id
    ),
    (
      select count(*) from public.orders orders
      where orders.organization_id = organization.id
    ),
    (
      select count(*) from public.locations location
      where location.organization_id = organization.id and location.deleted_at is null
    ),
    branding.commercial_name,
    branding.logo_path is not null
  from public.organizations organization
  left join public.organization_branding branding
    on branding.organization_id = organization.id
  where organization.id = target_organization_id
    and organization.deleted_at is null;
end;
$$;

create function public.platform_list_organization_entitlements(target_organization_id uuid)
returns table (
  feature_key text,
  category text,
  description text,
  configured_enabled boolean,
  effective_enabled boolean,
  limit_value bigint,
  source text,
  valid_from timestamptz,
  valid_until timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_platform_admin_identity();

  if not exists (
    select 1 from public.organizations organization
    where organization.id = target_organization_id and organization.deleted_at is null
  ) then
    raise exception 'platform_organization_not_found' using errcode = '22023';
  end if;

  return query
  select
    feature.feature_key,
    feature.category,
    feature.description,
    coalesce(entitlement.enabled, false),
    public.organization_entitlement_is_enabled(
      target_organization_id, feature.feature_key, now()
    ),
    entitlement.limit_value,
    entitlement.source,
    entitlement.valid_from,
    entitlement.valid_until
  from public.platform_feature_catalog feature
  left join public.organization_entitlements entitlement
    on entitlement.organization_id = target_organization_id
   and entitlement.feature_key = feature.feature_key
  order by feature.category, feature.feature_key;
end;
$$;

create function public.platform_list_organization_audit(
  target_organization_id uuid,
  target_limit integer default 25
)
returns table (
  id uuid,
  action text,
  target text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz,
  actor_display_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_platform_admin_identity();

  if target_limit < 1 or target_limit > 100 then
    raise exception 'platform_audit_list_bounds_invalid' using errcode = '22023';
  end if;

  return query
  select
    audit.id,
    audit.action,
    audit.target,
    audit.before_state,
    audit.after_state,
    audit.created_at,
    profile.display_name
  from public.platform_audit_log audit
  join public.profiles profile on profile.id = audit.platform_user_id
  where audit.organization_id = target_organization_id
  order by audit.created_at desc, audit.id
  limit target_limit;
end;
$$;

create function public.platform_set_organization_entitlement(
  target_organization_id uuid,
  target_feature_key text,
  target_enabled boolean,
  target_limit_value bigint,
  target_valid_from timestamptz,
  target_valid_until timestamptz,
  target_source text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.require_platform_admin_identity();
  previous_state jsonb := '{}'::jsonb;
  next_state jsonb;
  audit_action text;
  normalized_source text := lower(btrim(coalesce(target_source, 'platform_admin')));
begin
  if not exists (
    select 1 from public.organizations organization
    where organization.id = target_organization_id and organization.deleted_at is null
  ) or not exists (
    select 1 from public.platform_feature_catalog feature
    where feature.feature_key = target_feature_key
  ) then
    raise exception 'platform_entitlement_target_invalid' using errcode = '22023';
  end if;

  if target_enabled is null
    or target_limit_value < 0
    or (target_valid_until is not null and target_valid_from is not null
      and target_valid_until < target_valid_from)
    or normalized_source !~ '^[a-z0-9_:-]{1,64}$' then
    raise exception 'platform_entitlement_values_invalid' using errcode = '22023';
  end if;

  select to_jsonb(entitlement) - 'organization_id' - 'feature_key'
  into previous_state
  from public.organization_entitlements entitlement
  where entitlement.organization_id = target_organization_id
    and entitlement.feature_key = target_feature_key;

  insert into public.organization_entitlements (
    organization_id, feature_key, enabled, limit_value, source, valid_from, valid_until
  ) values (
    target_organization_id, target_feature_key, target_enabled, target_limit_value,
    normalized_source, target_valid_from, target_valid_until
  )
  on conflict (organization_id, feature_key)
  do update set
    enabled = excluded.enabled,
    limit_value = excluded.limit_value,
    source = excluded.source,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until;

  select to_jsonb(entitlement) - 'organization_id' - 'feature_key'
  into next_state
  from public.organization_entitlements entitlement
  where entitlement.organization_id = target_organization_id
    and entitlement.feature_key = target_feature_key;

  audit_action := case
    when target_enabled and coalesce((previous_state ->> 'enabled')::boolean, false) = false
      then 'entitlement_enabled'
    when not target_enabled and coalesce((previous_state ->> 'enabled')::boolean, false) = true
      then 'entitlement_disabled'
    else 'entitlement_updated'
  end;

  insert into public.platform_audit_log (
    platform_user_id, organization_id, action, target, before_state, after_state
  ) values (
    actor_id, target_organization_id, audit_action, target_feature_key,
    coalesce(previous_state, '{}'::jsonb), next_state
  );
end;
$$;

create function public.platform_set_organization_service_status(
  target_organization_id uuid,
  target_status public.platform_service_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.require_platform_admin_identity();
  previous_status public.platform_service_status;
begin
  select organization.platform_service_status into previous_status
  from public.organizations organization
  where organization.id = target_organization_id
    and organization.deleted_at is null
  for update;

  if previous_status is null or target_status is null then
    raise exception 'platform_organization_status_invalid' using errcode = '22023';
  end if;

  if previous_status = target_status then
    return;
  end if;

  update public.organizations
  set platform_service_status = target_status
  where id = target_organization_id;

  insert into public.platform_audit_log (
    platform_user_id, organization_id, action, target, before_state, after_state
  ) values (
    actor_id,
    target_organization_id,
    case when target_status = 'suspended'
      then 'organization_suspended'
      else 'organization_reactivated'
    end,
    'platform_service_status',
    jsonb_build_object('status', previous_status),
    jsonb_build_object('status', target_status)
  );
end;
$$;

create function public.platform_set_organization_commercial_label(
  target_organization_id uuid,
  target_commercial_plan_label text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.require_platform_admin_identity();
  previous_label text;
  normalized_label text := nullif(btrim(target_commercial_plan_label), '');
begin
  if normalized_label is not null and length(normalized_label) > 80 then
    raise exception 'platform_commercial_label_invalid' using errcode = '22023';
  end if;

  select organization.commercial_plan_label into previous_label
  from public.organizations organization
  where organization.id = target_organization_id
    and organization.deleted_at is null
  for update;

  if not found then
    raise exception 'platform_organization_not_found' using errcode = '22023';
  end if;

  update public.organizations
  set commercial_plan_label = normalized_label
  where id = target_organization_id;

  if previous_label is distinct from normalized_label then
    insert into public.platform_audit_log (
      platform_user_id, organization_id, action, target, before_state, after_state
    ) values (
      actor_id,
      target_organization_id,
      'commercial_label_updated',
      'commercial_plan_label',
      jsonb_build_object('label', previous_label),
      jsonb_build_object('label', normalized_label)
    );
  end if;
end;
$$;

revoke all on function public.platform_admin_is_active(uuid) from public, anon, authenticated;
revoke all on function public.require_platform_admin_identity() from public, anon, authenticated;
revoke all on function public.is_platform_admin() from public, anon, authenticated;
grant execute on function public.is_platform_admin() to authenticated;

revoke all on function public.platform_assert_request_allowed() from public, anon, authenticated;
grant execute on function public.platform_assert_request_allowed() to anon, authenticated, service_role;

revoke all on function public.platform_get_overview() from public, anon, authenticated;
grant execute on function public.platform_get_overview() to authenticated;

revoke all on function public.platform_list_organizations(text, public.platform_service_status, integer, integer) from public, anon, authenticated;
grant execute on function public.platform_list_organizations(text, public.platform_service_status, integer, integer) to authenticated;

revoke all on function public.platform_get_organization_summary(uuid) from public, anon, authenticated;
grant execute on function public.platform_get_organization_summary(uuid) to authenticated;

revoke all on function public.platform_list_organization_entitlements(uuid) from public, anon, authenticated;
grant execute on function public.platform_list_organization_entitlements(uuid) to authenticated;

revoke all on function public.platform_list_organization_audit(uuid, integer) from public, anon, authenticated;
grant execute on function public.platform_list_organization_audit(uuid, integer) to authenticated;

revoke all on function public.platform_set_organization_entitlement(uuid, text, boolean, bigint, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.platform_set_organization_entitlement(uuid, text, boolean, bigint, timestamptz, timestamptz, text) to authenticated;

revoke all on function public.platform_set_organization_service_status(uuid, public.platform_service_status) from public, anon, authenticated;
grant execute on function public.platform_set_organization_service_status(uuid, public.platform_service_status) to authenticated;

revoke all on function public.platform_set_organization_commercial_label(uuid, text) from public, anon, authenticated;
grant execute on function public.platform_set_organization_commercial_label(uuid, text) to authenticated;

-- Secure bootstrap (intentionally not executed here): after verifying the Auth
-- user UUID out of band, a database operator inserts exactly one row into
-- platform_admins. No tenant-facing route or RPC can perform this operation.

alter role authenticator set pgrst.db_pre_request = 'public.platform_assert_request_allowed';
notify pgrst, 'reload config';
