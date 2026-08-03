drop policy if exists "order_media_select_member" on storage.objects;

create policy "order_media_select_member"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'order-media'
  and public.app_order_media_path_is_valid(name)
  and (
    (
      public.is_organization_member(public.app_order_media_path_organization_id(name))
      and exists (
        select 1
        from public.order_photos photo
        where photo.storage_bucket = storage.objects.bucket_id
          and photo.storage_path = storage.objects.name
          and photo.organization_id = public.app_order_media_path_organization_id(storage.objects.name)
          and photo.order_id = public.app_order_media_path_order_id(storage.objects.name)
          and photo.is_active
      )
    )
    or public.can_access_customer_order_photo(storage.objects.bucket_id, storage.objects.name)
  )
);
