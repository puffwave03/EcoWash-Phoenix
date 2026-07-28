"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/features/customers/types";
import {
  optionalDbValue,
  parseCustomerForm,
  parsePropertyForm,
} from "@/features/customers/server/validation";

const initialState: ActionState = { fieldErrors: {}, formError: null };

function fail(
  formError: ActionState["formError"] = "generic",
  fieldErrors: Record<string, string> = {},
) {
  return { fieldErrors, formError };
}

function revalidateCustomers(locale: string) {
  revalidatePath(`/${locale}/app`);
  revalidatePath(`/${locale}/app/customers`);
}

export async function createCustomerAction(
  locale: string,
  _state: ActionState = initialState,
  formData: FormData,
) {
  void _state;

  const { input, fieldErrors, valid } = parseCustomerForm(formData);
  if (!valid) return fail(null, fieldErrors);

  const { membership, user } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      alternate_phone: optionalDbValue(input.alternatePhone),
      billing_address_line1: optionalDbValue(input.billingAddressLine1),
      billing_address_line2: optionalDbValue(input.billingAddressLine2),
      billing_city: optionalDbValue(input.billingCity),
      billing_country_code: optionalDbValue(input.billingCountryCode),
      billing_postal_code: optionalDbValue(input.billingPostalCode),
      company_name: optionalDbValue(input.companyName),
      created_by: user.id,
      customer_code: optionalDbValue(input.customerCode),
      customer_type: input.customerType,
      display_name: input.displayName,
      email: optionalDbValue(input.email),
      first_name: optionalDbValue(input.firstName),
      is_active: input.isActive,
      last_name: optionalDbValue(input.lastName),
      notes: optionalDbValue(input.notes),
      organization_id: membership.organization.id,
      phone: optionalDbValue(input.phone),
      preferred_locale: input.preferredLocale,
      tax_id: optionalDbValue(input.taxId),
      updated_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("Customer create failed", error?.code);
    return fail("generic");
  }

  revalidateCustomers(locale);
  redirect(`/${locale}/app/customers/${data.id}`);
}

export async function updateCustomerAction(
  locale: string,
  customerId: string,
  _state: ActionState = initialState,
  formData: FormData,
) {
  void _state;

  const { input, fieldErrors, valid } = parseCustomerForm(formData);
  if (!valid) return fail(null, fieldErrors);

  const { membership, user } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("customers")
    .update({
      alternate_phone: optionalDbValue(input.alternatePhone),
      billing_address_line1: optionalDbValue(input.billingAddressLine1),
      billing_address_line2: optionalDbValue(input.billingAddressLine2),
      billing_city: optionalDbValue(input.billingCity),
      billing_country_code: optionalDbValue(input.billingCountryCode),
      billing_postal_code: optionalDbValue(input.billingPostalCode),
      company_name: optionalDbValue(input.companyName),
      customer_code: optionalDbValue(input.customerCode),
      customer_type: input.customerType,
      display_name: input.displayName,
      email: optionalDbValue(input.email),
      first_name: optionalDbValue(input.firstName),
      is_active: input.isActive,
      last_name: optionalDbValue(input.lastName),
      notes: optionalDbValue(input.notes),
      phone: optionalDbValue(input.phone),
      preferred_locale: input.preferredLocale,
      tax_id: optionalDbValue(input.taxId),
      updated_by: user.id,
    })
    .eq("organization_id", membership.organization.id)
    .eq("id", customerId);

  if (error) {
    console.error("Customer update failed", error.code);
    return fail("generic");
  }

  revalidateCustomers(locale);
  redirect(`/${locale}/app/customers/${customerId}`);
}

export async function deactivateCustomerAction(locale: string, customerId: string) {
  const { membership, user } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("customers")
    .update({ is_active: false, updated_by: user.id })
    .eq("organization_id", membership.organization.id)
    .eq("id", customerId);

  if (error) console.error("Customer deactivate failed", error.code);

  revalidateCustomers(locale);
}

export async function createPropertyAction(
  locale: string,
  lockedCustomerId: string,
  _state: ActionState = initialState,
  formData: FormData,
) {
  void _state;

  formData.set("customerId", lockedCustomerId);
  const { input, fieldErrors, valid } = parsePropertyForm(formData);
  if (!valid) return fail(null, fieldErrors);

  const { membership, user } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .insert({
      access_instructions: optionalDbValue(input.accessInstructions),
      address_line1: optionalDbValue(input.addressLine1),
      address_line2: optionalDbValue(input.addressLine2),
      city: optionalDbValue(input.city),
      contact_name: optionalDbValue(input.contactName),
      contact_phone: optionalDbValue(input.contactPhone),
      country_code: optionalDbValue(input.countryCode),
      created_by: user.id,
      customer_id: input.customerId,
      is_active: input.isActive,
      name: input.name,
      notes: optionalDbValue(input.notes),
      organization_id: membership.organization.id,
      postal_code: optionalDbValue(input.postalCode),
      property_code: optionalDbValue(input.propertyCode),
      property_type: optionalDbValue(input.propertyType),
      updated_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("Property create failed", error?.code);
    return fail("generic");
  }

  revalidateCustomers(locale);
  redirect(`/${locale}/app/properties/${data.id}`);
}

export async function updatePropertyAction(
  locale: string,
  propertyId: string,
  _state: ActionState = initialState,
  formData: FormData,
) {
  void _state;

  const { input, fieldErrors, valid } = parsePropertyForm(formData);
  if (!valid) return fail(null, fieldErrors);

  const { membership, user } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("properties")
    .update({
      access_instructions: optionalDbValue(input.accessInstructions),
      address_line1: optionalDbValue(input.addressLine1),
      address_line2: optionalDbValue(input.addressLine2),
      city: optionalDbValue(input.city),
      contact_name: optionalDbValue(input.contactName),
      contact_phone: optionalDbValue(input.contactPhone),
      country_code: optionalDbValue(input.countryCode),
      is_active: input.isActive,
      name: input.name,
      notes: optionalDbValue(input.notes),
      postal_code: optionalDbValue(input.postalCode),
      property_code: optionalDbValue(input.propertyCode),
      property_type: optionalDbValue(input.propertyType),
      updated_by: user.id,
    })
    .eq("organization_id", membership.organization.id)
    .eq("id", propertyId);

  if (error) {
    console.error("Property update failed", error.code);
    return fail("generic");
  }

  revalidateCustomers(locale);
  redirect(`/${locale}/app/properties/${propertyId}`);
}

export async function deactivatePropertyAction(locale: string, propertyId: string) {
  const { membership, user } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("properties")
    .update({ is_active: false, updated_by: user.id })
    .eq("organization_id", membership.organization.id)
    .eq("id", propertyId);

  if (error) console.error("Property deactivate failed", error.code);

  revalidateCustomers(locale);
}
