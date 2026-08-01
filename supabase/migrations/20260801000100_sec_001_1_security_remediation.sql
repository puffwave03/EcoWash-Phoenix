-- SEC-001.1 security remediation.
-- Local migration only until reviewed and explicitly applied.

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon, authenticated;

revoke all privileges
on function public.recalculate_order_totals(uuid)
from public, anon, authenticated;

alter default privileges for role postgres in schema public
revoke execute on functions from public;

alter default privileges for role postgres in schema public
revoke execute on functions from anon, authenticated;

grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, public.app_role[]) to authenticated;
grant execute on function public.shares_organization_with_profile(uuid) to authenticated;
grant execute on function public.app_order_media_path_is_valid(text) to authenticated;
grant execute on function public.app_order_media_path_organization_id(text) to authenticated;
grant execute on function public.app_order_media_path_order_id(text) to authenticated;

grant execute on function public.create_order(uuid, uuid, uuid, public.order_priority, timestamptz, text, text) to authenticated;
grant execute on function public.save_order_item(uuid, uuid, uuid, text, public.service_unit_type, numeric, numeric, text) to authenticated;
grant execute on function public.remove_order_item(uuid, uuid) to authenticated;
grant execute on function public.transition_order_status(uuid, public.production_status, text) to authenticated;
grant execute on function public.update_order_discount(uuid, numeric) to authenticated;
grant execute on function public.update_order_details(uuid, public.order_priority, timestamptz, text, text) to authenticated;
grant execute on function public.get_order_payment_summary(uuid) to authenticated;
grant execute on function public.create_or_update_pickup(uuid, uuid, timestamptz, uuid, text, text, text, text, text, text, text, text, numeric) to authenticated;
grant execute on function public.create_or_update_delivery(uuid, uuid, timestamptz, uuid, text, text, text, text, text, text, text, text, numeric) to authenticated;
grant execute on function public.transition_pickup_status(uuid, public.fulfillment_status, text) to authenticated;
grant execute on function public.transition_delivery_status(uuid, public.fulfillment_status, text) to authenticated;
grant execute on function public.record_payment(uuid, numeric, public.payment_method, timestamptz, text, text, uuid) to authenticated;
grant execute on function public.void_payment(uuid, text) to authenticated;
grant execute on function public.refund_payment(uuid, numeric, text) to authenticated;
grant execute on function public.register_order_photo(uuid, public.photo_category, text, text, text, bigint, text) to authenticated;
grant execute on function public.deactivate_order_photo(uuid) to authenticated;

revoke truncate, references, trigger
on all tables in schema public
from anon, authenticated;

revoke select, insert, update, delete
on all tables in schema public
from anon;

revoke delete
on all tables in schema public
from authenticated;

revoke insert, update
on public.profiles,
   public.organizations,
   public.locations,
   public.organization_memberships,
   public.orders,
   public.order_items,
   public.order_status_history,
   public.pickups,
   public.deliveries,
   public.payments,
   public.order_photos
from authenticated;

drop policy if exists "order_media_select_member" on storage.objects;

create policy "order_media_select_member"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'order-media'
  and public.app_order_media_path_is_valid(name)
  and public.is_organization_member(public.app_order_media_path_organization_id(name))
  and exists (
    select 1
    from public.order_photos photo
    where photo.storage_bucket = storage.objects.bucket_id
      and photo.storage_path = storage.objects.name
      and photo.organization_id = public.app_order_media_path_organization_id(storage.objects.name)
      and photo.order_id = public.app_order_media_path_order_id(storage.objects.name)
      and photo.is_active
  )
);
