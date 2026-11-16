import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdminConfig, hasSupabaseAdminConfig } from "@/lib/supabase/env";

const PREVIEW_TTL_SECONDS = 5 * 60;

function featureEnabled() {
  return (
    process.env.ENABLE_STAGING_CUSTOMER_PREVIEW === "true"
    && process.env.NEXT_PUBLIC_SITE_INDEXING === "false"
    && hasSupabaseAdminConfig()
  );
}

function signaturePayload(locale: string, customerId: string, expiresAt: number) {
  return `${locale}.${customerId}.${expiresAt}`;
}

function sign(payload: string) {
  const { serviceRoleKey } = getSupabaseAdminConfig();

  return createHmac("sha256", serviceRoleKey).update(payload).digest("hex");
}

export function canUseStagingCustomerPreview() {
  return featureEnabled();
}

export function createStagingCustomerPreviewPath(locale: string, customerId: string) {
  if (!featureEnabled()) return null;

  const expiresAt = Math.floor(Date.now() / 1000) + PREVIEW_TTL_SECONDS;
  const payload = signaturePayload(locale, customerId, expiresAt);
  const params = new URLSearchParams({
    customerId,
    expires: String(expiresAt),
    sig: sign(payload),
  });

  return `/${locale}/portal/preview-test?${params.toString()}`;
}

export function verifyStagingCustomerPreviewSignature(
  locale: string,
  customerId: string | null,
  expires: string | null,
  signature: string | null,
) {
  if (!featureEnabled() || !customerId || !expires || !signature) return false;

  const expiresAt = Number(expires);
  if (!Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = sign(signaturePayload(locale, customerId, expiresAt));
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  return (
    expectedBuffer.length === signatureBuffer.length
    && timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}
