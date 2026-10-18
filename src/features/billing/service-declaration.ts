// Operator-supplied factual declaration, never tenant authorization or proof of
// eligibility. The canonical SQL RPC revalidates the actual invoice and profile.
export function parseBillingServiceDeclaration(form: FormData) {
  const one = (key: string) => {
    const values = form.getAll(key);
    return values.length === 1 && typeof values[0] === "string" ? values[0] : null;
  };
  const date = one("servicePerformedOn");
  const scope = one("operationScope");
  const recipient = one("fiscalRecipientRequirement");
  if (!date || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date
    || one("serviceConfirmed") !== "confirmed" || scope !== "local_laundry_dry_cleaning"
    || !["consumer", "consumer_identified", "business"].includes(recipient ?? "")) return null;
  return { servicePerformedOn: date, operationScope: scope, recipientRequirement: recipient! };
}
