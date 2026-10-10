import { routing } from "@/i18n/routing";

export type OwnerMode = "invite" | "existing";
export type TenantOnboardingInput = {
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  locale: string;
  country: string;
  location: string;
  ownerEmail: string;
  ownerMode: OwnerMode;
  ownerId: string;
};

export type TenantOnboardingField = keyof TenantOnboardingInput;
export type TenantOnboardingFieldErrors = Partial<Record<TenantOnboardingField, string>>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function suggestTenantSlug(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-$/, "");
}

export function normalizeTenantOnboarding(formData: FormData): TenantOnboardingInput {
  const value = (key: string) => String(formData.get(key) ?? "").trim();
  return {
    name: value("name"),
    slug: value("slug"),
    currency: value("currency").toUpperCase(),
    timezone: value("timezone"),
    locale: value("locale"),
    country: value("country").toUpperCase(),
    location: value("location"),
    ownerEmail: value("ownerEmail").toLowerCase(),
    ownerMode: value("ownerMode") as OwnerMode,
    ownerId: value("ownerId").toLowerCase(),
  };
}

export function tenantOnboardingFingerprint(input: TenantOnboardingInput) {
  return JSON.stringify(input);
}

export function validateTenantOnboarding(input: TenantOnboardingInput): TenantOnboardingFieldErrors {
  const errors: TenantOnboardingFieldErrors = {};
  if (!input.name || input.name.length > 160) errors.name = "requiredName";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug) || input.slug.length > 80) errors.slug = "invalidSlug";
  if (!/^[A-Z]{3}$/.test(input.currency)) errors.currency = "invalidCurrency";
  if (!input.timezone || input.timezone.length > 100) errors.timezone = "invalidTimezone";
  else {
    try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }); }
    catch { errors.timezone = "invalidTimezone"; }
  }
  if (!routing.locales.includes(input.locale as (typeof routing.locales)[number])) errors.locale = "invalidLocale";
  if (!/^[A-Z]{2}$/.test(input.country)) errors.country = "invalidCountry";
  if (!input.location || input.location.length > 160) errors.location = "requiredLocation";
  if (!emailPattern.test(input.ownerEmail) || input.ownerEmail.length > 254) errors.ownerEmail = "invalidEmail";
  if (input.ownerMode !== "invite" && input.ownerMode !== "existing") errors.ownerMode = "invalidMode";
  if (input.ownerMode === "existing" && !uuidPattern.test(input.ownerId)) errors.ownerId = "invalidUuid";
  return errors;
}
