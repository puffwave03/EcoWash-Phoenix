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
}

export async function createServiceAction(
  locale: string,
  _state: ServiceActionState = initialState,
  formData: FormData,
) {
  void _state;

  const { input, fieldErrors, valid } = parseServiceForm(formData);
  if (!valid) return fail(null, fieldErrors);

  const { membership, user } = await requireOwnerOrManager(locale);
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

  const { input, fieldErrors, valid } = parseServiceForm(formData);
  if (!valid) return fail(null, fieldErrors);

  const { membership, user } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("services")
    .update({
      category: optionalDbValue(input.category),
      code: optionalDbValue(input.code),
      description: optionalDbValue(input.description),
      is_active: input.isActive,
      name: input.name,
      unit_type: input.unitType,
      updated_by: user.id,
    })
    .eq("organization_id", membership.organization.id)
    .eq("id", serviceId);

  if (error) {
    console.error("Service update failed", error.code);
    return fail("generic");
  }

  await supabase
    .from("service_prices")
    .update({ is_active: false, updated_by: user.id })
    .eq("organization_id", membership.organization.id)
    .eq("service_id", serviceId)
    .eq("is_active", true);

  const { error: priceError } = await supabase.from("service_prices").insert({
    amount: input.amount,
    created_by: user.id,
    currency: input.currency,
    is_active: true,
    is_from: input.priceIsFrom,
    organization_id: membership.organization.id,
    service_id: serviceId,
    updated_by: user.id,
    valid_from: input.validFrom,
    valid_to: optionalDbValue(input.validTo),
  });

  if (priceError) {
    console.error("Service price update failed", priceError.code);
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
