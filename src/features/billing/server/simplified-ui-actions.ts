"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createBillingSimplifiedDraft } from "@/features/billing/server/simplified-draft";
import { issueBillingSimplifiedInvoice } from "@/features/billing/server/simplified-issue";
import { getBillingSimplifiedUiState } from "@/features/billing/server/simplified-ui";
import { requireBillingSimplifiedUiMutationAccess } from "@/features/billing/server/simplified-ui-access";

function selectedOrder(form: FormData) {
  const ids = form.getAll("orderId");
  return ids.length === 1 && typeof ids[0] === "string" && /^[0-9a-f-]{36}$/i.test(ids[0]) ? ids[0] : null;
}

function destination(locale: string, orderId: string | null, error?: string) {
  const query = new URLSearchParams();
  if (orderId) query.set("orderId", orderId);
  if (error) query.set("error", error);
  return `/${locale}/app/billing/simplified?${query}`;
}

export async function prepareBillingSimplifiedUiAction(locale: string, form: FormData) {
  await requireBillingSimplifiedUiMutationAccess(locale);
  const orderId = selectedOrder(form);
  if (!orderId) redirect(destination(locale, null, "invalid_input"));
  const state = await getBillingSimplifiedUiState(locale, { orderId });
  // Existing compatible drafts/issued documents are reused, never recreated.
  if (state.status === "draft" || state.status === "issued" || state.status === "issued_unavailable") redirect(destination(locale, orderId));
  if (state.status !== "ready") redirect(destination(locale, orderId, state.status === "blocked" ? state.reason : "order_unavailable"));
  const result = await createBillingSimplifiedDraft(locale, orderId, String(form.get("series") ?? ""));
  revalidatePath(`/${locale}/app/billing`);
  if (result.status === "blocked") redirect(destination(locale, orderId, result.reason));
  redirect(destination(locale, orderId, result.preview.status === "blocked" ? result.preview.reason : undefined));
}

export async function issueBillingSimplifiedUiAction(locale: string, form: FormData) {
  await requireBillingSimplifiedUiMutationAccess(locale);
  const orderId = selectedOrder(form);
  if (!orderId) redirect(destination(locale, null, "invalid_input"));
  if (form.get("confirm") !== "issue") redirect(destination(locale, orderId, "invalid_input"));
  const state = await getBillingSimplifiedUiState(locale, { orderId });
  if (state.status === "issued" || state.status === "issued_unavailable") redirect(destination(locale, orderId));
  if (state.status !== "draft") redirect(destination(locale, orderId, state.status === "blocked" ? state.reason : "simplified_draft_required"));
  // Invoice ID comes from the server-validated order, never from FormData.
  const result = await issueBillingSimplifiedInvoice(locale, state.invoiceId);
  revalidatePath(`/${locale}/app/billing`);
  if (result.status === "blocked") redirect(destination(locale, orderId, result.reason));
  // A committed issue is never described as rolled back if its ticket read
  // fails. GET retries the persisted document without another emission.
  redirect(destination(locale, orderId));
}
