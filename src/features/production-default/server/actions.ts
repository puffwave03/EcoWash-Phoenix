"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveProductionDefaultAssigneeAction(locale: string, formData: FormData) {
  await requireOwnerOrManager(locale);
  const locationId = String(formData.get("locationId") ?? "").trim();
  const profileId = String(formData.get("profileId") ?? "").trim();
  const path = `/${locale}/app/settings/production`;
  if (!UUID.test(locationId) || (profileId && !UUID.test(profileId))) {
    redirect(`${path}?state=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_location_default_production_assignee", {
    target_location_id: locationId,
    target_profile_id: profileId || null,
  });
  if (error) {
    const state = error.message.includes("default_production_assignee_invalid") ? "invalidAssignee"
      : error.message.includes("default_production_location_invalid") ? "invalidLocation"
        : "error";
    redirect(`${path}?state=${state}`);
  }

  revalidatePath(path);
  redirect(`${path}?state=saved`);
}
