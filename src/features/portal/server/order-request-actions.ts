"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCustomerPortalAccess } from "@/features/portal/server/queries";
import { parseCustomerPortalOrderRequest } from "@/features/portal/server/order-request-validation";
import type {
  CustomerPortalOrderRequestError,
  CustomerPortalOrderRequestState,
} from "@/features/portal/types";

const initialState: CustomerPortalOrderRequestState = {
  fieldErrors: {},
  formError: null,
};

function requestError(message: string | undefined): CustomerPortalOrderRequestError {
  if (message?.includes("portal_request_pickup_in_past")) return "pickupPast";
  if (message?.includes("portal_request_invalid_pickup_time")) return "requestedPickupAt";
  if (message?.includes("portal_request_invalid_property")) return "property";
  if (message?.includes("portal_request_invalid_items")) return "invalidQuantity";
  if (message?.includes("portal_request_service_unavailable")) return "services";

  return "generic";
}

export async function createCustomerPortalOrderRequestAction(
  locale: string,
  _state: CustomerPortalOrderRequestState = initialState,
  formData: FormData,
): Promise<CustomerPortalOrderRequestState> {
  void _state;

  const { input, state, valid } = parseCustomerPortalOrderRequest(formData);
  if (!valid) return state;

  await requireCustomerPortalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("create_customer_portal_order_request", {
      target_customer_notes: input.customerNotes || null,
      target_items: input.items.map((item) => ({
        quantity: item.quantity,
        service_id: item.serviceId,
      })),
      target_property_id: input.propertyId,
      target_request_id: input.requestId,
      target_requested_pickup_at: input.requestedPickupAt,
    })
    .single<{ id: string; order_number: string }>();

  if (error || !data) {
    console.error("Portal order request failed", error?.code ?? "missing_data");

    return {
      fieldErrors: {},
      formError: requestError(error?.message),
    };
  }

  revalidatePath(`/${locale}/portal`);
  revalidatePath(`/${locale}/portal/orders`);
  revalidatePath(`/${locale}/portal/orders/${data.id}`);
  revalidatePath(`/${locale}/app/orders`);
  revalidatePath(`/${locale}/app/orders/${data.id}`);
  revalidatePath(`/${locale}/app/work`);
  revalidatePath(`/${locale}/app/work/pickups`);
  revalidatePath(`/${locale}/app/work/production`);

  redirect(`/${locale}/portal/orders/${data.id}`);
}
