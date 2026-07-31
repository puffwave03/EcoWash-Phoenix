"use client";

import { FormEvent, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/Card";

const businessTypes = [
  "professionalLaundry",
  "dryCleaning",
  "hotel",
  "vacationRental",
  "restaurant",
  "commercialClient",
  "selfService",
  "other",
] as const;

const locationOptions = ["one", "twoToFive", "sixToTen", "moreThanTen"] as const;
const languageOptions = ["en", "it", "es", "fr", "de"] as const;
const requiredFields = [
  "fullName",
  "businessName",
  "email",
  "country",
  "businessType",
  "locations",
  "message",
  "language",
  "consent",
] as const;

type FieldKey = (typeof requiredFields)[number];
type FormErrors = Partial<Record<FieldKey, string>>;

export function DemoRequestForm() {
  const t = useTranslations("contact");
  const [errors, setErrors] = useState<FormErrors>({});
  const [notice, setNotice] = useState("");

  const fieldIds = useMemo(
    () => ({
      fullName: "full-name",
      businessName: "business-name",
      email: "email",
      phone: "phone",
      country: "country",
      businessType: "business-type",
      locations: "locations",
      message: "message",
      language: "language",
      consent: "consent",
    }),
    [],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextErrors: FormErrors = {};

    requiredFields.forEach((field) => {
      const value = data.get(field);
      if (typeof value !== "string" || value.trim() === "") {
        nextErrors[field] = t("form.validation.required");
      }
    });

    const email = data.get("email");
    if (
      typeof email === "string" &&
      email.trim() !== "" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      nextErrors.email = t("form.validation.email");
    }

    setErrors(nextErrors);
    setNotice(Object.keys(nextErrors).length === 0 ? t("form.notAvailableMessage") : "");
  }

  const errorFor = (field: FieldKey) => errors[field];

  return (
    <Card className="p-5 sm:p-7">
      <div>
        <h2 className="text-h3 font-semibold text-text">{t("form.title")}</h2>
        <p className="mt-3 text-body leading-7 text-muted">
          {t("form.description")}
        </p>
      </div>
      <form className="mt-8 space-y-6" noValidate onSubmit={handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            error={errorFor("fullName")}
            id={fieldIds.fullName}
            label={t("form.fields.fullName.label")}
            name="fullName"
            placeholder={t("form.fields.fullName.placeholder")}
            required
          />
          <TextField
            error={errorFor("businessName")}
            id={fieldIds.businessName}
            label={t("form.fields.businessName.label")}
            name="businessName"
            placeholder={t("form.fields.businessName.placeholder")}
            required
          />
          <TextField
            error={errorFor("email")}
            id={fieldIds.email}
            label={t("form.fields.email.label")}
            name="email"
            placeholder={t("form.fields.email.placeholder")}
            required
            type="email"
          />
          <TextField
            id={fieldIds.phone}
            label={t("form.fields.phone.label")}
            name="phone"
            placeholder={t("form.fields.phone.placeholder")}
            type="tel"
          />
          <TextField
            error={errorFor("country")}
            id={fieldIds.country}
            label={t("form.fields.country.label")}
            name="country"
            placeholder={t("form.fields.country.placeholder")}
            required
          />
          <SelectField
            error={errorFor("businessType")}
            id={fieldIds.businessType}
            label={t("form.fields.businessType.label")}
            name="businessType"
            options={businessTypes.map((option) => ({
              label: t(`businessTypes.${option}`),
              value: option,
            }))}
            required
          />
          <SelectField
            error={errorFor("locations")}
            id={fieldIds.locations}
            label={t("form.fields.locations.label")}
            name="locations"
            options={locationOptions.map((option) => ({
              label: t(`locations.${option}`),
              value: option,
            }))}
            required
          />
          <SelectField
            error={errorFor("language")}
            id={fieldIds.language}
            label={t("form.fields.language.label")}
            name="language"
            options={languageOptions.map((option) => ({
              label: t(`languages.${option}`),
              value: option,
            }))}
            required
          />
        </div>
        <TextAreaField
          error={errorFor("message")}
          id={fieldIds.message}
          label={t("form.fields.message.label")}
          name="message"
          placeholder={t("form.fields.message.placeholder")}
          required
        />
        <div>
          <label
            className="flex items-start gap-3 text-sm leading-6 text-muted"
            htmlFor={fieldIds.consent}
          >
            <input
              aria-describedby={errorFor("consent") ? `${fieldIds.consent}-error` : undefined}
              className="mt-1 size-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              id={fieldIds.consent}
              name="consent"
              required
              type="checkbox"
              value="accepted"
            />
            <span>
              {t("form.fields.consent.label")}
              <span aria-hidden="true" className="text-secondary">
                {" "}
                *
              </span>
            </span>
          </label>
          {errorFor("consent") ? (
            <p className="mt-2 text-sm font-medium text-primary" id={`${fieldIds.consent}-error`}>
              {errorFor("consent")}
            </p>
          ) : null}
        </div>
        <div className="rounded-card border border-secondary/30 bg-secondary-soft p-4 text-sm leading-6 text-primary">
          {t("form.developmentNotice")}
        </div>
        {notice ? (
          <p
            className="rounded-card border border-primary/20 bg-primary-soft p-4 text-sm font-medium leading-6 text-primary"
            role="status"
          >
            {notice}
          </p>
        ) : null}
        <button
          className="inline-flex min-h-11 w-full items-center justify-center rounded-control bg-primary px-5 py-2.5 text-sm font-semibold !text-white shadow-luxury transition-standard hover:bg-primary-strong hover:!text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
          type="submit"
        >
          {t("form.submit")}
        </button>
      </form>
    </Card>
  );
}

type TextFieldProps = {
  error?: string;
  id: string;
  label: string;
  name: string;
  placeholder: string;
  required?: boolean;
  type?: string;
};

function TextField({
  error,
  id,
  label,
  name,
  placeholder,
  required = false,
  type = "text",
}: TextFieldProps) {
  return (
    <div>
      <label className="text-sm font-semibold text-text" htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-secondary">
            {" "}
            *
          </span>
        ) : null}
      </label>
      <input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? "true" : "false"}
        className="mt-2 min-h-11 w-full rounded-control border border-border bg-background px-4 py-2.5 text-sm text-text outline-none transition-standard placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/20"
        id={id}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
      {error ? (
        <p className="mt-2 text-sm font-medium text-primary" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

type SelectFieldProps = {
  error?: string;
  id: string;
  label: string;
  name: string;
  options: Array<{ label: string; value: string }>;
  required?: boolean;
};

function SelectField({
  error,
  id,
  label,
  name,
  options,
  required = false,
}: SelectFieldProps) {
  return (
    <div>
      <label className="text-sm font-semibold text-text" htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-secondary">
            {" "}
            *
          </span>
        ) : null}
      </label>
      <select
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? "true" : "false"}
        className="mt-2 min-h-11 w-full rounded-control border border-border bg-background px-4 py-2.5 text-sm text-text outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20"
        defaultValue=""
        id={id}
        name={name}
        required={required}
      >
        <option value="" />
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-2 text-sm font-medium text-primary" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextAreaFieldProps = {
  error?: string;
  id: string;
  label: string;
  name: string;
  placeholder: string;
  required?: boolean;
};

function TextAreaField({
  error,
  id,
  label,
  name,
  placeholder,
  required = false,
}: TextAreaFieldProps) {
  return (
    <div>
      <label className="text-sm font-semibold text-text" htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-secondary">
            {" "}
            *
          </span>
        ) : null}
      </label>
      <textarea
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? "true" : "false"}
        className="mt-2 min-h-36 w-full resize-y rounded-control border border-border bg-background px-4 py-3 text-sm text-text outline-none transition-standard placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/20"
        id={id}
        name={name}
        placeholder={placeholder}
        required={required}
      />
      {error ? (
        <p className="mt-2 text-sm font-medium text-primary" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
