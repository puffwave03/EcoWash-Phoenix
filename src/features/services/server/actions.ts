"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ServiceActionState } from "@/features/services/types";
import {
  optionalDbValue,
  parseServiceForm,
} from "@/features/services/validation";

const initialState: ServiceActionState = { fieldErrors: {}, formError: null };

function fail(
  formError: ServiceActionState["formError"] = "generic",
  fieldErrors: Record<string, string> = {},
) {
  return { fieldErrors, formError };
}

function revalidateServices(locale: string) {
  revalidatePath(`/${locale}/app`);
  revalidatePath(`/${locale}/app/services`);
  revalidatePath(`/${locale}/app/orders/new`);
  revalidatePath(`/${locale}/app/shop`);
  revalidatePath(`/${locale}/portal`);
  revalidatePath(`/${locale}/portal/requests/new`);
}

export async function createServiceAction(
  locale: string,
  _state: ServiceActionState = initialState,
  formData: FormData,
) {
  void _state;

  const { membership, user } = await requireOwnerOrManager(locale);
  const { input, fieldErrors, valid } = parseServiceForm(formData, membership.organization.defaultCurrency);
  if (!valid || input.amount === null) return fail(null, fieldErrors);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .insert({
      category: optionalDbValue(input.category),
      code: optionalDbValue(input.code),
      created_by: user.id,
      description: optionalDbValue(input.description),
      is_active: input.isActive,
      name: input.name,
      organization_id: membership.organization.id,
      unit_type: input.unitType,
      updated_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("Service create failed", error?.code);
    return fail("generic");
  }

  const { error: priceError } = await supabase.from("service_prices").insert({
    amount: input.amount,
    created_by: user.id,
    currency: input.currency,
    is_active: true,
    is_from: input.priceIsFrom,
    organization_id: membership.organization.id,
    service_id: data.id,
    updated_by: user.id,
    valid_from: input.validFrom,
    valid_to: optionalDbValue(input.validTo),
  });

  if (priceError) {
    console.error("Service price create failed", priceError.code);
    return fail("generic");
  }

  revalidateServices(locale);
  redirect(`/${locale}/app/services`);
}

export async function updateServiceAction(
  locale: string,
  serviceId: string,
  _state: ServiceActionState = initialState,
  formData: FormData,
) {
  void _state;

  const { membership } = await requireOwnerOrManager(locale);
  const { input, fieldErrors, valid } = parseServiceForm(formData, membership.organization.defaultCurrency, true);
  if (!valid) return fail(null, fieldErrors);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_service_with_versioned_price", {
    target_amount: input.amount,
    target_category: optionalDbValue(input.category),
    target_code: optionalDbValue(input.code),
    target_currency: input.currency,
    target_description: optionalDbValue(input.description),
    target_is_active: input.isActive,
    target_is_from: input.priceIsFrom,
    target_name: input.name,
    target_service_id: serviceId,
    target_unit_type: input.unitType,
    target_valid_from: input.validFrom,
    target_valid_to: optionalDbValue(input.validTo),
  });
  if (error) {
    console.error("Service price version save failed", error.code);
    return fail("generic");
  }

  revalidateServices(locale);
  redirect(`/${locale}/app/services`);
}

export async function deactivateServiceAction(locale: string, serviceId: string) {
  const { membership, user } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("services")
    .update({ is_active: false, updated_by: user.id })
    .eq("organization_id", membership.organization.id)
    .eq("id", serviceId);

  if (error) console.error("Service deactivate failed", error.code);

  revalidateServices(locale);
}
