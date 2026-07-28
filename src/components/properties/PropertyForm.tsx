"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import type { ActionState, Property } from "@/features/customers/types";

type PropertyFormText = {
  accessInstructions: string;
  active: string;
  addressLine1: string;
  addressLine2: string;
  apartment: string;
  business: string;
  city: string;
  contactName: string;
  contactPhone: string;
  countryCode: string;
  error: string;
  holidayHome: string;
  hotel: string;
  inactive: string;
  name: string;
  notes: string;
  other: string;
  postalCode: string;
  propertyCode: string;
  propertyType: string;
  save: string;
  saving: string;
};

type PropertyFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  customerId: string;
  property?: Property;
  text: PropertyFormText;
};

const initialState: ActionState = { fieldErrors: {}, formError: null };

function fieldClass(hasError: boolean) {
  return `min-h-11 w-full rounded-control border bg-white px-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    hasError ? "border-red-300" : "border-border"
  }`;
}

function Field({
  defaultValue,
  error,
  label,
  name,
}: {
  defaultValue?: string | null;
  error?: string;
  label: string;
  name: string;
}) {
  return (
    <label className="space-y-2 text-sm font-semibold text-primary">
      <span>{label}</span>
      <input
        className={fieldClass(Boolean(error))}
        defaultValue={defaultValue ?? ""}
        name={name}
      />
    </label>
  );
}

export function PropertyForm({
  action,
  customerId,
  property,
  text,
}: PropertyFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <input name="customerId" type="hidden" value={customerId} />
      {state.formError ? (
        <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {text.error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          defaultValue={property?.name}
          error={state.fieldErrors.name}
          label={text.name}
          name="name"
        />
        <Field defaultValue={property?.propertyCode} label={text.propertyCode} name="propertyCode" />
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.propertyType}</span>
          <select
            className={fieldClass(Boolean(state.fieldErrors.propertyType))}
            defaultValue={property?.propertyType ?? ""}
            name="propertyType"
          >
            <option value="">{text.other}</option>
            <option value="apartment">{text.apartment}</option>
            <option value="holiday_home">{text.holidayHome}</option>
            <option value="hotel">{text.hotel}</option>
            <option value="business">{text.business}</option>
            <option value="other">{text.other}</option>
          </select>
        </label>
        <Field defaultValue={property?.addressLine1} label={text.addressLine1} name="addressLine1" />
        <Field defaultValue={property?.addressLine2} label={text.addressLine2} name="addressLine2" />
        <Field defaultValue={property?.city} label={text.city} name="city" />
        <Field defaultValue={property?.postalCode} label={text.postalCode} name="postalCode" />
        <Field defaultValue={property?.countryCode ?? "ES"} error={state.fieldErrors.countryCode} label={text.countryCode} name="countryCode" />
        <Field defaultValue={property?.contactName} label={text.contactName} name="contactName" />
        <Field defaultValue={property?.contactPhone} error={state.fieldErrors.contactPhone} label={text.contactPhone} name="contactPhone" />
      </div>

      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.accessInstructions}</span>
        <textarea
          className="min-h-28 w-full rounded-control border border-border bg-white px-3 py-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20"
          defaultValue={property?.accessInstructions ?? ""}
          name="accessInstructions"
        />
      </label>

      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.notes}</span>
        <textarea
          className="min-h-28 w-full rounded-control border border-border bg-white px-3 py-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20"
          defaultValue={property?.notes ?? ""}
          name="notes"
        />
      </label>

      <input name="isActive" type="hidden" value={property?.isActive === false ? "false" : "true"} />

      <Button disabled={isPending} type="submit">
        {isPending ? text.saving : text.save}
      </Button>
    </form>
  );
}
