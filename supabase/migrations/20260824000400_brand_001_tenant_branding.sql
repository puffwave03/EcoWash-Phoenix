-- BRAND-001: organization-scoped customer-facing branding and public brand media.
-- This migration is additive and does not mutate existing tenant business data.

create function public.app_brand_media_path_is_valid(target_path text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select target_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/(logo|hero|promo|category)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$';
$$;

create function public.app_brand_media_path_organization_id(target_path text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  if not public.app_brand_media_path_is_valid(target_path) then
    return null;
  end if;

  return split_part(target_path, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

create function public.is_customer_portal_user_for_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customer_portal_access access
    where access.organization_id = target_organization_id
      and access.user_id = auth.uid()
      and access.is_active
  );
$$;

create table public.organization_branding (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  commercial_name text,
  logo_path text,
  logo_alt text,
  primary_color text,
  strong_color text,
  soft_color text,
  portal_hero_path text,
  portal_hero_focal_position text not null default 'center',
  portal_title text,
  portal_subtitle text,
  support_email text,
  support_phone text,
  support_whatsapp text,
  business_address text,
  website_url text,
  promo_enabled boolean not null default false,
  promo_title text,
  promo_body text,
  promo_image_path text,
  promo_cta_label text,
  promo_cta_href text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_branding_commercial_name_length check (commercial_name is null or length(commercial_name) between 1 and 120),
  constraint organization_branding_logo_alt_length check (logo_alt is null or length(logo_alt) <= 180),
  constraint organization_branding_primary_color check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint organization_branding_strong_color check (strong_color is null or strong_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint organization_branding_soft_color check (soft_color is null or soft_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint organization_branding_palette_complete check (
    (primary_color is null and strong_color is null and soft_color is null)
    or (primary_color is not null and strong_color is not null and soft_color is not null)
  ),
  constraint organization_branding_logo_path check (
    logo_path is null
    or (
      public.app_brand_media_path_is_valid(logo_path)
      and public.app_brand_media_path_organization_id(logo_path) = organization_id
      and split_part(logo_path, '/', 2) = 'logo'
    )
  ),
  constraint organization_branding_hero_path check (
    portal_hero_path is null
    or (
      public.app_brand_media_path_is_valid(portal_hero_path)
      and public.app_brand_media_path_organization_id(portal_hero_path) = organization_id
      and split_part(portal_hero_path, '/', 2) = 'hero'
    )
  ),
  constraint organization_branding_promo_path check (
    promo_image_path is null
    or (
      public.app_brand_media_path_is_valid(promo_image_path)
      and public.app_brand_media_path_organization_id(promo_image_path) = organization_id
      and split_part(promo_image_path, '/', 2) = 'promo'
    )
  ),
  constraint organization_branding_hero_focal check (portal_hero_focal_position in ('center', 'top', 'bottom', 'left', 'right')),
  constraint organization_branding_portal_title_length check (portal_title is null or length(portal_title) <= 120),
  constraint organization_branding_portal_subtitle_length check (portal_subtitle is null or length(portal_subtitle) <= 320),
  constraint organization_branding_support_email_length check (support_email is null or length(support_email) <= 254),
  constraint organization_branding_support_phone_length check (support_phone is null or length(support_phone) <= 40),
  constraint organization_branding_support_whatsapp_length check (support_whatsapp is null or length(support_whatsapp) <= 40),
  constraint organization_branding_business_address_length check (business_address is null or length(business_address) <= 320),
  constraint organization_branding_website_url_length check (website_url is null or length(website_url) <= 500),
  constraint organization_branding_website_url_scheme check (website_url is null or website_url ~* '^https?://'),
  constraint organization_branding_promo_title_length check (promo_title is null or length(promo_title) <= 120),
  constraint organization_branding_promo_body_length check (promo_body is null or length(promo_body) <= 500),
  constraint organization_branding_promo_cta_label_length check (promo_cta_label is null or length(promo_cta_label) <= 80),
  constraint organization_branding_promo_cta_href_length check (promo_cta_href is null or length(promo_cta_href) <= 500),
  constraint organization_branding_promo_cta_href_scheme check (promo_cta_href is null or promo_cta_href ~* '^https?://')
);

create table public.organization_portal_categories (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category_key text not null,
  image_path text,
  focal_position text not null default 'center',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, category_key),
  constraint organization_portal_categories_key check (category_key ~ '^[a-z0-9_]{1,64}$'),
  constraint organization_portal_categories_image_path check (
    image_path is null
    or (
      public.app_brand_media_path_is_valid(image_path)
      and public.app_brand_media_path_organization_id(image_path) = organization_id
      and split_part(image_path, '/', 2) = 'category'
    )
  ),
  constraint organization_portal_categories_focal check (focal_position in ('center', 'top', 'bottom', 'left', 'right'))
);

create trigger organization_branding_set_updated_at
before update on public.organization_branding
for each row execute function public.set_updated_at();

create trigger organization_portal_categories_set_updated_at
before update on public.organization_portal_categories
for each row execute function public.set_updated_at();

alter table public.organization_branding enable row level security;
alter table public.organization_portal_categories enable row level security;

create policy "organization_branding_select_scoped"
on public.organization_branding
for select
to authenticated
using (
  public.is_organization_member(organization_id)
  or public.is_customer_portal_user_for_organization(organization_id)
);

create policy "organization_branding_insert_owner"
on public.organization_branding
for insert
to authenticated
with check (public.has_organization_role(organization_id, array['owner']::public.app_role[]));

create policy "organization_branding_update_owner"
on public.organization_branding
for update
to authenticated
using (public.has_organization_role(organization_id, array['owner']::public.app_role[]))
with check (public.has_organization_role(organization_id, array['owner']::public.app_role[]));

create policy "organization_portal_categories_select_scoped"
on public.organization_portal_categories
for select
to authenticated
using (
  public.is_organization_member(organization_id)
  or public.is_customer_portal_user_for_organization(organization_id)
);

create policy "organization_portal_categories_insert_owner"
on public.organization_portal_categories
for insert
to authenticated
with check (public.has_organization_role(organization_id, array['owner']::public.app_role[]));

create policy "organization_portal_categories_update_owner"
on public.organization_portal_categories
for update
to authenticated
using (public.has_organization_role(organization_id, array['owner']::public.app_role[]))
with check (public.has_organization_role(organization_id, array['owner']::public.app_role[]));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-media', 'brand-media', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "brand_media_insert_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'brand-media'
  and owner = auth.uid()
  and public.app_brand_media_path_is_valid(name)
  and public.has_organization_role(
    public.app_brand_media_path_organization_id(name),
    array['owner']::public.app_role[]
  )
);

create policy "brand_media_delete_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'brand-media'
  and public.app_brand_media_path_is_valid(name)
  and public.has_organization_role(
    public.app_brand_media_path_organization_id(name),
    array['owner']::public.app_role[]
  )
);

revoke all on public.organization_branding from public, anon, authenticated;
revoke all on public.organization_portal_categories from public, anon, authenticated;
grant select, insert, update on public.organization_branding to authenticated;
grant select, insert, update on public.organization_portal_categories to authenticated;

revoke all on function public.app_brand_media_path_is_valid(text) from public, anon, authenticated;
revoke all on function public.app_brand_media_path_organization_id(text) from public, anon, authenticated;
revoke all on function public.is_customer_portal_user_for_organization(uuid) from public, anon, authenticated;
grant execute on function public.app_brand_media_path_is_valid(text) to authenticated;
grant execute on function public.app_brand_media_path_organization_id(text) to authenticated;
grant execute on function public.is_customer_portal_user_for_organization(uuid) to authenticated;
