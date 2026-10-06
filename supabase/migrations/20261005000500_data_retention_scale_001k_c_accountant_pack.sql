-- DATA-RETENTION-AND-SCALE-001K-C: private, non-fiscal accountant pack jobs.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.accountant_pack_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  period_start date not null,
  period_end_exclusive date not null,
  timezone text not null,
  location_id uuid,
  organization_name_snapshot text not null,
  location_name_snapshot text,
  pack_schema_version integer not null default 1,
  request_fingerprint text not null,
  status text not null default 'queued',
  requested_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  lease_token uuid,
  lease_started_at timestamptz,
  lease_expires_at timestamptz,
  source_read_started_at timestamptz,
  source_read_completed_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_code text,
  artifact_bucket text,
  artifact_path text,
  artifact_filename text,
  artifact_size_bytes bigint,
  artifact_sha256 text,
  manifest jsonb,
  expires_at timestamptz,
  cleanup_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accountant_pack_jobs_org_id_unique unique (organization_id, id),
  constraint accountant_pack_jobs_location_same_org foreign key (organization_id, location_id)
    references public.locations(organization_id, id) on delete restrict,
  constraint accountant_pack_jobs_period_valid check (period_start < period_end_exclusive),
  constraint accountant_pack_jobs_status_valid check (status in ('queued','processing','completed','failed','expired')),
  constraint accountant_pack_jobs_fingerprint_valid check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint accountant_pack_jobs_hash_valid check (artifact_sha256 is null or artifact_sha256 ~ '^[0-9a-f]{64}$'),
  constraint accountant_pack_jobs_attempt_valid check (attempt_count between 0 and 3),
  constraint accountant_pack_jobs_lease_valid check (
    (status = 'processing' and lease_token is not null and lease_started_at is not null and lease_expires_at is not null)
    or (status <> 'processing' and lease_token is null and lease_started_at is null and lease_expires_at is null)
  )
);
create index accountant_pack_jobs_history_idx on public.accountant_pack_jobs (organization_id, requested_at desc, id desc);
create index accountant_pack_jobs_queued_idx on public.accountant_pack_jobs (next_attempt_at, requested_at, id) where status = 'queued';
create index accountant_pack_jobs_lease_idx on public.accountant_pack_jobs (lease_expires_at, id) where status = 'processing';
create index accountant_pack_jobs_expiry_idx on public.accountant_pack_jobs (expires_at, id) where status = 'completed';
create unique index accountant_pack_jobs_active_request_idx on public.accountant_pack_jobs (organization_id, request_fingerprint)
  where status in ('queued','processing');
alter table public.accountant_pack_jobs enable row level security;
revoke all on public.accountant_pack_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.accountant_pack_jobs to service_role;

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('accounting-exports', 'accounting-exports', false, array['application/zip'])
on conflict (id) do update set public = false, allowed_mime_types = array['application/zip'];

