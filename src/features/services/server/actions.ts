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

type CurrentServiceRow = {
  category: string | null;
  code: string | null;
  description: string | null;
  id: string;
  is_active: boolean;
  name: string;
  unit_type: string;
};

type CurrentPriceRow = {
  amount: number;
  currency: string;
  is_from: boolean;
  valid_from: string;
  valid_to: string | null;
};

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
  const [{ data: currentService, error: currentServiceError }, { data: currentPrices, error: currentPricesError }] = await Promise.all([
    supabase.from("services")
      .select("id, code, name, description, unit_type, category, is_active")
      .eq("organization_id", membership.organization.id)
      .eq("id", serviceId)
      .maybeSingle<CurrentServiceRow>(),
    supabase.from("service_prices")
      .select("amount, currency, is_from, valid_from, valid_to")
      .eq("organization_id", membership.organization.id)
      .eq("service_id", serviceId)
      .eq("is_active", true)
      .returns<CurrentPriceRow[]>(),
  ]);
  if (currentServiceError || currentPricesError || !currentService) {
    console.error("Service update target lookup failed", currentServiceError?.code ?? currentPricesError?.code);
    return fail("generic");
  }

  const serviceFieldsUnchanged =
    currentService.code === optionalDbValue(input.code)
    && currentService.description === optionalDbValue(input.description)
    && currentService.unit_type === input.unitType
    && currentService.category === optionalDbValue(input.category)
    && currentService.is_active === input.isActive;
  const submittedPriceAlreadyExists = (currentPrices ?? []).some((price) =>
    Number(price.amount) === input.amount
    && price.currency === input.currency
    && price.is_from === input.priceIsFrom
    && price.valid_from === input.validFrom
    && price.valid_to === optionalDbValue(input.validTo));
  const nameOnlyUpdate = serviceFieldsUnchanged && submittedPriceAlreadyExists;

  const { data: updatedService, error } = await supabase
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
    .eq("id", serviceId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !updatedService) {
    console.error("Service update failed", error?.code ?? "not_found");
    return fail("generic");
  }

  if (nameOnlyUpdate) {
    revalidateServices(locale);
    redirect(`/${locale}/app/services`);
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
