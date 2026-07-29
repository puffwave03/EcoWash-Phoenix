alter table public.organizations
add column timezone text not null default 'Atlantic/Canary';

alter table public.organizations
add constraint organizations_timezone_not_blank check (length(btrim(timezone)) > 0);