create function public.request_accountant_pack(target_period_start date, target_period_end_exclusive date, target_location_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public, extensions
as $$
declare
  org_id uuid := public.app_current_organization_id();
  org_row public.organizations%rowtype;
  location_name text;
  fingerprint text;
  result public.accountant_pack_jobs%rowtype;
begin
  if not public.has_organization_role(org_id, array['owner','manager']::public.app_role[]) then
    raise exception 'accountant_pack_denied' using errcode = '42501';
  end if;
  select * into org_row from public.organizations where id = org_id and status = 'active' and deleted_at is null;
  if not found then raise exception 'accountant_pack_organization_inactive' using errcode = '42501'; end if;
  if target_period_start is null or target_period_end_exclusive is null or target_period_start >= target_period_end_exclusive then
    raise exception 'accountant_pack_period_invalid' using errcode = '22023';
  end if;
  if target_location_id is not null then
    select name into location_name from public.locations
    where organization_id = org_id and id = target_location_id and is_active and deleted_at is null;
    if not found then raise exception 'accountant_pack_location_invalid' using errcode = '22023'; end if;
  end if;
  fingerprint := encode(extensions.digest(concat_ws('|', org_id::text, target_period_start::text,
    target_period_end_exclusive::text, org_row.timezone, coalesce(target_location_id::text, 'all'), '1'), 'sha256'), 'hex');
  insert into public.accountant_pack_jobs (organization_id, requested_by, period_start, period_end_exclusive,
    timezone, location_id, organization_name_snapshot, location_name_snapshot, request_fingerprint)
  values (org_id, auth.uid(), target_period_start, target_period_end_exclusive, org_row.timezone,
    target_location_id, org_row.name, location_name, fingerprint)
  on conflict (organization_id, request_fingerprint) where status in ('queued','processing') do nothing
  returning * into result;
  if result.id is null then
    select * into result from public.accountant_pack_jobs
    where organization_id = org_id and request_fingerprint = fingerprint and status in ('queued','processing');
  end if;
  return result.id;
end;
$$;

create function public.list_accountant_pack_jobs(target_cursor_requested_at timestamptz default null, target_cursor_id uuid default null)
returns table (id uuid, period_start date, period_end_exclusive date, timezone text, location_id uuid,
  location_name_snapshot text, status text, requested_at timestamptz, expires_at timestamptz,
  artifact_size_bytes bigint, error_code text)
language plpgsql stable security definer set search_path = public
as $$
declare org_id uuid := public.app_current_organization_id();
begin
  if not public.has_organization_role(org_id, array['owner','manager']::public.app_role[]) then
    raise exception 'accountant_pack_denied' using errcode = '42501';
  end if;
  if (target_cursor_requested_at is null) <> (target_cursor_id is null) then
    target_cursor_requested_at := null; target_cursor_id := null;
  end if;
  return query select j.id, j.period_start, j.period_end_exclusive, j.timezone, j.location_id,
    j.location_name_snapshot, j.status, j.requested_at, j.expires_at, j.artifact_size_bytes, j.error_code
  from public.accountant_pack_jobs j where j.organization_id = org_id
    and exists (select 1 from public.organizations o where o.id = org_id and o.status = 'active' and o.deleted_at is null)
    and (target_cursor_requested_at is null or (j.requested_at, j.id) < (target_cursor_requested_at, target_cursor_id))
  order by j.requested_at desc, j.id desc limit 21;
end;
$$;

create function public.get_accountant_pack_download(target_job_id uuid)
returns table (artifact_bucket text, artifact_path text, artifact_filename text)
language plpgsql stable security definer set search_path = public
as $$
declare org_id uuid := public.app_current_organization_id();
begin
  if not public.has_organization_role(org_id, array['owner','manager']::public.app_role[]) then
    raise exception 'accountant_pack_denied' using errcode = '42501';
  end if;
  return query select j.artifact_bucket, j.artifact_path, j.artifact_filename
  from public.accountant_pack_jobs j
  where j.organization_id = org_id and j.id = target_job_id and j.status = 'completed'
    and exists (select 1 from public.organizations o where o.id = org_id and o.status = 'active' and o.deleted_at is null)
    and j.expires_at > now() and j.artifact_bucket = 'accounting-exports' and j.artifact_path is not null;
end;
$$;

create function public.retry_accountant_pack(target_job_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare org_id uuid := public.app_current_organization_id(); old_job public.accountant_pack_jobs%rowtype;
begin
  if not public.has_organization_role(org_id, array['owner','manager']::public.app_role[]) then
    raise exception 'accountant_pack_denied' using errcode = '42501';
  end if;
  select * into old_job from public.accountant_pack_jobs
    where organization_id = org_id and id = target_job_id and status in ('failed','completed','expired');
  if not found then raise exception 'accountant_pack_retry_unavailable' using errcode = '22023'; end if;
  return public.request_accountant_pack(old_job.period_start, old_job.period_end_exclusive, old_job.location_id);
end;
$$;

revoke all on function public.request_accountant_pack(date,date,uuid) from public, anon, authenticated;
revoke all on function public.list_accountant_pack_jobs(timestamptz,uuid) from public, anon, authenticated;
revoke all on function public.get_accountant_pack_download(uuid) from public, anon, authenticated;
revoke all on function public.retry_accountant_pack(uuid) from public, anon, authenticated;
grant execute on function public.request_accountant_pack(date,date,uuid) to authenticated;
grant execute on function public.list_accountant_pack_jobs(timestamptz,uuid) to authenticated;
grant execute on function public.get_accountant_pack_download(uuid) to authenticated;
grant execute on function public.retry_accountant_pack(uuid) to authenticated;

-- One canonical Sales event selector; both user and worker boundaries delegate here.
create function private.accounting_sales_page_core(
  target_organization_id uuid,
  target_start timestamptz,
  target_end_exclusive timestamptz,
  target_location_id uuid,
  target_cursor_event_date timestamptz default null,
  target_cursor_event_type text default null,
  target_cursor_event_id uuid default null,
  target_limit integer default 250
)
returns table (
  event_date timestamptz,
  event_type text,
  event_id uuid,
  order_reference text,
  customer text,
  location text,
  payment_method text,
  amount numeric,
  currency text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid := target_organization_id;
begin
  if target_start is null or target_end_exclusive is null or target_start >= target_end_exclusive then
    raise exception 'accounting_export_period_invalid';
  end if;
  if target_limit is null or target_limit < 1 or target_limit > 250 then
    raise exception 'accounting_export_page_size_invalid';
  end if;
  if (target_cursor_event_date is null) <> (target_cursor_event_type is null)
    or (target_cursor_event_date is null) <> (target_cursor_event_id is null)
    or (target_cursor_event_type is not null and target_cursor_event_type not in ('sale', 'payment', 'refund')) then
    raise exception 'accounting_export_cursor_invalid';
  end if;
  if target_location_id is not null and not exists (
    select 1 from public.locations location
    where location.organization_id = org_id
      and location.id = target_location_id
  ) then
    raise exception 'accounting_export_location_invalid';
  end if;

  return query
  with sale_events as (
    select
      orders.created_at as event_date,
      'sale'::text as event_type,
      orders.id as event_id,
      orders.order_number as order_reference,
      customer.display_name as customer,
      location.name as location,
      null::text as payment_method,
      orders.total as amount,
      orders.currency as currency
    from public.orders orders
    join public.customers customer
      on customer.organization_id = orders.organization_id
     and customer.id = orders.customer_id
    left join public.locations location
      on location.organization_id = orders.organization_id
     and location.id = orders.location_id
    where orders.organization_id = org_id
      and orders.is_active
      and orders.production_status <> 'cancelled'
      and orders.created_at >= target_start
      and orders.created_at < target_end_exclusive
      and (target_location_id is null or orders.location_id = target_location_id)
      and not (
        exists (
          select 1 from public.order_status_history history
          where history.organization_id = orders.organization_id
            and history.order_id = orders.id
            and history.metadata @> '{"source":"quick_drop"}'::jsonb
        )
        and not exists (
          select 1 from public.order_items item
          where item.organization_id = orders.organization_id
            and item.order_id = orders.id
            and item.is_active
        )
      )
      and (
        target_cursor_event_date is null
        or orders.created_at < target_cursor_event_date
        or (orders.created_at = target_cursor_event_date and 'sale'::text > target_cursor_event_type)
        or (orders.created_at = target_cursor_event_date and 'sale'::text = target_cursor_event_type and orders.id > target_cursor_event_id)
      )
    order by orders.created_at desc, orders.id asc
    limit target_limit
  ), payment_events as (
    select
      payments.paid_at as event_date,
      'payment'::text as event_type,
      payments.id as event_id,
      orders.order_number as order_reference,
      customer.display_name as customer,
      location.name as location,
      payments.method::text as payment_method,
      payments.amount as amount,
      orders.currency as currency
    from public.payments payments
    join public.orders orders
      on orders.organization_id = payments.organization_id
     and orders.id = payments.order_id
    join public.customers customer
      on customer.organization_id = orders.organization_id
     and customer.id = orders.customer_id
    left join public.locations location
      on location.organization_id = orders.organization_id
     and location.id = orders.location_id
    where payments.organization_id = org_id
      and payments.status = 'confirmed'
      and orders.is_active
      and payments.paid_at >= target_start
      and payments.paid_at < target_end_exclusive
      and (target_location_id is null or orders.location_id = target_location_id)
      and (
        target_cursor_event_date is null
        or payments.paid_at < target_cursor_event_date
        or (payments.paid_at = target_cursor_event_date and 'payment'::text > target_cursor_event_type)
        or (payments.paid_at = target_cursor_event_date and 'payment'::text = target_cursor_event_type and payments.id > target_cursor_event_id)
      )
    order by payments.paid_at desc, payments.id asc
    limit target_limit
  ), refund_events as (
    select
      payments.paid_at as event_date,
      'refund'::text as event_type,
      payments.id as event_id,
      orders.order_number as order_reference,
      customer.display_name as customer,
      location.name as location,
      payments.method::text as payment_method,
      payments.amount as amount,
      orders.currency as currency
    from public.payments payments
    join public.orders orders
      on orders.organization_id = payments.organization_id
     and orders.id = payments.order_id
    join public.customers customer
      on customer.organization_id = orders.organization_id
     and customer.id = orders.customer_id
    left join public.locations location
      on location.organization_id = orders.organization_id
     and location.id = orders.location_id
    where payments.organization_id = org_id
      and payments.status = 'refunded'
      and orders.is_active
      and payments.paid_at >= target_start
      and payments.paid_at < target_end_exclusive
      and (target_location_id is null or orders.location_id = target_location_id)
      and (
        target_cursor_event_date is null
        or payments.paid_at < target_cursor_event_date
        or (payments.paid_at = target_cursor_event_date and 'refund'::text > target_cursor_event_type)
        or (payments.paid_at = target_cursor_event_date and 'refund'::text = target_cursor_event_type and payments.id > target_cursor_event_id)
      )
    order by payments.paid_at desc, payments.id asc
    limit target_limit
  ), events as (
    select * from sale_events
    union all
    select * from payment_events
    union all
    select * from refund_events
  )
  select events.event_date, events.event_type, events.event_id, events.order_reference,
    events.customer, events.location, events.payment_method, events.amount, events.currency
  from events
  order by events.event_date desc, events.event_type asc, events.event_id asc
  limit target_limit;
end;
$$;

revoke all on function private.accounting_sales_page_core(uuid,timestamptz,timestamptz,uuid,timestamptz,text,uuid,integer) from public, anon, authenticated;
create or replace function public.list_accounting_sales_export_page(
  target_start timestamptz, target_end_exclusive timestamptz, target_location_id uuid,
  target_cursor_event_date timestamptz default null, target_cursor_event_type text default null,
  target_cursor_event_id uuid default null, target_limit integer default 250
)
returns table (event_date timestamptz, event_type text, event_id uuid, order_reference text,
  customer text, location text, payment_method text, amount numeric, currency text)
language plpgsql stable security definer set search_path = public
as $$
declare org_id uuid := public.app_current_organization_id();
begin
  if not public.has_organization_role(org_id, array['owner','manager']::public.app_role[]) then
    raise exception 'accounting_export_denied' using errcode = '42501';
  end if;
  if target_location_id is not null and not exists (
    select 1 from public.locations location where location.organization_id = org_id
      and location.id = target_location_id and location.is_active and location.deleted_at is null
  ) then raise exception 'accounting_export_location_invalid'; end if;
  return query select * from private.accounting_sales_page_core(org_id, target_start, target_end_exclusive,
    target_location_id, target_cursor_event_date, target_cursor_event_type, target_cursor_event_id, target_limit);
end;
$$;
revoke all on function public.list_accounting_sales_export_page(timestamptz,timestamptz,uuid,timestamptz,text,uuid,integer) from public, anon, authenticated;
grant execute on function public.list_accounting_sales_export_page(timestamptz,timestamptz,uuid,timestamptz,text,uuid,integer) to authenticated;

-- Service-role-only worker transitions. Every write is guarded by the current lease token.
create function public.claim_accountant_pack(target_job_id uuid default null)
returns public.accountant_pack_jobs language plpgsql security definer set search_path = public
as $$
declare result public.accountant_pack_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'accountant_pack_worker_denied' using errcode = '42501'; end if;
  update public.accountant_pack_jobs j set status = 'failed', failed_at = now(), error_code = 'generation_failed',
    lease_token = null, lease_started_at = null, lease_expires_at = null, updated_at = now()
  where j.id in (select id from public.accountant_pack_jobs
    where status = 'processing' and lease_expires_at <= now() and attempt_count >= 3
    order by lease_expires_at, id limit 10 for update skip locked);
  select * into result from public.accountant_pack_jobs j
  where (target_job_id is null or j.id = target_job_id) and j.attempt_count < 3
    and ((j.status = 'queued' and j.next_attempt_at <= now())
      or (j.status = 'processing' and j.lease_expires_at <= now()))
  order by j.next_attempt_at, j.requested_at, j.id limit 1 for update skip locked;
  if result.id is null then return null; end if;
  update public.accountant_pack_jobs j set status = 'processing', attempt_count = j.attempt_count + 1,
    lease_token = gen_random_uuid(), lease_started_at = now(), lease_expires_at = now() + interval '90 seconds',
    source_read_started_at = now(), source_read_completed_at = null, error_code = null, updated_at = now()
  where j.id = result.id returning * into result;
  return result;
end;
$$;

create function public.heartbeat_accountant_pack(target_job_id uuid, target_lease_token uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'accountant_pack_worker_denied' using errcode = '42501'; end if;
  update public.accountant_pack_jobs set lease_expires_at = now() + interval '90 seconds', updated_at = now()
  where id = target_job_id and status = 'processing' and lease_token = target_lease_token and lease_expires_at > now();
  return found;
end;
$$;

create function public.mark_accountant_pack_sources_read(target_job_id uuid, target_lease_token uuid)
returns timestamptz language plpgsql security definer set search_path = public
as $$
declare completed_time timestamptz;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'accountant_pack_worker_denied' using errcode = '42501'; end if;
  update public.accountant_pack_jobs set source_read_completed_at = now(), updated_at = now()
  where id = target_job_id and status = 'processing' and lease_token = target_lease_token and lease_expires_at > now()
  returning source_read_completed_at into completed_time;
  return completed_time;
end;
$$;

create function public.list_accountant_pack_worker_sales_page(target_job_id uuid, target_lease_token uuid,
  target_cursor_event_date timestamptz default null, target_cursor_event_type text default null,
  target_cursor_event_id uuid default null, target_limit integer default 250)
returns table (event_date timestamptz, event_type text, event_id uuid, order_reference text,
  customer text, location text, payment_method text, amount numeric, currency text)
language plpgsql stable security definer set search_path = public
as $$
declare job public.accountant_pack_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'accountant_pack_worker_denied' using errcode = '42501'; end if;
  select * into job from public.accountant_pack_jobs
  where id = target_job_id and status = 'processing' and lease_token = target_lease_token and lease_expires_at > now();
  if not found then raise exception 'accountant_pack_lease_lost' using errcode = '42501'; end if;
  return query select * from private.accounting_sales_page_core(job.organization_id,
    job.period_start::timestamp at time zone job.timezone,
    job.period_end_exclusive::timestamp at time zone job.timezone,
    job.location_id, target_cursor_event_date, target_cursor_event_type, target_cursor_event_id, target_limit);
end;
$$;

create function public.complete_accountant_pack(target_job_id uuid, target_lease_token uuid,
  target_artifact_path text, target_artifact_filename text, target_artifact_size_bytes bigint,
  target_artifact_sha256 text, target_manifest jsonb)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'accountant_pack_worker_denied' using errcode = '42501'; end if;
  if target_artifact_path is null or target_artifact_size_bytes <= 0
    or target_artifact_sha256 !~ '^[0-9a-f]{64}$' or target_manifest is null then
    raise exception 'accountant_pack_artifact_invalid' using errcode = '22023';
  end if;
  update public.accountant_pack_jobs j set status = 'completed', completed_at = now(),
    artifact_bucket = 'accounting-exports', artifact_path = target_artifact_path,
    artifact_filename = target_artifact_filename, artifact_size_bytes = target_artifact_size_bytes,
    artifact_sha256 = target_artifact_sha256, manifest = target_manifest, expires_at = now() + interval '14 days',
    lease_token = null, lease_started_at = null, lease_expires_at = null, updated_at = now()
  where j.id = target_job_id and j.status = 'processing' and j.lease_token = target_lease_token
    and j.lease_expires_at > now() and j.source_read_completed_at is not null
    and target_artifact_path = j.organization_id::text || '/' || j.id::text || '/attempt-' || j.attempt_count::text || '-' || target_lease_token::text || '.zip';
  return found;
end;
$$;

create function public.fail_accountant_pack(target_job_id uuid, target_lease_token uuid,
  target_error_code text, target_retryable boolean)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'accountant_pack_worker_denied' using errcode = '42501'; end if;
  if target_error_code not in ('generation_failed','storage_upload_failed','artifact_runtime_limit_exceeded',
    'source_read_failed','manifest_generation_failed','worker_lease_lost') then
    raise exception 'accountant_pack_error_code_invalid' using errcode = '22023';
  end if;
  update public.accountant_pack_jobs j set
    status = case when target_retryable and j.attempt_count < 3 then 'queued' else 'failed' end,
    next_attempt_at = case when target_retryable and j.attempt_count < 3
      then now() + (case when j.attempt_count = 1 then interval '1 minute' else interval '5 minutes' end)
      else j.next_attempt_at end,
    failed_at = case when target_retryable and j.attempt_count < 3 then null else now() end,
    error_code = target_error_code, lease_token = null, lease_started_at = null,
    lease_expires_at = null, updated_at = now()
  where j.id = target_job_id and j.status = 'processing' and j.lease_token = target_lease_token
    and j.lease_expires_at > now();
  return found;
end;
$$;

revoke all on function public.claim_accountant_pack(uuid) from public, anon, authenticated;
revoke all on function public.heartbeat_accountant_pack(uuid,uuid) from public, anon, authenticated;
revoke all on function public.mark_accountant_pack_sources_read(uuid,uuid) from public, anon, authenticated;
revoke all on function public.list_accountant_pack_worker_sales_page(uuid,uuid,timestamptz,text,uuid,integer) from public, anon, authenticated;
revoke all on function public.complete_accountant_pack(uuid,uuid,text,text,bigint,text,jsonb) from public, anon, authenticated;
revoke all on function public.fail_accountant_pack(uuid,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.claim_accountant_pack(uuid) to service_role;
grant execute on function public.heartbeat_accountant_pack(uuid,uuid) to service_role;
grant execute on function public.mark_accountant_pack_sources_read(uuid,uuid) to service_role;
grant execute on function public.list_accountant_pack_worker_sales_page(uuid,uuid,timestamptz,text,uuid,integer) to service_role;
grant execute on function public.complete_accountant_pack(uuid,uuid,text,text,bigint,text,jsonb) to service_role;
grant execute on function public.fail_accountant_pack(uuid,uuid,text,boolean) to service_role;
